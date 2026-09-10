---
phase: 28-pr-plausibility-ceiling
plan: 01
subsystem: analytics
tags: [best-efforts, pr-ceiling, calibration, riegel, non-circularity]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "D-02 anti-quota rule (threshold tuned to a target count is a quota, not a claim), D-03 classifier-independent recount discipline"
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "distance-advance-interval medians (2s/16s/24s/60s) used to justify the mechanism-clean >=5000m partition"
provides:
  - "CEILING_K = 1.28 and CEILING_MIN_POPULATION = 100, both measured live and mechanism-derived (never chosen to hit a target demotion count)"
  - "scripts/compute-pr-ceiling-calibration.mjs — 8 pure functions plus report/render/write, importable side-effect-free"
  - "28-CEILING-CALIBRATION.md — the committed, regenerated, proven-idempotent evidence record plan 28-03 cites by section"
affects: [28-02, 28-03, 28-04, 28-05, 28-06, 28-07, 28-08, 28-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nearest-rank (interpolation-free) percentile for byte-reproducible archive statistics"
    - "Mechanism-clean/vulnerable partition by target distance (>=5000m), independent of any measured ratio"
    - "Order-statistic-derived population floor (n - ceil(0.9n) >= k), computed not hard-coded"

key-files:
  created:
    - scripts/compute-pr-ceiling-calibration.mjs
    - scripts/compute-pr-ceiling-calibration.test.mjs
    - .planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md
    - .planning/phases/28-pr-plausibility-ceiling/deferred-items.md
  modified:
    - package.json

key-decisions:
  - "CEILING_K derived from 10k (the mechanism-clean, floor-eligible distance with the largest max/p90 ratio), not from an illustrative value discussed in planning"
  - "Reported the archive drift against 28-CONTEXT.md's cited table explicitly rather than silently matching or ignoring it"

patterns-established:
  - "Calibration scripts read the live archive fresh each run and reconcile against any previously-recorded reference table by naming the drift and its likely cause, never absorbing it silently"

requirements-completed: [PR-02, PR-05]

# Metrics
duration: ~20min
completed: 2026-09-10
---

# Phase 28 Plan 01: PR Ceiling Calibration Summary

**Measured CEILING_K = 1.28 (argmax 10k, max/p90 = 1.2713) and CEILING_MIN_POPULATION = 100 (order-statistic floor) live against the current archive, recorded with full evidence in a proven-idempotent `28-CEILING-CALIBRATION.md`, and surfaced a real 2026-09-08 archive drift that the original planning discussion's reference numbers had gone stale against.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 5 (2 created scripts, 1 generated artifact, 1 new deferred-items log, 1 package.json line)

## Accomplishments

- `scripts/compute-pr-ceiling-calibration.mjs` exports 8 side-effect-free pure functions (`buildFilteredPopulations`, `nearestRankPercentile`, `describeDistribution`, `partitionMechanismClean`, `deriveMinimumPopulation`, `deriveCeilingMultiplier`, `applyCeiling`, `compareRiegelGate`) plus `buildCalibrationReport`/`renderCalibrationMarkdown`/`main()`.
- Live-measured `CEILING_K = 1.28`: the largest `max/p90` ratio among the mechanism-clean (`TARGET_METERS >= 5000`), floor-eligible distances is 10k's 1.2713, rounded up. 400m/1k/1mi (mechanism-vulnerable) never enter the candidate set regardless of how extreme their own ratios are — proven structurally in the test suite by injecting a `1e9` m/s ratio at 400m and confirming `k` and `argmaxDistance` are unchanged.
- Live-measured `CEILING_MIN_POPULATION = 100`: the smallest `n` such that `n - Math.ceil(0.9n) >= 10`. Half-marathon's live population (n=104) clears the floor and keeps its own ceiling; marathon (n=0) fails open onto the existing world-record/max_speed guard alone — both consequences stated explicitly in the artifact.
- **Archive drift found and reported, not silently absorbed:** live per-distance `n` is 1-7 lower than `28-CONTEXT.md`'s cited 2026-09-10 table across every distance. Root cause traced: `data/best-effort-exclusions.json` (git-tracked) already carried a curation-tickbox exclusion of activity `4556693525` (D-04's own pinned regression case) and five other "bad measurement" activities, committed 2026-09-08 — two days before this session — while `data/stats/best-efforts.json` (gitignored, locally regenerated) evidently had not been refreshed since before that commit when the planning discussion's reference table was drawn. This run reads the freshly regenerated, live archive.
- **D-03 consequence measured live:** the 400m ceiling is 5.1098 m/s (78.3s), demoting 8 of the *current* top 10 (population n=1825) — not a full emptying, because the archive drift above already removed several of the fastest (and most implausible) 400m efforts from the population before this ceiling ever ran. This reportable consequence of the drift is disclosed explicitly in the artifact, not smoothed over.
- Percentile self-defeat re-measured live (never copied): p99.5 demotes 9/10 of the top-10 at 400m, 1k and 1mi, 8/10 at 5k, 7/10 at 10k, 0/10 at half — confirming the same mechanism-clean-tail-cutting problem the plan's own rationale describes, on the current archive.
- Riegel cross-distance gate measured as reported evidence only (never fed back into K derivation): 5k/10k/half all show zero Riegel-only demotions against the shipped ceiling; half shows 1 Riegel-only demotion, the one concrete measurement that would reopen the ratio-to-bulk-vs-Riegel question.
- `28-CEILING-CALIBRATION.md` proven regenerable byte-identical by an actual second run (`diff` on both runs with the `**Generated:**` line stripped returned zero lines both times this was checked).
- 15 unit tests across 7 `describe` blocks cover the interpolation-free percentile, the non-circularity population filter (proving `rankings` is never read for membership), the data-independent mechanism partition, the minimality of the population floor, the anti-quota structural proof for K, `applyCeiling`'s exact-boundary retention and fail-open behavior, and `renderCalibrationMarkdown`'s purity.

