import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Type Tool
 * Type text into an input element in the real browser.
 */
export class BrowserTypeTool implements Tool {
  name = 'browser_type';
  description =
    'Type text into an input field in the browser. Provide the CSS selector of the input (e.g., "input[name=\'q\']", "#search") and the text to type. Use for search boxes, forms, etc.';
  requiresConfirmation = false;
  timeout = 10000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string' as const,
        description: 'CSS selector of the input element (e.g., "input[type=text]", "#query")',
      },
      text: {
        type: 'string' as const,
        description: 'Text to type into the input',
      },
      submit: {
        type: 'boolean' as const,
        description: 'Press Enter after typing (default: false)',
      },
    },
    required: ['selector', 'text'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const selector = String(params.selector ?? '').trim();
    const text = String(params.text ?? '');
    const submit = Boolean(params.submit);

    if (!selector) {
      return {
        success: false,
        output: '',
        error: 'selector is required',
        duration: Date.now() - startTime,
      };
    }

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
      await page.fill(selector, text, { timeout: this.timeout });
      if (submit) {
        await page.press(selector, 'Enter');
      }
      return {
        success: true,
        output: submit ? `Typed text and pressed Enter in ${selector}` : `Typed text into ${selector}`,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Type failed';
      return {
        success: false,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }
}
