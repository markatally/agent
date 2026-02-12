# Inspector Refactor Plan (Analyze -> Build -> Test -> Fix)

## 1) Current-State Diagnosis

### Duplicate "Computer" header/status
- `apps/web/src/components/inspector/InspectorPanel.tsx` renders an outer `Computer` section header and status.
- `apps/web/src/components/inspector/ComputerPanel.tsx` also renders inner `Computer` headers with another status in replay/PPT/empty states.
- Result: nested "Computer" + duplicate status indicators.

### Duplicate "Reasoning Trace" container
- `apps/web/src/components/inspector/InspectorPanel.tsx` renders an outer `Reasoning Trace` section header.
- `apps/web/src/components/inspector/InspectorReasoningFlow.tsx` renders `ReasoningTrace`.
- `apps/web/src/components/inspector/ReasoningTrace.tsx` renders `ReasoningTimeline`.
- `apps/web/src/components/chat/ReasoningTimeline.tsx` renders another "Reasoning Trace" card/header.
- Result: outer + inner repeated reasoning containers.

### Extra standalone Searching/Tool trace blocks
- `apps/web/src/components/inspector/InspectorReasoningFlow.tsx` adds separate `Searching` and `Other Tools` blocks below reasoning.
- This violates the requirement to merge tool details into reasoning timeline items.

### Snapshot sizing issue root cause
- `apps/web/src/components/inspector/BrowserViewport.tsx` draws live frames on canvas with fixed letterbox fill (`ctx.fillStyle = '#1a1a1a'`) and contain-fit scaling.
- Snapshot `<img>` is always `object-contain` in a fixed container; no explicit sizing mode.
- Result: deterministic black bars/letterboxing and no user-selectable policy (FIT/FILL/PIXEL).

## 2) Target Component Structure

### Keep
- `InspectorPanel` as top-level shell and collapse logic.
- `ComputerPanel` for browser timeline + scrubber + placeholders.
- `ReasoningTrace` as the single reasoning timeline component in Inspector.

### Remove/replace
- Remove `InspectorReasoningFlow` from Inspector usage and delete it.
- Stop using nested "Reasoning Trace" card title in Inspector context.
- Stop rendering inner `Computer` header/status from `ComputerPanel`.

### New structure (Inspector content)
1. Outer `Computer` section (single title + single status; collapsible)
2. Outer `Reasoning Trace` section (single title + single status; collapsible)
3. Inside `Reasoning Trace`: one timeline list that includes reasoning steps + tool items

## 3) Data Contract for Tool Calls and Sources

Tool timeline item source: `useChatStore().toolCalls` filtered by:
- `call.sessionId === sessionId`
- `call.status !== 'pending'`
- if message selected: `call.messageId === selectedMessageId`

Required fields to render expandable details:
- `toolCallId` (stable key)
- `toolName` (title `Tool: <name>`)
- `status` (running/completed/failed)
- `params` (request params section)
- `result.output` (response summary base)
- `result.artifacts[]` (source extraction + optional parsed structured results)
- `error` (failure detail)

Sources extraction contract:
- URLs from `result.output` text
- URLs (and titles when available) parsed from known structured artifact payloads, especially `search-results.json`
- fallback title = URL host/full URL

## 4) Snapshot Sizing Mode Spec

Implement explicit mode on `BrowserViewport`:
- `FIT`: preserve aspect ratio; viewport frame adapts to source ratio (snapshot/frame dimensions), no distortion.
- `FILL`: cover container area; preserve aspect ratio with cropping allowed, no black bars.
- `PIXEL`: render at source pixel size (1:1), enable overflow scroll.

Mode control:
- Add segmented control in Computer content (FIT / FILL / PIXEL).
- Persist to `localStorage` key for session continuity.

Default mode choice: `FIT`
- Best match for "must fully follow snapshot size or viewport size" while preserving full content and avoiding distortion.
- `FIT` uses source ratio as canonical geometry; no arbitrary letterboxing policy from hardcoded black canvas fill.

## 5) Implementation Plan (BUILD)

1. Add viewport sizing model utilities (`fit|fill|pixel`) and deterministic style helpers.
2. Refactor `BrowserViewport`:
   - Use explicit sizing mode.
   - Remove black-canvas letterbox behavior for live preview.
   - Track source dimensions for ratio-driven layout.
3. Refactor `ComputerPanel`:
   - Accept sizing mode state + pass to every `BrowserViewport` instance.
   - Remove inner Computer status/header when embedded in Inspector.
4. Refactor `InspectorPanel`:
   - Keep one Computer header/status and one Reasoning Trace header/status.
   - Render `ReasoningTrace` directly (no `InspectorReasoningFlow`).
5. Refactor `ReasoningTrace`:
   - Render single timeline list in inspector context.
   - Merge tool call items as expandable timeline entries.
   - Show tool name, params, response summary, sources list (clickable).
6. Remove obsolete `InspectorReasoningFlow.tsx`.

## 6) Edge Cases

- No snapshot/live frame available: show stable placeholder message (no layout jump).
- Missing tool result or params: render "No params"/"No output" fallback.
- Missing sources: show explicit "No sources found".
- Long source lists: capped panel height + internal scroll (`max-h` + `overflow-y-auto`).
- Very small inspector width/heights: avoid overflow clipping via min-h guards + scoped scroll containers.
- Failed tool calls: timeline status icon and error section visible.
- PIXEL mode with large image: horizontal/vertical scroll visible and usable.

