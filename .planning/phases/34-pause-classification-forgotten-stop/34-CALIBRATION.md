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

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| strawman M | 78895 | 4.000000 | — (0) | — | 4.000000 (79684) | 0.0000% | 789 | FAIL |

**FAILED** — removedDelta —, plantedDelta 0.0000% (expected).

### Strawman W

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| strawman W | 794 | 4.450000 | — (0) | — | 4.450000 (848) | 0.0000% | 54 | FAIL |

**FAILED** — removedDelta —, plantedDelta 0.0000% (expected).

## Shape arbitration

### Family G

NOT ARBITRATED (D-20): STATIONARY_MAX_SPEED_MPS is developer-declared, not calibrated. The rows below are EVIDENCE for the drift-while-stationary finding, never candidates — no row here can select or influence a constant.

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| G4 | 6 | 0.029873 | 0.003063 (4) | 89.7455% | 1.195556 (7) | 3902.0881% | 1 | FAIL |
| G5 | 6 | 0.029873 | 0.003063 (4) | 89.7455% | 0.496462 (6) | 1561.8912% | 1 | FAIL |

Selected: not applicable — not arbitrated (D-20)

### Family M

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| M1 | 1873 | 40.000000 | 40.000000 (1870) | 0.0000% | 40.000000 (1873) | 0.0000% | 26276 | PASS |
| M2 | 1873 | 30.000000 | 30.000000 (1870) | 0.0000% | 30.000000 (1873) | 0.0000% | 26276 | PASS |

Selected: M1

### Family W

NOT ARBITRATED (D-21): WALK_RUN_BOUNDARY_MPS is developer-declared, not calibrated. The rows below are EVIDENCE for the valley-evidence finding, never candidates — no row here can select or influence a constant.

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | plants | Verdict |
|---|---|---|---|---|---|---|---|---|
| W1 | 2612365 | 6.950000 | 6.950000 (2574257) | 0.0000% | 6.950000 (2638590) | 0.0000% | 26225 | PASS |
| W2 | 2612365 | 6.850000 | 6.850000 (2574257) | 0.0000% | 6.850000 (2638590) | 0.0000% | 26225 | PASS |

Selected: not applicable — not arbitrated (D-21)

## Chosen constants

STATIONARY_MAX_SPEED_MPS = 0.5
STATIONARY_MAX_SPEED_MPS provenance: developer-declared (D-20), not calibrated
FORGOTTEN_STOP_MIN_SEC = 40
FORGOTTEN_STOP_MIN_SEC provenance: calibrated (M family, M1)
WALK_RUN_BOUNDARY_MPS = 2.2
WALK_RUN_BOUNDARY_MPS provenance: developer-declared (D-21), not calibrated
UNRELIABLE_SPEED_LIMIT_MPS = 7.35 (imported, 32-CALIBRATION.md)

## Gates

| gate | measured | bound | Verdict |
|---|---|---|---|
| order | 0.5 < 2.2 < 7.35 | 0 <= STATIONARY_MAX_SPEED_MPS < WALK_RUN_BOUNDARY_MPS < UNRELIABLE_SPEED_LIMIT_MPS | PASS |
| d12-anchor-i | walked | walked | PASS |
| d12-anchor-ii | 2.8257182738164475 | > 2.2 | PASS |
| d12-anchor-iii | no creep intersects window | no creep intersecting window | PASS |
| d10-rule | anchors pass, margin clear | anchors match; margin clear | PASS |
| join | 0 | 0 | PASS |
| d20-basis | 0.029873294347019862 | < STATIONARY_MAX_SPEED_MPS (0.5) | PASS |
| d21-basis | control-window max=1.797; W1 modal bin centre=3.050 | boundary > every confirmed control window aggregate speed AND boundary < W1 time-weighted modal bin centre | PASS |

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

Standstill episodes: total=684, chained=6, single-pause=678, chainedShare=0.8772%, totalStandstillSeconds=5824.0, totalChainedMetres=2.70. G4 measured base (pooled, chained-episode rate, R-7 p90) = 0.029873 m/s; G5 measured base (per-activity) = 0.029873 m/s.

Disposition (D-20, 2026-09-22): drift-while-stationary is a MEASURED NON-ISSUE on this archive. Family G still measures and renders the G4/G5 rows above, under Shape arbitration, as evidence for this finding; it no longer arbitrates a cut for this constant. The stationary/walked boundary sits at the developer-declared 0.5 m/s bound, stated (never re-stated as a value line) in the Chosen constants section when every family clears, chosen on physical grounds, far above what the evidence above measures.

