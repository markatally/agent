import type { Tool, ToolContext } from './types';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { FileReaderTool } from './file_reader';
import { FileWriterTool } from './file_writer';
import { BashExecutorTool } from './bash_executor';

/**
 * Tool Registry
 * Manages available tools and converts them to LLM function calling format
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(private context: ToolContext) {
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    this.register(new FileReaderTool(this.context));
    this.register(new FileWriterTool(this.context));
    this.register(new BashExecutorTool(this.context));
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Convert tools to OpenAI function calling format
   */
  toOpenAIFunctions(toolNames?: string[]): ChatCompletionTool[] {
    const tools = toolNames
      ? toolNames.map((name) => this.tools.get(name)).filter((t): t is Tool => t !== undefined)
      : this.getAllTools();

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Check if a tool requires user confirmation
   */
  requiresConfirmation(toolName: string): boolean {
    const tool = this.getTool(toolName);
    return tool?.requiresConfirmation ?? false;
  }

  /**
   * Get tool timeout
   */
  getTimeout(toolName: string): number {
    const tool = this.getTool(toolName);
    return tool?.timeout ?? 30000;
  }
}

// Singleton instance per context
const registryCache = new Map<string, ToolRegistry>();

/**
 * Get or create tool registry for a session
 */
export function getToolRegistry(context: ToolContext): ToolRegistry {
  const cacheKey = context.sessionId;

  if (!registryCache.has(cacheKey)) {
    registryCache.set(cacheKey, new ToolRegistry(context));
  }

  return registryCache.get(cacheKey)!;
}

/**
 * Clear tool registry cache for a session
 */
export function clearToolRegistry(sessionId: string): void {
  registryCache.delete(sessionId);
}
