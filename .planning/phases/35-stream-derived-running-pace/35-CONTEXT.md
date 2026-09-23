# Phase 35: Stream-Derived Running Pace - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A stream-derived **running pace** — unreliable segments and gaps excluded from both distance and
time — is computed for every activity with a computable stream, through the existing single
pace-derivation module (`src/analytics/pace-derivation.ts`). It is shown beside the metadata pace on
the activity detail view with a plain statement of the excluded metres and seconds, and the existing
"Pace disputed" badge is raised on material disagreement under a threshold calibrated against the
archive and recorded in a regenerable artifact.

**Requirements:** RPACE-01, RPACE-02, RPACE-03 — plus Phase 35's own half of SEG-05b (D-11).

**Not in this phase:** best-effort partitioning, demotion and the ceiling diff (Phase 36);
review-queue priority and CUR-04 (Phase 37); a "stopped time removed" pace (STOP-04, out of
milestone); pause-class tinting or any change to Phase 33's pace-chart clipping and Phase 34's
Pauses section. **Nothing is corrected:** metadata pace and device `moving_time` remain the shipped
aggregate everywhere — lists, stats documents and widgets are unchanged (ROADMAP criterion 4, and
the milestone's standing non-goal "Replacing metadata pace or `moving_time` as the shipped
aggregate"). No stream file is rewritten.

</domain>

<decisions>
## Implementation Decisions

### Measured during this discussion (throwaway probe — references to reconcile against, NEVER expected values)

Probe: `derivePaceWithCoverage` over 1,873 computable committed streams; running pace taken as the
sum of per-step metres and seconds over steps not overlapping any `gapInterval` (one of several
readings — see D-08). Metadata pace from `data/activities/*.json` (`moving_time / (distance/1000)`).

| Activity | Metadata | Span (elapsed) | Running | Δ | Ratio | Excluded |
|---|---|---|---|---|---|---|
| 3475724402 | 4:56/km (296.0) | 5:24/km | 5:18/km | +21.6 s/km | ×1.073 | 2,253 m / 797 s |
| 3475734189 | 5:41/km | 5:49/km | 5:55/km | +14.0 s/km | ×1.041 | 182 m / 24 s |
| 3475740390 | 5:42/km | 5:45/km | 5:45/km | +2.4 s/km | ×1.007 | 222 m / 81 s |
| 5059204779 | 1:53/km (112.6) | 5:51/km (350.6) | 5:56/km (355.8) | +243.2 s/km | ×3.161 | 166 m / 3 s |

Archive-wide Δ (running − metadata), n=1,873: q50 +0.9, q75 +2.0, q90 +5.0, q95 +10.7, q97 +16.3,
q99 +40.2, max +243.2, min −158.2 s/km. Ratio: q50 1.003, q90 1.014, q95 1.029, q97 1.046,
q99 1.106, max 3.161. Counts over candidate cuts: Δ≥5 → 189; Δ≥10 → 99; Δ≥15 → 64; Δ≥20 → 44;
Δ≥30 → 28; Δ≥45 → 15; Δ≥60 → 10. Ratio≥1.02 → 136; ≥1.03 → 90; ≥1.05 → 52; ≥1.075 → 30;
≥1.10 → 22; ≥1.15 → 11; ≥1.25 → 4.

**Three findings that drove the decisions below, recorded so they are not re-derived:**

1. **Today's PACE-07 gate can never fire on 3475724402.** The shipped rule is
   `metadataPaceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM (200)` **and**
   `streamPaceSecPerKm / metadata >= PACE_DISAGREEMENT_RATIO (2)`. 3475724402's metadata pace is
   296.0 s/km (fails the gate outright) and its ratio is 1.073, not ≥ 2. RPACE-03 is therefore not a
   threshold tweak — the rule itself has to change.
2. **The distribution has no valley.** Δ and ratio both decay smoothly from the median into a long
   right tail with no dip anywhere. This is the same shape that defeated Phase 34's D-06 valley rule
   and produced D-21's declaration. 3475724402 sits near q98 on both axes, so the required fixture
   is close to whatever cut is chosen, in both directions.
3. **Two different mechanisms produce a metadata↔running disagreement, and only one is this
   milestone's target.** (a) *Distance covered off the clock* — 3475724402 (2,253 m / 797 s),
   5059213289 (1,816 m / 732 s), 3475723743 (986 m / 58 s), 14122328106 (514 m / 92 s). (b) *Device
   `moving_time` disagreeing with our covered time, with almost no distance withheld* — 3475742397
   (**0 m** / 1,211 s, Δ +212.8), 3475740798 (**0 m** / 396 s, Δ +103.7), 3475737589 (**0 m** / 9 s,
   Δ +70.5), and the entire negative side (7 activities at Δ ≤ −20, led by 10969136984 at −158.2
   s/km on 123 m / 2,593 s). Mechanism (b) is what v2.2's `elapsedVsMoving` quality signal already
   exists to describe. A bare Δ threshold badges it as "pace disputed" too.

Tail composition at Δ≥20 (n=44): distances min 0.67 km, median 6.61 km, max 22.53 km; 7 under 3 km,
17 under 5 km. So the tail is **not** dominated by short runs.

### The disputed rule

- **D-01:** **REPLACE — one comparator, not two.** `detectPaceDisagreement` compares metadata pace
  against the **running pace**; the span-based `streamPaceSecPerKm` rule is retired as the disputed
  comparator. Rationale: one definition of "the stream says otherwise", one threshold to calibrate,
  and no two rules that can disagree about the same row. The replacement does **not** lose v2.2's
  sole flagged activity — under a running-pace comparison 5059204779 is the archive **maximum on
  both axes** (×3.161 / +243.2), so it clears any defensible cut by a wide margin. Rejected:
  **running beside span, badge fires on either** (preserves 5:51/km and v2.2's count of 1 exactly,
  but ships two rules, two thresholds, and lets one row carry two different "stream-derived"
  numbers); **a separate, differently-named badge** (contradicts RPACE-03's own text — "the
  *existing* 'Pace disputed' badge is raised" — and puts two pace-doubt badges on one row).
  - *Known consequence, to be disclosed rather than discovered:* 5059204779's stream-derived figure
    moves from **5:51/km (350.6)** to **5:56/km (355.8)**. 5:51/km is a figure of record, cited in
    `.planning/milestones/v2.2-REQUIREMENTS.md:62` and `:64`, in 26-07-SUMMARY.md / 26-07-PLAN.md,
    and read back verbatim at Phase 26's browser checkpoint. See D-04.
  - *Scope note:* `streamPaceSecPerKm` itself is used by nothing else in `src/` outside
    `detectPaceDisagreement` (verified by grep, 2026-09-23). Whether the function is deleted, kept
    for another purpose or kept only for its tests is open.

- **D-02:** **The eligibility gate that replaces the 3:20/km implausibility gate is Claude's
  discretion** (developer: "you decide"), **bound by all of:** 3475724402 MUST be badged
  (ROADMAP criterion 3); the gate is stated in the calibration artifact with its own
  non-circularity argument; and whatever population it excludes is **named with its measured
  count**, never silently dropped. Finding 3 above is the material the planner must engage with —
  an excluded-distance gate would keep the badge on this milestone's claim and leave pure
  `moving_time` divergence to `elapsedVsMoving`; no gate at all makes the badge mean "these two
  figures disagree for any reason", which is defensible only if the disclosure sentence says so.
  Options put to the developer and left open: excluded-distance gate (floor in metres, or as a
  fraction of the activity's own distance); no gate, threshold alone; minimum-scale gate only
  (11 activities are under 2 km).

- **D-03:** **Badge reach across surfaces is Claude's discretion, bound by one hard rule: no surface
  may disagree with another about whether a given activity's pace is disputed.** Today
  `appendPaceDisputedBadge` dispatches from one place to four list surfaces (Activities, Records,
  Overview PRs, Overview Activities) and fires on 1 activity; under the widened rule the badged
  population is order ~20–45. ROADMAP criterion 4 protects the metadata pace **figure**, not the
  absence of badges, so widening the reach is permitted — but whichever reach ships is read back at
  the phase's human browser checkpoint. A detail-view-only badge with list rows still firing on the
  old population is the shape Phase 24's D-04 lesson (duplicated derivations diverging) warns
  against and would need an explicit argument.

- **D-04:** **How the shipped `paceDisagreement.streamPaceSecPerKm` field and the 5:51/km figure of
  record are handled is Claude's discretion, bound by two standing conventions:** (i) a shipped
  field's name must match what it holds — the 33 D-11 precedent, where copy that stopped describing
  its own number was treated as a correctness fix, not cosmetics; (ii) any figure of record that
  moves gets a **dated in-place amendment** naming what superseded it and why, in the Phase 32 D-03
  / 33 D-12 / 34 D-02 pattern, never a silent overwrite. Options left open: rename the field and
  amend the figure; keep the name and amend only docblock + figures; carry both numbers on the row.

### The disagreement threshold (RPACE-03)

- **D-05:** **FULL CALIBRATION, with a HALT contract. The declare-up-front shortcut is explicitly
  REJECTED for this constant.** The developer chose calibration knowing the distribution has no
  valley (finding 2) and knowing Phase 34 HALTed three times before declaring D-20 and D-21. The
  machinery is the established one, unchanged:
  - Candidate statistic shapes are **pre-declared in the plan text, each with a written
    non-circularity argument, BEFORE any measurement** (33 D-16, 34 D-06).
  - A deliberately circular **strawman is measured first and must FAIL**; a strawman that passes
    invalidates the round (32 D-13).
  - **D-13 insensitivity at a 1% tolerance, fixed before measuring and never widened** (34 D-19's
    rejection of option 3 is binding precedent). Both axes: re-derive with the judged
    population's contribution removed, and with proportional planted synthetics —
    `ceil(INSENSITIVITY_TOLERANCE × N)` items where N is the shape's own base population size in its
    own unit (34 D-19's proportional-planting rule).
  - **Every plant must enter the population its shape actually reads**, and a test asserts
    `planted items = base items + plants entered` for every shape and strawman (34 D-19's fix for
    HALT-1's vacuous rows). Watched RED first.
  - **First-clearing arbitration.** The archive-wide badged count is a **reported finding** and may
    never select, tune or re-order a shape (Phase 27 D-02 anti-quota).
  - **If no pre-declared shape clears, the plan commits a NO SHAPE CLEARS artifact and HALTs for the
    developer.** Nothing is widened, loosened or hand-picked on executor judgement.
  - The probe figures in this file are **contaminated context**: they are known to the planner and
    must never be pinned as an expected value, success criterion or fixture target, and the
    pre-declared shapes must be argued from first principles (34 D-19's contamination guard).

- **D-06:** **Direction (symmetric vs slower-only) is Claude's discretion, bound by:** whichever
  direction ships is stated in the calibration artifact, and **the measured count on the other side
  is reported as a finding**, never silently dropped. The slower-only reading matches the
  milestone's actual claim (distance covered off the clock reported as speed); the symmetric reading
  matches RPACE-03's literal wording ("the two figures disagree materially"). If symmetric ships,
  the disclosure sentence must carry the sign so a reader is not misled about which way the pace
  moved.

- **D-07:** **The statistic family (ratio, absolute Δ in sec/km, or both) is Claude's discretion,
  subject to D-05's pre-declaration-before-measurement rule.** Recorded so the trade-off is not
  re-derived: the two rank the tail differently — 3475742397 is #2 by Δ (+212.8) but mid-pack by
  ratio (×1.280), because its metadata pace is 12:41/km. A ratio is scale-free; an absolute Δ is
  directly readable in the disclosure sentence and in the same unit as every pace figure on the page.

### The running-pace definition (RPACE-01)

- **D-08:** **The exact computation is Claude's discretion, bound by all of:**
  - It must be a **total-distance ÷ total-time** quantity that a **zero-import independent recount
    can reproduce** — the project's standing convention that every headline figure is re-derived
    outside the code that produced it. This rules out a time-weighted mean of
    `derivePaceSeriesGapAware`'s windowed series, which is a mean of paces and cannot reconcile
    against a metres÷seconds recount.
  - RPACE-02's "excluded metres and seconds" must **reconcile with what the coverage caption already
    discloses** (33 D-10's four always-on terms). Two covered-time numbers that can disagree is the
    defect shape, not the design.
  - It is computed **through `pace-derivation.ts`** (RPACE-01's "the existing single pace-derivation
    module"), and the single-source audit (`src/analytics/pace-single-source.test.ts`) must see it.
  - Boundary handling — what happens to a sample step that straddles an interval edge — is **stated
    explicitly and pinned by a test**, not left implicit.
  - "Computable stream" is **defined**, with the count of non-computable activities reported. The
    probe found 1 of 1,874 streams not computable; that figure is a reference, not an expectation.
  - Readings put to the developer and left open: covered metres ÷ `coverage.coveredSec` (ties the
    denominator to COV-01's proven-exact number and to the caption); whole-step exclusion (simplest
    to recount, but ships a second covered-time number).

### Detail-view disclosure and the splits coupling (RPACE-02)

- **D-09:** **The splits rebase FOLLOWS the badge.** Phase 26's D-13 rule is kept exactly as
  written: whenever the disputed badge fires, `buildSplitsSection`'s `activityAvgPaceSecPerKm`
  argument is rebased away from metadata pace — now to the **running pace** — and the section
  renders its own disclosure note from that same value. Rationale: the page must never compare
  splits against a figure it is simultaneously disputing. **Known consequence:** the rebased
  population grows from 1 activity to order ~20–45, so ~20–45 activities' "vs. Avg" bars change
  baseline this phase. That is a visible change to a shipped surface and MUST be read back at the
  human browser checkpoint, against a value derived outside the changed code. Rejected: **rebase
  stays on the old span-based population** (a detail view that badges the pace as disputed while
  still comparing its own splits against exactly that disputed figure — the contradiction D-13 was
  written to remove); **retire the rebase entirely** (reverses a shipped v2.2 decision and moves
  5059204779's splits comparison back onto its 1:53/km metadata pace).

- **D-10:** **Where the running pace renders, whether it renders on every activity or only when
  something was excluded, and the exclusions sentence's wording are Claude's discretion, bound by:**
  RPACE-02's "a plain statement of what was excluded (metres and seconds)" is an explicit
  requirement, not optional garnish; ROADMAP criterion 2 requires 3475724402's detail view to show
  the running pace beside the metadata pace **with the two figures visibly differing**; and ROADMAP
  criterion 4 keeps lists, stats documents and widgets byte-identical. The existing Pace stat card
  (`detail.ts:683`, where `appendAccessibleBadge` already attaches the disputed disclosure as a
  third child) and the always-on Quality Signals section are both established templates. Note
  COV-02's always-on precedent: a term that disappears at zero stops meaning "zero" and starts
  meaning "unknown".

### SEG-05b — Phase 35's half

- **D-11:** **Phase 35 records its own half of SEG-05b, proven load-bearing, not by import.** The
  running-pace computation consumes the detector's output through `pace-derivation.ts`'s existing
  single import. The proof is the 33 D-15 / 34 D-01 shape: **stub the detector call and watch the
  running pace change** on a named activity — not "the import exists". Record the half in
  `REQUIREMENTS.md`'s SEG-05b row with dated provenance and the plan/task that proved it. The row
  re-ticks only after **Phase 36** records its half too; Phase 35 must not tick it.

### Claude's Discretion

Consolidated — each is bound by the constraints stated in its own decision above:

- The eligibility gate replacing the 3:20/km threshold (D-02).
- Badge reach across list surfaces vs detail view (D-03).
- Field naming and how the 5:51/km figure of record is amended (D-04).
- Threshold direction (D-06) and statistic family (D-07), subject to D-05's pre-declaration rule.
- The exact running-pace computation and its boundary rule (D-08).
- Rendering placement, conditionality and copy for the running pace and its exclusions line (D-10).
- The calibration artifact's filename and the generator/recount script names, following
  `32-CALIBRATION.md` / `33-CALIBRATION.md` / `34-CALIBRATION.md` and
  `compute-*-calibration.mjs` / `compute-*-recount.mjs`.
- Whether the running pace and its exclusions ship as index-row scalars, in the lazy quality shard,
  or both — additive only, `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`.
- The disposition of `streamPaceSecPerKm` once it is no longer the disputed comparator (D-01).

### Folded Todos

- **`validateStreamSeries` reads `t.length` unconditionally — nine call sites still carry the null
  gap** (`.planning/todos/pending/2026-09-23-validate-stream-series-null-safety-at-source.md`,
  created 2026-09-23, area `analytics`, from 34-REVIEW.md IN-04). Folded because it sits directly in
  this phase's blast radius: RPACE-01 computes a running pace for **every** activity with a
  computable stream, D-08 requires "computable stream" to be defined, and one of the nine unguarded
  sites is `pace-derivation.ts:937` — the `validateStreamSeries` call inside `streamPaceSecPerKm`,
  the very function D-01 retires as the disputed comparator. Its own acceptance criteria carry over:
  `validateStreamSeries(null, null)` returns `{ ok: false }` with a stated reason rather than
  throwing, proven by a test; every call site's behaviour on null input is asserted or its
  now-redundant guard removed with a comment saying why; and the comment plan 34-16 narrowed in
  `pace-derivation.ts` is restored to its general claim once true. Not a live defect today —
  hardening, per the todo's own "Why deferred".

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` § Phase 35 — the goal and four success criteria. **Criterion 3's
  "calibrated against the archive and recorded" is what D-05 commits to in full, HALT contract
  included.** Criterion 4 ("metadata pace and device `moving_time` remain byte-identical everywhere
  else") is the phase's hard boundary.
- `.planning/REQUIREMENTS.md` — RPACE-01, RPACE-02, RPACE-03; the **standing conventions paragraph
  every requirement inherits** (watch-it-fail, classifier-independent recount, idempotent artifacts,
  fixtures pinned to values derived outside the changed code, human browser checkpoint, merge origin
  once per phase); SEG-05b's row (Phase 35 records its half, D-11); and § Out of Scope, especially
  "Replacing metadata pace or `moving_time` as the shipped aggregate".
- `.planning/PROJECT.md` § Current Milestone: v2.3 — the three named activities' measured scoping
  facts, and "Device `moving_time` and metadata pace stay the shipped aggregate; the stream-derived
  figure is shown beside it, never substituted."

### The v2.2 rule this phase replaces
- `.planning/milestones/v2.2-REQUIREMENTS.md:62` and `:64` — PACE-07's text and the **5:51/km figure
  of record** for 5059204779 that D-01 moves to 5:56/km and D-04 must amend with dated provenance.
- `.planning/milestones/v2.2-phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-07-SUMMARY.md`
  — why `streamPaceSecPerKm` is deliberately span-based rather than windowed (lines 44, 56, 96, 106),
  and the 26-UI-SPEC D-11/D-13 contracts the badge and the splits rebase implement.
- `.planning/milestones/v2.2-phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-07-PLAN.md`
  — the original PACE-07 acceptance shape.

### Decisions this phase inherits
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CONTEXT.md` — **D-01**
  (the whole merged segment is ONE `unreliable` interval, at the top of the priority tree), **D-02**
  (one `gapIntervals` array, so anything clipping on gaps inherits unreliable for free), **D-03**
  (the load-bearing assertion is agreement with an INDEPENDENT recount, not internal consistency),
  **D-10** (four always-on caption terms; independent per-term rounding), **D-11** (copy must name
  exactly what its number counts — a correctness fix, not cosmetics), **D-13** (checkpoint rows
  assert an independently-derived extent, with a stated CAN FAIL / CAN PASS proof), **D-15**
  (SEG-05b is per-phase and proven load-bearing by stubbing), **D-16** (non-self-referential
  population; HALT rather than widen).
- `.planning/phases/34-pause-classification-forgotten-stop/34-CONTEXT.md` — **D-19** (proportional
  planting; every plant must enter the population its shape reads; the contamination guard on
  known measured values), **D-20 / D-21** (what a declared constant costs and requires — the path
  D-05 deliberately does NOT take, plus the basis-gate pattern if it is ever reached), **D-22**
  (guards must assert against an independent value; the union-semantics lesson).
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CONTEXT.md` — **D-04** (one
  downstream treatment per segment; withholding a claim never alters distance, totals or splits),
  **D-13** (insensitivity, not prose; watched failing first), **D-15** (independent recount),
  **D-16** (figures of record in three units over a live denominator).
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` —
  `UNRELIABLE_SPEED_LIMIT_MPS = 7.35` and its non-circularity argument; the archive figures of
  record (699 of 1,874 activities, 1,344 segments, 77,915.4 m, 16,020 s).
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md` and
  `33-COVERAGE-IDENTITY.md` — artifact shape, and 33-08's failed-percentile table as the recorded
  negative example D-05 guards against.
- `.planning/research/PITFALLS.md` — 5 (circularity), 11 (a recount that shares the classifier's
  blind spot), 12 (look-alike fixtures), 13 (artifacts reverting on regeneration).
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`,
  `.planning/research/STACK.md` (no new runtime dependencies).
- `.planning/RETROSPECTIVE.md` — vacuous checks, unsatisfiable checkpoint rows, recounts.

### Code this phase reads or changes
- `src/analytics/pace-derivation.ts` — **`detectPaceDisagreement` (:980)**, `PaceDisagreementResult`
  (:956), `streamPaceSecPerKm` (:943), `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM = 200`
  (:921), `PACE_DISAGREEMENT_RATIO = 2` (:928) — the rule D-01 replaces. Also `PaceCoverage` (:167,
  `spanSec` / `coveredSec` / `recordingGapSec` / `pauseSec` / `unreliableSec` / `gapIntervals`),
  `classifyGaps` / `classifyGapsWithSegments`, `derivePaceWithCoverage`,
  `derivePaceSeriesGapAware`, `quantile` (:100 — reuse, never a third percentile definition), and
  the `validateStreamSeries` call at **:937** that the folded todo covers.
- `src/analytics/unreliable-segments.ts` — `detectUnreliableSegments` and
  `UNRELIABLE_SPEED_LIMIT_MPS`; `pace-derivation.ts` is its ONE permitted importer (D-11).
- `src/analytics/best-effort-utils.ts` — `validateStreamSeries` (~:73), the folded todo's single
  real fix site.
- `src/analytics/dashboard-index.types.ts` — `paceDisagreement` row shape
  (`streamPaceSecPerKm` :150, `metadataPaceSecPerKm` :151) and
  `DASHBOARD_INDEX_SCHEMA_VERSION = 1`, which stays.
- `src/analytics/compute-dashboard-index.ts` — the write end; `round1` convention.
- `src/dashboard/views/detail.ts` — the Pace stat card (**:683**), the `disagreement` read
  (**:679**), the disputed badge attach (**:692-698**), and **`rebasedAveragePaceSecPerKm`
  (:809)** plus the `buildSplitsSection` call (:812-817) that D-09 governs.
- `src/dashboard/views/detail-sections.ts` — `buildSplitsSection` (:340), `buildPaceBarCell` (:254),
  the `isRebasedAverage` disclosure note (**:427-430**), `coverageCaptionText`,
  `qualitySignalsSectionPlan`, `EXPLANATION_PROBE_QUALITY` / `EXPLANATION_PROBE_SPECS`.
- `src/dashboard/views/list.ts` — `PACE_DISPUTED_BADGE_TEXT` (:287),
  `paceDisputedDescriptionId` (:297), `paceDisputedExplanation` (**:308** — the disclosure
  sentence), `appendPaceDisputedBadge` (:312), `appendAccessibleBadge`, and the four-surface
  dispatch (:705-707) that D-03 governs.
- `src/analytics/pace-quality.ts` — `resolveCoverage` (the module's sole `classifyGaps` call site),
  `hasAnySevereSignal` (**never widened**), `PaceQualityShard` / `buildPaceQualityShard`.
- `src/dashboard/data/pace-quality-client.ts` — the shard read end.

### Guards and generators to extend or mirror
- `src/analytics/pace-single-source.test.ts` — the single-source audit; D-11's proof must satisfy it.
- `scripts/compute-unreliable-segment-recount.mjs` and
  `scripts/unreliable-segment-recount-crosscheck.test.mjs` — the zero-import recount pattern D-08
  requires.
- `scripts/compute-unreliable-segment-calibration.mjs`,
  `scripts/compute-unreliable-segment-severity-calibration.mjs`,
  `scripts/compute-pause-classification-recount.mjs` (+ their `.test.mjs`) — generator pattern, the
  idempotence proof, and the observing `vi.mock('fs')` import-time guard.
- `scripts/compute-stream-checksums.mjs` — the `data/streams/` immutability gate; this phase writes
  nothing there.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`detectPaceDisagreement` already has the right shape** — it returns `null` or a fully-populated
  result, never a partial object or a zero, and takes an `options` override for both constants.
  D-01 changes its comparator and threshold semantics, not its contract.
- **`PaceCoverage` already carries the exact-second ledger** — `coveredSec` is proven exact by
  COV-01/COV-03 and already disclosed in the caption's four always-on terms. D-08's denominator
  question is about whether to reuse that number or ship a second one.
- **`appendAccessibleBadge`** attaches a badge with its `.sr-only` explanation to any element and is
  already used by the detail Pace tile — the template for anything new on that tile.
- **`buildStatCard`** in `detail.ts` — the stat-grid template if a second card is chosen (D-10).
- **`quantile` (pace-derivation.ts:100)** — the one percentile definition; the calibration shapes
  reuse it, never a third.
- **`projectUnreliableSegments` / `buildPaceQualityShard`** — the cap-100 shard projection pattern,
  if any per-activity list ships.

### Established Patterns
- Constants carry a docblock naming the measurement they came from and the rule forbidding tuning
  toward a count. `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`'s existing docblock is the
  template — and is itself the prose D-04 must amend.
- Every calibration generator has a `.test.mjs`, is run twice to prove idempotence, and **its prose
  is generated** — hand-editing the artifact without fixing the generator silently reverts.
- Guards are demonstrated RED on a planted violation before they may pass.
- Only `severe`-tier signals badge a list row; `none` / `not-computable` are disclosed in the
  detail view's always-on Quality Signals section instead.
- Figures of record are superseded by dated in-place amendment with a forward reference, never a
  silent overwrite of the archive (34 D-04's treatment of the v2.2 transport figure).

### Integration Points — and three inheritance traps
- **`rebasedAveragePaceSecPerKm` (detail.ts:809) is a one-line conditional on `disagreement !==
  null`.** Widening the badge population silently widens the rebase population by exactly the same
  amount — D-09 makes that intentional, but the browser checkpoint must cover it, and the
  disclosure note at `detail-sections.ts:430` still says "not the disputed metadata average" while
  naming a figure whose definition has changed.
- **`paceDisputedExplanation` (list.ts:308)** renders `"{stream} measured vs. {metadata} shown"`.
  Under D-01 the first figure changes meaning; under D-06 it may also need a sign. The badge's own
  docblock rule (text names exactly what the number is) applies — 33 D-11's precedent.
- **`data/dashboard/index.json` is regenerated by CI nightly**, and the archive moves under
  calibration artifacts. Regenerate after merging origin (MERGE-01).
- `npm test` (vitest, `fileParallelism: false`) is the nightly deploy gate: nothing added there may
  read gitignored or owner-editable live files (Phase 31 TD-01).
- `data/streams/` immutability is gated by `compute-stream-checksums`; this phase writes nothing
  there.

</code_context>

<specifics>
## Specific Ideas

- **Named fixtures, real IDs only — no synthetic look-alikes and no convenient nearby activity
  standing in for a named input.** **3475724402** is criterion 2 and 3's activity (metadata 4:56/km,
  no split under 5:00, probe running pace 5:18/km on 2,253 m / 797 s excluded). **5059204779** is the
  PACE-07 regression fixture whose figure D-01 moves. **3475734189** and **3475740390** are the other
  two scoping activities and are useful negative controls — at Δ +14.0 and +2.4 s/km neither is
  required to be badged.
- **Every figure in this file is a reference to reconcile against, never an expected value.** The
  probe was a throwaway using one of several possible running-pace definitions (D-08 has not chosen);
  its own numbers will move once D-08 is settled. Audit every figure a plan quotes.
- **D-05's contamination guard is live:** the planner has seen the Δ and ratio distributions above,
  so the pre-declared shapes must be argued from first principles and the plan must state where its
  populations overlap what is quoted here and why that is not "the probe with a cut applied".
- Documents needing recorded, dated amendments as part of this phase's work: the PACE-07 figure of
  record wherever it is cited (D-04); `REQUIREMENTS.md`'s SEG-05b row, recording Phase 35's half
  **without re-ticking** (D-11); and RPACE-03's own row if D-05 ends in a HALT and a constant is
  declared. ROADMAP/STATE mutations go through `gsd-sdk query` handlers where one exists — never a
  direct Write.
- Planner note: **list the D-NN ids in each plan's frontmatter `must_haves.decisions`** so the
  decision-coverage gate can see them (it cannot read planner XML tags).
- Merge origin at least once during the phase and **regenerate artifacts after the merge** — the
  nightly CI commits to origin/master and the archive moves under calibration artifacts. Expect
  non-fast-forward; merge, don't rebase.
- **The phase closes on a human browser checkpoint against a digest-verified served build.** Criteria
  2 and 3 are rendered claims, and D-09's rebase is a visible change to a shipped surface.
  Hard-reload after every fixture edit — a stale `index.html` / `index.json` in a staged build has
  produced false evidence in this project before.
- Checkpoint rows assert an **independently-derived value with a stated CAN FAIL / CAN PASS
  reachability proof in both directions** (33 D-13). An absence-only or internal-agreement row
  passes equally well against a chart that failed to render — this project has shipped a green gate
  over a broken build on exactly that shape twice.
- If any `VALIDATION.md` row uses a `vitest -t` name filter, record the **matched test count** — a
  filter matching zero tests exits 0.

</specifics>

<deferred>
## Deferred Ideas

- **Splitting the disputed badge into two named claims** — "pace disputed (distance off the clock)"
  vs "pace disputed (moving-time divergence)". Raised by finding 3's two mechanisms. Deferred: D-01
  commits to one badge, and RPACE-03 names the existing one. Revisit only if the shipped single
  badge proves to conflate the two in a way readers complain about.
- **Surfacing the running pace outside the detail view** — on list rows, in stats documents or in
  widgets. Explicitly barred by ROADMAP criterion 4 this phase.
- **A "stopped time removed" pace** — STOP-04, already Out of Scope pending STOP-02's calibration.
- **Reconciling the running pace against device `moving_time` as its own signal** — the negative
  side of the distribution (7 activities where the running pace is faster than metadata) is
  `elapsedVsMoving`'s territory, not RPACE's. Belongs with any future revisit of that signal.

### Reviewed Todos (not folded)
- **"unreliableSegments and impossibleSamples shard lists are capped on write only"**
  (`.planning/todos/pending/2026-09-23-read-and-render-caps-for-shard-lists.md`, score 0.6,
  dashboard) — relevant only if this phase ships a new shard list, and the running pace is more
  likely a row scalar (D-10 / Discretion). Kept pending.
- **"Pace chart y-axis compressed by pre-pause run-in samples (3475734189, 68–93 min/km at
  t=208–219)"** (`.planning/todos/pending/2026-09-22-pace-chart-y-axis-compressed-by-pre-pause-run-in-samples.md`,
  score 0.6, dashboard) — a chart-scaling concern no RPACE requirement covers. Already reviewed and
  kept deferred by the developer in Phase 34; same disposition here.
- **"Pauses summary row names the not-classifiable category, not the mechanisms actually present"**
  (`.planning/todos/pending/2026-09-23-not-classifiable-mechanism-breakdown-in-pauses-row.md`, score
  0.4, dashboard) — Phase 34 disclosure polish on a different detail-view section. Kept pending.

</deferred>

---

*Phase: 35-Stream-Derived Running Pace*
*Context gathered: 2026-09-23*
