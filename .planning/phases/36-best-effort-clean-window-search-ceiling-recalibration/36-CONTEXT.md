# Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The ranking path. A best-effort window may not span, or interpolate a crossing across, an
unreliable segment. The contaminated effort is demoted-and-kept under a new guard while the search
continues for the best clean sub-interval found by **partitioning** the stream (never splicing);
unreliable-segment exclusion runs strictly before ceiling derivation within the existing three-pass
shape; and both an archive-wide best-effort diff and a ceiling recalibration diff are signed by the
developer against their sha256 before the phase closes.

**Requirements:** PR-06, PR-07, PR-08, PR-09 — plus Phase 36's own half of **SEG-05b**, the last
one outstanding. Per 35-CONTEXT.md D-11, the SEG-05b row re-ticks only after Phase 36 records its
half; Phases 33, 34 and 35 each recorded theirs and none ticked the row.

**Not in this phase:** review-queue reordering by pause class or by guard-moved efforts, the
reversible "reviewed and kept" action, and CUR-04 (all Phase 37 — see D-17). No change to the
detector's calibration or its constants. No change to distance, totals, moving time, splits or
pace — barring a window *withholds a claim*, it never alters a measurement (32-CONTEXT.md D-04).

</domain>

<decisions>
## Implementation Decisions

### Measured during this discussion (throwaway probe — references to reconcile against, NEVER expected values)

The roadmapper-pins-probe-figures failure has already happened once on this milestone. Every figure
below is a reference to reconcile against and explain any difference from, **not** a pinned
expected value. ROADMAP criterion 1's own rule applies to all of them.

Probe: `classifyGapsWithSegments` for segments; a local re-implementation of the two-pointer sweep
restricted to index ranges; `deriveCeilings` from the shipped module. Run 2026-09-28 against the
live archive (1,874 streams swept).

**Validation that the probe is on the same footing as the shipped pipeline:** its *before* column
reproduces the shipped ceiling exactly — 1mi ceiling **4.6282**, p90 **3.6157**, population
**1851** — against `best-effort-ceiling.ts:191`'s docblock ("4.628 m/s derived from 1,851 filtered
efforts with p90 3.616 m/s"). The *after* column was computed by the same code path.

400m, the three scoping activities:

| Activity | Today | Partition (honest) | Naive splice | d-rebased splice | t-rebased splice |
|---|---|---|---|---|---|
| 3475740390 | 3:20/km (79.9 s, starts t=2508 on the 52 m jump) | 4:59/km (119.6 s, t=1308) | 3:24 | 4:51 | 2:57 |
| 3475724402 | 3:21/km | 4:50/km | 4:31 | 4:57 | 0:33 |
| 3475734189 | 3:22/km | 5:08/km | 3:22 | 5:08 | 3:02 |

Archive-wide, per-distance ceiling recalibration:

| dist | popN before/after | p90 before → after | ceiling before → after | delta |
|---|---|---|---|---|
| 400m | 1834 / 1858 | 3.9927 → 3.9294 | 5.1108 → 5.0297 | −0.0811 |
| 1k | 1852 / 1854 | 3.7106 → 3.6801 | 4.7497 → 4.7106 | −0.0391 |
| 1mi | 1851 / 1848 | 3.6157 → 3.5919 | 4.6282 → 4.5977 | −0.0305 |
| 5k | 1788 / 1726 | 3.3947 → 3.3893 | 4.3453 → 4.3384 | −0.0069 |
| 10k | 1468 / 1147 | 3.2971 → 3.3220 | 4.2204 → 4.2522 | **+0.0318 (up)** |
| half | 104 / 69 | 3.4388 → null | 4.4017 → **null** | loses its ceiling |
| marathon | 0 / 0 | null | null | n/a |

Effort-distance pairs: **1,200 moved**, 7,352 unchanged, **439 with no clean window** (concentrated
at 10k/half). 699 of 1,874 activities carry at least one segment.

**Four findings that drove the decisions below, recorded so they are not re-derived:**

1. **The merged-gap question is measurably immaterial today.** Excluding the whole merged segment
   span vs excluding only the `parts[].kind === 'burst'` spans produces provably different cut
   lists (17 vs 26 sub-intervals on 3475724402) but identical moved/unchanged/lost counts and
   identical ceilings to 4 dp. The burst is what severs the stream; the gap portion adds only
   marginal extent. → D-01.
