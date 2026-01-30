import fs from 'fs/promises';
import path from 'path';
import type { Tool, ToolResult, ToolContext } from './types';

/**
 * File Writer Tool
 * Writes or modifies files in the workspace
 */
export class FileWriterTool implements Tool {
  name = 'file_writer';
  description = 'Write or modify a file in the workspace';
  requiresConfirmation = true; // Requires user approval
  timeout = 5000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'File path relative to workspace',
      },
      content: {
        type: 'string' as const,
        description: 'Content to write',
      },
      mode: {
        type: 'string' as const,
        enum: ['write', 'append'],
        description: 'Write mode (default: write)',
      },
    },
    required: ['path', 'content'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const filePath = params.path as string;
      const content = params.content as string;
      const mode = (params.mode as 'write' | 'append') || 'write';

      // Validate inputs
      if (!filePath) {
        return {
          success: false,
          output: '',
          error: 'File path is required',
          duration: Date.now() - startTime,
        };
      }

      if (content === undefined || content === null) {
        return {
          success: false,
          output: '',
          error: 'Content is required',
          duration: Date.now() - startTime,
        };
      }

      // Resolve absolute path within workspace
      const absolutePath = path.resolve(this.context.workspaceDir, filePath);

      // Security check: ensure path is within workspace
      if (!absolutePath.startsWith(this.context.workspaceDir)) {
        return {
          success: false,
          output: '',
          error: 'Access denied: path outside workspace',
          duration: Date.now() - startTime,
        };
      }

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      if (mode === 'append') {
        await fs.appendFile(absolutePath, content, 'utf-8');
      } else {
        await fs.writeFile(absolutePath, content, 'utf-8');
      }

      // Get file stats
      const stats = await fs.stat(absolutePath);

      return {
        success: true,
        output: `File ${mode === 'append' ? 'appended' : 'written'} successfully: ${filePath} (${stats.size} bytes)`,
        duration: Date.now() - startTime,
        artifacts: [
          {
            type: 'file',
            name: path.basename(filePath),
            content,
            mimeType: this.getMimeType(filePath),
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeTypes[ext] || 'text/plain';
  }
}
