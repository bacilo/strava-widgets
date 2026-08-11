# Phase 17: Activity Browser & Detail Views - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the two real views the Phase 16 shell left as stubs and a proving slice. Concretely:

1. **Browser** — the `#/list` view becomes a paginated, sortable, filterable, text-searchable browser over all 1,867 index rows, with removable filter chips and a live result count (BROWSE-01..04, BROWSE-06).
2. **Calendar** — the `#/calendar` stub becomes a real month-grid training log (BROWSE-05).
3. **Detail** — the `#/activity/:id` proving slice grows into a full detail page: stats header, route map, pace/HR/cadence/elevation charts, per-km splits table, and a pace-distribution/zone breakdown, all degrading cleanly when a channel is absent (DETAIL-01..05).

**Not in scope:** records/PR presentation and trends (`#/records`, `#/trends` stay Phase 18 stubs), any change to the index-manifest or stream contracts, any new per-activity pipeline output, and the year-over-time heatmap (deferred to Phase 18).

</domain>

<decisions>
## Implementation Decisions

### Activity list — layout and sorting
- **D-01:** **Sortable table on desktop, existing card rows on mobile.** A real `<table>` with clickable column headers above roughly 700px; below that the view falls back to Phase 16's `renderActivityRow` card layout. Sortable columns are the right affordance for five sort keys; cards stay readable on a phone.
- **D-02:** **Desktop columns: date, name, distance, moving time, pace, avg HR** — every BROWSE-02 sort key is visible and clickable — **plus the existing badges inline** (no streams / no HR / low confidence / excluded from records / PR count). Elevation and location stay on the detail page.
- **D-03:** **Sort by clicking column headers.** Second click flips direction; the active column shows a direction arrow and carries `aria-sort`. Mobile card mode gets a compact sort dropdown as the equivalent control.
- **D-04:** **Two row renderers, each with one job.** `renderActivityRow` stays the shared card renderer used by the overview's recent-activities and by the list's mobile mode; the table row builder is list-only. The overview does NOT become a mini table. No date/pace formatter may be duplicated in either (16-12 rule: one `formatActivityDate`, one `formatPace`).

### Activity list — scale and pagination
- **D-05:** **Numbered pagination**, not infinite scroll and not a virtualizer. BROWSE-01 says paginated; a bounded DOM keeps re-render cost trivial and avoids scroll-restoration complexity. Changing sort or filters resets to page 1.
- **D-06:** **50 rows per page** (~38 pages over the archive). Phase 16's newest-100 truncation notice is a placeholder and must be removed.
- **D-07:** **Full list state lives in the hash query string** — sort key, direction, page, and every active filter (e.g. `#/list?sort=pace&dir=asc&page=3&dmin=10`). The router already parses query params (16-D02), so browser back/forward and shareable/bookmarkable views come for free.
- **D-08:** **Return-from-detail restores position.** Coming back to the list restores page and sort from the URL and scrolls the just-viewed activity's row into view with a brief highlight — no separate session storage needed, since the state is in the URL.

### Activity list — filters and search
- **D-09:** **Always-visible search box and chips row; range filters behind a collapsible "Filters" panel.** Keeps the default view clean for the common case (find by name, or scan recent) with ranges one click away. No new shell layout — nothing like a sidebar rail.
- **D-10:** **Range entry is presets plus numeric min/max.** Quick chips for the common cases (5k, 10k, HM+, marathon+; This year, Last 12 months) alongside plain min/max inputs for date, distance, pace, and duration. No dual-thumb sliders. Both forms must serialize cleanly into the query string (D-07).
- **D-11:** **AND semantics with a live, debounced result count.** All active filters narrow together; the count updates as you type (~150–250ms debounce on text, immediate on chips/presets). The whole index is already in memory, so filtering is a local array pass — no refetch.
- **D-12:** **One removable chip per active filter, plus Clear all at two or more.** Each chip names its constraint ("10–25 km ×", "2024 ×", "name: hills ×"). Zero matches renders a proper empty state that names the active filters and offers a one-click clear — never a blank table.