## 7) TEST Plan

### Unit tests
- Sizing mode logic utility:
  - FIT computes ratio-based layout
  - FILL uses cover semantics
  - PIXEL returns 1:1/scroll behavior

### Component/UI tests
- `ReasoningTrace` inspector rendering:
  - no duplicate nested "Reasoning Trace" heading in inspector content
  - tool items rendered as `Tool: <name>`
  - expanding tool item reveals params + response summary + clickable source links
- Inspector structure:
  - no standalone `Searching`/`Tool trace` blocks
  - single outer `Computer` status indicator

### E2E smoke (existing Playwright path)
- Inspector opens
- Browser viewport visible
- Tool/snapshot flows still functional after refactor

## 8) Completion Criteria

All acceptance criteria from request map to specific checks:
- deterministic sizing modes -> utility + viewport tests
- single Computer/status -> inspector structure test
- single Reasoning Trace -> inspector structure test
- no Searching/Tool trace blocks -> DOM assertions
- tool calls under reasoning with expandable sources -> component test
- no overflow bugs -> component style assertions + Playwright smoke at common viewport sizes

---

# Inspector Follow-Up Plan (Analyze -> Plan -> Fix -> Test)

## A) Current Issues Diagnosis

1. Snapshot fallback on blocked links:
- `apps/api/src/services/browser/orchestrator.ts` strips some tracking params but misses Cloudflare challenge tokens (`__cf_chl_*`), so stale challenge query values can force blocked responses.
- When navigation fails/challenge-detects, the code renders an explicit fallback error page (`Snapshot fallback: source page blocked`), which is technically a screenshot but poor UX and perceived as failure.

2. Computer status text mismatch:
- `apps/web/src/components/inspector/InspectorPanel.tsx` maps active state to `Running`; product requirement is `Live` while running.

3. Completed state after run:
- Same header status logic needs deterministic transition from `Live` -> `Completed` (green dot) once browser activity/streaming ends.

4. Nested card visual clutter:
- `InspectorPanel` already provides a card surface, while `ComputerPanel` adds another bordered rounded card in compact mode, creating nested borders and extra padding.
- Computer/Reasoning sections should share one flattened style system.

## B) Fix Plan

1. Browser snapshot resilience for blocked URLs:
- Extend URL normalization to remove Cloudflare challenge params.
- Replace error-first fallback rendering with content-first reader snapshot rendering:
  - Build a synthesized article preview snapshot (title + URL + snippet + optional extracted readable text).
  - Keep screenshot generation deterministic by rendering the preview HTML into the browser and taking a normal screenshot.
  - Use neutral success copy (`Captured content snapshot`) instead of fallback-error wording.

2. Status label updates:
- Change Computer header status mapping:
  - running/launching/streaming => `Live` (red dot)
  - failed => `Failed`
  - otherwise => `Completed` (green dot)

3. Flatten Computer UI:
- Remove inner bordered card wrappers in `ComputerPanel` when `compact=true`.
- Keep one surface owned by `InspectorPanel`.
- Tighten spacing and make timeline controls use a unified subtle container style.

4. Style parity with Reasoning Trace:
- Apply same section container treatment for Computer and Reasoning Trace in `InspectorPanel` (single surface, subtle elevation, consistent border/spacing tokens).

## C) Test Plan

1. API unit tests:
- Add/update tests in `tests/unit/browser-orchestrator.test.ts`:
  - Cloudflare params are removed during normalization.
  - Navigation attempt behavior still deterministic.

2. Web component tests:
- Update `apps/web/src/components/inspector/__tests__/InspectorPanel.test.tsx`:
  - `Live` appears while streaming browser is active.
  - `Completed` appears when browser is closed/not streaming.
  - no duplicate section headings.

3. Regression checks:
- Run `bun run --filter=web test`.
- Run `bun test tests/unit/browser-orchestrator.test.ts`.
- Run `bun run --filter=web lint`.

---

# Inspector Follow-Up Plan 2 (Reasoning Trace + Collapse)

## A) Diagnosis
- `ReasoningTrace` currently shows web search tool items as standalone timeline rows and can show duplicates.
- Tool details are bundled in one `Details` expander instead of distinct `Request` and `Sources` expanders.
- Running timers rely on `Date.now()` per render and are not frame-synchronized/throttled for smooth centisecond updates.
- Computer collapse keeps layout pressure due section flex sizing even when content is hidden.

## B) Build Plan
1. Refactor `ReasoningTrace`:
- Deduplicate tool calls with deterministic signatures.
- Merge `web_search` calls into the `Searching` reasoning step.
- Split details into `Request` and `Sources` expandable panels.
2. Add high-precision timer loop:
- Use `requestAnimationFrame` + `performance.now()` -> epoch time.
- Throttle UI commits to every 10ms.
3. Fix Computer collapse behavior:
- Animate grid-row height to zero with overflow hidden.
- Remove flex/min-height pressure when collapsed.
- Unmount body after collapse animation to eliminate reserved space.
4. Update tests:
- Validate merged single web search presentation.
- Validate Request/Sources expansion.
- Validate collapse unmount + no reserved flex behavior.
