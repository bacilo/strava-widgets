# Phase 34 Plan 4: pause-classification / forgotten-stop calibration (PAUSE-01, STOP-02)

Regenerate with `npm run compute-pause-classification-calibration`. This artifact carries no wall-clock timestamp or generated-at field — provenance is content-addressed to data/streams' own git tree. A re-run against an unchanged archive is byte-identical.

## Statistic and scope

Families run in the fixed order G, then M, then W (34-04-PLAN.md <predeclared_shapes>, as amended by 34-12-PLAN.md (D-19)). Downstream families use the upstream chosen value AS SHIPPED (rounded). If a family HALTs, every downstream family renders "not computed: upstream HALT". The D-13 PLANTED perturbation plants ceil(PLANT_FRACTION x the shape's own base items) items into that shape's own population, uniform across G, M and W (D-19) — never a single family-wide plant.

## Pre-declared shapes

### Family G

#### G4 — standstill episodes, pooled

**Meaning:** 90% of the archive's established standstills in which the odometer drifted at all accrued drift at or below this rate. Above it the odometer is advancing faster than all but the top tenth of real standstills, so something is moving.

**Non-circularity:** Membership comes only from the pause rule (Phase 26, duration-only, no speed term) and covered-run adjacency. Neither reads a band, a class or a speed. No J interval can lie inside an episode, because a bridge is a covered run and any gap-bearing interval between two pauses breaks the chain. The band judges J (never pause intervals, D-01) and, through STOP-01, individual covered pairs. The statistic is an aggregate over whole standstills including their zero-advance time, never a percentile of judged items. The unchanged REMOVED view measures what leakage remains. By the structural bound, an episode's rate is strictly less than half the fastest speed of its bridges (each pause lasts more than P_a and each bridge less than P_a, so bridges occupy strictly less than half of any episode's seconds). Overlap with the retired G3: bridges can lie inside G3's old pause-boundary windows whenever they are shorter than the neighbourhood width, so the two populations share covered pairs — but this population is not "G3 with the neighbourhood removed": it pre-excludes nothing near J (its REMOVED row is live), its statistic is a whole-standstill aggregate including zero-advance time (not a pair median), and a single stop's run-in/run-out pairs never enter (only covered runs sandwiched between two pauses qualify).

**Caveats:** Sees light drift only (heavier drift forms no pause, so it is invisible here — conservative for walking breaks, forgotten stops with dense drift may be under-detected). Aggregate versus pair: a single drift tick's pair speed exceeds an episode's average, so ticks can split creep runs (same under-detection direction, disclosed and not corrected). Conditional on drift: a single-pause standstill accrues 0 by construction and is excluded — including it would risk a zero base. Small population: at most half the archive's pause intervals (pauses often adjoin recording gaps).

#### G5 — standstill episodes, per activity

**Meaning:** The same ceiling, with each activity voting once (total chained-episode metres / total chained-episode seconds, R-7 p90 across activities), so an activity with many stops cannot dominate G4's pooled statistic. Each planted item lifts exactly one host activity's ratio.

**Non-circularity:** Membership comes only from the pause rule (Phase 26, duration-only, no speed term) and covered-run adjacency. Neither reads a band, a class or a speed. No J interval can lie inside an episode, because a bridge is a covered run and any gap-bearing interval between two pauses breaks the chain. The band judges J (never pause intervals, D-01) and, through STOP-01, individual covered pairs. The statistic is an aggregate over whole standstills including their zero-advance time, never a percentile of judged items. The unchanged REMOVED view measures what leakage remains. By the structural bound, an episode's rate is strictly less than half the fastest speed of its bridges (each pause lasts more than P_a and each bridge less than P_a, so bridges occupy strictly less than half of any episode's seconds). Overlap with the retired G3: bridges can lie inside G3's old pause-boundary windows whenever they are shorter than the neighbourhood width, so the two populations share covered pairs — but this population is not "G3 with the neighbourhood removed": it pre-excludes nothing near J (its REMOVED row is live), its statistic is a whole-standstill aggregate including zero-advance time (not a pair median), and a single stop's run-in/run-out pairs never enter (only covered runs sandwiched between two pauses qualify).

**Caveats:** Sees light drift only (heavier drift forms no pause, so it is invisible here — conservative for walking breaks, forgotten stops with dense drift may be under-detected). Aggregate versus pair: a single drift tick's pair speed exceeds an episode's average, so ticks can split creep runs (same under-detection direction, disclosed and not corrected). Conditional on drift: a single-pause standstill accrues 0 by construction and is excluded — including it would risk a zero base. Small population: at most half the archive's pause intervals (pauses often adjoin recording gaps). Ranks below G4 on criterion (2), being a two-level statistic.

