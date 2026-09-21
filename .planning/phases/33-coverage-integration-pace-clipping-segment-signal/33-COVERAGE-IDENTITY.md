# Phase 33 — Coverage Identity Recount (COV-03)

Machine-written by `npm run compute-coverage-identity-recount`; never hand-edit. Regenerating this file against an unchanged archive and an unchanged git commit produces a byte-identical result — no wall-clock timestamp appears anywhere below.

## Method

The archive-wide four-way identity (`coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec`) is a structural property of an exhaustive, mutually-exclusive pair partition — it holds even if the WRONG pairs were classified `unreliable`, because the partition shape guarantees the sum regardless of which pairs land in which bucket. It alone would NOT have discharged COV-03. The load-bearing check below instead compares the shipped `unreliableSec` against `recountActivity`'s own total, a gap-first, per-segment-run-enumeration traversal that shares no code with the detector module or with `pace-derivation.ts`'s own pass-2/pass-3 arithmetic — the only shared surface is the shipped classifier itself, read once per activity through `readShippedCoverage`, the ONE function in `scripts/compute-coverage-identity-recount.mjs` permitted to call it, structurally confined there by a scoped-import guard test.

## Archive-wide identity

Streams scanned (`isStreamFile`, excluding `manifest.json`): **1874**. Computable (pass this recount's own `checkStream`): **1874**. Skipped: **0**.

Identity violations (expected 0): **0**

_None — the four-way identity held on every computable stream._

## Recount agreement (the load-bearing check)

Recount mismatches (expected 0): **0**

_None — the shipped unreliableSec matched this recount's own total on every computable stream._

Activities carrying any unreliable time: **699** of 1874. Total unreliable seconds (this recount's own sum): **16020.0 s**.

| Mechanism | Activities | / stream files | Segments | Metres | Seconds |
|---|---|---|---|---|---|
| gap-adjacent | 63 | 63 of 1874 (3.4%) | 85 | 12730.8 m | 11574.0 s |
| hidden-pause | 54 | 54 of 1874 (2.9%) | 97 | 25716.3 m | 1364.0 s |
| isolated-jump | 645 | 645 of 1874 (34.4%) | 1162 | 39468.3 m | 3082.0 s |
| total (distinct activities) | 699 | 699 of 1874 (37.3%) | 1344 | 77915.4 m | 16020.0 s |

_Per-mechanism activity counts may sum to more than the distinct total above — one activity can carry segments of more than one mechanism._

## Time movement (D-01)

Computed as the archive-wide sum, per activity, of `classifyGapsThreeWay(t, d)` (pre-detector) minus this recount's own `readShippedCoverage(t, d)` read (shipped, post-detector) on the same stream:

- Seconds moved OUT of `recordingGapSec`: **10665.0 s**
- Seconds moved OUT of `pauseSec`: **587.0 s**
- Seconds moved OUT of `coveredSec`: **4768.0 s**

Per mechanism: only `gap-adjacent` can move recording-gap/pause seconds — a `hidden-pause`/`isolated-jump` segment has `gapCount === 0` by the detector's own construction (it touches no pre-detector gap of either kind), so its seconds move exclusively out of `coveredSec`. The archive-wide `gap-adjacent` mechanism total from the table above (**11574.0 s**, 63 activities) is the whole merged-segment total (burst seconds + gap seconds combined, D-01's own rule) — it is NOT the same figure as `recordingGapMovedSec` alone (that figure is the gap PORTION only), but the two are related: `recordingGapMovedSec` is bounded above by the gap-adjacent mechanism's own total seconds, since the gap portion of a gap-adjacent segment can be no larger than the segment itself.

Reconciliation against `32-CALIBRATION.md`'s own "Figures of record (D-16)" reference (63 gap-adjacent activities, 85 segments, 12730.8 m, **11574.0 s**, recorded 2026-09-21): this run measured 63 gap-adjacent activities, 85 segments, 12730.8 m, 11574.0 s. Any difference from the 32-CALIBRATION.md reference is attributed to archive growth (nightly CI commits) between that artifact's generation and this run, per this project's standing MERGE-01/D-16 reconciliation discipline — the reference is cited, never asserted equal.

## Tier migration (D-05)

Before (two-term numerator, pre-widening: `(recordingGapSec + pauseSec) / spanSec`) vs after (three-term numerator, shipped: `(recordingGapSec + pauseSec + unreliableSec) / spanSec`) `gapProfile` tier, bucketed via the SAME frozen thresholds `gapProfileSignal` ships with (`GAP_PROFILE_SEVERE_FRACTION = 0.2`, `GAP_PROFILE_MINOR_FRACTION = 0.05`) — reported as a finding EVEN THOUGH it is non-zero. Neither constant was moved by this widening (Phase 27's D-02 anti-quota rule: a constant is never moved to change a count); this section measures the effect of the WIDENED NUMERATOR alone, holding both thresholds fixed.

| Before \ After | none | minor | severe | not-computable |
|---|---|---|---|---|
| none | 1404 | 3 | 0 | 0 |
| minor | 0 | 340 | 0 | 0 |
| severe | 0 | 0 | 127 | 0 |
| not-computable | 0 | 0 | 0 | 0 |

Activities with a changed tier: **3** of 1874 computed (0 skipped as non-computable streams).

## Inputs

- Stream directory: `data/streams/`
- Stream files scanned (`isStreamFile`, excluding `manifest.json`): **1874**
- Constants used — `speedLimitMps`: 7.35 m/s, `excessFloorMetres`: 3 m, `hiddenPauseMinMetres`: 116.95 m, all parsed from `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`'s own "## Chosen constants" table (never hand-copied literals) — `LOCAL_GAP_THRESHOLD_SEC`: 10 s, a local literal duplicate of `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts`).
- Git commit this run was made at: `adb5e66539fd6b97b204dd45e6b49c9cb01cfbda`

Regenerate this artifact against the live committed archive with:

```
npm run compute-coverage-identity-recount
```
