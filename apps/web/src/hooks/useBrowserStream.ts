import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/api';

/**
 * Hook to connect to the browser screencast WebSocket and receive JPEG frames.
 * Returns the latest frame as a data URL for canvas rendering, connection status, and error.
 */
export function useBrowserStream(sessionId: string | null, enabled: boolean) {
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'closed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId || !enabled) {
      setStatus('idle');
      setFrameDataUrl(null);
      setError(null);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getAccessToken();
    const wsUrl = `${protocol}//${host}/api/sessions/${sessionId}/browser-stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setFrameDataUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        return;
      }
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'no_session' || msg.type === 'no_browser' || msg.type === 'browser_disabled' || msg.type === 'error') {
            setError(msg.error ?? msg.type);
            setStatus('error');
          }
        } catch (_) {
          // ignore non-JSON
        }
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus('closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
      setFrameDataUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setStatus('idle');
    };
  }, [sessionId, enabled]);

  return { frameDataUrl, status, error };
}
