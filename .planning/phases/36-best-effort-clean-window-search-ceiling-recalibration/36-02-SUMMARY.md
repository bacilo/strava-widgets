---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 02
subsystem: analytics
tags: [best-effort, two-pointer-sweep, typescript, vitest, clean-window-search]

# Dependency graph
requires: []
provides:
  - "findBestEffort accepts an optional zero-copy half-open sample bound {startIndex, endIndex}"
  - "RawEffort carries the sweep's own startIndex/endIndex under the detector's half-open pair-space convention"
  - "the three scoping activities' 400m BEFORE figures (3:20, 3:21, 3:22/km) pinned as permanent regression fixtures with a full reference table"
affects: [36-03, 36-04, 36-05, 36-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional half-open {startIndex, endIndex} sample bound on a two-pointer sweep, adjusting loop limits only — never slice/subarray/concat/Array.from"
    - "Bound totality guard runs before any array read: Number.isInteger(lo/hi), lo>=0, hi<=t.length, hi-lo>=2"
    - "Independent-value test pattern: expected answer computed by slicing the array with the UNBOUNDED sweep, never by re-feeding the bounded sweep's own output back into the assertion"

key-files:
  created: []
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/best-effort-utils.ts
    - src/analytics/best-effort-utils.test.ts

key-decisions:
  - "D-01/D-02 (per 36-CONTEXT.md, referenced not re-litigated here): this plan only lays the index-bound primitive the partition search (36-04) will consume; it does not implement partitioning itself"
  - "RawEffort's startIndex/endIndex use the SAME half-open pair-space convention classifyGapsWithSegments's pass 3 already uses (pace-derivation.ts), so overlap decisions in later plans are index-space, not a second float-boundary rule"

patterns-established:
  - "Zero-copy bounded sweep reuse pattern for per-sub-interval search (consumed by 36-04's partition-and-search step)"
  - "Archive-wide omitted-bounds identity sweep as a committed regression guard (13,118 activity/distance pairs)"

requirements-completed: [PR-06, PR-09]

# Metrics
duration: 25min
completed: 2026-09-28
---

# Phase 36 Plan 02: findBestEffort Bounds & BEFORE-State Pinning Summary

**`findBestEffort` gains a zero-copy half-open `{startIndex, endIndex}` sample bound returning its own sweep indices, and the three scoping activities' 400m BEFORE figures (3:20, 3:21, 3:22/km) are pinned as permanent regression fixtures derived from the raw committed streams.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-28T15:30Z (approx, worktree setup)
- **Completed:** 2026-09-28T15:39Z
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments

- `findBestEffort` accepts an optional `bounds?: { startIndex: number; endIndex: number }` parameter, restricting the sweep to samples `startIndex..endIndex-1` without ever copying the input arrays — the loop's own `lo`/`hi` limits are adjusted in place. Omitting `bounds` reproduces today's full-array behaviour exactly (verified against every activity in the archive).
- `RawEffort` now carries `startIndex`/`endIndex`, the sweep's own sample indices, under the exact half-open pair-space convention `classifyGapsWithSegments`'s pass 3 already uses for `UnreliableSegment` — so a later plan can decide window/segment overlap in index space instead of inventing a second float-boundary rule (the defect class 32-13/32-17 fixed twice).
- The bound is total: an inverted, negative, over-long, non-integer or too-short bound returns `undefined` before any array read — six totality cases, each its own assertion.
- Bound equivalence proven against an INDEPENDENT value: the expected answer for a bounded sweep is computed by slicing the array and running the UNBOUNDED sweep over the slice — an array copy the shipped code deliberately never makes — on three synthetic streams and the real `3475740390` archive stream.
- The three scoping activities' 400m BEFORE figures (ROADMAP criterion 4's pinned fixtures) are reproduced from the raw committed streams by `findBestEffort` alone and pinned as permanent regression tests, with the head comment stating explicitly these are the BEFORE state and naming the after figures (4:59/4:50/5:08/km) only as references plan 36-05 will reconcile against.

## Task Commits

Each task was committed atomically:

1. **Task 1: RawEffort carries the sweep's indices; findBestEffort gains a zero-copy half-open bound** - `7865c61c` (feat)
2. **Task 2: Bounds equivalence against a sliced expectation, and bounds totality** - `cd57cc8e` (test)
3. **Task 3: Pin the three scoping activities' 400m BEFORE figures as permanent regression fixtures** - `7a6d62bd` (test)

**Plan metadata:** commit pending (docs: complete plan) — this SUMMARY commit is that metadata commit; orchestrator does not require a separate STATE.md/ROADMAP.md update from this worktree agent.