### Calendar training log
- **D-13:** **Month grid with prev/next navigation, a month/year jump, and a month-total header** (distance + run count). Bookmarkable as `#/calendar?month=YYYY-MM`. Not a year heatmap, not continuously scrolling months.
- **D-14:** **Day cell shows the day's total km as text, with the cell tinted by distance** using the existing orange accent scale. Rest days render a plain dash. Distance must be readable without hovering (there is no hover on mobile).
- **D-15:** **Multi-run days show the day total plus a run-count marker** (e.g. "×2"); clicking a multi-run day opens a compact per-run picker, while a single-run day navigates straight to its detail view. Keeps day totals honest and the grid rhythm uniform.
- **D-16:** **The calendar is never filtered.** It keeps state fully independent of the list's filters — a filtered month grid would show gaps that read as missed training. Separate URL contract, no shared filter state.

### Detail — charts
- **D-17:** **Stacked per-channel bands on one shared x-axis:** pace, HR, cadence, elevation, each its own short chart, vertically aligned. Each keeps its own readable y-scale, and an absent channel simply omits its band rather than breaking a shared axis.
- **D-18:** **Each band takes up to two optional shaded companion overlays, chosen per band.** Independent per-chart checkbox pickers (not one global control), so e.g. HR can shade behind pace while elevation shades behind cadence at the same time. Capped at two companions per band for legibility.
- **D-19:** **Overlays render on their own auto-scaled but undrawn y-axis**, as a low-opacity filled area behind the full-contrast primary line. No competing right-hand tick labels; the tooltip reports the overlay's true value with units, so hiding the axis loses nothing. Overlays are never normalized to a percentage.
- **D-20:** **Overlay configuration persists in localStorage**, so a habitual pairing survives across activities and sessions — same persistence approach as the existing theme choice. Not in the URL (keeps detail links about the activity).
- **D-21:** **X-axis is distance by default, with a toggle to elapsed time.** Both series come straight from the stream's `t` and `d` arrays, so the toggle is cheap. Distance-by-default also keeps charts aligned with the splits table.
- **D-22:** **Pace is smoothed for presentation only, then decimated.** A rolling window (~15–30s) tames 1 Hz Δd/Δt spikiness before plotting, and Chart.js's LTTB decimation plugin caps drawn points (the Phase 14 decision). Raw values still drive the splits table and stats — smoothed values are never persisted and never feed a computation.

