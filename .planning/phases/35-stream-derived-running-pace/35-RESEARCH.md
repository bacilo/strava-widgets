# Phase 35: Stream-Derived Running Pace - Research

**Researched:** 2026-09-24
**Domain:** Extending an existing pure-function pace-derivation module (`pace-derivation.ts`) with a
second headline pace quantity, and retargeting an existing disputed-pace comparator/badge/rebase
chain to it — no new runtime dependency, no new architectural tier.
**Confidence:** HIGH for the code-shape findings below (all read directly from the committed
source tree this session); MEDIUM for the D-08 boundary-handling question, which is genuinely open
and argued from first principles, not resolved.

## Summary

Phase 35 is not a greenfield feature — it is "which existing pattern applies, and what does it
cost" applied to three already-shipped mechanisms: `detectPaceDisagreement`'s comparator/threshold
pair, `derivePaceWithCoverage`'s exact-second coverage ledger, and the calibration-with-HALT
machinery Phases 32/34 already built and exercised three times. The phase's hardest question
(D-08's running-pace definition) has no committed precedent to copy — `PaceCoverage` currently
tracks only **seconds** (`spanSec`/`coveredSec`/`recordingGapSec`/`pauseSec`/`unreliableSec`), never
metres, so a new metres accounting must be added regardless of which reading D-08 settles on. The
safest reading, argued below, reuses the exact same `pairKinds`/`coveredRuns` partition that already
proves the COV-01/COV-03 four-term identity, because it is structurally impossible for that reading
to disagree with `coverage.coveredSec` — the two numbers are two views of the same partition, not
two independent computations that happen to agree today.

The second load-bearing finding is architectural, not mathematical: **today's `compute-dashboard-
index.ts` only reads an activity's stream for `paceDisagreement` when `metadataPaceSecPerKm < 200`**
(the old 3:20/km implausibility gate). RPACE-01 requires a running pace for *every* activity with a
computable stream — 3475724402's own metadata pace is 296.0 s/km (4:56/km), which is *slower* than
the 200 s/km gate, so today's read path would never even open its stream file. This is not a
threshold tweak inside `detectPaceDisagreement`; it changes which activities get a stream read at
all in the CI compute chain, and that read should very likely be folded into the *already-
unconditional* stream read the quality-signal block performs two dozen lines below it, not added as
a third gated read.

The third load-bearing finding is that D-05's calibration commits to the full HALT-capable machinery
Phases 32 and 34 already built, tested and (in 34's case) exercised through three real HALTs. That
machinery is a large, working, copy-a-pattern asset (`scripts/compute-pause-classification-
calibration.mjs` + its `.test.mjs`, 2,980/1,545/~2,600 lines respectively across the three sibling
generators) — the planner's job is to instantiate its shape (pre-declared statistics, a
must-fail strawman, D-13 insensitivity with proportional planting, first-clearing arbitration, a
`## NO SHAPE CLEARS` HALT branch), not invent a new one.

**Primary recommendation:** add one new exported function to `pace-derivation.ts` — call it
`deriveRunningPace(stream)` or similar — that reuses `classifyGapsWithSegments`'s existing
`coveredRuns` output (index-based, already computed, already proven to partition the stream
exactly) to sum covered metres, divides by the existing `coverage.coveredSec`, and returns both the
pace and the excluded metres/seconds so the detail view's disclosure sentence and the coverage
caption can never disagree. Retarget `detectPaceDisagreement` to compare against this new quantity
instead of `streamPaceSecPerKm`, replace the eligibility gate (currently `metadataPace < 200`) with
one that keeps 3475724402 in reach without conflating mechanism (b) (`elapsedVsMoving`'s territory),
and run the full D-05 calibration to select the disagreement threshold — arguing every candidate
shape from first principles, never from the CONTEXT.md probe figures.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — REPLACE, one comparator, not two.** `detectPaceDisagreement` compares metadata pace
  against the **running pace**; the span-based `streamPaceSecPerKm` rule is retired as the disputed
  comparator. `streamPaceSecPerKm` itself is used by nothing else in `src/` outside
  `detectPaceDisagreement` (verified by grep, 2026-09-23, re-confirmed this session — see Code
  Examples). 5059204779's stream-derived figure of record moves from 5:51/km (350.6) to 5:56/km
  (355.8, per the throwaway probe — a reference, not an expectation); this is a disclosed known
  consequence, not a defect to avoid.
- **D-05 — FULL CALIBRATION with a HALT contract. The declare-up-front shortcut is REJECTED for
  this constant.** Candidate statistic shapes pre-declared in plan text with a written
  non-circularity argument BEFORE any measurement; a deliberately circular strawman measured first
  and must FAIL; D-13 insensitivity at a fixed 1% tolerance (`ceil(0.01 × N)` proportional planting,
  never widened); every plant enters the population its shape actually reads, tested; first-clearing
  arbitration (archive-wide badged count is a reported finding, never a selector); if no shape
  clears, the plan commits a NO SHAPE CLEARS artifact and HALTs for the developer. The probe figures
  in 35-CONTEXT.md are contaminated context — never pinned as expected values, success criteria, or
  fixture targets.
- **D-09 — the splits rebase FOLLOWS the badge, exactly as Phase 26's D-13 wrote it**, now rebasing
  to the running pace instead of the old span-based figure. Known consequence: the rebased
  population grows from 1 activity to order ~20-45; MUST be read back at the human browser
  checkpoint against a value derived outside the changed code.
- **D-11 — Phase 35 records its own half of SEG-05b**, proven load-bearing by the 33 D-15 / 34 D-01
  stub-the-detector shape on a named activity, not "the import exists." The row re-ticks only after
  Phase 36 records its half too; Phase 35 must not tick it.

### Claude's Discretion

Each bound by the constraints stated in its own CONTEXT.md decision — do not re-litigate the bound,
only the open choice:

- **D-02** — the eligibility gate replacing the retired 3:20/km implausibility gate. MUST keep
  3475724402 reachable; MUST be stated in the calibration artifact with its own non-circularity
  argument; whatever population it excludes MUST be named with its measured count, never silently
  dropped.
- **D-03** — badge reach across list surfaces vs. detail view. Hard rule: no surface may disagree
  with another about whether a given activity's pace is disputed.
- **D-04** — how the shipped `paceDisagreement.streamPaceSecPerKm` field name and the 5:51/km figure
  of record are handled. Bound by: a shipped field's name must match what it holds (33 D-11
  precedent); any figure of record that moves gets a dated in-place amendment, never a silent
  overwrite (32 D-03 / 33 D-12 / 34 D-02 pattern).
- **D-06** — threshold direction (symmetric vs. slower-only). Whichever direction ships is stated in
  the calibration artifact; the measured count on the other side is reported as a finding, never
  silently dropped.
- **D-07** — statistic family (ratio, absolute Δ sec/km, or both), subject to D-05's
  pre-declaration-before-measurement rule.
- **D-08** — the exact running-pace computation and its boundary rule. See § Architecture Patterns
  below for the trade-off this research surfaces without picking a side.
- **D-10** — rendering placement, conditionality, and copy for the running pace and its exclusions
  line. Bound by: RPACE-02's "plain statement of what was excluded" is explicit, not optional;
  ROADMAP criterion 2 requires the two figures to visibly differ on 3475724402; ROADMAP criterion 4
  keeps lists/stats/widgets byte-identical.
- The calibration artifact's filename and generator/recount script names, following the
  `32-CALIBRATION.md`/`33-CALIBRATION.md`/`34-CALIBRATION.md` and
  `compute-*-calibration.mjs`/`compute-*-recount.mjs` naming precedent.
- Whether the running pace and its exclusions ship as index-row scalars, in the lazy quality shard,
  or both — additive only, `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`.
- The disposition of `streamPaceSecPerKm` once it is no longer the disputed comparator.

### Deferred Ideas (OUT OF SCOPE)

- Splitting the disputed badge into two named claims (distance-off-the-clock vs. moving-time
  divergence). D-01 commits to one badge.
- Surfacing the running pace outside the detail view (list rows, stats documents, widgets) —
  explicitly barred by ROADMAP criterion 4.
- A "stopped time removed" pace (STOP-04, out of milestone).
- Reconciling the running pace against device `moving_time` as its own signal — negative-Δ
  activities belong to `elapsedVsMoving`'s territory, not RPACE's, and are out of this phase.
- Best-effort partitioning/demotion/ceiling diff (Phase 36); review-queue priority and CUR-04
  (Phase 37); pause-class tinting; any change to Phase 33's pace-chart clipping or Phase 34's Pauses
  section.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| RPACE-01 | A stream-derived running pace (unreliable segments and gaps excluded from both distance and time) is computed for every activity with a computable stream, through the existing single pace-derivation module. | § Architecture Patterns (Pattern 1, the new `deriveRunningPace` function and its metres accounting); § Common Pitfalls (the gated-read defect in `compute-dashboard-index.ts`); § Don't Hand-Roll ("computable stream" definition already exists in `pace-quality.ts`'s not-computable pattern). |
