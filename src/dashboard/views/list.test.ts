import { describe, it, expect } from 'vitest';
import { formatActivityDate } from './list.js';

describe('formatActivityDate — WR-02 timezone-independent local dates', () => {
  it('formats a real intervals.icu no-Z record', () => {
    expect(formatActivityDate('2026-08-06T07:28:22')).toBe('Aug 6, 2026');
  });

  it('formats a late-evening no-Z record without shifting to the next day (US-viewer repro)', () => {
    expect(formatActivityDate('2026-08-06T22:30:00')).toBe('Aug 6, 2026');
  });

  it('formats an early-morning no-Z record without shifting to the previous day (EU-viewer repro)', () => {
    expect(formatActivityDate('2026-08-06T01:30:00')).toBe('Aug 6, 2026');
  });

  it('still formats a Z-suffixed Strava-shape record correctly', () => {
    expect(formatActivityDate('2024-01-15T09:00:00Z')).toBe('Jan 15, 2024');
  });

  it('formats a year boundary (Dec 31 no-Z)', () => {
    expect(formatActivityDate('2024-12-31T23:59:59')).toBe('Dec 31, 2024');
  });

  it('formats a year boundary the other way (Jan 1 no-Z)', () => {
    expect(formatActivityDate('2024-01-01T00:00:00')).toBe('Jan 1, 2024');
  });

  it('returns an em dash for unparseable input', () => {
    expect(formatActivityDate('not-a-date')).toBe('—');
  });

  it('returns an em dash for an empty string', () => {
    expect(formatActivityDate('')).toBe('—');
  });
});
