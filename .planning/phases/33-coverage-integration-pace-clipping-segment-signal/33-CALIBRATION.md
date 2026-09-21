# Phase 33 Plan 8: D-07 severity-tier calibration (SEG-06)

Regenerate with `npm run build && npm run compute-unreliable-segment-severity-calibration`. This artifact carries no wall-clock timestamp, generated-at field, or classifier source hash — provenance is content-addressed to `data/streams`' own git tree alone. A re-run against an unchanged archive and unchanged classifier behaviour is byte-identical, including after this file is committed. Plan 33-14 (D-16) supersedes plan 33-08's own derivation below, which stays on the record as a negative finding.

## Statistic

D-07's measured quantity is UNCHANGED by this plan: for each activity with at least one detected unreliable segment, `excessFraction = sum(segment.excessMetres) / (d[n-1] - d[0])` — the summed merged-segment excess over the activity's own total distance (never unreliable-seconds over span, rejected by 33-CONTEXT.md D-07). Only the DERIVATION of the severe-tier CUT changes (D-16): from an outer percentile of the flagged cohort itself (33-08, circular, see the recorded negative finding below) to the first of four pre-declared reference shapes clearing D-13 insensitivity, each read over ordinary folded covered steps and per-activity distances across ALL computable activities.

## Pre-declared reference shapes (D-16)

Fixed by 33-14-PLAN.md's `<predeclared_shapes>` text BEFORE any measurement (a counts-and-booleans existence probe only — no value, delta, or severe rate was looked at). If the implementation and that text ever disagree, the text wins.

### R1 — accumulated ordinary step noise

**Meaning:** The share of its own distance that an ordinary activity's sample-to-sample distance noise could plausibly accumulate to. Severe = the impossible excess is larger than that.

**Non-circularity:** `sigma_a` is a MEDIAN over thousands of ordinary residuals per activity (50% breakdown point), so the handful of burst steps a flagged activity carries cannot move it; the across-activity p90 is taken over every activity, most of which carry no segment at all; and nothing in the statistic references the speed limit, the floor, a segment, or the flagged set. Removing detected bursts changes `steps.length` and `totalDistanceM` by fractions of a percent; planting one burst into an activity adds one non-contiguous step that enters no residual.

**Caveats:** Disclosed model assumption: independent per-step errors accumulating as a random walk.

### R2 — own-distance step share, bulk-of-bulk

**Meaning:** The share of its own activity that one high-ordinary recorded step carries - the granularity at which the stream resolves distance at all. Severe = the impossible excess exceeds what a single ordinary sample step could ever account for.

**Non-circularity:** The population is every ordinary step of every activity (the population `statisticSA` and `deriveExcessFloor` both already proved bulk-dominated); a per-activity p95 over thousands of steps shifts by a rank or two when a few burst steps leave or arrive; no detector constant and no flagged membership enters it.

**Caveats:** Disclosed caveat: this is a SAMPLE-level scale, the same population `UNRELIABLE_EXCESS_FLOOR_M` was drawn from (its p10), so it sits closer to a detection scale than R1 does.

### R3 — bulk step over bulk distance

**Meaning:** One high-ordinary step as a share of a typical-length activity.

**Non-circularity:** The numerator is the very population `deriveExcessFloor` reads, measured at 0.00%/0.00% under this same removal-and-planting harness in 32-CALIBRATION.md; the denominator is a median over all activities of a quantity segments alter by well under 1%.

**Caveats:** Ranks below R2 because it judges every activity against a TYPICAL distance rather than through each activity's own distance (D-07's framing).

### R4 — hidden-pause boundary over bulk distance

**Meaning:** The share of a typical activity that a pause-scale distance lie represents.

**Non-circularity:** Neither factor is a statistic of the flagged cohort's excess fractions; the denominator is R3's.

**Caveats:** Ranks LAST on independence and inherited caveats: its numerator is a DETECTOR constant whose own derivation found no clean valley and fell back to the midpoint of an anchor interval whose upper end is 3475734189's own segment, so (a) its D-13 insensitivity is partly insensitivity-of-a-constant, weak evidence, and (b) the D-07 anchor check on 3475734189 is not independent of it; and it compares an excess-metres quantity against a segment-metres scale.