Definitional caveat: a single-pause standstill (no qualifying bridge on either side) is zero-advance BY CONSTRUCTION — the pause rule only marks zero-advance runs — so the single-pause share of the counts above is partly definitional. The chained share and the G4/G5 rates above are the measured, non-definitional part of this finding.

## Valley evidence

Population: [lo, hi) = [0.500, 7.350) — lo is the declared stationary constant, hi the imported unreliable-speed ceiling.

W1 (time-weighted): total mass=7715582.0, modal bin [3.00, 3.10) mass=852973.0, qualifying dips=16, picked bin centre=6.95 mass=309.0 share=0.0040%

W2 (count-weighted): total mass=2612365.0, modal bin [3.00, 3.10) mass=308708.0, qualifying dips=16, picked bin centre=6.85 mass=150.0 share=0.0057%

Only the time-weighted mode (W1) is gated by `d21-basis` below; W2 is rendered as evidence only.

D-21 (2026-09-22) records the finding that walking and running form one hump on this archive, so D-06's valley premise does not hold here: the valley rule's picked bin (6.95 m/s (mass share 0.0040%)) sits away from the modal bin (3.05 m/s (mass share 11.0552%)), a computed relation rather than a fixed sentence.

## Join exhaustiveness

Summed joinViolations archive-wide: 0. PASS.

## Per-interval class table — 3475724402 (classifier output)

| # | source | startSec | endSec | seconds | metres | speedMps | class |
|---|---|---|---|---|---|---|---|
| 1 | merged-segment | 1030 | 1048 | 18 | 52.4 | 2.911 | ran-through |
| 2 | merged-segment | 1064 | 1135 | 71 | 288.6 | 4.065 | ran-through |
| 3 | merged-segment | 1461 | 1515 | 54 | 124.6 | 2.307 | ran-through |
| 4 | merged-segment | 1589 | 1611 | 22 | 52.2 | 2.373 | ran-through |
| 5 | recording-gap | 1663 | 1685 | 22 | 58.1 | 2.641 | ran-through |
| 6 | merged-segment | 1729 | 1760 | 31 | 88.4 | 2.852 | ran-through |
| 7 | merged-segment | 2102 | 2125 | 23 | 53.4 | 2.322 | ran-through |
| 8 | merged-segment | 2139 | 2169 | 30 | 90.1 | 3.003 | ran-through |
| 9 | merged-segment | 2179 | 2236 | 57 | 157.5 | 2.763 | ran-through |
| 10 | merged-segment | 2491 | 2525 | 34 | 81.7 | 2.403 | ran-through |
| 11 | merged-segment | 2957 | 3067 | 110 | 305.4 | 2.776 | ran-through |
| 12 | recording-gap | 3364 | 3388 | 24 | 46.3 | 1.929 | walked |
| 13 | merged-segment | 3438 | 3456 | 18 | 49.2 | 2.733 | ran-through |
| 14 | merged-segment | 3486 | 3547 | 61 | 157.8 | 2.587 | ran-through |
| 15 | merged-segment | 3975 | 4028 | 53 | 154.4 | 2.913 | ran-through |
| 16 | merged-segment | 4056 | 4121 | 65 | 201.7 | 3.103 | ran-through |
| 17 | merged-segment | 4133 | 4212 | 79 | 219.0 | 2.772 | ran-through |
| 18 | merged-segment | 4238 | 4263 | 25 | 72.3 | 2.892 | ran-through |

## Archive-wide findings (never an input to selection)

Class distribution: stationary=5260 (1170 activities), walked=623 (237 activities), ran-through=167 (75 activities), transported=6 (5 activities). Not-classifiable intervals: 1259.

Forgotten-stop: computable 1769, not-computable 105 ({"fewer than 30 covered pairs available to compute the recording-mechanism signature":1,"distance-triggered recording: a standstill would be written as a recording gap, not a covered creep, so the forgotten-stop flag cannot see it":104}). Covered-creep flagged on 82 activities (300 stretches); zero-advance-pause flagged on 414 activities (694 intervals).

## Inputs

- Streams scanned: 1874, not computable: 0
- data/streams git tree: `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`
- Newest activity start date: 2026-09-18T05:02:46Z
- Control file: /Users/pedf/workspace/strava-widgets/.planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-CONTROL.md
- Regenerate: `npm run compute-pause-classification-calibration`
