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

function extractSegmentCount(output: string): number {
  const match = output.match(/Segments:\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

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

  it('returns structured YTDLP_NOT_FOUND error when all yt-dlp runners are missing', async () => {
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async () => {
        throw new Error('runner missing');
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      filename: 'install-attempt-test',
    });

    expect(result.success).toBe(false);
    const parsed = JSON.parse(result.error!);
    expect(parsed.code).toBe('YTDLP_NOT_FOUND');
    expect(parsed.installCommands).toBeDefined();
    expect(parsed.installCommands.length).toBeGreaterThan(0);
    expect(parsed.recoveryHint).toContain('bash_executor');
  });

  it('captures at least 10 preview snapshots for shorter videos when ffmpeg is available', async () => {
    const progressMessages: string[] = [];
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        if (command === 'ffprobe') {
          return { stdout: '400\n', stderr: '' };
        }

        if (command === 'ffmpeg') {
          const outputPath = args[args.length - 1];
          await fs.writeFile(outputPath, Buffer.from(`frame-${outputPath}`));
          return { stdout: '', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const outputPath = template.replace('.%(ext)s', '.mp4');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, 'video-content');
        return { stdout: `${outputPath}\n`, stderr: '' };
      },
      persistFileRecord: async () => 'file-with-snapshots',
    });

    const result = await tool.execute(
      {
        url: 'https://example.com/video',
        filename: 'download-with-snapshots',
      },
      (_current, _total, message) => {
        if (message) progressMessages.push(message);
      }
    );

    expect(result.success).toBe(true);
    expect(Array.isArray(result.previewSnapshots)).toBe(true);
    expect(result.previewSnapshots?.length).toBe(10);
    expect(result.previewSnapshots?.every((item) => item.startsWith('data:image/jpeg;base64,'))).toBe(
      true
    );
    expect(result.output).toContain('Snapshots: 10 frame');
    expect(progressMessages.some((msg) => msg.startsWith('__video_snapshot__'))).toBe(true);
  });

  it('caps preview snapshots at 20 for longer videos', async () => {
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        if (command === 'ffprobe') {
          return { stdout: '7200\n', stderr: '' };
        }

        if (command === 'ffmpeg') {
          const outputPath = args[args.length - 1];
          await fs.writeFile(outputPath, Buffer.from(`frame-${outputPath}`));
          return { stdout: '', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const outputPath = template.replace('.%(ext)s', '.mp4');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, 'video-content');
        return { stdout: `${outputPath}\n`, stderr: '' };
      },
      persistFileRecord: async () => 'file-with-many-snapshots',
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      filename: 'download-long-video',
    });

    expect(result.success).toBe(true);
    expect(result.previewSnapshots?.length).toBe(20);
    expect(result.output).toContain('Snapshots: 20 frame');
  });

  it('skips preview snapshots when ffmpeg is unavailable', async () => {
    const tool = new VideoDownloadTool(mockContext, {
      execFileFn: async (command, args) => {
        if (args.includes('--version')) {
          if (command === 'ffmpeg') {
            throw new Error('ffmpeg missing');
          }
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const outputPath = template.replace('.%(ext)s', '.mp4');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, 'video-content');
        return { stdout: `${outputPath}\n`, stderr: '' };
      },
      persistFileRecord: async () => 'file-no-snapshots',
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      filename: 'download-no-snapshots',
    });

    expect(result.success).toBe(true);
    expect(result.previewSnapshots).toBeUndefined();
    expect(result.output).not.toContain('Snapshots:');
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
    expect(result.artifacts?.length).toBe(1);
    expect(result.output).toContain('Hello world');
    expect(result.output).toContain('[00:00:00.000 --> 00:00:02.000]');
    expect(extractSegmentCount(result.output)).toBe(2);
  });

  it('captures preview snapshots for transcript-only analysis flows', async () => {
    const progressMessages: string[] = [];
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        if (command === 'ffprobe') {
          return { stdout: '400\n', stderr: '' };
        }

        if (command === 'ffmpeg') {
          const outputPath = args[args.length - 1];
          await fs.writeFile(outputPath, Buffer.from(`frame-${outputPath}`));
          return { stdout: '', stderr: '' };
        }

        const outputIndex = args.findIndex((value) => value === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';

        if (args.includes('--write-subs')) {
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
              'Snapshot path test',
              '',
            ].join('\n'),
            'utf8'
          );
          return { stdout: '', stderr: '' };
        }

        if (args.includes('--format')) {
          const snapshotVideoPath = template.replace('.%(ext)s', '.mp4');
          await fs.mkdir(path.dirname(snapshotVideoPath), { recursive: true });
          await fs.writeFile(snapshotVideoPath, 'fake snapshot video content');
          return { stdout: `${snapshotVideoPath}\n`, stderr: '' };
        }

        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async () => 'file-transcript-with-snapshots',
    });

    const result = await tool.execute(
      {
        url: 'https://example.com/video',
        language: 'en',
        includeTimestamps: true,
        filename: 'transcript-snapshot-test',
      },
      (_current, _total, message) => {
        if (message) progressMessages.push(message);
      }
    );

    expect(result.success).toBe(true);
    expect(Array.isArray(result.previewSnapshots)).toBe(true);
    expect(result.previewSnapshots?.length).toBe(10);
    expect(result.previewSnapshots?.every((item) => item.startsWith('data:image/jpeg;base64,'))).toBe(
      true
    );
    expect(result.output).toContain('Snapshots: 10 frame');
    expect(progressMessages.some((msg) => msg.startsWith('__video_snapshot__'))).toBe(true);
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
    const parsed = JSON.parse(result.error!);
    expect(parsed.code).toBe('YTDLP_NOT_FOUND');
    expect(parsed.installCommands).toBeDefined();
  });

  it('falls back to Whisper when no subtitles are found', async () => {
    let persistedFilename = '';
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (command, args) => {
        // yt-dlp version check
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        // yt-dlp subtitle extraction — produce no subtitle files
        if (args.includes('--write-subs')) {
          const outputIndex = args.findIndex((v) => v === '--output');
          const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(template), { recursive: true });
          // No subtitle files written
          return { stdout: '', stderr: '' };
        }
        // whisper --help probe
        if (args.includes('--help') && (command === 'whisper' || args.includes('whisper'))) {
          return { stdout: 'usage: whisper', stderr: '' };
        }
        // yt-dlp audio extraction
        if (args.includes('--extract-audio')) {
          const outputIndex = args.findIndex((v) => v === '--output');
          const audioPath = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(audioPath), { recursive: true });
          await fs.writeFile(audioPath, 'fake wav data');
          return { stdout: '', stderr: '' };
        }
        // whisper transcription
        if (args.includes('--output_format')) {
          const audioArg = args.find((a) => a.endsWith('.wav'));
          const dirIndex = args.findIndex((v) => v === '--output_dir');
          const outputDir = dirIndex >= 0 ? args[dirIndex + 1] : '';
          const stem = path.basename(audioArg || '', '.wav');
          const srtPath = path.join(outputDir, `${stem}.srt`);
          await fs.writeFile(
            srtPath,
            [
              '1',
              '00:00:00,000 --> 00:00:03,000',
              'Whisper transcribed line one',
              '',
              '2',
              '00:00:03,000 --> 00:00:06,000',
              'Whisper transcribed line two',
              '',
            ].join('\n'),
            'utf8'
          );
          return { stdout: '', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async (input) => {
        persistedFilename = input.filename;
        return 'file-whisper-789';
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/no-subs-video',
      language: 'zh',
      includeTimestamps: true,
      filename: 'whisper-fallback-test',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(result.output).toContain('whisper:');
    expect(persistedFilename).toBe('whisper-fallback-test.transcript.txt');
    expect(result.artifacts?.length).toBe(1);
    expect(result.output).toContain('Whisper transcribed line one');
    expect(extractSegmentCount(result.output)).toBe(2);
  });

  it('scales whisper-related timeouts dynamically with long video durations', async () => {
    let seenAudioTimeout = 0;
    let seenWhisperTimeout = 0;
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (command, args, options) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        if (args.includes('--write-subs')) {
          // Force fallback to Whisper by not writing subtitle files.
          const outputIndex = args.findIndex((v) => v === '--output');
          const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(template), { recursive: true });
          return { stdout: '', stderr: '' };
        }
        if (args.includes('--help') && (command === 'whisper' || args.includes('whisper'))) {
          return { stdout: 'usage: whisper', stderr: '' };
        }
        if (args.includes('--extract-audio')) {
          seenAudioTimeout = Number(options?.timeout || 0);
          const outputIndex = args.findIndex((v) => v === '--output');
          const audioPath = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(audioPath), { recursive: true });
          await fs.writeFile(audioPath, 'fake wav data');
          return { stdout: '', stderr: '' };
        }
        if (args.includes('--output_format')) {
          seenWhisperTimeout = Number(options?.timeout || 0);
          const audioArg = args.find((a) => a.endsWith('.wav'));
          const dirIndex = args.findIndex((v) => v === '--output_dir');
          const outputDir = dirIndex >= 0 ? args[dirIndex + 1] : '';
          const stem = path.basename(audioArg || '', '.wav');
          const srtPath = path.join(outputDir, `${stem}.srt`);
          await fs.writeFile(
            srtPath,
            ['1', '00:00:00,000 --> 00:00:03,000', '长视频动态超时测试', ''].join('\n'),
            'utf8'
          );
          return { stdout: '', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async () => 'file-dynamic-timeout',
    });

    const result = await tool.execute({
      url: 'https://example.com/very-long-video',
      language: 'zh',
      includeTimestamps: true,
      filename: 'dynamic-timeout-test',
      durationSeconds: 5400, // 90 minutes
    });

    expect(result.success).toBe(true);
    expect(seenAudioTimeout).toBeGreaterThan(300000);
    expect(seenWhisperTimeout).toBeGreaterThan(300000);
    expect(seenWhisperTimeout).toBeGreaterThan(seenAudioTimeout);
  });

  it('returns WHISPER_NOT_FOUND error when whisper missing and no subtitles', async () => {
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (command, args) => {
        // yt-dlp version check succeeds
        if (args.includes('--version')) {
          if (command === 'yt-dlp') return { stdout: '2026.01.01\n', stderr: '' };
          throw new Error('not found');
        }
        // yt-dlp subtitle extraction — no subtitle files
        if (args.includes('--write-subs')) {
          const outputIndex = args.findIndex((v) => v === '--output');
          const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(template), { recursive: true });
          return { stdout: '', stderr: '' };
        }
        // whisper --help probe fails for all candidates
        if (args.includes('--help')) {
          throw new Error('whisper not found');
        }
        return { stdout: '', stderr: '' };
      },
    });

    const result = await tool.execute({
      url: 'https://example.com/no-subs-video',
      filename: 'whisper-missing-test',
    });

    expect(result.success).toBe(false);
    const parsed = JSON.parse(result.error!);
    expect(parsed.code).toBe('WHISPER_NOT_FOUND');
    expect(parsed.installCommands).toBeDefined();
    expect(parsed.installCommands.length).toBeGreaterThan(0);
  });

  it('auto-retries with browser cookies when subtitles need login', async () => {
    const cookiesUsed: string[] = [];
    let persistedFilename = '';
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        if (args.includes('--write-subs')) {
          const outputIndex = args.findIndex((v) => v === '--output');
          const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
          await fs.mkdir(path.dirname(template), { recursive: true });

          const cookieIndex = args.findIndex((v) => v === '--cookies-from-browser');
          const browser = cookieIndex >= 0 ? args[cookieIndex + 1] : null;

          if (!browser) {
            // First attempt without cookies: return auth warning, no subtitle files
            cookiesUsed.push('none');
            return {
              stdout: '',
              stderr: 'WARNING: [BiliBili] Subtitles are only available when logged in. Use --cookies-from-browser or --cookies for the authentication.',
            };
          }

          // Retry with browser cookies
          cookiesUsed.push(browser);
          if (browser === 'chrome') {
            // Simulate successful subtitle download with chrome cookies
            const subtitlePath = template.replace('.%(ext)s', '.ai-zh.srt');
            await fs.writeFile(
              subtitlePath,
              [
                '1',
                '00:00:00,080 --> 00:00:03,080',
                '自动重试成功的字幕内容',
                '',
              ].join('\n'),
              'utf8'
            );
          }
          return { stdout: '', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async (input) => {
        persistedFilename = input.filename;
        return 'file-auto-retry';
      },
    });

    const result = await tool.execute({
      url: 'https://www.bilibili.com/video/BV1itzyBJErX',
      language: 'zh',
      includeTimestamps: true,
      filename: 'auth-retry-test',
      // No cookiesFromBrowser — should auto-retry
    });

    // Should have tried without cookies first, then retried with chrome
    expect(cookiesUsed).toContain('none');
    expect(cookiesUsed).toContain('chrome');
    // Should succeed via auto-retry
    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(persistedFilename).toBe('auth-retry-test.transcript.txt');
  });

  it('handles Bilibili ai-zh subtitle tracks correctly', async () => {
    let persistedFilename = '';
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((v) => v === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        // Simulate Bilibili writing an ai-zh.srt file
        const subtitlePath = template.replace('.%(ext)s', '.ai-zh.srt');
        await fs.mkdir(path.dirname(subtitlePath), { recursive: true });
        await fs.writeFile(
          subtitlePath,
          [
            '1',
            '00:00:00,080 --> 00:00:03,080',
            '这期视频呢会跟大家分享一下这三部分的内容',
            '',
            '2',
            '00:00:03,080 --> 00:00:04,680',
            'clouds skills的工作原理',
            '',
            '3',
            '00:00:04,680 --> 00:00:07,480',
            '了解一点原理是必不可少的',
            '',
          ].join('\n'),
          'utf8'
        );
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async (input) => {
        persistedFilename = input.filename;
        return 'file-bilibili-ai-zh';
      },
    });

    const result = await tool.execute({
      url: 'https://www.bilibili.com/video/BV1itzyBJErX',
      language: 'zh',
      includeTimestamps: true,
      filename: 'bilibili-ai-zh-test',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(result.output).toContain('ai-zh.srt');
    expect(persistedFilename).toBe('bilibili-ai-zh-test.transcript.txt');
    expect(result.artifacts?.length).toBe(1);
    expect(result.output).toContain('这期视频呢会跟大家分享一下这三部分的内容');
    expect(result.output).toContain('clouds skills的工作原理');
    expect(extractSegmentCount(result.output)).toBe(3);
  });

  it('includes transcript text in output field for conversation history', async () => {
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        const outputIndex = args.findIndex((v) => v === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const subtitlePath = template.replace('.%(ext)s', '.en.vtt');
        await fs.mkdir(path.dirname(subtitlePath), { recursive: true });
        await fs.writeFile(
          subtitlePath,
          [
            'WEBVTT',
            '',
            '00:00:00.000 --> 00:00:02.000',
            'First line of dialogue',
            '',
            '00:00:02.000 --> 00:00:04.000',
            'Second line of dialogue',
            '',
          ].join('\n'),
          'utf8'
        );
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async () => 'file-output-check',
    });

    const result = await tool.execute({
      url: 'https://example.com/video',
      language: 'en',
      includeTimestamps: true,
      filename: 'output-text-test',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('--- Transcript ---');
    expect(result.output).toContain('First line of dialogue');
    expect(result.output).toContain('Second line of dialogue');
  });

  it('does not truncate long transcript text in output', async () => {
    const longSegments = Array.from({ length: 280 }, (_, i) => `Line ${i + 1}: 这是第${i + 1}段转录文本`).join('\n');
    const toSrtTs = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},000`;
    };
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }
        const outputIndex = args.findIndex((v) => v === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const subtitlePath = template.replace('.%(ext)s', '.zh.srt');
        await fs.mkdir(path.dirname(subtitlePath), { recursive: true });

        // Build deterministic long SRT content.
        const srtLines: string[] = [];
        for (let i = 0; i < 280; i += 1) {
          const startSec = i;
          const endSec = i + 1;
          srtLines.push(String(i + 1));
          srtLines.push(`${toSrtTs(startSec)} --> ${toSrtTs(endSec)}`);
          srtLines.push(`Line ${i + 1}: 这是第${i + 1}段转录文本`);
          srtLines.push('');
        }
        await fs.writeFile(subtitlePath, srtLines.join('\n'), 'utf8');
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async () => 'file-long-transcript',
    });

    const result = await tool.execute({
      url: 'https://example.com/long-video',
      language: 'zh',
      includeTimestamps: true,
      filename: 'long-transcript-output-test',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('--- Transcript ---');
    expect(result.output).not.toContain('[truncated]');
    expect(result.output).toContain('Line 1: 这是第1段转录文本');
    expect(result.output).toContain('Line 280: 这是第280段转录文本');
    expect(result.output).toContain(longSegments.split('\n')[120]);
  });

  it('deduplicates overlapping incremental subtitle cues from auto-generated tracks', async () => {
    const tool = new VideoTranscriptTool(mockContext, {
      execFileFn: async (_command, args) => {
        if (args.includes('--version')) {
          return { stdout: '2026.01.01\n', stderr: '' };
        }

        const outputIndex = args.findIndex((v) => v === '--output');
        const template = outputIndex >= 0 ? args[outputIndex + 1] : '';
        const subtitlePath = template.replace('.%(ext)s', '.en.vtt');
        await fs.mkdir(path.dirname(subtitlePath), { recursive: true });
        await fs.writeFile(
          subtitlePath,
          [
            'WEBVTT',
            '',
            '00:00:00.160 --> 00:00:02.800',
            'ZAI just released their new model GLM5.',
            '',
            '00:00:02.800 --> 00:00:04.630',
            'ZAI just released their new model GLM5. So I ran it through the same benchmark',
            '',
            '00:00:04.630 --> 00:00:04.640',
            'So I ran it through the same benchmark',
            '',
            '00:00:04.640 --> 00:00:07.909',
            'So I ran it through the same benchmark tests I used on Opus 4.6 and GPT 5.3',
            '',
            '00:00:07.909 --> 00:00:07.919',
            'tests I used on Opus 4.6 and GPT 5.3',
            '',
            '00:00:07.919 --> 00:00:10.310',
            'tests I used on Opus 4.6 and GPT 5.3 codecs. Same prompts, same setup, same',
            '',
          ].join('\n'),
          'utf8'
        );
        return { stdout: '', stderr: '' };
      },
      persistFileRecord: async () => 'file-overlap-dedupe',
    });

    const result = await tool.execute({
      url: 'https://www.youtube.com/watch?v=CQILCWuQqdo',
      language: 'en',
      includeTimestamps: true,
      filename: 'incremental-overlap-test',
    });

    expect(result.success).toBe(true);
    expect(extractSegmentCount(result.output)).toBeLessThanOrEqual(3);
    expect(result.output).toContain('ZAI just released their new model GLM5. So I ran it through the same benchmark');
    expect(result.output).toContain('tests I used on Opus 4.6 and GPT 5.3 codecs. Same prompts, same setup, same');
    expect(result.output).not.toContain(
      '[00:00:04.630 --> 00:00:04.640] So I ran it through the same benchmark'
    );
    expect(result.output).not.toContain(
      '[00:00:07.909 --> 00:00:07.919] tests I used on Opus 4.6 and GPT 5.3'
    );
  });
});
