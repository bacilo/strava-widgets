# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 26-shared-gap-aware-pace-derivation-honest-coverage
**Areas discussed:** Windowing mechanism, Gap taxonomy & thresholds, Metadata-vs-stream cross-check,
Coverage disclosure on screen, Split gap marking (five of eight selected; the remaining three —
coverage denominator, module shape & audit, residual report & fixture library form — were defaulted
by explicit developer instruction, see "Pacing decision" below)

---

## Area selection

Eight gray areas were presented across two multi-select questions. The developer selected **all
eight**. Two todo matches surfaced by `todo.match-phase 26` (Garmin export adapter; curation-guard
cosmetics) were assessed as out of scope and recorded as reviewed-not-folded without spending a
question on them.

---

## Windowing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive width (time-based) | Keep the centred real-time window; compute width per-activity from its own advance interval. Inherits the roadmap's measured recovery figures. | |
| Advance-boundary integration | Snap window edges to distance advances; average over N advances not N seconds. Scale-free, but every measured figure must be re-derived. | |
| Hybrid: advances with a time floor | Integrate advance-to-advance with a minimum span. Most robust; two knobs to justify. | |
| You decide | Claude picks, constrained to whatever survives the four measured interval profiles with fixed-20s demonstrated failing first. | ✓ |

**User's choice:** You decide.
**Notes:** Recorded as D-01/D-02/D-03. The default taken was adaptive time-based width, on the
grounds that it is the mechanism the roadmap's own recovery numbers were measured under, so
Criteria 1 and 5 inherit them rather than requiring re-derivation. D-03 leaves the door open for
research to override, but only by re-deriving PACE-03/04/06's figures and recording the comparison.

---

## Gap taxonomy & thresholds

Grounded first by profiling the committed archive (250-activity random sample plus the four named
interval profiles). Key measurement surfaced during the discussion: activity 5059204779 has samples
every 2s and a maximum time gap of 7s — no recording gap at all — yet 97% of its elapsed time sits
in distance-flat runs, because its watch emits distance once per minute. The pinned exemplar
4556693525 shows 28% flat time, which matches the shipped histogram's known 72% coverage exactly.

| Option | Description | Selected |
|--------|-------------|----------|
| Two signals, scale-relative | Recording gap = t-jump (absolute); pause = distance-flat run long relative to that activity's own advance interval. Matches PROJECT.md's two measured cohorts. | |
| Sample absence only | Only a stretch with no samples is a gap; flat time stays covered. Simplest, immune to the emitter trap, but no category for the 321-activity pause cohort. | |
| Three categories | Recording gap, pause, and a named short standstill. Richest itemisation; three thresholds to defend. | |
| (free text) | — | ✓ |

**User's choice:** "you decide".
**Notes:** Recorded as D-04/D-05. The recommendation (two signals, pause scale-relative) was taken.
D-05 records the non-negotiable discriminator: an absolute distance-flat threshold misclassifies
~97% of 5059204779 as paused, so the pause rule must be demonstrated failing under an absolute
threshold before the scale-relative one is trusted.

---

## Pacing decision (mid-discussion)

After two consecutive delegations, the developer was asked how to spend the remaining six areas.

| Option | Description | Selected |
|--------|-------------|----------|
| Only the visible ones | Default the four internal engineering areas with rationale; discuss the three the developer will actually look at. | ✓ |
| Decide everything, I'll review | Default everything and review CONTEXT.md before planning. | |
| Keep going area by area | Full question-per-area flow through all six. | |

**User's choice:** Only the visible ones.
**Notes:** Coverage denominator, module shape & audit, residual report form and fixture library home
were consequently locked as defaults (D-06/D-07, D-15..D-18, D-19, D-20) with rationale recorded in
CONTEXT.md rather than asked.

---

## Metadata-vs-stream cross-check

Context supplied: the bogus 1:53/km surfaces on the Activities list pace column and row meta line,
the detail Pace stat card, and — less obviously — the splits `+/-` column, which diffs every split
against that same activity average.

| Option | Description | Selected |
|--------|-------------|----------|
| Badge it, keep metadata | Metadata pace still displays, with a visible badge naming the disagreement and the stream-derived value. Nothing recomputed. | ✓ |
| Suppress and explain | Replace the disputed number with an explicit flagged state plus the stream value as context. | |
| Substitute the stream value | Show 5:51/km with a marker. Most useful number, but makes a derived value authoritative on a metadata-driven surface. | |

