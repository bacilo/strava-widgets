# Phase 33: Coverage Integration — Pace Clipping & Segment Signal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 33-coverage-integration-pace-clipping-segment-signal
**Areas discussed:** Coverage ledger split, gapProfileSignal fraction, SEG-06 severity & badging, Split marker & caption copy, ROADMAP wording amendment, Browser checkpoint design, Detector in the browser path, SEG-05b's Phase 33 half

---

## Coverage ledger split

### Which seconds become "unreliable"

| Option | Description | Selected |
|--------|-------------|----------|
| Whole segment | Full `[startSec, endSec]` becomes one unreliable interval at the top of the strict-priority tree; gap-adjacent time moves out of recording-gap/pause. ~11,574 s across 63 activities moves between shipped caption terms. | ✓ |
| Burst seconds only | Only previously-`covered` burst parts become unreliable; gap parts stay put. Purely additive, no shipped figure moves. | |

**User's choice:** Whole segment (recommended)
**Notes:** Rationale recorded as D-01 — SEG-02 already makes the merged segment the unit of truth, so "how long was this segment" must have one answer.

### How the new class surfaces on `PaceCoverage`

| Option | Description | Selected |
|--------|-------------|----------|
| Widen `GapKind` | `'unreliable'` joins the union, `unreliableSec` added, segments land in the SAME `gapIntervals` array; clipping/histogram/split annotation inherit with zero call-site changes. | ✓ |
| Separate parallel array | `unreliableIntervals` beside a two-kind `gapIntervals`; no consumer can mis-bucket, but nothing clips until each is updated. | |

**User's choice:** Widen `GapKind` (recommended)
**Notes:** Two silent-inheritance traps surfaced during the discussion and recorded in CONTEXT.md § Integration Points — `splitGapAnnotations`' two-way else-branch, and `gapProfileRow`'s "N gap intervals" evidence line.

### Where the archive-wide identity proof lives

| Option | Description | Selected |
|--------|-------------|----------|
| Artifact + fixture guard | Archive-wide scan in a regenerable, idempotent artifact from the detector-free recount; `npm test` keeps a fast named-fixture guard and today's single-activity crosscheck. | ✓ |
| Archive-wide in `npm test` | Full 1,874-stream scan every suite run; nothing can go stale, but the suite is already serialised. | |
| Both | Maximum coverage, two places the number is computed. | |

**User's choice:** Artifact + fixture guard (recommended)
**Notes:** Raised in the question itself — sum-equals-span is near-tautological; the load-bearing check is `unreliableSec` against an independently recounted total.

---

## gapProfileSignal fraction

### Does unreliable time enter the numerator

| Option | Description | Selected |
|--------|-------------|----------|
| Include it | `(recordingGapSec + pauseSec + unreliableSec) / spanSec`; the 63 gap-adjacent activities keep today's fraction, so no shipped badge is silently lost. | ✓ |
| Exclude it | Fraction stays two-term; mechanically shrinks for those 63 activities, dropping badges purely from a re-label. | |
| Exclude, and pin the loss | Exclude, but measure and report which activities change tier. | |

**User's choice:** Include it (recommended)
**Notes:** Measured impact supplied with the question — hidden-pause ~25 s/activity, isolated-jump ~4.8 s/activity, both fractions of a percent.

### The 0.05 / 0.20 thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen, movement reported | Phase 27's measured cuts stand; before/after tier migration reported as a finding, including if zero. | ✓ |
| Re-derive against the new distribution | Treat the four-way fraction as a new population with a fresh non-circularity argument. | |

**User's choice:** Frozen, movement reported (recommended)
**Notes:** Phase 27 D-02's anti-quota rule restated explicitly for a reader tempted to "recalibrate" after the numerator changes.

---

## SEG-06 severity & badging

### Tiering and the severe composite

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered, out of composite | none/minor/severe, badges only at severe, `hasAnySevereSignal`'s `Pick<>` never widened — the Phase 30 elevation precedent. | ✓ |
| Tiered, in the composite | Arguably a pace-trust signal in a way elevation is not; moves the composite and the list filter it drives. | |
| Untiered fact | Disclosed on the detail view only, no row badge anywhere. | |

**User's choice:** Tiered, out of composite (recommended)
**Notes:** Measured context supplied — 699/1,874 (37.3%) carry ≥1 segment, so presence-as-severe would badge over a third of the archive against today's 15.8% composite.

### The measure behind the tier

| Option | Description | Selected |
|--------|-------------|----------|
| Excess metres ÷ activity distance | The detector's own D-09 excess concept; catches the 199 m hidden pause and leaves a 34 m jump on a 10 km run quiet. One new constant under D-13 insensitivity. | ✓ |
| Unreliable seconds ÷ span | Mirrors `gapProfile`'s shape; scores 3475734189's hidden pause at ~0.2% of span. | |
| Both, either clears | Catches both shapes; two constants to derive and keep insensitive. | |

**User's choice:** Excess metres ÷ activity distance (recommended)
**Notes:** The 199 m-in-7 s hidden pause was used as the discriminating test case.

### What each layer carries

| Option | Description | Selected |
|--------|-------------|----------|
| Row scalars + shard segments | Index row: tier, count, metres, excess metres, seconds, mechanisms. Shard: per-segment list without `parts`, capped at 100. | ✓ |
| Row scalars + full segments | Shard carries complete `UnreliableSegment` objects including itemised `parts`. | |
| Row scalars only | No shard change; evidence line can only restate the badge. | |

