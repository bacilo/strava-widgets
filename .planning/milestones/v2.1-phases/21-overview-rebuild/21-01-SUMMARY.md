---
phase: 21-overview-rebuild
plan: 01
subsystem: analytics
tags: [typescript, vitest, streak-computation, records-view, data-contract]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: stable records.ts / records-logic.ts module boundary this plan extends
provides:
  - "`StreakResult.currentStreakEnd: Date | null` — the streak's last run day, set unconditionally regardless of active/ended state"
  - "`StreakData.currentStreakEnd: string` — the serialized JSON contract in `data/stats/streaks.json`"
  - "`selectCurrentStreak` deriving `endedISO` from `currentStreakEnd` instead of the wrong `currentStreakStart` field"
affects: [21-05-records, 21-06-overview, 21-07-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unconditional 'end' field precedent (`longestStreakEnd`) extended to `currentStreakEnd` — an ended state still names its end day, only the 'active' derived field is what nulls"
    - "Tolerant-parse discriminator: a new optional field is read through a `typeof x === 'string'` guard and deliberately excluded from the required-field `hasOwn` gate, so an old JSON shape degrades one sub-label rather than an entire tile"

key-files:
  created: []
  modified:
    - src/analytics/streak-utils.ts
    - src/analytics/streak-utils.test.ts
    - src/types/analytics.types.ts
    - src/analytics/compute-advanced-stats.ts
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts

key-decisions:
  - "D-12 layer 1 and layer 2 both land in this single plan (producer + consumer) so no wave can ship layer 1 alone and leave a plausible-but-wrong start-date sub-label rendering"
  - "currentStreakEnd is NOT added to selectCurrentStreak's required-field hasOwn guard — widening it would drop the whole Current Streak tile for any pre-phase streaks.json instead of degrading only the sub-label (D-13)"

patterns-established:
  - "Two-distinct-dates Pitfall-1 discriminator: a fixture carrying both currentStreakStart and currentStreakEnd with different values, asserting the correct field's value AND asserting inequality against the wrong field's value — the only assertion shape that distinguishes a correct fix from a plausible wrong one"

requirements-completed: [FIX-01]

# Metrics
duration: ~15min
completed: 2026-08-18
---

# Phase 21 Plan 01: Streak currentStreakEnd producer/consumer fix Summary

**`currentStreakEnd` flows unconditionally from `calculateDailyStreaks` through `StreakData`/`compute-advanced-stats` into `streaks.json`, and `selectCurrentStreak` now reads it instead of the wrong `currentStreakStart` field for the Records "ended {date}" sub-label.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments
- `StreakResult` and `StreakData` both gained `currentStreakEnd`, populated from the existing `lastActivityDate` local and set unconditionally (mirrors the `longestStreakEnd` precedent) — the streak's last run day is now nameable even after the streak has ended.
- `compute-advanced-stats.ts` serializes `currentStreakEnd` into `streaks.json` using the same ternary-to-empty-string idiom as `longestStreakEnd`.
- `selectCurrentStreak` in `records-logic.ts` now derives `endedISO` from `currentStreakEnd` instead of the buggy `currentStreakStart` read, closing FIX-01's two-layer defect (D-12) in one plan so neither layer ships alone.
- `records.ts:291-303` (the DOM rendering of the sub-label) needed zero changes — it was already correct against `endedISO`; only the value flowing into it was wrong.

## Task Commits

Each task was committed atomically:

1. **Task 1: Produce and serialize currentStreakEnd (D-12 layer 1, D-13)** - `8acb9bc` (feat)
2. **Task 2: selectCurrentStreak reads currentStreakEnd (D-12 layer 2)** - `891286b` (fix)

**Plan metadata:** committed separately per worktree-mode convention (SUMMARY.md only; STATE.md/ROADMAP.md updates deferred to orchestrator)

## Files Created/Modified
- `src/analytics/streak-utils.ts` - `StreakResult.currentStreakEnd` added; `calculateDailyStreaks` sets it unconditionally from `lastActivityDate`
- `src/analytics/streak-utils.test.ts` - empty-array `toEqual` literal updated; new active-streak and ended-streak cases added, the latter with the discriminator that `currentStreakEnd` is the END day, not the start day
- `src/types/analytics.types.ts` - `StreakData.currentStreakEnd: string` added, sibling to `currentStreakStart`
- `src/analytics/compute-advanced-stats.ts` - `streakData` literal serializes `currentStreakEnd` via the ternary-to-empty-string idiom
- `src/dashboard/views/records-logic.ts` - `selectCurrentStreak` destructures `currentStreakEnd` instead of `currentStreakStart`; JSDoc updated to explain why the required-field guard is not widened
- `src/dashboard/views/records-logic.test.ts` - new `describe('selectCurrentStreak — FIX-01 endedISO comes from currentStreakEnd, not currentStreakStart (D-12 layer 2)')` with four cases (two-distinct-dates discriminator, absent-key degrade, empty-string degrade, active-branch-wins)

## Decisions Made
- Both layers of D-12 (producer in `streak-utils.ts`/`compute-advanced-stats.ts`, consumer in `records-logic.ts`) were implemented in this single plan per the plan's own objective — splitting them across waves would risk shipping a plausible-but-wrong start-date sub-label if only layer 1 landed.
- `currentStreakEnd` was kept out of `selectCurrentStreak`'s required-field `hasOwn` guard by design (D-13): the existing `typeof currentStreakEnd === 'string'` check already yields `false` for an absent key, so a pre-phase `streaks.json` (which has no `currentStreakEnd` key until the next compute run) still renders the tile — only the sub-label degrades to `null`.
- `finalCurrentStreak`'s `withinCurrentStreak ? currentStreak : 0` ternary was left untouched (D-14): the tile's big number must keep reporting a real `0` for a broken streak, never silently swallowed.

## Deviations from Plan

None in source code — plan executed exactly as written for both tasks.

**One environment-only action outside the plan's file list:** the fresh git worktree this plan executed in does not carry gitignored, locally-generated `data/stats/` and `data/dashboard/` directories (git worktrees only materialize tracked files). `src/dashboard/views/records-logic.test.ts`'s live-file suite (`describe('selectSuperlatives — live data/stats files')`, pre-existing, not written by this plan) reads `data/stats/streaks.json` directly and failed with `ENOENT` before these directories were copied from the main checkout's local build artifacts (`cp -R` of the same gitignored, non-secret, machine-local generated JSON — no network calls, no git operation, nothing committed). This is a worktree-isolation artifact of the execution environment, not a code change, and required no deviation-rule classification since no plan file was touched to work around it.

## Issues Encountered

- The full `npm test` / `npx tsc --noEmit` / `npm run build-widgets` per-wave verification gate initially failed on the missing `data/stats/`/`data/dashboard/` directories described above; resolved by copying the same gitignored data from the main checkout, after which all 1086 tests, a clean typecheck, and a clean `build-widgets` all passed. No source code was affected.

## Next Phase Readiness
- The `StreakResult`/`StreakData`/`selectCurrentStreak` contracts this plan establishes are ready for plans 21-05 (Records) and 21-06 (Overview) to consume, per the plan's own `<interfaces>` block.
- `data/stats/streaks.json` will not carry a real `currentStreakEnd` value until the next `npm run compute-advanced-stats` or the nightly CI's `compute-all-stats` run — this is the expected degrade path Task 2 asserts, not a blocker. Plan 21-07's checkpoint is documented to use a staged-build fixture rather than waiting for that live regeneration.

## Self-Check: PASSED

- FOUND: .planning/phases/21-overview-rebuild/21-01-SUMMARY.md
- FOUND: 8acb9bc (Task 1 commit)
- FOUND: 891286b (Task 2 commit)
- FOUND: 12f816c (plan metadata commit)
