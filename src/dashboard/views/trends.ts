/**
 * Trends page (`#/trends`) — REC-05, TREND-01, TREND-02, 18-UI-SPEC § 7/§ 13.
 * Replaces the second and last Phase 16 stub with a page-global
 * rolling-totals header strip and a five-tab ARIA tablist (Volume,
 * Year-over-Year, Cadence & HR, Training Load, Gear). This plan (18-14)
 * ships live content for the first two tabs only — Cadence & HR, Training
 * Load, and Gear render a named placeholder until plan 18-15 fills them in;
 * their tabpanel DOM shells, ARIA wiring, and keyboard behaviour are already
 * fully real from this plan (D-03's five-tab contract).
 *
 * Tab switching never calls `router.ts`'s `navigateTo` (which assigns
 * `location.hash` directly and would trigger `main.ts`'s `onMatch` — a full
 * view unmount/remount on every arrow-key press, defeating 18-UI-SPEC § 7's
 * "5 persistent tabpanels ... not a rebuild-per-switch DOM shell" contract).
 * Instead a switch updates the visible URL via `history.pushState` — the
 * exact same `#/trends?tab=...` shape the router already understands, so a
 * reload or a fresh navigation to a bookmarked URL still resolves correctly
 * through the normal router path — without firing `hashchange` (MDN:
 * `pushState`/`replaceState` never fire `hashchange`, even when the new URL
 * differs from the old one only in its fragment). Back/forward across tab
 * history entries DOES cross the router (browsers fire `hashchange` for a
 * fragment-only change on history traversal regardless of how the entries
 * were created), which is a correct full remount, not a bug: the freshly
 * parsed `?tab=` query still resolves to the right tab.
 *
 * Every chart lives behind a lazy `await import('./trends-charts.js')`
 * (D-25's lazy-chunk-boundary discipline) — this module's own static import
 * graph never pulls in Chart.js. Every await point (the initial parallel
 * stats fetch and each tab's dynamic import) re-checks a `requestToken`,
 * the same discipline `detail.ts` uses for its activity-to-activity race —
 * a fast tab-to-tab switch here is a structurally identical navigation race
 * (T-18-RACE-02).
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES, NAV_ORDER } from '../view.types.js';
import type { IndexClient, FetchLike } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  TREND_TAB_KEYS,
  parseTrendTab,
  serializeTrendQuery,
  computeRollingTotals,
  type TrendTabKey,
  type RollingTotals,
} from './trends-logic.js';
import {
  buildVolumeSeries,
  buildYearGrid,
  listActivityYears,
  yearGridSummary,
  VOLUME_GRANULARITIES,
  type VolumeGranularity,
} from './trends-volume-logic.js';
import {
  parseYearOverYear,
  listYoyYears,
  defaultYoyYears,
  buildYoySeries,
  toggleYoyYear,
} from './trends-yoy-logic.js';
import { buildMonthlyChannelSeries } from './trends-cadence-hr-logic.js';
import {
  parseTrainingLoad,
  parseTrimpModel,
  parseLoadWindow,
  sliceLoadWindow,
  selectModelSeries,
  findThinCoverageSpans,
  coverageCaption,
  TRAINING_LOAD_WINDOWS,
  DEFAULT_LOAD_WINDOW,
  type TrimpModel,
  type LoadWindow,
} from './trends-training-load-logic.js';
import type { TrainingLoadDocument } from '../../analytics/training-load.types.js';
import {
  parseGearAggregate,
  sortShoes,
  buildGearChartBuckets,
  coverageSentence,
  type GearSortKey,
} from './trends-gear-logic.js';
import type { GearShoeAggregate } from '../../analytics/gear-aggregate.types.js';
import { formatPace, formatActivityDate } from './list.js';

const STATS_BASE_URL = 'data/stats/';

const TAB_LABELS: Record<TrendTabKey, string> = {
  volume: 'Volume',
  yoy: 'Year-over-Year',
  'cadence-hr': 'Cadence & HR',
  'training-load': 'Training Load',
  gear: 'Gear',
};

const TRENDS_NAV_ENTRY = NAV_ORDER.find((entry) => entry.route === ROUTES.TRENDS);

/** Everything the page fetches once, on mount, shared by every tab. */
interface TrendsRawData {
  rows: DashboardIndexRow[];
  weekly: unknown;
  monthly: unknown;
  yearly: unknown;
  yoy: unknown;
}

/** A live tab's mounted chart handle(s) — destroyed on every tab switch (18-UI-SPEC § 7's locked destroy-and-rebuild decision). */
interface ChartHandle {
  destroy(): void;
}

/**
 * Fetches and parses a small stats JSON file, degrading to `null` on any
 * failure (missing gitignored/regenerated file, network error, bad JSON) —
 * mirrors `records.ts`'s/`overview.ts`'s identical helper.
 */
