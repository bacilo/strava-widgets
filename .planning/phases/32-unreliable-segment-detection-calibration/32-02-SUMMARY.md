---
phase: 32-unreliable-segment-detection-calibration
plan: 02
subsystem: analytics
tags: [typescript, vitest, stream-analysis, gap-detection, pure-function]

# Dependency graph
requires:
  - phase: 26-pace-data-quality-foundation
    provides: validateStreamSeries (best-effort-utils.ts) — the entry guard this module reuses
provides:
  - "src/analytics/unreliable-segments.ts — advanceSteps, detectUnreliableSegments, and the full exported type contract (SegmentMechanism, GapSpan, DetectorParams, AdvanceStep, SegmentPart, UnreliableSegment)"
  - "A leaf module with REQUIRED DetectorParams — no calibrated constants yet; plan 32-06 derives them"
affects: [32-03, 32-04, 32-06, 32-08, 32-09, phase-33-pace-derivation-integration, phase-36-best-effort-partitioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-level (not per-sample) speed scoring: advanceSteps folds zero-advance/zero-duration pairs forward before any speed test runs, closing the decimation-aliasing pitfall a per-pair check would fall into"
    - "Touching-only adjacency (no tolerance constant): a burst and a gap merge only when one's endIndex equals the other's startIndex exactly"
    - "Total-function/never-throw discipline mirrored from pace-derivation.ts: validateStreamSeries guard first, fresh [] on any invalid input, no shared mutable module-level constants"

key-files:
  created:
    - src/analytics/unreliable-segments.ts
    - src/analytics/unreliable-segments.test.ts
  modified: []

key-decisions:
  - "D-06/D-07 touching adjacency implemented as a single sorted-blocks contiguous-chain walk over interleaved burst and gap blocks, rather than two separate adjacency checks — this is what makes conservation (parts sum exactly to segment totals) hold by construction rather than by a separate reconciliation step"
  - "A burst chain that touches no gap still yields a segment (isolated-jump or hidden-pause per D-08) — only a gap-only chain (no burst) yields nothing, per the plan's explicit 'near miss' and 'not swallowed' behaviour bullets"

patterns-established:
  - "isFastStep/excessMetres literal-text discipline: the two core comparisons (`metres > speedLimitMps * seconds`, `metres - speedLimitMps * seconds`) each appear in exactly one place in the file, verified by grep, ready for plan 32-04's single-source audit to bind to"

requirements-completed: [SEG-01]

# Metrics
duration: ~20min
completed: 2026-09-19
---

# Phase 32 Plan 02: Unreliable-Segment Detector (advanceSteps + detectUnreliableSegments) Summary

**Standalone `src/analytics/unreliable-segments.ts` leaf module: `advanceSteps` folds zero-advance/zero-duration pairs into run-level units, and `detectUnreliableSegments` scores runs by aggregate excess speed, merges touching bursts and gaps into single conserved segments, and labels each with one of three mechanisms — all with required (uncalibrated) parameters and 38 passing mechanics tests.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `advanceSteps(t, d, gaps)`: walks covered pairs, folding zero-advance and zero-duration pairs forward into the next genuinely-advancing pair; a gap pair discards any pending step and resets the walk to the gap's own end sample. Verified against the plan's exact full/zero-alternation fixture (3 steps, each 8m/2s).
- `detectUnreliableSegments(t, d, gaps, params)`: groups `advanceSteps`' output into maximal contiguous fast runs, promotes a run to a "burst" only once its aggregate excess metres clears `excessFloorMetres` (D-09), maps each caller-supplied gap span to sample indices, and chains touching bursts/gaps (D-06: exact index-boundary touch, no tolerance; D-07: maximal contiguous chains) into `UnreliableSegment` records with full burst/gap itemisation.
- Mechanism labelling: `gapCount > 0` → `gap-adjacent`; otherwise split on `hiddenPauseMinMetres` into `hidden-pause`/`isolated-jump` (D-03/D-08) — exactly three `SegmentMechanism` members, no fourth.
- Every export is total: `validateStreamSeries` guards `t`/`d`, an explicit range/finiteness check guards `params`, and a malformed gap span (non-finite bounds, `endSec <= startSec`, or bounds matching no sample time) fails the whole call closed to `[]` — never throws.
- 38 tests across 6 named describe blocks (`advanceSteps`; adjacency/chaining D-06/D-07; excess floor D-09; mechanism labelling D-03/D-08; run-level scoring SEG-01 decimation aliasing and diluted slews; total function), including a conservation check (`metres === burstMetres + gapMetres`, `seconds === burstSeconds + gapSeconds`, within 1e-9) across every produced segment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Module skeleton, exported types and advanceSteps** - `84022d99` (feat)
2. **Task 2: detectUnreliableSegments — bursts, excess floor, touching adjacency, contiguous chaining, mechanism, conservation** - `5c8a4385` (feat)

_Note: both tasks are TDD-flagged in the plan; tests were written and verified green alongside each task's implementation within the same commit (RED/GREEN co-located per task, matching this plan's tight two-task coupling — the module was not yet importable/usable in a partial state that would make a separate failing-test commit meaningful)._

## Files Created/Modified

- `src/analytics/unreliable-segments.ts` - New leaf module: types (`SegmentMechanism`, `GapSpan`, `DetectorParams`, `AdvanceStep`, `SegmentPart`, `UnreliableSegment`), `advanceSteps`, `detectUnreliableSegments`, and private helpers (`isGapPair`, `isFastStep`, `excessMetres`, `groupFastRuns`, `mapGapToIndices`, `paramsAreValid`).
- `src/analytics/unreliable-segments.test.ts` - 38 mechanics tests on hand-built arrays with explicit `DetectorParams`.

## Decisions Made

- Implemented D-06/D-07 adjacency and chaining as one sorted-blocks walk (interleaving burst and gap blocks by `startIndex`, extending a chain while `blocks[j+1].startIndex === blocks[j].endIndex`) rather than two separate "does this burst touch a gap" and "do these chains merge" passes. This makes the conservation invariant (parts sum exactly to the segment's own endpoint-difference totals) hold structurally, not by a second reconciliation step.
- A burst-only chain (touching no gap) still produces a segment, labelled `isolated-jump`/`hidden-pause` by D-08's metres boundary — confirmed against the plan's "near miss" and "not swallowed" behaviour bullets, which require the near-miss case to yield a no-gap segment rather than nothing.

## Deviations from Plan

None — plan executed exactly as written. No interim calibration constants were invented; `DetectorParams` is required with no default, per the plan's explicit instruction that plan 32-06 derives the calibrated values.

## Issues Encountered

One self-correction during Task 1/2 authoring: the initial docblock for the private `isFastStep` helper restated the banned literal text (`metres > speedLimitMps * seconds`) in prose, which would have made `grep -c` on that exact string match 2 lines instead of the required 1 (the acceptance criterion for plan 32-04's future single-source audit). Reworded the docblock to describe the comparison without quoting its literal text verbatim, verified `grep -c` returns exactly `1` for both banned literals before committing. This was caught and fixed before any commit landed — not a post-hoc revert.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The exact contract (`advanceSteps`, `detectUnreliableSegments`, all six exported types) is in place for plans 32-03 (recount), 32-04 (single-source audit extension), 32-06 (calibration deriving `DetectorParams`' real values and making it optional with a default), 32-08 (named-activity fixtures), and 32-09.
- `pace-derivation.ts` is confirmed byte-for-byte untouched (`git diff --stat` empty) — the phase boundary against wiring into it holds.
- No blockers. The module is fully self-contained and requires no external service or calibration artifact to be usable in its current (required-params) form.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-19*
