/**
 * Pure, DOM-free logic behind the Trends page's Volume tab: the
 * three-granularity distance series and the 53x7 year consistency grid
 * (D-04, D-15, D-21, TREND-01). Injected inputs only — no DOM globals and no
 * fresh clock reads constructed inside this module.
 *
 * `weekly-distance.json`, `monthly-stats.json` and `yearly-stats.json` do
 * NOT share a field shape: weekly uses `weekStartISO`; monthly and yearly
 * use `periodStart`/`periodLabel`. `buildVolumeSeries` reads the correct
 * field per granularity rather than assuming a single shape across all
 * three (a copy-paste risk the test suite asserts against directly).
 */

import { activityDayKey, tintStepForDistance } from './calendar-logic.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

// ---------------------------------------------------------------------------
// Granularity toggle
// ---------------------------------------------------------------------------

export type VolumeGranularity = 'weekly' | 'monthly' | 'yearly';

export const VOLUME_GRANULARITIES: readonly VolumeGranularity[] = ['weekly', 'monthly', 'yearly'];

/** Allow-list, default `'weekly'` — same idiom as `parseTrendTab`. */
export function parseVolumeGranularity(raw: string | null): VolumeGranularity {
  if (raw !== null && (VOLUME_GRANULARITIES as readonly string[]).includes(raw)) {
    return raw as VolumeGranularity;
  }
  return 'weekly';
}

// ---------------------------------------------------------------------------
// Volume series
// ---------------------------------------------------------------------------

/**
 * One point in a volume series. `x` is epoch-ms of the period start — a
 * `'linear'` Chart.js scale value, NEVER a Chart.js time-axis scale value
 * (this repo has zero precedent for that scale type; 18-UI-SPEC § 14
 * restates it as a hard requirement).
 */
export interface VolumePoint {
  x: number;
  km: number;
  runs: number;
  label: string;
}

interface RawStatEntry {
  weekStartISO?: unknown;
  periodStart?: unknown;
  periodLabel?: unknown;
  totalKm?: unknown;
  runCount?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function toDerivedLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds one granularity's series from its raw stats payload. Total and
 * tolerant: `input` may be `null` (a failed fetch), `undefined`, or
 * malformed — in every such case this returns `[]` rather than throwing.
 * Entries with a non-finite `totalKm` or an unparseable date are dropped
 * individually; the rest of the array still contributes. Output is sorted
 * ascending by `x`.
 */
function buildSeriesForGranularity(input: unknown, dateField: 'weekStartISO' | 'periodStart'): VolumePoint[] {
  if (!Array.isArray(input)) return [];

  const points: VolumePoint[] = [];

  for (const entry of input) {
    if (!isRecord(entry)) continue;
    const raw = entry as RawStatEntry;

    if (!hasOwn(entry, dateField)) continue;
    const dateRaw = dateField === 'weekStartISO' ? raw.weekStartISO : raw.periodStart;
    if (typeof dateRaw !== 'string') continue;

    const epochMs = Date.parse(dateRaw);
    if (!Number.isFinite(epochMs)) continue;

    const totalKm = hasOwn(entry, 'totalKm') ? raw.totalKm : undefined;
    if (typeof totalKm !== 'number' || !Number.isFinite(totalKm)) continue;

    const runCount = hasOwn(entry, 'runCount') && typeof raw.runCount === 'number' ? raw.runCount : 0;

    const periodLabel = hasOwn(entry, 'periodLabel') ? raw.periodLabel : undefined;
    const label = typeof periodLabel === 'string' && periodLabel.length > 0
      ? periodLabel
      : toDerivedLabel(epochMs);

    points.push({ x: epochMs, km: totalKm, runs: runCount, label });
  }

  points.sort((a, b) => a.x - b.x);
  return points;
}

/**
 * Builds the volume series for the requested granularity from all three raw
 * stats documents. Each input may independently be `null` or malformed
 * (a failed fetch), in which case the requested granularity's series is
 * `[]` rather than throwing.
 */
export function buildVolumeSeries(
  weekly: unknown,
  monthly: unknown,
  yearly: unknown,
  granularity: VolumeGranularity
): VolumePoint[] {
  switch (granularity) {
    case 'weekly':
      return buildSeriesForGranularity(weekly, 'weekStartISO');
    case 'monthly':
      return buildSeriesForGranularity(monthly, 'periodStart');
    case 'yearly':
      return buildSeriesForGranularity(yearly, 'periodStart');
  }
}

// ---------------------------------------------------------------------------
// 53x7 year consistency grid (GitHub's Sunday-first convention)
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  week: number;
  dow: number;
  dateISO: string;
  km: number;
  runs: number;
  tint: 0 | 1 | 2 | 3 | 4;
}

