/**
 * LangGraph Nodes Tests
 * 
 * Tests for NodeExecutor and node execution logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeExecutor } from '../../apps/api/src/services/langgraph/nodes';
import type { GraphNode, Precondition, Postcondition, NodeContext } from '../../apps/api/src/services/langgraph/nodes';
import type { AgentState } from '../../apps/api/src/services/langgraph/types';

describe('LangGraph Nodes', () => {
  describe('NodeExecutor', () => {
    let executor: NodeExecutor;
    let mockContext: NodeContext;
    let baseState: AgentState;
    
    beforeEach(() => {
      executor = new NodeExecutor();
      mockContext = {
        skills: {} as any,
        tools: {} as any,
        llm: {} as any,
        sessionId: 'test-session',
        userId: 'test-user',
      };
      baseState = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'test',
        currentNode: '',
        executionHistory: [],
        intermediateResults: {},
        errors: [],
        warnings: [],
        status: 'pending',
      };
    });
    
    it('should execute node successfully', async () => {
      const node: GraphNode<AgentState, any, any> = {
        id: 'test-node',
        name: 'Test Node',
        description: 'A test node',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, testResult: output },
        }),
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'success' });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should check preconditions before execution', async () => {
      const failingPrecondition: Precondition<AgentState> = {
        name: 'Must have prompt',
        check: (state) => state.userPrompt.length > 0,
        errorMessage: 'User prompt is required',
        severity: 'fatal',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'guarded-node',
        name: 'Guarded Node',
        description: 'Has preconditions',
        preconditions: [failingPrecondition],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => state,
      };
      
      const emptyPromptState = { ...baseState, userPrompt: '' };
      const result = await executor.execute(node, emptyPromptState, undefined, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PRECONDITION_FAILED');
      expect(result.error?.message).toContain('User prompt is required');
      expect(result.preconditionResults).toHaveLength(1);
      expect(result.preconditionResults[0].passed).toBe(false);
    });
    
    it('should pass when preconditions are met', async () => {
      const passingPrecondition: Precondition<AgentState> = {
        name: 'Must have prompt',
        check: (state) => state.userPrompt.length > 0,
        errorMessage: 'User prompt is required',
        severity: 'fatal',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'guarded-node',
        name: 'Guarded Node',
        description: 'Has preconditions',
        preconditions: [passingPrecondition],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.preconditionResults).toHaveLength(1);
      expect(result.preconditionResults[0].passed).toBe(true);
    });
    
    it('should check postconditions after execution', async () => {
      const failingPostcondition: Postcondition<AgentState, any> = {
        name: 'Must return non-null',
        check: (state, output) => output !== null,
        errorMessage: 'Output cannot be null',
        severity: 'error',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'checked-node',
        name: 'Checked Node',
        description: 'Has postconditions',
        preconditions: [],
        postconditions: [failingPostcondition],
        execute: async () => null,
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('POSTCONDITION_FAILED');
      expect(result.postconditionResults).toHaveLength(1);
      expect(result.postconditionResults[0].passed).toBe(false);
    });
    
    it('should handle warnings from postconditions', async () => {
      const warningPostcondition: Postcondition<AgentState, any> = {
        name: 'Should be optimal',
        check: (state, output) => output.quality === 'optimal',
        errorMessage: 'Output quality is not optimal',
        severity: 'warning',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'warning-node',
        name: 'Warning Node',
        description: 'Has warning postconditions',
        preconditions: [],
        postconditions: [warningPostcondition],
        execute: async () => ({ quality: 'acceptable' }),
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      // Should still succeed despite warning
      expect(result.success).toBe(true);
      expect(result.postconditionResults).toHaveLength(1);
      expect(result.postconditionResults[0].passed).toBe(false);
    });
    
    it('should handle node execution errors', async () => {
      const node: GraphNode<AgentState, any, any> = {
        id: 'error-node',
        name: 'Error Node',
        description: 'Throws an error',
        preconditions: [],
        postconditions: [],
        execute: async () => {
          throw new Error('Execution failed');
        },
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NODE_EXECUTION_ERROR');
      expect(result.error?.message).toContain('Execution failed');
    });
    
    it('should execute multiple preconditions', async () => {
      const precondition1: Precondition<AgentState> = {
        name: 'Has prompt',
        check: (state) => state.userPrompt.length > 0,
        errorMessage: 'Prompt required',
        severity: 'fatal',
      };
      
      const precondition2: Precondition<AgentState> = {
        name: 'Has session',
        check: (state) => state.sessionId.length > 0,
        errorMessage: 'Session required',
        severity: 'fatal',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'multi-guard-node',
        name: 'Multi Guard Node',
        description: 'Has multiple preconditions',
        preconditions: [precondition1, precondition2],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.preconditionResults).toHaveLength(2);
      expect(result.preconditionResults.every(r => r.passed)).toBe(true);
    });
    
    it('should stop at first fatal precondition failure', async () => {
      const precondition1: Precondition<AgentState> = {
        name: 'Has prompt',
        check: (state) => state.userPrompt.length > 0,
        errorMessage: 'Prompt required',
        severity: 'fatal',
      };
      
      const precondition2: Precondition<AgentState> = {
        name: 'Never checked',
        check: (state) => false,
        errorMessage: 'Should not be checked',
        severity: 'fatal',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'early-fail-node',
        name: 'Early Fail Node',
        description: 'Fails at first precondition',
        preconditions: [precondition1, precondition2],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => state,
      };
      
      const emptyPromptState = { ...baseState, userPrompt: '' };
      const result = await executor.execute(node, emptyPromptState, undefined, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.preconditionResults).toHaveLength(1);
    });
    
    it('should execute multiple postconditions', async () => {
      const postcondition1: Postcondition<AgentState, any> = {
        name: 'Has result',
        check: (state, output) => output.result !== undefined,
        errorMessage: 'Result required',
        severity: 'error',
      };
      
      const postcondition2: Postcondition<AgentState, any> = {
        name: 'Result is string',
        check: (state, output) => typeof output.result === 'string',
        errorMessage: 'Result must be string',
        severity: 'error',
      };
      
      const node: GraphNode<AgentState, any, any> = {
        id: 'multi-check-node',
        name: 'Multi Check Node',
        description: 'Has multiple postconditions',
        preconditions: [],
        postconditions: [postcondition1, postcondition2],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.postconditionResults).toHaveLength(2);
      expect(result.postconditionResults.every(r => r.passed)).toBe(true);
    });
    
    it('should measure execution time', async () => {
      const node: GraphNode<AgentState, any, any> = {
        id: 'timed-node',
        name: 'Timed Node',
        description: 'Takes measurable time',
        preconditions: [],
        postconditions: [],
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'done' };
        },
        updateState: (state, output) => state,
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
    
    it('should handle complex output types', async () => {
      const node: GraphNode<AgentState, any, any> = {
        id: 'complex-node',
        name: 'Complex Node',
        description: 'Returns complex output',
        preconditions: [],
        postconditions: [],
        execute: async () => ({
          data: [1, 2, 3],
          meta: { timestamp: new Date(), count: 3 },
          nested: { deep: { value: 'test' } },
        }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, complex: output },
        }),
      };
      
      const result = await executor.execute(node, baseState, undefined, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.output?.data).toEqual([1, 2, 3]);
      expect(result.output?.nested.deep.value).toBe('test');
    });
  });
});
