import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  DEFAULT_DIR,
  DEFAULT_LIST_STATE,
  DISTANCE_PRESETS,
  EMPTY_FILTERS,
  PAGE_SIZE,
  activeFilterCount,
  buildFilterChips,
  compareRows,
  datePresetRange,
  filterRows,
  formatPaceInput,
  paginate,
  parseListQuery,
  parsePaceInput,
  removeChip,
  serializeListQuery,
  sortRows,
  type FilterState,
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
    gearName: null,
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

describe('filterRows — AND semantics (D-11)', () => {
  it('EMPTY_FILTERS returns every row (contents, not array identity)', () => {
    const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })];
    const result = filterRows(rows, EMPTY_FILTERS);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result).not.toBe(rows);
  });

  it('two active filters narrow together — a distance filter AND a name filter', () => {
    const rows = [
      makeRow({ id: 'both', distanceM: 15000, name: 'Evening hills repeat' }),
      makeRow({ id: 'distance-only', distanceM: 15000, name: 'Flat tempo' }),
      makeRow({ id: 'name-only', distanceM: 5000, name: 'Hills recovery' }),
    ];
    const result = filterRows(rows, { ...EMPTY_FILTERS, dMinKm: 10, dMaxKm: 25, q: 'hills' });
    expect(result.map((r) => r.id)).toEqual(['both']);
  });

  it('q matching is case-insensitive substring on name only, after trimming', () => {
    const rows = [
      makeRow({ id: 'match', name: 'Evening hills repeat' }),
      makeRow({ id: 'no-match', name: 'Flat tempo' }),
      makeRow({ id: 'location-only', name: 'Recovery jog', location: 'Hillsborough' }),
    ];
    const result = filterRows(rows, { ...EMPTY_FILTERS, q: '  HILLS ' });
    expect(result.map((r) => r.id)).toEqual(['match']);
  });

  it('a row whose paceSecPerKm is null is excluded when a pace filter is active', () => {
    const rows = [
      makeRow({ id: 'has-pace', paceSecPerKm: 300 }),
      makeRow({ id: 'no-pace', paceSecPerKm: null }),
    ];
    const result = filterRows(rows, { ...EMPTY_FILTERS, pMinSec: 200, pMaxSec: 400 });
    expect(result.map((r) => r.id)).toEqual(['has-pace']);
  });

  it('a row whose paceSecPerKm is null is included when no pace filter is active', () => {
    const rows = [makeRow({ id: 'no-pace', paceSecPerKm: null })];
    const result = filterRows(rows, EMPTY_FILTERS);
    expect(result.map((r) => r.id)).toEqual(['no-pace']);
  });

  it('from/to inclusive range includes a Z-suffixed boundary and excludes a no-Z row past it', () => {
    const rows = [
      makeRow({ id: 'inside', startDateLocal: '2024-12-31T23:30:00Z' }),
      makeRow({ id: 'outside-no-z', startDateLocal: '2025-01-01T00:05:00' }),
    ];
    const result = filterRows(rows, { ...EMPTY_FILTERS, from: '2024-01-01', to: '2024-12-31' });
    expect(result.map((r) => r.id)).toEqual(['inside']);
  });

  it('the intervals.icu no-Z startDateLocal form is compared correctly regardless of runner UTC offset', () => {
    const rows = [
      // Late-evening no-Z local time — must not shift to the next day under
      // the Z-suffix normalization rule (WR-02 lineage).
      makeRow({ id: 'late-evening', startDateLocal: '2024-12-31T23:30:00' }),
    ];
    const result = filterRows(rows, { ...EMPTY_FILTERS, from: '2024-01-01', to: '2024-12-31' });
    expect(result.map((r) => r.id)).toEqual(['late-evening']);
  });
});

