import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Extract Tool
 * Extract visible text from the page or from a specific element in the real browser.
 */
export class BrowserExtractTool implements Tool {
  name = 'browser_extract';
  description =
    'Extract text content from the browser page. If selector is provided, extracts that element\'s text; otherwise extracts the main body text (e.g., article, main content). Use to read page content for summarization or analysis.';
  requiresConfirmation = false;
  timeout = 10000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string' as const,
        description:
          'Optional CSS selector to extract text from (e.g., "article", "main", ".content"). If omitted, extracts body text.',
      },
    },
    required: [],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const selector = (params.selector as string)?.trim();

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
      let text: string;
      if (selector) {
        const el = await page.$(selector);
        if (!el) {
          return {
            success: false,
            output: '',
            error: `Element not found: ${selector}`,
            duration: Date.now() - startTime,
          };
        }
        text = await el.textContent();
        await el.dispose();
      } else {
        text = await page.evaluate(() => {
          const body = document.body;
          if (!body) return '';
          const clone = body.cloneNode(true) as HTMLElement;
          const scripts = clone.querySelectorAll('script, style, nav, footer, [role="banner"]');
          scripts.forEach((s) => s.remove());
          return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
        });
      }

      const trimmed = (text ?? '').trim().slice(0, 50000);
      return {
        success: true,
        output: trimmed || '(No text extracted)',
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extract failed';
      return {
        success: false,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }
}
