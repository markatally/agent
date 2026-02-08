import type { Tool, ToolResult, ToolContext } from './types';
import { getBrowserManager } from '../browser/manager';

/**
 * Browser Screenshot Tool
 * Take a screenshot of the current page for LLM vision or debugging.
 */
export class BrowserScreenshotTool implements Tool {
  name = 'browser_screenshot';
  description =
    'Take a screenshot of the current browser page. Returns the image as base64 (JPEG). Use to capture the current view for analysis or to pass to vision models.';
  requiresConfirmation = false;
  timeout = 10000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      fullPage: {
        type: 'boolean' as const,
        description: 'Capture full scrollable page (default: false)',
      },
    },
    required: [],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const fullPage = Boolean(params.fullPage);

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
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage,
        timeout: this.timeout,
      });
      const base64 = Buffer.isBuffer(buffer) ? buffer.toString('base64') : (buffer as string);
      return {
        success: true,
        output: `Screenshot captured (${fullPage ? 'full page' : 'viewport'}). Base64 length: ${base64.length}. Use data:image/jpeg;base64,${base64.slice(0, 100)}... for preview.`,
        duration: Date.now() - startTime,
        artifacts: [
          {
            type: 'image' as const,
            name: 'screenshot.jpg',
            content: base64,
            mimeType: 'image/jpeg',
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Screenshot failed';
      return {
        success: false,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }
}
