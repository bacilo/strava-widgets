import { describe, expect, it } from 'vitest';

import { columnIndices, parseCsv, parseStravaExportDate } from './csv.js';

describe('parseCsv', () => {
  it('splits plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields — every Strava date has two', () => {
    expect(parseCsv('id,date\n123,"Aug 8, 2026, 5:14:17 AM"\n')).toEqual([
      ['id', 'date'],
      ['123', 'Aug 8, 2026, 5:14:17 AM'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('name\n"the ""long"" run"\n')).toEqual([['name'], ['the "long" run']]);
  });

  it('handles CRLF line endings and a missing trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('preserves empty fields', () => {
    expect(parseCsv('a,b,c\n1,,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });
});

describe('columnIndices', () => {
  it('records every occurrence of duplicated headers', () => {
    // activities.csv repeats Distance (km first, meters second) — the reason
    // this helper exists.
    const cols = columnIndices(['Activity ID', 'Distance', 'Moving Time', 'Distance']);

    expect(cols.get('Distance')).toEqual([1, 3]);
    expect(cols.get('Activity ID')).toEqual([0]);
  });
});

describe('parseStravaExportDate', () => {
  it('parses the export format as UTC', () => {
    // Verified against the archive: this run's start_date is 2026-08-08T05:14:17Z.
    expect(parseStravaExportDate('Aug 8, 2026, 5:14:17 AM')).toBe(
      Date.UTC(2026, 7, 8, 5, 14, 17) / 1000
    );
  });

  it('handles PM', () => {
    expect(parseStravaExportDate('Apr 13, 2024, 10:53:08 PM')).toBe(
      Date.UTC(2024, 3, 13, 22, 53, 8) / 1000
    );
  });

  it('handles the 12 AM / 12 PM edge', () => {
    expect(parseStravaExportDate('Jan 1, 2020, 12:00:00 AM')).toBe(Date.UTC(2020, 0, 1) / 1000);
    expect(parseStravaExportDate('Jan 1, 2020, 12:30:00 PM')).toBe(
      Date.UTC(2020, 0, 1, 12, 30) / 1000
    );
  });

  it('rejects what it cannot parse rather than guessing', () => {
    expect(parseStravaExportDate('2026-08-08T05:14:17Z')).toBeUndefined();
    expect(parseStravaExportDate('')).toBeUndefined();
  });
});
