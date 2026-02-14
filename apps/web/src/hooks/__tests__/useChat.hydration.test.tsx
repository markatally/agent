import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSessionMessages } from '../useChat';
import { useChatStore } from '../../stores/chatStore';

const mockSessionGet = vi.fn();
const mockFilesList = vi.fn();

vi.mock('../../lib/api', () => ({
  apiClient: {
    sessions: {
      get: (...args: any[]) => mockSessionGet(...args),
    },
    files: {
      list: (...args: any[]) => mockFilesList(...args),
    },
  },
}));

describe('useSessionMessages hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useChatStore.setState({
      messages: new Map(),
      toolCalls: new Map(),
      files: new Map(),
      reasoningSteps: new Map(),
      agentSteps: new Map(),
      agentRunStartIndex: new Map(),
      browserSession: new Map(),
      pptPipeline: new Map(),
      isPptTask: new Map(),
      streamingTables: new Map(),
      completedTables: new Map(),
      selectedMessageId: null,
    } as any);

    mockFilesList.mockResolvedValue({ files: [] });
  });

  it('keeps richer session-local timeline on refresh instead of clobbering it with reconstructed fallback', async () => {
    const sessionId = 'session-refresh';

    const localSteps = Array.from({ length: 10 }, (_, i) => ({
      stepIndex: i,
      messageId: 'assistant-1',
      type: 'browse' as const,
      output: `Local step ${i + 1}`,
      snapshot: {
        stepIndex: i,
        timestamp: 1700000000000 + i,
        url: `https://local.example/${i + 1}`,
        screenshot: `data:image/jpeg;base64,local-${i + 1}`,
        metadata: { actionDescription: 'Visit page' },
      },
    }));

    localStorage.setItem(
      `mark-agent-computer-${sessionId}`,
      JSON.stringify({
        agentSteps: {
          currentStepIndex: localSteps.length - 1,
          steps: localSteps,
        },
      })
    );

    mockSessionGet.mockResolvedValue({
      id: sessionId,
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'find news',
          createdAt: '2026-02-14T00:00:00.000Z',
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'done',
          createdAt: '2026-02-14T00:00:10.000Z',
          metadata: {},
        },
      ],
      toolCalls: [
        {
          id: 'tool-1',
          toolName: 'web_search',
          parameters: { query: 'ai news' },
          createdAt: '2026-02-14T00:00:05.000Z',
          messageId: 'assistant-1',
          result: {
            success: true,
            output: 'https://single.example/story',
            artifacts: [
              {
                name: 'search-results.json',
                content: JSON.stringify({
                  results: [{ title: 'Single', url: 'https://single.example/story', content: 'one' }],
                }),
              },
            ],
          },
        },
      ],
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSessionMessages(sessionId), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hydrated = useChatStore.getState().agentSteps.get(sessionId)?.steps ?? [];
    expect(hydrated).toHaveLength(10);
    expect(hydrated[0]?.snapshot?.url).toBe('https://local.example/1');
    expect(hydrated[9]?.snapshot?.screenshot).toBe('data:image/jpeg;base64,local-10');

    const persisted = JSON.parse(localStorage.getItem(`mark-agent-computer-${sessionId}`) || '{}');
    expect(persisted?.agentSteps?.steps?.length).toBe(10);
  });

  it('deduplicates steps by (type, output, url) signature when populating empty timeline', async () => {
    const sessionId = 'session-dedup';

    // No local state in localStorage — timeline starts empty
    mockSessionGet.mockResolvedValue({
      id: sessionId,
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'find news',
          createdAt: '2026-02-14T00:00:00.000Z',
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'done',
          createdAt: '2026-02-14T00:00:10.000Z',
          metadata: {},
        },
      ],
      toolCalls: [
        {
          id: 'tool-1',
          toolName: 'web_search',
          parameters: { query: 'ai news' },
          createdAt: '2026-02-14T00:00:05.000Z',
          messageId: 'assistant-1',
          result: {
            success: true,
            output: 'Found https://dup.example/story',
            artifacts: [
              {
                name: 'search-results.json',
                content: JSON.stringify({
                  results: [
                    { title: 'Dup Story', url: 'https://dup.example/story', content: 'summary' },
                  ],
                }),
              },
            ],
          },
        },
        // Second tool call producing the exact same browse URL — should be deduped
        {
          id: 'tool-2',
          toolName: 'web_search',
          parameters: { query: 'ai news' },
          createdAt: '2026-02-14T00:00:06.000Z',
          messageId: 'assistant-1',
          result: {
            success: true,
            output: 'Found https://dup.example/story',
            artifacts: [
              {
                name: 'search-results.json',
                content: JSON.stringify({
                  results: [
                    { title: 'Dup Story', url: 'https://dup.example/story', content: 'summary' },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSessionMessages(sessionId), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hydrated = useChatStore.getState().agentSteps.get(sessionId)?.steps ?? [];
    // There should be no duplicates: search step is unique, browse step is deduped
    const browseSteps = hydrated.filter((s) => s.type === 'browse' && s.snapshot?.url === 'https://dup.example/story');
    expect(browseSteps).toHaveLength(1);
  });

  it('keeps computer timelines isolated per session when hydrating multiple chats', async () => {
    const sessionA = 'session-a';
    const sessionB = 'session-b';

    const makeSteps = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        stepIndex: i,
        messageId: `${prefix}-assistant`,
        type: 'browse' as const,
        output: `${prefix}-step-${i + 1}`,
        snapshot: {
          stepIndex: i,
          timestamp: 1700000005000 + i,
          url: `https://${prefix}.example/${i + 1}`,
          screenshot: `data:image/jpeg;base64,${prefix}-${i + 1}`,
          metadata: { actionDescription: 'Visit page' },
        },
      }));

    localStorage.setItem(
      `mark-agent-computer-${sessionA}`,
      JSON.stringify({
        agentSteps: { currentStepIndex: 9, steps: makeSteps('a', 10) },
      })
    );
    localStorage.setItem(
      `mark-agent-computer-${sessionB}`,
      JSON.stringify({
        agentSteps: { currentStepIndex: 6, steps: makeSteps('b', 7) },
      })
    );

    mockSessionGet.mockImplementation(async (id: string) => ({
      id,
      messages: [
        {
          id: `${id}-user`,
          role: 'user',
          content: 'query',
          createdAt: '2026-02-14T00:00:00.000Z',
        },
        {
          id: `${id}-assistant`,
          role: 'assistant',
          content: 'answer',
          createdAt: '2026-02-14T00:00:10.000Z',
          metadata: {},
        },
      ],
      toolCalls: [
        {
          id: `${id}-tool`,
          toolName: 'web_search',
          parameters: { query: 'fallback' },
          createdAt: '2026-02-14T00:00:05.000Z',
          messageId: `${id}-assistant`,
          result: {
            success: true,
            output: 'https://fallback.example/one',
            artifacts: [],
          },
        },
      ],
    }));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const aHook = renderHook(() => useSessionMessages(sessionA), { wrapper });
    await waitFor(() => expect(aHook.result.current.isSuccess).toBe(true));

    const bHook = renderHook(() => useSessionMessages(sessionB), { wrapper });
    await waitFor(() => expect(bHook.result.current.isSuccess).toBe(true));

    const state = useChatStore.getState();
    expect(state.agentSteps.get(sessionA)?.steps.length).toBe(10);
    expect(state.agentSteps.get(sessionB)?.steps.length).toBe(7);
    expect(state.agentSteps.get(sessionA)?.steps[0]?.snapshot?.url).toBe('https://a.example/1');
    expect(state.agentSteps.get(sessionB)?.steps[0]?.snapshot?.url).toBe('https://b.example/1');
  });
});
