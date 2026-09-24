---
phase: 35-stream-derived-running-pace
plan: 02
subsystem: testing
tags: [validateStreamSeries, totality, null-safety, pace-derivation, pace-quality, best-effort-utils]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: the narrowed classifyPairKinds docblock and the folded todo (IN-04) this plan closes
provides:
  - a total validateStreamSeries (never throws on null/undefined/non-array input)
  - null-input assertions at every exported function in pace-derivation.ts/pace-quality.ts that
    transitively reaches validateStreamSeries
  - the classifyPairKinds docblock restored to its general, dated, citation-free claim
affects: [35-03, 35-stream-derived-running-pace (RPACE-01's "computable stream" totality)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array.isArray-first guard: a shared totality util rejects any non-array argument before
      reading .length, so every call site inherits never-throws for free"
    - "One null-input regression test per exported function, asserting the function's OWN
      already-documented neutral value rather than inventing a new one"

key-files:
  created: []
  modified:
    - src/analytics/best-effort-utils.ts
    - src/analytics/best-effort-utils.test.ts
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts
    - src/analytics/pace-quality.test.ts

key-decisions:
  - "D-08: validateStreamSeries(null, null) proven throwing before the fix (watched RED), then
    fixed to return { ok: false, reason } via an Array.isArray-first guard"
  - "Widened validateStreamSeries's parameter types to readonly number[] | null | undefined —
    tsc --noEmit stayed clean at every call site, so the widen-vs-keep-narrow branch resolved to
    widen"
  - "Existing t == null || d == null guards (13 sites) kept as defence in depth, not removed —
    the todo's 'asserted' branch was taken at every site, never the 'guard removed as redundant'
    branch"
  - "The todo is closed in substance (acceptance criteria met) but left in
    .planning/todos/pending/ — .planning/todos/done/ does not exist in this repo (only
    todos/completed/), and the plan's own fallback forbids inventing a directory mapping"

requirements-completed: []  # Requirement-tick safety: this plan ticks nothing (RPACE-01 stays open for plan 35-03+).

# Metrics
duration: ~15min
completed: 2026-09-24
---

# Phase 35 Plan 02: validateStreamSeries Null-Safety at Source Summary

**Made `validateStreamSeries` genuinely total (never throws on `null`/`undefined`/non-array input) at its one definition, then asserted every one of the 12 exported functions across `pace-derivation.ts`/`pace-quality.ts` that transitively reach it now returns its own documented neutral value instead of inheriting the old raw `TypeError`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- `validateStreamSeries` (`best-effort-utils.ts`) is now total for every input shape: an
  `Array.isArray`-first guard rejects `null`, `undefined`, and any non-array value with a
  `{ ok: false, reason }` naming which argument failed and its `typeof`, before the function's
  first `.length` read. Watched RED first — the pre-fix function threw
  `TypeError: Cannot read properties of null (reading 'length')` at `best-effort-utils.ts:73:9`.
- Zero already-covered `validateStreamSeries` inputs moved: five pinned pre-fix shapes (valid
  series, length mismatch, <2 samples, non-finite value, decreasing `t`) deep-equal the exact
  objects the unfixed function returned.
- Live call-site census re-grepped fresh (the folded todo's own "nine" was stale): **14** call
  sites total, not nine — `pace-derivation.ts:340,792,945`; `pace-quality.ts:1017,1346,1437,1580,
  1820,2176`; `unreliable-segments.ts:267,497`; `compute-best-efforts.ts:114`;
  `dashboard/views/detail-splits.ts:83`; `dashboard/views/detail-charts-logic.ts:62`.
- One null-input regression test added per exported function in `pace-derivation.ts`/
  `pace-quality.ts` that transitively reaches `validateStreamSeries` — 12 functions, each
  asserting its own already-documented neutral value (see table below).
- The `classifyPairKinds` docblock plan 34-16 narrowed to "AT THIS CALL SITE" with a stale
  line-number census and a pending-todo pointer is rewritten to the now-true general claim:
  `validateStreamSeries` is itself total, so every call site inherits the guarantee; the local
  `t == null || d == null` check is retained as defence in depth. Dated 2026-09-24, no
  `.ts:{line}` citations.

## Task Commits

1. **Task 1: Make validateStreamSeries total at source, watched failing first** - `8e7337e7` (fix)
2. **Task 2: Census every call site, assert each enclosing function's null behaviour, restore the narrowed comment** - `3fb7334a` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/analytics/best-effort-utils.ts` — `validateStreamSeries` gained an `Array.isArray`-first
  guard and a widened `readonly number[] | null | undefined` parameter type; docblock states
  totality explicitly.
- `src/analytics/best-effort-utils.test.ts` — 8 total-for-null/undefined/non-array cases plus a
  5-case unchanged-behaviour block pinned to the pre-fix function's own observed output.
- `src/analytics/pace-derivation.ts` — `classifyPairKinds`'s docblock rewritten (no behaviour
  change).
- `src/analytics/pace-derivation.test.ts` — 5 new null-input tests (`classifyGaps`,
  `classifyGapsThreeWay`, `derivePaceWithCoverage`, `streamPaceSecPerKm`,
  `detectPaceDisagreement`); `classifyGapsWithSegments` already had equivalent coverage in the
  existing Phase 34 `coveredRuns` block, not duplicated.
- `src/analytics/pace-quality.test.ts` — 7 new null-input tests (`decimationSignal`,
  `gapProfileSignal`, `unreliableSegmentsSignal`, `countImpossibleSamples`,
  `impossibleSampleSignal`, `computePaceQualitySignals`, `buildPaceQualityShard`); added
  `NOT_COMPUTABLE_UNUSABLE_STREAM` to the import list.

## Call-Site Census (Task 2, re-grepped 2026-09-24)

`grep -rn "validateStreamSeries(" src/ | grep -v test` — **14 live call sites**, not the folded
todo's stale "nine":

| File:Line | Enclosing exported function (or its exported callers) | Own documented neutral return |
|---|---|---|
| `pace-derivation.ts:340` | `classifyPairKinds` (private) → `classifyGapsThreeWay`, `classifyGaps`, `classifyGapsWithSegments` | zeroed `ThreeWayPaceCoverage` / zeroed `PaceCoverage` / `{ coverage: zeroCoverage(), segments: [], coveredRuns: [] }` |
| `pace-derivation.ts:792` | `derivePaceWithCoverage` | `{ paceSeries: [], coverage: zeroCoverage(), windowSec: PACE_WINDOW_FLOOR_SEC }` |
| `pace-derivation.ts:945` | `streamPaceSecPerKm` → `detectPaceDisagreement` | `null` |
| `pace-quality.ts:1017` | `decimationSignal` | `{ tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null }` |
| `pace-quality.ts:1346` | `unreliableSegmentsSignal` | `notComputableUnreliableSegmentsSignal()` (all-null) |
| `pace-quality.ts:1437` | `countImpossibleSamples` → `impossibleSampleSignal`, `buildPaceQualityShard` | `{ count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0, samples: [] }` |
| `pace-quality.ts:1580` | `impossibleSampleSignal` | `{ tier: 'not-computable', count: null, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: null }` |
| `pace-quality.ts:1820` | `computePaceQualitySignals` | `notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_UNUSABLE_STREAM)` |
| `pace-quality.ts:2176` | `buildPaceQualityShard` | full not-computable shard, `notComputableReason: NOT_COMPUTABLE_UNUSABLE_STREAM` |
| `unreliable-segments.ts:267,497` | `detectUnreliableSegments` (out of this plan's `files` scope — pace-quality.ts/pace-derivation.ts only) | not touched this plan |
| `compute-best-efforts.ts:114` | out of scope | not touched this plan |
| `dashboard/views/detail-splits.ts:83` | out of scope | not touched this plan |
| `dashboard/views/detail-charts-logic.ts:62` | out of scope | not touched this plan |

`gapProfileSignal` (`pace-quality.ts:1273`) is exported and also **transitively** reaches
`validateStreamSeries` via `resolveCoverage` → `classifyGapsWithSegments` → `classifyPairKinds` —
included in the null-input assertion table below even though it has no direct call of its own.
`pauseClassificationSignal`, `forgottenStopSignal`, `projectUnreliableSegments`,
`projectPauseIntervals`, `subGroundSignal`, `closureDriftSignal`, `verticalRateSignal`, and
`elevationSignal` were checked and confirmed **not** to reach `validateStreamSeries` at all
(the pause/forgotten-stop pair delegates to `pause-classification.ts`, which never calls it; the
elevation trio guards with its own local `Array.isArray` checks) — correctly excluded from scope.

Only `pace-derivation.ts:945` (inside `streamPaceSecPerKm`, the function D-01 in this phase's
CONTEXT.md is expected to retire as the disputed comparator) and any new call site plan 35-03's
running-pace function might introduce sit in this phase's blast radius per 35-RESEARCH.md
Pitfall 3 — the six `pace-quality.ts` sites and `pace-derivation.ts:792` are unrelated call sites
this plan touched only because Task 2's own text ("every exported function... that transitively
reaches a validateStreamSeries call") required it, not because RPACE-01 needed them touched.

## Null-Input Assertions Added (Task 2)

| Function | Module | Test name (abbreviated) | Matched `-t` count |
|---|---|---|---|
| `classifyGaps` | pace-derivation | `classifyGaps(null, null)...` | 5 (block) |
| `classifyGapsThreeWay` | pace-derivation | `classifyGapsThreeWay(undefined, undefined)...` | 5 (block) |
| `classifyGapsWithSegments` | pace-derivation | already covered — Phase 34 `coveredRuns` block, `null t`/`null d`/mismatched-length | n/a (pre-existing) |
| `derivePaceWithCoverage` | pace-derivation | `derivePaceWithCoverage on a stream whose t/d are null...` | 5 (block) |
| `streamPaceSecPerKm` | pace-derivation | `streamPaceSecPerKm ... t/d are undefined...` | 5 (block) |
| `detectPaceDisagreement` | pace-derivation | `detectPaceDisagreement ... t/d are null...` | 5 (block) |
| `decimationSignal` | pace-quality | `35-02 D-08: decimationSignal(null, null)...` | 7 (block) |
| `gapProfileSignal` | pace-quality | `35-02 D-08: gapProfileSignal(undefined, undefined)...` | 7 (block) |
| `unreliableSegmentsSignal` | pace-quality | `35-02 D-08: unreliableSegmentsSignal(null, null, [])...` | 7 (block) |
| `countImpossibleSamples` | pace-quality | `35-02 D-08: countImpossibleSamples(null, null)...` | 7 (block) |
| `impossibleSampleSignal` | pace-quality | `35-02 D-08: impossibleSampleSignal(undefined, undefined)...` | 7 (block) |
| `computePaceQualitySignals` | pace-quality | `35-02 D-08: computePaceQualitySignals on a stream object whose t/d are null...` | 7 (block) |
| `buildPaceQualityShard` | pace-quality | `35-02 D-08: buildPaceQualityShard on a stream object whose t/d are null...` | 7 (block) |

`-t "35-02"` on `pace-derivation.test.ts` matched 5 tests (all pass). `-t "35-02"` on
`pace-quality.test.ts` matched 7 tests (all pass). Both counts are non-zero — verified, not a
vacuous filter.

## Decisions Made

- **D-08 (Array.isArray-first guard):** the fix runs `Array.isArray` on both `t` and `d` before
  the existing `t.length !== d.length` check, returning `{ ok: false, reason: '<name> is not an
  array: <typeof>' }` naming the offending argument. This is the narrowest change that closes the
  gap at the one shared definition rather than at each of 14 call sites individually.
- **Parameter type widened, not kept narrow:** the plan's step 2 made widening to
  `readonly number[] | null | undefined` conditional on "no compile error at any call site" —
  `npx tsc --noEmit` stayed clean with the widened signature, so no call site needed a cast added
  or removed, and the widen branch was taken.
- **Guards kept, not removed:** the todo's acceptance criteria offered two branches ("asserted, OR
  the site's own guard is removed as redundant"). This plan takes the "asserted" branch
  everywhere — all 13 pre-existing `t == null || d == null` guards across the codebase are
  untouched, staying as defence in depth.
- **Todo left in `pending/`:** `.planning/todos/done/` does not exist in this repo (the actual
  convention here is `.planning/todos/completed/`, 4 entries). The plan's own instruction was
  specific to `done/` and forbade inventing a directory mapping, so the todo file was left in
  place with its disposition recorded here rather than moved to `completed/` on my own judgement.

## Deviations from Plan

None — plan executed exactly as written. The docblock rewrite, the 12-function census, and the
todo-directory fallback all matched a scenario the plan explicitly anticipated and gave
instructions for.

## Issues Encountered

None.

## Next Phase Readiness

`validateStreamSeries` is now genuinely total for every input shape a `.mjs` caller, a malformed
stream file, or plan 35-03's own new running-pace function could reach it with. Plan 35-03 can
build the RPACE-01 running-pace computation on top of `classifyGapsWithSegments` without adding a
fifteenth `t == null || d == null` two-token guard, and without RPACE-01's "computable stream"
predicate silently excluding a `null`-shaped input differently than a merely malformed one.

No blockers for plan 35-03.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 6 files (5 source/test files + this summary) confirmed present via `[ -f ... ]`. Both task
commit hashes (`8e7337e7`, `3fb7334a`) confirmed present via `git log --oneline --all`.
