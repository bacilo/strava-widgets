import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  DEFAULT_DIR,
  DEFAULT_LIST_STATE,
  EMPTY_FILTERS,
  PAGE_SIZE,
  compareRows,
  formatPaceInput,
  paginate,
  parseListQuery,
  parsePaceInput,
  serializeListQuery,
  sortRows,
  type ListState,
  type SortDir,
  type SortKey,
} from './list-logic.js';

// Node-environment-only test file — this repo has no jsdom, so `list-logic.ts`
// is deliberately DOM-free and this file must never reference `document`
// (17-RESEARCH.md Pitfall 4, mirroring `router.test.ts`'s file-header precedent).

function makeRow(overrides: Partial<DashboardIndexRow> = {}): DashboardIndexRow {
  return {
    id: '1',
    startDate: '2024-06-01T09:00:00Z',
    startDateLocal: '2024-06-01T09:00:00Z',
    name: 'Morning run',
    distanceM: 10000,
    movingTimeSec: 3000,
    paceSecPerKm: 300,
    elevationGainM: 50,
    avgHr: 150,
    maxHr: 170,
    avgCadenceRpm: 85,
    location: 'Copenhagen',
    sportType: 'Run',
    streams: { available: true, hr: true, cadence: true, elevation: true },
    lowConfidence: false,
    excludedFromRecords: false,
    prCount: 0,
    ...overrides,
  };
}

describe('sortRows — date', () => {
  it('sorts newest-first by startDateLocal on desc', () => {
    const rows = [
      makeRow({ id: 'a', startDateLocal: '2024-01-01T00:00:00Z' }),
      makeRow({ id: 'b', startDateLocal: '2024-06-01T00:00:00Z' }),
      makeRow({ id: 'c', startDateLocal: '2024-03-01T00:00:00Z' }),
    ];
    const sorted = sortRows(rows, 'date', 'desc');
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array (identity and order unchanged)', () => {
    const rows = [
      makeRow({ id: 'a', startDateLocal: '2024-01-01T00:00:00Z' }),
      makeRow({ id: 'b', startDateLocal: '2024-06-01T00:00:00Z' }),
    ];
    const originalOrder = rows.map((r) => r.id);
    const originalArray = rows;
    sortRows(rows, 'date', 'desc');
    expect(rows).toBe(originalArray);
    expect(rows.map((r) => r.id)).toEqual(originalOrder);
  });

  it('is stable: two rows with an identical sort value keep their relative input order', () => {
    const rows = [
      makeRow({ id: 'a', distanceM: 5000 }),
      makeRow({ id: 'b', distanceM: 5000 }),
      makeRow({ id: 'c', distanceM: 5000 }),
    ];
    const sorted = sortRows(rows, 'distance', 'asc');
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('sortRows — pace (nulls last in both directions)', () => {
  it('fastest-first on asc, with a null pace sorting last', () => {
    const rows = [
      makeRow({ id: 'slow', paceSecPerKm: 360 }),
      makeRow({ id: 'null', paceSecPerKm: null }),
      makeRow({ id: 'fast', paceSecPerKm: 240 }),
    ];
    const sorted = sortRows(rows, 'pace', 'asc');
    expect(sorted.map((r) => r.id)).toEqual(['fast', 'slow', 'null']);
  });

  it('a null pace still sorts last on desc', () => {
    const rows = [
      makeRow({ id: 'slow', paceSecPerKm: 360 }),
      makeRow({ id: 'null', paceSecPerKm: null }),
      makeRow({ id: 'fast', paceSecPerKm: 240 }),
    ];
    const sorted = sortRows(rows, 'pace', 'desc');
    expect(sorted.map((r) => r.id)).toEqual(['slow', 'fast', 'null']);
  });
});

describe('sortRows — avgHr (nulls last in both directions)', () => {
  it('sorts by avgHr desc with a null avgHr last', () => {
    const rows = [
      makeRow({ id: 'low', avgHr: 130 }),
      makeRow({ id: 'null', avgHr: null }),
      makeRow({ id: 'high', avgHr: 170 }),
    ];
    const sorted = sortRows(rows, 'avgHr', 'desc');
    expect(sorted.map((r) => r.id)).toEqual(['high', 'low', 'null']);
  });

  it('sorts by avgHr asc with a null avgHr still last', () => {
    const rows = [
      makeRow({ id: 'low', avgHr: 130 }),
      makeRow({ id: 'null', avgHr: null }),
      makeRow({ id: 'high', avgHr: 170 }),
    ];
    const sorted = sortRows(rows, 'avgHr', 'asc');
    expect(sorted.map((r) => r.id)).toEqual(['low', 'high', 'null']);
  });
});

describe('compareRows', () => {
  it('is used consistently by sortRows for equal semantics', () => {
    const a = makeRow({ id: 'a', movingTimeSec: 1000 });
    const b = makeRow({ id: 'b', movingTimeSec: 2000 });
    expect(compareRows(a, b, 'movingTime', 'asc')).toBeLessThan(0);
    expect(compareRows(a, b, 'movingTime', 'desc')).toBeGreaterThan(0);
  });
});

describe('paginate', () => {
  it('paginate(items, 3, 50) on 120 items returns page 3 slice', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const result = paginate(items, 3, 50);
    expect(result.pageItems).toEqual(items.slice(100, 120));
    expect(result.totalPages).toBe(3);
    expect(result.clampedPage).toBe(3);
  });

  it('clamps an out-of-range high page to the last page', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const result = paginate(items, 99, 50);
    expect(result.clampedPage).toBe(3);
  });

  it('clamps a negative page to page 1', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const result = paginate(items, -4, 50);
    expect(result.clampedPage).toBe(1);
  });

  it('an empty input always returns totalPages: 1 and an empty pageItems (never 0 pages)', () => {
    const result = paginate([], 1, 50);
    expect(result.totalPages).toBe(1);
    expect(result.pageItems).toEqual([]);
    expect(result.clampedPage).toBe(1);
  });

  it('defaults pageSize to PAGE_SIZE', () => {
    const items = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => i);
    const result = paginate(items, 1);
    expect(result.pageItems.length).toBe(PAGE_SIZE);
    expect(result.totalPages).toBe(2);
  });
});

