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

function extractWebSearchUrls(result: ToolResult): string[] {
  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  const searchArtifact = artifacts.find(
    (artifact) => artifact?.name === 'search-results.json' && typeof artifact?.content === 'string'
  );
  if (!searchArtifact || typeof searchArtifact.content !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(searchArtifact.content) as {
      results?: Array<{ url?: string }>;
    };
    const rows = Array.isArray(parsed.results) ? parsed.results : [];
    return rows
      .map((row) => row?.url?.trim())
      .filter((url): url is string => Boolean(url));
  } catch {
    return [];
  }
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
      const manager = getBrowserManager();
      const shouldTrackBrowser = isBrowserTool(toolName) || toolName === 'web_search';
      if (!shouldTrackBrowser || !manager.isEnabled()) {
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

      if (toolName === 'web_search' && result.success) {
        const session = manager.getSession(sessionId);
        if (session?.page) {
          const urls = extractWebSearchUrls(result);
          for (const url of urls) {
            let navOk = false;
            try {
              await session.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
              });
              const title = await session.page.title().catch(() => undefined);
              manager.setCurrentUrl(sessionId, session.page.url(), title);
              await emit({
                type: 'browser.navigated',
                sessionId,
                data: {
                  url: session.page.url(),
                  title,
                },
              });
              navOk = true;
            } catch (error) {
              await emit({
                type: 'browser.action',
                sessionId,
                data: {
                  action: 'browser_navigate',
                  params: { url },
                  success: false,
                  error: error instanceof Error ? error.message : 'Navigation failed',
                },
              });
            }

            if (!navOk) continue;

            await emit({
              type: 'browser.action',
              sessionId,
              data: {
                action: 'browser_navigate',
                params: { url: session.page.url() },
                success: true,
                output: `Visited ${session.page.url()} from web search`,
              },
            });

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
              /* non-fatal; skip this screenshot */
            }
          }
        }
        return result;
      }

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