/**
 * Groups `rows` by `activityDayKey`, then walks every calendar day of
 * `year` in UTC emitting one cell per day. `dow` is `getUTCDay()`
 * (0 = Sunday, GitHub's own convention). `week` starts at 0 and increments
 * after each Saturday, so the first partial week occupies column 0. `tint`
 * is derived via `tintStepForDistance` — this module writes NO second tint
 * scale — so a rest day (`km === 0`) yields tint `0`, which the stylesheet
 * renders with no accent at all (D-15).
 */
export function buildYearGrid(rows: readonly DashboardIndexRow[], year: number): HeatmapCell[] {
  const byDay = new Map<string, { km: number; runs: number }>();

  for (const row of rows) {
    const dayKey = activityDayKey(row.startDateLocal);
    if (dayKey === null) continue;
    if (!dayKey.startsWith(`${year}-`)) continue;

    const existing = byDay.get(dayKey);
    const km = row.distanceM / 1000;
    if (existing) {
      existing.km += km;
      existing.runs += 1;
    } else {
      byDay.set(dayKey, { km, runs: 1 });
    }
  }

  const cells: HeatmapCell[] = [];
  const jan1 = Date.UTC(year, 0, 1);
  const totalDays = Math.round((Date.UTC(year + 1, 0, 1) - jan1) / 86_400_000);

  let week = 0;

  for (let i = 0; i < totalDays; i++) {
    const dayMs = jan1 + i * 86_400_000;
    const d = new Date(dayMs);
    const dow = d.getUTCDay();

    const year4 = String(d.getUTCFullYear()).padStart(4, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateISO = `${year4}-${month}-${day}`;

    const entry = byDay.get(dateISO);
    const km = entry?.km ?? 0;
    const runs = entry?.runs ?? 0;

    cells.push({
      week,
      dow,
      dateISO,
      km,
      runs,
      tint: tintStepForDistance(km * 1000),
    });

    // After emitting a Saturday cell, advance to the next week column —
    // unless this is the very last day of the year.
    if (dow === 6 && i < totalDays - 1) {
      week += 1;
    }
  }

  return cells;
}

/** Distinct years with at least one activity, descending, for the year `<select>`. */
export function listActivityYears(rows: readonly DashboardIndexRow[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    const dayKey = activityDayKey(row.startDateLocal);
    if (dayKey === null) continue;
    years.add(Number(dayKey.slice(0, 4)));
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Feeds § 8's single summarizing `aria-label` and the "View as table"
 * disclosure, so the heatmap's information is reachable without 366
 * focusable cells.
 */
export function yearGridSummary(cells: readonly HeatmapCell[]): { activeDays: number; totalKm: number; year: number | null } {
  let activeDays = 0;
  let totalKm = 0;
  let year: number | null = null;

  for (const cell of cells) {
    if (cell.runs > 0) activeDays += 1;
    totalKm += cell.km;
    if (year === null) {
      year = Number(cell.dateISO.slice(0, 4));
    }
  }

  return { activeDays, totalKm, year };
}
