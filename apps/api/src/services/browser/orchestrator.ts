/**
 * Browser Orchestrator
 * Wraps tool execution with SSE event emission for browser tools (browser.launched, browser.navigated, browser.action).
 */

import type { ToolContext } from '../tools/types';
import type { ToolExecutor } from '../tools/executor';
import type { ToolResult } from '../tools/types';
import { getBrowserManager } from './manager';

type StreamEmitter = (event: { type: string; sessionId: string; data?: any }) => Promise<void>;

const BROWSER_TOOL_PREFIX = 'browser_';

function isBrowserTool(toolName: string): boolean {
  return toolName.startsWith(BROWSER_TOOL_PREFIX);
}

/**
 * Create a tool executor that emits SSE events for browser tools.
 */
export function createBrowserObservableExecutor(
  baseExecutor: ToolExecutor,
  emit: StreamEmitter,
  sessionId: string
): ToolExecutor {
  let browserLaunchedEmitted = false;

  return {
    async execute(toolName: string, params: Record<string, any>, options?: { onProgress?: any }) {
      if (!isBrowserTool(toolName)) {
        return baseExecutor.execute(toolName, params, options);
      }

      const manager = getBrowserManager();
      if (!manager.isEnabled()) {
        return baseExecutor.execute(toolName, params, options);
      }

      const hadSession = manager.getSession(sessionId) != null;
      if (!hadSession && manager.canCreateSession()) {
        await manager.getPage(sessionId);
        if (!browserLaunchedEmitted) {
          browserLaunchedEmitted = true;
          await emit({
            type: 'browser.launched',
            sessionId,
            data: { message: 'Browser session started' },
          });
        }
      }

      const result: ToolResult = await baseExecutor.execute(toolName, params, options);

      if (toolName === 'browser_navigate' && result.success) {
        const info = manager.getSessionInfo(sessionId);
        await emit({
          type: 'browser.navigated',
          sessionId,
          data: {
            url: info?.currentUrl ?? params.url,
            title: info?.currentTitle,
          },
        });
      }

      await emit({
        type: 'browser.action',
        sessionId,
        data: {
          action: toolName,
          params,
          success: result.success,
          output: result.output?.slice(0, 500),
          error: result.error,
        },
      });

      const session = manager.getSession(sessionId);
      if (session?.page && result.success) {
        try {
          const buf = await session.page.screenshot({
            type: 'jpeg',
            quality: 60,
            timeout: 5000,
          });
          const base64 = Buffer.isBuffer(buf) ? buf.toString('base64') : (buf as string);
          await emit({
            type: 'browser.screenshot',
            sessionId,
            data: { screenshot: base64 },
          });
        } catch (_) {
          /* non-fatal; omit screenshot */
        }
      }

      return result;
    },
  } as ToolExecutor;
}

export interface BrowserOrchestratorParams {
  sessionId: string;
  toolExecutor: ToolExecutor;
  sseStream: { writeSSE: (payload: { data: string }) => Promise<void> };
}

/**
 * Wrap the given tool executor with browser event emission and return the wrapped executor.
 * Does not create/destroy browser sessions; that is done by tools and BrowserManager idle timeout.
 */
export function wrapExecutorWithBrowserEvents(
  params: BrowserOrchestratorParams
): ToolExecutor {
  const { sessionId, toolExecutor, sseStream } = params;

  const emit: StreamEmitter = async (event) => {
    await sseStream.writeSSE({
      data: JSON.stringify({
        type: event.type,
        sessionId: event.sessionId,
        timestamp: Date.now(),
        data: event.data ?? {},
      }),
    });
  };

  return createBrowserObservableExecutor(toolExecutor, emit, sessionId);
}
