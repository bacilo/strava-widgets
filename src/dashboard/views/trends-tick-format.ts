/**
 * Pure, DOM-free, step-aware time-axis tick formatting shared by every
 * Trends time axis (Finding 7, `23-VALIDATION.md`). Chart.js hands each
 * `ticks.callback` a value and the full tick array for that scale; this
 * module derives the step between adjacent ticks and picks a granularity
 * from THAT step, rather than trusting a fixed format or a UI toggle that
 * has no idea how far the user has zoomed. That is what makes it possible
 * for eight ticks at an ≈11-day Training Load window to read eight
 * different dates instead of eight copies of `Feb 2026`.
 *
 * THE INVARIANT this module exists to guarantee: two adjacent ticks —
 * `anchor` and `anchor + step` — can NEVER format to the same string, at
 * any step size. `DAY_STEP_MAX_MS` and `MONTH_STEP_MAX_MS` are not taste;
 * they are derived directly from that invariant.
 *
 * - `DAY_STEP_MAX_MS` (32 days) exceeds the longest calendar month (31
 *   days), so two ticks one step apart can never land inside the same
 *   month once the step reaches this threshold — a 28-day threshold would
 *   fail, because 2024-01-01 and 2024-01-29 (28 days apart) are both
 *   `Jan 2024`, the same class of defect as Finding 7 one rung coarser.
 * - `MONTH_STEP_MAX_MS` (366 days) exceeds the longest calendar year (366,
 *   a leap year), so two ticks one step apart can never land inside the
 *   same year once the step reaches this threshold.
 *
 * NOT a tooltip formatter. Finding 6 (the Training Load tooltip title
 * rendering a raw epoch, `1,769,990,400,000`) is explicitly OUT OF SCOPE
 * for Phase 23 and this module must not acquire a tooltip `title`
 * callback, however tempting the adjacency — see `23-VALIDATION.md`.
 *
 * No DOM, no charting-library import — loadable under vitest's
 * `environment: 'node'`, matching `trends-zoom-logic.ts`'s house style.
 */

// ---------------------------------------------------------------------------
// Types and thresholds
// ---------------------------------------------------------------------------

export type TimeTickGranularity = 'day' | 'month' | 'year';

/** 32 days in ms — exceeds the longest calendar month (31 days). */
export const DAY_STEP_MAX_MS = 2764800000;

/** 366 days in ms — exceeds the longest calendar year (a leap year, 366 days). */
export const MONTH_STEP_MAX_MS = 31622400000;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------------------
// Granularity selection
// ---------------------------------------------------------------------------

/**
 * Picks the tick granularity for a given step between adjacent ticks.
 * Non-finite or non-positive input (a malformed or single-entry tick
 * array) returns `'month'` — a safe, mid-range default that never throws.
 */
export function tickGranularityForStep(stepMs: number): TimeTickGranularity {
  if (!Number.isFinite(stepMs) || stepMs <= 0) return 'month';
  if (stepMs < DAY_STEP_MAX_MS) return 'day';
  if (stepMs < MONTH_STEP_MAX_MS) return 'month';
  return 'year';
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Formats an epoch-ms value at the given granularity, in UTC, matching the
 * exact string shapes already shipped so no rendered style changes:
 * `'day'` → `D MMM YYYY` (today's `formatVolumeTick` weekly output, e.g.
 * `13 Aug 2025`), `'month'` → `MMM YYYY` (today's `formatMonthYearTick`),
 * `'year'` → `YYYY` (today's `formatVolumeTick` yearly output). Non-finite
 * input returns the empty string, mirroring `formatRangeLabel`'s
 * convention in `trends-zoom-logic.ts` so a degenerate scale renders a
 * blank tick rather than `Invalid Date`.
 */
export function formatTimeAxisTick(epochMs: number, granularity: TimeTickGranularity): string {
  if (!Number.isFinite(epochMs)) return '';
  const d = new Date(epochMs);
  const year = d.getUTCFullYear();
  if (granularity === 'year') return String(year);
  const month = MONTH_ABBR[d.getUTCMonth()];
  if (granularity === 'month') return `${month} ${year}`;
  return `${d.getUTCDate()} ${month} ${year}`;
}

// ---------------------------------------------------------------------------
// Step derivation from Chart.js's own tick array
// ---------------------------------------------------------------------------

/**
 * The smallest strictly-positive finite difference between adjacent
 * entries in a Chart.js tick array, or `0` when there is none (an empty
 * array, a single entry, or every entry sharing the same value). A
 * repeated value never collapses the step to `0` as long as at least one
 * pair differs — only the smallest positive gap is taken, not the first.
 * A non-finite entry is skipped rather than poisoning the result.
 */
export function stepMsFromTicks(ticks: readonly { value: number }[]): number {
  let minStep = Infinity;
  let found = false;

  for (let i = 1; i < ticks.length; i++) {
    const a = ticks[i - 1]?.value;
    const b = ticks[i]?.value;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const diff = Math.abs(b - a);
    if (diff > 0 && diff < minStep) {
      minStep = diff;
      found = true;
    }
  }

  return found ? minStep : 0;
}

// ---------------------------------------------------------------------------
// Composition point — what every Trends x-axis `ticks.callback` calls
// ---------------------------------------------------------------------------

/**
 * The composition of `tickGranularityForStep` and `formatTimeAxisTick`:
 * formats `epochMs` at the granularity implied by `stepMs`. This is the
 * single function every Trends time-axis tick callback routes through
 * (Finding 7's fix, `trends-charts.ts`).
 */
export function formatAdaptiveTimeTick(epochMs: number, stepMs: number): string {
  return formatTimeAxisTick(epochMs, tickGranularityForStep(stepMs));
}
