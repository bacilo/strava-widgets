# Phase 28: PR Plausibility Ceiling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 28-pr-plausibility-ceiling
**Areas discussed:** Ceiling derivation rule, Ceiling stability over time, Demotion surface + old guard, The before/after diff (PR-04)

**Method note:** every question in this discussion was preceded by a measurement against the live
`data/stats/best-efforts.json`, not by a priori reasoning. Three of the twelve answers turned on a
number that was not known when the question was drafted. All figures are reproduced in CONTEXT.md's
`<code_context>` § Measurements.

---

## Ceiling derivation rule

### Q1 — What statistic defines the personal plausibility ceiling?

| Option | Description | Selected |
|--------|-------------|----------|
| K × p90, per distance (Rec) | Ceiling = K × the 90th percentile of the athlete's own filtered efforts. p90 is set by the bulk of ~1,800 efforts, so the artifacts being rejected cannot move where the line falls. Measured to preserve every genuine 5k/10k/half record while cutting hard at 400m/1k. | |
| Cross-distance coherence | Project each distance's ceiling from a trusted longer anchor via the existing `riegel.ts`. Physiologically principled, reuses shipped code — but inherits Riegel's calibration range (silent on 400m) and needs a "trusted anchor" rule that is itself a plausibility judgment. | |
| Ratio primary + Riegel gate | K × p90 sets the ceiling; cross-distance coherence runs as an independent second gate that can only demote further, never re-admit. Two mechanisms failing differently. | |
| You decide | Delegate to research/planning, bound by the measurements and PR-02's non-circularity requirement. | ✓ |

**User's choice:** You decide
**Notes:** Delegated after seeing the measured behaviour of all three candidates rather than in place
of seeing it. The delegation is bounded in CONTEXT.md D-01 by a *structural* property (the rejected
artifacts must not be able to move the statistic), not by a formula. The measurement that motivated
the framing: a plain percentile of the filtered population is self-defeating — at n≈1,800, p99.5
lands on the 9th-fastest effort by construction and demotes 9/10 at 5k and 8/10 at 10k, both genuine
records. This is a second circularity that PR-02 does not name.

### Q2 — What happens at a distance with too thin a population?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to today's guard (Rec) | Below a stated minimum population, derive no personal ceiling; keep world-record + max_speed only, and record that fact in the output. Fails open rather than inventing a ceiling from a handful of points. | ✓ |
| Borrow from a neighbour | Derive from an adjacent healthy distance and scale across. Gives every distance a ceiling, but imports one distance's contamination into another's judgment. | |
| Fail closed | A distance with no derivable ceiling admits nothing. Maximally conservative, but would empty the half-marathon table on a technicality and delete a genuine 1:26:51. | |

**User's choice:** Fall back to today's guard
**Notes:** Live, not hypothetical — marathon has 0 efforts and half has 105 against ~1,800 at the
short distances. Accepted cost: those distances stay as unguarded as they are today.

### Q3 — The 400m PR table empties under any bulk-derived ceiling. Right outcome?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept an empty table (Rec) | If nothing in the archive is a credible 400m, an empty table with a stated reason is the honest result. Makes the empty-state copy a real deliverable. | ✓ |
| Drop 400m as a target | Remove 400m from `TARGET_ORDER`. Honest about the archive's limits, but changes a contract touching age-grading, Riegel's matrix, the detail panel and the shards. | |
| Softer ceiling at 400m | A deliberately more permissive ceiling at the shortest distance so a few efforts survive. Keeps the table populated — but choosing K to yield a non-empty table is tuning to a target count. | |

**User's choice:** Accept an empty table
**Notes:** Even a permissive K=1.50 sits at 66.6s while the 10th-fastest shipped 400m is 65.5s, so
the whole top-10 goes. These are 400m windows carved from ordinary runs, not track intervals — the
most artifact-prone case by construction. Rejecting the "softer ceiling" option was explicitly a
Phase 27 D-02 call: a threshold tuned to produce a non-empty table is a quota, not a claim.