async function fetchStatsJson<T>(url: string, doFetch: FetchLike): Promise<T | null> {
  try {
    const response = await doFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Error state — the exact three-part formula (heading + body + Retry),
// copied character-for-character from 18-UI-SPEC's Copywriting Contract.
// ---------------------------------------------------------------------------

function renderErrorState(container: HTMLElement, onRetry: () => void): void {
  container.replaceChildren();

  const errorState = document.createElement('section');
  errorState.className = 'error-state';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = "Couldn't load trends";
  errorState.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent = 'Check your connection and try again.';
  errorState.appendChild(body);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'cta';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', onRetry);
  errorState.appendChild(retryBtn);

  container.appendChild(errorState);
}

// ---------------------------------------------------------------------------
// Rolling-totals strip (18-UI-SPEC § 13) — page-global focal point, above
// the tablist, present regardless of which tab is open.
// ---------------------------------------------------------------------------

function buildRollingTile(km: number, runs: number, label: string): HTMLElement {
  const wrapper = document.createElement('div');

  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = `${km.toFixed(1)} km`;
  wrapper.appendChild(valueEl);

  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const runsEl = document.createElement('div');
  runsEl.className = 'text-label';
  runsEl.textContent = `${runs} run${runs === 1 ? '' : 's'}`;
  wrapper.appendChild(runsEl);

  return wrapper;
}

function buildRollingTotalsStrip(totals: RollingTotals): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  const grid = document.createElement('div');
  grid.className = 'stat-grid';

  grid.appendChild(buildRollingTile(totals.week.km, totals.week.runs, 'This Week'));
  grid.appendChild(buildRollingTile(totals.month.km, totals.month.runs, 'This Month'));
  grid.appendChild(buildRollingTile(totals.yearToDate.km, totals.yearToDate.runs, 'This Year to Date'));

  card.appendChild(grid);
  return card;
}

// ---------------------------------------------------------------------------
// Tablist (18-UI-SPEC § 7) — real ARIA tablist, roving tabindex, automatic
// activation on Left/Right/Home/End. Distinct from the `.segmented`
// group-toggle pattern used INSIDE the Volume tab's granularity control
// (role="group" + a per-button pressed-state attribute) — this outer bar
// needs `role="tablist"`/`"tab"`/`aria-selected` for 5 mutually-exclusive
// views.
// ---------------------------------------------------------------------------

function applyTabButtonState(btn: HTMLButtonElement, isActive: boolean): void {
  if (isActive) {
    btn.setAttribute('aria-selected', 'true');
    btn.tabIndex = 0;
    btn.className = 'segmented__option segmented__option--active';
  } else {
    btn.setAttribute('aria-selected', 'false');
    btn.tabIndex = -1;
    btn.className = 'segmented__option';
  }
}

function buildTabButton(tab: TrendTabKey, isActive: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = `tab-${tab}`;
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-controls', `tabpanel-${tab}`);
  btn.textContent = TAB_LABELS[tab];
  applyTabButtonState(btn, isActive);
  return btn;
}

function buildTabpanel(tab: TrendTabKey, isActive: boolean): HTMLElement {
  const panel = document.createElement('div');
  panel.id = `tabpanel-${tab}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${tab}`);
  panel.tabIndex = 0;
  if (!isActive) {
    panel.hidden = true;
  }
  return panel;
}

/** The exact existing `.loading-indicator` markup (`role="status"`), reused verbatim per 18-UI-SPEC § 7/§ 15. */
function showTabLoading(panel: HTMLElement, tab: TrendTabKey): void {
  panel.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'loading-indicator';
  loading.setAttribute('role', 'status');
  loading.textContent = `Loading ${TAB_LABELS[tab]}…`;
  panel.appendChild(loading);
}

// ---------------------------------------------------------------------------
// Gear tab table (18-UI-SPEC § 12) — click-to-sort column headers mirroring
// `list.ts`'s `buildHeaderRow`/`buildSortArrowSvg` shape (not exported from
// that module, so this is a genuine, full reuse of the SAME pattern against
// a tiny ≤17-row dataset, not a re-derivation of a different one).
// ---------------------------------------------------------------------------

const GEAR_SVG_NS = 'http://www.w3.org/2000/svg';

