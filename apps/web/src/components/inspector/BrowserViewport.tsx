import { useMemo, useState } from 'react';
import { useBrowserStream } from '../../hooks/useBrowserStream';
import { cn } from '../../lib/utils';
import {
  type SourceDimensions,
  type ViewportSizingMode,
  getMediaObjectFit,
  getViewportContainerStyle,
} from './viewportSizing';

interface BrowserViewportProps {
  sessionId: string | null;
  enabled: boolean;
  snapshotUrl?: string | null;
  sizingMode?: ViewportSizingMode;
  /** When false, show stored snapshot instead of live WebSocket frame (e.g. when scrubbing history) */
  showLive?: boolean;
  /** When true, fill parent height and use minHeight instead of fixed 16:9 aspect ratio */
  fillHeight?: boolean;
  minHeight?: number;
  className?: string;
}

/**
 * Renders live browser screencast frames on a canvas.
 * Connects to WebSocket and draws JPEG frames as they arrive.
 */
export function BrowserViewport({
  sessionId,
  enabled,
  snapshotUrl,
  sizingMode = 'fit',
  showLive = true,
  fillHeight = false,
  minHeight = 320,
  className,
}: BrowserViewportProps) {
  const { frameDataUrl, status, error } = useBrowserStream(sessionId, enabled);
  const displayLive = showLive !== false && !!frameDataUrl;
  const [sourceDimensions, setSourceDimensions] = useState<SourceDimensions | null>(null);

  const viewportStyle = useMemo(
    () =>
      getViewportContainerStyle({
        mode: sizingMode,
        sourceDimensions,
        fillHeight,
        minHeight,
      }),
    [fillHeight, minHeight, sizingMode, sourceDimensions]
  );
  const mediaObjectFit = getMediaObjectFit(sizingMode);
  const activeSrc = displayLive ? frameDataUrl : snapshotUrl ?? frameDataUrl;
  const isPixelMode = sizingMode === 'pixel';
  const useFitRatioWrapper = sizingMode === 'fit' && fillHeight;

  if (!enabled && !snapshotUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground',
          className
        )}
        style={viewportStyle}
      >
        Browser view is off
      </div>
    );
  }

  if (enabled && status === 'connecting') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground',
          className
        )}
        style={viewportStyle}
      >
        Connecting...
      </div>
    );
  }

  if (status === 'error' || error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive',
          className
        )}
        style={viewportStyle}
      >
        {error ?? 'Connection failed'}
      </div>
    );
  }

  if (status === 'closed' && !frameDataUrl && !snapshotUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground',
          className
        )}
        style={viewportStyle}
      >
        No browser session
      </div>
    );
  }

  return (
    <div
      data-testid="browser-viewport"
      className={cn(
        'rounded-lg border bg-muted/20',
        fillHeight && 'flex min-h-0 flex-1 items-center justify-center',
        isPixelMode ? 'overflow-auto' : fillHeight ? 'overflow-hidden' : 'overflow-auto',
        className
      )}
      style={viewportStyle}
    >
      {activeSrc ? (
        useFitRatioWrapper ? (
          <img
            data-testid={displayLive ? 'browser-viewport-live' : 'browser-viewport-screenshot'}
            src={activeSrc}
            alt="Browser viewport"
            onLoad={(event) => {
              const next = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              if (next.width > 0 && next.height > 0) {
                setSourceDimensions(next);
              }
            }}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img
            data-testid={displayLive ? 'browser-viewport-live' : 'browser-viewport-screenshot'}
            src={activeSrc}
            alt="Browser viewport"
            onLoad={(event) => {
              const next = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              if (next.width > 0 && next.height > 0) {
                setSourceDimensions(next);
              }
            }}
            className={cn(
              isPixelMode ? 'max-h-none max-w-none' : 'h-full w-full'
            )}
            style={
              isPixelMode
                ? {
                    width: sourceDimensions ? `${sourceDimensions.width}px` : 'auto',
                    height: sourceDimensions ? `${sourceDimensions.height}px` : 'auto',
                    objectFit: 'none',
                  }
                : { objectFit: mediaObjectFit }
            }
          />
        )
      ) : null}
    </div>
  );
}
