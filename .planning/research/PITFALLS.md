# Pitfalls Research: Training Dashboard (v2.0) — Streams, Best Efforts, SPA on GitHub Pages

**Domain:** Adding FIT/GPX stream ingestion, best-effort computation, and a dashboard SPA to an existing static Strava-widgets pipeline
**Researched:** 2026-08-10
**Confidence:** MEDIUM-HIGH (grounded in this repo's actual data — 1,835 `.fit.gz` + 306 `.gpx` in `export_data/strava/`, existing `src/exports/geometry-readers.ts` FIT decoder, existing repo-bloat precedent in git history — cross-checked against FIT SDK docs, GitHub repo-limit docs, and intervals.icu forum threads)

## Critical Pitfalls

### Pitfall 1: Recomputing distance from raw lat/lng instead of using the device's cumulative distance field

**What goes wrong:**
Best-effort splits (400m/1k/1mi/5k/10k/HM/marathon) are computed against a self-derived haversine distance built from raw `positionLat`/`positionLong` points instead of the FIT record's own cumulative `distance` field. Raw GPS points jitter a few meters even when stationary (tree cover, urban canyon, traffic-light stops), so a haversine-summed distance array is not strictly monotonic — it can wobble back and forth. Short efforts (400m, 1k) are especially sensitive: a few meters of noise is a large fraction of 400m, producing phantom PRs, negative-duration splits, or missed splits when the "sliding window" logic assumes monotonic non-decreasing distance.

**Why it happens:**
The codebase already decodes raw `positionLat`/`positionLong` for route polylines (`src/exports/geometry-readers.ts`), so it's tempting to reuse that same array for distance-based analytics. But route geometry and pace/distance analytics have different noise tolerances — polylines just need to look right on a map, best efforts need monotonic ground truth.

**How to avoid:**
Prefer the FIT record's native `distance` field (Garmin's own smoothed, monotonic cumulative distance, GPS+accelerometer-fused on modern devices) as the x-axis for best-effort computation, not a recomputed haversine sum. For GPX-sourced activities (306 files, phone-app recordings with no native distance field), haversine is the only option — apply an outlier/speed-implausibility filter (reject point-to-point implausible speeds, e.g. >8 m/s instantaneous pace spikes for a run) before treating the cumulative sum as ground truth, and consider flagging GPX-derived best efforts as lower-confidence in the UI (e.g., a badge) rather than presenting them with the same precision as FIT-derived ones.

**Warning signs:**
Best efforts shorter than the target distance's typical GPS noise floor (sub-1k) that don't match what Strava/Garmin already computed for the same activity; negative or zero-duration segments; PR lists dominated by GPX-sourced (phone-recorded) activities.

**Phase to address:** Stream ingestion / best-effort computation phase.

---

### Pitfall 2: O(n²) or worse best-effort search instead of a two-pointer sweep

**What goes wrong:**
A naive implementation nested-loops over every (start, end) index pair per target distance to find the minimum-time window covering that distance. For a ~1-hour run at 1Hz that's ~3,600 points → ~6.5M pairs, times 7 target distances, times ~1,850 running activities with distance data. This either makes the CI build unacceptably slow (the pipeline already runs full-archive recomputation on every push per `.github/workflows/daily-refresh.yml`) or times out the 30-minute CI job.

**Why it happens:**
The brute-force formulation is the obvious first draft: "for every start point, scan forward until you've covered the target distance." It's correct but doesn't exploit that distance is monotonic non-decreasing.

**How to avoid:**
Use the standard two-pointer sweep: since cumulative distance is non-decreasing, as the start index `i` advances, the minimal end index `j` satisfying `distance[j] - distance[i] >= target` is also non-decreasing — each pointer only moves forward across the whole pass, giving O(n) per target distance per activity (not O(n·log n) or O(n²)). Also interpolate linear time at the exact target-distance crossing (rather than snapping to the next recorded point) — otherwise best-effort times are systematically biased slow by up to one sample interval, and that bias is proportional to sample rate, which differs between FIT (~1Hz) and any lower-rate source. Pre-filter: skip an activity entirely for a given target distance if `activity.distance < target * 0.99` — most runs are shorter than half the standard target list, so this alone eliminates most of the work before even loading the stream file.

**Warning signs:**
`compute-best-efforts` step wall-clock time growing linearly with the number of *target distances* multiplied by stream size rather than staying near-linear in total stream points; CI job duration creeping toward the 30-minute timeout as the archive grows.

