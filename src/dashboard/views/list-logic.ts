/**
 * Pure sort/filter/paginate/URL-state brain for the activity browser
 * (BROWSE-01..04, BROWSE-06). Every export in this module is DOM-free — no
 * `document`, no `window` — so it can be unit tested under vitest's
 * `environment: 'node'` (17-RESEARCH.md Pitfall 4: this repo has no jsdom).
 * `list.ts` and `list-logic.test.ts` are the only two files that may import
 * from here for the DOM/test split respectively.
 */

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

export type SortKey = 'date' | 'distance' | 'movingTime' | 'pace' | 'avgHr';
export type SortDir = 'asc' | 'desc';

/** Allow-list used by `parseListQuery` — the only valid `sort` values. */
export const SORT_KEYS: readonly SortKey[] = ['date', 'distance', 'movingTime', 'pace', 'avgHr'];

/** First-click default direction per sort key (17-UI-SPEC § 1). */
export const DEFAULT_DIR: Readonly<Record<SortKey, SortDir>> = {
  date: 'desc',
  distance: 'desc',
  movingTime: 'desc',
  avgHr: 'desc',
  pace: 'asc',
};

/** Rows per page (D-06). Phase 16's newest-100 truncation is removed. */
export const PAGE_SIZE = 50;

export interface FilterState {
  q: string;
  from: string | null;
  to: string | null;
  dMinKm: number | null;
  dMaxKm: number | null;
  pMinSec: number | null;
  pMaxSec: number | null;
  tMinMin: number | null;
  tMaxMin: number | null;
}

export const EMPTY_FILTERS: FilterState = {
  q: '',
  from: null,
  to: null,
  dMinKm: null,
  dMaxKm: null,
  pMinSec: null,
  pMaxSec: null,
  tMinMin: null,
  tMaxMin: null,
};

export interface ListState {
  sort: SortKey;
  dir: SortDir;
  page: number;
  filters: FilterState;
}

export const DEFAULT_LIST_STATE: ListState = {
  sort: 'date',
  dir: 'desc',
  page: 1,
  filters: EMPTY_FILTERS,
};

// ---------------------------------------------------------------------------
// Query-string contract (D-07 — these exact param names are the
// shareable-URL contract)
// ---------------------------------------------------------------------------

function parseQParam(raw: string | null): string {
  if (raw === null) return '';
  return raw.trim().slice(0, 200);
}

