# Project Research Summary

**Project:** Strava Analytics & Visualization Platform — v2.0 Training Dashboard
**Domain:** Personal training-analytics dashboard (static SPA) extending an existing TypeScript/Node.js Strava-widgets pipeline
**Researched:** 2026-08-10
**Confidence:** HIGH

## Executive Summary

v2.0 is not a new product, it is the fourth layer on an already-proven static pipeline: raw activity data to derived JSON (gitignored, cheap to recompute) to committed durable archives (expensive/impossible to recompute) to Vite-built static pages deployed to GitHub Pages. Research across stack, features, architecture, and pitfalls converges on the same verdict from four independent angles: this milestone needs zero new production dependencies and no new architectural concepts. It needs new data (time-series streams, currently unparsed) and new code that follows patterns this repo has already validated at scale (regex GPX reader, `@garmin/fitsdk`, Chart.js, hand-rolled table sort/paginate, gitignore-vs-commit split, hash routing for static hosting). The single biggest unlock for the whole milestone is stream ingestion: best efforts, activity-detail charts, splits, and pace-distribution all sit downstream of it, while the activity browser, aggregates/records resurfacing, and TRIMP-based training load can ship against already-existing summary data in parallel or first.

The recommended approach: extend `geometry-readers.ts` to pull HR/cadence/altitude/distance/timestamp (not just position) from FIT and GPX; introduce one canonical stream-derivation module shared by a local one-time backfill command (FIT/GPX from `export_data/`, which is gitignored and CI-inaccessible) and the existing incremental intervals.icu sync; commit the derived, decimated per-activity stream JSON (not raw/full-resolution) to `data/streams/`, following the same "commit durable, gitignore-cheap-to-regenerate" split already used for `data/activities/` vs `data/stats/`; build best-effort computation as a two-pointer sweep over native (not haversine-recomputed) distance, timestamp-indexed for pause-safety; and ship the dashboard as a new Vite multi-page entry (like `heatmap.html`/`routes.html`) using hash-based routing, never History-API routing, because GitHub Pages has no server-side rewrite.