describe('parseListQuery — hostile query string never throws, never NaN, never an unknown sort key', () => {
  it('a malicious/malformed query string resolves entirely to safe defaults', () => {
    const query = new URLSearchParams(
      'sort=__proto__&dir=sideways&page=-99999&dmin=Infinity&dmax=abc'
    );
    const result = parseListQuery(query);

    expect(result.sort).toBe('date');
    expect(result.dir).toBe('desc');
    expect(result.page).toBe(1);
    expect(result.filters.dMinKm).toBeNull();
    expect(result.filters.dMaxKm).toBeNull();
    expect(result.filters.pMinSec).toBeNull();
    expect(result.filters.pMaxSec).toBeNull();
    expect(result.filters.tMinMin).toBeNull();
    expect(result.filters.tMaxMin).toBeNull();
    expect(Object.getPrototypeOf(result.filters)).toBe(Object.prototype);
  });
});

describe('parseListQuery — empty query', () => {
  it('an empty URLSearchParams returns the fully-default ListState', () => {
    const result = parseListQuery(new URLSearchParams());
    expect(result).toEqual({ sort: 'date', dir: 'desc', page: 1, filters: EMPTY_FILTERS });
  });
});

describe('parseListQuery / serializeListQuery round-trip', () => {
  const cases: ListState[] = [
    {
      sort: 'pace',
      dir: 'asc',
      page: 1,
      filters: { ...EMPTY_FILTERS, q: 'hills' },
    },
    {
      sort: 'distance',
      dir: 'asc',
      page: 3,
      filters: { ...EMPTY_FILTERS, dMinKm: 10, dMaxKm: 25.5 },
    },
    {
      sort: 'avgHr',
      dir: 'desc',
      page: 2,
      filters: {
        ...EMPTY_FILTERS,
        from: '2024-01-01',
        to: '2024-12-31',
        pMinSec: 240,
        pMaxSec: 330,
        tMinMin: 20,
        tMaxMin: 90,
      },
    },
  ];

  for (const state of cases) {
    it(`round-trips sort=${state.sort} dir=${state.dir} page=${state.page}`, () => {
      const query = serializeListQuery(state);
      const reparsed = parseListQuery(query);
      expect(reparsed).toEqual(state);
    });
  }

  it('serializeListQuery omits every key at its default value — a pristine list URL is bare', () => {
    const params = serializeListQuery(DEFAULT_LIST_STATE);
    expect(params.toString()).toBe('');
  });
});

describe('parsePaceInput / formatPaceInput', () => {
  it('parsePaceInput("5:30") -> 330', () => {
    expect(parsePaceInput('5:30')).toBe(330);
  });

  it('parsePaceInput("330") -> 330', () => {
    expect(parsePaceInput('330')).toBe(330);
  });

  it('parsePaceInput("5:75") -> null (invalid seconds)', () => {
    expect(parsePaceInput('5:75')).toBeNull();
  });

  it('parsePaceInput("") -> null', () => {
    expect(parsePaceInput('')).toBeNull();
  });

  it('parsePaceInput("abc") -> null', () => {
    expect(parsePaceInput('abc')).toBeNull();
  });

  it('formatPaceInput(330) -> "5:30"', () => {
    expect(formatPaceInput(330)).toBe('5:30');
  });
});

// Sanity check that DEFAULT_DIR covers every SortKey used above (guards
// against a future SortKey addition silently missing a default direction).
describe('DEFAULT_DIR', () => {
  it('has an entry for every sort key exercised by this suite', () => {
    const keys: SortKey[] = ['date', 'distance', 'movingTime', 'pace', 'avgHr'];
    for (const key of keys) {
      expect(['asc', 'desc']).toContain(DEFAULT_DIR[key] as SortDir);
    }
  });
});
