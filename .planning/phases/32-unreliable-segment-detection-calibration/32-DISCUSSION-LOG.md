# Phase 32: Unreliable-Segment Detection & Calibration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 32-Unreliable-Segment Detection & Calibration
**Areas discussed:** Suunto vs the jumps, Mechanism boundaries, Calibration population, Figures of record & evidence

Two throwaway probes were run against the committed streams during the discussion to ground the
options (per-sample speed >7 m/s, uncalibrated). Their outputs are quoted in CONTEXT.md as
references, not expected values. The probes were inline `node -e` one-liners and were not committed.

---

## Suunto vs the jumps

### Q1 — ROADMAP criterion 4 ("flagged under its own label") vs PITFALLS Pitfall 2 ("must stay unflagged")

Context presented: the five isolated jumps measure 10.0–14.3 m/s, below the Suunto's 17 m/s, so a
speed rule alone cannot spare the Suunto. Also: no planning document records the Suunto activity ID.

| Option | Description | Selected |
|--------|-------------|----------|
| Detected, own label (Recommended) | Follow ROADMAP/SEG-04; Pitfall 2 superseded with the measurement as reason | ✓ |
| Whatever the rule says | Measure first on the committed stream; label exists only if actually detected | |
| Must stay unflagged | Find a second discriminator beyond speed; criterion 4 would need amending | |

**User's choice:** Detected, own label

### Q2 — Where the "own mechanism label" comes from

| Option | Description | Selected |
|--------|-------------|----------|
| No separate label from t/d (Recommended) | Detector labels it isolated-jump; artifact discloses it cannot distinguish over-measurement; criterion 4 wording amended | ✓ |
| Device family decides | Phase 27 device-era passed in; breaks t/d-only purity, sample of one | |
| Pinned activity list | Committed list of verified IDs relabels after detection | |

**User's choice:** No separate label from t/d

### Q3 — Is clipping / barring a PR window a "correction"?

| Option | Description | Selected |
|--------|-------------|----------|
| Same treatment as a jump (Recommended) | Withholding a claim is not altering distance/totals/splits; one treatment everywhere | ✓ |
| Disclose only, don't clip | Reported but excluded from clipping and the best-effort guard | |
| Defer to Phases 33/36 | Each consumer decides | |

**User's choice:** Same treatment as a jump

### Q4 — The vacant negative control

| Option | Description | Selected |
|--------|-------------|----------|
| Archive's fastest clean runs (Recommended) | Research pins 2–3 named corroborated-genuine activity IDs as must-not-fire; headroom reported | ✓ |
| You name them | Developer supplies stride/track activity IDs | |
| Personal ceiling as the floor | Limit sits above 5.11 m/s by a margin; no named fixtures | |

**User's choice:** Archive's fastest clean runs

---

## Mechanism boundaries

Context presented: probe on 3475724402 reproduced 30 bursts / 18 gaps / 1,694 m / 106 s / 707 s; all
30 bursts 0 s from a gap boundary (17 trailing, 13 leading); 680 m inside the gaps; inter-gap
spacings as short as 16 s.

### Q1 — Adjacency rule

| Option | Description | Selected |
|--------|-------------|----------|
| Touching only (Recommended) | Run begins/ends on the gap's boundary sample; near-misses swept and reported as a finding | ✓ |
| Calibrated tolerance | Within a measured N s/samples; second constant, swallows clean samples | |
| You decide | Research measures the distribution; planner picks | |

**User's choice:** Touching only

### Q2 — Chaining across short clean spans

| Option | Description | Selected |
|--------|-------------|----------|
| Never swallow clean samples (Recommended) | Chain only when contiguous; clean time never reclassified | ✓ |
| Chain across short clean spans | Gaps closer than a calibrated spacing merge, including clean samples | |

**User's choice:** Never swallow clean samples

### Q3 — Hidden-pause vs isolated-jump discriminator

| Option | Description | Selected |
|--------|-------------|----------|
| Metres carried (Recommended) | Boundary calibrated from the archive distribution; "no clean valley" reported if so | ✓ |
| Speed regime | At the ~29.5 m/s cap = hidden pause; but real slews span 8.6–27.9 m/s | |
| You decide | Research measures both; planner picks, recording the loser's confusion count | |

**User's choice:** Metres carried

### Q4 — Significance floor

