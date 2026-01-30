import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useSessionMessages } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chatStore';
import { MessageItem } from './MessageItem';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

interface MessageListProps {
  sessionId: string;
}

export function MessageList({ sessionId }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading, error } = useSessionMessages(sessionId);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Failed to load messages</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start a conversation by sending a message below
          </p>
        </div>
      </div>
    );
  }

  const isStreamingThisSession = isStreaming && streamingSessionId === sessionId;

  return (
    <ScrollArea className="flex-1">
      <div ref={scrollRef} className="flex flex-col">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {isStreamingThisSession && streamingContent && (
          <MessageItem
            message={{
              id: 'streaming',
              sessionId,
              role: 'assistant',
              content: streamingContent,
              createdAt: new Date(),
            } as any}
            isStreaming
          />
        )}
      </div>
    </ScrollArea>
  );
}
