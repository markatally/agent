import fs from 'fs/promises';
import path from 'path';
import type { Tool, ToolResult, ToolContext } from './types';

/**
 * File Reader Tool
 * Reads file contents from the workspace
 */
export class FileReaderTool implements Tool {
  name = 'file_reader';
  description = 'Read contents of a file from the workspace';
  requiresConfirmation = false;
  timeout = 5000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'File path relative to workspace',
      },
      encoding: {
        type: 'string' as const,
        enum: ['utf-8', 'base64'],
        description: 'Encoding for reading (default: utf-8)',
      },
    },
    required: ['path'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const filePath = params.path as string;
      const encoding = (params.encoding as 'utf-8' | 'base64') || 'utf-8';

      // Validate path
      if (!filePath) {
        return {
          success: false,
          output: '',
          error: 'File path is required',
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

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          success: false,
          output: '',
          error: `File not found: ${filePath}`,
          duration: Date.now() - startTime,
        };
      }

      // Read file
      let content: string;
      if (encoding === 'base64') {
        const buffer = await fs.readFile(absolutePath);
        content = buffer.toString('base64');
      } else {
        content = await fs.readFile(absolutePath, 'utf-8');
      }

      return {
        success: true,
        output: content,
        duration: Date.now() - startTime,
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
}
