import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolContext, ToolResult } from './types';
import {
  buildYtDlpMissingError,
  resolveYtDlpRunner,
  runYtDlpCommand,
} from './video_runtime';

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileFn = (
  command: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
) => Promise<ExecFileResult>;

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildSummary(data: any, includeFormats: boolean, includeSubtitles: boolean): string {
  const title = toSafeString(data?.title) || 'Unknown title';
  const uploader = toSafeString(data?.uploader) || 'Unknown uploader';
  const webpageUrl = toSafeString(data?.webpage_url);
  const description = toSafeString(data?.description);
  const durationSeconds = Number(data?.duration);
  const duration = Number.isFinite(durationSeconds)
    ? `${Math.floor(durationSeconds / 60)}m ${Math.floor(durationSeconds % 60)}s`
    : 'Unknown';

  const formatCount = Array.isArray(data?.formats) ? data.formats.length : 0;
  const subtitleLangs = includeSubtitles
    ? Array.from(
        new Set([
          ...Object.keys((data?.subtitles as Record<string, unknown>) || {}),
          ...Object.keys((data?.automatic_captions as Record<string, unknown>) || {}),
        ])
      )
    : [];

  const lines = [
    `Video probe result`,
    `Title: ${title}`,
    `Uploader: ${uploader}`,
    `Duration: ${duration}`,
    ...(webpageUrl ? [`URL: ${webpageUrl}`] : []),
    ...(description ? [`Description: ${description.slice(0, 800)}`] : []),
    ...(includeFormats ? [`Formats detected: ${formatCount}`] : []),
    ...(includeSubtitles
      ? [
          `Subtitle languages: ${
            subtitleLangs.length > 0 ? subtitleLangs.join(', ') : 'none detected'
          }`,
        ]
      : []),
  ];

  return lines.join('\n');
}

export class VideoProbeTool implements Tool {
  name = 'video_probe';
  description =
    'Inspect video metadata from a URL (title, duration, uploader, available formats/subtitles) without downloading media.';
  requiresConfirmation = false;
  timeout = 45000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string' as const,
        description: 'Video page URL to inspect.',
      },
      includeFormats: {
        type: 'boolean' as const,
        description: 'Include full format list in artifact JSON (default: false).',
      },
      includeSubtitles: {
        type: 'boolean' as const,
        description: 'Include subtitle language availability (default: true).',
      },
      cookiesFromBrowser: {
        type: 'string' as const,
        description:
          'Optional browser profile for authenticated pages (e.g. chrome, edge, firefox).',
      },
    },
    required: ['url'],
  };

  private execFileFn: ExecFileFn;

  constructor(
    _context: ToolContext,
    deps?: {
      execFileFn?: ExecFileFn;
    }
  ) {
    const execFileAsync = promisify(execFile);
    this.execFileFn =
      deps?.execFileFn ??
      (async (command, args, options) => {
        const result = await execFileAsync(command, args, {
          timeout: options?.timeout,
          maxBuffer: options?.maxBuffer ?? 20 * 1024 * 1024,
        });
        return {
          stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout),
          stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr),
        };
      });
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const url = String(params.url || '').trim();
    const includeFormats = params.includeFormats === true;
    const includeSubtitles = params.includeSubtitles !== false;
    const cookiesFromBrowser = String(params.cookiesFromBrowser || '').trim();

    if (!url || !isHttpUrl(url)) {
      return {
        success: false,
        output: '',
        error: 'A valid http/https video URL is required',
        duration: Date.now() - startTime,
      };
    }

    const ytDlpRunner = await resolveYtDlpRunner(this.execFileFn);
    if (!ytDlpRunner) {
      return {
        success: false,
        output: '',
        error: buildYtDlpMissingError(),
        duration: Date.now() - startTime,
      };
    }

    const args = ['--no-playlist', '--dump-single-json', '--no-warnings'];
    if (cookiesFromBrowser) {
      args.push('--cookies-from-browser', cookiesFromBrowser);
    }
    args.push(url);

    try {
      const { stdout } = await runYtDlpCommand(this.execFileFn, ytDlpRunner, args, {
        timeout: this.timeout,
        maxBuffer: 30 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout || '{}');
      const summary = buildSummary(parsed, includeFormats, includeSubtitles);

      const artifactPayload: Record<string, unknown> = {
        title: parsed?.title,
        uploader: parsed?.uploader,
        duration: parsed?.duration,
        webpage_url: parsed?.webpage_url,
        description: parsed?.description,
      };
      if (includeFormats) artifactPayload.formats = parsed?.formats;
      if (includeSubtitles) {
        artifactPayload.subtitles = parsed?.subtitles || {};
        artifactPayload.automatic_captions = parsed?.automatic_captions || {};
      }

      return {
        success: true,
        output: summary,
        duration: Date.now() - startTime,
        artifacts: [
          {
            type: 'data',
            name: 'video-probe.json',
            content: JSON.stringify(artifactPayload),
            mimeType: 'application/json',
          },
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error?.stderr || error?.message || 'Failed to probe video metadata',
        duration: Date.now() - startTime,
      };
    }
  }
}
