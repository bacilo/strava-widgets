# Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 36-Best-Effort Clean-Window Search & Ceiling Recalibration
**Areas discussed:** Partition + crossing rule, Contaminated + clean record shape, Ceiling recalibration reporting, Surfacing + no-clean-window

**Gray areas presented for selection:** Contaminated + clean record shape, Partition + crossing
rule, Ceiling recalibration reporting, Surfacing + no-clean-window. All four selected.

---

## Partition + crossing rule

### Q1 — What gets excluded from a merged segment when partitioning?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole merged segment span | Sub-intervals run `[0, seg.startIndex]` / `[seg.endIndex, ...]`; the gap portion is excluded too. Simplest to state and audit. Silently also bars windows across recording-gap time, which today's sweep does traverse. | |
| Burst parts only | Cut on each `parts[].kind === 'burst'` span; merged gap portions stay traversable. Truer to PR-06's literal text; more, smaller sub-intervals. | |
| You decide — with a guard | Delegate, but require a committed archive-wide test measuring BOTH rules and asserting they agree today. | ✓ |

**User's choice:** You decide — with a guard → **D-01**
**Notes:** Grounded by a probe run during the discussion: the two readings produce provably
different cut lists (17 vs 26 sub-intervals on 3475724402) but identical moved/unchanged/lost
counts and identical ceilings to 4 dp. The burst is what severs the stream.

### Q2 — Which splice variant must criterion 2's test defend against?

| Option | Description | Selected |
|--------|-------------|----------|
| d-rebased (the plausible one) | Deletes samples AND subtracts the segment's metres — what a competent maintainer would write, and whose wrong answer looks reasonable. Fixture 3475740390. | ✓ |
| All three variants | Pin naive, d-rebased and t-rebased, each against the fixture where it is provably faster. More complete, more fixture bookkeeping. | |
| Naive only (literal reading) | Matches PR-06's wording exactly. Leaves the plausible variant undefended. | |

**User's choice:** d-rebased (the plausible one) → **D-02**
**Notes:** Measured 400m: partition 4:59 / naive 3:24 / d-rebased 4:51 / t-rebased 2:57 on
3475740390. The t-rebased variant produces 0:33/km on 3475724402 — a straw man. Reachability trap
surfaced: d-rebased is faster than the honest answer only on 3475740390; on 3475724402 it is
slower, so variant and fixture must be pinned together.

### Q3 — Should the no-span/no-crossing property be asserted independently?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — archive-wide overlap invariant | Every ranked effort's interval must overlap no segment from the detector's own output, computed from the detector rather than the search code. Watched failing first. | ✓ |
| Yes, plus the fractional crossing | As above, and additionally assert the interpolated `endOffsetSec` never lands strictly inside a segment. | |
| No — structural is enough | Partitioning makes it impossible by construction. | |

**User's choice:** Yes — archive-wide overlap invariant → **D-03**

### Q4 — When is a contaminated effort recorded as demoted?

| Option | Description | Selected |
|--------|-------------|----------|
| When the unpartitioned window intersects a segment | Structural test. No new threshold constant; PR-09's count is well-defined and independently recomputable. | ✓ |
| When the ranked figure actually moves | Smaller diff (~1,200 pairs moved by >0.05 s) but needs a movement threshold to calibrate and defend. | |
| You decide | Delegate, bound by no-new-constant-without-a-measured-basis. | |

**User's choice:** When the unpartitioned window intersects a segment → **D-04**

---

## Contaminated + clean record shape

### Q1 — How does one (activityId, distance) hold both records?

| Option | Description | Selected |
|--------|-------------|----------|
| New sibling field, `demotion` untouched | Add `contaminated: {...} \| null` to ComputedEffort; the effort's own figures are the clean window and it ranks normally. Purely additive, no schema bump, one-per-distance holds. | ✓ |
| Reuse `demotion` with a new guard value | Smallest new surface, reads literally against PR-07. But "demotion means it does not rank" stops being true for four consumers. | |
| Two entries per distance | Most faithful to "never deleted". Breaks the at-most-one-per-distance assumption at four `.find()` sites. | |

**User's choice:** New sibling field, `demotion` untouched → **D-05**
**Notes:** Decisive scout finding presented with the question: `demotion !== null` currently *means*
"does not rank" — `compute-best-efforts.ts:304` skips it from `byDistance` and
`detail-best-efforts-logic.ts:266` renders "left out of the ranked PR list".

### Q2 — How is "no clean window at a distance" represented?

