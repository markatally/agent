import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ToolCallDisplay } from './ToolCallDisplay';
import { apiClient } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../../hooks/use-toast';

interface ChatContainerProps {
  sessionId: string;
}

export function ChatContainer({ sessionId }: ChatContainerProps) {
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const addMessage = useChatStore((state) => state.addMessage);

  // SSE streaming hook
  useSSE({
    sessionId,
    enabled: isStreaming,
    onComplete: () => {
      setIsStreaming(false);
      setIsSending(false);
    },
    onError: (error) => {
      toast({
        title: 'Streaming error',
        description: error.message,
        variant: 'destructive',
      });
      setIsStreaming(false);
      setIsSending(false);
    },
  });

  const handleSendMessage = async (content: string) => {
    setIsSending(true);

    try {
      // Add optimistic user message
      const tempUserMessage = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: 'user' as const,
        content,
        createdAt: new Date(),
      };

      addMessage(sessionId, tempUserMessage as any);

      // Send message to backend (triggers SSE stream)
      await apiClient.chat.send(sessionId, content);

      // Enable SSE streaming to receive the response
      setIsStreaming(true);

      // Refetch messages to get the user message persisted
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'messages'] });
    } catch (error: any) {
      toast({
        title: 'Failed to send message',
        description: error.message || 'Could not send message',
        variant: 'destructive',
      });
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList sessionId={sessionId} />
      <ToolCallDisplay sessionId={sessionId} />
      <ChatInput onSend={handleSendMessage} disabled={isSending} />
    </div>
  );
}
