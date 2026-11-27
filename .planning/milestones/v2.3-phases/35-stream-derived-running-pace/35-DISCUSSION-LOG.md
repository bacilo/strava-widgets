# Phase 35: Stream-Derived Running Pace - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 35-stream-derived-running-pace
**Areas discussed:** Disputed rule vs PACE-07, Threshold shape & how it is fixed, Running-pace
definition, Detail-view disclosure & splits coupling (splits-rebase question only)

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Disputed rule vs PACE-07 | Replace / beside / separate; the 3:20/km gate; badge reach across four list surfaces | ✓ |
| Threshold shape & how it is fixed | Ratio vs Δ; direction; calibrated vs declared after Phase 34's three HALTs | ✓ |
| Running-pace definition | Which numerator and denominator "excluded from both distance and time" means | ✓ |
| Detail-view disclosure & splits coupling | Where it renders; the Phase 26 D-13 splits-baseline rebase | ✓ |

**User's choice:** all four.
**Notes:** Selection was made after a throwaway probe over 1,873 committed streams was presented —
the named activities' running paces, the archive Δ/ratio distribution, and the finding that today's
PACE-07 gate can never fire on 3475724402. Those measurements framed every question that followed.

---

## Disputed rule vs PACE-07

### Q1 — How should the new running-pace comparison relate to the shipped span-based rule?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace — one comparator | `detectPaceDisagreement` compares metadata against the running pace; the span rule is retired. One definition, one threshold. Cost: 5059204779's shipped 5:51/km becomes 5:56/km, needing dated amendments | ✓ |
| Beside — badge fires on either | Keep the span rule as shipped (5:51/km and v2.2's count of 1 preserved) and add the running rule as a second trigger. Cost: two rules, two thresholds, one row able to carry two "stream-derived" numbers | |
| Separate badge | PACE-07 untouched; a new differently-named badge carries the running-pace disagreement. Cost: contradicts RPACE-03's own text, two pace-doubt badges on one row | |

**User's choice:** Replace — one comparator. → **D-01**
**Notes:** Presented alongside a supporting measurement — under a running-pace comparison
5059204779 is the archive maximum on **both** axes (×3.161 / +243.2 s/km), so replacement does not
lose v2.2's sole flagged activity. That removed the strongest argument for keeping the span rule.

### Q2 — What replaces the 3:20/km implausibility gate as the eligibility rule?

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded-distance gate | Only activities where the pace differs BECAUSE distance was withheld are eligible; leaves pure `moving_time` divergence to `elapsedVsMoving` | |
| No gate — threshold alone | Every computable activity eligible; the calibrated cut is the only test | |
| Minimum-scale gate only | A distance or duration floor, no mechanism filter | |
| You decide | Claude picks during planning, bound by stated constraints | ✓ |

**User's choice:** You decide. → **D-02** (Claude's Discretion, bounded)
**Notes:** Asked after presenting the structural finding that **two different mechanisms** produce a
metadata↔running disagreement: (a) distance covered off the clock — 3475724402 (2,253 m / 797 s),
5059213289 (1,816 m / 732 s), 3475723743 (986 m / 58 s), 14122328106 (514 m / 92 s); and (b) device
`moving_time` disagreeing with covered time on almost **zero** withheld distance — 3475742397
(0 m / 1,211 s, Δ +212.8), 3475740798 (0 m / 396 s), 3475737589 (0 m / 9 s), plus the whole negative
side (7 activities at Δ ≤ −20, led by 10969136984 at −158.2 s/km). Mechanism (b) is already
described by v2.2's `elapsedVsMoving` signal. Bounds recorded in CONTEXT.md: 3475724402 must be
badged; the gate is stated in the calibration artifact with its non-circularity argument; whatever
it excludes is named with its measured count.

### Q3 — Where should the widened badge surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep all four surfaces | Badge keeps its reach; only the count grows (1 → ~20-45). Criterion 4 protects the pace figure, not the absence of badges | |
| Detail view only | List rows keep firing on the old span population. Cost: a row and its own detail view can disagree — the Phase 24 D-04 divergence shape | |
| You decide | Bound by: no surface may disagree with another; whichever reach ships is read back at the checkpoint | ✓ |

**User's choice:** You decide. → **D-03** (Claude's Discretion, bounded)

### Q4 — How should the shipped `paceDisagreement.streamPaceSecPerKm` field and the 5:51/km figure of record be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Rename the field, amend the figure | Field name says what it now holds; 5:51/km gets a dated in-place amendment wherever cited (32 D-03 / 33 D-12 / 34 D-02 pattern) | |
| Keep the field name | Only the docblock and figures of record are amended. Cost: a field whose name no longer matches its contents — the defect 33 D-11 called a correctness fix | |
| Carry both numbers | Row carries span and running; 5:51/km survives as a rendered value | |
| — | User answered free-text "you decide." | ✓ |

