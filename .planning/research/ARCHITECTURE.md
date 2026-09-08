# Architecture Research: Pace Data-Quality Integration

**Domain:** Static analytics-pipeline SPA — nightly precompute + lazy-fetch dashboard, GitHub Pages hosting
**Researched:** 2026-09-08
**Confidence:** HIGH (all claims traced to real file paths/functions read in this repo; no external ecosystem uncertainty — this is an internal-integration question, not a "what does the ecosystem look like" question)

This is a subsequent-milestone integration study, not a greenfield design. Every recommendation below cites the real precedent in this codebase it extends, and the HARD CONSTRAINT (committed `data/streams/` stays byte-identical) is treated as load-bearing throughout.

## System Overview (as it exists today, annotated with v2.2 insertion points)

```
┌──────────────────────────── CI: nightly (COMPUTE_ALL_STATS_STEPS) ───────────────────────────┐
│  compute-stats → compute-advanced-stats → compute-geo-stats → compute-best-efforts            │
│                                                    │ (reads data/streams/*.json)                │
│                                            [NEW quality signals — insertion point #2/#3]        │
│                                                    ▼                                            │
│                                      compute-age-grading → compute-dashboard-index              │
│                                                                    │ (reads best-efforts.json)  │
│                                                            [NEW index fields — insertion #2]     │
│                                                                    ▼                             │
│                                      compute-gear-aggregate → compute-training-load             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                          writes → data/stats/*.json, data/stats/best-efforts/{id}.json (shard),
                                   data/dashboard/index.json   [+ NEW data/stats/pace-quality/{id}.json]
                                                    │
                                                    ▼ (gitignored, regenerated; committed inputs unchanged)
┌───────────────────────────── Static SPA (src/dashboard/) — GitHub Pages ─────────────────────┐
│  index-client.ts: fetch-once data/dashboard/index.json (compact manifest, list/filter/badges) │
│         │                                                                                       │
│         ▼ on activity open                                                                     │
│  detail-client.ts: lazy fetch data/activities/{id}.json + data/streams/{id}.json               │
│  best-efforts-client.ts: lazy fetch data/stats/best-efforts/{id}.json                          │
│  [NEW] pace-quality-client.ts: lazy fetch data/stats/pace-quality/{id}.json                    │
│         │                                                                                       │
│         ▼                                                                                       │
│  detail-charts-logic.ts (derivePaceSeries, 20s window) ─┐                                       │
│  detail-zones.ts (computePaceDistribution, raw dt/dd)   ├─→ [UNIFY onto src/analytics/ shared]  │
│  detail-splits.ts (computeSplits, Δt-weighted, correct) ┘   (already correct — leave alone)     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
┌───────────────────────── Local-only: npm run curate (scripts/curate-server.mjs) ──────────────┐
│  Serves built dist/widgets from 127.0.0.1:4173, injects overlay script tag (response-patch      │
│  only). PUT/DELETE /__curate/exclusions/:id → data/best-effort-exclusions.json (atomic write,   │
│  mirrored into dist/widgets/data/). POST /__curate/recompute → spawns                           │
│  dist/index.js compute-best-efforts, compute-dashboard-index.                                   │
│  [NEW] review-queue routes reuse this exact namespace/guard/mirror machinery — see Q4.          │
│  Guarded by: curation-guard.mjs (build-time content/name scan) +                                │
│              verify-dashboard-publish.mjs (HTTP-layer 404 assertion) — both structural,         │
│              not enumerated-route-based, so new /__curate/* routes are covered for free.        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

export_data/ (gitignored, local-only originals) ── read ONLY by src/streams/backfill-streams.ts,
the sole precedent for a local-only compute step. Not in COMPUTE_ALL_STATS_STEPS, not reachable
from CI. v2.2's target features are all computable from the COMMITTED stream (t/d/alt) alone, so
this milestone should NOT need a new local-only step — see Q5.
```

## Q1 — Where the shared pace derivation lives