### Considered and rejected before measurement

- Stream-distance versus summary-distance disagreement: measured DEGENERATE by the planner - the summary distance is the stream's own final value (exactly equal on 1,499 of 1,788 numeric-id activities, within 1 m on 239 more), so it is not a second record of distance.
- The detector's own sub-floor "trivia" excess: bounded above by `UNRELIABLE_EXCESS_FLOOR_M` by construction while every detected burst exceeds it, so the cut could only restate presence.
- Any statistic over unflagged activities ONLY: membership is defined by the detector, and the planting step would evict most of the population.
- An across-activity percentile of an ordinary fast-side overshoot SUM: bursts dominate the sum in exactly the share of activities the removal step edits.

## Non-circularity

Every pre-declared shape's reference population is ordinary folded covered steps and per-activity distances over ALL computable activities — never the flagged cohort the cut later judges. 33-08 measured that a percentile of the flagged cohort itself is circular (every candidate order failed D-13 by 50–4333% against the 1% tolerance): the percentiled population IS the flagged set, so "re-derive with detected segments removed" collapses the population itself, and the real q=0.99 candidate was literally the same computation as its own deliberately circular strawman. See each shape above for its own argument, and the recorded negative finding below for 33-08's own measurement.

## Strawman watched failing (D-13 harness)

The step-level D-13 harness (`buildBaseViews`/`buildRemovedViews`/`buildPlantedViews`) evaluates a strawman FIRST, before any real shape: R-7 q=0.99 of the excess fractions of views with a non-empty `excessList` — deliberately the same computation as 33-08's own strawman, restated over the view shape the new shapes need. Its base value must equal 33-08's legacy q=0.99 cut exactly (same population, same quantile).

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| strawman (q=0.99) | 699 | 0.035714 | — (0) | — | 0.033754 (1529) | 5.4877% | FAIL |

**FAILED** — removedDelta —, plantedDelta 5.4877%, both measured against the 1% tolerance — the harness is discriminating.

## Shape arbitration (D-13 insensitivity)

Tolerance: 1%. SELECTION RULE: the strawman is evaluated first; then R1, R2, R3, R4 in that fixed order; the FIRST shape whose removedDelta AND plantedDelta are both at or below the tolerance (computed on the RAW unrounded value) is chosen. All four rows are always computed and rendered, whichever wins. `selectShape` receives only `{ id, pass }` rows — no cut, count, rate or activity id can reach it.

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| R1 | 1873 | 0.004229 | 0.004241 (1873) | 0.2848% | 0.004208 (1873) | 0.5081% | PASS |
| R2 | 1873 | 0.002273 | 0.002280 (1873) | 0.2983% | 0.002269 (1874) | 0.1709% | PASS |
| R3 | 1873 | 0.001690 | 0.001691 (1873) | 0.0300% | 0.001690 (1874) | 0.0159% | PASS |
| R4 | 1873 | 0.010626 | 0.010629 (1873) | 0.0300% | 0.010625 (1874) | 0.0159% | PASS |

Non-vacuity: removed step count 2164, planted count 1344 (>= detected segment count 1344), source burst shape count 25, activities whose totalDistanceM changed under removal 699 / under planting 1344.

## Chosen constant

Shape **R1** (accumulated ordinary step noise) is the FIRST to clear D-13 insensitivity — raw value 0.004229, rounded UP to 3 significant figures (rounding up can only call FEWER activities severe than the raw value would, and 3 s.f. is the coarsest precision whose quantum never exceeds the 1% D-13 tolerance) to 0.00423.

**UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423**

Live-derived: 0.00423. Shipped (`src/analytics/pace-quality.ts`): 0.00423. Shipped value equal: yes.

## D-07 anchor check

Evaluated on the winning shape's cut only, never an input to selection. 3475734189 must tier `severe`; 10146303423 must tier `none`. Findings (never an anchor requirement): 3475724402, 3475740390.