| Option | Description | Selected |
|--------|-------------|----------|
| Effort kept, contaminated figure + `demotion` | It genuinely does not rank, so `demotion`'s existing meaning holds and existing copy works. This is where PR-07's "new guard discriminator" lands. | ✓ |
| Effort omitted, rejected row only | Smallest data change, but `rejected` is archive-wide and would not reach the per-activity shard the detail view reads. | |
| Separate no-clean-window list | Cleanest separation, but a third place a distance's disposition can come from. | |

**User's choice:** Effort kept, contaminated figure + `demotion` → **D-06**
**Notes:** ~439 eligible pairs in the probe, concentrated at 10k/half. Three places must gain the
new guard value: `EffortDemotionGuard`, `VALID_DEMOTION_GUARDS` (which silently drops unlisted
guards), and `records-logic.ts:204`'s switch.

### Q3 — What does the reason string state when several segments intersect?

| Option | Description | Selected |
|--------|-------------|----------|
| All intersecting segments, itemised + totalled | Honest to the measurement; needs a cap or summarisation rule. | |
| Totals plus the largest, named | Bounded by construction; loses itemisation. | |
| You decide | Delegate, bound by measured numbers, bounded length, independently recomputable. | ✓ |

**User's choice:** You decide → **D-07**
**Notes:** PR-07 says "the segment" (singular) but 3475740390's 400m window intersects four:
52.4 m/5 s at t=2508, 28.6 m/2 s at t=2536, 30.4 m/3 s at t=2580, 24.7 m/2 s at t=2587.

### Q4 — Where does the new guard sit in the precedence chain?

| Option | Description | Selected |
|--------|-------------|----------|
| Unreliable-segment first | The contaminated figure is not a measurement, so "exceeds world-record pace" asserts something about a number that should never have been quoted. Changes existing ordering. | |
| Absolute guards still first | Keeps the existing chain exactly; new guard slots in above the ceiling. | |
| You decide | Delegate, bound by: stated in the docblock, proven by a test on a real activity tripping both. | ✓ |

**User's choice:** You decide → **D-08**

---

## Ceiling recalibration reporting

### Q1 — Where is the ceiling movement recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| New 36-CEILING-RECALIBRATION.md | Committed, regenerable, idempotent, following the 28/30 artifact shape with its own generator + `.test.mjs`. | ✓ |
| Amend 28-CEILING-CALIBRATION.md | One document per subject, but that artifact is in the archived v2.2 milestone directory. | |
| Existing ceiling-state diff only | No new artifact; console output is not a committed figure of record and criterion 4 needs a sha256 to sign. | |

**User's choice:** New 36-CEILING-RECALIBRATION.md → **D-09**

### Q2 — How is the half-marathon losing its ceiling handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Named finding, developer signs it | Its own finding with before/after population and the floor; PR-09's signature explicitly covers it. `CEILING_MIN_POPULATION` may not move (anti-quota). | ✓ |
| Named finding, reported only | One row of the recalibration like any other. | |
| You decide | Delegate, bound by: constant may not move, fail-open disclosed with its population, in the signed artifact. | |

**User's choice:** Named finding, developer signs it → **D-10**
**Notes:** Probe: `half` population 104 → 69, below `CEILING_MIN_POPULATION = 100`, so Phase 28's
D-02 fail-open fires and the distance keeps only world-record and max_speed.

### Q3 — Resolve 28 WR-06's ceiling-file write gate here?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve it — add the opt-in guard | Protects PR-09's baseline directly; a carried-forward finding on the exact file criterion 4 signs. | |
| Leave WR-06, commit the new state once | Diff script already uses a throwaway path. Hazard stays open through the phase where it bites hardest. | |
| You decide | Delegate, bound by: reproducible from a clean checkout, not rewritable as a side effect. | ✓ |

**User's choice:** You decide → **D-11**
**Notes:** Scout finding presented with the question: `compute-best-efforts.ts:570-571` rewrites the
tracked file whenever population or p90 moves; 28-REVIEW.md records WR-06 as "partially resolved —
the hazard is now documented, not removed."

### Q4 — How deep must the artifact's explanation go?

| Option | Description | Selected |
|--------|-------------|----------|
| Explain direction per distance | Every distance's movement gets a stated cause, including why 10k rises while the others fall. | |
| Explain only anomalies | Tabulate all; explain zero movement, upward movement and the half fail-open. | |
| You decide | Delegate, bound by: zero and upward movement each carry a stated measured cause; no row left unaccounted. | ✓ |

**User's choice:** You decide → **D-12**
**Notes:** Probe: 10k moves UP (+0.0318) while 400m/1k/1mi/5k all fall; population 1468 → 1147.

### Q5 — What makes PR-09's third reconciliation leg independent?

