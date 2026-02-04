/**
 * LangGraph Agent System - Validation Rules
 * 
 * Defines hard constraints and validation rules for each scenario.
 * Violations are system failures, not partial successes.
 */

import type {
  AgentState,
  ResearchState,
  PPTState,
  SummaryState,
  ChatState,
  AgentError,
  ValidationResult,
} from './types';

// ============================================================
// VALIDATION RULE INTERFACE
// ============================================================

export interface ValidationRule<TState = AgentState> {
  id: string;
  name: string;
  description: string;
  severity: 'warning' | 'error' | 'fatal';
  check(state: TState): boolean;
  errorMessage: string;
  suggestions?: string[];
}

// ============================================================
// RESEARCH VALIDATION RULES
// ============================================================

export const ResearchValidationRules: Record<string, ValidationRule<ResearchState>> = {
  /**
   * HARD CONSTRAINT: Must have at least 3 valid papers
   * Rationale: Research synthesis requires multiple sources for credibility
   */
  MINIMUM_PAPERS: {
    id: 'MINIMUM_PAPERS',
    name: 'Minimum Paper Count',
    description: 'Research requires at least 3 valid papers for meaningful synthesis',
    severity: 'fatal',
    check: (state) => state.validPapers.length >= 3,
    errorMessage: 'Research requires at least 3 valid papers. Found: {count}',
    suggestions: [
      'Try broadening your search query',
      'Include more paper sources (arxiv, semantic_scholar, pubmed)',
      'Use more general terms in your search',
    ],
  },
  
  /**
   * HARD CONSTRAINT: All claims must have citations
   * Rationale: Evidence-backed research is non-negotiable
   */
  CLAIMS_REQUIRE_CITATIONS: {
    id: 'CLAIMS_REQUIRE_CITATIONS',
    name: 'Claims Require Citations',
    description: 'Every synthesized claim must reference at least one paper',
    severity: 'fatal',
    check: (state) => 
      state.synthesizedClaims.every(c => c.supportingPaperIds.length >= 1),
    errorMessage: 'Found claims without citations. All claims must reference sources.',
    suggestions: [
      'Re-run synthesis with stricter citation requirements',
      'Remove uncited claims from output',
    ],
  },
  
  /**
   * HARD CONSTRAINT: Citations must be valid
   * Rationale: Citations must reference actual discovered papers
   */
  VALID_CITATIONS: {
    id: 'VALID_CITATIONS',
    name: 'Valid Citations',
    description: 'All cited paper IDs must exist in discovered papers',
    severity: 'fatal',
    check: (state) => {
      const validIds = new Set(state.validPapers.map(p => p.id));
      return state.synthesizedClaims.every(c =>
        c.supportingPaperIds.every(id => validIds.has(id))
      );
    },
    errorMessage: 'Found citations referencing non-existent papers',
    suggestions: [
      'Validate paper IDs before synthesis',
      'Remove invalid citations',
    ],
  },
  
  /**
   * HARD CONSTRAINT: No synthesis without comparison
   * Rationale: Comparison provides context for synthesis
   */
  SYNTHESIS_REQUIRES_COMPARISON: {
    id: 'SYNTHESIS_REQUIRES_COMPARISON',
    name: 'Synthesis Requires Comparison',
    description: 'Cannot synthesize claims without first comparing papers',
    severity: 'fatal',
    check: (state) =>
      state.synthesizedClaims.length === 0 || state.comparisonMatrix !== undefined,
    errorMessage: 'Synthesis attempted without paper comparison',
    suggestions: [
      'Complete paper comparison before synthesis',
    ],
  },
  
  /**
   * WARNING: Low paper count may limit analysis quality
   */
  LOW_PAPER_COUNT: {
    id: 'LOW_PAPER_COUNT',
    name: 'Low Paper Count Warning',
    description: 'Fewer than 5 papers may result in limited analysis depth',
    severity: 'warning',
    check: (state) => state.validPapers.length >= 5,
    errorMessage: 'Only {count} papers found. Consider expanding search for better coverage.',
    suggestions: [
      'Consider adding more search sources',
      'Broaden search terms',
    ],
  },
  
  /**
   * WARNING: Short abstracts may indicate incomplete data
   */
  ABSTRACT_QUALITY: {
    id: 'ABSTRACT_QUALITY',
    name: 'Abstract Quality Check',
    description: 'Papers with very short abstracts may lack sufficient information',
    severity: 'warning',
    check: (state) =>
      state.validPapers.every(p => p.abstract.length >= 100),
    errorMessage: 'Some papers have very short abstracts (< 100 characters)',
    suggestions: [
      'Consider filtering out papers with insufficient abstracts',
    ],
  },
};

// ============================================================
// PPT VALIDATION RULES
// ============================================================

export const PPTValidationRules: Record<string, ValidationRule<PPTState>> = {
  /**
   * HARD CONSTRAINT: Must have a topic
   */
  HAS_TOPIC: {
    id: 'HAS_TOPIC',
    name: 'Has Topic',
    description: 'Presentation must have a topic',
    severity: 'fatal',
    check: (state) => !!state.topic && state.topic.length >= 3,
    errorMessage: 'Presentation topic is required',
    suggestions: [
      'Provide a clear topic for the presentation',
    ],
  },
  
  /**
   * HARD CONSTRAINT: Outline must have sections
   */
  OUTLINE_HAS_SECTIONS: {
    id: 'OUTLINE_HAS_SECTIONS',
    name: 'Outline Has Sections',
    description: 'Presentation outline must have at least 2 sections',
    severity: 'fatal',
    check: (state) =>
      !!state.outline && state.outline.sections.length >= 2,
    errorMessage: 'Presentation outline must have at least 2 sections',
    suggestions: [
      'Expand the presentation scope',
      'Break down the topic into more subtopics',
    ],
  },
  
  /**
   * WARNING: Too many slides
   */
  SLIDE_COUNT: {
    id: 'SLIDE_COUNT',
    name: 'Slide Count',
    description: 'Presentation should not exceed 30 slides',
    severity: 'warning',
    check: (state) => state.slides.length <= 30,
    errorMessage: 'Presentation has {count} slides. Consider condensing.',
    suggestions: [
      'Consider combining related slides',
      'Remove redundant content',
    ],
  },
};

