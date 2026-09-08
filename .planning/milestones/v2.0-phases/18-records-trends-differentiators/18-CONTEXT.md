# Phase 18: Records, Trends & Differentiators - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the last two stub views the Phase 16 shell left behind — `#/records` and `#/trends` — plus the derived data they need. Concretely:

1. **Records** (`#/records`) — all-time PR lists per distance, PR evolution over the years, age-graded percentages, Riegel race-time predictions, and the volume/streak *superlatives* (biggest week, biggest month, longest/current streak). REC-02, REC-03, REC-05 (superlatives half), REC-06, REC-07.
2. **Detail-view PR presentation** — named per-distance PR badges in the stats header plus a best-efforts panel. REC-04's list and overview badges **already ship** (`src/dashboard/views/list.ts:130`, `src/dashboard/views/overview.ts:95`); only the detail side is new.
3. **Trends** (`#/trends`) — five tabs: volume trends (with the year consistency heatmap), year-over-year, cadence/HR trends, TRIMP training load, and gear-aware breakdowns. Plus a rolling-totals header strip (this week / month / year to date). TREND-01..05, REC-05 (totals half).
4. **Supporting pipeline** — new build-time compute steps for training load and age-grading, a resolved gear-name field in the dashboard index, and extended `data/config/athlete.json` fields.

**Not in scope:** any change to the stream contract or the best-effort engine's algorithm (Phase 14/15 are locked — read `data/stats/best-efforts.json`, never recompute); rework of the list, calendar, or detail views beyond adding the PR badge and best-efforts panel; teaching the intervals.icu adapter to carry `gear_id` (see Deferred); the Garmin export adapter.

</domain>

<decisions>
## Implementation Decisions

### Page composition and routing
- **D-01:** **Superlatives on Records, rolling totals on Trends.** REC-05 splits by what each number is *for*: the record-shaped items (biggest week, biggest month, longest streak, current streak) sit next to the PR tables on Records; the rolling totals (this week / this month / this year to date) become a header strip above the Trends charts. Not split by data source — both halves read the same `data/stats/` files.
- **D-02:** **Records scrolls, Trends is tabbed.** `#/records` is a single scrolling page with anchored sections and a **sticky in-page jump list**; the jump list is load-bearing, not decorative, because D-04 and D-06 together make this page long (70 PR rows + a seven-chart grid + predictions + superlatives). `#/trends` uses URL-encoded sub-tabs (`#/trends?tab=volume`) per 17-D07, so tabs are bookmarkable and back/forward works, and each tab's charts only build when opened (pairs with 17-D25's lazy Chart.js import).
- **D-03:** **Trends has five tabs, each owning its own controls.** Volume / Year-over-year / Cadence & HR / Training load / Gear. No shared global date-range control — volume gets a weekly/monthly/yearly granularity toggle, training load gets its own date window, gear needs neither. Rejected a single shared range control: it would force every chart to handle windows it has no data for.
- **D-04:** **The year consistency heatmap lives in the Volume tab.** The GitHub-style 53×7 grid coloured by distance (deferred here from Phase 17) sits beside the volume charts it visualizes. Not its own tab, not on the calendar view.

### PR lists and evolution
- **D-05:** **Seven top-10 tables, all visible.** One table per target distance (400m, 1k, 1mi, 5k, 10k, half, marathon), each showing its full top-10 from `rankings` — no expand-on-click. `rankings.marathon` is currently **empty (zero entries)**; that table must render a proper empty state, not a blank block or a crash.
- **D-06:** **PR evolution is a small-multiples grid.** Seven compact step charts (x = date, y = time, stepping down each time the record fell), so the whole evolution story is visible without interaction. Each chart's progression table (date, new time, improvement over previous, link to the run) expands underneath on click. Data is the `wasPRAtTheTime` flag already computed in Phase 15 — **6–21 steps per distance, 78 total**, which is a well-sized step chart. Planning must account for seven live Chart.js instances on one page alongside D-05's tables.
- **D-07:** **Low-confidence and excluded efforts are badged in place, never hidden.** Low-confidence rows (GPS-reconstructed distance, `lowConfidence: true`, 180 archive-wide) carry a marker with an explanatory tooltip; excluded activities are visibly marked with their `reason` string from `data/best-effort-exclusions.json`. Consistent with 15-D03's "nothing is silently excluded" and the list view's existing badge vocabulary. No hide-by-default toggle.
- **D-08:** **Detail view gets both a header badge and a panel.** Named per-distance badges in the stats header ("PR — 5k", "PR — 10k") rather than the list's `2 PR` count, plus a best-efforts panel further down listing every effort this run produced across all seven distances with the PR-setting rows highlighted. The panel gives every streamed run a reason to show it — showing the 5k split inside a 10k run even when it set no record — and is the natural home for D-10's age-grade column too.

