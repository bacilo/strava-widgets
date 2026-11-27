# Phase 34: Pause Classification & Forgotten-Stop - Research

**Researched:** 2026-09-22
**Domain:** Deterministic classification of an existing detector's merged output (no new detection), plus a stream-quality signal computed against the same `t`/`d` archive Phases 32/33 already calibrate against.
**Confidence:** HIGH for code seams and archive-measurable facts (all verified against the committed source tree and `data/streams/`); MEDIUM for the proposed statistic shapes (described, not selected — D-06/D-08 forbid selecting by peeking); LOW/flagged for anything requiring developer confirmation (D-12 candidates).

## Summary

Phase 34 adds no new detection. Every input it needs already exists: `classifyGapsWithSegments` (`src/analytics/pace-derivation.ts`) returns both the merged `gapIntervals` (real-time spans, kind-tagged `'recording-gap' | 'pause' | 'unreliable'`) and the detector's own raw `segments: UnreliableSegment[]` (mechanism-tagged `'gap-adjacent' | 'hidden-pause' | 'isolated-jump'`, each carrying its own `metres`/`seconds`). The classifier's whole job is to (a) separate the gap-bearing intervals (classifiable) from the not-classifiable ones (isolated-jump/hidden-pause, D-01) using a **mechanism lookup that is not exposed as a single convenient field** — this research traces the exact join needed (see § Code Seams) — and (b) apply calibrated speed bands to each classifiable interval's own merged metres/seconds.

For D-10 (blind-spot streams), a `t`/`d`-only discriminator was built and verified archive-wide: the coefficient of variation of the sample interval (`dt`) versus the coefficient of variation of the per-sample distance advance (`dd`), restricted to covered pairs (`dt` ≤ 10 s, `dd` > 0). Time-triggered devices hold `dt` almost perfectly constant (`cvDt` near 0) while `dd` varies with pace (`cvDd` 0.4–0.7); distance-triggered devices show the mirror image. `3475740390` (the named positive case) measures `cvDt = 0.226`, `cvDd = 0.173` — `dd` varies LESS than `dt`, the signature of distance-triggered sampling. A rule of `cvDd < 0.2 AND cvDd/cvDt < 0.8` (≥30 covered pairs required to compute either statistic) sits in a genuine gap in the archive's own ratio distribution (0.767 → 0.928, nothing between) and flags 104 of 1,874 streams (5.5%) — all of them a contiguous batch of early-era `3475711xxx`–`3475743xxx` activities plus a handful of others, never any of the three named ordinary time-triggered activities (ratios 6.1–8.7, or `Infinity` when `dt` is perfectly constant). One stream has too few covered pairs (<30) to compute the statistic at all and must report its own distinct "insufficient data" reason.

For D-12, three real activities were found with a sustained, clean, covered-time walking window (1.26–1.80 m/s, 400+ s, zero internal zero-advance stretches) markedly slower than the SAME activity's own overall pace — the shape of a genuine walking break inside a run, not an all-day hike. These are **proposals only**; per D-12 the developer must confirm at least one before it is pinned.

For D-06/D-07/D-13, this research describes (never selects) 2–3 candidate statistic shapes each for the walk/run valley and the drift-floor/minimum-duration pair, following the exact Phase 32/33 idiom (pre-declared shapes, first-clearing arbitration under a fixed insensitivity tolerance, HALT on no shape clearing). No shape is chosen here — doing so would violate D-08's "no defensible value → HALT, nothing hand-picked" rule and the project's own repeated lesson that scoping-probe figures must never become expected values.