**User's choice:** "you decide." → **D-04** (Claude's Discretion, bounded)
**Notes:** Context given: `streamPaceSecPerKm` is used by nothing in `src/` outside
`detectPaceDisagreement` (verified by grep), but its value ships on every index row and is read at
three render sites including the splits rebase. Bounds recorded: a shipped field's name must match
what it holds; any moved figure of record gets a dated in-place amendment, never a silent overwrite.

---

## Threshold shape & how it is fixed

### Q1 — Calibrated, declared, or measure-first?

| Option | Description | Selected |
|--------|-------------|----------|
| Calibrate, HALT if it fails | Full D-06/D-08/D-13 machinery: pre-declared shapes with non-circularity arguments, strawman-first, 1% tolerance fixed before measuring, first-clearing arbitration, committed HALT artifact if nothing clears | ✓ |
| Declare up front, with a basis gate | Go straight to D-20/D-21's endpoint: developer-declared on stated grounds, measurement rows kept as evidence, structural basis gate re-checked every run. Needs a dated amendment to RPACE-03 | |
| Measure first, then decide | One plan measures without selecting, then the developer picks. Cost: figures known before shapes are declared — the contamination D-19 guards against | |

**User's choice:** Calibrate, HALT if it fails. → **D-05**
**Notes:** Chosen with the counter-evidence explicitly on the table: the Δ distribution decays
smoothly from q50 +0.9 to q99 +40.2 s/km with **no valley** — the same shape that defeated Phase
34's D-06 valley rule and forced D-21's declaration — and 3475724402 sits near q98 on both axes, so
the required fixture is close to any cut in both directions. The declare-up-front shortcut is
therefore **explicitly rejected** for this constant, not merely unchosen.

### Q2 — Should the badge fire in both directions?

| Option | Description | Selected |
|--------|-------------|----------|
| Slower-only | Matches the milestone's actual claim; a faster-than-metadata running pace is `elapsedVsMoving`'s territory | |
| Symmetric | Matches RPACE-03's literal wording ("the two figures disagree materially"); disclosure must carry the sign | |
| You decide | Bound by: the direction is stated in the artifact and the other side's measured count is reported as a finding | ✓ |

**User's choice:** You decide. → **D-06** (Claude's Discretion, bounded)
**Notes:** Presented with the negative-side measurement: 7 activities at Δ ≤ −20 s/km, led by
10969136984 at −158.2 (×0.724) on 2,593 s excluded against only 123 m.

### Q3 — Which statistic family should the pre-declared shapes measure?

| Option | Description | Selected |
|--------|-------------|----------|
| Ratio (scale-free) | running ÷ metadata; 3475724402 is ×1.073 | |
| Absolute Δ in sec/km | running − metadata; directly readable in the disclosure sentence; 3475724402 is +21.6 | |
| Both families pre-declared | D-13 arbitrates in first-clearing order; the archive decides | |
| You decide | Bound by pre-declaration-before-measurement and the anti-quota rule | ✓ |

**User's choice:** You decide. → **D-07** (Claude's Discretion, bounded)
**Notes:** Trade-off presented: the two rank the tail differently — 3475742397 is #2 by Δ (+212.8)
but mid-pack by ratio (×1.280), because its metadata pace is 12:41/km.

---

## Running-pace definition

### Q1 — How should "excluded from both distance and time" be computed exactly?

| Option | Description | Selected |
|--------|-------------|----------|
| Covered metres ÷ `coverage.coveredSec` | Denominator is the ledger's own number, proven exact by COV-01 and already disclosed in the caption, so the stat card and caption cannot drift | |
| Whole-step exclusion | Sum metres and seconds over steps not overlapping any `gapInterval` (what the probe did, giving 5:18/km). Cost: ships a second covered-time number beside the caption's | |
| Time-weighted mean of the pace series | Most literally "through the existing module". Cost: a mean of paces is not distance ÷ time and cannot reconcile against a metres÷seconds recount | |
| — | User answered free-text "you decide". | ✓ |

**User's choice:** "you decide". → **D-08** (Claude's Discretion, bounded)
**Notes:** Bounds recorded in CONTEXT.md are strong enough to rule out the third option on the
project's own recount convention: the figure must be a total-distance ÷ total-time quantity a
zero-import recount can reproduce; the excluded metres/seconds must reconcile with the coverage
caption; it is computed through `pace-derivation.ts` and seen by the single-source audit; the
straddling-step boundary rule is stated and pinned by a test; and "computable stream" is defined
with the non-computable count reported.