### Age-grading and race predictions
- **D-09:** **Age-grade all seven distances, with 1k explicitly labelled derived.** 5k/10k/half/marathon use WMA road factors; 400m and the mile use WMA track factors; **1k has no WMA standard at all** and is interpolated between the 800m and mile track factors. The interpolated value must be visibly labelled as derived — never presented as a published WMA standard. Bundle the factor tables as committed JSON under `data/` following existing conventions.
- **D-10:** **Age-grade is a column in the top-10 tables; Riegel gets its own section.** Age-grade is a property of a specific effort, so it belongs inline beside time and pace — which lets a slower recent run visibly out-grade a faster old one. Riegel is a model output, so it gets its own anchored "Race Predictions" section on Records. Different kinds of number, different homes.
- **D-11:** **Riegel is a matrix at the standard 1.06, with a self-suppressing fitted exponent alongside.** Every PR predicts every longer distance in a grid, so the disagreement between eras is *visible information* rather than a hidden model choice. A secondary athlete-fitted exponent displays its own value and **names the distances it was fitted over**, and **suppresses itself entirely when the fitting set spans fewer than 3 distinct activities**. This guard is not optional — see the data findings below for exactly why.

### Athlete configuration
- **D-12:** **One extended `data/config/athlete.json`.** Add `birthDate`, `sex`, and `restingHr` alongside the existing `maxHr` and `hrZones` (17-D30). Each consumer validates only the fields it needs, so a missing `birthDate` disables age-grading without touching the HR-zone panel or training load. Rejected a separate profile file — 17-D30 already named this file as Phase 18's config source.
- **D-13:** **Missing or placeholder config hides the feature behind an actionable notice.** No `birthDate` → no age-grade column, no placeholder number, no fabricated value (the 17-D31 precedent). But unlike 17-D31's silent hiding, a small notice names the file and field to fill in — mirroring the actionable blocked-basemap notice from commit `c502537`. A dead-end feature is worse than one that tells you how to enable it. **The phase passes with the config unfilled**; filling in real values is the developer's action afterward, not a prerequisite.

### Training load (TREND-04)
- **D-14:** **Both TRIMP models, Edwards as default.** Edwards zone-based TRIMP (time-in-zone × zone weight 1–5) is the default — its only input is the five bpm boundaries already in `athlete.json`, it needs no resting HR or sex coefficient, and it is fully transparent (you can point at any run and see why its load is what it is), which matches REQUIREMENTS.md's Out-of-Scope stance against black-box proprietary scores. Banister exponential TRIMP is available via a toggle so the fitness/freshness picture can be checked for robustness against the model rather than being an artifact of it. Both computed per activity from the HR **stream**, not from `avgHr`.
- **D-15:** **No-HR runs contribute nothing and the gap is shown, never filled.** ~180 activities (10%) have no HR. They produce no TRIMP; CTL/ATL simply decay across those days. The chart **shades or annotates spans where HR coverage is thin**, so a dip reads as "no data" rather than "no training". Explicitly rejected: estimating load from pace/duration (mixes two units in one line), and truncating the chart to 2017+ (hides activities). **Nothing is deleted and nothing is invented** — the no-HR runs remain in every volume chart, every list, and every total.
- **D-16:** **Standard CTL/ATL exponential time constants** (42-day / 7-day) with TSB as their difference, over the full archive date span. Displayed window is Claude's discretion; the underlying series covers everything.