The dominant risk cluster is data-integrity, not technology choice: distance/duration correctness for best efforts (native FIT `distance` field vs. noisy haversine, timestamp-indexed duration vs. index-based, FIT sentinel values, cadence unit mismatch between FIT's half-cadence convention and intervals.icu's ambiguous units), repo-bloat from committing full-resolution streams (this repo already shows a measurable bloat trajectory from `data/heatmap/all-points.json`), and static-hosting UX traps (client-side routing 404s, stale cached JSON, loading the whole archive's streams into browser memory at once). All of these are well-understood, well-documented failure modes with concrete prevention strategies — none require new research to resolve, only correct sequencing and explicit storage/algorithm decisions made early rather than patched after the fact.

## Key Findings

### Recommended Stack

No new npm packages. The existing stack (TypeScript 5.9.3, Node 22, Vite 7.3.1, Chart.js 4.5.1 already installed, `@garmin/fitsdk` already installed and verified against real archive files) covers every new capability this milestone needs. Verified by actually decoding live `.fit.gz`/`.gpx` samples from `export_data/`: all needed fields (`heartRate`, `cadence`, `distance`, `speed`/`enhancedSpeed`, `altitude`/`enhancedAltitude`) are already present on FIT `recordMesgs`; GPX files in this archive carry no HR/cadence extensions at all (regex parsing remains sufficient, no XML library needed). A SPA framework (Preact/Svelte/Vue/React), a router package, a table/grid library, a fuzzy-search library, a date library, and a second charting library (uPlot) were all evaluated and explicitly rejected as unnecessary for this scope and inconsistent with the project's validated zero-dependency stance.

**Core technologies:**
- TypeScript 5.9.3 + Node 22 — already the pipeline's only language/runtime, no reason to diverge
- Vite 7.3.1 multi-page build (`vite.config.pages.ts`) — already implements the exact standalone-page pattern (`heatmap.html`, `pinmap.html`, `routes.html`) the dashboard SPA needs
- Chart.js 4.5.1 (already bundled) with built-in `Decimation` plugin — sufficient for per-activity charts at the archive's real data scale (~1,300-2,500 points/activity)
- `@garmin/fitsdk` (already a dependency, verified latest) — already returns every stream field needed, just not yet extracted by `readFit()`
- Hand-rolled hash router (~40 LOC) — avoids GitHub Pages' lack of server-side rewrite rules entirely
- Reused `TableSorter`/`TablePaginator` from `geo-table-widget` — already generic, dependency-free, proven at comparable row counts

### Expected Features

Reference products (Strava, Garmin Connect, intervals.icu, Runalyze, Smashrun, Elevate) converge on a consistent table-stakes bar; this is a single-athlete tool so social/segment/live-sync features are explicitly excluded per PROJECT.md, not a gap. Stream ingestion is the hinge dependency: it blocks best efforts, detail-page charts, splits, and pace-distribution, while browser/aggregates/training-load can ship on existing summary data alone.

**Must have (table stakes):**
- Paginated activity list with sort/filter/search (date, distance, pace, duration, HR) — summary data only, no stream dependency
- Activity detail page: stats header, route map (reuse existing widget), pace/HR/elevation charts — charts require streams
- All-time best per standard distance (400m..marathon) via sliding-window best-effort scan — the explicit centerpiece, requires streams
- Weekly/monthly/yearly/all-time aggregates and records — reuse existing v1.0 `compute-advanced-stats` pipeline, no new computation

**Should have (competitive differentiators):**
- Self-computed best efforts within any run (not just races), deeper than any SaaS free tier — requires streams
- Training load (CTL/ATL/TSB via TRIMP) — deliberately summary-only (avg HR + duration), don't gate behind streams; one of the highest-value, cheapest-to-ship differentiators
- Age-graded performance % and Riegel race-time prediction — "free" once best efforts exist, cheap to bundle into the same phase as the PR list
- Full-archive PR history back to ~2018 — deeper coverage than Garmin Connect (~1yr) or Strava web for this account

**Defer (v2.x / v3+):**
- Calendar/month-grid training-log view, auto-splits table, gear-aware breakdowns — v2.x candidates after core validates
- Pace-distribution/zone breakdown, native lap support, weather-normalized PRs — v3+, speculative or high-cost-low-value
- Segments/leaderboards, proprietary "training status" scores, historical weather backfill, AI training plans — explicitly out of scope (social, unauditable black-box, high cost/low value, or already excluded in PROJECT.md)

### Architecture Approach

Treat the new work as two new pipeline stages plus one new build target, not a parallel system. (1) Stream derivation writes a new committed data family, `data/streams/<id>.json`, populated once via a local-only backfill command (FIT/GPX from `export_data/`, which is gitignored and never present in CI) and incrementally via the existing intervals.icu sync reusing the streams response already fetched for geometry — committed because sources aren't reliably regenerable later (unlike `data/stats/`). (2) Best-efforts and records/trends are pure derived aggregates computed from `data/activities/` + `data/streams/`, gitignored and recomputed every CI run, following the exact convention `compute-stats.ts`/`compute-advanced-stats.ts` already use. (3) The dashboard SPA is a new Vite multi-page entry point (`dashboard.html`), built like `heatmap.html`/`routes.html` — never through the widget IIFE loop — consuming a small index/manifest JSON for the list view plus lazily-fetched per-activity stream files for detail views, mirroring the existing `route-list.json` + on-demand-fetch pattern already used by `single-run-map`.

**Major components:**
1. Stream ingestion (extended `geometry-readers.ts` + new `derive-stream.ts` module) — shared canonical shape for both FIT/GPX backfill and intervals.icu incremental sources, writing decimated/derived (not raw) `data/streams/<id>.json`, committed
2. Local-only backfill command — one-time-ish, idempotent, re-runnable CLI (extends `consolidate-exports`'s pattern) since `export_data/` structurally cannot be reached from CI
3. Best-effort + records/trends computation — new pure-function modules alongside `compute-stats.ts`, gitignored output, regenerated every CI run, wired into the existing `compute-all-stats` chain
4. Dashboard data contract — new `data/dashboard/activities-index.json` (small, whole-archive, fetched once) + lazy per-activity `data/streams/<id>.json` fetches, with a recommended `schemaVersion` field for forward compatibility
5. Dashboard SPA build integration — new Vite page entry, hash-based routing, extended `copyDataFiles()`, one-line `daily-refresh.yml` addition to the existing `git-auto-commit-action` file pattern

### Critical Pitfalls

1. **Recomputing distance from raw lat/lng instead of the FIT `distance` field** — haversine-summed GPS is noisy/non-monotonic and corrupts short best efforts (400m/1k) with phantom PRs. Use FIT's native cumulative `distance`; for GPX (no native distance field), apply outlier/speed-implausibility filtering and label results lower-confidence.
2. **O(n²) best-effort search** — naive nested-loop search over ~1,850 activities x 7 target distances risks blowing the 30-minute CI timeout. Use a two-pointer sweep exploiting monotonic distance (O(n) per target per activity), and interpolate at the exact target-distance crossing to avoid systematic slow bias.
3. **Index-based (not timestamp-based) duration** — pauses/auto-laps create real gaps in the timestamp stream; computing duration from array-index deltas instead of `timestamp[j] - timestamp[i]` produces impossible splits. Always index by timestamp; sanity-check against `max_speed`.
4. **Committing full-resolution stream JSON blows past the repo's existing bloat trajectory** — this repo already shows a measurable, ongoing bloat pattern from `data/heatmap/all-points.json` (~11-13MB/version). Full-resolution multi-series streams for ~1,850 activities would be an order of magnitude worse. Decimate before writing, never git-track raw per-point streams, and gitignore the raw form the same way `export_data/` already is.
5. **Client-side routing 404s / cadence unit mismatch / streams-in-browser-memory** — GitHub Pages has no server rewrite (hash routing only, verify base path against production build, not dev server); FIT's half-cadence convention vs. intervals.icu's ambiguous units needs a `probe-intervals`-style empirical check (this project already has one such quirk — the `data`/`data2` latlng issue — treat cadence with equal suspicion); the list view must load only a small index manifest, never bulk per-activity streams.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Stream Ingestion Foundation
**Rationale:** Every stream-dependent feature (best efforts, detail charts, splits, pace-distribution) sits behind this; architecture research explicitly calls it the "foundational" build-order step, and storage-strategy decisions (decimation, commit-vs-gitignore) must be made explicit before any file is written, not patched after the archive balloons.
**Delivers:** Extended `readFit()`/`readGpx()` (HR, cadence, distance, altitude, timestamp); canonical `derive-stream.ts` shared by backfill and incremental paths; local backfill CLI producing decimated, committed `data/streams/<id>.json` for the ~1,835 export-covered historical activities; extended `IntervalsSync` persisting streams for new activities incrementally.
**Addresses:** Stream ingestion (FEATURES.md P0 blocking infrastructure)
**Avoids:** Pitfall 4 (FIT sentinels), Pitfall 5 (cadence unit mismatch), Pitfall 6 (repo bloat), Pitfall 10 (backfill/incremental provenance divergence), Pitfall 11 (GPS-less/treadmill activities silently dropped)

### Phase 2: Best-Effort Engine + Records/Trends
**Rationale:** Depends on Phase 1's stream shape and benefits from real backfilled data to validate against; records/trends aggregates depend only on `data/activities/` and can be built in parallel with best-efforts within this phase since they share no code dependency.
**Delivers:** Two-pointer sliding-window best-effort computation (400m..marathon) over native distance/timestamp; PR list per distance; extended `compute-advanced-stats.ts` outputs for weekly/monthly/yearly/all-time records; `data/stats/best-efforts.json`.
**Uses:** Pure TS, no new dependencies (STACK.md)
**Implements:** Best-effort + records/trends computation (ARCHITECTURE.md component 4-5)
**Avoids:** Pitfall 1 (haversine distance), Pitfall 2 (O(n^2) search), Pitfall 3 (index-based duration)

### Phase 3: Dashboard Data Contract + SPA Shell
**Rationale:** Depends on Phases 1-2 having real output to join against (geo, provenance, best-efforts, stream-availability). Architecture research explicitly recommends sequencing SPA wiring after the contract is stable, though empty-page build scaffolding can happen earlier in parallel.
**Delivers:** `data/dashboard/activities-index.json` manifest; new Vite `dashboard.html` multi-page entry with hash-based routing; extended `copyDataFiles()`/daily-refresh workflow wiring.
**Uses:** Vite multi-page build (STACK.md), Chart.js already-installed (STACK.md)
**Implements:** Dashboard data contract + SPA build integration (ARCHITECTURE.md components 6-7)
**Avoids:** Pitfall 7 (bulk-loading all streams), Pitfall 8 (client-side routing 404s/base path), Pitfall 9 (stale cached JSON)

### Phase 4: Activity Browser + Detail Views
**Rationale:** Within the SPA, list view (needs only the index manifest) can ship before detail view (needs per-activity streams) per architecture's own internal sequencing recommendation — this is presentation work on top of Phase 3's contract, not new computation.
**Delivers:** Activity list with sort/filter/search reusing `TableSorter`/`TablePaginator`; activity detail page with stats header, reused route map, pace/HR/elevation charts.
**Addresses:** Activity browser + activity detail (FEATURES.md P1)
**Avoids:** Pitfall 7 (again, at the UI layer — release streams on navigation away from detail view)

### Phase 5: Records/Trends Presentation + Differentiators
**Rationale:** Resurfaces Phase 2's computed aggregates in the SPA (low-risk, high-visible-progress per FEATURES.md); age-grading and Riegel prediction are "free" once best efforts exist (Phase 2) so bundle here rather than a separate phase; TRIMP training load is deliberately summary-only and independent of stream ingestion, so it can be sequenced here without blocking on earlier phases' stream work.
**Delivers:** Records/PR list view with recent-PR badges and per-distance trend; weekly/monthly/yearly/all-time views; TRIMP-based training load (CTL/ATL/TSB); age-graded % and Riegel race prediction on PR list.
**Addresses:** Records/trends, training load, age-grading, race prediction (FEATURES.md P1/P2)

### Phase Ordering Rationale

- Stream ingestion is the single hardest dependency to retrofit (architecture, features, and pitfalls research all independently flag it as foundational/blocking), so it must land first and its storage/algorithm decisions (decimation, native-distance-vs-haversine, timestamp-indexing) must be explicit before any file is committed — retrofitting after a bloated commit or a wrong-algorithm PR list ships is expensive (PITFALLS.md Recovery Strategies: git history rewrite is HIGH cost).
- Best-effort/records computation is grouped as its own phase before the SPA because it's pure backend computation, testable against real backfilled data independent of any UI, and the two-pointer algorithm's correctness needs validating before it's trusted to feed a user-facing PR list.
- The SPA shell (data contract + routing + hash-based navigation) is deliberately sequenced before feature views are built on top of it, since architecture research notes the contract should be stable before dependent UI churns.
- List-before-detail within the browser phase mirrors the "small index, large lazy detail" data-loading split that recurs across both architecture and pitfalls research as the correct mitigation for the "bulk-loading streams" performance trap.
- Training load, age-grading, and race prediction are bundled late/cheap rather than each getting their own phase, per FEATURES.md's explicit prioritization matrix (P2, low implementation cost, "free" once best-efforts output exists).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Stream Ingestion):** Cadence unit normalization (FIT half-cadence vs. intervals.icu's documented-but-unverified units) needs an empirical probe against a live intervals.icu payload before trusting it — same category of gotcha as the already-discovered `data`/`data2` latlng quirk. GPX extension namespace variability across the 306 files should also be spot-checked, not assumed uniform.
- **Phase 2 (Best-Effort Engine):** Algorithm correctness (two-pointer sweep, timestamp interpolation, pause-gap handling) benefits from research-phase validation against a handful of known activities cross-checked with Strava's own displayed best efforts.

Phases with standard patterns (skip research-phase):
- **Phase 3 (SPA Shell):** Hash routing, Vite multi-page build, and the index/lazy-detail data split are all patterns already directly proven elsewhere in this exact repo (`route-list.json`, `single-run-map`, `heatmap.html`).
- **Phase 4 (Activity Browser):** Directly extends `TableSorter`/`TablePaginator`, already-tested generic utilities.
- **Phase 5 (Records/Trends):** Reuses existing `compute-advanced-stats.ts` outputs; TRIMP/age-grading/Riegel formulas are well-documented open standards with no implementation ambiguity.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified by live-decoding real `.fit.gz`/`.gpx` files from `export_data/` with the already-installed SDK, not just reading package docs; npm registry checked live for all evaluated-and-rejected alternatives |
| Features | HIGH | Cross-verified against official product docs (Strava, Garmin, intervals.icu) plus independent reviews for proprietary-algorithm claims (Garmin VO2max overestimation, TRIMP methodology) |
| Architecture | MEDIUM-HIGH | Grounded in direct inspection of this repo's actual code/config/workflows; a few numeric estimates (stream payload size, GitHub Pages CDN gzip behavior) are explicitly flagged MEDIUM confidence, not directly measured |
| Pitfalls | MEDIUM-HIGH | Grounded in this repo's actual data and measured repo-bloat precedent (`git count-objects`); FIT-side cadence convention is well-documented, intervals.icu-side cadence ambiguity sourced from a community forum thread (not official spec), explicitly flagged for empirical verification |

**Overall confidence:** HIGH

### Gaps to Address

- Cadence unit semantics on intervals.icu's streams endpoint — not verified against a live payload in this research session; flagged for a `probe-intervals`-style check during Phase 1 planning before trusting the field.
- GPX extension namespace variability — only 36 of 306 GPX files were sampled; the absence of HR/cadence extensions in that sample should be reconfirmed (or the regex reader hardened to detect and skip unrecognized extension prefixes) rather than assumed universal across all 306.
- Actual stream payload size at scale — the ~15-35MB total estimate (architecture research) is a calculation from a formula, not a measurement; the first backfill run should measure `git count-objects -vH` before/after (per PITFALLS.md's own "Looks Done But Isn't" checklist) to confirm the decimation/storage strategy holds in practice.
- GitHub Pages CDN gzip behavior — assumed but not verified against this repo's actual response headers; low-risk, but worth a quick check once the dashboard is deployed if payload size becomes a concern.
- Whether `data/streams/` schema evolves before backfill is fully committed — a `schemaVersion` field is recommended but the actual shape (parallel arrays vs. object structure) should be locked before the one-time backfill runs, since re-running it against a changed schema means re-committing ~1,850 files.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `package.json`, `vite.config.ts`, `vite.config.pages.ts`, `src/exports/geometry-readers.ts`, `src/types/garmin-fitsdk.d.ts`, `src/widgets/geo-table-widget/*.ts`, `src/api/intervals-provider.ts`, `src/sync/intervals-sync.ts`, `.github/workflows/daily-refresh.yml`, `.gitignore`, `data/provenance.json`, `.planning/PROJECT.md`
- Live decode of real archive files (`export_data/strava/activities/*.fit.gz`, `*.gpx`) using the already-installed `@garmin/fitsdk` — field presence, decode performance (7.2ms/file), GPX extension absence confirmed empirically
- `git count-objects -vH` / `git rev-list --objects` — measured existing repo-bloat pattern from `data/heatmap/all-points.json`
- npm registry live checks: `@garmin/fitsdk@21.212.0`, `chart.js@4.5.1` (both installed = latest)
- GitHub Docs — Repository limits (https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits)
- Strava — All-Time PRs (https://support.strava.com/hc/en-us/articles/216918487-All-Time-PRs), Best Efforts - Running (https://support.strava.com/en-us/articles/15401661-best-efforts-running)
- intervals.icu — Fitness, Fatigue & Form Chart (https://www.intervals.icu/features/fitness-chart/)

### Secondary (MEDIUM confidence)
- Chart.js official docs on Decimation plugin performance, corroborated by installed package files
- GitHub Pages/Fastly on-the-fly gzip — community discussion, not verified against this repo's response headers
- GoldenCheetah/GoldenCheetah#2060 (https://github.com/GoldenCheetah/GoldenCheetah/issues/2060), Garmin Forums — Fractional Cadence (https://forums.garmin.com/developer/fit-sdk/f/discussion/288454/fractional-cadence-values) — FIT half-cadence convention
- Intervals.icu Forum — Cadence SPM (https://forum.intervals.icu/t/cadence-steps-per-minute-spm/117617) — community thread, flagged for empirical verification

### Tertiary (LOW confidence)
- Stream payload size estimate (~15-35MB total) — calculated, not measured; needs first-backfill confirmation

---
*Research completed: 2026-08-10*
*Ready for roadmap: yes*
