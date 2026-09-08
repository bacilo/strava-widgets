# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage - Research

**Researched:** 2026-09-08
**Domain:** Statistical derivation over irregular time-series (running-pace smoothing, gap classification, coverage accounting) — internal refinement of an existing TypeScript codebase, not a new library/framework integration
**Confidence:** HIGH — every load-bearing number below was measured directly against the committed archive in this session (scripts run under `/Users/pedf/.claude/jobs/7d0ef571/tmp/`, never touching `src/`, `data/`, or `scripts/`), not inferred from documentation or training knowledge. `data/streams/` and `data/activities/` were read-only throughout; nothing in the repo was modified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Windowing mechanism (PACE-03)**
- **D-01:** Ship adaptive time-based window width — keep `derivePaceSeries`' centred real-time window with interpolated `d` at the window edges, but compute the width per-activity from that activity's own distance-advance-interval distribution rather than the constant `PACE_SMOOTHING_WINDOW_SEC`.
- **D-02:** The width statistic and multiplier are not fixed by CONTEXT.md — research picks them, bound by (a) validation against all four measured interval profiles (medians 2s/16s/24s/60s; activities 4556693525/3647739864/4598855187/5059204779), and (b) a fixed-20s implementation demonstrated failing first, reproducing the 94.81% fast-mass/30% coverage distortion on the 60s-median case.
- **D-03:** If advance-boundary integration (or a hybrid with a time floor) is clearly superior on the measured profiles, it may override D-01 — but only by re-deriving PACE-03/04/06's figures under the new mechanism and recording the comparison. Silently substituting a mechanism while keeping the inherited numbers is not acceptable.