---

## Detail-view disclosure & splits coupling

### Q0 — How to finish

| Option | Description | Selected |
|--------|-------------|----------|
| Just the splits-rebase question | Ask only the one that changes shipped behaviour; the rest of area 4 goes down as discretion | ✓ |
| Write CONTEXT.md now | Everything remaining recorded as discretion under stated bounds | |
| Keep going through area 4 | Placement, conditionality, wording and the rebase | |

**User's choice:** Just the splits-rebase question.
**Notes:** Offered after the user answered "you decide" to six consecutive mechanics questions —
the check was proposed specifically to stop spending their time on choices they were content to
delegate, while still surfacing the one remaining item that changes shipped behaviour.

### Q1 — What happens to Phase 26 D-13's splits-baseline rebase?

| Option | Description | Selected |
|--------|-------------|----------|
| Rebase follows the badge | D-13 kept as written; baseline rebases to the running pace. Cost: ~20-45 activities' "vs. Avg" bars change baseline, a visible change to a shipped surface | ✓ |
| Rebase stays on the old population | Nothing about the splits table changes. Cost: a view that badges the pace as disputed while comparing its splits against exactly that figure — the contradiction D-13 removed | |
| Retire the rebase | One baseline everywhere. Cost: reverses a shipped v2.2 decision; 5059204779's splits move back onto its 1:53/km metadata pace | |

**User's choice:** Rebase follows the badge. → **D-09**
**Notes:** The remaining area-4 items (stat card vs sub-line on the Pace tile, always-on vs
conditional rendering, exclusions-sentence wording) were recorded as **D-10**, Claude's Discretion,
bounded by RPACE-02's explicit metres-and-seconds requirement, ROADMAP criterion 2's "the two
figures visibly differ" on 3475724402, criterion 4's byte-identical constraint on lists/stats/
widgets, and COV-02's always-on precedent.

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| `validateStreamSeries` null gap | 2026-09-23, analytics, score 0.6 — from 34-REVIEW.md IN-04; one of the nine unguarded sites is `pace-derivation.ts:937`, inside `streamPaceSecPerKm` | ✓ |
| Shard lists capped on write only | 2026-09-23, dashboard, score 0.6 | |
| Pace chart y-axis compression | 2026-09-22, dashboard, score 0.6 — already reviewed and deferred by the developer in Phase 34 | |
| Pauses row mechanism breakdown | 2026-09-23, dashboard, score 0.4 | |

**User's choice:** fold the `validateStreamSeries` null-safety todo only.
**Notes:** Folded because RPACE-01 computes a running pace for **every** activity with a computable
stream, D-08 requires "computable stream" to be defined, and the retired-comparator function
`streamPaceSecPerKm` contains one of the nine unguarded call sites. The other three are recorded in
CONTEXT.md § Reviewed Todos with their reasons, not lost.

---

## Claude's Discretion

Delegated by the user during this discussion, each bounded in CONTEXT.md:

- **D-02** — the eligibility gate replacing the 3:20/km implausibility threshold.
- **D-03** — badge reach across the four list surfaces vs detail view only.
- **D-04** — field naming and how the 5:51/km figure of record is amended.
- **D-06** — threshold direction (symmetric vs slower-only).
- **D-07** — statistic family (ratio, absolute Δ, or both), subject to D-05's pre-declaration rule.
- **D-08** — the exact running-pace computation and its boundary rule.
- **D-10** — rendering placement, conditionality and copy for the running pace and its exclusions
  line.
- Plus the standing discretion items: artifact and script filenames, index-row vs shard placement
  (additive only, schema version stays `1`), and the disposition of `streamPaceSecPerKm` once it is
  no longer the disputed comparator.

## Deferred Ideas

- Splitting the disputed badge into two named claims (distance off the clock vs moving-time
  divergence) — raised by the two-mechanism finding; D-01 commits to one badge.
- Surfacing the running pace outside the detail view (lists, stats documents, widgets) — barred by
  ROADMAP criterion 4 this phase.
- A "stopped time removed" pace — STOP-04, already Out of Scope pending STOP-02's calibration.
- Reconciling the running pace against device `moving_time` as its own signal — the negative side of
  the distribution is `elapsedVsMoving`'s territory, not RPACE's.

## Method note

The probe used to ground this discussion was a throwaway script over 1,873 committed streams, using
one of several possible running-pace definitions (D-08 has not chosen between them). **Every figure
quoted above is a reference to reconcile against, never an expected value** — and D-05's
contamination guard applies: the planner has seen these distributions, so the pre-declared
calibration shapes must be argued from first principles, with the plan stating where its populations
overlap what is quoted here and why that is not "the probe with a cut applied".