function buildGearSortArrowSvg(dir: 'asc' | 'desc'): SVGSVGElement {
  const svg = document.createElementNS(GEAR_SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(GEAR_SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', dir === 'asc' ? 'M5 1 L9 8 L1 8 Z' : 'M1 2 L9 2 L5 9 Z');
  svg.appendChild(path);
  return svg;
}

interface GearColumnDef {
  key: GearSortKey | null;
  label: string;
  numeric: boolean;
}

/** Exactly seven columns, in this order (18-UI-SPEC § 12). Coverage % has no sort key — it is derived per row, mirroring list.ts's null-key Activity/Status columns. */
const GEAR_COLUMNS: readonly GearColumnDef[] = [
  { key: 'label', label: 'Shoe', numeric: false },
  { key: 'distanceM', label: 'Distance', numeric: true },
  { key: 'runs', label: 'Runs', numeric: true },
  { key: 'avgPaceSecPerKm', label: 'Avg Pace', numeric: true },
  { key: 'avgHr', label: 'Avg HR', numeric: true },
  { key: 'firstDate', label: 'Date Range', numeric: false },
  { key: null, label: 'Coverage %', numeric: true },
];

const GEAR_DEFAULT_DIR: Readonly<Record<GearSortKey, 'asc' | 'desc'>> = {
  label: 'asc',
  distanceM: 'desc',
  runs: 'desc',
  avgPaceSecPerKm: 'asc',
  avgHr: 'desc',
  firstDate: 'desc',
};

/** Applies the same click/select semantics as `list.ts`'s `nextSortState`: clicking the active column flips direction, clicking a different one resets to that column's default. */
function buildGearHeaderRow(
  sort: GearSortKey,
  dir: 'asc' | 'desc',
  onSort: (key: GearSortKey) => void
): HTMLTableRowElement {
  const tr = document.createElement('tr');

  for (const col of GEAR_COLUMNS) {
    const th = document.createElement('th');

    if (col.key === null) {
      th.textContent = col.label;
      th.setAttribute('aria-sort', 'none');
      tr.appendChild(th);
      continue;
    }

    const key = col.key;
    const isActive = sort === key;
    th.setAttribute('aria-sort', isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'activity-table__sort-button';
    btn.textContent = col.label;

    if (isActive) {
      const arrowWrap = document.createElement('span');
      arrowWrap.className = 'activity-table__sort-arrow';
      arrowWrap.appendChild(buildGearSortArrowSvg(dir));
      btn.appendChild(arrowWrap);
    }

    btn.addEventListener('click', () => onSort(key));
    th.appendChild(btn);
    tr.appendChild(th);
  }

  return tr;
}

/**
 * Builds one gear table row. Every athlete-authored/derived string is
 * assigned via `textContent` — never an HTML-string assignment — per
 * T-18-XSS-01: shoe names are blank today but will carry athlete-typed free
 * text once `data/config/gear.json` is filled in.
 */
function buildGearTableRow(shoe: GearShoeAggregate, totalDistanceM: number): HTMLTableRowElement {
  const tr = document.createElement('tr');

  const shoeTd = document.createElement('td');
  shoeTd.textContent = shoe.label;
  tr.appendChild(shoeTd);

  const distanceTd = document.createElement('td');
  distanceTd.className = 'pr-table__numeric';
  distanceTd.textContent = `${(shoe.distanceM / 1000).toFixed(1)} km`;
  tr.appendChild(distanceTd);

  const runsTd = document.createElement('td');
  runsTd.className = 'pr-table__numeric';
  runsTd.textContent = String(shoe.runs);
  tr.appendChild(runsTd);

  const paceTd = document.createElement('td');
  paceTd.className = 'pr-table__numeric';
  paceTd.textContent = formatPace(shoe.avgPaceSecPerKm);
  tr.appendChild(paceTd);

  const hrTd = document.createElement('td');
  hrTd.className = 'pr-table__numeric';
  hrTd.textContent = shoe.avgHr === null ? '—' : `${Math.round(shoe.avgHr)} bpm`;
  tr.appendChild(hrTd);

  const dateRangeTd = document.createElement('td');
  dateRangeTd.textContent =
    shoe.firstDate !== null && shoe.lastDate !== null
      ? `${formatActivityDate(shoe.firstDate)} – ${formatActivityDate(shoe.lastDate)}`
      : '—';
  tr.appendChild(dateRangeTd);

  const coverageTd = document.createElement('td');
  coverageTd.className = 'pr-table__numeric';
  const coveragePercent = totalDistanceM > 0 ? (shoe.distanceM / totalDistanceM) * 100 : 0;
  coverageTd.textContent = `${coveragePercent.toFixed(1)}%`;
  tr.appendChild(coverageTd);

  return tr;
}

/**
 * Updates the visible URL to `#/trends?tab=...` WITHOUT firing `hashchange`
 * — see this file's header comment for why `history.pushState` is used
 * instead of `router.ts`'s `navigateTo`.
 */
function updateTabUrl(tab: TrendTabKey): void {
  const query = serializeTrendQuery(tab);
  const queryString = query.toString().length > 0 ? `?${query.toString()}` : '';
  const newHash = `#${ROUTES.TRENDS}${queryString}`;
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash);
  }
}

// ---------------------------------------------------------------------------
// View factory
// ---------------------------------------------------------------------------

export interface TrendsViewDeps {
  indexClient: IndexClient;
  fetchImpl?: FetchLike;
}

export function createTrendsView(deps: TrendsViewDeps): DashboardView {
  let mountedContainer: HTMLElement | null = null;
  let requestToken = 0;
  let activeTab: TrendTabKey = 'volume';
  let activeChartHandle: ChartHandle | null = null;
  let data: TrendsRawData | null = null;
  let tabButtons: Partial<Record<TrendTabKey, HTMLButtonElement>> = {};
  let tabPanels: Partial<Record<TrendTabKey, HTMLElement>> = {};

  // Volume tab's own within-tab state (18-UI-SPEC § 8) — survives a
  // granularity/year change (destroy-and-rebuild the chart only), but not a
  // full page remount (reset on unmount()).
  let volumeGranularity: VolumeGranularity = 'weekly';
  let volumeYear: number | null = null;

  // Year-over-Year tab's own within-tab state (18-UI-SPEC § 9) — the set of
  // selected years, defaulted to the 3 most recent on first activation.
  let yoySelectedYears: number[] = [];

  // Training Load tab's own within-tab state (18-UI-SPEC § 11) — the parsed
  // document (this tab's own fetch, not part of the shared TrendsRawData),
  // the TRIMP model toggle (D-14, default Edwards), and the display window
  // (D-16, default 12mo — the underlying series always covers the full
  // archive; only the DISPLAYED window is scoped).
  let trainingLoadDoc: TrainingLoadDocument | null = null;
  let trimpModel: TrimpModel = 'edwards';
  let loadWindow: LoadWindow = DEFAULT_LOAD_WINDOW;

  // Gear tab's own within-tab state (18-UI-SPEC § 12) — the active sort
  // column/direction; re-sorting rebuilds nothing on the canvas (the chart
  // is unaffected by table sort order).
  let gearSort: GearSortKey = 'distanceM';
  let gearSortDir: 'asc' | 'desc' = 'desc';

  function destroyActiveChart(): void {
    activeChartHandle?.destroy();
    activeChartHandle = null;
  }

  /**
   * Builds the Volume tab's year consistency heatmap (18-UI-SPEC § 8): a
   * native `<select>` year picker, a 53x7 CSS-grid heatmap whose 371 cells
   * are never individually focusable or clickable (T-18-A11Y-03), one
   * summarizing `aria-label` on the grid container, and a disclosure
   * (labelled below) carrying the same day-by-day data as a real HTML
   * table — the accessible-equivalent content the grid itself cannot
   * provide.
   */
  function buildYearHeatmapSection(rows: readonly DashboardIndexRow[]): HTMLElement {
    const section = document.createElement('div');

    const years = listActivityYears(rows);
    const fallbackYear = new Date().getUTCFullYear();
    const defaultYear = years[0] ?? fallbackYear;
    if (volumeYear === null || !years.includes(volumeYear)) {
      volumeYear = defaultYear;
    }

    const selectLabel = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = 'Year';
    selectLabel.appendChild(labelText);

    const select = document.createElement('select');
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      if (year === volumeYear) option.selected = true;
      select.appendChild(option);
    });
    selectLabel.appendChild(select);
    section.appendChild(selectLabel);

    const gridWrap = document.createElement('div');
    section.appendChild(gridWrap);

    function renderGridForYear(): void {
      gridWrap.replaceChildren();
      if (volumeYear === null) return;

      const cells = buildYearGrid(rows, volumeYear);
      const summary = yearGridSummary(cells);

      const grid = document.createElement('div');
      grid.className = 'year-heatmap';
      grid.setAttribute(
        'aria-label',
        `${summary.year ?? volumeYear} training consistency: ${summary.activeDays} active days, ${summary.totalKm.toFixed(0)} km`
      );

      for (const cell of cells) {
        const cellEl = document.createElement('div');
        // Interpolated from the cell's own computed tint — a rest day (tint
        // 0) reaches `--tint-0`, which the stylesheet renders with NO
        // accent at all (D-15).
        cellEl.className = `year-heatmap__cell year-heatmap__cell--tint-${cell.tint}`;
        cellEl.style.gridColumn = String(cell.week + 1);
        cellEl.style.gridRow = String(cell.dow + 1);
        cellEl.title = `${cell.dateISO}: ${cell.km.toFixed(1)} km`;
        grid.appendChild(cellEl);
      }

      gridWrap.appendChild(grid);

      const details = document.createElement('details');
      const detailsSummary = document.createElement('summary');
      detailsSummary.textContent = 'View as table';
      details.appendChild(detailsSummary);

      const table = document.createElement('table');
      table.className = 'activity-table pr-table';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const columnLabel of ['Date', 'Distance']) {
        const th = document.createElement('th');
        th.textContent = columnLabel;
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const cell of cells) {
        if (cell.runs === 0) continue;
        const tr = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.textContent = cell.dateISO;
        tr.appendChild(dateTd);
        const kmTd = document.createElement('td');
        kmTd.className = 'pr-table__numeric';
        kmTd.textContent = `${cell.km.toFixed(1)} km`;
        tr.appendChild(kmTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      details.appendChild(table);

      gridWrap.appendChild(details);
    }

    select.addEventListener('change', () => {
      volumeYear = Number(select.value);
      renderGridForYear();
    });

    renderGridForYear();

    return section;
  }

  /**
   * Mounts the Volume tab (18-UI-SPEC § 8): one chart plus a 3-way
   * `.segmented` granularity toggle (`role="group"` + a pressed-state
   * attribute — the correct pattern here, unlike the outer 5-way tablist)
   * and the year consistency heatmap. Switching granularity destroys the
   * live chart and mounts a fresh one — never an in-place dataset mutation.
   */
  async function renderVolumeTab(panel: HTMLElement, myToken: number): Promise<void> {
    if (!data) return;
    showTabLoading(panel, 'volume');

    const chartsModule = await import('./trends-charts.js');
    if (myToken !== requestToken || !mountedContainer) return;

    panel.replaceChildren();

    const GRANULARITY_LABELS: Record<VolumeGranularity, string> = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    };

    const controls = document.createElement('div');
    controls.className = 'segmented';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Volume granularity');

    const granularityButtons: Partial<Record<VolumeGranularity, HTMLButtonElement>> = {};

    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);

    function mountChartForGranularity(): void {
      if (!data) return;
      destroyActiveChart();
      const points = buildVolumeSeries(data.weekly, data.monthly, data.yearly, volumeGranularity);
      activeChartHandle = chartsModule.mountVolumeChart(canvas, points, volumeGranularity);
    }

    VOLUME_GRANULARITIES.forEach((granularity) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = GRANULARITY_LABELS[granularity];
      const isActive = granularity === volumeGranularity;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.className = isActive ? 'segmented__option segmented__option--active' : 'segmented__option';
      btn.addEventListener('click', () => {
        if (volumeGranularity === granularity) return;
        volumeGranularity = granularity;
        VOLUME_GRANULARITIES.forEach((g) => {
          const b = granularityButtons[g];
          if (!b) return;
          const active = g === volumeGranularity;
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
          b.className = active ? 'segmented__option segmented__option--active' : 'segmented__option';
        });
        mountChartForGranularity();
      });
      controls.appendChild(btn);
      granularityButtons[granularity] = btn;
    });

    panel.appendChild(controls);
    panel.appendChild(canvasWrap);

    mountChartForGranularity();

    panel.appendChild(buildYearHeatmapSection(data.rows));
  }

  /**
   * Mounts the Year-over-Year tab (18-UI-SPEC § 9): a `.chip-row` of
   * `.preset-chip` year toggles (defaulting to the 3 most recent years)
   * plus one grouped-bar chart. Selecting or deselecting a year always
   * destroys and rebuilds the chart — never mutates a live instance's
   * datasets in place (the "Canvas is already in use" defect class).
   */
  async function renderYoyTab(panel: HTMLElement, myToken: number): Promise<void> {
    if (!data) return;
    showTabLoading(panel, 'yoy');

    const chartsModule = await import('./trends-charts.js');
    if (myToken !== requestToken || !mountedContainer) return;

    panel.replaceChildren();

    const months = parseYearOverYear(data.yoy);

    if (months.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const heading = document.createElement('h3');
      heading.className = 'text-heading';
      heading.textContent = 'No year-over-year data yet';
      empty.appendChild(heading);
      const body = document.createElement('p');
      body.className = 'text-body';
      body.textContent =
        'Once more than one year of activity is recorded, a year-over-year comparison will appear here.';
      empty.appendChild(body);
      panel.appendChild(empty);
      return;
    }

    const orderedMonths = [...months].sort((a, b) => a.month - b.month);
    const monthLabels = orderedMonths.map((m) => m.monthLabel);
    const availableYears = listYoyYears(orderedMonths);

    if (yoySelectedYears.length === 0 || yoySelectedYears.some((year) => !availableYears.includes(year))) {
      yoySelectedYears = defaultYoyYears(orderedMonths);
    }

    const chipRow = document.createElement('div');
    chipRow.className = 'chip-row';

    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);

    function mountYoyForSelection(): void {
      destroyActiveChart();
      const series = buildYoySeries(orderedMonths, yoySelectedYears);
      activeChartHandle = chartsModule.mountYoyChart(canvas, series, monthLabels);
    }

    function renderChips(): void {
      chipRow.replaceChildren();
      availableYears.forEach((year) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = String(year);
        const isSelected = yoySelectedYears.includes(year);
        chip.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        chip.addEventListener('click', () => {
          // toggleYoyYear's own never-empty guard means the UI never needs
          // a duplicate "is this the last one" check here.
          yoySelectedYears = toggleYoyYear(yoySelectedYears, year, availableYears);
          renderChips();
          mountYoyForSelection();
        });
        chipRow.appendChild(chip);
      });
    }

    renderChips();
    panel.appendChild(chipRow);
    panel.appendChild(canvasWrap);
    mountYoyForSelection();
  }

  /**
   * Mounts the Cadence & HR tab (18-UI-SPEC § 10): two stacked, pinned-gutter
   * single-axis bands (monthly average cadence, monthly average heart rate)
   * computed client-side from the already-fetched index rows via
   * `buildMonthlyChannelSeries`. A plain-numbers caption below states how
   * many months have no data for each channel — derived from the series,
   * never a hardcoded claim.
   */
  async function renderCadenceHrTab(panel: HTMLElement, myToken: number): Promise<void> {
    if (!data) return;
    showTabLoading(panel, 'cadence-hr');

    const chartsModule = await import('./trends-charts.js');
    if (myToken !== requestToken || !mountedContainer) return;

    panel.replaceChildren();

    const cadenceSeries = buildMonthlyChannelSeries(data.rows, 'cadence');
    const hrSeries = buildMonthlyChannelSeries(data.rows, 'hr');

    const chartRoot = document.createElement('div');
    panel.appendChild(chartRoot);

    destroyActiveChart();
    activeChartHandle = chartsModule.mountChannelBands(chartRoot, cadenceSeries, hrSeries);

    const cadenceMissingMonths = cadenceSeries.filter((point) => point.value === null).length;
    const hrMissingMonths = hrSeries.filter((point) => point.value === null).length;

    const caption = document.createElement('p');
    caption.className = 'text-label';
    caption.textContent =
      `${cadenceMissingMonths} month${cadenceMissingMonths === 1 ? '' : 's'} with no cadence data; ` +
      `${hrMissingMonths} month${hrMissingMonths === 1 ? '' : 's'} with no heart rate data.`;
    panel.appendChild(caption);
  }

  /**
   * Mounts the Training Load tab (18-UI-SPEC § 11, D-13/D-14/D-15/D-16):
   * fetches `data/stats/training-load.json` (this tab's own fetch, guarded
   * by the shared `requestToken`), an Edwards/Banister model toggle
   * (`role="group"` + `aria-pressed` — correct here, unlike the outer
   * tablist) that is a PURE client-side re-render (both series already live
   * in the one fetched document), a 3mo/12mo/All window control that scopes
   * only the DISPLAYED slice, and the thin-HR-coverage shading + caption —
   * the phase's single most load-bearing honesty requirement.
   */
  async function renderTrainingLoadTab(panel: HTMLElement, myToken: number): Promise<void> {
    showTabLoading(panel, 'training-load');

    const doFetch = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    const [chartsModule, rawDoc] = await Promise.all([
      import('./trends-charts.js'),
      fetchStatsJson<unknown>(`${STATS_BASE_URL}training-load.json`, doFetch),
    ]);
    if (myToken !== requestToken || !mountedContainer) return;

    trainingLoadDoc = parseTrainingLoad(rawDoc);
    panel.replaceChildren();

    if (trainingLoadDoc === null) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const heading = document.createElement('h3');
      heading.className = 'text-heading';
      heading.textContent = 'No training load data yet';
      empty.appendChild(heading);
      const body = document.createElement('p');
      body.className = 'text-body';
      body.textContent = 'Training load will appear here once the archive has been processed.';
      empty.appendChild(body);
      panel.appendChild(empty);
      return;
    }

    const doc = trainingLoadDoc;

    // Re-clamp the in-memory model selection against THIS document — a
    // stored 'banister' selection can never survive an unconfigured model.
    trimpModel = parseTrimpModel(trimpModel, doc);
    loadWindow = parseLoadWindow(loadWindow);

    const banisterUnavailable = doc.models.banister === false;

    // -- TRIMP model toggle (a genuine two-state toggle, role="group") -----

    const modelGroup = document.createElement('div');
    modelGroup.className = 'segmented';
    modelGroup.setAttribute('role', 'group');
    modelGroup.setAttribute('aria-label', 'TRIMP model');

    const edwardsBtn = document.createElement('button');
    edwardsBtn.type = 'button';
    edwardsBtn.textContent = 'Edwards';

    const banisterBtn = document.createElement('button');
    banisterBtn.type = 'button';
    banisterBtn.textContent = 'Banister';
    // The option stays visible but DISABLED when unconfigured — the model
    // still exists, it just is not configured (D-13, 17-D31 precedent).
    banisterBtn.disabled = banisterUnavailable;

    function updateModelButtons(): void {
      const isEdwards = trimpModel === 'edwards';
      edwardsBtn.setAttribute('aria-pressed', isEdwards ? 'true' : 'false');
      edwardsBtn.className = isEdwards ? 'segmented__option segmented__option--active' : 'segmented__option';
      banisterBtn.setAttribute('aria-pressed', isEdwards ? 'false' : 'true');
      banisterBtn.className = !isEdwards ? 'segmented__option segmented__option--active' : 'segmented__option';
    }
    updateModelButtons();

    edwardsBtn.addEventListener('click', () => {
      if (trimpModel === 'edwards') return;
      trimpModel = 'edwards';
      updateModelButtons();
      rebuildChart();
    });
    banisterBtn.addEventListener('click', () => {
      if (banisterBtn.disabled || trimpModel === 'banister') return;
      trimpModel = 'banister';
      updateModelButtons();
      rebuildChart();
    });

    modelGroup.appendChild(edwardsBtn);
    modelGroup.appendChild(banisterBtn);
    panel.appendChild(modelGroup);

    if (banisterUnavailable) {
      const notice = document.createElement('div');
      notice.className = 'config-notice';
      notice.textContent =
        doc.banisterDisabledReason ??
        'Training load is off — add birthDate, sex, and restingHr to data/private/athlete-private.json to enable it.';
      panel.appendChild(notice);
    }

    // -- Window control (scopes only the DISPLAYED slice, D-16) ------------

    const WINDOW_LABELS: Record<LoadWindow, string> = { '3mo': '3mo', '12mo': '12mo', all: 'All' };
    const windowButtons: Partial<Record<LoadWindow, HTMLButtonElement>> = {};

    const windowGroup = document.createElement('div');
    windowGroup.className = 'segmented';
    windowGroup.setAttribute('role', 'group');
    windowGroup.setAttribute('aria-label', 'Training load window');

    function updateWindowButtons(): void {
      TRAINING_LOAD_WINDOWS.forEach((w) => {
        const btn = windowButtons[w];
        if (!btn) return;
        const active = w === loadWindow;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.className = active ? 'segmented__option segmented__option--active' : 'segmented__option';
      });
    }

    TRAINING_LOAD_WINDOWS.forEach((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = WINDOW_LABELS[w];
      btn.addEventListener('click', () => {
        if (loadWindow === w) return;
        loadWindow = w;
        updateWindowButtons();
        rebuildChart();
      });
      windowGroup.appendChild(btn);
      windowButtons[w] = btn;
    });
    updateWindowButtons();
    panel.appendChild(windowGroup);

    // -- Chart + empty-model state + caption --------------------------------

    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);
    panel.appendChild(canvasWrap);

    const emptyModelState = document.createElement('div');
    emptyModelState.className = 'empty-state';
    emptyModelState.hidden = true;
    const emptyHeading = document.createElement('h3');
    emptyHeading.className = 'text-heading';
    emptyHeading.textContent = 'No data for this model';
    emptyModelState.appendChild(emptyHeading);
    const emptyBody = document.createElement('p');
    emptyBody.className = 'text-body';
    emptyBody.textContent = 'This model has no computed data for the selected window.';
    emptyModelState.appendChild(emptyBody);
    panel.appendChild(emptyModelState);

    const caption = document.createElement('p');
    caption.className = 'text-label';
    panel.appendChild(caption);

    function rebuildChart(): void {
      destroyActiveChart();

      // `now` is constructed HERE, in the view, never inside
      // trends-training-load-logic.ts (that module stays deterministic and
      // total under vitest's node environment).
      const windowedDays = sliceLoadWindow(doc.days, loadWindow, new Date());
      const points = selectModelSeries(windowedDays, trimpModel);
      const spans = findThinCoverageSpans(windowedDays);

      if (points.length === 0) {
        canvasWrap.hidden = true;
        emptyModelState.hidden = false;
        caption.textContent = '';
        return;
      }

      canvasWrap.hidden = false;
      emptyModelState.hidden = true;
      activeChartHandle = chartsModule.mountTrainingLoadChart(canvas, points, spans);
      caption.textContent = coverageCaption(spans);
    }

    rebuildChart();
  }

  /**
   * Mounts the Gear tab (18-UI-SPEC § 12, decisions D17/D18/D19): a coverage
   * sentence FIRST (above everything else, so a reader sees the real
   * coverage numbers before the picture, per D-18), a top-8-plus-Other bar
   * chart with its own caption, and a sortable table listing every shoe
   * including an always-present Unknown row (its label comes from the
   * fetched data — `UNKNOWN_GEAR_LABEL` via the aggregate — never a literal
   * in this view). Re-sorting the table never touches the canvas; the chart
   * is unaffected by table sort order.
   */
  async function renderGearTab(panel: HTMLElement, myToken: number): Promise<void> {
    showTabLoading(panel, 'gear');

    const doFetch = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    const [chartsModule, rawDoc] = await Promise.all([
      import('./trends-charts.js'),
      fetchStatsJson<unknown>(`${STATS_BASE_URL}gear-aggregate.json`, doFetch),
    ]);
    if (myToken !== requestToken || !mountedContainer) return;

    const gearDoc = parseGearAggregate(rawDoc);
    panel.replaceChildren();

    if (gearDoc === null) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const heading = document.createElement('h3');
      heading.className = 'text-heading';
      heading.textContent = 'No gear data yet';
      empty.appendChild(heading);
      const body = document.createElement('p');
      body.className = 'text-body';
      body.textContent = 'Gear coverage will appear here once it has been computed.';
      empty.appendChild(body);
      panel.appendChild(empty);
      return;
    }

    // Captured into its own `const` (rather than relying on narrowing of
    // `gearDoc` inside the nested `renderTable` closure below, which
    // TypeScript's control-flow analysis does not carry through a function
    // declaration hoisted above the narrowing check).
    const shoes: readonly GearShoeAggregate[] = gearDoc.shoes;

    // Coverage sentence FIRST — D-18's real coverage in plain numbers,
    // above the chart so a reader sees the caveat before the picture.
    const coverageEl = document.createElement('p');
    coverageEl.className = 'text-body';
    coverageEl.textContent = coverageSentence(gearDoc.totals, gearDoc.byYear);
    panel.appendChild(coverageEl);

    // Bar chart, top 8 named shoes plus one merged Other bar.
    const { buckets, caption: chartCaption } = buildGearChartBuckets(shoes);

    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);
    panel.appendChild(canvasWrap);

    if (chartCaption.length > 0) {
      const chartCaptionEl = document.createElement('p');
      chartCaptionEl.className = 'text-label';
      chartCaptionEl.textContent = chartCaption;
      panel.appendChild(chartCaptionEl);
    }

    destroyActiveChart();
    activeChartHandle = chartsModule.mountGearChart(canvas, buckets);

    // Sortable table — every shoe including the always-present Unknown row.
    const totalDistanceM = shoes.reduce((sum, s) => sum + s.distanceM, 0);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'activity-table-wrapper';
    const table = document.createElement('table');
    table.className = 'activity-table pr-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);

    function renderTable(): void {
      thead.replaceChildren(
        buildGearHeaderRow(gearSort, gearSortDir, (key) => {
          if (gearSort === key) {
            gearSortDir = gearSortDir === 'asc' ? 'desc' : 'asc';
          } else {
            gearSort = key;
            gearSortDir = GEAR_DEFAULT_DIR[key];
          }
          renderTable();
        })
      );

      const sorted = sortShoes(shoes, gearSort, gearSortDir);
      tbody.replaceChildren(...sorted.map((shoe) => buildGearTableRow(shoe, totalDistanceM)));
    }

    renderTable();
  }

  /**
   * Renders whichever tab is now active into its (already-mounted) panel.
   */
  async function renderActiveTabContent(tab: TrendTabKey, myToken: number): Promise<void> {
    const panel = tabPanels[tab];
    if (!panel || !data) return;
    switch (tab) {
      case 'volume':
        await renderVolumeTab(panel, myToken);
        break;
      case 'yoy':
        await renderYoyTab(panel, myToken);
        break;
      case 'cadence-hr':
        await renderCadenceHrTab(panel, myToken);
        break;
      case 'training-load':
        await renderTrainingLoadTab(panel, myToken);
        break;
      case 'gear':
        await renderGearTab(panel, myToken);
        break;
    }
  }

  function switchTab(tab: TrendTabKey, focusButton: boolean): void {
    if (tab === activeTab) {
      if (focusButton) tabButtons[tab]?.focus();
      return;
    }

    const previousButton = tabButtons[activeTab];
    const previousPanel = tabPanels[activeTab];
    if (previousButton) applyTabButtonState(previousButton, false);
    if (previousPanel) previousPanel.hidden = true;

    destroyActiveChart();

    activeTab = tab;
    const nextButton = tabButtons[tab];
    const nextPanel = tabPanels[tab];
    if (nextButton) {
      applyTabButtonState(nextButton, true);
      if (focusButton) nextButton.focus();
    }
    if (nextPanel) nextPanel.hidden = false;

    updateTabUrl(tab);

    const myToken = ++requestToken;
    void renderActiveTabContent(tab, myToken);
  }

  function buildTablistAndPanels(initialTab: TrendTabKey): { tablist: HTMLElement; panelsWrap: HTMLElement } {
    tabButtons = {};
    tabPanels = {};

    const tablist = document.createElement('div');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Trends views');
    tablist.className = 'segmented';

    const panelsWrap = document.createElement('div');

    TREND_TAB_KEYS.forEach((tab) => {
      const isActive = tab === initialTab;
      const btn = buildTabButton(tab, isActive);

      btn.addEventListener('click', () => switchTab(tab, false));
      btn.addEventListener('keydown', (event) => {
        const currentIndex = TREND_TAB_KEYS.indexOf(tab);
        let nextIndex: number | null = null;
        if (event.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + TREND_TAB_KEYS.length) % TREND_TAB_KEYS.length;
        } else if (event.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % TREND_TAB_KEYS.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = TREND_TAB_KEYS.length - 1;
        }
        if (nextIndex !== null) {
          event.preventDefault();
          switchTab(TREND_TAB_KEYS[nextIndex], true);
        }
      });

      tablist.appendChild(btn);
      tabButtons[tab] = btn;

      const panel = buildTabpanel(tab, isActive);
      panelsWrap.appendChild(panel);
      tabPanels[tab] = panel;
    });

    return { tablist, panelsWrap };
  }

  async function load(ctx: ViewMountContext): Promise<void> {
    destroyActiveChart();
    ctx.container.replaceChildren();

    const loading = document.createElement('div');
    loading.className = 'loading-indicator';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading trends…';
    ctx.container.appendChild(loading);

    const myToken = ++requestToken;
    const doFetch = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

    let rawData: TrendsRawData;
    try {
      const [, weekly, monthly, yearly, yoy] = await Promise.all([
        deps.indexClient.loadIndex(),
        fetchStatsJson<unknown>(`${STATS_BASE_URL}weekly-distance.json`, doFetch),
        fetchStatsJson<unknown>(`${STATS_BASE_URL}monthly-stats.json`, doFetch),
        fetchStatsJson<unknown>(`${STATS_BASE_URL}yearly-stats.json`, doFetch),
        fetchStatsJson<unknown>(`${STATS_BASE_URL}year-over-year.json`, doFetch),
      ]);
      rawData = { rows: deps.indexClient.getRows(), weekly, monthly, yearly, yoy };
    } catch (error) {
      console.error(error);
      if (myToken !== requestToken || mountedContainer !== ctx.container) return;
      renderErrorState(ctx.container, () => {
        void load(ctx);
      });
      return;
    }

    // mount() may resolve after the view was unmounted, or a fast
    // navigation away superseded this load — never paint into a container
    // this view no longer owns.
    if (myToken !== requestToken || mountedContainer !== ctx.container) return;

    data = rawData;
    ctx.container.replaceChildren();

    const view = document.createElement('div');
    view.className = 'view';

    const h1 = document.createElement('h1');
    h1.className = 'text-heading';
    h1.textContent = 'Trends';
    h1.tabIndex = -1;
    view.appendChild(h1);

    // `now` is constructed HERE, never inside trends-logic.ts (that module
    // stays deterministic and total under vitest's node environment).
    const totals = computeRollingTotals(rawData.rows, new Date());
    view.appendChild(buildRollingTotalsStrip(totals));

    activeTab = parseTrendTab(ctx.query.get('tab'));
    const { tablist, panelsWrap } = buildTablistAndPanels(activeTab);
    view.appendChild(tablist);
    view.appendChild(panelsWrap);

    ctx.container.appendChild(view);

    // Every hash navigation announces a context change to assistive tech
    // (17-UI-SPEC § 5 Cross-Surface focus management), same discipline as
    // every other Phase 16/17/18 view.
    h1.focus();

    void renderActiveTabContent(activeTab, myToken);
  }

  return {
    route: ROUTES.TRENDS,
    title: 'Trends',
    navEntry: TRENDS_NAV_ENTRY,

    async mount(ctx: ViewMountContext): Promise<void> {
      mountedContainer = ctx.container;
      await load(ctx);
    },

    unmount(): void {
      requestToken++; // invalidate any in-flight request or tab render
      destroyActiveChart();
      mountedContainer?.replaceChildren();
      mountedContainer = null;
      data = null;
      tabButtons = {};
      tabPanels = {};
    },
  };
}
