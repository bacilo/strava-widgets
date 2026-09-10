---
phase: 27-per-activity-quality-signals
plan: 02
subsystem: analytics
tags: [typescript, vitest, gap-classification, decimation, quality-signals]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-01's full ActivityQualitySignals type tree, resolveDeviceFamily, elapsedVsMovingSignal, notComputableSignals"
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "classifyGaps/quantile/advanceIntervals/adaptiveWindowSec in pace-derivation.ts, validateStreamSeries in best-effort-utils.ts, PINNED_FIXTURES/loadPinnedStream/loadPinnedActivity in pace-fixtures.ts, the 154-activity severe-decimation cohort rule"
provides:
  - "decimationSignal, gapProfileSignal, countImpossibleSamples, impossibleSampleSignal, hasAnySevereSignal, computePaceQualitySignals, buildPaceQualityShard — the complete pace-quality.ts algorithm layer"
  - "WORLD_RECORD_100M_SPEED_MPS exported from best-effort-utils.ts, replacing the undocumented 10.44 literal that circulated in comments and REQUIREMENTS.md"
  - "QualityThresholdOverrides — the one knob plan 27-03's calibration sweep turns for all three tiering signals"
  - "PaceQualityShard — the D-17 evidence-shard shape, ready for 27-04's CI writer"
affects: [27-03, 27-04, 27-05, 27-08, 27-09, 27-10]

tech-stack:
  added: []
  patterns:
    - "Shared-coverage split (resolveCoverage / tierGapProfileFromCoverage) so classifyGaps has exactly one call site in the module, reused by both gapProfileSignal and buildPaceQualityShard rather than two independent invocations"
    - "Raw, unsmoothed per-consecutive-pair detection with disclosed-not-subtracted correlation counters (countInsideZeroAdvanceRun), mirroring D-05/QUAL-02's device-era/decimation precedent applied to a second correlated pair"
    - "Every open threshold is an export const with a numbered, mechanism-first doc comment (what it measures, the mechanism argument, measured cohort at the cut and two neighbours, an explicit 'not chosen for 5%' sentence) — no threshold literal at any call site"

key-files:
  created: []
  modified:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - src/analytics/best-effort-utils.ts
    - src/analytics/best-effort-utils.test.ts

key-decisions:
  - "GAP_PROFILE_SEVERE_FRACTION = 0.2 (20% of a stream's own span in recording-gap+pause time), justified as the point past which 'a pace distribution describes the whole run' stops being true of the activity as a whole — a statement about one activity's own timeline, not tuned to the archive's size or to land under 5%"
  - "IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10 (raw count, not a fraction), justified as the point where 'isolated forgivable GPS glitch' stops being the more likely explanation than 'this stream's distance channel is broken'; measured overlap with the severe-decimation cohort at this cut is 4/31 (12.9%), far below the raw >=1 population's 90% overlap, because the >=10 cut already excludes the single-glitch population driving that 90% figure"
  - "The impossible-sample/decimation overlap is accepted and disclosed (countInsideZeroAdvanceRun, never subtracted from count), not engineered away — locked disposition from 27-RESEARCH.md Common Pitfall 3, option 1"
  - "classifyGaps is called from exactly one place in the source (a private resolveCoverage wrapper); gapProfileSignal and buildPaceQualityShard both route through it so the classifier never runs twice per activity and its gapIntervals result can't drift between the tier and the shard"

requirements-completed: [QUAL-01, QUAL-02, QUAL-05]

duration: ~55min
completed: 2026-09-10
---

# Phase 27 Plan 02: Tiering Signals, Composite Predicate, and the D-17 Evidence Shard Summary

**Implemented `decimationSignal`, `gapProfileSignal` and `countImpossibleSamples`/`impossibleSampleSignal` — the three severity-tiering signals — plus the single `hasAnySevereSignal` composite, the `computePaceQualitySignals` assembly entry point, and `buildPaceQualityShard`'s D-17 evidence shard, with both open thresholds (gap-profile 20%, impossible-sample raw count >=10) carrying a numbered mechanism-first justification and a measured archive-wide cohort.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 4 (`pace-quality.ts`, `pace-quality.test.ts`, `best-effort-utils.ts`, `best-effort-utils.test.ts`)

## Accomplishments

