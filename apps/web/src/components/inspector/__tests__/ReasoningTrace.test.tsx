import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useChatStore } from '../../../stores/chatStore';
import { ReasoningTrace } from '../ReasoningTrace';

describe('ReasoningTrace (Inspector)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatStore.setState({
      messages: new Map(),
      reasoningSteps: new Map(),
      toolCalls: new Map(),
      isStreaming: false,
      streamingSessionId: null,
    });
  });

  it('renders a normalized step timeline with user/debug modes and merged semantic phases', async () => {
    const sessionId = 'session-1';
    const now = Date.now();

    useChatStore.setState({
      messages: new Map([
        [
          sessionId,
          [
            {
              id: 'assistant-1',
              sessionId,
              role: 'assistant',
              content: 'answer',
              createdAt: new Date(now),
              metadata: {
                tokens: 321,
                duration: 1800,
                model: 'gpt-test',
              },
            },
          ],
        ],
      ]),
      reasoningSteps: new Map([
        [
          sessionId,
          [
            {
              stepId: 'r-1',
              label: 'Thinking',
              status: 'completed',
              startedAt: now - 5000,
              completedAt: now - 4000,
              durationMs: 1000,
              message: 'Planning approach.',
              thinkingContent: 'Draft internal reasoning.',
            },
            {
              stepId: 'r-2',
              label: 'Generating response',
              status: 'completed',
              startedAt: now - 3800,
              completedAt: now - 3300,
              durationMs: 500,
            },
            {
              stepId: 'r-3',
              label: 'Generating response',
              status: 'completed',
              startedAt: now - 3200,
              completedAt: now - 3000,
              durationMs: 200,
            },
            {
              stepId: 'tool-tc-1',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 2800,
              completedAt: now - 2200,
              durationMs: 600,
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
                        publishedAt: '2025-01-15T12:00:00Z',
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
                        publishedAt: '2025-01-15T12:00:00Z',
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
    expect(screen.getByText('Step 1: Reasoning')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Generate Answer')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Tool Step')).toBeInTheDocument();
    const toolStepButton = screen.getByRole('button', { name: /Step 3: Tool Step/i });
    const durationColumn = toolStepButton.parentElement?.querySelector('.w-20') as HTMLElement | null;
    expect(durationColumn).toBeTruthy();
    expect(durationColumn?.querySelector('svg')).toBeNull();
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Query/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Sources (1)')).not.toBeInTheDocument();
    await userEvent.click(toolStepButton);

    expect(screen.getByRole('button', { name: /Query/i })).toBeInTheDocument();
    expect(screen.queryByText('ai news')).not.toBeInTheDocument();
    expect(screen.getByText('Sources (1)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Example source/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Query/i }));
    expect(screen.getByText('ai news')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sources \(1\)/i }));
    expect(screen.getByRole('link', { name: /Example source/i })).toHaveAttribute(
      'href',
      'https://example.com/article'
    );

    expect(screen.queryByText('Response Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Request Params')).not.toBeInTheDocument();
    expect(screen.queryByText('Internal Reasoning')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Debug/i }));

    expect(screen.getByTestId('reasoning-debug-summary')).toHaveTextContent('Tokens: 321');
    expect(screen.getByText('Internal Reasoning')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Debug Details'));
    expect(screen.getByText('Request Params')).toBeInTheDocument();
    expect(screen.getByText('Raw Output')).toBeInTheDocument();
    expect(screen.getByText('Latency 0.01s')).toBeInTheDocument();
  });

  it('keeps sources on the referenced tool step even when duplicate signatures exist', async () => {
    const sessionId = 'session-dedup-order';
    const now = Date.now();

    useChatStore.setState({
      messages: new Map([
        [
          sessionId,
          [
            {
              id: 'assistant-dedup',
              sessionId,
              role: 'assistant',
              content: 'answer',
              createdAt: new Date(now),
            },
          ],
        ],
      ]),
      reasoningSteps: new Map([
        [
          sessionId,
          [
            {
              stepId: 'tool-tc-1',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 1000,
              completedAt: now - 500,
              durationMs: 500,
            },
          ],
        ],
      ]),
      toolCalls: new Map([
        [
          'tc-1-dup',
          {
            sessionId,
            toolCallId: 'tc-1-dup',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'agent news' },
            result: {
              success: true,
              output: 'Top result: https://example.com/article',
              duration: 10,
              artifacts: [
                {
                  type: 'data',
                  name: 'search-results.json',
                  content: JSON.stringify({
                    results: [{ title: 'Example source', url: 'https://example.com/article' }],
                  }),
                },
              ],
            },
          },
        ],
        [
          'tc-1',
          {
            sessionId,
            toolCallId: 'tc-1',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'agent news' },
            result: {
              success: true,
              output: 'Top result: https://example.com/article',
              duration: 10,
              artifacts: [
                {
                  type: 'data',
                  name: 'search-results.json',
                  content: JSON.stringify({
                    results: [{ title: 'Example source', url: 'https://example.com/article' }],
                  }),
                },
              ],
            },
          },
        ],
      ]),
    });

    render(<ReasoningTrace sessionId={sessionId} />);

    expect(screen.queryByText('Step 2: Tool Step')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Step 1: Tool Step/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sources \(1\)/i }));
    expect(screen.getByRole('link', { name: /Example source/i })).toBeInTheDocument();
  });

  it('attaches orphan tool data to unresolved tool step instead of rendering duplicate tool steps', async () => {
    const sessionId = 'session-unresolved-tool-step';
    const now = Date.now();

    useChatStore.setState({
      messages: new Map([
        [
          sessionId,
          [
            {
              id: 'assistant-unresolved',
              sessionId,
              role: 'assistant',
              content: 'answer',
              createdAt: new Date(now),
            },
          ],
        ],
      ]),
      reasoningSteps: new Map([
        [
          sessionId,
          [
            {
              stepId: 'r-1',
              label: 'Generating response',
              status: 'completed',
              startedAt: now - 4000,
              completedAt: now - 3500,
              durationMs: 500,
              message: 'Switching to tools...',
            },
            {
              stepId: 'tool-missing-id',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 3000,
              completedAt: now - 2000,
              durationMs: 1000,
            },
            {
              stepId: 'r-2',
              label: 'Thinking',
              status: 'completed',
              startedAt: now - 1900,
              completedAt: now - 1600,
              durationMs: 300,
            },
          ],
        ],
      ]),
      toolCalls: new Map([
        [
          'tc-real',
          {
            sessionId,
            toolCallId: 'tc-real',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'ai machine learning industry news' },
            result: {
              success: true,
              output: 'Top result: https://example.com/article',
              duration: 1310,
              artifacts: [
                {
                  type: 'data',
                  name: 'search-results.json',
                  content: JSON.stringify({
                    results: [
                      { title: 'Example source', url: 'https://example.com/article' },
                      { title: 'Example source 2', url: 'https://example.org/article' },
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

    const toolSteps = screen.getAllByText(/Step \d+: Tool Step/i);
    expect(toolSteps).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /Step 2: Tool Step/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sources \(2\)/i }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('removes duplicate tool phases with identical tool signatures from the timeline', () => {
    const sessionId = 'session-duplicate-tool-phases';
    const now = Date.now();

    useChatStore.setState({
      messages: new Map([
        [
          sessionId,
          [
            {
              id: 'assistant-duplicate-tools',
              sessionId,
              role: 'assistant',
              content: 'answer',
              createdAt: new Date(now),
            },
          ],
        ],
      ]),
      reasoningSteps: new Map([
        [
          sessionId,
          [
            {
              stepId: 'tool-missing-1',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 2000,
              completedAt: now - 1500,
              durationMs: 500,
            },
            {
              stepId: 'tool-missing-2',
              label: 'Searching',
              status: 'completed',
              startedAt: now - 1400,
              completedAt: now - 900,
              durationMs: 500,
            },
          ],
        ],
      ]),
      toolCalls: new Map([
        [
          'tc-dupe-1',
          {
            sessionId,
            toolCallId: 'tc-dupe-1',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'duplicate tool trace' },
            result: {
              success: true,
              output: 'https://example.com/a',
              duration: 15,
              artifacts: [],
            },
          },
        ],
        [
          'tc-dupe-2',
          {
            sessionId,
            toolCallId: 'tc-dupe-2',
            toolName: 'web_search',
            status: 'completed',
            params: { query: 'duplicate tool trace' },
            result: {
              success: true,
              output: 'https://example.com/a',
              duration: 15,
              artifacts: [],
            },
          },
        ],
      ]),
    });

    render(<ReasoningTrace sessionId={sessionId} />);

    const toolSteps = screen.getAllByText(/Step \d+: Tool Step/i);
    expect(toolSteps).toHaveLength(1);
  });
});
