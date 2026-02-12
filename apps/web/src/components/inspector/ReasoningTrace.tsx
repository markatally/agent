import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolResult } from '@mark/shared';
import { useChatStore } from '../../stores/chatStore';
import { ThinkingIndicator } from '../chat/ThinkingIndicator';
import { StatusIcon } from '../ui/status-icon';
import { SourceFavicon } from './SourceFavicon';

interface ReasoningTraceProps {
  sessionId: string;
  selectedMessageId?: string | null;
}

interface ToolCallStatus {
  sessionId: string;
  messageId?: string;
  toolCallId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: any;
  result?: ToolResult;
  error?: string;
}

interface SourceEntry {
  url: string;
  title: string;
}

interface ReasoningStepEntry {
  stepId: string;
  label: string;
  status: 'running' | 'completed';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  message?: string;
  thinkingContent?: string;
}

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web Search',
  paper_search: 'Paper Search',
  ppt_generator: 'Presentation',
  file_reader: 'File Reader',
  file_writer: 'File Writer',
  bash_executor: 'Shell Command',
};

const DURATION_THROTTLE_MS = 10;

function getEpochNowMs(): number {
  if (
    typeof performance !== 'undefined' &&
    Number.isFinite(performance.timeOrigin) &&
    Number.isFinite(performance.now())
  ) {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(',')}}`;
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return '0.00s';
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatToolName(toolName: string) {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return matches.map((url) => url.replace(/[),.\]}'"]+$/, ''));
}

function collectToolSources(toolCall: ToolCallStatus): SourceEntry[] {
  const sources = new Map<string, SourceEntry>();
  const addSource = (url: string, title?: string) => {
    const cleanUrl = url.replace(/[),.\]}'"]+$/, '');
    if (!cleanUrl) return;

    const existing = sources.get(cleanUrl);
    if (existing) {
      if (title && (existing.title === existing.url || existing.title === cleanUrl)) {
        existing.title = title;
      }
      return;
    }

    sources.set(cleanUrl, {
      url: cleanUrl,
      title: title || cleanUrl,
    });
  };

  if (toolCall.result?.output) {
    extractUrls(toolCall.result.output).forEach((url) => addSource(url));
  }

  for (const artifact of toolCall.result?.artifacts || []) {
    if (artifact?.name === 'search-results.json') {
      try {
        const rawContent =
          typeof artifact.content === 'string'
            ? artifact.content
            : JSON.stringify(artifact.content);
        const parsed = JSON.parse(rawContent) as {
          results?: Array<{ url?: string; title?: string }>;
        };
        for (const result of parsed.results || []) {
          if (result?.url) addSource(result.url, result.title);
        }
      } catch {
        // Ignore malformed artifact payload and continue with generic extraction.
      }
      continue;
    }

    if (typeof artifact.content === 'string') {
      extractUrls(artifact.content).forEach((url) => addSource(url));
    }
  }

  return Array.from(sources.values());
}

function summarizeToolResult(toolCall: ToolCallStatus): string {
  if (toolCall.error) return toolCall.error;
  if (!toolCall.result?.output) return 'No response output.';
  const firstMeaningfulLine = toolCall.result.output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstMeaningfulLine) return 'No response output.';
  return firstMeaningfulLine.length > 220
    ? `${firstMeaningfulLine.slice(0, 220)}...`
    : firstMeaningfulLine;
}

function getToolCallSignature(toolCall: ToolCallStatus): string {
  return [
    toolCall.messageId ?? '',
    toolCall.toolName,
    stableStringify(toolCall.params ?? {}),
    toolCall.result?.output ?? '',
    toolCall.error ?? '',
  ].join('|');
}

function statusPriority(status: ToolCallStatus['status']): number {
  if (status === 'completed') return 4;
  if (status === 'running') return 3;
  if (status === 'failed') return 2;
  return 1;
}

function pickPreferredToolCall(a: ToolCallStatus, b: ToolCallStatus): ToolCallStatus {
  const aPriority = statusPriority(a.status);
  const bPriority = statusPriority(b.status);
  if (aPriority !== bPriority) return aPriority > bPriority ? a : b;
  const aOutputLen = a.result?.output?.length ?? 0;
  const bOutputLen = b.result?.output?.length ?? 0;
  if (aOutputLen !== bOutputLen) return aOutputLen > bOutputLen ? a : b;
  return a;
}

function dedupeToolCalls(toolCalls: ToolCallStatus[]): ToolCallStatus[] {
  const bySignature = new Map<string, ToolCallStatus>();
  for (const call of toolCalls) {
    const signature = getToolCallSignature(call);
    const existing = bySignature.get(signature);
    bySignature.set(signature, existing ? pickPreferredToolCall(existing, call) : call);
  }
  return Array.from(bySignature.values());
}

function ToolRequestAndSources({ toolCall }: { toolCall: ToolCallStatus }) {
  const toolSources = collectToolSources(toolCall);
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <details className="rounded-lg border border-border bg-muted/10 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">Request</summary>
        <div className="mt-2 space-y-3 text-xs">
          <div>
            <div className="mb-1 font-medium text-foreground">Tool Name</div>
            <div className="text-muted-foreground">{toolCall.toolName}</div>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">Request Params</div>
            <pre className="max-h-56 min-w-0 overflow-auto rounded bg-background p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.params ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">Response Summary</div>
            <div className="rounded bg-background p-2 text-muted-foreground">
              {summarizeToolResult(toolCall)}
            </div>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-border bg-muted/10 px-3 py-2" data-testid="reasoning-tool-sources">
        <summary className="cursor-pointer text-xs font-medium text-foreground">
          Sources ({toolSources.length})
        </summary>
        <div className="mt-2">
          {toolSources.length === 0 ? (
            <div className="rounded bg-background p-2 text-xs text-muted-foreground">
              No sources found.
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {toolSources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-muted-foreground transition hover:text-foreground"
                >
                  <SourceFavicon url={source.url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{source.title}</div>
                    <div className="truncate text-[11px]">{source.url}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export function ReasoningTrace({ sessionId, selectedMessageId }: ReasoningTraceProps) {
  const isStreaming = useChatStore((state) => state.isStreaming);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const messages = useChatStore((state) => state.messages.get(sessionId) || []);
  const reasoningMap = useChatStore((state) => state.reasoningSteps);
  const toolCallsMap = useChatStore((state) => state.toolCalls);
  const isActive = isStreaming && streamingSessionId === sessionId;

  const selectedMessageKey = selectedMessageId ? `msg-${selectedMessageId}` : null;
  const latestAssistantMessageWithTrace = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && (reasoningMap.get(`msg-${message.id}`)?.length ?? 0) > 0);
  const fallbackMessageKey = latestAssistantMessageWithTrace ? `msg-${latestAssistantMessageWithTrace.id}` : null;
  const sessionReasoningSteps = reasoningMap.get(sessionId) || [];
  const reasoningKey = selectedMessageKey
    ? selectedMessageKey
    : sessionReasoningSteps.length > 0
      ? sessionId
      : fallbackMessageKey ?? sessionId;
  const reasoningSteps = (reasoningMap.get(reasoningKey) || []) as ReasoningStepEntry[];

  const toolCalls = useMemo(
    () =>
      dedupeToolCalls(
        Array.from(toolCallsMap.values())
          .filter((call) => {
            if (call.sessionId !== sessionId) return false;
            if (call.status === 'pending') return false;
            if (selectedMessageId) return call.messageId === selectedMessageId;
            return true;
          })
          .reverse() as ToolCallStatus[]
      ),
    [toolCallsMap, sessionId, selectedMessageId]
  );

  const webSearchToolCalls = useMemo(
    () => toolCalls.filter((call) => call.toolName === 'web_search'),
    [toolCalls]
  );
  const standaloneToolCalls = useMemo(
    () => toolCalls.filter((call) => call.toolName !== 'web_search'),
    [toolCalls]
  );
  const hasSearchingStep = reasoningSteps.some((step) => step.label.toLowerCase() === 'searching');
  const ungroupedWebSearchCalls = hasSearchingStep ? [] : webSearchToolCalls;

  const hasRunningEntries =
    reasoningSteps.some((step) => step.status === 'running') ||
    toolCalls.some((toolCall) => toolCall.status === 'running');
  const [displayNowMs, setDisplayNowMs] = useState<number>(() => getEpochNowMs());

  useEffect(() => {
    if (!hasRunningEntries) {
      setDisplayNowMs(getEpochNowMs());
      return;
    }

    let rafId = 0;
    let lastCommittedAt = -Infinity;
    const tick = (rafTs: number) => {
      if (rafTs - lastCommittedAt >= DURATION_THROTTLE_MS) {
        lastCommittedAt = rafTs;
        setDisplayNowMs(getEpochNowMs());
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hasRunningEntries]);

  const timelineCount = reasoningSteps.length + standaloneToolCalls.length + ungroupedWebSearchCalls.length;

  if (timelineCount === 0) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        {isActive ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <ThinkingIndicator />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            No reasoning trace yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="reasoning-trace-timeline" className="space-y-3">
      {[...reasoningSteps, ...standaloneToolCalls, ...ungroupedWebSearchCalls].map((entry, index) => {
        const isLast = index === timelineCount - 1;
        if ('stepId' in entry) {
          const step = entry as ReasoningStepEntry;
          const isCompleted = step.status === 'completed';
          const duration = isCompleted
            ? step.durationMs || (step.completedAt || 0) - step.startedAt
            : displayNowMs - step.startedAt;
          const isSearchingStep = step.label.toLowerCase() === 'searching';
          return (
            <div key={step.stepId} className="relative flex gap-3" data-testid="reasoning-step-item">
              <div className="flex flex-col items-center">
                <StatusIcon status={isCompleted ? 'completed' : 'running'} size="md" />
                {!isLast && <div className="mt-1 h-full w-px bg-border" />}
              </div>

              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-foreground">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{formatDuration(duration)}</div>
                </div>
                {step.message ? (
                  <div className="text-xs text-muted-foreground">{step.message}</div>
                ) : null}
                {step.thinkingContent ? (
                  <details className="mt-2 rounded-lg border border-border bg-muted/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {isCompleted ? 'Thoughts' : 'Thoughts (streaming)'}
                    </summary>
                    <div className="mt-2 prose prose-sm max-w-none min-w-0 overflow-x-hidden text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {step.thinkingContent}
                      </ReactMarkdown>
                    </div>
                  </details>
                ) : null}
                {isSearchingStep && webSearchToolCalls.length > 0 ? (
                  <details className="mt-2 rounded-lg border border-border bg-muted/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-foreground">
                      Tool: Web Search {webSearchToolCalls.length > 1 ? `(${webSearchToolCalls.length})` : ''}
                    </summary>
                    <div className="mt-2 space-y-3">
                      {webSearchToolCalls.map((toolCall) => (
                        <div key={toolCall.toolCallId} className="rounded-md border border-border/60 bg-background/70 p-2">
                          <div className="text-xs text-muted-foreground">{summarizeToolResult(toolCall)}</div>
                          <ToolRequestAndSources toolCall={toolCall} />
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          );
        }

        const toolCall = entry as ToolCallStatus;
        const statusIcon =
          toolCall.status === 'running'
            ? 'running'
            : toolCall.status === 'failed'
              ? 'failed'
              : 'completed';
        return (
          <div key={toolCall.toolCallId} className="relative flex gap-3" data-testid="reasoning-tool-item">
            <div className="flex flex-col items-center">
              <StatusIcon status={statusIcon} size="md" />
              {!isLast && <div className="mt-1 h-full w-px bg-border" />}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="text-sm font-medium text-foreground">Tool: {formatToolName(toolCall.toolName)}</div>
              <div className="text-xs text-muted-foreground">{summarizeToolResult(toolCall)}</div>
              <ToolRequestAndSources toolCall={toolCall} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
