/**
 * WebSocket route for browser screencast streaming
 * GET /api/sessions/:sessionId/browser-stream?token=...
 */

import { Hono } from 'hono';
import { requireAuth, AuthContext } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { getBrowserManager } from '../services/browser/manager';
import { getFrameBufferService } from '../services/browser/frame-buffer';

export type UpgradeWebSocketFn = (
  c: any,
  fn: (c: any) => { onOpen?: (ev: any, ws: any) => void; onMessage?: (ev: any, ws: any) => void; onClose?: (ev: any) => void }
) => Response;

export function createBrowserStreamRoutes(upgradeWebSocket: UpgradeWebSocketFn): Hono<AuthContext> {
  const routes = new Hono<AuthContext>();
  routes.use('*', requireAuth);

  routes.get('/sessions/:sessionId/browser-stream', (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    let clientWs: { send(data: string | Buffer): void; readyState: number } | null = null;

    return upgradeWebSocket(c, () => ({
      onOpen: async (_ev: any, ws: any) => {
        clientWs = ws;
        try {
          const session = await prisma.session.findUnique({
            where: { id: sessionId, userId: user.userId },
          });
          if (!session) {
            ws.send(JSON.stringify({ type: 'no_session', error: 'Session not found' }));
            ws.close();
            return;
          }

          const manager = getBrowserManager();
          if (!manager.isEnabled()) {
            ws.send(JSON.stringify({ type: 'browser_disabled', error: 'Browser mode is disabled' }));
            ws.close();
            return;
          }

          const browserSession = manager.getSession(sessionId);
          if (!browserSession) {
            ws.send(JSON.stringify({ type: 'no_browser', error: 'No active browser session' }));
            ws.close();
            return;
          }

          const frameBuffer = getFrameBufferService();
          frameBuffer.subscribe(sessionId, ws);
          await manager.startScreencast(sessionId);

          const info = manager.getSessionInfo(sessionId);
          ws.send(
            JSON.stringify({
              type: 'url_changed',
              url: info?.currentUrl ?? '',
              title: info?.currentTitle,
            })
          );
        } catch (err) {
          console.error('[browser-stream] onOpen error:', err);
          ws.send(JSON.stringify({ type: 'error', error: String(err) }));
          ws.close();
        }
      },
      onMessage(ev: any, ws: any) {
        try {
          const data = ev.data;
          if (typeof data === 'string') {
            const msg = JSON.parse(data);
            if (msg.type === 'get_frame' && typeof msg.index === 'number') {
              const frameBuffer = getFrameBufferService();
              const frame = frameBuffer.getFrame(sessionId, msg.index);
              if (frame) {
                ws.send(frame);
              }
            }
          }
        } catch (_) {
          // ignore
        }
      },
      onClose: () => {
        if (clientWs) {
          const frameBuffer = getFrameBufferService();
          frameBuffer.unsubscribe(sessionId, clientWs);
          clientWs = null;
        }
      },
    }));
  });

  return routes;
}