### Q4 — How should the PR-05 regression fixture be pinned?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin live, record the drift (Rec) | Pin 45.2s / 8.85 m/s — what the pipeline actually emits — and record the 44.0/9.09 discrepancy as a resolved note in REQUIREMENTS.md, per Phase 27's G-02 precedent. | ✓ |
| Investigate the drift first | Find out why the number moved before pinning. Safest epistemically, but front-loads an open-ended investigation. | |
| Pin the effort, not the number | Assert only that 4556693525's 400m is rejected, without a duration. More durable, but weakens PR-05's "must fail if the ceiling regresses" teeth. | |

**User's choice:** Pin live, record the drift
**Notes:** Discovered during measurement, not raised by the requirement: PR-05 and ROADMAP Criterion
3 both state 44.0s / 9.09 m/s; the live archive computes 45.2s / 8.85 m/s. Both are physically
impossible and both pass today's guard, so the requirement's substance is unaffected. The *cause* of
the drift remains unexplained and was deliberately left uninvestigated — noted as a deferred idea.

---

## Ceiling stability over time

### Q1 — What time scope should the ceiling be derived over?

| Option | Description | Selected |
|--------|-------------|----------|
| All-time, single ceiling (Rec) | One ceiling per distance over the whole filtered archive. Simplest to make deterministic under PR-01 — no window boundary, no "as of when" ambiguity in the diff. | ✓ |
| Trailing window | Derive from a trailing N-year window so the ceiling tracks current fitness. Introduces a boundary that silently re-judges old efforts as it slides. | |
| Per-era ceilings | Segment by device era (Phase 27 ships the taxonomy). Appealing because contamination is era-correlated — but hands each contaminated era its own inflated ceiling. | |

**User's choice:** All-time, single ceiling
**Notes:** Settled by measurement rather than argument. 400m p90 moves only 3.30→4.26 m/s across
fifteen years (±8%, fittest year 9% above least fit) while max swings 3.40→8.85 (160%) — the fitness
signal a window would chase is an order of magnitude smaller than the artifact signal. The sparse
early years (2011: 2 efforts, 2013: 6, 2015: 2) would starve any responsive window.

### Q2 — Nightly CI re-derives the ceiling; how to stop silent re-admission after the review?

| Option | Description | Selected |
|--------|-------------|----------|
| Recompute + report drift (Rec) | Re-derive every run, persist the derived ceiling into the output, and report when a ceiling moved or an effort changed disposition since the last run. | ✓ |
| Pinned committed snapshot | Derive once, commit it, have CI read rather than re-derive. Maximally stable — but goes stale silently and puts a hand-maintained number on the critical path. | |
| Recompute silently | Simplest and fully stateless — but the one option that lets a record change hands with nobody seeing it. | |

**User's choice:** Recompute + report drift
**Notes:** PR-04's principle ("a PR moving without the owner seeing it is a milestone failure") is
written about ship time; this extends it past ship, since nightly CI regenerates `best-efforts.json`
every day. A reported movement has been seen.

### Q3 — Where does the previous run's ceiling state live?

| Option | Description | Selected |
|--------|-------------|----------|
| Small committed ceiling file (Rec) | A committed, machine-written file holding the derived ceilings and demoted-effort set. CI regenerates, diffs, reports, commits. Git history becomes the audit trail. | ✓ |
| Report within the run only | No new file and no push race — but cannot answer "did this change since you last looked". | |
| GitHub Actions artifact/cache | Keeps generated state out of git — but cache eviction silently turns the drift report into a no-op. | |

