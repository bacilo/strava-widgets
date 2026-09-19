# Stack Research

**Domain:** Sample-stream signal processing (unreliable-segment detection, robust statistics, gap classification) for a static-JSON analytics pipeline
**Researched:** 2026-09-19
**Confidence:** HIGH — every claim below is grounded in this repo's own committed source, not general ecosystem survey. The domain here is not "what library does the industry use for outlier detection" — it's "does this specific, already-established codebase have a house convention that already covers the new math," and it demonstrably does.

## Recommended Stack

### Core Technologies — unchanged

No new core technology. v2.3 is arithmetic over two already-committed arrays (`t`, `d`) plus a new write path for one curation action. Every piece of infrastructure it needs is already installed and already exercises the exact pattern v2.3 needs one level further.

| Technology | Version (installed) | Purpose in v2.3 | Why no change |
|------------|---------|---------|-----------------|
| TypeScript | ^5.9.3 | All detection/classification/merge logic | Pure-function numeric modules under `src/analytics/`, same as every prior milestone |
| Node.js | 22 (CI), local dev on 25.2.1 | Runtime for compute scripts + curate server | `node:http`, `node:fs`, `node:zlib`, native `fetch` already carry the whole pipeline; nothing in v2.3's scope needs a runtime capability Node 22 lacks |
| vitest | ^4.0.18 | Unit tests for new pure functions + regression fixtures | Same test runner that already pins `percentileNearestRank`, `quantile`, `classifyGaps` with hand-built populations of known percentile |
| Chart.js + chartjs-plugin-zoom | ^4.5.1 / ^2.2.0 | Pace chart/histogram clip unreliable segments | Segment clipping is a *data* transform (drop/mark points) applied before the existing chart-feed step, exactly how gap-clipping already works for PACE-02/COV-01 — no new chart capability required |
| `@garmin/fitsdk` | ^21.212.0 (latest published: 21.214.0) | Local-only calibration scripts reading `export_data/*.fit` | Already a runtime dependency, already used via dynamic `import('@garmin/fitsdk')` in `src/exports/geometry-readers.ts:76` (`Decoder`, `Stream.fromBuffer`) to decode FIT `record` messages including `position_lat`/`position_long`, `distance`, `timestamp`. That is precisely what a slew-cap / timer-event calibration script against `export_data/` needs — no new FIT/GPX parser required |

### Supporting Libraries — none added

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | None needed. See "What NOT to Use" below for the specific candidates considered and rejected. |

### Development Tools — unchanged

| Tool | Purpose | Notes |
|------|---------|-------|
| esbuild (^0.27.3) | Bundles the curate overlay/queue TS for the localhost server | Already the transport for `scripts/curate-overlay/` and `scripts/curate-queue/`; CUR-04's new button/handler is another module through the same bundle, not a new build path |
| `node:http` (curate-server.mjs) | Localhost-only curation server | Confirmed no framework (no Express/Fastify) — stays a raw `http.createServer` per the existing file; CUR-04 adds one more route/branch, same shape as the existing exclude/remove/recompute routes |

## Installation

```bash
# Nothing to install. v2.3 introduces zero new package.json entries.
```

## Where v2.3's math actually lands (and why it's already covered)

This is the load-bearing finding, so it's spelled out rather than just asserted:

