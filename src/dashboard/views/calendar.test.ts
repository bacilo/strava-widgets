import { describe, it, expect } from 'vitest';
import { weekdayLabels, formatWeekDuration, weekTotalAccessibleName } from './calendar.js';
import type { DayCell, WeekTotal } from './calendar-logic.js';

/**
 * Vitest runs here with `environment: 'node'` — there is no jsdom and no
 * headless browser in this repository, so nothing in this file constructs a
 * DOM, focuses an element or observes an accessibility tree. A green run is
 * coverage of pure string and array output only; the rendering proof (that
 * the eighth column actually appears, that the totals are legible, that the
 * accessible name is announced) is plan 22-05's browser checkpoint
 * (PROJECT.md line 49 — automated gates never discharge a visual claim).
 */

function dayCell(overrides: Partial<DayCell> & { dayOfMonth: number }): DayCell {
  return {
    dateKey: `2025-10-${String(overrides.dayOfMonth).padStart(2, '0')}`,
    totalDistanceM: 0,
    totalTimeSec: 0,
    runCount: 0,
    activityIds: [],
    tintStep: 0,
    ...overrides,
  };
}

describe('weekdayLabels', () => {
  it('returns the exact Sunday-first seven-element array', () => {
    expect(weekdayLabels('sunday')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('returns the exact Monday-first seven-element array', () => {
    expect(weekdayLabels('monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('is a rotation, not a rewrite — both orderings contain the same seven names', () => {
    const sunday = [...weekdayLabels('sunday')].sort();
    const monday = [...weekdayLabels('monday')].sort();
    expect(monday).toEqual(sunday);
  });
});

describe('formatWeekDuration', () => {
  // Pinned to 22-03-PLAN.md's <rounding_is_load_bearing> table — plan
  // 22-05's checkpoint reads these exact strings back from the browser.
  // Round-to-nearest-minute is load-bearing: truncation would produce a
  // different (wrong) string for every row below except the two noted as
  // truncation-stable.
  it('20500s (Oct 1-4/1-5 row) rounds to 5h 42m', () => {
    expect(formatWeekDuration(20500)).toBe('5h 42m');
  });

  it('28378s (Oct 5-11/6-12 row) rounds to 7h 53m', () => {
    expect(formatWeekDuration(28378)).toBe('7h 53m');
  });

  it('19594s (Oct 12-18 row) rounds to 5h 27m', () => {
    expect(formatWeekDuration(19594)).toBe('5h 27m');
  });

  it('36831s (Oct 19-25 row) rounds to 10h 14m', () => {
    expect(formatWeekDuration(36831)).toBe('10h 14m');
  });

  it('19911s (Oct 26-31/27-31 row) rounds to 5h 32m', () => {
    expect(formatWeekDuration(19911)).toBe('5h 32m');
  });

  it('28691s (Monday 13-19 row, truncation-stable) rounds to 7h 58m', () => {
    expect(formatWeekDuration(28691)).toBe('7h 58m');
  });

  it('27734s (Monday 20-26 row, truncation-stable) rounds to 7h 42m', () => {
    expect(formatWeekDuration(27734)).toBe('7h 42m');
  });

  it('rounds up across an hour boundary: 3599s -> 1h 0m', () => {
    expect(formatWeekDuration(3599)).toBe('1h 0m');
  });

  it('formats a sub-hour value with no hour component: 2700s -> 45m', () => {
    expect(formatWeekDuration(2700)).toBe('45m');
  });

  it('formats zero as 0m', () => {
    expect(formatWeekDuration(0)).toBe('0m');
  });

  it('formats NaN as 0m, staying total', () => {
    expect(formatWeekDuration(NaN)).toBe('0m');
  });
});

describe('weekTotalAccessibleName', () => {
  const october2025 = { year: 2025, month: 10 };
  const june2025 = { year: 2025, month: 6 };

  it('full week with runs: October 13-19, 2025, 80.0 km, 5 runs', () => {
    const week: (DayCell | null)[] = [
      dayCell({ dayOfMonth: 13 }),
      dayCell({ dayOfMonth: 14 }),
      dayCell({ dayOfMonth: 15 }),
      dayCell({ dayOfMonth: 16 }),
      dayCell({ dayOfMonth: 17 }),
      dayCell({ dayOfMonth: 18 }),
      dayCell({ dayOfMonth: 19 }),
    ];
    const total: WeekTotal = {
      totalDistanceM: 80000,
      totalTimeSec: 28691,
      runCount: 5,
      daysShown: 7,
      isPartial: false,
    };
    expect(weekTotalAccessibleName(total, week, october2025)).toBe(
      'Week of October 13–19, 2025, 80.0 km, 7h 58m, 5 runs'
    );
  });

  it('partial week with runs: October 1-5, 2025, 59.1 km, 5 runs', () => {
    const week: (DayCell | null)[] = [
      dayCell({ dayOfMonth: 1 }),
      dayCell({ dayOfMonth: 2 }),
      dayCell({ dayOfMonth: 3 }),
      dayCell({ dayOfMonth: 4 }),
      dayCell({ dayOfMonth: 5 }),
    ];
    const total: WeekTotal = {
      totalDistanceM: 59100,
      totalTimeSec: 20500,
      runCount: 5,
      daysShown: 5,
      isPartial: true,
    };
    expect(weekTotalAccessibleName(total, week, october2025)).toBe(
      'Partial week, 5 days shown, week of October 1–5, 2025, 59.1 km, 5h 42m, 5 runs'
    );
  });

  it('begins with "Partial week, 5 days shown,"', () => {
    const week: (DayCell | null)[] = [
      dayCell({ dayOfMonth: 1 }),
      dayCell({ dayOfMonth: 2 }),
      dayCell({ dayOfMonth: 3 }),
      dayCell({ dayOfMonth: 4 }),
      dayCell({ dayOfMonth: 5 }),
    ];
    const total: WeekTotal = {
      totalDistanceM: 59100,
      totalTimeSec: 20500,
      runCount: 5,
      daysShown: 5,
      isPartial: true,
    };
    expect(weekTotalAccessibleName(total, week, october2025)).toMatch(/^Partial week, 5 days shown,/);
  });

  it('full rest week: June 16-22, 2025, rest week', () => {
    const week: (DayCell | null)[] = [
      dayCell({ dayOfMonth: 16 }),
      dayCell({ dayOfMonth: 17 }),
      dayCell({ dayOfMonth: 18 }),
      dayCell({ dayOfMonth: 19 }),
      dayCell({ dayOfMonth: 20 }),
      dayCell({ dayOfMonth: 21 }),
      dayCell({ dayOfMonth: 22 }),
    ];
    const total: WeekTotal = {
      totalDistanceM: 0,
      totalTimeSec: 0,
      runCount: 0,
      daysShown: 7,
      isPartial: false,
    };
    expect(weekTotalAccessibleName(total, week, june2025)).toBe('Week of June 16–22, 2025, rest week');
  });

  it('single-day partial rest week: June 1, 2025, rest week, begins with "Partial week, 1 day shown,"', () => {
    const week: (DayCell | null)[] = [dayCell({ dayOfMonth: 1 })];
    const total: WeekTotal = {
      totalDistanceM: 0,
      totalTimeSec: 0,
      runCount: 0,
      daysShown: 1,
      isPartial: true,
    };
    const name = weekTotalAccessibleName(total, week, june2025);
    expect(name).toBe('Partial week, 1 day shown, week of June 1, 2025, rest week');
    expect(name).toMatch(/^Partial week, 1 day shown,/);
  });

  it('uses the singular "1 run" for a one-run week', () => {
    const week: (DayCell | null)[] = [dayCell({ dayOfMonth: 1 })];
    const total: WeekTotal = {
      totalDistanceM: 5000,
      totalTimeSec: 1800,
      runCount: 1,
      daysShown: 1,
      isPartial: true,
    };
    expect(weekTotalAccessibleName(total, week, june2025)).toContain('1 run');
    expect(weekTotalAccessibleName(total, week, june2025)).not.toContain('1 runs');
  });

  it('an all-null week returns "Empty week" and does not throw', () => {
    const week: (DayCell | null)[] = [null, null, null, null, null, null, null];
    const total: WeekTotal = {
      totalDistanceM: 0,
      totalTimeSec: 0,
      runCount: 0,
      daysShown: 0,
      isPartial: true,
    };
    expect(() => weekTotalAccessibleName(total, week, october2025)).not.toThrow();
    expect(weekTotalAccessibleName(total, week, october2025)).toBe('Empty week');
  });
});
