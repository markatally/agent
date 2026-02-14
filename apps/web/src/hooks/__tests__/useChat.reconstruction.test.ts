import { describe, expect, it } from 'vitest';
import { extractPersistedAgentStepsFromMessages, reconstructAgentStepsFromToolCalls } from '../useChat';

describe('reconstructAgentStepsFromToolCalls', () => {
  it('reconstructs search/browse steps without synthetic screenshots', () => {
    const steps = reconstructAgentStepsFromToolCalls([
      {
        toolName: 'web_search',
        createdAt: '2026-02-12T00:00:00.000Z',
        parameters: { query: 'ai news' },
        result: {
          output: 'Found https://example.com/story',
          artifacts: [
            {
              name: 'search-results.json',
              content: JSON.stringify({
                results: [
                  {
                    title: 'Example Story',
                    url: 'https://example.com/story?utm_source=test',
                    content: 'summary',
                  },
                ],
              }),
            },
          ],
        },
      },
    ]);

    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0]?.type).toBe('search');
    expect(steps[0]?.snapshot?.metadata?.actionDescription).toContain('Search: ai news');
    expect(steps[0]?.snapshot?.screenshot).toBeUndefined();

    const browseStep = steps.find((step) => step.type === 'browse');
    expect(browseStep).toBeDefined();
    expect(browseStep?.snapshot?.url).toBe('https://example.com/story');
    expect(browseStep?.snapshot?.screenshot).toBeUndefined();
  });
});

describe('reconstructAgentStepsFromToolCalls - no phantom steps', () => {
  it('does not produce phantom PPT pipeline steps from non-PPT tool calls', () => {
    // Verify that only web_search tool calls produce browse/search steps.
    // Tools like bash_executor or file_reader should NOT appear in the timeline.
    const steps = reconstructAgentStepsFromToolCalls([
      {
        toolName: 'bash_executor',
        createdAt: '2026-02-12T00:00:00.000Z',
        parameters: { command: 'ls -la' },
        result: {
          output: 'file1.txt\nfile2.txt',
        },
      },
      {
        toolName: 'file_reader',
        createdAt: '2026-02-12T00:00:01.000Z',
        parameters: { path: '/workspace/slides.pptx' },
        result: {
          output: 'file content with presentation keyword',
        },
      },
    ]);

    // No steps should be reconstructed for non-web_search tools
    expect(steps).toHaveLength(0);
  });
});

describe('extractPersistedAgentStepsFromMessages', () => {
  it('hydrates persisted computer timeline steps with screenshots from assistant metadata', () => {
    const steps = extractPersistedAgentStepsFromMessages([
      {
        id: 'assistant-1',
        role: 'assistant',
        metadata: {
          computerTimelineSteps: [
            {
              type: 'browse',
              output: 'Visit page',
              snapshot: {
                timestamp: 1700000000000,
                url: 'https://example.com/story',
                screenshot: 'data:image/jpeg;base64,abc123',
                metadata: { actionDescription: 'Visit page' },
              },
            },
          ],
        },
      },
    ] as any);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.messageId).toBe('assistant-1');
    expect(steps[0]?.snapshot?.screenshot).toBe('data:image/jpeg;base64,abc123');
    expect(steps[0]?.snapshot?.url).toBe('https://example.com/story');
  });
});
