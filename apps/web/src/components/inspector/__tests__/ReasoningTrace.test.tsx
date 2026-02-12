import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useChatStore } from '../../../stores/chatStore';
import { ReasoningTrace } from '../ReasoningTrace';

describe('ReasoningTrace (Inspector)', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: new Map(),
      reasoningSteps: new Map(),
      toolCalls: new Map(),
      isStreaming: false,
      streamingSessionId: null,
    });
  });

  it('merges web_search into Searching, dedupes duplicates, and exposes Request/Sources panels', async () => {
    const sessionId = 'session-1';
    const now = Date.now();
    useChatStore.setState({
      reasoningSteps: new Map([
        [
          sessionId,
          [
            {
              stepId: 'r-1',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 2000,
              completedAt: now - 1000,
              durationMs: 1000,
              message: 'Looking up sources.',
            },
          ],
        ],
      ]),
      toolCalls: new Map([
        [
          'tc-1',
          {
            sessionId,
            toolCallId: 'tc-1',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'ai news', topic: 'news' },
            result: {
              success: true,
              output: 'Top result: https://example.com/article',
              duration: 12,
              artifacts: [
                {
                  type: 'data',
                  name: 'search-results.json',
                  content: JSON.stringify({
                    results: [
                      {
                        title: 'Example source',
                        url: 'https://example.com/article',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
        [
          'tc-1-dup',
          {
            sessionId,
            toolCallId: 'tc-1-dup',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'ai news', topic: 'news' },
            result: {
              success: true,
              output: 'Top result: https://example.com/article',
              duration: 12,
              artifacts: [
                {
                  type: 'data',
                  name: 'search-results.json',
                  content: JSON.stringify({
                    results: [
                      {
                        title: 'Example source',
                        url: 'https://example.com/article',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      ]),
    });

    render(<ReasoningTrace sessionId={sessionId} />);

    expect(screen.getByTestId('reasoning-trace-timeline')).toBeInTheDocument();
    expect(screen.getAllByText('Tool: Web Search')).toHaveLength(1);
    expect(screen.queryByTestId('reasoning-tool-item')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Tool: Web Search'));
    await userEvent.click(screen.getByText('Request'));

    expect(screen.getByText('Request Params')).toBeInTheDocument();
    expect(screen.getByText('Response Summary')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Sources (1)'));
    expect(screen.getByTestId('reasoning-tool-sources')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Example source/i })).toHaveAttribute(
      'href',
      'https://example.com/article'
    );
  });
});
