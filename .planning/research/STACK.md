# Stack Research

**Domain:** Training-analytics dashboard (static SPA) added to an existing TypeScript/Node.js Strava-widgets platform
**Researched:** 2026-08-10
**Confidence:** HIGH (verified against the actual repo, actual export files, and live package registry — not just training data)

## Headline Finding

**This milestone needs zero new production npm dependencies.** Every "new" capability — FIT stream parsing, GPX stream parsing, SPA routing, activity-list filter/sort, time-series charts — is either already solved by a dependency this repo already ships (`@garmin/fitsdk`, `chart.js`) or is better served by extending patterns the codebase has already proven at scale (regex GPX reader, hand-rolled `TableSorter`/`TablePaginator`, Custom Elements, native `fetch`/`Date`). This is a direct continuation of the project's validated "zero dependencies where practical" decisions (native Custom Elements, native `fetch`, offline geocoding) — not a new philosophy being introduced for v2.0.

I verified this by decoding real files from `export_data/` and reading the existing pipeline code, not just by inspecting package listings:
- Decoded live `.fit.gz` and `.gpx` samples from the archive with the SDK/parser already in the repo — confirmed `heartRate`, `cadence`, `distance`, `speed`/`enhancedSpeed`, `altitude`/`enhancedAltitude` are all present directly on `recordMesgs` from `@garmin/fitsdk`, no extra parsing library needed.
- Timed a 100-file batch decode: 7.2ms/file → ~13s to decode all 1,835 `.fit.gz` files in CI. Fast enough for a build-time pipeline step, no worker-thread/streaming complexity warranted.
- Grepped 36 sampled `.gpx` files (of 306) for `gpxtpx`/`extensions`/`<hr>` — zero matches. Strava's exported phone-recorded GPX in this archive carries only `lat`/`lon`/`ele`/`time`, never heart rate or cadence extensions. This is a data fact, not a parsing limitation — confirms a regex-based reader is sufficient (there's no rich extension schema to navigate).

## Recommended Stack

### Core Technologies (unchanged — confirmed still correct for v2.0)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.3 (installed) | Whole pipeline + SPA | Already the project's only language; no reason to introduce anything else for a personal, single-maintainer dashboard |
| Node.js | 22 | Build-time pipeline (stream parsing, best-effort computation, JSON generation) | Already the CI runtime; native `fetch`, native `zlib`, no new runtime needed |
| Vite | 7.3.1 (installed) | Bundling for both widgets and the new dashboard SPA | `vite.config.pages.ts` already implements the exact multi-page pattern the dashboard needs (see Integration Points) |
| Chart.js | 4.5.1 (installed, latest) | Per-activity detail charts (pace/HR/cadence vs. distance) | Already bundled and tree-shaken in 2 widgets; reusing avoids paying for a second charting library (see rationale below) |

### New Code, Not New Dependencies