## Files Created/Modified

- `src/analytics/best-effort.types.ts` — `RawEffort` gains `startIndex`/`endIndex` with the half-open pair-space contract documented, naming 32-13/32-17 as the defect class avoided
- `src/analytics/best-effort-utils.ts` — `findBestEffort` gains the optional `bounds` parameter, the totality guard, and returns `startIndex`/`endIndex`; docblock extended with the zero-copy guarantee, the one-sweep warning (`pace-single-source.test.ts` does not currently ban a duplicate sweep), and the five totality cases
- `src/analytics/best-effort-utils.test.ts` — new `findBestEffort — bounds` describe (11 tests: omitted-bounds archive identity, sliced-expectation equivalence x4, totality x6) and new `findBestEffort — scoping activities` describe (3 tests, the pinned BEFORE fixtures)

## Reference Table — This Phase's BEFORE State (36-02 Task 3, re-derived this run)

| Activity | durationSec | paceSecPerKm | mm:ss | startOffsetSec | endOffsetSec | startIndex | endIndex |
|---|---|---|---|---|---|---|---|
| 3475740390 | 79.90688259109311 | 199.76720647773277 | 3:20 | 2508 | 2587.906882591093 | 629 | 657 |
| 3475724402 | 80.37704918032796 | 200.9426229508199 | 3:21 | 3061 | 3141.377049180328 | 1329 | 1369 |
| 3475734189 | 80.83870967741927 | 202.09677419354819 | 3:22 | 1285 | 1365.8387096774193 | 1285 | 1366 |

`3475740390`'s 400m window starts on the 52m jump at `t=2508` (SEG-03's own named fixture), confirming this is the right fixture rather than a look-alike. `t[startIndex] === startOffsetSec` holds for all three. These are the BEFORE state only — the after figures (4:59/4:50/5:08/km) are references for plan 36-05 to reconcile against, never asserted here.

## Verification Evidence

- `npx tsc --noEmit` exits 0.
- `npx vitest run src/analytics/best-effort-utils.test.ts -t "bounds"` — **11 tests matched** (>= 9 required, not 0).
- Compared-pair counter from the omitted-bounds identity sweep: **13,118** activity/distance pairs (1,874 archive activities x 7 `TARGET_ORDER` distances) — greater than zero, so the sweep genuinely ran, not vacuously.
- `npx vitest run src/analytics/best-effort-utils.test.ts -t "scoping activities"` — **3 tests matched** (>= 3 required, not 0).
- `npx vitest run src/analytics/best-effort-utils.test.ts` — **63/63 tests pass**, unfiltered.
- `npx vitest run src/analytics/` (full analytics suite) — **878/878 tests pass**, no regressions.
- `git status --porcelain data/` — empty at every checkpoint (no test wrote to a tracked file).
- `git diff --stat` (base..HEAD) touches exactly the three files in `files_modified`.
- The four interpolation lines (`needed`, `segMeters`, `frac`, `crossingTime`) are byte-identical to the pre-change file — confirmed via `git diff` hunk in the Task 1 commit.

## Decisions Made

None beyond what 36-CONTEXT.md and 36-RESEARCH.md already locked (D-01, D-02 referenced but not exercised by this plan — this plan only adds the primitive later plans consume). No new architectural decisions were required during execution.

## Deviations from Plan

None - plan executed exactly as written. The plan's own task-commit boundaries required splitting Task 2 and Task 3's test additions (both land in the same file) into two separate commits; this was done by temporarily removing the Task 3 block before Task 2's commit and restoring it before Task 3's commit — a mechanical split, not a deviation from the plan's content.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `findBestEffort`'s bound and `RawEffort.startIndex`/`.endIndex` are the exact primitive plan 36-04's partition-and-search step needs — the signature and half-open convention are locked and documented, ready for reuse without a second sweep implementation.
- The three BEFORE fixtures are now permanent regression tests; plan 36-05 can add the corresponding AFTER assertions (4:59/4:50/5:08/km) against the same activities once the clean-window search lands.
- No blockers. `pace-single-source.test.ts` does not currently guard against a second sweep implementation — flagged in the `findBestEffort` docblock as a disclosed residual (T-36-06 in this plan's threat register); a future plan may want to add that guard but it is out of this plan's scope.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/analytics/best-effort.types.ts
- FOUND: src/analytics/best-effort-utils.ts
- FOUND: src/analytics/best-effort-utils.test.ts
- FOUND: commit 7865c61c
- FOUND: commit cd57cc8e
- FOUND: commit 7a6d62bd

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
