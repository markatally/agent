import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Click Tool
 * Click an element by selector or by coordinates in the real browser.
 */
export class BrowserClickTool implements Tool {
  name = 'browser_click';
  description =
    'Click an element in the browser. Provide either a CSS selector (e.g., "button.submit", "#link") or x,y coordinates in pixels. Use after navigating to interact with the page.';
  requiresConfirmation = false;
  timeout = 10000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string' as const,
        description: 'CSS selector of the element to click (e.g., "a[href=\'/about\']", "button")',
      },
      x: {
        type: 'number' as const,
        description: 'X coordinate in pixels (use with y for coordinate click)',
      },
      y: {
        type: 'number' as const,
        description: 'Y coordinate in pixels (use with x for coordinate click)',
      },
    },
    required: [],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();

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

    const selector = params.selector as string | undefined;
    const x = params.x as number | undefined;
    const y = params.y as number | undefined;

    if (selector) {
      try {
        await page.click(selector, { timeout: this.timeout });
        return {
          success: true,
          output: `Clicked element: ${selector}`,
          duration: Date.now() - startTime,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Click failed';
        return {
          success: false,
          output: '',
          error: message,
          duration: Date.now() - startTime,
        };
      }
    }

    if (typeof x === 'number' && typeof y === 'number') {
      try {
        await page.mouse.click(x, y);
        return {
          success: true,
          output: `Clicked at (${x}, ${y})`,
          duration: Date.now() - startTime,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Click failed';
        return {
          success: false,
          output: '',
          error: message,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      output: '',
      error: 'Provide either selector or both x and y coordinates',
      duration: Date.now() - startTime,
    };
  }
}
