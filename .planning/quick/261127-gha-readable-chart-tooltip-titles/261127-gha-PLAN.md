---
phase: quick-261127-gha
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/dashboard/views/chart-tooltip-title.ts
  - src/dashboard/views/chart-tooltip-title.test.ts
  - src/dashboard/views/chart-tooltip-wiring.test.ts
  - src/dashboard/views/trends-charts.ts
  - src/dashboard/views/records-charts.ts
  - src/dashboard/views/detail-charts.ts
  - src/dashboard/views/trends-tick-format.ts
autonomous: true
requirements:
  - QUICK-261127-gha
must_haves:
  truths:
    - "Hovering a Volume bar shows 'Week of 23 Nov 2026' (weekly), 'November 2026' (monthly) or '2026' (yearly) as the tooltip title, never an epoch integer"
    - "Hovering the Training Load chart shows the day, e.g. 'Mon 23 Nov 2026'"
    - "Hovering a Cadence & HR band shows the month, e.g. 'November 2026'"
    - "Hovering a Records PR-progression point shows the effort date, e.g. '14 Mar 2025'"
    - "Hovering an activity-detail band shows '3.45 km' in distance mode and '12:34' / '1:02:34' in time mode"
    - "Category-axis charts (YoY, Gear, widget charts) keep their already-readable label titles, untouched"
  artifacts:
    - path: "src/dashboard/views/chart-tooltip-title.ts"
      provides: "Pure DOM-free tooltip title formatters + items-array adapter"
      exports: ["formatVolumeTooltipTitle", "formatDayTooltipTitle", "formatMonthTooltipTitle", "formatDateTooltipTitle", "formatDetailTooltipTitle", "titleFromItems"]
    - path: "src/dashboard/views/chart-tooltip-title.test.ts"
      provides: "Formatter unit tests with hand-written expected strings"
    - path: "src/dashboard/views/chart-tooltip-wiring.test.ts"
      provides: "Per-builder wiring tests via mocked chart.js capturing each config"
  key_links:
    - from: "src/dashboard/views/trends-charts.ts"
      to: "src/dashboard/views/chart-tooltip-title.ts"
      via: "plugins.tooltip.callbacks.title in mountVolumeChart (both branches), buildChannelBand, mountTrainingLoadChart (both branches)"
      pattern: "title: \\(items"
    - from: "src/dashboard/views/records-charts.ts"
      to: "src/dashboard/views/chart-tooltip-title.ts"
      via: "plugins.tooltip.callbacks.title"
      pattern: "formatDateTooltipTitle"
    - from: "src/dashboard/views/detail-charts.ts"
      to: "src/dashboard/views/chart-tooltip-title.ts"
      via: "plugins.tooltip.callbacks.title reading the live xAxisMode closure"
      pattern: "formatDetailTooltipTitle"
---

<objective>
Give every linear-x Chart.js chart in the dashboard a readable tooltip title (resolves Phase 23 "Finding 6", previously deferred). Today no chart sets `plugins.tooltip.callbacks.title`, so Chart.js's default title renders the raw linear x value: epoch ms with locale commas on Trends/Records (e.g. `1,769,990,400,000`), raw km/seconds on activity detail.

Purpose: the user's report — "when hovering the tooltip indicates the time as a long number" — across Volume, Training Load, activity detail pace & effort, and any other instance.
Output: one pure formatter module + tests, title callbacks wired into every linear-x chart, wiring tests proven to fail at HEAD.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/dashboard/views/trends-tick-format.ts
@src/dashboard/views/trends-charts.ts
@src/dashboard/views/records-charts.ts
@src/dashboard/views/detail-charts.ts

<inventory>
Planner-verified chart inventory (every `from 'chart.js'` importer in src/):

