/**
 * LangGraph Skills Tests
 * 
 * Tests for SkillRegistry and atomic skill execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillRegistry } from '../../apps/api/src/services/langgraph/skills';
import type { AtomicSkill, SkillContext } from '../../apps/api/src/services/langgraph/skills';
import { z } from 'zod';

describe('LangGraph Skills', () => {
  describe('SkillRegistry', () => {
    let registry: SkillRegistry;
    
    beforeEach(() => {
      registry = new SkillRegistry();
    });
    
    describe('register', () => {
      it('should register a valid skill', () => {
        const skill: AtomicSkill<{ input: string }, { output: string }> = {
          metadata: {
            id: 'test-skill',
            name: 'Test Skill',
            description: 'A test skill',
            category: 'test',
            version: '1.0.0',
            retryPolicy: {
              maxRetries: 3,
              backoffMs: 1000,
              backoffMultiplier: 2,
            },
          },
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async (input) => ({ output: `processed-${input.input}` }),
        };
        
        expect(() => registry.register(skill)).not.toThrow();
        expect(registry.has('test-skill')).toBe(true);
      });
      
      it('should allow registering multiple skills', () => {
        const skill1: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-1',
            name: 'Skill 1',
            description: 'First skill',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        const skill2: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-2',
            name: 'Skill 2',
            description: 'Second skill',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        registry.register(skill1);
        registry.register(skill2);
        
        expect(registry.listIds()).toContain('skill-1');
        expect(registry.listIds()).toContain('skill-2');
      });
    });
    
    describe('get', () => {
      it('should retrieve registered skill', () => {
        const skill: AtomicSkill<any, any> = {
          metadata: {
            id: 'test-skill',
            name: 'Test Skill',
            description: 'A test skill',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        registry.register(skill);
        const retrieved = registry.get('test-skill');
        
        expect(retrieved).toBeDefined();
        expect(retrieved?.metadata.id).toBe('test-skill');
      });
      
      it('should return undefined for non-existent skill', () => {
        const retrieved = registry.get('non-existent');
        expect(retrieved).toBeUndefined();
      });
    });
    
    describe('has', () => {
      it('should return true for registered skill', () => {
        const skill: AtomicSkill<any, any> = {
          metadata: {
            id: 'test-skill',
            name: 'Test',
            description: 'Test',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        registry.register(skill);
        expect(registry.has('test-skill')).toBe(true);
      });
      
      it('should return false for non-existent skill', () => {
        expect(registry.has('non-existent')).toBe(false);
      });
    });
    
    describe('getAll', () => {
      it('should return all registered skills', () => {
        const skill1: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-1',
            name: 'Skill 1',
            description: 'First',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        const skill2: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-2',
            name: 'Skill 2',
            description: 'Second',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        registry.register(skill1);
        registry.register(skill2);
        
        const all = registry.getAll();
        expect(all).toHaveLength(2);
      });
      
      it('should return empty array when no skills registered', () => {
        expect(registry.getAll()).toEqual([]);
      });
    });
    
    describe('getByCategory', () => {
      it('should return skills in specified category', () => {
        const skill1: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-1',
            name: 'Skill 1',
            description: 'First',
            category: 'category-a',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        const skill2: AtomicSkill<any, any> = {
          metadata: {
            id: 'skill-2',
            name: 'Skill 2',
            description: 'Second',
            category: 'category-b',
            version: '1.0.0',
            retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        };
        
        registry.register(skill1);
        registry.register(skill2);
        
        const categoryA = registry.getByCategory('category-a');
        expect(categoryA).toHaveLength(1);
        expect(categoryA[0].metadata.id).toBe('skill-1');
      });
    });
    
    describe('execute', () => {
      it('should execute skill successfully', async () => {
        const skill: AtomicSkill<{ value: number }, { result: number }> = {
          metadata: {
            id: 'math-skill',
            name: 'Math Skill',
            description: 'Doubles a number',
            category: 'math',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async (input) => ({ result: input.value * 2 }),
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('math-skill', { value: 5 }, context);
        
        expect(result.success).toBe(true);
        expect(result.output?.result).toBe(10);
        expect(result.retries).toBe(0);
      });
      
      it('should return error for non-existent skill', async () => {
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('non-existent', {}, context);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Skill not found');
      });
      
      it('should validate input schema', async () => {
        const skill: AtomicSkill<{ value: number }, { result: number }> = {
          metadata: {
            id: 'strict-skill',
            name: 'Strict Skill',
            description: 'Requires number input',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async (input) => ({ result: input.value }),
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        // Invalid input (string instead of number)
        const result = await registry.execute('strict-skill', { value: 'invalid' }, context);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('validation');
      });
      
      it('should retry on failure with backoff', async () => {
        let attempts = 0;
        
        const skill: AtomicSkill<{}, {}> = {
          metadata: {
            id: 'flaky-skill',
            name: 'Flaky Skill',
            description: 'Fails first time, succeeds second time',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 2, backoffMs: 10, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            attempts++;
            if (attempts === 1) {
              throw new Error('First attempt fails');
            }
            return {};
          },
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('flaky-skill', {}, context);
        
        expect(result.success).toBe(true);
        expect(result.retries).toBe(1);
        expect(attempts).toBe(2);
      });
      
      it('should fail after max retries', async () => {
        const skill: AtomicSkill<{}, {}> = {
          metadata: {
            id: 'always-fails',
            name: 'Always Fails',
            description: 'Always throws error',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 2, backoffMs: 10, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            throw new Error('Always fails');
          },
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('always-fails', {}, context);
        
        expect(result.success).toBe(false);
        expect(result.retries).toBe(2);
        expect(result.error).toContain('Always fails');
      });
      
      it('should call beforeExecute hook if provided', async () => {
        let hookCalled = false;
        
        const skill: AtomicSkill<{ value: number }, { result: number }> = {
          metadata: {
            id: 'hook-skill',
            name: 'Hook Skill',
            description: 'Has beforeExecute hook',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async (input) => ({ result: input.value }),
          beforeExecute: async (input) => {
            hookCalled = true;
            return input;
          },
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        await registry.execute('hook-skill', { value: 5 }, context);
        
        expect(hookCalled).toBe(true);
      });
      
      it('should call afterExecute hook if provided', async () => {
        let hookCalled = false;
        
        const skill: AtomicSkill<{ value: number }, { result: number }> = {
          metadata: {
            id: 'hook-skill',
            name: 'Hook Skill',
            description: 'Has afterExecute hook',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async (input) => ({ result: input.value }),
          afterExecute: async (output) => {
            hookCalled = true;
            return output;
          },
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        await registry.execute('hook-skill', { value: 5 }, context);
        
        expect(hookCalled).toBe(true);
      });
      
      it('should validate output schema', async () => {
        const skill: AtomicSkill<{}, { value: number }> = {
          metadata: {
            id: 'bad-output-skill',
            name: 'Bad Output Skill',
            description: 'Returns invalid output',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.number() }),
          execute: async () => ({ value: 'not-a-number' } as any),
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('bad-output-skill', {}, context);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('validation');
      });
      
      it('should track execution duration', async () => {
        const skill: AtomicSkill<{}, {}> = {
          metadata: {
            id: 'slow-skill',
            name: 'Slow Skill',
            description: 'Takes time to execute',
            category: 'test',
            version: '1.0.0',
            retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
          },
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return {};
          },
        };
        
        registry.register(skill);
        
        const context: SkillContext = {
          sessionId: 'sess1',
          userId: 'user1',
          tools: {} as any,
          llm: {} as any,
          startTime: Date.now(),
        };
        
        const result = await registry.execute('slow-skill', {}, context);
        
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual(50);
      });
    });
  });
});
