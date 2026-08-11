/**
 * Activities list view — renders real index rows end to end.
 *
 * Paginated, sortable activity browser (BROWSE-01..04, BROWSE-06): a real
 * `<table>` renders above 720px with clickable, aria-sort-annotated column
 * headers; at or below 720px the shared `renderActivityRow` card layout
 * renders instead, with an equivalent sort `<select>`. Sort key, direction,
 * and page all round-trip through the hash query string via
 * `parseListQuery`/`serializeListQuery` (`list-logic.ts`), so back/forward
 * and bookmarking work for free. All sort/filter/paginate arithmetic lives
 * in `list-logic.ts` — this file is DOM construction and event wiring only.
 *
 * `renderActivityRow` is exported so `overview.ts` reuses the exact same row
 * markup — one row renderer, two views.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import { navigateTo } from '../router.js';
import type { SortKey, SortDir, ListState } from './list-logic.js';
import {
  DEFAULT_DIR,
  parseListQuery,
  serializeListQuery,
  filterRows,
  sortRows,
  paginate,
} from './list-logic.js';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a `startDateLocal` value as e.g. "Jan 15, 2024". The archive
 * contains two shapes, both wall-clock LOCAL time — never UTC:
 * Strava-era rows are Z-suffixed (`2024-01-15T09:00:00Z`, Strava's own
 * convention), while intervals.icu-migrated rows have no `Z`
 * (`2026-08-06T07:28:22`). Appending `Z` to the no-Z form before parsing
 * makes the subsequent `getUTC*` reads return the wall-clock components
 * unchanged, instead of the viewer's browser shifting them by its own UTC
 * offset (WR-02). This is the single date formatter for list, overview and
 * detail — no view may add its own.
 */
export function formatActivityDate(isoLocal: string): string {
  if (typeof isoLocal !== 'string') return '—';
  const normalized = isoLocal.endsWith('Z') ? isoLocal : `${isoLocal}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Formats a duration in seconds as `h:mm:ss`. Exported so `detail.ts` and
 * `detail-sections.ts` import it rather than each keeping their own copy —
 * one duration formatter, the same discipline already applied to
 * `formatActivityDate` and `formatPace`.
 */
export function formatDurationHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a pace in seconds-per-km as `m:ss/km`, or an em dash when null.
 *
 * Rounds to whole seconds BEFORE splitting into minutes and seconds. Deriving
 * the two components independently — `floor(s/60)` alongside `round(s % 60)` —
 * lets the seconds half round up to 60 while the minutes half stays put, so
 * 359.9 s/km rendered as "5:60/km" instead of "6:00/km". That hit 11 of the
 * 1,867 rows in the live index. Any future edit must keep a single rounding
 * step feeding both components.
 *
 * This is the ONE pace formatter in the dashboard — detail.ts imports it rather
 * than keeping its own copy, matching how formatActivityDate is shared. The
 * duplicate is why the defect had two homes; do not reintroduce one.
 */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function appendBadge(container: HTMLElement, text: string): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;
  container.appendChild(badge);
}

/**
 * Appends every applicable status badge to `container` — shared by
 * `renderActivityRow` (mobile card) and `buildTableRow` (desktop Status
 * cell) so the two surfaces show identical badges from one source of truth.
 */
function appendStatusBadges(container: HTMLElement, row: DashboardIndexRow): void {
  if (!row.streams.available) {
    appendBadge(container, row.streams.reason ? `No streams (${row.streams.reason})` : 'No streams');
  } else if (!row.streams.hr) {
    appendBadge(container, 'No HR');
  }

  if (row.lowConfidence) {
    appendBadge(container, 'Low confidence');
  }

  if (row.excludedFromRecords) {
    appendBadge(container, 'Excluded from records');
  }

  if (row.prCount > 0) {
    appendBadge(container, `${row.prCount} PR`);
  }
}

/**
 * Builds one `.activity-row`. Every athlete-authored string (`row.name`) is
 * written with `textContent` — an HTML-string assignment is never used —
 * per T-16-VW-01, the explicit deviation from `route-browser`'s known
 * unescaped-interpolation anti-pattern.
 */
export function renderActivityRow(row: DashboardIndexRow): HTMLElement {
  const rowEl = document.createElement('div');
  rowEl.className = 'activity-row';

  const nameEl = document.createElement('div');
  nameEl.className = 'activity-row__name';
  nameEl.textContent = row.name;
  rowEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'activity-row__meta';
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km · ${formatDurationHms(row.movingTimeSec)} · ${formatPace(row.paceSecPerKm)}`;
  rowEl.appendChild(metaEl);

  appendStatusBadges(rowEl, row);

  const cta = document.createElement('a');
  cta.className = 'cta';
  cta.textContent = 'View Activity';
  cta.href = `#/activity/${row.id}`;
  rowEl.appendChild(cta);

  return rowEl;
}