| Chart | File / function | x scale | x value | Title today | Action |
|---|---|---|---|---|---|
| Volume (empty-bounds branch) | trends-charts.ts mountVolumeChart, tooltip ~L242 | linear | epoch ms: weekly = `weekStartISO` (UTC Monday 00:00, confirmed `2026-11-23T00:00:00.000Z` = Mon); monthly/yearly = `periodStart` (UTC 1st of month / 1 Jan) | raw epoch | ADD title |
| Volume (zoom branch) | mountVolumeChart, tooltip ~L320 | linear | same | raw epoch | ADD title |
| Cadence & HR bands | buildChannelBand (called by mountChannelBands), tooltip ~L649 | linear | `MonthlyPoint.x = monthStartMs(cursor)` — monthly buckets | raw epoch | ADD title (month) |
| Training Load (empty branch) | mountTrainingLoadChart, tooltip ~L912, `interaction: index` | linear | daily epoch ms | raw epoch | ADD title (day) |
| Training Load (zoom branch) | mountTrainingLoadChart, tooltip ~L1007 | linear | daily epoch ms | raw epoch | ADD title (day) |
| YoY | mountYoyChart ~L445 | category (labels = month labels) | — | month label (readable) | NONE |
| Gear | mountGearChart ~L1113 | category (labels = bucket.label) | — | shoe label (readable) | NONE |
| Records PR evolution | records-charts.ts mountEvolutionCharts ~L104 | linear | `EvolutionPoint.x` = epoch ms of effort date | raw epoch | ADD title (date) |
| Activity detail bands | detail-charts.ts mountChartBands → buildBand ~L498, `interaction: index`, decimation on | linear | km (distance mode) or seconds since first sample (time mode); `xAxisMode` is a `let` closure, bands rebuilt on toggle | raw km/sec | ADD title |
| Widgets | src/widget/chart-config.ts, src/widgets/streak-widget, src/widgets/comparison-chart | category / radar with `labels` | — | readable | NONE |

chart-zoom.ts imports chart.js only for the zoom plugin — no chart of its own.
</inventory>

<interfaces>
From src/dashboard/views/trends-volume-logic.ts:
- `export type VolumeGranularity = 'weekly' | 'monthly' | 'yearly';`
- `export interface VolumePoint { x: number; km: number; runs: number; label: string; }`

From src/dashboard/views/detail-charts-logic.ts:
- `export type XAxisMode = 'distance' | 'time';`

From src/dashboard/views/trends-charts.ts:
- `export function mountVolumeChart(canvas: HTMLCanvasElement, points: readonly VolumePoint[], granularity: VolumeGranularity, zoom: ZoomMountOptions): ChartHandle`
- `export function mountChannelBands(root: HTMLElement, cadence: readonly MonthlyPoint[], hr: readonly MonthlyPoint[], zoom: Omit<ZoomMountOptions, 'header'>): ChartHandle`
- `export function mountTrainingLoadChart(canvas: HTMLCanvasElement, points: readonly LoadPoint[], spans: readonly CoverageSpan[], zoom: ZoomMountOptions): ChartHandle`
- `export interface ZoomMountOptions { header: HTMLElement; savedRange: ZoomRange | null; onRangeChange: (range: ZoomRange) => void; }`
- imports from './chart-zoom.js': `chartZoomPlugin, buildZoomPluginOptions, attachZoomController` (ZoomController = { settle, applyRange, currentRange, destroy })
- `computeArchiveBounds([])` returns null → the no-zoom branch.

From src/dashboard/views/records-charts.ts:
- `export interface EvolutionChartCard { distance: TargetDistanceKey; displayName: string; canvas: HTMLCanvasElement; points: readonly EvolutionPoint[]; }`
- mount function loops `cards`, `new Chart(card.canvas, ...)` per non-empty card. (Read the exported mount function name from the file.)

From src/dashboard/views/detail-charts.ts:
- `export function mountChartBands(container: HTMLElement, options: { stream: CanonicalStream; storage?: WebStorage; onHover?: (fraction: number | null) => void }): ChartBandsHandle`
- `formatXTick(value, mode)` (private): time → `m:ss`, distance → `x.x km`. Leave it unchanged.
- Inside buildBand: `datasetChannels: ChannelKey[]`; primary dataset is pushed LAST; overlays first.