### Gear-aware trends (TREND-05)
- **D-17:** **Resolved gear *name* in the index, plus a precomputed aggregate for the charts.** Build time resolves `gear_id` through `data/config/gear.json` and writes the human name into each index row — **never the raw id**, which honors 16-D09's public-artifact rule as written while making gear a first-class field the activity browser can also filter and group by (settling the "gear as an index field" question Phase 17 deferred here, rather than leaving it for a third phase). Trends additionally reads a precomputed per-shoe aggregate (distance, runs, avg pace, avg HR, date range) so its charts don't re-reduce 1,867 rows on every tab open.
- **D-18:** **Explicit "Unknown" bucket with stated coverage.** Runs without gear group into a visible Unknown row rather than vanishing, and the section states its real coverage in plain numbers. Same principle as D-15: absence is shown, never filled in. This deliberately keeps the 2026 erosion visible instead of letting it silently hollow out the chart.
- **D-19:** **Gear names are currently all empty strings — the feature must work anyway.** All 16 entries in `data/config/gear.json` have `""` as their name. The code must build, run, and chart correctly against blank names (falling back gracefully rather than rendering a raw `g16649854`, per 17-D32/D33), with the developer filling in real names from Strava's My Gear page as a follow-up action. **Not a blocker for the phase gate.**

### Build-time vs client-side computation
- **D-20:** **Build steps for stream-dependent and identity-dependent work.** New `compute-*` CLI subcommands writing gitignored JSON to `data/stats/`, following the `compute-stats.ts` convention and wired into the `compute-all-stats` chain:
  - **Training load** — requires the 1,687 stream files (~142 MB); not a browser job under any circumstances.
  - **Age-grading** — its inputs are `birthDate` and `sex`. Precomputing means only the resulting percentages reach the published payload, keeping identity inputs out of the served artifact. Same discipline as 16-D09.
  - **Gear aggregate** — per D-17.
- **D-21:** **Client-side for everything derivable from what's already fetched.** The Riegel matrix (pure arithmetic over `best-efforts.json`, no personal inputs), volume rollups, the biggest-week/month superlatives (a `max()` over the already-generated `weekly-distance.json` / `monthly-stats.json`), and monthly cadence/HR means over the 1,867 in-memory index rows. Minimum new pipeline surface, fastest iteration on presentation.
- **D-22:** **Any new committed or generated data file must be added to `copyDataFiles` in `scripts/build-widgets.mjs`.** A file that isn't copied into the publish dir 404s in production — the Phase 17 canonical-refs warning applies unchanged to every new file this phase adds.

### Claude's Discretion
- Exact schema, field names, and file names for the new `data/stats/` outputs and the committed WMA factor tables — follow existing `data/stats/` conventions (`schemaVersion`, `generatedAt`, `note`).
- Which subset D-11's fitted exponent regresses over (rank-1 PRs only, best-per-distance-per-year, or the full top-10 set), provided the 3-distinct-activity guard holds and the chosen subset is named in the UI.
- Displayed default window for the training-load chart (D-16), and the exact visual treatment of thin-HR-coverage spans (shading vs annotation vs both).
- Records section order and the exact superlative tile set; Trends tab order beyond Volume being first.
- Pace-vs-time y-axis treatment on the D-06 step charts, and whether the small multiples share a y-scale (they cannot meaningfully — 44 s to 87 min).
- Empty and loading states for both new pages, and whether Trends charts adopt the detail view's hover-crosshair conventions (17-D26).
- Module decomposition: how much of the aggregation logic is pure and unit-tested separately from DOM rendering (the 17 precedent: `list-logic.ts` / `calendar-logic.ts` / `detail-charts-logic.ts` split).
- Whether the tabbed Trends view unmounts and disposes Chart.js instances on tab switch or keeps them alive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data contracts this phase consumes (read-only — do not change)
- `src/analytics/best-effort.types.ts` — the full best-effort output contract. `BestEffort.wasPRAtTheTime` drives D-06's evolution charts and D-08's badges; `excludedFromRecords` and `lowConfidence` drive D-07; `PRRankingEntry` / `rankings` drives D-05. `TARGET_ORDER` and `TARGET_METERS` are the canonical distance list and metres.
- `src/analytics/dashboard-index.types.ts` — the index row contract D-17 extends with a resolved gear name. **Read the header comment first**: it states the browse-complete invariant and the public-artifact rule (no athlete/upload/external/gear ids) that D-17 is deliberately threading rather than breaking.
- `src/streams/stream.types.ts` — the locked committed stream schema (`t`, `d`, optional `hr`/`cadence`/`alt`). The `hr` array is D-14's input; there is no `pace` and no lat/lng by design.
- `data/streams/manifest.json` — per-activity channel availability; the source of truth for D-15's HR-coverage determination.
- `data/config/athlete.json` — the file D-12 extends. Its `note` field already states that Phase 18's training load reads it.
- `data/config/gear.json` — the id→name map D-17 resolves through and D-19 must tolerate being blank.
- `data/best-effort-exclusions.json` — the `reason` strings D-07 surfaces.

