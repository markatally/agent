import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useChatStore } from '../stores/chatStore';

/**
 * Fetch messages for a session
 */
export function useSessionMessages(sessionId: string | undefined) {
  const setMessages = useChatStore((state) => state.setMessages);

  return useQuery({
    queryKey: ['sessions', sessionId, 'messages'],
    queryFn: async () => {
      if (!sessionId) throw new Error('Session ID is required');
      const session = await apiClient.sessions.get(sessionId);

      // Update chat store with messages
      setMessages(sessionId, session.messages || []);

      return session.messages || [];
    },
    enabled: !!sessionId,
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds for new messages
  });
}