**Phase to address:** Best-effort computation phase — get the algorithm's complexity right before running it over the full ~1,850-activity archive, not after a slow CI run forces a rewrite.

---

### Pitfall 3: Pauses and auto-lap gaps inflating (or hiding) best-effort times

**What goes wrong:**
Best-effort segment duration is computed as `(index_j - index_i)` assuming constant 1Hz sampling rather than `timestamp[j] - timestamp[i]` from the actual recorded timestamps. Garmin "smart recording" and manual/auto-pause both create real gaps in the timestamp stream (the watch simply stops writing records, or a pause/resume event pair brackets a stationary period) without necessarily advancing distance. If duration is derived from array-index deltas instead of timestamp deltas, a paused run appears to have run through the pause at zero elapsed time (impossibly fast splits) or, if pause records are retained with stale timestamps, produces division-by-near-zero pace spikes.

**Why it happens:**
Assuming a uniform sample rate is a reasonable simplification until it silently breaks on the subset of activities that were paused (traffic lights, photo stops, gear adjustments) — which, for a personal archive spanning years and mixed devices/apps, is common, not rare.

**How to avoid:**
Always index by the record's own `timestamp` field (seconds resolution from FIT, or `<time>` from GPX), never by array position. When computing best-effort duration, use `timestamp[j] - timestamp[i]` directly. Cross-check: an activity's summed best-effort-implied pace should never be faster than its `max_speed` field from the canonical record — use that as a sanity assertion/guard in tests, not just in the algorithm.

**Warning signs:**
Best efforts with pace far outside human plausibility (e.g., sub-2:00/km "5k best effort" inside a 6:00/km-average run); best efforts clustering suspiciously at activities known to have GPS/device dropouts.

**Phase to address:** Best-effort computation phase.

---

### Pitfall 4: FIT `positionLat`/`positionLong` sentinel/invalid values treated as real coordinates

**What goes wrong:**
FIT stores position as signed 32-bit semicircles (already correctly handled in this repo: `SEMICIRCLE = 180 / 2**31` in `geometry-readers.ts`). Uninitialized/invalid fields in the FIT spec use a sentinel value (`0x7FFFFFFF`) rather than being omitted from the message. Indoor activities, GPS-signal-loss stretches (tunnels, dense tree cover, parking garages), and treadmill runs recorded on a watch that still writes `record` messages without a GPS fix can carry these sentinels. If code doesn't guard for the sentinel (or for `positionLat`/`positionLong` simply being absent, which the existing decoder already checks via `typeof === 'number'`), a stray point at ~180°,180° corrupts route bounding boxes, breaks the multi-run map auto-fit, and can wreck a naive haversine-distance-based best-effort calculation with an enormous phantom jump.

**Why it happens:**
The existing decoder (`readFit` in `geometry-readers.ts`) already filters on `typeof rec.positionLat === 'number'`, which handles *missing* fields via the FIT SDK's own decoding, but the FIT SDK may still surface the raw sentinel as a very large/small finite number rather than `undefined` in edge cases (varies by SDK version and message type). This is easy to overlook when extending the same decoder to also pull `distance`, `heartRate`, `cadence`, `altitude` per record for streams — those fields have their own per-type invalid-value sentinels, and each needs its own guard.

**How to avoid:**
When extending `readFit`/`readOriginal` to emit full multi-field streams (not just coordinates), explicitly bounds-check `positionLat`/`positionLong` (valid range ±90/±180 after semicircle conversion) and treat any FIT-typed field's max-sentinel value as "missing," not as data. Reuse the existing `IntervalsProvider.validateGeometry` distance-consistency check pattern (`accept 0.6–1.6x` recorded distance, per the intervals-icu-migration memory) as a template for a stream-level sanity check, not just a whole-activity one.

**Warning signs:**
Route maps that occasionally auto-fit to a near-global bounding box; best-effort or elevation-gain outliers many multiples beyond plausible human performance.

**Phase to address:** Stream ingestion phase (parser hardening), verified before best-effort computation consumes the streams.

---

### Pitfall 5: Cadence unit mismatch between bulk-imported FIT streams and incremental intervals.icu streams

