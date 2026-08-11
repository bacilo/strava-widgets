/**
 * Pure, DOM-free logic behind the Trends page's Year-over-Year tab
 * (TREND-02). Parses the committed `data/stats/year-over-year.json`
 * payload tolerantly at entry level (the `parseGearDocument` discipline in
 * `gear-client.ts`: a single malformed entry is dropped, not the whole
 * document), then selects and reshapes years for a grouped-bar chart
 * following `comparison-chart/chart-config.ts`'s existing default of the 3
 * most recent years.
 */

const DEFAULT_YOY_YEAR_COUNT_VALUE = 3;
export const DEFAULT_YOY_YEAR_COUNT = DEFAULT_YOY_YEAR_COUNT_VALUE;

export interface YoyMonth {
  month: number;
  monthLabel: string;
  years: Record<string, { totalKm: number; totalRuns: number; totalHours: number }>;
}

/** Own-property read only — no prototype key is ever reachable through a parsed payload. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses one month entry's `years` map, keeping only own-property entries
 * whose value carries numeric `totalKm`, `totalRuns` and `totalHours`.
 * A malformed year entry is dropped individually.
 */
function parseYearsMap(raw: unknown): Record<string, { totalKm: number; totalRuns: number; totalHours: number }> | null {
  if (!isRecord(raw)) return null;

  const result: Record<string, { totalKm: number; totalRuns: number; totalHours: number }> = {};

  for (const key of Object.keys(raw)) {
    if (!hasOwn(raw, key)) continue;
    const entry = raw[key];
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'totalKm') || !hasOwn(entry, 'totalRuns') || !hasOwn(entry, 'totalHours')) continue;

    const { totalKm, totalRuns, totalHours } = entry;
    if (typeof totalKm !== 'number' || typeof totalRuns !== 'number' || typeof totalHours !== 'number') continue;

    result[key] = { totalKm, totalRuns, totalHours };
  }

  return result;
}

/**
 * Total, never-throwing parse of the year-over-year payload. Returns `[]`
 * unless `raw` is an array; each entry survives only when it carries a
 * numeric `month`, a string `monthLabel`, and a non-array object `years`
 * (parsed tolerantly by `parseYearsMap`). A malformed entry is dropped
 * individually rather than rejecting the whole payload.
 */
export function parseYearOverYear(raw: unknown): YoyMonth[] {
  if (!Array.isArray(raw)) return [];

  const months: YoyMonth[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'month') || !hasOwn(entry, 'monthLabel') || !hasOwn(entry, 'years')) continue;

    const { month, monthLabel } = entry;
    if (typeof month !== 'number' || typeof monthLabel !== 'string') continue;

    const years = parseYearsMap(entry.years);
    if (years === null) continue;

    months.push({ month, monthLabel, years });
  }

  return months;
}

/** Every distinct year appearing in any month, ascending. */
export function listYoyYears(months: readonly YoyMonth[]): number[] {
  const years = new Set<number>();
  for (const m of months) {
    for (const key of Object.keys(m.years)) {
      if (!hasOwn(m.years, key)) continue;
      const year = Number(key);
      if (Number.isFinite(year)) years.add(year);
    }
  }
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * The `DEFAULT_YOY_YEAR_COUNT` most recent years, ascending. Fewer than
 * three available returns all of them.
 */
export function defaultYoyYears(months: readonly YoyMonth[]): number[] {
  const years = listYoyYears(months);
  return years.slice(Math.max(0, years.length - DEFAULT_YOY_YEAR_COUNT));
}

export interface YoySeries {
  year: number;
  km: number[];
  runs: number[];
}

/**
 * One entry per requested year, each with a 12-element array indexed by
 * calendar month 1-12 (index 0 = January). A month with no data for that
 * year is `0` for both `runs` and `km` — for a BAR chart a missing bar and
 * a zero bar are the same pixel, so zero is honest here. Contrast with the
 * Cadence & HR tab (18-UI-SPEC § 10), where a missing month must be a LINE
 * GAP (`spanGaps: false`), never a zero, because on a line chart a zero is
 * a claim about the data, not an absence of it.
 */
export function buildYoySeries(months: readonly YoyMonth[], years: readonly number[]): YoySeries[] {
  return years.map((year) => {
    const km = new Array(12).fill(0) as number[];
    const runs = new Array(12).fill(0) as number[];

    for (const m of months) {
      const monthIndex = m.month - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;

      const yearData = hasOwn(m.years, String(year)) ? m.years[String(year)] : undefined;
      if (yearData === undefined) continue;

      km[monthIndex] = yearData.totalKm;
      runs[monthIndex] = yearData.totalRuns;
    }

    return { year, km, runs };
  });
}

/**
 * Adds or removes `year` from `selected`, ignoring years not present in
 * `available`, always returning a fresh ascending array. Removing the last
 * remaining year is a no-op — an empty chart would be an unrecoverable
 * dead end, so `selected` is guaranteed non-empty when non-empty on entry.
 */
export function toggleYoyYear(selected: readonly number[], year: number, available: readonly number[]): number[] {
  if (!available.includes(year)) {
    return [...selected].sort((a, b) => a - b);
  }

  const isSelected = selected.includes(year);

  if (isSelected) {
    if (selected.length <= 1) {
      // Never-empty guard: removing the last remaining year is a no-op.
      return [...selected].sort((a, b) => a - b);
    }
    return selected.filter((y) => y !== year).sort((a, b) => a - b);
  }

  return [...selected, year].sort((a, b) => a - b);
}
