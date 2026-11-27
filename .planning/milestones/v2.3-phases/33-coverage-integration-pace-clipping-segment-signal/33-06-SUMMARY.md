---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 06
subsystem: testing
tags: [pace-derivation, unreliable-segments, coverage, pace-chart, pace-histogram, vitest, real-stream-fixtures]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "01"
    provides: "classifyGaps widened to a four-way GapKind, classifyGapsThreeWay's pre-detector seam — the detector wiring this plan proves reaches the chart and histogram"
provides:
  - "Real-stream, extent-based proof that the pace chart band (buildChannelSeries) and the pace histogram (computePaceDistribution) clip/exclude unreliable segments through their pre-existing, UNCHANGED call sites — PACE-08's central claim, with zero edits to detail-charts-logic.ts, detail-zones.ts or detail.ts"
  - "Independently-derived post-clip fastest pace per named activity (3475724402: 2:53/km; 3475734189: 3:51/km; 3475740390: 2:40/km), recorded for plan 33-11's browser checkpoint rows"
  - "A pinned clean-control activity (10146303423) for plans 33-11/33-12 to reuse, with detector-stubbed-vs-real identity proven for both the chart and the histogram"
  - "A load-bearing accounting-identity guard (bucketedSec <= coveredSec) that catches a class of leak the band-absence and fastest-bucket-edge checks cannot: a segment's own start sample surviving exclusion"