### Detail — route map
- **D-23:** **The polyline comes from the activity's own detail JSON** (`data/activities/<id>.json` → `map.summary_polyline`), which the detail view already fetches. Zero extra requests, zero extra bytes. Do NOT fetch `data/routes/route-list.json` (2.4 MB for one route, and missing ~28 activities), and do NOT add a new per-activity route pipeline output.
- **D-24:** **A dashboard-native map module that imports the shared `RouteRenderer`/`route-utils` helpers directly.** The `<single-run-map>` custom element is not embedded: it is Shadow-DOM-encapsulated (against 16-D04's light DOM), owns its own route-list fetch, and has no input path for a caller-supplied polyline. Share the rendering logic, not the widget lifecycle.
- **D-25:** **Leaflet and Chart.js load via lazy dynamic import on first detail-view open** — not a CDN script tag in the dashboard HTML, not statically bundled into the SPA entry. List, calendar, and overview never pay for them, preserving Phase 16's fast first paint.
- **D-26:** **Hover syncs a crosshair across every band and a position marker on the route map.** Hovering any band shows a shared vertical crosshair and tooltip at the same x across all bands, plus a marker at the corresponding route point. **Known limit, to be represented honestly:** committed streams carry no lat/lng by design (Phase 14), so the map position is interpolated by cumulative distance along the simplified `summary_polyline` — approximate, not survey-exact.

### Detail — splits, zones, and the stats header
- **D-27:** **Seven-column splits table:** km, pace, cumulative elapsed time, avg HR, avg cadence, elevation Δ, and a horizontal bar showing the split against the activity's average pace. Columns for absent channels render an em dash (BROWSE-06's clean-missing-data rule). **Planning must solve the responsive story** — seven columns will not fit a phone; column collapse or horizontal scroll within its own container is required, and the page body must never scroll horizontally.
- **D-28:** **The final partial kilometre is shown, labelled with its real distance** (e.g. "0.4 km") and visually marked as partial, so the splits sum to the actual activity distance and a short segment's pace can't be misread as a full split.
- **D-29:** **Both breakdowns, with different availability rules.** A pace-distribution histogram (time spent per pace bucket) always renders — it needs no configuration and works for every streamed activity. An HR-zone time breakdown renders additionally when threshold config exists and the activity has HR.
- **D-30:** **HR zones come from a committed athlete config file** (e.g. `data/athlete.json`) holding max HR plus explicit bpm boundaries between the five zones — not derived from the archive's observed max (one strap spike would set zones for a decade) and not relative to each activity's own peak (incomparable between runs). Explicit bpm boundaries keep whatever convention the athlete actually trains to out of the code. Phase 18's TRIMP training load will read the same file, so this is shared foundation, not phase scaffolding.
- **D-31:** **Missing config or missing HR hides the zone panel entirely**, while the pace histogram carries DETAIL-05 on its own. No placeholder box, no fabricated zones — the phase's success criteria are met with or without the file. Filling in the real values is not a prerequisite for the phase to pass.
- **D-32:** **Gear resolves through a hand-written `data/gear.json` id→name map.** Only 16 distinct `gear_id` values exist across 1,808 activities, and Strava's "My Gear" page is still readable in a browser despite the API paywall — so a small committed mapping genuinely satisfies DETAIL-01 and hands Phase 18's gear-aware trends a ready map. Unmapped ids must fall back gracefully rather than rendering a raw `g16649854`.
- **D-33:** **When gear is unknown, fall back to `device_name` if present, otherwise omit the tile.** 708 activities carry no `gear_id` and no intervals.icu-era activity has one; `device_name` is committed for 1,808 Strava-era records and is genuinely useful. Never render an empty-labelled tile.

### Claude's Discretion
- Detail-page section order and the exact stats-header tile set (DETAIL-01 names distance, time, pace, elevation, avg/max HR, cadence, gear — arrangement and grouping are open).
- Text-search matching semantics (case-insensitive substring vs token matching; whether `location` is searched alongside `name`). Whatever is chosen, athlete-authored `name` is untrusted and must be rendered with `textContent` (T-16-VW-01).
- Exact rolling-window size, decimation thresholds, and pace-bucket widths for the histogram.
- Prev/next activity navigation from within a detail view, and keyboard navigation for the table and calendar grid.
- Whether the collapsible filter panel's open/closed state persists, and its exact breakpoint (alongside the ~700px table/card switch).
- Concrete schema and file names for `data/athlete.json` and `data/gear.json` — follow existing `data/` conventions (schemaVersion, generated_at/note where applicable) and decide whether they are committed hand-maintained inputs (they should be) versus generated output.
- How the splits table collapses on narrow screens (which columns drop first).
- Module decomposition: how much of filter/sort/paginate logic is pure and unit-tested separately from DOM rendering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data contracts this phase consumes (read-only — do not change)
- `src/analytics/dashboard-index.types.ts` — the browse-complete index row contract; every sort/filter field in BROWSE-02/03 is already a field here. Also documents the "public artifact" rule (no athlete/upload/external/gear ids, no privacy flags in the index).
- `src/streams/stream.types.ts` — locked committed stream schema (`t`, `d`, optional `hr`/`cadence`/`alt`; no `pace`, no lat/lng — both deliberately excluded). Source of D-22's derive-pace and D-26's no-lat/lng limitation.
- `data/streams/manifest.json` — per-activity availability and unavailable reason codes behind the list badges and the detail view's missing-data states.
- `src/analytics/best-effort.types.ts` — best-effort output types; `excludedFromRecords` and PR counts already surface as index badges.

