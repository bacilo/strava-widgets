import { describe, expect, it } from 'vitest';

import {
  activityDayKey,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  shiftMonth,
} from './calendar-logic.js';

describe('parseMonthParam — valid values', () => {
  it('parseMonthParam("2024-03", now) returns { year: 2024, month: 3 }', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    expect(parseMonthParam('2024-03', now)).toEqual({ year: 2024, month: 3 });
  });

  it('parseMonthParam(null, now) falls back to now\'s UTC year/month', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    expect(parseMonthParam(null, now)).toEqual({ year: 2026, month: 8 });
  });
});

describe('parseMonthParam — hostile input falls back to now, never throws', () => {
  const now = new Date('2026-08-11T00:00:00Z');
  const expected = { year: 2026, month: 8 };

  it('parseMonthParam("2024-13", now) falls back (month out of range)', () => {
    expect(parseMonthParam('2024-13', now)).toEqual(expected);
  });

  it('parseMonthParam("2024-00", now) falls back (month out of range)', () => {
    expect(parseMonthParam('2024-00', now)).toEqual(expected);
  });

  it('parseMonthParam("abcd-ef", now) falls back (non-numeric)', () => {
    expect(parseMonthParam('abcd-ef', now)).toEqual(expected);
  });

  it('parseMonthParam("../../etc", now) falls back (traversal-looking value)', () => {
    expect(parseMonthParam('../../etc', now)).toEqual(expected);
  });

  it('parseMonthParam("99999-01", now) falls back (year out of range)', () => {
    expect(parseMonthParam('99999-01', now)).toEqual(expected);
  });

  it('parseMonthParam("", now) falls back (empty string)', () => {
    expect(parseMonthParam('', now)).toEqual(expected);
  });
});

describe('formatMonthParam', () => {
  it('formatMonthParam({ year: 2024, month: 3 }) returns "2024-03" (zero-padded)', () => {
    expect(formatMonthParam({ year: 2024, month: 3 })).toBe('2024-03');
  });

  it('formatMonthParam({ year: 2024, month: 11 }) returns "2024-11" (no extra padding)', () => {
    expect(formatMonthParam({ year: 2024, month: 11 })).toBe('2024-11');
  });
});

describe('shiftMonth — year rollover', () => {
  it('shiftMonth({ year: 2024, month: 12 }, 1) rolls into January of the next year', () => {
    expect(shiftMonth({ year: 2024, month: 12 }, 1)).toEqual({ year: 2025, month: 1 });
  });

  it('shiftMonth({ year: 2024, month: 1 }, -1) rolls back into December of the prior year', () => {
    expect(shiftMonth({ year: 2024, month: 1 }, -1)).toEqual({ year: 2023, month: 12 });
  });

  it('shiftMonth({ year: 2024, month: 6 }, 1) stays within the same year', () => {
    expect(shiftMonth({ year: 2024, month: 6 }, 1)).toEqual({ year: 2024, month: 7 });
  });
});

describe('monthLabel', () => {
  it('monthLabel({ year: 2024, month: 3 }) returns "March 2024"', () => {
    expect(monthLabel({ year: 2024, month: 3 })).toBe('March 2024');
  });

  it('monthLabel({ year: 2026, month: 1 }) returns "January 2026"', () => {
    expect(monthLabel({ year: 2026, month: 1 })).toBe('January 2026');
  });

  it('monthLabel({ year: 2026, month: 12 }) returns "December 2026"', () => {
    expect(monthLabel({ year: 2026, month: 12 })).toBe('December 2026');
  });
});

describe('activityDayKey — Strava-era (Z-suffixed) and intervals.icu-era (no Z) shapes', () => {
  it('activityDayKey("2024-01-15T09:00:00Z") returns "2024-01-15"', () => {
    expect(activityDayKey('2024-01-15T09:00:00Z')).toBe('2024-01-15');
  });

  it('activityDayKey("2026-08-06T07:28:22") (no Z, intervals.icu shape) returns "2026-08-06" — not shifted by the runner\'s UTC offset', () => {
    expect(activityDayKey('2026-08-06T07:28:22')).toBe('2026-08-06');
  });

  it('activityDayKey("2024-01-15T23:59:00Z") stays on its own local day', () => {
    expect(activityDayKey('2024-01-15T23:59:00Z')).toBe('2024-01-15');
  });

  it('activityDayKey("not-a-date") returns null', () => {
    expect(activityDayKey('not-a-date')).toBeNull();
  });

  it('activityDayKey(undefined) returns null', () => {
    expect(activityDayKey(undefined as unknown as string)).toBeNull();
  });
});