### Family M

#### M1 — pause-rule scale, conservative

**Meaning:** A creep standstill is recognised at the duration the archive's own zero-advance pause rule recognises a standstill, for all but the sparsest-sampled tenth of activities. One duration definition for both D-09 sources.

**Non-circularity:** P_a comes from each activity's full advance-interval distribution (thousands of intervals) under the already-calibrated PAUSE_GAP_P90_MULTIPLIER. No creep stretch, band or class enters it.

**Caveats:** Conservative — the p90 across activities.

#### M2 — pause-rule scale, typical

**Meaning:** The same population, at a typical (not conservative) scale.

**Non-circularity:** As M1.

**Caveats:** Ranks second on criterion (2): typical, not conservative.

### Family W

#### W1 — covered time by speed

**Meaning:** The valley in the athlete's own covered-time speed distribution, time-weighted.

**Non-circularity:** Covered steps exclude every J interval, pause and unreliable segment by construction (D-06: "disjoint from what it judges"); the harness measures leakage directly.

**Caveats:** Disclosed property: the value is quantised to 0.1 m/s.

#### W2 — covered steps by speed

**Meaning:** The same valley, count-weighted rather than time-weighted.

**Non-circularity:** As W1.

**Caveats:** Ranks second: sampling rate biases counts, since a 1 Hz stream contributes more steps per minute than a decimated one — a structurally different weighting, a genuine second opinion.

## Rejected on argument

- G (rejected on argument): a low percentile of ALL pooled covered speeds — that population overlaps the walking cluster W judges, the 33-08 failure shape.
- G (rejected on argument): HR-band stillness — HR stays elevated for minutes after a stop, so it cannot mark stillness onset.
- M (rejected on argument): run lengths of pre-pause creep — the same mixed population G3 discloses as contaminated.
- M (rejected on argument): any round-number duration, including the scoping probe's 30s and 120s, which are references only and never a shape.
- W (rejected on argument): a per-activity valley percentile — most activities contain no walking hump, so the population would be selected by the property being measured.
- W (rejected on argument): a cadence-split anchor, which needs its own uncalibrated cadence constant.
- G (rejected on argument, D-19): (c) pause-interval interiors alone — zero-advance by definition, so the rate is exactly 0: a degenerate population and a zero base.
- G (rejected on argument, D-19): (d) G3's population restricted to pairs outside every J neighbourhood — it makes the REMOVED axis vacuous by construction, and a measured HALT-1 view of nearly that population already exists, so declaring it would be choosing by outcome.
- G (rejected on argument, D-19): (e) pre-start / post-finish stationary tails — no speed-free rule tells a stationary tail from a start or finish effort except the pause rule itself, which reduces to G4.
- G (rejected on argument, D-19): (f) chained plus single-pause standstills together — a single-pause standstill accrues 0 by construction and is excluded (see G4/G5 caveats).
- G (rejected on argument, D-19): (g) pair speeds of drift ticks inside bridges — a tick's pair speed is one sample's odometer jump, not a drift rate over standing time; wrong unit for a boundary that judges interval aggregates.
- RETIRED (D-19, not argued, recorded in 34-06-HALT-1.md): G1 (cadence-silent covered pairs, pooled), G2 (cadence-silent covered pairs, per activity), G3 (pause-boundary run-in). All three measured walking/jogging speeds, not stationary-drift speeds, and failed D-13 insensitivity on the real archive.

## Non-circularity