2. **"Splice fabricates a FASTER window" is directional and variant-specific.** The naive splice on
   3475740390 (3:24) is *slower than today* (3:20) and *far faster than the honest answer* (4:59).
   A test asserting "splice < today's figure" would be **false** there. The comparison that holds
   is splice vs partition. Further, the d-rebased variant is faster than the honest answer on
   3475740390 (4:51 < 4:59) but **slower** on 3475724402 (4:57 > 4:50) — so the variant and the
   fixture must be pinned together or the row is unsatisfiable. → D-02.
3. **The contaminated window can intersect several segments.** 3475740390's 400m window
   (t=2508 → 2587.9) intersects **four**: 52.4 m/5 s at t=2508, 28.6 m/2 s at t=2536, 30.4 m/3 s at
   t=2580, 24.7 m/2 s at t=2587. PR-07's "the segment" is singular; reality is plural. → D-07.
4. **`demotion !== null` currently MEANS "does not rank".** `compute-best-efforts.ts:304` skips
   such an effort from `byDistance`, and `detail-best-efforts-logic.ts:266` renders "is left out of
   the ranked PR list because a plausibility guard rejected it". PR-07 needs an effort that carries
   a rejection record **and still ranks** on the clean figure. Reusing `demotion` for that would
   invert a load-bearing invariant at four call sites. → D-05.

### Partition and crossing rule

- **D-01:** **The exclusion granularity is delegated, under an equivalence guard.** Research and
  planning choose between excluding the whole merged segment span (`startIndex`..`endIndex`) and
  excluding only the `burst` parts. A committed archive-wide test must measure **both** readings and
  assert they agree on today's archive, so the day they diverge is a visible failure rather than
  silent drift. Recording the equivalence as a checked fact, not a one-off probe, is the point.
- **D-02:** **Criterion 2's test defends against the d-rebased splice, on 3475740390.** The variant
  that deletes the unreliable samples **and** subtracts the segment's metres is the one a competent
  maintainer would actually write, and the one whose wrong answer looks reasonable (4:51 vs the
  honest 4:59 — a reviewer would wave that through as noise). The t-rebased variant (0:33/km on
  3475724402) is a straw man nobody would ship. Variant and fixture are pinned **together**: on
  3475724402 the d-rebased answer is slower than partition, so that pairing would be an
  unsatisfiable row (see finding 2).
- **D-03:** **An archive-wide overlap invariant, computed from the detector's own output.** Every
  ranked effort's `[startOffsetSec, endOffsetSec]` interval must overlap no segment returned by the
  detector — asserted against the detector, **not** against the search code. Watched failing on a
  deliberately widened sub-interval before it may pass. This project has twice had a Critical slip
  past a guard that only checked the changed code against itself (Phase 23 extent, Phase 32
  cross-segment conservation).
- **D-04:** **Demotion is triggered structurally, not by a movement threshold.** An effort is
  recorded as contaminated when the *unpartitioned* best window intersects a segment — regardless of
  how much the figure moves. No new calibrated constant is introduced, and PR-09's "every newly
  demoted effort" count is well-defined and independently recomputable. Rejected: "when the ranked
  figure actually moves", which needs a movement threshold this milestone has deliberately avoided
  inventing without a measured basis.

### Contaminated and clean record shape

- **D-05:** **A new sibling field; `demotion` keeps its exact current meaning.** Add
  `contaminated: { guard, reason, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec } | null`
  to `ComputedEffort`. The effort's own `durationSec`/`paceSecPerKm` **are** the clean window and it
  ranks normally. Purely additive, so no `BEST_EFFORTS_SCHEMA_VERSION` bump — the Phase 26 D-14
  precedent, matching how `totals.effortsDemoted` and `ceilings` were added. At-most-one-effort-
  per-distance holds, so all four `.find(e => e.distance === key)` sites keep working unchanged.
  Rejected: reusing `demotion` with a new guard value (inverts the invariant in finding 4); two
  entries per distance (silently breaks the four `.find()` sites).