From src/dashboard/views/chart-theme.ts: `resolveToken` calls `getComputedStyle(document.documentElement)`.
Stream fixture pattern: detail-charts-logic.test.ts `makeStream` / `makeUniformStream(speedMps, durationSec)` (L161/L179) — copy the shape, do not import from a test file.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure tooltip-title formatter module (TDD)</name>
  <files>src/dashboard/views/chart-tooltip-title.ts, src/dashboard/views/chart-tooltip-title.test.ts</files>
  <behavior>
    Hand-written expected strings (independent of implementation; never compute expectations with Date/Intl in the test):
    - formatVolumeTooltipTitle(Date.UTC(2026,10,23), 'weekly') → 'Week of 23 Nov 2026'; (Date.UTC(2026,10,1), 'monthly') → 'November 2026'; (Date.UTC(2026,0,1), 'yearly') → '2026'
    - UTC, not local: formatVolumeTooltipTitle(Date.UTC(2026,0,1), 'yearly') → '2026' and formatMonthTooltipTitle(Date.UTC(2026,0,1)) → 'January 2026' (a local-time getter under a negative TZ offset would yield 2025/December — the test must also pass with TZ=America/Los_Angeles; run it that way once)
    - formatDayTooltipTitle(Date.UTC(2026,10,23)) → 'Mon 23 Nov 2026'; formatDayTooltipTitle(Date.UTC(2024,1,29)) → 'Thu 29 Feb 2024'
    - formatMonthTooltipTitle(Date.UTC(2025,8,1)) → 'September 2025'
    - formatDateTooltipTitle(Date.UTC(2025,2,14)) → '14 Mar 2025' (single-digit day not zero-padded: Date.UTC(2025,2,4) → '4 Mar 2025')
    - formatDetailTooltipTitle(3.4512, 'distance') → '3.45 km'; (0, 'distance') → '0.00 km'; (754, 'time') → '12:34'; (59.6, 'time') → '1:00'; (3754, 'time') → '1:02:34'; (3600, 'time') → '1:00:00'
    - Every formatter: NaN / Infinity → '' (mirrors formatTimeAxisTick's convention)
    - titleFromItems([], fmt) → ''; titleFromItems([{ parsed: { x: Date.UTC(2026,10,23) } }], formatDayTooltipTitle) → 'Mon 23 Nov 2026'; item with parsed.x non-number → ''
  </behavior>
  <action>
    Create src/dashboard/views/chart-tooltip-title.ts as a pure, DOM-free module (no chart.js import, loadable under vitest environment 'node'), in trends-tick-format.ts's house style: header doc comment explaining it resolves Phase 23 Finding 6 and why it is a SEPARATE module (trends-tick-format.ts's doc comment forbids a tooltip title callback there — that prohibition is honored, not overridden). Use UTC getters only (getUTCFullYear/getUTCMonth/getUTCDate/getUTCDay), consistent with formatTimeAxisTick. Keep own local arrays for short month names, full month names and short weekday names (Sun..Sat). Export:
    formatVolumeTooltipTitle(epochMs: number, granularity: VolumeGranularity): string (import type only from './trends-volume-logic.js'; weekly is "Week of D MMM YYYY" because weekly x is the UTC-Monday week start from weekStartISO);
    formatDayTooltipTitle(epochMs): 'Ddd D MMM YYYY';
    formatMonthTooltipTitle(epochMs): 'MMMM YYYY';
    formatDateTooltipTitle(epochMs): 'D MMM YYYY';
    formatDetailTooltipTitle(x: number, mode: XAxisMode): distance → x.toFixed(2) + ' km'; time → round to whole seconds, 'm:ss' under an hour, 'h:mm:ss' at/over an hour (import type XAxisMode from './detail-charts-logic.js');
    titleFromItems(items: readonly { parsed?: { x?: unknown } }[], format: (x: number) => string): string — returns '' for an empty array, missing parsed, or non-finite/non-number x; otherwise format(items[0].parsed.x).
    Read the x from parsed.x, NOT dataIndex: Training Load and detail have Decimation enabled, so dataIndex indexes the decimated dataset, not the caller's points array. Write the tests first (RED: module missing), then implement (GREEN).
  </action>
  <verify>
    <automated>npx vitest run --config vitest.logic.config.ts src/dashboard/views/chart-tooltip-title.test.ts && TZ=America/Los_Angeles npx vitest run --config vitest.logic.config.ts src/dashboard/views/chart-tooltip-title.test.ts</automated>
  </verify>
  <done>All behavior cases pass in both default TZ and America/Los_Angeles; module has no chart.js or DOM reference (grep -v '^\s*\*' file | grep -c "chart.js\|document" == 0).</done>
</task>

