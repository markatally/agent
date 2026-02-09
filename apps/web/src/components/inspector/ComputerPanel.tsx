import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { PptPipelineTimeline } from './PptPipelineTimeline';
import { BrowserViewport } from './BrowserViewport';
import { BrowserToolbar, getBrowserActionLabel } from './BrowserToolbar';
import { TimelineScrubber } from './TimelineScrubber';

interface ComputerPanelProps {
  sessionId: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ANSI_COLOR_CLASS: Record<string, string> = {
  '30': 'text-neutral-400',
  '31': 'text-red-400',
  '32': 'text-emerald-400',
  '33': 'text-amber-400',
  '34': 'text-sky-400',
  '35': 'text-fuchsia-400',
  '36': 'text-cyan-400',
  '37': 'text-neutral-200',
  '90': 'text-neutral-500',
};

const parseAnsiSegments = (input: string): Array<{ text: string; className?: string }> => {
  const segments: Array<{ text: string; className?: string }> = [];
  const ansiRegex = /\u001b\[([\d;]+)m/g;
  let lastIndex = 0;
  let currentClass: string | undefined;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(input)) !== null) {
    const text = input.slice(lastIndex, match.index);
    if (text) {
      segments.push({ text, className: currentClass });
    }
    const codes = match[1].split(';');
    if (codes.includes('0')) {
      currentClass = undefined;
    } else {
      const colorCode = codes.find((code) => ANSI_COLOR_CLASS[code]);
      if (colorCode) {
        currentClass = ANSI_COLOR_CLASS[colorCode];
      }
    }
    lastIndex = ansiRegex.lastIndex;
  }

  const remaining = input.slice(lastIndex);
  if (remaining) {
    segments.push({ text: remaining, className: currentClass });
  }

  return segments;
};