| RPACE-02 | The activity detail view shows the running pace beside the metadata pace with a plain statement of what was excluded (metres and seconds). Metadata pace and device `moving_time` remain the shipped aggregate everywhere else. | § Architecture Patterns (Pattern 2, detail.ts/detail-sections.ts integration points); § Code Examples (existing Pace stat card / splits rebase call sites). |
| RPACE-03 | The existing "Pace disputed" badge is raised when the two figures disagree materially, under a threshold calibrated against the archive and recorded. | § Validation Architecture; § Common Pitfalls (Pitfall 1, the retired gate); the full D-05 calibration-machinery walkthrough in § Architecture Patterns Pattern 3. |
| SEG-05b (Phase 35 half) | The detector is the single source; Phase 35 records its own half by proving the running-pace computation reads the detector's output through `pace-derivation.ts`, load-bearing, not by import. | § Code Examples (the stub-the-detector proof pattern from `pace-single-source.test.ts`). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Running-pace computation (metres/seconds accounting, gap+unreliable exclusion) | API/Backend (CI compute chain, `compute-dashboard-index.ts`) | Browser (dashboard render path, `detail.ts` calling `derivePaceWithCoverage`/the new function directly for the detail view's own on-demand render) | `pace-derivation.ts` is explicitly dual-imported by both the CI writer and the browser render path (its own docblock, line 5-8) — this is the established pattern for every prior pace quantity (PACE-01..09), not new to this phase. |
| Disagreement detection (`detectPaceDisagreement`) | API/Backend | — | Runs once per activity in `compute-dashboard-index.ts`; the result is a precomputed row field (`paceDisagreement`), never recomputed client-side (mirrors PACE-07's existing shape). |
| Calibration (threshold, eligibility gate) | Build-time script (`scripts/compute-*-calibration.mjs`) | — | Node-only, reads `data/streams/*.json` directly; outside both browser and CI-index tiers, matching every prior Phase 32/33/34 calibration artifact. |
| Detail-view disclosure (running pace + exclusions sentence, badge, splits rebase) | Browser (dashboard render path) | — | All three already live in `src/dashboard/views/detail.ts` / `detail-sections.ts` / `list.ts`; this phase extends, does not relocate, that rendering tier. |
| List-surface badge reach (D-03) | Browser (dashboard render path) | — | `appendStatusBadges` in `list.ts` is the one dispatch point for all four list surfaces; widening reach is a call-site change there, not a new tier. |

## Standard Stack

No new runtime dependency (`.planning/research/STACK.md`, confirmed unchanged this session — v2.3
introduces zero new `package.json` entries; every algorithm this phase needs extends an existing
hand-rolled function, `quantile`/`classifyGapsWithSegments`, both already in `pace-derivation.ts`).

### Core (existing, reused)
| Module | Purpose in Phase 35 | Why standard here |
|--------|---------------------|--------------------|
| `src/analytics/pace-derivation.ts` | Home for the new running-pace function (D-08's "computed through the existing single pace-derivation module" requirement); home of `detectPaceDisagreement`/`PaceDisagreementResult` (D-01's retarget); home of `classifyGapsWithSegments`/`CoveredRun`/`PaceCoverage` (the reusable coverage machinery). | The one module every stream-derived pace quantity in this codebase is required to pass through (`pace-single-source.test.ts`'s whole purpose). |
| `src/analytics/pace-quality.ts` | Template for "computable stream" / not-computable disclosure (`notComputableReason`, never a fabricated `'none'`); template for the shard-vs-row-scalar decision (D-10 discretion). | Established pattern for every prior "does this activity have a usable stream" question in this codebase. |
| `src/analytics/compute-dashboard-index.ts` | Write end — computes `paceDisagreement` today; needs its stream-read gating changed (see Pitfall 1) and a new row/shard field for the running pace + exclusions. | The one CI writer for `data/dashboard/index.json`; every prior pace/quality signal was added here. |
| `src/dashboard/views/detail.ts`, `detail-sections.ts`, `list.ts` | Detail-view disclosure, splits rebase, badge dispatch. | Established rendering surfaces named explicitly in CONTEXT.md's canonical refs; see § Architecture Patterns Pattern 2 for the exact call sites. |
| `scripts/compute-*-calibration.mjs` pattern (e.g. `compute-pause-classification-calibration.mjs`) | Template for the new `compute-<name>-calibration.mjs` this phase's D-05 requires. | The one calibration shape this codebase has now exercised three times (32, 33, 34), including three real HALTs — copying it is lower-risk than inventing a fourth shape. |

### Supporting
None beyond the above — this phase adds zero new files' worth of *concepts*, only new functions
inside already-established modules, following the codebase's own STACK.md guidance ("every
algorithm needed extends an existing hand-rolled function").

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Reusing `classifyGapsWithSegments`'s `coveredRuns` for the running-pace numerator | A fresh independent re-scan of `gapIntervals`' real-second boundaries | The fresh re-scan risks re-deriving a SECOND boundary convention alongside the index-based one `coveredRuns` already uses — exactly the defect shape 32-13/32-17 fixed (two disagreeing gap-boundary conventions silently dropping seconds). See § Architecture Patterns Pattern 1 for the full argument. |
| A new `compute-*-calibration.mjs` generator | Extending `compute-unreliable-segment-severity-calibration.mjs` or `compute-pause-classification-calibration.mjs` in place | Rejected: those generators are already 1,500-3,000 lines and scoped to a different constant family (severity tiers, pause bands) with their own pre-declared shapes; RPACE-03's threshold is a structurally different question (metadata-vs-running-pace disagreement, not segment/pause classification) and deserves its own artifact, matching the one-artifact-per-constant-family precedent every prior phase set. |

**Installation:** none — no `npm install` step for this phase.

**Version verification:** N/A — no new package. Existing stack versions (TypeScript ^5.9.3, vitest
^4.0.18, Node 22) confirmed unchanged in `.planning/research/STACK.md`, dated 2026-09-19, still
current for this milestone.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. `.planning/research/STACK.md` confirms
zero new `package.json` entries for the whole v2.3 milestone, and Phase 35 introduces none either.

## Architecture Patterns

### System Architecture Diagram

```
                    CI compute chain (build-time, Node)
  ┌──────────────────────────────────────────────────────────────────────┐
  │  compute-dashboard-index.ts (per activity, one pass)                  │
  │                                                                        │
  │  activity.json ──► metadataPaceSecPerKm = movingTime/(distance/1000)  │
  │                                                                        │
  │  data/streams/{id}.json ──► CanonicalStream (t[], d[])                │
  │       │                                                                │
  │       ▼                                                                │
  │  pace-derivation.ts: classifyGapsWithSegments(t, d)                   │
  │       │  (runs detectUnreliableSegments internally — SEG-05b)         │
  │       ▼                                                                │
  │  { coverage: PaceCoverage, segments[], coveredRuns[] }                │
  │       │                                                                │
  │       ├──► NEW: deriveRunningPace-shaped function                     │
  │       │      sums covered metres over coveredRuns,                    │
  │       │      divides by coverage.coveredSec                           │
  │       │      → { runningPaceSecPerKm, excludedM, excludedSec }        │
  │       │                                                                │
  │       └──► detectPaceDisagreement(metadataPace, runningPace, gate)    │
  │              → PaceDisagreement | null   (RETARGETED, D-01)           │
  │                                                                        │
  │  row.paceDisagreement = ...  ─┐                                       │
  │  row.<new running-pace field> ┴─► data/dashboard/index.json           │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  (fetched once per opened detail view)
                    Browser render path (detail.ts)
  ┌──────────────────────────────────────────────────────────────────────┐
  │  indexClient.getRow(id).paceDisagreement  ──► badge on Pace stat card │
  │  indexClient.getRow(id).<running pace field> ──► disclosure sentence  │
  │  disagreement !== null ──► rebasedAveragePaceSecPerKm (D-09)          │
  │       │                                                                │
  │       ▼                                                                │
  │  buildSplitsSection(splits, rebasedAveragePaceSecPerKm, ..., true)    │
  │                                                                        │
  │  list.ts: appendStatusBadges() ──► all 4 list surfaces (D-03 reach)   │
  └──────────────────────────────────────────────────────────────────────┘

                    Build-time-only calibration (Node script, not shipped)
  ┌──────────────────────────────────────────────────────────────────────┐
  │  scripts/compute-<name>-calibration.mjs                               │
  │    reads every data/streams/*.json directly (own loadArchive)         │
  │    imports pace-derivation.ts's running-pace function (same one CI    │
  │    writer uses) + a from-scratch metadataPace read                    │
  │    runs pre-declared shapes, strawman-first, D-13 insensitivity       │
  │    → writes 35-CALIBRATION.md (or NO SHAPE CLEARS + HALT)             │
  └──────────────────────────────────────────────────────────────────────┘
```

A reader tracing 3475724402's badge end to end: `activity.json` (moving_time/distance) → CI reads
`data/streams/3475724402.json` unconditionally (not gated by the old 200 s/km threshold, see
Pitfall 1) → `classifyGapsWithSegments` → the new running-pace function → `detectPaceDisagreement`
→ `row.paceDisagreement` written to `index.json` → `detail.ts` reads it → badge + disclosure
sentence + rebased splits, all sourced from the same `PaceDisagreement` object.

### Recommended Project Structure

No new directories or files beyond the calibration artifact/generator pair. Everything else is a
function added to, or a call-site changed in, an already-existing file:

```
src/analytics/
├── pace-derivation.ts        # + new running-pace function, retargeted detectPaceDisagreement
├── compute-dashboard-index.ts # gating change (Pitfall 1) + new row/shard field
├── dashboard-index.types.ts   # additive PaceDisagreement / DashboardIndexRow field (D-10)
└── pace-single-source.test.ts # extended: new running-pace function must be the ONE implementation

src/dashboard/views/
├── detail.ts                  # disclosure sentence + rebase call-site (already D-09-shaped)
├── detail-sections.ts         # buildSplitsSection's isRebasedAverage note text (D-04 field name)
└── list.ts                    # paceDisputedExplanation copy (D-06 sign), badge reach (D-03)

scripts/
├── compute-<name>-calibration.mjs       # NEW — D-05's full HALT-capable calibration
├── compute-<name>-calibration.test.mjs  # NEW — strawman-must-fail, D-13 insensitivity, idempotence
└── compute-<name>-recount.mjs (+ .test.mjs)  # NEW — D-08's zero-import independent recount

.planning/phases/35-stream-derived-running-pace/
└── 35-CALIBRATION.md          # NEW — generated artifact, regenerated twice, byte-identical
```

### Pattern 1: The running-pace computation (D-08) — two candidate readings, argued, not chosen

**What `PaceCoverage` already gives you, and what it does not:** `classifyGapsWithSegments` returns
`{ coverage: PaceCoverage, segments: UnreliableSegment[], coveredRuns: CoveredRun[] }`.
`PaceCoverage` tracks four **second** totals (`coveredSec`/`recordingGapSec`/`pauseSec`/
`unreliableSec`) that sum exactly to `spanSec` — proven exact by COV-01/COV-03 across the whole
archive. It tracks **zero metres**. `coveredRuns: CoveredRun[]` gives `{ startIndex, endIndex }`
pairs over the pair-index space (pair `i` spans samples `t[i]..t[i+1]`) — this is already the exact
same final `pairKinds` partition that produced `coveredSec`, just expressed as index ranges instead
of a second total.

**Reading A — reuse `coveredRuns` directly (index-based numerator, `coveredSec` denominator):**

```typescript
// Illustrative, not a verbatim existing function — pace-derivation.ts's own shape:
function coveredMetres(d: readonly number[], coveredRuns: readonly CoveredRun[]): number {
  let metres = 0;
  for (const run of coveredRuns) {
    metres += d[run.endIndex] - d[run.startIndex];
  }
  return metres;
}
// runningPaceSecPerKm = coverage.coveredSec / (coveredMetres(d, coveredRuns) / 1000)
```

Because `coveredRuns` and `coverage.coveredSec` are two views of the *identical* final `pairKinds`
array (`classifyGapsWithSegments`'s own docblock, lines 596-600: `coveredRuns` is "derived from the
SAME final pairKinds array finalAcc was summed from — no second classification pass"), this reading
is **structurally guaranteed** to reconcile with the coverage caption's `coveredSec` term — there is
no code path by which the numerator and denominator could describe different sets of samples. A
zero-import recount (D-08's requirement) is straightforward: independently re-classify pairs
(mirroring `compute-unreliable-segment-recount.mjs`'s existing gap-first, detector-free traversal)
and sum `d`-deltas over the pairs it independently judges "covered." Boundary handling is a
non-issue under this reading: every `[t[i], t[i+1]]` pair belongs to exactly one kind by
construction (`classifyPairKinds`'s pass-1 priority list, and pass 3's index-based, not
float-boundary-based, segment overwrite) — no pair can ever "straddle" two categories, because the
classification never splits a pair.

**Reading B — "whole-step exclusion" computed independently of `coveredRuns`:** subtract excluded
metres/seconds using `gapIntervals`' real-second `{ startSec, endSec }` boundaries directly (e.g.
`totalMetres - Σ(interpolated distance at each gapInterval's edges)`, or a fresh per-sample
inclusion test against those boundaries rather than reusing the index-based `coveredRuns` list).
This is the reading D-08's own text calls "simplest to recount" — subtracting a few named intervals
from totals reads simpler than summing runs — but it risks **re-deriving a second boundary
convention** alongside `coveredRuns`' index-based one. That is the *exact* defect shape this
codebase has fixed twice before: 32-13's `mapGapToIndices`/`isGapPair` used two disagreeing
gap-boundary index conventions and silently dropped a gap's own metres/seconds when a duplicate
timestamp landed exactly on a boundary (SEG-02's own reopened-and-closed history, `REQUIREMENTS.md`
line 23). Concretely: `GapInterval.startSec`/`endSec` in the current code ARE always exact sample
times (`accumulateCoverage` sets `openStartSec = t[i]`, never an interpolated value), so in the
*current* architecture Reading B's boundaries coincide with Reading A's pair boundaries — but only
if the independent implementation is careful to use `>=`/`<` membership consistently with how
`coveredRuns` itself was built. A careless re-implementation (e.g. `<=`/`<` vs. `<`/`<=` at one
edge) is the kind of one-character defect that has previously survived to a reopened requirement.

**Consequence for the four named activities (probe figures — reference to reconcile against, NEVER
an expected value, per the contamination guard):** 3475724402's probe reading excluded 2,253 m /
797 s; 5059204779 excluded only 166 m / 3 s despite a huge second-axis Δ (mechanism (b) — moving-
time divergence with almost no distance withheld). Under EITHER reading, an activity like
3475742397 (0 m / 1,211 s excluded per the probe) will show a running pace that moved almost
entirely on the denominator, not the numerator — worth a boundary-case test specifically for "an
activity whose excluded metres round to 0 but excluded seconds are large," since Reading A's
`d[run.endIndex] - d[run.startIndex]` sum could plausibly diverge from a naive Reading B
implementation exactly at the edges of such a run.

**Recommendation for the planner to pre-declare (not lock in this research):** Reading A is the
lower-risk starting point because it is structurally reconciling by construction and reuses an
already-computed, already-tested field (`coveredRuns` ships today, unused by any caller — verified
by grep, no `src/` file reads `coveredRuns` outside `pace-quality.ts`'s own `resolveCoverage`/
`buildPaceQualityShard`). If Reading B is chosen instead for a stated reason, D-08's own boundary
test requirement should specifically assert Reading B's metres/seconds numerator/denominator against
Reading A's (or a from-scratch recount) at exactly this edge case — an activity with near-zero
excluded metres but large excluded seconds — as its own pinned regression, not merely a general
smoke test.

### Pattern 2: Detail-view integration (RPACE-02, D-09, D-10)

Existing call sites, unchanged in shape, to extend:

- `detail.ts:668-671` — `paceSecPerKm` (metadata) computed from `activity.distance`/
  `activity.moving_time`, **untouched by this phase** (ROADMAP criterion 4).
- `detail.ts:679` — `disagreement = indexClient.getRow(detail.id)?.paceDisagreement ?? null`. This
  read pattern (optional-chained, tolerant of a re-parsed row missing the key) is the template for
  reading whatever new field D-10 adds for the running pace + exclusions.
- `detail.ts:683-698` — the Pace stat card. `appendAccessibleBadge` already attaches the disputed
  disclosure as the card's third child when `disagreement !== null`; D-10's "existing Pace stat card
  ... established template" refers to this exact block. A second, always-on running-pace value
  (per COV-02's "a term that disappears at zero stops meaning zero and starts meaning unknown"
  precedent — D-10 explicitly invokes this) most naturally either extends this same card or becomes
  a sibling `buildStatCard` call (the stat-grid auto-fit reflow already tolerates a variable card
  count — see the conditional `gearLabel` card immediately below at `:739-741` for the precedent).
- `detail.ts:800` — `const derived = derivePaceWithCoverage(detail.stream)` — this ALREADY computes
  `coverage` (including `gapIntervals`) client-side for the chart/histogram/splits-gap-annotation
  path. If the running-pace computation is added as a small pure function taking `(stream,
  coverage, coveredRuns)` rather than re-deriving coverage itself, the detail view's OWN render path
  can compute the running pace from data it already has in scope here, without a second
  `classifyGapsWithSegments` call — worth flagging to the planner as a possible reason to prefer a
  helper function over one that re-derives coverage internally, IF the detail view is ever expected
  to compute the running pace client-side rather than solely reading a precomputed index-row field.
  (Given ROADMAP criterion 4 keeps this a single detail-view-only figure and D-10 leaves shard-vs-
  row scalar to discretion, either the CI-precomputed-field path or the client-recompute path is
  viable; the precomputed-field path avoids a third `classifyGapsWithSegments` call per detail-view
  open and matches how `paceDisagreement` itself already ships as a precomputed field.)
- `detail.ts:809` — `rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.streamPaceSecPerKm : paceSecPerKm`.
  Under D-01 this field name (`streamPaceSecPerKm`) is D-04's discretion — whatever it is renamed
  to (or not), this line's RHS must read the running-pace value once `PaceDisagreementResult`'s
  shape changes.
- `detail.ts:812-817` — `buildSplitsSection(splits, rebasedAveragePaceSecPerKm, ..., disagreement !== null)`
  — unchanged call shape; D-09 requires this call to fire on the widened badge population
  automatically, since it is a one-line conditional on `disagreement !== null`.
- `detail-sections.ts:427-430` — the `isRebasedAverage` disclosure note: `"Splits above are compared
  against the stream-derived average (...), not the disputed metadata average."` This text is a
  correctness claim (per 33 D-11's precedent: copy that stops describing its own number is a
  correctness fix, not cosmetics) — it currently says "stream-derived," which remains accurate
  under D-01 (the RHS value is still stream-derived, just via a different comparator), but should be
  re-read once D-04 settles the field's final name.
- `list.ts:308` — `paceDisputedExplanation`: `` `Metadata pace disagrees with the stream-derived
  pace: ${formatPace(disagreement.streamPaceSecPerKm)} measured vs. ${formatPace(disagreement.metadataPaceSecPerKm)} shown` ``
  — under D-01 the first figure's *meaning* changes (running pace, not span pace); under D-06 (if
  symmetric direction ships) the sentence may need a sign so a reader isn't misled about which way
  the pace moved. This is the ONE definition both the row badge and the detail stat-card badge read
  from (33 D-11 / 26-08 precedent) — changing it here changes both surfaces atomically, which is the
  point.
- `list.ts:710-719` (`appendStatusBadges`) and `:705-707`'s docblock — the ONE dispatch point for all
  four `RowSurface` values. D-03's reach decision is a change here (or explicitly NOT here, if the
  developer's discretion keeps detail-view-only reach — CONTEXT.md flags this as needing "an
  explicit argument" per Phase 24's D-04 duplicated-derivation lesson).

### Anti-Patterns to Avoid

- **A second running-pace implementation outside `pace-derivation.ts`.** `pace-single-source.test.ts`'s
  `BANNED_LITERALS` scanner currently only bans the two *old* per-sample division literals
  (`'dt / (dd / 1000)'`, `'elapsed / (metres / 1000)'`) — it has **no rule yet that would catch a
  new running-pace formula reimplemented inline in `detail.ts` or `compute-dashboard-index.ts`**.
  If the running-pace arithmetic is exposed as a function from `pace-derivation.ts` and every
  consumer calls it, the existing `ALLOWED_FILE_SUFFIX` discipline covers it structurally. If any
  call site instead inlines the metres/seconds division itself, the audit will not catch a drifted
  duplicate — the planner should either extend `BANNED_LITERALS`/`DETECTOR_ARITHMETIC_LITERALS`-style
  scanning to the new formula's literal shape, or ensure by construction (one function, every
  consumer imports it) that no second copy can exist to drift.
- **Re-gating the stream read behind the retired 200 s/km threshold.** See Pitfall 1 below — this
  is the single most consequential implementation mistake available in this phase.
- **Computing the running pace from `derivePaceSeriesGapAware`'s windowed series.** D-08's own text
  rules this out explicitly: a time-weighted mean of windowed per-sample paces cannot reconcile
  against a metres-over-seconds recount (the windows overlap, are centred, and are a different
  partition than `coveredRuns`).
- **A second, disagreeing gap-boundary convention.** See Pattern 1, Reading B's risk — this is a
  proven, twice-fixed defect shape in this exact codebase (32-13/32-17), not a hypothetical.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Percentile/quantile arithmetic for the D-05 calibration shapes | A new percentile implementation | `quantile` (`pace-derivation.ts:225`) — the ONE percentile definition, explicitly required to be reused ("the calibration shapes reuse it, never a third," CONTEXT.md canonical refs) | A second percentile definition (nearest-rank vs. R-7 interpolation) silently disagrees at small N — exactly the kind of drift this codebase's own conventions forbid. |
| "Is this stream usable at all" / not-computable classification | A new predicate | `validateStreamSeries` (`best-effort-utils.ts:72`) plus the existing `notComputableReason` pattern (`pace-quality.ts`) | Already total, already tested against every malformed-input shape the archive has produced; re-deriving "computable" risks disagreeing with the count `pace-quality.ts` already reports. |
| Gap/pause/unreliable classification for the running-pace numerator | A parallel classifier | `classifyGapsWithSegments`/`coveredRuns` (`pace-derivation.ts`) | This is the ONE classification-arithmetic implementation in the module (`accumulateCoverage`'s own docblock); a parallel classifier is a second implementation of exactly the logic COV-03 already proves exact. |
| The zero-import independent recount's traversal | A recount that imports the same classification code | `compute-unreliable-segment-recount.mjs`'s pattern — gap-first traversal, deliberately structurally different from the detector's run-first traversal, zero `unreliable-segments`/`pace-derivation` imports of any kind | Pitfall 11 (`PITFALLS.md`): a recount sharing the classifier's own blind spot is not a real second opinion. This codebase already has a working, precedent-setting example to copy for D-08's zero-import recount requirement. |
| The calibration machinery (strawman, insensitivity, first-clearing arbitration, HALT) | A new bespoke calibration harness | `scripts/compute-pause-classification-calibration.mjs`'s shape (`runFamily`, `evaluateShape`, `plantShapes`, `decideOutcome`, `renderCalibrationMarkdown`) | This exact shape has been built, reviewed, and exercised through three real HALTs (34-06-HALT-1/2/3.md). Re-deriving it is strictly more expensive and more risky than instantiating it for a new constant family. |

**Key insight:** every mechanism this phase needs to build already has a working sibling in this
codebase from Phases 26-34. The research risk here is not "does a library exist for this" (STACK.md
already answered no-new-dependency) — it is "which of the 5-6 near-identical prior patterns is the
right one to copy for this specific field," and getting that wrong (e.g. re-deriving a boundary
convention, or building a fifth calibration harness from scratch) is where past phases have lost the
most time.

## Common Pitfalls

### Pitfall 1: The stream read that never happens for slow-metadata activities

**What goes wrong:** `compute-dashboard-index.ts:244-262` only reads `data/streams/{id}.json` for
the disagreement check when `paceSecPerKm !== null && paceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`
(200 s/km today). 3475724402's metadata pace is 296.0 s/km — this branch would never execute for
it, so `paceDisagreement` would stay `null` forever under an unmodified gate, and ROADMAP criterion
3 ("3475724402 ... is badged") would be unsatisfiable no matter how the comparator/threshold change.

**Why it happens:** the gate was written for PACE-07's narrower question ("is metadata implying an
implausibly FAST pace"), which is a strict subset of RPACE-03's question ("do the two figures
disagree materially, in either direction the developer chooses under D-06"). The gate is also a
performance optimization (avoid reading every stream file just to check a comparator that rarely
fires) — but RPACE-01 independently requires a stream read for *every* computable-stream activity
anyway, to compute the running pace at all.

**How to avoid:** compute the running pace (and therefore have the stream already read and
classified) unconditionally for every activity with `entry.available` — this already happens two
dozen lines below the disagreement-gate block, for the quality-signal computation
(`streamForQuality`, `:274-290`). The running-pace computation and the disagreement check should
most likely both consume that SAME already-read stream (or the running-pace value itself, once
computed unconditionally), rather than adding a third independently-gated read. The disagreement
check's OWN gate (D-02's eligibility gate, replacing the retired 200 s/km rule) becomes a filter on
an *already-computed* running pace, not a filter on whether to read the stream at all.

**Warning signs:** a `-t "detectPaceDisagreement"` or archive-sweep test that reports a lower count
than expected specifically for slow-metadata activities; 3475724402 failing to badge in a
development build even after the comparator/threshold change lands.

### Pitfall 2: A calibration statistic that measures the same axis as the eligibility gate

**What goes wrong:** D-02 (the eligibility gate) and D-05/D-06/D-07 (the threshold and its
statistic family) are two separate, sequential decisions. If the eligibility gate is defined in
terms of the SAME quantity the calibrated statistic measures (e.g., "exclude activities where
excluded metres < N" as the gate, then calibrate a Δ-sec/km threshold that is itself driven mostly
by excluded metres), the calibration's non-circularity argument becomes harder to write honestly —
the population the statistic is calibrated over would already be pre-filtered by a related axis.

**Why it happens:** Finding 3 in CONTEXT.md (two different mechanisms producing disagreement — (a)
distance-off-the-clock, (b) moving-time divergence) is exactly the kind of finding that tempts a
gate defined in terms of one mechanism's own signature (e.g., "excluded metres > floor") interacting
with a threshold measuring the OTHER mechanism's signature (Δ or ratio, which fire on both). This is
not inherently wrong, but the calibration's own non-circularity argument (required by D-05) must
explicitly address why the gate and the statistic are independent enough that arbitration on the
statistic isn't secretly arbitration on the gate.

**How to avoid:** when pre-declaring calibration shapes (D-05, before any measurement), state the
gate's own definition alongside them and argue explicitly that the gate's population is not
self-referential with respect to what the statistic measures (mirroring `32-CONTEXT.md` D-16's
"non-self-referential population; HALT rather than widen" precedent).

**Warning signs:** a calibration artifact whose non-circularity argument reads as "the gate excludes
X, and coincidentally the statistic's tail is dominated by not-X."

### Pitfall 3: `validateStreamSeries`'s null-unsafety inside the retiring function

**What goes wrong:** `streamPaceSecPerKm` (`pace-derivation.ts:943`, the function D-01 retires as
the disputed comparator) calls `validateStreamSeries(t, d)` at line 945 without the `t == null ||
d == null` guard `classifyPairKinds` added in Phase 34 — one of the nine call sites the folded todo
names. If this function is deleted outright (one of D-01's disposition options), the gap closes for
free at this site. If it is KEPT (for another purpose, or only for its own tests, per D-01's "open"
note), the gap survives whatever D-01 decides.

**Why it happens:** `validateStreamSeries` itself (`best-effort-utils.ts:72`) reads `t.length`
unconditionally as its first line — a genuinely `null` `t`/`d` throws a raw `TypeError` before the
function's own "never throws" contract can apply. Phase 34 closed this gap at exactly one call site
(`classifyPairKinds`) and explicitly scoped the fix as narrow, deferring the general fix.

**How to avoid:** the folded todo's own acceptance criteria apply verbatim to whichever of the nine
sites this phase's changes touch or delete. The nine sites named by the todo (2026-09-23,
`.planning/todos/pending/2026-09-23-validate-stream-series-null-safety-at-source.md`): `pace-
derivation.ts:784` (now `:792`, inside `derivePaceWithCoverage`), `pace-derivation.ts:937` (now
`:945`, inside `streamPaceSecPerKm` — the function this phase retires as a comparator), and six
sites in `pace-quality.ts` at (line numbers as of the todo's creation) `:1013`, `:1342`, `:1433`,
`:1576`, `:1816`, `:2151` (current line numbers, verified this session: `:1017`, `:1346`, `:1437`,
`:1580`, `:1820`, `:2176`). Note: the todo's own title says "nine call sites" but its body
enumerates exactly eight — a minor internal inconsistency in the todo text itself, not something
this research resolves; the planner should re-grep before scoping a fix rather than trust either
number blindly. **Folded scope for this phase per D-11's CONTEXT.md text:** only `pace-derivation.ts:937`
sits directly in this phase's blast radius (it is inside the function D-01 retires); the six
`pace-quality.ts` sites and `pace-derivation.ts:784` are unrelated call sites this phase does not
need to touch unless the new running-pace function is added to `pace-derivation.ts` in a way that
creates a TENTH call site with the same gap.

### Pitfall 4: A duplicated-derivation badge-reach mismatch (Phase 24 D-04's lesson, recurring risk)

**What goes wrong:** if D-03 widens badge reach on list surfaces but the detail view's own
`disagreement` read, or vice versa, computes/reads the disputed state through a DIFFERENT code path
(e.g., a stale cached row shape, or a client-side recompute that doesn't match the index-row field),
one surface can show a row as disputed while another does not.

**Why it happens:** this codebase already has ONE dispatch point for badge text
(`appendStatusBadges`/`statusBadgeTexts`) and ONE detail-view read (`indexClient.getRow(id)?.
paceDisagreement`) — both already read the SAME precomputed `row.paceDisagreement` field. The risk
is introduced only if this phase adds a second source of truth (e.g., a client-recomputed running
pace that could theoretically disagree with the CI-precomputed one used for the badge decision).

**How to avoid:** keep exactly one computation of `paceDisagreement` (in `compute-dashboard-index.ts`,
at CI time) and have every render-path consumer read that same precomputed field — never recompute
`detectPaceDisagreement` client-side. This mirrors the existing PACE-07 shape exactly; the phase's
job is retargeting the comparator, not restructuring where the comparison happens.

## Code Examples

### The zero-import recount pattern (D-08's requirement)

```javascript
// Source: scripts/compute-unreliable-segment-recount.mjs:1-40 (docblock, read verbatim this session)
// FORBIDDEN, DELIBERATELY: this file has zero import/require/dynamic-import() statements
// naming `unreliable-segments` ... A recount that imported the detector that produced the
// numbers it is checking would agree with itself by construction.
//
// TRAVERSAL, DELIBERATELY MIRRORED [different from the code under test]...
//
// LOCAL_GAP_THRESHOLD_SEC = 10 is a LOCAL DUPLICATE of RECORDING_GAP_ABS_THRESHOLD_SEC
// (src/analytics/pace-derivation.ts), NOT imported from there — the discipline is about
// staying independent of the code under test.
```

The same shape applies to D-08's running-pace recount: a new `compute-<name>-recount.mjs` that
duplicates the tiny constants it needs (`RECORDING_GAP_ABS_THRESHOLD_SEC = 10`, the pause-threshold
formula) locally, uses a structurally different traversal than `classifyGapsWithSegments`'s
three-pass shape, and states its own "bound on its claim" (what it verifies vs. what it cannot
arbitrate) explicitly in its docblock.

### The stub-the-detector load-bearing proof (D-11's SEG-05b half)

```typescript
// Source: src/analytics/pace-single-source.test.ts:889-934 (read verbatim this session)
describe('pace-derivation.ts\'s detector import is load-bearing (SEG-05b, D-15)', () => {
  it('stubbing detectUnreliableSegments to return [] on real 3475734189 both zeroes ' +
     'unreliableSec AND un-clips the previously-clipped window; the real module does the ' +
     'opposite in both respects', async () => {
    // vi.mock('./unreliable-segments.js', ...) returning [] from detectUnreliableSegments,
    // then re-import pace-derivation.js and assert the running-pace-adjacent output changes
    // on the SAME named real activity — not "the import statement exists".
  });
});
```

Phase 35's D-11 proof should follow this exact shape: stub `detectUnreliableSegments` to return
`[]`, re-import `pace-derivation.js`, and show the running-pace value (or its excluded-metres/
excluded-seconds pair) on 3475724402 changes between the real and stubbed module — proving the new
running-pace function genuinely reads the detector's output through `classifyGapsWithSegments`,
not merely importing a module that happens to import the detector elsewhere.

### The `detectPaceDisagreement` contract to preserve (D-01: retarget, not restructure)

```typescript
// Source: src/analytics/pace-derivation.ts:980-1002 (read verbatim this session)
export function detectPaceDisagreement(
  metadataPaceSecPerKm: number | null,
  stream: CanonicalStream,
  options?: { metadataThresholdSecPerKm?: number; ratio?: number }
): PaceDisagreementResult | null {
  // ... returns null OR a fully-populated result, never partial, never a zero.
  // This shape (options override for both constants, all-or-nothing return) is explicitly
  // NOT what D-01 changes — only the comparator (streamPaceSecPerKm -> running pace) and the
  // threshold semantics (D-02/D-05/D-06/D-07) change.
}
```

The signature likely needs to change from `(metadataPaceSecPerKm, stream, options)` to something
that accepts the already-computed running pace (or the stream plus enough to derive it) rather than
recomputing `streamPaceSecPerKm(stream)` internally — since Pitfall 1's fix means the running pace
is very likely already computed by the time this function is called, and recomputing it a second
time inside `detectPaceDisagreement` would be both wasteful and a second call site for the same
arithmetic (Anti-Pattern risk above).

## State of the Art

| Old approach | Current approach (this phase) | When changed | Impact |
|--------------|-------------------------------|---------------|--------|
| Span-based `streamPaceSecPerKm` (`(t[n-1]-t[0]) / ((d[n-1]-d[0])/1000)`) as the disputed comparator | A coverage-based running pace (excludes gaps/pauses/unreliable segments from BOTH distance and time) | This phase, D-01 | The comparator now answers "how fast when moving reliably," not "what does the whole recorded stream imply" — a materially different question, which is why the eligibility gate and threshold both need recalibration, not just a constant swap. |
| Gated stream read (`metadataPace < 200`) before any disagreement check | Unconditional stream read for every computable-stream activity (shared with the quality-signal read) | This phase, forced by RPACE-01 | Every activity now gets a running-pace value, not just implausibly-fast ones; the CI compute chain's per-row cost changes from "conditional extra read" to "one more field on the already-unconditional read." |
| `PaceCoverage` tracks seconds only | (Likely) a metres-accounting addition, reusing `coveredRuns` | This phase, D-08 | First time this module's coverage machinery needs to answer a distance question, not just a time question — no existing field to extend, a genuinely new addition. |

**Deprecated/outdated:** `streamPaceSecPerKm`'s role as THE disputed comparator is retired by D-01;
its disposition as a standalone export (kept, deleted, or test-only) is D-04's discretion — this
research surfaces the grep-confirmed fact that nothing outside `detectPaceDisagreement` calls it
today, which is the load-bearing fact for whichever disposition the planner chooses.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `coveredRuns`'s index-based covered-metres sum (Reading A) is the lower-risk starting point for D-08, versus a from-scratch "whole-step exclusion" re-derivation (Reading B). This is argued from the codebase's own documented history (32-13/32-17), not measured against the CONTEXT.md probe figures. | Pattern 1 | If the planner instead argues from measured probe-figure agreement (forbidden by the contamination guard) or picks Reading B without an equivalent boundary-case test, a silent second boundary convention could reintroduce the exact class of defect 32-13 fixed. |
| A2 | The running-pace computation and the `paceDisagreement` computation should share ONE stream read per activity in `compute-dashboard-index.ts`, folded into the existing unconditional quality-signal read rather than kept as a third gated read. | Pitfall 1 | If not folded, either 3475724402 never gets read (ROADMAP criterion 3 fails outright) or the CI chain reads every stream file three separate times per activity, which is correct but wasteful — a performance, not correctness, risk if missed. |
| A3 | `detectPaceDisagreement`'s signature likely needs to change to accept an already-computed running pace rather than recomputing it internally from `stream`. | Code Examples | If the planner keeps the current `(metadataPace, stream, options)` signature and has it call the new running-pace function internally, that creates the exact "recompute vs. reuse" duplication risk the Anti-Patterns section warns against — not incorrect, but a second computation of the same numbers per activity. |
| A4 | The "nine call sites" the folded todo names is very likely an off-by-one in the todo's own title (eight are explicitly enumerated in its body); only `pace-derivation.ts:937` (inside the retiring `streamPaceSecPerKm`) is in THIS phase's scope per D-11's own CONTEXT.md text. | Common Pitfalls Pitfall 3 | If the planner trusts "nine" and searches for a ninth site rather than re-grepping, time is wasted on a discrepancy that traces to the todo file itself, not to a missed site in this codebase. |

## Open Questions

1. **Does the running pace ship as a row scalar, a shard field, or both (D-10 discretion)?**
   - What we know: `paceDisagreement` (a small, always-needed-on-detail-view object) ships as a row
     scalar today; the per-segment evidence lists (SEG-06's mechanism breakdown) ship in the lazy
     shard instead, per the established "small/always-needed → row scalar, large/detail-only →
     shard" split (`dashboard-index.types.ts`'s own docblock language, "shard-only evidence").
   - What's unclear: whether the running pace + its exclusions sentence's two numbers (metres,
     seconds) are small enough to be a row scalar (they are — three numbers) or whether the
     developer's D-10 preference leans toward the shard for consistency with SEG-06.
   - Recommendation: row scalar, following the `paceDisagreement` precedent directly — it is used
     on every detail-view open (not conditionally, per COV-02's always-on precedent D-10 invokes)
     and is small (running pace + excluded metres + excluded seconds, three numbers).

2. **Does `detectPaceDisagreement`'s eligibility gate (D-02) need its own named constant with a
   docblock, mirroring `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`'s existing precedent?**
   - What we know: the retired 200 s/km constant's docblock is explicitly named as "itself the
     prose D-04 must amend" — a strong signal the codebase's convention is one named, documented
     constant per gate, with a measurement-provenance comment and the "rule forbidding tuning
     toward a count" language every prior constant carries.
   - What's unclear: what shape the NEW gate takes (excluded-distance floor, minimum-scale gate, or
     no gate) — this is explicitly D-02's open discretion, not something this research resolves.
   - Recommendation: whichever shape is chosen, follow the existing docblock convention verbatim
     (measurement provenance + no-tuning-toward-a-count rule), since that convention is itself what
     D-04 will need to amend later if the constant moves.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-verified stack (TypeScript,
vitest, Node — all confirmed present and current in `.planning/research/STACK.md`, dated
2026-09-19, and via this session's read of `package.json`/`vitest.config.ts`). No new tool, service,
or runtime is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (already configured — no Wave 0 install) |
| Config file | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| Quick run command | `npx vitest run <touched test files> -t "<fragment>"` (`.test.mjs` files import `../dist/` — run `npm run build` first) |
| Full suite command | `npm test` — baseline at Phase 34's close: 98 files / 3,499 tests, all green (`34-VALIDATION.md`, STATE.md 2026-09-23); re-confirm fresh at Wave 0, since nightly CI may have moved the archive |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPACE-01 | Running pace computed for every computable-stream activity, through `pace-derivation.ts`, gap/unreliable-excluded from both distance and time | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "running pace"` | ❌ Wave 0 (extends existing file) |
| RPACE-01 (CI write) | `compute-dashboard-index.ts` computes the running pace unconditionally (not gated by the retired 200 s/km rule) for every `entry.available` activity | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "running pace"` | ❌ Wave 0 (extends existing file) |
| RPACE-02 | Detail view shows running pace beside metadata pace with excluded metres/seconds stated; the two figures visibly differ on 3475724402 | unit + manual | `npx vitest run src/dashboard/views/detail.test.ts -t "running pace"`; browser checkpoint row against 3475724402's served page | ❌ Wave 0 (extends existing file) |
| RPACE-02 (byte-identical boundary) | Metadata pace and `moving_time` unchanged everywhere else — lists, stats, widgets | unit (regression) | `npx vitest run src/dashboard/views/list.test.ts -t "metadata pace unchanged"` plus existing stats-document snapshot tests re-run unmodified | ✅ extend existing coverage, no new file |
| RPACE-03 (comparator retarget) | `detectPaceDisagreement` compares metadata pace against running pace, not span-based `streamPaceSecPerKm` | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "detectPaceDisagreement"` | ✅ file exists, extend |
| RPACE-03 (eligibility gate) | D-02's replacement gate keeps 3475724402 reachable; excluded population named with measured count | script (artifact) | the new `compute-<name>-calibration.mjs`'s own eligibility-gate section, asserted via its `.test.mjs` | ❌ Wave 0 |
| RPACE-03 (threshold calibration) | Full D-05 calibration: pre-declared shapes, strawman-must-fail, D-13 insensitivity, first-clearing arbitration, HALT branch | script (artifact) | `npx vitest run scripts/compute-<name>-calibration.test.mjs` | ❌ Wave 0 |
| RPACE-03 (badge on 3475724402) | Badge raised on 3475724402 under the calibrated threshold | unit + manual | `npx vitest run src/dashboard/views/list.test.ts -t "3475724402"`; browser checkpoint row | ❌ Wave 0 (new fixture-pinned test) |
| RPACE-03 (zero-import recount) | D-08's independent metres/seconds recount agrees with the shipped computation on named activities | script | `npx vitest run scripts/compute-<name>-recount.test.mjs` | ❌ Wave 0 |
| SEG-05b (Phase 35 half) | Running-pace computation reads the detector's output through `pace-derivation.ts`, load-bearing (stub-and-watch-change proof) | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "running pace"` | ✅ file exists, extend |
| D-09 (splits rebase) | Splits rebase to the running pace on badged activities; disclosure note text correct | unit + manual | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "isRebasedAverage"`; browser checkpoint row | ✅ extend existing coverage |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched files> -t "<fragment>"`, matched count recorded
  (this project's own Rule 1 — a filter matching 0 tests exits 0 and is indistinguishable from a
  pass, per `33-VALIDATION.md`/`34-VALIDATION.md`'s carried-forward lesson).
- **Per wave merge:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`.
- **Phase gate:** full suite green; the D-05 calibration and D-08 recount artifacts both regenerated
  twice and byte-identical; the D-05 strawman watched failing first against the real archive; the
  D-11 stub-the-detector proof watched changing the running-pace value on 3475724402; human browser
  checkpoint against a digest-verified served build (mandatory — criteria 2 and 3 are rendered
  claims, and D-09's rebase is a visible change to a shipped surface). Hard-reload after every
  fixture edit (this project's own recorded browser-checkpoint pitfall).

### Wave 0 Gaps
- [ ] The new running-pace function (name TBD, D-08) + its unit tests in `pace-derivation.test.ts`
      — including the pinned boundary-case test for "near-zero excluded metres, large excluded
      seconds" (Pattern 1's flagged edge case, best exercised on an activity resembling 3475742397's
      profile per the probe).
- [ ] `scripts/compute-<name>-calibration.mjs` + `.test.mjs` — D-05's full HALT-capable machinery,
      instantiated from the `compute-pause-classification-calibration.mjs` shape.
- [ ] `scripts/compute-<name>-recount.mjs` + `.test.mjs` — D-08's zero-import independent recount,
      instantiated from the `compute-unreliable-segment-recount.mjs` shape.
- [ ] `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` — the generated artifact
      (does not exist until the generator runs).
- Framework install: none — vitest already configured, no new dependency.

## Security Domain

`security_enforcement` is not present in `.planning/config.json` (absent = enabled per this
template's default), but this phase touches no authentication, session, access-control, or new
external-input surface — it is pure numeric computation over already-committed, already-trusted
stream data, rendered via the existing `textContent`-only DOM-writing discipline this codebase
already enforces everywhere (`appendAccessibleBadge`, the same badge-append path this phase reuses).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V5 Input Validation | yes (unchanged) | `textContent`-only DOM writes for the new disclosure sentence, matching `appendAccessibleBadge`'s existing discipline; no new free-text surface is introduced (the excluded metres/seconds are formatted numbers, not user- or device-supplied strings). |
| Others | no | No auth, session, crypto, or new external service in this phase. |

## Sources

### Primary (HIGH confidence — read directly from the committed source tree this session)
- `src/analytics/pace-derivation.ts` — full file read (1,003 lines): `PaceCoverage`, `CoveredRun`,
  `classifyGapsWithSegments`, `classifyGaps`, `derivePaceWithCoverage`, `streamPaceSecPerKm`,
  `detectPaceDisagreement`, `PaceDisagreementResult`, `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`,
  `PACE_DISAGREEMENT_RATIO`, `quantile`.
- `src/analytics/best-effort-utils.ts` — `validateStreamSeries` (the unconditional `t.length` read).
- `src/analytics/pace-quality.ts` — `resolveCoverage`, `hasAnySevereSignal`, `PaceQualityShard`,
  `buildPaceQualityShard`, `notComputableReason` pattern.
- `src/analytics/compute-dashboard-index.ts` — the gated stream-read block (`:244-262`) and the
  unconditional quality-signal read (`:264-290`); import list confirming `detectPaceDisagreement`/
  `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM` are imported from `pace-derivation.js`.
- `src/analytics/dashboard-index.types.ts` — `PaceDisagreement`, `DASHBOARD_INDEX_SCHEMA_VERSION`,
  `ParsedDashboardIndexRow`.
- `src/dashboard/views/detail.ts` (lines 650-838) — the Pace stat card, `disagreement` read,
  `rebasedAveragePaceSecPerKm`, `buildSplitsSection` call.
- `src/dashboard/views/detail-sections.ts` (lines 230-450) — `buildPaceBarCell`, `buildSplitsSection`,
  the `isRebasedAverage` disclosure note.
- `src/dashboard/views/list.ts` (lines 260-350, 690-720) — `PACE_DISPUTED_BADGE_TEXT`,
  `paceDisputedExplanation`, `appendPaceDisputedBadge`, `rowPaceDisagreement`, `appendStatusBadges`.
- `src/analytics/pace-single-source.test.ts` (partial read, ~600 lines across several ranges) —
  `BANNED_LITERALS`, `ALLOWED_FILE_SUFFIX`, the SEG-05b load-bearing stub-the-detector proof pattern
  (`:889-934`, `:944-1007`).
- `scripts/compute-unreliable-segment-recount.mjs` (lines 1-90) — the zero-import recount pattern's
  full docblock and structure.
- `scripts/compute-pause-classification-calibration.mjs` (grep-driven structural survey of a
  2,980+1,545+518-line generator/test family) — `runFamily`, `evaluateShape`, `plantShapes`,
  `decideOutcome`, `renderCalibrationMarkdown`, `main()`'s provenance (git-tree-hash, not
  `rev-parse HEAD` alone).
- `scripts/unreliable-segment-import-guards.test.mjs` (lines 1-90) — the observing `vi.mock('fs')`
  import-time guard pattern, replacing the structurally vacuous `vi.spyOn` approach.
- `.planning/todos/pending/2026-09-23-validate-stream-series-null-safety-at-source.md` — the folded
  todo's exact nine/eight call sites.
- `.planning/phases/35-stream-derived-running-pace/35-CONTEXT.md` — full file read, all decisions.
- `.planning/REQUIREMENTS.md` — full file read, RPACE-01/02/03, SEG-05b's history, standing
  conventions paragraph, § Out of Scope.
- `.planning/config.json` — confirmed `nyquist_validation: true` (absent-would-also-mean-enabled,
  but it is explicitly present and true).
- `.planning/research/STACK.md` (partial read) — confirmed zero new dependencies for the whole
  v2.3 milestone.
- `.planning/phases/34-pause-classification-forgotten-stop/34-VALIDATION.md` and `34-RESEARCH.md`
  § Validation Architecture — the exact table/section format this research mirrors.

### Secondary (MEDIUM confidence)
- `package.json` / `vitest.config.ts` grep — confirmed `"test": "vitest run"`,
  `fileParallelism: false`.
- `.planning/STATE.md` (partial read, lines 1-224) — Phase 34 close figures (98 files / 3,499 tests),
  current phase position.

### Tertiary (LOW confidence — flagged for developer/planner confirmation)
- None — every claim above traces to a primary source read this session. The one genuinely open
  technical question (D-08's Reading A vs. Reading B) is presented as an argued trade-off, not a
  low-confidence guess, per the phase's own research-focus instruction not to pick a side.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, confirmed against `STACK.md` and this session's own
  `package.json`/module reads.
- Architecture: HIGH for integration call sites (all read verbatim this session); MEDIUM for D-08's
  running-pace computation specifically, since no committed precedent exists to copy — argued from
  first principles against this codebase's own documented defect history (32-13/32-17).
- Pitfalls: HIGH — Pitfall 1 (the gated-read defect) is a direct, verified reading of the current
  `compute-dashboard-index.ts` source, not an inference; Pitfalls 3-4 trace to named, dated project
  history (the folded todo, Phase 24 D-04).

**Research date:** 2026-09-24
**Valid until:** 2026-09-31 (7 days — this phase touches a fast-moving part of the codebase that
Phases 33/34 both modified recently, and the nightly CI continues to move the underlying archive).
