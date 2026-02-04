/**
 * Prompt Runtime Tests
 * 
 * Tests for LLM-based skill execution with retry logic and timeout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptRuntime } from '../../apps/api/src/services/skills/runtimes/prompt-runtime';
import type { ExternalSkillContract, ExecutionContext } from '@mark/shared';
import type { LLMClient } from '../../apps/api/src/services/llm';

describe('Prompt Runtime', () => {
  let runtime: PromptRuntime;
  let mockLLMClient: LLMClient;
  let mockSkill: ExternalSkillContract;
  let mockContext: ExecutionContext;
  
  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: '{"result": "success"}',
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      }),
    } as any;
    
    runtime = new PromptRuntime(mockLLMClient);
    
    mockSkill = {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill',
      kind: 'prompt',
      systemPrompt: 'You are a test assistant',
      userPromptTemplate: 'Process: {userInput}',
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      platformId: 'test',
      contractVersion: '1.0',
    } as any;
    
    mockContext = {
      sessionId: 'sess1',
      userId: 'user1',
      userTier: 'free',
      resolvedPolicy: {
        retryCount: 2,
        timeoutMs: 5000,
        maxTokens: 1000,
      },
      workspaceFiles: [],
    } as any;
  });
  
  describe('run', () => {
    it('should execute skill successfully', async () => {
      const result = await runtime.run(mockSkill, 'test input', {}, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.tokensUsed).toBe(100);
    });
    
    it('should build messages with system and user prompts', async () => {
      await runtime.run(mockSkill, 'test input', {}, mockContext);
      
      expect(mockLLMClient.chat).toHaveBeenCalled();
      const messages = (mockLLMClient.chat as any).mock.calls[0][0];
      
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('test assistant');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('test input');
    });
    
    it('should substitute template variables', async () => {
      await runtime.run(mockSkill, 'my input', {}, mockContext);
      
      const messages = (mockLLMClient.chat as any).mock.calls[0][0];
      const userMessage = messages[1].content;
      
      expect(userMessage).toContain('my input');
      expect(userMessage).not.toContain('{userInput}');
    });
    
    it('should retry on failure', async () => {
      let attempts = 0;
      (mockLLMClient.chat as any).mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('First attempt fails');
        }
        return Promise.resolve({
          content: '{"result": "success"}',
          usage: { totalTokens: 100 },
        });
      });
      
      const result = await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.metrics?.retryCount).toBe(1);
      expect(attempts).toBe(2);
    });
    
    it('should fail after max retries', async () => {
      (mockLLMClient.chat as any).mockRejectedValue(new Error('Always fails'));
      
      const result = await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBeDefined();
      expect(result.metrics?.retryCount).toBe(2); // maxRetries from context
    });
    
    it('should handle timeout', async () => {
      (mockLLMClient.chat as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          content: '{"result": "late"}',
          usage: {},
        }), 10000))
      );
      
      mockContext.resolvedPolicy.timeoutMs = 100;
      
      const result = await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe('TIMEOUT');
    });
    
    it('should validate output schema', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: '{"wrong": "field"}', // Doesn't match schema
        usage: {},
      });
      
      const result = await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe('VALIDATION');
    });
    
    it('should handle malformed JSON output', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: 'Not JSON at all',
        usage: {},
      });
      
      const result = await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(result.success).toBe(false);
    });
    
    it('should apply exponential backoff between retries', async () => {
      const timestamps: number[] = [];
      
      (mockLLMClient.chat as any).mockImplementation(async () => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          throw new Error('Fail');
        }
        return { content: '{"result": "success"}', usage: {} };
      });
      
      await runtime.run(mockSkill, 'test', {}, mockContext);
      
      expect(timestamps.length).toBe(3);
      // Check that delays increase (basic exponential backoff)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThan(delay1);
    });
    
    it('should use maxTokens from policy', async () => {
      await runtime.run(mockSkill, 'test', {}, mockContext);
      
      const options = (mockLLMClient.chat as any).mock.calls[0][2];
      expect(options.maxTokens).toBe(1000);
    });
  });
});
