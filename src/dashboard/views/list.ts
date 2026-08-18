/**
 * Activities list view — renders real index rows end to end.
 *
 * Paginated, sortable, filterable, text-searchable browse over the full
 * activity index (BROWSE-01..04, BROWSE-06): a real `<table>` renders above
 * 720px with clickable, aria-sort-annotated column headers; at or below
 * 720px the shared `renderActivityRow` card layout renders instead, with an
 * equivalent sort `<select>`. A search box, removable filter chips, and a
 * collapsible range-filter panel (date/distance/pace/duration, with date and
 * distance presets) narrow the row set with AND semantics. Sort key,
 * direction, page, and every filter value all round-trip through the hash
 * query string via `parseListQuery`/`serializeListQuery` (`list-logic.ts`),
 * so back/forward and bookmarking work for free. All sort/filter/paginate
 * arithmetic lives in `list-logic.ts` — this file is DOM construction and
 * event wiring only.
 *
 * `renderActivityRow` is exported so `overview.ts` reuses the exact same row
 * markup — one row renderer, two views.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import { navigateTo } from '../router.js';
import { attachRowNavigation, activityDetailHref } from '../row-navigation.js';
import type { SortKey, SortDir, ListState, DatePresetId } from './list-logic.js';
import {
  DEFAULT_DIR,
  parseListQuery,
  serializeListQuery,
  filterRows,
  sortRows,
  paginate,
  activeFilterCount,
  DISTANCE_PRESETS,
  datePresetRange,
  parsePaceInput,
  formatPaceInput,
  buildFilterChips,
  removeChip,
  EMPTY_FILTERS,
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

/**
 * Formats a duration in seconds as `m:ss` when under an hour, `h:mm:ss` at
 * or above one hour — unlike `formatDurationHms`, which always shows a
 * leading `0:` hour component (`formatDurationHms(1179)` -> `"0:19:39"`,
 * wrong for a 5K PR; this returns `"19:39"`). Exists alongside
 * `formatDurationHms` rather than replacing it: that formatter's `h:mm:ss`
 * shape is correct for activity moving-time display (an activity is always
 * "long enough" for the hour component to read naturally), while this one
 * is for standalone effort/PR times that are usually well under an hour.
 *
 * Consumers (18-UI-SPEC § 14): PR tables, evolution progression tables, the
 * Riegel matrix, and the best-efforts panel.
 *
 * Uses a SINGLE rounding step feeding both the minutes and seconds
 * components (`Math.round` once, then `floor(/60)` and `% 60`), exactly as
 * `formatPace`'s own JSDoc mandates above — deriving the two components
 * independently is what caused that formatter's shipped 11-row `:60`
 * rounding defect, and this formatter must not reintroduce that defect
 * class.
 */
export function formatEffortDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Appends one plain `.badge` span. Exported (18-UI-SPEC § 5) so `detail.ts`
 * reuses it for the per-distance PR badge rather than duplicating this
 * 5-line DOM builder — the same single-source discipline already applied
 * to `formatActivityDate`/`formatPace`.
 */
export function appendBadge(container: HTMLElement, text: string): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;
  container.appendChild(badge);
}

/**
 * The exact text of the low-confidence badge — the single definition
 * `appendLowConfidenceBadge`, `statusBadgeTexts` and `appendStatusBadges`
 * all read from, so the rendered badge and the composed aria-label can never
 * disagree on the string (CR-02).
 */
export const LOW_CONFIDENCE_BADGE_TEXT = 'Low confidence';

/**
 * Every surface that renders a `.activity-row` via `renderActivityRow` or
 * shares its badge helper (`appendStatusBadges`), in one place (D-05,
 * `21-CONTEXT.md`).
 *
 * `'activity-card'` and `'activity-table'` are the two pre-existing
 * surfaces — the Activities screen's mobile card (`renderActivityRow`,
 * unchanged default) and its desktop table (`buildTableRow`). They were
 * never simultaneously visible: `styles.css` CSS-hides one of the pair via
 * a media query, so the old two-string prefix scheme sufficed on its own.
 *
 * `'overview-prs'` and `'overview-activities'` are new (plan 21-04):
 * Overview renders its "Recent PRs" and "Recent Activities" cards in the
 * SAME document at the same time, both calling `renderActivityRow`. An
 * activity with `prCount > 0` that also sits among the ten most recent
 * activities appears in both cards. `appendLowConfidenceBadge` mints an
 * element `id` from the surface's prefix (via `lowConfidenceDescriptionId`)
 * — without a fourth-and-fifth distinct prefix, that row would emit the
 * SAME `id` twice in one document, invalid HTML with an ambiguous
 * `aria-describedby` resolution target. `rowIdPrefix` exists so every
 * surface gets a distinct prefix from one place, closing that collision
 * before the call site that would trigger it (plan 21-04) exists.
 */
