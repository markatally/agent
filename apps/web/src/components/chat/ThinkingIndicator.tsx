import { Bot } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThinkingIndicatorProps {
  className?: string;
}

/**
 * Thinking indicator shown before the first token arrives.
 * Displays a ChatGPT-style pulsing dots animation.
 */
export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn('flex gap-3 p-4', className)}>
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>

      {/* Thinking dots animation */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Assistant</span>
          <span className="text-xs text-muted-foreground">thinking...</span>
        </div>

        <div className="flex items-center gap-1 py-2">
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '1s' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '1s' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '1s' }}
          />
        </div>
      </div>
    </div>
  );
}
