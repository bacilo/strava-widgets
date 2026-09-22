# Phase 34 Plan 4: pause-classification / forgotten-stop calibration (PAUSE-01, STOP-02)

Regenerate with `npm run compute-pause-classification-calibration`. This artifact carries no wall-clock timestamp or generated-at field — provenance is content-addressed to data/streams' own git tree. A re-run against an unchanged archive is byte-identical.

## Statistic and scope

Families run in the fixed order G, then M, then W (34-04-PLAN.md <predeclared_shapes>). Downstream families use the upstream chosen value AS SHIPPED (rounded). If a family HALTs, every downstream family renders "not computed: upstream HALT".

## Pre-declared shapes

### Family G

#### G1 — cadence-silent covered pairs, pooled

**Meaning:** 90% of the odometer's advance rate while the athlete takes no steps sits at or below it. Above that, something is moving.

**Non-circularity:** Membership is decided by the cadence channel, which no detector, pause rule, classifier or band reads. Covered pairs exclude every J interval and pause by construction, so J cannot enter the population. Why this is not device-family relabelling: cadence here only selects which covered PAIRS enter a calibration sample for one speed cut. It never labels a stream or device, never gates a stream into or out of D-10's recordingMechanismSignature, and never enters the shipped classifier, which stays a pure function of t/d and reads only the derived constant. The D-10 rule and this population stay separate functions with separately-stated non-circularity arguments; the D-10 rule only ever gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation (device-family reasoning creeping in is exactly what this avoids, per Pitfall 5).

**Caveats:** Cadence is present on a subset of streams; a cadence of 0 can also be a sensor dropout while moving, which inflates the tail. The D-12 anchor gate exists to catch that.

#### G2 — cadence-silent covered pairs, per activity

**Meaning:** Guards criterion (2): a few long cadence-silent activities cannot dominate the pooled G1 statistic.

**Non-circularity:** As G1, including the device-family relabelling sentence. Why this is not device-family relabelling: cadence here only selects which covered PAIRS enter a calibration sample for one speed cut. It never labels a stream or device, never gates a stream into or out of D-10's recordingMechanismSignature, and never enters the shipped classifier, which stays a pure function of t/d and reads only the derived constant. The D-10 rule and this population stay separate functions with separately-stated non-circularity arguments; the D-10 rule only ever gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation (device-family reasoning creeping in is exactly what this avoids, per Pitfall 5).

**Caveats:** Ranks below G1 on criterion (3) — a two-level statistic.

#### G3 — pause-boundary run-in

**Meaning:** The speed of covered pairs immediately bracketing an established zero-advance pause interval.

**Non-circularity:** The pause rule is a duration-only rule with no speed term, so it is independent of any band; no band or class enters it.

**Caveats:** Ranks last: the population mixes deceleration and acceleration pairs, so its upper tail is contaminated by construction — the median is used for that reason.

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

## Non-circularity

- **G1:** Membership is decided by the cadence channel, which no detector, pause rule, classifier or band reads. Covered pairs exclude every J interval and pause by construction, so J cannot enter the population. Why this is not device-family relabelling: cadence here only selects which covered PAIRS enter a calibration sample for one speed cut. It never labels a stream or device, never gates a stream into or out of D-10's recordingMechanismSignature, and never enters the shipped classifier, which stays a pure function of t/d and reads only the derived constant. The D-10 rule and this population stay separate functions with separately-stated non-circularity arguments; the D-10 rule only ever gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation (device-family reasoning creeping in is exactly what this avoids, per Pitfall 5).
- **G2:** As G1, including the device-family relabelling sentence. Why this is not device-family relabelling: cadence here only selects which covered PAIRS enter a calibration sample for one speed cut. It never labels a stream or device, never gates a stream into or out of D-10's recordingMechanismSignature, and never enters the shipped classifier, which stays a pure function of t/d and reads only the derived constant. The D-10 rule and this population stay separate functions with separately-stated non-circularity arguments; the D-10 rule only ever gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation (device-family reasoning creeping in is exactly what this avoids, per Pitfall 5).
- **G3:** The pause rule is a duration-only rule with no speed term, so it is independent of any band; no band or class enters it.
- **M1:** P_a comes from each activity's full advance-interval distribution (thousands of intervals) under the already-calibrated PAUSE_GAP_P90_MULTIPLIER. No creep stretch, band or class enters it.
- **M2:** As M1.
- **W1:** Covered steps exclude every J interval, pause and unreliable segment by construction (D-06: "disjoint from what it judges"); the harness measures leakage directly.
- **W2:** As W1.

## Strawmen watched failing

Removal empties a strawman by construction — its population IS the population the boundary/duration later judges.

### Strawman G

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| strawman G | 5362 | 0.908333 | — (0) | — | 0.908333 (5362) | 0.0000% | FAIL |

**FAILED** — removedDelta —, plantedDelta 0.0000% (expected).

### Strawman M

not computed: upstream HALT

### Strawman W

not computed: upstream HALT

## Shape arbitration

### Family G

| id | n | base | removed (n) | removedDelta | planted (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| G1 | 7943 | 2.723333 | 2.650000 (4569) | 2.6928% | 3.000000 (13305) | 10.1591% | FAIL |
| G2 | 50 | 1.655000 | 1.612738 (35) | 2.5536% | 1.740000 (57) | 5.1360% | FAIL |
| G3 | 2737 | 1.900000 | 0.200000 (965) | 89.4737% | 1.900000 (2737) | 0.0000% | FAIL |

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

Not computed — upstream G family did not clear.

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