**What goes wrong:**
Garmin's FIT `cadence` field for running is recorded as *rpm* (one leg's revolutions), i.e. half of steps-per-minute, with a separate `fractional_cadence` field (0 or 0.5) to recover odd SPM values — the documented convention is `displayed_spm = 2 * (cadence + fractional_cadence)`. This repo will have two cadence sources: historical activities backfilled from bulk-export FIT files (parsed locally, in this raw half-cadence convention) and future activities ingested incrementally from intervals.icu's API going forward (per the intervals-icu-migration memory). intervals.icu's own community forum has open discussion about whether its cadence stream is reported in SPM directly or in the Garmin rpm convention — the semantics are not guaranteed consistent with a locally-parsed FIT file. If the two sources aren't normalized to one convention at ingestion, cadence charts and any cadence-based stats will show a ~2x discontinuity exactly at the historical/live boundary (around Aug 2026, matching the provider migration).

**Why it happens:**
Two different code paths (local FIT parsing vs. intervals.icu API JSON) feed the same downstream schema, and unit semantics for "cadence" are a classic silent-mismatch field — both sides look like a plausible number, so nothing errors, it just looks wrong on a chart.

**How to avoid:**
Normalize cadence to steps-per-minute at the ingestion boundary for *both* sources, and verify empirically rather than trusting docs: this codebase already has the right pattern for this — `IntervalsProvider`'s header comment explicitly says field mappings are "NOT... verified against a live account" and ships a `probe-intervals` command to diff real payloads against assumptions before trusting a sync. Apply the same discipline to the streams endpoint: probe a live intervals.icu activity that has a run with known cadence (compare against what the Garmin device itself displayed) before trusting the stream's cadence units.

**Warning signs:**
A visible step-change in average/max cadence in trend charts around the point where an activity switches from FIT-derived (backfill) to intervals.icu-derived (incremental) source; cadence in the "80s" for a run that should read "160s+" SPM, or vice versa.

**Phase to address:** Stream ingestion / stream-schema normalization phase — this is the same category of gotcha as the already-documented `data`/`data2` latlng stream quirk from the migration; treat it with equal suspicion before trusting it.

**Confidence:** MEDIUM — the FIT-side half-cadence convention is well-documented (Garmin forums, FIT SDK field tables); the intervals.icu-side ambiguity is sourced from an intervals.icu community forum thread (not an official spec statement), so verify empirically via `probe-intervals` rather than trusting either claim blindly.

---

### Pitfall 6: Committing full-resolution stream JSON to git blows past the repo's existing bloat trajectory

**What goes wrong:**
This repo already has a demonstrated, measurable bloat pattern: `data/heatmap/all-points.json` (decimated lat/lng points only, no other metrics) is git-tracked and re-committed on every pipeline run when it changes, at ~11–13 MB per version, and multiple historical versions already sit in the pack (`git count-objects -vH` currently shows ~63 MB packed, ~27 MB loose). Full per-activity streams (time, distance, lat, lng, altitude, heart rate, cadence — 5-7 parallel series, not just lat/lng) at native ~1Hz resolution for ~1,850 running activities will be an order of magnitude larger than the heatmap file per activity, and, unlike geo caches (which mutate slowly and rarely), stream data is written once per activity and essentially never changes — meaning the *first* backfill commit alone could push the repo well past GitHub's documented ~1 GB soft-limit warning threshold, before accounting for git history duplication from any re-run of the backfill.

**Why it happens:**
The existing pattern of "commit derived JSON so CI has it for the next incremental run" (used for `data/activities/`, `data/geo/*.json`, `data/routes/`, `data/heatmap/`) is a proven, working pattern in this repo — it's natural to extend it to streams without separately budgeting for the ~40x-larger payload streams represent versus summary/geo JSON.

**How to avoid:**
Do not git-track raw per-point streams at full resolution. Options, in order of preference: (1) downsample streams to a fixed point budget per activity (e.g., ≤200-500 points via largest-triangle-three-buckets or simple stride decimation) before writing to `data/`, matching the "pre-decoded heatmap points... trades file size for performance" decision already made for the heatmap widget; (2) keep only the *derived* best-effort/records JSON git-tracked (small, one row per activity per distance) and treat full streams as a build artifact regenerated from `export_data/` (gitignored, local-only) plus intervals.icu (re-fetchable), not committed at all — mirroring how `data/stats/` is already gitignored as "regenerated every run"; (3) if per-activity detail-view streams are genuinely needed client-side, generate them into `dist/` (deployed to `gh-pages`, not `master`) rather than into the git-tracked `data/` used for CI state, since `gh-pages` history can be squashed/orphaned independently (`peaceiris/actions-gh-pages` already force-pushes a single commit per deploy) without touching the pipeline's working history.
Whichever path is chosen, explicitly gitignore the raw/full-resolution form the same way `export_data/` already is, and only track the decimated/derived form.

