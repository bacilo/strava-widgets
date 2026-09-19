---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 04
subsystem: ui
tags: [pace-derivation, detail-view, vitest, chart, histogram, gap-aware]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "derivePaceWithCoverage/paceHistogramSamples/interpValueAtTime/PACE_WINDOW_FLOOR_SEC (26-02) and loadPinnedStream's worked-example archive fixture (26-03)"
provides:
  - "detail-charts-logic.ts's derivePaceSeries/interpValueAtTime as thin wrappers/re-exports over the shared module — no pace arithmetic left in this file"
  - "detail-zones.ts's computePaceDistribution as a consumer of an already-derived PaceDerivationResult, gap-segment-masked before delegating to paceHistogramSamples"
  - "detail.ts's single per-render derivePaceWithCoverage call feeding both the histogram and the coverage caption (D-16)"
affects: [26-05, 26-06, 26-08, 26-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-segment masking before paceHistogramSamples: mask paceSeries[i] to null when segment [t[i], t[i+1]] starts inside a gapInterval, so a smoothing window's deliberately non-null trailing sample (kept for a continuous chart line) does not leak its forward gap segment's dt into a covered-looking histogram bucket"
    - "node:fs-direct fixture read inside src/dashboard/*.test.ts (mirroring records-logic.test.ts/trends-cadence-hr-logic.test.ts) instead of importing analytics/pace-fixtures.ts, to respect that module's src/dashboard/-wide (including test files) import-boundary guard"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-charts-logic.ts
    - src/dashboard/views/detail-zones.ts
    - src/dashboard/views/detail.ts
    - src/dashboard/views/detail-charts-logic.test.ts
    - src/dashboard/views/detail-zones.test.ts

key-decisions:
  - "Gap-segment masking fix lives in detail-zones.ts (this plan's own file), not in pace-derivation.ts's paceHistogramSamples, because pace-derivation.ts is owned by the concurrently-executing sibling plan 26-07 — see Deviations."
  - "PACE-04 worked-example loads in both test files read data/streams/4556693525.json directly via node:fs rather than importing analytics/pace-fixtures.ts's loadPinnedStream, since that module's own import-boundary guard (D-20) forbids ANY file under src/dashboard/ — including test files — from importing it; the guard test does not distinguish production from test sources."
  - "Replaced the original 60s/1s raw-per-segment weighting test and the 3-tiny-segment ascending-bucket test with equivalent-intent tests using longer, densely-sampled fixtures, since the shared derivation's minimum 20s smoothing window makes any segment far shorter than 20s bleed into its neighbours — the raw-segment assertions could not survive the signature change as originally written."

requirements-completed: [PACE-01, PACE-04]

# Metrics
duration: ~50min
completed: 2026-09-08
---

# Phase 26 Plan 04: Collapse Chart and Histogram onto the Shared Pace Derivation Summary

**Chart and histogram both now read `derivePaceWithCoverage`'s single gap-aware, windowed series — with an in-file gap-segment mask that fixes a shipped-but-undiscovered histogram/coverage mismatch the sibling module didn't catch.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (all extended; no new files)

## Accomplishments

- `detail-charts-logic.ts` no longer owns any pace arithmetic: `interpValueAtTime` is re-exported verbatim from `pace-derivation.ts`, `derivePaceSeries` is a thin `classifyGaps` + `derivePaceSeriesGapAware` wrapper preserving its `(t, d, windowSec)` call shape, and `PACE_SMOOTHING_WINDOW_SEC` is now `PACE_WINDOW_FLOOR_SEC` re-exported under its old name. Verified byte-for-byte equivalent to `derivePaceWithCoverage(...).paceSeries` on the pinned worked example (0 mismatches across 1,682 samples).
- `detail-zones.ts`'s `computePaceDistribution` takes `(derived: PaceDerivationResult, t, bucketWidthSec)` and delegates to `paceHistogramSamples` — no more `dt / (dd / 1000)`, no more `dd <= 0` skip. Bucket totals now sum exactly to `derived.coverage.coveredSec`.
- `detail.ts` calls `derivePaceWithCoverage(detail.stream)` exactly once per render (D-16), feeding both `computePaceDistribution` and (via `derived`, ready for plan 26-06) the coverage caption. `computeSplits(detail.stream)` and its call site are byte-unchanged (D-17).
- On the pinned worked example 4556693525: fast-mass (<180 sec/km) is 2.4% (<=5% target), the modal bucket's `minSecPerKm` is 330 (inside the [300,375] independent-reference band derived from this run's own 5:35 overall split), and no bucket at or above 450 sec/km carries more than 1.52% of bucketed time (<=2% target) — the phantom fast cluster and spurious slow buckets are measurably gone.
- Found and fixed, within this plan's own scope, a real defect in how the shared module's pieces compose: `derivePaceSeriesGapAware`'s window-clipping deliberately leaves the LAST sample before a gap non-null (a shrunk-but-valid window, for a continuous-looking chart line), but that sample's own FORWARD segment IS the gap. Passing `derived.paceSeries` straight to `paceHistogramSamples` therefore misattributed the gap's own `Δt` to a covered-looking pace bucket — measured as 3394s bucketed vs 3363s `coveredSec` (31s of misattributed gap time) on the worked example before the fix, exact match after.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire the chart and the histogram onto the shared derivation** - `acc0c81a` (feat)
2. **Task 2: Update the existing zone and chart tests and pin PACE-04's phantom-mode elimination** - `3ae2ad9a` (test) — includes the gap-segment-masking fix to `detail-zones.ts`, discovered while writing this task's exact-sum test (see Deviations)

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