**Primary recommendation:** Build the classifier as a small new pure module (or a well-marked new export inside `pace-derivation.ts`, per D-01's own "reads the detector's merged segments via `pace-derivation.ts`'s existing import" framing) that consumes `classifyGapsWithSegments`'s two return halves directly — never re-deriving gaps or segments — and treat the mechanism-lookup join (gapIntervals ↔ segments) as the single trickiest implementation detail in the whole phase, because it is not already exposed as one field anywhere in the codebase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pause/gap classification (stationary/walked/ran-through/transported) | API/Backend (compute, `src/analytics/`) | Frontend Server/Browser (render only) | Pure function over `t`/`d` + calibrated constants; must run identically in CI (`compute-dashboard-index.ts`) and in the browser detail-view path (matching Phase 33 D-14's "detector runs in the browser path too" precedent — the shard is lazy-fetched, so the SAME classification must be derivable client-side from the shard's own data, not only server-precomputed) |
| Forgotten-stop detection (covered-creep + pause-interval union) | API/Backend (compute) | Browser (render) | Same split as above — computed once per activity in `compute-dashboard-index.ts`, disclosed via index row + shard |
| Speed-band / drift calibration artifacts | API/Backend (Node-only `scripts/`) | — | `export_data/` and archive-wide sweeps are gitignored/local-only; only the resulting constants and committed artifact reach `src/` |
| Pauses section (detail view) | Browser (DOM render) | — | Pure `*-logic`/plan split, same pattern as `qualitySignalsSectionPlan`/`buildQualitySignalsSection` |
| Quality Signals summary row (index-key-fed) | Browser (DOM render) | API/Backend (index writer) | Index row scalar computed server-side, rendered client-side with the CR-01 missing-key fallback |
| Independent recount (D-18) | API/Backend (Node-only `scripts/`, zero-import) | — | Never imported by `src/`; a standalone verification artifact only |

## Standard Stack

No new libraries. REQUIREMENTS.md's Out of Scope table already forbids new runtime dependencies for this milestone ("every algorithm needed extends an existing hand-rolled function"); Phase 34 reuses `quantile` (R-7, `pace-derivation.ts`), `classifyGapsWithSegments`, and the existing calibration-artifact/recount-script conventions verbatim. No installation step, no registry lookup, no legitimacy audit needed.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. REQUIREMENTS.md's Out of Scope table locks this: "New runtime dependencies … every algorithm needed extends an existing hand-rolled function (`quantile`, `classifyGaps`)." `scripts/` is Node-only tooling already present in the repo; no `npm install` step is expected for this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAUSE-01 | Classify every gap/merged segment as stationary/walked/ran-through(D-02 amendment)/transported | § Code Seams (classifier inputs), § Speed Bands (D-05/D-06/D-07 candidate shapes) |
| PAUSE-02 | Detail view lists each pause with class/duration/distance; additive index key + shard | § Code Seams (index/shard precedent), § Detail-View Disclosure |
| PAUSE-03 | Re-measure v2.2's "9 activities >100m/≥30s gap" on merged segments | § PAUSE-03 Re-Measurement (script pattern + illustrative reference run) |
| STOP-01 | Flag sustained near-zero speed inside recorded, timer-running time, itemised by source | § Forgotten-Stop Sources, § D-10 Blind-Spot Rule |
| STOP-02 | Calibrate near-zero threshold + min duration against measured GPS drift; walking breaks not flagged | § Drift/Duration Candidate Shapes, § D-12 Walking-Break Candidates |
| STOP-03 | Disclose on detail view; structurally excluded from severe composite | § Untiered-Fact Precedent (`hasAnySevereSignal`) |
| SEG-05b (Phase 34's half) | The classifier reads the detector's merged segments via `pace-derivation.ts`'s existing import, proven load-bearing | § Code Seams |
</phase_requirements>

## Architecture Patterns

### System Architecture Diagram

```
data/streams/{id}.json (t, d, alt, hr, cadence)
        │
        ▼
classifyGapsWithSegments(t, d)                    [pace-derivation.ts — EXISTING, unchanged]
        │
        ├──► coverage.gapIntervals: GapInterval[]      { startSec, endSec, kind }
        │        kind ∈ 'recording-gap' | 'pause' | 'unreliable'
        │
        └──► segments: UnreliableSegment[]             { startSec, endSec, metres, seconds,
                 mechanism ∈ 'gap-adjacent' | 'hidden-pause' | 'isolated-jump',              mechanism, excessMetres, ... }
                 excessMetres, ... }
        │
        ▼
[NEW] classifyPauses(coverage, segments, bands)   [Phase 34 — new pure function]
        │  1. pause-kind gapIntervals            → class 'stationary' (no speed test, D-01/D-03)
        │  2. recording-gap-kind gapIntervals     → metres = d[idx(endSec)] − d[idx(startSec)]
        │                                           (NOT on GapInterval — must be derived,
        │                                            see § Code Seams)
        │                                          → speed = metres/seconds → band lookup
        │  3. 'unreliable'-kind gapIntervals JOINED
        │     to segments by boundary match       → mechanism 'gap-adjacent'  → classifiable,
        │                                             uses segment's OWN metres/seconds directly
        │                                           → mechanism 'hidden-pause'/'isolated-jump'
        │                                             → NOT-CLASSIFIABLE (D-01), excluded from
        │                                               Pauses list, stays in Unreliable Segments
        │
        ▼
[NEW] classifyForgottenStop(t, d, coverage)       [Phase 34 — new pure function]
        │  source A: covered-creep (near-zero windowed speed inside 'covered' pairs)
        │  source B: existing zero-advance 'pause' gapIntervals
        │  D-10 blind-spot check FIRST — 'not-computable' short-circuits both sources
        │
        ▼
computePaceQualitySignals() / buildPaceQualityShard()   [pace-quality.ts — EXTEND]
        │  new untiered facts (D-11 template = elapsedVsMoving/deviceEra, NOT a QualityTier)
        ▼
compute-dashboard-index.ts (CI)  ──►  data/dashboard/index.json (additive, schema v1 unchanged)
        │                                    │
        ▼                                    ▼
detail-sections.ts (browser)  ◄── quality (index row) + shard (lazy fetch, same paceQualityClient.load)
        │
        ├─ qualitySignalsSectionPlan → new summary row (CR-01 missing-key fallback pattern)
        └─ [NEW] pausesSectionPlan → new "Pauses" section (buildSplitsSection template)
```

### Recommended Project Structure

No new directories. Two realistic module placement options (Claude's Discretion per CONTEXT.md, subject to the single-source audit):

```
src/analytics/
├── pace-derivation.ts        # UNCHANGED — classifyGapsWithSegments is read, never re-derived
├── unreliable-segments.ts    # UNCHANGED — detector stays untouched
├── pace-quality.ts           # EXTEND — new untiered facts, following elapsedVsMoving's shape
└── pause-classification.ts   # NEW (option A) — classifyPauses/classifyForgottenStop, pure,
                               #   client-safe, imports ONLY pace-derivation.ts's exported types
                               #   (never unreliable-segments.ts directly — mirrors the existing
                               #   "pace-derivation.ts is the detector's ONE permitted importer"
                               #   discipline pace-quality.ts itself already follows)
scripts/
├── compute-pause-classification-calibration.mjs   # NEW — walk/run valley + drift floor + STOP
│                                                     min-duration, one or three artifacts
│                                                     (Claude's Discretion, CONTEXT.md)
├── compute-pause-classification-calibration.test.mjs
├── compute-pause03-recount.mjs                     # NEW or folded into the above — PAUSE-03's
│                                                     >100m/≥30s re-measurement on merged segments
└── compute-pause-classification-recount.mjs        # NEW — D-18's zero-import independent
                                                       recount for 3475724402's per-segment class
                                                       table, mirroring
                                                       compute-unreliable-segment-recount.mjs
```

### Pattern 1: The mechanism-lookup join (gap-bearing vs. not-classifiable)

**What:** `classifyGapsWithSegments`'s pass 3 relabels pair-kinds to `'unreliable'` for **every** returned segment, regardless of mechanism — including `hidden-pause` and `isolated-jump` segments that carry no gap at all. This means `coverage.gapIntervals` entries with `kind: 'unreliable'` do **not** by themselves distinguish gap-adjacent (classifiable) from hidden-pause/isolated-jump (not-classifiable, D-01). The mechanism lives only on the separate `segments` array.

**When to use:** Every time Phase 34 needs to decide whether an `'unreliable'`-kind interval gets a speed class or stays `not-classifiable`.

**Example (verified against `dist/analytics/pace-derivation.js`):**
```typescript
// Source: src/analytics/pace-derivation.ts (classifyGapsWithSegments, pace-quality.ts's own resolveCoverage pattern)
const { coverage, segments } = classifyGapsWithSegments(t, d);

// Gap-adjacent segments ALREADY carry their own correct merged metres/seconds —
// use them directly, never round-trip through gapIntervals for this case.
const classifiableFromSegments = segments.filter((s) => s.mechanism === 'gap-adjacent');

// Recording gaps that never touched a burst still show as their own
// 'recording-gap'-kind gapIntervals entry (classifyGapsWithSegments's priority
// pass ALREADY strips any gap that got merged into an 'unreliable' segment out
// of this list — no double-counting, no manual exclusion needed).
const rawRecordingGaps = coverage.gapIntervals.filter((gi) => gi.kind === 'recording-gap');

// pause-kind intervals: stationary by definition, no speed test (D-01/D-03).
const pauseIntervals = coverage.gapIntervals.filter((gi) => gi.kind === 'pause');

// hidden-pause / isolated-jump segments: NOT classifiable (D-01) — they stay
// in the existing "Unreliable Segments" disclosure only.
const notClassifiable = segments.filter((s) => s.mechanism !== 'gap-adjacent');
```

### Pattern 2: Deriving metres for a RAW (unmerged) recording-gap interval

**What:** `GapInterval` (the shape `coverage.gapIntervals` entries have) carries only `{ startSec, endSec, kind }` — **no metres field**. `UnreliableSegment` carries `metres`/`seconds` directly. For an unmerged `recording-gap` interval, metres must be derived by looking up the exact sample index at `startSec`/`endSec` (both are always real sample times, since `classifyGapsWithSegments` only ever builds interval boundaries from `t[i]` values) and differencing `d`.

**Example (this exact pattern was verified working in a throwaway probe against every stream in the archive, see § PAUSE-03 Re-Measurement below):**
```typescript
// Source: verified pattern, mirrors classifyGapsWithSegments's own boundary construction
function metresForInterval(t: readonly number[], d: readonly number[], startSec: number, endSec: number): number {
  const startIdx = t.indexOf(startSec); // exact match — startSec is always a real t[i]
  const endIdx = t.indexOf(endSec);
  return d[endIdx] - d[startIdx];
}
```
A production implementation should build a `Map<number, number>` from `t` to index once per activity (O(n)) rather than repeated `Array.indexOf` (O(n) each) — this is a performance note, not a correctness one; `indexOf` was used above only for probe simplicity.

### Pattern 3: Untiered-fact signal shape (D-11's own template)

**What:** `ElapsedVsMovingSignal` (`pace-quality.ts`) and `DeviceEraSignal` show the exact shape a signal with no `QualityTier` takes — no `tier` field at all, computed from metadata/stream, always disclosed, never contributes to `hasAnySevereSignal`. STOP-01/02/03's flag (D-11) and PAUSE's per-class summary row (D-14, itself untiered — no severe/minor cut named anywhere in CONTEXT.md) should both follow this shape, not `UnreliableSegmentsSignal`'s four-tier shape.

**Example:**
```typescript
// Source: src/analytics/pace-quality.ts:181-185 (existing, unmodified)
export interface ElapsedVsMovingSignal {
  ratio: number | null; // untiered (D-14) — never a plausible-looking computed zero
  elapsedSec: number | null;
  movingSec: number | null;
}
```

### Pattern 4: The CR-01 missing-key fallback (stale/pre-Phase-34 `index.json`)

**What:** Every prior phase that added a new key to `ActivityQualitySignals` (elevation in Phase 30, `unreliableSegments` in Phase 33) hit the same hazard: `index-client.ts` does a blind, unvalidated cast of the fetched JSON, so a stale browser cache or a lagging staged build can hand `qualitySignalsSectionPlan` a `quality` object missing the newest key entirely. Both prior phases fixed this with a named `NOT_COMPUTABLE_*` fallback constant and a `??` at the read site — never a crash, never a silently-undefined row.

**Example:**
```typescript
// Source: src/dashboard/views/detail-sections.ts:1553-1612 (existing precedent, exact pattern to repeat)
const NOT_COMPUTABLE_UNRELIABLE_SEGMENTS: UnreliableSegmentsSignal = {
  tier: 'not-computable', count: null, totalMetres: null,
  totalExcessMetres: null, totalSeconds: null, excessFraction: null, mechanisms: null,
};
// ...
const unreliableSegments: UnreliableSegmentsSignal =
  quality.unreliableSegments ?? NOT_COMPUTABLE_UNRELIABLE_SEGMENTS;
```
Phase 34's new summary key(s) need the same treatment before `qualitySignalsSectionPlan`/the new Pauses-section-plan function dereferences them.

### Anti-Patterns to Avoid

- **Re-deriving gap boundaries independently in the classifier:** `classifyGapsWithSegments` is the ONE definition of a gap/merged segment (SEG-05b). A classifier that re-computes `dt > 10` or re-merges bursts itself is a second implementation of the exact thing the single-source audit (`pace-single-source.test.ts`) exists to catch.
- **Treating `'unreliable'`-kind `gapIntervals` as always classifiable:** see Pattern 1 above — this is the single most likely implementation bug in the phase.
- **Computing forgotten-stop "covered-creep" from `coverage.coveredSec` alone:** covered-creep must be found INSIDE the covered pairs (per-pair or per-window near-zero speed), not inferred from the aggregate `coveredSec` total, which says nothing about internal speed variation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile/quantile for any band statistic | A second percentile function | `quantile` (R-7 linear-interpolation, `pace-derivation.ts`) | Single-source audit already forbids a second percentile definition (R-7 note in CONTEXT.md canonical refs) |
| Merged-segment boundaries | A new merge/adjacency algorithm | `classifyGapsWithSegments` | SEG-05b — the detector is the one source every consumer reads |
| Speed-limit-style calibrated constant derivation | An ad hoc threshold | The D-05/D-13 pre-declare → insensitivity-check → first-clearing-arbitrate → HALT-on-none pipeline already used three times (32-06, 33-08/33-14) | Consistency with the project's own non-circularity discipline; a fourth ad hoc method would be its own audit target |

**Key insight:** every piece of machinery Phase 34 needs (classification, calibration harness, recount pattern, untiered-fact shape, CR-01 fallback, shard/index additive-field pattern) already has exactly one canonical implementation elsewhere in this codebase from Phases 26/30/32/33. The phase's actual work is wiring and calibration, not new algorithms.

## Common Pitfalls

### Pitfall 1: Assuming `'unreliable'`-kind `gapIntervals` are always gap-bearing
**What goes wrong:** A classifier that speed-classifies every `'unreliable'`-kind interval would call isolated GPS jumps and hidden pauses "transported"/"ran-through" purely because `UNRELIABLE_SPEED_LIMIT_MPS` (7.35 m/s) is their own detection threshold by construction — D-01 explicitly names and rejects this ("a speed class would call every GPS jump 'transported'").
**Why it happens:** `GapInterval.kind === 'unreliable'` looks like a single, sufficient discriminator; the mechanism split is one join away, not visible on the interval itself.
**How to avoid:** Always resolve mechanism via the `segments` array (Pattern 1 above) before classifying.
**Warning signs:** A test on 3475740390 (five isolated jumps, 25–52 m each) showing a "transported" or "ran-through" class for any of them.

### Pitfall 2: Reproducing v2.2's PAUSE-03 rule on `GapInterval` metres without deriving them
**What goes wrong:** `GapInterval` has no `metres` field. A naive implementation that tries `gap.metres` will not compile / will read `undefined`.
**Why it happens:** `UnreliableSegment` (used for the merged case) DOES carry `metres` directly, creating an inconsistent mental model across the two interval sources.
**How to avoid:** Pattern 2 above — derive metres from `d[idx(endSec)] - d[idx(startSec)]` for raw `recording-gap` intervals; use `segment.metres` directly for `gap-adjacent` merged ones.

### Pitfall 3: Treating the "9 activities" v2.2 figure as reproducible from a committed script
**What goes wrong:** Assuming a `scripts/compute-*.mjs` already implements v2.2's rule and can simply be re-pointed at merged segments.
**Why it happens:** Every other historical figure in this project (259/1,873, the Suunto sample, etc.) turned out to trace to a committed artifact or at least a described method; this one does not.
**How to avoid:** `git log --all -S"essentially absent"` / `-S"advance >100"` finds no script — only the prose rule ("`>100 m` across a `≥30 s` gap") first appears in the v2.2 REQUIREMENTS.md commit (`7d10d223`) itself, with no accompanying script. Treat the rule text as the spec and write a fresh, small, regenerable script (see § PAUSE-03 Re-Measurement).

### Pitfall 4: Selecting a walk/run valley or drift-floor shape by peeking at its output
**What goes wrong:** Choosing whichever pre-declared shape "looks right" (gives a pleasing valley, or a flattering flagged count) is exactly the circularity D-08/D-13 and the project's own anti-quota rule (Phase 27 D-02, repeated in every subsequent phase) exist to forbid.
**Why it happens:** It is tempting once real numbers are in hand.
**How to avoid:** The plan must pre-declare the candidate shapes in its own text (this research proposes candidates below, in a fixed order), commit to first-clearing arbitration under a FIXED tolerance decided before any measurement, and be willing to HALT with a NO-VALUE artifact if none clears (D-08).

### Pitfall 5: Assuming the D-10 blind-spot rule and the D-06 walk/run valley share a population
**What goes wrong:** The D-10 rule (distance-triggered stream detection) and the D-06 valley (walk/run boundary within a SINGLE activity's covered-step speeds) look similar (both statistical, both over `t`/`d`) but must stay disjoint — D-10 classifies STREAMS, D-06 classifies SPEEDS within one stream's own covered population. Conflating them risks a stream flagged "distance-triggered" also being silently excluded from the archive-wide valley population for the wrong reason (device-family reasoning creeping in, which 32-CONTEXT.md D-03's t/d-purity rule forbids).
**How to avoid:** Keep the two rules as separate functions with separately-stated non-circularity arguments; the D-10 rule only ever gates the STOP-01 flag's own computability, never the PAUSE-01 band derivation.

## Code Examples

### D-10: the distance-triggered / blind-spot discriminator (verified, archive-wide)

```javascript
// Verified pattern (probe run against the full committed archive, 2026-09-22).
// Not a production file yet — this is the discriminator's logic, to be
// implemented as a pure t/d-only function alongside the classifier.
function mean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
function stdev(a) { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); }

function recordingMechanismSignature(t, d) {
  const n = Math.min(t.length, d.length);
  const dts = [];
  const dds = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dt <= 0 || dt > 10) continue; // exclude recording gaps
    if (dd <= 0) continue;            // exclude flat/pause pairs
    dts.push(dt);
    dds.push(dd);
  }
  if (dts.length < 30) return { computable: false, reason: 'fewer than 30 covered pairs' };

  const cvDt = stdev(dts) / mean(dts);
  const cvDd = stdev(dds) / mean(dds);
  const ratio = cvDt > 0 ? cvDd / cvDt : Infinity;

  // Distance-triggered signature: distance advances MORE regularly than time.
  const distanceTriggered = cvDd < 0.2 && ratio < 0.8;
  return { computable: true, cvDt, cvDd, ratio, distanceTriggered };
}
```

**Measured results (archive-wide, 1,874 streams, 2026-09-22, this session's own probe — reference figures to reconcile against in planning, never pinned as expected values without re-derivation inside the phase's own committed artifact):**

| Stream | Role | `cvDt` | `cvDd` | ratio | Flagged? |
|---|---|---|---|---|---|
| `3475740390` | **D-10's named positive case** | 0.226 | 0.173 | 0.767 | **YES** |
| `3475724402` | ordinary time-triggered control | 0.083 | 0.717 | 8.66 | no |
| `3475734189` | ordinary time-triggered control (`dt` perfectly constant, 1 Hz) | 0.000 | 0.499 | ∞ | no |
| `4556693525` | ordinary time-triggered control (Suunto) | 0.072 | 0.441 | 6.12 | no |

- **Archive-wide flagged count:** 104 of 1,874 streams (5.5%) at `cvDd < 0.2 AND ratio < 0.8`.
- **Insufficient-data count:** 1 stream has fewer than 30 covered pairs and cannot be evaluated by this rule at all — this must be its own distinct not-computable reason, separate from "distance-triggered."
- **Gap check:** the archive's own ratio distribution has a genuine gap between 0.767 (3475740390 itself) and 0.928 (the next-lowest stream) — the 0.8 cut sits inside that gap, not at an arbitrary round number chosen after the fact. Below 0.767, ratios continue smoothly down through the 0.26–0.75 range (the bulk of the flagged 104), all of them a contiguous, sequential-ID batch (`3475711xxx`–`3475743xxx`) strongly suggesting a shared device/era with `3475740390` — itself a finding worth disclosing in the calibration artifact, not a target to hit.
- **False-positive check:** a separate population of ~658 streams sits at ratio 0.9–1.1 with BOTH `cvDt` and `cvDd` elevated (~0.5–0.6) — these are noisy-in-both-dimensions streams (plausibly manual GPX imports), not distance-triggered ones, and the `cvDd < 0.2` absolute-magnitude condition excludes essentially all of them (only 2 of 658 pass `cvDd < 0.2`, and both are excluded by the ratio condition too).

**This rule must be committed as its own function with its own non-circularity note before Phase 34's STOP-01 flag reads it** — it currently exists only in this research's throwaway probe.

### D-12: walking-break negative-control candidates (proposals, NOT locked)

Method: maximal covered-time (no recording-gap) windows, at least 60 s from either end of the stream, with an AGGREGATE speed (`Δd/Δt` across the whole window) in `[1.2, 1.8]` m/s sustained for ≥150 s, where the REST of the activity (excluding the window) runs at ≥2.3 m/s (a genuine running pace) — the shape of an embedded walking break, not an all-day hike. Verified clean (zero internal zero-advance stretches, no sample gap >10 s inside the window) against the raw stream.

| Candidate | Window (`t`) | Duration | Distance | Window speed | Rest-of-activity speed | Window HR range |
|---|---|---|---|---|---|---|
| `6286234101` | t=5289–5696 | 407 s | 514.5 m | **1.264 m/s** | 2.753 m/s (~6:03/km) | 141–166 bpm |
| `3475733231` | t=1827–2229 | 402 s | 608.0 m | **1.512 m/s** | 2.462 m/s (~6:46/km) | 110–157 bpm |
| `3475715143` | t=1590–1992 | 402 s | 722.4 m | **1.797 m/s** | 2.435 m/s (~6:50/km) | 135–177 bpm |

All three: per-pair speeds inside the window stay bounded (no internal spike above ~3 m/s, no zero-advance stretch — `maxFlat = 0 s` for two of the three; the third's flat check was not separately re-verified with the exact same script pass and should be re-run before use), no recording gap inside the window. HR is meaningfully elevated relative to genuine standing rest, consistent with a tired/uphill walking segment rather than a full stop.

**These are RESEARCH PROPOSALS ONLY.** Per D-12, the developer must confirm at least one genuinely was a walking break (from memory, Strava's own segment view, or another out-of-band source) before any plan pins it as a fixture. **This is a developer-confirmation checkpoint the planner must schedule** — likely as an early Wave-0/discovery task or a `checkpoint:human-verify` before the negative-control test locks these IDs in.

### D-06/D-07/D-13: candidate statistic shapes (described, not selected)

Per Pitfall 4 above, none of these is chosen here. Each is stated with its own non-circularity argument, in the exact "pre-declared, first-clearing" idiom `33-CALIBRATION.md`'s D-16 resolution and `32-CALIBRATION.md`'s own L/F/B derivations already use. The plan must copy the shapes it intends to try into its own text BEFORE any measurement, in a fixed order, with a fixed tolerance (the project's convention: 1%) decided before any check runs.

**(a) walked → ran-through valley, in the athlete's own covered-time speed distribution (D-06):**

| Shape | Statistic | Non-circularity argument |
|---|---|---|
| **W1 — pooled archive valley** | `findValley`-style search (the same shape `HIDDEN_PAUSE_MIN_METRES` used) over the pooled archive-wide histogram of folded COVERED-step speeds, anchored between a walking-cluster candidate and a running-cluster candidate | Population is every activity's own covered steps — by construction disjoint from the gap-bearing intervals PAUSE-01 classifies (covered time excludes every gap/pause/unreliable interval by definition). Removing/doubling detected gap-bearing intervals cannot move this population at all, since they were never in it. |
| **W2 — per-activity valley, archive percentile** | For each activity with a sufficient covered-step count, find that activity's OWN minimum-density point between its two densest speed clusters; take an R-7 percentile of those per-activity valley points across the archive | Same population-disjointness argument as W1, but a DIFFERENT statistic shape (per-activity aggregation, not pooled) — guards against W1's pooled histogram being dominated by a few high-volume activities |
| **W3 — cadence-anchored (if cadence coverage is sufficient)** | Midpoint between the archive-wide low-quantile covered-step speed among LOW-cadence steps and the low-quantile speed among HIGH-cadence steps (a fixed cadence split, e.g. contact-time-derived) | Uses an entirely independent channel (cadence) to bootstrap the speed boundary rather than density alone — structurally cannot be circular with the SPEED population it later judges, though it inherits cadence's own coverage gaps as a caveat |

**(b) stationary → walked boundary = GPS drift floor (D-07), shared with STOP-02's near-zero threshold:**

| Shape | Statistic | Non-circularity argument |
|---|---|---|
| **G1 — pause-boundary-adjacent creep** | R-7 median (or p90) implied speed of COVERED pairs whose start or end sample sits within a small window (e.g. 10 s) of an EXISTING zero-advance `pause` interval's boundary | The population is anchored by the pause-interval RULE (a duration-based flat-run threshold, unrelated to speed) — not by the near-zero threshold being derived. The athlete is known-stationary immediately before/after an established pause by the pause rule's own definition, independent of any speed statistic. |
| **G2 — physiologically-corroborated stillness** | Median implied speed of covered pairs where HR sits within a small band of its own trailing average AND cadence reads 0 | Uses HR/cadence — channels structurally independent of the distance channel being measured — as external corroboration of genuine stillness. Caveat: HR/cadence coverage is not universal across the archive; this shape's population may be materially smaller. |
| **G3 — archive-wide low-tail (reference, likely to fail)** | R-7 p05 of ALL pooled folded covered-step speeds, archive-wide (the complement-direction idiom `UNRELIABLE_EXCESS_FLOOR_M` used) | Simplest to compute, but its population OVERLAPS the W-shapes' own walking cluster — flagged here as the shape most likely to fail D-13 insensitivity for the same reason 33-08's percentile-of-the-flagged-population failed (the population isn't structurally disjoint from what it will be used to judge). Included for completeness and as the negative-finding candidate to be watched failing, not as a real favourite. |

**Minimum sustained duration (paired with the drift floor, D-13):**

| Shape | Statistic | Non-circularity argument |
|---|---|---|
| **M1 — scale-relative, existing pattern** | Reuse `PAUSE_GAP_P90_MULTIPLIER`'s own shape: a fixed multiplier × the activity's own p90 advance-interval, exactly as the existing `pause` GapKind threshold is already derived | Reuses an ALREADY-CALIBRATED, unrelated derivation (26-RESEARCH.md's own K=4/5 sweep) rather than inventing a new one; the multiplier itself would need its own small sweep but the SHAPE is not new |
| **M2 — archive p10 of pre-pause creep run lengths** | Using G1's population (creep stretches immediately bracketing an established pause), find the archive-wide 10th percentile of how long such stretches run before the FORMAL pause threshold fires | Anchored the same way G1 is — population defined by the pre-existing pause-boundary rule, not by the duration constant being derived |

### D-18: the independent recount pattern (mirrored from `compute-unreliable-segment-recount.mjs`)

The existing D-15 recount script for 3475724402 (`scripts/compute-unreliable-segment-recount.mjs`) already independently derives that activity's own per-segment `startSec`/`endSec`/`metres`/`seconds`/mechanism table via a **gap-first** traversal (walking backward/forward from each raw gap, folding fast steps) — structurally different from the detector's own **run-first** traversal (find fast runs, then check gap adjacency), so the two artifacts cannot share the same blind spot (Pitfall 11). It has **zero imports** of `unreliable-segments`/`pace-derivation` in any spelling, duplicates the tiny `RECORDING_GAP_ABS_THRESHOLD_SEC = 10` constant locally rather than importing it, and parses the committed calibration artifact by a fixed table-header contract string.

**Phase 34's own D-18 recount should extend this exact script (or a sibling built the same way) with one more column: the classified band, computed by re-applying the (not-yet-chosen) speed-band constants to the SAME independently-derived metres/seconds this script already produces** — never re-deriving the merge itself, only adding the classification arithmetic on top of an already-independent per-segment table. This keeps the "never imports the classifier" guarantee while reusing the hardest-won part of the existing recount (the independent merge).

## Architectural Responsibility for PAUSE-03 Re-Measurement

**No committed v2.2 script exists.** `git log --all -S"essentially absent"` / `-S"advance >100"` / `-S"teleport"` across the whole repository history finds the rule text first appearing verbatim in the v2.2 REQUIREMENTS.md-defining commit (`7d10d223`, "docs: define milestone v2.2 requirements") with no accompanying script, and no `scripts/compute-*.mjs` anywhere in history references "100 m" or "essentially absent." The figure was an ad hoc scoping probe, never committed as regenerable tooling.

**The rule itself is fully specified in text** (REQUIREMENTS.md PAUSE-03, `.planning/milestones/v2.2-REQUIREMENTS.md:165`): an activity counts if ANY interval of duration ≥30 s advances >100 m. A fresh, small script applying this to `classifyGapsWithSegments`'s own `coverage.gapIntervals` (filtered to `kind IN ('recording-gap', 'unreliable')`, since `pause`-kind intervals are zero-advance by definition and can never qualify) reproduces the widened rule directly — see Pattern 2 above for how metres are derived for the un-merged `recording-gap` case.

**Illustrative probe run (this session, against `dist/analytics/pace-derivation.js`, reference figures only — NOT the phase's figure of record, which must come from a freshly committed, regenerable artifact):**

| Rule | Activities matching (of 1,874) |
|---|---|
| Old rule — `recording-gap`-kind intervals only, exactly the gap interval alone | **12** |
| New rule — `recording-gap` OR `unreliable`-kind (merged) intervals | **26** |
| Newly caught by widening (14 activities, including `3475724402`) | `3475711346`, `3475715271`, `3475724402`, `3475725513`, `3475725842`, `3475727699`, `3475730418`, `3475730936`, `3475733984`, `3475740567`, `3475741488`, `3475743571`, `4598855187`, `5059213289` |

The old-rule count here (12) does not exactly match v2.2's cited "9" — expected, since v2.2's own figure was measured on an earlier, smaller archive snapshot with an unknown exact implementation (no script survives to diff against). The plan should reconcile this difference explicitly (archive growth is the most likely single factor, mirroring `32-CALIBRATION.md`'s own "Reconciliation against the scoping probe" ladder) rather than silently overwriting the historical figure — PAUSE-03/D-04 already requires a dated forward-pointer at `v2.2-REQUIREMENTS.md:165`, not a silent edit.

## Detail-View Disclosure

`buildSplitsSection` (`detail-sections.ts:334-420`) is the closest existing template for a new "Pauses" section: a `<table>` inside a `.card.detail-section`, one row per item, built from a pure plan object (never DOM-simulated in tests), with a text-label legend below when needed. `qualitySignalsSectionPlan`/`buildQualitySignalsSection` (`detail-sections.ts:1591-1696`) is the template for the new one-line Quality Signals summary row — every row is built the same `{ label, valueText, tier, explanation, evidenceText }` shape, with `tier: 'untiered'` for facts like `deviceEra`/`elapsedVsMoving` (Pattern 3 above) — Phase 34's summary row(s) should use `'untiered'`, never a fabricated severity tier, per D-14 (no none/minor/severe cut named for either PAUSE class counts or STOP-01/02/03).

Mounting: the shard already arrives lazily, after first paint, in `mountBestEffortsAndBadges` (`detail.ts:568-612`) via the same `paceQualityClient.load(detail.id)` call the Quality Signals section already consumes — the new Pauses section needs no new fetch, only a new placeholder container mounted at first-paint time (mirroring `qualitySignalsContainer`) and filled in the same `Promise.all`-resolved callback.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| v2.2: gap interval alone judged for transport ("9 activities … ≤14 km/h") | PAUSE-03: merged segment (gap + adjacent burst) judged, capturing distance the burst absorbed | This phase | The re-measured figure is expected to rise (illustrative probe: 12 → 26) — this is the exact correction v2.2's own "essentially absent" finding is being reopened for |
| No pause/gap speed classification at all | Four-class speed band (stationary/walked/ran-through/transported) on every gap-bearing interval | This phase | New Pauses section, new PAUSE-03 figure |
| No forgotten-stop signal | Untiered STOP flag (two sources, itemised, never affecting moving time/pace/best efforts) | This phase | New Quality Signals fact, structurally excluded from `hasAnySevereSignal` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cvDd < 0.2 AND cvDd/cvDt < 0.8` (≥30 covered pairs) is a sound, generalisable D-10 blind-spot rule | § D-10 Blind-Spot Rule | If wrong, some genuinely distance-triggered streams could be missed (false "clean" STOP-01 result) or an ordinary noisy-GPX stream could be wrongly marked not-computable; the archive-wide gap check (0.767→0.928) mitigates but does not eliminate this risk — the plan should re-verify the gap holds on the freshly regenerated archive at execution time |
| A2 | The three D-12 candidates (`6286234101`, `3475733231`, `3475715143`) are genuine walking breaks, not e.g. a slow uphill jog, a photo stop, or a traffic-light wait | § D-12 Walking-Break Candidates | This is explicitly why D-12 requires developer confirmation before pinning — treat as unconfirmed until the developer responds |
| A3 | The W1–W3 / G1–G3 / M1–M2 candidate shapes are a sufficient, non-exhaustive set — a better shape may exist | § D-06/D-07/D-13 Candidate Shapes | Low risk — D-08 already provides a HALT escape hatch if none of these clears insensitivity; the plan is not locked into this exact list, only encouraged to pre-declare whichever list it commits to |
| A4 | No committed v2.2 PAUSE-03 script exists anywhere in git history | § PAUSE-03 Re-Measurement | Low risk — verified via three independent `git log -S` searches across `--all`; if a script does turn out to exist elsewhere (e.g. an uncommitted local file never pushed), the plan should still treat the REQUIREMENTS.md rule text as authoritative |

**If this table is empty:** N/A — see rows above.

## Open Questions (RESOLVED)

1. **Exact join key between `coverage.gapIntervals` and `segments` for the `'unreliable'` case**
   - What we know: both are derived from the same pass in `classifyGapsWithSegments`; in the overwhelmingly common case each detector segment produces exactly one `'unreliable'`-kind `gapIntervals` entry with identical `startSec`/`endSec`.
   - What's unclear: whether two detector segments can ever be pair-adjacent (one's `endIndex` equals another's `startIndex`) without the detector's OWN chaining logic already merging them into one segment — if this can happen, `accumulateCoverage`'s same-kind-run merge would silently fold two `UnreliableSegment`s into one `gapIntervals` entry, breaking a naive 1:1 boundary match.
   - Recommendation: the classifier should match by `startIndex`/`endIndex` semantics where possible (deriving indices via the same `t.indexOf` approach as Pattern 2) rather than trusting a 1:1 assumption, and a unit test should assert the join is exhaustive (every `'unreliable'`-kind interval resolves to at least one segment) before relying on it.
   - RESOLVED: 34-03's join-exhaustiveness unit test (every `'unreliable'`-kind interval resolves to at least one segment), re-checked archive-wide by 34-04's join gate.

2. **Which of the walk/run valley / drift-floor shapes will actually clear D-13 insensitivity**
   - What we know: the project's own track record (32-06, 33-08→33-14) shows roughly half of first-attempt shapes fail and require a second, structurally different shape.
   - What's unclear: which of W1–W3/G1–G3 clears first on THIS population — genuinely unknown until measured, by design (Pitfall 4).
   - Recommendation: the plan should budget for at least one HALT/re-shape cycle, following 33-08→33-14's own precedent, rather than assuming the first pre-declared shape ships.
   - RESOLVED: 34-04/34-06's pre-declared, HALT-capable pipeline (ordered G/M/W shapes with strawmen, first-clearing arbitration, exit 1 on NO SHAPE CLEARS, no fallback or retune).

## Environment Availability

No external dependencies beyond what Phases 32/33 already require (Node, the committed `data/streams/` archive, the existing `dist/` build). Skipped — this is a code/config/calibration-only phase with no new external tool, service, or runtime.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (already configured — no Wave 0 install) |
| Config file | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| Quick run command | `npx vitest run <touched test files> -t "<fragment>"` (`.test.mjs` files import `../dist/` — run `npm run build` first) |
| Full suite command | `npm test` — baseline at Phase 33's close: 93 files / 3,102 tests, all green (`33-VALIDATION.md`); re-confirm this count fresh at Wave 0, since nightly CI may have moved the archive |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAUSE-01 | Four-class band assignment on gap-bearing intervals; not-classifiable exclusion for hidden-pause/isolated-jump | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyPauses"` | ❌ Wave 0 |
| PAUSE-02 | Additive index key + capped shard list | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pauses"` | ❌ Wave 0 (extends existing file) |
| PAUSE-03 | Merged-segment re-measurement, dated provenance | script (artifact) | `npm run compute-pause03-recount` (or folded into the calibration script) — exit 0, reconciled against `v2.2-REQUIREMENTS.md:165` | ❌ Wave 0 |
| STOP-01 | Two-source union, itemised, timer-running scope | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyForgottenStop"` | ❌ Wave 0 |
| STOP-02 | Calibrated threshold/duration, walking-break negative control | script (artifact) | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs` | ❌ Wave 0 |
| STOP-03 | Detail-view disclosure, excluded from `hasAnySevereSignal` | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes"` (extend the existing never-widen guard) | ✅ file exists, extend |
| SEG-05b (Phase 34 half) | Classifier reads detector via `pace-derivation.ts`, load-bearing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pause-classification"` | ✅ file exists, extend |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched files> -t "<fragment>"`, matched count recorded (Rule 1, per `33-VALIDATION.md`'s own hard-won lesson: a filter matching 0 tests exits 0 and is indistinguishable from a pass)
- **Per wave merge:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Phase gate:** full suite green, every calibration/recount artifact regenerated twice byte-identical, D-18 recount watched failing first against a deliberately broken classifier, human browser checkpoint against a digest-verified served build (standing convention — PAUSE-02/STOP-03 are both rendered claims)

### Wave 0 Gaps
- [ ] `src/analytics/pause-classification.ts` + `.test.ts` — the new classifier module (or the equivalent extension inside `pace-derivation.ts`, per Claude's Discretion in CONTEXT.md)
- [ ] `scripts/compute-pause-classification-calibration.mjs` + `.test.mjs` — walk/run valley + drift floor + STOP min-duration artifact(s)
- [ ] `scripts/compute-pause-classification-recount.mjs` (or extend `compute-unreliable-segment-recount.mjs`) — D-18's zero-import independent recount for 3475724402
- [ ] `scripts/compute-pause03-recount.mjs` (or folded into the calibration script) — PAUSE-03's re-measurement, dated provenance
- Framework install: none — vitest already configured

## Security Domain

`security_enforcement` is not present in `.planning/config.json` (absent = enabled per this template's own default), but this phase touches no authentication, session, access-control, or new external-input surface. The one new untrusted-input consideration is unchanged from existing precedent: any free-text the Pauses section renders must go through `textContent`, never `innerHTML` (the same rule `deviceEra.rawDeviceName` already established, T-18-XSS-01/T-27-29). No ASVS category beyond the existing input-handling discipline applies.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V5 Input Validation | yes (unchanged) | `textContent`-only DOM writes, matching `appendAccessibleBadge`'s existing discipline |
| Others | no | No auth, session, crypto, or new external service in this phase |

## Sources

### Primary (HIGH confidence — read directly from the committed source tree)
- `src/analytics/pace-derivation.ts` — `classifyGaps`/`classifyGapsWithSegments`, `GapKind`/`GapInterval`, `PAUSE_GAP_P90_MULTIPLIER`, `RECORDING_GAP_ABS_THRESHOLD_SEC`, `quantile`
- `src/analytics/unreliable-segments.ts` — `UnreliableSegment`, `SegmentMechanism`, `DEFAULT_DETECTOR_PARAMS`, `UNRELIABLE_SPEED_LIMIT_MPS`
- `src/analytics/pace-quality.ts` — `ElapsedVsMovingSignal`/`DeviceEraSignal` (untiered template), `UnreliableSegmentsSignal` (tiered template), `resolveCoverage`, `hasAnySevereSignal`, `buildPaceQualityShard`
- `src/dashboard/views/detail-sections.ts` — `qualitySignalsSectionPlan`, `buildQualitySignalsSection`, `buildSplitsSection`, the CR-01 fallback constants
- `src/dashboard/views/detail.ts` — `mountBestEffortsAndBadges`, shard/quality mounting order
- `src/analytics/dashboard-index.types.ts` — `DashboardIndexRow.quality`, `DASHBOARD_INDEX_SCHEMA_VERSION`
- `scripts/compute-unreliable-segment-recount.mjs` — the D-15/D-18 zero-import recount pattern
- `data/streams/*.json` — archive-wide `t`/`d` measurements for D-10, D-12, PAUSE-03 probes (this session)
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` — the D-13 insensitivity/first-clearing idiom
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CONTEXT.md`, `33-VALIDATION.md` — D-15/D-16 non-circularity precedent, Rule 1/Rule 2 validation lessons

### Secondary (MEDIUM confidence)
- `git log --all -S"essentially absent"|"advance >100"|"teleport"` — confirms no committed v2.2 PAUSE-03 script exists (a negative result, verified by three independent search terms)

### Tertiary (LOW confidence — flagged for developer confirmation)
- The three D-12 walking-break candidates — proposed, not confirmed
- The specific `cvDd < 0.2 / ratio < 0.8` D-10 cut — a sound, gap-supported threshold on today's archive, but not yet committed as a calibration artifact with its own non-circularity argument

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, verified against REQUIREMENTS.md Out of Scope
- Architecture/code seams: HIGH — every claim verified by reading the actual compiled `dist/` and source `src/` files, not inferred from documentation
- D-10 rule: MEDIUM-HIGH — archive-wide verified, but not yet a committed artifact with its own D-13 check
- D-12 candidates: LOW (by design — explicitly unconfirmed, developer sign-off required)
- D-06/D-07/D-13 candidate shapes: MEDIUM — described and structurally sound by analogy to Phase 32/33's own successful shapes, but genuinely unmeasured (measuring them now would violate the no-peeking rule)
- Pitfalls: HIGH — each traced to a specific, cited code location or git-history search

**Research date:** 2026-09-22
**Valid until:** 30 days (stable, no fast-moving external dependency) — but re-verify the archive-wide D-10/D-12/PAUSE-03 figures at execution time if `data/streams/` has grown via the nightly CI in the interim (MERGE-01 precedent)
