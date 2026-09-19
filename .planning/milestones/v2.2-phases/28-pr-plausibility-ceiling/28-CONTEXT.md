# Phase 28: PR Plausibility Ceiling - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A personal plausibility ceiling — derived per target distance from each athlete's own
*already-filtered* effort population, never from the raw archive — demotes-and-flags implausible
efforts out of PR ranking while keeping them visible with the reason they were demoted.
`compute-best-efforts.ts` is restructured into a strict three-pass shape (accumulate → derive
ceiling → filter-and-flag) with no iteration to convergence, so CI output is byte-reproducible. An
archive-wide before/after PR diff is generated from the real archive and signed off by the developer
before the phase closes.

Nothing is recalculated. Per the milestone's own non-goal, **PRs move by demotion, never
recalculation** — `findBestEffort` integrates distance at interpolated crossings, so pace smoothing
is invisible to it, and the only defensible movement is rejecting efforts that should never have
ranked. `data/streams/` stays byte-identical. No effort's `durationSec` or `paceSecPerKm` changes.

Out of scope: the curation review queue and any override/re-admit write path (Phase 29), elevation
quality (Phase 30), and any change to `TARGET_ORDER`.

Requirements: PR-01, PR-02, PR-03, PR-04, PR-05 (5 total).

</domain>

<decisions>
## Implementation Decisions

### Ceiling derivation (PR-02, Criterion 2)

- **D-01:** **The ceiling statistic is delegated to research and planning** (see Claude's Discretion),
  bound by two hard constraints: PR-02's non-circularity rule, and the measurements recorded in
  `<code_context>` below. The developer did not pick a formula; they declined to, having seen the
  measured behaviour of the candidates. The constraint that matters is *structural*
  non-circularity — the statistic must be one the rejected artifacts cannot themselves move — not
  merely "computed over the filtered array".

  **A second circularity, measured during this discussion and NOT named by PR-02, that the chosen
  statistic must avoid.** PR-02 warns against deriving the ceiling from *unfiltered* data. That is
  necessary but not sufficient: a plain **percentile of the filtered population is also
  self-defeating**. At n ≈ 1,800 efforts per distance, p99.5 lands on roughly the 9th-fastest effort
  *by construction*, so it demotes 10/10 of the top-10 at 400m and 1k — but also **9/10 at 5k and
  8/10 at 10k**, which are genuine records (19:39 and 39:44). The tail you want to cut is the same
  tail the percentile consults to decide where to cut. A statistic set by the *bulk* of the
  distribution (a p90-style figure a dozen artifacts cannot move) does not have this property, and
  was measured discriminating correctly; so does a cross-distance projection from a trusted longer
  anchor, though Riegel cannot speak to 400m (outside its calibrated range). Either shape, or a
  hybrid, is open — the *property* is not.

  Rejected as a standalone rule: percentile-of-population, for the measured reason above.

- **D-02:** **Below a stated minimum population, no personal ceiling is derived — the distance keeps
  only the existing world-record + max_speed guard, and that fact is recorded in the output.** This
  is live, not hypothetical: marathon has **0** efforts and half has **105** against ~1,800 at the
  short distances. Fails open rather than inventing a ceiling from a handful of points, and "no
  ceiling was derivable here" is an honest auditable state in the register Phase 26's coverage
  accounting established. Accepted cost: those distances stay as unguarded as they are today.
  Rejected: borrowing a neighbour's ceiling (imports one distance's contamination into another's
  judgment, and at 400m every neighbour is itself contaminated), and failing closed (would empty the
  half-marathon table on a technicality and delete a genuine 1:26:51).

