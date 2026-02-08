import type { ToolContext } from '../tools/types';
import type { ToolExecutor } from '../tools/executor';
import type { SandboxManager } from './manager';
import type { ToolResult } from '../tools/types';

type StreamEmitter = (event: { type: string; sessionId: string; data?: any }) => Promise<void>;

const emitTerminalOutput = async (
  emit: StreamEmitter,
  sessionId: string,
  stream: 'stdout' | 'stderr',
  output?: string
) => {
  if (!output) return;
  const lines = output.split('\n').filter((line) => line.trim().length > 0);
  for (const line of lines) {
    await emit({
      type: stream === 'stderr' ? 'terminal.stderr' : 'terminal.stdout',
      sessionId,
      data: { line },
    });
  }
};

const createObservableToolExecutor = (
  baseExecutor: ToolExecutor,
  emit: StreamEmitter,
  sessionId: string
): ToolExecutor => {
  return {
    async execute(toolName: string, params: Record<string, any>, options?: { onProgress?: any }) {
      const stepId = `tool-${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await emit({
        type: 'execution.step.start',
        sessionId,
        data: {
          stepId,
          label: toolName,
          toolName,
          params,
        },
      });

      if (toolName === 'bash_executor' && params?.command) {
        await emit({
          type: 'terminal.command',
          sessionId,
          data: { command: params.command },
        });
      }

      const result: ToolResult = await baseExecutor.execute(toolName, params, {
        onProgress: async (current: number, total: number, message?: string) => {
          await emit({
            type: 'execution.step.update',
            sessionId,
            data: { stepId, current, total, message },
          });
          options?.onProgress?.(current, total, message);
        },
      });

      if (toolName === 'bash_executor') {
        await emitTerminalOutput(emit, sessionId, 'stdout', result.output);
        await emitTerminalOutput(emit, sessionId, 'stderr', result.error);
      }

      if (result.artifacts?.length) {
        for (const artifact of result.artifacts) {
          await emit({
            type: 'fs.file.created',
            sessionId,
            data: {
              path: artifact.name,
              size: artifact.size,
              mimeType: artifact.mimeType,
            },
          });
        }
      }

      await emit({
        type: 'execution.step.end',
        sessionId,
        data: {
          stepId,
          toolName,
          success: result.success,
          message: result.error,
        },
      });

      return result;
    },
  } as ToolExecutor;
};

interface SandboxOrchestratorParams {
  sessionId: string;
  messages: any[];
  tools: any;
  toolContext: ToolContext;
  taskManager: any;
  prisma: any;
  llmClient: any;
  startTime: number;
  toolExecutor: ToolExecutor;
  sseStream: { writeSSE: (payload: { data: string }) => Promise<void> };
  processAgentTurn: (
    sessionId: string,
    messages: any[],
    tools: any,
    toolContext: ToolContext,
    taskManager: any,
    prisma: any,
    llmClient: any,
    toolExecutor: ToolExecutor,
    sseStream: { writeSSE: (payload: { data: string }) => Promise<void> },
    startTime: number
  ) => Promise<any>;
}

export class SandboxOrchestrator {
  constructor(private sandboxManager: SandboxManager) {}

  async execute(params: SandboxOrchestratorParams): Promise<any> {
    const { sessionId, toolContext, toolExecutor, sseStream, processAgentTurn } = params;

    const emit: StreamEmitter = async (event) => {
      await sseStream.writeSSE({
        data: JSON.stringify({
          type: event.type,
          sessionId: event.sessionId,
          timestamp: Date.now(),
          data: event.data || {},
        }),
      });
    };

    await emit({
      type: 'sandbox.provisioning',
      sessionId,
      data: { message: 'Provisioning sandbox' },
    });

    await this.sandboxManager.createSandbox({
      sessionId,
      workspaceDir: toolContext.workspaceDir,
    });

    await emit({
      type: 'sandbox.ready',
      sessionId,
      data: { message: 'Sandbox ready' },
    });

    const observableExecutor = createObservableToolExecutor(toolExecutor, emit, sessionId);
    const result = await processAgentTurn(
      sessionId,
      params.messages,
      params.tools,
      toolContext,
      params.taskManager,
      params.prisma,
      params.llmClient,
      observableExecutor,
      sseStream,
      params.startTime
    );

    await emit({
      type: 'sandbox.teardown',
      sessionId,
      data: { message: 'Sandbox cleanup scheduled' },
    });

    return result;
  }
}
