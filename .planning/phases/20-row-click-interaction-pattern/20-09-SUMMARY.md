---
phase: 20-row-click-interaction-pattern
plan: 09
subsystem: ui
tags: [dashboard, click-handling, link-contract, tdd, accessibility]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "plan 20-03's row-click helper (attachRowNavigation) and the Records PR-table CTA removal that made row-click the sole affordance on five cells"
provides:
  - "shouldNavigateOnRowClick — the pure, unit-tested predicate holding the whole row-click link-contract decision"
  - "D-12 — the recorded decision covering modifier-key/button/selection guards and the explicit auxclick out-of-scope call"
  - "Behavioral + wiring test coverage in row-navigation.test.ts proving the guards, proven RED before GREEN"
affects: ["20-10", "20-11"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-free decision extraction: a pure predicate (RowClickContext -> boolean) carries a click-handling decision so it is testable under vitest's node environment, while the DOM-touching listener stays a thin adapter that builds the context and delegates."

key-files:
  created: []
  modified:
    - .planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md
    - src/dashboard/row-navigation.ts
    - src/dashboard/row-navigation.test.ts

key-decisions:
  - "D-12 recorded: the row-click listener now refuses navigation for a non-primary button, any modifier key, or an active text selection, in addition to the pre-existing closest('a') guard."
  - "auxclick (middle-click) is explicitly NOT handled — recorded as a deliberate absence, not an oversight, because synthesizing window.open would invent behavior contradicting D-03/UX-01 and is unverifiable in this DOM-less repo. The real fix is a real anchor on the five affected cells, deferred to Phase 21 pending D-05's activity-name join."
  - "Deviated from 20-REVIEW.md's drafted patch by extracting the three checks into a pure predicate (shouldNavigateOnRowClick) instead of inlining them in the addEventListener callback, because an inline check is unreachable from any test in a DOM-less repository."

patterns-established:
  - "RED-before-GREEN within a single non-tdd-tagged plan: Task 2 extracted the predicate with the pre-fix baseline body and proved the new behavioral cases failing against shipped semantics (8 failing tests) before Task 3 applied the real fix and turned them GREEN, in the same spirit as this codebase's tdd='true' convention."

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-13
---

# Phase 20 Plan 09: Row-Click Link Contract Summary

**Closed the BLOCKER 20-VERIFICATION.md recorded against row-navigation.ts — the row-click listener now honours the browser's link contract (modifier-click, non-primary button, drag-select) via a pure, unit-tested predicate, with middle-click recorded as a deliberate D-12 decision rather than an unexamined gap.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-13T23:10:00Z (approx, worktree session start)
- **Completed:** 2026-08-13T23:21:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments

- Recorded D-12 in `20-CONTEXT.md`: the full row-click link-contract decision (guards + reasoning) and the explicit auxclick out-of-scope call, superseding the stale "Claude's Discretion" bullet that had defaulted to no guards.
- Extracted `shouldNavigateOnRowClick(context: RowClickContext): boolean` — the whole click decision as a pure, node-testable function — and rewired `attachRowNavigation`'s listener to build a `RowClickContext` from the `MouseEvent` and current selection, then delegate to it.
- Proved the defect RED first: Task 2 shipped the predicate with the pre-fix baseline (`!context.insideAnchor`) and a full behavioral test suite; `npx vitest run` failed exactly 8 tests (the 7 single-guard cases plus the anti-over-blocking table case) against the shipped semantics, with the 2 baseline cases and all wiring assertions passing.
- Task 3 applied the full link contract (insideAnchor -> button -> modifier keys -> text selection, in that order) and turned all 21 tests in `row-navigation.test.ts` GREEN, with a new zero-count `auxclick` assertion making D-12 enforceable rather than advisory.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record D-12 — the row-click link contract, and the explicit auxclick call** - `89dc391` (docs)
2. **Task 2: Extract the click decision into a pure predicate, preserving behavior — the new tests must be RED** - `f94dda3` (test)
3. **Task 3: Apply the link contract — the tests turn GREEN, and the module header records D-12** - `89d1b48` (feat)

**Plan metadata commit:** pending (orchestrator-owned in worktree mode; this SUMMARY is committed directly per the worktree protocol).

_Note: Tasks 2 and 3 follow this codebase's RED-before-GREEN TDD precedent (20-06) even though the task is not tagged `tdd="true"` in frontmatter — Task 2's own verification step required a non-zero vitest exit before Task 3 could proceed._

## Files Created/Modified

- `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md` - Added D-12 (row-click link contract + auxclick disposition), superseded the stale "Claude's Discretion" default, added a Deferred Ideas entry.
- `src/dashboard/row-navigation.ts` - Added `RowClickContext` interface and `shouldNavigateOnRowClick` predicate carrying the whole click decision; rewired `attachRowNavigation`'s listener to delegate to it; extended the module header with a D-12 paragraph.
- `src/dashboard/row-navigation.test.ts` - Added the D-12 behavioral suite (11 cases: 2 baselines, 4 modifier-key cases, 2 button cases, 1 selection case, 1 anti-over-blocking table case) plus a wiring `describe` block (delegation count, field reads, `closest('a')` count, `auxclick` zero-count); updated the file header comment.

## Decisions Made

- **D-12** (see `20-CONTEXT.md`): the row-click listener refuses navigation on a non-primary button, any modifier key, or an active text selection, in addition to the existing `closest('a')` guard. Middle-click (`auxclick`) is explicitly out of scope — recorded reasoning: synthesizing `window.open` would invent behavior rather than propagate `list.ts`'s pattern (contradicting D-03/UX-01), adds unverifiable popup-blocker surface, and the real fix (a real anchor on the five affected cells) needs Phase 21's activity-name join (D-05).
- Deviated from `20-REVIEW.md`'s drafted patch by extracting the three checks into a pure predicate rather than inlining them in the `addEventListener` callback — an inline check would be unreachable from any test in this DOM-less repository, mirroring the reasoning `20-06-PLAN.md` used for preferring `tagName === 'A'` over `instanceof HTMLAnchorElement`.

## Deviations from Plan

None — plan executed exactly as written. Task 2's RED run failed exactly the 8 expected tests (7 single-field guard cases + the anti-over-blocking table case); Task 3's GREEN run passed all 21. No auto-fixes, no architectural questions, no auth gates.

## Verification Results

- `npx tsc --noEmit -p tsconfig.json` — exits 0 (checked after each task).
- Task 2: `npx vitest run src/dashboard/row-navigation.test.ts` — exited non-zero, 8 failed / 12 passed (20 total). Failures were exactly the 7 single-field guard cases (metaKey, ctrlKey, shiftKey, altKey, button:1, button:2, hasTextSelection) plus the anti-over-blocking table case. The 2 baseline cases and all wiring assertions passed, confirming the refactor was behavior-preserving before the fix landed.
- Task 3: `npx vitest run src/dashboard/row-navigation.test.ts src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts` — 3 files, 68 tests, all passed.
- Full suite: `npx vitest run` — 923/923 runnable tests passed. 5 test files failed with `ENOENT` on data fixtures absent from this worktree (`data/stats/best-efforts.json`, `data/dashboard/index.json`, `data/stats/gear-aggregate.json`, `data/stats/training-load.json`, `data/stats/year-over-year.json`) — these are the pre-existing data-dependent files named in `20-CONTEXT.md`'s Established Patterns / this plan's own constraints, unrelated to this plan's changes. No failures in `row-semantics.test.ts` or `styles.test.ts` (plan 20-10's in-flight files) were observed in this isolated worktree.
- Structural checks (node one-liners from the plan's own `<verify>` blocks): predicate exports, exactly 2 `shouldNavigateOnRowClick(` occurrences, exactly 1 `closest('a')`, zero `auxclick`/`keydown`/`tabindex`, predicate body considers all 7 `RowClickContext` fields — all passed.
- `git status --porcelain src` — after each task, listed only `row-navigation.ts` and `row-navigation.test.ts` (Task 2/3) or was empty (Task 1, doc-only).

## What This Does NOT Prove

Per the plan's own constraint (no DOM, no browser in this repo's test environment): the DOM plumbing inside `attachRowNavigation` — `closest('a')`, `window.getSelection()`, the `addEventListener` wiring itself — is not automatically provable by any test here. It is proven by (a) the source-structure wiring assertions added in this plan (delegation count, field reads, guard counts) and (b) the Round 3 human checkpoint rows in plan 20-11 covering modifier-click, Shift/Alt-click, middle-click and drag-select on the Records PR table. The module header and `row-navigation.test.ts`'s header comment both state this explicitly, per the plan's instruction not to overstate coverage.

## Self-Check: PASSED

- FOUND: src/dashboard/row-navigation.ts
- FOUND: src/dashboard/row-navigation.test.ts
- FOUND: .planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md (D-12 present)
- FOUND commit 89dc391 (docs D-12)
- FOUND commit f94dda3 (test RED)
- FOUND commit 89d1b48 (feat GREEN)