### Prior locked decisions (do not re-litigate)
- `.planning/phases/17-activity-browser-detail-views/17-CONTEXT.md` — D-25 (lazy Chart.js/Leaflet dynamic import), D-07 (state in the hash query string), D-30/D-31 (athlete config, hide-on-missing), D-32/D-33 (gear map and fallback ladder), D-22 (smoothing is presentation-only, never persisted, never feeds a computation).
- `.planning/phases/16-dashboard-shell-data-contract/16-CONTEXT.md` — D-01 (vanilla TS), D-03 (view registry: one module + one registry line), D-04 (light DOM), D-09 (index field set and the public-artifact rule), D-13/D-14 (theming).
- `.planning/phases/15-best-effort-engine/15-CONTEXT.md` — D-03 (low-confidence efforts stay in contention, nothing silently excluded), D-06 (**read `best-efforts.json`, never recompute**).
- `.planning/phases/14-stream-ingestion-foundation/14-CONTEXT.md` — stream storage and decimation decisions; cadence-unit conversion lives in exactly one place.

### Code this phase extends or must not regress
- `src/dashboard/views/records.stub.ts`, `src/dashboard/views/trends.stub.ts` — the two stubs being replaced.
- `src/dashboard/view.types.ts` — `ROUTES`, `NAV_ORDER`, and `STUB_PHASE`; **both remaining `STUB_PHASE` entries must be removed** when these views ship (the calendar precedent from 17-10).
- `src/dashboard/views/list.ts` — holds the single `formatActivityDate` and `formatPace`, both carrying defect-driven correctness comments (the Z-suffix timezone rule, the single-rounding-step m:ss rule). **Reuse, never fork.** Also holds the existing PR badge at line 130.
- `src/dashboard/views/overview.ts` — the existing recent-PR rendering (line 95); D-08's badge vocabulary should stay consistent with it.
- `src/dashboard/views/detail.ts` + `detail-sections.ts` — where D-08's badge and panel land; carries the stale-render guard and error/retry patterns to preserve.
- `src/dashboard/views/list-logic.ts`, `calendar-logic.ts`, `detail-charts-logic.ts` — the established pure-logic/DOM split to mirror.
- `src/dashboard/data/athlete-config-client.ts` — the existing `parseAthleteConfig` validation chokepoint D-12's new fields must flow through.
- `src/dashboard/data/gear-client.ts` — the existing gear resolution ladder D-17/D-19 build on.
- `src/analytics/compute-stats.ts`, `compute-advanced-stats.ts`, `compute-best-efforts.ts`, `compute-dashboard-index.ts` — the compute-step convention D-20 follows; `compute-dashboard-index.ts` is what D-17 modifies.
- `src/analytics/streak-utils.ts` — `calculateDailyStreaks` / `calculateWeeklyConsistency`, already producing `data/stats/streaks.json` for D-01's streak superlatives.
- `src/index.ts` (~line 503) — the CLI subcommand switch and the `compute-all-stats` chain new steps register in.
- `scripts/build-widgets.mjs` (`copyDataFiles`, ~line 134) — the publish-dir copy list every new data file must join (D-22).
- `scripts/verify-dashboard-publish.mjs` — the publish-contract HTTP gate; it mounts under `/strava-widgets` and hard-fails on root-absolute asset URLs. **Extend it rather than working around it.**
- `.github/workflows/daily-refresh.yml` — the blocking `npm test` + `npm run verify-dashboard` exit gate. Both must stay green. Note it triggers on **schedule and workflow_dispatch only, not on push**.

### Existing generated data this phase presents (no new computation needed)
- `data/stats/weekly-distance.json` (103 KB), `monthly-stats.json`, `yearly-stats.json` — TREND-01 and D-01's superlatives.
- `data/stats/year-over-year.json` — TREND-02, already shaped as month × year.
- `data/stats/streaks.json` — D-01's streak records (longest 31 days; weekly consistency).
- `data/stats/all-time-totals.json` — the Records page headline.
- `data/stats/best-efforts.json` — everything in D-05..D-11.