**Answer: `src/analytics/`, not `src/dashboard/`.**

The precedent is already established and load-bearing: `src/analytics/best-effort-utils.ts` is pure, DOM-free, I/O-free logic, and it is *already imported directly by three dashboard view modules* today:

- `src/dashboard/views/detail-charts-logic.ts:19` — `import { validateStreamSeries } from '../../analytics/best-effort-utils.js'`
- `src/dashboard/views/detail-zones.ts:24` — same import
- `src/dashboard/views/detail-splits.ts:19` — same import

Because this project is a static SPA with no server, "shared between CI and browser" is not a network/API-boundary problem here — it is just "two different JS runtimes (Node CLI, browser via Vite bundle) import the same ES module." `src/analytics/` is the established convergence point for exactly that: `compute-best-efforts.ts` (a CI compute step, invoked from `src/compute-all-stats-steps.ts`) and the three dashboard view modules above both call into `best-effort-utils.ts`'s `validateStreamSeries`. There is no precedent anywhere in this repo for `src/dashboard/` code being imported back into `src/analytics/` or into a CI compute step — the dependency arrow only ever runs `analytics/ → dashboard/`, never the reverse. That is the boundary rule to preserve.

**Concretely:** add a new module, e.g. `src/analytics/pace-derivation.ts`, that owns:
- Gap classification over a validated `(t, d)` series — the concept neither existing implementation has today. `validateStreamSeries` only checks length/finiteness/monotonicity; it says nothing about *recording gaps* (`dt` > ~10s) or *pause gaps* (near-zero `dd` sustained across `dt` ≥ 30s), which is exactly the distinction PROJECT.md's "Honest coverage" goal requires (1,233 activities have a >10s recording gap; 321 have >5min of pause-gap time).
- A gap-aware `derivePaceSeries` — presentation series for the chart band, adapted from the existing `detail-charts-logic.ts:97` implementation (which already uses real-Δt-weighted windows and `interpValueAtTime`; it is the *better* of the two today), but modified to stop silently smoothing straight across a classified gap.
- A gap-aware `computePaceDistribution` — adapted from `detail-zones.ts:61`'s per-segment `dt / (dd / 1000)` walk (which is honest about weighting by real `Δt` per segment already, but has no gap awareness at all — it is what manufactures the phantom fast-mode cluster PROJECT.md's worked example describes), modified to *exclude* gap-spanning segments from a bucket rather than let them alias into it.

Both current call sites (`buildChannelSeries('pace', …)` in `detail-charts-logic.ts`, `computePaceDistribution` in `detail-zones.ts`) become thin wrappers that call into the new shared module, rather than the split logic that exists today. `detail-splits.ts`'s `computeSplits`/`accumulateWeighted` is a *third*, structurally different computation (per-km-boundary Δt-weighted averages, already correct per its own docblock) — it is not one of the "two divergent" implementations PROJECT.md names, and nothing in the target features list calls for changing it; leave it alone unless a later gap-flagging need on splits emerges (flag as an open question, not a requirement).

**Test precedent:** `best-effort-utils.test.ts` sits beside the module it tests; `detail-charts-logic.test.ts` and `detail-zones.test.ts` already unit-test their respective pace math in isolation. A new `pace-derivation.test.ts` in `src/analytics/` should absorb the pace-specific cases those two files currently carry, once the view modules become thin wrappers.

## Q2 — Precompute vs derive-on-read

**Precompute the signals that need to be a `DashboardIndexRow` field (list badges/filtering); precompute-but-shard everything else; do not derive quality signals in the browser at all.**

This project already has a firm, load-bearing lazy-data contract, stated directly in `index-client.ts`'s docblock: *"The manifest is ~300-500KB, so it MUST be fetched at most once per page session no matter how many views... ask for it during bootstrap."* `DashboardIndexRow` (`dashboard-index.types.ts`) is deliberately "browse-complete... anything a ... sort or filter needs is a row field, because a field absent from the index cannot be sorted or filtered without fetching all 1,867 detail files" — and it already carries exactly this shape of signal: `lowConfidence: boolean`, `excludedFromRecords: boolean`, `prCount: number`, `streams: DashboardIndexStreams` (itself `{available, hr, cadence, elevation, distanceSource}` — small booleans/enums, not raw arrays).