### Prior locked decisions (do not re-litigate)
- `.planning/phases/16-dashboard-shell-data-contract/16-CONTEXT.md` — D-01..D-14: vanilla TS, view registry, param+query router, light DOM, index/lazy-detail split, theming.
- `.planning/phases/14-stream-ingestion-foundation/14-CONTEXT.md` — stream storage decisions, client-side decimation, cadence-unit handling in exactly one place.
- `.planning/phases/15-best-effort-engine/15-CONTEXT.md` — best-effort output contract: read it, never recompute.

### Code this phase extends or must not regress
- `src/dashboard/views/list.ts` — the view being replaced; **read the header comments before editing.** Holds the single `formatActivityDate` and `formatPace` (both carry hard-won correctness notes: the Z-suffix timezone rule from WR-02 and the single-rounding-step m:ss rule that affected 11 rows). Do not duplicate either.
- `src/dashboard/views/detail.ts` — the proving-slice detail view being grown; carries the stale-render guard and error/retry patterns to preserve.
- `src/dashboard/router.ts` — `parseHash`, param matching, `navigateTo`, and `isValidActivityId` (`/^i?\d{1,20}$/` — the widened chokepoint from 16-10; intervals.icu ids are `i`-prefixed).
- `src/dashboard/view.types.ts` — `ROUTES`, `NAV_ORDER`, `STUB_PHASE`; the calendar entry must move out of `STUB_PHASE` when it ships.
- `src/dashboard/views/calendar.stub.ts` — the stub being replaced.
- `src/widgets/shared/route-utils.ts` — `RouteData`, `RouteRenderOptions`, `RouteRenderer` (render, bounds-fit, hover); the shared map logic D-24 reuses.
- `src/widget/chart-config.ts`, `src/widgets/comparison-chart/chart-config.ts`, `src/widgets/streak-widget/chart-config.ts` — existing Chart.js 4.5 configuration conventions and theming.
- `scripts/build-widgets.mjs` (`copyDataFiles`, ~line 134) — the publish-dir data copy list; any new committed input (`data/athlete.json`, `data/gear.json`) must be copied to the publish dir or it will 404 in production.
- `scripts/verify-dashboard-publish.mjs` — the publish-contract HTTP gate; it mounts under `/strava-widgets` and hard-fails on root-absolute asset URLs. Extend it rather than working around it.
- `.github/workflows/daily-refresh.yml` — the blocking `npm test` + `npm run verify-dashboard` exit gate added in 16-13. Both must stay green.