function parseDateParam(raw: string | null): string | null {
  if (raw === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Total, never-throwing parse of one numeric query param. Follows the
 * `buildExclusionIndex` tolerance discipline (`best-effort-exclusions.ts`):
 * an unparseable value drops that one filter without affecting the others.
 */
function parseNonNegativeNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Total function, never throws. `sort` is accepted only if it is a member of
 * `SORT_KEYS` (T-17-URL-01 — an unknown value, including `__proto__` or
 * `constructor`, falls back to `'date'` and is never used as an object
 * index). `page` is clamped to `>= 1` here and further clamped into
 * `[1, totalPages]` by `paginate` (T-17-URL-02). Every numeric filter
 * requires `Number.isFinite`, so `Infinity`/`NaN` never reach a comparison.
 */
export function parseListQuery(query: URLSearchParams): ListState {
  const sortParam = query.get('sort');
  const sort: SortKey =
    sortParam !== null && (SORT_KEYS as readonly string[]).includes(sortParam)
      ? (sortParam as SortKey)
      : 'date';

  const dirParam = query.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort];

  const pageParam = query.get('page');
  const parsedPage = pageParam === null ? NaN : Number.parseInt(pageParam, 10);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const filters: FilterState = {
    q: parseQParam(query.get('q')),
    from: parseDateParam(query.get('from')),
    to: parseDateParam(query.get('to')),
    dMinKm: parseNonNegativeNumber(query.get('dmin')),
    dMaxKm: parseNonNegativeNumber(query.get('dmax')),
    pMinSec: parseNonNegativeNumber(query.get('pmin')),
    pMaxSec: parseNonNegativeNumber(query.get('pmax')),
    tMinMin: parseNonNegativeNumber(query.get('tmin')),
    tMaxMin: parseNonNegativeNumber(query.get('tmax')),
  };

  return { sort, dir, page, filters };
}

/**
 * Inverse of `parseListQuery` — omits every parameter whose value equals the
 * default, so the canonical clean list URL is bare `#/list` with no query
 * string.
 */
export function serializeListQuery(state: ListState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.sort !== DEFAULT_LIST_STATE.sort) {
    params.set('sort', state.sort);
  }
  if (state.dir !== DEFAULT_DIR[state.sort]) {
    params.set('dir', state.dir);
  }
  if (state.page !== DEFAULT_LIST_STATE.page) {
    params.set('page', String(state.page));
  }

  const { filters } = state;
  const trimmedQ = filters.q.trim();
  if (trimmedQ !== '') {
    params.set('q', trimmedQ);
  }
  if (filters.from !== null) params.set('from', filters.from);
  if (filters.to !== null) params.set('to', filters.to);
  if (filters.dMinKm !== null) params.set('dmin', String(filters.dMinKm));
  if (filters.dMaxKm !== null) params.set('dmax', String(filters.dMaxKm));
  if (filters.pMinSec !== null) params.set('pmin', String(filters.pMinSec));
  if (filters.pMaxSec !== null) params.set('pmax', String(filters.pMaxSec));
  if (filters.tMinMin !== null) params.set('tmin', String(filters.tMinMin));
  if (filters.tMaxMin !== null) params.set('tmax', String(filters.tMaxMin));

  return params;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Normalizes a `startDateLocal` value to a comparable timestamp using the
 * SAME Z-suffix rule `formatActivityDate` uses (`list.ts`, WR-02): append
 * `Z` when the string does not already end in `Z` before `new Date(...)`,
 * so wall-clock local time is compared consistently regardless of the
 * runner's own UTC offset.
 */
function normalizedDateMs(isoLocal: string): number {
  const normalized = isoLocal.endsWith('Z') ? isoLocal : `${isoLocal}Z`;
  return new Date(normalized).getTime();
}

function getSortValue(row: DashboardIndexRow, sort: SortKey): number | null {
  switch (sort) {
    case 'date':
      return normalizedDateMs(row.startDateLocal);
    case 'distance':
      return row.distanceM;
    case 'movingTime':
      return row.movingTimeSec;
    case 'pace':
      return row.paceSecPerKm;
    case 'avgHr':
      return row.avgHr;
  }
}

/**
 * Nulls (a nullable `pace`/`avgHr` value) always sort last, in BOTH
 * directions — a missing value is never "the fastest" or "the highest".
 */
export function compareRows(
  a: DashboardIndexRow,
  b: DashboardIndexRow,
  sort: SortKey,
  dir: SortDir
): number {
  const av = getSortValue(a, sort);
  const bv = getSortValue(b, sort);

  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;

  const cmp = av - bv;
  return dir === 'asc' ? cmp : -cmp;
}

/**
 * Non-mutating, stable sort (`[...rows].sort(...)` — the `markPRs`/
 * `rankTopN` idiom from `best-effort-utils.ts`). V8's `Array.prototype.sort`
 * has been stable since ES2019, so two rows with an identical sort value
 * keep their relative input order.
 */
export function sortRows(
  rows: readonly DashboardIndexRow[],
  sort: SortKey,
  dir: SortDir
): DashboardIndexRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, sort, dir));
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = PAGE_SIZE
): { pageItems: T[]; totalPages: number; clampedPage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const start = (clampedPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { pageItems, totalPages, clampedPage };
}

// ---------------------------------------------------------------------------
// Pace input helpers (D-10 — pace min/max inputs accept `m:ss`, the URL
// carries integer seconds)
// ---------------------------------------------------------------------------

/** Accepts `m:ss` (seconds 0–59) or a bare integer count of seconds. */
export function parsePaceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const colonMatch = /^(\d+):([0-5]?\d)$/.exec(trimmed);
  if (colonMatch) {
    const minutes = Number(colonMatch[1]);
    const seconds = Number(colonMatch[2]);
    return minutes * 60 + seconds;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}

/**
 * Renders `m:ss`. Rounds to whole seconds in a SINGLE step feeding both
 * components — the exact defect class documented on `formatPace` in
 * `list.ts` (359.9 s/km must become "6:00", never "5:60").
 */
export function formatPaceInput(secPerKm: number): string {
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