export type RowSurface =
  | 'activity-card'
  | 'activity-table'
  | 'overview-prs'
  | 'overview-activities';

/**
 * Builds the element-id prefix for one row on one surface — the single
 * construction site every simultaneously-rendered surface's element ids
 * derive from (D-05). Pre-Phase-21 callers relied on two inline template
 * literals (`` `activity-card-${row.id}` `` and `` `activity-table-${row.id}` ``)
 * that this function now replaces; both come out byte-identical to their
 * old values, so the surface scheme is additive, not a rename.
 */
export function rowIdPrefix(surface: RowSurface, rowId: string): string {
  return `${surface}-${rowId}`;
}

/**
 * The `id` a low-confidence badge's `.sr-only` explanation span is given,
 * derived from `idPrefix` — the single definition of this id shape, read by
 * both `appendLowConfidenceBadge` (which creates the element) and
 * `renderActivityRow` (which points a row-level `aria-describedby` at it,
 * CR-02). `idPrefix` must be unique per simultaneously-rendered surface —
 * see `appendStatusBadges`'s JSDoc for why.
 */
export function lowConfidenceDescriptionId(idPrefix: string): string {
  return `${idPrefix}-low-confidence-desc`;
}

/**
 * Appends a "Low confidence" badge whose explanation is reachable WITHOUT
 * hovering (D-07, 18-UI-SPEC § 6) — closing a real gap in the badge that
 * already ships on list/overview, which today carries no explanation at
 * all. Renders the visible `.badge` with a `title` attribute (for pointer
 * users) plus a sibling visually-hidden `.sr-only` span carrying the SAME
 * text with a unique id, wired via `aria-describedby` on the badge so
 * keyboard/assistive-tech users can reach the explanation too. Both spans
 * use `textContent` only (T-18-XSS-01).
 *
 * Signature and DOM output are unchanged by plan 20-07 (CR-02) —
 * `records.ts:412` and `detail-sections.ts:346` call this and are out of
 * that plan's scope. What changed is that `idPrefix` now flows through
 * `lowConfidenceDescriptionId`, the same helper `renderActivityRow` calls to
 * point its row-level `aria-describedby` at this badge's description span.
 */
export function appendLowConfidenceBadge(container: HTMLElement, idPrefix: string): void {
  const explanation = 'GPS-reconstructed distance; treat this time with caution';
  const descriptionId = lowConfidenceDescriptionId(idPrefix);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = LOW_CONFIDENCE_BADGE_TEXT;
  badge.title = explanation;
  badge.setAttribute('aria-describedby', descriptionId);
  container.appendChild(badge);

  const description = document.createElement('span');
  description.className = 'sr-only';
  description.id = descriptionId;
  description.textContent = explanation;
  container.appendChild(description);
}

/**
 * The status-badge strings for one row, in render order — the single source
 * of truth `appendStatusBadges` iterates to build the visible `.badge`
 * spans and `activityRowAriaLabel` folds into the row anchor's `aria-label`
 * (CR-02). Returns an empty array for a row with streams, HR, no
 * low-confidence flag, no exclusion and `prCount` 0. Because both the
 * rendered spans and the announced label read from this one array, they
 * cannot drift apart the way `20-REVIEW.md` CR-02 found them to.
 */
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  const texts: string[] = [];

  if (!row.streams.available) {
    texts.push(row.streams.reason ? `No streams (${row.streams.reason})` : 'No streams');
  } else if (!row.streams.hr) {
    texts.push('No HR');
  }

  if (row.lowConfidence) {
    texts.push(LOW_CONFIDENCE_BADGE_TEXT);
  }

  if (row.excludedFromRecords) {
    texts.push('Excluded from records');
  }

  if (row.prCount > 0) {
    texts.push(`${row.prCount} PR`);
  }

  return texts;
}