- **G4:** Membership comes only from the pause rule (Phase 26, duration-only, no speed term) and covered-run adjacency. Neither reads a band, a class or a speed. No J interval can lie inside an episode, because a bridge is a covered run and any gap-bearing interval between two pauses breaks the chain. The band judges J (never pause intervals, D-01) and, through STOP-01, individual covered pairs. The statistic is an aggregate over whole standstills including their zero-advance time, never a percentile of judged items. The unchanged REMOVED view measures what leakage remains. By the structural bound, an episode's rate is strictly less than half the fastest speed of its bridges (each pause lasts more than P_a and each bridge less than P_a, so bridges occupy strictly less than half of any episode's seconds). Overlap with the retired G3: bridges can lie inside G3's old pause-boundary windows whenever they are shorter than the neighbourhood width, so the two populations share covered pairs — but this population is not "G3 with the neighbourhood removed": it pre-excludes nothing near J (its REMOVED row is live), its statistic is a whole-standstill aggregate including zero-advance time (not a pair median), and a single stop's run-in/run-out pairs never enter (only covered runs sandwiched between two pauses qualify).
- **G5:** Membership comes only from the pause rule (Phase 26, duration-only, no speed term) and covered-run adjacency. Neither reads a band, a class or a speed. No J interval can lie inside an episode, because a bridge is a covered run and any gap-bearing interval between two pauses breaks the chain. The band judges J (never pause intervals, D-01) and, through STOP-01, individual covered pairs. The statistic is an aggregate over whole standstills including their zero-advance time, never a percentile of judged items. The unchanged REMOVED view measures what leakage remains. By the structural bound, an episode's rate is strictly less than half the fastest speed of its bridges (each pause lasts more than P_a and each bridge less than P_a, so bridges occupy strictly less than half of any episode's seconds). Overlap with the retired G3: bridges can lie inside G3's old pause-boundary windows whenever they are shorter than the neighbourhood width, so the two populations share covered pairs — but this population is not "G3 with the neighbourhood removed": it pre-excludes nothing near J (its REMOVED row is live), its statistic is a whole-standstill aggregate including zero-advance time (not a pair median), and a single stop's run-in/run-out pairs never enter (only covered runs sandwiched between two pauses qualify).
- **M1:** P_a comes from each activity's full advance-interval distribution (thousands of intervals) under the already-calibrated PAUSE_GAP_P90_MULTIPLIER. No creep stretch, band or class enters it.
- **M2:** As M1.
- **W1:** Covered steps exclude every J interval, pause and unreliable segment by construction (D-06: "disjoint from what it judges"); the harness measures leakage directly.
- **W2:** As W1.

## Strawmen watched failing

Removal empties a strawman by construction — its population IS the population the boundary/duration later judges.

### Strawman G

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| strawman G | 5362 | 0.908333 | — (0) | — | 0.941667 (5416) | 3.6697% | 54 | FAIL |

**FAILED** — removedDelta —, plantedDelta 3.6697% (expected).

### Strawman M

not computed: upstream HALT

### Strawman W

not computed: upstream HALT

## Shape arbitration

### Family G

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| G4 | 6 | 0.029873 | 0.003063 (4) | 89.7455% | 1.195556 (7) | 3902.0881% | 1 | FAIL |
| G5 | 6 | 0.029873 | 0.003063 (4) | 89.7455% | 0.496462 (6) | 1561.8912% | 1 | FAIL |

Selected: NO SHAPE CLEARS

### Family M

not computed: upstream HALT

### Family W

not computed: upstream HALT

## NO SHAPE CLEARS

At least one family failed to select a shape clearing D-13 insensitivity. No constant is named for that family or any family downstream of it. Nothing is widened or loosened.

## Gates

Not evaluated — not every family cleared (see `## NO SHAPE CLEARS` above).

## D-10 blind-spot rule

Named anchors:

| id | expected distanceTriggered | actual | Verdict |
|---|---|---|---|
| 3475740390 | true | true | PASS |
| 3475724402 | false | false | PASS |
| 3475734189 | false | false | PASS |
| 4556693525 | false | false | PASS |

Among computable streams with cvDd < 0.2, the ±0.02 margin around DISTANCE_TRIGGERED_MAX_CV_RATIO (0.8) is CLEAR. Nearest ratio below: 3475740390 (0.767041664739317); nearest above: 3475742755 (0.928374213947598).

Findings (never expected values): distance-triggered 104, insufficient-data 1, computable 1873.

## Drift-while-stationary

Standstill episodes: total=684, chained=6, single-pause=678, chainedShare=0.8772%, totalStandstillSeconds=5824.0, totalChainedMetres=2.70. Drift-matters not yet determined — Family G has not shipped a value this run.

## Join exhaustiveness

Summed joinViolations archive-wide: 0. PASS.

## Per-interval class table — 3475724402 (classifier output)

Not rendered — not every family cleared.

## Archive-wide findings (never an input to selection)

Not computed — not every family cleared.

## Inputs

- Streams scanned: 1874, not computable: 0
- data/streams git tree: `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`
- Newest activity start date: 2026-09-18T05:02:46Z
- Control file: /Users/pedf/workspace/strava-widgets/.planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-CONTROL.md
- Regenerate: `npm run compute-pause-classification-calibration`