// ---------------------------------------------------------------------------
// URL-state navigation — every state change goes through here, never a
// direct DOM mutation and never a hand-written hash assignment (D-07).
// ---------------------------------------------------------------------------

function applyState(next: ListState): void {
  const query = serializeListQuery(next);
  navigateTo(ROUTES.LIST, query);
}

/**
 * Applies the D-03 click/select semantics: clicking the ALREADY-active
 * column flips its direction; clicking a different column resets to that
 * column's `DEFAULT_DIR`. Both actions reset `page` to 1 (D-05).
 */
function nextSortState(state: ListState, key: SortKey): ListState {
  if (state.sort === key) {
    return { ...state, dir: state.dir === 'asc' ? 'desc' : 'asc', page: 1 };
  }
  return { ...state, sort: key, dir: DEFAULT_DIR[key], page: 1 };
}

// ---------------------------------------------------------------------------
// Desktop table
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildSortArrowSvg(dir: SortDir): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', dir === 'asc' ? 'M5 1 L9 8 L1 8 Z' : 'M1 2 L9 2 L5 9 Z');
  svg.appendChild(path);
  return svg;
}

interface ColumnDef {
  key: SortKey | null;
  label: string;
}

/** Exactly seven columns, in this order (17-UI-SPEC § 1). */
const COLUMNS: readonly ColumnDef[] = [
  { key: 'date', label: 'Date' },
  { key: null, label: 'Activity' },
  { key: 'distance', label: 'Distance' },
  { key: 'movingTime', label: 'Moving Time' },
  { key: 'pace', label: 'Pace' },
  { key: 'avgHr', label: 'Avg HR' },
  { key: null, label: 'Status' },
];

function buildHeaderRow(state: ListState): HTMLTableRowElement {
  const tr = document.createElement('tr');

  for (const col of COLUMNS) {
    const th = document.createElement('th');

    if (col.key === null) {
      th.textContent = col.label;
      th.setAttribute('aria-sort', 'none');
      tr.appendChild(th);
      continue;
    }

    const key = col.key;
    const isActive = state.sort === key;
    th.setAttribute('aria-sort', isActive ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'activity-table__sort-button';
    btn.textContent = col.label;

    if (isActive) {
      const arrowWrap = document.createElement('span');
      arrowWrap.className = 'activity-table__sort-arrow';
      arrowWrap.appendChild(buildSortArrowSvg(state.dir));
      btn.appendChild(arrowWrap);
    }

    btn.addEventListener('click', () => applyState(nextSortState(state, key)));
    th.appendChild(btn);
    tr.appendChild(th);
  }

  return tr;
}

/**
 * Builds one desktop `<tr>`, separate from `renderActivityRow` (D-04, two
 * renderers each with one job). Keyboard users operate the Activity-cell
 * anchor (already Tab+Enter operable) — no `tabindex` on the `<tr>` itself.
 */
function buildTableRow(row: DashboardIndexRow): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.dataset.activityId = row.id;
  tr.addEventListener('click', (event) => {
    // The Activity-cell anchor already navigates on its own; do not
    // double-navigate when the click originated from it.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    navigateTo(`/activity/${row.id}`);
  });

  const distanceKm = (row.distanceM / 1000).toFixed(1);

  const dateTd = document.createElement('td');
  dateTd.textContent = formatActivityDate(row.startDateLocal);
  tr.appendChild(dateTd);

  const activityTd = document.createElement('td');
  const anchor = document.createElement('a');
  anchor.href = `#/activity/${row.id}`;
  anchor.textContent = row.name; // athlete free text — textContent only (T-17-VW-01)
  anchor.setAttribute(
    'aria-label',
    `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`
  );
  activityTd.appendChild(anchor);
  tr.appendChild(activityTd);

  const distanceTd = document.createElement('td');
  distanceTd.textContent = `${distanceKm} km`;
  tr.appendChild(distanceTd);

  const movingTimeTd = document.createElement('td');
  movingTimeTd.textContent = formatDurationHms(row.movingTimeSec);
  tr.appendChild(movingTimeTd);

  const paceTd = document.createElement('td');
  paceTd.textContent = formatPace(row.paceSecPerKm);
  tr.appendChild(paceTd);

  const avgHrTd = document.createElement('td');
  avgHrTd.textContent = row.avgHr !== null ? String(Math.round(row.avgHr)) : '—';
  tr.appendChild(avgHrTd);

  const statusTd = document.createElement('td');
  appendStatusBadges(statusTd, row);
  tr.appendChild(statusTd);

  return tr;
}

