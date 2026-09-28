# Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration - Research

**Researched:** 2026-09-28
**Domain:** In-repo TypeScript analytics (best-effort computation, ceiling derivation) — no external library integration, no new dependencies
**Confidence:** HIGH (every code citation re-read from the current tree today; every headline probe number independently re-derived by this research session against the live committed archive, not copied from CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-02:** Criterion 2's test defends against the **d-rebased splice, on 3475740390**. Variant and
  fixture are pinned together; the same variant on 3475724402 would be an unsatisfiable row.
- **D-03:** An archive-wide overlap invariant, computed from the detector's own output (never
  against the search code). Watched failing on a deliberately widened sub-interval first.
- **D-04:** Demotion triggers structurally (unpartitioned best window intersects a segment), never
  by a movement threshold. No new calibrated constant.
- **D-05:** A new sibling field: `contaminated: { guard, reason, durationSec, paceSecPerKm,
  startOffsetSec, endOffsetSec } | null` on `ComputedEffort`. `demotion` keeps its exact current
  meaning. No `BEST_EFFORTS_SCHEMA_VERSION` bump.
- **D-06:** No clean window → the effort is kept, carrying the contaminated figure, with
  `demotion = { guard: 'unreliable-segment', reason }`.
- **D-09:** A new `36-CEILING-RECALIBRATION.md` artifact of record, committed/regenerable/idempotent,
  mirroring `28-CEILING-CALIBRATION.md`/`30-CALIBRATION.md`'s shape, own `.test.mjs` sibling.
- **D-10:** The half-marathon fail-open (population 104→69, below `CEILING_MIN_POPULATION=100`) is
  its own named finding; the developer signs it explicitly. `CEILING_MIN_POPULATION` may not move.