## Files Created/Modified

- `src/dashboard/views/detail-charts-logic.ts` — deleted the local `interpValueAtTime` body and `derivePaceSeries`'s raw-window arithmetic; both now delegate to `../../analytics/pace-derivation.js`. `PACE_SMOOTHING_WINDOW_SEC` is `PACE_WINDOW_FLOOR_SEC` re-exported.
- `src/dashboard/views/detail-zones.ts` — `computePaceDistribution` rebuilt as a consumer of `PaceDerivationResult` via `paceHistogramSamples`, with a local gap-segment mask (see Deviations) applied before delegating. `computeHrZoneTimes`/`parseAthleteConfig` untouched.
- `src/dashboard/views/detail.ts` — single `derivePaceWithCoverage(detail.stream)` call feeds `computePaceDistribution(derived, detail.stream.t)`; splits call site untouched.
- `src/dashboard/views/detail-charts-logic.test.ts` — added the one-derivation equivalence assertion (`derivePaceSeries` vs `derivePaceWithCoverage(...).paceSeries` on the worked example); all prior `interpValueAtTime`/`derivePaceSeries` assertions preserved (they exercise densely-sampled fixtures unaffected by gap classification, so behavior was unchanged).
- `src/dashboard/views/detail-zones.test.ts` — full rewrite of the `computePaceDistribution` describe block for the new signature (8 tests) plus a new PACE-04 worked-example describe block (3 tests); `parseAthleteConfig`/`computeHrZoneTimes` blocks untouched.

## Call Sites Changed (for plan 26-05's single-source audit)

- `detail-charts-logic.ts:61` `PACE_SMOOTHING_WINDOW_SEC` — now re-exports `pace-derivation.ts`'s `PACE_WINDOW_FLOOR_SEC`.
- `detail-charts-logic.ts` local `interpValueAtTime` (was module-private) — deleted, re-exported from `pace-derivation.ts`.
- `detail-charts-logic.ts` `derivePaceSeries` — body replaced with a `classifyGaps` + `derivePaceSeriesGapAware` wrapper; call shape (`t, d, windowSec`) unchanged, so `buildChannelSeries`'s own call site is untouched.
- `detail-zones.ts` `computePaceDistribution(stream, bucketWidthSec?)` -> `computePaceDistribution(derived, t, bucketWidthSec?)` — signature change; the sole caller (`detail.ts:685`) updated in lockstep.
- `detail.ts:679` (old) `computePaceDistribution(detail.stream)` -> `detail.ts:685` `computePaceDistribution(derived, detail.stream.t)`, preceded by the new `const derived = derivePaceWithCoverage(detail.stream);` at `detail.ts:680`.
- `detail.ts:677` `buildSplitsSection(splits, paceSecPerKm)` and `detail.ts:676` `computeSplits(detail.stream)` — byte-unchanged (D-17, verified by grep in acceptance criteria).

## Existing Assertions Restated (task 2, per plan's own instruction)