- **D-06:** **No clean window → the effort is kept, carrying the contaminated figure, with
  `demotion` set.** `durationSec`/`paceSecPerKm` hold the contaminated window and
  `demotion = { guard: 'unreliable-segment', reason }`. It genuinely does not rank, so `demotion`'s
  existing meaning holds exactly and the detail view's current copy works unchanged. **This is where
  PR-07's "new guard discriminator" lands literally**, so three places must gain the value:
  `EffortDemotionGuard` (`best-effort.types.ts:82`), `VALID_DEMOTION_GUARDS`
  (`best-efforts-client.ts:45` — it returns `null` for any unlisted guard, so omitting it makes
  every such demotion vanish silently in the browser), and `records-logic.ts:204`'s switch (which
  would otherwise bucket it into `other`). So: the **clean** case uses `contaminated`; the
  **no-clean** case uses `demotion`. Each case has exactly one unambiguous home for the contaminated
  figure. ~439 eligible pairs in the probe.
- **D-07:** **The reason's wording is delegated**, bound by: measured numbers not adjectives (the
  house register, Phase 27 D-09); **bounded length** (a window can intersect four or more segments
  — see finding 3 — and the open read/render-cap todo flags exactly this shape); and whatever it
  states must be **independently recomputable** from the detector's output by PR-09's
  reconciliation.
- **D-08:** **The new guard's position in the precedence chain is delegated**, bound by: whichever
  order is chosen must be stated in the source docblock the way the existing precedence is
  (`best-effort.types.ts:120-126`, `compute-best-efforts.ts:366-381`), and demonstrated by a test
  on a **real** activity that trips both. Today's chain is absolute guards (world-record,
  max-speed) → ceiling, and once `demotion` is non-null no later pass re-evaluates it.

### Ceiling recalibration

- **D-09:** **A new `36-CEILING-RECALIBRATION.md` artifact of record.** Committed, regenerable and
  idempotent, following the `28-CEILING-CALIBRATION.md` / `30-CALIBRATION.md` shape with its own
  generator plus a `.test.mjs` sibling, run twice to prove idempotence. Phase 28's artifact stays
  the record of how the ceiling was **derived**; this one is the record of how it **moved**.
  Rejected: amending the Phase 28 artifact (it lives under `.planning/milestones/v2.2-phases/`, and
  editing an archived milestone's artifact from a later milestone breaks the archive's provenance);
  the console-only `diffCeilingState`/`formatCeilingMovement` path (not a committed figure of
  record, and criterion 4 needs something with a sha256 to sign). **Standing trap:** the prose must
  be generated, never hand-edited — a correction to a generated artifact without fixing its
  generator silently reverts, and must be proven by idempotence rather than one run.
- **D-10:** **The half-marathon fail-open is its own named finding, and the developer signs it.**
  The population drops 104 → 69, below `CEILING_MIN_POPULATION = 100`, so under Phase 28's D-02 the
  distance fails open and keeps only the world-record and max_speed guards. That is the designed,
  honest state — but losing a guard is more than "movement", so the artifact names it as a separate
  finding with its before/after population and the floor, and PR-09's signature explicitly covers
  it. **`CEILING_MIN_POPULATION` may not move to rescue the distance** — barred by Phase 28 D-02
  and Phase 27 D-02's anti-quota rule; the constant is fixed by order-statistic arithmetic and
  takes no population-count argument.
- **D-11:** **The ceiling-state write gate (28 WR-06) is delegated**, bound by: the artifact PR-09
  signs must be **reproducible from a clean checkout** and must **not be rewritable as a side effect
  of an unrelated local command**. Context: `compute-best-efforts.ts:570-571` rewrites the tracked
  `data/best-effort-ceiling.json` whenever population or p90 moves, and 28 WR-06 is recorded as
  "partially resolved — the hazard is now documented, not removed. No opt-in guard was added."
  This phase moves every ceiling at once, so the carried-forward hazard bites here hardest. Note
  `compute-pr-ceiling-diff.mjs` already passes a throwaway `ceilingStatePath` so *generating* a diff
  is safe today; the exposure is an ordinary `compute-all-stats` run mid-phase.
- **D-12:** **The artifact's explanation depth is delegated**, bound by: zero movement **and any
  upward movement** must each carry a stated, measured cause, and no distance's row may be left with
  a number and no account of it. The probe's 10k rise (+0.0318, population 1468 → 1147) while every
  other distance falls is the concrete case — *which* efforts left the population matters more than
  how many.
