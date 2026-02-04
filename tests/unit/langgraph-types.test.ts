/**
 * LangGraph Types Tests
 * 
 * Tests for Zod schema validation and type correctness
 */

import { describe, it, expect } from 'vitest';
import {
  ParsedIntentSchema,
  ExecutionStepSchema,
  AgentErrorSchema,
  AgentStateSchema,
  PaperSchema,
  PaperSummarySchema,
  ClaimSchema,
  ComparisonMatrixSchema,
  ResearchReportSchema,
  RecallAttemptSchema,
  ResearchStateSchema,
  OutlineSchema,
  SlideSchema,
  PPTStateSchema,
  ContentChunkSchema,
  KeyPointSchema,
  SummaryStateSchema,
  ToolCallRecordSchema,
  ChatStateSchema,
  RetryPolicySchema,
  SkillMetadataSchema,
  ValidationResultSchema,
  ConditionResultSchema,
} from '../../apps/api/src/services/langgraph/types';

describe('LangGraph Type Schemas', () => {
  describe('ParsedIntentSchema', () => {
    it('should validate correct parsed intent', () => {
      const valid = {
        scenario: 'research',
        entities: { topic: 'AI' },
        parameters: { limit: 10 },
        confidence: 0.95,
      };
      
      expect(() => ParsedIntentSchema.parse(valid)).not.toThrow();
    });
    
    it('should reject invalid scenario', () => {
      const invalid = {
        scenario: 'invalid_scenario',
        entities: {},
        parameters: {},
        confidence: 0.5,
      };
      
      expect(() => ParsedIntentSchema.parse(invalid)).toThrow();
    });
    
    it('should reject confidence out of range', () => {
      const invalid = {
        scenario: 'research',
        entities: {},
        parameters: {},
        confidence: 1.5,
      };
      
      expect(() => ParsedIntentSchema.parse(invalid)).toThrow();
    });
  });
  
  describe('ExecutionStepSchema', () => {
    it('should validate execution step with all fields', () => {
      const valid = {
        nodeId: 'node1',
        nodeName: 'TestNode',
        startTime: new Date(),
        endTime: new Date(),
        input: { test: true },
        output: { result: 'success' },
        durationMs: 100,
      };
      
      expect(() => ExecutionStepSchema.parse(valid)).not.toThrow();
    });
    
    it('should accept step without optional fields', () => {
      const minimal = {
        nodeId: 'node1',
        nodeName: 'TestNode',
        startTime: new Date(),
        input: {},
      };
      
      expect(() => ExecutionStepSchema.parse(minimal)).not.toThrow();
    });
    
    it('should coerce date strings to Date objects', () => {
      const withStringDate = {
        nodeId: 'node1',
        nodeName: 'TestNode',
        startTime: '2024-01-01T00:00:00Z',
        input: {},
      };
      
      const result = ExecutionStepSchema.parse(withStringDate);
      expect(result.startTime).toBeInstanceOf(Date);
    });
  });
  
  describe('AgentErrorSchema', () => {
    it('should validate agent error with defaults', () => {
      const valid = {
        code: 'TEST_ERROR',
        message: 'Test error message',
      };
      
      const result = AgentErrorSchema.parse(valid);
      expect(result.severity).toBe('error');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    it('should accept all severity levels', () => {
      const severities = ['warning', 'error', 'fatal'];
      
      severities.forEach(severity => {
        const error = {
          code: 'TEST',
          message: 'Test',
          severity,
        };
        expect(() => AgentErrorSchema.parse(error)).not.toThrow();
      });
    });
  });
  
  describe('AgentStateSchema', () => {
    it('should validate base agent state', () => {
      const valid = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Test prompt',
      };
      
      const result = AgentStateSchema.parse(valid);
      expect(result.currentNode).toBe('');
      expect(result.executionHistory).toEqual([]);
      expect(result.intermediateResults).toEqual({});
      expect(result.errors).toEqual([]);
      expect(result.status).toBe('pending');
    });
  });
  
  describe('PaperSchema', () => {
    it('should validate paper with all fields', () => {
      const valid = {
        id: 'paper1',
        title: 'Test Paper',
        authors: ['Author 1', 'Author 2'],
        abstract: 'Abstract text',
        url: 'https://example.com/paper',
        source: 'arxiv',
        publishedDate: new Date('2024-01-01'),
        citationCount: 10,
        doi: '10.1234/test',
        keywords: ['AI', 'ML'],
        publicationDateSource: 'arxiv_v1',
      };
      
      expect(() => PaperSchema.parse(valid)).not.toThrow();
    });
    
    it('should accept minimal paper fields', () => {
      const minimal = {
        id: 'paper1',
        title: 'Test Paper',
        authors: ['Author 1'],
        abstract: 'Abstract',
        url: 'https://example.com',
        source: 'semantic_scholar',
      };
      
      expect(() => PaperSchema.parse(minimal)).not.toThrow();
    });
    
    it('should reject invalid source', () => {
      const invalid = {
        id: 'paper1',
        title: 'Test',
        authors: ['A'],
        abstract: 'Abstract',
        url: 'https://example.com',
        source: 'invalid_source',
      };
      
      expect(() => PaperSchema.parse(invalid)).toThrow();
    });
  });
  
  describe('ClaimSchema', () => {
    it('should validate claim with citations', () => {
      const valid = {
        claim: 'Test claim',
        supportingPaperIds: ['paper1', 'paper2'],
        confidence: 0.9,
        category: 'finding',
      };
      
      expect(() => ClaimSchema.parse(valid)).not.toThrow();
    });
    
    it('should accept empty citations array', () => {
      const valid = {
        claim: 'Test claim',
        supportingPaperIds: [],
        confidence: 0.5,
        category: 'methodology',
      };
      
      expect(() => ClaimSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('ResearchStateSchema', () => {
    it('should extend AgentState with research fields', () => {
      const valid = {
        // Base agent state
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Research AI papers',
        
        // Research-specific
        topic: 'AI',
        validPapers: [],
        paperSummaries: [],
        comparisonMatrix: null,
        synthesizedClaims: [],
        recallAttempts: [],
        recallExhausted: false,
      };
      
      expect(() => ResearchStateSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('PPTStateSchema', () => {
    it('should validate PPT state', () => {
      const valid = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Create presentation',
        topic: 'AI Trends',
        outline: null,
        slides: [],
        researchReport: null,
      };
      
      expect(() => PPTStateSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('SummaryStateSchema', () => {
    it('should validate summary state', () => {
      const valid = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Summarize this',
        sourceText: 'Long text...',
        chunks: [],
        keyPoints: [],
        summary: null,
      };
      
      expect(() => SummaryStateSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('ChatStateSchema', () => {
    it('should validate chat state', () => {
      const valid = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Hello',
        conversationHistory: [],
        toolCalls: [],
      };
      
      expect(() => ChatStateSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('RetryPolicySchema', () => {
    it('should validate retry policy with defaults', () => {
      const valid = {};
      
      const result = RetryPolicySchema.parse(valid);
      expect(result.maxRetries).toBe(3);
      expect(result.backoffMs).toBe(1000);
      expect(result.backoffMultiplier).toBe(2);
    });
    
    it('should accept custom retry policy', () => {
      const custom = {
        maxRetries: 5,
        backoffMs: 500,
        backoffMultiplier: 1.5,
      };
      
      const result = RetryPolicySchema.parse(custom);
      expect(result.maxRetries).toBe(5);
    });
  });
  
  describe('SkillMetadataSchema', () => {
    it('should validate skill metadata', () => {
      const valid = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        category: 'test',
        version: '1.0.0',
        retryPolicy: {},
      };
      
      expect(() => SkillMetadataSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('ValidationResultSchema', () => {
    it('should validate validation result', () => {
      const valid = {
        valid: true,
        errors: [],
        warnings: [],
      };
      
      expect(() => ValidationResultSchema.parse(valid)).not.toThrow();
    });
    
    it('should validate result with errors', () => {
      const withErrors = {
        valid: false,
        errors: [
          { code: 'ERR1', message: 'Error 1', severity: 'error' },
        ],
        warnings: [],
      };
      
      expect(() => ValidationResultSchema.parse(withErrors)).not.toThrow();
    });
  });
  
  describe('ConditionResultSchema', () => {
    it('should validate condition result', () => {
      const valid = {
        passed: true,
        reason: 'Condition met',
        metadata: { count: 5 },
      };
      
      expect(() => ConditionResultSchema.parse(valid)).not.toThrow();
    });
  });
  
  describe('Schema composition', () => {
    it('should handle extended schemas correctly', () => {
      // ResearchState extends AgentState
      const researchState = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Research AI',
        topic: 'AI',
        validPapers: [],
        paperSummaries: [],
        comparisonMatrix: null,
        synthesizedClaims: [],
        recallAttempts: [],
        recallExhausted: false,
      };
      
      const result = ResearchStateSchema.parse(researchState);
      
      // Should have both base and extended fields
      expect(result.sessionId).toBe('sess1');
      expect(result.topic).toBe('AI');
      expect(result.validPapers).toEqual([]);
    });
  });
});