**User's choice:** Badge it, keep metadata.
**Notes:** Recorded as D-10. Preserves PROJECT.md's "device `moving_time` stays the shipped
aggregate" non-goal — disclosure rather than overruling.

### Follow-up: badge placement

| Option | Description | Selected |
|--------|-------------|----------|
| Detail view + list row | Badge on the Pace stat card and a marker on the Activities list row, so a disputed pace is never unmarked where it sorts #1 fastest. | ✓ |
| Detail view only | List stays untouched; a pace-sorted list still shows 1:53/km at the top unmarked. | |
| Detail + exclude from pace sort | Additionally drop flagged activities from pace sort/filter, like a null pace. | |

**User's choice:** Detail view + list row.
**Notes:** Recorded as D-11 and D-12. Explicitly *not* suppressed from sort/filter — hiding a real
activity from a filtered list has no precedent in this archive. Touches Phase 20's shared
`renderActivityRow` and its three surfaces.

### Follow-up: the splits +/- baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Stream-derived average | For flagged activities only, diff against 5:51/km so the column stays meaningful. | ✓ |
| Drop the column when flagged | Omit `+/-` rather than diff against a known-wrong number. | |
| Leave it as-is | Keep diffing against metadata; the badge already warns. | |

**User's choice:** Stream-derived average.
**Notes:** Recorded as D-13. Today every real kilometre on 5059204779 reads ~4 minutes slow.

---

## Coverage disclosure on screen

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on line with breakdown | Caption under the heading on every activity: covered % plus per-category excluded %. | ✓ |
| Always-on percentage only | Single covered % caption; categories stay in the data. | |
| Only when below a threshold | Caption appears only under some coverage bar; clean runs render as today. | |

**User's choice:** Always-on line with breakdown.
**Notes:** Recorded as D-08. Always-on was preferred partly because Criterion 3 requires a coverage
percentage to be *read in the browser* and compared against a hand-sum of the stream file — a
threshold-conditional caption makes that read-back depend on picking a tripping activity, and turns
"no caption" into an ambiguous signal.

---

## Split gap marking

| Option | Description | Selected |
|--------|-------------|----------|
| Marker on the row + legend | Inline marker on the pace cell plus a legend naming the measured gap duration. Reuses the existing footnote-asterisk pattern. | |
| A dedicated column | A ninth column showing gap duration per split. | |
| Restyle the whole row | Distinguish the row visually so a paused km reads as a different kind of row. | |
| (free text) | — | ✓ |

**User's choice:** "you decide".
**Notes:** Recorded as D-09. The recommendation (marker + legend stating the measured amount) was
taken — a ninth column fights Phase 22's phone-width work on this table, and row restyling collides
with Phase 19's shared table treatment.

---

## Claude's Discretion

- **Windowing mechanism** (D-01/D-02/D-03) — delegated; adaptive time-based width taken as the
  default, constrained to validation against the four measured interval profiles with a fixed-20s
  implementation demonstrated failing first.
- **Gap taxonomy** (D-04/D-05) — delegated; two scale-relative signals taken, with the 5059204779
  misclassification recorded as the mandatory discriminator.
- **Split gap marking** (D-09) — delegated; marker plus measured-duration legend taken.
- **Four internal areas** defaulted by explicit instruction: coverage denominator (D-06/D-07),
  module shape and single-source audit (D-15..D-18), residual report form (D-19), fixture library
  home (D-20).

## Deferred Ideas

None — the discussion stayed inside the phase boundary. Two todo matches were reviewed and
deliberately not folded (Garmin export adapter, externally blocked and forbidden by the
byte-identical-streams non-goal; curation-guard cosmetics, which belong with Phase 29).

## Finding raised during discussion, not a decision

Roadmap Success Criterion 3 requires coverage to sum to "the stream's own `elapsed_time` field".
Committed stream files carry no such field. D-06 amends the criterion to the stream span
`t[n-1] - t[0]`; the planner should carry that amendment into the phase's validation rows rather
than writing a row that cannot be satisfied as literally worded.