function buildDesktopTable(state: ListState, pageItems: readonly DashboardIndexRow[]): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'activity-table-wrapper';

  const table = document.createElement('table');
  table.className = 'activity-table';

  const thead = document.createElement('thead');
  thead.appendChild(buildHeaderRow(state));
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of pageItems) {
    tbody.appendChild(buildTableRow(row));
  }
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Mobile card mode — unchanged `renderActivityRow` cards, plus a sort
// `<select>` that is the D-03 mobile-equivalent of a header click.
// ---------------------------------------------------------------------------

const SORT_SELECT_OPTIONS: readonly { sort: SortKey; dir: SortDir; label: string }[] = [
  { sort: 'date', dir: 'desc', label: 'Date (newest)' },
  { sort: 'date', dir: 'asc', label: 'Date (oldest)' },
  { sort: 'distance', dir: 'desc', label: 'Distance (longest)' },
  { sort: 'distance', dir: 'asc', label: 'Distance (shortest)' },
  { sort: 'movingTime', dir: 'desc', label: 'Moving Time (longest)' },
  { sort: 'movingTime', dir: 'asc', label: 'Moving Time (shortest)' },
  { sort: 'pace', dir: 'asc', label: 'Pace (fastest)' },
  { sort: 'pace', dir: 'desc', label: 'Pace (slowest)' },
  { sort: 'avgHr', dir: 'desc', label: 'Avg HR (highest)' },
  { sort: 'avgHr', dir: 'asc', label: 'Avg HR (lowest)' },
];

function buildSortSelect(state: ListState): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'sort-select';
  select.setAttribute('aria-label', 'Sort activities');

  for (const opt of SORT_SELECT_OPTIONS) {
    const optionEl = document.createElement('option');
    optionEl.value = `${opt.sort}:${opt.dir}`;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }

  select.value = `${state.sort}:${state.dir}`;

  select.addEventListener('change', () => {
    const [sort, dir] = select.value.split(':') as [SortKey, SortDir];
    applyState({ ...state, sort, dir, page: 1 });
  });

  return select;
}

function buildMobileCardList(pageItems: readonly DashboardIndexRow[]): HTMLDivElement {
  const listEl = document.createElement('div');
  listEl.className = 'activity-list activity-list--cards';
  for (const row of pageItems) {
    listEl.appendChild(renderActivityRow(row));
  }
  return listEl;
}

// ---------------------------------------------------------------------------
// Pagination (D-05/D-06/D-08)
// ---------------------------------------------------------------------------

/**
 * Windows the numbered page buttons down to at most 7: page 1, the current
 * page's immediate neighbourhood, and the last page, with `'ellipsis'`
 * markers filling any gaps.
 */
function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  const pageSet = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) {
      pageSet.add(p);
    }
  }

  const sortedPages = Array.from(pageSet).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sortedPages.length; i++) {
    if (i > 0 && sortedPages[i] - sortedPages[i - 1] > 1) {
      result.push('ellipsis');
    }
    result.push(sortedPages[i]);
  }
  return result;
}

