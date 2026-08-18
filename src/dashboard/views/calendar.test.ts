import { readFileSync } from 'node:fs';
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

/**
 * Source-structure regression guard for plan 22-04's week-start toggle, in
 * the same spirit as `row-semantics.test.ts` is a text guard over the view
 * files' TypeScript source. This block proves SOURCE TEXT SHAPE only — that
 * `setWeekStart`'s body contains none of the four calls that would reopen
 * Phase 20's two shipped focus-theft regressions, and that the segmented
 * markup matches the two shipped `.segmented` instances (`records.ts`,
 * `detail-charts.ts`).
 *
 * It proves NOTHING about rendering, clicking, focus order or screen-reader
 * announcement. Vitest runs in this repository with `environment: 'node'` —
 * there is no jsdom and no headless browser anywhere in it — so nothing here
 * can construct a live DOM, dispatch a click event, or observe where focus
 * actually lands. The only proof of that is plan 22-05's blocking browser
 * checkpoint (PROJECT.md line 49 — automated gates never discharge a visual
 * or interaction claim). A green run of this block is coverage of source
 * text only; do not read it as coverage of the toggle actually working.
 */
describe('calendar.ts — Phase 22 source-structure guards', () => {
  const calendarSource = readFileSync(new URL('./calendar.ts', import.meta.url), 'utf8');

  /**
   * Extracts a function's full body (the outermost `{...}` following the
   * given signature substring), balancing nested braces rather than matching
   * the first `}` — `setWeekStart`'s body has none today, but this stays
   * correct if a future edit adds one.
   */
  function extractFunctionBody(source: string, signature: string): string {
    const startIdx = source.indexOf(signature);
    if (startIdx === -1) throw new Error(`"${signature}" not found in calendar.ts`);
    const openBraceIdx = source.indexOf('{', startIdx);
    let depth = 0;
    let i = openBraceIdx;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return source.slice(openBraceIdx, i + 1);
  }

  const setWeekStartBody = extractFunctionBody(calendarSource, 'function setWeekStart');

  describe('D-04 — the toggle never steals focus or re-enters mount', () => {
    it('setWeekStart contains none of focus, mount(, navigateTo, await', () => {
      expect(setWeekStartBody).not.toContain('focus');
      expect(setWeekStartBody).not.toContain('mount(');
      expect(setWeekStartBody).not.toContain('navigateTo');
      expect(setWeekStartBody).not.toContain('await');
    });

    it('setWeekStart persists, clears the picker, and rebuilds the grid', () => {
      expect(setWeekStartBody).toContain('writeWeekStart');
      expect(setWeekStartBody).toContain('replaceChildren');
      expect(setWeekStartBody).toContain('buildMonthGrid');
      expect(setWeekStartBody).toContain('renderGrid');
    });

    it('the file has exactly two .focus() call sites, neither inside setWeekStart', () => {
      const focusMatches = calendarSource.match(/\.focus\(\)/g) ?? [];
      expect(focusMatches).toHaveLength(2);
      expect(setWeekStartBody).not.toMatch(/\.focus\(\)/);
    });
  });

  describe('D-01 — segmented markup invariants match the two shipped instances', () => {
    it('builds a role="group" .segmented container with aria-label "Week start"', () => {
      expect(calendarSource).toContain("'segmented'");
      expect(calendarSource).toContain("'role', 'group'");
      expect(calendarSource).toContain("'aria-label', 'Week start'");
    });

    it('has at least two segmented__option and two aria-pressed occurrences', () => {
      const optionMatches = calendarSource.match(/segmented__option/g) ?? [];
      const pressedMatches = calendarSource.match(/aria-pressed/g) ?? [];
      expect(optionMatches.length).toBeGreaterThanOrEqual(2);
      expect(pressedMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('uses segmented__option--active, the shared active-state class', () => {
      expect(calendarSource).toContain('segmented__option--active');
    });

    it('never creates a <select> — D-01 chose a segmented control, not a select', () => {
      expect(calendarSource).not.toContain("createElement('select')");
    });
  });

  describe('D-11 — the week-total cell adds no focus stop', () => {
    it('has exactly two tabindex writes (the picker heading and h1)', () => {
      const tabindexMatches = calendarSource.match(/tabindex/g) ?? [];
      expect(tabindexMatches).toHaveLength(2);
    });

    it('never introduces ARIA grid roles', () => {
      expect(calendarSource).not.toContain('role="gridcell"');
      expect(calendarSource).not.toContain('role="row"');
      expect(calendarSource).not.toContain('role="grid"');
    });
  });

  describe('D-02 — the control sits between the month input and the header end', () => {
    it('places the Week start control after the jump-to-month append and before the header append', () => {
      const jumpAppendIdx = calendarSource.indexOf('header.appendChild(jumpWrapper)');
      const controlIdx = calendarSource.indexOf("'aria-label', 'Week start'");
      const headerAppendIdx = calendarSource.indexOf('view.appendChild(header)');

      expect(jumpAppendIdx).toBeGreaterThan(-1);
      expect(controlIdx).toBeGreaterThan(-1);
      expect(headerAppendIdx).toBeGreaterThan(-1);
      expect(controlIdx).toBeGreaterThan(jumpAppendIdx);
      expect(controlIdx).toBeLessThan(headerAppendIdx);
    });
  });
});