- **D-03:** **The 400m PR table emptying is an accepted outcome, and the empty state must say why.**
  Under any bulk-derived ceiling the whole 400m top-10 goes — even a permissive K=1.50 sits at
  66.6s while the 10th-fastest shipped 400m is 65.5s. These are 400m windows carved out of ordinary
  runs, not track intervals, which is exactly where a ~90s window is most corruptible by one aliased
  distance jump. **This makes the Records-screen empty-state copy a real deliverable of this phase,
  not an afterthought** — a table that renders nothing with no explanation reads as a bug.
  Rejected: dropping 400m from `TARGET_ORDER` (that constant is a contract touching age-grading,
  Riegel's matrix, the detail panel and the shards — far wider than this phase's boundary), and a
  deliberately softer ceiling at 400m (choosing K to yield a non-empty table is tuning to a target
  count, the quota-not-a-claim failure Phase 27's D-02 named).

- **D-04:** **The PR-05 regression fixture pins the LIVE value — 45.2s / 8.85 m/s — not the 44.0s /
  9.09 m/s written in the requirement.** `data/stats/best-efforts.json` computes 45.2s / 8.85 m/s for
  activity 4556693525's 400m; PR-05 and ROADMAP Criterion 3 both state 44.0s / 9.09 m/s. Both values
  are physically impossible and both pass today's guard, so nothing about the requirement's substance
  changes — but a regression fixture must assert what the pipeline actually emits or it fails on day
  one for the wrong reason. **The 44.0/9.09 discrepancy is recorded as a resolved note in
  REQUIREMENTS.md**, following the precedent Phase 27's G-02 set for its stale cohort figure. The
  cause of the drift is unexplained and was deliberately not investigated; a cheap check is welcome
  but must not become an open-ended investigation inside this phase.
  Rejected: investigating the drift before pinning (front-loads an open-ended investigation into a
  phase scoped to the ceiling), and pinning on identity alone without a duration (weakens PR-05's
  "must fail if the ceiling regresses" teeth — a test that only checks rejection cannot notice the
  effort's value drifting underneath it).

### Ceiling stability and drift (PR-01, PR-04, Criterion 1)

- **D-05:** **One all-time ceiling per distance over the whole filtered archive — no time window, no
  per-era segmentation.** Decided on measurement, not preference: 400m p90 moves only 3.30→4.26 m/s
  across fifteen years (±8% around the mean, fittest year only 9% above least fit) while max swings
  3.40→8.85 m/s (160%). **The fitness signal a window would chase is an order of magnitude smaller
  than the artifact signal being rejected.** The sparse early years (2011: 2 efforts, 2013: 6, 2015:
  2) would starve any window narrow enough to be responsive. It is also the simplest shape to make
  deterministic under PR-01 — no window boundary to define, no "as of when" ambiguity in the diff.
  Rejected: a trailing window (introduces a boundary that silently re-judges old efforts as it
  slides — an effort demoted this year and admitted next with no code change), and per-era ceilings
  (contamination *is* era-correlated — all 154 severe stair-step activities are 2020-2021 Suunto 9 —
  so this hands each contaminated era its own inflated ceiling, precisely the circularity PR-02
  exists to prevent).

- **D-06:** **The ceiling is re-derived on every run, persisted into the output, and any movement is
  reported.** Nightly CI regenerates `best-efforts.json` daily, so a silently re-derived ceiling
  could re-admit a demoted effort weeks after the PR-04 review. Re-deriving keeps the ceiling honest
  as the archive grows and keeps the pipeline stateless; **reporting the movement is what satisfies
  PR-04's principle after ship, not just at ship** — a PR that moves and is reported has been seen.
  Rejected: a pinned committed snapshot the pipeline only reads (maximally stable, but it goes stale
  silently as the archive grows — the same failure wearing a different hat — and puts a
  hand-maintained number on the critical path of every future PR judgment), and recomputing silently
  (the one option that lets a record change hands with nobody seeing it, which PR-04 names as a
  milestone failure).

- **D-07:** **The previous run's ceiling state lives in a small committed, machine-written file.**
  `data/stats/` is gitignored and CI starts with it empty, so there is nowhere else durable to diff
  against. CI regenerates the file, diffs against the committed version, reports movement, and
  commits the update — reusing the nightly data-commit path that already exists, with git history
  as the audit trail (every ceiling move becomes a commit that can be blamed). **Two known hazards
  the planner must design around:** this repo's CI auto-commit races against `origin/master`
  (expect non-fast-forward; merge, do not rebase), and quoting a skip-CI token anywhere in a commit
  message silently suppresses the whole daily-refresh run.
  Rejected: reporting within the run only (no new file and no push race, but it cannot answer "did
  this change since you last looked", which is the actual question PR-04 cares about), and a GitHub
  Actions cache/artifact (cache eviction silently turns the drift report into a no-op — a gate that
  fails quiet, which this project has been bitten by before).

### Demotion, never deletion (PR-03, Criterion 4)

- **D-08:** **Every rejection — ceiling, world-record and max_speed alike — becomes a flagged,
  demoted, visible effort carrying its reason, through ONE shared code path.** PR-03's never-delete
  rule is written about the new ceiling, but the existing absolute guard is extended to match.
  Measured basis: **34 efforts across 28 activities are deleted today** (28 of them at 400m, at
  implied speeds of 14.75 to 24.44 m/s — 53 to 88 km/h). They are recorded in `best-efforts.json`'s
  `rejected` array, but **nothing in the dashboard reads that array** (verified by grep) — so the
  archive's most flagrantly broken efforts are the ones that can never be seen. Deleting them is the
  behaviour that made this milestone necessary. One shared path also means one place a future change
  can break the rule, which is Phase 24's `resolveExcluded` lesson (duplicated derivations defeat
  checkpoints).
  Rejected: ceiling-only conversion (leaves two rejection mechanisms with opposite semantics inside
  one function — the divergence shape this project has repeatedly been bitten by — and Criterion 4's
  "no path removes a flagged effort" audit would need an exception carved into it), and
  flag-in-data-but-never-render (PR-03 says "always visible with the reason it was demoted";
  JSON-only visibility is exactly what the `rejected` array already offers and nobody reads).

- **D-09:** **Visible on the activity detail view's Best Efforts panel, plus a note on the Records
  screen naming why a table is short or empty.** The detail panel satisfies Criterion 4 directly
  (which requires the effort be read *in the browser*, not merely present in JSON); the Records note
  puts the explanation where the absence is actually noticed, which D-03's now-empty 400m table
  requires anyway.
  **Known rendering hazard the planner must fix rather than extend:** `detail-sections.ts:339-353`'s
  `buildPrFlagsCell` renders `isPr` and `excluded` into the same `<td>`, and Phase 24's Round 2 R15
  recorded that cell literally rendering `PRExcluded — {reason}`. A third state added to that cell
  without fixing it reproduces the same defect.
  Rejected: detail-panel-only (smallest surface, but the Records screen would show an empty 400m
  table with no explanation anywhere on it), and all three surfaces including an Activities-list
  badge (most discoverable and it makes the demoted cohort browsable, but that is close to Phase
  29's review-queue job, and Phase 27 has just added quality badges to those same rows).

- **D-10:** **A demotion is a SEPARATE field from `excludedFromRecords`, carrying which guard fired
  and why.** They are different claims with different authority: `excludedFromRecords` is the
  owner's stated intent, a demotion is the machine's judgment. **Collapsing them would leave Phase
  29's review queue unable to distinguish "you excluded this" from "the ceiling rejected this",
  which is the exact distinction that queue exists to act on.** It also leaves the
  `resolveExcluded` live-vs-precomputed contract (Phase 24's WR-05/WR-17) completely untouched.
  Rejected: reusing `excludedFromRecords` (zero new fields and every consumer honours it for free —
  rankings, `prCount`, age-grading, the `list.ts:266` badge — but it overwrites the meaning of a
  field that currently means "the owner decided", and a recompute would silently rewrite entries the
  owner did not author), and writing both (least downstream work, but two sources of truth for one
  fact — the divergence mechanism Phase 24's WR-05 and WR-17 were both about).

- **D-11:** **No override / re-admit path ships in this phase — it lands with Phase 29's curation
  review queue.** An override is a write surface and this phase has none; adding one drags
  `curate-server.mjs`, CUR-02's trusted-origin write path and CUR-03's two publish guards into a
  phase whose roadmap entry mentions none of them. PR-03 itself requires only flagged, demoted and
  visible. The milestone's "flagged and overridable" phrasing is satisfied across Phases 28+29
  together, and D-10's separate field is what makes the Phase 29 action possible.
  Rejected: a hand-edited override file this phase (no new write surface and a wrongly-demoted PR
  would be fixable on day one, but it is a second curation file alongside
  `best-effort-exclusions.json` with its own precedence question against the ceiling), and building
  the full override UI here (Phase 29's scope wholesale, in a phase that must also restructure the
  compute chain).

### The archive-wide before/after diff (PR-04, Criterion 5)

- **D-12:** **"A record changing hands" means every top-10 ranking row that moves AND every
  `wasPRAtTheTime` flip, in BOTH directions — demotions and the retroactive promotions they cause.**
  `markPRs` is chronological, so removing one effort re-runs the whole improved-on-best-so-far chain
  behind it. Measured under an illustrative K=1.35 ceiling: **20 efforts demoted, 10
  `wasPRAtTheTime` flags flipped**. The 1mi row is the case that settles this — **one effort
  demoted, two flags flipped, total unchanged at 14**: removing one effort *promoted* a different
  activity into being a PR-at-the-time it never was. A rankings-only diff reports that as "nothing
  happened". These flags feed the Records evolution charts and progression tables, `prCount` on the
  dashboard index (Overview's "Recent PRs"), age-grading, and Riegel's prediction matrix.
  Rejected: rankings-only (compact and literally what "PR diff" suggests, but silently misses every
  historical flag flip), and extending the diff to the derived downstream documents themselves
  (most complete, but mechanically implied by the first two and it widens the deliverable into
  documents this phase does not otherwise touch).

- **D-13:** **A regenerable committed markdown artifact, generated by a dry-run command**, following
  the `26-RESIDUAL.md` / `27-CALIBRATION.md` precedent the developer has twice reviewed and signed
  off. Reviewable in a diff, lands in git history, already a familiar format.
  **The trap to design around explicitly:** Phase 27's G-01 is still open precisely because its
  calibration artifact was not provably regenerable byte-identical. **Idempotence must be a test
  here, not an assumption** — and proved by a second run, not one (a hand-edit to a generated
  artifact whose generator was not fixed reverts silently on the next regeneration).
  Rejected: a CLI dry-run writing nothing (zero staleness, but the review leaves no trace, making
  "reviewed and signed off before the phase closes" unauditable after the fact), and a JSON artifact
  (best for the Criterion 5 reconciliation and trivially assertable, but the human review is the
  actual point of PR-04 and raw JSON is not what gets read).

- **D-14:** **The sign-off lives OUTSIDE the generated artifact, bound to the exact version
  reviewed.** The diff stays purely machine-written; the developer's approval is recorded in the
  phase's validation record, naming the diff's content hash or `generatedAt` stamp. This keeps the
  artifact idempotent (D-13's requirement) while making the approval *verifiable* rather than merely
  asserted, and it matches how this project already records checkpoint verdicts.
  Rejected: a human-edited sign-off block inside the generated file (everything in one place, but it
  makes the file half-generated and half-hand-written, so regeneration either destroys the sign-off
  or the generator must preserve a region it does not own), and treating the git commit as the
  sign-off (nothing extra to maintain, but agents commit in this repo too, so a commit cannot
  distinguish "a human read this" from "a pipeline wrote this" — which is the whole of what PR-04
  requires).

- **D-15:** **Criterion 5's reconciling count is derived by reading the SHIPPED
  `best-efforts.json` and counting demoted efforts directly, WITHOUT importing the ceiling logic.**
  The same classifier-independent discipline as Phase 27's D-03. Two numbers produced by the same
  code agreeing proves only that the code is deterministic — which is Criterion 1's job, not
  Criterion 5's.
  Rejected: same-code-path counts asserted equal (a check that can only agree with itself — the
  exact defect class the roadmap's own browser-checkpoint rationale cites Phase 23's CR-01 for), and
  additionally reconciling a count reachable in the browser (strongest evidence, and it would let
  the checkpoint assert extent rather than internal agreement — but with no demoted-cohort filter
  shipping this phase per D-09, there is no way to reach that count on screen without building one).

### Claude's Discretion

The developer answered every question explicitly and interrogated each recommendation on its own
terms, with one deliberate delegation:

- **The ceiling statistic itself (D-01)** — delegated wholesale to research and planning. Bound by:
  PR-02's non-circularity rule; the structural property D-01 names (the rejected artifacts must not
  be able to move the statistic); the measurements in `<code_context>`; and Phase 27's D-02 rule
  that a threshold tuned until it produces a target count is a quota, not a claim about the data.
  The candidates measured during this discussion (ratio-to-bulk, cross-distance projection via the
  existing `riegel.ts`, or a hybrid where the second acts only as a further-demoting gate) are
  offered as evidence, not as a shortlist to pick from.

What else remains genuinely open, and is left to research and planning:

- **The minimum population threshold in D-02** — what counts as "too thin to derive from", derived
  from mechanism and then measured, with the resulting per-distance coverage reported.
- **The three-pass restructuring's own mechanics.** Today `computeBestEfforts` is a single
  per-activity loop accumulating into `byDistance`, then a per-distance ranking pass. PR-01's
  accumulate → derive → filter-and-flag shape is a restructuring of that function; whether the
  ceiling derivation is a new pure module in `src/analytics/` alongside `best-effort-utils.ts` (and
  therefore unit-testable without file I/O, as `computeActivityEfforts` already is) is an
  architecture call — bound by Phase 26's D-15 purity rule if any of it is imported by the browser.
- **How Criterion 1's determinism is demonstrated failing** — the roadmap specifies "if Pass 2 is
  changed to iterate to convergence"; wiring that mutation is a planning call.
- **How the 662-activity impossible-sample cohort dry-run count (Criterion 3) is reported** and
  where it sits relative to the D-13 diff artifact.
- **The demotion reason's wording register.** Phase 27's D-09 set the house style — a named
  condition with its measured value, never an adjective. `isPlausible`'s existing reasons already
  match it (`implied 14.75 m/s exceeds world-record pace 9.30 m/s`); the ceiling's reason should.
- **Tier/badge styling** for a demoted row against Phase 19's design system, and where the Records
  screen's D-09 note sits.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` § PR plausibility (PR) — PR-01..PR-05, the five requirements this
  phase closes. Note the preamble rule: "Named activities are exemplars, never the scope" — except
  where a specific activity IS the deliverable, which PR-05 states explicitly for 4556693525.
- `.planning/REQUIREMENTS.md` § Curation review queue (CUR) — CUR-01..CUR-03, Phase 29's scope.
  Read to confirm the D-11 override boundary, not to implement.
- `.planning/ROADMAP.md` § Phase 28 — goal, the five success criteria, the browser-checkpoint
  rationale (which cites Phase 23's CR-01 lesson by name).
- `.planning/PROJECT.md` § Current Milestone: v2.2 — in particular the non-goal **"PRs move by
  demotion, never recalculation"**, which is the load-bearing constraint on this phase.

### Prior phase decisions this phase inherits
- `.planning/phases/27-per-activity-quality-signals/27-CONTEXT.md` — D-02 (a threshold tuned to a
  target count is a quota, not a claim), D-03 (the recount must not import the classifier), D-09
  (badge wording register: named condition + measured value, never an adjective), D-18 (browser
  checkpoint hazards: verify the served digest, hard-reload after fixture edits, viewport clamps
  500..941).
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-CONTEXT.md` — D-15
  (`src/analytics/` modules imported by the browser stay pure: no `fs`, no Node builtins), D-14
  (new scalars ride additively on existing documents), D-20 (`pace-fixtures.ts` is the fixture
  library to compose, not rebuild).

### Code contracts this phase must not break
- `src/analytics/compute-best-efforts.ts` — the function being restructured. Lines 88-96 are where
  a rejected effort hits `continue` and is lost; `computeActivityEfforts` is the existing pure seam
  the fixture suite calls without file I/O.
- `src/analytics/best-effort-utils.ts` — `isPlausible`, `markPRs` (chronological, hence D-12's
  ripple), `rankTopN`, `WORLD_RECORD_SPEED_MPS`, `MAX_SPEED_MARGIN`,
  `WORLD_RECORD_100M_SPEED_MPS`.
- `src/analytics/best-effort.types.ts` — `BestEffortsDocument`, `ActivityBestEfforts`,
  `BestEffort`, `RejectedEffort`, `TARGET_ORDER`/`TARGET_METERS` (D-03 forbids changing
  `TARGET_ORDER`), and `BEST_EFFORTS_SCHEMA_VERSION` (bump only via explicit coordinated
  recomputation).
- `src/analytics/best-effort-exclusions.ts` — `isExcluded` / `loadExclusions`; the owner-intent
  path D-10 keeps separate.
- `src/analytics/riegel.ts` — `riegelPredict`, `RIEGEL_STANDARD_B`, `fitRiegelExponent`,
  `selectFitPoints`. Available to D-01's cross-distance option at zero cost.
- `src/compute-all-stats-steps.ts` — `COMPUTE_ALL_STATS_STEPS`, the single source of truth for
  chain ordering (Phase 25's CI-01). `compute-best-efforts` is step 4; steps 5 and 6 read its
  output. Any new step must be declared here, not in `daily-refresh.yml`.

### Downstream consumers (do not break)
- `src/dashboard/views/detail-best-efforts-logic.ts` — `resolveExcluded` (THE single definition of
  "excluded right now", per WR-17), `buildPrBadgeLabels`, `buildBestEffortsPanelRows`. D-09's home.
- `src/dashboard/views/detail-sections.ts:339-353` — `buildPrFlagsCell`, the `PRExcluded — {reason}`
  hazard named in D-09.
- `src/dashboard/views/records-logic.ts` — `buildEvolutionSeries` / `buildProgressionRows`, both
  driven by `wasPRAtTheTime` (D-12's ripple lands here).
- `src/dashboard/views/records.ts` — the rankings tables, superlatives, and the Riegel prediction
  card (`buildRiegelMatrix`, `selectFitPoints` read `rankings`). D-03's empty-400m note lands here.
- `src/dashboard/views/overview.ts:233` — Recent PRs, derived from `row.prCount`.
- `src/analytics/compute-dashboard-index.ts` — writes `prCount`; reads `best-efforts.json`.
- `src/analytics/compute-age-grading.ts` — reads `best-efforts.json`, aligned by index with
  `rankings`.
- `scripts/verify-dashboard-publish.mjs` — hard-requires `best-efforts.json` plus a shard sample
  over HTTP; a blocking gate with no escape hatch by design.

### Prior research
- `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md` — milestone-level research.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`computeActivityEfforts`** (`compute-best-efforts.ts:64`) — already a pure, file-I/O-free seam
  the fixture suite calls directly. The natural place for per-effort flagging.
- **`riegel.ts`** — `riegelPredict`, `fitRiegelExponent`, `selectFitPoints` all shipped and tested;
  cross-distance projection costs nothing to try.
- **`pace-fixtures.ts`** (Phase 26 D-20) — the stratified fixture library, including the pinned
  worked example. ERA-03 says compose it, do not rebuild it.
- **`FileStore.writeJson`** — atomic write; the existing convention for both the archive-wide
  document and the per-activity shards.
- **`26-RESIDUAL.md` / `27-CALIBRATION.md`** — the committed regenerable-markdown deliverable
  pattern D-13 adopts.

### Established patterns that constrain this phase
- **Rejections are currently deleted, not demoted.** `compute-best-efforts.ts:92` — `rejected.push(...)`
  then `continue`, so the effort never enters `activities[id].efforts`. D-08 reverses this.
- **`markPRs` is chronological and re-entrant over the whole population**, so any removal re-runs
  the improved-on-best-so-far chain. This is the mechanism behind D-12's retroactive promotions.
- **`data/stats/` and `data/dashboard/` are gitignored**, regenerated every run, absent from the
  nightly data-commit `file_pattern`. This is why D-07 needs a separate committed file.
- **`COMPUTE_ALL_STATS_STEPS` is the one declaration of chain order** (Phase 25 CI-01) — the
  workflow consumes it rather than hand-maintaining a copy.
- **`resolveExcluded` is the single definition** of live-vs-precomputed exclusion state; D-10 keeps
  it untouched by giving demotion its own field.

### Integration points
- `compute-best-efforts.ts`'s per-activity loop and per-distance ranking pass — the three-pass
  restructuring's home.
- `BestEffort` / `ActivityBestEfforts` — where D-10's demotion field rides additively.
- `buildBestEffortsPanelRows` + `buildPrFlagsCell` — where a demoted row surfaces (D-09).
- `records.ts` — where D-03's empty-table explanation surfaces.
- `COMPUTE_ALL_STATS_STEPS` — where any new dry-run/diff step is declared.

### Measurements taken during this discussion (2026-09-10, re-derivable)

All from `data/stats/best-efforts.json`, filtered population only (activity- and effort-level
exclusions removed). Implied speed = `TARGET_METERS[k] / durationSec`.

**Per-distance distribution (m/s):**

| dist | n | p50 | p90 | p99 | p99.5 | max | max/p90 |
|---|---|---|---|---|---|---|---|
| 400m | 1831 | 3.43 | 4.00 | 5.00 | 6.10 | 8.85 | **2.21** |
| 1k | 1849 | 3.21 | 3.72 | 4.22 | 4.68 | 6.20 | 1.66 |
| 1mi | 1848 | 3.14 | 3.62 | 3.98 | 4.04 | 5.61 | 1.55 |
| 5k | 1786 | 2.99 | 3.39 | 3.70 | 3.76 | 4.24 | 1.25 |
| 10k | 1464 | 2.91 | 3.30 | 3.63 | 3.68 | 4.19 | 1.27 |
| half | 105 | 3.02 | 3.44 | 3.65 | 3.84 | 4.05 | 1.18 |
| marathon | **0** | — | — | — | — | — | — |

`max/p90` separates the clean distances (1.18-1.27, where the records are genuine) from the
contaminated ones (1.55-2.21) — the mechanism signature, since a 400m window (~90s) is corrupted by
one aliased distance jump while a half-marathon window averages it away.

- **Today's 400m guard has zero bite.** `WORLD_RECORD_SPEED_MPS['400m']` = 9.296 m/s; **0 of 1,831**
  400m efforts exceed it. The `max_speed` half is inert too on the pinned case — activity
  4556693525 carries `max_speed: 16.4` m/s (59 km/h), so `16.4 × 1.02` clears an 8.85 m/s effort
  easily. This is the "guard that does not bind".
- **Currently deleted:** 34 efforts across 28 activities (400m 28, 1k 4, 1mi 2; by guard:
  world-record 19, max_speed 15), at implied speeds up to 24.44 m/s. Recorded in the document's
  `rejected` array; **no dashboard code reads it** (verified by grep).
- **Percentile self-defeat:** a p99.5 ceiling demotes 10/10 of the top-10 at 400m and 1k, **9/10 at
  5k and 8/10 at 10k**.
- **Ratio-to-bulk at K=1.35:** demotes 0/10 at 5k, 10k and half; 1/10 at 1mi; 4/10 at 1k; 10/10 at
  400m. K=1.50 still demotes 10/10 at 400m (ceiling 6.01 m/s = 66.6s vs a 10th-fastest of 65.5s).
- **Riegel projected down from the best 10k (2383.9s, b=1.06):** 0/10 demoted at 5k and 10k, 3/10 at
  1mi, 8/10 at 1k; 400m is outside its calibrated range.
- **Per-year stability (400m):** p90 spans 3.30-4.26 across 2011-2026 (±8%); max spans 3.40-8.85
  (160%). Sparse years: 2011 n=2, 2013 n=6, 2015 n=2, 2016 n=11.
- **Simulated diff blast radius at K=1.35:** 20 efforts demoted; **10 `wasPRAtTheTime` flags
  flipped**. Per distance (demoted / flags-now / flags-after / flipped): 400m 15/11/8/5, 1k 4/11/8/3,
  **1mi 1/14/14/2**, 5k 0/21/21/0, 10k 0/16/16/0, half 0/6/6/0. The 1mi row demonstrates a
  retroactive promotion with no net count change.
- **Shipped 400m top-10 for reference:** 45.2s (8.85), 46.5s (8.60), 47.6s (8.40), 54.6s (7.33),
  55.5s (7.21), 57.5s (6.96), 58.2s (6.87), 60.3s (6.63), 62.1s (6.44), 65.5s (6.11).
- **Pinned case 4556693525:** 400m 45.2s (8.85 m/s, `wasPRAtTheTime: true`), 1k 207.4s (4.82),
  1mi 393.8s (4.09), 5k 1498.6s (3.34), 10k 3308s (3.02); `max_speed: 16.4`, `distance: 10130`,
  `moving_time: 3360`. Only the 400m is implausible — the rest of the activity is ordinary, which is
  what makes it a good fixture.

</code_context>

<specifics>
## Specific Ideas

- **The 1mi case is the sentence to carry into the diff design.** One effort demoted, two flags
  flipped, total unchanged: an activity that was never a PR became one. Any diff that cannot
  represent a *promotion* has not understood what "changes hands" means.
- **The register for a demotion reason is already set by the code.** `isPlausible` emits
  `implied 14.75 m/s exceeds world-record pace 9.30 m/s` — a named condition with its measured
  numbers. The ceiling's reason should read the same way, and Phase 27's D-09 says the same thing
  from the other direction: never an adjective.
- **An empty 400m table is a deliverable, not an absence.** D-03's accepted outcome only reads as a
  judgment if the screen says so. "No efforts at this distance passed the plausibility ceiling" is
  the shape; a blank table is the failure.
- **Activity 4556693525 is legible precisely because only one of its five efforts is broken.** The
  1k, 1mi, 5k and 10k are ordinary. A fixture whose whole activity is nonsense proves less.
- **PR-05's cohort framing:** 662 activities (36%) carry at least one sample faster than the 100m
  world record, and `WORLD_RECORD_100M_SPEED_MPS` (10.44) is already exported from
  `best-effort-utils.ts` specifically for that per-sample check — it is not a best-effort target and
  must not become one.

</specifics>

<deferred>
## Deferred Ideas

- **The override / re-admit action** — decided under D-11, deferred to Phase 29's curation review
  queue, which already owns the trusted-origin write path (CUR-02) and both publish guards
  (CUR-03). D-10's separate demotion field is the hook that makes it possible.
- **A demoted-cohort filter on the Activities list** — considered under D-09 and under D-15's
  browser-reconciliation option. It would let a checkpoint assert reachable extent rather than
  internal agreement (the Phase 23 CR-01 lesson), but it is close to Phase 29's queue job and
  Phase 27 has just added quality badges to those same rows. Phase 29 is the natural place.
- **Investigating the 44.0s → 45.2s fixture drift** — noted under D-04, deliberately not pursued
  here. The number is reconciled by pinning the live value and recording the discrepancy; the
  *cause* remains unexplained and is a fair candidate for a todo.
- **Extending the diff to derived downstream documents** (age-grading entries, Riegel predictions,
  `prCount`) — considered under D-12. Mechanically implied by the rankings + flag-flip diff, and it
  would widen the deliverable into documents this phase does not otherwise touch.
- **Dropping 400m from `TARGET_ORDER`** — considered and rejected under D-03. If the 400m table
  stays permanently empty across future milestones, revisit it then as a deliberate contract change
  with its own phase.

### Reviewed Todos (not folded)

Both keyword matches from `todo.match-phase 28` were reviewed and deliberately not folded — both
were already routed elsewhere by prior phases, and those routings still hold:

- **IN-17 / IN-18 curation-guard cosmetics**
  (`2026-09-02-in17-in18-curation-guard-cosmetics.md`, score 0.6) — `scripts/lib/curation-guard.mjs`
  polish. Already assigned to Phase 29 in `27-CONTEXT.md`, which is the next phase to touch the
  curation guard and already carries a criterion asserting both publish guards discriminate in both
  directions. Phase 28 does not touch the guard at all.
- **Garmin export adapter when export arrives**
  (`2026-08-10-garmin-export-adapter-when-export-arrives.md`, score 0.2, STREAM-04) — externally
  blocked on the export arriving, and a stream *ingestion* change, which this milestone's
  "`data/streams/` stays byte-identical" non-goal explicitly forbids. Declined for Phases 26 and 27
  on the same grounds; carried in STATE.md as a next-milestone item.

</deferred>

---

*Phase: 28-PR Plausibility Ceiling*
*Context gathered: 2026-09-10*