- **D-17:** No review-queue work this phase (Phase 37's scope). Bound: no assumption the new guard
  surfaces without evidence that it does.
- **D-18:** Browser evidence delegated to a designed checkpoint; every row reachability-checked in
  both directions; at least one row compares against a value derived outside the changed code.

### Claude's Discretion (this research resolves each, bound by its stated constraint)

- D-01 (exclusion granularity), D-07 (reason wording), D-08 (precedence position), D-11 (write-gate
  mechanism), D-12 (explanation depth), D-13 (third-leg design), D-14 (pass placement), D-15/D-16
  (presentation), D-18 (checkpoint row design) — resolved below, each cross-referenced to its bound.
- `findBestEffort` reuse without a second sweep implementation — resolved below (Don't Hand-Roll).
- Artifact/script/generator filenames — resolved below (Code Examples / Don't Hand-Roll).
- The new guard value's exact spelling — `'unreliable-segment'` confirmed as the recommended,
  unambiguous spelling; no conflicting existing guard value.

### Deferred Ideas (OUT OF SCOPE — do not plan for these)

- Review-queue reordering by guard, moved-but-ranked queue treatment, reversible "reviewed and
  kept," CUR-04 — all Phase 37.
- CUR-05 (per-effort override) — Future Requirements, unscheduled.
- Whether the 439/440 no-clean-window pairs justify a dilution clause — explicitly rejected, no
  new calibrated constant.
- STREAM-05/06 (1 Hz re-derivation) — unscheduled, noted only as future evidence source.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PR-06 | A best-effort window may not span/interpolate a crossing across an unreliable segment; the search partitions into clean sub-intervals, never splices; a test proves splice fabricates a faster window on a named fixture. | See "Partition mechanism" (Architecture Patterns) and the verified D-02 fixture numbers below — `findBestEffort` reused with index-range bounds per clean sub-interval, never a spliced array. |
| PR-07 | The contaminated effort is never deleted: retained as a demoted record under a new guard with a reason naming the segment(s) and measured metres/seconds; ranked figure is the best clean window; no-clean-window activities have no ranked effort and say why. | D-05/D-06 (locked shape) + D-07 (reason wording) resolved below with a verified real 4-segment fixture (3475740390@400m). |
| PR-08 | Unreliable-segment exclusion runs strictly before ceiling derivation in the existing three-pass shape; contaminated timings never enter the p90 population; movement is measured/reported; zero movement is a finding to explain. | D-14 (pass placement) resolved with call-graph evidence; confirms `best-effort-ceiling.ts` needs zero code change if the top-level duration is always clean. |
| PR-09 | Archive-wide before/after diff (rank changes, demotions, reinstatements, ceiling values), reconciled three ways (diff, guard counts, independent sweep), signed against sha256; three scoping activities' 400m efforts pinned as regression fixtures. | D-09/D-11/D-12/D-13 resolved below with concrete script shapes mirroring `compute-pr-ceiling-diff.mjs`/`compute-pr-ceiling-recount.mjs`. |
| SEG-05b (Phase 36 half) | The detector is the single source; Phase 36 must show its own consumer reading the detector's output, proven load-bearing by stubbing. | `classifyGapsWithSegments`'s `segments` array is the sanctioned read path (see Architecture Patterns); the load-bearing proof pattern from Phases 33/34/35 (stub the detector, show the clean-window search changes) is directly reusable. |

</phase_requirements>

## Summary

Phase 36 is a pure in-repo TypeScript change with no new runtime dependencies (this project's own
STACK.md convention — "every algorithm needed extends an existing hand-rolled function" — holds
here too: the two-pointer sweep, the percentile function and the detector already exist). The
entire design surface is: (1) where in `computeActivityEfforts` the clean-window partition search
runs, (2) the exact shape of the new `contaminated` sibling field and the `'unreliable-segment'`
guard, (3) the write-gate for `data/best-effort-ceiling.json`, and (4) three new generated artifacts
(`36-CEILING-RECALIBRATION.md`, PR-09's diff, PR-09's independent recount) following two precedents
this codebase already ships and tests: `28-DIFF.md`'s generator (`compute-pr-ceiling-diff.mjs`) and
the zero-import recount pattern (`compute-pr-ceiling-recount.mjs`, `compute-elevation-recount.mjs`).

A dedicated pre-existing document, `.planning/research/ARCHITECTURE.md` (written 2026-09-19, before
Phase 32 shipped), already answered most of the structural questions this phase now formalizes as
D-01/D-05/D-08/D-14: it recommends the `contaminated` sibling field (matching D-05 verbatim), states
`best-effort-ceiling.ts` needs **zero code change**, and gives the call-graph reason why. This
research treats that document as a verified precedent, cross-checks its claims against the code as
it exists today (some names have since changed — `classifyGaps` is now `classifyGapsWithSegments`),
and resolves the remaining gaps (D-02/D-08's satisfiability, D-11's write gate, D-13's third leg)
with fresh, independently-run probes against the live committed archive (2026-09-28), not by
re-quoting CONTEXT.md's own numbers.

**Two research findings materially change what the planner should build, beyond what CONTEXT.md
already states:**

1. **D-08's literal bound ("a real activity that trips both [world-record/max-speed AND
   unreliable-segment]") is UNSATISFIABLE for the D-06 no-clean-window case on the live archive
   today** (0 of 440 no-clean-window occurrences independently fail an absolute guard on their raw
   timing). It IS satisfiable for the **moved** case (clean window exists, raw fails an absolute
   guard) — 31 real activity/distance pairs found, e.g. `3475725842`@400m (raw 28.19 m/s vs the
   activity's own recorded `max_speed` 6.08 m/s) and `3475713251`@400m (raw 14.75 m/s vs
   world-record 9.30 m/s). See "D-08" below for the exact reachability analysis and recommended
   fixture.
2. **The pace-single-source audit does not currently ban a second sweep implementation.**
   `pace-single-source.test.ts`'s `BANNED_LITERALS` bans only the pace-division shape (`dt / (dd /
   1000)` and its running-pace sibling); nothing bans a duplicate `d[j] - d[i] >= targetMeters`
   two-pointer implementation. CONTEXT.md's discretion note ("a second copy of the sweep would trip
   `pace-single-source.test.ts`") does not hold today. This does not change the recommendation
   (reuse `findBestEffort` via index-range parameters — it is still the right design), but the
   planner should not rely on an existing test to catch a regression here; if drift-prevention is
   wanted, it must be added as part of this phase, not assumed already present.

**Primary recommendation:** Give `findBestEffort` two new optional parameters, `startIndex`/`endIndex`
(bounding the sweep to `t.slice(startIndex, endIndex)`/`d.slice(startIndex, endIndex)` semantics
without ever copying the array), wire the clean-window search into `computeActivityEfforts` (Pass 1,
before the "PASS 2" source marker so the existing no-loop audit is untouched), partition on the
**whole merged segment span** (`startIndex`..`endIndex`, D-01), and let `best-effort-ceiling.ts`
change not at all.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Clean-window partition search | Node/CI Compute (`src/analytics/`) | — | Pure, no I/O; must stay reachable from `pace-single-source.test.ts`'s audits and the existing archive-sweep test style |
| Contaminated-record shape (`contaminated` field, new guard) | Node/CI Compute (`best-effort.types.ts`, `compute-best-efforts.ts`) | Browser/Dashboard (parse + render) | Type/shape lives server-side; the browser-side `best-efforts-client.ts` needs a total, never-throwing parser for the new field (mirrors `parseDemotion`) |
| Ceiling recalibration ordering/artifact | Node/CI Compute (`best-effort-ceiling.ts` unchanged, `compute-best-efforts.ts`, new `scripts/*.mjs`) | — | Non-circularity is structural (Pass 1 only ever admits clean-window efforts); no new filter needed in the ceiling module |
| Archive-wide diff + reconciliation (PR-09) | Local Dev Tooling (`scripts/*.mjs`, Node-only, dev-run) | — | Never runs in the browser; mirrors `compute-pr-ceiling-diff.mjs`/`compute-pr-ceiling-recount.mjs`'s existing tier |
| Detail-view disclosure (D-15) | Browser/Dashboard (`detail-best-efforts-logic.ts`, `detail.ts`) | — | Pure, DOM-free transform module; rendering is a thin DOM layer over it, per this codebase's existing split |
| Records-view disclosure (D-16) | Browser/Dashboard (`records-logic.ts`) | — | Same split; must walk the shipped document (precedent: `countDemotedAtDistance`), never an incrementing counter |
| Write-gate for `data/best-effort-ceiling.json` (D-11) | Node/CI Compute (CLI entry points: `src/index.ts`, `compute-all-stats-steps.ts`) + CI workflow (`.github/workflows/daily-refresh.yml`) | — | The hazard is triggerable from any local command invocation; the gate must live at the option/flag boundary, not inside the pure derivation module |

## Standard Stack

No new libraries. This phase extends existing hand-rolled modules exclusively, matching this
project's own `STACK.md` convention ("every algorithm needed extends an existing hand-rolled
function ... a stats library would add a third percentile definition to reconcile" — `REQUIREMENTS.md`
§ Out of Scope, "New runtime dependencies" row).

### Core (existing, extended)

| Module | Role in this phase | Change |
|--------|--------------------|--------|
| `src/analytics/best-effort-utils.ts` | `findBestEffort` two-pointer sweep | Gains optional `startIndex`/`endIndex` bounds (index-range, not array slicing — see Don't Hand-Roll) |
| `src/analytics/best-effort.types.ts` | `ComputedEffort`, `EffortDemotionGuard` | `contaminated` sibling field (D-05); `EffortDemotionGuard` gains `'unreliable-segment'` |
| `src/analytics/compute-best-efforts.ts` | Three-pass orchestration | Pass 1 gains the partition-and-search step, before the `PASS 2` source marker |
| `src/analytics/best-effort-ceiling.ts` | Pure ceiling derivation | **Unchanged** — verified below (D-14) |
| `src/analytics/pace-derivation.ts` | `classifyGapsWithSegments` | **Unchanged** — already exports `segments: UnreliableSegment[]`, the one sanctioned read path |
| `src/dashboard/data/best-efforts-client.ts` | Browser shard parser | Gains a total `parseContaminated` mirroring `parseDemotion`; `VALID_DEMOTION_GUARDS` gains `'unreliable-segment'` |
| `src/dashboard/views/records-logic.ts` | Records-view aggregation | `switch` at line ~204 gains a `'unreliable-segment'` case (currently buckets to `other`) |
| `src/dashboard/views/detail-best-efforts-logic.ts` | Detail-view panel rows | `BestEffortPanelRow` gains a `contaminated`/`contaminatedReason` pair, mirroring `demoted`/`demotionReason` |

### New files (following house naming conventions)

| File | Purpose | Precedent mirrored |
|------|---------|---------------------|
| `scripts/compute-clean-window-diff.mjs` | PR-09's archive-wide before/after diff, dev-signed | `scripts/compute-pr-ceiling-diff.mjs` |
| `scripts/compute-clean-window-recount.mjs` | PR-09's classifier-independent reconciliation leg (zero-import, D-13) | `scripts/compute-pr-ceiling-recount.mjs`, `scripts/compute-elevation-recount.mjs` |
| `scripts/compute-ceiling-recalibration.mjs` | D-09's `36-CEILING-RECALIBRATION.md` generator | `scripts/compute-pr-ceiling-calibration.mjs` (28-CEILING-CALIBRATION.md's own generator) |
| `.planning/phases/36-.../36-CEILING-RECALIBRATION.md` | D-09's artifact of record | `28-CEILING-CALIBRATION.md`, `30-CALIBRATION.md` |

Each `.mjs` generator needs its own `.test.mjs` sibling proving idempotence (run twice, byte-identical
except `generatedAt`) — the standing Pitfall 13 discipline.

**Installation:** none — `npm install` is not needed for this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages (confirmed against `REQUIREMENTS.md` §
Out of Scope, "New runtime dependencies" row, and cross-checked against `package.json` — no new
dependency is implied by any locked or delegated decision). The `slopcheck`/registry-verification
protocol is skipped entirely; nothing here needs it.

## Architecture Patterns

### System Architecture Diagram

```
data/streams/{id}.json (t, d)  ── committed, byte-identical, tracked in git (NOT gitignored)
data/activities/{id}.json      ── committed activity metadata (distance, max_speed)
        │
        ▼
compute-best-efforts.ts: per-activity loop (existing, reads t/d + activity today)
        │
        ├─► pace-derivation.ts: classifyGapsWithSegments(t, d)
        │       └─► segments: UnreliableSegment[]  (detector's own index-based spans)
        │
        ▼
computeActivityEfforts(input)  ── Pass 1, BEFORE the "PASS 2" source-text marker
        │
        ├─ raw = findBestEffort(t, d, target)                      [existing, unconstrained]
        ├─ subIntervals = complement of segment spans, by INDEX    [NEW: partition, D-01]
        ├─ clean = min over subIntervals of
        │           findBestEffort(t, d, target, {startIndex, endIndex})  [reused sweep, bounded]
        ├─ if raw's [startOffsetSec,endOffsetSec] overlaps ANY segment (D-04, structural):
        │     contaminated = { guard: 'unreliable-segment', reason, ...raw }
        │   else: contaminated = null
        ├─ if clean exists:
        │     top-level durationSec/paceSecPerKm/.../demotion = isPlausible(clean)/ceiling(clean)
        │        — EXISTING absolute-guard code path, UNCHANGED, now fed the clean figure (D-08)
        │   else (D-06, no clean window):
        │     top-level durationSec/paceSecPerKm = raw (contaminated) figure
        │     demotion = { guard: 'unreliable-segment', reason }   — short-circuits; isPlausible
        │        is NOT independently evaluated (empirically vacuous on the live archive — see D-08)
        │
        ▼
Pass 1 byDistance accumulation (compute-best-efforts.ts:249-333)  ── UNCHANGED code
        — only admits demotion:null efforts; a contaminated-but-clean effort's CLEAN duration
          is what's admitted; a no-clean-window effort is excluded exactly as any other demotion
        ▼
Pass 2 deriveCeilings (best-effort-ceiling.ts)  ── UNCHANGED, non-circular by construction
        ▼
Pass 3 ceilingDemotion sweep  ── UNCHANGED, applies to the clean figure exactly as today
        ▼
data/stats/best-efforts.json + data/stats/best-efforts/{id}.json shards
        │
        ├─► src/dashboard/data/best-efforts-client.ts  (browser, total parse, D-06 guard added)
        │        ├─► detail-best-efforts-logic.ts  (D-15: contaminated figure + reason, same view)
        │        └─► records-logic.ts               (D-16: walk-the-document disclosure)
        │
        └─► scripts/compute-clean-window-diff.mjs      (PR-09 leg 1: diff, throwaway paths)
            scripts/compute-clean-window-recount.mjs    (PR-09 leg 3: zero-import recount)
            (leg 2 = D-03's overlap invariant, reads the detector's own segments directly)
```

### Component Responsibilities

| File | Today | Phase 36 change |
|------|-------|------------------|
| `best-effort-utils.ts` | `findBestEffort(t, d, targetMeters)` — full-array two-pointer sweep | Gains `startIndex`/`endIndex` optional params (default `0`/`t.length`), no behavior change when omitted |
| `best-effort.types.ts` | `EffortDemotionGuard = 'world-record' \| 'max-speed' \| 'ceiling'`; `ComputedEffort` has no contamination field | `EffortDemotionGuard` gains `'unreliable-segment'`; `ComputedEffort` gains `contaminated: {...} \| null` |
| `compute-best-efforts.ts` | `computeActivityEfforts` takes only `t`/`d`, calls `findBestEffort` once per target | Caller (the per-activity loop, ~line 264) also calls `classifyGapsWithSegments(t, d)` and passes `segments` into `computeActivityEfforts`'s input; the function itself gains the partition-and-search step |
| `best-effort-ceiling.ts` | Pure, reads only `byDistance` (already-filtered population) | **No change** — see D-14 for the call-graph proof |
| `best-effort-ceiling-state.ts` | Unconditional write when `ceilingMovement.length > 0` | Gated behind D-11's new opt-in flag (see below) |
| `best-efforts-client.ts` | `parseDemotion`, `VALID_DEMOTION_GUARDS` (3 members) | `VALID_DEMOTION_GUARDS` gains 4th member; new `parseContaminated` total parser |
| `records-logic.ts` | `countDemotedAtDistance`'s switch buckets unknown guards to `other` | Gains explicit `'unreliable-segment'` case; new walk-the-document function for D-16's disclosure |
| `detail-best-efforts-logic.ts` | `BestEffortPanelRow.demoted`/`.demotionReason` | Gains `.contaminated`/`.contaminatedReason`, new badge spec (D-15) |

### Recommended Project Structure

```
src/analytics/
├── best-effort-utils.ts        # MODIFIED — findBestEffort gains startIndex/endIndex bounds
├── best-effort.types.ts        # MODIFIED — EffortDemotionGuard + ComputedEffort.contaminated
├── compute-best-efforts.ts     # MODIFIED — Pass 1 partition-and-search, before "PASS 2" marker
├── best-effort-ceiling.ts      # UNCHANGED
├── best-effort-ceiling-state.ts # MODIFIED — write gated behind new opt-in option (D-11)
└── pace-single-source.test.ts  # optionally extended — see "Don't Hand-Roll" note on sweep reuse

src/dashboard/data/
└── best-efforts-client.ts      # MODIFIED — parseContaminated, VALID_DEMOTION_GUARDS 4th member

src/dashboard/views/
├── records-logic.ts            # MODIFIED — switch case, walk-the-document disclosure (D-16)
└── detail-best-efforts-logic.ts # MODIFIED — panel row contaminated fields (D-15)

scripts/
├── compute-ceiling-recalibration.mjs   # NEW — D-09's 36-CEILING-RECALIBRATION.md generator
├── compute-ceiling-recalibration.test.mjs
├── compute-clean-window-diff.mjs       # NEW — PR-09 leg 1 (diff), mirrors compute-pr-ceiling-diff.mjs
├── compute-clean-window-diff.test.mjs
├── compute-clean-window-recount.mjs    # NEW — PR-09 leg 3 (zero-import recount)
└── compute-clean-window-recount.test.mjs

.planning/phases/36-.../
├── 36-CEILING-RECALIBRATION.md         # NEW — D-09's artifact of record
└── 36-DIFF.md (or similar)             # NEW — PR-09's signed diff, mirrors 28-DIFF.md
```

### Pattern 1: Partition via index-bounded sweep reuse, never splice

**What:** `findBestEffort` gains two optional parameters, `startIndex = 0` and `endIndex =
t.length`, and internally operates only on `t[startIndex..endIndex)`/`d[startIndex..endIndex)` —
implemented by adjusting the existing loop bounds (`for (let i = startIndex; i < endIndex; i++)`,
`j` starts at `Math.max(j, startIndex + 1)`, `j < endIndex` in the while condition), never by
`Array.prototype.slice`. This is the "optional index-range parameters" branch of CONTEXT.md's own
discretion note, and is preferable to slicing for one concrete reason not stated there: slicing
`t`/`d` per sub-interval allocates a new array per sub-interval per target distance per activity —
at ~1,874 activities × up to 7 distances × up to a handful of sub-intervals each, that is a real,
avoidable allocation cost; index bounds are zero-copy.

**When to use:** Any time the clean-window search needs to restrict the sweep to a sub-range of the
full stream — i.e., always, once segments exist for an activity.

**Example (illustrative signature change, not verbatim production code):**
```typescript
// src/analytics/best-effort-utils.ts
export function findBestEffort(
  t: number[],
  d: number[],
  targetMeters: number,
  bounds?: { startIndex: number; endIndex: number }
): RawEffort | undefined {
  const lo = bounds?.startIndex ?? 0;
  const hi = bounds?.endIndex ?? t.length;
  const n = hi - lo;
  if (n < 2 || d[hi - 1] - d[lo] < targetMeters) return undefined;

  let best: RawEffort | undefined;
  let j = lo;

  for (let i = lo; i < hi; i++) {
    if (j < i + 1) j = i + 1;
    while (j < hi && d[j] - d[i] < targetMeters) j++;
    if (j >= hi) break;
    // ...identical interpolation math below, unchanged...
  }
  return best;
}
```
Every existing call site (`computeActivityEfforts`'s current single call) omits `bounds` and is
behavior-identical — `lo=0, hi=t.length` reproduces today's full-array sweep exactly. This is a
**zero-risk, additive** signature change; no existing test needs to change.

**Partition construction (the clean sub-interval list, D-01):** sort segments by `startIndex`,
walk the stream computing the complement:
```typescript
function complementSubIntervals(
  streamLength: number,
  segments: readonly UnreliableSegment[]
): Array<{ startIndex: number; endIndex: number }> {
  const cuts = [...segments].sort((a, b) => a.startIndex - b.startIndex);
  const subs: Array<{ startIndex: number; endIndex: number }> = [];
  let cursor = 0;
  for (const seg of cuts) {
    if (seg.startIndex > cursor) subs.push({ startIndex: cursor, endIndex: seg.startIndex });
    cursor = Math.max(cursor, seg.endIndex);
  }
  if (cursor < streamLength) subs.push({ startIndex: cursor, endIndex: streamLength });
  return subs;
}
```
This is exactly the "whole merged segment span" reading (D-01) — cutting at `seg.startIndex`/
`seg.endIndex`, the SAME index range `classifyGapsWithSegments`'s own Pass 3 already uses to
reclassify pairs as `'unreliable'` (`pace-derivation.ts:576`: `for (let i = seg.startIndex; i <
seg.endIndex; i++)`). Reusing this exact boundary convention — rather than inventing a second one
keyed off `parts[].kind === 'burst'` sub-ranges — means the clean-window search excludes precisely
the same real-time span the pace chart/histogram/coverage caption already clip, so "clean" means
the same thing everywhere in the codebase. **[VERIFIED, this research session, 2026-09-28]:** ran
both readings (whole-span vs burst-only cut lists) against the three named scoping activities and a
sample of the archive; CONTEXT.md's finding 1 (identical moved/unchanged/lost counts, identical
ceilings to 4dp, only the cut LIST differs) reproduces — see "Don't Hand-Roll" for the recommended
committed equivalence test shape.

**Best-window selection across sub-intervals:** take the minimum-duration result across all
sub-intervals — `findBestEffort` already returns `undefined` for a sub-interval too short to hold
the target distance, so a plain `for` loop with an `undefined`-safe running minimum suffices:
```typescript
let clean: RawEffort | undefined;
for (const sub of complementSubIntervals(t.length, segments)) {
  const candidate = findBestEffort(t, d, targetMeters, sub);
  if (candidate && (!clean || candidate.durationSec < clean.durationSec)) clean = candidate;
}
```

### Pattern 2: `contaminated` is a strictly additive sibling field; the top-level fields are ALWAYS the clean result

**What:** `ComputedEffort.contaminated: { guard: 'unreliable-segment'; reason: string; durationSec:
number; paceSecPerKm: number; startOffsetSec: number; endOffsetSec: number } | null` (D-05, locked).
Populated whenever the RAW (unconstrained) `findBestEffort` result's interval overlaps at least one
detected segment (D-04's structural trigger — never a movement threshold). The top-level
`durationSec`/`paceSecPerKm`/`startOffsetSec`/`endOffsetSec`/`demotion` fields describe the CLEAN
result when one exists, or the contaminated figure (with `demotion` set) when none does (D-06).

**Why this is the ONLY safe shape (Anti-Pattern 3, from `.planning/research/ARCHITECTURE.md`):**
Pass 1's accumulator (`compute-best-efforts.ts:304`, unchanged) skips any effort whose `demotion` is
non-null. If the top-level fields kept today's single contaminated `findBestEffort` result and
merely attached a 4th guard's `demotion` to it (the naive "just add a guard" shape), the activity
would contribute **nothing** to `byDistance` for that distance — not even its genuine clean time —
silently shrinking the ceiling's population for a run that DID complete the distance cleanly. This
is a real correctness bug the naive shape produces, not a hypothetical.

**Why `best-effort-ceiling.ts` needs zero code change (resolves the "no code change required"
claim independently, D-14):** `deriveCeilings`/`deriveCeiling` only ever read
`impliedSpeedsByDistance`, itself built from `byDistance`, itself built ONLY from efforts whose
`demotion` field is `null` AND which are not excluded (`compute-best-efforts.ts:304,`
unchanged code, re-read this session). Once the top-level `durationSec` is always the CLEAN figure,
a contaminated timing can never reach `byDistance` — not because of a new filter, but because the
existing filter (`effort.demotion !== null`) already excludes it structurally whenever no clean
window exists, and because the clean figure IS what's stored when one does. No new parameter, no
new branch, no new import in `best-effort-ceiling.ts`.

### Pattern 3: Detector consumption stays inside `compute-best-efforts.ts`'s caller, never inside `best-effort-utils.ts`

**What:** `best-effort-utils.ts` (where `findBestEffort` lives) is pure, has zero `fs`/Node imports,
and is reachable from the dashboard bundle transitively through `best-effort.types.ts` — this
purity rule is stated in `best-effort-ceiling.ts`'s own header ("Phase 26 D-15's purity rule") and
holds for `best-effort-utils.ts` too (verified — no import of `fs`/`path` anywhere in the file
today). `classifyGapsWithSegments` needs `t`/`d` only and is itself pure — but the CALL to it inside
`computeActivityEfforts` should happen in `compute-best-efforts.ts`'s per-activity loop (which
already reads `t`/`d` off disk at line 270 today) or be threaded as an added `input.segments` field
on `ActivityEffortInput`, computed by the caller before invoking `computeActivityEfforts`. Either
shape keeps `computeActivityEfforts` itself pure and unit-testable exactly as today (the "fixture-
validation suite... calls directly without any file writing" docblock claim at
`compute-best-efforts.ts:108-109` must remain true).

**Recommended:** add `segments: UnreliableSegment[]` to `ActivityEffortInput` (computed by the
caller via `classifyGapsWithSegments(t, d).segments`, passed in alongside `t`/`d`), rather than
having `computeActivityEfforts` call the detector itself. This keeps `computeActivityEfforts`'s own
signature testable with a synthetic `segments` array (no need to construct a real gap-riddled
stream to test the partition logic in isolation) and matches the existing pattern where the caller
assembles `ActivityEffortInput` from several independently-read sources.

**This also satisfies SEG-05b's Phase 36 half** (per Phases 33/34/35's precedent, "proven
load-bearing by stubbing"): a test that stubs `classifyGapsWithSegments` (or passes a synthetic
`segments` array) to return `[]` must show the clean-window search collapsing to today's
unconstrained behavior (raw === clean, `contaminated` always null), and a test that passes a
non-empty `segments` array must show the search actually partitioning — both directions
demonstrate the detector's output is load-bearing, not merely imported.

### Anti-Patterns to Avoid

- **Splicing (deleting samples, re-running the sweep over the reduced array):** PR-06's own
  criterion 2 exists to demonstrate this wrong. Confirmed empirically this session — see D-02
  verification below; a splice variant CAN produce a faster-than-honest answer on a real fixture.
- **A second, burst-only cut-list convention diverging from `classifyGapsWithSegments`'s own Pass 3
  reclassification boundary:** would create exactly the class of defect 32-13/32-17 already fixed
  twice (two disagreeing boundary conventions for "what counts as inside the segment").
- **Calling `detectUnreliableSegments` directly from `compute-best-efforts.ts` or
  `best-effort-utils.ts`:** `pace-derivation.ts`'s `classifyGapsWithSegments` is the one sanctioned
  accessor (its own docblock, re-read this session: "the detector's own gaps argument... so
  `classifyGaps` stays the ONE definition of what a gap is"). A direct second call site would
  re-run the detector twice per activity and risk the two results disagreeing.
- **Re-deriving segment overlap by float `startSec`/`endSec` comparison instead of the detector's
  own index range:** `classifyGapsWithSegments`'s own docblock states this explicitly as the exact
  defect class 32-13/32-17 fixed. The overlap check for `contaminated` population (raw window vs
  segments) and D-03's archive-wide invariant should both use index-based containment where
  possible, or at minimum the exact same float-boundary semantics `isGapPair`/Pass-3 use
  (`seg.startSec <= x && y <= seg.endSec`-style inclusive bounds), not an ad hoc strict-inequality
  variant invented fresh for this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Minimum-duration window over a monotonic distance series | A second two-pointer sweep inside the partition/search code, or inside a new recount script | `findBestEffort`, extended with `startIndex`/`endIndex` (Pattern 1) | It is already O(n), already interpolation-correct at the crossing, already unit-tested (`best-effort-utils.test.ts`); a second implementation is drift risk with **no existing automated guard today** (see Summary finding 2) |
| Percentile derivation | A new percentile function for the recalibration artifact | `percentileNearestRank` (`best-effort-ceiling.ts:81`) | Already the house's one percentile definition (`STACK.md`'s stated reason for zero new dependencies) |
| Gap/segment classification | A second per-pair speed scan inside `compute-best-efforts.ts` | `classifyGapsWithSegments` (Pattern 3) | The one sanctioned accessor; a second scan is Anti-Pattern 1 from `.planning/research/ARCHITECTURE.md`, a historically-real defect shape in this codebase (`detail-zones.ts`'s `maskedPaceSeries` incident) |
| Archive-wide before/after diff scaffolding | A bespoke diff script from scratch | `compute-pr-ceiling-diff.mjs`'s shape (throwaway `statsDir`/`ceilingStatePath`, pure exported functions + gated `main()`) | Directly precedented, already reviewed, already proven not to mutate what it describes |
| Classifier-independent recount | A recount that imports `compute-best-efforts.js`/`best-effort-ceiling.js` "just for the constants" | `compute-pr-ceiling-recount.mjs`'s zero-import shape, own local `TARGET_METERS_LOCAL` copy | Importing anything from the classifier under test reproduces Pitfall 11/D-13's exact forbidden shape — "18 = 18" |

**Key insight:** every primitive this phase needs (sweep, percentile, gap/segment classification,
diff scaffolding, zero-import recount pattern) already exists in this codebase, proven and tested.
The entire phase is composition and one new field, not new algorithms.

**Committed equivalence test for D-01 (whole-span vs burst-only), concrete shape:** follow
`pace-derivation.test.ts`'s own precedent — it already reads the REAL committed archive directly
inside a vitest test (`fs.readFileSync(path.join('data/streams', ...))`, confirmed at
`pace-derivation.test.ts:12,65-68`; `data/streams/` is tracked in git, not gitignored — confirmed
via `.gitignore`, only `data/stats/`, `data/dashboard/`, `data/tokens.json`, `data/private/*.json`
are excluded). A new test (in `compute-best-efforts.test.ts` or a sibling
`clean-window-equivalence.test.ts`) should: read `data/streams/manifest.json` and every available
activity's stream, build BOTH cut lists (whole-span from `UnreliableSegment.startIndex/endIndex`,
burst-only from `parts.filter(p => p.kind === 'burst')`) per activity, run the partition-and-search
logic with each, and assert the resulting moved/unchanged/no-clean-window counts and every
per-distance ceiling agree (ceilings to a stated decimal tolerance, matching this codebase's
existing `toBeCloseTo` convention in the "no iteration to convergence" test). This is a genuine
full-archive sweep inside `npm test` — acceptable cost, precedented by `pace-derivation.test.ts`'s
own "archive-wide over-fire sweep" (same file, line 282) and by `npm test`'s current 3,676-test/
~30s baseline (measured this session).

## Common Pitfalls

This phase has **two pitfalls in `.planning/research/PITFALLS.md` written specifically for it**
(Pitfall 7 and 8), not cited in CONTEXT.md's own pitfall list (which names 3, 5, 11, 12, 13) —
surfacing them here since they are the two most directly applicable.

### Pitfall 7: Clean-window search returns a window abutting (not avoiding) the excluded segment

**What goes wrong:** A splice-and-restitch implementation interpolates a crossing that straddles the
splice point, treating the removed segment's distance as covered in zero time — this can fabricate
an EVEN FASTER window than the original contaminated one, or return a "clean" window whose boundary
sample sits exactly on the excluded segment's edge.

**Verified this session (D-02's exact locked fixture, `3475740390`@400m, d-rebased splice variant):**

| Variant | Duration | Pace |
|---|---|---|
| Today (raw, unconstrained) | 79.9s | 3:20/km |
| Partition (honest, index-bounded per-sub-interval) | 119.6s | 4:59/km |
| Naive splice (delete segment samples, re-run sweep) | 82.3s | 3:26/km |
| **d-rebased splice** (delete + subtract segment metres from `d` downstream) | **116.6s** | **4:51/km** |

This independently reproduces CONTEXT.md's cited numbers almost exactly (their table: honest
119.6s/4:59, d-rebased 4:51 — my `durationSec`/pace match to within rounding). **The d-rebased
splice IS faster than the honest partition answer on this exact fixture (116.6s < 119.6s)** — this
is the reachability proof that criterion 2's test is satisfiable in the "must fail" direction: a
plausible-looking splice variant genuinely fabricates a faster window than partitioning does, on
the locked, real fixture.

**Caution — a discrepancy found, not silently absorbed:** CONTEXT.md's D-02 rationale additionally
claims the SAME d-rebased variant on `3475724402` is *slower* than partition (4:57 > 4:50, the
reason that pairing was rejected as unsatisfiable). This research's own quick re-implementation of
the d-rebased splice produced **4:50 — identical to partition**, not 4:57, on that activity. This
does not affect the locked decision (D-02 pins `3475740390`, confirmed above, not `3475724402`) but
the planner/implementer should independently re-derive the `3475724402` supporting figure during
Wave 0 rather than copy either number — my probe and CONTEXT.md's probe may differ in a minor detail
(e.g., D-01's granularity choice, or a boundary-sample edge case) and neither should be trusted
uncritically for a number that is not itself the locked test row.

**How to avoid in the shipped code:** never build a combined/stitched array (Pattern 1 above — index
bounds, never splicing/slicing across a segment boundary).

### Pitfall 8: Removing contaminated efforts shifts the ceiling population, re-litigating settled demotions

**What goes wrong:** `deriveCeiling`'s p90 is population-sensitive by design. Once contaminated
efforts move out of the ceiling's input (because the clean figure, not the raw one, populates
`byDistance`), every distance's ceiling can shift — silently promoting a previously-ceiling-demoted
effort back above a (now-lower) ceiling, or the reverse.

**Verified this session:** CONTEXT.md's own probe table already shows this concretely (10k rises
+0.0318 while every other distance falls; half loses its ceiling entirely, 104→69, below
`CEILING_MIN_POPULATION`). This is not hypothetical for this phase — it is the archive's actual,
measured behavior. PR-08's own criterion 3 ("a recalibration reporting zero movement is treated as
requiring its own explanation") and D-12 exist precisely because of this pitfall.

**How to avoid:** ship the recalibration artifact (D-09) and the signed diff (PR-09) in the SAME
phase as the exclusion logic — already locked by the phase boundary — and never defer it. Order
operations so exclusion runs strictly before derivation (PR-08, already the existing three-pass
shape; Pattern 2 above shows this requires zero new ordering code because the structural filter
already enforces it).

### Pitfall 3 (from PITFALLS.md, cited in CONTEXT.md): capped slews diluted below detection

Already closed by Phase 32's calibration (run-level aggregate speed, not per-sample) — this phase
inherits `UnreliableSegment`s as given; no new detection math here. Relevant only in that the
partition search must trust the detector's segment list as-is (never re-derive a "is this really
unreliable" judgment inside the best-effort code).

### Pitfall 5 (cited): threshold circularity

Not directly applicable — this phase introduces no new calibrated constant (D-04 explicitly forbids
one). The one place circularity COULD sneak in — `CEILING_K`/`CEILING_MIN_POPULATION` being nudged
to "fix" the half-marathon fail-open — is explicitly barred by D-10.

### Pitfall 11 (cited): verification recount shares the classifier's blind spot

Directly governs D-13 (PR-09's third leg) — see that section below for the concrete zero-import
design.

### Pitfall 12 (cited): a synthetic fixture that doesn't discriminate the real one

Governs D-02/D-03's regression fixtures — all recommended fixtures above (`3475740390`,
`3475724402`, `3475734189`, `3475713251`, `3475725842`) are real archive activity IDs with
independently-verified measured numbers, never hand-rolled round numbers.

### Pitfall 13 (cited): generated artifacts silently revert or diverge on regeneration

Governs D-09/PR-09's three new artifacts — each needs a `.test.mjs` sibling proving idempotence
(run twice, byte-identical except `generatedAt`), mirroring the discipline already shipped for
`28-DIFF.md`/`28-CEILING-CALIBRATION.md`.

## The Nine Delegated Decisions — Resolution

### D-01: Exclusion granularity — whole merged segment span

**Recommendation:** partition cut points at `UnreliableSegment.startIndex`/`.endIndex` (the whole
merged span), NOT `parts[].kind === 'burst'` sub-ranges.

**Why:** (1) CONTEXT.md's own finding 1 measured these as producing identical moved/unchanged/lost
counts and identical ceilings to 4dp — so there is no ranking-outcome cost to the simpler choice.
(2) The whole-span boundary is the EXACT SAME index range `classifyGapsWithSegments`'s Pass 3
already uses to reclassify pairs as `'unreliable'` (`pace-derivation.ts:575-579`) — reusing it means
"clean" means the same real-time span everywhere in the codebase (pace chart, histogram, coverage
caption, and now best efforts), rather than best efforts alone excluding a narrower span than
everything else already excludes. (3) A burst-only reading would be a SECOND boundary convention,
the exact class of defect 32-13/32-17 fixed twice (disagreeing gap-boundary conventions silently
dropping metres/seconds).

**Committed equivalence test:** see "Don't Hand-Roll" above — a full-archive vitest suite computing
both readings and asserting agreement, so divergence becomes a visible CI failure rather than silent
drift, per D-01's own bound.

### D-07: Reason string wording — bounded, numeric, independently recomputable

**Recommendation, following the house register** (`isPlausible`'s existing reason strings, `best-
effort-ceiling.ts`'s `ceilingDemotion` reason — named condition + measured numbers, never an
adjective, Phase 27 D-09):

For a **single**-segment case: `"window t=<start>-<end>s intersects an unreliable segment at
t=<segStart>-<segEnd>s (<mechanism>, <metres>m/<seconds>s)"`.

For the **multi-segment** case (finding 3, verified this session on `3475740390`@400m — the raw
window `t=2508-2587.9` intersects exactly 4 real segments: `isolated-jump` 52.4m/5s at t=2508,
28.6m/2s at t=2536, 30.4m/3s at t=2580, 24.7m/2s at t=2587), name up to a small fixed cap of
segments individually, then a trailing count — e.g. `"window t=2508-2588s intersects 4 unreliable
segments (isolated-jump 52.4m/5s at t=2508; isolated-jump 28.6m/2s at t=2536; +2 more)"` with a cap
of 2-3 named inline. This mirrors the SHARD_LIST_CAP discipline already shipped
(`pace-quality.ts:2088`, "same cap as `impossibleSamples`/`unreliableSegments`" — read/render side,
per the still-open `2026-09-23-read-and-render-caps-for-shard-lists.md` todo, which this phase
should NOT attempt to fix (explicitly out of scope, Phase 33/34 surface) but should be consistent
with in spirit for a NEW string).

**Independently recomputable (PR-09's reconciliation bound):** every number named in the reason
(segment start/end, metres, seconds, mechanism) is read directly off `UnreliableSegment` fields —
never re-derived or rounded differently than the detector's own output — so PR-09's reconciliation
script can parse or re-derive the claim without importing the best-effort code, only the shipped
document + a fresh `classifyGapsWithSegments` call (D-13, see below).

### D-08: Precedence — unreliable-segment resolves the input FIRST; it is structural, not competitive

**Recommendation:** state explicitly in the `ComputedEffort.demotion`/`.contaminated` docblock
(mirroring `best-effort.types.ts:120-126`'s existing precedence prose) that:

> The clean-window search (unreliable-segment exclusion) resolves which duration reaches the
> existing absolute-guard/ceiling pipeline — it runs conceptually BEFORE `isPlausible`/
> `ceilingDemotion`, not as a fourth guard racing to overwrite `demotion` on the same duration.
> When a clean window exists, `isPlausible`/`ceilingDemotion` evaluate ONLY the clean figure —
> exactly as today, unmodified. When no clean window exists (D-06), `demotion` is set directly to
> `{ guard: 'unreliable-segment', reason }` and `isPlausible` is never independently evaluated
> against the contaminated figure — mirroring the existing "once `demotion` is non-null, no later
> pass re-evaluates it" invariant this file already states for world-record/max-speed vs ceiling.

**Reachability, checked in both directions this session (a real probe against the live archive,
2026-09-28):**

- **The literal bound as written — "a real activity that trips both, in the D-06 no-clean-window
  case" — is UNSATISFIABLE today.** Swept all 1,874 available activities × 7 distances: 440
  occurrences where the raw window intersects a segment AND no clean sub-interval covers the target
  distance (matches CONTEXT.md's cited ~439 closely). **Zero** of those 440 ALSO independently fail
  `isPlausible` (world-record or max-speed) on the raw/contaminated timing. A test row phrased
  exactly as CONTEXT.md's bound states it would be **vacuous** — it could never be exercised on real
  data, only a synthetic fixture.
- **The bound IS satisfiable for the adjacent, structurally-relevant case: raw fails an absolute
  guard AND a clean window exists.** 31 real activity/distance pairs found (all in the same batch of
  short/slow activities carrying an isolated-jump burst — e.g. a walk with one large GPS jump).
  Concrete fixtures, both independently verified this session:
  - **`3475725842`@400m**: raw duration 14.2s, implied speed 28.19 m/s, fails `max-speed`
    (activity's own recorded `max_speed` 6.08 m/s) — clean window exists at 122.9s (3.25 m/s,
    plausible). **Recommended primary fixture** — max-speed is activity-specific (not a shared
    constant), making the "trips both, resolved by using the clean figure" demonstration concrete
    and non-generic.
  - **`3475713251`@400m**: raw duration 27.1s, implied speed 14.75 m/s, fails `world-record` (9.30
    m/s) — clean window exists at 133.7s (2.99 m/s, plausible).
  - Both are also, incidentally, **retroactive un-demotions**: today (before this phase), these
    efforts ARE demoted with `guard: 'world-record'`/`'max-speed'` (since today's single
    unconstrained sweep result IS what `isPlausible` currently evaluates). After this phase, both
    rank normally on their clean figure with `demotion: null` and `contaminated` populated. This is
    exactly the "reinstated effort" population `PR-09`'s diff must capture (ROADMAP criterion 4) —
    **not purely a ceiling phenomenon; some reinstatements will come from the absolute guards too.**
    Flag this for the planner: PR-09's diff generator must reconstruct "OLD" state the same way
    `compute-pr-ceiling-diff.mjs` does today (drop world-record/max-speed-demoted efforts, retain
    everything else) but the retained population's OLD duration must be the ORIGINAL (pre-Phase-36)
    unconstrained sweep result, not the new clean-window result — this is a genuinely new
    reconstruction rule PR-09's diff needs, distinct from Phase 28's.

**Recommended test:** demonstrate the precedence rule with `3475725842`@400m (or `3475713251`) as a
real-activity regression fixture — assert the shipped effort's `demotion` is `null`, its top-level
`paceSecPerKm` matches the clean figure, and `contaminated.guard === 'unreliable-segment'` while
`contaminated.reason` still names the segment (not "max-speed"/"world-record" — those never
independently fire on the CLEAN figure at this activity's slow pace). Do not attempt to construct a
no-clean-window-and-independently-implausible fixture — none exists on the live archive; a
synthetic one would violate the "traced to real activity IDs, not look-alikes" convention
(Pitfall 12) and should be flagged, not silently built, if the plan wants that exact combination
tested.

### D-11: Write-gate mechanism — explicit opt-in flag, off by default

**Recommendation:** add `writeCeilingState?: boolean` (default `false`) to
`ComputeBestEffortsOptions`; gate the existing conditional write at `compute-best-efforts.ts:569`
behind `options.writeCeilingState && ceilingMovement.length > 0` (both conditions, not either).
Thread a new `--write-ceiling-state` CLI flag through `computeBestEffortsCommand()` (`index.ts`)
and through the `compute-best-efforts` step in `compute-all-stats-steps.ts` — **verified this
session:** neither currently receives any per-invocation flag distinguishing CI from a local run
(the existing `--ci` flag only controls `continueOnError` at `index.ts:317`, it is never threaded
into the `compute-best-efforts` step's closure). Update `.github/workflows/daily-refresh.yml`'s
`compute-all-stats --ci` invocation to also pass `--write-ceiling-state` (or an equivalent env var
the workflow alone sets); leave `npm run compute-best-efforts`, `npm run compute-all-stats`, and
`npm run process` all defaulting to `false`.

**Why this satisfies both bounds:** (1) "reproducible from a clean checkout" — the derived
`best-efforts.json`/`ceilings` output is unaffected by the flag; only the COMMITTED
`data/best-effort-ceiling.json` write is gated, so a clean checkout always re-derives the same
ceilings regardless of the flag. (2) "not rewritable as a side effect of an unrelated local
command" — an ordinary developer running `npm run compute-all-stats` (e.g., after a curation edit,
per `daily-refresh.yml`'s own comment about running it "BEFORE compute-all-stats so
`compute-best-efforts` reads the edited [exclusions]") never touches the committed ceiling file;
only the CI workflow's own invocation, or an explicit, deliberate manual flag, does.

**PR-09's own diff/recount generators are unaffected** — they already use throwaway
`ceilingStatePath` values (`compute-pr-ceiling-diff.mjs`'s existing pattern), so they never read
`options.writeCeilingState` at all; this is an orthogonal, already-solved concern for those scripts.

### D-12: Recalibration artifact explanation depth — every row gets a stated, measured cause

**Recommendation:** `36-CEILING-RECALIBRATION.md`'s generator must, for every distance row (D-12's
bound — zero movement AND upward movement both need an account, not just downward):

1. Report population before/after, p90 before/after, ceiling before/after (mirroring
   `28-CEILING-CALIBRATION.md`'s existing table shape).
2. For any row where population dropped: name which activity/distance pairs LEFT the population
   (moved to `contaminated`+clean-ranking, or moved to no-clean-window) — a finite, listable set,
   since `effortsDemoted`-style walking of the shipped document already gives exactly this
   population.
3. For the 10k-style upward case specifically (CONTEXT.md's probe: 10k rose despite population
   *shrinking* 1468→1147): this is NOT paradoxical — removing the SLOWEST members of a population
   (the contaminated efforts, which are typically SLOWER once genuinely clean, per this session's
   own verified numbers — e.g. `3475740390`@400m's clean figure, 4:59/km, is far slower than its
   contaminated 3:20/km) raises the p90 of what remains. State this mechanism explicitly in the
   generator's prose (parameterized by the actual measured before/after populations, never a fixed
   string), not merely the number.
4. For a zero-movement row: state explicitly that zero activities at that distance carried a segment
   intersecting their best-effort window (a directly checkable, machine-derived claim, not an
   assumption).

**Generated, not hand-written** — like `28-CEILING-CALIBRATION.md`'s reconciliation-drift paragraph,
every sentence above must be templated from measured values the generator itself computes, never a
human-typed explanation risking Pitfall 13's revert-on-regeneration trap.

### D-13: PR-09's third reconciliation leg — zero-import, different algorithm, watched failing first

**Recommendation:** `scripts/compute-clean-window-recount.mjs`, following
`compute-pr-ceiling-recount.mjs`'s exact shape (zero imports of `dist/analytics/{compute-best-
efforts,best-effort-ceiling,best-effort-utils,best-effort.types}.js`, by any spelling), reading only
the SHIPPED `data/stats/best-efforts.json` off disk. Its "different algorithm" (bound: not a
rearrangement of the search) is:

- It may import `dist/analytics/pace-derivation.js`'s `classifyGapsWithSegments` and
  `dist/analytics/best-effort-utils.js`'s `findBestEffort` **directly against the raw committed
  stream** (`data/streams/{id}.json`) — this is legitimate because D-13 bars importing "the search"
  (the orchestration inside `compute-best-efforts.ts` that decides granularity, precedence, and
  writes `contaminated`) and "the detector" module... **wait — this needs a sharper reading.**
  `classifyGapsWithSegments` internally calls the SAME `detectUnreliableSegments` the production
  path uses; importing it is importing "the detector" by any reasonable reading of D-13's bar,
  which explicitly forbids that (mirroring D-15 in Phase 32/28's precedent, "never import the
  classifier"). **Recommended instead:** the third leg must NOT call `classifyGapsWithSegments`
  either. It should perform its OWN independent per-pair speed scan directly (a coarser,
  differently-shaped check — e.g., "does ANY sample pair inside this effort's `[startOffsetSec,
  endOffsetSec]` window carry implied speed above a fixed, generously-loose multiple of the
  effort's own OWN mean pace" — genuinely different arithmetic, not a re-derivation of
  `UNRELIABLE_SPEED_LIMIT_MPS`/`excessFloorMetres`/`hiddenPauseMinMetres`). This keeps the
  zero-import property AND satisfies "different algorithm."
- Concretely: for every `contaminated`-bearing or no-clean-window effort in the shipped document,
  re-read the activity's raw stream (`data/streams/{id}.json`, permitted — reading committed data is
  not importing a classifier), and independently confirm that the CONTAMINATED window (named by
  `contaminated.startOffsetSec`/`.endOffsetSec` or, for no-clean, the top-level offsets) contains at
  least one sample-to-sample step whose OWN implied speed is a clear outlier relative to the rest of
  that SAME window's steps (e.g., z-score-style or simple "more than Nx the window's own median
  step speed" — a self-referential, per-window statistic, never importing
  `UNRELIABLE_SPEED_LIMIT_MPS` or any detector constant). This is a genuinely different, coarser
  test: it does not attempt to reproduce the detector's exact boundary, only to confirm "yes,
  something anomalous really is in this window," which is exactly the "structurally asserted" bar
  `compute-elevation-recount.mjs`'s own docblock describes for its sibling leg.
- **Watched failing first (the D-13/D-03 bound):** the recount test suite must include a
  deliberately-broken partitioner fixture — e.g., stub the production partition search to return a
  window it should have excluded (planted violation) — and show `compute-clean-window-recount.mjs`
  failing on that planted output before trusting it on the real shipped document, mirroring
  `unreliable-segments.test.ts`'s own "demonstrated catching a planted second implementation"
  precedent used repeatedly across this milestone.

**Note the honest bound stated in the recount's own header (mirroring `compute-pr-ceiling-
recount.mjs`'s "THE BOUND ON ITS CLAIM"):** this leg verifies that a contaminated window really does
carry SOME anomaly and that the shipped document's own counts/claims are internally consistent
(cross-checking `totals.effortsDemoted`-style counters by walking the document itself) — it does NOT
and cannot arbitrate whether the detector's OWN calibrated constants are exactly right; that is
Phase 32's job.

### D-14: Pass placement — inside Pass 1, positioned before the "PASS 2" source-text marker

**Recommendation:** the partition-and-search step lives inside `computeActivityEfforts` (called from
Pass 1's per-activity loop, `compute-best-efforts.ts:252-333` today), i.e., BEFORE the accumulate
step reads `result.efforts`. This is both candidates named in CONTEXT.md reconciled: it satisfies
"inside Pass 1 at `computeActivityEfforts`" literally, AND it satisfies "ordering visible as its own
step" because the new logic is a clearly-delimited block inside `computeActivityEfforts`'s existing
per-target `for` loop, not interleaved with the existing accumulation logic.

**Verified this session — the existing no-loop audit is UNAFFECTED regardless of exact
placement, as long as the new code's source TEXT sits outside the `PASS 2`...`PASS 3` slice:**
`compute-best-efforts.test.ts`'s "no iteration to convergence" test (line ~1812) does
`source.indexOf('PASS 2')` / `source.indexOf('PASS 3')` and asserts the text BETWEEN those two
literal markers contains no `for`/`while`. `computeActivityEfforts` is defined earlier in the file
(before the `PASS 1` comment even starts), entirely outside this slice. Any code added inside
`computeActivityEfforts` — including its own `for` loops over sub-intervals — is textually outside
the audited slice and cannot break this test, **with zero modification to the test itself**,
regardless of whether the search is framed as "inside Pass 1" or "a new pass between 1 and 2" — both
readings place the code before the literal `PASS 2` marker in source order. This resolves D-14's
"must keep passing unmodified" bound definitively, for either candidate.

**"Contaminated timings never enter the ceiling population" — demonstrable, not asserted (D-14's
second bound):** covered by Pattern 2 above (the structural argument: Pass 1's accumulator only
ever reads `effort.durationSec`, which is always the clean figure). The DEMONSTRATION (not just the
argument) should be a test that: constructs a synthetic activity whose raw window is fast/absurd but
whose clean window is slow, runs it through `computeBestEfforts`, and asserts the DERIVED CEILING
for that distance reflects only the slow (clean) implied speed, never the fast (raw) one — mirroring
the existing "ceiling is non-circular" describe block's own divergence-first methodology
(`compute-best-efforts.test.ts:1833+`, "divergence, then equality-with-filtered, then
populationN equality, in that order").

### D-15: Detail-view presentation — a new badge spec, mirroring the existing `demoted` shape

**Recommendation:** `BestEffortPanelRow` (`detail-best-efforts-logic.ts:99-121`) gains
`contaminated: boolean` and `contaminatedReason: string | null`, populated from
`effort.contaminated != null`/`effort.contaminated?.reason ?? null` (same total-read pattern as the
existing `demoted`/`demotionReason` pair at lines 200-201). A new badge spec branch (alongside the
existing `pr`/`demoted`/`low-confidence`/`excluded` branches at `buildPrFlagBadgeSpecs`, ~line 250+)
fires when `row.contaminated` is true, with copy along the lines of: `visibleText:
row.contaminatedReason ? \`Ranked on clean window — ${row.contaminatedReason}\` : 'Ranked on clean
window'`, `explanation: 'the ranked figure excludes an unreliable segment; the original figure and
its reason are shown here without leaving this view'`. This directly satisfies both bounds: (1)
reachable from the detail view without leaving it (it is a badge on the SAME panel row, like every
other guard's badge), (2) the ranked figure is never presented as if nothing changed — the badge
itself, appearing beside the (now materially different) pace, is the explicit "this figure moved"
signal CONTEXT.md notes is currently missing (today's copy only fires when `demotion !== null`,
which a moved-but-still-ranked effort never sets).

### D-16: Records-view disclosure — walk the shipped document, mirroring `countDemotedAtDistance`

**Recommendation:** a new function, structurally identical to `records-logic.ts`'s existing
`countDemotedAtDistance` (verified this session — walks `Object.keys(activities)`, `activity.efforts`,
counts by a field, respects `excludedFromRecords`), but counting `effort.contaminated != null`
instead of `effort.demotion != null`. This satisfies D-16's bound directly: derived by walking the
shipped document (not an incrementing counter carried through the pipeline), so it cannot drift from
what a consumer actually sees, exactly the `effortsDemoted` precedent CONTEXT.md cites. Surface it
either as a new summary line beside the existing demotion-count sentence (`describeDemotionCounts`'s
sibling), or folded into the SAME sentence with its own clause — either is acceptable; the bound is
about the DERIVATION mechanism, not the exact copy, which is Claude's Discretion within D-16.

## Code Examples

### Existing precedent: total, never-throwing browser-side parser (mirror for `parseContaminated`)

```typescript
// Source: src/dashboard/data/best-efforts-client.ts:53-64 (existing, read in full this session)
function parseDemotion(raw: unknown): EffortDemotion | null {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) return null;
  const { guard, reason } = raw;
  if (typeof guard !== 'string' || !VALID_DEMOTION_GUARDS.has(guard)) return null;
  if (typeof reason !== 'string') return null;
  return { guard: guard as EffortDemotionGuard, reason };
}
```
The new `parseContaminated` should follow this exact shape, additionally validating
`durationSec`/`paceSecPerKm`/`startOffsetSec`/`endOffsetSec` are numbers (mirroring `parseEffort`'s
own field-by-field validation immediately below `parseDemotion` in the same file).

### Existing precedent: throwaway-path diff generator (mirror for `compute-clean-window-diff.mjs`)

```javascript
// Source: scripts/compute-pr-ceiling-diff.mjs:657-681 (existing, read in full this session)
const tempDir = mkdtempSync(join(tmpdir(), 'pr-ceiling-diff-'));
const throwawayStatsDir = join(tempDir, 'stats');
const throwawayCeilingStatePath = join(tempDir, 'ceiling-state.json');
try {
  const newDoc = await computeBestEfforts({
    statsDir: throwawayStatsDir,
    ceilingStatePath: throwawayCeilingStatePath,
    // Phase 36 addition: writeCeilingState defaults false anyway (D-11), so this
    // throwaway ceilingStatePath is now doubly safe — belt and suspenders.
  });
  // ...build report, render markdown, write ONLY to the phase's own .planning/ artifact path...
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `contaminated` field's reason string should cap named segments at a small fixed number (2-3) with a trailing count, mirroring `SHARD_LIST_CAP`'s philosophy | D-07 | Low — this is Claude's Discretion per CONTEXT.md; a different cap number does not change correctness, only readability |
| A2 | `compute-clean-window-recount.mjs`'s "different algorithm" should be a per-window self-referential outlier check (median-step-speed ratio) rather than any variant that re-derives the detector's own constants | D-13 | Medium — if the planner instead reuses `classifyGapsWithSegments` directly, the third leg becomes a re-derivation, not independent, defeating D-13's purpose; this must be caught by a plan-checker or code review before it ships |
| A3 | Threading `--write-ceiling-state` requires modifying `compute-all-stats-steps.ts`'s step-closure shape (currently closures capture only module-level `config`, not per-invocation flags) — assumed straightforward but not verified against every call site | D-11 | Low-Medium — if the step table's construction pattern resists a per-invocation flag more than expected, an env-var gate (`process.env.CI === 'true'`, already set by GitHub Actions) is a simpler fallback with the same safety property |
| A4 | The 31 "raw fails absolute guard, clean window exists" activities found this session are exhaustive for 400m/1k against `TARGET_ORDER`'s first two distances only in effect (the probe swept all 7 distances but nearly all hits cluster at 400m/1k because longer distances rarely have a raw window entirely inside one burst) | D-08 | Low — this is a descriptive finding about today's archive, not a locked constraint; the planner's own Wave-0 sweep (required anyway, since all figures are references to reconcile) will re-derive the exact population |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does the "no clean window AND independently implausible" combination the planner should test
   for D-08 need to exist at all, or is documenting its unsatisfiability sufficient?**
   - What we know: 0 of 440 real no-clean-window occurrences today independently fail an absolute
     guard on their raw figure (verified this session).
   - What's unclear: whether a future archive growth could produce one, and whether the plan should
     therefore still write DEFENSIVE code for that combination (i.e., an explicit precedence rule
     that would apply IF it occurred) even though no real fixture demonstrates it today.
   - Recommendation: write the defensive code (the short-circuit described in D-08's recommendation
     is already correct for this case structurally — `demotion` is set once, unconditionally, before
     any other guard runs), but do NOT invent a synthetic fixture to "prove" it; state in the plan's
     own checkpoint/test design that this exact combination is currently vacuous on the real archive,
     per Pitfall 12's discipline (a synthetic look-alike fixture risks not discriminating the real
     failure mode).

2. **Exact wording/format for D-07's reason string and D-12's generated prose is not fully specified
   here** (deliberately — both are Claude's Discretion bound only by measured-numbers/bounded-length
   and by-cause-explained respectively). The planner should draft exact copy during plan-writing, not
   here.

3. **`compute-all-stats-steps.ts`'s exact mechanism for threading a per-invocation flag into a step
   closure** (Assumption A3) needs a quick read of that file's step-table construction before
   committing to the CLI-flag design over an env-var design — a 5-minute check during Wave 0, not a
   blocking unknown.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing, `package.json` confirms `vitest` devDependency; 101 test files, 3,676 tests, confirmed green this session) |
| Config file | `vitest.config.ts` (existing, unmodified by this phase) |
| Quick run command | `npx vitest run src/analytics/best-effort-utils.test.ts src/analytics/compute-best-efforts.test.ts -t "<name>"` |
| Full suite command | `npm test` (confirmed this session: 101 files / 3,676 tests, ~30s, exit 0 on the current committed tree) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PR-06 | Splice fabricates a faster window than partition on `3475740390`@400m (d-rebased variant) | unit/regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "splice fabricates"` | ❌ Wave 0 — new describe block needed |
| PR-06 | `findBestEffort` with `startIndex`/`endIndex` bounds reproduces full-array behavior when omitted | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "bounds"` | ❌ Wave 0 |
| PR-06 (D-01) | Whole-span vs burst-only cut lists agree archive-wide | integration (full-archive sweep) | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "equivalence"` (or a new sibling `.test.ts`) | ❌ Wave 0 |
| PR-07 (D-05/D-06) | `contaminated` populated when raw intersects a segment and a clean window exists; `demotion` set (not `contaminated`) when no clean window exists | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "contaminated"` | ❌ Wave 0 |
| PR-07 (D-08) | Real activity `3475725842`@400m: `demotion: null`, `contaminated.guard === 'unreliable-segment'`, top-level pace matches the clean figure | regression, real fixture | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "3475725842"` | ❌ Wave 0 |
| PR-08 (D-03) | Archive-wide: every ranked effort's interval overlaps no detected segment | integration, full-archive | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "overlap invariant"` | ❌ Wave 0 — watched failing on a deliberately widened sub-interval first (D-03's own bound) |
| PR-08 (D-14) | Contaminated timings never enter ceiling population — synthetic fast-raw/slow-clean activity, ceiling reflects only the slow speed | unit, synthetic | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "ceiling population"` | ❌ Wave 0 |
| PR-08 | "No loop between PASS 2/PASS 3 markers" audit still passes unmodified | existing regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` | ✅ already exists, must remain green with zero edits |
| PR-09 (D-09) | `36-CEILING-RECALIBRATION.md` regenerates byte-identically twice | idempotence | `node scripts/compute-ceiling-recalibration.mjs && node scripts/compute-ceiling-recalibration.mjs && diff <(git show HEAD:.../36-CEILING-RECALIBRATION.md) .../36-CEILING-RECALIBRATION.md` | ❌ Wave 0 |
| PR-09 (D-13) | Third-leg recount fails on a deliberately-broken (planted) partitioner output before trusting it on real output | guard, watched-failing-first | `npx vitest run scripts/compute-clean-window-recount.test.mjs -t "planted"` | ❌ Wave 0 |
| PR-09 | Three-way reconciliation (diff, guard counts via D-03's invariant, independent recount) agree on the live archive | integration | `node scripts/compute-clean-window-recount.mjs` (exit code, mirrors `compute-pr-ceiling-recount.mjs`'s pass/fail verdict) | ❌ Wave 0 |
| PR-09 | Three scoping activities' 400m efforts (3:20/3:21/3:22 TODAY) pinned as permanent regression fixtures | regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "scoping activities"` | ❌ Wave 0 — note: this pins TODAY's figure as the "before," not the after; re-read ROADMAP criterion 4's exact wording when drafting |
| SEG-05b (Phase 36 half) | Stubbing the detector's segment output to `[]` collapses the clean-window search to today's unconstrained behavior | unit, load-bearing proof | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "stubbed segments"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `-t` filtered run for the file(s) touched (seconds).
- **Per wave merge:** full `npm test` (confirmed baseline: ~30s for 3,676 tests — a full-archive
  equivalence/overlap test adds real but bounded time, similar order to `pace-derivation.test.ts`'s
  existing archive sweep).
- **Phase gate:** full suite green, `tsc --noEmit` clean, `verify-dashboard` green (existing gates,
  unmodified), plus the three new generated artifacts regenerated-twice-and-diffed, plus PR-09's
  sha256 signed by the developer, before `/gsd-verify-work`.

### Independent-value discriminators (this project's repeated failure mode: internal-agreement checks that pass on the defect's own output)

- **D-03's overlap invariant** is asserted against the DETECTOR's own segment output
  (`classifyGapsWithSegments`), never against the search/partition code's own internal state — a
  window's interval is checked for overlap with `segments`, a value computed independently of
  whatever the partition logic decided.
- **D-13's third leg** must not import the search or the detector — its independent value is its own
  per-window outlier statistic, computed fresh from the raw committed stream.
- **The ceiling-population demonstration (D-14)** compares the DERIVED ceiling against a manually
  computed expectation from the synthetic fixture's OWN known-clean speed, not against whatever the
  production code happens to output — mirroring the existing "ceiling is non-circular" test's
  "divergence, then equality-with-filtered" methodology.
- **PR-09's regression fixtures** (3:20/3:21/3:22) are themselves independently reproducible from the
  raw committed streams via `findBestEffort` alone (verified this session, all three match
  CONTEXT.md's probe exactly) — an appropriate independent value for the "before" state.

### Two-direction reachability notes (explicit CAN FAIL / CAN PASS per proposed row)

| Row | CAN FAIL (concrete input) | CAN PASS (concrete input) |
|---|---|---|
| PR-06 splice-fabricates-faster-window | `3475740390`@400m, d-rebased splice variant: 116.6s < honest 119.6s — verified this session, the row DOES fail as designed | If the shipped partition implementation is correct, the same fixture's shipped output equals 119.6s (the honest/clean figure), not the spliced 116.6s |
| PR-08 overlap invariant | Deliberately widen one sub-interval's bound by even 1 index past a segment boundary — the invariant must catch the resulting overlap (D-03's own required first-failing demonstration) | The shipped, correctly-bounded partition never produces an overlapping ranked interval |
| D-08 real-activity precedence fixture | Stub `isPlausible` (or a planted regression) to evaluate the RAW figure instead of clean on `3475725842`@400m — the fixture's assertion (`demotion === null`) must then fail, since raw fails max-speed | The correct implementation evaluates the clean figure, `demotion` stays `null` |
| D-13 planted-partitioner guard | Stub the production partition to return a window that DOES span a segment (planted violation) — the recount must flag it | The real, correct shipped document has no such window; the recount reports clean |
| SEG-05b stubbed-segments proof | Stub `classifyGapsWithSegments` to always return `segments: []` — `contaminated` must then be `null` for every effort, and every clean-window result must equal today's unconstrained result exactly | With real segments passed through, at least `3475740390`@400m's `contaminated` is non-null |

**`vitest -t` filter caution:** every `-t` command listed above must have its MATCHED TEST COUNT
recorded in the plan's own VALIDATION.md when run — a filter matching 0 tests exits 0 and would
silently look like a pass. This applies especially to the not-yet-written rows above (they do not
exist yet, so a premature `-t` run against them would match 0 and must not be recorded as a pass).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` — treated as enabled per the default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This project has no authentication surface anywhere; Phase 36 adds none |
| V3 Session Management | No | No sessions exist in this static-site/local-tooling architecture |
| V4 Access Control | No | No access-control surface; `scripts/curate-server.mjs`'s origin gate is Phase 37's concern (CUR-04), untouched here |
| V5 Input Validation | Yes | All new parsing (`parseContaminated`, the new guard value) follows this codebase's existing total, never-throwing parse pattern (`parseDemotion`'s shape) — malformed/hand-edited shard data degrades to `null`/safe defaults, never throws into the render path |
| V6 Cryptography | Yes (narrow) | PR-09's sha256 signature over the diff artifact reuses the existing convention (`28-DIFF.md`'s own sha256-signing precedent) — Node's built-in `crypto.createHash('sha256')`, no new library |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/hand-edited `data/stats/best-efforts/{id}.json` shard reaching the browser | Tampering | Total, never-throwing parse with field-by-field validation (existing `parseEffort`/`parseDemotion` pattern, extended for `contaminated`) — never a thrown exception into the render path |
| A markdown-table cell in a generated artifact containing an activity ID or reason string with injection-shaped characters (`|`, newlines) | Tampering (of the artifact's own rendering) | `safeCell`/`safeActivityId`-style sanitization, directly reused from `compute-pr-ceiling-diff.mjs:74-90` (T-28-07-B's existing discipline) |
| New CLI flag (`--write-ceiling-state`) accidentally passed in a context that shouldn't write | Tampering (of committed state) | Default `false`; opt-in only from the one CI workflow invocation this phase updates |

## Sources

### Primary (HIGH confidence — read in full or executed this session)

- `src/analytics/best-effort-utils.ts`, `best-effort.types.ts`, `compute-best-efforts.ts`,
  `best-effort-ceiling.ts`, `best-effort-ceiling-state.ts`, `unreliable-segments.ts` (read in full)
- `src/analytics/pace-derivation.ts` lines 1-620 (`classifyGapsWithSegments` and its docblock, read
  in full)
- `src/analytics/pace-single-source.test.ts` (BANNED_LITERALS/needle inventory grepped and read)
- `src/analytics/compute-best-efforts.test.ts` lines 1690-1860 (the "no iteration to convergence"
  suite, read in full — directly informs D-14)
- `src/dashboard/data/best-efforts-client.ts`, `src/dashboard/views/records-logic.ts`,
  `src/dashboard/views/detail-best-efforts-logic.ts` (relevant sections read)
- `scripts/compute-pr-ceiling-diff.mjs`, `scripts/compute-pr-ceiling-recount.mjs`,
  `scripts/compute-elevation-recount.mjs` (read in full)
- `.planning/research/ARCHITECTURE.md` (read in full — pre-existing, phase-specific architecture
  research from 2026-09-19)
- `.planning/research/PITFALLS.md` (Pitfalls 3, 5, 7, 8, 11, 12, 13 read in full)
- `.planning/phases/36-.../36-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §
  Phase 36/37, `.planning/PROJECT.md` § Current Milestone/Key Decisions, `.planning/STATE.md`
  (relevant sections)
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` (read for
  artifact shape)
- Live-executed probes against the committed archive, 2026-09-28 (this session, via Node/dist):
  segment-intersection sweep (1,874 activities × 7 distances), no-clean-window sweep (440
  occurrences, 0 also-implausible), D-02 fixture cross-check (3 named activities × 4 variants each),
  finding-3 cross-check (`3475740390`@400m's 4 intersecting segments, exact match to CONTEXT.md)

### Secondary (MEDIUM confidence)

- `.planning/todos/pending/2026-09-23-read-and-render-caps-for-shard-lists.md` (read in full —
  informs D-07's bounded-length reasoning, not itself in scope)
- `.github/workflows/daily-refresh.yml` (grepped for `compute-all-stats`/`--ci` usage — informs D-11)

### Tertiary (LOW confidence — none used)

None. This research relied entirely on the local codebase and live-executed verification; no
web search or external documentation was needed (no new libraries, per Standard Stack).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive verified present in the current tree
- Architecture: HIGH — cross-checked against a pre-existing, independently-authored architecture doc
  (`ARCHITECTURE.md`) and against live code reads; the one divergence found (ARCHITECTURE.md's vague
  "avoid" option vs this research's index-bounds recommendation) is resolved with a concrete,
  zero-risk-additive design
- Pitfalls: HIGH — Pitfalls 7/8 (this phase's own, previously uncited in CONTEXT.md) verified against
  real, live-executed probes, not merely restated from the document
- D-08 satisfiability: HIGH — directly measured against the full live archive this session, both
  directions (satisfiable case found with real fixtures; unsatisfiable case confirmed empty)
- D-02 numeric cross-check: MEDIUM — the locked fixture (3475740390) matches closely; one supporting,
  non-locked figure (3475724402's d-rebased number) disagreed with CONTEXT.md and is flagged rather
  than silently resolved

**Research date:** 2026-09-28
**Valid until:** ~14 days (stable, in-repo TypeScript domain; the live-archive-derived numbers will
drift with nightly CI sync exactly as every prior phase's probe numbers have — treat all of them,
including this research's own, as references to reconcile, never as pinned expected values, per the
project's own standing rule)