affects: [33-11, 33-12, 33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent extent proof: a from-scratch centred-window pace computation (handInterp + independentFastestPaceSecPerKm), sharing only the production adaptiveWindowSec width, never calling derivePaceSeriesGapAware/buildChannelSeries/computePaceDistribution — reused identically in both test files per the plan's own instruction"
    - "Detector's own segment boundaries obtained via the pre-detector classifyGapsThreeWay path (detectedSegmentsFor helper), not read back from classifyGaps' post-detector gapIntervals — ground truth independent of the code under test"
    - "vi.doMock('.../unreliable-segments.js') + vi.resetModules() + dynamic re-import, mirroring 33-01's pace-single-source.test.ts pattern, to prove a clean-control activity renders identically through the widened detector path and a stubbed-to-[] path"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-charts-logic.test.ts
    - src/dashboard/views/detail-zones.test.ts

key-decisions:
  - "Clean control chosen by live archive scan (throwaway node script, not committed): 10146303423 — classifyGaps(t,d).unreliableSec === 0, span 2,559 s (42.6 min), 2,545 samples, zero recording-gap/pause seconds too (fully covered), avgMps 2.77 (normal running pace). Pinned as the literal id both this plan's tasks reuse and the id plans 33-11/33-12 must also reuse per the plan's own instruction."
  - "Independent fastest-pace formula deliberately written as (windowElapsedSec * 1000) / windowMetres rather than the mathematically-identical elapsed / (metres / 1000) — the latter is a BANNED_LITERALS entry in pace-single-source.test.ts (the historical duplicate-pace-implementation defect shape), which does not exempt *.test.ts files by design. Found via this plan's own required full npm test run; fixed in both files before committing (see Deviations)."
  - "Task 2's central discriminator is NOT the band-absence or fastest-bucket-edge check (both proven insensitive to the WR-01 segment-start-leak defect class via a watched-failing mutation) but a third, added assertion: computePaceDistribution's total bucketed seconds must never exceed derived.coverage.coveredSec. This is the assertion PACE-08's histogram claim actually rests on for this activity."

patterns-established:
  - "When a proof-quality bar demands failability, run the watched-failing mutation BEFORE trusting a green suite — Task 2's first draft passed 8/8 new tests against a genuinely broken call site (gapIntervals filtered to drop 'unreliable') because neither chosen assertion was sensitive to that specific leak shape."

requirements-completed: []  # This plan's own text (requirement-tick safety) forbids ticking PACE-08 here — it maps which requirement this evidence serves, not authority to tick it. Plan 33-13 alone sets PACE-08's disposition, and only under the all-rows-PASS rule against rendered checkpoint evidence.

# Metrics
duration: ~50min
completed: 2026-09-21
---

# Phase 33 Plan 6: Pace-chart and histogram clipping proof (PACE-08 evidence) Summary

**Proved, by fixture behaviour on three real committed streams (3475724402, 3475734189, 3475740390) plus a clean control (10146303423), that the pace chart band and the pace histogram inherit unreliable-segment clipping through their pre-existing call sites with zero source-file change — and found, via a watched-failing mutation, that the histogram's most natural-looking assertions (band absence, fastest-bucket-edge) do not actually catch the WR-01 segment-start-leak defect class, so a third accounting-identity check had to be added.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2
- **Files modified:** 2 (both test-only, exactly the plan's declared scope)

## Accomplishments

- `detail-charts-logic.test.ts` gained a new describe block (12 new tests, all named for `-t "unreliable"`) proving `buildChannelSeries`'s pace branch clips unreliable segments on 3475724402 and 3475734189, each with: a non-vacuity check (detector finds >=1 segment), a segment-membership null-check against the CHART's own `{x,y}` output (not a separately-computed `derivePaceWithCoverage` call — an early draft made exactly that mistake and stayed green under a mutation; see Deviations), an extent discriminator (>=100 non-null points, fastest within 1 sec/km of an independently hand-computed value), a global no-faster-than-independent-fastest check, and the named-impossible-band absence check
- `detail-zones.test.ts` gained a matching describe block (9 new tests) proving `computePaceDistribution` excludes 3475740390's five isolated jumps (each reconciled against `PROJECT.md`'s measured description), holds `paceHistogramAccounting`'s WR-01 identity on 3475724402's now-smaller `coveredSec`, and reproduces Task 1's clean-control identity check via `vi.doMock`
- Both source files this plan targets (`detail-charts-logic.ts`, `detail-zones.ts`) plus the third render-side file the audit names (`detail.ts`) are confirmed untouched: `git diff --exit-code` clean on all three, and `git log`/`git diff --stat` empty between the phase-33 base commit (`6772dca5`, the commit immediately before plan 33-01's first task commit `a3e2bba7`) and `HEAD`
- Independently-derived post-clip fastest pace recorded per named activity for plan 33-11 (see table below)
- Found and fixed a real defect in the SUMMARY-writing session itself: Task 1's first draft asserted segment-strictly-inside null-ness against a separately-computed `derived.paceSeries` object rather than the chart's own output, so it could not have failed even if `buildChannelSeries` were broken — caught by the mandated watched-failing mutation, fixed to assert against `buildChannelSeries`'s own `{x,y}` points

## Task Commits

1. **Task 1: Chart-band clipping on the two 0:34/km activities, plus a clean control** - `ad856c2c` (test)
2. **Task 2: Histogram exclusion on the isolated-jump activity, plus the zero-call-site-change audit** - `c033d2ca` (test)

_No plan-metadata commit — this is a worktree-isolated parallel execution; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified

- `src/dashboard/views/detail-charts-logic.test.ts` — new describe block `unreliable segment clipping reaches the chart band with zero source-file change (unreliable, PACE-08)`; new helpers `loadStreamById`, `handInterp`, `independentFastestPaceSecPerKm`, `detectedSegmentsFor`
- `src/dashboard/views/detail-zones.test.ts` — new describe block `unreliable segment exclusion reaches the histogram with zero source-file change (unreliable, PACE-08)`; same four helpers duplicated per-file (matching this codebase's existing per-file fixture-helper convention)

## Independently-derived post-clip fastest pace (for plan 33-11)

Computed in-test from raw `t`/`d`, walking every sample not strictly inside a `gapIntervals` entry (any kind), taking a centred `adaptiveWindowSec`-wide window clamped at the stream extent and the nearest bounding gap, using a from-scratch interpolation (`handInterp`) — never calling `derivePaceSeriesGapAware`/`buildChannelSeries`/`computePaceDistribution`. Only the window WIDTH is shared with production (`adaptiveWindowSec`, deliberately, per the plan's own instruction); the EXTENT is independent.

| Activity | windowSec | Independent fastest (sec/km) | min:sec/km | Rendered fastest (chart, Task 1 only) |
|---|---|---|---|---|
| 3475724402 | 20 | 173.01 | **2:53/km** | 173.01 (exact match, diff 0.000) |
| 3475734189 | 20 | 231.21 | **3:51/km** | 231.21 (exact match, diff 0.000) |
| 3475740390 | 20 | 160.00 | **2:40/km** | n/a (Task 2, histogram only) |

## Task 1 — chart-band clipping, per-activity detail

**3475724402** (18 gaps, 30 bursts, all gap-adjacent — the 0:34/km case):
- 16 detected unreliable segments (`isolated-jump`/`gap-adjacent` mechanisms merged), 45 total sample indices strictly inside them (`startIndex < i < endIndex` across all 16) — every one confirmed absent from the chart's own `{x,y}` output (no point at that `stream.t[i]`)
- Rendered non-null pace count: 1,789 (of 1,834 total samples)
- Fastest rendered pace: 173.01 sec/km — equals the independently-derived value exactly (diff 0.000)
- Zero rendered samples in the 0:30-0:40/km band

**3475734189** (no timestamp gap at all; 199 m hidden pause at t=1353-1360 — also the 0:34/km case):
- 1 detected unreliable segment (`hidden-pause`, `startIndex=1352, endIndex=1360`), 7 sample indices strictly inside (t=1353..1359) — all absent from the chart's own output
- Rendered non-null pace count: 2,366 (of 2,388 total samples)
- Fastest rendered pace: 231.21 sec/km — equals the independently-derived value exactly (diff 0.000)
- Zero rendered samples in the 0:30-0:40/km band

**Clean control (10146303423)**:
- `classifyGaps(t,d).unreliableSec === 0`; span 2,559 s (42.6 min); recordingGapSec=0, pauseSec=0 too (fully covered stream); 2,545 samples
- Chart renders its full range: 2,545 non-null points, identical whether computed through the real widened-detector path or a path with `detectUnreliableSegments` stubbed to return `[]` (`vi.doMock('../../analytics/unreliable-segments.js')` + `vi.resetModules()` + dynamic re-import); fastest value identical to 6 decimal places both ways (~225.99 sec/km, 3:46/km)

## Task 2 — histogram exclusion, activity detail

**3475740390** (distance-triggered, five isolated jumps between km 6.9 and 7.7 — the 1:10-1:40/km case):

| # | startIndex-endIndex | startSec-endSec | metres | seconds | km range | mechanism |
|---|---|---|---|---|---|---|
| 1 | 590-591 | 2347-2350 | 30.10 | 3.00 | 6.831-6.861 | isolated-jump |
| 2 | 629-630 | 2508-2513 | 52.40 | 5.00 | 7.305-7.357 | isolated-jump |
| 3 | 636-637 | 2536-2538 | 28.60 | 2.00 | 7.431-7.460 | isolated-jump |
| 4 | 653-654 | 2580-2583 | 30.40 | 3.00 | 7.638-7.669 | isolated-jump |
| 5 | 656-657 | 2587-2589 | 24.70 | 2.00 | 7.694-7.718 | isolated-jump |

- All five confirmed `mechanism: 'isolated-jump'`; `coverage.unreliableSec = 15` (sum of the five durations, all disjoint — no merge)
- Each of the five jumps' own sample START confirmed in-test to fall inside an unreliable interval via `paceHistogramSamples`'s own membership rule (`segStart >= g.startSec && segStart < g.endSec`) — attributable, not incidental
- **Reconciliation against `PROJECT.md`'s "five isolated jumps of 25-52 m in 2-5 s between km 6.9 and 7.7":** duration range matches exactly (2-5 s). Metres range measured 24.70-52.40 m vs. PROJECT.md's stated 25-52 m — a ~1.2% difference at the low end (24.70 vs 25), attributable to PROJECT.md's figure being a rounded scoping-session measurement, not a recomputed one; not material. km range measured 6.831-7.718 vs. PROJECT.md's stated "km 6.9 and 7.7" — the first jump (6.831 km) sits slightly before PROJECT.md's stated 6.9 km floor; the other four (7.305-7.718 km) sit inside the stated range. Both differences are named per D-13/PITFALLS discipline (reconcile, never assert equality against prose) and neither is material to the histogram-exclusion claim.
- Populated buckets: 29; total bucketed seconds: 3,569 (of `coveredSec` 3,563 — see accounting note below the acceptance criteria are drawn from `computePaceDistribution`'s own output, not a `paceSeries[i] === null` re-derivation)
- Zero buckets overlap the 1:10-1:40/km (70-100 sec/km) band
- Fastest populated bucket: `150-165/km` (edge 150 sec/km) — within one `PACE_BUCKET_WIDTH_SEC` (15 s) of the independently-derived fastest (160.00 sec/km); the raw minimum histogram sample is exactly 160.00 sec/km (confirmed by direct inspection), so the bucket-edge quantization (150 = floor(160/15)*15) is expected, not a leak

**3475724402 — `paceHistogramAccounting` WR-01 identity** (`coveredSec === bucketedSec + unbucketedCoveredSec`):
- `coverage.unreliableSec > 0` confirmed (non-vacuity: this stream's `coveredSec` genuinely shrank under Phase 33's widening)
- `coveredSec = 3,548`, `bucketedSec = 3,548`, `unbucketedCoveredSec = 0` — identity holds exactly

**Clean control (10146303423), histogram**: `classifyGaps(t,d).unreliableSec === 0` confirmed; `computePaceDistribution` output proven byte-for-byte identical (`toEqual`) through the real detector path and the `vi.doMock`-stubbed-to-`[]` path.

## Zero-call-site-change audit

Phase-33 base commit: `6772dca5` (`docs(33): begin phase execution`, the commit immediately preceding plan 33-01's first task commit `a3e2bba7`).

```
git log --oneline 6772dca5..HEAD -- src/dashboard/views/detail-charts-logic.ts   → (empty)
git log --oneline 6772dca5..HEAD -- src/dashboard/views/detail-zones.ts          → (empty)
git log --oneline 6772dca5..HEAD -- src/dashboard/views/detail.ts                → (empty)
git diff --stat 6772dca5..HEAD -- detail-charts-logic.ts detail-zones.ts detail.ts → (empty)
```

All three render-side files this phase's D-12 amendment names are confirmed byte-identical to their state before Phase 33 began — the clipping/exclusion behaviour this plan proves is wholly inherited through `pace-derivation.ts`'s widened `classifyGaps`, exactly as D-02 claims.

## Test counts

- `npx vitest run detail-charts-logic.test.ts -t "unreliable"`: **12 passed, 0 failed** (39 skipped, non-matching)
- `npx vitest run detail-charts-logic.test.ts` (whole file): **51 passed, 0 failed**
- `npx vitest run detail-zones.test.ts -t "unreliable"`: **9 passed, 0 failed** (36 skipped, non-matching)
- `npx vitest run detail-zones.test.ts` (whole file): **45 passed, 0 failed**
- `npm test` (full suite, post both tasks): **91 files (83 passed, 7 failed, 1 skipped); 2,756 tests (2,730 passed, 3 failed, 23 skipped)** — the same 7-file/3-test ENOENT set 33-01-SUMMARY.md documented as pre-existing and environmental in this bare worktree (`data/stats/gear-aggregate.json`, `data/stats/training-load.json`, `data/stats/year-over-year.json`, `data/stats/pace-quality/{4556693525,17257505831,i184264408}.json`), unrelated to this plan's files. Delta vs. plan 33-01's recorded baseline (91 files / 2,735 tests): 0 files, +21 tests — exactly this plan's own 12 (Task 1) + 9 (Task 2) new cases.

## No planning-figure literals used as assertion values

Confirmed by direct grep of both modified test files: no numeric figure from `CONTEXT.md`, `RESEARCH.md`, `VALIDATION.md`, `PROJECT.md` or `32-CALIBRATION.md` appears anywhere in the new code (assertion values or comments) — only doc-NAME references (`33-CONTEXT.md`) for context, never a quoted number. The one place a planning figure is compared is the SUMMARY prose above (reconciliation against PROJECT.md's "25-52 m in 2-5 s... km 6.9-7.7"), not inside the test files, and it is an explicit reconciliation-with-named-difference, never an equality assertion.

## Decisions Made

- Clean control chosen by a throwaway `node` scan (not committed) of the whole committed archive for `classifyGaps(t,d).unreliableSec === 0`, span >= 30 min, normal average pace (1.5-6 m/s): **10146303423** selected (span 2,559 s / 42.6 min, 2,545 samples, fully covered — zero recording-gap and pause seconds too, avgMps 2.77). Pinned as the literal id in both test files; plans 33-11/33-12 must reuse the same id per the plan's own instruction.
- Independent fastest-pace hand computation shares only `adaptiveWindowSec`'s resolved WIDTH with production (read from the helper, never hardcoded) — the EXTENT (window clamping at gaps, interpolation) is a fresh implementation (`handInterp`, distinct from `interpValueAtTime`), never calling `derivePaceSeriesGapAware`/`buildChannelSeries`/`computePaceDistribution`.
- Detector segment ground truth obtained via `classifyGapsThreeWay(t,d)` → `detectUnreliableSegments(...)`, called directly in-test (the documented pre-detector seam, D-14) rather than read back from `classifyGaps`' own post-detector `gapIntervals` — an independent re-derivation, not a self-agreement check.
- Task 2's histogram proof needed a THIRD assertion beyond the plan's own two named checks (band-absence, fastest-bucket-edge) because both proved insensitive to the WR-01 segment-start-leak defect class during the watched-failing mutation (see Deviations). Added the accounting-identity check (`bucketedSec <= coveredSec`) as the actual load-bearing discriminator for this task's central claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's segment-membership null-check asserted against the wrong value — did not exercise `buildChannelSeries` at all**
- **Found during:** Task 1, the mandated watched-failing demonstration (temporarily passing `{ clipAtGaps: false }` into `detail-charts-logic.ts`'s `derivePaceWithCoverage` call)
- **Issue:** The first-draft "every sample index strictly inside a detected segment has a null pace value" test checked `derived.paceSeries[i]` — a value from a `derived` object computed by the TEST's own separate `derivePaceWithCoverage(stream)` call, never touching `buildChannelSeries`'s output at all. Under the mutation, this test stayed GREEN (since `derived` was unaffected by the mutation, which only lived inside `detail-charts-logic.ts`), proving it could pass even if `buildChannelSeries`'s forwarding were completely broken — the exact vacuous-proof failure mode the plan's own proof-quality bar exists to catch.
- **Fix:** Rewrote the assertion against `chartPoints` (the CHART's own `{x,y}` output): built a `Set` of rendered x-values and asserted `stream.t[i]` is absent from it, for every strictly-inside index. Re-ran the mutation: this rewritten test now correctly failed red; reverted the mutation (`git diff --exit-code` clean) and re-confirmed green.
- **Files modified:** `src/dashboard/views/detail-charts-logic.test.ts`
- **Verification:** `npx vitest run detail-charts-logic.test.ts -t "unreliable"` — 12/12 passed after the fix and revert
- **Committed in:** `ad856c2c`

**2. [Rule 1 - Bug] Task 2's two named discriminators (band-absence, fastest-bucket-edge) proved insensitive to the WR-01 segment-start-leak defect class**
- **Found during:** Task 2, the mandated watched-failing demonstration (temporarily dropping `'unreliable'`-kind entries from the `gapIntervals` array passed to `paceHistogramSamples` inside `detail-zones.ts`'s `computePaceDistribution`)
- **Issue:** Under the mutation, `computePaceDistribution` leaked exactly 5 extra samples (each isolated jump's own boundary start sample — the case `pace-derivation.ts`'s own docblock names: "a segment's OWN START falls inside a gap interval... a naive `paceSeries[i] === null` check misses [this]"). All 8 originally-planned assertions stayed GREEN, because none of the 5 leaked values (462, 297, 377, 282, 160 sec/km) fell in the 70-100 sec/km band or beat the existing fastest bucket.
- **Fix:** Added a ninth assertion: `computePaceDistribution`'s total bucketed seconds must never exceed `derived.coverage.coveredSec` (the accounting-identity invariant `paceHistogramAccounting` already names — `unbucketedCoveredSec` going negative is the "different and worse defect" its own docblock warns about). Re-ran the mutation: this new assertion correctly failed red (`3584 > 3569`, `unbucketedCoveredSec = -15`); reverted the mutation (`git diff --exit-code` clean on all three render-side files) and re-confirmed green.
- **Files modified:** `src/dashboard/views/detail-zones.test.ts`
- **Verification:** `npx vitest run detail-zones.test.ts -t "unreliable"` — 9/9 passed after the fix and revert
- **Committed in:** `c033d2ca`

**3. [Rule 3 - Blocking] Fixed a pre-existing single-source-of-truth audit violation this plan's own required `npm test` run surfaced — introduced by Task 1's already-committed hand computation**
- **Found during:** Task 2, running the plan's own mandated `npm test` verification step
- **Issue:** `pace-single-source.test.ts`'s `findStreamPaceViolations` scan bans the exact literal `elapsed / (metres / 1000)` anywhere outside `pace-derivation.ts` (the historical two-divergent-implementations defect shape) — a rule that deliberately does NOT exempt `*.test.ts` files. Task 1's `independentFastestPaceSecPerKm` helper (already committed in `ad856c2c`) used exactly this literal text for its hand computation, and Task 2's identical helper (duplicated per this codebase's per-file fixture-helper convention) reproduced it — both files failed the audit.
- **Fix:** Reformulated the arithmetic as `(windowElapsedSec * 1000) / windowMetres` (mathematically identical, structurally distinct literal text) in both `detail-charts-logic.test.ts` and `detail-zones.test.ts`, with a comment explaining why the exact production literal is deliberately avoided.
- **Files modified:** `src/dashboard/views/detail-charts-logic.test.ts`, `src/dashboard/views/detail-zones.test.ts`
- **Verification:** `npx vitest run pace-single-source.test.ts detail-charts-logic.test.ts detail-zones.test.ts` — 180/180 passed; full `npm test` re-run clean of this failure
- **Committed in:** `c033d2ca` (committed together with Task 2's own new tests, since both files needed the same fix and it was discovered while validating Task 2)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug/proof-quality corrections, 1 Rule 3 blocking cross-file fix)
**Impact on plan:** All three were required for the plan's own stated proof-quality bar (failable, independently-asserted) and for `npm test` (the plan's own verification step) to pass. None touch production code — `detail-charts-logic.ts` and `detail-zones.ts` were mutated only temporarily, for the mandated watched-failing demonstrations, and reverted before every commit (`git diff --exit-code` clean, confirmed each time). No scope creep into `detail.ts` or any file outside this plan's declared two-file scope.

## Issues Encountered

None beyond the three deviations above, which were themselves the proof-quality work this plan exists to do.

## Next Phase Readiness

- PACE-08's central claim (chart and histogram inherit clipping with zero call-site change) is now evidenced on real streams, not merely argued from source reading — ready for plan 33-11 to draft the browser checkpoint rows using this plan's recorded independently-derived fastest-pace values (2:53/km, 3:51/km, 2:40/km) and the pinned clean-control id (10146303423).
- No blockers. `data/streams/` untouched (this plan reads only, per its own threat model). `detail-charts-logic.ts`, `detail-zones.ts` and `detail.ts` are confirmed byte-identical to their pre-Phase-33 state.
- PACE-08 is NOT ticked by this plan (requirement-tick safety, stated in the plan's own objective) — plan 33-13 alone sets its disposition, gated on rendered checkpoint evidence.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/detail-charts-logic.test.ts`
- FOUND: `src/dashboard/views/detail-zones.test.ts`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-06-SUMMARY.md`
- FOUND commit: `ad856c2c`
- FOUND commit: `c033d2ca`
