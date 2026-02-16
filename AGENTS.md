# AGENTS.md

## Required Delivery Process
- For any code work (new feature, refactor, bug fix, regression repair), follow this exact sequence:
  - `ANALYZE > PLAN > BUILD/FIX > TEST`
- Do not skip phases.
- "TEST" must include at least targeted automated tests relevant to the touched behavior; run broader tests when risk is medium/high.
- Run end-to-end (E2E) tests when changes affect cross-service flows, streaming/tool orchestration, or critical user-visible journeys.
  - If full E2E cannot be run in the current environment, explicitly document why and run the closest integration coverage available.

## Historical Fixes And Root Causes (Do Not Regress)

### 1) Duplicate web-search tool steps in Reasoning Trace
- Symptom:
  - Inspector showed repeated failed `Web Search` tool steps with the same "Search already completed for this query..." message.
- Root cause:
  - LLM retried blocked search calls; each blocked retry was emitted and rendered as a new failed tool step.
- Fix pattern:
  - Keep backend guard that blocks redundant searches.
  - Dedupe these blocked retries in timeline rendering using a canonical dedupe signature for blocked search errors.
- Files:
  - `apps/api/src/services/tasks/task_manager.ts`
  - `apps/web/src/components/inspector/ReasoningTrace.tsx`
  - `apps/web/src/components/inspector/__tests__/ReasoningTrace.test.tsx`

### 2) New chat contaminated/replaced historical Computer snapshots
- Symptom:
  - Starting a new prompt/chat appeared to replace or show old snapshots incorrectly in Inspector.
- Root causes:
  - Tool-call map key collision:
    - `toolCalls` were keyed by `toolCallId` only (not session-scoped), so identical IDs across sessions could overwrite each other.
  - Session switch clearing too broadly:
    - `clearToolCalls()` was called globally during session change.
  - Event contamination risk:
    - Stream handlers did not strongly ignore events from other sessions.
  - Timeline clobber on hydration:
    - Rehydration replaced local timeline with DB reconstruction, which has lower fidelity and can drop screenshot state.
  - Message association overreach:
    - `associateAgentStepsWithMessage` tagged all unassigned steps, including older runs.
  - History wipe on new turn:
    - `clearBrowserSession(sessionId)` on `message.start` removed prior run browser history.
  - UI fallback leak:
    - Computer panel could show standalone browser timeline for latest message even when no scoped steps existed.
- Fix pattern:
  - Always namespace tool-call storage key by `sessionId + toolCallId`.
  - On session change, clear only current session tool calls.
  - Parse and carry `sessionId` from SSE payload and reject mismatched events at handler boundary.
  - Hydration rule:
    - If timeline exists, never replace it with reconstructed timeline.
    - Only backfill/repair `messageId` mapping.
  - Associate message IDs only from `agentRunStartIndex` forward, then clear that marker.
  - Do not clear browser session on each `message.start`.
  - In Computer panel, show standalone browser timeline only in live/no-message scope.
- Files:
  - `apps/web/src/stores/chatStore.ts`
  - `apps/web/src/components/chat/ChatContainer.tsx`
  - `apps/web/src/hooks/useSSE.ts`
  - `apps/web/src/lib/sse.ts`
  - `apps/web/src/hooks/useChat.ts`
  - `apps/web/src/components/inspector/ComputerPanel.tsx`
  - `apps/web/src/stores/__tests__/chatStore.test.ts`
  - `apps/web/src/components/inspector/__tests__/ComputerPanel.test.tsx`

## Mandatory Guardrails For Future Changes
- Never use global keys for session-bound runtime state.
  - If data is session-bound, key by `sessionId`.
- Never globally clear runtime maps on session switch unless explicitly intended.
  - Prefer `clearX(sessionId)` scoped clears.
- Treat streaming events as untrusted cross-session input.
  - Drop events when `event.sessionId` does not equal current route/session.
- Do not replace rich local visual history with degraded reconstruction.
  - Reconstruction is bootstrap/fallback only.
- When associating runtime steps to assistant messages, scope to current run window.
  - Use run start marker, not "all unassigned".

## Regression Test Minimums
- Tool calls:
  - Same `toolCallId` in different sessions must not collide.
- Reasoning trace:
  - Repeated blocked search retries collapse to one logical step.
- Computer panel:
  - Latest message without scoped steps must not show stale old timeline.
  - Historical selected message must show its own snapshot, not latest run snapshot.
- Hydration:
  - Existing timeline with screenshots must not be overwritten by reconstruction.

## Debug Playbook (Fast)
- If snapshots look wrong:
  - Check `agentSteps[sessionId]`, `agentRunStartIndex[sessionId]`, `selectedMessageId`, `browserSession[sessionId]`.
- If wrong tool/source rows appear:
  - Inspect `toolCalls` keys for session prefix and validate `messageId` association.
- If cross-session behavior appears:
  - Confirm SSE event carries `sessionId` and client handler is filtering mismatches.
