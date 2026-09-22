# Phase 34: Pause Classification & Forgotten-Stop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 34-Pause Classification & Forgotten-Stop
**Areas discussed:** Classes vs running-speed gaps, Speed-band anchors, What counts as a forgotten stop, How it's shown on the detail view

Two throwaway probes ran during the discussion (implied speed per `classifyGaps` interval across
1,788 streams; near-zero stretches inside covered time). Their figures are recorded in CONTEXT.md
as references only.

---

## Classes vs running-speed gaps

| Option | Description | Selected |
|--------|-------------|----------|
| Gap-bearing only | Recording gaps + gap-adjacent merged segments; jumps/hidden pauses not-classifiable; pauses stationary by definition | ✓ |
| Every interval | Literal PAUSE-01; ~1,230 GPS jumps land in transported | |
| Gaps only, skip merged | Contradicts PAUSE-01 / criterion 1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Add a 4th class | stationary / walked / ran-through / transported; dated PAUSE-01 amendment | ✓ |
| "walked" = on foot | Three classes; a 4.06 m/s segment reads "walked" | |
| Leave unclassified | "ambiguous" residual | |

| Option | Description | Selected |
|--------|-------------|----------|
| Classify all, no floor | No new constant; metres/seconds shown | ✓ |
| Calibrated minimum duration | "too short to classify" below a derived floor | |
| You decide | Research measures short-gap noise | |

| Option | Description | Selected |
|--------|-------------|----------|
| Both, side by side | v2.2 rule re-run on merged segments + transported count; pointer in v2.2 archive | ✓ |
| Old rule only | | |
| Class count replaces it | | |

**Notes:** Probe showed 3475724402's merged intervals at 2.31–4.06 m/s (slow running, not walking)
and no-gap segments above 7.35 m/s by construction.

---

## Speed-band anchors

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse 7.35 m/s | Import `UNRELIABLE_SPEED_LIMIT_MPS` for ran-through→transported | ✓ |
| Own calibrated edge | ~2 intervals above 7.35 to calibrate on | |

| Option | Description | Selected |
|--------|-------------|----------|
| Valley in own speeds | Walk/run valley in covered-time speed distribution; D-13; HALT if none | ✓ |
| Fraction of your running | Multiplier is a choice | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Shared with STOP-02 drift | One "not moving" constant for pause class and forgotten stop | ✓ |
| Separate edges | | |

| Option | Description | Selected |
|--------|-------------|----------|
| HALT and return to you | NO-VALUE artifact, pre-declared shapes (33-08/33-14 pattern) | ✓ |
| Best-effort label, disclosed | 32 D-08 pattern | |

---

## What counts as a forgotten stop

| Option | Description | Selected |
|--------|-------------|----------|
| Covered creep + pause intervals | Itemised by source; STOP-01 wording amended to timer-running time | ✓ |
| Covered time only, literal | Rarely fires; zero-advance standstills never flagged | |
| Pause intervals only | Drop creep detection | |

| Option | Description | Selected |
|--------|-------------|----------|
| not-computable, with reason | Distance-triggered etc.; clean always means "looked, found none" | ✓ |
| Compute anyway, show 0 | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Untiered fact | Total/longest/count; no cut, no badge, outside composite | ✓ |
| Tiered none/minor/severe | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Research finds, you confirm | 2–3 candidates, developer confirms, two-way reachability | ✓ |
| I'll name one | | |
| Research finds and pins | | |

**Notes:** Probe: covered near-zero stretches rare (35–76 activities ≥30 s depending on cut) vs
663 zero-advance `pause` intervals.

---

## How it's shown on the detail view

| Option | Description | Selected |
|--------|-------------|----------|
| New Pauses section + summary row | Section lists intervals; Quality Signals summary row | ✓ |
| Inside Quality Signals only | | |
| Folded into Splits | | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, list only | Phase 33 chart untouched | ✓ |
| Tint clipped bands by class | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Detail view only | Phase 37 queue is the surfacing path | ✓ |
| Badge transported on rows | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Everything off the clock, jumps excluded | Gaps, merged segments, pauses, creep stops; cap 100 | ✓ |
| Only ≥ some duration | | |

---

## Claude's Discretion

- Index key / shard field names and shapes (additive).
- Artifact and script names; one artifact or several.
- Pauses section copy, column order, empty state.
- How the blind-spot not-computable rule is expressed (t/d only).
- Classifier module location, subject to the single-source audit.

## Deferred Ideas

- Pace-chart class tinting; transported list badge/filter; tiered stop signal; STOP-04.
- Todo "Pace chart y-axis compressed by pre-pause run-in samples" — reviewed, kept deferred.
