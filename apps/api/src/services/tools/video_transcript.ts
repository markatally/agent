import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../prisma';
import type { Tool, ToolContext, ToolResult, ProgressCallback } from './types';
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

type PersistFileRecordFn = (input: {
  sessionId: string;
  filename: string;
  filepath: string;
  sizeBytes: number;
  mimeType: string;
}) => Promise<string | undefined>;

interface TranscriptSegment {
  start: string;
  end: string;
  text: string;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeFilename(value: string): string {
  return path.basename(value).replace(/[\/\\:*?"<>|\x00]/g, '_');
}

function stripExtension(value: string): string {
  const parsed = path.parse(value);
  return parsed.name || value;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanSubtitleText(value: string): string {
  return normalizeWhitespace(
    decodeBasicEntities(
      value
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{\\an\d\}/g, ' ')
        .replace(/\[[^\]]*?\]/g, ' ')
    )
  );
}

function parseSubtitleSegments(content: string): TranscriptSegment[] {
  const blocks = content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    if (lines[0].toUpperCase() === 'WEBVTT' || lines[0].startsWith('NOTE')) {
      continue;
    }

    let timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;

    const timingLine = lines[timingIndex];
    const timingParts = timingLine.split('-->');
    if (timingParts.length < 2) continue;

    const start = normalizeWhitespace(timingParts[0]).replace(',', '.');
    const end = normalizeWhitespace(timingParts[1]).split(' ')[0].replace(',', '.');
    if (!start || !end) continue;

    const textLines = lines.slice(timingIndex + 1);
    if (textLines.length === 0) continue;

    const text = cleanSubtitleText(textLines.join(' '));
    if (!text) continue;

    const previous = segments.length > 0 ? segments[segments.length - 1] : null;
    // Collapse repeated adjacent subtitle text from auto-generated tracks.
    if (previous && previous.text === text && previous.end === start) {
      previous.end = end;
      continue;
    }

    segments.push({ start, end, text });
  }

  return segments;
}

function buildTranscriptText(
  segments: TranscriptSegment[],
  includeTimestamps: boolean
): string {
  if (includeTimestamps) {
    return segments.map((segment) => `[${segment.start} --> ${segment.end}] ${segment.text}`).join('\n');
  }
  return segments.map((segment) => segment.text).join('\n');
}

function buildSubtitleLanguageSelector(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'auto') {
    return 'all,-live_chat';
  }

  const primary = normalized.split('-')[0];
  const candidates = new Set<string>([
    normalized,
    `${normalized}.*`,
    primary,
    `${primary}.*`,
    'en',
    'en.*',
  ]);

  return `${Array.from(candidates).join(',')},-live_chat`;
}

function scoreSubtitleCandidate(
  filename: string,
  preferredLanguage: string
): number {
  const normalized = filename.toLowerCase();
  const preferred = preferredLanguage.toLowerCase();
  const preferredPrimary = preferred.split('-')[0];

  let score = 0;
  if (normalized.endsWith('.vtt')) score += 40;
  else if (normalized.endsWith('.srt')) score += 30;
  else if (normalized.endsWith('.ass')) score += 20;
  else score += 5;

  if (normalized.includes(`.${preferred}.`)) score += 80;
  if (normalized.includes(`.${preferredPrimary}.`)) score += 60;
  if (normalized.includes('.en.')) score += 30;
  if (normalized.includes('.auto.')) score += 10;

  return score;
}

async function resolveSubtitlePath(
  outputDir: string,
  stem: string,
  preferredLanguage: string
): Promise<string | null> {
  const entries = await fs.readdir(outputDir);
  const candidates = entries.filter((name) => {
    const lower = name.toLowerCase();
    return (
      name.startsWith(`${stem}.`) &&
      (lower.endsWith('.vtt') || lower.endsWith('.srt') || lower.endsWith('.ass'))
    );
  });

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((filename) => ({
      filename,
      score: scoreSubtitleCandidate(filename, preferredLanguage),
    }))
    .sort((a, b) => b.score - a.score);

  return path.join(outputDir, ranked[0].filename);
}

