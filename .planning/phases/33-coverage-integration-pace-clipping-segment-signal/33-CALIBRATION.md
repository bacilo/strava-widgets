# Phase 33 Plan 8: D-07 severity-tier calibration (SEG-06)

Regenerate with `npm run build && npm run compute-unreliable-segment-severity-calibration`. This artifact carries no wall-clock timestamp or generated-at field — a re-run against an unchanged archive is byte-identical.

## Statistic

For each activity with at least one detected unreliable segment, `excessFraction = sum(segment.excessMetres) / (d[n-1] - d[0])` — the summed merged-segment excess over the activity's own total distance (D-07: a fraction of the activity's OWN distance, never unreliable-seconds over span). The candidate cut is `quantile(sortedAsc(excessFractions), q)` for `q` drawn in order from `[0.9, 0.95, 0.97, 0.99]`; the smallest passing candidate wins.

## Non-circularity

The cut is derived from the flagged cohort's own excess-fraction population — 699 of 1874 activities with at least one detected segment (cohort size 699, 0 not computable within it). This population IS the population the cut later judges (every flagged activity's own fraction), so a percentile of it is PARTIALLY circular by construction — stated plainly here rather than argued away. The insensitivity check below is what adjudicates whether that partial circularity is disqualifying: a candidate clears D-13 only when removing its own top decile, or planting extreme synthetic contamination, barely moves it — evidence the cut is not merely restating an arbitrary rank of its own judged population.

## Candidate excess-fraction cuts (D-13 insensitivity)

Tolerance: 1%. Selection rule: the SMALLEST `q` whose both deltas clear the tolerance wins — never the count or severe rate it produces.

| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| 0.9 | 699 | 0.008839 | 0.004388 (629) | 50.3521% | 0.015541 (724) | 75.8232% | FAIL |
| 0.95 | 699 | 0.020290 | 0.005906 (629) | 70.8950% | 0.031423 (724) | 54.8636% | FAIL |
| 0.97 | 699 | 0.024554 | 0.006530 (629) | 73.4042% | 1.088558 (724) | 4333.4014% | FAIL |
| 0.99 | 699 | 0.035714 | 0.008123 (629) | 77.2560% | 1.088558 (724) | 2948.0047% | FAIL |

## NO CANDIDATE CLEARS

None of `[0.9, 0.95, 0.97, 0.99]` cleared the 1% tolerance in both directions — see the candidate table above for every measured delta. No constant is named; this is a HALT condition for a developer decision (33-08-PLAN.md Task 3 step 5), not a widened candidate list or a loosened tolerance chosen unilaterally.

## Why not a tail percentile of the population itself

The deliberately circular strawman — `quantile(excessFractions, 0.99)`, a raw tail percentile of the excess-fraction population ITSELF — is run through the identical two-direction insensitivity check as every real candidate:

| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| 0.99 | 699 | 0.035714 | 0.008123 (629) | 77.2560% | 1.088558 (724) | 2948.0047% | FAIL |

**FAILED** — removedDelta 77.2560%, plantedDelta 2948.0047%, both measured against the 1% tolerance. The strawman's own top rank moves with its own top decile and with planted contamination close to exactly as much as removing or planting would move any other tail percentile of the same population — it fails for the same structural reason Phase 32's two strawmen did.

## Archive-wide severe/minor/none distribution (reported finding)

Not computed — no candidate cleared the tolerance, so no cut exists to classify against.

## Inputs

- Streams scanned: 1874, not computable: 0
- Flagged cohort: 699 activities with ≥1 detected segment (cohort size 699, 0 not computable within it)
- Candidate outer percentiles: [0.9, 0.95, 0.97, 0.99]
- Insensitivity tolerance: 1%
- Planted-synthetic batch: 25 values at 10x the population's own maximum
- Detector constants (imported, never re-derived here): speedLimitMps=7.35, excessFloorMetres=3, hiddenPauseMinMetres=116.95
