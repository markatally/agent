import type { PptPipelineStep } from '../../types';
import { cn } from '../../lib/utils';

interface PptPipelineTimelineProps {
  steps: PptPipelineStep[];
}

export function PptPipelineTimeline({ steps }: PptPipelineTimelineProps) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-3">
          <div
            className={cn(
              'mt-1 h-2.5 w-2.5 rounded-full',
              step.status === 'pending' && 'bg-muted-foreground/40',
              step.status === 'running' && 'bg-blue-500 animate-pulse',
              step.status === 'completed' && 'bg-emerald-500'
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{step.label}</div>
            <div className="text-xs text-muted-foreground capitalize">{step.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
