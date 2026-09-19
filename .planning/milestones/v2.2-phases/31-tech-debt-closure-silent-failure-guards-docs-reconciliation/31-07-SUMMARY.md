---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 07
subsystem: testing
tags: [vitest, node, reporting-generator, pr-ceiling, docs-reconciliation]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: "compute-pr-ceiling-calibration.mjs's buildFilteredPopulations/applyCeiling/renderCalibrationMarkdown pipeline and its pure-function test seam"
provides:
  - "largestAbsoluteDrift(reconciliation) — a data-derived selection replacing the WR-07 hard-coded '400m shows the largest drift' clause"
  - "countOwnerExcludedAboveCeiling(bestEffortsDoc, applied) — the WR-08 complement count that reconciles the calibration report's Demoted column against the pipeline's ceiling-demotion total"
  - "an updated renderCalibrationMarkdown whose largest-drift sentence and Demoted/Owner-excluded columns are both derived, never hard-coded"
affects: [31-08, 31-09, 31-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection-with-tie-break-and-zero-case pure helper (largestAbsoluteDrift), mirroring the project's existing describeDistribution/nearestRankPercentile determinism discipline"
    - "Partition-not-overlap complement counting (countOwnerExcludedAboveCeiling mirrors buildFilteredPopulations's own speed derivation and world-record/max-speed skip so the two counts sum without double-counting), following compute-pr-ceiling-diff.mjs's existing owner-excluded presentation"

key-files:
  created: []
  modified:
    - scripts/compute-pr-ceiling-calibration.mjs
    - scripts/compute-pr-ceiling-calibration.test.mjs

key-decisions:
  - "D-11 (WR-07): 400m curation-tickbox mechanism explanation is only rendered when 400m is actually the largest-drift distance; otherwise the sentence says the mechanism does not apply and points at archive growth as the more likely cause, rather than asserting a mechanism the data doesn't support."
  - "D-11/Claude's Discretion (WR-08): reconciliation via relabel + extra column + a reconciliation sentence stating the sum, mirroring compute-pr-ceiling-diff.mjs's 'Of which owner-excluded' presentation rather than inventing a new one."

requirements-completed: []  # TD-05 ticks in 31-10 only, per this plan's own tick rule — not here.

# Metrics
duration: 55min
completed: 2026-09-19
---

# Phase 31 Plan 07: WR-07/WR-08 calibration-generator fixes Summary

**Replaced the hard-coded "400m shows the largest drift" clause with a computed selection, and reconciled the calibration report's non-excluded "Demoted" column against the pipeline's owner-excluded ceiling total, both pinned by unit tests on hand-built reports — no ceiling/p90/multiplier/population arithmetic changed.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-19 (session start)
- **Completed:** 2026-09-19
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- **WR-07 fixed:** `largestAbsoluteDrift(reconciliation)` selects the distance with the greatest absolute drift from `report.reconciliation`, breaking ties by `TARGET_ORDER` position and returning `null` when every drift is zero. `renderCalibrationMarkdown`'s opening clause is now computed from this selection every run; the 400m-specific curation-tickbox mechanism paragraph is retained only when 400m is the named distance, and is replaced by an explicit non-assertion otherwise.
- **WR-08 fixed:** `countOwnerExcludedAboveCeiling(bestEffortsDoc, applied)` counts, per distance, `excludedFromRecords` efforts whose implied speed (`TARGET_METERS[distance] / durationSec`, same derivation as `buildFilteredPopulations`) exceeds that distance's already-derived ceiling, skipping world-record/max-speed-guarded efforts on the same terms. The "Resulting coverage and demotions" table's `Demoted` column is relabelled `Demoted (non-excluded)` and a new `Owner-excluded above ceiling` column sits beside it; a reconciliation sentence beneath the table states both totals, their sum, and that the sum is the figure `compute-pr-ceiling-recount.mjs --expect-demoted` checks.
- 14 new tests added (7 "largest drift", 7 "owner-excluded"); all 29 tests in the file pass; `npm test` (2564 tests, 84 files) and `npx tsc --noEmit` both exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive the largest-drift sentence from the data (WR-07)** - `92e7a9b7` (feat)
2. **Task 2: Make the Demoted column reconcile with the pipeline's ceiling total (WR-08)** - `12839a2f` (feat)

_No plan-metadata commit in worktree mode — the orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md after all wave agents return._

## Files Created/Modified

- `scripts/compute-pr-ceiling-calibration.mjs` - Added `largestAbsoluteDrift` and `countOwnerExcludedAboveCeiling` (both exported pure functions); wired `ownerExcludedAboveCeiling` into `buildCalibrationReport`'s returned report object; rewrote the largest-drift paragraph and the "Resulting coverage and demotions" table/reconciliation sentence in `renderCalibrationMarkdown`.
- `scripts/compute-pr-ceiling-calibration.test.mjs` - Added `describe('largestAbsoluteDrift and its rendered sentence (WR-07)', ...)` (7 tests), `describe('countOwnerExcludedAboveCeiling (WR-08)', ...)` (4 tests) and `describe('render: reconciled owner-excluded reconciliation (WR-08)', ...)` (3 tests); hoisted the existing `renderCalibrationMarkdown` test fixture to a module-level `SAMPLE_REPORT` constant so all three new describe blocks and the pre-existing `renderCalibrationMarkdown` describe block share one fixture; imported `TARGET_METERS` from `../dist/analytics/best-effort.types.js` for exact-speed fixture construction.

## Verbatim artifacts (per the plan's own Output spec)

**New drift sentence template** (`renderCalibrationMarkdown`, replacing the old hard-coded clause):
```
No distance drifted from `28-CONTEXT.md`'s quoted table in this run: every live n matches
its reference figure exactly, so no distance is named "largest" here.
```
when `largestAbsoluteDrift` returns `null`, otherwise:
```
**${drift.key}** shows the largest drift (${driftStr}, live n = ${driftEntry.liveN} vs
28-CONTEXT.md's ${driftEntry.referenceN}): the live population and its top-10 differ from
28-CONTEXT.md's quoted figures. ${mechanismSentence}
```
where `mechanismSentence` is the original 400m curation-tickbox explanation when `drift.key === '400m'`, or:
```
The curation-tickbox-exclusion mechanism recorded for 400m in an earlier run of this
report does not apply here: this run's largest drift falls at a different distance, so
no committed exclusion or regeneration-timing explanation is asserted for it. Continued
archive growth since `28-CONTEXT.md` was drafted is the more likely cause, stated as a
hypothesis, not a claim.
```
otherwise.

**New column headers** ("## Resulting coverage and demotions" table):
```
| Distance | Ceiling (m/s) | Ceiling (time) | Eligible | n | Demoted (non-excluded) | Owner-excluded above ceiling | Demoted of top 10 |
```

**Reconciliation sentence, verbatim template** (rendered once, beneath the table, using live totals):
```
Reconciliation, stated once so `${totalNonExcludedDemoted}` (this report's own "Demoted
(non-excluded)" column, summed) never looks like it disagrees with the pipeline's own count:
the filtered population `deriveCeilingMultiplier`/`applyCeiling` consult deliberately excludes
every owner-excluded effort (the population that DERIVES the ceiling must not be shaped by the
owner's own curation calls), so this report's demoted count alone is always narrower than the
pipeline's total. Adding back the ${totalOwnerExcludedAboveCeiling} owner-excluded effort(s)
also above the same ceiling (the "Owner-excluded above ceiling" column, summed) gives
${totalNonExcludedDemoted} + ${totalOwnerExcludedAboveCeiling} = ${totalCeilingDemotions}, the
figure the pipeline reports as its total ceiling demotions and the one
`compute-pr-ceiling-recount.mjs --expect-demoted` checks.
```

**Test match counts:**
- `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "largest drift"` → **7 passed, 0 failed**
- `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "owner-excluded"` → **7 passed, 0 failed**
- Full file: **29 passed** (15 before this plan, +14 new)

**Functions touched** (per the plan's "state the function names touched" acceptance criterion):
- `largestAbsoluteDrift` — new, exported
- `countOwnerExcludedAboveCeiling` — new, exported
- `buildCalibrationReport` — modified (wires `ownerExcludedAboveCeiling` into the returned report)
- `renderCalibrationMarkdown` — modified (largest-drift paragraph, Demoted/Owner-excluded table columns, reconciliation sentence)

No change touched `buildFilteredPopulations`, `deriveCeilingMultiplier`, `deriveMinimumPopulation`, or `applyCeiling` — every existing test for those functions is unmodified and still green (confirmed by the full 29-test pass).

## Decisions Made

- **WR-07 mechanism paragraph scope:** kept the original 400m curation-tickbox explanation verbatim only when 400m is the selected distance; wrote an explicit non-assertion for every other distance rather than generalizing the mechanism text to name an arbitrary distance, since the actual committed-exclusion mechanism described is specific to activity `4556693525` and 400m and would be false for any other distance.
- **WR-08 presentation:** relabel + extra column + one reconciliation sentence (Claude's Discretion, `31-CONTEXT.md`), mirroring `compute-pr-ceiling-diff.mjs`'s existing `Of which owner-excluded` column rather than inventing new vocabulary — though note the relationship here is *additive* (the two counts partition disjoint populations and sum to the pipeline total), unlike `compute-pr-ceiling-diff.mjs`'s own `demotedExcludedCount`, which is a *subset* of its `demotedCount`. The column header ("Owner-excluded above ceiling", not "Of which owner-excluded") reflects this difference so a reader is not misled into expecting a subset relationship.
- **Test fixture consolidation:** moved the pre-existing `sampleReport` local const out of the `renderCalibrationMarkdown` describe block to a module-level `SAMPLE_REPORT` constant so the two new render-level describe blocks (largest-drift, owner-excluded) could reuse it via `{ ...SAMPLE_REPORT, <override> }` without duplicating the ~80-line fixture. Verified safe: `it()` callback bodies only execute after the whole module has finished loading, so referencing `SAMPLE_REPORT` inside test bodies located earlier in the file is not a temporal-dead-zone hazard.

## Deviations from Plan

**1. [Rule 1 - Bug] Own documentation comment accidentally matched the acceptance-criteria grep**
- **Found during:** Task 1 verification
- **Issue:** The docblock for `largestAbsoluteDrift` originally quoted the literal string `'400m shows the largest drift'` to explain what it replaces, which made `grep -n "400m shows the largest drift" scripts/compute-pr-ceiling-calibration.mjs` (an explicit acceptance criterion) return a false-positive match against the comment, not the removed code.
- **Fix:** Reworded the comment to `"400m always shows the largest drift"` (paraphrased, not a verbatim substring match) so the grep only reflects the actual code state.
- **Files modified:** `scripts/compute-pr-ceiling-calibration.mjs`
- **Verification:** `grep -n "400m shows the largest drift" scripts/compute-pr-ceiling-calibration.mjs` now returns nothing (exit 1).
- **Committed in:** `92e7a9b7` (part of Task 1 commit)

**2. [Rule 3 - Blocking] Worktree's `dist/widgets/data/` was never populated, failing an unrelated pre-existing test**
- **Found during:** Task 2's `npm test` full-suite verification
- **Issue:** `scripts/verify-dashboard-publish-stats.test.mjs` failed with `ENOENT: ... dist/widgets/data/stats/best-efforts.json` because this worktree had never run `npm run build-widgets` (a one-time environment-setup gap, not a code defect — `data/activities/` and `data/streams/` are git-tracked and were already present via the worktree checkout itself).
- **Fix:** Ran `npm run build-widgets` once in this worktree (writes only to this worktree's gitignored `dist/`, reads only from the already-present `data/` tree — never touches the primary checkout or `data/`).
- **Files modified:** none (build output only, gitignored)
- **Verification:** `npm test` now reports 84/84 test files and 2564/2564 tests passed.
- **Committed in:** not applicable — build output is gitignored and untracked, confirmed via `git status --porcelain` showing no new entries.

---

**Total deviations:** 2 (1 auto-fixed comment wording, 1 environment build-step gap closed)
**Impact on plan:** No scope creep — both were required to make the plan's own stated acceptance criteria and verification commands pass as written.

## Issues Encountered

The `renderCalibrationMarkdown` output contains three separate markdown tables whose rows all begin with `| 400m |` (the per-distance distributions table, the "why not a percentile" table, and the "resulting coverage" table). Early test assertions using a bare `.startsWith('| 400m |')` line search matched the wrong table. Resolved by adding a second, more specific match condition (`.includes('| true | 1000 |')`, unique to the "resulting coverage" table's eligible rows) to the row-finder helper in the two affected tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both WR-07 and WR-08 findings are closed at the generator level, satisfying this plan's `must_haves.truths` (data-derived largest-drift sentence; reader-visible reconciliation of the Demoted column) without touching any ceiling/multiplier/percentile arithmetic. This unblocks 31-08's twice-regeneration pass of `28-CEILING-CALIBRATION.md` (D-11) — the regenerated artifact will now render a computed drift sentence and a reconciled Demoted/Owner-excluded table instead of the two 28-REVIEW findings. TD-05 itself is **not** ticked here per this plan's own tick rule (§ Output: "TD-05 tick rule: do NOT tick TD-05 here. It ticks only in 31-10, after the PR-04 Round 4 verdict.") — no requirement IDs are marked complete by this plan.

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: `scripts/compute-pr-ceiling-calibration.mjs`
- FOUND: `scripts/compute-pr-ceiling-calibration.test.mjs`
- FOUND: `.planning/phases/31-tech-debt-closure-silent-failure-guards-docs-reconciliation/31-07-SUMMARY.md`
- FOUND commit: `92e7a9b7` (Task 1)
- FOUND commit: `12839a2f` (Task 2)
