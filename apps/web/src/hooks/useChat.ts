import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import type { AgentStep } from '../types';

type PersistedToolCall = {
  toolName?: string;
  name?: string;
  parameters?: Record<string, unknown>;
  params?: Record<string, unknown>;
  result?: {
    output?: unknown;
    artifacts?: Array<{ name?: string; content?: unknown }>;
  };
  createdAt?: string | number | Date;
  messageId?: string;
  message_id?: string;
};

function normalizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const keys = Array.from(parsed.searchParams.keys());
    for (const key of keys) {
      if (
        /^utm_/i.test(key) ||
        /^ga_/i.test(key) ||
        /^gaa_/i.test(key) ||
        /^gclid$/i.test(key) ||
        /^fbclid$/i.test(key) ||
        /^mc_eid$/i.test(key) ||
        /^mc_cid$/i.test(key) ||
        /^ref$/i.test(key) ||
        /^ref_src$/i.test(key) ||
        /^igshid$/i.test(key) ||
        /^mkt_tok$/i.test(key) ||
        /^__cf_chl_/i.test(key)
      ) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return matches.map((url) => normalizeUrl(url.replace(/[),.]+$/, '')));
}

export function reconstructAgentStepsFromToolCalls(toolCalls: PersistedToolCall[]): AgentStep[] {
  const persistedToolCalls = [...toolCalls].sort((a, b) => {
    const aT = new Date(a?.createdAt ?? 0).getTime();
    const bT = new Date(b?.createdAt ?? 0).getTime();
    return aT - bT;
  });

  const reconstructedSteps: AgentStep[] = [];
  let stepIndex = 0;
  let fallbackTimestamp = Date.now();

  for (const toolCall of persistedToolCalls) {
    const toolName = toolCall?.toolName || toolCall?.name;
    const params = toolCall?.parameters || toolCall?.params || {};
    const result = toolCall?.result;
    const outputText = typeof result?.output === 'string' ? result.output : '';
    const timestamp = Number.isFinite(new Date(toolCall?.createdAt ?? 0).getTime())
      ? new Date(toolCall?.createdAt ?? 0).getTime()
      : ++fallbackTimestamp;

    if (toolName === 'web_search') {
      const query = params?.query || params?.q || 'Web search';
      const messageId = toolCall?.messageId || toolCall?.message_id;
      reconstructedSteps.push({
        stepIndex,
        messageId: typeof messageId === 'string' ? messageId : undefined,
        type: 'search',
        output: String(query),
        snapshot: {
          stepIndex,
          timestamp,
          metadata: {
            actionDescription: `Search: ${String(query)}`,
          },
        },
      });
      stepIndex++;
    }

    const urls = new Set<string>();
    const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
    const searchArtifact = artifacts.find((artifact: any) => artifact?.name === 'search-results.json');

    let parsedResults: Array<{ title?: string; url?: string; content?: string }> = [];
    if (searchArtifact?.content != null) {
      try {
        const raw =
          typeof searchArtifact.content === 'string'
            ? searchArtifact.content
            : JSON.stringify(searchArtifact.content);
        const parsed = JSON.parse(raw) as { results?: Array<any> };
        parsedResults = Array.isArray(parsed?.results) ? parsed.results : [];
        for (const r of parsedResults) {
          if (r?.url) urls.add(normalizeUrl(String(r.url)));
        }
      } catch {
        // Ignore malformed artifact payloads.
      }
    }

    extractUrls(outputText).forEach((u) => urls.add(u));

    if (urls.size > 0) {
      for (const url of urls) {
        const match = parsedResults.find((r) => normalizeUrl(String(r?.url ?? '')) === url);
        const title = match?.title || url;
        const summary = match?.content;
        const messageId = toolCall?.messageId || toolCall?.message_id;
        reconstructedSteps.push({
          stepIndex,
          messageId: typeof messageId === 'string' ? messageId : undefined,
          type: 'browse',
          output: title,
          snapshot: {
            stepIndex,
            timestamp,
            url,
            metadata: {
              actionDescription: 'Visit page',
              ...(summary ? { domSummary: summary } : {}),
            },
          },
        });
        stepIndex++;
      }
    }
  }

  return reconstructedSteps;
}

/**
 * Fetch messages for a session
 */
