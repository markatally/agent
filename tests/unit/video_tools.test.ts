import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { VideoProbeTool } from '../../apps/api/src/services/tools/video_probe';
import { VideoDownloadTool } from '../../apps/api/src/services/tools/video_download';
import { VideoTranscriptTool } from '../../apps/api/src/services/tools/video_transcript';
import type { ToolContext } from '../../apps/api/src/services/tools/types';

const mockContext: ToolContext = {
  sessionId: 'video-tools-session',
  userId: 'video-tools-user',
  workspaceDir: '/tmp/video-tools-workspace',
};

async function safeCleanup(filepath: string): Promise<void> {
  await fs.rm(filepath, { recursive: true, force: true }).catch(() => {});
}

afterEach(async () => {
  await safeCleanup(path.join(process.cwd(), 'outputs', 'video'));
  await safeCleanup(path.join(process.cwd(), 'outputs', 'transcripts'));
});

describe('VideoProbeTool', () => {
  it('returns validation error for invalid URL', async () => {
    const tool = new VideoProbeTool(mockContext);
    const result = await tool.execute({ url: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid http/https video URL');
  });

  it('returns metadata artifact when probe succeeds', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const tool = new VideoProbeTool(mockContext, {
      execFileFn: async (command, args) => {
        calls.push({ command, args });
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        return {
          stdout: JSON.stringify({
            title: 'Demo Video',
            uploader: 'Demo Channel',
            duration: 90,
            webpage_url: 'https://example.com/video',
            subtitles: { en: [{ ext: 'vtt' }] },
            automatic_captions: {},
          }),
          stderr: '',
        };
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      includeFormats: true,
      includeSubtitles: true,
      cookiesFromBrowser: 'chrome',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Demo Video');
    expect(result.output).toContain('Subtitle languages: en');
    const artifact = result.artifacts?.find((item) => item.name === 'video-probe.json');
    expect(artifact).toBeDefined();
    const parsed = JSON.parse(String(artifact?.content || '{}'));
    expect(parsed.title).toBe('Demo Video');
    expect(parsed.subtitles).toBeDefined();
    const commandCall = calls.find((entry) => entry.args.includes('--dump-single-json'));
    expect(commandCall).toBeDefined();
    expect(commandCall!.args).toContain('--cookies-from-browser');
  });
});

describe('VideoDownloadTool', () => {
  it('creates downloadable file artifact and persists metadata', async () => {
    let persistedFilename = '';
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const outputPath = template.replace('.%(ext)s', '.mp4');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, 'fake video content');
        return { stdout: `${outputPath}\n`, stderr: '' };
      },
      persistFileRecord: async (input) => {
        persistedFilename = input.filename;
        return 'file-video-123';
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      container: 'mp4',
      quality: '720p',
      filename: 'unit-video-download',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Video download completed.');
    expect(persistedFilename).toContain('unit-video-download');
    const artifact = result.artifacts?.find((item) => item.type === 'file');
    expect(artifact).toBeDefined();
    expect(artifact?.fileId).toBe('file-video-123');
    expect(artifact?.name.toLowerCase().endsWith('.mp4')).toBe(true);
  });

  it('falls back to python3 -m yt_dlp when yt-dlp binary is unavailable', async () => {
    const seenCommands: string[] = [];
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (command, args) => {
        seenCommands.push(command);
        if (args.includes('--version')) {
          if (command === 'yt-dlp') {
            throw new Error('yt-dlp missing');
          }
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const outputPath = template.replace('.%(ext)s', '.mp4');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, 'video-by-python-module');
        return { stdout: `${outputPath}\n`, stderr: '' };
      },
      persistFileRecord: async () => 'file-python-fallback',
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      filename: 'fallback-download',
    });

    expect(result.success).toBe(true);
    expect(seenCommands).toContain('yt-dlp');
    expect(seenCommands).toContain('python3');
  });

  it('attempts auto-install before failing when all yt-dlp runners are missing', async () => {
    const seenInvocations: Array<string> = [];
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (command, args) => {
        seenInvocations.push(`${command} ${args.join(' ')}`.trim());
        if (args.includes('pip') || command === 'pip3') {
          throw new Error('install failed');
        }
        throw new Error('runner missing');
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      filename: 'install-attempt-test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Automatic installation attempt failed');
    expect(seenInvocations.some((value) => value.startsWith('python3 -m pip install --user yt-dlp'))).toBe(true);
  });
});

describe('VideoTranscriptTool', () => {
  it('extracts transcript from subtitle file and returns file artifact', async () => {
    let persistedFilename = '';
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const subtitlePath = template.replace('.%(ext)s', '.en.vtt');
        await fs.mkdir(path.dirname(subtitlePath), { recursive: true });
        await fs.writeFile(
          subtitlePath,
          [
            'WEBVTT',
            '',
            '00:00:00.000 --> 00:00:02.000',
            'Hello world',
            '',
            '00:00:02.000 --> 00:00:04.000',
            'This is a test',
            '',
          ].join('\n'),
          'utf8'
        );
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async (input) => {
        persistedFilename = input.filename;
        return 'file-transcript-456';
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      language: 'en',
      includeTimestamps: true,
      filename: 'unit-video-transcript',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(persistedFilename).toBe('unit-video-transcript.transcript.txt');

    const transcriptArtifact = result.artifacts?.find(
      (item) => item.type === 'file' && item.name.endsWith('.transcript.txt')
    );
    expect(transcriptArtifact?.fileId).toBe('file-transcript-456');

    const dataArtifact = result.artifacts?.find((item) => item.name === 'video-transcript.json');
    expect(dataArtifact).toBeDefined();
    const payload = JSON.parse(String(dataArtifact?.content || '{}'));
    expect(payload.segmentCount).toBe(2);
    expect(payload.transcript).toContain('Hello world');
    expect(payload.transcript).toContain('[00:00:00.000 --> 00:00:02.000]');
  });

  it('returns install guidance when no yt-dlp runner is available', async () => {
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async () => {
        throw new Error('missing');
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Install with: pip install yt-dlp');
  });
});