## Task Commits

1. **Task 1: Calibration script — per-distance distributions, mechanism-clean partition, and the K derivation** - `13b3f060` (feat)
2. **Task 2: Generate 28-CEILING-CALIBRATION.md and prove it regenerates identically on a second run** - `e1d6aa4e` (feat)
3. **Task 3: Unit-test the pure calibration functions, including the anti-quota and determinism properties** - `2589a7ad` (test)

## Files Created/Modified

- `scripts/compute-pr-ceiling-calibration.mjs` - the calibration measurement, report builder, markdown renderer, and CLI entrypoint
- `scripts/compute-pr-ceiling-calibration.test.mjs` - 15 tests, 7 describe blocks, over the pure functions only
- `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` - the committed, regenerable evidence record
- `.planning/phases/28-pr-plausibility-ceiling/deferred-items.md` - logs 6 pre-existing, out-of-scope test failures found in this fresh worktree
- `package.json` - registered `compute-pr-ceiling-calibration` script (exactly one added line)

## Decisions Made

- **CEILING_K derived from 10k, not an illustrative planning-time value.** D-01 delegated the choice to measurement; the mechanism-clean, floor-eligible argmax on the live archive is 10k (ratio 1.2713 → K=1.28), not the 1.35/1.50 figures used illustratively during the planning discussion for diff-blast-radius examples. No demotion count influenced this — `deriveCeilingMultiplier` structurally cannot see one.
- **Archive drift reported explicitly rather than reconciled by re-fetching or editing the reference table.** Per D-13's idempotence discipline and the plan's own "drift is reported, never silently absorbed" instruction, the calibration artifact states the live vs. `28-CONTEXT.md` numbers side by side with a named, evidence-based hypothesis for the cause (stale gitignored `data/stats/` vs. an already-committed exclusion-list update), rather than silently treating either number as authoritative.
- **D-03's "the 400m table empties" was tested against the true live population, not asserted.** The honest result — 8 of 10, not 10 of 10 — is stated with numbers rather than forced to match the discussion's anticipated near-total emptying, which itself depended on a since-changed population.

## Deviations from Plan

None (Rules 1-3) beyond routine execution. One scope-boundary item logged, not fixed:

### Out-of-Scope, Logged (not a deviation, not fixed)

Six pre-existing `npx vitest run` failures in this fresh worktree, in files this plan never touches (`scripts/verify-dashboard-publish-stats.test.mjs`, `src/dashboard/views/records-logic.test.ts`, `src/dashboard/views/trends-gear-logic.test.ts`, `src/dashboard/views/trends-training-load-logic.test.ts`, `src/dashboard/views/trends-yoy-logic.test.ts`, `src/dashboard/views/trends-zoom-logic.test.ts`) — caused by missing gitignored `data/stats/*.json` documents this plan does not generate, and a missing `node_modules/chartjs-plugin-zoom` dist file. Logged in `deferred-items.md` per the scope boundary rule; `scripts/compute-pr-ceiling-calibration.test.mjs` itself passes 15/15 and `tsc --noEmit` is clean.

## Issues Encountered

Generating the two input documents locally (`npm run compute-best-efforts`, `npm run compute-dashboard-index`) surfaced that this worktree's freshly-regenerated `data/stats/best-efforts.json` reflects a git-tracked exclusion-list update from 2026-09-08 that the planning session's own reference table apparently did not (see Decisions Made above). Resolved by measuring and reporting live, per the plan's explicit instruction, rather than treating this as a bug to fix.

## Next Phase Readiness

`CEILING_K = 1.28` and `CEILING_MIN_POPULATION = 100` are ready for plan 28-03 to hard-code with a citation to `28-CEILING-CALIBRATION.md`'s "Chosen constants" section, per this plan's `key_links` contract (`CEILING_K` pattern match). No production code was touched by this plan. The archive-drift finding is worth carrying into 28-03/28-04's own measurements, since any plan that cites specific live counts (e.g., demotion totals for the archive-wide diff, PR-04/D-12) should re-measure fresh rather than reuse this plan's or 28-CONTEXT.md's numbers verbatim.

**REQUIREMENTS.md left untouched (PR-02/PR-05 stay Pending):** this plan's frontmatter names PR-02 and PR-05 as the requirements it feeds, but neither is actually satisfied yet — PR-02 requires the ceiling to be *derived and applied* in the production pipeline (still `src/analytics/best-effort-ceiling.ts` and `compute-best-efforts.ts`'s restructuring, plan 28-03+), and PR-05 requires a shipped regression test rejecting activity 4556693525 (no source code for the ceiling exists yet). Ticking either now would repeat the project's own documented anti-pattern of premature requirement completion (see STATE.md's "verification-after-requirement-tick" note). Left for whichever later plan actually wires the ceiling into production and ships the regression fixture.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-10*

## Self-Check: PASSED

All created files verified present on disk (`scripts/compute-pr-ceiling-calibration.mjs`,
`scripts/compute-pr-ceiling-calibration.test.mjs`, `28-CEILING-CALIBRATION.md`,
`deferred-items.md`, this summary). All three task commits (`13b3f060`, `e1d6aa4e`, `2589a7ad`)
confirmed present in `git log --oneline --all`. No missing items.
