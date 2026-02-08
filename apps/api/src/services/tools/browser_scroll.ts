import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Scroll Tool
 * Scroll the page up or down in the real browser.
 */
export class BrowserScrollTool implements Tool {
  name = 'browser_scroll';
  description =
    'Scroll the browser page up or down. Use direction "down" to scroll down (see more content) or "up" to scroll up. Optionally specify amount in pixels.';
  requiresConfirmation = false;
  timeout = 5000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      direction: {
        type: 'string' as const,
        description: 'Scroll direction: "up" or "down"',
        enum: ['up', 'down'],
      },
      amount: {
        type: 'number' as const,
        description: 'Pixels to scroll (default: 300)',
      },
    },
    required: ['direction'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const direction = params.direction as 'up' | 'down';
    const amount = Math.min(
      Math.max(Number(params.amount) || 300, 50),
      2000
    );
    const delta = direction === 'down' ? amount : -amount;

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
      await page.mouse.wheel(0, delta);
      return {
        success: true,
        output: `Scrolled ${direction} by ${Math.abs(delta)}px`,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scroll failed';
      return {
        success: false,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }
}