**User's choice:** Small committed ceiling file
**Notes:** Forced by `data/stats/` being gitignored and CI starting empty — there is nowhere else
durable to diff against. Two known repo hazards recorded into CONTEXT.md D-07 for the planner: the
CI auto-commit push race against `origin/master` (merge, don't rebase), and the skip-CI token that
silently suppresses the whole daily-refresh run if quoted in a commit message.

---

## Demotion surface + old guard

### Q1 — Should today's absolute guard also convert to demote-and-flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Convert both, one path (Rec) | Every rejection — ceiling, world-record, max_speed — becomes a flagged, demoted, visible effort through one shared code path. | ✓ |
| Ceiling only | Narrowest reading of PR-03 and the smallest diff — but leaves two rejection mechanisms with opposite semantics inside one function. | |
| Convert, but keep them out of the detail view | Flag in data, never render a 24 m/s effort. Keeps the UI clean — but that is what the `rejected` array already offers and nobody reads. | |

**User's choice:** Convert both, one path
**Notes:** Measured during the discussion: 34 efforts across 28 activities are deleted today (28 at
400m, implied 14.75–24.44 m/s = 53–88 km/h). They are recorded in the document's `rejected` array,
but a grep confirmed **no dashboard code reads that array** — so the archive's most flagrantly broken
efforts are precisely the ones that can never be seen. One shared path also honours Phase 24's
`resolveExcluded` lesson that duplicated derivations defeat checkpoints.

### Q2 — Where must a demoted effort be visible with its reason?

| Option | Description | Selected |
|--------|-------------|----------|
| Detail panel + Records note (Rec) | Best Efforts panel renders the demoted row with its reason (satisfies Criterion 4 directly); the Records screen names why a table is short or empty. | ✓ |
| Detail panel only | Minimum that satisfies Criterion 4 — but the Records screen would show an empty 400m table with no explanation anywhere on it. | |
| All three surfaces | Adds an Activities-list badge. Most discoverable — but close to Phase 29's review-queue job, and Phase 27 just added quality badges to those rows. | |

**User's choice:** Detail panel + Records note
**Notes:** Rendering hazard recorded for the planner: `detail-sections.ts:339-353`'s
`buildPrFlagsCell` renders `isPr` and `excluded` into one `<td>` and already produced
`PRExcluded — {reason}` in Phase 24's Round 2. A third state must fix that cell, not extend it.

### Q3 — How does a demotion relate to `excludedFromRecords`?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate field + reason (Rec) | A distinct field recording that the effort was demoted and by which guard, alongside the existing flag. | ✓ |
| Reuse `excludedFromRecords` | Zero new fields; every consumer honours it for free — but overwrites the meaning of a field that means "the owner decided", and a recompute would rewrite entries the owner did not author. | |
| Both: flag it and exclude it | Least downstream work — but two sources of truth for one fact, the divergence mechanism Phase 24's WR-05 and WR-17 were both about. | |

**User's choice:** Separate field + reason
**Notes:** The deciding argument was Phase 29: collapsing the two would leave the review queue unable
to distinguish "you excluded this" from "the ceiling rejected this", which is the exact distinction
that queue exists to act on. Also leaves the `resolveExcluded` live-vs-precomputed contract
untouched.

### Q4 — Does an override / re-admit path land in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 29 (Rec) | Phase 28 ships demotion and visibility; the override lands with the curation queue, which already owns the write path and both publish guards. | ✓ |
| Ship a manual override here | A committed override file edited by hand. No new write surface — but a second curation file with its own precedence question against the ceiling. | |
| Ship the full override UI here | Delivers "overridable" literally — but is Phase 29's scope wholesale. | |

**User's choice:** Defer to Phase 29
**Notes:** An override is a write surface and this phase has none. The milestone's "flagged and
overridable" phrasing is satisfied across Phases 28+29 together; D-10's separate field is the hook
that makes the Phase 29 action possible.

---

## The before/after diff (PR-04)

### Q1 — What counts as "a record changing hands"?

| Option | Description | Selected |
|--------|-------------|----------|
| Rankings + flag flips (Rec) | Every top-10 row that moves AND every `wasPRAtTheTime` flip in both directions — demotions and the retroactive promotions they cause. | ✓ |
| Rankings only | Compact and literally what "PR diff" suggests — but silently misses every historical flag flip. | |
| Everything downstream too | Adds `prCount`, age-grading, Riegel predictions. Most complete — but mechanically implied, and widens the deliverable into untouched documents. | |

**User's choice:** Rankings + flag flips
**Notes:** Decided by a simulation run during the discussion. Under an illustrative K=1.35 ceiling:
20 efforts demoted, 10 `wasPRAtTheTime` flags flipped. The 1mi row settled it — **one effort
demoted, two flags flipped, total unchanged at 14**, meaning removing one effort *promoted* a
different activity into being a PR-at-the-time it never was. A rankings-only diff reports that as
"nothing happened".

### Q2 — What form should the diff take?

| Option | Description | Selected |
|--------|-------------|----------|
| Regenerable committed markdown (Rec) | A committed `.md` generated by a dry-run command, per the `26-RESIDUAL.md` / `27-CALIBRATION.md` precedent. Reviewable in a diff, lands in git history. | ✓ |
| CLI dry-run, no artifact | Zero staleness — but the review leaves no trace, making "reviewed and signed off" unauditable. | |
| JSON artifact | Best for the Criterion 5 reconciliation and trivially assertable — but the human review is the point of PR-04, and raw JSON is not what gets read. | |

**User's choice:** Regenerable committed markdown
**Notes:** Trap recorded explicitly: Phase 27's G-01 is still open precisely because its calibration
artifact was not provably regenerable byte-identical. Idempotence must be a test here, proved by a
second run rather than one.

### Q3 — How is the review sign-off recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate sign-off record (Rec) | The generated diff stays purely machine-written; the sign-off lives in the phase's validation record, naming the diff's content hash or generated-at stamp. | ✓ |
| Sign-off block in the artifact | Everything in one place — but makes the file half-generated and half-hand-written, so regeneration either destroys the sign-off or the generator must preserve a region it does not own. | |
| Git commit as the sign-off | Nothing extra to maintain — but agents commit in this repo too, so a commit cannot distinguish "a human read this" from "a pipeline wrote this". | |

**User's choice:** Separate sign-off record
**Notes:** The hazard was surfaced before the question was asked: a sign-off written *into* a
regenerable artifact is erased by the next regeneration. Binding the approval to a content hash
makes it verifiable rather than merely asserted.

### Q4 — How independent must Criterion 5's reconciling count be?

| Option | Description | Selected |
|--------|-------------|----------|
| Read the shipped output only (Rec) | Count demoted efforts by reading the shipped `best-efforts.json`, without importing the ceiling logic — Phase 27's D-03 discipline. | ✓ |
| Same code path, asserted equal | Simplest and guaranteed consistent — but a check that can only agree with itself. | |
| Reconcile in the browser too | Strongest evidence and asserts reachable extent — but no demoted-cohort filter ships this phase, so there is no way to reach that count on screen. | |

**User's choice:** Read the shipped output only
**Notes:** Two numbers produced by the same code agreeing proves only determinism, which is
Criterion 1's job, not Criterion 5's. The browser-reconciliation option was genuinely attractive
(it is the Phase 23 CR-01 "assert extent, not internal agreement" lesson) but is blocked by D-09's
decision not to ship a demoted-cohort filter; recorded as a deferred idea for Phase 29.

---

## Claude's Discretion

- **The ceiling statistic itself (D-01)** — delegated wholesale, bounded by PR-02's non-circularity
  rule, the structural property that the rejected artifacts must not be able to move the statistic,
  the measurements reproduced in CONTEXT.md, and Phase 27's D-02 anti-quota rule.

Left open to research and planning, not delegated by the user but simply not decided here: the
minimum-population threshold for D-02; the three-pass restructuring's module layout; how Criterion
1's determinism is demonstrated failing; how the 662-activity cohort dry-run count is reported; the
demotion reason's exact wording; and tier/badge styling against Phase 19's design system.

## Deferred Ideas

- The override / re-admit action → Phase 29 (D-11).
- A demoted-cohort filter on the Activities list → Phase 29 (considered under D-09 and D-15).
- Investigating the 44.0s → 45.2s fixture drift → a todo; reconciled but unexplained (D-04).
- Extending the diff to derived downstream documents → considered and rejected under D-12.
- Dropping 400m from `TARGET_ORDER` → considered and rejected under D-03; revisit as its own phase
  if the table stays permanently empty across future milestones.

### Reviewed todos, not folded

- **IN-17 / IN-18 curation-guard cosmetics** (score 0.6) — already routed to Phase 29 by
  `27-CONTEXT.md`; Phase 28 does not touch `curation-guard.mjs`.
- **Garmin export adapter** (score 0.2, STREAM-04) — externally blocked, and a stream ingestion
  change this milestone's byte-identical-streams non-goal forbids. Declined on the same grounds in
  Phases 26 and 27.
