# Phase 26 PACE-06 Residual Report

The residue the adaptive gap-aware derivation (`src/analytics/pace-derivation.ts`) does not fix, quantified rather than smoothed into plausibility (PACE-06, D-19). This is the committed, regenerable deliverable Phase 27 consumes as pre-flagged input and re-derives at its own boundary — see `npm run compute-pace-residual` below.

**Generated:** 2026-09-08T20:50:09.093Z

## Cohort Definition

The severe stair-step cohort: more than 15% of consecutive samples have zero distance advance (`d[i] <= d[i-1]`), AND the stream has at least 50 samples (the 50-sample floor excludes one degenerate near-empty manual-entry stream, `11865310195`, which would otherwise raise the cohort by one).

## Window Formula (D-03: every figure states the window it was measured under)

Every "after" figure below is measured under the adaptive averaging window `max(20, 2.5 x p90(advance intervals))`, resolved per activity from that activity's own distance-advance-interval distribution (`adaptiveWindowSec`), with the pace series clipped at gap boundaries and the fast-mass fraction restricted to covered time only.

## Summary

- Archive size scanned: 1866
- Severe stair-step cohort size: 154
- Residual count (after fast mass > 0.5% of covered time): 14
- Max residual: 2.44%

## Residual Activities

| Activity ID | After % (covered time) | Baseline % (unfixed per-sample) | Window (s) | Note |
|---|---|---|---|---|
| 4556693525 | 2.44% | 22.39% | 20.00 | Also the PACE-04 worked example |
| 5059204779 | 1.17% | 100.00% | 150.00 | — |
| 3925007542 | 0.63% | 19.96% | 20.00 | — |
| 3647739864 | 0.62% | 61.36% | 221.00 | — |
| 4548213751 | 0.59% | 17.40% | 20.00 | — |
| 5520899318 | 0.57% | 15.85% | 20.00 | — |
| 5566805363 | 0.57% | 12.48% | 20.00 | — |
| 4531479183 | 0.57% | 15.14% | 20.00 | — |
| 5465833080 | 0.57% | 16.97% | 20.00 | — |
| 5246078056 | 0.56% | 10.18% | 20.00 | — |
| 4569639779 | 0.55% | 11.90% | 20.00 | — |
| 4667351283 | 0.54% | 21.74% | 20.00 | — |
| 3789623232 | 0.51% | 9.42% | 20.00 | — |
| 4332544744 | 0.51% | 28.43% | 20.00 | — |

## Criterion 1 Reconciliation

Amended rule (D-19 / 26-RESEARCH.md Pitfall 2): the after-value is strictly lower than that same activity's own baseline, OR both are exactly zero — a literal "strictly lower for all" reading is unsatisfiable for any activity whose baseline is already 0.00%.

- Strictly improved: 153
- Tied at zero: 1
- Regressed: 0

Ties (baseline and after both exactly 0.00%), named by ID:

| 3475742397 |

## Notes

Activity `4556693525` appears both as the PACE-04 worked example (the shipped phantom-fast-mode fix) and, if its after-value exceeds 0.5%, in this residual list. That is consistent rather than a measurement error — 26-RESEARCH.md Open Question 2 records that the same activity legitimately holds both roles.

## Regeneration

Regenerate this report against the live committed archive with:

```
npm run compute-pace-residual
```
