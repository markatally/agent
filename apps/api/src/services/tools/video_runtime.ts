type ExecFileResult = { stdout: string; stderr: string };
type ExecFileFn = (
  command: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
) => Promise<ExecFileResult>;

export type YtDlpRunner = {
  command: string;
  baseArgs: string[];
  label: 'yt-dlp' | 'python3 -m yt_dlp' | 'python -m yt_dlp';
};

const YTDLP_CANDIDATES: YtDlpRunner[] = [
  { command: 'yt-dlp', baseArgs: [], label: 'yt-dlp' },
  { command: 'python3', baseArgs: ['-m', 'yt_dlp'], label: 'python3 -m yt_dlp' },
  { command: 'python', baseArgs: ['-m', 'yt_dlp'], label: 'python -m yt_dlp' },
];

export async function resolveYtDlpRunner(
  execFileFn: ExecFileFn
): Promise<YtDlpRunner | null> {
  for (const candidate of YTDLP_CANDIDATES) {
    try {
      await execFileFn(candidate.command, [...candidate.baseArgs, '--version'], {
        timeout: 10000,
      });
      return candidate;
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function runYtDlpCommand(
  execFileFn: ExecFileFn,
  runner: YtDlpRunner,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
): Promise<ExecFileResult> {
  return execFileFn(runner.command, [...runner.baseArgs, ...args], options);
}

export function buildYtDlpMissingError(): string {
  return [
    'yt-dlp is not available in this runtime.',
    'Tried: yt-dlp, python3 -m yt_dlp, python -m yt_dlp.',
    'Install with: pip install yt-dlp',
  ].join(' ');
}
