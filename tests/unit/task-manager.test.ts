/**
 * Task Manager Tests
 * 
 * Tests for task CRUD operations, state transitions, and tool call limits
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../apps/api/src/services/tasks/task_manager';

describe('Task Manager', () => {
  let taskManager: TaskManager;
  
  beforeEach(() => {
    taskManager = new TaskManager();
  });
  
  describe('initializeTask', () => {
    it('should create new task state', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Search for AI papers');
      
      expect(state.sessionId).toBe('sess1');
      expect(state.userId).toBe('user1');
      expect(state.phase).toBe('planning');
      expect(state.goal).toBeDefined();
      expect(state.plan).toBeDefined();
      expect(state.plan.length).toBeGreaterThan(0);
    });
    
    it('should infer search goal', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Find papers on machine learning');
      
      expect(state.goal.requiresSearch).toBe(true);
      expect(state.goal.requiresPPT).toBe(false);
    });
    
    it('should infer PPT goal', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Create a presentation on AI');
      
      expect(state.goal.requiresPPT).toBe(true);
    });
    
    it('should infer combined goal', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Search for papers and create a PPT');
      
      expect(state.goal.requiresSearch).toBe(true);
      expect(state.goal.requiresPPT).toBe(true);
    });
    
    it('should create appropriate execution plan for search', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Find research papers');
      
      const hasSearchStep = state.plan.some(step => step.type === 'web_search');
      expect(hasSearchStep).toBe(true);
    });
    
    it('should create appropriate execution plan for PPT', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Create a presentation');
      
      const hasPptStep = state.plan.some(step => step.type === 'ppt_generation');
      expect(hasPptStep).toBe(true);
    });
  });
  
  describe('getTaskState', () => {
    it('should retrieve task state', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      const retrieved = taskManager.getTaskState('sess1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe('sess1');
    });
    
    it('should return undefined for non-existent task', () => {
      const retrieved = taskManager.getTaskState('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });
  
  describe('updateTaskState', () => {
    it('should update task state fields', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      taskManager.updateTaskState('sess1', {
        phase: 'executing',
        currentStep: 1,
      });
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('executing');
      expect(state?.currentStep).toBe(1);
    });
    
    it('should update updatedAt timestamp', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      const originalTimestamp = taskManager.getTaskState('sess1')?.updatedAt;
      
      // Wait a bit
      setTimeout(() => {
        taskManager.updateTaskState('sess1', { phase: 'executing' });
        
        const newTimestamp = taskManager.getTaskState('sess1')?.updatedAt;
        expect(newTimestamp).not.toEqual(originalTimestamp);
      }, 10);
    });
  });
  
  describe('recordToolCall', () => {
    it('should record tool call in history', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      taskManager.recordToolCall('sess1', 'web_search', { query: 'AI agents' }, { count: 5 });
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.searchResults).toBeDefined();
    });
    
    it('should update step status when tool matches step', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      taskManager.recordToolCall('sess1', 'web_search', { query: 'AI' }, { papers: [] });
      
      const updatedState = taskManager.getTaskState('sess1');
      const searchStep = updatedState?.plan.find(s => s.type === 'web_search');
      expect(searchStep?.status).toBe('completed');
    });
  });
  
  describe('shouldAllowToolCall', () => {
    it('should allow first web_search call', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      const allowed = taskManager.shouldAllowToolCall('sess1', 'web_search', { query: 'AI' });
      expect(allowed).toBe(true);
    });
    
    it('should block duplicate web_search calls', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      // First call allowed
      taskManager.recordToolCall('sess1', 'web_search', { query: 'AI' }, {});
      
      // Second call blocked
      const allowed = taskManager.shouldAllowToolCall('sess1', 'web_search', { query: 'ML' });
      expect(allowed).toBe(false);
    });
    
    it('should block tool calls when task is completed', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      taskManager.completeTask('sess1');
      
      const allowed = taskManager.shouldAllowToolCall('sess1', 'web_search', { query: 'AI' });
      expect(allowed).toBe(false);
    });
    
    it('should allow other tools on first call', () => {
      taskManager.initializeTask('sess1', 'user1', 'Create presentation');
      
      const allowed = taskManager.shouldAllowToolCall('sess1', 'ppt_generator', { topic: 'AI' });
      expect(allowed).toBe(true);
    });
  });

  describe('consecutive failures', () => {
    it('should block tool after consecutive failures', () => {
      taskManager.initializeTask('sess1', 'user1', 'Create presentation');

      taskManager.recordToolCall('sess1', 'ppt_generator', { topic: 'AI' }, {}, false);
      taskManager.recordToolCall('sess1', 'ppt_generator', { topic: 'AI' }, {}, false);

      const allowed = taskManager.shouldAllowToolCall('sess1', 'ppt_generator', { topic: 'AI' });
      expect(allowed).toBe(false);
    });

    it('should reset failure count after a success', () => {
      taskManager.initializeTask('sess1', 'user1', 'Create presentation');

      taskManager.recordToolCall('sess1', 'ppt_generator', { topic: 'AI' }, {}, false);
      taskManager.recordToolCall('sess1', 'ppt_generator', { topic: 'AI' }, {}, true);
      taskManager.recordToolCall('sess1', 'ppt_generator', { topic: 'AI' }, {}, false);

      const allowed = taskManager.shouldAllowToolCall('sess1', 'ppt_generator', { topic: 'AI' });
      expect(allowed).toBe(true);
    });
  });
  
  describe('reflect', () => {
    it('should determine completion when all steps done', () => {
      const state = taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      // Complete all steps
      state.plan.forEach(step => {
        step.status = 'completed';
      });
      taskManager.updateTaskState('sess1', { plan: state.plan });
      
      const reflection = taskManager.reflect('sess1');
      expect(reflection.isComplete).toBe(true);
    });
    
    it('should determine incomplete when steps remain', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      const reflection = taskManager.reflect('sess1');
      expect(reflection.isComplete).toBe(false);
      expect(reflection.shouldContinue).toBe(true);
    });
  });
  
  describe('completeTask', () => {
    it('should mark task as completed', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      taskManager.completeTask('sess1');
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('completed');
    });
  });
  
  describe('failTask', () => {
    it('should mark task as failed with reason', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      taskManager.failTask('sess1', 'Test failure reason');
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('failed');
    });
  });
  
  describe('clearTask', () => {
    it('should remove task state', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      taskManager.clearTask('sess1');
      
      const state = taskManager.getTaskState('sess1');
      expect(state).toBeUndefined();
    });
  });
  
  describe('getTaskSummary', () => {
    it('should return formatted summary', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for AI papers');
      
      const summary = taskManager.getTaskSummary('sess1');
      expect(summary).toContain('Search for AI papers');
      expect(summary).toContain('planning');
    });
    
    it('should return empty for non-existent task', () => {
      const summary = taskManager.getTaskSummary('non-existent');
      expect(summary).toBe('');
    });
  });
  
  describe('getSystemPromptContext', () => {
    it('should return context for LLM prompts', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search for papers');
      
      const context = taskManager.getSystemPromptContext('sess1');
      expect(context).toContain('Task Goal');
      expect(context).toContain('Execution Plan');
    });
    
    it('should return empty for non-existent task', () => {
      const context = taskManager.getSystemPromptContext('non-existent');
      expect(context).toBe('');
    });
  });
  
  describe('State transitions', () => {
    it('should transition from planning to executing', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      
      taskManager.updateTaskState('sess1', { phase: 'executing' });
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('executing');
    });
    
    it('should transition from executing to reflecting', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      taskManager.updateTaskState('sess1', { phase: 'executing' });
      
      taskManager.updateTaskState('sess1', { phase: 'reflecting' });
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('reflecting');
    });
    
    it('should transition from reflecting to completed', () => {
      taskManager.initializeTask('sess1', 'user1', 'Test task');
      taskManager.updateTaskState('sess1', { phase: 'reflecting' });
      
      taskManager.completeTask('sess1');
      
      const state = taskManager.getTaskState('sess1');
      expect(state?.phase).toBe('completed');
    });
  });
  
  describe('Multiple sessions', () => {
    it('should manage multiple task states independently', () => {
      taskManager.initializeTask('sess1', 'user1', 'Task 1');
      taskManager.initializeTask('sess2', 'user2', 'Task 2');
      
      const state1 = taskManager.getTaskState('sess1');
      const state2 = taskManager.getTaskState('sess2');
      
      expect(state1?.sessionId).toBe('sess1');
      expect(state2?.sessionId).toBe('sess2');
      expect(state1?.goal.description).toBe('Task 1');
      expect(state2?.goal.description).toBe('Task 2');
    });
    
    it('should track tool calls separately per session', () => {
      taskManager.initializeTask('sess1', 'user1', 'Search 1');
      taskManager.initializeTask('sess2', 'user2', 'Search 2');
      
      taskManager.recordToolCall('sess1', 'web_search', { query: 'AI' }, {});
      
      // sess1 should block second search
      expect(taskManager.shouldAllowToolCall('sess1', 'web_search', { query: 'ML' })).toBe(false);
      
      // sess2 should still allow first search
      expect(taskManager.shouldAllowToolCall('sess2', 'web_search', { query: 'ML' })).toBe(true);
    });
  });
});