function buildPagination(clampedPage: number, totalPages: number, state: ListState): HTMLDivElement {
  const paginationEl = document.createElement('div');
  paginationEl.className = 'pagination';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination__button';
  prevBtn.textContent = '‹ Prev';
  prevBtn.disabled = clampedPage <= 1;
  prevBtn.addEventListener('click', () => applyState({ ...state, page: clampedPage - 1 }));
  paginationEl.appendChild(prevBtn);

  for (const item of buildPageList(clampedPage, totalPages)) {
    if (item === 'ellipsis') {
      const span = document.createElement('span');
      span.className = 'pagination__ellipsis';
      span.textContent = '…';
      paginationEl.appendChild(span);
      continue;
    }

    const pageNum = item;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      pageNum === clampedPage ? 'pagination__button pagination__button--current' : 'pagination__button';
    btn.textContent = String(pageNum);
    if (pageNum === clampedPage) {
      btn.setAttribute('aria-current', 'page');
    }
    btn.addEventListener('click', () => applyState({ ...state, page: pageNum }));
    paginationEl.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination__button';
  nextBtn.textContent = 'Next ›';
  nextBtn.disabled = clampedPage >= totalPages;
  nextBtn.addEventListener('click', () => applyState({ ...state, page: clampedPage + 1 }));
  paginationEl.appendChild(nextBtn);

  const label = document.createElement('span');
  label.className = 'pagination__label';
  label.textContent = `Page ${clampedPage} of ${totalPages}`;
  paginationEl.appendChild(label);

  return paginationEl;
}

// ---------------------------------------------------------------------------
// Return-from-detail restoration (D-08)
// ---------------------------------------------------------------------------

/**
 * In-memory hint of the activity most recently viewed in the detail view.
 * Deliberately NOT session/local storage — restorable state (page, sort,
 * filters) genuinely lives in the URL; only this one-shot "which row did I
 * just look at" needs remembering, and only for the current page session.
 */
let notedActivityId: string | null = null;

/**
 * Records which activity the visitor just viewed so returning to `#/list`
 * can highlight, scroll to, and focus that row. Called by `detail.ts` on
 * mount (a future plan) — `detail.ts` already imports formatters from this
 * module, so the dependency direction already exists.
 */
export function noteViewedActivity(id: string): void {
  notedActivityId = id;
}

function highlightAndFocus(el: HTMLElement | undefined): void {
  if (!el) return;
  el.classList.add('activity-table__row--highlight');
  el.scrollIntoView({ block: 'center' });
  el.querySelector('a')?.focus();
}

/**
 * If the noted activity is present on the current page, highlights and
 * focuses it in BOTH layouts (only one is visually shown per the 720px CSS
 * switch — the hidden layout's elements are not focusable, so acting on
 * both is harmless). Clears the noted id unconditionally so a later
 * navigation to the list does not re-highlight.
 */
function applyReturnHighlight(
  tableWrapper: HTMLElement,
  cardList: HTMLElement,
  pageItems: readonly DashboardIndexRow[]
): void {
  if (notedActivityId === null) {
    return;
  }

  const idx = pageItems.findIndex((row) => row.id === notedActivityId);
  notedActivityId = null;
  if (idx === -1) {
    return;
  }

  const tr = tableWrapper.querySelectorAll('tbody tr')[idx] as HTMLElement | undefined;
  const card = cardList.children[idx] as HTMLElement | undefined;
  highlightAndFocus(tr);
  highlightAndFocus(card);
}

// ---------------------------------------------------------------------------
// View factory
// ---------------------------------------------------------------------------

export interface ListViewDeps {
  indexClient: IndexClient;
}

export function createListView(deps: ListViewDeps): DashboardView {
  const { indexClient } = deps;
  let mountedContainer: HTMLElement | null = null;

  return {
    route: ROUTES.LIST,
    title: 'Activities',

    async mount(ctx: ViewMountContext): Promise<void> {
      mountedContainer = ctx.container;
      ctx.container.replaceChildren();

      const loading = document.createElement('div');
      loading.className = 'loading-indicator';
      loading.setAttribute('role', 'status');
      loading.textContent = 'Loading activities…';
      ctx.container.appendChild(loading);

      try {
        await indexClient.loadIndex();
      } catch (error) {
        console.error(error);
        // A rejection can arrive after the user navigated away — must not
        // wipe the newly-mounted view (WR-01).
        if (mountedContainer !== ctx.container) {
          return;
        }
        ctx.container.replaceChildren();
        const errorState = document.createElement('section');
        errorState.className = 'error-state';
        const heading = document.createElement('h2');
        heading.className = 'text-heading';
        heading.textContent = "Couldn't load activities";
        const body = document.createElement('p');
        body.className = 'text-body';
        body.textContent = 'Check your connection and try again.';
        errorState.appendChild(heading);
        errorState.appendChild(body);
        ctx.container.appendChild(errorState);
        return;
      }

      // mount() may resolve after the view was unmounted (fast navigation
      // away before the index finished loading) — guard against painting
      // into a container this view no longer owns.
      if (mountedContainer !== ctx.container) {
        return;
      }

      ctx.container.replaceChildren();

      const state = parseListQuery(ctx.query);

      const view = document.createElement('div');
      view.className = 'view';

      const heading = document.createElement('h1');
      heading.className = 'text-heading';
      heading.tabIndex = -1;
      heading.textContent = 'Activities';
      view.appendChild(heading);

      const filtered = filterRows(indexClient.getRows(), state.filters);
      const sorted = sortRows(filtered, state.sort, state.dir);
      const { pageItems, totalPages, clampedPage } = paginate(sorted, state.page);

      const countLine = document.createElement('p');
      countLine.className = 'text-label';
      countLine.textContent = `${filtered.length} activities`;
      view.appendChild(countLine);

      // Seam for the filter bar (a later plan populates this placeholder —
      // left empty here on purpose).
      const toolbar = document.createElement('div');
      toolbar.className = 'list-toolbar';
      view.appendChild(toolbar);

      const tableWrapper = buildDesktopTable(state, pageItems);
      view.appendChild(tableWrapper);

      view.appendChild(buildSortSelect(state));

      const cardList = buildMobileCardList(pageItems);
      view.appendChild(cardList);

      if (totalPages > 1) {
        view.appendChild(buildPagination(clampedPage, totalPages, state));
      }

      ctx.container.appendChild(view);

      // Focus management (17-UI-SPEC § 5): every view moves focus to its
      // own `<h1>` after mount completes.
      heading.focus();

      // Same stale-render guard as the rest of the mount path (WR-01
      // lineage) — a fast navigation away must not scroll/focus a
      // superseded view.
      if (mountedContainer === ctx.container) {
        applyReturnHighlight(tableWrapper, cardList, pageItems);
      }
    },

    unmount(): void {
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