| id | segments | excess (m) | own distance (m) | fraction | tier |
|---|---|---|---|---|---|
| 3475734189 | 1 | 122.70 | 6830.3 | 0.017964 | severe |
| 10146303423 | 0 | 0.00 | 7096.6 | 0.000000 | none |
| 3475724402 | 16 | 0.00 | 13424.7 | 0.000000 | minor |
| 3475740390 | 5 | 55.95 | 10571.1 | 0.005293 | severe |

**PASS** — both anchor activities tier as required.

## Archive-wide severe/minor/none distribution (reported finding)

At the chosen cut (0.00423): **severe 136**, **minor 563**, **none 1175**, not-computable 0, of 1874 activities.

This rate is reported as a finding, never tuned toward. Nothing in `selectShape` or this rendering step adjusts the shape, the tolerance, or the synthetic plant in response to it.

## Recorded negative finding — outer percentiles of the flagged cohort (plan 33-08)

33-08's own derivation — an outer percentile of the FLAGGED COHORT's own excess-fraction population — is kept here as a recorded negative finding, never deleted. Every candidate order measured circular on the real archive; this is WHY plan 33-14 (D-16) moved the statistic to a reference population that is not the flagged set.

### Statistic (33-08)

For each activity with at least one detected unreliable segment, `excessFraction = sum(segment.excessMetres) / (d[n-1] - d[0])`. The candidate cut is `quantile(sortedAsc(excessFractions), q)` for `q` drawn in order from `[0.9, 0.95, 0.97, 0.99]`; the smallest passing candidate wins.

### Non-circularity (33-08)

The cut was derived from the flagged cohort's own excess-fraction population — 699 of 1874 activities with at least one detected segment (cohort size 699, 0 not computable within it). This population IS the population the cut later judges (every flagged activity's own fraction) — the insensitivity check below measured that circularity disqualifying, not a false alarm.

### Candidate excess-fraction cuts (D-13 insensitivity) (33-08)

Tolerance: 1%. Selection rule: the SMALLEST `q` whose both deltas clear the tolerance wins — never the count or severe rate it produces.

| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| 0.9 | 699 | 0.008839 | 0.004388 (629) | 50.3521% | 0.015541 (724) | 75.8232% | FAIL |
| 0.95 | 699 | 0.020290 | 0.005906 (629) | 70.8950% | 0.031423 (724) | 54.8636% | FAIL |
| 0.97 | 699 | 0.024554 | 0.006530 (629) | 73.4042% | 1.088558 (724) | 4333.4014% | FAIL |
| 0.99 | 699 | 0.035714 | 0.008123 (629) | 77.2560% | 1.088558 (724) | 2948.0047% | FAIL |

### NO CANDIDATE CLEARS (33-08)

None of `[0.9, 0.95, 0.97, 0.99]` cleared the 1% tolerance in both directions — see the candidate table above for every measured delta. This is 33-08's own recorded HALT (33-08-PLAN.md Task 3 step 5), closed by plan 33-14 (D-16) above.

### Why not a tail percentile of the population itself (33-08)

The deliberately circular strawman — `quantile(excessFractions, 0.99)`, a raw tail percentile of the excess-fraction population ITSELF — was run through the identical two-direction insensitivity check as every 33-08 candidate:

| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| 0.99 | 699 | 0.035714 | 0.008123 (629) | 77.2560% | 1.088558 (724) | 2948.0047% | FAIL |

**FAILED** — removedDelta 77.2560%, plantedDelta 2948.0047%, both measured against the 1% tolerance. The strawman's own top rank moved with its own top decile and with planted contamination close to exactly as much as removing or planting would move any other tail percentile of the same population — it failed for the same structural reason 33-08's own real q=0.99 candidate did (they are the same computation).

## Inputs

- Streams scanned: 1874, not computable: 0
- data/streams git tree: `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`
- Insensitivity tolerance: 1%
- Plant source activity: 3475724402
- Source burst shape count: 25
- Archive-wide detected segment count: 1344
- Planted count: 1344
- R1 exclusion count (base population): 1
- R2 exclusion count (base population): 1
- R3 exclusion count (base population): 1
- R4 exclusion count (base population): 1
- Detector constants (imported, never re-derived here): speedLimitMps=7.35, excessFloorMetres=3, hiddenPauseMinMetres=116.95