export function useSessionMessages(sessionId: string | undefined) {
  const setMessages = useChatStore((state) => state.setMessages);
  const setFileArtifacts = useChatStore((state) => state.setFileArtifacts);
  const upsertToolCall = useChatStore((state) => state.upsertToolCall);
  const appendAgentStep = useChatStore((state) => state.appendAgentStep);
  const clearAgentSteps = useChatStore((state) => state.clearAgentSteps);
  const addReasoningStep = useChatStore((state) => state.addReasoningStep);
  const clearReasoningSteps = useChatStore((state) => state.clearReasoningSteps);

  return useQuery({
    queryKey: ['sessions', sessionId, 'messages'],
    queryFn: async () => {
      if (!sessionId) throw new Error('Session ID is required');
      const session = await apiClient.sessions.get(sessionId);

      // Update chat store with messages (ensure each message has current sessionId for file lookups)
      const messages = (session.messages || []).map((m) => ({ ...m, sessionId }));
      setMessages(sessionId, messages);

      // Hydrate persisted tool calls into the store (for refresh/load).
      // Prefer atomic upsert so we don't depend on call ordering across effects/refetches.
      const normalizeStatus = (status: any, result: any) => {
        if (status === 'pending' || status === 'running' || status === 'completed' || status === 'failed') {
          return status;
        }
        // Fallback for legacy/unknown DB values
        if (result?.success === false) return 'failed';
        return 'completed';
      };

      const persistedToolCallsById = new Map<string, any>();
      // Newer API shape: session.toolCalls (flat list)
      for (const toolCall of (session as any).toolCalls || []) {
        const id = toolCall?.toolCallId || toolCall?.id;
        if (id) persistedToolCallsById.set(id, toolCall);
      }
      // Also support hydrating from session.messages[].toolCalls (in case root toolCalls isn't present)
      for (const message of (session.messages || []) as any[]) {
        for (const toolCall of message?.toolCalls || []) {
          const id = toolCall?.toolCallId || toolCall?.id;
          if (!id) continue;
          // Ensure messageId is present for message-scoped filtering in Inspector
          persistedToolCallsById.set(id, { ...toolCall, messageId: toolCall.messageId ?? message.id });
        }
      }

      for (const toolCall of persistedToolCallsById.values()) {
        const toolCallId = toolCall?.toolCallId || toolCall?.id;
        const toolName = toolCall?.toolName || toolCall?.name;
        if (!toolCallId || !toolName) continue;

        const params = toolCall?.parameters || toolCall?.params || {};
        const result = toolCall?.result;
        const status = normalizeStatus(toolCall?.status, result);
        const messageId = toolCall?.messageId || toolCall?.message_id;

        upsertToolCall({
          sessionId,
          messageId,
          toolCallId,
          toolName,
          params,
          status,
          result: result?.success ? result : undefined,
          error: result?.success === false ? result?.error : undefined,
        });
      }

      // Hydrate "Computer" replay timeline from persisted tool calls.
      // If local timeline is partial (e.g., after relogin), replace it with fuller DB reconstruction.
      try {
        const persistedToolCalls = Array.from(persistedToolCallsById.values()).filter(
          (tc) => (tc?.sessionId ?? sessionId) === sessionId
        );
        const reconstructedSteps = reconstructAgentStepsFromToolCalls(persistedToolCalls);

        const existingTimeline = useChatStore.getState().agentSteps.get(sessionId);
        const existingSteps = existingTimeline?.steps ?? [];
        const hasSameTimeline =
          reconstructedSteps.length === existingSteps.length &&
          reconstructedSteps.every((step, index) => {
            const existing = existingSteps[index];
            if (!existing) return false;
            return (
              step.type === existing.type &&
              (step.output ?? '') === (existing.output ?? '') &&
              (step.snapshot?.url ?? '') === (existing.snapshot?.url ?? '') &&
              (step.snapshot?.metadata?.actionDescription ?? '') ===
                (existing.snapshot?.metadata?.actionDescription ?? '')
            );
          });

        if (!hasSameTimeline) {
          clearAgentSteps(sessionId);
          for (const step of reconstructedSteps) {
            appendAgentStep(sessionId, step);
          }
        }
      } catch {
        // Best-effort only; never block message loading.
      }

      // Hydrate reasoning steps from message metadata
      // Use a message-specific key format: `msg-{messageId}`
      for (const message of messages) {
        if (message.role === 'assistant' && message.metadata?.reasoningSteps) {
          const reasoningSteps = message.metadata.reasoningSteps as Array<{
            stepId: string;
            label: string;
            startedAt: number;
            completedAt: number;
            durationMs: number;
            message?: string;
            details?: { queries?: string[]; sources?: string[]; toolName?: string };
            thinkingContent?: string;
          }>;

          // Clear any existing reasoning steps for this message
          const messageKey = `msg-${message.id}`;
          clearReasoningSteps(messageKey);

          // Add each reasoning step
          for (const step of reasoningSteps) {
            addReasoningStep(messageKey, {
              stepId: step.stepId,
              label: step.label,
              status: 'completed',
              startedAt: step.startedAt,
              completedAt: step.completedAt,
              durationMs: step.durationMs,
              message: step.message,
              thinkingContent: step.thinkingContent,
              details: step.details,
            });
          }
        }
      }

      // Hydrate file artifacts from API (for refresh/load - files persist in DB)
      try {
        const { files } = await apiClient.files.list(sessionId);
        const artifacts = files.map((f) => ({
          type: 'file' as const,
          name: f.filename,
          fileId: f.id,
          size: f.sizeBytes,
          mimeType: f.mimeType,
          content: '',
        }));
        setFileArtifacts(sessionId, artifacts);
      } catch {
        // Ignore - session may have no files or list may fail
      }

      return messages;
    },
    enabled: !!sessionId,
    staleTime: 30000, // 30 seconds - SSE provides real-time updates, no need for aggressive polling
  });
}