**Warning signs:**
`du -sh .git` growing by tens of MB per week instead of staying roughly flat; `npm ci`/`actions/checkout@v4` (a full, non-shallow clone by default) taking noticeably longer in CI; a GitHub repo-size warning email.

**Phase to address:** Stream ingestion / storage-strategy phase — this is a foundational decision the roadmap needs to make explicit before any phase starts writing stream files, not something to patch after the archive balloons.

---

### Pitfall 7: Loading the entire archive's streams into the browser at once

**What goes wrong:**
A dashboard SPA over ~2,000 activities that either bundles one giant JSON (all streams, or even all activity summaries with full metadata) or lazily fetches-but-never-releases every activity's stream as the user browses will hit real memory and load-time limits on GitHub Pages (which has no server-side pagination — every response is a static file). Mobile Safari/Chrome tabs commonly OOM-kill or heavily throttle around a few hundred MB of live JS heap; a naive "fetch all activities, keep them all in a JS array/store for filtering" pattern scales fine at 100 activities and silently degrades at 2,000+, especially once each entry carries a full stream rather than just summary fields.

**Why it happens:**
Static-only hosting removes the usual escape hatch (server-side query/pagination), so the natural instinct is to ship one big precomputed JSON and let the client do all filtering/sorting in memory — which is exactly right for the *summary* list (small, one row per activity) but wrong for *streams* (large, needed only for the single activity currently being viewed).

**How to avoid:**
Split the data model by access pattern, matching the existing "72% payload reduction vs loading full activity data in widgets" decision already made for route data: one small, git-tracked index/summary JSON (id, date, distance, pace, best-effort flags — everything the browser/list/filter view needs) covering the whole archive, loaded once; per-activity stream JSON fetched on demand only when a detail view opens, and released/garbage-collected on navigation away. Never require all 2,000 streams to be resident simultaneously.

**Warning signs:**
Initial dashboard load time or memory footprint scaling with total archive size rather than with "currently visible" data; browser tab memory climbing unboundedly as a user pages through many activity detail views in one session without a reload.

**Phase to address:** Dashboard SPA shell phase (data-loading architecture) — decide the summary/detail split before building list and detail views on top of it.

---

### Pitfall 8: Client-side routing 404s and broken base paths on GitHub Pages

**What goes wrong:**
A dashboard SPA using client-side routing (e.g., `/dashboard/activities/12345`) works fine when navigated to from within the app, but a direct link, bookmark, or page refresh hits GitHub's static file server, which has no such path and returns a real 404 — GitHub Pages has no server-side rewrite/fallback mechanism. Separately, this repo's widgets are deployed to a `gh-pages` branch and (per the existing `daily-refresh.yml`) published as `./dist/widgets`, almost certainly served under a repo subpath (`https://<user>.github.io/strava-widgets/...`), not a domain root — any router or asset reference using absolute paths (`/assets/...`) instead of the correct base path will 404 in production while working fine in local dev (which usually serves from root).

**Why it happens:**
Local dev servers (Vite dev server, etc.) default to root-path serving with full history-API rewrite support, masking both issues until the first production deploy.

**How to avoid:**
Prefer hash-based routing (`#/activities/12345`) for the dashboard SPA — it never touches the server on navigation or refresh, sidestepping the 404 issue entirely and avoiding needing a `404.html` redirect-trick, which is a reasonable but hackier alternative. Whichever routing approach is used, set the build tool's base path explicitly to match the deployed subpath (mirroring how `vite.config.pages.ts` already configures a dedicated `outDir`/multi-page build for the existing standalone pages) and verify with a production-mode preview build, not just dev-server testing, before considering a phase done.

**Warning signs:**
Deep links or refreshes from the dashboard returning GitHub's default 404 page; broken CSS/JS asset loads only after deploying to `gh-pages`, not in local dev.

**Phase to address:** Dashboard SPA shell phase.

---

### Pitfall 9: Stale cached JSON after daily rebuilds (SPA serves yesterday's data)

**What goes wrong:**
The daily pipeline (`daily-refresh.yml`) rebuilds and redeploys `dist/widgets` (and, going forward, the dashboard) once a day, committing the same filenames each time (e.g., a fixed `data/summary.json`). Browsers and any CDN in front of GitHub Pages will happily cache these fixed filenames beyond the next day's rebuild, so returning visitors can silently see stale data (or, worse, a version mismatch where the SPA shell references a stream schema newer than the cached summary JSON it's reading, causing a runtime error rather than just staleness).

