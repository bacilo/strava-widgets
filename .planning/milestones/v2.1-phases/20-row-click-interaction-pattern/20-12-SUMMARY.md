---
phase: 20-row-click-interaction-pattern
plan: 12
subsystem: ui
tags: [vitest, tdd, regression-fix, accessibility, wcag]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: plan 20-11's Round 3 gap-closure checkpoint that surfaced the NEW CRITICAL this plan closes (notedActivityId leak, list.ts:1112-1131)
provides:
  - takeNotedActivityId() — the one-shot return-hint's sole read-and-consume writer, unconditional by construction
  - applyReturnHighlight(notedId, ...) — exported, pure with respect to module state, taking the consumed id as its first parameter
  - mount() consuming the hint as its first statement, before loadIndex() is awaited, so all four render-branch exits spend it
  - a four-case behavioural regression suite plus a five-assertion source-structure wiring guard (including a blind-spot proof) pinning the fix
affects: [20-row-click-interaction-pattern gap-closure round 4, any future list.ts mount() refactor]

# Tech tracking
tech-stack:
  added: []
  patterns: [read-and-consume module-state helper (single writer, unconditional call site), source-structure wiring guard with a blind-spot proof against the pre-fix shape]

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - .planning/phases/20-row-click-interaction-pattern/deferred-items.md

key-decisions:
  - "Moved the consume call site to the top of mount(), above the try that awaits loadIndex(), rather than 20-REVIEW.md's drafted placement after the stale-container guard — that placement would still leak the load-failure branch, which returns before reaching it. Recorded as a deviation per the plan's own deviation_from_the_review block."
  - "Logged a third stripComments copy (views/list.test.ts, alongside row-semantics.test.ts and row-navigation.test.ts) against WR-04 in deferred-items.md rather than extracting a shared test-utils module — that extraction is out of this gap-closure round's scope."

patterns-established:
  - "Read-and-consume module state: a function that reads a module-scoped variable and clears it to null in the same call is the only writer of the null value, making leaks structurally impossible rather than relying on every caller remembering to clear it."

requirements-completed: [UX-01, UX-03]

# Metrics
duration: ~12min
completed: 2026-08-17
---

# Phase 20 Plan 12: Fix the return-highlight one-shot hint leak (CR-01) Summary

**Unconditional read-and-consume for the return-from-detail highlight hint — `takeNotedActivityId()` is now the sole writer of `notedActivityId = null`, called as the first statement of `mount()` before `loadIndex()` can reject, so no render branch (zero-match, load-failure, stale-container, normal) can leak the hint into a later, unrelated navigation and steal keyboard focus there.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-17T20:29Z (approx, first commit)
- **Completed:** 2026-08-17T20:31Z (approx, last commit)
- **Tasks:** 3 completed
- **Files modified:** 3 (list.ts, list.test.ts, deferred-items.md)

## Accomplishments
- Closed the CRITICAL regression `20-VERIFICATION.md` recorded: `applyReturnHighlight` no longer reads or clears module state itself; `takeNotedActivityId()` is the single, unconditional consumer.
- `mount()` now consumes the hint as its very first statement, before the `try` that awaits `indexClient.loadIndex()` — all four exits (load-failure return, stale-container return, zero-match branch, normal render) spend the one-shot hint exactly once.
- Four-case behavioural regression suite (happy path, empty-filter leak, load-failure/stale-container leak, and a parameterisation-pinning case) plus a five-assertion source-structure wiring guard with a blind-spot proof that the guard actually catches the pre-fix shape, not merely describes the desired one.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the leak regression test and prove it RED** - `a237285` (test)
2. **Task 2: Make the consume unconditional in list.ts and turn the suite green** - `7c70290` (feat)
3. **Task 3: Source-structure guard pinning the unconditional call site** - `0fc3b7a` (test)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode — this executor does not write STATE.md/ROADMAP.md).

## Files Created/Modified
- `src/dashboard/views/list.ts` - `takeNotedActivityId()` added (sole `notedActivityId = null` writer); `applyReturnHighlight` exported and made state-free, taking `notedId` as its first parameter; `mount()` consumes the hint as its first statement, above the `try` that awaits `loadIndex()`
- `src/dashboard/views/list.test.ts` - four-case behavioural regression suite for the leak sequence, plus a source-structure wiring guard (five assertions including a blind-spot proof) with a local `stripComments` copy and its four self-tests
- `.planning/phases/20-row-click-interaction-pattern/deferred-items.md` - `## Plan 20-12` section logging the third `stripComments` copy against WR-04

## Decisions Made
- Call site moved above the `try`/`loadIndex()` await rather than after the stale-container guard (20-REVIEW.md's drafted placement), because the load-failure branch returns before that guard is ever reached and would still leak. This is the plan's stated, pre-approved deviation from the review — not a new architectural decision, so no Rule 4 checkpoint was needed.
- Consuming the hint on a stale or failed render was treated as the intended semantic (per the plan's `deviation_from_the_review` block), not a loss — the hint is one-shot by definition.

## Deviations from Plan

None beyond the plan's own pre-recorded `deviation_from_the_review` (call site placed above the `try` rather than after the stale-container guard, as instructed by the plan itself). No Rule 1-4 auto-fixes were needed — the plan's action blocks were followed as written.

## Issues Encountered
None. RED confirmed cleanly in Task 1 (4 failing tests, `TypeError: ... is not a function` on the two missing exports, `list.ts` untouched); GREEN confirmed cleanly in Task 2 (all 47 tests passing, `row-semantics.test.ts` unaffected, `tsc --noEmit` clean, plan's node structural-guard script passing); Task 3's wiring guard and blind-spot proof passed on first write.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This closes the CRITICAL blocker recorded in STATE.md against Phase 20's round 4 gap closure (`notedActivityId leaks past mount()'s zero-match / load-error / stale-container branches, stealing focus on an unrelated navigation`). D-01 and D-02 remain upheld as constraints — `list.ts` gained no `tabindex`, no `role`, and no `keydown` handler; `row-semantics.test.ts` stays green (33/33 passing). The other round-4 blocker (R18/R19 — modified clicks on anchor-less Records PR cells) is out of this plan's scope and remains open for a separate plan in the same gap-closure round.

## Threat Flags

None — this plan's threat register (T-20G4-P12-01..05) is fully addressed by the shipped Task 1/Task 3 tests; no new network, auth, file-access, or schema surface was introduced. No `jsdom`/`happy-dom`/`puppeteer`/`playwright` dependency was added.

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts
- FOUND: src/dashboard/views/list.test.ts
- FOUND: .planning/phases/20-row-click-interaction-pattern/deferred-items.md
- FOUND: .planning/phases/20-row-click-interaction-pattern/20-12-SUMMARY.md
- FOUND commit: a237285 (test(20-12): add failing regression test for CR-01 return-hint leak)
- FOUND commit: 7c70290 (feat(20-12): make the one-shot return-hint consume unconditional)
- FOUND commit: 0fc3b7a (test(20-12): pin the unconditional consume with a source-structure guard)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-17*