describe('activeFilterCount', () => {
  it('EMPTY_FILTERS is 0', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('q + distance range + date range is 3 (one per chip group, not per bound)', () => {
    const filters: FilterState = {
      ...EMPTY_FILTERS,
      q: 'hills',
      dMinKm: 10,
      dMaxKm: 25,
      from: '2024-01-01',
      to: '2024-12-31',
    };
    expect(activeFilterCount(filters)).toBe(3);
  });
});

describe('buildFilterChips', () => {
  it('a distance range with both bounds yields "10–25 km"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, dMinKm: 10, dMaxKm: 25 });
    expect(chips).toEqual([{ key: 'distance', label: '10–25 km' }]);
  });

  it('a distance min-only yields "10 km+"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, dMinKm: 10, dMaxKm: null });
    expect(chips).toEqual([{ key: 'distance', label: '10 km+' }]);
  });

  it('a distance max-only yields "up to 25 km"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, dMinKm: null, dMaxKm: 25 });
    expect(chips).toEqual([{ key: 'distance', label: 'up to 25 km' }]);
  });

  it('a date range covering exactly one calendar year yields the chip label "2024"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, from: '2024-01-01', to: '2024-12-31' });
    expect(chips).toEqual([{ key: 'date', label: '2024' }]);
  });

  it('a date range NOT covering exactly one calendar year yields "{from} – {to}"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, from: '2024-03-01', to: '2024-09-30' });
    expect(chips).toEqual([{ key: 'date', label: '2024-03-01 – 2024-09-30' }]);
  });

  it('a from-only date range yields "from {from}"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, from: '2024-03-01', to: null });
    expect(chips).toEqual([{ key: 'date', label: 'from 2024-03-01' }]);
  });

  it('a to-only date range yields "until {to}"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, from: null, to: '2024-09-30' });
    expect(chips).toEqual([{ key: 'date', label: 'until 2024-09-30' }]);
  });

  it('q yields the chip label "name: hills"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, q: 'hills' });
    expect(chips).toEqual([{ key: 'q', label: 'name: hills' }]);
  });

  it('chips are ordered q, date, distance, pace, duration', () => {
    const chips = buildFilterChips({
      ...EMPTY_FILTERS,
      q: 'hills',
      from: '2024-01-01',
      to: '2024-12-31',
      dMinKm: 10,
      dMaxKm: 25,
      pMinSec: 240,
      pMaxSec: 330,
      tMinMin: 20,
      tMaxMin: 90,
    });
    expect(chips.map((c) => c.key)).toEqual(['q', 'date', 'distance', 'pace', 'duration']);
  });

  it('a pace range renders via formatPaceInput as e.g. "4:00–5:30/km"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, pMinSec: 240, pMaxSec: 330 });
    expect(chips).toEqual([{ key: 'pace', label: '4:00–5:30/km' }]);
  });

  it('a duration range renders as e.g. "30–90 min"', () => {
    const chips = buildFilterChips({ ...EMPTY_FILTERS, tMinMin: 30, tMaxMin: 90 });
    expect(chips).toEqual([{ key: 'duration', label: '30–90 min' }]);
  });
});

describe('removeChip', () => {
  it('removeChip(filters, "distance") clears both dMinKm and dMaxKm and leaves everything else untouched', () => {
    const filters: FilterState = {
      ...EMPTY_FILTERS,
      q: 'hills',
      dMinKm: 10,
      dMaxKm: 25,
      from: '2024-01-01',
    };
    const result = removeChip(filters, 'distance');
    expect(result).toEqual({ ...filters, dMinKm: null, dMaxKm: null });
  });

  it('removeChip(filters, "date") clears both from and to', () => {
    const filters: FilterState = { ...EMPTY_FILTERS, from: '2024-01-01', to: '2024-12-31', q: 'kept' };
    const result = removeChip(filters, 'date');
    expect(result).toEqual({ ...filters, from: null, to: null });
  });

  it('removeChip(filters, "q") clears q only', () => {
    const filters: FilterState = { ...EMPTY_FILTERS, q: 'hills', dMinKm: 10 };
    const result = removeChip(filters, 'q');
    expect(result).toEqual({ ...filters, q: '' });
  });

  it('removeChip(filters, "pace") clears both pMinSec and pMaxSec', () => {
    const filters: FilterState = { ...EMPTY_FILTERS, pMinSec: 240, pMaxSec: 330 };
    const result = removeChip(filters, 'pace');
    expect(result).toEqual({ ...filters, pMinSec: null, pMaxSec: null });
  });

  it('removeChip(filters, "duration") clears both tMinMin and tMaxMin', () => {
    const filters: FilterState = { ...EMPTY_FILTERS, tMinMin: 30, tMaxMin: 90 };
    const result = removeChip(filters, 'duration');
    expect(result).toEqual({ ...filters, tMinMin: null, tMaxMin: null });
  });
});

describe('DISTANCE_PRESETS', () => {
  it('has exactly four entries with the pinned numeric bounds', () => {
    expect(DISTANCE_PRESETS).toEqual([
      { id: '5k', label: '5K', dMinKm: 4.8, dMaxKm: 5.5 },
      { id: '10k', label: '10K', dMinKm: 9.6, dMaxKm: 11.0 },
      { id: 'hm', label: 'HM+', dMinKm: 21.0, dMaxKm: null },
      { id: 'marathon', label: 'Marathon+', dMinKm: 42.0, dMaxKm: null },
    ]);
  });
});

describe('datePresetRange', () => {
  it('"this-year" returns January 1 of the injected date\'s UTC year, open-ended', () => {
    const result = datePresetRange('this-year', new Date('2026-08-11T00:00:00Z'));
    expect(result).toEqual({ from: '2026-01-01', to: null });
  });

  it('"last-12-months" returns the same month/day one year earlier, open-ended', () => {
    const result = datePresetRange('last-12-months', new Date('2026-08-11T00:00:00Z'));
    expect(result).toEqual({ from: '2025-08-11', to: null });
  });
});
