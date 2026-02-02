# LangGraph-Based AI Agent System Architecture

## Executive Summary

This document defines the architecture for a **LangGraph-centric AI Agent system** that is atomic, pluggable, deterministic, multi-scenario, and verifiable. The system uses explicit DAG-based orchestration with no implicit LLM reasoning for workflow control.

---

## Table of Contents

1. [Architectural Principles](#1-architectural-principles)
2. [System Overview](#2-system-overview)
3. [Core Components](#3-core-components)
4. [LangGraph DAG Design](#4-langgraph-dag-design)
5. [Atomic Skill Definitions](#5-atomic-skill-definitions)
6. [Scenario Graphs](#6-scenario-graphs)
7. [State Management](#7-state-management)
8. [Validation & Failure Handling](#8-validation--failure-handling)
9. [Extensibility Guidelines](#9-extensibility-guidelines)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Architectural Principles

### 1.1 LangGraph-Centric Orchestration

All agent behavior is expressed as **explicit LangGraph nodes and edges**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      LangGraph                            │  │
│  │  • Explicit node definitions                              │  │
│  │  • Conditional edges with deterministic routing           │  │
│  │  • No implicit LLM-driven flow control                    │  │
│  │  • Compile-time verifiable graph structure                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Hard Rules:**
- Routing decisions are made by explicit conditional functions, never by LLM inference
- No hidden loops or autonomous free-running agents
- Every state transition is logged and traceable
- Graph structure is statically analyzable

### 1.2 Atomic & Pluggable Skills

Every capability is implemented as an **atomic skill**:

```typescript
interface AtomicSkill<TInput, TOutput> {
  // Identity
  id: string;
  name: string;
  version: string;
  
  // Schema (Zod-based)
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  
  // Execution
  execute(input: TInput, context: SkillContext): Promise<TOutput>;
  
  // Metadata
  description: string;
  requiredTools: string[];
  estimatedDuration: number;
  retryPolicy: RetryPolicy;
}
```

**Constraints:**
- Each skill does **exactly one thing**
- Skills **never call each other directly**
- All coordination happens via LangGraph
- Skills are independently testable and replaceable

### 1.3 Separation of Responsibilities

Each responsibility maps to a distinct LangGraph node:

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Intent    │ → │  Scenario   │ → │    Task     │ → │  Evidence   │ → │  Synthesis  │
│   Parsing   │   │   Routing   │   │  Execution  │   │ Collection  │   │ & Writing   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

---

## 2. System Overview

### 2.1 High-Level Architecture

```
                                    ┌─────────────────────────────────┐
                                    │         USER INPUT              │
                                    └────────────┬────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              TOP-LEVEL ROUTER GRAPH                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         IntentParsingNode                                         │ │
│  │  • Extract intent from user prompt                                                │ │
│  │  • Classify scenario type                                                         │ │
│  │  • Extract entities and parameters                                                │ │
│  └────────────────────────────┬─────────────────────────────────────────────────────┘ │
│                               │                                                        │
│                               ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        ScenarioRoutingNode                                        │ │
│  │  • Route to exactly ONE scenario graph                                            │ │
│  │  • Cross-scenario execution is FORBIDDEN                                          │ │
│  └────────────────────────────┬─────────────────────────────────────────────────────┘ │
└───────────────────────────────┼────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┬───────────────────────┐
        │                       │                       │                       │
        ▼                       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ ResearchGraph │       │   PPTGraph    │       │ SummaryGraph  │       │GeneralChatGraph│
│               │       │               │       │               │       │               │
│ • Paper       │       │ • Outline     │       │ • Content     │       │ • Direct      │
│   Discovery   │       │   Generation  │       │   Ingestion   │       │   Response    │
│ • Summarize   │       │ • Slide       │       │ • Chunk       │       │ • Tool        │
│ • Compare     │       │   Creation    │       │   Processing  │       │   Execution   │
│ • Synthesis   │       │ • Export      │       │ • Summary     │       │               │
│ • Write       │       │               │       │   Generation  │       │               │
└───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

### 2.2 Core Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Orchestration** | LangGraph | Explicit DAG, conditional routing, state management |
| **Skill Abstraction** | Atomic Functions | Single responsibility, schema-driven I/O |
| **State** | Pydantic/Zod Models | Type-safe, serializable, validatable |
| **LLM Role** | Constrained Executor | Content generation only, never workflow control |
| **Evidence** | Citation-backed | Every claim requires source reference |
| **Failure** | Explicit Stop | Graph halts on validation failure |

---

## 3. Core Components

### 3.1 State Schema

```typescript
// Base state for all graphs
interface AgentState {
  // Request context
  sessionId: string;
  userId: string;
  requestId: string;
  timestamp: Date;
  
  // Input
  userPrompt: string;
  parsedIntent: ParsedIntent;
  
  // Execution tracking
  currentNode: string;
  executionHistory: ExecutionStep[];
  
  // Output accumulation
  intermediateResults: Map<string, unknown>;
  
  // Error handling
  errors: AgentError[];
  status: 'running' | 'completed' | 'failed' | 'stopped';
}

interface ParsedIntent {
  scenario: 'research' | 'ppt' | 'summary' | 'general_chat';
  entities: Record<string, string>;
  parameters: Record<string, unknown>;
  confidence: number;
}

interface ExecutionStep {
  nodeId: string;
  startTime: Date;
  endTime?: Date;
  input: unknown;
  output?: unknown;
  error?: string;
}
```

### 3.2 Research-Specific State

```typescript
interface ResearchState extends AgentState {
  // Discovery phase
  searchQuery: string;
  discoveredPapers: Paper[];
  validPapers: Paper[];
  
  // Summarization phase
  paperSummaries: Map<string, PaperSummary>;
  
  // Comparison phase
  comparisonMatrix: ComparisonMatrix;
  
  // Synthesis phase
  synthesizedClaims: Claim[];
  
  // Final output
  finalReport?: Report;
}

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  source: 'arxiv' | 'semantic_scholar' | 'pubmed';
  publishedDate: Date;
  citationCount?: number;
}

interface PaperSummary {
  paperId: string;
  mainContributions: string[];
  methodology: string;
  keyFindings: string[];
  limitations: string[];
}

interface Claim {
  id: string;
  statement: string;
  supportingPaperIds: string[];  // Must have at least one!
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

interface ComparisonMatrix {
  dimensions: string[];
  paperScores: Map<string, Map<string, number | string>>;
}
```

### 3.3 Node Types

```typescript
// Generic node interface
interface GraphNode<TState extends AgentState, TInput, TOutput> {
  id: string;
  name: string;
  
  // Pre-conditions (must pass before execution)
  preconditions: Precondition<TState>[];
  
  // Core execution
  execute(state: TState, input: TInput): Promise<TOutput>;
  
  // Post-conditions (must pass after execution)
  postconditions: Postcondition<TState, TOutput>[];
  
  // State update
  updateState(state: TState, output: TOutput): TState;
}

interface Precondition<TState> {
  name: string;
  check(state: TState): boolean;
  errorMessage: string;
}

interface Postcondition<TState, TOutput> {
  name: string;
  check(state: TState, output: TOutput): boolean;
  errorMessage: string;
}
```

---

## 4. LangGraph DAG Design

### 4.1 Top-Level Router Graph

```python
from langgraph.graph import StateGraph, END
from typing import Literal

def create_router_graph():
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("intent_parser", intent_parsing_node)
    graph.add_node("scenario_router", scenario_routing_node)
    
    # Subgraph nodes (each is a compiled subgraph)
    graph.add_node("research_graph", research_subgraph)
    graph.add_node("ppt_graph", ppt_subgraph)
    graph.add_node("summary_graph", summary_subgraph)
    graph.add_node("general_chat_graph", general_chat_subgraph)
    
    # Entry point
    graph.set_entry_point("intent_parser")
    
    # Intent parser -> Scenario router
    graph.add_edge("intent_parser", "scenario_router")
    
    # Conditional routing to scenario graphs
    graph.add_conditional_edges(
        "scenario_router",
        route_to_scenario,  # Deterministic function, NOT LLM
        {
            "research": "research_graph",
            "ppt": "ppt_graph",
            "summary": "summary_graph",
            "general_chat": "general_chat_graph",
        }
    )
    
    # All scenario graphs end the flow
    graph.add_edge("research_graph", END)
    graph.add_edge("ppt_graph", END)
    graph.add_edge("summary_graph", END)
    graph.add_edge("general_chat_graph", END)
    
    return graph.compile()

# CRITICAL: This is a DETERMINISTIC function, not LLM-based
def route_to_scenario(state: AgentState) -> Literal["research", "ppt", "summary", "general_chat"]:
    """Route based on parsed intent - NO LLM inference here"""
    return state.parsed_intent.scenario
```

### 4.2 Research Graph (Reference Implementation)

```python
def create_research_graph():
    graph = StateGraph(ResearchState)
    
    # Strict linear pipeline with validation gates
    graph.add_node("paper_discovery", paper_discovery_node)
    graph.add_node("discovery_validation", discovery_validation_node)
    graph.add_node("paper_summarize", paper_summarize_node)
    graph.add_node("paper_compare", paper_compare_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("final_writer", final_writer_node)
    graph.add_node("failure_handler", failure_handler_node)
    
    # Entry point
    graph.set_entry_point("paper_discovery")
    
    # Discovery -> Validation gate
    graph.add_edge("paper_discovery", "discovery_validation")
    
    # Validation gate: proceed or fail
    graph.add_conditional_edges(
        "discovery_validation",
        check_paper_count,  # Returns "continue" or "fail"
        {
            "continue": "paper_summarize",
            "fail": "failure_handler",
        }
    )
    
    # Linear progression after validation
    graph.add_edge("paper_summarize", "paper_compare")
    graph.add_edge("paper_compare", "synthesis")
    graph.add_edge("synthesis", "final_writer")
    graph.add_edge("final_writer", END)
    graph.add_edge("failure_handler", END)
    
    return graph.compile()

def check_paper_count(state: ResearchState) -> Literal["continue", "fail"]:
    """HARD CONSTRAINT: Must have at least 3 valid papers"""
    if len(state.valid_papers) < 3:
        return "fail"
    return "continue"
```

**Research Graph Visualization:**

```
START
  │
  ▼
┌─────────────────────────┐
│   PaperDiscoveryNode    │  ← Tool-only: web_search, arxiv_api
│   (MANDATORY TOOL USE)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ DiscoveryValidationNode │  ← Check: papers >= 3?
│   (VALIDATION GATE)     │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
  continue       fail
     │             │
     ▼             ▼
┌─────────────┐  ┌─────────────┐
│ Summarize   │  │   STOP      │
│ (one paper  │  │  (Explicit  │
│  per cycle) │  │   Failure)  │
└──────┬──────┘  └─────────────┘
       │
       ▼
┌─────────────────────────┐
│    PaperCompareNode     │
│  (Cross-paper analysis) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     SynthesisNode       │  ← Generate claims with citations
│ (Claims MUST cite papers)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│    FinalWriterNode      │  ← Produce final report
│  (Evidence-backed only) │
└───────────┬─────────────┘
            │
            ▼
          END
```

### 4.3 PPT Graph

```python
def create_ppt_graph():
    graph = StateGraph(PPTState)
    
    graph.add_node("content_analysis", content_analysis_node)
    graph.add_node("outline_generation", outline_generation_node)
    graph.add_node("slide_content_creation", slide_content_node)
    graph.add_node("visual_suggestions", visual_suggestions_node)
    graph.add_node("ppt_export", ppt_export_node)
    
    graph.set_entry_point("content_analysis")
    
    graph.add_edge("content_analysis", "outline_generation")
    graph.add_edge("outline_generation", "slide_content_creation")
    graph.add_edge("slide_content_creation", "visual_suggestions")
    graph.add_edge("visual_suggestions", "ppt_export")
    graph.add_edge("ppt_export", END)
    
    return graph.compile()
```

### 4.4 Summary Graph

```python
def create_summary_graph():
    graph = StateGraph(SummaryState)
    
    graph.add_node("content_ingestion", content_ingestion_node)
    graph.add_node("chunk_processing", chunk_processing_node)
    graph.add_node("key_extraction", key_extraction_node)
    graph.add_node("summary_generation", summary_generation_node)
    
    graph.set_entry_point("content_ingestion")
    
    graph.add_edge("content_ingestion", "chunk_processing")
    graph.add_edge("chunk_processing", "key_extraction")
    graph.add_edge("key_extraction", "summary_generation")
    graph.add_edge("summary_generation", END)
    
    return graph.compile()
```

### 4.5 General Chat Graph

```python
def create_general_chat_graph():
    graph = StateGraph(ChatState)
    
    graph.add_node("tool_detection", tool_detection_node)
    graph.add_node("tool_execution", tool_execution_node)
    graph.add_node("response_generation", response_generation_node)
    
    graph.set_entry_point("tool_detection")
    
    graph.add_conditional_edges(
        "tool_detection",
        check_needs_tools,
        {
            "yes": "tool_execution",
            "no": "response_generation",
        }
    )
    
    graph.add_edge("tool_execution", "response_generation")
    graph.add_edge("response_generation", END)
    
    return graph.compile()
```

---

## 5. Atomic Skill Definitions

### 5.1 Skill Catalog

| Skill ID | Category | Purpose | Input | Output |
|----------|----------|---------|-------|--------|
| `paper_discovery` | Research | Find academic papers | SearchQuery | Paper[] |
| `paper_summarize` | Research | Summarize single paper | Paper | PaperSummary |
| `paper_compare` | Research | Compare multiple papers | Paper[], Dimensions | ComparisonMatrix |
| `claim_synthesis` | Research | Generate evidence-backed claims | PaperSummary[] | Claim[] |
| `report_writer` | Research | Write final report | Claim[], ComparisonMatrix | Report |
| `outline_generate` | PPT | Create presentation outline | Topic, Context | Outline |
| `slide_content` | PPT | Generate slide content | OutlineSection | SlideContent |
| `ppt_export` | PPT | Export to PPTX format | Slides[] | FileArtifact |
| `content_chunk` | Summary | Split content into chunks | Content | Chunk[] |
| `key_extract` | Summary | Extract key points | Chunk | KeyPoints[] |
| `summary_write` | Summary | Write summary from key points | KeyPoints[] | Summary |
| `web_search` | Tool | Search the web | Query | SearchResults |
| `file_read` | Tool | Read file contents | FilePath | FileContent |
| `file_write` | Tool | Write file contents | FilePath, Content | Success |
| `bash_execute` | Tool | Execute shell command | Command | ExecutionResult |

### 5.2 Skill Implementation Pattern

```typescript
// Example: PaperDiscoverySkill
const PaperDiscoverySkill: AtomicSkill<PaperDiscoveryInput, PaperDiscoveryOutput> = {
  id: 'paper_discovery',
  name: 'Paper Discovery',
  version: '1.0.0',
  
  inputSchema: z.object({
    query: z.string().min(3).max(500),
    sources: z.array(z.enum(['arxiv', 'semantic_scholar', 'pubmed'])).default(['arxiv', 'semantic_scholar']),
    maxResults: z.number().min(1).max(50).default(20),
    dateRange: z.object({
      start: z.date().optional(),
      end: z.date().optional(),
    }).optional(),
  }),
  
  outputSchema: z.object({
    papers: z.array(PaperSchema),
    totalFound: z.number(),
    searchMetadata: z.object({
      queriesExecuted: z.number(),
      sourcesSearched: z.array(z.string()),
      duration: z.number(),
    }),
  }),
  
  async execute(input, context) {
    const results: Paper[] = [];
    
    // MANDATORY: Must use tools for discovery
    for (const source of input.sources) {
      const tool = context.tools.get(`${source}_search`);
      if (!tool) continue;
      
      const sourceResults = await tool.execute({
        query: input.query,
        maxResults: Math.ceil(input.maxResults / input.sources.length),
      });
      
      results.push(...sourceResults.papers);
    }
    
    return {
      papers: results.slice(0, input.maxResults),
      totalFound: results.length,
      searchMetadata: {
        queriesExecuted: input.sources.length,
        sourcesSearched: input.sources,
        duration: Date.now() - context.startTime,
      },
    };
  },
  
  description: 'Discovers academic papers from multiple sources based on search query',
  requiredTools: ['arxiv_search', 'semantic_scholar_search'],
  estimatedDuration: 5000,
  retryPolicy: { maxRetries: 3, backoffMs: 1000 },
};
```

### 5.3 Skill Registry

```typescript
class SkillRegistry {
  private skills: Map<string, AtomicSkill<any, any>> = new Map();
  
  register<TInput, TOutput>(skill: AtomicSkill<TInput, TOutput>): void {
    // Validate skill definition
    this.validateSkill(skill);
    this.skills.set(skill.id, skill);
  }
  
  get<TInput, TOutput>(id: string): AtomicSkill<TInput, TOutput> | undefined {
    return this.skills.get(id);
  }
  
  private validateSkill(skill: AtomicSkill<any, any>): void {
    // Ensure required fields
    if (!skill.id || !skill.name || !skill.version) {
      throw new Error('Skill must have id, name, and version');
    }
    
    // Ensure schemas are valid Zod schemas
    if (!skill.inputSchema || !skill.outputSchema) {
      throw new Error('Skill must define input and output schemas');
    }
    
    // Ensure execute is a function
    if (typeof skill.execute !== 'function') {
      throw new Error('Skill must implement execute function');
    }
  }
  
  // Get all skills for a scenario
  getScenarioSkills(scenario: string): AtomicSkill<any, any>[] {
    const scenarioSkills: Record<string, string[]> = {
      research: ['paper_discovery', 'paper_summarize', 'paper_compare', 'claim_synthesis', 'report_writer'],
      ppt: ['outline_generate', 'slide_content', 'ppt_export'],
      summary: ['content_chunk', 'key_extract', 'summary_write'],
      general_chat: ['web_search', 'file_read', 'file_write', 'bash_execute'],
    };
    
    return (scenarioSkills[scenario] || [])
      .map(id => this.skills.get(id))
      .filter((s): s is AtomicSkill<any, any> => s !== undefined);
  }
}
```

---

## 6. Scenario Graphs

### 6.1 Research Scenario Node Implementations

#### PaperDiscoveryNode

```typescript
const PaperDiscoveryNode: GraphNode<ResearchState, void, Paper[]> = {
  id: 'paper_discovery',
  name: 'Paper Discovery',
  
  preconditions: [
    {
      name: 'has_search_query',
      check: (state) => !!state.searchQuery && state.searchQuery.length >= 3,
      errorMessage: 'Search query must be at least 3 characters',
    },
  ],
  
  async execute(state, _input) {
    const skill = skillRegistry.get<PaperDiscoveryInput, PaperDiscoveryOutput>('paper_discovery');
    
    const result = await skill!.execute(
      {
        query: state.searchQuery,
        sources: ['arxiv', 'semantic_scholar'],
        maxResults: 20,
      },
      { tools: toolRegistry, startTime: Date.now() }
    );
    
    return result.papers;
  },
  
  postconditions: [
    {
      name: 'has_papers',
      check: (_state, output) => output.length > 0,
      errorMessage: 'No papers found for the given query',
    },
  ],
  
  updateState(state, output) {
    return {
      ...state,
      discoveredPapers: output,
      validPapers: output.filter(p => this.isValidPaper(p)),
    };
  },
  
  isValidPaper(paper: Paper): boolean {
    return !!(paper.title && paper.abstract && paper.url);
  },
};
```

#### DiscoveryValidationNode

```typescript
const DiscoveryValidationNode: GraphNode<ResearchState, void, ValidationResult> = {
  id: 'discovery_validation',
  name: 'Discovery Validation',
  
  preconditions: [],
  
  async execute(state, _input) {
    const paperCount = state.validPapers.length;
    const MIN_REQUIRED = 3;
    
    return {
      passed: paperCount >= MIN_REQUIRED,
      paperCount,
      requiredCount: MIN_REQUIRED,
      message: paperCount >= MIN_REQUIRED
        ? `Found ${paperCount} valid papers, proceeding to summarization`
        : `Only ${paperCount} valid papers found, minimum ${MIN_REQUIRED} required`,
    };
  },
  
  postconditions: [],
  
  updateState(state, output) {
    if (!output.passed) {
      return {
        ...state,
        status: 'failed',
        errors: [...state.errors, {
          code: 'INSUFFICIENT_PAPERS',
          message: output.message,
          nodeId: this.id,
        }],
      };
    }
    return state;
  },
};
```

#### PaperSummarizeNode

```typescript
const PaperSummarizeNode: GraphNode<ResearchState, void, Map<string, PaperSummary>> = {
  id: 'paper_summarize',
  name: 'Paper Summarization',
  
  preconditions: [
    {
      name: 'has_valid_papers',
      check: (state) => state.validPapers.length >= 3,
      errorMessage: 'Must have at least 3 valid papers before summarization',
    },
  ],
  
  async execute(state, _input) {
    const skill = skillRegistry.get<PaperSummarizeInput, PaperSummary>('paper_summarize');
    const summaries = new Map<string, PaperSummary>();
    
    // Process ONE paper at a time (as per spec)
    for (const paper of state.validPapers) {
      const summary = await skill!.execute(
        { paper },
        { llm: llmClient }
      );
      summaries.set(paper.id, summary);
    }
    
    return summaries;
  },
  
  postconditions: [
    {
      name: 'all_papers_summarized',
      check: (state, output) => output.size === state.validPapers.length,
      errorMessage: 'Not all papers were summarized',
    },
  ],
  
  updateState(state, output) {
    return { ...state, paperSummaries: output };
  },
};
```

#### SynthesisNode

```typescript
const SynthesisNode: GraphNode<ResearchState, void, Claim[]> = {
  id: 'synthesis',
  name: 'Claim Synthesis',
  
  preconditions: [
    {
      name: 'has_summaries_and_comparison',
      check: (state) => state.paperSummaries.size >= 3 && !!state.comparisonMatrix,
      errorMessage: 'Must have summaries and comparison matrix before synthesis',
    },
  ],
  
  async execute(state, _input) {
    const skill = skillRegistry.get<SynthesisInput, Claim[]>('claim_synthesis');
    
    const claims = await skill!.execute(
      {
        summaries: Array.from(state.paperSummaries.values()),
        comparisonMatrix: state.comparisonMatrix,
      },
      { llm: llmClient }
    );
    
    return claims;
  },
  
  postconditions: [
    {
      name: 'all_claims_have_citations',
      check: (_state, output) => output.every(claim => claim.supportingPaperIds.length >= 1),
      errorMessage: 'Every claim MUST reference at least one paper ID',
    },
    {
      name: 'citations_are_valid',
      check: (state, output) => {
        const validPaperIds = new Set(state.validPapers.map(p => p.id));
        return output.every(claim => 
          claim.supportingPaperIds.every(id => validPaperIds.has(id))
        );
      },
      errorMessage: 'All cited paper IDs must be valid',
    },
  ],
  
  updateState(state, output) {
    return { ...state, synthesizedClaims: output };
  },
};
```

### 6.2 PPT Scenario Node Implementations

```typescript
// PPT State
interface PPTState extends AgentState {
  topic: string;
  context?: string;
  outline?: Outline;
  slides: Slide[];
  outputPath?: string;
}

const OutlineGenerationNode: GraphNode<PPTState, void, Outline> = {
  id: 'outline_generation',
  name: 'Outline Generation',
  
  preconditions: [
    {
      name: 'has_topic',
      check: (state) => !!state.topic,
      errorMessage: 'Must have a topic for presentation',
    },
  ],
  
  async execute(state, _input) {
    const skill = skillRegistry.get<OutlineInput, Outline>('outline_generate');
    
    return await skill!.execute(
      { topic: state.topic, context: state.context },
      { llm: llmClient }
    );
  },
  
  postconditions: [
    {
      name: 'has_sections',
      check: (_state, output) => output.sections.length >= 3,
      errorMessage: 'Outline must have at least 3 sections',
    },
  ],
  
  updateState(state, output) {
    return { ...state, outline: output };
  },
};

const PPTExportNode: GraphNode<PPTState, void, FileArtifact> = {
  id: 'ppt_export',
  name: 'PPT Export',
  
  preconditions: [
    {
      name: 'has_slides',
      check: (state) => state.slides.length >= 1,
      errorMessage: 'Must have at least one slide to export',
    },
  ],
  
  async execute(state, _input) {
    const tool = toolRegistry.get('ppt_generator');
    
    return await tool!.execute({
      slides: state.slides,
      title: state.topic,
      outputPath: state.outputPath || `presentation_${Date.now()}.pptx`,
    });
  },
  
  postconditions: [
    {
      name: 'file_created',
      check: (_state, output) => !!output.fileId,
      errorMessage: 'PPT file must be created',
    },
  ],
  
  updateState(state, output) {
    return { ...state, outputPath: output.path };
  },
};
```

---

## 7. State Management

### 7.1 Memory Store

```typescript
interface MemoryStore {
  // Paper-related storage
  papers: {
    store(paperId: string, paper: Paper): Promise<void>;
    get(paperId: string): Promise<Paper | null>;
    search(query: string): Promise<Paper[]>;
  };
  
  // Summary storage
  summaries: {
    store(paperId: string, summary: PaperSummary): Promise<void>;
    get(paperId: string): Promise<PaperSummary | null>;
    getBySession(sessionId: string): Promise<PaperSummary[]>;
  };
  
  // Claim storage with evidence linking
  claims: {
    store(claim: Claim): Promise<void>;
    get(claimId: string): Promise<Claim | null>;
    getByPaper(paperId: string): Promise<Claim[]>;
    validateEvidence(claimId: string): Promise<boolean>;
  };
  
  // Session state
  sessions: {
    save(sessionId: string, state: AgentState): Promise<void>;
    load(sessionId: string): Promise<AgentState | null>;
    checkpoint(sessionId: string, nodeId: string): Promise<void>;
  };
}

// Implementation using existing Prisma setup
class PrismaMemoryStore implements MemoryStore {
  constructor(private prisma: PrismaClient) {}
  
  papers = {
    store: async (paperId: string, paper: Paper) => {
      await this.prisma.paper.upsert({
        where: { id: paperId },
        create: paper,
        update: paper,
      });
    },
    
    get: async (paperId: string) => {
      return this.prisma.paper.findUnique({ where: { id: paperId } });
    },
    
    search: async (query: string) => {
      return this.prisma.paper.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { abstract: { contains: query, mode: 'insensitive' } },
          ],
        },
      });
    },
  };
  
  // ... other implementations
}
```

### 7.2 Checkpoint System

```typescript
interface CheckpointManager {
  // Save checkpoint at a node
  saveCheckpoint(
    sessionId: string,
    nodeId: string,
    state: AgentState
  ): Promise<string>;  // Returns checkpoint ID
  
  // Resume from checkpoint
  resumeFromCheckpoint(
    checkpointId: string
  ): Promise<{ state: AgentState; nodeId: string }>;
  
  // List checkpoints for a session
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>;
}

interface Checkpoint {
  id: string;
  sessionId: string;
  nodeId: string;
  state: AgentState;
  createdAt: Date;
}
```

---

## 8. Validation & Failure Handling

### 8.1 Validation Rules

```typescript
// Research scenario validation rules
const ResearchValidationRules = {
  // Hard constraint: minimum papers
  MINIMUM_PAPERS: {
    rule: (state: ResearchState) => state.validPapers.length >= 3,
    errorCode: 'INSUFFICIENT_PAPERS',
    severity: 'fatal',
    message: 'Research requires at least 3 valid papers',
  },
  
  // Hard constraint: claims must have citations
  CLAIMS_REQUIRE_CITATIONS: {
    rule: (state: ResearchState) => 
      state.synthesizedClaims.every(c => c.supportingPaperIds.length >= 1),
    errorCode: 'UNCITED_CLAIMS',
    severity: 'fatal',
    message: 'Every claim must reference at least one paper',
  },
  
  // Hard constraint: no synthesis without comparison
  SYNTHESIS_REQUIRES_COMPARISON: {
    rule: (state: ResearchState) => 
      !state.synthesizedClaims.length || !!state.comparisonMatrix,
    errorCode: 'SYNTHESIS_WITHOUT_COMPARISON',
    severity: 'fatal',
    message: 'Synthesis cannot proceed without paper comparison',
  },
  
  // Warning: low paper count
  LOW_PAPER_COUNT_WARNING: {
    rule: (state: ResearchState) => state.validPapers.length >= 5,
    errorCode: 'LOW_PAPER_COUNT',
    severity: 'warning',
    message: 'Fewer than 5 papers may result in limited analysis',
  },
};

// Validation executor
class ValidationExecutor {
  validate(
    state: AgentState, 
    rules: Record<string, ValidationRule>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    for (const [name, rule] of Object.entries(rules)) {
      const passed = rule.rule(state);
      
      if (!passed) {
        if (rule.severity === 'fatal') {
          errors.push({
            code: rule.errorCode,
            message: rule.message,
            ruleName: name,
          });
        } else {
          warnings.push({
            code: rule.errorCode,
            message: rule.message,
            ruleName: name,
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### 8.2 Failure Conditions

| Condition | Trigger | Action | Recovery |
|-----------|---------|--------|----------|
| Insufficient Papers | `validPapers.length < 3` | Stop graph execution | Report to user, suggest query refinement |
| Uncited Claim | `claim.supportingPaperIds.length === 0` | Reject synthesis output | Re-run synthesis with stricter prompt |
| Tool Timeout | Tool execution > timeout | Mark tool as failed | Retry with backoff, then skip |
| LLM Error | API error or invalid response | Log and retry | Max 3 retries, then fail node |
| Invalid Schema | Output doesn't match schema | Reject output | Re-run node with corrected input |

### 8.3 Failure Handler Node

```typescript
const FailureHandlerNode: GraphNode<AgentState, void, FailureReport> = {
  id: 'failure_handler',
  name: 'Failure Handler',
  
  preconditions: [],
  
  async execute(state, _input) {
    const report: FailureReport = {
      sessionId: state.sessionId,
      failedAt: state.currentNode,
      errors: state.errors,
      partialResults: this.extractPartialResults(state),
      suggestions: this.generateSuggestions(state.errors),
      recoveryOptions: this.determineRecoveryOptions(state),
    };
    
    // Log failure for analysis
    await this.logFailure(report);
    
    return report;
  },
  
  postconditions: [],
  
  updateState(state, output) {
    return {
      ...state,
      status: 'failed',
      failureReport: output,
    };
  },
  
  extractPartialResults(state: AgentState): Record<string, unknown> {
    // Extract any useful partial results
    return {
      discoveredPapers: (state as ResearchState).discoveredPapers?.length || 0,
      summarizedPapers: (state as ResearchState).paperSummaries?.size || 0,
    };
  },
  
  generateSuggestions(errors: AgentError[]): string[] {
    const suggestions: string[] = [];
    
    for (const error of errors) {
      if (error.code === 'INSUFFICIENT_PAPERS') {
        suggestions.push('Try broadening your search query');
        suggestions.push('Include more paper sources');
        suggestions.push('Reduce specificity of search terms');
      }
    }
    
    return suggestions;
  },
};
```

---

## 9. Extensibility Guidelines

### 9.1 Adding a New Scenario Graph

1. **Define State Schema**
```typescript
interface NewScenarioState extends AgentState {
  // Scenario-specific fields
  customField1: string;
  customField2: number;
}
```

2. **Implement Required Skills**
```typescript
const NewSkill: AtomicSkill<NewInput, NewOutput> = {
  id: 'new_skill',
  // ... implementation
};

skillRegistry.register(NewSkill);
```

3. **Define Graph Nodes**
```typescript
const NewNode: GraphNode<NewScenarioState, Input, Output> = {
  id: 'new_node',
  // ... implementation
};
```

4. **Compose Graph**
```python
def create_new_scenario_graph():
    graph = StateGraph(NewScenarioState)
    graph.add_node("node1", node1_impl)
    graph.add_node("node2", node2_impl)
    graph.add_edge("node1", "node2")
    graph.add_edge("node2", END)
    return graph.compile()
```

5. **Register in Router**
```python
# In route_to_scenario function
def route_to_scenario(state):
    scenario_map = {
        "research": "research_graph",
        "ppt": "ppt_graph",
        "summary": "summary_graph",
        "general_chat": "general_chat_graph",
        "new_scenario": "new_scenario_graph",  # Add here
    }
    return scenario_map[state.parsed_intent.scenario]
```

### 9.2 Adding a New Skill

```typescript
// 1. Define input/output schemas
const NewSkillInputSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

const NewSkillOutputSchema = z.object({
  result: z.string(),
  metadata: z.record(z.unknown()),
});

// 2. Implement skill
const NewSkill: AtomicSkill<
  z.infer<typeof NewSkillInputSchema>,
  z.infer<typeof NewSkillOutputSchema>
> = {
  id: 'new_skill',
  name: 'New Skill',
  version: '1.0.0',
  inputSchema: NewSkillInputSchema,
  outputSchema: NewSkillOutputSchema,
  
  async execute(input, context) {
    // Implementation
    return { result: 'done', metadata: {} };
  },
  
  description: 'Description of what this skill does',
  requiredTools: [],
  estimatedDuration: 1000,
  retryPolicy: { maxRetries: 2, backoffMs: 500 },
};

// 3. Register
skillRegistry.register(NewSkill);
```

### 9.3 Adding a New Tool

```typescript
// Follows existing Tool interface in types.ts
const NewTool: Tool = {
  name: 'new_tool',
  description: 'What this tool does',
  
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter 1' },
    },
    required: ['param1'],
  },
  
  async execute(params, onProgress) {
    // Implementation
    return {
      success: true,
      output: 'result',
      duration: 100,
    };
  },
  
  requiresConfirmation: false,
  timeout: 30000,
};

// Register in ToolRegistry
toolRegistry.register(NewTool);
```

### 9.4 Replacing an LLM Provider

```typescript
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
}

// Example: Switching from GLM to OpenAI
class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages,
      temperature: options?.temperature || 0.7,
    });
    
    return {
      content: response.choices[0].message.content || '',
      toolCalls: response.choices[0].message.tool_calls,
    };
  }
  
  async *streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages,
      stream: true,
    });
    
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}

// Swap providers at runtime
const llmProvider: LLMProvider = new OpenAIProvider(process.env.OPENAI_API_KEY);
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Set up LangGraph integration
- [ ] Define core state schemas
- [ ] Implement base node interfaces
- [ ] Create skill registry
- [ ] Set up validation framework

### Phase 2: Research Scenario (Week 3-4)

- [ ] Implement PaperDiscoveryNode
- [ ] Implement PaperSummarizeNode
- [ ] Implement PaperCompareNode
- [ ] Implement SynthesisNode
- [ ] Implement FinalWriterNode
- [ ] Implement validation gates
- [ ] End-to-end testing

### Phase 3: PPT Scenario (Week 5)

- [ ] Implement OutlineGenerationNode
- [ ] Implement SlideContentNode
- [ ] Implement PPTExportNode
- [ ] Integration with existing ppt_generator tool

### Phase 4: Summary Scenario (Week 6)

- [ ] Implement ContentIngestionNode
- [ ] Implement ChunkProcessingNode
- [ ] Implement SummaryGenerationNode

### Phase 5: Integration & Testing (Week 7-8)

- [ ] Integrate with existing API routes
- [ ] Streaming support for LangGraph execution
- [ ] Frontend integration
- [ ] Comprehensive testing
- [ ] Documentation

### Phase 6: Production Hardening (Week 9-10)

- [ ] Error handling improvements
- [ ] Monitoring and logging
- [ ] Performance optimization
- [ ] Security review
- [ ] Deployment

---

## Appendix A: LangGraph Integration Code

```python
# apps/api/src/services/langgraph/graphs.py

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from typing import TypedDict, List, Optional, Literal
import json

# State definitions
class AgentState(TypedDict):
    session_id: str
    user_id: str
    request_id: str
    user_prompt: str
    parsed_intent: dict
    current_node: str
    execution_history: List[dict]
    intermediate_results: dict
    errors: List[dict]
    status: str

class ResearchState(AgentState):
    search_query: str
    discovered_papers: List[dict]
    valid_papers: List[dict]
    paper_summaries: dict
    comparison_matrix: dict
    synthesized_claims: List[dict]
    final_report: Optional[dict]

# Node implementations
async def intent_parsing_node(state: AgentState) -> AgentState:
    """Parse user intent and classify scenario"""
    from services.llm import llm_client
    
    # Use LLM to parse intent (constrained execution)
    result = await llm_client.parse_intent(state["user_prompt"])
    
    return {
        **state,
        "parsed_intent": result,
        "current_node": "intent_parsing",
    }

async def paper_discovery_node(state: ResearchState) -> ResearchState:
    """Discover papers using tools (MANDATORY tool usage)"""
    from services.tools import tool_registry
    
    search_tool = tool_registry.get("web_search")
    arxiv_tool = tool_registry.get("arxiv_search")
    
    # Execute searches
    web_results = await search_tool.execute({
        "query": f"{state['search_query']} research paper",
        "max_results": 10,
    })
    
    arxiv_results = await arxiv_tool.execute({
        "query": state["search_query"],
        "max_results": 10,
    })
    
    all_papers = web_results["papers"] + arxiv_results["papers"]
    valid_papers = [p for p in all_papers if is_valid_paper(p)]
    
    return {
        **state,
        "discovered_papers": all_papers,
        "valid_papers": valid_papers,
        "current_node": "paper_discovery",
    }

def check_paper_count(state: ResearchState) -> Literal["continue", "fail"]:
    """HARD CONSTRAINT: Must have at least 3 valid papers"""
    if len(state["valid_papers"]) < 3:
        return "fail"
    return "continue"

# Graph construction
def create_router_graph():
    graph = StateGraph(AgentState)
    
    graph.add_node("intent_parser", intent_parsing_node)
    graph.add_node("research_graph", create_research_graph())
    graph.add_node("ppt_graph", create_ppt_graph())
    graph.add_node("summary_graph", create_summary_graph())
    graph.add_node("general_chat_graph", create_general_chat_graph())
    
    graph.set_entry_point("intent_parser")
    
    graph.add_conditional_edges(
        "intent_parser",
        lambda state: state["parsed_intent"]["scenario"],
        {
            "research": "research_graph",
            "ppt": "ppt_graph",
            "summary": "summary_graph",
            "general_chat": "general_chat_graph",
        }
    )
    
    for subgraph in ["research_graph", "ppt_graph", "summary_graph", "general_chat_graph"]:
        graph.add_edge(subgraph, END)
    
    # Add checkpointer for persistence
    checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
    
    return graph.compile(checkpointer=checkpointer)

def create_research_graph():
    graph = StateGraph(ResearchState)
    
    graph.add_node("paper_discovery", paper_discovery_node)
    graph.add_node("discovery_validation", discovery_validation_node)
    graph.add_node("paper_summarize", paper_summarize_node)
    graph.add_node("paper_compare", paper_compare_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("final_writer", final_writer_node)
    graph.add_node("failure_handler", failure_handler_node)
    
    graph.set_entry_point("paper_discovery")
    graph.add_edge("paper_discovery", "discovery_validation")
    
    graph.add_conditional_edges(
        "discovery_validation",
        check_paper_count,
        {"continue": "paper_summarize", "fail": "failure_handler"}
    )
    
    graph.add_edge("paper_summarize", "paper_compare")
    graph.add_edge("paper_compare", "synthesis")
    graph.add_edge("synthesis", "final_writer")
    graph.add_edge("final_writer", END)
    graph.add_edge("failure_handler", END)
    
    return graph.compile()

# Entry point
router_graph = create_router_graph()

async def run_agent(session_id: str, user_id: str, prompt: str) -> dict:
    """Main entry point for running the agent"""
    initial_state: AgentState = {
        "session_id": session_id,
        "user_id": user_id,
        "request_id": generate_request_id(),
        "user_prompt": prompt,
        "parsed_intent": {},
        "current_node": "",
        "execution_history": [],
        "intermediate_results": {},
        "errors": [],
        "status": "running",
    }
    
    # Run the graph
    final_state = await router_graph.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": session_id}}
    )
    
    return final_state
```

---

## Appendix B: TypeScript Type Definitions

```typescript
// apps/api/src/services/langgraph/types.ts

import { z } from 'zod';

// Base schemas
export const ParsedIntentSchema = z.object({
  scenario: z.enum(['research', 'ppt', 'summary', 'general_chat']),
  entities: z.record(z.string()),
  parameters: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
});

export const ExecutionStepSchema = z.object({
  nodeId: z.string(),
  startTime: z.date(),
  endTime: z.date().optional(),
  input: z.unknown(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const AgentStateSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  requestId: z.string(),
  timestamp: z.date(),
  userPrompt: z.string(),
  parsedIntent: ParsedIntentSchema,
  currentNode: z.string(),
  executionHistory: z.array(ExecutionStepSchema),
  intermediateResults: z.record(z.unknown()),
  errors: z.array(AgentErrorSchema),
  status: z.enum(['running', 'completed', 'failed', 'stopped']),
});

// Research-specific schemas
export const PaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  url: z.string().url(),
  source: z.enum(['arxiv', 'semantic_scholar', 'pubmed']),
  publishedDate: z.date(),
  citationCount: z.number().optional(),
});

export const PaperSummarySchema = z.object({
  paperId: z.string(),
  mainContributions: z.array(z.string()),
  methodology: z.string(),
  keyFindings: z.array(z.string()),
  limitations: z.array(z.string()),
});

export const ClaimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  supportingPaperIds: z.array(z.string()).min(1),  // MUST have at least one!
  confidence: z.enum(['high', 'medium', 'low']),
  category: z.string(),
});

export const ResearchStateSchema = AgentStateSchema.extend({
  searchQuery: z.string(),
  discoveredPapers: z.array(PaperSchema),
  validPapers: z.array(PaperSchema),
  paperSummaries: z.map(z.string(), PaperSummarySchema),
  comparisonMatrix: z.object({
    dimensions: z.array(z.string()),
    paperScores: z.map(z.string(), z.map(z.string(), z.union([z.number(), z.string()]))),
  }),
  synthesizedClaims: z.array(ClaimSchema),
  finalReport: z.object({
    title: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      content: z.string(),
      citations: z.array(z.string()),
    })),
  }).optional(),
});

// Type exports
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;
export type AgentError = z.infer<typeof AgentErrorSchema>;
export type AgentState = z.infer<typeof AgentStateSchema>;
export type Paper = z.infer<typeof PaperSchema>;
export type PaperSummary = z.infer<typeof PaperSummarySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type ResearchState = z.infer<typeof ResearchStateSchema>;
```

---

## Summary

This architecture provides:

1. **LangGraph-Centric Control**: All workflow logic is explicit in graph definitions
2. **Atomic Skills**: Each capability is isolated, tested, and replaceable
3. **Deterministic Routing**: Scenario selection is rule-based, not LLM-inferred
4. **Evidence-Based Output**: Every claim requires explicit citations
5. **Validation Gates**: Hard constraints enforce data quality
6. **Extensibility**: Clear patterns for adding scenarios, skills, and tools
7. **Failure Handling**: Explicit stop conditions with useful error reporting

The system is designed to evolve while maintaining strict boundaries between orchestration (LangGraph), capabilities (Skills), and execution (Tools).
