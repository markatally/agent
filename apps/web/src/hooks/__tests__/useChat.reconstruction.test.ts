import { describe, expect, it } from 'vitest';
import { reconstructAgentStepsFromToolCalls } from '../useChat';

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
