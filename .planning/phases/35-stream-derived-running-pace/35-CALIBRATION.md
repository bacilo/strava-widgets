# Phase 35 Plan 6: running-pace dispute threshold calibration (RPACE-03)

Regenerate with `npm run compute-running-pace-dispute-calibration -- --write`. This artifact carries no wall-clock timestamp or generated-at field -- provenance is content-addressed to data/streams' own git tree. A re-run against an unchanged archive is byte-identical.

## Statistic and scope

Populations E/C/B, the two per-activity statistics (delta, ratio) and the slower-only direction (D-06) are declared verbatim from 35-06-PLAN.md's pre-declaration (D-02, D-05, D-06, D-07), before any archive measurement. delta = runningPaceSecPerKm - metadataPaceSecPerKm (positive means the running pace is slower); ratio = runningPaceSecPerKm / metadataPaceSecPerKm. Percentiles use the repo's ONE R-7 `quantile` definition, imported from `dist/analytics/pace-derivation.js` -- never re-declared locally.

## Pre-declared shapes

#### S0

**Meaning:** S0 is a deliberately circular STRAWMAN: its cut is delta(3475724402) minus the gap between E's own two largest deltas, so 3475724402 cannot fail to badge under it. (Gap-closure, 35-07: originally read the smallest POSITIVE gap anywhere in E; 35-07-HALT-1.md measured that whole-population statistic as structurally insensitive to Axis C's tail trim on a dense archive. A first repair narrowed the search to a top-5%-by-fraction window, but a re-measurement (also on this session's own record) showed that window still wide enough to leave its own minimum gap sitting in the untouched remainder below the trimmed top 1%. The search was narrowed to the absolute minimum -- the top two order statistics -- which no trim of >=1 member or plant-a-duplicate-of-the-max can leave untouched, and the positive-only filter was dropped so a duplicate planted at the population's own max -- Axis B's mechanism -- registers as the zero-gap it actually is.)

**Non-circularity:** NONE -- S0 reads its cut off the very activity ROADMAP criterion 3 requires to be badged, so it is evidence of nothing. If S0 clears the D-13 insensitivity axes the round is invalid: the generator renders NO SHAPE CLEARS with strawmanCleared: true and never proceeds to C1.

**Caveats:** Must FAIL. A strawman that clears the insensitivity axes invalidates the entire calibration round (32 D-13's binding precedent) -- it is never a fallback candidate.

#### C1

**Meaning:** The 95th percentile of the absolute sec/km disagreement (delta = runningPaceSecPerKm - metadataPaceSecPerKm) over C, the tight control population.

**Non-circularity:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.

**Caveats:** Ranks first: q95 precedes q99 in the arbitration order because a q99 over a control is strictly more tail-sensitive, and D-13's own axes punish that -- the more robust reading is offered the chance first. The delta sibling precedes its ratio twin (D-07) because an absolute sec/km figure is directly readable in the disclosure sentence and in the same unit as every pace figure on the page.

#### C3

**Meaning:** The 95th percentile of the pace ratio (ratio = runningPaceSecPerKm / metadataPaceSecPerKm) over C, the tight control population.

**Non-circularity:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.

**Caveats:** Ranks after C1: a ratio is scale-free but is not directly readable against every other pace figure on the page the way an absolute sec/km delta is (D-07).

#### C2

**Meaning:** The 99th percentile of delta over C, the tight control population.

**Non-circularity:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.

**Caveats:** Ranks after C1/C3: q99 over a control is strictly more tail-sensitive than q95, which D-13's own insensitivity axes punish -- the more robust q95 reading is offered the chance first.

#### C4

**Meaning:** The 99th percentile of ratio over C, the tight control population.

**Non-circularity:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.

**Caveats:** Ranks last among the C-based shapes: both a q99 order (vs q95) and a ratio (vs delta).

#### B1

**Meaning:** The 95th percentile of delta over B, the broad control population.

**Non-circularity:** B is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of B provably has zero distance withheld off the clock, though seconds may have been withheld -- B excludes only the distance mechanism, a broader but still non-circular control than C.

**Caveats:** Ranks after every C-based shape: control C provably excludes BOTH disagreement mechanisms (distance and time), while B excludes only the distance one -- C is offered the chance to clear first.

#### B2

**Meaning:** The 95th percentile of ratio over B, the broad control population.

**Non-circularity:** B is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of B provably has zero distance withheld off the clock, though seconds may have been withheld -- B excludes only the distance mechanism, a broader but still non-circular control than C.

**Caveats:** Ranks last: a ratio (D-07) over the broader, less circularity-proof control (D-05).

## Rejected on argument

- A percentile over the FULL computable population (not gated by excludedM > 0): this is exactly the contaminated 35-CONTEXT.md probe population D-05 forbids targeting, and it does not separate mechanism (b) (pure moving_time divergence, zero distance withheld -- elapsedVsMoving's territory) from mechanism (a) (distance covered off the clock -- this milestone's target). D-02's eligibility gate exists precisely to make that separation a mechanism filter, not a magnitude filter.
- A symmetric two-sided cut (badging both directions): rejected on D-06's own binding resolution -- the milestone's claim is distance covered off the clock reported as speed, a slower-only mechanism; the measured count on the faster side is reported as a finding below, never badged.

## Non-circularity

The planner has seen 35-CONTEXT.md's probe percentiles over the full computable population. NONE of the declared shapes reads that population: C and B are both defined by excludedM === 0, a subset the probe never isolated or reported, and both are disjoint from E by construction. The probe's own candidate cuts are cuts applied to the full population -- precisely the shape none of these declarations takes. No probe figure appears as a target, expected value or fixture anywhere in this generator or its tests.

- **S0:** NONE -- S0 reads its cut off the very activity ROADMAP criterion 3 requires to be badged, so it is evidence of nothing. If S0 clears the D-13 insensitivity axes the round is invalid: the generator renders NO SHAPE CLEARS with strawmanCleared: true and never proceeds to C1.
- **C1:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.
- **C3:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.
- **C2:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.
- **C4:** C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C provably has zero distance withheld off the clock and zero time withheld -- precisely the mechanism the badge detects. A cut derived from C cannot be circular with respect to E.
- **B1:** B is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of B provably has zero distance withheld off the clock, though seconds may have been withheld -- B excludes only the distance mechanism, a broader but still non-circular control than C.
- **B2:** B is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of B provably has zero distance withheld off the clock, though seconds may have been withheld -- B excludes only the distance mechanism, a broader but still non-circular control than C.

## Strawmen watched failing

Base population: E (N=1322), statistic: delta, cut=-96.2006

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | badgedCount=1321 baseCut=-96.2006 removedCut=— movement=— | failed |
| Axis B — proportional planting | baseItems=1322 plantsEntered=14 plantedItems=1336 baseCut=-96.2006 plantedCut=21.6440 movement=122.4988% | failed |
| Axis C — base-tail removal | membersRemoved=14 baseItems=1322 trimmedItems=1308 baseCut=-96.2006 trimmedCut=18.5553 movement=119.2882% | failed |

shapeClears: false

**FAILED (expected)** — S0's Axis B status is `failed`, Axis C status is `failed`.

## Shape arbitration

### S0

Base population: E (N=1322), statistic: delta, cut=-96.2006

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | badgedCount=1321 baseCut=-96.2006 removedCut=— movement=— | failed |
| Axis B — proportional planting | baseItems=1322 plantsEntered=14 plantedItems=1336 baseCut=-96.2006 plantedCut=21.6440 movement=122.4988% | failed |
| Axis C — base-tail removal | membersRemoved=14 baseItems=1322 trimmedItems=1308 baseCut=-96.2006 trimmedCut=18.5553 movement=119.2882% | failed |

shapeClears: false

### C1

Base population: C (N=382), statistic: delta, cut=7.2738

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=382 plantsEntered=4 plantedItems=386 baseCut=7.2738 plantedCut=7.9944 movement=9.9059% | failed |
| Axis C — base-tail removal | membersRemoved=4 baseItems=382 trimmedItems=378 baseCut=7.2738 trimmedCut=6.0942 movement=16.2177% | failed |

shapeClears: false

### C3

Base population: C (N=382), statistic: ratio, cut=1.0171

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=382 plantsEntered=4 plantedItems=386 baseCut=1.0171 plantedCut=1.0210 movement=0.3836% | cleared |
| Axis C — base-tail removal | membersRemoved=4 baseItems=382 trimmedItems=378 baseCut=1.0171 trimmedCut=1.0156 movement=0.1417% | cleared |

shapeClears: true

### C2

Base population: C (N=382), statistic: delta, cut=13.7721

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=382 plantsEntered=4 plantedItems=386 baseCut=13.7721 plantedCut=53.2845 movement=286.9006% | failed |
| Axis C — base-tail removal | membersRemoved=4 baseItems=382 trimmedItems=378 baseCut=13.7721 trimmedCut=11.1507 movement=19.0345% | failed |

shapeClears: false

### C4

Base population: C (N=382), statistic: ratio, cut=1.0330

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=382 plantsEntered=4 plantedItems=386 baseCut=1.0330 plantedCut=1.1092 movement=7.3745% | failed |
| Axis C — base-tail removal | membersRemoved=4 baseItems=382 trimmedItems=378 baseCut=1.0330 trimmedCut=1.0247 movement=0.8086% | cleared |

shapeClears: false

### B1

Base population: B (N=598), statistic: delta, cut=7.4377

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=598 plantsEntered=6 plantedItems=604 baseCut=7.4377 plantedCut=8.4313 movement=13.3587% | failed |
| Axis C — base-tail removal | membersRemoved=6 baseItems=598 trimmedItems=592 baseCut=7.4377 trimmedCut=5.7569 movement=22.5978% | failed |

shapeClears: false

### B2

Base population: B (N=598), statistic: ratio, cut=1.0180

| Axis | Detail | Status |
|---|---|---|
| Axis A — judged-contribution removal | not applicable -- base population is disjoint from the badged population by construction | structural (0 by construction) |
| Axis B — proportional planting | baseItems=598 plantsEntered=6 plantedItems=604 baseCut=1.0180 plantedCut=1.0223 movement=0.4267% | cleared |
| Axis C — base-tail removal | membersRemoved=6 baseItems=598 trimmedItems=592 baseCut=1.0180 trimmedCut=1.0157 movement=0.2302% | cleared |

shapeClears: true

Selected: C3

## Chosen constants

PACE_DISAGREEMENT_RUNNING_RATIO = 1.0171
PACE_DISAGREEMENT_RUNNING_RATIO provenance: calibrated (shape C3, base population C, N=382)

## Gates

| Gate | Measured | Status |
|---|---|---|
| Basis gate (3475724402 badged under eligibility + slower-only direction) | eligible=true targetValue=1.0731 cut=1.0171 | PASS |

Newly-disputed count under the chosen cut (population E): 124
Faster-side count at the mirror cut (D-06 finding, never badged): 15
Gate-excluded population (excludedM === 0, D-02's eligibility gate excludes this set): n=598, own delta summary: q50=0.50 min=-4.16 max=212.80
Non-computable (deriveRunningPace): 1 ({"stream has no covered distance or no covered time":1})

| Named activity | found | eligible | delta | ratio | status |
|---|---|---|---|---|---|
| 3475724402 | yes | true | 21.64 | 1.0731 | badged |
| 3475734189 | yes | true | 13.98 | 1.0410 | badged |
| 3475740390 | yes | true | 2.43 | 1.0071 | not badged |
| 5059204779 | yes | true | 243.25 | 3.1612 | badged |

## Inputs

- Streams scanned: 1929, parse errors: 0, missing metadata: 0
- data/streams git tree (git rev-parse HEAD:data/streams): `423cdc2bafc3dd0f0927e0e070cf0bdeb2bfe0e7`
- Newest activity start date: 2026-11-24T06:34:17Z
- Regenerate: `npm run compute-running-pace-dispute-calibration`