### Hard-won lessons that constrain this phase
- `.planning/STATE.md` § Blockers/Concerns — the Phase 16 black-page failure: **the phase's own exit gate reported 15/15 green on a broken build** because the verifier asserted a local shape production does not have. Any new verification this phase adds must assert the production shape.
- `.planning/phases/17-activity-browser-detail-views/17-VALIDATION.md` — the Gap-Closure Record. Phase 17's automated gate was green (592/592 tests, clean tsc, 20/20 verify-dashboard) while two real defects sat in the browser: absent basemap tiles and misaligned chart-band x-axes. **Both were chart/map rendering defects invisible to automated checks** — precisely the class of defect a five-tab charting phase is most exposed to.
- `.planning/REQUIREMENTS.md` § Out of Scope — "Garmin-style Training Status / VO2max / readiness scores: black-box proprietary algorithms, unvalidatable; transparent TRIMP + Riegel instead". This is the stated reason D-14 defaults to the explainable model.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/stats/*.json` — REC-05, TREND-01 and TREND-02 are **presentation-only**: weekly, monthly, yearly, year-over-year and streak aggregates all already exist and are regenerated every CI run. No new computation for those three requirements.
- REC-04's list and overview PR badges **already ship** — `list.ts:130` (`if (row.prCount > 0)`) and `overview.ts:95`. Only the detail-view side (D-08) is new work.
- `DashboardIndexRow.prCount` — already populated; 49 activities carry `prCount > 0`.
- `streak-utils.ts` — `calculateDailyStreaks` and `calculateWeeklyConsistency` need no changes.
- `chart.js@4.5` and the existing chart-config conventions (`src/widget/chart-config.ts`, `src/widgets/comparison-chart/chart-config.ts`, `src/widgets/streak-widget/chart-config.ts`) — theming and configuration precedent for every new chart.
- `athlete-config-client.ts` / `gear-client.ts` — validation and resolution chokepoints already built and tested in Phase 17.
- The `*-logic.ts` + `*.test.ts` pure-function pattern from Phase 17 — the model for testing aggregation without a DOM.

### Established Patterns
- Vanilla TS + Vite, light DOM for dashboard views, Shadow DOM only for embeddable widgets (16-D01/D04).
- Views are self-contained registry modules (`{route, title, navEntry?, mount, unmount?}`) — adding a view is one module plus one registry line (16-D03).
- Compute steps are CLI subcommands writing gitignored JSON to `data/stats/`; hand-maintained inputs live in `data/config/` and are committed.
- Athlete free text is written with `textContent`, never an HTML-string assignment (T-16-VW-01).
- Vitest colocated `*.test.ts`; `npm test` is a blocking CI gate.
- Non-blocking failure convention: bad data is reported, never halts the pipeline.

### Integration Points
- `view-registry.ts` — records and trends move from stub to real; both `STUB_PHASE` entries are removed.
- `compute-dashboard-index.ts` — gains the resolved gear name field (D-17).
- `src/index.ts` CLI switch + `compute-all-stats` chain — new compute steps register here.
- `copyDataFiles` in `scripts/build-widgets.mjs` — every new data file must be added or it 404s in production.

### Data findings from this discussion (verified against the live archive)
- **All three road PRs come from one run.** The 5k (19:39.3), 10k (39:43.9) and half (1:26:51.3) records are all activity `7827165619`, a 21.35 km "Lunch Run" on 2022-09-18 — the 5k and 10k are *splits inside a half marathon*, not standalone efforts. A Riegel exponent fitted across them yields **1.032**, which is an artifact of near-constant pace within a single run, not fatigue curvature. **This is the concrete reason for D-11's 3-distinct-activity guard.**
- **The short PRs are a different era.** 400m 0:44 (2019-05-12), 1k 2:28.9 (2019-06-09), 1mi 4:47 (2019-05-16). Pairwise Riegel exponents between the short and road groups land at **1.16–1.38** against the textbook 1.06; a least-squares fit over all six PRs gives **1.206**. Predicting a marathon from the mile PR versus the half PR disagrees wildly — which D-11's matrix surfaces rather than hides.
- **`rankings.marathon` is empty** — zero marathon efforts in the archive. D-05's empty state is a real code path, not a hypothetical.
- **HR coverage: 1,688 / 1,867 activities have `avgHr` (90%); 1,687 have HR streams.** Coverage is solid from 2017 onward; only 22 activities predate 2017 in total. Stream-based TRIMP is viable across essentially the whole meaningful archive.
- **Gear coverage has a sharp shape: 1,160 / 1,868 (62%).** Zero before 2020, ~56% in 2020, ~100% for 2021–2025, and **19% in 2026** — the intervals.icu pipeline does not carry `gear_id`, so coverage is *degrading going forward*, not merely historically incomplete. 16 distinct shoes. TREND-05's honest domain is mid-2020 → 2025 (~1,146 runs).
- ⚠️ **The local `data/stats/best-efforts.json` is stale** — `generatedAt: 2026-08-10T17:07`, predating the exclusions feature. It has no `excludedFromRecords` field and its `totals` lacks `effortsExcluded`, so the two GPS-suspect activities (`3475726256`, `3475725513`) still hold rank 1 at 400m and 1k *locally*. The file is gitignored and CI regenerates it. **Planning and executing agents must rebuild (`npm run build && node dist/index.js compute-best-efforts`) before trusting any record number read from disk.**

</code_context>

<specifics>
## Specific Ideas

- The user's stated default when uncertain is **"the more the merrier"** — favour showing more information over curating it down, provided the extra material is honest. D-11's matrix-plus-fitted-exponent, D-05's all-tables-visible, and D-06's small-multiples grid are all concrete expressions of that preference.
- The user's stated rule for missing data, verbatim: *"I don't want to delete activities but I want to make sure those absences are visible and not 'made up'."* This is the governing principle behind D-15 (no-HR runs), D-18 (unknown gear), D-07 (low-confidence badging) and D-13 (unfilled config). It is a **hard constraint, not a preference** — no imputation, no estimation, no truncation that hides activities.
- D-13's actionable-notice pattern is modelled explicitly on commit `c502537` ("make blocked-basemap notice actionable") from Phase 17 — the notice names the file and field to fill in rather than merely disappearing.
- The year-over-time consistency heatmap was explicitly wanted by the user during Phase 17 ("somewhere as well") and routed here; D-04 places it in the Volume tab.

### Developer follow-up actions (not phase-gating)
- Fill in the 16 shoe names in `data/config/gear.json` from Strava's My Gear page.
- Replace the placeholder `maxHr: 190` and zone boundaries in `data/config/athlete.json` with real training values, and add `birthDate`, `sex`, `restingHr` once D-12's schema lands.

</specifics>

<deferred>
## Deferred Ideas

- **Teaching the intervals.icu adapter to carry gear** — the 2026 gear coverage drop to 19% is a *pipeline* gap, not a presentation one. D-18 makes the erosion visible; fixing the source belongs with whatever phase next touches ingestion. Recorded here so it is not absorbed as a permanent fact of the data.
- **Filtering or grouping the activity browser by shoe** — D-17 puts the resolved gear name into the index, which makes this cheap, but the browser UI for it is not in this phase's scope.
- **Personal route-segment detection** (REC-08 in REQUIREMENTS.md's Future set) — frequently-run sections from GPS overlap with per-segment time history. Not in v2.0.
- **Native device-recorded laps table** (DETAIL-06) — still blocked on FIT lap-marker recovery.
- **Pace/speed colour coding along route polylines** — already in PROJECT.md's future-vision list.

### Reviewed Todos (not folded)
- **Manual exclusion of activities from best-effort/PR calculations** (`.planning/todos/pending/2026-08-10-manual-exclusion-of-activities-from-best-efforts.md`, score 0.90) — **not folded: already shipped.** Phase 16 plan 16-01 delivered `data/best-effort-exclusions.json` (populated with both GPS-suspect activities and their reasons), `src/analytics/best-effort-exclusions.ts`, and the index's `excludedFromRecords` field. D-07 surfaces the `reason` strings; no override *UI* was requested. **The todo file should be moved to `.planning/todos/completed/`** — a housekeeping item Phase 17 also flagged and which remains undone.
- **Garmin export adapter when export arrives** (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`, score 0.60) — **not folded, deferred a fourth time.** `export_data/` still contains only `strava/`, and the todo's own notes require probing the real export structure before coding (the repeated project lesson from the intervals.icu latlng stream). Re-fold into whichever phase is active when the export lands.

</deferred>

---

*Phase: 18-records-trends-differentiators*
*Context gathered: 2026-08-11*
