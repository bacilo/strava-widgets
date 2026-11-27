import { describe, expect, it } from 'vitest';
import {
  formatDateTooltipTitle,
  formatDayTooltipTitle,
  formatDetailTooltipTitle,
  formatMonthTooltipTitle,
  formatVolumeTooltipTitle,
  titleFromItems,
} from './chart-tooltip-title.js';

describe('formatVolumeTooltipTitle', () => {
  it('formats weekly, monthly, yearly', () => {
    expect(formatVolumeTooltipTitle(Date.UTC(2026, 10, 23), 'weekly')).toBe('Week of 23 Nov 2026');
    expect(formatVolumeTooltipTitle(Date.UTC(2026, 10, 1), 'monthly')).toBe('November 2026');
    expect(formatVolumeTooltipTitle(Date.UTC(2026, 0, 1), 'yearly')).toBe('2026');
  });
  it('non-finite -> empty', () => {
    expect(formatVolumeTooltipTitle(NaN, 'weekly')).toBe('');
    expect(formatVolumeTooltipTitle(Infinity, 'yearly')).toBe('');
  });
});

describe('formatDayTooltipTitle', () => {
  it('formats weekday + date', () => {
    expect(formatDayTooltipTitle(Date.UTC(2026, 10, 23))).toBe('Mon 23 Nov 2026');
    expect(formatDayTooltipTitle(Date.UTC(2024, 1, 29))).toBe('Thu 29 Feb 2024');
    expect(formatDayTooltipTitle(NaN)).toBe('');
  });
});

describe('formatMonthTooltipTitle', () => {
  it('formats full month, in UTC', () => {
    expect(formatMonthTooltipTitle(Date.UTC(2025, 8, 1))).toBe('September 2025');
    expect(formatMonthTooltipTitle(Date.UTC(2026, 0, 1))).toBe('January 2026');
    expect(formatMonthTooltipTitle(Infinity)).toBe('');
  });
});

describe('formatDateTooltipTitle', () => {
  it('formats without zero padding', () => {
    expect(formatDateTooltipTitle(Date.UTC(2025, 2, 14))).toBe('14 Mar 2025');
    expect(formatDateTooltipTitle(Date.UTC(2025, 2, 4))).toBe('4 Mar 2025');
    expect(formatDateTooltipTitle(NaN)).toBe('');
  });
});

describe('formatDetailTooltipTitle', () => {
  it('distance mode', () => {
    expect(formatDetailTooltipTitle(3.4512, 'distance')).toBe('3.45 km');
    expect(formatDetailTooltipTitle(0, 'distance')).toBe('0.00 km');
  });
  it('time mode', () => {
    expect(formatDetailTooltipTitle(754, 'time')).toBe('12:34');
    expect(formatDetailTooltipTitle(59.6, 'time')).toBe('1:00');
    expect(formatDetailTooltipTitle(3754, 'time')).toBe('1:02:34');
    expect(formatDetailTooltipTitle(3600, 'time')).toBe('1:00:00');
  });
  it('non-finite -> empty', () => {
    expect(formatDetailTooltipTitle(NaN, 'distance')).toBe('');
    expect(formatDetailTooltipTitle(Infinity, 'time')).toBe('');
  });
});

describe('titleFromItems', () => {
  it('handles empty, valid, and malformed items', () => {
    expect(titleFromItems([], formatDayTooltipTitle)).toBe('');
    expect(titleFromItems([{ parsed: { x: Date.UTC(2026, 10, 23) } }], formatDayTooltipTitle)).toBe('Mon 23 Nov 2026');
    expect(titleFromItems([{ parsed: { x: 'abc' } }], formatDayTooltipTitle)).toBe('');
    expect(titleFromItems([{}], formatDayTooltipTitle)).toBe('');
    expect(titleFromItems([{ parsed: { x: NaN } }], formatDayTooltipTitle)).toBe('');
  });
});
