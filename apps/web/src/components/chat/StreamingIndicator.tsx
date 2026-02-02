import { cn } from '../../lib/utils';

interface StreamingIndicatorProps {
  isStreaming: boolean;
  className?: string;
}

/**
 * Streaming status indicator that shows next to agent avatar
 * - Pulsing gradient while generating
 * - Solid blue when completed
 */
export function StreamingIndicator({ isStreaming, className }: StreamingIndicatorProps) {
  return (
    <div
      className={cn(
        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
        isStreaming
          ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 animate-pulse bg-[length:200%_100%] animate-streaming-gradient'
          : 'bg-blue-500',
        className
      )}
      aria-label={isStreaming ? 'Generating response' : 'Response complete'}
    />
  );
}