export function ComputerPanel({ sessionId }: ComputerPanelProps) {
  const terminalLines = useChatStore((state) => state.terminalLines.get(sessionId) || []);
  const executionSteps = useChatStore((state) => state.executionSteps.get(sessionId) || []);
  const sandboxFiles = useChatStore((state) => state.sandboxFiles.get(sessionId) || []);
  const sandboxStatus = useChatStore((state) => state.sandboxStatus);
  const pptPipeline = useChatStore((state) => state.pptPipeline.get(sessionId));
  const isPptTask = useChatStore((state) => state.isPptTask.get(sessionId));
  const fileArtifacts = useChatStore((state) => state.files.get(sessionId) || []);
  const browserSession = useChatStore((state) => state.browserSession.get(sessionId));
  const setBrowserActionIndex = useChatStore((state) => state.setBrowserActionIndex);

  const [followOutput, setFollowOutput] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!followOutput) return;
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines, followOutput]);

  const handleTerminalScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollowOutput(atBottom);
  };

  const orderedSteps = useMemo(() => {
    return [...executionSteps].sort((a, b) => {
      const aTime = a.startedAt || 0;
      const bTime = b.startedAt || 0;
      return aTime - bTime;
    });
  }, [executionSteps]);

  const currentStepEntry = useMemo(() => {
    if (!pptPipeline?.steps?.length) return null;
    const running = pptPipeline.steps.find((step) => step.status === 'running');
    if (running) return running;
    return [...pptPipeline.steps].reverse().find((step) => step.status === 'completed') || pptPipeline.steps[0];
  }, [pptPipeline]);

  const currentPipelineStep = currentStepEntry?.id || 'research';
  const currentStepStatus = currentStepEntry?.status || 'pending';

  const activityLabel = useMemo(() => {
    if (currentPipelineStep === 'finalizing' && currentStepStatus === 'completed') {
      return 'Output ready';
    }
    switch (currentPipelineStep) {
      case 'browsing':
        return 'Agent is using Search';
      case 'reading':
        return 'Agent is reading sources';
      case 'synthesizing':
        return 'Agent is synthesizing notes';
      case 'generating':
        return 'Agent is generating slides';
      case 'finalizing':
        return 'Agent is finalizing output';
      case 'research':
      default:
        return 'Agent is planning research';
    }
  }, [currentPipelineStep, currentStepStatus]);

  const browseActivity = pptPipeline?.browseActivity || [];
  const lastActivity = browseActivity[browseActivity.length - 1];
  const browseResults = browseActivity.filter((activity) => activity.action === 'visit');
  const searchQueries = browseActivity.filter((activity) => activity.action === 'search');
  const pptFiles = fileArtifacts.filter(
    (artifact) =>
      artifact.name?.toLowerCase().endsWith('.pptx') ||
      artifact.mimeType?.includes('presentation')
  );

  const isBrowserMode = browserSession?.active ?? false;
  const browserActions = browserSession?.actions ?? [];
  const browserCurrentIndex = browserSession?.currentActionIndex ?? 0;
  const isAtLatestAction = browserActions.length === 0 || browserCurrentIndex >= browserActions.length - 1;
  const selectedBrowserAction = browserActions[browserCurrentIndex];
  const displayUrl = selectedBrowserAction?.url ?? browserSession?.currentUrl ?? '';
  const displayTitle = isAtLatestAction ? browserSession?.currentTitle : undefined;
  const lastBrowserAction = browserActions[browserCurrentIndex];
  const actionLabel = lastBrowserAction
    ? getBrowserActionLabel(`browser_${lastBrowserAction.type}`)
    : 'Browsing';

  if (isBrowserMode && !(isPptTask && pptPipeline)) {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border bg-muted/10">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="text-sm font-medium text-foreground">Computer</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="space-y-3 px-4 pb-4">
            <BrowserToolbar
              status={browserSession?.status ?? 'active'}
              currentUrl={displayUrl}
              currentTitle={displayTitle ?? browserSession?.currentTitle}
              actionLabel={actionLabel}
              isLive
            />
            <BrowserViewport
              sessionId={sessionId}
              enabled={isBrowserMode}
              snapshotUrl={browserActions[browserCurrentIndex]?.screenshotDataUrl ?? null}
              showLive={isAtLatestAction}
            />
            <TimelineScrubber
              currentIndex={browserCurrentIndex}
              totalSteps={browserActions.length}
              isLive
              onPrevious={() => setBrowserActionIndex(sessionId, browserCurrentIndex - 1)}
              onNext={() => setBrowserActionIndex(sessionId, browserCurrentIndex + 1)}
              onJumpToLive={() => setBrowserActionIndex(sessionId, Math.max(0, browserActions.length - 1))}
              onSeek={(index) => setBrowserActionIndex(sessionId, index)}
            />
          </div>
        </section>
      </div>
    );
  }

  if (isPptTask && pptPipeline) {
    const stepIndex = Math.max(
      0,
      pptPipeline.steps.findIndex((step) => step.id === currentPipelineStep)
    );
    const isLive = currentStepStatus === 'running';

    return (
      <div className="space-y-4">
        <section className="rounded-xl border bg-muted/10">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="text-sm font-medium text-foreground">Computer</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50')} />
              {isLive ? 'Live' : 'Complete'}
            </div>
          </div>
          <div className="space-y-3 px-4 pb-4">
            <div className="text-xs text-muted-foreground">{activityLabel}</div>

            {/* Always show browser viewport area so screenshots have a place to appear */}
            <BrowserToolbar
              status={browserSession?.status ?? (browserActions.length > 0 ? 'closed' : 'active')}
              currentUrl={displayUrl}
              currentTitle={displayTitle ?? browserSession?.currentTitle}
              actionLabel={actionLabel}
              isLive={isLive}
            />
            {isBrowserMode || browserActions.length > 0 ? (
              <>
                <BrowserViewport
                  sessionId={sessionId}
                  enabled={isBrowserMode}
                  snapshotUrl={browserActions[browserCurrentIndex]?.screenshotDataUrl ?? null}
                  showLive={isLive && isAtLatestAction}
                />
                {browserActions.length > 0 && (
                  <TimelineScrubber
                    currentIndex={browserCurrentIndex}
                    totalSteps={browserActions.length}
                    isLive={isLive}
                    onPrevious={() => setBrowserActionIndex(sessionId, browserCurrentIndex - 1)}
                    onNext={() => setBrowserActionIndex(sessionId, browserCurrentIndex + 1)}
                    onJumpToLive={() => setBrowserActionIndex(sessionId, Math.max(0, browserActions.length - 1))}
                    onSeek={(index) => setBrowserActionIndex(sessionId, index)}
                  />
                )}
              </>
            ) : (
              <div
                data-testid="computer-viewport-placeholder"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center"
                style={{ aspectRatio: 16 / 9 }}
              >
                <p className="text-sm font-medium text-muted-foreground">
                  Screenshots of each step will appear here
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentPipelineStep === 'browsing' && browseResults.length === 0
                    ? 'Collecting search results…'
                    : currentPipelineStep === 'reading'
                    ? 'Reading sources…'
                    : 'As the agent visits each page, a screenshot will be added to the timeline below.'}
                </p>
                {(lastActivity?.url || lastActivity?.query || searchQueries[searchQueries.length - 1]?.query) && (
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {lastActivity?.url
                      ? lastActivity.url
                      : lastActivity?.query
                      ? `Search: ${lastActivity.query}`
                      : `Search: ${searchQueries[searchQueries.length - 1]?.query}`}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Step {stepIndex + 1} of {pptPipeline.steps.length}:{' '}
                {pptPipeline.steps[stepIndex]?.label}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    currentStepStatus === 'running' && 'bg-emerald-500',
                    currentStepStatus === 'completed' && 'bg-emerald-500',
                    currentStepStatus === 'pending' && 'bg-muted-foreground/50'
                  )}
                />
                {currentStepStatus === 'completed' ? 'Completed' : currentStepStatus === 'running' ? 'Active' : 'Pending'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-muted/10">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="text-sm font-medium text-foreground">Step Timeline</div>
            <div className="text-xs text-muted-foreground">PPT pipeline</div>
          </div>
          <div className="px-4 pb-4">
            <PptPipelineTimeline steps={pptPipeline.steps} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-muted/10">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-sm font-medium text-foreground">Step Timeline</div>
          <div className="text-xs text-muted-foreground">Sandbox: {sandboxStatus}</div>
        </div>
        <div className="space-y-3 px-4 pb-4">
          {orderedSteps.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              No execution steps yet.
            </div>
          ) : (
            orderedSteps.map((step) => (
              <div key={step.stepId} className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-1 h-2.5 w-2.5 rounded-full',
                    step.status === 'planned' && 'bg-muted-foreground/40',
                    step.status === 'running' && 'bg-blue-500',
                    step.status === 'completed' && 'bg-emerald-500',
                    step.status === 'failed' && 'bg-red-500'
                  )}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {step.label || step.toolName || 'Execution step'}
                  </div>
                  {step.message ? (
                    <div className="text-xs text-muted-foreground">{step.message}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-muted/10">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-sm font-medium text-foreground">Terminal Output</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (terminalRef.current) {
                terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
              }
              setFollowOutput(true);
            }}
          >
            Jump to live
          </Button>
        </div>
        <div
          ref={terminalRef}
          onScroll={handleTerminalScroll}
          className="max-h-64 overflow-y-auto border-t bg-black px-4 py-3 font-mono text-xs text-white"
        >
          {terminalLines.length === 0 ? (
            <div className="text-muted-foreground">No terminal output yet.</div>
          ) : (
            terminalLines.map((line) => (
              <div key={line.id} className="whitespace-pre-wrap">
                {parseAnsiSegments(line.stream === 'command' ? `$ ${line.content}` : line.content).map(
                  (segment, index) => (
                    <span key={`${line.id}-${index}`} className={segment.className}>
                      {segment.text}
                    </span>
                  )
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-muted/10">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-sm font-medium text-foreground">Files</div>
          <div className="text-xs text-muted-foreground">{sandboxFiles.length} items</div>
        </div>
        <div className="space-y-2 px-4 pb-4">
          {sandboxFiles.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              No files tracked yet.
            </div>
          ) : (
            sandboxFiles.map((file, index) => (
              <div key={`${file.path}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 truncate">{file.path}</div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
