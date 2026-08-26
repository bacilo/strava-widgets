import { describe, expect, it } from 'vitest';

import {
  DAY_STEP_MAX_MS,
  MONTH_STEP_MAX_MS,
  formatAdaptiveTimeTick,
  formatTimeAxisTick,
  stepMsFromTicks,
  tickGranularityForStep,
} from './trends-tick-format.js';

// ---------------------------------------------------------------------------
// tickGranularityForStep
// ---------------------------------------------------------------------------

describe('tickGranularityForStep', () => {
  it('a 1-day step is day granularity', () => {
    expect(tickGranularityForStep(86400000)).toBe('day');
  });

  it('the exact ~11-day / 8-tick Training Load window Finding 7 observed is day granularity', () => {
    expect(tickGranularityForStep((11 * 86400000) / 7)).toBe('day');
  });

  it('the 32-day boundary, asserted from both sides', () => {
    expect(tickGranularityForStep(2764799999)).toBe('day');
    expect(tickGranularityForStep(2764800000)).toBe('month');
  });

  it('the 366-day boundary, asserted from both sides', () => {
    expect(tickGranularityForStep(31622399999)).toBe('month');
    expect(tickGranularityForStep(31622400000)).toBe('year');
  });

  it('returns month for 0, -1, NaN and Infinity without throwing', () => {
    expect(tickGranularityForStep(0)).toBe('month');
    expect(tickGranularityForStep(-1)).toBe('month');
    expect(tickGranularityForStep(NaN)).toBe('month');
    expect(tickGranularityForStep(Infinity)).toBe('month');
  });

  it('the exported threshold constants match the boundary values used above', () => {
    expect(DAY_STEP_MAX_MS).toBe(2764800000);
    expect(MONTH_STEP_MAX_MS).toBe(31622400000);
  });
});

// ---------------------------------------------------------------------------
// formatTimeAxisTick
// ---------------------------------------------------------------------------

describe('formatTimeAxisTick', () => {
  const anchor = Date.parse('2026-02-06T00:00:00.000Z');

  it('day granularity renders D MMM YYYY', () => {
    expect(formatTimeAxisTick(anchor, 'day')).toBe('6 Feb 2026');
  });

  it('month granularity renders MMM YYYY', () => {
    expect(formatTimeAxisTick(anchor, 'month')).toBe('Feb 2026');
  });

  it('year granularity renders YYYY', () => {
    expect(formatTimeAxisTick(anchor, 'year')).toBe('2026');
  });

  it('a non-finite epoch renders the empty string, not Invalid Date', () => {
    expect(formatTimeAxisTick(NaN, 'month')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatAdaptiveTimeTick — the composition point every Trends x-axis calls
// ---------------------------------------------------------------------------

describe('formatAdaptiveTimeTick', () => {
  it('adjacent 1-day-step ticks render different labels — the precise invariant Finding 7 violated', () => {
    const day1 = formatAdaptiveTimeTick(Date.parse('2026-02-06T00:00:00.000Z'), 86400000);
    const day2 = formatAdaptiveTimeTick(Date.parse('2026-02-07T00:00:00.000Z'), 86400000);
    expect(day1).toBe('6 Feb 2026');
    expect(day2).toBe('7 Feb 2026');
    expect(day1).not.toBe(day2);
  });

  it('never duplicates a label for adjacent ticks at any step, including a leap-year February anchor', () => {
    const steps = [
      86400000, // 1 day
      7 * 86400000, // 1 week
      2764800000, // 32 days — the day/month boundary
      90 * 86400000, // ~3 months
      31622400000, // 366 days — the month/year boundary
      3 * 365 * 86400000, // ~3 years
    ];
    const anchors = [
      Date.parse('2024-01-01T00:00:00.000Z'),
      Date.parse('2024-02-01T00:00:00.000Z'), // leap-year February
      Date.parse('2024-12-31T00:00:00.000Z'),
      Date.parse('2026-02-06T00:00:00.000Z'),
    ];

    for (const step of steps) {
      for (const anchor of anchors) {
        const a = formatAdaptiveTimeTick(anchor, step);
        const b = formatAdaptiveTimeTick(anchor + step, step);
        expect(a).not.toBe(b);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// stepMsFromTicks
// ---------------------------------------------------------------------------

describe('stepMsFromTicks', () => {
  it('the smallest strictly-positive finite difference between adjacent ticks', () => {
    expect(stepMsFromTicks([{ value: 0 }, { value: 86400000 }, { value: 172800000 }])).toBe(86400000);
  });

  it('an empty or single-entry array returns 0', () => {
    expect(stepMsFromTicks([])).toBe(0);
    expect(stepMsFromTicks([{ value: 5 }])).toBe(0);
  });

  it('a repeated value never collapses the step to 0', () => {
    expect(stepMsFromTicks([{ value: 10 }, { value: 10 }, { value: 10 + 86400000 }])).toBe(86400000);
  });

  it('a non-finite entry is skipped rather than poisoning the result', () => {
    expect(stepMsFromTicks([{ value: NaN }, { value: 86400000 }, { value: 2 * 86400000 }])).toBe(86400000);
  });
});
