# Architecture Research

**Domain:** Training-analytics dashboard (static SPA) integrating into an existing TypeScript/Node CLI pipeline + Vite widget build, deployed to GitHub Pages
**Researched:** 2026-08-10
**Confidence:** MEDIUM-HIGH (grounded in direct inspection of this repo's code/config; a few numeric estimates and one GH-Pages behavior are marked separately)

## Summary / Recommendation

Treat the new components as **two new pipeline stages plus one new build target**, not a parallel system:

1. **Stream derivation** — a new committed data family, `data/streams/<id>.json`, populated once via a local backfill command (from `export_data/` FIT/GPX) and incrementally via the existing intervals.icu sync. It is **committed to git**, like `data/activities/`, not gitignored like `data/stats/` — because its sources (local export, intervals.icu's ~1yr window) are not permanently available to regenerate from.
2. **Best-efforts + records/trends** — pure derived aggregates computed from `data/activities/` + `data/streams/`, following the existing `data/stats/` convention: **gitignored, recomputed every CI run**, shipped only into the deploy output.
3. **Dashboard SPA** — a new Vite multi-page entry point built the same way `heatmap.html`/`pinmap.html`/`routes.html` already are (standalone page, not an IIFE widget library), consuming a new lightweight index manifest plus lazily-fetched per-activity stream files.

This mirrors patterns already proven in this codebase (route/heatmap pre-computation, `data/stats/` gitignore-and-regenerate, `copyDataFiles()` deploy staging) rather than introducing new architectural concepts.

## Existing System (what this integrates with)

```
export_data/ (LOCAL ONLY, gitignored)          intervals.icu API (daily CI)
   strava/*.fit.gz, *.gpx                              │
        │                                              │
        ▼                                              ▼
 consolidate-exports (local CLI)            IntervalsSync.syncNewActivities()
        │  writes data/provenance.json               │  writes data/activities/<id>.json
        │  imports missing activities                │  (geometry via streams, dedupe by
        │  into data/activities/                      │   start_date epoch)
        ▼                                              ▼
              data/activities/*.json  (COMMITTED — 1,867 files, 7.5MB, the durable archive)
                              │
        ┌─────────────────────┼─────────────────────────┐
        ▼                     ▼                          ▼
 compute-stats/          compute-geo-stats          compute-route-data /
 compute-advanced-stats  → data/geo/*.json           compute-heatmap-data
 → data/stats/*.json     (COMMITTED)                 → data/routes, data/heatmap
 (GITIGNORED, cheap                                   (COMMITTED — derived from
  to regenerate)                                       activities' polylines only)
        │                     │                          │
        └─────────────────────┴─────────────┬────────────┘
                                              ▼
                              build-widgets.mjs (Vite, per-widget IIFE
                              loop + copyDataFiles() + buildPages())
                                              ▼
                                     dist/widgets/  (gitignored, built
                                     fresh every CI run)
                                              ▼
                          peaceiris/actions-gh-pages@v4 → gh-pages branch
```

Key existing conventions this milestone should follow:
- **Committed vs regenerated split**: anything cheaply recomputable from already-committed inputs is gitignored (`data/stats/`) and rebuilt every CI run; anything whose *source* isn't reliably available later (activities themselves, route polylines derived from FIT/GPX) is committed directly.
- **Derive-small, discard-raw**: `data/activities/<id>.json` never stores the full GPS track — only an encoded `summary_polyline` (already lossy/simplified) and `start_latlng`. Full-resolution streams are fetched, used, and thrown away (`IntervalsProvider.fetchGeometry`, `geometry-readers.ts`). The stream-storage design below extends this same instinct.
- **Lazy per-item JSON, small index JSON**: `data/routes/route-list.json` (full list, all fields needed for a table/overlay) + `data/routes/latest-runs.json` (top-20 slice) is exactly the index/detail split the dashboard needs, just applied to per-activity time-series instead of polylines.
- **Non-blocking optional steps**: geocoding and intervals fetch both use `continue-on-error: true` in CI so a transient failure degrades to cached data rather than blocking deploy. The new compute steps should follow the same pattern.

## New Components

### 1. Stream ingestion (NEW code, NEW data family)

**What's new:**
- Extend `src/exports/geometry-readers.ts` (`readFit`/`readGpx`) to pull heart rate, cadence, altitude, distance, and per-record timestamp — not just `positionLat/positionLong`. FIT `recordMesgs` already carries `heartRate`, `cadence`, `altitude`, `distance`, `timestamp` fields alongside position; GPX needs `<extensions>`/`<gpxtpx:hr>` parsing added to the existing regex-based reader (or a minimal fallback when absent — Strava's own GPX export often omits HR/cadence extensions, unlike FIT).
- New module, e.g. `src/streams/derive-stream.ts`: turns a raw record sequence (from FIT/GPX **or** from `IntervalsProvider.getAllStreams`) into one **canonical stream shape** used everywhere downstream — this is the seam that makes backfill and incremental ingestion produce identical output regardless of source.
- New CLI command, e.g. `backfill-streams` (or fold into `consolidate-exports`, which already walks `export_data/` and knows the id↔file mapping via `data/provenance.json`): reads originals, derives streams, writes `data/streams/<id>.json`. Idempotent — skips ids that already have a stream file unless `--force`, matching `consolidate-exports`'s re-runnable design (needed anyway for when the pending Garmin export adapter lands).
- Extend `IntervalsSync.syncNewActivities()` (or `IntervalsProvider.fetchGeometry`) to derive and persist a stream file for each newly-synced activity, reusing the **same streams response already being fetched** for polyline reconstruction — avoid a second network call per activity.

**Storage strategy — decided:**

| Question | Decision | Why |
|---|---|---|
| Commit raw streams? | **No.** Never persist full raw FIT/GPX record dumps or full-resolution lat/lng arrays. | Lat/lng is already covered by the existing `summary_polyline` on the activity record and by `data/routes`/`data/heatmap`; duplicating it roughly doubles per-activity payload for zero new capability. |
| Commit *derived* per-activity series? | **Yes — `data/streams/<id>.json`, committed to git**, not gitignored. | Sources vanish: `export_data/` is local-only (gitignored, never in CI), and intervals.icu retains only ~1 year of Garmin backfill (per memory: "intervals.icu holds only ~1 year of Garmin backfill"). CI cannot regenerate this the way it regenerates `data/stats/`. Same reasoning that already makes `data/activities/` committed instead of gitignored. |
| Format | Compact object with **parallel arrays**, not array-of-objects: `{ id, sampleCount, t: [...], d: [...], hr: [...], cadence: [...], alt: [...] }` (seconds-since-start, cumulative meters, bpm, spm, meters). Round HR/cadence to integers, altitude to 0.1m, drop nulls-run-length where cheap. | Parallel-array + short keys is standard JSON-size hygiene; avoids the ~2x bloat of `[{t,d,hr,...}, ...]` repeated-key objects at this file count. |
| Downsample? | **No aggressive fixed-point downsampling.** Keep native sampling density (FIT devices/intervals.icu are already ~1–5s smart-recording, not 1kHz). Only drop lat/lng (see above) and round numeric precision. | Repo-size math below shows this comfortably fits GitHub's limits without lossy downsampling, and best-effort computation (fastest-1k-within-a-run, etc.) is more accurate against native density than an artificially decimated series. Decimating now would need re-deriving from FIT later if best-effort logic turns out to need finer resolution — better to keep the one durable derived artifact reasonably rich since backfill sources disappear once consolidated. |
| Compression | Plain `.json`, **not pre-gzipped**. | GitHub Pages is fronted by Fastly and applies on-the-fly gzip to compressible responses for clients that send `Accept-Encoding: gzip` (MEDIUM confidence, GitHub Pages docs/community discussion — see Sources). Pre-gzipping (`.json.gz` + client-side `DecompressionStream`) adds real complexity (build step, fetch-and-inflate on every widget/SPA read) for a transfer-size win the CDN already gives for free. Revisit only if actual measured payload sizes are a problem. |

**Size estimate (MEDIUM confidence, not directly measured):** stripping lat/lng and using parallel arrays, a ~45min run stores ~500–900 samples × 4 numeric series ≈ 8–20KB uncompressed JSON. Across 1,867 activities: **~15–35MB total**, growing by a few tens of KB/day going forward. Current committed `data/` is 38MB; this roughly doubles it — well inside GitHub's "keep it under 1GB, definitely under 5GB" guidance and nowhere near the 100MB single-file block (each file is one activity, KB-sized). No per-file or repo-size blocker.

**One real risk worth flagging (MEDIUM confidence):** `peaceiris/actions-gh-pages@v4` without `force_orphan: true` appends a new commit to the `gh-pages` branch on every deploy rather than resetting it, so that branch's own history (separate from `main`) grows unboundedly over the life of the project regardless of how compact `main` stays. This isn't new to this milestone, but adding a genuinely larger data family increases the stakes of that pre-existing choice — worth a `force_orphan: true` follow-up if `gh-pages` branch size ever becomes a concern (out of scope to change here since it's not caused by this milestone).

### 2. Backfill — local-only, one-time-ish command (NOT CI)

`export_data/` is gitignored and never checked out by GitHub Actions, so **stream backfill for the 1,867 pre-existing activities structurally cannot run in CI** — it must run on the developer's machine, the same constraint `consolidate-exports` already documents and obeys. Concretely:

- Add to the same family as `consolidate-exports` (either a new command or a `--streams` flag on it) so it reuses `data/provenance.json`'s id→original-file mapping instead of re-deriving it.
- Run locally: `node dist/index.js backfill-streams` (or equivalent), then `git add data/streams && git commit`.
- Re-runnable/idempotent by design (skip activities with an existing stream file) because: (a) the pending Garmin bulk export (`export_data/garmin/`, adapter not yet written per project memory) will need the same command run again once it lands, and (b) `consolidate-exports` can import *new* activities from an export at any time, which then also need streams derived.
- Activities with no original recording (`provenance.json`'s `archive_without_original` — 24 currently) simply get no stream file; downstream code (index manifest, detail view) must treat `hasStreams: false` as a normal, expected state, not an error.

### 3. Incremental flow for new activities (intervals.icu, daily CI) — MODIFIED existing code

No new CI infrastructure needed — this extends `IntervalsSync`/`IntervalsProvider`, which already fetches a streams response per new activity for polyline reconstruction:

- `IntervalsProvider.fetchGeometry` (or a sibling method) derives the compact stream artifact from the **same** `getStreams`/`getAllStreams` response it already fetches, rather than issuing a second request.
- Writes `data/streams/<id>.json` for that one new activity as part of `IntervalsSync.syncNewActivities()`'s per-activity loop — incremental by construction, no full-archive reprocessing.
- `.github/workflows/daily-refresh.yml`: extend the `git-auto-commit-action` step's `file_pattern` to include `data/streams/*.json` (it already lists `data/activities/*.json data/sync-state.json data/geo/*.json`). This is a one-line addition to an existing workflow step, not a new job.
- Follow the existing non-blocking pattern: a streams-derivation failure for one activity should warn and continue (activity still gets saved without a stream file, same as it already does without a route on geometry failure), not abort the whole sync.

### 4. Best-effort computation (NEW code, follows `data/stats/` convention)

- New module, e.g. `src/analytics/compute-best-efforts.ts`, alongside the existing `compute-stats.ts`/`compute-advanced-stats.ts`. Pure function: reads `data/activities/*.json` + `data/streams/*.json`, for each activity slides a distance window over the `d`/`t` arrays to find fastest 400m/1k/1mi/5k/10k/HM/marathon splits, and aggregates into a PR list per distance across the archive.
- Output: `data/stats/best-efforts.json` (or a new `data/dashboard/` dir if you want dashboard-only aggregates namespaced separately from the widget-facing `data/stats/` — either works; reusing `data/stats/` is less new surface area).
- **Gitignored, regenerated every CI run** — this is the cheap-to-recompute tier, unlike streams. It reads only already-committed JSON, same cost class as `compute-stats`/`compute-advanced-stats` today (1,867 small files, no network, no FIT parsing).
- Wire into the existing `compute-all-stats` command chain (`src/index.ts`) and the `npm run compute-all-stats` step already present in `daily-refresh.yml`, rather than inventing a separate pipeline stage.

### 5. Records/trends aggregates (NEW code, extends existing pattern directly)

- Weekly/monthly/yearly/all-time records (fastest pace ever in a week, longest streak, etc.) are a natural extension of the *existing* `compute-advanced-stats.ts` (which already produces `weekly-distance.json`, `monthly-stats.json`, `yearly-stats.json`, `year-over-year.json`, `streaks.json`). Add new output files there rather than a new module family, unless the logic diverges significantly.
- Same gitignore/regenerate treatment as `data/stats/` today.
- Can be built in parallel with best-efforts (Component 4) — they share no code dependency, both depend only on `data/activities/` (records/trends) or `data/activities/` + `data/streams/` (best-efforts).

### 6. Dashboard data contract (NEW, the pipeline↔SPA seam)

Two new file families, deployed via an extended `copyDataFiles()` in `build-widgets.mjs`:

- **Index/manifest** — `data/dashboard/activities-index.json` (gitignored, regenerated, small): one array entry per activity with everything the activity-browser list/filter/sort view needs and nothing more — id, date, distance, moving time, avg pace, avg HR, avg cadence, elevation gain, city/country (joined from `data/geo/activity-cities.json`), gear (from `data/provenance.json`), and a `hasStreams: boolean` flag. Sorted newest-first, same shape-role as `data/routes/route-list.json`. At ~150–250 bytes/entry this stays under ~500KB even at several years of growth — safe to fetch whole, no pagination needed for the foreseeable future.
- **Per-activity detail** — the SPA fetches `data/streams/<id>.json` **lazily, on route change**, exactly like `single-run-map` already fetches one route's polyline on demand rather than bundling all routes into the widget. Never loaded in bulk by the list view.
- **Aggregates** — `data/stats/best-efforts.json`, plus whatever new keys land in the existing `data/stats/*.json` files for records/trends — fetched by the relevant dashboard views directly, same as widgets already do today.
- Recommend a `schemaVersion` field on the index manifest and on the per-activity stream file, given the project's explicit "flexible foundation... many more functions can plug into over time" goal — cheap insurance against silent breakage as the shape evolves across future milestones.

### 7. Dashboard SPA build integration (NEW entry point, follows existing standalone-page pattern)

- Structurally the dashboard is much closer to `src/pages/heatmap.html` / `pinmap.html` / `routes.html` (a standalone page, ES modules, client routing) than to a Custom-Element widget (IIFE, embeddable, no router). **Do not** add it to the per-widget IIFE loop in `build-widgets.mjs` (the `widgets` array) — that format (global-name IIFE, IE-style single bundle) is for embeddable widgets, not a multi-view app.
- Add a new entry to the `buildPages()` step (and mirror it in `vite.config.pages.ts`'s `rollupOptions.input`): `dashboard: resolve(__dirname, 'src/pages/dashboard.html')`, output alongside the other standalone pages in `dist/widgets/` (or rename that output dir if the "widgets" name now feels wrong — optional, not required this milestone).
- **Routing constraint:** GitHub Pages serves static files with no server-side rewrite rule, and this repo's deploy config sets no custom 404 fallback. A dashboard with per-activity deep links (`/dashboard/activity/123`) using the History API would 404 on refresh or direct link. Use **hash-based routing** (`#/activity/123`) to sidestep this entirely, or add a `404.html` that's a copy of `dashboard/index.html` (the standard GH Pages SPA workaround) if path-based routing is preferred later.
- Extend `copyDataFiles()` in `build-widgets.mjs` with the new `data/streams` and `data/dashboard` directories (same copy-all-json-files pattern already used for `data/stats`, `data/geo`, `data/routes`, `data/heatmap`).
- `.github/workflows/daily-refresh.yml`: insert the new compute steps (best-efforts, records/trends, index manifest) after the existing `compute-all-stats`/`compute-geo-stats` steps and before `npm run build-widgets` — no new job, no change to the deploy step (it already publishes the whole output directory).

## Build Order

Dependencies flow: **raw source access → derived streams → best-efforts/aggregates → data contract → SPA views**. Recommended sequence:

1. **Extend FIT/GPX readers** (`geometry-readers.ts`) to pull HR/cadence/altitude/distance/timestamp, not just position. Foundational — every later step needs this.
2. **Canonical stream-derivation module** (`src/streams/derive-stream.ts` or similar) — shared by both backfill and incremental sync, so they can never drift into two different stream shapes.
3. **Local backfill command** — produces `data/streams/<id>.json` for the ~1,835 export-covered historical activities; run and commit locally. Do this early because everything else (best-efforts especially) is much easier to build and test against real data than against fixtures.
4. **Incremental intervals.icu stream persistence** — extend `IntervalsSync`, wire into the daily workflow's commit step. Can happen in parallel with step 3 since it touches different code paths, but should land before step 6/7 rely on "streams exist for new activities too."
5. **Best-effort computation** — depends on step 2's shape and benefits from step 3's real data existing to validate against. Build and test against the backfilled archive.
6. **Records/trends aggregates** — depends only on `data/activities/`; can be built in parallel with step 5.
7. **Dashboard data contract** (index manifest generator) — depends on steps 3–6 having real output to join against (geo, provenance, best-efforts, streams-availability all feed into it).
8. **Dashboard SPA** — depends on step 7's contract being stable. Within the SPA itself, sequence views by their own data dependency: **list view (needs only the index manifest) → detail view with charts (needs per-activity streams) → best-efforts view (needs the best-efforts aggregate) → records/trends view (needs the records aggregate).** Vite/build/workflow wiring (component 7 above) can be scaffolded early in parallel (an empty page that proves the build pipeline works) but final `copyDataFiles()`/`file_pattern` wiring should follow the contract, not precede it, to avoid churn.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Recomputing streams/best-efforts from FIT in CI
**What people do:** Treat backfill like `compute-stats` — "just regenerate it in the daily workflow."
**Why it's wrong:** `export_data/` is gitignored and never present on the GitHub Actions runner. This would silently produce nothing (or error) in CI, unlike every other `compute-*` step which works because its inputs are already committed.
**Instead:** Backfill is a one-time (re-runnable) **local** command whose output (`data/streams/`) is committed. CI only ever adds streams for *new* activities via the intervals.icu API path, which it does have access to.

### Anti-Pattern 2: Duplicating full-resolution lat/lng in the new stream files
**What people do:** Store every stream field the API/FIT file offers, including position, "to be safe."
**Why it's wrong:** Route geometry is already committed (as a simplified polyline) in `data/activities/<id>.json` and pre-decoded further in `data/routes`/`data/heatmap`. Re-storing full-precision GPS in a second file roughly doubles per-activity payload for a capability (higher-precision map rendering) this milestone doesn't need.
**Instead:** New stream files carry only the channels not already covered: time, cumulative distance, pace/speed, HR, cadence, elevation.

### Anti-Pattern 3: Bulk-loading all per-activity streams for the list/browser view
**What people do:** Fetch every `data/streams/*.json` up front so filtering/sorting "just works" client-side against full data.
**Why it's wrong:** At ~15–35MB total and growing, that's a multi-megabyte load for a page that only needs to show a table.
**Instead:** The list view reads only the small index manifest (`activities-index.json`); per-activity streams are fetched lazily on navigating into a detail view — same lazy-load discipline `single-run-map` already applies to routes.

### Anti-Pattern 4: Path-based SPA routing with no 404 fallback
**What people do:** Use the History API (`/dashboard/activity/123`) because it looks nicer than hash routes.
**Why it's wrong:** GitHub Pages has no server-side rewrite; a direct link or refresh on a sub-path 404s. The current deploy config sets no 404-to-index fallback.
**Instead:** Hash-based routing (`#/activity/123`), or add a `404.html` = copy of the dashboard's `index.html` if path routing is wanted later.

### Anti-Pattern 5: Building the dashboard through the widget IIFE loop
**What people do:** Add `dashboard` as another entry in `build-widgets.mjs`'s `widgets` array since "that's how we build things here."
**Why it's wrong:** That pipeline targets single-global-name IIFE bundles for embeddable Custom Elements — wrong format for a multi-view, routed application.
**Instead:** Treat it like the existing standalone pages (`buildPages()` / `vite.config.pages.ts`), which already build ES-module, multi-file, non-IIFE output for `heatmap.html`/`pinmap.html`/`routes.html`.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Backfill CLI ↔ `export_data/` | Local filesystem read, `data/provenance.json` as index | Local-only; never runs in CI. Re-run when Garmin export lands. |
| Backfill CLI / IntervalsSync ↔ `data/streams/` | Committed JSON files, one per activity id | Shared derivation module (`derive-stream.ts`) keeps both producers' output identical in shape. |
| `compute-best-efforts` / records ↔ `data/activities/` + `data/streams/` | Read committed JSON, pure computation | Gitignored output, regenerated every CI run — same tier as `compute-stats` today. |
| Dashboard SPA ↔ pipeline outputs | Static JSON over HTTP (GitHub Pages), fetched at runtime | Index manifest fetched once per session; per-activity streams and aggregates fetched on demand. No build-time coupling between SPA code and pipeline code beyond the JSON shape (schemaVersion recommended). |
| `daily-refresh.yml` ↔ new compute steps | Sequential job steps, `continue-on-error` for optional stages | Insert after existing `compute-all-stats`/`compute-geo-stats`, before `build-widgets`; extend `git-auto-commit-action`'s `file_pattern` for `data/streams/*.json` only (not gitignored aggregates). |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Pages (Fastly CDN) | Static hosting, automatic gzip on the fly | MEDIUM confidence — no server config needed; pre-gzipping the new JSON is unnecessary complexity given this. |
| intervals.icu API | Already-integrated `IntervalsClient`/`IntervalsProvider`, extend to persist streams from the response already fetched for geometry | No new client code needed, just broaden what's extracted from the existing `getAllStreams`/`getStreams` call. |

## Sources

- Direct inspection: `.planning/PROJECT.md`, `src/exports/geometry-readers.ts`, `src/exports/consolidate.ts`, `src/api/intervals-client.ts`, `src/api/intervals-provider.ts`, `src/sync/intervals-sync.ts`, `src/index.ts`, `scripts/build-widgets.mjs`, `scripts/compute-route-data.mjs`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/daily-refresh.yml`, `.gitignore`, `data/provenance.json`, repo file-size measurements (`du`, `git count-objects`). HIGH confidence — this is the actual current system, not inferred.
- Project memory: `intervals-icu-migration.md` (data2 stream quirk, ~1yr intervals.icu retention window, provenance/backfill status, pending Garmin adapter). HIGH confidence — established through prior direct verification per the memory file itself.
- [GitHub Docs — Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits) — file size (100MB block, 50MB warning) and repo size guidance (<1GB ideal, <5GB strongly recommended). HIGH confidence, official docs.
- [GitHub community discussion #146740 — size limits](https://github.com/orgs/community/discussions/146740) — corroborates the above. MEDIUM confidence, community source, consistent with official docs.
- GitHub Pages / Fastly on-the-fly gzip compression for compressible static content — MEDIUM confidence, based on community discussion and Fastly's documented automatic-compression feature; not verified against this repo's actual response headers.

---
*Architecture research for: training-analytics dashboard integration, strava-widgets v2.0*
*Researched: 2026-08-10*
