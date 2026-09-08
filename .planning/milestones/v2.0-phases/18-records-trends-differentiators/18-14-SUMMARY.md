---
phase: 18-records-trends-differentiators
plan: 14
subsystem: ui
tags: [trends, chart.js, aria-tablist, dashboard, chart-theme]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    provides: "trends-logic.ts/trends-volume-logic.ts/trends-yoy-logic.ts (plan 18-06, DOM-free tab-state, volume series, YoY series), chart-theme.ts (plan 18-04, live-token colour resolution + Y_AXIS_WIDTH_PX), records.ts/records-charts.ts (plan 18-12, lazy-chunk-boundary + registry-swap precedent)"
provides:
  - "The #/trends view: real ARIA tablist, page-global rolling-totals strip, 5 persistent tabpanels"
  - "Volume tab: one Chart.js bar chart with a weekly/monthly/yearly toggle plus a 53x7 year consistency heatmap"
  - "Year-over-Year tab: grouped monthly bar chart, live-token colours, add/remove year chips"
  - "Both Phase 16 stub views now shipped — STUB_PHASE is empty"
affects: ["18-15 (Cadence & HR, Training Load, Gear tabs extend this same trends.ts/trends-charts.ts)", "18-16 (manual verification checkpoint)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "history.pushState (not router.ts's navigateTo) for in-page tab switches, so the URL/history update without firing hashchange and without triggering main.ts's full unmount/remount cycle — back/forward still resolves correctly through the router since hashchange fires on history traversal regardless of how the entries were created"
    - "requestToken increment-and-compare re-checked after every await (initial parallel stats fetch, each tab's lazy chart-module import) — same discipline as detail.ts's activity-to-activity race guard, applied here to tab-to-tab races"
    - "Destroy-and-rebuild chart lifecycle on every tab switch and every in-tab control change (granularity toggle, year select, year chip) — canvas element reused, Chart.js instance always destroyed before a new one is constructed, never an in-place dataset mutation"

key-files:
  created:
    - src/dashboard/views/trends.ts
    - src/dashboard/views/trends-charts.ts
  modified:
    - src/dashboard/view-registry.ts
    - src/dashboard/view.types.ts
    - src/dashboard/view-registry.test.ts

key-decisions:
  - "Tab switching uses window.history.pushState directly rather than router.ts's navigateTo, because navigateTo assigns location.hash and would trigger main.ts's onMatch on every arrow-key press (a full view unmount/remount), defeating 18-UI-SPEC §7's '5 persistent tabpanels, not a rebuild-per-switch DOM shell' contract. pushState updates the same #/trends?tab=... URL shape the router understands (so a reload/bookmark still resolves correctly) without firing hashchange (MDN: pushState/replaceState never fire hashchange even for a fragment-only change). Back/forward across tab history entries does cross the router (hashchange fires on history traversal for a fragment change regardless of how the entries were created), which is a correct full remount, not a bug."
  - "Rolling-totals tiles use a 3-line shape (km display, category label, run count) rather than the UI-SPEC's literal 'two-line' phrasing, reusing records.ts's buildSuperlativeTile precedent (already 'zero new CSS') — a reader needs to know which tile is This Week vs This Month vs This Year to Date, and the literal 2-element description didn't specify where that name goes."
  - "Cadence & HR, Training Load, and Gear tabs are real, fully switchable/keyboard-navigable tabs from this plan (DOM shell, ARIA wiring, tablist entry) but render a named placeholder ('{Tab} is coming in a future update.') until plan 18-15 fills them in — matches the plan's explicit 'ships live content for the first two tabs only' scope."
  - "trends-charts.ts registers the full Chart.js component set the plan's Task 2 action lists verbatim (BarController/BarElement/LineController/LineElement/PointElement/LinearScale/CategoryScale/Tooltip/Filler), even though this plan's two chart functions (bar-only) don't use Line*/Filler — the module is explicitly designed to be extended in-place by plan 18-15's Cadence & HR (line charts) and Training Load (Filler-based CTL area) tabs rather than re-registered."
  - "view-registry.test.ts's STUB_PHASE describe block previously asserted ROUTES.TRENDS stayed stubbed (a Phase 17-era regression guard) — updated to assert STUB_PHASE is now empty, since this plan is the one that ships Trends and the assertion would otherwise permanently fail against a working page."

requirements-completed: [REC-05, TREND-01, TREND-02]

# Metrics
duration: 55min
completed: 2026-08-12
---

# Phase 18 Plan 14: Trends Shell + Volume/Year-over-Year Tabs Summary

**Real ARIA tablist replacing the Phase 16 Trends stub, with a live weekly/monthly/yearly volume chart plus 53x7 year consistency heatmap and a live-token-themed year-over-year grouped bar chart with add/remove year chips — Chart.js lazy-loaded behind `await import('./trends-charts.js')`.**

## Performance

- **Duration:** ~55 min (task execution; excludes upfront read/context-gathering)
- **Started:** 2026-08-12T06:32:00+02:00 (worktree base reset)
- **Completed:** 2026-08-12T06:38:14+02:00 (last task commit)
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `trends.ts`: `createTrendsView` — a real WAI-ARIA tablist (`role="tablist"`/`"tab"`/`"tabpanel"`, roving `tabindex`, Left/Right/Home/End keyboard activation matching the APG pattern), 5 persistent tabpanels present from mount, and a page-global rolling-totals strip (This Week / This Month / This Year to Date) above the tablist that stays visible regardless of which tab is open
- `trends-charts.ts`: `mountVolumeChart` (single bar chart, `'linear'` x-scale with a period-formatting `ticks.callback`, y-axis pinned to the shared `Y_AXIS_WIDTH_PX` gutter, `aria-label` changing with granularity) and `mountYoyChart` (grouped bar chart, `'category'` x-scale over the twelve parsed `monthLabel`s, per-year colour resolved from live CSS tokens with an alpha-fallback past 11 selected years) — both idempotent-`destroy()` handles, both reached only via `trends.ts`'s lazy `await import`
- Volume tab: a `.segmented` 3-way granularity toggle (`role="group"` + a per-button pressed-state attribute, the correct pattern here vs. the outer tablist), the year consistency heatmap (native `<select>` year picker, a 53×7 CSS-grid of 371 non-focusable/non-interactive cells whose tint is interpolated directly from each cell's computed value so a rest day reaches `tint-0` with zero accent, one summarizing `aria-label`, and a "View as table" disclosure carrying the same per-day data as a real HTML table)
- Year-over-Year tab: a `.chip-row` of `.preset-chip` year toggles defaulting to the 3 most recent years, a named empty state when the document is absent/empty, and destroy-and-rebuild on every selection change
- Registry swap: `view-registry.ts` now wires `createTrendsView({ indexClient })` in place of the `trends.stub.js` import; `trends.stub.ts` deleted; `view.types.ts`'s `STUB_PHASE` is now an empty object — both Phase 16 stub views (Calendar, Records, Trends) have shipped
- Tab switching updates the URL via `history.pushState` rather than `router.ts`'s `navigateTo`, avoiding a full page unmount/remount on every arrow-key press while keeping `#/trends?tab=...` bookmarkable and back/forward-correct (see Decisions below)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tablist shell, rolling-totals strip, tab dispatch, and registry swap** - `69f474a` (feat)
2. **Task 2: The Volume tab — one chart, a granularity toggle, and the year heatmap** - `6e773a6` (feat)
3. **Task 3: The Year-over-Year tab** - `e371680` (feat)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified

- `src/dashboard/views/trends.ts` - The `#/trends` view: tablist, tabpanels, rolling totals, tab dispatch, Volume/YoY tab content
- `src/dashboard/views/trends-charts.ts` - Chart.js mounting for the Volume and Year-over-Year tabs, behind a lazy import
- `src/dashboard/view-registry.ts` - Registry entry swapped from the stub to `createTrendsView`
- `src/dashboard/view.types.ts` - `STUB_PHASE` emptied (both Phase 16 stubs shipped)
- `src/dashboard/view-registry.test.ts` - `STUB_PHASE` assertion updated to expect an empty object

## Decisions Made

See `key-decisions` in the frontmatter above for full rationale on: the `history.pushState` tab-switch mechanism, the rolling-totals tile's 3-line shape, the placeholder treatment for the three not-yet-built tabs, the upfront full Chart.js component registration, and the `view-registry.test.ts` fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing test that asserted Trends stayed stubbed**
- **Found during:** Task 1 (`npm test` run before committing)
- **Issue:** `view-registry.test.ts`'s `STUB_PHASE` describe block asserted `STUB_PHASE[ROUTES.TRENDS]` was defined — a Phase 17-era regression guard written when Trends was still a stub. Shipping this plan's real Trends view makes that assertion permanently false, failing `npm test`.
- **Fix:** Updated the test to assert `STUB_PHASE` is empty (`Object.keys(STUB_PHASE).length === 0`) and that none of Calendar/Records/Trends have an entry, matching the plan's explicit `STUB_PHASE` acceptance criterion.
- **Files modified:** `src/dashboard/view-registry.test.ts`
- **Verification:** `npm test` — 884/884 tests pass.
- **Committed in:** `69f474a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary to keep `npm test` green after shipping Trends; no scope creep — the fix only updates the test's own outdated assertion to match the plan's stated `STUB_PHASE` contract.

## Known Stubs

Cadence & HR, Training Load, and Gear tabpanels render a fixed placeholder string (`"{Tab name} is coming in a future update."`) rather than real chart content. This is the plan's own explicit scope boundary — its objective states "ships live content for the first two tabs only," and the plan's own `<read_first>`/data-fetch instructions explicitly forbid fetching `training-load.json`/`gear-aggregate.json` in this plan. The tabs are otherwise fully real: they exist in the tablist, are keyboard-navigable (arrow keys move to and activate them), and have real ARIA-wired tabpanel DOM shells from mount. Plan 18-15 replaces the placeholder branch in `renderActiveTabContent`'s `switch` (in `trends.ts`) with real chart-mounting logic, extending the same `trends-charts.ts` module (already registers the Line*/Filler Chart.js components those tabs will need).

## Issues Encountered

- Derived stats data (`data/stats/*.json`, `data/dashboard/index.json`) did not exist in this fresh worktree (gitignored). Ran `npm run compute-all-stats` locally to generate it, matching plan 18-06's precedent. The unrelated `data/geo/geo-metadata.json` timestamp-only churn from that run was reverted with `git checkout --` before any task commit, per the derived-data-note instructions.
- No headless browser or jsdom is available in this repo (confirmed, matches RESEARCH.md). The plan's Task 2/Task 3 "manual smoke" acceptance items (chart renders, granularity toggle switches without a console error, rapid Volume/YoY switching produces no "Canvas is already in use" error) were verified by code-level review instead of a live browser: every chart mount path goes through `destroy()` on the previous instance before constructing a new one on a reused `<canvas>` element, and neither `trends.ts` nor `trends-charts.ts` contains any `.data.datasets =` assignment or `.update()` call on a live `Chart` instance (confirmed via the plan's own grep acceptance criteria, both returning 0). Full visual/interactive verification remains plan 18-16's checkpoint, as the plan itself states.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `#/trends` is live with two fully-functional tabs (Volume, Year-over-Year) and three real-but-placeholder tabs (Cadence & HR, Training Load, Gear) ready for plan 18-15 to fill in via the same `renderActiveTabContent` switch statement and the same shared `trends-charts.ts` module (whose Chart.js registration already includes the line-chart and `Filler` components those tabs need).
- `STUB_PHASE` is empty — both Phase 16 stub views (Calendar, Records, Trends) have shipped; the 18-19's manual verification checklist item "`STUB_PHASE` removal" is satisfied.
- `npm run build`, `npm run build-widgets`, `npm run verify-dashboard`, and `npm test` are all green (884/884 tests, 37/37 verify-dashboard checks, clean `tsc`, clean Vite dashboard SPA build with Chart.js confirmed still landing in a lazy async chunk shared by `records-charts.js`/`trends-charts.js`/`detail-charts.js`).
- Manual keyboard-model, canvas-lifecycle, heatmap-layout, and tint-0-emptiness verification is explicitly deferred to plan 18-16's checkpoint, per this plan's own `<verification>` section.

## Self-Check: PASSED

- All 2 created files verified present on disk (`src/dashboard/views/trends.ts`, `src/dashboard/views/trends-charts.ts`).
- `src/dashboard/views/trends.stub.ts` verified absent (`test -f` exits non-zero).
- All 3 task commits (`69f474a`, `6e773a6`, `e371680`) verified present in `git log --oneline --all`.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-12*
