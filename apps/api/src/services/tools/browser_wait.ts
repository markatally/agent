import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Wait Tool
 * Wait for a selector to appear or for a fixed time in the real browser.
 */
export class BrowserWaitTool implements Tool {
  name = 'browser_wait';
  description =
    'Wait in the browser until an element appears (by CSS selector) or for a fixed number of milliseconds. Use to wait for dynamic content or navigation to finish.';
  requiresConfirmation = false;
  timeout = 30000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string' as const,
        description: 'CSS selector to wait for (if provided). Omit to wait for fixed time only.',
      },
      timeout: {
        type: 'number' as const,
        description: 'Maximum wait time in milliseconds (default: 5000)',
      },
    },
    required: [],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const selector = params.selector as string | undefined;
    const waitTimeout = Math.min(
      Math.max(Number(params.timeout) || 5000, 500),
      this.timeout
    );

    const manager = getBrowserManager();
    const page = await manager.getPage(this.context.sessionId);
    if (!page) {
      return {
        success: false,
        output: '',
        error: 'Browser is not available. Enable browser mode in configuration.',
        duration: Date.now() - startTime,
      };
    }

    try {
      if (selector) {
        await page.waitForSelector(selector, { timeout: waitTimeout });
        return {
          success: true,
          output: `Element "${selector}" appeared within ${waitTimeout}ms`,
          duration: Date.now() - startTime,
        };
      }
      await new Promise((r) => setTimeout(r, waitTimeout));
      return {
        success: true,
        output: `Waited ${waitTimeout}ms`,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wait failed';
      return {
        success: false,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }
}
