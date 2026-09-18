# Phase 30: Elevation Quality Signal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 30-elevation-quality-signal
**Areas discussed:** Closure-drift loop test, Signal home & severity, Disclosure surfaces, Validation report & proof

---

## Closure-drift loop test

**Q1 — How should the detector define drift, given 12 of the 34 are point-to-point runs?**

| Option | Description | Selected |
|--------|-------------|----------|
| Loop-gated via metadata | Drift fires only when start_latlng/end_latlng are within a radius; cohort becomes ~21 | ✓ |
| Raw start/end difference | Flag \|alt[end] − alt[start]\| > 60 m regardless of geography; reproduces 34 | |
| Both, reported separately | Loop-gated flag, raw count as an unflagged diagnostic | |

**Q2 — What does drift report when start/end position is absent (232 activities)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Not-computable for drift only | Other modes still run; never-coerce rule at per-mode granularity | ✓ |
| Fall back to raw difference | Keeps coverage, reintroduces the false positive where it can't be checked | |
| Skip silently | Treat as not-drifting | |

**Q3 — How are the 60 m threshold and loop radius set?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism-justified, researcher picks radius | 60 m stays; radius derived from the archive's start/end distance distribution | ✓ |
| Fixed 60 m / 200 m now | Lock both here | |
| Scale drift threshold with duration | m per hour rather than flat 60 m | |

**Q4 — How is Criterion 1's "at least 34" reconciled?**

| Option | Description | Selected |
|--------|-------------|----------|
| Correct the criterion to the loop-gated count | Update ROADMAP + ELEV-01; list the 12 point-to-point IDs as excluded-by-design | ✓ |
| Keep 34 as a floor, report both | Satisfy via the raw diagnostic count | |

**Notes:** The scouting measurement (2026-09-18) reproduced 11/34/39/71 with raw definitions; the loop test was the discovery that the requirement's own wording was not what was measured.

---

## Signal home & severity

**Q1 — Where does the elevation signal live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sixth signal in ActivityQualitySignals | Same shard, index row, compute step | ✓ |
| Separate elevation module + own shard | Own compute step; second fetch on detail open | |
| Index-row scalars only, no shard evidence | Smallest change, loses per-sample findings | |

**Q2 — Does elevation join the anySevere composite?** (measured: 299/1,890 severe today; 42 of 71 already severe; joining → 328)

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered but outside the composite | Own tier + badge; anySevere and Phase 27 numbers unchanged | ✓ |
| Joins the composite | 15.8% → 17.4%; recount/calibration revisited | |
| Untiered labelled fact | Like deviceEra | |

**Q3 — Tier shape?**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-mode booleans, one rolled-up tier | severe iff any mode fires; no minor band | ✓ |
| Add a minor band per mode | Three new unjustified knobs | |
| Three independent tiers, no roll-up | Triples the interface and badge surface | |

**Q4 — How is vertical rate computed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-sample Δalt/Δt on the committed stream, skip Δt≤0 | Reproduces 39; worst rate + violating count | ✓ |
| Exclude samples crossing classified gaps | Adds a dependency; likely a no-op | |
| Windowed rate | Suppresses the spikes the mode exists to catch | |

---

## Disclosure surfaces

**Q1 — Row badge on the three renderActivityRow surfaces?**

| Option | Description | Selected |
|--------|-------------|----------|
| One 'elevation' badge naming the fired modes | Severe only, one badge with worst value | ✓ |
| One badge per fired mode | Up to three altitude badges on a row | |
| No row badge, detail view only | Conflicts with roadmap UI hint | |

**Q2 — Detail-view quality section?**

| Option | Description | Selected |
|--------|-------------|----------|
| Three always-on mode lines | Healthy or not, tier-styled, with values | ✓ |
| One elevation line, expanded only when flagged | Silence-as-good-news | |
| Mode lines + marker on the elevation chart | New interactive surface | |

**Q3 — Caveats on other elevation figures?**

| Option | Description | Selected |
|--------|-------------|----------|
| Caveat the detail stat card only | Elevation Gain card badged via the paceDisagreement precedent | ✓ |
| No caveats anywhere else | Card would state a number the page flags | |
| Caveat card + splits + aggregates | Correction-by-disclaimer | |

**Q4 — New list filter?**

| Option | Description | Selected |
|--------|-------------|----------|
| No new filter this phase | Deferred | ✓ |
| Add an 'elevation flagged' toggle | Second checkbox + URL param | |

---

## Validation report & proof

**Q1 — Fixtures for Criterion 2's independence proof?**

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic per mode + pinned real exemplars | Three makeStream synthetics + pin 4745489664 and 3149636661 (4556693525 already pinned) | ✓ |
| Synthetic only | Nothing ties detectors to the named archive exemplars | |
| Pinned real only | 3149636661 fires two modes; isolation needs a single-mode stream | |

**Q2 — Archive-wide report?**

| Option | Description | Selected |
|--------|-------------|----------|
| 30-CALIBRATION.md, same convention | scripts/compute-elevation-calibration.mjs; loop-gate exclusions + independence evidence sections | ✓ |
| Extend 27-CALIBRATION.md | Couples regeneration to Phase 27's script | |

**Q3 — Proof that data/streams/ is byte-unchanged?**

| Option | Description | Selected |
|--------|-------------|----------|
| Digest before/after in the calibration script + code audit | sha256 roll-up before and after; fail on difference; no-fs-write audit | ✓ |
| git status clean check only | Blind on a dirty tree | |
| Code audit only | Proves intent, not outcome | |

**Q4 — What ends the phase?**

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight browser checkpoint of its own | One short round on three surfaces + detail lines + card caveat | ✓ |
| Recount script only, no browser round | Three shipped defects behind green gates argue against | |

---

## Claude's Discretion

- Field names, badge wording, sr-only explanation sentences
- One shared synthetic baseline vs three builders
- Report layout beyond the named sections; recount script structure
- Signed vs absolute `deltaM` storage (recommended signed)
- Plan/wave breakdown; where the D-04 requirement-text correction lands

## Deferred Ideas

- Elevation-flagged list filter / URL param
- Marker on the detail altitude chart
- Caveats on aggregate elevation totals
- DEM correction / grade-adjusted pace (milestone non-goal)
- Reviewed, not folded: Garmin export adapter todo (keyword-only match, externally blocked)