- **`quantile()` — `src/analytics/pace-derivation.ts:100`.** R-7 linear-interpolation percentile (numpy/D3 default), hand-rolled, ~12 lines, explicitly documented as "deliberately the SAME quantile implementation Phase 28's PR plausibility ceiling will reuse." It already computes the p90 that drives `classifyGaps`'s scale-relative pause threshold. **`median(x)` is `quantile(sorted, 0.5)`** — zero new code, just a call site.
- **`percentileNearestRank()` — `src/analytics/best-effort-ceiling.ts:81`.** A second, deliberately different percentile (interpolation-free nearest-rank) used for the PR ceiling, with its own docblock explaining why it's not the same algorithm as `quantile()`. This is the strongest evidence against reaching for a stats library: the project already maintains *two* distinct, precisely-specified percentile implementations by hand because the exact algorithm is load-bearing for calibration artifacts (`28-CEILING-CALIBRATION.md` cites exact percentile values to 4 decimals) — a generic library's percentile (which itself has multiple competing definitions: R-1 through R-9) would be one more implementation to disambiguate and pin, not fewer.
- **MAD (median absolute deviation)**, needed for robust-statistics thresholds per the milestone question, is `median(x.map(v => Math.abs(v - median(x))))` — two calls to the function above plus a `.map()`. This is not a research gap; it's three lines that belong beside `quantile()`.
- **Gap+burst segment merging** already has a working pattern to extend: `classifyGaps()` (`pace-derivation.ts:195-263`) walks samples, opens a "run" when it sees a gap/pause kind, and **extends the run rather than closing it while the same kind continues** (`else if (openKind === kind) { /* extend */ }`), closing only on a `covered` sample or end of stream. Merging a slew burst into its adjacent gap is the same walk with one more `kind` value and one more adjacency rule (burst immediately following/preceding an open gap run extends it rather than opening a new segment) — not a new algorithmic primitive, an extension of an existing one.
- **`advanceIntervals()`** already produces the sorted-ascending real-time-per-distance-advance array that both `quantile()` calls and any new burst-speed threshold would consume — the input shape v2.3 needs already exists.
- **`haversineMeters()` — `src/analytics/pace-quality.ts:243`.** Already hand-rolled for elevation closure-drift loop-gating. Relevant only to the **local-only calibration scripts** against `export_data/` FIT files (which carry `position_lat`/`position_long`) — not to the runtime detector, because **`data/streams/{id}.json` does not commit a `latlng` channel** (only `t`, `d`, `hr`, `alt`, per this milestone's own constraint). Isolated-GPS-jump detection therefore cannot and does not run on geodesic distance at runtime; it runs on the same `d`-vs-physically-plausible-speed method the archive sweep in `PROJECT.md` already used (excess distance above a speed ceiling). `haversineMeters()` is reusable as-is for any local calibration script that needs to cross-check `d` against the FIT file's own lat/lng path — exactly how the scoping investigation already established "device distance equals the summed GPS path within 0–2%."

### CUR-04 (curation queue dismiss/"reviewed and kept" action)

Traced the existing write path end to end:
- `scripts/curate-overlay/index.ts` exports `saveExclusion`/`removeExclusion`/`runRecompute` — plain `fetch()` calls (native, no HTTP client library) against the localhost server's own routes, with an atomic file write and an origin gate on the server side (`curate-server.mjs`, `node:http`).
- `scripts/curate-queue/index.ts` already imports that transport rather than re-implementing it (explicitly documented as load-bearing — CUR-02 pinned this structurally in Phase 29).
- CUR-04 is a **new state, not a new mechanism**: a "reviewed and kept" flag is the same shape as an exclusion entry (activity id + reason/marker + timestamp), written through the same atomic-write route, listed the same way the queue already lists excluded rows. The natural implementation is either a third value on the existing per-activity curation record or a small sibling JSON file next to the exclusions file, written via a new server route that mirrors `saveExclusion`'s shape. No new dependency; extend `curate-overlay/index.ts` and `curate-server.mjs` with one more route/function pair.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hand-rolled `median`/MAD beside the existing `quantile()` | `simple-statistics`, `d3-array`, `mathjs` | Only if the project needed a broad statistics surface (regression, distributions, matrix ops) beyond percentile/median/MAD — it doesn't, and pulling one in for ~3 lines of logic would introduce a second percentile *definition* to reconcile against the two the project already hand-maintains on purpose |
| Extend `classifyGaps()`'s existing run-merging walk | A generic interval-merging library (e.g. `interval-tree` packages) | Only if segments needed range-query structures (overlap search, nearest-interval lookup) at scale — v2.3 is a single linear pass over an already-sorted, already-indexed stream, which is what the existing function already does |
| `@garmin/fitsdk` (already installed) for local calibration scripts | `fit-file-parser`, `gpxparser`, or a Python/`fitdecode` side-tool | Only if the calibration needed GPX support the SDK doesn't cover — but the SDK already handles FIT (this milestone's evidence was drawn from FIT files) and the project has no working GPX-only calibration need |
| Raw `d`/speed-based jump detection at runtime | A geodesic/GIS library (`turf.js`, `geolib`) for GPS-jump detection | Only if `latlng` were committed to `data/streams/`, which it explicitly is not — a geometry library has nothing to operate on at runtime. `haversineMeters()` (already hand-rolled) remains the right tool for local-only FIT-based calibration, which does have lat/lng |
| `node:http` + esbuild for CUR-04's new route | Express/Fastify for the curate server | Only if the server needed routing middleware complexity beyond a handful of hand-matched paths — `curate-server.mjs` already handles exclude/remove/recompute/queue routes this way and the project's own "native fetch, no HTTP libraries" decision (`PROJECT.md` Key Decisions) applies equally to the server side |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `simple-statistics` / `jStat` / `mathjs` for median, MAD, percentile | Would duplicate math the codebase already implements twice on purpose with pinned, calibration-cited semantics (R-7 interpolation vs nearest-rank); a third, library-defined percentile variant risks exactly the "two divergent implementations" failure mode PACE-01's structural audit exists to prevent, and the milestone's own before/after diffs (e.g. `28-DIFF.md`) depend on exact, reproducible arithmetic a black-box library would obscure | Add `median()`/`mad()` as named exports beside `quantile()` in `pace-derivation.ts`, following its existing docblock convention |
| `d3-array` for percentile/rollup helpers | Same duplication risk, plus it's a large surface for one or two functions | Same as above |
| `turf.js` / `geolib` for GPS-jump / distance math at runtime | `data/streams/*.json` carries no `latlng` channel — nothing for a geometry library to consume in the shipped pipeline; would only be exercisable in local-only calibration scripts, where the hand-rolled `haversineMeters()` already does the job | Reuse `haversineMeters()` from `pace-quality.ts` for local FIT-based calibration only |
| A dedicated outlier/anomaly-detection package (e.g. `outlier` npm packages, `ml-outlier`) | These target unlabeled multivariate anomaly detection; v2.3's detector is a calibrated, explainable, single-variable speed-vs-threshold rule the developer must be able to sign off on (per the demote-and-keep house convention) — a black-box ML detector is the wrong shape for a milestone whose defining discipline is "re-derive every number independently and disclose the reason string" | Threshold-based detection over `advanceIntervals`/`quantile`, same house style as `best-effort-ceiling.ts`'s reason strings |
| Express/Fastify/Koa for `curate-server.mjs` | The server already stays deliberately on `node:http` (no framework) with hand-matched routes; adding a framework for one more route is a scope-inconsistent dependency | Add one more `if (req.url === ...)` branch, same shape as the existing exclude/remove/recompute routes |
| A UUID/id-generation library for CUR-04 records | Every existing curation record already keys off the Strava/intervals `activityId`, which is already unique and already the join key for exclusions, the review queue, and the dashboard index | Reuse `activityId` as the key, same as `saveExclusion`/`removeExclusion` |
| A CSV/streaming-stats library for the archive-wide before/after diff (best-effort demotion) | Phase 28 already established the pattern for this exact kind of artifact (`28-DIFF.md`, regenerable, idempotent, sha256-signed) using plain JSON + a `.mjs` script under `scripts/` | Follow the same `compute-*-diff.mjs` script shape already in `package.json` |