/**
 * Appends every applicable status badge to `container` — shared by
 * `renderActivityRow` (mobile card) and `buildTableRow` (desktop Status
 * cell) so the two surfaces show identical badges from one source of truth
 * (`statusBadgeTexts`).
 *
 * `idPrefix` must differ between every simultaneously-rendered surface, or a
 * shared `<id>-low-confidence-desc` element id would collide and
 * `aria-describedby` could resolve to the wrong copy. `rowIdPrefix` is the
 * single source of that prefix now — see its JSDoc for the full surface
 * list and the Overview collision (D-05) it exists to prevent.
 */
function appendStatusBadges(container: HTMLElement, row: DashboardIndexRow, idPrefix: string): void {
  for (const text of statusBadgeTexts(row)) {
    if (text === LOW_CONFIDENCE_BADGE_TEXT) {
      appendLowConfidenceBadge(container, idPrefix);
    } else {
      appendBadge(container, text);
    }
  }
}

/**
 * Returns `base` unchanged when `badgeTexts` is empty, otherwise `base`
 * followed by `, ` and the badge texts joined with `, `. The shared
 * composer every surface that folds status-badge text into a curated
 * `aria-label` (CR-02) imports, so the three surfaces cannot each invent
 * their own separator.
 */
export function composeRowAriaLabel(base: string, badgeTexts: readonly string[]): string {
  if (badgeTexts.length === 0) return base;
  return `${base}, ${badgeTexts.join(', ')}`;
}

/**
 * Builds the accessible name for an activity row anchor: the curated D-04
 * three-part base (`row.name`, the formatted local date, the one-decimal
 * kilometre distance) with `statusBadgeTexts(row)` folded on via
 * `composeRowAriaLabel` (CR-02).
 *
 * This REFINES D-04, it does not overturn it. D-04's rationale is that a
 * whole-row link must not announce every descendant string concatenated
 * (name, date, distance, duration, pace, badges) and must match what the
 * same activity announces elsewhere. The curated three-part base stays
 * exactly as it is; only the status-badge texts are appended, and only on
 * `renderActivityRow`'s card surface where those badges are trapped inside
 * the anchor and would otherwise be silently dropped from the accessible
 * name (`20-VERIFICATION.md` confirmed this as CR-02). `buildTableRow` and
 * `records.ts` deliberately do NOT fold badges into their anchor labels —
 * on both of those surfaces the badges live in a sibling `<td>` in the same
 * row and are already announced by table navigation, so folding them in
 * here too would double-announce them.
 */
export function activityRowAriaLabel(row: DashboardIndexRow): string {
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  const base = `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`;
  return composeRowAriaLabel(base, statusBadgeTexts(row));
}

/**
 * Builds one `.activity-row`. Every athlete-authored string (`row.name`) is
 * written with `textContent` — an HTML-string assignment is never used —
 * per T-16-VW-01, the explicit deviation from `route-browser`'s known
 * unescaped-interpolation anti-pattern.
 *
 * This row is now a whole-row `<a>` (D-07): the entire row is the
 * navigation affordance, not a bare `<div>` with a click handler bolted on.
 * It is the single shared seam between Overview's Recent Activities card
 * and the Activities mobile card view — one edit here changes both
 * screens. The redundant "View Activity" CTA that used to live inside the
 * row was removed under UX-02, since the row itself is now the affordance.
 * The curated `aria-label`, built by `activityRowAriaLabel`, exists because
 * a whole-row link otherwise announces every descendant string concatenated
 * (name, date, distance, duration, pace, every status badge) — verbose and
 * inconsistent with what the same activity announces elsewhere (D-04).
 * `activityRowAriaLabel` folds `statusBadgeTexts(row)` onto that curated
 * base (CR-02) because this card IS the anchor: the status badges appended
 * below are descendants of the very element that carries the `aria-label`,
 * so without the fold their text is silently dropped from the accessible
 * name. When `row.lowConfidence` is true, `aria-describedby` is also set on
 * the row itself (not just on the badge span `appendStatusBadges` creates)
 * — a description is only announced when its host is announced, and on
 * this surface the row anchor is the only element that gets announced.
 * `.activity-row` in `styles.css` declares `display: flex`, which is what
 * keeps the row laid out now that the element is an inline-by-default
 * anchor.
 */