**Gap taxonomy and thresholds (PACE-02, COV-01)**
- **D-04:** Two independent signals, the pause one scale-relative: `recording-gap` = an absolute `t`-jump threshold (>10s, no samples across it — PROJECT.md's 1,233-activity cohort); `pause` = a distance-flat run long relative to that activity's own advance interval, not an absolute seconds value (PROJECT.md's 321-activity cohort).
- **D-05 (hard constraint / discriminator):** an absolute distance-flat threshold would classify ~97% of 5059204779 as paused — this must be demonstrated failing before the scale-relative rule is trusted, and 5059204779 must classify with approximately zero pause time under the shipped rule.

**Coverage accounting and denominator (COV-01)**
- **D-06:** The coverage denominator is the stream's own span, `t[n-1] - t[0]` — not activity metadata's `elapsed_time` (which does not exist on committed stream files). This amends Roadmap Success Criterion 3.
- **D-07:** `covered + Σ(excluded by named category) === t[n-1] - t[0]` exactly, asserted by test and watched failing against the real defect (the `dd <= 0` skip in `computePaceDistribution`) before being trusted.

**What the reader sees**
- **D-08 (COV-02):** Always-on caption with category breakdown under the `Pace Distribution` heading in `buildBreakdownSection` — e.g. `94% of elapsed time covered · 4% recording gaps · 2% paused`.
- **D-09 (PACE-05):** A split whose window crosses a gap gets an inline marker on the split's pace cell plus a short legend under the table naming the measured amount — e.g. `⚠ this km includes 2:14 of recording gap`. Reuses the footnote-asterisk pattern `detail-sections.ts` already uses. Split arithmetic itself is not changed.

**Metadata-vs-stream cross-check (PACE-07)**
- **D-10:** Badge it, keep the metadata value — flagged activity still displays its metadata-derived pace alongside a visible badge naming the disagreement and the stream-derived figure. Nothing recomputed, nothing silently substituted.
- **D-11:** Badge appears on both the detail view's Pace stat card and the Activities list row (all three `renderActivityRow` surfaces via `idPrefix` — Activities, Overview Recent Activities, Overview Recent PRs — must be considered).
- **D-12:** Flagged activities are NOT removed from pace sort/filter results. Disclosure, not suppression.
- **D-13:** For a flagged activity only, the splits table's `+/-` column diffs each split against the stream-derived average rather than the disputed metadata average.
- **D-14:** The flag is persisted as an additive field on the dashboard index row, leaving `DASHBOARD_INDEX_SCHEMA_VERSION` at `1` — precedent stated in `dashboard-index.types.ts:17` for the `gearName` addition.

**Module shape and audit (PACE-01)**
- **D-15:** New module at `src/analytics/pace-derivation.ts` — pure and client-safe (no `fs`, no `fetch`, no DOM), mirroring `trimp.ts`'s discipline. Imported by both the dashboard render path and the CI report script.
- **D-16:** The primary entry point returns the pace series AND the coverage accounting together in one result, so no caller can obtain derived pace without also holding coverage/gap info.
- **D-17:** Presentation-derived pace stays non-persisted on the dashboard render path — never feeds `computeSplits`, never becomes a stats value. What Phase 26 persists is the PACE-07 flag (D-14) and the PACE-06 report (D-19).
- **D-18 (Criterion 4):** Single-source audit ships as a vitest test (runs in existing CI chain for free), greps `src/` for per-sample `dt / (dd / 1000)`-equivalent pace arithmetic, fails on any match outside `pace-derivation.ts`, demonstrated catching a deliberately reintroduced second implementation. Scope is *stream-derived* pace only — `compute-dashboard-index.ts:202` and `detail.ts:610` (metadata-derived `moving_time / distance`) belong to PACE-07, not this audit; the pattern must not conflate them.

**Deliverable artifacts (PACE-06, ERA-03)**
- **D-19:** PACE-06 residual (13-of-154 by ID and percentage) is a committed markdown deliverable at `26-RESIDUAL.md`, following the `15-FIXTURE-CANDIDATES.md` precedent, shipped with the regenerating script under `scripts/`.
- **D-20:** ERA-03 fixture library lives at `src/analytics/pace-fixtures.ts` as named exports. Synthetic fixtures where the expected answer must be known; pinned real-archive cases read from `data/streams/`/`data/activities/` via `node:fs` following `best-effort-fixtures.test.ts`'s pattern — never from gitignored `data/stats/`. Must cover fēnix 6 Pro / Suunto 9 / GPX / intervals.icu-only / no-device-name, plus a decimation-aliased stream, a recording gap, a multi-hour pause, an impossible-speed sample, and the pinned worked example 4556693525.

### Claude's Discretion
- **Windowing mechanism** (D-01/D-02/D-03) — delegated, constrained as above. **Resolved by this research below** (window formula + multiplier), see Summary.
- **Gap taxonomy** (D-04/D-05) — delegated; two-signal recommendation taken, pause scale-relative. **Resolved by this research below** (concrete rule + multiplier).
- **Split gap marking** (D-09) — delegated; inline marker + legend taken as the shipped design.

### Deferred Ideas (OUT OF SCOPE)
- Nothing raised during discussion fell outside the phase boundary.
- Garmin export adapter (STREAM-04) — externally blocked, and a stream-ingestion change forbidden by this milestone's byte-identical constraint.
- IN-17/IN-18 curation-guard cosmetics — belongs with Phase 29.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACE-01 | All stream-derived pace comes from one shared module in `src/analytics/`, imported by both `detail-charts-logic.ts` and `detail-zones.ts` | Confirmed exactly 2 current stream-derived call sites via `grep` (see Don't Hand-Roll / Code Examples); audit-pattern design and false-positive risk (`route-utils.ts`, `gear-aggregate-logic.ts`) documented below |
| PACE-02 | A pace-averaging window never bridges a recording or pause gap; clips at the gap boundary | Segment-priority classification design (recording-gap > pause > covered) makes clipping mechanical — see Architecture Patterns |
| PACE-03 | Smoothing window justified from archive evidence; fixed window disproven by measurement | Window formula `max(20, 2.5 × p90(advanceIntervals))` derived and validated against all four profiles with measured fast-mass/coverage figures reproducing the roadmap's cited recovery numbers to within ~0.05pp on two of three and ~4% window-width variance on the third — see Summary |
| PACE-04 | Pace-distribution histogram routes through shared derivation, eliminating phantom fast mode archive-wide | 154-activity severe cohort re-identified and measured (see PACE-06 below); 4556693525's own histogram measured directly under both baseline and adaptive window |
| PACE-05 | Per-km splits mark any split whose window contains a gap | `startTimeSec`/`endTimeSec` on every `Split` (confirmed in `detail-splits.ts`) already gives the intersection primitive needed; no new plumbing required |
| PACE-06 | Residue adaptive windowing does not fix is quantified, 13-of-154 marginal | **Re-measured exactly: 13 of 154, max 2.42% (documented ceiling 2.4%)** — full ID list produced below; one discriminator edge case found (`3475742397`, baseline already 0%, "strictly lower" unsatisfiable) |
| PACE-07 | Metadata-vs-stream disagreement detected and surfaced, singleton at 1/1,890 | **Re-measured exactly: 1 of 1,890** activities at threshold <200 sec/km, confirmed ID `5059204779` at 112.6 sec/km |
| COV-01 | Covered + excluded (named categories) sums exactly to stream span | Schema confirmed (`elapsed_time` absent from `CanonicalStream`); 4556693525's 3,394-vs-3,393 discrepancy confirmed exactly against real committed files; segment-priority design makes the sum an identity by construction |
| COV-02 | Coverage visible wherever a derived distribution is shown | `buildBreakdownSection`/`detail-sections.ts:313` confirmed as the integration point; caption design inherited from D-08 |
| ERA-03 | Stratified fixture library, synthetic where ground truth is required | Device-family sample IDs found for fēnix 6 Pro, Suunto 9, vívoactive 4, GPX, intervals.icu; **no real multi-hour densely-sampled pause exists in the archive** (longest found: 10.4 min) — must be synthetic, flagged below |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gap-aware pace derivation (window, series) | Browser / Client (also CI report script) | — | Pure computation over an already-fetched stream; D-15 requires client-safety so both the dashboard render path and a future CI report script can import it — no network/DOM dependency either way |
| Gap classification (recording-gap / pause / covered) | Browser / Client (also CI report script) | — | Same module as above (D-16: pace series and coverage returned together) — a classification decision is not persisted, it's derived on read |
| Coverage caption / on-screen disclosure | Browser / Client (SSR-equivalent: static SPA render) | — | `buildBreakdownSection` runs in the dashboard's client-side render path (this project has no server tier — GitHub Pages static hosting) |
| Split gap marking | Browser / Client | — | `detail-sections.ts`'s `buildSplitsSection`, same render path as the chart/histogram |
| PACE-06 residual (13-of-154 list) | API / Backend (CI compute step, offline) | Database/Storage | Computed once by a `scripts/` script reading `data/streams/`, committed to `26-RESIDUAL.md` — not computed client-side; this project's "API tier" is the nightly GitHub Actions compute pipeline, not a live server |
| PACE-07 metadata/stream flag | API / Backend (CI compute step) | Database/Storage | Written into `data/dashboard/index.json` by `compute-dashboard-index.ts` (additive field, D-14) — computed once in CI, read many times by the client |
| Fixture library (`pace-fixtures.ts`) | Browser / Client (test-only) | — | Imported by `vitest` (Node test runner) and, per D-20, potentially by future phases' client code — module itself has no tier restriction beyond D-15's purity rule |
| Single-source audit | Database/Storage (source-tree scan) | — | A build/test-time static-analysis step over `src/`, not a runtime capability in any tier — closest analogy is a CI lint gate |

**Note on this project's tiers:** this is a static SPA on GitHub Pages with a GitHub Actions nightly compute pipeline — there is no live "API/Backend" server. Where the template's "API/Backend" tier is invoked above, it maps to this project's CI compute-step chain (`COMPUTE_ALL_STATS_STEPS`), and "Database/Storage" maps to committed JSON under `data/`.

## Summary

This phase has no external library to select — the whole task is picking the right constants and classification rule for code whose *shape* is already correct (`derivePaceSeries`'s centred, Δt-weighted, interpolated-at-edges window), and unifying two divergent implementations onto one module. The two open numbers CONTEXT.md delegated to research — the adaptive window's width statistic/multiplier, and the pause classifier's scale-relative threshold — were both closed empirically in this session by running real measurement scripts against every committed stream in `data/streams/` (1,865 files) and every committed activity in `data/activities/` (1,890 files), never by search or training-data recall.

**Primary recommendation:** `windowSec = max(PACE_SMOOTHING_WINDOW_SEC, 2.5 × p90(activity's own distance-advance intervals))` for the smoothing window, and a segment-priority gap classifier — `recording-gap` (`Δt > 10s`, absolute, unchanged) takes priority over `pause` (`part of a distance-flat run whose total duration exceeds 5 × p90(advance intervals)`, scale-relative) takes priority over `covered` — reproduces every one of D-02/D-05's required discriminators and the roadmap's cited recovery figures to within measurement noise, using only the same `interpValueAtTime`/`derivePaceSeries` primitives already in `detail-charts-logic.ts`.

**How the window formula was found and verified:** `PACE-03`'s own advance-interval table gives p90 values of 4s / 92s / 99s / 60s for the four profile activities, against target windows of ~150s/~230s/~248s named in Roadmap Criterion 5 for three of them. `150 / 60 = 2.5`; `230 / 92 ≈ 2.5`; `248 / 99 ≈ 2.5` — the multiplier is not a guess, it falls directly out of the roadmap's own cited numbers once you divide. This session re-derived each activity's p90 advance interval directly from its committed stream (measured: 4s / 88.4s / 99s / 60s — three exact or near-exact matches, one within measurement-methodology noise, see Open Questions) and then ran a full re-implementation of `derivePaceSeries` plus a Δt-weighted fast-mass/coverage measurement (mirroring `computePaceDistribution`'s weighting exactly) at both the fixed-20s window and the adaptive window for all three "recovered" activities:

| Activity | Fixed-20s fast-mass / coverage (measured) | Roadmap-cited fixed-20s figures | Adaptive fast-mass / coverage (measured) | Roadmap-cited adaptive figures |
|---|---|---|---|---|
| 5059204779 | 94.80% / 30.4% | 94.81% / 30% | 1.17% / 97.1% | 1.22% / 97% |
| 3647739864 | 59.82% / 39.4% | 59.77% / 40% | 0.62% / 100.0% | 0.00% / 100% |
| 4598855187 | 42.72% / 45.0% | 42.57% / 45% | 0.00% / 100.0% | 0.00% / 100% |

The fixed-20s "demonstrated failing" column matches the roadmap's cited figures almost to the decimal — confirming this session's measurement methodology (Δt-weighted per-index smoothed-pace histogram, threshold 180 sec/km = 3:00/km) is the same one that originally produced those numbers. The adaptive column is close enough (worst case 0.62 percentage points on 3647739864) that this formula is the correct one to ship, not merely a plausible candidate.

**How the pause classifier was found and verified:** an absolute-threshold rule (any distance-flat run >30s = paused) was run against 5059204779 and produced **96.9% pause-flagged time** — matching D-05's own cited "~97% misclassification" almost exactly, so the required "demonstrated failing" discriminator is satisfied by direct measurement, not asserted. A scale-relative rule — flat run duration `> K × p90(that activity's own advance intervals)` — was then swept across `K ∈ {2,3,4,5,6}` for all four profile activities; `K=4` is the minimum multiplier that reaches exactly 0.00% pause time on all four profiles simultaneously, and `K=5` reaches 0.00% with a full extra multiple of headroom above the minimum. **Recommend K=5** for margin, paired with the same recording-gap absolute threshold (>10s) the project already uses for its 1,233-activity cohort.

**Everything else in this phase is architecture, not a numeric unknown** — D-16's single-return-value contract, D-18's audit pattern, D-19/D-20's deliverable shapes are all already fully specified by CONTEXT.md; this research confirms the concrete integration points (`buildBreakdownSection`, `Split.startTimeSec`/`endTimeSec`, `DashboardIndexRow`'s additive-field precedent) exist and behave as CONTEXT.md describes, and surfaces two things CONTEXT.md could not have known without running the numbers: an unsatisfiable literal reading of Roadmap Criterion 1 for one specific activity, and the absence of any real multi-hour *pause* (as opposed to *recording gap*) fixture candidate in the committed archive.

## Standard Stack

### Core

No new library. Every technique needed (windowed Δt-weighted averaging, quantile computation, segment classification) is already implemented in this codebase's own style (`derivePaceSeries`, `computePaceDistribution`, `computeSplits` in the files named in CONTEXT.md) and is a 15-60 line pure function, matching the conclusion `.planning/research/SUMMARY.md` already reached for this whole milestone: `simple-statistics` and `d3-array` were evaluated and rejected at the milestone-research stage, and nothing new emerged in this phase-level research to revisit that call.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| — | — | — | No new runtime dependency; TypeScript 5.9.3 / Node 22 / vitest 4.0.18 (all confirmed already installed) are sufficient |

### Supporting

Not applicable — no new library.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled quantile (`p90` over an activity's own advance intervals, ~10 lines) | `simple-statistics`/`d3-array` | Already rejected at milestone-research stage (SUMMARY.md) — a single quantile call over ≤3,000 floats doesn't clear the bar for a new dependency, and this phase's own measurement scripts (`/Users/pedf/.claude/jobs/7d0ef571/tmp/lib.mjs`) show the R-7 linear-interpolation quantile is ~10 lines and already used correctly |

**Installation:** none required.

**Version verification:** not applicable — no package to verify.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — every algorithm is hand-rolled TypeScript reusing existing project primitives (`interpValueAtTime`, `validateStreamSeries`). `slopcheck`/registry verification was not run because there is nothing to run it against. If a future planning pass introduces any new `package.json` dependency during this phase, the Package Legitimacy Gate protocol must be re-run before that dependency ships.

## Architecture Patterns

### System Architecture Diagram

```
data/streams/{id}.json  (committed, byte-identical — t[], d[], hr?, cadence?, alt?)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  src/analytics/pace-derivation.ts   (NEW — D-15, pure/client-safe) │
│                                                                 │
│  1. classifyGaps(t, d)                                         │
│       walks consecutive segments [t[i], t[i+1]] once;          │
│       priority: recording-gap (Δt>10s abs) > pause              │
│       (flat-run total > 5×p90(advanceIntervals)) > covered      │
│       → { recordingGapSec, pauseSec, coveredSec,                │
│           gapIntervals: [{start,end,kind}] }                    │
│                                                                 │
│  2. derivePaceSeries(t, d, gapIntervals)                       │
│       adaptive window = max(20, 2.5×p90(advanceIntervals));     │
│       centred window PER SAMPLE, clipped at the nearest         │
│       gap boundary instead of the stream extent alone           │
│       → (number|null)[] , one value per sample index            │
│                                                                 │
│  3. one exported entry point (D-16) returns BOTH               │
│       { paceSeries, coverage } together — no caller can         │
│       get one without the other                                 │
└─────────────────────────────────────────────────────────────┘
        │                          │                        │
        ▼                          ▼                        ▼
┌───────────────┐     ┌──────────────────────┐   ┌────────────────────┐
│ detail-charts-  │     │ detail-zones.ts       │   │ detail-splits.ts   │
│ logic.ts        │     │ (histogram) — Δt-      │   │ — unchanged        │
│ (chart) — thin   │     │ weighted buckets fed   │   │ arithmetic;        │
│ wrapper over     │     │ by paceSeries, NOT     │   │ intersects its own │
│ paceSeries        │     │ raw per-sample dt/dd   │   │ [startTimeSec,     │
│                   │     │                        │   │  endTimeSec] with  │
│                   │     │                        │   │  gapIntervals       │
└───────────────┘     └──────────────────────┘   └────────────────────┘
        │                          │                        │
        ▼                          ▼                        ▼
   Pace & Effort chart     buildBreakdownSection       buildSplitsSection
   (unchanged visual)      "Pace Distribution" +        gap marker + legend
                           D-08 always-on coverage       (D-09)
                           caption
```

Separately, an offline path (CI / `scripts/`, not the browser):

```
data/streams/  (all 154 severe-cohort activities)
        │
        ▼
scripts/compute-pace-residual.mjs  (D-19 — regenerates 26-RESIDUAL.md)
        │  imports pace-derivation.ts's classifyGaps + derivePaceSeries
        ▼
26-RESIDUAL.md   (13 IDs + percentages, committed, reviewed)
```

```
data/activities/  (all 1,890)  +  data/streams/  (matching stream)
        │
        ▼
compute-dashboard-index.ts  (existing CI step, MODIFIED)
        │  paceSecPerKm (metadata, unchanged) vs stream-derived pace (via
        │  pace-derivation.ts) — flags when metadata implies <200 sec/km
        ▼
data/dashboard/index.json   row.paceDisagreement?: { streamPaceSecPerKm, ... }  (D-14, additive)
```

### Recommended Project Structure

```
src/analytics/
├── pace-derivation.ts        # NEW (D-15) — gap classification + adaptive derivePaceSeries + coverage
├── pace-derivation.test.ts   # NEW — unit tests, including the D-05/D-02 "demonstrated failing" fixed-20s/absolute-threshold cases
├── pace-fixtures.ts          # NEW (D-20) — named exports, stratified fixture library
├── pace-fixtures.test.ts     # NEW — asserts every required fixture present by name (Criterion 6)
├── pace-single-source.test.ts # NEW (D-18) — grep-based audit, vitest, demonstrated catching a reintroduced 2nd impl
└── best-effort-fixtures.test.ts  # EXISTING — pattern D-20 follows for real-archive fixture reads

scripts/
└── compute-pace-residual.mjs # NEW (D-19) — regenerates 26-RESIDUAL.md from data/streams/

.planning/phases/26-.../
└── 26-RESIDUAL.md            # NEW (D-19) — committed deliverable, 13 IDs + percentages
```

### Pattern 1: Segment-priority gap classification (resolves PACE-02/D-04/D-05/D-07)

**What:** Walk `[t[i], t[i+1]]` once; classify each segment into exactly one of `{recording-gap, pause, covered}` by priority, never by independent overlapping checks. Recording-gap wins ties because an absolute `Δt > 10s` jump is, by the committed schema's own construction, always also part of the segment's distance-flat neighbourhood — checking pause first would double-count or under-count depending on ordering.

**When to use:** The one and only place gap/coverage accounting happens — feeds both PACE-02's window-clipping and COV-01's exact-sum invariant from the same pass.

**Example (measured formula, this session):**
```typescript
// Source: this session's measurement scripts, /Users/pedf/.claude/jobs/7d0ef571/tmp/pause-classifier2.mjs
// Reproduces D-05's required "demonstrated failing" (absolute 30s rule -> 96.9% of 5059204779 flagged paused,
// vs. D-05's own cited "~97%") and the scale-relative rule's required "~zero" (K=5 -> 0.00% on all four profiles).
const RECORDING_GAP_ABS_THRESHOLD_SEC = 10; // unchanged, PROJECT.md's existing 1,233-activity cohort
const PAUSE_GAP_P90_MULTIPLIER = 5;

function classifySegment(dt: number, isPartOfFlatRun: boolean, flatRunTotalSec: number, p90AdvanceInterval: number): 'recording-gap' | 'pause' | 'covered' {
  if (dt > RECORDING_GAP_ABS_THRESHOLD_SEC) return 'recording-gap';
  if (isPartOfFlatRun && flatRunTotalSec > PAUSE_GAP_P90_MULTIPLIER * p90AdvanceInterval) return 'pause';
  return 'covered';
}
```

### Pattern 2: Adaptive window as a per-activity precomputed constant, not a per-sample recomputation

**What:** Compute `p90(advanceIntervals)` and the resulting `windowSec` ONCE per activity (O(n log n) for the sort), then pass it into the existing `derivePaceSeries(t, d, windowSec)` signature unchanged — the window is a single number per call, not something recomputed per sample.

**When to use:** Every call site that currently calls `derivePaceSeries(t, d, PACE_SMOOTHING_WINDOW_SEC)` with the fixed constant.

**Example (measured formula, this session):**
```typescript
// Source: this session's /Users/pedf/.claude/jobs/7d0ef571/tmp/lib.mjs + measure-windows.mjs,
// validated against all four PACE-03 profile activities (see Summary table).
const PACE_WINDOW_P90_MULTIPLIER = 2.5;
const PACE_SMOOTHING_WINDOW_SEC = 20; // existing constant, now used as a FLOOR, not the only value

function adaptiveWindowSec(t: number[], d: number[]): number {
  const p90 = quantile(advanceIntervals(t, d), 0.9);
  return Math.max(PACE_SMOOTHING_WINDOW_SEC, PACE_WINDOW_P90_MULTIPLIER * p90);
}
```
Floor at the existing 20s constant matters empirically, not just defensively: this session measured 4556693525 (p90=4s, unfloored formula would give 10s) both floored and unfloored, and both keep the single clean pace mode PACE-04 already describes — but the *floored* 20s value is what reproduces PACE-06's exact cited residual figures (13-of-154, max 2.42% vs. the cited 2.4%), so keep the floor rather than letting the formula float below it.

### Pattern 3: One entry point returns pace series and coverage together (D-16)

**What:** `derivePaceWithCoverage(stream): { paceSeries: (number|null)[]; coverage: { coveredSec, recordingGapSec, pauseSec, span, gapIntervals } }` — single function, single return shape, both consumed together.

**When to use:** Every call site — the chart, the histogram, the splits table, and the future PACE-06 residual script all call this one function.

**Why:** Structurally prevents COV-02's caption drifting out of sync with the histogram beside it (same lesson as Phase 24's `resolveExcluded`, cited in CONTEXT.md).

### Anti-Patterns to Avoid

- **Computing pause/recording-gap independently and summing:** produces double-counted or under-counted seconds when a segment qualifies for both under naive, non-priority checks — breaks D-07's exact-sum invariant. Use the single priority pass in Pattern 1.
- **Letting the adaptive window float below the existing 20s floor:** this session's own measurement shows the floor is what reproduces the archive's cited PACE-06 figures; an unfloored formula is not "wrong" (it still avoids stair-step noise on the fine-grained profile) but it is *untested against the numbers CONTEXT.md already committed to*, and diverging from those numbers without re-deriving them violates D-03's explicit constraint.
- **Recomputing the histogram from raw per-segment `dt/dd` and only fixing the window in the chart:** this is exactly today's shipped bug (`detail-zones.ts:76` vs `detail-charts-logic.ts:97`) — PACE-01/PACE-04 require the histogram to consume the SAME smoothed `paceSeries` the chart does, Δt-weighted per index, not recomputed per raw segment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interpolating `d` at an arbitrary time | A second interpolation function | `interpValueAtTime` (already in `detail-charts-logic.ts`) | Already correct, already binary-search-based, already used for window edges — this session confirmed it needs no change |
| Validating a stream before deriving | A new guard | `validateStreamSeries` (`best-effort-utils.ts`) | Already the total, never-throwing guard every other module (`detail-zones.ts`, `detail-splits.ts`, `detail-charts-logic.ts` indirectly) relies on |
| A percentile/quantile function | A dependency, or a naive `sort()[Math.floor(...)]` | The R-7 linear-interpolation quantile this session's `lib.mjs` implements (~10 lines) | Matches numpy/Excel/D3's default method; already what `.planning/research/SUMMARY.md` recommends archive-wide for Phase 28's ceiling too — keep the SAME quantile implementation across phases so two phases don't quietly disagree on what "p90" means |
| A "grep for banned patterns, return violations, never throw" scanner | A new pattern for D-18's audit | `scripts/lib/curation-guard.mjs`'s shape (pure function returning a violations array, fail-closed extension handling, no `process.exit` inside the pure function) | Direct, already-tested precedent in this exact repo for "scan `src/` for a banned code shape and prove the scanner catches a planted violation" — the Phase 24 precedent CONTEXT.md doesn't name but that this session found and confirms is reusable |

**Key insight:** every primitive this phase needs already exists in the codebase in a slightly different shape (fixed-window smoothing, raw per-sample histogram, a source-tree content scanner) — the work here is *unifying and parameterizing*, not designing from scratch. Building new versions of any of these from a blank page would silently reintroduce the exact class of divergence (two derivations disagreeing) this phase exists to eliminate.

## Common Pitfalls

### Pitfall 1: The multiplier looks derivable from the roadmap's own table without running real data
**What goes wrong:** `150/60 = 2.5`, `230/92 ≈ 2.5`, `248/99 ≈ 2.5` is a clean arithmetic pattern visible just by reading REQUIREMENTS.md/ROADMAP.md — tempting to accept as "confirmed" without measuring it against the real committed streams.
**Why it happens:** The roadmap's own numbers already look internally consistent; cross-checking against source data feels redundant.
**How to avoid:** This session did run the real measurement (see Summary table) and found the arithmetic pattern holds almost exactly for two of three, with a ~4% window-width discrepancy on the third (`3647739864`: measured p90=88.4s → 221s window vs. the cited ~230s). The discrepancy is small enough not to change the recommendation, but it means CONTEXT.md's own cited figures were likely produced with a slightly different quantile-interpolation method or a slightly different definition of "advance interval" (e.g., counting the very last, often-anomalous gap-to-stream-end interval differently). Flagged in Open Questions — worth a second measurement pass at implementation time using the SAME quantile function this session used, and treating any residual gap as expected floating-point/definitional variance, not a defect.
**Warning signs:** A different quantile implementation (nearest-rank vs. linear-interpolation) silently shifting all four profiles' windows by single-digit percentages.

### Pitfall 2: "Strictly lower for all 154" is not literally satisfiable
**What goes wrong:** Roadmap Criterion 1 requires the after-value to be "strictly lower than that same activity's own baseline for all 154." This session found activity `3475742397` has baseline fast-mass already at exactly 0.00% — the adaptive derivation also measures 0.00%, a tie, not a regression, but not a strict decrease either (you cannot go below zero).
**Why it happens:** The criterion was likely drafted before every one of the 154 was individually measured against both baseline and adaptive.
**How to avoid:** Recommend the plan phrase this row as "strictly lower, OR both exactly zero" — and confirm this is the ONLY exception among the 154 (this session confirmed: 153/154 strictly improve, 1/154 ties at zero, 0/154 regress). Do not silently smooth this over in the plan's checkpoint wording; a row that cannot be satisfied as literally worded is exactly the "checkpoint row can be unsatisfiable" trap this project's own prior milestones (Phase 24 R19/R26, per STATE.md) have hit before.
**Warning signs:** A verification round failing this specific row and nobody being able to explain why without re-running the measurement.

### Pitfall 3: Recording-gap and pause double-counting if classified independently
**What goes wrong:** A segment with `Δt > 10s` is, in every real committed stream this session inspected, also part of a distance-flat run (the device didn't advance distance during the gap it also didn't record samples through) — classifying "is this a recording gap?" and "is this part of a paused flat-run?" as two independent yes/no questions and then excluding a segment under BOTH categories breaks the D-07 exact-sum invariant (double-subtracted from covered time).
**Why it happens:** The two signals are described in CONTEXT.md as "independent," which is true in the sense that they measure different things (a `t`-jump vs. a `d`-plateau), but they are not mutually exclusive at the segment level without an explicit priority rule.
**How to avoid:** Use the single-pass priority classification in Architecture Patterns' Pattern 1 — recording-gap always wins the tie. This makes the sum identity hold by construction rather than needing a separate reconciliation step.
**Warning signs:** `covered + recordingGap + pause !== span` in a test — the sign of the error (sum too LOW) tells you double-counting is the cause, versus too HIGH which would mean a segment was missed entirely.

### Pitfall 4: No real multi-hour *pause* fixture exists in the archive
**What goes wrong:** ERA-03 requires a "multi-hour pause" fixture. This session searched the entire committed archive for the longest continuously-and-densely-sampled (internal sample gaps ≤30s) distance-flat run and found only 10.4 minutes (`3475742397`), not hours. The only multi-hour gap found (`11544429866`, 35.4 hours) is a `recording-gap` by construction (a single huge `t`-jump with essentially no samples across it, not a densely-sampled flat run) — it satisfies ERA-03's separate "recording gap" fixture requirement, not the "multi-hour pause" one.
**Why it happens:** A watch left running for hours without motion is a real-world scenario, but this archive apparently never contains one where the device kept sampling densely throughout (most long stops either stopped the recorder entirely, becoming a recording-gap, or the run simply ended).
**How to avoid:** Build the "multi-hour pause" fixture synthetically (as ERA-03's own text already anticipates: "fixtures must be synthetic where the expected answer must be known") — e.g., a constructed `t`/`d` array with dense 2-5s sampling for 3 hours where `d` never advances, embedded inside an otherwise-normal short run.
**Warning signs:** A plan that tries to pin a real activity ID for this fixture and can't find one that actually qualifies — this session already did that search so the planner doesn't have to repeat it.

### Pitfall 5: Two additional metadata-derived pace sites beyond the two D-18 already names
**What goes wrong:** D-18's own text names `compute-dashboard-index.ts:202` and `detail.ts:610` as the metadata-derived sites the single-source audit must NOT conflate with stream-derived arithmetic. This session's `grep` found two MORE metadata-derived pace computations: `src/widgets/shared/route-utils.ts:183` (`(movingTimeSec / distanceMeters) * 1000`) and `src/analytics/gear-aggregate-logic.ts:138` (`bucket.movingTimeSec / (bucket.distanceM / 1000)`).
**Why it happens:** CONTEXT.md's audit was scoped to the dashboard's own detail/index code; `route-utils.ts` feeds the embeddable IIFE widgets (a different deployment surface from the dashboard SPA), and `gear-aggregate-logic.ts` aggregates over gear buckets, not raw per-activity metadata — both are legitimately outside PACE-01's stream-derived scope, but a naive audit pattern (e.g., grepping for any `/ (X / 1000)` shape) would false-positive on both.
**How to avoid:** Write the audit pattern to match the STREAM-SAMPLE shape specifically — i.e., look for the literal residual arithmetic shape tied to loop variables sourced from `stream.t[]`/`stream.d[]` (or, more robustly, simply grep for the literal strings `dt / (dd / 1000)` and `elapsed / (metres / 1000)` — the exact two expressions this session found at `detail-zones.ts:76` and `detail-charts-logic.ts:127` — since after the refactor neither literal string should exist anywhere outside `pace-derivation.ts`). Do not use a broad `movingTime.*distance` pattern; it will catch all four metadata/aggregate sites and produce false positives the "demonstrated catching a reintroduced implementation" test would then have to explicitly allowlist.
**Warning signs:** The audit test fails on `route-utils.ts` or `gear-aggregate-logic.ts` at write-time with no code change to either file — a sign the pattern is too broad.

## Code Examples

### Current stream-derived pace sites (confirmed via `grep`, this session — the two PACE-01 collapses)
```typescript
// Source: src/dashboard/views/detail-zones.ts:76 (computePaceDistribution)
const paceSecPerKm = dt / (dd / 1000);
```
```typescript
// Source: src/dashboard/views/detail-charts-logic.ts:127 (derivePaceSeries)
result[i] = elapsed / (metres / 1000);
```

### Current metadata-derived pace sites (confirmed via `grep`, this session — OUT of PACE-01's audit scope, IN PACE-07's cross-check scope for the two named in D-18; the other two are informational)
```typescript
// Source: src/dashboard/views/detail.ts:610-613 — PACE-07's subject
const paceSecPerKm =
  distanceM !== null && distanceM > 0 && movingTimeSec !== null && movingTimeSec > 0
    ? movingTimeSec / (distanceM / 1000)
    : null;
```
```typescript
// Source: src/analytics/compute-dashboard-index.ts:202-203 — PACE-07's subject, writes DashboardIndexRow.paceSecPerKm
const paceSecPerKm =
  distanceM > 0 && movingTimeSec > 0 ? round1(movingTimeSec / (distanceM / 1000)) : null;
```
```typescript
// Source: src/widgets/shared/route-utils.ts:183 — NOT named by D-18; different deployment surface (embeddable widgets)
const paceSecondsPerKm = (movingTimeSec / distanceMeters) * 1000;
```
```typescript
// Source: src/analytics/gear-aggregate-logic.ts:138 — NOT named by D-18; per-gear aggregate, not per-activity
bucket.distanceM > 0 ? round1(bucket.movingTimeSec / (bucket.distanceM / 1000)) : null;
```

### Measured window/coverage formula (this session, reproducible — see Summary table for the full validation)
```typescript
// Reproduces (measured, this session): 5059204779 94.80%/30.4%->1.17%/97.1%;
// 3647739864 59.82%/39.4%->0.62%/100.0%; 4598855187 42.72%/45.0%->0.00%/100.0%.
// Roadmap's cited figures: 94.81%/30%->1.22%/97%; 59.77%/40%->0.00%/100%; 42.57%/45%->0.00%/100%.
function quantile(sortedAsc: number[], q: number): number {
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

function advanceIntervals(t: number[], d: number[]): number[] {
  const intervals: number[] = [];
  let lastAdvanceT = t[0];
  for (let i = 1; i < t.length; i++) {
    if (d[i] > d[i - 1]) { intervals.push(t[i] - lastAdvanceT); lastAdvanceT = t[i]; }
  }
  return intervals.sort((a, b) => a - b);
}
```

### PACE-06 residual: full measured list (13 of 154, this session — for `26-RESIDUAL.md`/`compute-pace-residual.mjs` to reproduce)
```
4556693525   2.42%   (also the pinned PACE-04 worked example — see Open Questions)
5059204779   1.17%   (also the pinned PACE-07 singleton)
5059213289   0.64%
3647739864   0.62%
4548213751   0.59%
4531479183   0.56%
5465833080   0.56%
5520899318   0.56%
5566805363   0.56%
4569639779   0.54%
4667351283   0.53%
3789623232   0.51%
4332544744   0.50%
```
Cohort definition that reproduces the documented "154": `>15% of consecutive samples have Δd === 0` AND `sampleCount >= 50` (the 50-sample floor excludes one degenerate 6-sample stream — `11865310195`, 100% zero-distance because it is a near-empty manual/short entry, not a decimation artifact — which otherwise makes the raw count 155, not 154).

### PACE-07 threshold: exact archive-wide count (this session)
```
1,890 activities scanned (data/activities/*.json)
1 flagged at moving_time/(distance/1000) < 200 sec/km:
  5059204779: paceSecPerKm=112.6, distance=10804, movingTime=1216
```

### COV-01 denominator: confirmed schema + discrepancy (this session)
```
CanonicalStream (src/streams/stream.types.ts) fields: schemaVersion, id, source,
distanceSource, sampleCount, channels, t, d, hr?, cadence?, alt? — NO elapsed_time field.

data/activities/4556693525.json: "elapsed_time": 3393
data/streams/4556693525.json:    t[last] - t[0] = 3394
```
Exact match to D-06's cited "3,394 (stream) vs 3,393 (metadata)".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fixed `PACE_SMOOTHING_WINDOW_SEC = 20` for every activity | `max(20, 2.5 × p90(activity's own advance intervals))` | This phase | Recovers the three coarse-emission-interval activities from 94.81%/59.77%/42.57% phantom fast-mass to 1.22%/0.00%/0.00% (roadmap-cited) / 1.17%/0.62%/0.00% (this session's measurement) |
| Raw per-sample `dt/dd` histogram (`detail-zones.ts:76`) | Δt-weighted histogram fed by the same smoothed `paceSeries` the chart uses | This phase | Eliminates the phantom fast mode/72%-coverage bug on 4556693525, matching the chart's already-correct distribution |
| Absolute distance-flat threshold (would classify 96.9% of 5059204779 as paused, measured this session) | Scale-relative: flat run > 5×p90(own advance interval) | This phase | Correctly leaves 5059204779 at ~0% pause (0.00% measured at K=4 or K=5) while still catching genuinely long stops on other profiles |

**Deprecated/outdated:**
- The two independent pace derivations (`derivePaceSeries` fixed-20s window, `computePaceDistribution` raw per-sample) — both retired as independent implementations; both become thin callers of the new shared module.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PACE_WINDOW_P90_MULTIPLIER = 2.5` and `PAUSE_GAP_P90_MULTIPLIER = 5` are the exact constants to ship | Summary, Pattern 1/2 | LOW — both were derived and cross-validated against real measurement in this session (not training-data recall), but they are still this session's own choice within CONTEXT.md's delegated discretion, not an externally-mandated number. A different multiplier in the same ballpark (e.g. K=4 for pause) would also satisfy the stated discriminators; 2.5/5 are recommended, not the only valid values. |
| A2 | The `3647739864` window discrepancy (measured 221s vs. roadmap-cited ~230s, both consistent with a 2.5× multiplier applied to slightly different p90 measurements) is measurement-methodology noise, not a sign the formula is wrong | Pitfall 1, Summary | LOW-MEDIUM — if the discrepancy is instead caused by a materially different "advance interval" definition than this session used, the multiplier itself could need re-tuning against a corrected measurement. Recommend re-running this session's `advance-intervals.mjs` script against the implementation once `pace-derivation.ts` exists, to confirm the production TypeScript reproduces this session's Node/mjs measurement exactly. |
| A3 | No real committed activity has a multi-hour, densely-sampled pause (Pitfall 4) | Common Pitfalls, ERA-03 support | LOW — this was an exhaustive scan of all 1,865 stream files with an explicit "internal gap ≤30s" density filter; a much looser density filter might surface a different, still-real candidate, but any candidate found that way would have a less clean pause signature than a synthetic fixture provides anyway. |

**If this table is empty:** N/A — see rows above.

## Open Questions (RESOLVED)

> All three were resolved during planning (2026-09-08). Each carries an inline
> **RESOLVED** line naming the plan that operationalises it.

1. **RESOLVED — see plan 26-02.** Plan 26-02 Task 2 asserts the shipped window as a band rather than an exact value and carries an explicit stop-and-record instruction (per D-03) if the measured window falls outside it, so a residual discrepancy is surfaced rather than absorbed.

   **Does the production TypeScript quantile implementation need to match this session's Node script exactly to reproduce the roadmap's exact cited windows (150s/230s/248s)?**
   - What we know: Two of three profiles matched the cited target windows almost exactly (150.0s, 247.5s); the third (`3647739864`) measured 221.0s against a cited ~230s, a ~4% difference.
   - What's unclear: Whether this is floating-point/interpolation-method noise (this session used R-7 linear interpolation) or a genuinely different "advance interval" definition used when CONTEXT.md's figures were originally produced (CONTEXT.md itself labels its own numbers "re-derivable; not yet a committed artifact").
   - Recommendation: When `pace-derivation.ts` is implemented, re-run the exact measurement against the shipped TypeScript (not this session's throwaway `.mjs` scripts) and treat any residual discrepancy under ~5% as expected variance rather than a defect — but if the real implementation's `3647739864` window comes out meaningfully different from ~221-230s, re-derive PACE-03/06's cited figures for that activity specifically, per D-03's requirement.

2. **RESOLVED — see plan 26-09.** Plan 26-09 Task 2 requires `26-RESIDUAL.md` to state explicitly that `4556693525` legitimately holds both roles, so a future reader does not mistake it for a measurement error.

   **Should `4556693525`'s own PACE-06 residual (2.42%, measured this session) be listed alongside its role as the PACE-04 worked example?**
   - What we know: This session's residual measurement includes `4556693525` at 2.42% — the single highest residual in the 13-activity list, essentially matching PACE-06's stated ceiling (0.5-2.4%) almost exactly at its top end. `4556693525` is ALSO the pinned PACE-04 exemplar for the phantom-fast-mode fix (its shipped histogram bug, now fixed) and separately provides the PR-plausibility fixture for a future phase (400m effort at 44.0s).
   - What's unclear: Whether `4556693525` appearing in BOTH the "fixed" (PACE-04) and "still has a marginal residual" (PACE-06) roles is intentional in the original scoping, or whether the roadmap's authors expected the 13-activity residual to be a disjoint set from the worked example.
   - Recommendation: This is not a contradiction — a residual of 2.42% is consistent with "the fix works, and there is still a small genuine-device-over-measurement tail," which is exactly what PACE-06 describes. Note it explicitly in `26-RESIDUAL.md` so a future reader doesn't mistake it for a measurement error.

3. **RESOLVED — see plan 26-09.** Plan 26-09 re-derives the 154-cohort and residual against the archive at execution time rather than this session's frozen list, and checks the "strictly lower, or both zero" wording per activity, so additional tie cases introduced by archive growth are caught.

   **Is `3475742397`'s "strictly lower" tie (Pitfall 2) the only such case, or could new activities added to the archive between this research session and implementation introduce more?**
   - What we know: Exactly 1 of the measured 154 has baseline fast-mass already at 0.00%.
   - What's unclear: The archive grows continuously (this session found 1,890 activities vs. PROJECT.md's cited 1,864-1,868 figures from the scoping session, and 741 vs. 716 no-device-name activities — the archive has grown by roughly two dozen activities since the milestone was scoped).
   - Recommendation: Re-run the 154-cohort identification and residual measurement against the archive at implementation time, not against this session's frozen list — treat this session's exact IDs/percentages as a strong prior, not a guarantee, and re-verify the "strictly lower, or both zero" wording still covers whatever the re-measurement finds.

## Environment Availability

Not applicable in the usual external-dependency sense — this phase has no new runtime/CLI/service dependency. Everything needed (Node 22, TypeScript 5.9.3, vitest 4.0.18) is already installed and was used directly in this research session's measurement scripts.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, measurement scripts | ✓ | 25.2.1 (session), 22 (project target per PROJECT.md) | — |
| TypeScript | `tsc --noEmit` gate | ✓ | 5.9.3 | — |
| vitest | Unit/audit tests | ✓ | 4.0.18 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, per STATE.md's Phase 24 cross-plan-defect lesson; keep this setting, do not re-enable parallelism for this phase's new test files) |
| Quick run command | `npx vitest run src/analytics/pace-derivation.test.ts` |
| Full suite command | `npm run test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACE-01 | Zero remaining stream-derived `dt/dd`-equivalent arithmetic outside `pace-derivation.ts` | unit (grep-based) | `npx vitest run src/analytics/pace-single-source.test.ts` | ❌ Wave 0 |
| PACE-02 | Window clips at gap boundary, never bridges | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "gap boundary"` | ❌ Wave 0 |
| PACE-03 | Fixed-20s demonstrated failing on 60s-median profile; adaptive window recovers it | unit, against real committed stream `5059204779` | `npx vitest run src/analytics/pace-derivation.test.ts -t "adaptive window"` | ❌ Wave 0 |
| PACE-04 | Histogram routes through shared derivation; 4556693525's phantom mode gone | unit, real archive | `npx vitest run src/analytics/pace-derivation.test.ts -t "histogram"` | ❌ Wave 0 |
| PACE-05 | Split gap marking present when window crosses a gap | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gap marker"` | ❌ Wave 0 (existing `detail-sections.test.ts` file may already exist — extend, don't duplicate) |
| PACE-06 | 13-of-154 residual reproducible from `scripts/compute-pace-residual.mjs` | integration (script, real archive) | `node scripts/compute-pace-residual.mjs` (diff against committed `26-RESIDUAL.md`) | ❌ Wave 0 |
| PACE-07 | Exactly 1 of 1,890 flagged at <200 sec/km metadata pace | unit + archive-wide dry run | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pace disagreement"` | ❌ Wave 0 (extend existing `compute-dashboard-index.test.ts`) |
| COV-01 | `covered + recordingGap + pause === span` exactly, watched failing against `dd<=0` skip | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "coverage sums"` | ❌ Wave 0 |
| COV-02 | Coverage caption present under Pace Distribution heading | unit (DOM assertion, jsdom-free per this project's convention — text/structure assertion) | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverage caption"` | ❌ Wave 0 |
| ERA-03 | Every named fixture present by name | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts`
- **Per wave merge:** `npm run test` (full suite, `fileParallelism: false`)
- **Phase gate:** Full suite green + `tsc --noEmit` + `npm run build-widgets` before `/gsd-verify-work`, per this project's existing convention (confirmed in STATE.md across every prior phase)

### Wave 0 Gaps
- [ ] `src/analytics/pace-derivation.ts` + `.test.ts` — the module itself
- [ ] `src/analytics/pace-fixtures.ts` + `.test.ts` — fixture library
- [ ] `src/analytics/pace-single-source.test.ts` — D-18's audit
- [ ] `scripts/compute-pace-residual.mjs` — D-19's regenerating script
- [ ] `.planning/phases/26-.../26-RESIDUAL.md` — D-19's committed deliverable (13 IDs, this session's measured list is a strong starting draft — re-verify before committing as final)
- [ ] Extend `src/dashboard/views/detail-sections.test.ts` — D-08/D-09's caption and split marker
- [ ] Extend `src/analytics/compute-dashboard-index.test.ts` — PACE-07's flag field
- [ ] This project has NO browser checkpoint tradition skipped lightly — per PROJECT.md, every prior milestone phase closed on a human browser checkpoint because "automated gates have missed shipped rendering defects three times." COV-02's on-screen caption and D-09's split marker are exactly the kind of visual change that convention exists for; the plan should include one, even though Phase 26 has no `UI hint` flag noted differently from other phases in ROADMAP.md — ROADMAP.md marks this phase `UI hint: yes`, confirming a checkpoint is expected.

**Framework install:** none needed — vitest already configured project-wide.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per this template's default), but this phase has essentially no attack surface: it adds a pure-computation module reading already-committed, already-trusted JSON (`data/streams/`, `data/activities/`) and writes an additive field to an already-published artifact (`data/dashboard/index.json`). No new user input, no new network call, no new write path, no new auth/session surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | Yes (narrow) | `validateStreamSeries` (existing, reused unchanged) already total-guards malformed `t`/`d`; the new module must remain equally total/never-throwing on any shape of committed stream, since a stream can be arbitrarily malformed by a future backfill bug |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed/adversarial `data/streams/{id}.json` (e.g. from a future ingestion bug) causing an uncaught exception in the render path | Denial of Service (client-side crash) | `validateStreamSeries`'s existing total-function contract, reused unchanged by `pace-derivation.ts` per D-15's purity discipline; every new function in this module must also be total (return a safe default, never throw) on any array-shaped input |
| `?? 0` / `|| 0` silently coercing a missing/insufficient-window pace value into a plausible-looking zero, corrupting an average | Tampering (data integrity, not security in the traditional sense, but the exact class of bug PITFALLS.md's Pitfall 9 names) | Use `null`, not `0`, for "insufficient window" / "no data" states, and exclude nulls from denominators — already the pattern `derivePaceSeries` uses today; keep it in the adaptive version |

## Sources

### Primary (HIGH confidence — measured directly against the committed repository in this session)
- `data/streams/*.json` (1,865 files) — read via `node:fs` from throwaway scripts under `/Users/pedf/.claude/jobs/7d0ef571/tmp/`, never modified
- `data/activities/*.json` (1,890 files) — same
- `src/dashboard/views/detail-charts-logic.ts`, `detail-zones.ts`, `detail-splits.ts`, `detail.ts`, `detail-sections.ts` — read directly, line numbers cited above confirmed by `grep -n`
- `src/analytics/trimp.ts`, `best-effort-fixtures.test.ts`, `compute-dashboard-index.ts`, `dashboard-index.types.ts`, `best-effort-utils.ts` — read directly
- `src/streams/stream.types.ts` — read directly, confirmed `elapsed_time` field absence
- `src/dashboard/views/list.ts`, `list-logic.ts` — read directly, confirmed `idPrefix`/`renderActivityRow`/sort-value integration points
- `scripts/lib/curation-guard.mjs` — read directly for D-18's audit-pattern precedent
- `package.json`, `vitest.config.ts` (referenced via STATE.md's `fileParallelism: false` note) — confirmed toolchain versions

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md`, `PITFALLS.md`, `SUMMARY.md` — prior milestone-level research, read in full; used for cross-referencing pitfall categories (silent-drop coverage, cumulative-vs-differentiated inequivalence, absolute thresholds not surviving device eras) but every NUMBER in this phase-level RESEARCH.md was independently re-measured against the live archive, not taken on the prior research's authority alone

### Tertiary (LOW confidence)
- None — this phase's research required no external web sources; the whole task was internal measurement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, confirmed by direct source read
- Architecture: HIGH — every named integration point (`buildBreakdownSection`, `Split.startTimeSec`/`endTimeSec`, `DashboardIndexRow` additive-field precedent) confirmed present in the actual committed source
- Window/pause formulas: HIGH — both derived AND cross-validated against real measurement in this session, not asserted from documentation or training recall
- PACE-06/PACE-07 archive-wide figures: HIGH — exact re-derivation against all 1,890/1,865 committed files, not sampled or extrapolated
- Fixture availability (ERA-03): HIGH for the negative finding (no real multi-hour pause exists), MEDIUM for the specific device-family sample IDs listed (spot-checked, not exhaustively validated against every field the fixture library will need)

**Research date:** 2026-09-08
**Valid until:** Recommend re-verifying the 154-cohort/13-residual/1,890-count numbers at implementation time if more than ~2 weeks elapse before Phase 26 executes — this archive grows via nightly CI sync (confirmed: activity count already drifted from PROJECT.md's cited 1,864-1,868 to this session's measured 1,890 since the milestone was scoped on the same date, 2026-09-08, earlier in the day).
