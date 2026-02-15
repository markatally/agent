import { useEffect, useRef } from 'react';
import { SSEClient, type StreamEvent } from '../lib/sse';
import { useChatStore } from '../stores/chatStore';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { isHiddenArtifactName } from '../lib/artifactFilters';

interface UseSSEOptions {
  sessionId: string;
  enabled: boolean;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Idle timeout configuration (in milliseconds)
 * If no SSE events are received within this time, connection is considered stuck
 */
const IDLE_TIMEOUT = 60 * 1000; // 60 seconds

/**
 * Hook to handle SSE streaming for a session
 * Includes idle timeout protection to prevent infinite polling
 */
export function useSSE({ sessionId, enabled, onComplete, onError }: UseSSEOptions) {
  const clientRef = useRef<SSEClient | null>(null);
  const queryClient = useQueryClient();
  const startStreaming = useChatStore((state) => state.startStreaming);
  const appendStreamingContent = useChatStore((state) => state.appendStreamingContent);
  const startToolCall = useChatStore((state) => state.startToolCall);
  const updateToolCallProgress = useChatStore((state) => state.updateToolCallProgress);
  const completeToolCall = useChatStore((state) => state.completeToolCall);
  const associateToolCallsWithMessage = useChatStore((state) => state.associateToolCallsWithMessage);
  const applyReasoningEvent = useChatStore((state) => state.applyReasoningEvent);
  const clearReasoningSteps = useChatStore((state) => state.clearReasoningSteps);
  const addFileArtifact = useChatStore((state) => state.addFileArtifact);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const finalizeStreamingMessage = useChatStore((state) => state.finalizeStreamingMessage);
  const lastEventTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Create SSE client
    const client = new SSEClient();
    clientRef.current = client;

    // Get stream URL with auth token
    const streamUrl = apiClient.chat.getStreamUrl(sessionId);

    // Set up idle timeout detection
    let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimeout = () => {
      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
      }
      lastEventTimeRef.current = Date.now();

      // Check for idle state after timeout period
      idleTimeoutId = setTimeout(() => {
        const elapsed = Date.now() - lastEventTimeRef.current;
        if (elapsed > IDLE_TIMEOUT) {
          console.error(`Agent idle timeout: no events for ${elapsed}ms`);
          stopStreaming();
          onError?.(new Error('Agent took too long to respond (idle timeout)'));
        }
      }, IDLE_TIMEOUT);
    };

    // Connect to SSE stream
    const cleanup = client.connect(streamUrl, {
      onEvent: (event: StreamEvent) => {
        if (event.sessionId && event.sessionId !== sessionId) {
          return;
        }

        // Reset idle timeout on any event
        resetIdleTimeout();

        switch (event.type) {
          case 'message.start':
            startStreaming(sessionId);
            clearReasoningSteps(sessionId);
            break;

          case 'message.delta':
            if (event.data?.content) {
              appendStreamingContent(event.data.content);
            }
            break;

          case 'message.complete':
            if (event.data?.assistantMessageId) {
              associateToolCallsWithMessage(sessionId, event.data.assistantMessageId);
            }
            if (event.data?.message) {
              finalizeStreamingMessage(event.data.message.id, event.data.message);
            }
            // Refetch messages to ensure we have the latest
            queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'messages'] });
            onComplete?.();
            break;

          case 'tool.start':
            if (event.data) {
              startToolCall(
                sessionId,
                event.data.toolCallId,
                event.data.toolName,
                event.data.params || event.data.parameters
              );

            }
            break;

          case 'tool.progress':
            if (event.data) {
              updateToolCallProgress(
                sessionId,
                event.data.toolCallId,
                event.data.current || 0,
                event.data.total || 100,
                event.data.message
              );
            }
            break;

          case 'tool.complete':
            if (event.data) {
              const visibleArtifacts = Array.isArray(event.data.artifacts)
                ? event.data.artifacts.filter(
                    (artifact: any) => !isHiddenArtifactName(artifact?.name)
                  )
                : undefined;
              const toolResult: import('@mark/shared').ToolResult = {
                success: true,
                output: event.data.result || '',
                duration: event.data.duration || 0,
                artifacts: visibleArtifacts,
              };
              completeToolCall(sessionId, event.data.toolCallId, toolResult);
            }
            break;

          case 'tool.error':
            if (event.data) {
              const toolResult: import('@mark/shared').ToolResult = {
                success: false,
                output: '',
                error: event.data.error || 'Unknown error',
                duration: event.data.duration || 0,
              };
              completeToolCall(sessionId, event.data.toolCallId, toolResult);
            }
            break;

          case 'reasoning.step':
            if (event.data) {
              const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
              const currentSteps = useChatStore.getState().reasoningSteps.get(sessionId) || [];
              const knownStep = currentSteps.find((step) => step.stepId === event.data.stepId);
              const fallbackStepIndex =
                knownStep?.stepIndex ??
                (Math.max(0, ...currentSteps.map((step) => step.stepIndex ?? 0)) + 1);
              const lifecycle =
                event.data.lifecycle ??
                (event.data.status === 'running' ? 'STARTED' : 'FINISHED');

              applyReasoningEvent(sessionId, {
                eventId:
                  event.data.eventId ??
                  `${event.data.stepId}:${event.data.eventSeq ?? 0}:${timestamp}`,
                traceId: event.data.traceId ?? sessionId,
                stepId: event.data.stepId,
                stepIndex: Number(event.data.stepIndex ?? fallbackStepIndex),
                eventSeq: Number(event.data.eventSeq ?? 0),
                lifecycle,
                timestamp,
                label: event.data.label,
                message: event.data.message,
                thinkingContent: event.data.thinkingContent,
                details: event.data.details,
                finalStatus: event.data.finalStatus,
              });
            }
            break;

          case 'file.created':
            // File artifact created - add to store for independent display
            if (event.data?.fileId && event.data?.filename) {
              const artifact: import('@mark/shared').Artifact = {
                fileId: event.data.fileId,
                name: event.data.filename,
                type: event.data.type || 'file',
                mimeType: event.data.mimeType,
                size: event.data.size,
                content: '',
              };
              addFileArtifact(sessionId, artifact);
            }
            break;

          case 'agent.step_limit':
            // Agent exceeded maximum tool steps
            console.error('Agent step limit reached:', event.data?.reason);
            stopStreaming();
            onError?.(new Error(event.data?.reason || 'Agent exceeded step limit'));
            break;

          case 'error':
            console.error('SSE error:', event.data);
            stopStreaming();
            onError?.(new Error(event.data?.message || 'Stream error'));
            break;
        }
      },
      onError: (error) => {
        console.error('SSE connection error:', error);
        stopStreaming();
        onError?.(error);
      },
      onOpen: () => {
        console.log('SSE connection opened');
      },
      onClose: () => {
        console.log('SSE connection closed');
        stopStreaming();
      },
      reconnect: true,
      maxReconnectAttempts: 3,
    });

    return () => {
      cleanup();
      clientRef.current = null;
    };
  }, [
    sessionId,
    enabled,
    startStreaming,
    appendStreamingContent,
    startToolCall,
    updateToolCallProgress,
    completeToolCall,
    applyReasoningEvent,
    clearReasoningSteps,
    addFileArtifact,
    stopStreaming,
    finalizeStreamingMessage,
    queryClient,
    onComplete,
    onError,
  ]);

  return {
    disconnect: () => {
      if (clientRef.current) {
        clientRef.current.close();
      }
    },
  };
}