<task type="auto">
  <name>Task 2: Wire title callbacks into every linear-x chart</name>
  <files>src/dashboard/views/trends-charts.ts, src/dashboard/views/records-charts.ts, src/dashboard/views/detail-charts.ts, src/dashboard/views/trends-tick-format.ts</files>
  <action>
    Add a `title` entry beside each existing `label` in `plugins.tooltip.callbacks`, using titleFromItems + the matching formatter from './chart-tooltip-title.js'. Do not change any label callback, tick callback, or other option.
    trends-charts.ts: mountVolumeChart BOTH branches (empty-bounds ~L242 and zoom ~L320) → formatVolumeTooltipTitle(x, granularity) via the function's `granularity` parameter; buildChannelBand (~L649) → formatMonthTooltipTitle; mountTrainingLoadChart BOTH branches (~L912, ~L1007) → formatDayTooltipTitle. Leave mountYoyChart and mountGearChart alone (category x; Chart.js's default title is already the category label).
    records-charts.ts (~L104) → formatDateTooltipTitle.
    detail-charts.ts buildBand (~L498) → formatDetailTooltipTitle(x, xAxisMode), reading the `xAxisMode` closure at call time exactly as the existing tick callback does. Because `interaction: { mode: 'index' }` returns one item per dataset and overlay series may carry different x at the same index, prefer the item whose datasetIndex is the primary dataset (datasets.length - 1 / last entry of datasetChannels); fall back to items[0]. Implement that selection inline in the callback (or as a small helper in detail-charts.ts) and pass the selected item to titleFromItems as a one-element array.
    Type the title callback parameter structurally like the existing label callbacks (e.g. `items: readonly { parsed: { x: unknown }; datasetIndex: number }[]`), keeping the existing `as any` casts — do not add new eslint-disable lines.
    trends-tick-format.ts: comment-only edit — update the "NOT a tooltip formatter" paragraph so it says Finding 6 is now resolved by chart-tooltip-title.ts (quick 261127-gha) and the prohibition on adding a title callback to THIS module still stands. No code change in that file.
  </action>
  <verify>
    <automated>npx tsc --noEmit && test "$(grep -c 'title: (items' src/dashboard/views/trends-charts.ts)" -eq 5 && grep -c 'title: (items' src/dashboard/views/records-charts.ts src/dashboard/views/detail-charts.ts</automated>
  </verify>
  <done>tsc clean; 5 title callbacks in trends-charts.ts, 1 in records-charts.ts, 1 in detail-charts.ts; YoY and Gear unchanged; trends-tick-format.ts diff is comment-only (git diff shows only lines starting with ` *`).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Per-builder wiring tests, proven to fail at HEAD; full gates</name>
  <files>src/dashboard/views/chart-tooltip-wiring.test.ts</files>
  <behavior>
    Each case mounts the REAL builder, captures the config passed to the mocked Chart constructor, and asserts `typeof config.options.plugins.tooltip.callbacks.title === 'function'` AND that calling it on a hand-built sample item returns the hand-written string:
    - mountVolumeChart empty-bounds branch (points = []) and zoom branch (points with 2+ entries), weekly: item parsed.x = Date.UTC(2026,10,23) → 'Week of 23 Nov 2026'; monthly: Date.UTC(2026,10,1) → 'November 2026'; yearly: Date.UTC(2026,0,1) → '2026'
    - mountChannelBands: both captured configs (cadence + HR) at parsed.x = Date.UTC(2025,8,1) → 'September 2025'
    - mountTrainingLoadChart empty and zoom branches: Date.UTC(2026,10,23) → 'Mon 23 Nov 2026'
    - Records mount function, one card: Date.UTC(2025,2,14) → '14 Mar 2025'
    - mountChartBands distance mode: items [{datasetIndex: primaryIndex, parsed: {x: 3.4512}}] → '3.45 km'; after invoking the recorded click listener of the time-mode toggle (bands rebuild), the NEW captured config's title on parsed.x 754 → '12:34'
    - Empty items array → '' for at least one builder
  </behavior>
  <action>
    Create src/dashboard/views/chart-tooltip-wiring.test.ts (vitest environment stays 'node'; no new dependencies — no jsdom/happy-dom). Use vi.mock('chart.js') returning a fake Chart class whose constructor pushes (canvas, config) to a module-level captured array (use vi.hoisted for the array), with static register as no-op and instance methods resize/destroy/update no-ops plus a `tooltip` stub with setActiveElements; also export every name the three modules import (BarController, LineController, LinearScale, CategoryScale, Tooltip, Filler, Decimation, etc.) as dummy objects. vi.mock('./chart-zoom.js') to stub chartZoomPlugin ({ id: 'zoom' }), buildZoomPluginOptions (returns {}), attachZoomController (returns { settle, applyRange, currentRange: () => null, destroy } no-ops) — this avoids chart-zoom's DOM. Install a minimal fake DOM in the test file only via vi.stubGlobal: document (documentElement, createElement returning a FakeElement), getComputedStyle (getPropertyValue → ''), and leave ResizeObserver undefined (observeCanvasResize already early-returns). FakeElement supports whatever the mounts touch — children, appendChild/append/replaceChildren/remove, setAttribute/getAttribute, className, classList (add/remove/toggle/contains), style, dataset, textContent, parentElement, addEventListener recording listeners by type, querySelector/querySelectorAll returning null/[] — extend it until the real mounts run; never change production code to make the fake easier. Pass a fake storage object (getItem → null, setItem no-op) to mountChartBands. Build the stream fixture inline in the shape of detail-charts-logic.test.ts makeUniformStream (t/d arrays, e.g. 10 m/s for 1000 s), with at least pace available; locate the time toggle by its recorded 'click' listener on the element whose textContent is the time option (read detail-charts.ts for its text). For mountChartBands, compute primaryIndex as the captured config's data.datasets.length - 1. Expected values are hand-written literals; never import chart-tooltip-title.ts to compute them.
    Prove the tests fail against HEAD without mutating tracked files: create a detached worktree in the scratchpad (git worktree add "$SCRATCH/head-wt" HEAD), symlink node_modules into it, copy ONLY chart-tooltip-wiring.test.ts into its src/dashboard/views/, run npx vitest run src/dashboard/views/chart-tooltip-wiring.test.ts there, record "X failed / Y total" (expect every title assertion to fail — the title callback is absent at HEAD; if any case passes at HEAD, that case is vacuous and must be fixed), then git worktree remove --force. Record the HEAD fail count and the post-change pass count in the SUMMARY. If any `-t` filter is used, record its matched test count (0 matches exits 0). Do not write to tracked data/ or dist/.
  </action>
  <verify>
    <automated>npx vitest run --config vitest.logic.config.ts src/dashboard/views/chart-tooltip-wiring.test.ts && npm run test:logic && npx tsc --noEmit</automated>
  </verify>
  <done>Wiring suite green on the change and failing case-for-case at HEAD (counts recorded); npm run test:logic green at 127 files (125 + 2 new) with test count above 4442; tsc clean; git status shows no changes under data/ or dist/ and no leftover worktree (git worktree list shows only the primary checkout).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| data/*.json → chart tooltip | Pipeline-generated numbers rendered as tooltip text on canvas |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gha-01 | Tampering | tooltip title text | accept | Chart.js draws titles on canvas (no HTML injection path); formatters output only digits and fixed month/weekday literals |
| T-gha-02 | Denial of Service | malformed x (NaN/Infinity/missing parsed) | mitigate | titleFromItems and every formatter return '' for non-finite input; unit-tested in Task 1 |
| T-gha-03 | Tampering | tests mutating tracked files | mitigate | HEAD-fail proof runs in a scratchpad git worktree; no test writes to tracked files; data/ and dist/ untouched (checked in Task 3 done) |
</threat_model>

<verification>
- `npm run test:logic` green (125 → 127 files)
- `npx tsc --noEmit` clean
- Wiring tests fail at HEAD (count recorded) and pass after
- Formatter tests pass under TZ=America/Los_Angeles
</verification>

<success_criteria>
Every linear-x chart (Volume x2 branches, Cadence & HR, Training Load x2 branches, Records, activity detail) shows a human-readable tooltip title appropriate to its granularity; category-x charts unchanged; wiring proven non-vacuous against HEAD.
</success_criteria>

<output>
Create `.planning/quick/261127-gha-readable-chart-tooltip-titles/261127-gha-SUMMARY.md` when done, including the chart inventory table outcome, HEAD fail count vs post-change pass count, and suite totals.
</output>