- **detail-zones.test.ts, "buckets a constant 5 m/s, 1000s stream"**: original fixture was 2 samples 1000s apart — `classifyGaps`' 10s recording-gap threshold would classify the WHOLE stream as one gap. Restated with 5s sample spacing; same expected bucket/label/timeSec.
- **detail-zones.test.ts, "weights a 60s segment as 60s and a 1s segment as 1s"**: original 3-sample fixture (dt=60 for segment A) is itself a recording gap under the new threshold, and even if it weren't, the shared derivation's 20s+ smoothing window blends short adjacent segments together, making an exact per-segment `timeSec` assertion meaningless. Replaced with a discriminator fixture (21 dense 1s samples over 20s at 200 sec/km vs 9 sparse 9s samples over 81s at 1000 sec/km): a sample-count-weighted (bugged) implementation would give the dense-but-short region ~70% of the histogram; the actual Δt-weighted result gives the sparse-but-long region >50% and the dense-but-short region <20% — the opposite majority, a stronger discriminator than the original.
- **detail-zones.test.ts, "returns buckets in ascending pace order... [195, 390, 600]"**: original used three 1-second segments — with a 20s+ smoothing window vastly larger than the whole 3-second stream, every index would resolve to nearly the same averaged pace, collapsing to ~1 bucket instead of 3. Replaced with three 150s, densely-sampled (2s spacing) constant-pace segments (400/200/600 sec/km) — each far longer than the smoothing window, so each segment's own core still resolves to a clean, dominant, distinct bucket (measured 132s/142s/140s respectively, each asserted `>120`), with the original ascending-order and non-collapse intent both preserved.
- **detail-zones.test.ts, "formats an exact 4:00/km bucket boundary... 4:00–4:15/km"**: original used 2 samples targeting exactly 240 sec/km. Densified to 24 dense (10s) samples for realism, which introduces floating-point interpolation noise unstable exactly AT a bucket boundary (measured: split across two adjacent buckets). Restated targeting 250 sec/km — safely inside the same 240-255 bucket — preserving the label-formatting assertion this test exists to pin.
- **detail-zones.test.ts, "excludes a zero-distance (standstill) segment... Infinity"**: original 3-sample standstill fixture is too short/sparse to trigger `classifyGaps`' pause classification at all (its flat-run duration doesn't exceed the derived pause threshold), so under the new derivation it produces THREE distinct finite (not excluded) pace values rather than one bucket. Replaced with an advance/genuine-pause/advance fixture properly satisfying the pause threshold (40s flat, `classifyGaps` correctly classifies it `pause`), asserting: no `Infinity`/`NaN` ever, `pauseSec≈40`, `coveredSec≈120`, and bucket-sum equals `coveredSec` exactly — this is a stronger, more accurate test of the original's "never bucket an Infinity pace" intent, now exercising the real exclusion mechanism (`classifyGaps`) rather than a bypassed `dd<=0` check.
- **detail-charts-logic.test.ts**: no assertions lost — all prior `derivePaceSeries`/`interpValueAtTime` tests use densely-sampled (1s) fixtures with no dt exceeding the recording-gap threshold, so behavior is byte-identical to before; only the new equivalence assertion was added.

## Decisions Made

