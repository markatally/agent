import type { JSONSchema } from '@manus/shared';

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  artifacts?: Artifact[];
}

/**
 * Artifact produced by tool execution
 */
export interface Artifact {
  type: 'file' | 'image' | 'code' | 'data';
  name: string;
  content: string | Buffer;
  mimeType?: string;
}

/**
 * Tool interface following SPEC.md pattern (lines 504-513)
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(params: Record<string, any>): Promise<ToolResult>;
  requiresConfirmation: boolean;
  timeout: number;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionId: string;
  userId: string;
  workspaceDir: string;
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public params: Record<string, any>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
