/**
 * LangGraph Agent System - Graph Node Implementations
 * 
 * Each node is a distinct step in the graph with pre/post conditions.
 * Nodes don't call each other directly - coordination is via LangGraph.
 */

import type { 
  AgentState, 
  ResearchState, 
  PPTState, 
  SummaryState, 
  ChatState,
  ParsedIntent,
  ExecutionStep,
  AgentError,
  ConditionResult,
} from './types';
import type { SkillRegistry, SkillContext } from './skills';
import type { ToolRegistry } from '../tools/registry';
import type { LLMClient } from '../llm';

// ============================================================
// NODE INTERFACES
// ============================================================

/**
 * Precondition - must pass before node execution
 */
export interface Precondition<TState> {
  name: string;
  check(state: TState): boolean;
  errorMessage: string;
  severity: 'error' | 'fatal';
}

/**
 * Postcondition - must pass after node execution
 */
export interface Postcondition<TState, TOutput> {
  name: string;
  check(state: TState, output: TOutput): boolean;
  errorMessage: string;
  severity: 'warning' | 'error' | 'fatal';
}

/**
 * Graph node interface
 */
export interface GraphNode<TState extends AgentState, TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  
  // Conditions
  preconditions: Precondition<TState>[];
  postconditions: Postcondition<TState, TOutput>[];
  
  // Execution
  execute(state: TState, input: TInput, context: NodeContext): Promise<TOutput>;
  
  // State update
  updateState(state: TState, output: TOutput): TState;
}

/**
 * Context provided to node execution
 */
export interface NodeContext {
  skills: SkillRegistry;
  tools: ToolRegistry;
  llm: LLMClient;
  sessionId: string;
  userId: string;
}

/**
 * Node execution result
 */
export interface NodeExecutionResult<TOutput> {
  success: boolean;
  output?: TOutput;
  error?: AgentError;
  preconditionResults: ConditionResult[];
  postconditionResults: ConditionResult[];
  duration: number;
}

// ============================================================
// NODE EXECUTOR
// ============================================================

/**
 * Executes a graph node with condition checking
 */
export class NodeExecutor {
  /**
   * Execute a node with full condition checking
   */
  async execute<TState extends AgentState, TInput, TOutput>(
    node: GraphNode<TState, TInput, TOutput>,
    state: TState,
    input: TInput,
    context: NodeContext
  ): Promise<NodeExecutionResult<TOutput>> {
    const startTime = Date.now();
    const preconditionResults: ConditionResult[] = [];
    const postconditionResults: ConditionResult[] = [];
    
    // Check preconditions
    for (const precondition of node.preconditions) {
      const passed = precondition.check(state);
      preconditionResults.push({
        passed,
        conditionName: precondition.name,
        message: passed ? undefined : precondition.errorMessage,
      });
      
      if (!passed && precondition.severity === 'fatal') {
        return {
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: precondition.errorMessage,
            nodeId: node.id,
            severity: 'fatal',
            timestamp: new Date(),
          },
          preconditionResults,
          postconditionResults,
          duration: Date.now() - startTime,
        };
      }
    }
    
    // Execute node
    let output: TOutput;
    try {
      output = await node.execute(state, input, context);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          nodeId: node.id,
          severity: 'fatal',
          timestamp: new Date(),
        },
        preconditionResults,
        postconditionResults,
        duration: Date.now() - startTime,
      };
    }
    
    // Check postconditions
    for (const postcondition of node.postconditions) {
      const passed = postcondition.check(state, output);
      postconditionResults.push({
        passed,
        conditionName: postcondition.name,
        message: passed ? undefined : postcondition.errorMessage,
      });
      
      if (!passed && postcondition.severity === 'fatal') {
        return {
          success: false,
          error: {
            code: 'POSTCONDITION_FAILED',
            message: postcondition.errorMessage,
            nodeId: node.id,
            severity: 'fatal',
            timestamp: new Date(),
          },
          preconditionResults,
          postconditionResults,
          duration: Date.now() - startTime,
        };
      }
    }
    
    return {
      success: true,
      output,
      preconditionResults,
      postconditionResults,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================
// TOP-LEVEL NODES
// ============================================================

/**
 * Intent Parsing Node
 * Extracts intent from user prompt and classifies scenario
 */
export const IntentParsingNode: GraphNode<AgentState, void, ParsedIntent> = {
  id: 'intent_parsing',
  name: 'Intent Parsing',
  description: 'Parse user prompt to extract intent and classify scenario',
  
  preconditions: [
    {
      name: 'has_user_prompt',
      check: (state) => !!state.userPrompt && state.userPrompt.length > 0,
      errorMessage: 'User prompt is required',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'has_valid_scenario',
      check: (_state, output) => ['research', 'ppt', 'summary', 'general_chat'].includes(output.scenario),
      errorMessage: 'Invalid scenario classification',
      severity: 'fatal',
    },
  ],
  
  async execute(state, _input, context) {
    const prompt = `Analyze the following user request and classify it into one of these scenarios:
- research: Academic research, paper analysis, literature review
- ppt: Presentation creation, slides, PowerPoint
- summary: Summarization of content, documents, articles
- general_chat: General questions, coding help, other tasks

User request: "${state.userPrompt}"

Respond with JSON:
{
  "scenario": "research|ppt|summary|general_chat",
  "entities": {"key": "value"},
  "parameters": {"key": "value"},
  "confidence": 0.9
}

Extract relevant entities like topic, keywords, file paths, etc.`;

    const response = await context.llm.chat([
      { role: 'system', content: 'You are an intent classifier. Always respond with valid JSON. Be precise in classification.' },
      { role: 'user', content: prompt },
    ]);
    
    const content = response.content || '';
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[IntentParsingNode] Failed to parse response:', error);
    }
    
    // Default to general chat if parsing fails
    return {
      scenario: 'general_chat',
      entities: {},
      parameters: {},
      confidence: 0.5,
    };
  },
  
  updateState(state, output) {
    return {
      ...state,
      parsedIntent: output,
      currentNode: 'intent_parsing',
      executionHistory: [
        ...state.executionHistory,
        {
          nodeId: 'intent_parsing',
          nodeName: 'Intent Parsing',
          startTime: new Date(),
          endTime: new Date(),
          input: state.userPrompt,
          output,
        },
      ],
    };
  },
};

