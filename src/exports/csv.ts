/**
 * Minimal CSV support for bulk-export files.
 *
 * Strava's activities.csv needs two things most quick parsers get wrong:
 * quoted fields containing commas (every date: "Aug 8, 2026, 5:14:17 AM") and
 * duplicate column names — Distance, Elapsed Time and Max Heart Rate each
 * appear twice, first in display units and again in canonical units (meters,
 * seconds). Callers pick the occurrence they mean via columnIndices.
 */

/** Parse CSV text into rows of fields. Handles quotes, "" escapes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      // Skip blank lines (including the trailing newline at EOF).
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  return rows;
}

/** Every index at which each column name occurs, in order of appearance. */
export function columnIndices(header: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  header.forEach((name, i) => {
    const trimmed = name.trim();
    if (!map.has(trimmed)) map.set(trimmed, []);
    map.get(trimmed)!.push(i);
  });
  return map;
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parse Strava's export date format ("Aug 8, 2026, 5:14:17 AM") as UTC.
 *
 * The export's times are UTC — verified by matching 1,861 rows against
 * archived start_date values to the second. Native Date.parse would apply
 * the local timezone, silently shifting every activity.
 */
export function parseStravaExportDate(value: string): number | undefined {
  const m = value.match(/^(\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/);
  if (!m) return undefined;

  const month = MONTHS[m[1]];
  if (month === undefined) return undefined;

  let hour = parseInt(m[4], 10) % 12;
  if (m[7] === 'PM') hour += 12;

  return Date.UTC(
    parseInt(m[3], 10), month, parseInt(m[2], 10),
    hour, parseInt(m[5], 10), parseInt(m[6], 10)
  ) / 1000;
}