### Hard-won lessons that constrain this phase
- `.planning/STATE.md` § Blockers/Concerns — the Phase 16 black-page failure: root-absolute asset URLs break under a Pages *project* path, and the phase's own verifier reported 15/15 green on the broken build because it asserted a local shape production does not have. Any new verification must assert the production shape.
- `.planning/phases/16-dashboard-shell-data-contract/16-VERIFICATION.md` — the warnings this phase must not reintroduce: timezone-incorrect dates (WR-02/03), stale-render races on fast navigation (WR-01), silently non-load-bearing checks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderActivityRow` (`src/dashboard/views/list.ts`): the card row for the overview and the list's mobile mode (D-01/D-04) — already renders every badge this phase needs.
- `formatActivityDate` / `formatPace` (`src/dashboard/views/list.ts`): the only date and pace formatters in the dashboard; both carry defect-driven comments. Reuse, never fork.
- `RouteRenderer` + `RouteData` (`src/widgets/shared/route-utils.ts`): polyline rendering, bounds-fitting, hover — reused directly by the detail map module (D-24).
- `@mapbox/polyline` (dependency): decodes `map.summary_polyline` from the activity JSON (D-23).
- `chart.js@4.5` and `leaflet@1.9.4` (dependencies): both already present, no new runtime deps needed. Chart.js ships the LTTB Decimation plugin used by D-22.
- Detail-client + index-client (`src/dashboard/data/`): the fetch-once index and lazy, id-validated detail fetch — already tested, already the contract.
- Error/loading/retry and stale-render-guard patterns in `detail.ts` and `list.ts`: the templates for every new async view.

### Established Patterns
- Vanilla TS + Vite, no framework, light DOM for dashboard views, Shadow DOM only for embeddable widgets (16-D01/D04).
- Views are self-contained registry modules (`{route, title, navEntry?, mount, unmount?}`); adding or replacing a view is one module plus one registry line (16-D03).
- Athlete free text is written with `textContent`, never an HTML-string assignment (T-16-VW-01, deviating deliberately from `route-browser`'s unescaped interpolation).
- Committed hand-maintained data and generated data are distinguished by gitignore: `data/stats/` and `data/dashboard/` are regenerated per run; `data/activities/`, `data/streams/`, `data/best-effort-exclusions.json` are committed. `data/athlete.json` and `data/gear.json` belong in the committed camp.
- Tests are vitest, colocated (`*.test.ts`); `npm test` is a blocking CI gate.

### Integration Points
- `view-registry.ts` — calendar moves from stub to real; list and detail modules are replaced in place.
- Publish pipeline — `copyDataFiles` in `scripts/build-widgets.mjs` must carry any new committed input file into `dist/widgets/data/`.
- `data/activities/<id>.json` field availability is **era-dependent**, and planning must handle both: Strava-era records carry `gear_id`, `average_cadence`, `device_name`, `location_city`, `elev_high/low`; intervals.icu-era records carry only the core set (id, name, type, dates, distance, times, elevation gain, speeds, HR, latlng, map, source_provider). Roughly 1,111 of 1,868 activities have `average_cadence`; 1,808 have `gear_id` (708 do not); 1,843 of 1,867 have streams.

</code_context>

<specifics>
## Specific Ideas

- **The overlay feature is the user's own design, stated verbatim:** "I would like to be able to overlay them (so I can see the HR together with … cadence (one is the primary and the others would be shaded behind). Perhaps we could have them stacked in the way you suggest but then each of them would allow us to select (optional) one of the others to shade behind it? Like a multi-check kind of thing." D-17..D-20 are the concrete form of that request — the shading-behind, per-band, multi-check character is the point, not incidental.
- The user explicitly wants a heatmap over time "somewhere as well", while confirming the month grid is the Phase 17 priority. See Deferred Ideas — it is wanted, not rejected.
- Phase 16's newest-100 truncation notice in the list view was always a placeholder for this phase's pagination; removing it is part of the work.

</specifics>

<deferred>
## Deferred Ideas

- **Year-over-time consistency heatmap** (GitHub-style 53×7 year grid colored by distance) — user wants this, routed to **Phase 18 (Records, Trends & Differentiators)** where it sits beside streaks and volume evolution. Not a `#/calendar?mode=year` toggle in this phase.
- **Gear as an index field / gear filtering in the browser** — `data/gear.json` lands here for the detail header only. Putting gear into the published index (to filter or group the list by shoe) is Phase 18's gear-aware-trends territory, and would also need a fresh look at the index's "no gear ids in a public artifact" rule.
- **Pace/speed color coding along the route polyline** — already in PROJECT.md's future-vision list; the detail map ships as a plain route with a hover marker.
- **Native device-recorded laps table with a splits/laps toggle** — already tracked as DETAIL-06 in REQUIREMENTS.md's deferred set (needs FIT lap-marker recovery). D-27's splits are auto-computed from streams only.

### Reviewed Todos (not folded)
- **Manual exclusion of activities from best-effort/PR calculations** (`.planning/todos/pending/2026-08-10-manual-exclusion-of-activities-from-best-efforts.md`, score 0.60) — **not folded: already implemented.** Phase 16 plan 16-01 shipped `data/best-effort-exclusions.json`, `src/analytics/best-effort-exclusions.ts`, and the index's `excludedFromRecords` field, which this phase's list already badges. Nothing remains for Phase 17; any PR-list/override *UI* belongs to Phase 18. **The todo file should be moved to `.planning/todos/completed/`.**
- **Garmin export adapter when export arrives** (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`, score 0.40) — **not folded, deferred again.** `export_data/` still contains only `strava/`; the todo's own notes require probing the real export structure before coding (the repeated project lesson from the intervals.icu latlng stream). Re-fold into whichever phase is active when the export lands.

</deferred>

---

*Phase: 17-activity-browser-detail-views*
*Context gathered: 2026-08-11*