**Why it happens:**
GitHub Pages sets fairly aggressive default caching headers on static assets and doesn't provide cache-control configuration; the existing widget deploy pattern (small, individually-versioned IIFE bundles embedded elsewhere) has never needed cache-busting because widgets are typically re-embedded/refreshed alongside the host page's own deploys — a dashboard SPA that users bookmark and revisit doesn't get that same implicit refresh.

**How to avoid:**
Content-hash or timestamp-suffix the data files the SPA fetches (or at minimum the top-level index/summary JSON), and have the SPA shell itself carry a build-time version identifier it checks against the fetched data's own `generated_at` field, prompting a hard reload if they diverge — cheaper than solving full cache invalidation, and consistent with the project's existing pattern of embedding a `generated_at` timestamp in generated JSON (see `data/provenance.json`).

**Warning signs:**
Support/self-reports of "the dashboard doesn't show yesterday's run" despite the pipeline having committed and deployed successfully; hard-refresh "fixing" an apparently broken view.

**Phase to address:** Dashboard SPA shell phase, or CI/deploy integration phase — whichever phase finalizes the static asset naming/caching strategy.

---

### Pitfall 10: Backfill (bulk export) and incremental (intervals.icu) ingestion silently diverging in provenance and coverage

**What goes wrong:**
The one-time historical backfill (parsing 1,835 `.fit.gz` + 306 `.gpx` from `export_data/strava/`) and the ongoing daily incremental sync (intervals.icu API) are two structurally different code paths feeding the same canonical archive. Left unmanaged, this creates several concrete failure modes specific to this project: (a) new activities landing after the backfill script's own "record used" bookkeeping was last generated aren't picked up by a future re-run of the backfill, silently orphaning them from the streams layer even though `data/activities/<id>.json` exists; (b) the 24 archive records already flagged `archive_without_original` in `data/provenance.json` (plus the 4 rescued phone-app GPX runs called out as "a recurring category worth re-checking" in the migration memory) have no FIT/GPX to source streams from at all and need an explicit "no detail view / no best efforts available" UI state rather than crashing or silently omitting them from lists; (c) dedupe continues to rely on `start_date` epoch matching (per the migration memory, "verified unique across the whole archive"), but that uniqueness guarantee was established for whole-activity records, not (yet) re-verified once a stream layer with its own per-source keys is added — a second, independent join surface is a second place the epoch-uniqueness assumption can quietly break.

**Why it happens:**
`consolidate-exports` was designed as an idempotent, re-runnable *one-time reconciliation* tool for a static bulk export, not as an ongoing dual-source sync — extending the mental model to "streams also come from two sources, one static and one live" isn't automatic.

**How to avoid:**
Treat stream provenance as its own explicit, versioned index (following the existing `data/provenance.json` pattern: `generated_at`, coverage counts, and an explicit list of activities without stream coverage) rather than assuming "provenance implies streams." Any dashboard detail view or best-effort computation must handle "no stream available" as a first-class, tested state (not an exception path), given it's a real, already-quantified ~1-2% of the archive (24+ of 1,866). Re-run and diff `consolidate-exports`' summary counts after any future export drop (the pending Garmin export, or any repeat Strava export) rather than assuming a single historical run is final.

**Warning signs:**
Dashboard detail views 500ing/blank-screening on the ~24 activities without an original recording; best-effort/PR counts that don't reconcile between a "computed from streams" count and the archive's total run count; stream files whose count doesn't match `provenance.json`'s "linked to an original" count after a rebuild.

**Phase to address:** Stream ingestion phase (provenance/coverage handling), verified again at dashboard SPA phase (empty-state UI).

---

### Pitfall 11: Treadmill/manual/GPS-less activities silently excluded from best efforts and maps

**What goes wrong:**
Best-effort computation and route/map features both implicitly assume GPS-derived position and distance exist. Treadmill runs (real distance from a footpod/accelerometer or manually entered, `positionLat`/`positionLong` absent for the whole activity) and fully manual entries (`manual: true` in the Strava schema, no stream at all — visible already as a boolean field on `StravaActivity`) will have no map, but *can* still have a valid distance/time for best efforts, or may have neither. If the best-effort code assumes "has streams" implies "has GPS," it either crashes on these activities or, worse, silently drops them from PR consideration — meaning a legitimate treadmill 5K PR never surfaces, which is a correctness bug, not just a missing-feature gap.

