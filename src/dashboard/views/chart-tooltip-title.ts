/**
 * Pure, DOM-free tooltip title formatters for every linear-x Chart.js chart
 * in the dashboard. Resolves Phase 23 "Finding 6": without a
 * `plugins.tooltip.callbacks.title`, Chart.js renders the raw linear x value
 * as the title (epoch ms such as `1,769,990,400,000`, or raw km/seconds on
 * activity detail).
 *
 * This is deliberately a SEPARATE module from `trends-tick-format.ts`, whose
 * doc comment forbids a tooltip title callback there; that prohibition is
 * honored, not overridden.
 *
 * All date formatting uses UTC getters, consistent with `formatTimeAxisTick`
 * (x values are UTC period starts). Every formatter returns '' for
 * non-finite input.
 *
 * No DOM, no charting-library import — loadable under vitest `node`.
 */

import type { XAxisMode } from './detail-charts-logic.js';
import type { VolumeGranularity } from './trends-volume-logic.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `D MMM YYYY` (no zero padding), UTC. */
export function formatDateTooltipTitle(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return '';
  const d = new Date(epochMs);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `Ddd D MMM YYYY`, UTC. */
export function formatDayTooltipTitle(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return '';
  const d = new Date(epochMs);
  return `${WEEKDAY_ABBR[d.getUTCDay()]} ${formatDateTooltipTitle(epochMs)}`;
}

/** `MMMM YYYY`, UTC. */
export function formatMonthTooltipTitle(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return '';
  const d = new Date(epochMs);
  return `${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Volume title by granularity. Weekly x is the UTC-Monday week start, hence
 * "Week of D MMM YYYY".
 */
export function formatVolumeTooltipTitle(epochMs: number, granularity: VolumeGranularity): string {
  if (!Number.isFinite(epochMs)) return '';
  if (granularity === 'yearly') return String(new Date(epochMs).getUTCFullYear());
  if (granularity === 'monthly') return formatMonthTooltipTitle(epochMs);
  return `Week of ${formatDateTooltipTitle(epochMs)}`;
}

/** Activity-detail title: `x.xx km` (distance) or `m:ss` / `h:mm:ss` (time). */
export function formatDetailTooltipTitle(x: number, mode: XAxisMode): string {
  if (!Number.isFinite(x)) return '';
  if (mode === 'distance') return `${x.toFixed(2)} km`;
  const total = Math.round(x);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h >= 1) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Adapts Chart.js tooltip items to a formatter. Reads `parsed.x` (NOT
 * dataIndex: Decimation makes dataIndex index the decimated dataset).
 */
export function titleFromItems(
  items: readonly { parsed?: { x?: unknown } }[],
  format: (x: number) => string,
): string {
  const x = items[0]?.parsed?.x;
  if (typeof x !== 'number' || !Number.isFinite(x)) return '';
  return format(x);
}