// ============================================================
// RESEARCH NODES
// ============================================================

/**
 * Paper Discovery Node
 * MANDATORY tool usage - uses web_search to find papers
 */
export const PaperDiscoveryNode: GraphNode<ResearchState, void, any> = {
  id: 'paper_discovery',
  name: 'Paper Discovery',
  description: 'Discover academic papers using search tools (MANDATORY tool usage)',
  
  preconditions: [
    {
      name: 'has_search_query',
      check: (state) => !!state.searchQuery && state.searchQuery.length >= 3,
      errorMessage: 'Search query must be at least 3 characters',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'has_papers',
      check: (_state, output) => output.papers && output.papers.length > 0,
      errorMessage: 'No papers found for the given query',
      severity: 'error',
    },
  ],
  
  async execute(state, _input, context) {
    const skillContext: SkillContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      tools: context.tools,
      llm: context.llm,
      startTime: Date.now(),
    };
    
    const result = await context.skills.execute(
      'paper_discovery',
      {
        query: state.searchQuery,
        sources: state.searchSources || ['arxiv', 'semantic_scholar'],
        maxResults: 20,
      },
      skillContext
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Paper discovery failed');
    }
    
    return result.output;
  },
  
  updateState(state, output) {
    const validPapers = output.papers.filter((p: any) => 
      p.title && p.abstract && p.abstract.length > 50
    );
    
    return {
      ...state,
      discoveredPapers: output.papers,
      validPapers,
      discoveryMetadata: output.metadata,
      currentNode: 'paper_discovery',
    };
  },
};

/**
 * Discovery Validation Node
 * HARD CONSTRAINT: Must have at least 3 valid papers
 */
export const DiscoveryValidationNode: GraphNode<ResearchState, void, { passed: boolean; paperCount: number }> = {
  id: 'discovery_validation',
  name: 'Discovery Validation',
  description: 'Validate that enough papers were discovered (minimum 3)',
  
  preconditions: [],
  
  postconditions: [],
  
  async execute(state, _input, _context) {
    const MIN_REQUIRED = 3;
    const paperCount = state.validPapers.length;
    
    return {
      passed: paperCount >= MIN_REQUIRED,
      paperCount,
      requiredCount: MIN_REQUIRED,
      message: paperCount >= MIN_REQUIRED
        ? `Found ${paperCount} valid papers, proceeding to summarization`
        : `Only ${paperCount} valid papers found, minimum ${MIN_REQUIRED} required`,
    };
  },
  
  updateState(state, output) {
    if (!output.passed) {
      return {
        ...state,
        status: 'failed',
        errors: [
          ...state.errors,
          {
            code: 'INSUFFICIENT_PAPERS',
            message: `Only ${output.paperCount} valid papers found, minimum 3 required`,
            nodeId: 'discovery_validation',
            severity: 'fatal',
            timestamp: new Date(),
          },
        ],
        currentNode: 'discovery_validation',
      };
    }
    
    return {
      ...state,
      currentNode: 'discovery_validation',
    };
  },
};

/**
 * Paper Summarize Node
 * Summarizes each paper individually
 */