export class VideoTranscriptTool implements Tool {
  name = 'video_transcript';
  description =
    'Extract full transcript text from a video URL using available subtitle tracks and return downloadable transcript artifacts.';
  requiresConfirmation = false;
  timeout = 120000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string' as const,
        description: 'Video page URL to extract transcript from.',
      },
      language: {
        type: 'string' as const,
        description: 'Preferred subtitle language (default: en). Use "auto" to accept any language.',
      },
      includeTimestamps: {
        type: 'boolean' as const,
        description: 'Include [start --> end] timestamps in transcript text (default: true).',
      },
      filename: {
        type: 'string' as const,
        description: 'Optional transcript filename stem (without extension).',
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
  private persistFileRecord: PersistFileRecordFn;

  constructor(
    private context: ToolContext,
    deps?: {
      execFileFn?: ExecFileFn;
      persistFileRecord?: PersistFileRecordFn;
    }
  ) {
    const execFileAsync = promisify(execFile);
    this.execFileFn =
      deps?.execFileFn ??
      (async (command, args, options) => {
        const result = await execFileAsync(command, args, {
          timeout: options?.timeout,
          maxBuffer: options?.maxBuffer ?? 30 * 1024 * 1024,
        });
        return {
          stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout),
          stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr),
        };
      });
    this.persistFileRecord =
      deps?.persistFileRecord ??
      (async (input) => {
        const dbFile = await prisma.file.create({
          data: {
            sessionId: input.sessionId,
            filename: input.filename,
            filepath: input.filepath,
            sizeBytes: BigInt(input.sizeBytes),
            mimeType: input.mimeType,
          },
        });
        return dbFile.id;
      });
  }

  async execute(params: Record<string, any>, onProgress?: ProgressCallback): Promise<ToolResult> {
    const startTime = Date.now();
    const url = String(params.url || '').trim();
    const language = String(params.language || 'en').trim() || 'en';
    const includeTimestamps = params.includeTimestamps !== false;
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

    const outputDir = path.join(process.cwd(), 'outputs', 'transcripts');
    await fs.mkdir(outputDir, { recursive: true });

    const requestedName = String(params.filename || '').trim();
    const stem = sanitizeFilename(
      stripExtension(requestedName) || `transcript-${Date.now().toString(36)}`
    );

    const subtitleSelector = buildSubtitleLanguageSelector(language);
    const subtitleTemplate = path.join(outputDir, `${stem}.%(ext)s`);
    const subtitleArgs = [
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
      '--write-subs',
      '--write-auto-subs',
      '--sub-format',
      'vtt/srt/best',
      '--sub-langs',
      subtitleSelector,
      '--output',
      subtitleTemplate,
    ];
    if (cookiesFromBrowser) {
      subtitleArgs.push('--cookies-from-browser', cookiesFromBrowser);
    }
    subtitleArgs.push(url);

    onProgress?.(10, 100, 'Fetching available subtitle tracks...');

    try {
      await runYtDlpCommand(this.execFileFn, ytDlpRunner, subtitleArgs, {
        timeout: this.timeout,
        maxBuffer: 30 * 1024 * 1024,
      });
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error?.stderr || error?.message || 'Failed to fetch subtitles',
        duration: Date.now() - startTime,
      };
    }

    onProgress?.(55, 100, 'Parsing subtitle transcript...');

    const subtitlePath = await resolveSubtitlePath(outputDir, stem, language);
    if (!subtitlePath) {
      return {
        success: false,
        output: '',
        error:
          'No subtitle track was found for this video URL. Try a different language, set language to "auto", or provide authenticated cookies.',
        duration: Date.now() - startTime,
      };
    }

    const subtitleContent = await fs.readFile(subtitlePath, 'utf8');
    const segments = parseSubtitleSegments(subtitleContent);

    if (segments.length === 0) {
      return {
        success: false,
        output: '',
        error: `Subtitle file was downloaded but no transcript content could be parsed: ${path.basename(subtitlePath)}`,
        duration: Date.now() - startTime,
      };
    }

    const transcriptText = buildTranscriptText(segments, includeTimestamps);
    const transcriptFilename = `${stem}.transcript.txt`;
    const transcriptPath = path.join(outputDir, transcriptFilename);
    await fs.writeFile(transcriptPath, transcriptText, 'utf8');

    const transcriptStats = await fs.stat(transcriptPath);
    const relativeTranscriptPath = `outputs/transcripts/${transcriptFilename}`;

    let fileId: string | undefined;
    if (this.context.sessionId) {
      try {
        fileId = await this.persistFileRecord({
          sessionId: this.context.sessionId,
          filename: transcriptFilename,
          filepath: relativeTranscriptPath,
          sizeBytes: transcriptStats.size,
          mimeType: 'text/plain',
        });
      } catch (error: any) {
        console.warn(
          '[video_transcript] Failed to persist transcript metadata:',
          error?.message || error
        );
      }
    }

    onProgress?.(100, 100, 'Transcript extraction complete');

    const summary = [
      'Transcript extraction completed.',
      `Subtitle source: ${path.basename(subtitlePath)}`,
      `Segments: ${segments.length}`,
      `Transcript file: ${transcriptFilename}`,
      `Path: ${relativeTranscriptPath}`,
    ].join('\n');

    return {
      success: true,
      output: summary,
      duration: Date.now() - startTime,
      artifacts: [
        {
          type: 'file',
          name: transcriptFilename,
          content: '',
          mimeType: 'text/plain',
          fileId,
          size: transcriptStats.size,
        },
        {
          type: 'data',
          name: 'video-transcript.json',
          content: JSON.stringify({
            sourceSubtitleFile: path.basename(subtitlePath),
            language,
            includeTimestamps,
            segmentCount: segments.length,
            transcript: transcriptText,
            segments,
          }),
          mimeType: 'application/json',
        },
      ],
    };
  }
}