- Kept the gap-segment-masking fix inside `detail-zones.ts` rather than editing `paceHistogramSamples` in `pace-derivation.ts`, because that file is owned by the concurrently-executing sibling plan 26-07 (per the worktree concurrency contract). The fix is a pre-filter on `derived.paceSeries` before delegating to the shared `paceHistogramSamples` primitive, so the shared Δt-weighting logic itself remains untouched and single-sourced.
- Both PACE-04 worked-example fixture loads (`detail-zones.test.ts`, `detail-charts-logic.test.ts`) read `data/streams/4556693525.json` directly via `node:fs` rather than importing `analytics/pace-fixtures.ts`'s `loadPinnedStream`, because that module's own `pace-fixtures.test.ts` import-boundary guard scans ALL `.ts` files under `src/dashboard/` (test files included) and fails if any imports it — confirmed by running the full suite with the import in place (2 offending files reported) before switching to the `node:fs` pattern already established in `records-logic.test.ts`/`trends-cadence-hr-logic.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gap segments silently re-included in the histogram via a non-null pre-gap sample**
- **Found during:** Task 2, while writing the exact `sum(bucket.timeSec) === derived.coverage.coveredSec` identity test the plan itself specifies.
- **Issue:** `derivePaceSeriesGapAware`'s window-clipping (shipped by plan 26-02) deliberately leaves the sample immediately before a gap non-null — its window shrinks to end exactly at the gap boundary rather than resolving to `null`, so the CHART shows a continuous pace line right up to the gap edge. But `paceHistogramSamples` pairs each sample's pace with its FORWARD segment's `Δt` (`[t[i], t[i+1]]`), and that forward segment for the pre-gap sample IS the gap itself (classified `recording-gap`/`pause` by `classifyGaps`, not `covered`). Calling `paceHistogramSamples(t, derived.paceSeries)` unmodified therefore attributed the gap's own duration to a covered-looking bucket. Measured directly on the worked example: 3394s of bucketed time vs 3363s `coveredSec` — the full 31s of the stream's two recording gaps (18s + 13s) fully misattributed.
- **Fix:** Added a local mask in `detail-zones.ts`'s `computePaceDistribution`: for each index `i`, if the segment `[t[i], t[i+1]]` starts inside any `derived.coverage.gapIntervals` entry, force `paceSeries[i]` to `null` before calling `paceHistogramSamples`. Re-measured: 3363s bucketed exactly equals 3363s `coveredSec` — exact match. All PACE-04 threshold assertions (fast-mass, modal bucket, slow-bucket ceiling) re-verified with the fix in place and still pass comfortably inside their target bands.
- **Files modified:** `src/dashboard/views/detail-zones.ts`
- **Verification:** `npx vitest run src/dashboard/views/detail-zones.test.ts` — the exact-sum test and the standstill/pause test both assert `toBe`/exact equality against `coveredSec` and pass; `npm run test` shows no regressions beyond the pre-existing worktree-artifact failures (see Next Phase Readiness).
- **Committed in:** `3ae2ad9a` (Task 2's commit — discovered while writing Task 2's own tests, so folded into that commit per the shared deviation process)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** A correctness fix confined to this plan's own file (`detail-zones.ts`), required to satisfy this plan's own stated acceptance criteria (the exact `coveredSec` identity). No edit to `pace-derivation.ts` (owned by the concurrent 26-07 plan). No scope creep — the mask is a pre-filter over an existing shared primitive's output, not a new implementation of Δt-weighting.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes introduced. The gap-segment mask operates entirely on data already returned by `derivePaceWithCoverage`.

## Issues Encountered

- Initially imported `analytics/pace-fixtures.ts`'s `loadPinnedStream` directly into both test files for the worked-example fixture; this violated that module's own `src/dashboard/`-wide import-boundary guard (which scans test files too), caught immediately by running the full suite (`pace-fixtures.test.ts`'s negative-direction scanner failed, naming both offending files). Resolved by reading the committed stream file directly via `node:fs`, matching the pattern already established in `records-logic.test.ts` and `trends-cadence-hr-logic.test.ts`. No lasting impact — caught and fixed within Task 2, before committing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `detail-charts-logic.ts` and `detail-zones.ts` are both thin consumers of `pace-derivation.ts`; plan 26-05's single-source audit should find zero remaining `dt / (dd / 1000)` or `elapsed / (metres / 1000)` occurrences anywhere outside `pace-derivation.ts` itself (confirmed by this plan's own grep acceptance criteria).
- `detail.ts`'s `derived` (the `PaceDerivationResult` from the single per-render `derivePaceWithCoverage` call) is computed but not yet passed to `buildBreakdownSection` beyond the buckets — plan 26-06 is the one that extends that call with the coverage argument, per this plan's own scope boundary.
- The gap-segment-masking fix in `detail-zones.ts` is a workaround for a `pace-derivation.ts` composition gap (`paceHistogramSamples` doesn't itself know about `gapIntervals`). Plan 26-05's audit or a future `pace-derivation.ts`-owning plan may want to consider moving this masking into `paceHistogramSamples` itself (as an optional `gapIntervals` parameter) so every consumer gets it automatically rather than each caller needing to remember to mask — flagged here rather than done in this plan, since `pace-derivation.ts` was out of this plan's declared `files_modified` and owned by the concurrently-executing 26-07 plan.
- Pre-existing unrelated test failures (missing gitignored `data/dashboard/index.json`, `data/stats/*.json` compute artifacts in this fresh worktree) persist unchanged: 8 test files / 4 tests failing, none touching this plan's files (`verify-dashboard-publish-*.test.mjs`, `records-logic.test.ts`, `trends-*-logic.test.ts`) — not a regression introduced by this plan. `npx tsc --noEmit` exits 0 and `npm run build-widgets` exits 0.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail-charts-logic.ts
- FOUND: src/dashboard/views/detail-zones.ts
- FOUND: src/dashboard/views/detail.ts
- FOUND: .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-04-SUMMARY.md
- FOUND: acc0c81a (feat: rewire chart and histogram onto shared pace derivation)
- FOUND: 3ae2ad9a (test: pin PACE-04 phantom-mode elimination and dt-weighting identity)