**Why it happens:**
GPS-based route work (already the majority of this codebase's map features) makes it easy to conflate "activity has a distance stream" with "activity has a position stream" — they're independent properties, and running-specific: a treadmill run has (chip/footpod) distance without position, GPS dropout under tree cover can have position without reliable distance in that segment, and a fully manual entry may have neither.

**How to avoid:**
Design the stream schema so distance-time and position-time are independent, optionally-present series per activity, and gate features on the specific series they need (best efforts require `distance` + `time`; route maps require `lat/lng`) rather than a single "has streams" flag. Explicitly test the best-effort path against at least one activity known to have no GPS.

**Warning signs:**
Manual/treadmill activities (`type: 'Run'`, `manual: true`, or zero-length `map.summary_polyline`) missing from PR lists despite plausible pace/distance; a `total_activities` vs. `activities_with_best_efforts` count that's suspiciously lower than `activities_with_streams`.

**Phase to address:** Stream ingestion phase (schema design) and best-effort computation phase (feature gating).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Committing full-resolution stream JSON to `data/` like other derived files | Fast to build, reuses existing pipeline pattern | Repo bloat trajectory already visible in `git count-objects`; eventual GitHub soft-limit warning; slower `checkout`/`npm ci` in every CI run forever | Never for full resolution — acceptable only for a heavily decimated (e.g. ≤300-point) form |
| Recomputing distance from raw lat/lng instead of the FIT `distance` field | One code path for FIT and GPX | Noisy, non-monotonic distance breaks best-effort correctness, especially at short target distances | Only for GPX-sourced activities where no alternative exists, with outlier filtering and lower-confidence labeling |
| Treating "has streams" as one flag instead of independent series presence | Simpler schema, fewer edge cases to write at first | Silently drops treadmill/manual PRs, crashes on partial-coverage activities | Never — running domain has too many legitimate GPS-less cases |
| Skipping timestamp-based duration and using array-index deltas | Simpler sliding-window code | Wrong best-effort times across any paused/auto-lap activity — silent, not a crash | Never |
| One shared "stream" ingestion path for both FIT/GPX backfill and intervals.icu incremental without a normalization/probe step | Faster to ship the first version | Unit mismatches (cadence, and potentially others) create a visible discontinuity at the migration boundary | Never — this project already has one such quirk (`data`/`data2` latlng) confirmed the hard way; assume more exist until probed |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Garmin FIT SDK (`@garmin/fitsdk`) decoding | Treating any numeric `positionLat`/`positionLong`/other field as valid without checking FIT sentinel/invalid values | Bounds-check decoded values (±90/±180 for position after semicircle conversion) and treat max-sentinel values as missing, per field type |
| FIT running cadence | Reading `cadence` directly as steps-per-minute | `displayed_spm = 2 * (cadence + fractional_cadence)` — apply the doubling + fractional correction for every FIT-sourced running activity |
| intervals.icu streams API (going forward) | Assuming field names/units match Strava/FIT conventions by analogy | Run a probe against a live payload (extending the existing `probe-intervals` pattern) before trusting any new stream field's units, especially cadence |
| Strava bulk export GPX files | Assuming all GPX have the same extension namespace/prefix for HR/cadence extensions as the currently-implemented lat/lon-only regex parser | Verify prefix (`gpxtpx:`, `ns3:`, etc.) against a real sample from this export before extending the regex parser to pull elevation/HR/cadence; don't assume uniformity across the 306 GPX files, which may span multiple recording app/versions |
| GitHub Pages static hosting | Assuming server-side routing/rewrite exists for the SPA, or that absolute asset paths work under a repo subpath | Hash-based routing (or `404.html` redirect trick) + explicit base-path config verified against a production build, not dev server |
| `gh-pages` deploy (`peaceiris/actions-gh-pages`) | Assuming `dist/widgets`-style deploy scales unchanged to dashboard-sized asset volume without checking total deploy size/time | Monitor deploy size explicitly once stream/derived JSON is added to `dist/`; keep raw streams out of the deploy artifact if they're not needed client-side beyond the active detail view |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| O(n²) best-effort search | CI job duration climbing superlinearly as archive grows | Two-pointer sweep exploiting monotonic distance | Already too slow at ~1,850 activities × 7 distances × ~1Hz streams; will likely blow the 30-min CI timeout |
| Full-resolution streams committed to git | `.git` size and `checkout` time growing every backfill/incremental run | Decimate before writing; keep raw streams out of git entirely (regenerate from `export_data/`/API) | Already visible at MB-per-commit scale with heatmap-only data (13MB/version); streams will be materially larger per activity |
| Loading all activity summaries+streams into one client bundle | Slow initial dashboard load, browser memory pressure, especially mobile | Split summary (small, whole-archive) vs. stream (large, on-demand per activity) payloads | Real risk starting in the low hundreds of activities with mobile browsers; guaranteed problem at ~2,000 if streams are included in the bulk payload |
| Reprocessing the entire archive's streams on every CI run instead of incrementally | Daily CI runtime grows even though only ~1 new activity/day is added | Cache/skip already-computed best-efforts per activity keyed by a content hash or `generated_at`, matching the ">90% cache hit rate" pattern already proven for the geocoding cache | Becomes noticeable once per-activity stream processing exceeds ~10-20ms amortized across ~1,850 activities |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Assuming `export_data/` (gitignored, 123MB, full-resolution GPS+HR) stays out of the public repo forever by convention alone | A future contributor or automation change accidentally commits raw export data (precise home/work GPS traces) to a public repo | Keep the existing `.gitignore` entry authoritative; add a CI guard (e.g., a pre-deploy check that fails if `export_data/` is ever staged) rather than relying on gitignore alone |
| Publishing per-activity streams (with precise start/end GPS) to the public `gh-pages` dashboard without the same privacy consideration already applied elsewhere (e.g., no street-level geocoding, city-level only per `PROJECT.md`) | Precise home-location leakage via activity start/end coordinates in stream JSON, even if summary/geo data is already deliberately coarse | Apply the same privacy posture to stream data as already applied to geocoding — consider truncating/masking the first/last N seconds of position data in any publicly deployed stream JSON, consistent with the existing "street-level geocoding... poor accuracy at finer granularity" out-of-scope decision |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Presenting GPS-watch best efforts (esp. sub-1k) with the same precision/confidence as track-verified records | User trusts a "400m PR" that's actually GPS noise | Label short GPS-derived best efforts as estimated, or set a minimum-distance floor (e.g., 1k) for "PR" framing, with sub-1k shown as informational only |
| No empty/loading state for the ~24 archive activities without any original recording | Dashboard detail view blank-screens or errors for a small but real slice of the archive | Explicit "no detailed data available for this activity" state, tested against the known `archive_without_original` list |
| Dashboard silently serving stale cached JSON after a rebuild | User sees yesterday's stats and assumes a pipeline failure | Version-check fetched data against a `generated_at` field and prompt/force-refresh on mismatch |

## "Looks Done But Isn't" Checklist

- [ ] **FIT stream parsing:** Often missing sentinel/invalid-value guards per field (not just position) — verify against at least one activity with a known GPS dropout or indoor segment.
- [ ] **Best-effort computation:** Often missing timestamp-based (not index-based) duration and target-distance interpolation — verify against a known paused activity and against Strava's own displayed best efforts for a handful of activities as a sanity cross-check.
- [ ] **Stream storage:** Often missing an explicit decimation/exclusion decision before the first commit — verify `git count-objects -vH` before and after the first full backfill to confirm the growth is bounded, not open-ended.
- [ ] **Dashboard SPA on GitHub Pages:** Often missing correct base-path config and hash routing (or 404.html fallback) — verify with a production build served under the actual repo subpath, not just the dev server.
- [ ] **Backfill/incremental parity:** Often missing a shared normalization/probe step between bulk FIT/GPX parsing and intervals.icu streams — verify cadence (and other units) against a real intervals.icu payload before trusting it, per the existing `probe-intervals` pattern.
- [ ] **GPS-less activities:** Often missing explicit handling in both best-effort and map code paths — verify against at least one treadmill/manual activity end-to-end.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Full-resolution streams already committed and repo bloated | HIGH | Requires history rewrite (`git filter-repo`/BFG) to remove the blobs from history, force-push, and coordinate with any collaborators/CI caches — expensive; strongly prefer prevention |
| Cadence unit mismatch discovered after both backfill and months of incremental data exist | MEDIUM | One-time normalization pass over already-ingested incremental data (multiply/divide by 2 as needed) with a version flag in the stream schema so future ingestion doesn't need reinterpretation |
| Best-effort algorithm found to be biased (non-interpolated) after PRs already displayed to the user | LOW-MEDIUM | Recompute is cheap once the algorithm is fixed (pure function over already-stored streams); just needs a full regeneration run, no data loss |
| GPS-derived distance found to be unreliable for short best efforts after shipping | LOW | Add a minimum-distance floor or confidence label; no data migration needed, just a display-layer change |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Recomputed vs. native distance for best efforts | Stream ingestion / best-effort computation | Best efforts for a sample of FIT-sourced activities match (within a few seconds) what Strava/Garmin already computed for the same activity |
| O(n²) best-effort search | Best-effort computation | CI step timing stays near-linear as more activities are added; full-archive recompute completes well under the 30-min CI timeout |
| Pause/timer gaps inflating or hiding times | Best-effort computation | Unit test against a synthetic stream with an injected pause gap; cross-check against `max_speed` plausibility guard |
| FIT sentinel/invalid values | Stream ingestion (parser hardening) | Bounds-check test against a known GPS-dropout activity; no ±180°/±90°-adjacent points in any decoded stream |
| Cadence unit mismatch (FIT vs. intervals.icu) | Stream ingestion (schema normalization) | `probe-intervals`-style diff run before trusting incremental cadence; no visible step-change in cadence trend charts at the migration date boundary |
| Git repo bloat from committed streams | Stream ingestion (storage strategy) — decide before any phase writes stream files | `git count-objects -vH` growth stays bounded after first full backfill; repo stays comfortably under GitHub's ~1GB soft-limit guidance |
| Browser memory from loading all streams at once | Dashboard SPA shell (data-loading architecture) | Summary payload size stays roughly flat regardless of archive growth; stream fetches are scoped to the single open detail view |
| Client-side routing 404s / base path | Dashboard SPA shell | Direct link and hard refresh to a deep dashboard route succeed against a production build served from the actual GitHub Pages subpath |
| Stale cached JSON after rebuilds | Dashboard SPA shell or CI/deploy integration | Data fetch includes a version/`generated_at` check; a forced rebuild-then-revisit shows the new data without a manual hard refresh |
| Backfill/incremental divergence, provenance gaps | Stream ingestion (provenance/coverage handling) | Stream coverage count reconciles against `provenance.json`'s "linked to an original" count; explicit empty state tested for `archive_without_original` activities |
| GPS-less (treadmill/manual) activities dropped | Stream ingestion (schema) + best-effort computation (feature gating) | At least one manual/treadmill-style activity has a valid best-effort/PR entry with no map, end-to-end |

## Sources

- This repository: `.planning/PROJECT.md`, `src/exports/geometry-readers.ts`, `src/exports/consolidate.ts`, `src/api/intervals-provider.ts`, `data/provenance.json`, `.github/workflows/daily-refresh.yml`, `git count-objects -vH` and `git rev-list --objects` output (direct measurement of existing repo-bloat pattern from `data/heatmap/all-points.json`)
- User memory: `intervals-icu-migration.md` (data2 stream quirk, start_date epoch dedupe, provenance/export details, FIT semicircle constant already verified in this codebase)
- [Repository limits - GitHub Docs](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits) — ~1GB soft warning threshold
- [GitHub repos appear to have a "soft" size limit of about 1GB - Hacker News](https://news.ycombinator.com/item?id=37082992)
- [Running Cadence in Garmin FIT use "fractional_cadence" with float · GoldenCheetah/GoldenCheetah#2060](https://github.com/GoldenCheetah/GoldenCheetah/issues/2060) — half-cadence + fractional_cadence convention
- [Fractional Cadence values - FIT SDK - Garmin Forums](https://forums.garmin.com/developer/fit-sdk/f/discussion/288454/fractional-cadence-values)
- [Cadence: Steps Per Minute (SPM) - Intervals.icu Forum](https://forum.intervals.icu/t/cadence-steps-per-minute-spm/117617) — evidence of real ambiguity in intervals.icu cadence units, MEDIUM confidence, verify empirically
- [Compressed Speed Distance - FIT SDK - Garmin Forums](https://forums.garmin.com/developer/fit-sdk/f/discussion/260085/compressed-speed-distance) — FIT `compressed_speed_distance` 12+12 bit packing (relevant if extending beyond the standard `speed`/`distance` fields already used)
- [GitHub Pages does not support routing for single page apps · community #64096](https://github.com/orgs/community/discussions/64096)
- [S(GH)PA: The Single-Page App Hack For GitHub Pages — Smashing Magazine](https://www.smashingmagazine.com/2016/08/sghpa-single-page-app-hack-github-pages/) — 404.html redirect trick, alternative to hash routing

---
*Pitfalls research for: Training dashboard (FIT/GPX stream ingestion, best-effort computation, dashboard SPA) added to an existing static Strava-widgets pipeline*
*Researched: 2026-08-10*
