/**
 * LangGraph Validation Tests
 * 
 * Tests for validation rules and the ValidationExecutor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResearchValidationRules,
  PPTValidationRules,
  SummaryValidationRules,
  GeneralValidationRules,
  ValidationExecutor,
} from '../../apps/api/src/services/langgraph/validation';
import type {
  ResearchState,
  PPTState,
  SummaryState,
  ChatState,
  Paper,
  Claim,
} from '../../apps/api/src/services/langgraph/types';

describe('LangGraph Validation', () => {
  describe('ResearchValidationRules', () => {
    let baseResearchState: ResearchState;
    
    beforeEach(() => {
      baseResearchState = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Research AI',
        currentNode: '',
        executionHistory: [],
        intermediateResults: {},
        errors: [],
        warnings: [],
        status: 'running',
        topic: 'AI',
        validPapers: [],
        paperSummaries: [],
        comparisonMatrix: null,
        synthesizedClaims: [],
        recallAttempts: [],
        recallExhausted: false,
      };
    });
    
    describe('MINIMUM_PAPERS', () => {
      it('should pass with 3 or more papers', () => {
        const papers: Paper[] = [
          {
            id: '1',
            title: 'Paper 1',
            authors: ['A'],
            abstract: 'Abstract',
            url: 'https://example.com/1',
            source: 'arxiv',
          },
          {
            id: '2',
            title: 'Paper 2',
            authors: ['B'],
            abstract: 'Abstract',
            url: 'https://example.com/2',
            source: 'arxiv',
          },
          {
            id: '3',
            title: 'Paper 3',
            authors: ['C'],
            abstract: 'Abstract',
            url: 'https://example.com/3',
            source: 'arxiv',
          },
        ];
        
        const state = { ...baseResearchState, validPapers: papers };
        expect(ResearchValidationRules.MINIMUM_PAPERS.check(state)).toBe(true);
      });
      
      it('should fail with fewer than 3 papers', () => {
        const papers: Paper[] = [
          {
            id: '1',
            title: 'Paper 1',
            authors: ['A'],
            abstract: 'Abstract',
            url: 'https://example.com/1',
            source: 'arxiv',
          },
        ];
        
        const state = { ...baseResearchState, validPapers: papers };
        expect(ResearchValidationRules.MINIMUM_PAPERS.check(state)).toBe(false);
      });
      
      it('should have fatal severity', () => {
        expect(ResearchValidationRules.MINIMUM_PAPERS.severity).toBe('fatal');
      });
    });
    
    describe('CLAIMS_REQUIRE_CITATIONS', () => {
      it('should pass when all claims have citations', () => {
        const claims: Claim[] = [
          {
            claim: 'Claim 1',
            supportingPaperIds: ['1'],
            confidence: 0.9,
            category: 'finding',
          },
          {
            claim: 'Claim 2',
            supportingPaperIds: ['1', '2'],
            confidence: 0.8,
            category: 'methodology',
          },
        ];
        
        const state = { ...baseResearchState, synthesizedClaims: claims };
        expect(ResearchValidationRules.CLAIMS_REQUIRE_CITATIONS.check(state)).toBe(true);
      });
      
      it('should fail when any claim lacks citations', () => {
        const claims: Claim[] = [
          {
            claim: 'Claim 1',
            supportingPaperIds: ['1'],
            confidence: 0.9,
            category: 'finding',
          },
          {
            claim: 'Claim 2',
            supportingPaperIds: [],
            confidence: 0.8,
            category: 'methodology',
          },
        ];
        
        const state = { ...baseResearchState, synthesizedClaims: claims };
        expect(ResearchValidationRules.CLAIMS_REQUIRE_CITATIONS.check(state)).toBe(false);
      });
    });
    
    describe('VALID_CITATIONS', () => {
      it('should pass when all citations reference valid papers', () => {
        const papers: Paper[] = [
          {
            id: '1',
            title: 'Paper 1',
            authors: ['A'],
            abstract: 'Abstract',
            url: 'https://example.com/1',
            source: 'arxiv',
          },
          {
            id: '2',
            title: 'Paper 2',
            authors: ['B'],
            abstract: 'Abstract',
            url: 'https://example.com/2',
            source: 'arxiv',
          },
        ];
        
        const claims: Claim[] = [
          {
            claim: 'Claim 1',
            supportingPaperIds: ['1', '2'],
            confidence: 0.9,
            category: 'finding',
          },
        ];
        
        const state = {
          ...baseResearchState,
          validPapers: papers,
          synthesizedClaims: claims,
        };
        
        expect(ResearchValidationRules.VALID_CITATIONS.check(state)).toBe(true);
      });
      
      it('should fail when citations reference non-existent papers', () => {
        const papers: Paper[] = [
          {
            id: '1',
            title: 'Paper 1',
            authors: ['A'],
            abstract: 'Abstract',
            url: 'https://example.com/1',
            source: 'arxiv',
          },
        ];
        
        const claims: Claim[] = [
          {
            claim: 'Claim 1',
            supportingPaperIds: ['1', '999'], // 999 doesn't exist
            confidence: 0.9,
            category: 'finding',
          },
        ];
        
        const state = {
          ...baseResearchState,
          validPapers: papers,
          synthesizedClaims: claims,
        };
        
        expect(ResearchValidationRules.VALID_CITATIONS.check(state)).toBe(false);
      });
    });
  });
  
  describe('PPTValidationRules', () => {
    let basePPTState: PPTState;
    
    beforeEach(() => {
      basePPTState = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Create PPT',
        currentNode: '',
        executionHistory: [],
        intermediateResults: {},
        errors: [],
        warnings: [],
        status: 'running',
        topic: '',
        outline: null,
        slides: [],
        researchReport: null,
      };
    });
    
    describe('HAS_TOPIC', () => {
      it('should pass with non-empty topic', () => {
        const state = { ...basePPTState, topic: 'AI Trends' };
        expect(PPTValidationRules.HAS_TOPIC.check(state)).toBe(true);
      });
      
      it('should fail with empty topic', () => {
        const state = { ...basePPTState, topic: '' };
        expect(PPTValidationRules.HAS_TOPIC.check(state)).toBe(false);
      });
    });
    
    describe('OUTLINE_HAS_SECTIONS', () => {
      it('should pass with outline containing sections', () => {
        const state = {
          ...basePPTState,
          outline: {
            title: 'Test',
            sections: [
              { title: 'Intro', keyPoints: ['Point 1'] },
              { title: 'Body', keyPoints: ['Point 2'] },
            ],
          },
        };
        expect(PPTValidationRules.OUTLINE_HAS_SECTIONS.check(state)).toBe(true);
      });
      
      it('should fail with null outline', () => {
        const state = { ...basePPTState, outline: null };
        expect(PPTValidationRules.OUTLINE_HAS_SECTIONS.check(state)).toBe(false);
      });
      
      it('should fail with empty sections', () => {
        const state = {
          ...basePPTState,
          outline: {
            title: 'Test',
            sections: [],
          },
        };
        expect(PPTValidationRules.OUTLINE_HAS_SECTIONS.check(state)).toBe(false);
      });
    });
  });
  
  describe('SummaryValidationRules', () => {
    let baseSummaryState: SummaryState;
    
    beforeEach(() => {
      baseSummaryState = {
        sessionId: 'sess1',
        userId: 'user1',
        requestId: 'req1',
        timestamp: new Date(),
        userPrompt: 'Summarize',
        currentNode: '',
        executionHistory: [],
        intermediateResults: {},
        errors: [],
        warnings: [],
        status: 'running',
        sourceText: '',
        chunks: [],
        keyPoints: [],
        summary: null,
      };
    });
    
    describe('HAS_SOURCE', () => {
      it('should pass with source text', () => {
        const state = { ...baseSummaryState, sourceText: 'Some text to summarize' };
        expect(SummaryValidationRules.HAS_SOURCE.check(state)).toBe(true);
      });
      
      it('should fail with empty source', () => {
        const state = { ...baseSummaryState, sourceText: '' };
        expect(SummaryValidationRules.HAS_SOURCE.check(state)).toBe(false);
      });
    });
    
    describe('HAS_KEY_POINTS', () => {
      it('should pass with key points', () => {
        const state = {
          ...baseSummaryState,
          keyPoints: [
            { point: 'Point 1', importance: 0.9 },
          ],
        };
        expect(SummaryValidationRules.HAS_KEY_POINTS.check(state)).toBe(true);
      });
      
      it('should fail with no key points', () => {
        const state = { ...baseSummaryState, keyPoints: [] };
        expect(SummaryValidationRules.HAS_KEY_POINTS.check(state)).toBe(false);
      });
    });
  });
  
  describe('GeneralValidationRules', () => {
    describe('HAS_PROMPT', () => {
      it('should pass with non-empty prompt', () => {
        const state = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Test prompt',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        expect(GeneralValidationRules.HAS_PROMPT.check(state)).toBe(true);
      });
      
      it('should fail with empty prompt', () => {
        const state = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: '',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        expect(GeneralValidationRules.HAS_PROMPT.check(state)).toBe(false);
      });
    });
    
    describe('VALID_SESSION', () => {
      it('should pass with valid session ID', () => {
        const state = {
          sessionId: 'valid-session-id',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Test',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        expect(GeneralValidationRules.VALID_SESSION.check(state)).toBe(true);
      });
      
      it('should fail with empty session ID', () => {
        const state = {
          sessionId: '',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Test',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        expect(GeneralValidationRules.VALID_SESSION.check(state)).toBe(false);
      });
    });
  });
  
  describe('ValidationExecutor', () => {
    let executor: ValidationExecutor;
    
    beforeEach(() => {
      executor = new ValidationExecutor();
    });
    
    describe('validate', () => {
      it('should return valid result when all rules pass', () => {
        const state = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Test prompt',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        
        const rules = [GeneralValidationRules.HAS_PROMPT];
        const result = executor.validate(state, rules);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
      
      it('should collect errors when rules fail', () => {
        const state = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: '',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running' as const,
        };
        
        const rules = [GeneralValidationRules.HAS_PROMPT];
        const result = executor.validate(state, rules);
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
      
      it('should separate errors and warnings by severity', () => {
        const researchState: ResearchState = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Research',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running',
          topic: 'AI',
          validPapers: [], // Will trigger fatal error
          paperSummaries: [],
          comparisonMatrix: null,
          synthesizedClaims: [],
          recallAttempts: [],
          recallExhausted: false,
        };
        
        const rules = [ResearchValidationRules.MINIMUM_PAPERS];
        const result = executor.validate(researchState, rules);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.severity === 'fatal')).toBe(true);
      });
    });
    
    describe('validateResearch', () => {
      it('should validate research state with combined rules', () => {
        const state: ResearchState = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Research AI',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running',
          topic: 'AI',
          validPapers: [
            {
              id: '1',
              title: 'Paper 1',
              authors: ['A'],
              abstract: 'Abstract',
              url: 'https://example.com/1',
              source: 'arxiv',
            },
            {
              id: '2',
              title: 'Paper 2',
              authors: ['B'],
              abstract: 'Abstract',
              url: 'https://example.com/2',
              source: 'arxiv',
            },
            {
              id: '3',
              title: 'Paper 3',
              authors: ['C'],
              abstract: 'Abstract',
              url: 'https://example.com/3',
              source: 'arxiv',
            },
          ],
          paperSummaries: [],
          comparisonMatrix: null,
          synthesizedClaims: [],
          recallAttempts: [],
          recallExhausted: false,
        };
        
        const result = executor.validateResearch(state);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('validatePPT', () => {
      it('should validate PPT state', () => {
        const state: PPTState = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Create PPT',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running',
          topic: 'AI Trends',
          outline: {
            title: 'AI Trends',
            sections: [
              { title: 'Introduction', keyPoints: ['Point 1'] },
            ],
          },
          slides: [],
          researchReport: null,
        };
        
        const result = executor.validatePPT(state);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('validateSummary', () => {
      it('should validate summary state', () => {
        const state: SummaryState = {
          sessionId: 'sess1',
          userId: 'user1',
          requestId: 'req1',
          timestamp: new Date(),
          userPrompt: 'Summarize',
          currentNode: '',
          executionHistory: [],
          intermediateResults: {},
          errors: [],
          warnings: [],
          status: 'running',
          sourceText: 'Text to summarize',
          chunks: [],
          keyPoints: [
            { point: 'Key point 1', importance: 0.9 },
          ],
          summary: null,
        };
        
        const result = executor.validateSummary(state);
        expect(result.valid).toBe(true);
      });
    });
  });
});