- `decimationSignal` reproduces `scripts/compute-pace-residual.mjs`'s exact rule (0.15 zero-advance fraction, 50-sample floor) using the same denominator, verified against the pinned `decimation-aliased` fixture (activity 5059204779) to within 0.005 of its recorded `zeroAdvanceFraction`.
- `gapProfileSignal` tiers `classifyGaps`'s `(recordingGapSec + pauseSec) / spanSec` with `GAP_PROFILE_SEVERE_FRACTION = 0.2`, whose doc comment carries the full four-element D-02 justification (what it measures, the mechanism argument, the measured cohort at the cut and two neighbours from the live archive, and an explicit "not chosen for 5%" statement).
- `countImpossibleSamples` is a raw, unsmoothed, per-consecutive-pair detector against `WORLD_RECORD_100M_SPEED_MPS` (newly exported from `best-effort-utils.ts`, replacing an undocumented 10.44 literal that circulated in comments and `REQUIREMENTS.md`'s cited cohort). `IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10` carries the full six-element justification the task required, including a measured overlap with the severe-decimation cohort re-derived against the live 1,865-stream archive at execution time (4/31, 12.9% — not the research's cited 90%, because the raw >=1 population and the >=10-cut population are different cohorts).
- `hasAnySevereSignal` is the single "any severe" composite definition, its JSDoc naming all four consumers (D-01's calibrated number, D-16's filter, 27-03's calibration report, 27-05's forbidden-from-importing recount) and explicitly permitting exactly one deliberate second implementation.
- `computePaceQualitySignals` and `buildPaceQualityShard` are both callable, total (never throw, T-26-01), and never partially fill an activity's signals. `classifyGaps` has exactly one call site in the module (`grep -rn "classifyGaps(" pace-quality.ts | wc -l` → 1), shared by both functions via a private `resolveCoverage`/`tierGapProfileFromCoverage` split.

## Task Commits

Each task was committed atomically:

