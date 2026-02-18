/**
 * Integration test: end-to-end robustness checks for video transcript QA
 * on a real Bilibili URL (network + yt-dlp + optional browser cookies).
 *
 * This test is opt-in by design.
 *
 * Run:
 *   RUN_BILIBILI_VIDEO_ROBUSTNESS=1 bun test tests/integration/bilibili_video_analysis_robustness.test.ts
 */
import { describe, expect, it } from 'bun:test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { VideoTranscriptTool } from '../../apps/api/src/services/tools/video_transcript';
import type { ToolContext } from '../../apps/api/src/services/tools/types';
import { answerVideoQueryFromTranscript } from '../../apps/api/src/services/transcript-qa';
import { parseTranscriptDocument } from '../../apps/api/src/services/transcript-qa/parser';

const execFileAsync = promisify(execFile);
const TARGET_URL = 'https://www.bilibili.com/video/BV11nzjBnEuQ';
const ENABLED = process.env.RUN_BILIBILI_VIDEO_ROBUSTNESS === '1';

const toolContext: ToolContext = {
  sessionId: 'bilibili-video-robustness',
  userId: 'robustness-user',
  workspaceDir: '/tmp/bilibili-video-robustness',
};

async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

function buildRobustnessLlm() {
  return {
    async *streamChat(messages: Array<{ role: string; content: string | null }>) {
      const system = String(messages?.[0]?.content || '');
      const user = String(messages?.[1]?.content || '');
      if (system.includes('You classify user intent for transcript QA')) {
        const queryLine = user.split('\n').find((line) => line.startsWith('Query:')) || '';
        const query = queryLine.replace(/^Query:\s*/, '');
        if (/前1\/3|前三分之一|first third/i.test(query)) {
          yield {
            type: 'content' as const,
            content:
              '{"intent":"summary","range":{"type":"relative","anchor":"head","numerator":1,"denominator":3},"language":"auto"}',
          };
          yield { type: 'done' as const, finishReason: 'stop' };
          return;
        }
        if (/后面1\/2|后半|最后一半|last half|última mitad/i.test(query)) {
          yield {
            type: 'content' as const,
            content:
              '{"intent":"time_range","range":{"type":"relative","anchor":"tail","numerator":1,"denominator":2},"language":"auto"}',
          };
          yield { type: 'done' as const, finishReason: 'stop' };
          return;
        }
        yield {
          type: 'content' as const,
          content: '{"intent":"summary","range":{"type":"none"},"language":"auto"}',
        };
        yield { type: 'done' as const, finishReason: 'stop' };
        return;
      }

      // Keep answers extractive/deterministic in integration checks.
      yield { type: 'done' as const, finishReason: 'stop' };
    },
    async embedTexts(texts: string[]) {
      return texts.map((text) => {
        const vec = new Array<number>(32).fill(0);
        for (let i = 0; i < text.length; i += 1) {
          vec[i % vec.length] += (text.charCodeAt(i) % 41) / 41;
        }
        return vec;
      });
    },
  };
}

describe('Bilibili Video Analysis Robustness (Integration)', () => {
  it('runs multilingual summary/follow-up robustness checks on BV11nzjBnEuQ', async () => {
    if (!ENABLED) {
      console.warn('SKIP: set RUN_BILIBILI_VIDEO_ROBUSTNESS=1 to run this integration test');
      return;
    }

    const ytdlpReady = await isYtDlpAvailable();
    if (!ytdlpReady) {
      console.warn('SKIP: yt-dlp not installed');
      return;
    }

    const transcriptTool = new VideoTranscriptTool(toolContext, {
      persistFileRecord: async () => 'bilibili-video-robustness-file-id',
    });

    const transcriptResult = await transcriptTool.execute({
      url: TARGET_URL,
      language: 'zh',
      includeTimestamps: true,
      filename: 'bilibili-video-robustness',
      cookiesFromBrowser: process.env.BILIBILI_COOKIES_BROWSER || undefined,
    });

    expect(transcriptResult.success).toBe(true);
    expect(transcriptResult.output).toContain('--- Transcript ---');

    const marker = '--- Transcript ---';
    const transcriptText = transcriptResult.output.includes(marker)
      ? transcriptResult.output.slice(transcriptResult.output.indexOf(marker) + marker.length).trim()
      : '';
    expect(transcriptText.length).toBeGreaterThan(800);

    const doc = parseTranscriptDocument(transcriptText);
    const duration = doc.segments[doc.segments.length - 1]?.endSeconds ?? 0;
    expect(duration).toBeGreaterThan(180);

    const llm = buildRobustnessLlm();
    const scenarios = [
      '请总结这个视频的核心内容',
      '视频前1/3重点讲了什么？',
      '后面1/2讲了啥？',
      'What does the last half cover?',
      '¿Qué explica la última mitad?',
      '视频 01:00 到 02:30 讲了什么？',
      '这个视频有没有讲摩斯密码？',
    ];

    for (const query of scenarios) {
      const result = await answerVideoQueryFromTranscript({
        llm,
        userQuery: query,
        transcriptText,
      });

      expect(result.content.length).toBeGreaterThan(20);
      expect(result.content).not.toContain('fluffy cat');

      if (/前1\/3|后面1\/2|last half|última mitad|01:00 到 02:30/.test(query)) {
        expect(result.content).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}|\[\d{2}:\d{2}:\d{2}/);
      }
    }
  }, 180000);
});
