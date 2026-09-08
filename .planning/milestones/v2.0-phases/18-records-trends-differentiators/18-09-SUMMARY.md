---
phase: 18-records-trends-differentiators
plan: 09
subsystem: analytics, ui
tags: [riegel, race-prediction, records-page, pure-functions, vitest, superlatives]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    plan: 02
    provides: AgeGradingDocument contract consumed for the PR-table age-grade join
provides:
  - src/analytics/riegel.ts — Riegel prediction, guarded log-log OLS fit, prediction matrix
  - src/dashboard/views/records-logic.ts — PR table rows, evolution series, progression tables, superlatives
affects: [18-10, 18-11, 18-12 (Records page rendering consumes both modules)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Distinct-activityId guard via Set, never row-count, for any statistic that could be an artifact of splits within one activity (REC-07/D-11)"
    - "Own-property, __proto__-safe tolerant parsing of unknown JSON payloads for every records-logic entry point (buildExclusionReasonIndex, selectSuperlatives) — mirrors trends-yoy-logic.ts's parseYearOverYear discipline"
    - "Explicit empty-state/absence sentinels (isEmptyRanking, null agePercent, present-but-zero currentStreak tile) rather than inline length checks or fabricated zeros"

key-files:
  created:
    - src/analytics/riegel.ts
    - src/analytics/riegel.test.ts
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
  modified: []

key-decisions:
  - "currentStreak live-archive test value updated from the plan's predicted (0, inactive) to the actual (2, active) observed when this plan executed — the archive gained two consecutive training days since the plan was written. Per the plan's own instruction ('update the expected value and record the change in the summary rather than loosening the assertion to an inequality'), the test asserts the real live values and documents the change here rather than weakening to an inequality. The zero-day/absent-vs-zero guarantee (T-18-HONEST-02) is still pinned directly via a synthetic zero-value fixture in the same test file, independent of which state the live archive happens to be in on any given day."
  - "buildProgressionRows derives each row's startDate via new Date(point.x).toISOString() rather than carrying a separate raw startDate field through EvolutionPoint — EvolutionPoint's x (epoch-ms) is already the authoritative instant per the plan's own type contract, so round-tripping it to ISO is lossless and avoids threading a second date representation through the series."

patterns-established:
  - "Riegel fit-point selection (selectFitPoints): rank-1 entries only, one per non-empty ranking — documented in the source as the smallest UI-nameable subset, matching D-11's requirement that the fitted table state which distances backed it"

requirements-completed: [REC-02, REC-03, REC-05, REC-07]

# Metrics
duration: 45min
completed: 2026-08-11
---

# Phase 18 Plan 09: Records Page Logic — Riegel Predictions & PR Data Transforms Summary

**Two pure, DOM-free modules: `riegel.ts` (prediction formula + a fitted exponent that self-suppresses unless ≥3 distinct activities back it, guarding against this archive's real single-run-splits artifact) and `records-logic.ts` (PR table rows, evolution series/progression, and superlative tiles) — 34 tests total, several pinned against the live regenerated archive.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- `fitRiegelExponent`'s distinct-`activityId` guard is provably load-bearing: the mandated mutation check (row-count instead of distinct-activity-count) was run live and produced a fabricated exponent (`b = 1.0322825519488372`) from what is actually a single run's internal splits — exactly the failure mode D-11 exists to prevent. Reverted and confirmed green afterward.
- Ran the live fit against the freshly rebuilt archive: `selectFitPoints`/`fitRiegelExponent` over `data/stats/best-efforts.json` produced **6 points across 4 distinct activities**, fitted exponent **b = 1.1935142631296778** (CONTEXT.md predicted a value near 1.206 — same order of magnitude, correctly clear of the textbook 1.06 range, confirming a real personal fatigue-curve signal rather than an artifact).
- `buildEvolutionSeries` against the live archive produced per-distance step counts of 400m 11, 1k 11, 1mi 14, 5k 21, 10k 16, half 6, marathon 0 — **79 total**, matching CONTEXT.md's predicted 6-21-per-distance / 78-79-total range exactly.
- `records-logic.ts` never fabricates a zero: a missing age-grade is `null`, and a genuinely zero-day current streak still produces a tile — confirmed both against the live archive (which today shows `currentStreak: 2, active: true`) and a synthetic zero-value fixture in the same test.
- Marathon's empty ranking (D-05) is asserted directly against the live regenerated `best-efforts.json`, not only a fixture.

## Task Commits

1. **Task 1: Riegel prediction, guarded fit, and the prediction matrix** - `81c9799` (feat)
2. **Task 2: PR table rows, evolution series, progression tables, and superlatives** - `4d4b3ad` (feat)
3. **Task 3: Test the Records logic against fixtures and the live archive** - `c1fb361` (test)

_No plan-metadata commit yet — this is a worktree-mode executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `src/analytics/riegel.ts` - `RIEGEL_STANDARD_B`, `riegelPredict`, `fitRiegelExponent` (the D-11 distinct-activityId guard, documented in-source with the concrete `7827165619` archive example), `selectFitPoints`, `buildRiegelMatrix`
- `src/analytics/riegel.test.ts` - 12 tests: the live-archive suppression scenario, distinct-activity counting, synthetic-b recovery accuracy, degenerate inputs, `riegelPredict` edge cases, matrix row/column exclusion
- `src/dashboard/views/records-logic.ts` - `buildExclusionReasonIndex`, `buildPrTableRows`, `isEmptyRanking`, `buildEvolutionSeries`, `buildProgressionRows`, `selectSuperlatives`, `evolutionCardSummary`
- `src/dashboard/views/records-logic.test.ts` - 22 tests: marathon empty state (live-pinned), age-grade join/null-never-zero, exclusion reason surfacing + `__proto__` safety, `lowConfidence` passthrough, evolution series ordering/PR-only filter, progression sign convention, `evolutionCardSummary` live-pinned, `selectSuperlatives` live-pinned (`longestStreak.days === 31`) and null/malformed-tolerant

## Decisions Made

- **`currentStreak` live value diverged from the plan's prediction between planning and execution.** See key-decisions above — asserted the real observed values (`2`, `active: true`) rather than loosening the test, and kept the zero-day/absence-distinction guarantee pinned via an independent synthetic fixture.
- **`ProgressionRow.startDate` derived from `EvolutionPoint.x` via `toISOString()`** rather than threading a second raw-string date field through the series — see key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two records-logic.ts comments to avoid tripping their own acceptance-criteria greps**
- **Found during:** Task 2 verification
- **Issue:** Task 2's acceptance criteria require `grep -cE "document\.|window\.|new Date\(\)|fetch\(" src/dashboard/views/records-logic.ts` and `grep -cE "TimeScale|chartjs-adapter" src/dashboard/views/records-logic.ts` to both return `0`. The module's own header comment (documenting what it deliberately avoids) and the `EvolutionPoint.x` field comment both quoted the literal forbidden strings (`` `new Date()` ``, `` `document. ``, `` `fetch( ``, `` `TimeScale` ``) as part of explaining the constraint, tripping both greps to `1`.
- **Fix:** Reworded both comments to convey the same constraint without repeating the exact literal substrings the greps check for (mirrors the identical fix documented in plan 18-04's summary for `chart-theme.ts`/`styles.css`).
- **Files modified:** `src/dashboard/views/records-logic.ts`
- **Verification:** Re-ran both grep checks after the edit; both now return `0`. `npm run build` re-run clean afterward.
- **Committed in:** `4d4b3ad` (fix landed before the task's commit, no separate follow-up commit)

---

**Total deviations:** 1 auto-fixed (1 bug-class, Rule 1)
**Impact on plan:** Purely a comment-wording fix to satisfy the plan's own literal acceptance-criteria greps; no functional or behavioral change. No scope creep.

## Issues Encountered

None beyond the documented deviation above. `data/geo/geo-metadata.json`'s `generatedAt` timestamp was incidentally touched by running `compute-all-stats` to regenerate the live `data/stats/*.json` fixtures the plan's live assertions require; this out-of-scope side effect was reverted with `git checkout -- data/geo/geo-metadata.json` before committing, since it is not part of this plan's file list.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/analytics/riegel.ts` and `src/dashboard/views/records-logic.ts` are ready to be consumed by the Records page rendering plan(s) (18-UI-SPEC § 2/§ 3/§ 4a/§ 4b): every table row, evolution point, progression row, superlative tile, and Riegel matrix cell the page needs is already a tested, DOM-free function.
- The guard that suppresses a physiologically meaningless fitted exponent is proven load-bearing via a live mutation check, not just asserted in a comment.
- No blockers identified for downstream plans in this phase.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 claimed files verified present on disk (`src/analytics/riegel.ts`, `src/analytics/riegel.test.ts`, `src/dashboard/views/records-logic.ts`, `src/dashboard/views/records-logic.test.ts`, this SUMMARY.md). All 4 commits (`81c9799`, `4d4b3ad`, `c1fb361`, `55d27b1`) confirmed present in `git log --oneline --all`.