1. **Task 1: Decimation and gap-profile tiering** - `f5571bc3` (feat)
2. **Task 2: The impossible-sample detector and its justified severe cut** - `cfd215b7` (feat)
3. **Task 3: Composite predicate, assembly entry point, and the D-17 evidence shard** - `7b6d9372` (feat)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/analytics/pace-quality.ts` — Added `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION`/`DECIMATION_SEVERE_MIN_SAMPLES`/`DECIMATION_MINOR_ZERO_ADVANCE_FRACTION`/`decimationSignal`, `GAP_PROFILE_SEVERE_FRACTION`/`GAP_PROFILE_MINOR_FRACTION`/`gapProfileSignal`, `countImpossibleSamples`/`IMPOSSIBLE_SAMPLE_MINOR_COUNT`/`IMPOSSIBLE_SAMPLE_SEVERE_COUNT`/`impossibleSampleSignal`, `QualityThresholdOverrides`, `hasAnySevereSignal`, `computePaceQualitySignals`, `PaceQualityShard`, `buildPaceQualityShard`, plus the private `resolveCoverage`/`tierGapProfileFromCoverage`/`computeZeroAdvanceRunProfile` helpers.
- `src/analytics/pace-quality.test.ts` — `decimation signal (D-04)`, `gap profile signal`, `impossible samples detector`, `independent signals (QUAL-02)`, and `D-17 evidence shard` describe blocks (52 tests total in the file).
- `src/analytics/best-effort-utils.ts` — `WORLD_RECORD_100M_SPEED_MPS = 10.44`, exported standalone from the per-target-distance `WORLD_RECORD_SPEED_MPS` map.
- `src/analytics/best-effort-utils.test.ts` — Assertion that adding `WORLD_RECORD_100M_SPEED_MPS` leaves `WORLD_RECORD_SPEED_MPS`'s own key set unchanged.

## Decisions Made

- **`GAP_PROFILE_SEVERE_FRACTION = 0.2`** — full justification (as required by `<output>`, quoted verbatim from the source doc comment):
  > (1) WHAT IT MEASURES: `(recordingGapSec + pauseSec) / spanSec`, straight from `classifyGaps` — the fraction of a stream's own recorded span in which no pace was actually measured.
  > (2) MECHANISM ARGUMENT: a pace distribution, a splits table, or a headline "average pace" figure all implicitly claim to describe the whole run. Once a FIFTH or more of the stream's own recorded span carries no measured pace at all, that claim stops being true of the activity as a whole. This argument does not depend on archive size.
  > (3) MEASURED COHORT AT THE CHOSEN CUT AND ITS TWO NEIGHBOURS (live archive): >15% → 197 activities (10.6%); >20% → 127 activities (6.8%, CHOSEN); >25% → 88 activities (4.7%).
  > (4) NOT CHOSEN TO LAND UNDER 5%: 20% was picked because "a fifth of the recorded span" is the mechanism argument, not because 6.8% is closer to a target than 4.7% is — 25% would in fact clear ~5% on this signal alone and was NOT chosen for that reason.

- **`IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10`** — full justification (quoted verbatim):
  > (1) THE PHYSICAL FLOOR AND ITS SOURCE: `WORLD_RECORD_100M_SPEED_MPS` (Usain Bolt's 100m world record, 9.58s, 2009). Exceeding it once is a fact ABOUT THE RECORDING, never about the runner.
  > (2) FORM: RAW COUNT, not a fraction — an impossible sample is a discrete EVENT, not a proportional descriptor of the whole stream's quality.
  > (3) MECHANISM ARGUMENT: a single impossible sample is unremarkable (GPS multipath, one decimation-collapsed tick); TEN independent readings is not what an occasionally-noisy but otherwise-functioning channel produces.
  > (4) MEASURED COHORT: >=5 → 71 activities (3.8%); >=10 → 31 activities (1.7%, CHOSEN); >=20 → 10 activities (0.5%).
  > (5) MEASURED OVERLAP WITH THE SEVERE-DECIMATION COHORT AT THE CHOSEN CUT: of the 31 activities at >=10, **4 (12.9%)** are also in the 154-activity severe-decimation cohort — re-measured against this file's own `decimationSignal` and `countImpossibleSamples` over the live 1,865-stream archive on 2026-09-10, via a throwaway measurement script (not the research document's cited 139/154 for the raw >=1 population, which is a different, much larger cohort). The overlap is accepted and disclosed (`countInsideZeroAdvanceRun`), never engineered away.
  > (6) NOT CHOSEN TO LAND THE COMPOSITE UNDER 5%: >=10 was picked because ten independent occurrences is the mechanism point in (3) — >=5 (3.8%) would still individually clear ~5% and was NOT chosen for producing a smaller number.

- The `index` field `countImpossibleSamples` reports for an offending pair is the ARRIVAL sample (`i + 1`), not the pair's start index — matching `pace-fixtures.ts`'s own convention (`syntheticImpossibleSpeedStream`'s `idx`, the pinned `impossible-speed-sample` fixture's `offendingIndex: 303`). Discovered via a demonstrated-failing test run against the real fixture, corrected, then re-verified.

## Deviations from Plan

None affecting behaviour — plan executed exactly as written. One acceptance-criterion wording tension is worth recording rather than silently absorbing:

- **Task 2's acceptance criterion** `grep -n "pause\|smooth\|window" src/analytics/pace-quality.ts shows such words only in comments explaining what is deliberately NOT done inside countImpossibleSamples` is, read literally, unsatisfiable in this file: `GapProfileSignal`'s `pauseSec` field (part of the Task 1/27-01 type contract) is legitimate CODE, not a comment, and its identifier contains the substring `pause`. The intent of the gate — that `countImpossibleSamples` itself does not secretly implement pause-exclusion or windowing — is satisfied structurally (verified by reading `countImpossibleSamples`'s body: no reference to `pauseSec`, `pause`-tier segments, or any windowing). Treated as a literal-grep wording gap in the acceptance criterion, not a defect to engineer around by renaming an already-shipped, cross-plan-referenced field.

## Issues Encountered

None blocking. One demonstrated-failing/fixed cycle during Task 2: the pinned `impossible-speed-sample` fixture test initially failed because `countImpossibleSamples` reported the offending pair's START index (302) while the fixture's `offendingIndex: 303` names the ARRIVAL sample — corrected by changing the reported `index` to `i + 1`, re-verified green, and documented in the function's own doc comment so a future reader does not "fix" it back.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`pace-quality.ts` now exports the complete signal-computation and evidence-shard layer plan 27-03's calibration sweep and plan 27-04's CI compute step both need: `computePaceQualitySignals` for the five-signal bundle, `buildPaceQualityShard` for the D-17 evidence document, and `QualityThresholdOverrides` as the one knob the calibration sweep turns for all three tiering signals without a source edit.

Plan 27-03 can now measure the true composite `anySevere` union over the live archive (decimation's locked 8.3% floor plus this plan's two newly-chosen thresholds) and report it honestly per D-02, including if it lands materially above ~5% — 27-RESEARCH.md's Pitfall 4 already flagged this as likely. No blockers for 27-03 or 27-04.

`npm run test`'s full suite carries 8 pre-existing, unrelated failures in this worktree (missing `dist/`, `data/stats/*.json`, `data/dashboard/index.json`, and an empty worktree `node_modules/chartjs-plugin-zoom`) — documented in `.planning/phases/27-per-activity-quality-signals/deferred-items.md` by plan 27-01, re-confirmed identical here, and explicitly known to be worktree-provisioning artifacts rather than defects (per this session's own orchestrator note). None of the 8 failing files touch this plan's changes. This plan's own target commands are fully green: `npx tsc --noEmit` (0 errors) and `npx vitest run src/analytics/pace-quality.test.ts src/analytics/best-effort-utils.test.ts` (97/97 passed).

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