export const PaperSummarizeNode: GraphNode<ResearchState, void, Record<string, any>> = {
  id: 'paper_summarize',
  name: 'Paper Summarization',
  description: 'Summarize each discovered paper individually',
  
  preconditions: [
    {
      name: 'has_valid_papers',
      check: (state) => state.validPapers.length >= 3,
      errorMessage: 'Must have at least 3 valid papers',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'all_papers_summarized',
      check: (state, output) => Object.keys(output).length === state.validPapers.length,
      errorMessage: 'Not all papers were summarized',
      severity: 'error',
    },
  ],
  
  async execute(state, _input, context) {
    const summaries: Record<string, any> = {};
    
    const skillContext: SkillContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      tools: context.tools,
      llm: context.llm,
      startTime: Date.now(),
    };
    
    // Process papers one at a time (as per architecture spec)
    for (const paper of state.validPapers) {
      const result = await context.skills.execute(
        'paper_summarize',
        { paper },
        skillContext
      );
      
      if (result.success && result.output) {
        summaries[paper.id] = result.output;
      }
    }
    
    return summaries;
  },
  
  updateState(state, output) {
    return {
      ...state,
      paperSummaries: output,
      currentNode: 'paper_summarize',
    };
  },
};

/**
 * Paper Compare Node
 * Compare papers across multiple dimensions
 */
export const PaperCompareNode: GraphNode<ResearchState, void, any> = {
  id: 'paper_compare',
  name: 'Paper Comparison',
  description: 'Compare papers across methodology, novelty, and impact dimensions',
  
  preconditions: [
    {
      name: 'has_summaries',
      check: (state) => Object.keys(state.paperSummaries).length >= 3,
      errorMessage: 'Must have at least 3 paper summaries',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'has_comparison_matrix',
      check: (_state, output) => !!output && output.papers && output.papers.length > 0,
      errorMessage: 'Comparison matrix must be generated',
      severity: 'error',
    },
  ],
  
  async execute(state, _input, context) {
    const summaries = Object.values(state.paperSummaries);
    
    const skillContext: SkillContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      tools: context.tools,
      llm: context.llm,
      startTime: Date.now(),
    };
    
    const result = await context.skills.execute(
      'paper_compare',
      {
        summaries,
        dimensions: ['methodology', 'novelty', 'impact', 'limitations'],
      },
      skillContext
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Paper comparison failed');
    }
    
    return result.output;
  },
  
  updateState(state, output) {
    return {
      ...state,
      comparisonMatrix: output,
      currentNode: 'paper_compare',
    };
  },
};

/**
 * Synthesis Node
 * Generate evidence-backed claims
 * CRITICAL: Every claim MUST cite at least one paper
 */
export const SynthesisNode: GraphNode<ResearchState, void, any> = {
  id: 'synthesis',
  name: 'Claim Synthesis',
  description: 'Synthesize evidence-backed claims from paper summaries',
  
  preconditions: [
    {
      name: 'has_summaries_and_comparison',
      check: (state) => 
        Object.keys(state.paperSummaries).length >= 3 && 
        !!state.comparisonMatrix,
      errorMessage: 'Must have summaries and comparison matrix',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'all_claims_have_citations',
      check: (_state, output) => 
        output.claims && output.claims.every((c: any) => 
          c.supportingPaperIds && c.supportingPaperIds.length >= 1
        ),
      errorMessage: 'Every claim MUST reference at least one paper',
      severity: 'fatal',
    },
    {
      name: 'citations_are_valid',
      check: (state, output) => {
        const validIds = new Set(state.validPapers.map(p => p.id));
        return output.claims.every((c: any) => 
          c.supportingPaperIds.every((id: string) => validIds.has(id))
        );
      },
      errorMessage: 'All cited paper IDs must be valid',
      severity: 'fatal',
    },
  ],
  
  async execute(state, _input, context) {
    const summaries = Object.values(state.paperSummaries);
    
    const skillContext: SkillContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      tools: context.tools,
      llm: context.llm,
      startTime: Date.now(),
    };
    
    const result = await context.skills.execute(
      'claim_synthesis',
      {
        summaries,
        comparisonMatrix: state.comparisonMatrix,
        maxClaims: 10,
      },
      skillContext
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Claim synthesis failed');
    }
    
    return result.output;
  },
  
  updateState(state, output) {
    return {
      ...state,
      synthesizedClaims: output.claims,
      currentNode: 'synthesis',
    };
  },
};

/**
 * Final Writer Node
 * Produce the final research report
 */