// ============================================================
// SUMMARY VALIDATION RULES
// ============================================================

export const SummaryValidationRules: Record<string, ValidationRule<SummaryState>> = {
  /**
   * HARD CONSTRAINT: Must have source content
   */
  HAS_SOURCE: {
    id: 'HAS_SOURCE',
    name: 'Has Source Content',
    description: 'Summary must have source content to summarize',
    severity: 'fatal',
    check: (state) => !!state.sourceContent || !!state.sourceText || !!state.sourceUrl,
    errorMessage: 'No source content provided for summarization',
    suggestions: [
      'Provide text content or a URL to summarize',
    ],
  },
  
  /**
   * HARD CONSTRAINT: Must have key points before summary
   */
  HAS_KEY_POINTS: {
    id: 'HAS_KEY_POINTS',
    name: 'Has Key Points',
    description: 'Must extract key points before generating summary',
    severity: 'fatal',
    check: (state) =>
      state.keyPoints.length >= 1,
    errorMessage: 'Summary generated without extracting key points',
    suggestions: [
      'Extract key points from content first',
    ],
  },
};

// ============================================================
// GENERAL VALIDATION RULES
// ============================================================

export const GeneralValidationRules: Record<string, ValidationRule<AgentState>> = {
  /**
   * HARD CONSTRAINT: Must have user prompt
   */
  HAS_PROMPT: {
    id: 'HAS_PROMPT',
    name: 'Has User Prompt',
    description: 'Agent must have a user prompt to process',
    severity: 'fatal',
    check: (state) => !!state.userPrompt && state.userPrompt.length > 0,
    errorMessage: 'User prompt is required',
    suggestions: [
      'Provide a prompt or question',
    ],
  },
  
  /**
   * HARD CONSTRAINT: Must have valid session
   */
  VALID_SESSION: {
    id: 'VALID_SESSION',
    name: 'Valid Session',
    description: 'Must have a valid session ID',
    severity: 'fatal',
    check: (state) => !!state.sessionId,
    errorMessage: 'Valid session ID is required',
    suggestions: [
      'Create a new session',
    ],
  },
};

// ============================================================
// VALIDATION EXECUTOR
// ============================================================

export class ValidationExecutor {
  /**
   * Validate state against a set of rules
   */
  validate<TState extends AgentState>(
    state: TState,
    rules: Record<string, ValidationRule<TState>> | Array<ValidationRule<TState>>
  ): ValidationResult {
    const errors: AgentError[] = [];
    const warnings: AgentError[] = [];
    const ruleEntries: Array<[string, ValidationRule<TState>]> = Array.isArray(rules)
      ? rules.map((rule) => [rule.id, rule])
      : Object.entries(rules);

    for (const [ruleId, rule] of ruleEntries) {
      const passed = rule.check(state);
      
      if (!passed) {
        const error: AgentError = {
          code: ruleId,
          message: this.formatMessage(rule.errorMessage, state),
          severity: rule.severity,
          details: {
            ruleName: rule.name,
            description: rule.description,
            suggestions: rule.suggestions,
          },
          timestamp: new Date(),
        };
        
        if (rule.severity === 'warning') {
          warnings.push(error);
        } else {
          errors.push(error);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate research-specific state
   */
  validateResearch(state: ResearchState): ValidationResult {
    const generalResult = this.validate(state, GeneralValidationRules);
    const researchResult = this.validate(state, ResearchValidationRules);
    
    return this.mergeResults(generalResult, researchResult);
  }
  
  /**
   * Validate PPT-specific state
   */
  validatePPT(state: PPTState): ValidationResult {
    const generalResult = this.validate(state, GeneralValidationRules);
    const pptResult = this.validate(state, [
      PPTValidationRules.HAS_TOPIC,
      PPTValidationRules.SLIDE_COUNT,
    ]);
    
    return this.mergeResults(generalResult, pptResult);
  }
  
  /**
   * Validate summary-specific state
   */
  validateSummary(state: SummaryState): ValidationResult {
    const generalResult = this.validate(state, GeneralValidationRules);
    const summaryResult = this.validate(state, SummaryValidationRules);
    
    return this.mergeResults(generalResult, summaryResult);
  }
  
  /**
   * Format error message with state values
   */
  private formatMessage(template: string, state: AgentState): string {
    let message = template;
    
    // Replace common placeholders
    if ('validPapers' in state) {
      message = message.replace('{count}', String((state as ResearchState).validPapers.length));
    }
    if ('slides' in state) {
      message = message.replace('{count}', String((state as PPTState).slides.length));
    }
    
    return message;
  }
  
  /**
   * Merge multiple validation results
   */
  private mergeResults(...results: ValidationResult[]): ValidationResult {
    const errors: AgentError[] = [];
    const warnings: AgentError[] = [];
    
    for (const result of results) {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const ValidationRules = {
  General: GeneralValidationRules,
  Research: ResearchValidationRules,
  PPT: PPTValidationRules,
  Summary: SummaryValidationRules,
};