**User's choice:** Row scalars + shard segments (recommended)
**Notes:** Follows D-17's profile-not-per-sample-arrays discipline; measured scale ~2 segments per flagged activity.

---

## Split marker & caption copy

### How an unreliable segment shows on a split

| Option | Description | Selected |
|--------|-------------|----------|
| One marker, unreliable wins | `unreliableSec` added to the annotation; unreliable takes priority when present, gap and pause keep today's magnitude rule between themselves. | ✓ |
| One marker, three-way magnitude | Largest seconds wins across three categories; a small jump inside a long pause goes unnamed. | |
| Its own marker | A split can carry both markers; breaks the one-category-per-split copy contract. | |

**User's choice:** One marker, unreliable wins (recommended)
**Notes:** Edge case that drove it — a split holding a 200 s pause and a 2.7 s isolated jump.

### The caption's fourth term

| Option | Description | Selected |
|--------|-------------|----------|
| `· W% unreliable`, always on | Four terms rendered even at 0%, matching COV-02's always-on rule; independent rounding preserved. | ✓ |
| `· W% unreliable segments` | Self-explanatory without the detail view; longer heading line. | |
| Render only when non-zero | Shorter for the ~62.7% with no segments; absence stops meaning "zero". | |

**User's choice:** `· W% unreliable`, always on (recommended)
**Notes:** —

### Widening the existing gap-profile copy

| Option | Description | Selected |
|--------|-------------|----------|
| Name all three | Badge `…in gaps, pauses or unreliable segments`; row label `Coverage gaps`; healthy `No gaps, pauses or unreliable segments`. | ✓ |
| Category-neutral phrase | `Coverage` / "not trustworthy"; drops the itemisation the docblock protects. | |
| Leave it, disclose separately | Zero churn; badge would name two of its number's three components. | |

**User's choice:** Name all three (recommended)
**Notes:** Surfaced as a knock-on of the gapFraction decision — the existing badge docblock states that naming only one category would misdescribe the number.

---

## ROADMAP wording amendment

| Option | Description | Selected |
|--------|-------------|----------|
| Dated amendment | Amend the goal in place, narrowing "zero code change outside `pace-derivation.ts`" to the clipping mechanism, with provenance — the Phase 32 D-03 pattern. | ✓ |
| CONTEXT-only scoped reading | Leave ROADMAP.md alone and record the reading here. | |

**User's choice:** Dated amendment (recommended)
**Notes:** Raised unprompted during the discussion — PACE-09, COV-03 and SEG-06 all necessarily touch files outside `pace-derivation.ts`, so the unamended phrase is a trap for the verifier.

---

## Browser checkpoint design

| Option | Description | Selected |
|--------|-------------|----------|
| Derived extent + control | Each row compares the rendered fastest hovered tooltip against a value derived from raw `t`/`d` outside the changed code; plus a clean control activity and a CAN FAIL / CAN PASS proof per row. | ✓ |
| Absence of the named samples | Assert the 0:34/km and 1:10–1:40/km values are gone; cannot distinguish clipped from not-rendered. | |

**User's choice:** Derived extent + control (recommended)
**Notes:** Chosen against this project's two repeat failure shapes — internal agreement, and absence mistaken for correctness.

---

## Detector in the browser path

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, one code path | `classifyGaps` calls the detector wherever it runs; caption, chart, histogram and splits agree by construction. | ✓ |
| Precomputed from the shard | CI computes once, browser passes segments in; second source of truth, and the shard arrives after first paint. | |

**User's choice:** Yes, one code path (recommended)
**Notes:** The shard's post-first-paint arrival was the decisive argument, ahead of the structural one.

---

## SEG-05b's Phase 33 half

| Option | Description | Selected |
|--------|-------------|----------|
| Correct it, record this half | Untick and re-mark Pending with dated provenance; Phase 33 records its half, proven load-bearing by stubbing the call, not by the import existing; re-tick after 35 and 36. | ✓ |
| Correct it, defer the definition | Untick now, leave the evidence bar to the planner and per-phase verifier. | |
| Leave the tick alone | No REQUIREMENTS.md churn; row text and checkbox go on contradicting each other. | |

**User's choice:** Correct it, record this half (recommended)
**Notes:** The contradiction was found during this discussion — `REQUIREMENTS.md:24` is `[x]`/Complete while the row text says it stays Pending until every consuming phase records its part, and Phase 32 had no consumer at all.

---

## Claude's Discretion

- The statistic, percentile order and tolerance for D-07's excess-metres tier cut.
- Field names and exact shape of the new index-row scalars and shard segment projection.
- Whether `unreliableSec` is echoed on `GapProfileSignal` beside `recordingGapSec`/`pauseSec`.
- Artifact filename and generator/recount script names.
- The new quality-signal row's label, evidence-line wording and `descriptionIdSuffix`.
- How `unreliable`'s marker priority is expressed in code.
- Choice of the clean control activity for the checkpoint.

## Deferred Ideas

- Splitting the gap-profile signal in two (recording gaps vs unreliable segments) rather than
  widening its copy — revisit only if the widened badge text proves unreadable at phone widths.
- A reliable over-measurement-vs-jump discriminator (needs lat/lng or the 1 Hz speed channel) —
  carried from 32-CONTEXT.md.
- Whether the near-miss sweep justifies a tolerance-based adjacency rule — carried from
  32-CONTEXT.md.