*(asked after the user chose "More questions" at the area checkpoint)*

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-import sweep, different algorithm | Imports neither engine nor detector, structurally asserted; different algorithm; shown failing against a broken partitioner first. | |
| Extend compute-pr-ceiling-recount.mjs | Reuses a proven harness; risks importing Phase 28 assumptions and gives both legs one more place to agree wrongly. | |
| You decide | Delegate, bound by: no import of search or detector, different algorithm not a rearrangement, demonstrated red first. | ✓ |

**User's choice:** You decide → **D-13**

### Q6 — Where does the clean-window search go in the three-pass shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Pass 1, at computeActivityEfforts | PR-08's "strictly before" becomes structurally true; Pass 2's no-loop audit untouched. Needs segments where only `t`/`d` are today. | |
| New pass between 1 and 2 | Ordering visible as its own named step; `byDistance` would briefly hold contaminated timings. | |
| You decide | Delegate, bound by: no-loop audit passes unmodified; "never enter the population" demonstrable, not asserted in a comment. | ✓ |

**User's choice:** You decide → **D-14**

---

## Surfacing + no-clean-window

### Q1 — What does a MOVED effort show on the detail view?

| Option | Description | Selected |
|--------|-------------|----------|
| Both figures, clean ranked, contaminated annotated | Owner sees what the number was, what it is, and why, in one place. | |
| Clean figure plus a badge | Uncluttered; explanation one interaction away. | |
| You decide | Delegate, bound by: contaminated figure and reason reachable without leaving the view; ranked figure never presented as if nothing changed. | ✓ |

**User's choice:** You decide → **D-15**

### Q2 — What does the records view disclose?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: demoted count and moved count | Without the second, the phase's largest effect on the ranking is invisible on the records view. | |
| Demoted count only | Smaller change to a sentence several tests pin. | |
| You decide | Delegate, bound by: derived by walking the shipped document, not an incrementing counter. | ✓ |

**User's choice:** You decide → **D-16**

### Q3 — Where is the Phase 36 / Phase 37 review-queue boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic only — no queue work here | Guard value added; queue picks it up through its existing path. | |
| Automatic, plus verify it actually surfaces | No queue changes, but evidence that the guard reaches the queue rather than assuming it. | |
| You decide | Delegate, bound by: no change to queue ordering/copy/controls; no assumption without evidence. | ✓ |

**User's choice:** You decide → **D-17**

### Q4 — What browser evidence does the phase close on?

| Option | Description | Selected |
|--------|-------------|----------|
| Human checkpoint, extent from outside | Rows assert rendered figures against a value derived outside the changed code (Phase 29 precedent with three decoys). | |
| Human checkpoint, standard rows | Rows assert rendered output matches the generated document — not independent evidence. | |
| You decide | Delegate, bound by: served build; rows reachability-checked in both directions; at least one row against an outside value. | ✓ |

**User's choice:** You decide → **D-18**

---

## Claude's Discretion

Delegated with explicit constraints, all recorded in CONTEXT.md: D-01 (exclusion granularity),
D-07 (reason wording), D-08 (precedence position), D-11 (write-gate mechanism), D-12 (explanation
depth), D-13 (third-leg design), D-14 (pass placement), D-15 (detail-view presentation),
D-16 (records disclosure), D-17 (queue evidence), D-18 (checkpoint row design).

Also at discretion: how `findBestEffort` is reused per sub-interval without a second sweep
implementation; artifact, script and generator filenames; the new guard value's exact spelling.

## Deferred Ideas

- Phase 37 scope: queue reordering by guard, moved-but-ranked efforts in the queue, the reversible
  "reviewed and kept" action, CUR-04.
- CUR-05 per-effort override — already deferred at REQUIREMENTS.md line 116.
- Revisiting PR-06 to add a dilution clause for long distances — considered and **rejected**: the
  requirement is locked and a target-relative excess threshold would introduce a new calibrated
  constant with its own circularity burden. The measured impact (439 lost pairs, 10k/half) is
  recorded so a later reader sees it was weighed.
- STREAM-05/06 stream re-derivation — several of this phase's findings would be first evidence.

## Process notes surfaced during the discussion

- `.planning/config.json` has no `context_window` key, which silently disables the planner's
  prior-phase and `Depends on:` enrichment. Phase 32's artifacts are listed explicitly in
  CONTEXT.md's canonical refs to compensate.
- `32-CONTEXT.md:247`'s "n=909 / 2,388 / 1,834" is keyed to the wrong activity order. Measured
  2026-09-28: 3475724402 n=1834, 3475734189 n=2388, 3475740390 n=909.
