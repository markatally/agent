import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface TimelineScrubberProps {
  currentIndex: number;
  totalSteps: number;
  isLive: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToLive: () => void;
  onSeek?: (index: number) => void;
  className?: string;
}

/**
 * Timeline scrubber below the browser viewport: step nav, slider, Jump to live (Manus-style).
 */
export function TimelineScrubber({
  currentIndex,
  totalSteps,
  isLive,
  onPrevious,
  onNext,
  onJumpToLive,
  onSeek,
  className,
}: TimelineScrubberProps) {
  const total = Math.max(1, totalSteps);
  const value = totalSteps === 0 ? 0 : currentIndex;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Step {value + 1} of {total}
        </span>
        {!isLive && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onJumpToLive}>
            Jump to live
          </Button>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            live
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onSeek?.(0)}
          disabled={totalSteps === 0}
          aria-label="Go to start"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onPrevious}
          disabled={totalSteps === 0}
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 px-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={value}
            onChange={(e) => onSeek?.(e.target.valueAsNumber)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onNext}
          disabled={totalSteps === 0}
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onSeek?.(total - 1)}
          disabled={totalSteps === 0}
          aria-label="Go to end"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
