import { useCallback, useEffect, useState } from 'react';
import { X, GripVertical, ChevronRight } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ComputerPanel } from './ComputerPanel';
import { ReasoningTrace } from './ReasoningTrace';

const MIN_INSPECTOR_WIDTH = 280;
const MAX_INSPECTOR_WIDTH = 560;
const DEFAULT_INSPECTOR_WIDTH = 320;
const STORAGE_KEY = 'inspector-width';
const COLLAPSE_ANIMATION_MS = 220;
const clampInspectorWidth = (value: number) =>
  Math.min(Math.max(value, MIN_INSPECTOR_WIDTH), MAX_INSPECTOR_WIDTH);

interface InspectorPanelProps {
  open: boolean;
  sessionId?: string;
  onClose?: () => void;
}

export function InspectorPanel({ open, sessionId, onClose }: InspectorPanelProps) {
  const selectedMessageId = useChatStore((state) => state.selectedMessageId);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const reasoningMap = useChatStore((state) => state.reasoningSteps);
  const messages = useChatStore((state) => (sessionId ? state.messages.get(sessionId) || [] : []));
  const toolCalls = useChatStore((state) => state.toolCalls);
  const executionSteps = useChatStore((state) => (sessionId ? state.executionSteps.get(sessionId) || [] : []));
  const browserSession = useChatStore((state) => (sessionId ? state.browserSession.get(sessionId) : undefined));
  const pptPipeline = useChatStore((state) => (sessionId ? state.pptPipeline.get(sessionId) : undefined));
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? clampInspectorWidth(parseInt(stored, 10))
      : DEFAULT_INSPECTOR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [computerExpanded, setComputerExpanded] = useState(true);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [computerBodyMounted, setComputerBodyMounted] = useState(true);

  useEffect(() => {
    if (computerExpanded) {
      setComputerBodyMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setComputerBodyMounted(false), COLLAPSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [computerExpanded]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      setWidth(clampInspectorWidth(window.innerWidth - e.clientX));
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const isSessionStreaming = !!sessionId && isStreaming && streamingSessionId === sessionId;
  const isViewingHistorical = Boolean(selectedMessageId);
  const selectedMessageKey = selectedMessageId ? `msg-${selectedMessageId}` : null;
  const latestAssistantMessageWithTrace = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && (reasoningMap.get(`msg-${message.id}`)?.length ?? 0) > 0);
  const fallbackMessageKey = latestAssistantMessageWithTrace ? `msg-${latestAssistantMessageWithTrace.id}` : null;
  const sessionReasoningSteps = sessionId ? reasoningMap.get(sessionId) || [] : [];
  const reasoningKey = selectedMessageKey
    ? selectedMessageKey
    : sessionReasoningSteps.length > 0
      ? sessionId
      : fallbackMessageKey ?? sessionId ?? '';
  const reasoningSteps = reasoningKey ? reasoningMap.get(reasoningKey) || [] : [];
  const hasRunningReasoning = reasoningSteps.some((step) => step.status === 'running');
  const hasFailedExecution = executionSteps.some((step) => step.status === 'failed');
  const hasComputerActivity =
    executionSteps.length > 0 ||
    Boolean(browserSession) ||
    (browserSession?.actions?.length ?? 0) > 0 ||
    Boolean(pptPipeline?.steps?.length);
  const sessionToolCalls = sessionId
    ? Array.from(toolCalls.values()).filter((call) => {
        if (call.sessionId !== sessionId) return false;
        if (selectedMessageId) return call.messageId === selectedMessageId;
        return true;
      })
    : [];
  const hasFailedToolCall = sessionToolCalls.some((call) => call.status === 'failed');
  const hasFailedPptStep = !!pptPipeline?.steps?.some((step) => step.status === 'failed');
  const computerStatusLabel = (!isViewingHistorical && isSessionStreaming) || browserSession?.status === 'launching'
    ? 'Live'
    : hasFailedExecution || hasFailedToolCall || hasFailedPptStep
      ? 'Failed'
      : hasComputerActivity
        ? 'Completed'
        : 'Idle';
  const reasoningStatusLabel = hasRunningReasoning
    ? 'Running'
    : hasFailedToolCall
      ? 'Failed'
      : reasoningSteps.length > 0
        ? 'Completed'
        : 'Idle';

  return (
    <aside
      style={{ width: open ? width : 0 }}
      className={cn(
        'relative flex h-full shrink-0 flex-col bg-background transition-[width] duration-200',
        open ? 'border-l' : 'border-l border-transparent',
        isResizing && 'transition-none',
        'overflow-hidden'
      )}
      aria-hidden={!open}
    >
      {open ? (
        <>
          <div className="flex h-12 items-center justify-between border-b px-3">
            <div className="text-sm font-medium text-foreground">Inspector</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            {sessionId ? (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden p-3">
                <section
                  className="flex min-w-0 flex-col rounded-lg border border-border/70 bg-card/90 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setComputerExpanded((prev) => !prev)}
                    className="flex w-full shrink-0 items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          computerExpanded && 'rotate-90'
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">Computer</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          computerStatusLabel === 'Live' && 'bg-red-500',
                          computerStatusLabel === 'Completed' && 'bg-emerald-500',
                          computerStatusLabel === 'Failed' && 'bg-destructive',
                          computerStatusLabel === 'Idle' && 'bg-muted-foreground/50'
                        )}
                      />
                      {computerStatusLabel}
                    </div>
                  </button>
                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
                      computerExpanded
                        ? 'grid-rows-[1fr] border-t border-border/60 opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    {computerBodyMounted ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2.5">
                        <ComputerPanel sessionId={sessionId} compact />
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setReasoningExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          reasoningExpanded && 'rotate-90'
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">Reasoning Trace</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          reasoningStatusLabel === 'Running' && 'bg-blue-500',
                          reasoningStatusLabel === 'Completed' && 'bg-emerald-500',
                          reasoningStatusLabel === 'Failed' && 'bg-destructive',
                          reasoningStatusLabel === 'Idle' && 'bg-muted-foreground/50'
                        )}
                      />
                      {reasoningStatusLabel}
                    </div>
                  </button>
                  {reasoningExpanded ? (
                    <div className="border-t border-border/60 px-3 py-2.5">
                      <ReasoningTrace
                        sessionId={sessionId}
                        selectedMessageId={selectedMessageId}
                      />
                    </div>
                  ) : null}
                </section>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Inspector is available once a session is selected.
              </div>
            )}
          </div>

          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'absolute left-0 top-0 hidden h-full w-1 cursor-col-resize items-center justify-center group hover:bg-primary/20 transition-colors md:flex',
              isResizing && 'bg-primary/30'
            )}
          >
            <div
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-4 items-center justify-center rounded bg-border opacity-0 transition-opacity group-hover:opacity-100',
                isResizing && 'opacity-100 bg-primary/50'
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