## Stack Patterns by Variant

**If the new detector must run in CI (unreliable-segment detection, forgotten-stop flag, gap classification, pace clipping):**
- Pure TypeScript over the committed `t`/`d` (and `hr` where relevant) arrays only, in `src/analytics/`
- No `latlng`, no FIT/GPX parsing — the constraint that "original 1 Hz FIT/GPX files exist only locally" and CI cannot read `export_data/` rules out `@garmin/fitsdk` from any runtime code path this milestone touches
- Threshold/percentile math extends `quantile()`/`advanceIntervals()`; segment/gap merging extends `classifyGaps()`'s run-walk

**If the work is calibration/validation against original files (slew-cap constant, timer-event presence, archive-wide sweep confirmation):**
- Node scripts under `scripts/`, run locally only, never wired into `npm test` or the nightly workflow (mirrors how `export_data/` is gitignored and CI-invisible)
- `@garmin/fitsdk`'s `Decoder`/`Stream.fromBuffer` (already used, already typed via `src/types/garmin-fitsdk.d.ts`) for FIT; reuse `haversineMeters()` for any lat/lng cross-check
- Output a committed, regenerable calibration artifact (`*-CALIBRATION.md` or a JSON constants file) — the project's established pattern (`28-CEILING-CALIBRATION.md`, `30-CALIBRATION.md`) for turning a local-only measurement into a reproducible, cited constant the CI-side code can then hard-code

