import type { BrowserAction } from '@mark/shared';

// Re-export all shared types from @mark/shared
export * from '@mark/shared';

// Frontend-specific types

/**
 * Extended Message type with frontend-specific properties
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

/**
 * Tool call information
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  params: Record<string, any>;
  result?: string;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Tool call status for real-time tracking
 */
export interface ToolCallStatus {
  toolCallId: string;
  toolName: string;
  params: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

/**
 * SSE Stream event types
 */
export type StreamEventType =
  | 'message.start'
  | 'message.delta'
  | 'message.complete'
  | 'thinking.start'
  | 'thinking.delta'
  | 'thinking.complete'
  | 'tool.start'
  | 'tool.progress'
  | 'tool.complete'
  | 'tool.error'
  | 'reasoning.step'
  | 'inspector.focus'
  | 'sandbox.provisioning'
  | 'sandbox.ready'
  | 'sandbox.teardown'
  | 'sandbox.fallback'
  | 'execution.step.start'
  | 'execution.step.update'
  | 'execution.step.end'
  | 'terminal.command'
  | 'terminal.stdout'
  | 'terminal.stderr'
  | 'fs.file.created'
  | 'fs.file.modified'
  | 'fs.tree.snapshot'
  | 'file.created'
  | 'table.start'
  | 'table.complete'
  | 'ppt.pipeline.start'
  | 'ppt.pipeline.step'
  | 'browse.activity'
  | 'browser.launched'
  | 'browser.navigated'
  | 'browser.action'
  | 'browser.screenshot'
  | 'browser.closed'
  | 'browser.unavailable'
  | 'browse.screenshot'
  | 'error';

export type PptStep =
  | 'research'
  | 'browsing'
  | 'reading'
  | 'synthesizing'
  | 'generating'
  | 'finalizing';

export type PptStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PptPipelineStep {
  id: PptStep;
  label: string;
  status: PptStepStatus;
}

export interface BrowseActivity {
  action: 'search' | 'visit' | 'read';
  url?: string;
  title?: string;
  query?: string;
  timestamp: number;
  /** Optional screenshot data URL for visit steps (from backend browse.screenshot) */
  screenshotDataUrl?: string;
}

/** Browser session state for Computer mode (real browser viewport) */
export interface BrowserSessionState {
  active: boolean;
  currentUrl: string;
  currentTitle: string;
  status: 'idle' | 'launching' | 'active' | 'closed';
  actions: BrowserAction[];
  currentActionIndex: number;
}

export interface StepSnapshot {
  stepIndex: number;
  timestamp: number;
  url?: string;
  screenshot?: string;
  metadata?: {
    actionDescription?: string;
    domSummary?: string;
  };
}

export interface AgentStep {
  stepIndex: number;
  messageId?: string;
  type: 'browse' | 'search' | 'tool' | 'finalize';
  snapshot?: StepSnapshot;
  output?: string;
}

export interface AgentStepTimelineState {
  steps: AgentStep[];
  currentStepIndex: number;
}

/**
 * SSE Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  data: any;
}

/**
 * API Error response
 */
export interface ApiErrorResponse {
  message: string;
  code?: string;
  status: number;
}

/**
 * Session with messages
 */
export interface SessionWithMessages {
  id: string;
  userId: string;
  name?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

/**
 * Auth response
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Sessions list response
 */
export interface SessionsResponse {
  sessions: Array<{
    id: string;
    userId: string;
    name?: string;
    status: 'active' | 'completed' | 'archived';
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      messages: number;
    };
  }>;
}

/**
 * Messages list response
 */
export interface MessagesResponse {
  messages: ChatMessage[];
}

/**
 * Form validation error
 */
export interface FormError {
  field: string;
  message: string;
}
