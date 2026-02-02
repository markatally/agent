# LangGraph Production Roadmap

Beyond the 4 immediate next steps (frontend integration, end-to-end testing, remaining nodes, progress display), here are additional areas that should be addressed:

---

## 1. Testing Infrastructure for LangGraph

**Problem:** The new LangGraph module (`apps/api/src/services/langgraph/`) has no unit tests yet.

**Tasks:**
- Unit tests for atomic skills (`skills.ts`) - test each skill in isolation with mocked LLM
- Unit tests for graph nodes (`nodes.ts`) - test pre/post conditions
- Unit tests for validation rules (`validation.ts`) - test constraint enforcement
- Integration tests for graph execution (`graphs.ts`) - test full scenario flows
- Mock providers for LLM and tools to enable deterministic testing

**Files to create:**
- `tests/unit/langgraph/skills.test.ts`
- `tests/unit/langgraph/nodes.test.ts`
- `tests/unit/langgraph/validation.test.ts`
- `tests/unit/langgraph/graphs.test.ts`

---

## 2. Observability and Debugging

**Problem:** No visibility into graph execution for debugging and monitoring.

**Tasks:**
- Add structured logging for each node execution (entry, exit, duration)
- Add execution tracing with span IDs for distributed tracing
- Create debug mode that logs detailed state at each node
- Add metrics collection (execution time, success rate, step count)
- Consider OpenTelemetry integration for production observability

**Implementation approach:**
- Add `Logger` interface to `NodeContext`
- Emit trace events during `GraphExecutor.execute()`
- Store execution traces in database for post-hoc analysis

---

## 3. Database Schema for Graph Execution

**Problem:** No persistence of graph execution state, claims, or evidence.

**Tasks:**
- Add Prisma models for graph execution tracking:
  - `GraphExecution` (id, sessionId, scenario, status, startTime, endTime)
  - `GraphNode` (id, executionId, nodeId, status, input, output, duration)
  - `Claim` (id, executionId, statement, confidence, citations)
  - `Paper` (id, title, abstract, url, source) with caching
- Add migration for new tables
- Implement checkpoint save/restore logic

**File:** `apps/api/prisma/schema.prisma`

---

## 4. Error Recovery and Resilience

**Problem:** When a node fails, the entire graph fails. No recovery options.

**Tasks:**
- Implement retry policies per node (already defined in skills, needs enforcement)
- Add circuit breaker for external API calls (arXiv, Semantic Scholar)
- Implement graceful degradation (continue with fewer papers if some fail)
- Add timeout handling per node, not just per graph
- Preserve partial results on failure for user review

---

## 5. Skill/Graph Scenario Integration

**Problem:** Existing 31 slash commands don't integrate with LangGraph scenarios.

**Tasks:**
- Map relevant skills to LangGraph scenarios:
  - `/search` (web) -> Research graph
  - `/ppt` -> PPT graph  
  - `/docs` -> Summary graph
- Add skill detection in `/agent` endpoint to auto-route
- Allow skills to specify preferred execution mode (chat vs graph)

**File to modify:** `apps/api/src/routes/stream.ts` (agent endpoint)

---

## 6. Security and Rate Limiting

**Problem:** Graph execution can be resource-intensive; no protection against abuse.

**Tasks:**
- Add rate limiting for `/agent` endpoint (separate from `/chat`)
- Add execution time limits configurable per scenario
- Add validation for research queries (prevent prompt injection)
- Sanitize paper content before LLM processing
- Add resource quotas per user (max papers, max claims)

---

## 7. Configuration and Feature Flags

**Problem:** LangGraph is always-on with no way to disable or configure per-scenario.

**Tasks:**
- Add config options to `config/default.json`:
  - `langgraph.enabled` (boolean)
  - `langgraph.scenarios` (which scenarios are available)
  - `langgraph.research.minPapers` (configurable minimum)
  - `langgraph.research.maxPapers` (configurable maximum)
- Add feature flag for gradual rollout
- Add environment variable overrides

---

## 8. Developer Documentation

**Problem:** `docs/LANGGRAPH_ARCHITECTURE.md` is comprehensive but lacks practical guides.

**Tasks:**
- Add "How to add a new scenario" tutorial
- Add "How to add a new skill" tutorial
- Add "How to add validation rules" guide
- Add API documentation for `/agent` endpoint
- Add example requests/responses for each scenario
- Add troubleshooting guide for common errors

---

## 9. Frontend Mode Selection

**Problem:** Users can't choose between standard chat and graph-based execution.

**Tasks:**
- Add mode toggle in ChatInput (Chat vs Agent)
- Add scenario selector when Agent mode selected
- Show different UI for graph execution (progress, nodes, validation)
- Add ability to view claim citations inline
- Add research report preview/export

---

## 10. Performance Optimization (Deferred)

**Problem:** Sequential node execution is slow; no caching.

**Tasks (for later):**
- Implement parallel node execution where dependencies allow
- Add Redis caching for paper lookups
- Add LLM response caching for identical prompts
- Stream intermediate results to frontend
- Consider background job queue for long-running graphs

---

## Priority Recommendation

```
High Priority (Do First):
1. Testing Infrastructure - Ensures correctness
2. Database Schema - Enables persistence
3. Error Recovery - Improves reliability

Medium Priority (Do Next):
4. Skill Integration - Improves UX
5. Observability - Enables debugging
6. Security/Rate Limiting - Production requirement

Lower Priority (Do Later):
7. Configuration - Nice to have
8. Documentation - Important but not blocking
9. Frontend Mode Selection - UX improvement
10. Performance - Optimize when needed
```

---

## Estimated Effort

| Area | Effort | Dependencies |
|------|--------|--------------|
| Testing Infrastructure | 8-12 hours | None |
| Database Schema | 4-6 hours | None |
| Error Recovery | 6-8 hours | Testing |
| Observability | 4-6 hours | None |
| Skill Integration | 2-4 hours | None |
| Security | 4-6 hours | None |
| Configuration | 2-4 hours | None |
| Documentation | 4-6 hours | Testing complete |
| Frontend Mode | 8-12 hours | Backend complete |
| Performance | 8-12 hours | All above |

**Total additional work:** ~50-80 hours beyond the 4 immediate steps