**If the work is the curation queue's new action (CUR-04):**
- Extend `curate-overlay/index.ts` (transport) and `curate-server.mjs` (route) in place, following the exact shape of `saveExclusion`/`removeExclusion`
- No new client-side state library — the overlay/queue modules already manage their own state without React/Redux/etc., consistent with the rest of the dashboard SPA (no framework, hand-rolled DOM)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@garmin/fitsdk@^21.212.0` | Node 22/25 | Currently resolved to 21.212.0; latest published is 21.214.0 (patch-level, not required for v2.3 — no known fix in the delta affects `record`-message decoding used here) |
| `vitest@^4.0.18` | Node 22 | Already the test runner for all existing percentile/gap-classification fixtures; new median/MAD/segment-merge tests slot into the same `*.test.ts` convention beside `pace-derivation.test.ts`/`best-effort-ceiling.test.ts` |
| `chart.js@^4.5.1` + `chartjs-plugin-zoom@^2.2.0` | No change | Segment clipping happens in the data-preparation step before the chart is fed, same integration point as existing gap-clipping — no plugin-version interaction |

## Sources

- `/Users/pedf/workspace/strava-widgets/src/analytics/pace-derivation.ts` — `quantile()`, `advanceIntervals()`, `classifyGaps()` (first-party, HIGH confidence: read directly)
- `/Users/pedf/workspace/strava-widgets/src/analytics/best-effort-ceiling.ts` — `percentileNearestRank()`, ceiling derivation, reason-string convention (first-party, HIGH confidence)
- `/Users/pedf/workspace/strava-widgets/src/analytics/pace-quality.ts` — `haversineMeters()`, quality-signal architecture (first-party, HIGH confidence)
- `/Users/pedf/workspace/strava-widgets/src/exports/geometry-readers.ts` — confirmed `@garmin/fitsdk` `Decoder`/`Stream.fromBuffer` usage pattern (first-party, HIGH confidence)
- `/Users/pedf/workspace/strava-widgets/scripts/curate-overlay/index.ts`, `scripts/curate-queue/index.ts`, `scripts/curate-server.mjs` — curation write-path transport, confirms no HTTP framework (first-party, HIGH confidence)
- `/Users/pedf/workspace/strava-widgets/package.json` — dependency/devDependency manifest (first-party, HIGH confidence)
- `/Users/pedf/workspace/strava-widgets/.planning/PROJECT.md` §§ "Current Milestone: v2.3", "Constraints", "Key Decisions" — scoping evidence, committed-channel constraint (`t`/`d`/`hr`/`alt`, no `latlng`), "native fetch, no HTTP libraries" decision (first-party, HIGH confidence)
- `npm view @garmin/fitsdk version` — confirmed latest published 21.214.0 vs installed 21.212.0 (npm registry, HIGH confidence)

---
*Stack research for: Pause & Slew Integrity (v2.3) — signal-processing additions to an existing static-JSON analytics pipeline*
*Researched: 2026-09-19*
