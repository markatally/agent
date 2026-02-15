/**
 * Integration test: Bilibili video transcript extraction (real network).
 *
 * Tests the FULL pipeline including the auto-retry-with-cookies behavior
 * that a real user chat session would exercise:
 *   1. First attempt: no cookies → yt-dlp warns about auth
 *   2. Auto-retry with browser cookies (chrome) → subtitles found
 *   3. SRT parsing with timestamps
 *   4. Transcript file persistence
 *
 * Prerequisites:
 *   - yt-dlp installed (brew install yt-dlp)
 *   - Chrome browser with Bilibili login session
 *
 * Run: bun test tests/integration/bilibili_transcript.test.ts
 */
import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { VideoTranscriptTool } from '../../apps/api/src/services/tools/video_transcript';
import type { ToolContext } from '../../apps/api/src/services/tools/types';

const execFileAsync = promisify(execFile);

const BILIBILI_URL = 'https://www.bilibili.com/video/BV1itzyBJErX';
const TRANSCRIPT_DIR = path.join(process.cwd(), 'outputs', 'transcripts');

const mockContext: ToolContext = {
  sessionId: 'bilibili-integration-test',
  userId: 'test-user',
  workspaceDir: '/tmp/bilibili-test-workspace',
};

// Check if yt-dlp is available before running
async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

function extractSegmentCount(output: string): number {
  const match = output.match(/Segments:\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

function assertTranscriptText(content: string) {
  expect(content.length).toBeGreaterThan(500);
  expect(content).toMatch(/\[\d{2}:\d{2}:\d{2}/);
  expect(content).toMatch(/[一-龥]/);
}

afterAll(async () => {
  // Clean up generated transcript files
  const entries = await fs.readdir(TRANSCRIPT_DIR).catch(() => []);
  for (const entry of entries) {
    if (entry.startsWith('bilibili-integration-')) {
      await fs.rm(path.join(TRANSCRIPT_DIR, entry), { force: true }).catch(() => {});
    }
  }
});

describe('Bilibili Transcript Extraction (Integration)', () => {
  it('extracts transcript with explicit cookiesFromBrowser', async () => {
    const ytdlpReady = await isYtDlpAvailable();
    if (!ytdlpReady) {
      console.warn('SKIP: yt-dlp not installed');
      return;
    }

    const progressMessages: string[] = [];
    const tool = new VideoTranscriptTool(mockContext, {
      persistFileRecord: async () => 'integration-file-id',
    });

    const result = await tool.execute(
      {
        url: BILIBILI_URL,
        language: 'zh',
        includeTimestamps: true,
        filename: 'bilibili-integration-explicit',
        cookiesFromBrowser: 'chrome',
      },
      (_current, _total, message) => {
        if (message) progressMessages.push(message);
      }
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(result.artifacts?.length).toBe(1);
    expect(extractSegmentCount(result.output)).toBeGreaterThan(10);

    // Verify file written to disk
    const transcriptPath = path.join(TRANSCRIPT_DIR, 'bilibili-integration-explicit.transcript.txt');
    const fileContent = await fs.readFile(transcriptPath, 'utf8');
    assertTranscriptText(fileContent);

    expect(progressMessages.length).toBeGreaterThan(0);

    console.log('\n--- Explicit Cookies Test ---');
    console.log(`Segments: ${extractSegmentCount(result.output)}`);
  }, 120000);

  it('auto-retries with browser cookies when no cookies provided (real user scenario)', async () => {
    const ytdlpReady = await isYtDlpAvailable();
    if (!ytdlpReady) {
      console.warn('SKIP: yt-dlp not installed');
      return;
    }

    const progressMessages: string[] = [];
    const tool = new VideoTranscriptTool(mockContext, {
      persistFileRecord: async () => 'integration-auto-retry-id',
    });

    // This is the EXACT call the LLM makes in a real chat — NO cookiesFromBrowser.
    // The tool should detect the auth warning from Bilibili and auto-retry with
    // browser cookies (chrome, edge, firefox, safari in order).
    const result = await tool.execute(
      {
        url: BILIBILI_URL,
        language: 'zh',
        includeTimestamps: true,
        filename: 'bilibili-integration-autoretry',
        // NO cookiesFromBrowser — simulating real LLM call
      },
      (_current, _total, message) => {
        if (message) progressMessages.push(message);
      }
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Transcript extraction completed.');
    expect(result.artifacts?.length).toBe(1);
    expect(extractSegmentCount(result.output)).toBeGreaterThan(10);

    // Verify the auto-retry progress message was emitted
    expect(progressMessages.some((m) => /retry.*cookie/i.test(m))).toBe(true);

    // Verify file written to disk
    const transcriptPath = path.join(TRANSCRIPT_DIR, 'bilibili-integration-autoretry.transcript.txt');
    const fileContent = await fs.readFile(transcriptPath, 'utf8');
    assertTranscriptText(fileContent);

    console.log('\n--- Auto-Retry (No Cookies) Test ---');
    console.log(`Segments: ${extractSegmentCount(result.output)}`);
    console.log(`Progress messages: ${progressMessages.join(' → ')}`);
    const preview = fileContent.split('\n').filter(Boolean);
    console.log('First 3 lines:');
    for (const line of preview.slice(0, 3)) {
      console.log(`  ${line}`);
    }
    console.log('Last 3 lines:');
    for (const line of preview.slice(-3)) {
      console.log(`  ${line}`);
    }
  }, 120000);
});