| Capability | What to Add | Why Not a Library |
|------------|-------------|--------------------|
| FIT stream parsing (HR, cadence, pace, elevation) | Extend `src/exports/geometry-readers.ts` `readFit()` to also pull `heartRate`, `cadence`, `distance`, `enhancedSpeed`/`speed`, `enhancedAltitude` off each `recordMesg` (currently only `positionLat`/`positionLong` are read) | `@garmin/fitsdk` (already a dependency, `^21.212.0`, verified latest) already returns every one of these fields per record — verified by decoding a real 2025 recording from the archive. No FIT parsing gap exists. |
| GPX stream parsing (elevation, per-point time for pace) | Extend `readGpx()` to capture `lat`, `lon`, `ele`, `time` from each `<trkpt>` block in one regex pass instead of the current two-pass approach (all coords via one regex, only the *first* point's time via a second regex) | The archive's GPX files have a small, fixed, well-known schema (Strava's `StravaGPX` export) with no HR/cadence extensions present anywhere sampled. A full XML parser (fast-xml-parser, xml2js) would be solving a problem that doesn't exist here — the current regex-only approach was a deliberate, already-validated choice per the code comment in `geometry-readers.ts` ("targeted matching beats a full XML dependency") |
| Best-effort computation (fastest 400m/1k/1mi/5k/10k/HM/marathon) | Plain TS: sliding-window scan over the distance/time stream per activity | Pure numeric algorithm over an array — no npm package adds value here |
| Stream downsampling for published JSON | Hand-rolled fixed-stride or LTTB-style downsample function (~30 LOC) run in the Node pipeline before writing per-activity stream JSON | Keeps repo/JSON payload size bounded (see Charting section) without adding a downsampling package; full-resolution data stays available *within* the pipeline for best-effort math, only the *published* stream is capped |
| SPA routing | Hand-rolled hash router (`hashchange` listener + view-dispatch table, ~40 LOC) | See Alternatives — deliberately not adding a router package |
| Activity list filter/sort (~1,867 rows) | Reuse/extend `TableSorter` (locale-aware `Intl.Collator`, sort-a-copy pattern) and `TablePaginator` from `src/widgets/geo-table-widget/` | These utilities already exist, are already tested, and the scale difference (2,000 rows vs. the geo table's smaller row counts) doesn't change the approach — `Array.sort`/`Array.filter` over 2,000 items is sub-5ms |
| Per-activity route map on detail view | Reuse existing Leaflet 1.9.4 + single-run-map widget pattern | Already validated infrastructure (CDN-externalized, Shadow DOM CSS injection) |

### Supporting Libraries (none required, but here's what was evaluated and rejected)

| Library | Purpose it would serve | Verdict |
|---------|------------------------|---------|
| `fit-file-parser` | Alternative FIT decoder | Rejected — `@garmin/fitsdk` is already integrated, official (Garmin-maintained), and proven against real files. Switching decoders for no functional gain is pure risk. |
| `fit-decoder` | Alternative FIT decoder | Rejected — same reasoning; less actively maintained than the official SDK already in use. |
| `fast-xml-parser` / `xml2js` | GPX parsing | Rejected — regex approach already validated in production for 306 files with a fixed, simple schema; would add ~30-50KB and a new dependency for zero new capability. |
| `preact` (10.29.8) + `preact-router` (4.1.2) | SPA component model + routing | Rejected for v2.0, but the one framework worth reconsidering if reactive UI complexity grows (see Alternatives Considered below). |
| `svelte` + `vite-plugin-svelte` | SPA component model | Rejected — introduces a compiler step into a build pipeline that is currently pure TypeScript+Vite; inconsistent with a single-maintainer project that already has zero build "magic." |
| `vue` / `react` | SPA framework | Rejected — heaviest options (30-45KB+ runtime), directly contradicts the project's explicitly validated "small bundles, zero frameworks" decision (see PROJECT.md Key Decisions: "Native Custom Elements API — Zero dependencies, full attribute lifecycle control — ✓ Good"). |
| `uplot` (1.6.32) | High-performance time-series charting | Rejected — see Charting rationale below. |
| `fuse.js` (7.5.0) | Fuzzy search over activity list | Rejected — personal single-user dashboard; substring match (`.toLowerCase().includes()`) on activity titles is sufficient, fuzzy matching solves a UX problem this project doesn't have. |
| `navigo` (8.11.1) or similar router | SPA routing | Rejected — only ~4-5 view types (activity list, activity detail, records, trends); a 40-line hand-rolled hash dispatcher covers this with no dependency and no risk of pulling in History-API assumptions that don't work on GitHub Pages (see rationale below). |
| `date-fns` / `luxon` / `dayjs` | Date math for weekly/monthly/yearly aggregation | Rejected — project already has a validated "UTC everywhere, native `Date`" decision from v1.0; the records/trends aggregation is the same class of problem already solved without a date library. |

## Installation

No new packages required. If any of the above are later warranted, this is the reference invocation for the one path worth revisiting first:

```bash
# ONLY if reactive filter/sort UI complexity outgrows vanilla DOM updates
npm install preact @preact/signals
```

Everything else in this milestone ships with the existing `package.json`.

## Alternatives Considered

### (c) SPA framework: vanilla Custom Elements + hand-rolled hash router — chosen over Preact/Svelte/Vue/React

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Vanilla TS + native Custom Elements + hand-rolled hash router | Preact 10.29.8 + `preact-router` 4.1.2 (~5KB combined gzip) | If the activity list grows multiple *linked* filters with derived/computed state (e.g., filter-by-city updates available-year options which update available-distance-buckets), manual DOM sync becomes error-prone faster than a small VDOM diff would. Preact is deliberately compatible with rendering into a Custom Element's Shadow DOM, so it could be introduced incrementally (one view at a time) without a rewrite. Revisit if plan work reveals >2-3 interdependent filter dimensions. |
| Vanilla TS + native Custom Elements + hand-rolled hash router | Svelte + `vite-plugin-svelte` | Only if the project ever gains a second contributor or grows well beyond a personal dashboard — Svelte's compile-time approach pays off at team/growth scale, but adds a new toolchain (`.svelte` files, compiler plugin) this single-maintainer, already-lean Vite setup doesn't need today. |
| Vanilla TS + native Custom Elements + hand-rolled hash router | Vue / React | Not recommended at any point for this project's stated constraints (small bundles, zero frameworks explicitly validated as "Good" in PROJECT.md). Only reconsider if this dashboard is ever spun out into a separate, larger product with its own team. |

**Why vanilla wins here, concretely:**
- The codebase already proves the pattern works at real complexity: `geo-table-widget/index.ts` is 698 LOC of hand-rolled sortable/paginated table logic with zero framework, shipped and working.
- GitHub Pages has no server-side rewrite rules for a static SPA. History-API (`pushState`) routing needs either a `404.html` redirect hack or a Pages-specific workaround to make deep links survive a hard refresh; **hash-based routing** (`#/activities/12345`) sidesteps this entirely with zero server configuration, and a hash router is trivial to hand-roll (listen for `hashchange`, parse the fragment, dispatch to a render function). This is the more consequential decision here — pick hash routing regardless of whether vanilla or Preact is used for rendering.
- Introducing a framework would be the *one* inconsistent piece in an otherwise deliberately dependency-light codebase, for a UI surface (list + detail + two aggregate views) that isn't complex enough to need it.

### (d) Charting: Chart.js (existing) — chosen over uPlot

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Chart.js 4.5.1 (already a dependency) with tree-shaken registration (`LineController`, `LineElement`, `PointElement`, `LinearScale`, `Decimation`, `Tooltip`, `Legend`) + built-in `Decimation` plugin (no separate package — bundled in Chart.js core since v3) | `uPlot` 1.6.32 (~45KB, much faster for very large series) | If per-activity streams grow to tens of thousands of points per chart *and* multiple series must render simultaneously without any server-side downsampling. Not the case here: real decoded activities in this archive run ~1,300-2,500 records; Chart.js's own docs cite decimation bringing 5,000-10,000-point render times down to ~100ms, comfortably covering this project's per-activity scale. |

**Why Chart.js wins here, concretely:**
- Chart.js is *already* a paid-for cost in this codebase — `comparison-chart.iife.js` and `streak-widget.iife.js` are both ~180KB minified already. Adding uPlot as a second charting library would mean shipping two charting engines in one SPA bundle for no capability gain, directly working against the "small bundles" value driving the framework decision above.
- Combine Chart.js's built-in `Decimation` plugin (`algorithm: 'min-max'` to preserve pace/HR spikes, or `'lttb'` for smoother trend lines) with a small server-side downsample step in the Node pipeline that caps published per-activity stream JSON at a fixed point budget (e.g., 500-800 points). The downsample step is about *payload size* (1,867 activities × full-resolution multi-series streams would bloat the statically-hosted, git-tracked JSON significantly), not runtime chart performance — Chart.js alone already handles the runtime case fine at this data scale.
- Full-resolution streams should stay available transiently within the Node pipeline (not published) so best-effort computation (fastest-1k, etc.) is never computed from decimated data — decimation is a presentation-layer concern only.

### (e) Activity list filter/sort — vanilla, extending existing utilities

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Reuse/extend `TableSorter` + `TablePaginator` from `geo-table-widget`; plain `Array.filter` predicates for date-range/distance-range/text | TanStack Table, AG Grid, or similar headless table libraries | Only if the dashboard needs virtualized infinite-scroll over unpaginated data, column resizing/reordering, or multi-column complex query building. At ~1,867 rows with pagination (same UX pattern as the existing geo table), plain array operations complete in single-digit milliseconds — no library clears that bar in usefulness. |
| Substring match (`.toLowerCase().includes()`) for text search | `fuse.js` 7.5.0 (fuzzy search) | Only if search needs to tolerate typos/partial word order across a large, unstructured corpus. This is a personal archive with a known, small vocabulary of activity titles — exact substring matching is sufficient and predictable. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A second FIT decoder (`fit-file-parser`, `fit-decoder`) | `@garmin/fitsdk` is already integrated, official, and verified against real archive files with all needed fields present | Extend the existing `readFit()` in `geometry-readers.ts` |
| A GPX/XML parsing library | Regex extraction already proven for this exact export schema; no HR/cadence extensions exist in the archive to justify richer XML handling | Extend the existing `readGpx()` regex approach to capture `ele` and per-point `time` |
| Any SPA framework (Preact/Svelte/Vue/React) for the initial dashboard shell | Contradicts the project's validated small-bundle, zero-framework stance; scope (4-5 views) doesn't need it | Native Custom Elements + hand-rolled hash router |
| History-API (`pushState`) routing | GitHub Pages has no rewrite rules; hard refresh on a deep link 404s without extra `404.html` redirect tooling | Hash-based routing (`#/activities/:id`) |
| A second charting library (uPlot, D3, ECharts) alongside Chart.js | Chart.js is already a ~180KB sunk cost in the bundle and covers this project's per-activity data scale (1,300-2,500 points/activity, well within documented decimation-plugin comfort zone) | Chart.js `Decimation` plugin (built-in) + a small server-side stream-downsample step in the Node pipeline |
| A table/grid library (TanStack Table, AG Grid) | ~1,867 rows with pagination doesn't need virtualization or a headless table engine; existing hand-rolled `TableSorter`/`TablePaginator` already solves this class of problem | Extend `TableSorter`/`TablePaginator` from `geo-table-widget` |
| A fuzzy-search library (Fuse.js) | Personal, small-vocabulary corpus; predictable substring matching is preferable UX for this use case anyway | `.toLowerCase().includes()` |
| A date library (date-fns/luxon/dayjs) | Project already has a validated native-`Date`, UTC-everywhere pattern from v1.0 records/trends work | Native `Date` with UTC methods |

## Stack Patterns by Variant

**If reactive filter-state complexity grows beyond simple predicates during implementation:**
- Introduce `preact` + `@preact/signals` incrementally, scoped to just the activity-list view (rendered inside its own Custom Element's shadow root)
- Because it's the smallest possible step up in capability, keeps the rest of the app (detail view, records, trends) untouched, and doesn't force a wholesale framework migration

**If the 2 outlier `.gpx.gz` files in `export_data/` need handling:**
- Reuse the `gunzipSync` import already present in `geometry-readers.ts` (used for `.fit.gz`) as a pre-step before the GPX regex pass, replacing the current `throw new Error('gzipped gpx not implemented')` branch
- Because it's a one-line addition to already-imported `node:zlib`, not a new dependency

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@garmin/fitsdk@21.212.0` | Node.js 22 (installed runtime) | Verified working against real archive files (2017-2025 vintage devices) in this session; decodes gzipped buffers fine when pre-decompressed via `node:zlib.gunzipSync` (no native gzip support in the SDK itself — the existing code already handles this correctly) |
| `chart.js@4.5.1` | Vite 7.3.1 tree-shaken build | Already proven — `Decimation` plugin ships in core since Chart.js v3, needs explicit `Chart.register(Decimation)` alongside the other tree-shaken components per the existing `chart-config.ts` pattern |
| `vite.config.pages.ts` multi-page build | New dashboard entry point | Add a `dashboard.html` (or similarly named) entry to the existing `rollupOptions.input` map alongside `heatmap`, `pinmap`, `routes` — this is the exact mechanism already used for standalone full-page views; `emptyDir: false` must be preserved so widget bundles aren't wiped |
| Custom Elements | GitHub Pages hash routing | No compatibility concern — both are pure client-side, no server dependency |

## Integration Points (specific to this repo)

1. **`src/exports/geometry-readers.ts`** — extend `readFit()` to read `heartRate`, `cadence`, `distance`, `enhancedSpeed`/`speed`, `altitude`/`enhancedAltitude` off each `recordMesg` (fields confirmed present via live decode); extend `readGpx()` to capture `ele` and per-point `time` in a single regex pass over each `<trkpt>...</trkpt>` block.
2. **`src/types/garmin-fitsdk.d.ts`** — currently a minimal 24-line ambient declaration with a `[key: string]: unknown` catch-all on `recordMesgs`. Functionally sufficient (fields are already accessible, just typed `unknown`), but worth widening with explicit optional fields (`heartRate?: number`, `cadence?: number`, `distance?: number`, `enhancedSpeed?: number`, `enhancedAltitude?: number`) for type safety in the new stream-extraction code.
3. **`data/provenance.json`** — already maps canonical activity IDs to their original `export_data/` FIT/GPX file, exactly the linkage the stream-ingestion pipeline needs; no schema change required, just a new consumer.
4. **`vite.config.pages.ts`** — add the dashboard SPA as a new entry in the existing multi-page `rollupOptions.input`, following the same pattern as `heatmap.html`/`pinmap.html`/`routes.html`.
5. **`src/widgets/geo-table-widget/table-sorter.ts` and `table-paginator.ts`** — either import directly (if made shareable) or duplicate-and-adapt for the activity list; both are already generic (`<T>`) and dependency-free.
6. **Chart.js registration** — follow the existing tree-shaken pattern from `src/widget/chart-config.ts` / `src/widgets/comparison-chart/chart-config.ts` (`Chart.register(...)` with only the components actually used) rather than importing `chart.js/auto`.

## Sources

- Live repo inspection: `package.json`, `vite.config.ts`, `vite.config.pages.ts`, `scripts/build-widgets.mjs`, `src/exports/geometry-readers.ts`, `src/types/garmin-fitsdk.d.ts`, `src/widgets/geo-table-widget/*.ts` — HIGH confidence, verified directly.
- Live decode of real archive files (`export_data/strava/activities/*.fit.gz`, `*.gpx`) using the already-installed `@garmin/fitsdk` — HIGH confidence, empirically verified in this session (field presence, decode performance, GPX extension absence).
- npm registry (`npm view <pkg> version`), checked live: `@garmin/fitsdk@21.212.0` (installed = latest), `chart.js@4.5.1` (installed = latest), `preact@10.29.8`, `preact-router@4.1.2`, `uplot@1.6.32`, `fuse.js@7.5.0`, `navigo@8.11.1` — HIGH confidence, current as of 2026-08-10.
- Chart.js official docs (decimation plugin, min-max/LTTB algorithms, built-in since v3, ~100ms render for 5-10k points post-decimation) via WebSearch — MEDIUM confidence, corroborated by the plugin file (`node_modules/chart.js/dist/plugins/plugin.decimation.d.ts`) actually present in the installed package. [Data Decimation | Chart.js](https://www.chartjs.org/docs/latest/configuration/decimation.html), [Performance | Chart.js](https://www.chartjs.org/docs/latest/general/performance.html)
- `.planning/PROJECT.md` — Key Decisions table confirming "Native Custom Elements API — Zero dependencies... ✓ Good" and "Vite multi-page build for standalone... ✓ Good" as already-validated project values this research extends rather than contradicts.

---
*Stack research for: training-analytics dashboard SPA (v2.0 milestone), strava-widgets repo*
*Researched: 2026-08-10*
