/**
 * LangGraph Graphs Tests
 * 
 * Tests for GraphExecutor and graph definitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphExecutor } from '../../apps/api/src/services/langgraph/graphs';
import type { GraphDefinition, Edge, ConditionalEdge } from '../../apps/api/src/services/langgraph/graphs';
import type { AgentState } from '../../apps/api/src/services/langgraph/types';
import type { GraphNode, NodeContext } from '../../apps/api/src/services/langgraph/nodes';

describe('LangGraph Graphs', () => {
  describe('GraphExecutor', () => {
    let mockContext: NodeContext;
    
    beforeEach(() => {
      mockContext = {
        skills: {} as any,
        tools: {} as any,
        llm: {} as any,
        sessionId: 'test-session',
        userId: 'test-user',
      };
    });
    
    it('should execute simple linear graph', async () => {
      // Create a simple test node
      const testNode: GraphNode<AgentState, any, any> = {
        id: 'test-node',
        name: 'Test Node',
        description: 'A test node',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ result: 'success' }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, testNode: output },
          status: 'completed' as const,
        }),
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'test-graph',
        name: 'Test Graph',
        entryPoint: 'test-node',
        nodes: new Map([['test-node', testNode]]),
        edges: [{ from: 'test-node', to: 'END' }],
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['test-node']);
      expect(result.finalState.intermediateResults.testNode).toEqual({ result: 'success' });
    });
    
    it('should execute graph with multiple sequential nodes', async () => {
      const node1: GraphNode<AgentState, any, any> = {
        id: 'node1',
        name: 'Node 1',
        description: 'First node',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ step: 1 }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, step1: output },
        }),
      };
      
      const node2: GraphNode<AgentState, any, any> = {
        id: 'node2',
        name: 'Node 2',
        description: 'Second node',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ step: 2 }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, step2: output },
          status: 'completed' as const,
        }),
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'sequential-graph',
        name: 'Sequential Graph',
        entryPoint: 'node1',
        nodes: new Map([
          ['node1', node1],
          ['node2', node2],
        ]),
        edges: [
          { from: 'node1', to: 'node2' },
          { from: 'node2', to: 'END' },
        ],
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['node1', 'node2']);
      expect(result.finalState.intermediateResults.step1).toEqual({ step: 1 });
      expect(result.finalState.intermediateResults.step2).toEqual({ step: 2 });
    });
    
    it('should handle conditional edges', async () => {
      const decisionNode: GraphNode<AgentState, any, any> = {
        id: 'decision',
        name: 'Decision Node',
        description: 'Makes a decision',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ decision: 'go-left' }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, decision: output },
        }),
      };
      
      const leftNode: GraphNode<AgentState, any, any> = {
        id: 'left',
        name: 'Left Node',
        description: 'Left path',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ path: 'left' }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, path: output },
          status: 'completed' as const,
        }),
      };
      
      const rightNode: GraphNode<AgentState, any, any> = {
        id: 'right',
        name: 'Right Node',
        description: 'Right path',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ path: 'right' }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, path: output },
          status: 'completed' as const,
        }),
      };
      
      const conditionalEdge: ConditionalEdge<AgentState> = {
        from: 'decision',
        condition: (state) => {
          const decision = state.intermediateResults.decision as any;
          return decision?.decision === 'go-left' ? 'left' : 'right';
        },
        routes: {
          left: 'left',
          right: 'right',
        },
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'conditional-graph',
        name: 'Conditional Graph',
        entryPoint: 'decision',
        nodes: new Map([
          ['decision', decisionNode],
          ['left', leftNode],
          ['right', rightNode],
        ]),
        edges: [
          { from: 'left', to: 'END' },
          { from: 'right', to: 'END' },
        ],
        conditionalEdges: [conditionalEdge],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['decision', 'left']);
      expect(result.finalState.intermediateResults.path).toEqual({ path: 'left' });
    });
    
    it('should handle node failure with failure handler', async () => {
      const failingNode: GraphNode<AgentState, any, any> = {
        id: 'failing-node',
        name: 'Failing Node',
        description: 'Always fails',
        preconditions: [],
        postconditions: [],
        execute: async () => {
          throw new Error('Node execution failed');
        },
        updateState: (state, output) => state,
      };
      
      const failureHandler: GraphNode<AgentState, any, any> = {
        id: 'failure_handler',
        name: 'Failure Handler',
        description: 'Handles failures',
        preconditions: [],
        postconditions: [],
        execute: async () => ({ handled: true }),
        updateState: (state, output) => ({
          ...state,
          intermediateResults: { ...state.intermediateResults, failureHandled: true },
          status: 'failed' as const,
        }),
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'failure-graph',
        name: 'Failure Graph',
        entryPoint: 'failing-node',
        nodes: new Map([
          ['failing-node', failingNode],
          ['failure_handler', failureHandler],
        ]),
        edges: [{ from: 'failure_handler', to: 'END' }],
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.executionPath).toContain('failing-node');
      expect(result.executionPath).toContain('failure_handler');
      expect(result.finalState.intermediateResults.failureHandled).toBe(true);
    });
    
    it('should throw error for missing node', async () => {
      const testNode: GraphNode<AgentState, any, any> = {
        id: 'test-node',
        name: 'Test Node',
        description: 'Test',
        preconditions: [],
        postconditions: [],
        execute: async () => ({}),
        updateState: (state) => state,
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'invalid-graph',
        name: 'Invalid Graph',
        entryPoint: 'non-existent-node', // Node doesn't exist
        nodes: new Map([['test-node', testNode]]),
        edges: [],
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      
      await expect(executor.execute(initialState)).rejects.toThrow('Node not found');
    });
    
    it('should track execution duration', async () => {
      const slowNode: GraphNode<AgentState, any, any> = {
        id: 'slow-node',
        name: 'Slow Node',
        description: 'Takes time',
        preconditions: [],
        postconditions: [],
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {};
        },
        updateState: (state) => ({ ...state, status: 'completed' as const }),
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'timing-graph',
        name: 'Timing Graph',
        entryPoint: 'slow-node',
        nodes: new Map([['slow-node', slowNode]]),
        edges: [{ from: 'slow-node', to: 'END' }],
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.totalDuration).toBeGreaterThanOrEqual(50);
    });
    
    it('should return to END when no edges match', async () => {
      const orphanNode: GraphNode<AgentState, any, any> = {
        id: 'orphan',
        name: 'Orphan Node',
        description: 'Has no outgoing edges',
        preconditions: [],
        postconditions: [],
        execute: async () => ({}),
        updateState: (state) => ({ ...state, status: 'completed' as const }),
      };
      
      const graph: GraphDefinition<AgentState> = {
        id: 'orphan-graph',
        name: 'Orphan Graph',
        entryPoint: 'orphan',
        nodes: new Map([['orphan', orphanNode]]),
        edges: [], // No edges defined
        conditionalEdges: [],
      };
      
      const initialState: AgentState = {
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
      
      const executor = new GraphExecutor(graph, mockContext);
      const result = await executor.execute(initialState);
      
      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['orphan']);
    });
  });
});