- **D-13:** **PR-09's third reconciliation leg is delegated**, bound by: it **may not import** the
  search or the detector, must use a **different algorithm** rather than a rearrangement of the same
  one, and must be demonstrated **red against a deliberately-broken partitioner** before it is
  trusted. Rationale: the diff and the guard counts both read the same generated document, so the
  third leg is the only genuinely independent one. Precedents:
  `scripts/compute-elevation-recount.mjs` and `scripts/compute-pr-ceiling-recount.mjs` (never import
  the classifier, fail closed, structurally asserted), and 32-CONTEXT.md D-15.
- **D-14:** **Where the clean-window search sits in the three-pass shape is delegated**, bound by:
  the existing no-loop source-text audit on Pass 2 (`compute-best-efforts.test.ts`'s "no iteration
  to convergence" suite) must keep passing **unmodified**, and "contaminated timings never enter the
  ceiling population" must be **demonstrable rather than asserted in a comment**. The two candidates
  discussed: inside Pass 1 at `computeActivityEfforts` (makes PR-08's "strictly before"
  structurally true, but needs the detector's segments available where today only `t`/`d` are), or a
  new named pass between 1 and 2 (ordering visible as its own step, but `byDistance` would briefly
  hold contaminated timings).

### Surfacing

- **D-15:** **The detail view's presentation of a moved effort is delegated**, bound by: the
  contaminated figure and its reason must be reachable from the detail view **without leaving it**,
  and the ranked figure must **never be presented as if nothing changed**. Context: a moved effort
  has `demotion === null`, so today's "left out of the ranked PR list" note does not fire, and the
  owner's 3:20/km becomes ~4:59/km with no existing copy to explain it.
- **D-16:** **The records view's disclosure is delegated**, bound by: whatever is disclosed must be
  derived by **walking the shipped document**, not an incrementing counter — the `effortsDemoted`
  precedent at `compute-best-efforts.ts:450-462`, so it cannot drift from what a consumer sees.
  Context: under D-06 only no-clean-window efforts carry the new guard; the ~1,200 moved efforts
  carry no demotion at all, so without a deliberate decision the phase's largest effect on the
  ranking is invisible on the records view.
- **D-17:** **No review-queue work in this phase.** Phase 36 adds the guard value; the Phase 29
  queue picks it up through the path it already uses for the other three. Ordering, copy and
  controls are untouched — reordering by guard and the treatment of moved-but-ranked efforts are
  Phase 37's scope, and keeping them apart is the stated reason Phase 36 was sequenced where it is.
  Bound by: **no assumption that the new guard surfaces without evidence that it does** — the
  `VALID_DEMOTION_GUARDS` allowlist silently drops unknown guards, so "it will just work" is exactly
  the assumption that could fail quietly. The check is evidence, not a feature.
- **D-18:** **The browser evidence is delegated**, bound by: the phase closes on rendered evidence
  from the **served build**; every checkpoint row must be reachability-checked in **both**
  directions (unfailable/vacuous **and** unpassable) before it is relied on; and at least one row
  must compare against a value derived **outside the changed code** — the Phase 29 precedent, whose
  header had to reject three measured, mutually-distinct decoys.

### Claude's Discretion

- D-01's chosen granularity, D-07's reason wording, D-08's precedence position, D-11's write-gate
  mechanism, D-12's explanation depth, D-13's third-leg design, D-14's pass placement, D-15's and
  D-16's presentation, D-18's checkpoint row design — each bound by the constraint stated with it.
- How `findBestEffort` is reused per sub-interval without a second sweep implementation (optional
  index-range parameters vs per-sub-interval slicing — `d[j] - d[i]` is slice-safe since only
  differences are read). A second copy of the sweep would trip the single-source audit.
- Artifact, script and generator filenames, following `28-CEILING-CALIBRATION.md` /
  `30-CALIBRATION.md` and `compute-*-calibration.mjs` / `compute-*-recount.mjs` / `compute-*-diff.mjs`.
- The new guard value's exact spelling (`'unreliable-segment'` is used throughout this document as
  the working name).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

⚠ `.planning/config.json` has **no `context_window` key**, which silently disables the planner's
prior-phase and `Depends on:` enrichment. This phase depends on Phase 32, so Phase 32's artifacts
are listed explicitly below rather than relied on being injected.

### Phase scope and requirements
- `.planning/ROADMAP.md` § Phase 36 — goal and the four success criteria. Criterion 1's "references
  to reconcile against, NOT the pinned expected value" rule governs every figure in this document.
- `.planning/REQUIREMENTS.md` — PR-06..PR-09 (lines 41–44), the standing conventions paragraph every
  requirement inherits, the SEG-05b row (Phase 36 records the **final** half — see 35-CONTEXT.md
  D-11), line 135's statement of *why* PR-06/07 reverse v2.2's "no recomputing PR times" for this
  guard only, and § Out of Scope.
- `.planning/PROJECT.md` § Current Milestone v2.3 and § Key Decisions — the measured-not-chosen,
  anti-quota and recount conventions; line 207 records 28 WR-06 as an open developer decision.
- `.planning/STATE.md` — carried-forward items, including 28 WR-06 and the MERGE-01 process note.

### The dependency phase (Phase 32)
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CONTEXT.md` — **D-04** (one
  downstream treatment, no per-mechanism branch — binding on this phase), **D-06/D-07** (adjacency
  is touching-only; clean samples are never swallowed — this is what makes the partition boundary
  samples belong to the clean side), **D-09** (the excess-metres floor), **D-10** (the speed limit
  was deliberately NOT anchored to the 400m ceiling, precisely to avoid the cross-phase circularity
  this phase would otherwise close), **D-15** (the zero-import, different-algorithm recount shape →
  D-13). ⚠ Its line 247's "n=909 / 2,388 / 1,834" is keyed to the **wrong activity order** —
  measured 2026-09-28, 3475724402 is n=1834, 3475734189 is n=2388, 3475740390 is n=909. Do not copy
  those figures against activity IDs; re-measure.
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` (and the phase's
  SUMMARY files) — the calibrated constants and their non-circularity arguments.

### Prior consuming phases (SEG-05b halves already recorded)
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CONTEXT.md` — D-07
  (`excessMetres` semantics), D-15 (SEG-05b's premature tick, corrected).
- `.planning/phases/34-pause-classification-forgotten-stop/34-CONTEXT.md` — D-01 (reads the
  detector's merged segments by import, proven load-bearing), D-13 (checkpoint rows vs independent
  extent).
- `.planning/phases/35-stream-derived-running-pace/35-CONTEXT.md` — **D-11** (SEG-05b is per-phase,
  proven load-bearing by stubbing; the row re-ticks only after Phase 36 records its half).

### Milestone research
- `.planning/research/PITFALLS.md` — Pitfall 3 (diluted slews), 5 (circularity), 11 (a recount that
  shares the classifier's blind spot), 12 (look-alike fixtures — directly relevant to D-02), 13
  (artifacts reverting on regeneration — D-09).
- `.planning/research/ARCHITECTURE.md` — the shape Phase 36 was expected to consume from the detector.

### Precedents to mirror
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CONTEXT.md` — D-01 (a formula
  delegated under a structural non-circularity property), D-02 (fail-open below the population
  floor — the contract D-10 invokes), D-06/D-07 (re-derive fresh, diff against committed state),
  D-08/D-10 (demotion-not-deletion; machine judgment vs owner intent kept separate).
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` and
  `.planning/milestones/v2.2-phases/30-elevation-quality-signal/30-CALIBRATION.md` — the shape of a
  regenerable, idempotent artifact of record.
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-REVIEW.md` — WR-06's disposition
  row, the exact text D-11 must resolve or consciously carry.
- `.planning/RETROSPECTIVE.md` — v2.1/v2.2 lessons on vacuous checks and recounts.

### Code the phase changes or sits beside
- `src/analytics/best-effort-utils.ts` — `findBestEffort` (:141, the two-pointer sweep and the
  fractional crossing interpolated between `t[j-1]` and `t[j]` — the exact line PR-06's "interpolate
  a crossing" clause is about), `isPlausible` (:188), `validateStreamSeries` (:80), `markPRs`,
  `rankTopN`.
- `src/analytics/compute-best-efforts.ts` — `computeActivityEfforts` (:111), the three passes marked
  at :235 / :335 / :366, Pass 1's `if (effort.demotion !== null) continue` (:304), Pass 3's CR-01
  excluded-effort sweep (:401-420), the walk-the-document `effortsDemoted` count (:450-462), the
  ceiling-state write (:570-571).
- `src/analytics/best-effort.types.ts` — `ComputedEffort.demotion`'s docblock (:110-129),
  `EffortDemotionGuard` (:82), `BEST_EFFORTS_SCHEMA_VERSION` (:16) and the additive-field precedent
  in `totals.effortsDemoted`'s comment (:225-234).
- `src/analytics/best-effort-ceiling.ts` — `CEILING_K` (:47), `CEILING_MIN_POPULATION` (:67),
  `deriveCeiling`/`deriveCeilings`, `ceilingDemotion`, and the three contracts in the file header
  (pure / one all-time value per distance / called exactly once per run).
- `src/analytics/best-effort-ceiling-state.ts` — `loadCeilingState`, `buildCeilingStateFile`,
  `diffCeilingState`, `formatCeilingMovement`.
- `src/analytics/unreliable-segments.ts` — `UnreliableSegment` (:183, with `parts`, `burstMetres`,
  `gapMetres`, `excessMetres`), `SegmentPart` (:164), `detectUnreliableSegments` (:489).
- `src/analytics/pace-derivation.ts` — **`classifyGapsWithSegments` (:545), the detector's ONE
  permitted accessor** (Phase 33 plan 33-09) — anything needing both coverage and the segments must
  call this, never `classifyGaps` plus `detectUnreliableSegments` separately.
- `src/analytics/pace-single-source.test.ts` — the audit that bans a second implementation and the
  detector's arithmetic literals outside their two permitted files.
- `src/dashboard/data/best-efforts-client.ts:45` — `VALID_DEMOTION_GUARDS`, the allowlist that
  returns `null` for any unlisted guard.
- `src/dashboard/views/records-logic.ts:204` — the per-guard switch and its `other` bucket; :231-251
  `describeDemotions`, the shared sentence with its fixed part order.
- `src/dashboard/views/detail-best-efforts-logic.ts:111-120, :266` — the `demoted` flag, the reason
  passthrough, and the "left out of the ranked PR list" copy.
- `scripts/compute-pr-ceiling-diff.mjs` — **the direct precedent for PR-09**: one
  `computeBestEfforts` run against the real archive with throwaway `statsDir` **and** throwaway
  `ceilingStatePath` so the diff cannot mutate what it describes; OLD semantics reconstructed from
  the NEW document rather than a second sweep; pure exported functions plus a gated `main()`.
- `scripts/compute-pr-ceiling-recount.mjs`, `scripts/compute-elevation-recount.mjs` — the
  never-imports-the-classifier, fails-closed recount pattern for D-13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `findBestEffort` — the single sweep implementation. Reuse it per sub-interval (range parameters or
  slicing); a second copy would trip `pace-single-source.test.ts`.
- `classifyGapsWithSegments` — returns `{ coverage, segments, coveredRuns }` in one call; the only
  sanctioned way to obtain segments alongside coverage.
- `UnreliableSegment.parts[]` — already itemises burst vs gap contributions with indices and
  seconds, which is exactly what D-01's two readings need and what D-07's reason string can quote.
- `ceilingDemotion` / `deriveCeilings` — unchanged by this phase; only their *input population*
  changes.
- `compute-pr-ceiling-diff.mjs`'s throwaway-path pattern — reuse it so PR-09's generator cannot
  mutate the baseline it signs.

### Established Patterns
- Constants carry a docblock stating the measurement they came from and the rule forbidding tuning
  toward a count. No new constant is introduced by this phase (D-04).
- Every calibration generator has a `.test.mjs`, is run twice to prove idempotence, and its prose is
  generated — a hand-edit silently reverts.
- Recount scripts never import the classifier and fail closed.
- Guards are demonstrated red on a planted violation before they may pass (D-03, D-13).
- Additive document fields do not bump `BEST_EFFORTS_SCHEMA_VERSION` (Phase 26 D-14) — D-05 relies
  on this.
- `rejected[]` is one row per demoted effort plus unexpected-error rows; `totals.effortsRejected` is
  `rejected.length`.

### Integration Points
- `computeActivityEfforts` today takes only `t`/`d` and is pure with no I/O — the detector's segments
  must reach it (D-14).
- `data/best-effort-ceiling.json` is **tracked** and rewritten by ordinary local runs (D-11).
- The per-activity best-effort shards feed the detail view; the archive-wide document feeds the
  records view and the Phase 29 queue. `VALID_DEMOTION_GUARDS` sits between the shard and the
  browser and silently drops unlisted guards (D-06, D-17).
- `npm test` (vitest) is the nightly deploy gate — nothing added here may read gitignored or
  owner-editable live files (Phase 31 TD-01; and 28 WR-09's lesson about tests depending on the
  owner-editable exclusions file).

</code_context>

<specifics>
## Specific Ideas

- **Every figure in this document is a reference to reconcile against, never an expected value.**
  Audit each one a plan quotes. The exceptions are ROADMAP criterion 4's own pinned regression
  fixtures — the three scoping activities' 400m efforts at 3:20, 3:21 and 3:22/km today, which the
  probe reproduced exactly.
- **Two test rows in this phase are reachability traps** (both surfaced by measurement, not
  speculation): "splice fabricates a faster window" is false for the naive variant against *today's*
  figure, and false for the d-rebased variant on 3475724402. Check every row for satisfiability in
  **both** directions before relying on it.
- 3475740390 supplies its own multi-segment fixture (four segments inside one 400m window). Do not
  build a synthetic one.
- Planner note: list the D-NN ids in each plan's frontmatter `must_haves.decisions` so the
  decision-coverage gate can see them — it cannot read D-NN from planner XML tags alone.
- Merge origin at least once during the phase (MERGE-01), and **regenerate the signed artifacts
  after the merge** — the archive moves under calibration artifacts, and PR-09's signature is
  against a sha256 of a specific archive snapshot. Sequence the signature after the last merge.
- The reason-string length bound in D-07 connects to the open read/render-cap todo below; whatever
  cap is chosen should be consistent with how the `unreliableSegments` shard list is capped.

</specifics>

<deferred>
## Deferred Ideas

- Review-queue reordering by guard, treatment of moved-but-ranked efforts in the queue, the
  reversible "reviewed and kept" action, and CUR-04 — all Phase 37 (D-17).
- CUR-05 (per-effort override: reject one distance, keep the activity's others) — REQUIREMENTS.md
  line 116 already defers it and notes it becomes less pressing once PR-06/07 move contaminated
  efforts automatically. Revisit after v2.3's queue has been worked through.
- Whether the 439 no-clean-window pairs at 10k/half justify revisiting anything about the rule —
  explicitly **not** reopened here: PR-06 is locked and admits no dilution clause, and adding a
  target-relative excess threshold would introduce a new calibrated constant with its own
  circularity burden. Recorded so a later reader sees it was considered and rejected, with the
  measured population impact.
- STREAM-05/06 (re-deriving streams from the 1 Hz originals) — the quality signals now exist to
  measure whether it would help; several of this phase's findings (the four-segment 400m window, the
  439 lost pairs) would be first evidence.

### Reviewed Todos (not folded)
- "unreliableSegments and impossibleSamples shard lists are capped on write only"
  (`2026-09-23-read-and-render-caps-for-shard-lists.md`, score 0.6) — not folded; it is a
  Phase 33/34 surface. **But** its shape informs D-07's bounded-length constraint, noted above.
- "Pace chart y-axis compressed by pre-pause run-in samples"
  (`2026-09-22-...`, score 0.6) — pace-chart rendering, not the ranking path.
- "validateStreamSeries reads t.length unconditionally — nine call sites still carry the null gap"
  (`2026-09-23-...`, score 0.6) — cross-cutting hardening; 35-02 already fixed the function itself.
  Not this phase's scope, though any new `.mjs` added here must not add a tenth call site.
- "PAUSE-03 remeasurement and recount generators" (`2026-09-23-...`, score 0.4) — Phase 34 scripts.
- "Garmin export adapter when export arrives" (score 0.2) — STREAM-04, still externally blocked.
- "Pauses summary row names the not-classifiable category" (score 0.2) — Phase 34 copy.

</deferred>

---

*Phase: 36-Best-Effort Clean-Window Search & Ceiling Recalibration*
*Context gathered: 2026-09-28*