| Option | Description | Selected |
|--------|-------------|----------|
| Excess-metres floor, calibrated (Recommended) | Own non-circularity argument; must admit the 24.7 m / 2 s jump at t=2587 | ✓ |
| No floor — the limit decides | One constant; many trivial segments, count reported | |
| You decide | Research measures each choice's reach | |

**User's choice:** Excess-metres floor, calibrated

---

## Calibration population

### Q1 — Shape of the speed-limit statistic

| Option | Description | Selected |
|--------|-------------|----------|
| Delegate under the same property (Recommended) | Bulk-set, never a judged-population tail percentile, never round, anti-quota | ✓ |
| Anchor between measured boundaries | Between fastest genuine run and the 10.0 m/s jump | |
| Multiple of the personal ceiling | K × 5.11 m/s; cross-phase circularity with Phase 36 | |

**User's choice:** Delegate under the same property

### Q2 — Severely-decimated streams

| Option | Description | Selected |
|--------|-------------|----------|
| One rule, prove disjointness (Recommended) | Overlap with the decimation-severe cohort measured and explained; tracking = calibration failure | ✓ |
| Higher bar when severe | Run-length floor / higher limit on severe streams | |
| Not-computable when severe | Could blind the detector on ~154 activities | |

**User's choice:** One rule, prove disjointness

### Q3 — Local 1 Hz FIT originals

| Option | Description | Selected |
|--------|-------------|----------|
| Validation only, not derivation (Recommended) | Constants from committed t/d; local script cross-checks and commits dated findings | ✓ |
| Not at all this phase | Committed streams only | |
| Derive from FIT too | Strongest evidence; not CI-regenerable | |

**User's choice:** Validation only, not derivation

### Q4 — What the non-circularity argument must demonstrate

| Option | Description | Selected |
|--------|-------------|----------|
| Insensitivity, demonstrated (Recommended) | Re-derive with segments removed and with planted slews added; watched failing on a circular statistic | ✓ |
| Stated population filter | Prose argument, the Phase 28 docblock standard | |
| You decide | Planner picks the proof form | |

**User's choice:** Insensitivity, demonstrated

---

## Figures of record & evidence

Context presented: no `data/streams/` byte-identity gate exists today (checked `scripts/`, `src/`,
`.github/`).

### Q1 — Stream immutability gate in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — existing files immutable (Recommended) | sha256 manifest; fails on a changed digest, tolerates new files; watched failing | ✓ |
| Yes, but structural only | Audit that nothing opens data/streams for writing | |
| Not this phase | Keep the by-hand milestone-close check | |

**User's choice:** Yes — existing files immutable

### Q2 — Headline figure of record

| Option | Description | Selected |
|--------|-------------|----------|
| Per-mechanism, three units (Recommended) | Activities, segments, metres+seconds by mechanism; reconciliation table vs the probe | ✓ |
| Activities with ≥1 segment | One quotable count, breakdown beneath | |
| You decide | Planner shapes after research | |

**User's choice:** Per-mechanism, three units

### Q3 — Form of the independent per-segment table

| Option | Description | Selected |
|--------|-------------|----------|
| Committed script, no detector import (Recommended) | Different algorithm (gap-first), structurally asserted, shown failing first | ✓ |
| Hand-derived, frozen | Independent of any code; goes stale when the limit moves | |
| Both | Script of record plus hand-checked spot rows | |

**User's choice:** Committed script, no detector import

### Q4 — How SEG-05 closes with no consumer wired

| Option | Description | Selected |
|--------|-------------|----------|
| Split it: audit now, consumers later (Recommended) | SEG-05a in Phase 32; SEG-05b per consuming phase; REQUIREMENTS amendment | ✓ |
| Tick on the audit alone | Close SEG-05 in Phase 32 as mapped | |
| Hold SEG-05 open until Phase 36 | Phase 32 closes 4/5 by design | |

**User's choice:** Split it: audit now, consumers later

---

## Claude's Discretion

- Exact statistic, multiplier and tolerance for the speed limit, metres boundary and excess-metres
  floor (bound by D-10, D-13).
- Detector output types and segment itemisation.
- What the extended single-source audit bans.
- The near-miss sweep's reporting window.
- Stream-manifest location/format; artifact and script names.

## Deferred Ideas

- Tolerance-based adjacency, revisited only if the near-miss count is material.
- A reliable over-measurement-vs-jump discriminator — with the STREAM-05 revisit.
- Reviewed, not folded: "Garmin export adapter when export arrives" (keyword-only match, score 0.2).