export const FinalWriterNode: GraphNode<ResearchState, void, any> = {
  id: 'final_writer',
  name: 'Final Report Writer',
  description: 'Generate the final research report with citations',
  
  preconditions: [
    {
      name: 'has_claims',
      check: (state) => state.synthesizedClaims && state.synthesizedClaims.length > 0,
      errorMessage: 'Must have synthesized claims',
      severity: 'fatal',
    },
  ],
  
  postconditions: [
    {
      name: 'has_report',
      check: (_state, output) => !!output && !!output.title && output.sections?.length > 0,
      errorMessage: 'Report must have title and sections',
      severity: 'error',
    },
  ],
  
  async execute(state, _input, context) {
    const claims = state.synthesizedClaims;
    const papers = state.validPapers;
    const summaries = state.paperSummaries;
    
    const claimsText = claims.map((c, i) => 
      `${i + 1}. ${c.statement} [${c.supportingPaperIds.join(', ')}] (${c.confidence} confidence)`
    ).join('\n');
    
    const bibliographyText = papers.map(p => 
      `[${p.id}] ${p.authors?.join(', ')}. "${p.title}". ${p.source}. ${p.url}`
    ).join('\n');
    
    const prompt = `Write a research report based on the following synthesized claims and sources.

Claims:
${claimsText}

Bibliography:
${bibliographyText}

Generate a structured report in JSON format:
{
  "title": "Report Title",
  "abstract": "Brief summary of findings",
  "sections": [
    {
      "heading": "Section Title",
      "content": "Section content with inline citations like [paper_id]",
      "citations": ["paper_id_1", "paper_id_2"]
    }
  ],
  "bibliography": [
    {"paperId": "id", "citation": "Formatted citation string"}
  ]
}

IMPORTANT: 
- Every claim must be supported by citations
- Use the paper IDs provided
- Include an introduction and conclusion section`;

    const response = await context.llm.chat([
      { role: 'system', content: 'You are an expert research report writer. Always include citations. Respond with valid JSON.' },
      { role: 'user', content: prompt },
    ]);
    
    const content = response.content || '';
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return {
          ...JSON.parse(jsonMatch[0]),
          generatedAt: new Date(),
        };
      }
    } catch (error) {
      console.error('[FinalWriterNode] Failed to parse report:', error);
    }
    
    throw new Error('Failed to generate research report');
  },
  
  updateState(state, output) {
    return {
      ...state,
      finalReport: output,
      finalOutput: output,
      status: 'completed',
      currentNode: 'final_writer',
    };
  },
};

/**
 * Failure Handler Node
 * Handles graph execution failures gracefully
 */
export const FailureHandlerNode: GraphNode<AgentState, void, any> = {
  id: 'failure_handler',
  name: 'Failure Handler',
  description: 'Handle execution failures and produce failure report',
  
  preconditions: [],
  postconditions: [],
  
  async execute(state, _input, _context) {
    return {
      failedAt: state.currentNode,
      errors: state.errors,
      partialResults: extractPartialResults(state),
      suggestions: generateSuggestions(state.errors),
      recoveryOptions: determineRecoveryOptions(state),
    };
  },
  
  updateState(state, output) {
    return {
      ...state,
      status: 'failed',
      finalOutput: output,
      currentNode: 'failure_handler',
    };
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function extractPartialResults(state: AgentState): Record<string, any> {
  const results: Record<string, any> = {};
  
  if ('discoveredPapers' in state) {
    const rs = state as ResearchState;
    results.discoveredPapers = rs.discoveredPapers?.length || 0;
    results.validPapers = rs.validPapers?.length || 0;
    results.summarizedPapers = Object.keys(rs.paperSummaries || {}).length;
    results.synthesizedClaims = rs.synthesizedClaims?.length || 0;
  }
  
  return results;
}

function generateSuggestions(errors: AgentError[]): string[] {
  const suggestions: string[] = [];
  
  for (const error of errors) {
    if (error.code === 'INSUFFICIENT_PAPERS') {
      suggestions.push('Try broadening your search query');
      suggestions.push('Include more paper sources (arxiv, semantic_scholar, pubmed)');
      suggestions.push('Reduce specificity of search terms');
    } else if (error.code === 'PRECONDITION_FAILED') {
      suggestions.push('Ensure all required inputs are provided');
    } else if (error.code === 'POSTCONDITION_FAILED') {
      suggestions.push('Previous step may have produced incomplete results');
    }
  }
  
  return [...new Set(suggestions)];
}

function determineRecoveryOptions(state: AgentState): string[] {
  const options: string[] = [];
  
  if ('searchQuery' in state) {
    options.push('modify_search_query');
  }
  
  options.push('restart_from_beginning');
  options.push('export_partial_results');
  
  return options;
}

// ============================================================
// NODE REGISTRY
// ============================================================

/**
 * Registry of all available nodes
 */
export const NodeRegistry = {
  // Top-level
  intent_parsing: IntentParsingNode,
  
  // Research
  paper_discovery: PaperDiscoveryNode,
  discovery_validation: DiscoveryValidationNode,
  paper_summarize: PaperSummarizeNode,
  paper_compare: PaperCompareNode,
  synthesis: SynthesisNode,
  final_writer: FinalWriterNode,
  
  // Failure handling
  failure_handler: FailureHandlerNode,
};
