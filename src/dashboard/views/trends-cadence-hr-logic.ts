/**
 * Pure, DOM-free logic behind the Trends page's Cadence & HR tab (TREND-03).
 * Groups the already-fetched dashboard index by calendar month and computes
 * a moving-time-weighted mean per channel (cadence, HR), following the
 * `calendar-logic.ts` grouping shape and its `activityDayKey` Z-suffix
 * normalization rule (18-PATTERNS.md § Shared Patterns — never refork a
 * second date parser).
 *
 * A month with zero contributing activity for a channel emits `value: null`
 * rather than `0` or an interpolated bridge — Chart.js renders a `null`
 * point as a genuine line gap when the caller sets `spanGaps: false`
 * (18-UI-SPEC § 10). This is the same "absence visible, never filled"
 * discipline D-15 established for training load, applied here to a new
 * context.
 */

import { activityDayKey } from './calendar-logic.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

export type MonthlyChannel = 'cadence' | 'hr';

export const MONTHLY_CHANNELS: readonly MonthlyChannel[] = ['cadence', 'hr'];

/**
 * One month's aggregated channel value. `x` is the epoch-ms of the month
 * start (UTC midnight on the 1st) — a `'linear'` Chart.js scale value,
 * never a Chart.js date-axis scale (18-PATTERNS.md restates this as a hard
 * requirement; zero date-axis-scale precedent exists in this codebase). `value` is `null`
 * for a month with no contributing activity for this channel; `runs`
 * counts every activity that month regardless of channel availability, and
 * `contributing` counts only those whose channel value was non-null, so a
 * caller can explain a gap ("N runs this month, none with HR").
 */
export interface MonthlyPoint {
  x: number;
  monthKey: string;
  value: number | null;
  runs: number;
  contributing: number;
}

function channelValue(row: DashboardIndexRow, channel: MonthlyChannel): number | null {
  return channel === 'cadence' ? row.avgCadenceRpm : row.avgHr;
}

/** Epoch-ms of the UTC month start for a `YYYY-MM` key. */
function monthStartMs(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return Date.UTC(year, month - 1, 1);
}

/** The `YYYY-MM` key immediately following `monthKey`, rolling the year forward. */
function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const zeroBased = month - 1 + 1;
  const nextYear = year + Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Groups `rows` by `YYYY-MM` (derived from `activityDayKey(row.startDateLocal).slice(0, 7)`
 * — importing the shared normalizer rather than writing a second date
 * parser), computes a MOVING-TIME-WEIGHTED mean of `channel` per month (not
 * a plain row mean — a 10-minute shakeout must not carry the same weight as
 * a two-hour long run), and emits a CONTINUOUS month spine from the first to
 * the last month with any activity: months with zero activity at all get an
 * explicit `{ value: null, runs: 0, contributing: 0 }` entry rather than a
 * silently shortened x-axis (the same principle as the training-load daily
 * spine, Pitfall 3). Rows whose channel value is `null` are excluded from
 * the mean but still counted in `runs`. Rows with an unparseable
 * `startDateLocal` are skipped without throwing and never create a bogus
 * month. Total function: never throws, returns `[]` for empty input.
 */
export function buildMonthlyChannelSeries(
  rows: readonly DashboardIndexRow[],
  channel: MonthlyChannel
): MonthlyPoint[] {
  if (rows.length === 0) return [];

  // monthKey -> { weightedSum, weightTotal, runs, contributing }
  const byMonth = new Map<
    string,
    { weightedSum: number; weightTotal: number; runs: number; contributing: number }
  >();

  for (const row of rows) {
    const dayKey = activityDayKey(row.startDateLocal);
    if (dayKey === null) continue;

    const monthKey = dayKey.slice(0, 7);
    let bucket = byMonth.get(monthKey);
    if (!bucket) {
      bucket = { weightedSum: 0, weightTotal: 0, runs: 0, contributing: 0 };
      byMonth.set(monthKey, bucket);
    }

    bucket.runs += 1;

    const value = channelValue(row, channel);
    if (value === null || !Number.isFinite(value)) continue;

    const weight = row.movingTimeSec > 0 ? row.movingTimeSec : 0;
    if (weight <= 0) continue;

    bucket.weightedSum += value * weight;
    bucket.weightTotal += weight;
    bucket.contributing += 1;
  }

  if (byMonth.size === 0) return [];

  const monthKeys = Array.from(byMonth.keys()).sort();
  const firstMonth = monthKeys[0];
  const lastMonth = monthKeys[monthKeys.length - 1];

  const points: MonthlyPoint[] = [];
  let cursor = firstMonth;

  while (cursor <= lastMonth) {
    const bucket = byMonth.get(cursor);
    const value =
      bucket && bucket.weightTotal > 0 ? bucket.weightedSum / bucket.weightTotal : null;

    points.push({
      x: monthStartMs(cursor),
      monthKey: cursor,
      value,
      runs: bucket ? bucket.runs : 0,
      contributing: bucket ? bucket.contributing : 0,
    });

    cursor = nextMonthKey(cursor);
  }

  return points;
}

/**
 * Chart axis label per channel. The cadence label states the single-leg
 * unit explicitly, matching the detail view's existing
 * `'Cadence (rpm, single-leg)'` stat-card label (`detail.ts`), because the
 * index's `avgCadenceRpm` value is deliberately NOT doubled to
 * steps-per-minute — Phase 14 keeps that unit conversion in exactly one
 * place (stream derivation), and this label restates the same discipline
 * rather than silently implying a different unit.
 */
export function channelLabel(channel: MonthlyChannel): string {
  return channel === 'cadence'
    ? 'Average cadence (rpm, single-leg)'
    : 'Average heart rate (bpm)';
}