That is the template to follow for quality signals:

**Belongs in the index (compact scalars/booleans, drives list-level badges/filtering):**
- A small quality summary object mirroring `DashboardIndexStreams`'s shape, e.g. `quality: { hasRecordingGap: boolean, hasPauseGap: boolean, gapSec: number, stairStepRatio: number, impossibleSampleCount: number, elapsedVsMovingDivergenceSec: number, deviceEra: string | null }`. Every one of these is a single number/boolean per activity, computed once from the committed stream's `t`/`d`/`alt` arrays plus `activity.elapsed_time`/`activity.moving_time` (both already read into `compute-dashboard-index.ts`'s per-row loop) and the stream manifest's existing `source: StreamSource` field (`'fit'|'gpx'|'intervals'`, already present in `StreamManifestEntryAvailable` but not yet threaded into `DashboardIndexStreams` — a purely additive addition, same shape as the `gearName` addition dashboard-index.types.ts's own docblock documents: *"`DASHBOARD_INDEX_SCHEMA_VERSION` stays at `1` for the `gearName` addition below — it is a purely additive field."* The quality summary should land the same way: additive fields, schema version unchanged, `verify-dashboard-publish.mjs` unaffected).
- `deviceEra` is derivable cheaply from `source` + `activity.start_date` (a coarse bucket, e.g. "FIT (2018-2021)" vs "intervals.icu (2026-)") — no need to read anything beyond what's already resident in the compute-dashboard-index loop.

**Belongs in a per-activity shard, fetched lazily on open (detailed, larger, only needed once a detail view is open):**
- The full gap profile (list of individual gap segments with offsets/durations, not just a boolean+total), a stair-step sample-by-sample trace if the badge wants a mini-visualization, and the impossible-sample list (which samples, why). This is exactly the shape `compute-best-efforts.ts` already established for `best-efforts.json`: it writes both an archive-wide document AND, explicitly to avoid "fetch[ing] this whole archive-wide document in a browser (it is multiple MB for the live archive)," a per-activity shard at `data/stats/best-efforts/{id}.json` (see `compute-best-efforts.ts:313-322`), fetched by `best-efforts-client.ts`. The identical pattern applies here: a new `data/stats/pace-quality/{id}.json` shard, written by the same nightly step that produces the index summary, fetched by a new `pace-quality-client.ts` that mirrors `detail-client.ts`'s `loadDetail`/`InvalidActivityIdError`/in-flight-Map-memoization shape exactly.

**Nothing should be derived in the browser for quality signals.** The one thing that legitimately *stays* browser-computed is the full-resolution pace *series* for the chart (`derivePaceSeries`'s per-sample output) — that is inherently too large and too view-specific (window size, x-axis mode, zoom) to precompute variably, and it already is browser-computed today via `buildChannelSeries`. Quality *signals*, by contrast, are fixed scalar summaries with no rendering-time variability, so precomputing them in CI is strictly better: it matches every other precomputed document in this pipeline (`best-efforts.json`, `training-load.json`, `age-grading.json`), it keeps the browser bundle free of the gap-classification logic duplicated a second time, and — critically — it lets it use the SAME shared `src/analytics/pace-derivation.ts` gap-classifier from Q1 in exactly one runtime (Node, at CI time) rather than needing it to also run acceptably fast in-browser over a cold-fetch stream.

## Q3 — Where sharpened PR rejection belongs, and the ceiling/history ordering problem

**It belongs inside `compute-best-efforts.ts`/`best-effort-utils.ts`, as an additional pass appended AFTER the existing archive-wide accumulation and BEFORE `markPRs`/`rankTopN` — never as a per-activity, single-pass check like the existing `isPlausible`.**

Today's pipeline, read directly from `compute-best-efforts.ts`, is single-pass per activity:

```
for each activity (manifest order):
  computeActivityEfforts()          // pure, best-effort-utils.ts
    → findBestEffort()              // two-pointer sweep, per activity, no archive context
    → isPlausible()                 // activity's own max_speed + FIXED WORLD_RECORD_SPEED_MPS ceiling
  isExcluded()                      // exclusion list — externally authored, no circularity
  byDistance.get(key).push(entry)   // accumulate into a Map<distance, entries[]>, ARCHIVE-WIDE

// only after the full loop above completes:
for each distance:
  markPRs(byDistance.get(key))      // sorts CHRONOLOGICALLY, stamps wasPRAtTheTime
  rankTopN(byDistance.get(key))     // sorts FASTEST-FIRST, truncates to top 10
```

`isPlausible` (`best-effort-utils.ts:140`) is deliberately activity-local — it only ever sees one activity's `max_speed` and a *global*, hand-maintained `WORLD_RECORD_SPEED_MPS` table (`best-effort-utils.ts:34`, "admits a 44.0s 400m" per PROJECT.md). A **personal** plausibility ceiling is fundamentally different: it needs the athlete's *own* demonstrated range across the whole archive for a given distance, which does not exist until the archive-wide `byDistance` accumulation above has already run. That is the ordering problem stated in the question — the ceiling needs the history, but "the history" as currently defined is "whatever `isPlausible`+exclusions already let through," which is precisely the set the ceiling is meant to further filter.

**The resolution is a strict three-pass structure with no fixed-point iteration** (a converging/iterative ceiling — "recompute the ceiling, re-filter, recompute again" — is exactly the thing to avoid: it is non-deterministic in the general case and unnecessary here):

1. **Pass 1 (existing, unchanged):** run `computeActivityEfforts` + `isExcluded` exactly as today, per activity, accumulating into `byDistance: Map<TargetDistanceKey, PRAccumulatorEntry[]>`. This pass has no personal-ceiling dependency — it only uses the activity-local `max_speed` guard and the fixed world-record ceiling, both already independent of any archive-wide computation. No circularity here; this is the "history" the ceiling will be built from.

2. **Pass 2 (new):** for each distance, compute one ceiling value from the *complete* `byDistance.get(key)` array Pass 1 already materialized — e.g. a percentile or "best-so-far plus a fixed margin" statistic over `PRAccumulatorEntry.paceSecPerKm`. This must be a pure aggregate function (order-independent — sort internally by `durationSec` or percentile-rank, never rely on `Map`/array insertion order) living beside `isPlausible`, `markPRs`, `rankTopN` in `best-effort-utils.ts` (e.g. `personalPlausibilityCeiling(entries: PRAccumulatorEntry[]): number`). Because it runs over the array Pass 1 already produced in full, it needs no second read of streams/activities and no iteration over the manifest again — it is O(n log n) over an already-in-memory array per distance (7 distances, ~10-1800 entries each).

3. **Pass 3 (new):** re-filter each distance's `byDistance.get(key)` array against the Pass-2 ceiling, moving any entry that exceeds it into a rejected/flagged bucket — structurally identical to how `isExcluded` already removes entries from `byDistance` before `markPRs` runs, except this filter runs *after* accumulation instead of during it, and it must **flag rather than delete** per the milestone's explicit constraint ("rejected efforts stay visible, flagged and overridable, never deleted" — PROJECT.md, and "PRs move by demotion, never recalculation"). Concretely this likely means: keep the entry in `activities[id].efforts` (so the detail view still shows it), add a new boolean like `flaggedImplausible: boolean` alongside the existing `wasPRAtTheTime`/`excludedFromRecords` fields on `BestEffort` (`best-effort.types.ts:88`), and exclude flagged-but-not-excluded entries from `byDistance` before `markPRs`/`rankTopN` run — mirroring the existing `effortsExcluded` counter/mechanism (`compute-best-efforts.ts:215-219`) but keyed on ceiling-rejection instead of the hand-maintained exclusion list.

**Determinism in CI is preserved** because Pass 2's ceiling is a pure aggregate over Pass 1's fully-materialized, already-deterministic array — it does not depend on manifest iteration order (which is JS's numeric-key reordering of `Object.entries`, already order-insensitive downstream because `markPRs` re-sorts chronologically and `rankTopN` re-sorts by duration) and does not iterate to convergence. Re-running `compute-best-efforts` twice against unchanged inputs produces an identical ceiling and identical flags, same as every other document this pipeline writes.

**Two integration points worth flagging explicitly for roadmap/requirements, not resolved here:**
- **Override asymmetry.** The existing exclusion mechanism (`best-effort-exclusions.json`, `isExcluded`) only ever *removes* an effort from contention — there is no existing schema for "force this effort back IN despite a rejection." If the milestone's review queue (Q4) needs to let the athlete override a ceiling-rejection (accept it as a real PR anyway), that is a new, differently-shaped write than today's exclusion tickbox — either a new field on the exclusion schema (e.g. `overrideCeiling: true`) or a new sibling file. This should be settled in REQUIREMENTS/ROADMAP, not assumed.
- **Where the ceiling touches the exclusion list.** Exclusion-list filtering (Pass 1, `isExcluded`) and ceiling filtering (Pass 3) are two independent gates over the same `byDistance` accumulation — an activity can be excluded, ceiling-flagged, both, or neither. `compute-best-efforts.ts`'s totals block (`doc.totals`) already tracks `effortsExcluded` as a distinct counter from `effortsRejected`; a third counter (e.g. `effortsFlaggedImplausible`) should follow the same convention rather than overloading either existing one.

## Q4 — Curation-mode review queue, reusing the local-only write path without weakening the publish guards

**Reuse the `/__curate/*` namespace and its existing machinery wholesale; do not invent a parallel write surface.**

The two publish guards are both *structural*, not enumerated-route-based, which is exactly what makes them safe to extend without weakening:

- `scripts/lib/curation-guard.mjs`'s `findCurationArtifacts` scans the **whole** `dist/widgets` tree for the literal string `__curate` in any non-`.json` file, plus name-matches on a `__curate` directory/file or a `.curate-dist` file/directory. It has no route list to update — any new file the review-queue overlay adds under `scripts/curate-overlay/` (which is already structurally excluded from `tsconfig.json`'s `include`, both Vite configs, and `build-widgets.mjs`'s copy lists, per that module's own D-01 docblock) is covered automatically as long as its *build output* is never copied into `dist/widgets` by anything other than the existing response-body-patch (`injectOverlayTag`).
- `scripts/verify-dashboard-publish.mjs` asserts the `/__curate/*` HTTP surface 404s against the **live served bundle** — again prefix-based, not per-route, so new routes added inside `serveCurateRoute`'s dispatch in `curate-server.mjs` inherit the assertion for free (the guard is checking that the prefix is entirely absent from what GitHub Pages serves, and GitHub Pages never runs `curate-server.mjs` at all — it only serves the static `dist/widgets` output `build-widgets.mjs` produces).

**Concrete integration, following the exact shape `curate-server.mjs` already uses for exclusions:**
- The review-queue's *read* side needs no new mechanism at all — the ceiling-flagged efforts are already public data once Q3 ships (they live in `best-efforts.json`/its per-activity shard, already fetched today), so the overlay panel just reads what's already served, exactly as the existing exclusion tickbox already reads `best-efforts.json` per Phase 24's precedent.
- The review-queue's *write* side (accept/reject a flagged effort) should be new routes under the same `/__curate/` prefix, e.g. `PUT /__curate/pr-overrides/:id` mirroring `PUT /__curate/exclusions/:id` almost line for line: same `isTrustedOrigin` gate, same `MAX_BODY_BYTES`/`readJsonBody` cap, same `isValidCurateActivityId` id validation, same `writeAtomic` (temp-file + `renameSync`) write discipline, same `mirrorExclusions()`-shaped "copy working-tree file into `dist/widgets/data/`" step so the change is visible in the same curate session without a rebuild, and the same D-09 rule that **no code path here may invoke `git`** — the developer reviews and commits by hand, exactly as the docblock at the top of `curate-server.mjs` states for exclusions.
- Whatever file the override write targets (either an extended `best-effort-exclusions.json` schema or a new `data/pr-overrides.json`) must be added to the nightly workflow's data-commit `file_pattern`/push-paths filter — `data/best-effort-exclusions.json` is already there (`curate-server.mjs`'s docblock: *"sits in the nightly workflow's push-paths filter (added 2026-08-12), so a commit reaching origin triggers a full rebuild and deploy"*); a new committed file needs the same wiring or it will silently never propagate past the developer's own machine.
- `POST /__curate/recompute` already re-runs `compute-best-efforts` then `compute-dashboard-index` and re-mirrors `RECOMPUTE_DATA_DIRS` — since Q3's ceiling pass lives inside `compute-best-efforts`, an override write followed by the existing Recompute button already produces correct end-to-end behavior with **no change to the recompute route itself**, as long as the override file is read by `compute-best-efforts.ts` the same way `loadExclusions` reads the exclusion file today (tolerant, never-throwing, per `best-effort-exclusions.ts`'s own contract).
- New coverage to add, following this project's own stated convention ("an assertion which cannot be watched failing is not evidence" — CLAUDE.md's project memory / PROJECT.md's Key Decisions table): extend `curation-guard.test.ts` and the `verify-dashboard-publish` test suites with a case for the new route(s), and mutation-prove them the same way Phase 24's WR-05/WR-17 divergence tests did for `resolveExcluded`.

## Q5 — `export_data/` is local-only and gitignored: implication for feature placement

**None of v2.2's target features need it, and none should be architected to need it.**

The one and only precedent for a local-only compute step in this codebase is `src/streams/backfill-streams.ts`, whose own docblock states it plainly: *"Local backfill over `export_data/` originals, driven by `data/provenance.json`. `export_data/` is gitignored and structurally absent from CI, so this is..."* — it reads `export_data/<source>/<relative-path>` via a `resolveOriginalPath`-style join (`backfill-streams.ts:72`) driven by `data/provenance.json`, and it is confirmed absent from `COMPUTE_ALL_STATS_STEPS` (`src/compute-all-stats-steps.ts`'s eight-step array has no backfill entry) and absent from `curate-server.mjs`'s recompute route (which only runs `compute-best-efforts`/`compute-dashboard-index`). It exists purely as a standalone, hand-run CLI step for onboarding new original recordings into the committed stream store — never part of the automated nightly chain, never reachable from the dashboard.

PROJECT.md is explicit that v2.2 deliberately stays off this path: *"`data/streams/` stays byte-identical. No re-derivation this milestone despite 1 Hz originals being available locally for 94.5% of the archive... Deferred... the direction of that movement — higher resolution makes efforts faster, so re-derivation must follow rejection, never precede it."* Every one of the milestone's named quality signals — stair-step ratio, impossible-sample count, gap profile, elapsed-vs-moving divergence, altitude sanity — is computable purely from the committed `CanonicalStream`'s `t`/`d`/`alt` arrays (available in CI, in `data/streams/*.json`) plus the committed activity JSON's `elapsed_time`/`moving_time` fields. None require the original FIT/GPX bytes or the device's unused `speed` channel PROJECT.md names as a non-goal for this milestone.

**Practical implication for the roadmap:** do not introduce a new local-only compute step this milestone. Keep the entire quality-signal and ceiling pipeline inside `COMPUTE_ALL_STATS_STEPS` (CI-reproducible, deterministic, testable against fixtures the way `compute-best-efforts.test.ts` and `best-effort-fixtures.test.ts` already do). If a *future* milestone revisits stream re-derivation (explicitly flagged in PROJECT.md as "Revisit next milestone once quality signals exist to measure whether it helped"), that work — and only that work — should follow the `backfill-streams.ts` precedent: a standalone script, invoked by hand, reading `export_data/` via `data/provenance.json`, kept out of `COMPUTE_ALL_STATS_STEPS` and out of `curate-server.mjs`'s recompute route, exactly as `backfill-streams.ts` is today. One-off investigative measurement against `export_data/` (of the kind that already produced this milestone's own scoping numbers, e.g. "measured movement of only −1.6s to +5.0s on the tested activity") is legitimate throwaway tooling but must never become a dependency of a CI-required output.

## New vs Modified Components

| Component | New/Modified | Notes |
|---|---|---|
| `src/analytics/pace-derivation.ts` | **NEW** | Gap classification + shared gap-aware `derivePaceSeries`/`computePaceDistribution`. Lives in `src/analytics/`, matching the existing `best-effort-utils.ts` precedent of pure logic imported by both CI and dashboard views. |
| `src/dashboard/views/detail-charts-logic.ts` | MODIFIED | `derivePaceSeries`/`buildChannelSeries('pace', …)` become thin wrappers over the new shared module. |
| `src/dashboard/views/detail-zones.ts` | MODIFIED | `computePaceDistribution` becomes a thin wrapper over the new shared module. |
| `src/dashboard/views/detail-splits.ts` | UNCHANGED (flag only) | Already correct Δt-weighted per-split logic; not one of the two divergent implementations named in scope. Gap-flagging on splits is an open question, not a requirement. |
| `src/analytics/compute-dashboard-index.ts` | MODIFIED | New per-row quality-summary fields (scalars/booleans), threading the manifest's existing `source` field through, plus writing the new per-activity shard (or a sibling new compute file does the shard write — see below). |
| `src/analytics/dashboard-index.types.ts` | MODIFIED | New `quality: {...}` field on `DashboardIndexRow`, additive only — `DASHBOARD_INDEX_SCHEMA_VERSION` stays at `1`, same precedent as the existing `gearName` addition. |
| `data/stats/pace-quality/{id}.json` | **NEW data artifact** | Per-activity quality shard, gitignored/regenerated, mirrors `data/stats/best-efforts/{id}.json`'s sharding precedent exactly. |
| `src/dashboard/data/pace-quality-client.ts` | **NEW** | Lazy per-activity fetch client, mirrors `detail-client.ts`/`best-efforts-client.ts` shape (in-flight Map memoization, id validation, never fetched until an activity opens). |
| `src/analytics/best-effort-utils.ts` | MODIFIED | New `personalPlausibilityCeiling(entries): number` (or similarly named) pure aggregate, beside `isPlausible`/`markPRs`/`rankTopN`. |
| `src/analytics/best-effort.types.ts` | MODIFIED | New `flaggedImplausible: boolean` (or similar) on `BestEffort`; a new totals counter (e.g. `effortsFlaggedImplausible`) on `BestEffortsDocument.totals`. |
| `src/analytics/compute-best-efforts.ts` | MODIFIED | Restructured into the three-pass shape (accumulate → derive ceiling → filter-and-flag) between the existing accumulation loop and `markPRs`/`rankTopN`. |
| `data/best-effort-exclusions.json` schema, OR a new `data/pr-overrides.json` | **NEW or MODIFIED schema** | Unresolved by this research — needs a REQUIREMENTS/ROADMAP decision on override shape (see Q3). Whichever is chosen needs a corresponding loader (extend `best-effort-exclusions.ts`, or a new sibling `pr-overrides.ts` following its exact tolerant-parse contract). |
| `scripts/curate-server.mjs` | MODIFIED | New `/__curate/pr-overrides/:id` (or equivalent) routes, reusing `isTrustedOrigin`/`writeAtomic`/`readJsonBody`/`isValidCurateActivityId` verbatim. |
| `scripts/curate-overlay/` | MODIFIED | New review-queue panel/component, esbuild-bundled the same way, loaded only via the existing `injectOverlayTag` response-patch. |
| `.github/workflows/daily-refresh.yml` | MODIFIED | Add any new committed override file to the push-paths filter, same as `best-effort-exclusions.json` already is. |
| `scripts/lib/curation-guard.mjs`, `scripts/verify-dashboard-publish.mjs` | UNCHANGED (add tests only) | Structurally generic already; extend their test suites for the new route(s), do not need source changes. |
| `src/streams/backfill-streams.ts` / `export_data/` | UNCHANGED / not touched | No v2.2 feature should read from here — see Q5. |

## Suggested Build Order

1. **Shared pace derivation (`src/analytics/pace-derivation.ts`)** — no dependencies on anything else in this list; unblocks honest chart/histogram rendering immediately (the milestone's "Honest coverage" goal) and gives Q2/Q3's later work a single gap-classification primitive to reuse rather than re-deriving gap semantics twice more.
2. **Per-activity quality signals (index fields + `pace-quality/{id}.json` shard + `pace-quality-client.ts`)** — depends on (1)'s gap classifier for the gap-profile signal; otherwise independent of the PR-ceiling work. Ships the visible badges/filtering goal and gives the review queue (step 4) something to explain *why* an activity is flagged.
3. **Sharpened PR rejection (ceiling pass in `compute-best-efforts.ts`/`best-effort-utils.ts`)** — functionally independent of (1)/(2), but should follow them so the eventual review-queue UI can show quality context alongside a ceiling rejection. This is the step with the ordering/circularity risk (Q3) and needs its own fixture-based test coverage before anything downstream depends on its output shape.
4. **Curation review queue (`curate-server.mjs` + `curate-overlay/` + override schema decision)** — strictly depends on (3) existing (nothing to review without ceiling-rejected efforts) and benefits from (2) (contextual quality signals in the queue UI). Requires the REQUIREMENTS/ROADMAP decision on override schema (Q3's flagged open question) before implementation starts, and requires the workflow push-paths update alongside it.
5. **(Out of critical path, likely deferred to a future milestone)** any `export_data/`-driven work — do not schedule inside v2.2 per Q5; only revisit if quality signals from (2)/(3) demonstrate a need, per PROJECT.md's own "Revisit next milestone" framing.

## Sources

All findings sourced directly from this repository (HIGH confidence, no external ecosystem claims):
- `.planning/PROJECT.md` — milestone goal, non-goals, and the exact investigation numbers cited throughout
- `src/compute-all-stats-steps.ts` — CI compute-step chain and ordering contract
- `src/streams/stream.types.ts`, `src/streams/derive-stream.ts` — committed stream schema and the `MAX_SAMPLES=3000`/decimation mechanism PROJECT.md's investigation implicates
- `src/analytics/compute-best-efforts.ts`, `src/analytics/best-effort-utils.ts`, `src/analytics/best-effort.types.ts`, `src/analytics/best-effort-exclusions.ts` — existing PR pipeline, exclusion mechanism, and per-activity sharding precedent
- `src/analytics/compute-dashboard-index.ts`, `src/analytics/dashboard-index.types.ts` — index-manifest contract and its additive-field precedent (`gearName`)
- `src/dashboard/views/detail-charts-logic.ts`, `detail-zones.ts`, `detail-splits.ts` — the two divergent pace implementations plus the one correct adjacent implementation
- `src/dashboard/data/index-client.ts`, `detail-client.ts` — lazy-fetch/fetch-once client patterns to mirror for the new quality-shard client
- `scripts/curate-server.mjs`, `scripts/exclusion-cli.mjs`, `scripts/lib/curation-guard.mjs` — local-only write path, exclusion-list mutation contract, and the two structural publish guards
- `src/streams/backfill-streams.ts` — sole precedent for a local-only, `export_data/`-reading compute step

---
*Architecture research for: pace data-quality integration into an existing static analytics pipeline (v2.2 Pace Data Quality)*
*Researched: 2026-09-08*