export function renderActivityRow(row: DashboardIndexRow, surface: RowSurface = 'activity-card'): HTMLElement {
  const rowEl = document.createElement('a');
  rowEl.className = 'activity-row';
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  const idPrefix = rowIdPrefix(surface, row.id);
  rowEl.href = activityDetailHref(row.id);
  rowEl.setAttribute('aria-label', activityRowAriaLabel(row));
  if (row.lowConfidence) {
    rowEl.setAttribute('aria-describedby', lowConfidenceDescriptionId(idPrefix));
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'activity-row__name';
  nameEl.textContent = row.name;
  rowEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'activity-row__meta';
  metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km · ${formatDurationHms(row.movingTimeSec)} · ${formatPace(row.paceSecPerKm)}`;
  rowEl.appendChild(metaEl);

  appendStatusBadges(rowEl, row, idPrefix);

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
 * renderers each with one job).
 *
 * The row's keyboard path is the Activity-cell anchor below: a real link,
 * so Tab reaches it, Enter activates it, and assistive tech announces it as
 * a link with the curated `aria-label`. The `<tr>` itself deliberately
 * carries no `tabindex` and no `role="link"` — `role="link"` on a `<tr>`
 * removes it from the table's accessibility tree and breaks screen-reader
 * table navigation (D-01). Phase 20 success criterion 3's "Tab reaches the
 * row" is satisfied here via the row's single activation control, not via a
 * `tabindex` on the row wrapper itself; on the div rows (`renderActivityRow`,
 * `renderRecentPrRow`) it is satisfied literally, because those rows are
 * themselves anchors. This is a deliberate reading (D-01 of
 * `20-CONTEXT.md`), not a shortcut — the alternative degrades real
 * assistive-tech table navigation to satisfy a wording. The row-level click
 * behavior (mouse path, guarded so it never double-navigates with the
 * in-cell anchor) now lives in `src/dashboard/row-navigation.ts` (D-03).
 */
function buildTableRow(row: DashboardIndexRow): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.dataset.activityId = row.id;
  attachRowNavigation(tr, row.id);

  const distanceKm = (row.distanceM / 1000).toFixed(1);

  const dateTd = document.createElement('td');
  dateTd.textContent = formatActivityDate(row.startDateLocal);
  tr.appendChild(dateTd);

  const activityTd = document.createElement('td');
  const anchor = document.createElement('a');
  anchor.href = activityDetailHref(row.id);
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
  appendStatusBadges(statusTd, row, rowIdPrefix('activity-table', row.id));
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
// Filter bar (BROWSE-03/BROWSE-04/BROWSE-06) — search box + collapsible
// range-filter panel with presets. All filter VALUES flow through the URL
// exactly like sort/page do; the panel's open/closed state is a plain
// in-memory boolean owned by the view factory (D-09), never persisted and
// never written to the URL.
// ---------------------------------------------------------------------------

const FILTER_PANEL_ID = 'list-filter-panel';

function buildRemoveIconSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M1 1 L9 9 M9 1 L1 9');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('fill', 'none');
  svg.appendChild(path);
  return svg;
}

/**
 * Renders the active-filter chips row (D-12), rebuilt on every render from
 * `buildFilterChips(state.filters)` — every label and removal rule is
 * constructed in `list-logic.ts`; this function only wires DOM and events.
 * Each chip's visible text is `textContent` only (T-17-VW-01) — chip labels
 * can carry the athlete's own search string, a genuine XSS surface. `Clear
 * all` renders only once 2+ chips are active.
 */
function buildChipsRow(state: ListState, applyImmediate: (next: ListState) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'chip-row';

  const chips = buildFilterChips(state.filters);

  for (const chip of chips) {
    const chipEl = document.createElement('span');
    chipEl.className = 'chip';

    const labelEl = document.createElement('span');
    labelEl.textContent = chip.label;
    chipEl.appendChild(labelEl);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip__remove';
    // The × icon has no visible text label, so the aria-label is the
    // authoritative accessible name — the chip's own visible text is
    // decorative to assistive tech.
    removeBtn.setAttribute('aria-label', `Remove ${chip.label} filter`);
    removeBtn.appendChild(buildRemoveIconSvg());
    removeBtn.addEventListener('click', () => {
      applyImmediate({ ...state, page: 1, filters: removeChip(state.filters, chip.key) });
    });
    chipEl.appendChild(removeBtn);

    row.appendChild(chipEl);
  }

  if (chips.length >= 2) {
    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'chip-clear-all';
    clearAllBtn.textContent = 'Clear all';
    clearAllBtn.addEventListener('click', () => {
      applyImmediate({ ...state, page: 1, filters: EMPTY_FILTERS });
    });
    row.appendChild(clearAllBtn);
  }

  return row;
}

/**
 * Zero-match empty state (D-12) — renders IN PLACE OF both the table
 * wrapper and the card list when the filtered row set is empty, never a
 * blank table with headers and no body. Offers Clear all even at exactly
 * one active filter, the deliberate exception to the chips row's 2+ rule.
 */
function buildEmptyState(state: ListState, applyImmediate: (next: ListState) => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'empty-state';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'No activities match your filters';
  section.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent = 'Try widening your date range or distance, or clear a filter below.';
  section.appendChild(body);

  const clearAllBtn = document.createElement('button');
  clearAllBtn.type = 'button';
  clearAllBtn.className = 'chip-clear-all';
  clearAllBtn.textContent = 'Clear all';
  clearAllBtn.addEventListener('click', () => {
    applyImmediate({ ...state, page: 1, filters: EMPTY_FILTERS });
  });
  section.appendChild(clearAllBtn);

  return section;
}

/** Parses a trimmed numeric string, tolerating garbage the same way
 * `list-logic.ts`'s `parseNonNegativeNumber` does — an unparseable or
 * negative value drops that one bound rather than producing a `NaN`
 * comparison that would silently pass every row (T-17-URL-02 lineage). */
function parseOptionalNonNegativeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function buildDateField(
  state: ListState,
  applyImmediate: (next: ListState) => void,
  applyDebounced: (next: ListState) => void
): HTMLDivElement {
  const field = document.createElement('div');
  field.className = 'filter-field';

  const legend = document.createElement('span');
  legend.className = 'text-label';
  legend.textContent = 'Date range';
  field.appendChild(legend);

  const fromInput = document.createElement('input');
  fromInput.type = 'date';
  fromInput.setAttribute('aria-label', 'From date');
  fromInput.value = state.filters.from ?? '';

  const toInput = document.createElement('input');
  toInput.type = 'date';
  toInput.setAttribute('aria-label', 'To date');
  toInput.value = state.filters.to ?? '';

  function buildNext(): ListState {
    return {
      ...state,
      page: 1,
      filters: { ...state.filters, from: fromInput.value || null, to: toInput.value || null },
    };
  }

  fromInput.addEventListener('input', () => applyDebounced(buildNext()));
  fromInput.addEventListener('change', () => applyImmediate(buildNext()));
  toInput.addEventListener('input', () => applyDebounced(buildNext()));
  toInput.addEventListener('change', () => applyImmediate(buildNext()));

  field.appendChild(fromInput);
  field.appendChild(toInput);

  const presetRow = document.createElement('div');
  presetRow.className = 'chip-row';
  const datePresets: readonly { id: DatePresetId; label: string }[] = [
    { id: 'this-year', label: 'This year' },
    { id: 'last-12-months', label: 'Last 12 months' },
  ];
  for (const preset of datePresets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      const range = datePresetRange(preset.id, new Date());
      applyImmediate({
        ...state,
        page: 1,
        filters: { ...state.filters, from: range.from, to: range.to },
      });
    });
    presetRow.appendChild(btn);
  }
  field.appendChild(presetRow);

  return field;
}

function buildDistanceField(
  state: ListState,
  applyImmediate: (next: ListState) => void,
  applyDebounced: (next: ListState) => void
): HTMLDivElement {
  const field = document.createElement('div');
  field.className = 'filter-field';

  const legend = document.createElement('span');
  legend.className = 'text-label';
  legend.textContent = 'Distance range (km)';
  field.appendChild(legend);

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.step = '0.1';
  minInput.min = '0';
  minInput.setAttribute('aria-label', 'Min distance (km)');
  minInput.value = state.filters.dMinKm !== null ? String(state.filters.dMinKm) : '';

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.step = '0.1';
  maxInput.min = '0';
  maxInput.setAttribute('aria-label', 'Max distance (km)');
  maxInput.value = state.filters.dMaxKm !== null ? String(state.filters.dMaxKm) : '';

  function buildNext(): ListState {
    return {
      ...state,
      page: 1,
      filters: {
        ...state.filters,
        dMinKm: parseOptionalNonNegativeNumber(minInput.value),
        dMaxKm: parseOptionalNonNegativeNumber(maxInput.value),
      },
    };
  }

  minInput.addEventListener('input', () => applyDebounced(buildNext()));
  minInput.addEventListener('change', () => applyImmediate(buildNext()));
  minInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });
  maxInput.addEventListener('input', () => applyDebounced(buildNext()));
  maxInput.addEventListener('change', () => applyImmediate(buildNext()));
  maxInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });

  field.appendChild(minInput);
  field.appendChild(maxInput);

  const presetRow = document.createElement('div');
  presetRow.className = 'chip-row';
  for (const preset of DISTANCE_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      applyImmediate({
        ...state,
        page: 1,
        filters: { ...state.filters, dMinKm: preset.dMinKm, dMaxKm: preset.dMaxKm },
      });
    });
    presetRow.appendChild(btn);
  }
  field.appendChild(presetRow);

  return field;
}

/** No preset chips (D-10 names presets only for date and distance). */
function buildPaceField(
  state: ListState,
  applyImmediate: (next: ListState) => void,
  applyDebounced: (next: ListState) => void
): HTMLDivElement {
  const field = document.createElement('div');
  field.className = 'filter-field';

  const legend = document.createElement('span');
  legend.className = 'text-label';
  legend.textContent = 'Pace range (m:ss/km)';
  field.appendChild(legend);

  const minInput = document.createElement('input');
  minInput.type = 'text';
  minInput.inputMode = 'numeric';
  minInput.setAttribute('aria-label', 'Min pace (m:ss/km)');
  minInput.value = state.filters.pMinSec !== null ? formatPaceInput(state.filters.pMinSec) : '';

  const maxInput = document.createElement('input');
  maxInput.type = 'text';
  maxInput.inputMode = 'numeric';
  maxInput.setAttribute('aria-label', 'Max pace (m:ss/km)');
  maxInput.value = state.filters.pMaxSec !== null ? formatPaceInput(state.filters.pMaxSec) : '';

  function buildNext(): ListState {
    return {
      ...state,
      page: 1,
      filters: {
        ...state.filters,
        // An unparseable value clears that one bound rather than blocking
        // the others (matching parseListQuery's per-filter tolerance).
        pMinSec: parsePaceInput(minInput.value),
        pMaxSec: parsePaceInput(maxInput.value),
      },
    };
  }

  minInput.addEventListener('input', () => applyDebounced(buildNext()));
  minInput.addEventListener('change', () => applyImmediate(buildNext()));
  minInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });
  maxInput.addEventListener('input', () => applyDebounced(buildNext()));
  maxInput.addEventListener('change', () => applyImmediate(buildNext()));
  maxInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });

  field.appendChild(minInput);
  field.appendChild(maxInput);
  return field;
}

/** No preset chips (D-10 names presets only for date and distance). */
function buildDurationField(
  state: ListState,
  applyImmediate: (next: ListState) => void,
  applyDebounced: (next: ListState) => void
): HTMLDivElement {
  const field = document.createElement('div');
  field.className = 'filter-field';

  const legend = document.createElement('span');
  legend.className = 'text-label';
  legend.textContent = 'Duration range (min)';
  field.appendChild(legend);

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0';
  minInput.setAttribute('aria-label', 'Min duration (min)');
  minInput.value = state.filters.tMinMin !== null ? String(state.filters.tMinMin) : '';

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.min = '0';
  maxInput.setAttribute('aria-label', 'Max duration (min)');
  maxInput.value = state.filters.tMaxMin !== null ? String(state.filters.tMaxMin) : '';

  function buildNext(): ListState {
    return {
      ...state,
      page: 1,
      filters: {
        ...state.filters,
        tMinMin: parseOptionalNonNegativeNumber(minInput.value),
        tMaxMin: parseOptionalNonNegativeNumber(maxInput.value),
      },
    };
  }

  minInput.addEventListener('input', () => applyDebounced(buildNext()));
  minInput.addEventListener('change', () => applyImmediate(buildNext()));
  minInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });
  maxInput.addEventListener('input', () => applyDebounced(buildNext()));
  maxInput.addEventListener('change', () => applyImmediate(buildNext()));
  maxInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyImmediate(buildNext());
  });

  field.appendChild(minInput);
  field.appendChild(maxInput);
  return field;
}

function buildFilterPanel(
  state: ListState,
  panelOpen: boolean,
  applyImmediate: (next: ListState) => void,
  applyDebounced: (next: ListState) => void
): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = FILTER_PANEL_ID;
  panel.className = panelOpen ? 'filter-panel filter-panel--open' : 'filter-panel';

  panel.appendChild(buildDateField(state, applyImmediate, applyDebounced));
  panel.appendChild(buildDistanceField(state, applyImmediate, applyDebounced));
  panel.appendChild(buildPaceField(state, applyImmediate, applyDebounced));
  panel.appendChild(buildDurationField(state, applyImmediate, applyDebounced));

  return panel;
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

/**
 * Exported solely so the Phase 17 D-08 return-focus behaviour is
 * regression-testable under vitest's `environment: 'node'`; this repository
 * has no jsdom and no headless browser, so a stub-element unit test is the
 * only automated proof available. Not part of this module's public surface
 * for any other caller.
 *
 * CR-01: plan 20-02 made the card row element itself the `<a>`
 * (`renderActivityRow`) and deleted its `.cta` descendant, so the previous
 * `el.querySelector('a')` assumption became false on that branch and the
 * optional chain swallowed the failure silently (confirmed in
 * `20-VERIFICATION.md`). Below the 720px breakpoint the card is the only
 * focusable branch, so Phase 17 D-08's return-from-detail focus restoration
 * was dead on mobile while the highlight class still made the row look
 * restored.
 *
 * The branch below checks `el.tagName === 'A'` rather than
 * `el instanceof HTMLAnchorElement` (the form `20-REVIEW.md` proposed)
 * because vitest runs this repository with `environment: 'node'`, where
 * `HTMLAnchorElement` is not a defined global — the `instanceof` form would
 * throw `ReferenceError` in the very regression test that proves this
 * branch works. Both forms select the same elements in an HTML document;
 * this is a deliberate, recorded deviation from the review's proposed
 * patch.
 *
 * Standing invariant for future row renderers: this phase produced two row
 * shapes (D-01/D-07's deliberate hybrid) — the row that IS its own anchor
 * (card) and the row that CONTAINS one (`<tr>`). Any future row renderer
 * must be checked against both branches of this function.
 */
export function highlightAndFocus(el: HTMLElement | undefined): void {
  if (!el) return;
  el.classList.add('activity-table__row--highlight');
  el.scrollIntoView({ block: 'center' });
  const focusTarget = el.tagName === 'A' ? el : el.querySelector('a');
  focusTarget?.focus();
}

/**
 * Reads the noted activity id and clears the module state in the same call,
 * unconditionally — this is the only writer of `notedActivityId = null` in
 * the module. Consuming is unconditional by construction, so no render
 * branch can leak the hint into a later, unrelated navigation and steal
 * keyboard focus there (CR-01, `20-REVIEW.md`; a WCAG 3.2.x class defect —
 * "On Input" / unexpected context changes). Callers must consume this
 * before any early return, not just before the branch that would use it.
 */
export function takeNotedActivityId(): string | null {
  const id = notedActivityId;
  notedActivityId = null;
  return id;
}

/**
 * If `notedId` is present on the current page, highlights and focuses it in
 * BOTH layouts (only one is visually shown per the 720px CSS switch — the
 * hidden layout's elements are not focusable, so acting on both is
 * harmless). The caller has already consumed the id via
 * `takeNotedActivityId()`; this function neither reads nor writes the
 * module state.
 */
export function applyReturnHighlight(
  notedId: string | null,
  tableWrapper: HTMLElement,
  cardList: HTMLElement,
  pageItems: readonly DashboardIndexRow[]
): void {
  if (notedId === null) {
    return;
  }

  const idx = pageItems.findIndex((row) => row.id === notedId);
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

/** Debounce window for free-text search and numeric range inputs (D-11). */
const FILTER_DEBOUNCE_MS = 200;

export function createListView(deps: ListViewDeps): DashboardView {
  const { indexClient } = deps;
  let mountedContainer: HTMLElement | null = null;

  // Panel open/closed is a plain in-memory boolean owned by this factory
  // instance — NOT persisted to storage and NOT written to the URL
  // (17-UI-SPEC § 2). It outlives a re-mount within the same SPA session
  // because the factory instance is created once and reused across
  // navigations, so toggling it survives paginating/sorting.
  let panelOpen = false;

  // Debounce timer id for the search box and every numeric/text range
  // input (D-11). Held on the factory instance and cleared in unmount() so
  // a pending update can never fire into a torn-down view — the same
  // discipline as the mountedContainer stale guard.
  let debounceTimerId: ReturnType<typeof setTimeout> | null = null;

  function applyImmediate(next: ListState): void {
    if (debounceTimerId !== null) {
      clearTimeout(debounceTimerId);
      debounceTimerId = null;
    }
    applyState(next);
  }

  function applyDebounced(next: ListState): void {
    if (debounceTimerId !== null) {
      clearTimeout(debounceTimerId);
    }
    debounceTimerId = setTimeout(() => {
      debounceTimerId = null;
      applyState(next);
    }, FILTER_DEBOUNCE_MS);
  }

  function buildToolbar(state: ListState): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'list-toolbar';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'list-search';
    search.placeholder = 'Search activities by name…';
    search.setAttribute('aria-label', 'Search activities');
    search.value = state.filters.q;

    function buildNextQuery(): ListState {
      return { ...state, page: 1, filters: { ...state.filters, q: search.value } };
    }
    search.addEventListener('input', () => applyDebounced(buildNextQuery()));
    search.addEventListener('change', () => applyImmediate(buildNextQuery()));
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyImmediate(buildNextQuery());
    });
    toolbar.appendChild(search);

    const activeCount = activeFilterCount(state.filters);
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'filter-toggle';
    toggleBtn.textContent = activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters';
    toggleBtn.setAttribute('aria-expanded', String(panelOpen));
    toggleBtn.setAttribute('aria-controls', FILTER_PANEL_ID);
    toolbar.appendChild(toggleBtn);

    const chipRow = buildChipsRow(state, applyImmediate);
    toolbar.appendChild(chipRow);

    const panel = buildFilterPanel(state, panelOpen, applyImmediate, applyDebounced);
    toggleBtn.addEventListener('click', () => {
      panelOpen = !panelOpen;
      panel.classList.toggle('filter-panel--open', panelOpen);
      toggleBtn.setAttribute('aria-expanded', String(panelOpen));
    });
    toolbar.appendChild(panel);

    return toolbar;
  }

  return {
    route: ROUTES.LIST,
    title: 'Activities',

    async mount(ctx: ViewMountContext): Promise<void> {
      // CR-01: consume the one-shot return hint as the very first statement,
      // before the try that awaits loadIndex(), so every one of this
      // method's four exits spends it — the load-failure return below, the
      // stale-container return, the zero-match branch, and the normal
      // render. 20-REVIEW.md drafted placing this consume after the
      // stale-container guard instead; that placement leaves the
      // load-failure branch leaking (it returns first), so this plan moves
      // the call site earlier — see this plan's deviation_from_the_review.
      const notedId = takeNotedActivityId();

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

      const toolbar = buildToolbar(state);
      view.appendChild(toolbar);

      if (filtered.length === 0) {
        // Zero-match empty state (D-12) renders IN PLACE OF both the table
        // wrapper and the card list — never a blank table, and pagination
        // is hidden entirely in this state.
        view.appendChild(buildEmptyState(state, applyImmediate));
        ctx.container.appendChild(view);
        heading.focus();
      } else {
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
          applyReturnHighlight(notedId, tableWrapper, cardList, pageItems);
        }
      }
    },

    unmount(): void {
      if (debounceTimerId !== null) {
        clearTimeout(debounceTimerId);
        debounceTimerId = null;
      }
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
