/**
 * Activities list view — renders real index rows end to end (D-06/D-07).
 *
 * Scope guard: Phase 16 ships NO sorting, filtering, search, or pagination
 * controls (those are BROWSE-01..06 in Phase 17). To keep the DOM honest at
 * 1,867 rows without inventing pagination UI, this view renders only the
 * newest 100 rows with an explicit truncation notice (T-16-VW-03).
 *
 * `renderActivityRow` is exported so `overview.ts` reuses the exact same row
 * markup — one row renderer, two views.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

const MAX_ROWS = 100;

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

/** Formats a duration in seconds as `h:mm:ss`. */
function formatDurationHms(totalSeconds: number): string {
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

function appendBadge(rowEl: HTMLElement, text: string): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;
  rowEl.appendChild(badge);
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

  if (!row.streams.available) {
    appendBadge(rowEl, row.streams.reason ? `No streams (${row.streams.reason})` : 'No streams');
  } else if (!row.streams.hr) {
    appendBadge(rowEl, 'No HR');
  }

  if (row.lowConfidence) {
    appendBadge(rowEl, 'Low confidence');
  }

  if (row.excludedFromRecords) {
    appendBadge(rowEl, 'Excluded from records');
  }

  if (row.prCount > 0) {
    appendBadge(rowEl, `${row.prCount} PR`);
  }

  const cta = document.createElement('a');
  cta.className = 'cta';
  cta.textContent = 'View Activity';
  cta.href = `#/activity/${row.id}`;
  rowEl.appendChild(cta);

  return rowEl;
}

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

      const view = document.createElement('div');
      view.className = 'view';

      const heading = document.createElement('h1');
      heading.className = 'text-heading';
      heading.textContent = 'Activities';
      view.appendChild(heading);

      const rows = indexClient.getRows();

      const countLine = document.createElement('p');
      countLine.className = 'text-label';
      countLine.textContent = `${rows.length} activities`;
      view.appendChild(countLine);

      const listEl = document.createElement('div');
      listEl.className = 'activity-list';
      const visibleRows = rows.slice(0, MAX_ROWS);
      for (const row of visibleRows) {
        listEl.appendChild(renderActivityRow(row));
      }
      view.appendChild(listEl);

      if (rows.length > MAX_ROWS) {
        const truncationNote = document.createElement('p');
        truncationNote.className = 'text-label';
        truncationNote.textContent = `Showing the 100 most recent of ${rows.length} activities. Browsing, sorting and filtering land in Phase 17.`;
        view.appendChild(truncationNote);
      }

      ctx.container.appendChild(view);
    },

    unmount(): void {
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
