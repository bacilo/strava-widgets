/**
 * Pure, DOM-free logic behind the Trends page's Training Load tab
 * (TREND-04, D-13/D-14/D-15/D-16). Parses the published
 * `data/stats/training-load.json` document (plan 18-03's contract — both
 * the Edwards and Banister series live in one document, so the model
 * toggle never refetches per 18-UI-SPEC § 11), selects the active TRIMP
 * model's series, and detects thin-HR-coverage spans for the honesty
 * shading.
 *
 * `now` is always injected by the caller, never constructed fresh inside
 * this module — the same `calendar-logic.ts` discipline.
 *
 * Retired 2026-08-19 (Phase 23, D-03): the trailing-window dataset filter
 * this module used to export, plus its module-private day-count lookup
 * table, are gone. The Training Load window control became a set of zoom
 * presets over an always-complete series (`trends.ts`'s `rebuildChart` now
 * hands the chart the full `doc.days` unconditionally), so nothing here
 * filters `doc.days` any more. The filter was deleted rather than kept as
 * an unused pure helper: an exported dataset-scoping export is an open
 * invitation for a future caller to reintroduce exactly the mechanism D-03
 * removed, and a test for an uncalled function proves nothing about the
 * shipped view.
 */

import type { DailyLoadEntry, TrainingLoadDocument } from '../../analytics/training-load.types.js';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Own-property read only — guards against prototype-pollution reachability. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseEdwards(raw: unknown): { trimp: number; ctl: number; atl: number; tsb: number } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'trimp') || !hasOwn(raw, 'ctl') || !hasOwn(raw, 'atl') || !hasOwn(raw, 'tsb')) return null;
  const { trimp, ctl, atl, tsb } = raw;
  if (!isFiniteNumber(trimp) || !isFiniteNumber(ctl) || !isFiniteNumber(atl) || !isFiniteNumber(tsb)) return null;
  return { trimp, ctl, atl, tsb };
}

function parseBanister(raw: unknown): { trimp: number; ctl: number; atl: number; tsb: number } | null {
  if (raw === null) return null;
  return parseEdwards(raw);
}

/** Drops an individual malformed day rather than rejecting the whole payload. */
function parseDailyLoadEntry(raw: unknown): DailyLoadEntry | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'date') || typeof raw.date !== 'string') return null;
  if (!hasOwn(raw, 'runs') || !isFiniteNumber(raw.runs)) return null;
  if (!hasOwn(raw, 'runsWithHr') || !isFiniteNumber(raw.runsWithHr)) return null;

  if (!hasOwn(raw, 'edwards')) return null;
  const edwards = parseEdwards(raw.edwards);
  if (edwards === null) return null;

  const banister = hasOwn(raw, 'banister') ? parseBanister(raw.banister) : null;

  return { date: raw.date, runs: raw.runs, runsWithHr: raw.runsWithHr, edwards, banister };
}

/**
 * Total, never-throwing parse of the training-load payload. Returns `null`
 * unless `days` is an array whose entries carry a `date` string and an
 * `edwards` object with four finite numbers. Malformed individual days are
 * dropped rather than rejecting the whole document (the tolerant
 * entry-level parse discipline `parseGearDocument` established). Own-property
 * reads only — a `__proto__`-keyed payload cannot poison this parse.
 */
export function parseTrainingLoad(raw: unknown): TrainingLoadDocument | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'days') || !Array.isArray(raw.days)) return null;

  const days: DailyLoadEntry[] = [];
  for (const rawDay of raw.days) {
    const day = parseDailyLoadEntry(rawDay);
    if (day !== null) days.push(day);
  }

  const schemaVersion = hasOwn(raw, 'schemaVersion') && isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 1;
  const generatedAt = hasOwn(raw, 'generatedAt') && typeof raw.generatedAt === 'string' ? raw.generatedAt : '';
  const note = hasOwn(raw, 'note') && typeof raw.note === 'string' ? raw.note : '';

  const timeConstants =
    hasOwn(raw, 'timeConstants') && isRecord(raw.timeConstants) &&
    isFiniteNumber(raw.timeConstants.ctlDays) && isFiniteNumber(raw.timeConstants.atlDays)
      ? { ctlDays: raw.timeConstants.ctlDays as number, atlDays: raw.timeConstants.atlDays as number }
      : { ctlDays: 42, atlDays: 7 };

  const modelsRaw = hasOwn(raw, 'models') && isRecord(raw.models) ? raw.models : {};
  const models = {
    edwards: typeof modelsRaw.edwards === 'boolean' ? modelsRaw.edwards : true,
    banister: typeof modelsRaw.banister === 'boolean' ? modelsRaw.banister : false,
  };

  const banisterDisabledReason =
    hasOwn(raw, 'banisterDisabledReason') && (typeof raw.banisterDisabledReason === 'string' || raw.banisterDisabledReason === null)
      ? raw.banisterDisabledReason
      : null;

  const firstDate = hasOwn(raw, 'firstDate') && typeof raw.firstDate === 'string' ? raw.firstDate : (days[0]?.date ?? '');
  const lastDate =
    hasOwn(raw, 'lastDate') && typeof raw.lastDate === 'string' ? raw.lastDate : (days[days.length - 1]?.date ?? '');

  const totalsRaw = hasOwn(raw, 'totals') && isRecord(raw.totals) ? raw.totals : {};
  const totals = {
    daysInSpine: isFiniteNumber(totalsRaw.daysInSpine) ? totalsRaw.daysInSpine : days.length,
    activitiesConsidered: isFiniteNumber(totalsRaw.activitiesConsidered) ? totalsRaw.activitiesConsidered : 0,
    activitiesWithHr: isFiniteNumber(totalsRaw.activitiesWithHr) ? totalsRaw.activitiesWithHr : 0,
    activitiesWithoutHr: isFiniteNumber(totalsRaw.activitiesWithoutHr) ? totalsRaw.activitiesWithoutHr : 0,
    activitiesUnreadable: isFiniteNumber(totalsRaw.activitiesUnreadable) ? totalsRaw.activitiesUnreadable : 0,
  };

  return {
    schemaVersion,
    generatedAt,
    note,
    timeConstants,
    models,
    banisterDisabledReason,
    firstDate,
    lastDate,
    totals,
    days,
  };
}

// ---------------------------------------------------------------------------
// Model selection (D-13/D-14)
// ---------------------------------------------------------------------------

export type TrimpModel = 'edwards' | 'banister';

/**
 * Allow-list with an `'edwards'` default, and a hard fallback to
 * `'edwards'` when the document reports `models.banister === false`. This
 * is deliberately a PARSE-TIME clamp rather than a render-time check, so a
 * stored or URL-supplied `banister` value can never produce an empty
 * chart. Per D-13/§ 11 the Banister option stays visible but DISABLED in
 * the UI — the model exists, it just is not configured; this function only
 * governs which series the chart actually renders.
 */
export function parseTrimpModel(raw: string | null, doc: TrainingLoadDocument | null): TrimpModel {
  const requested: TrimpModel = raw === 'banister' ? 'banister' : 'edwards';
  if (requested === 'banister' && doc !== null && doc.models.banister === false) {
    return 'edwards';
  }
  return requested;
}

// ---------------------------------------------------------------------------
// Window scoping (D-16 — the underlying series always covers the full archive)
// ---------------------------------------------------------------------------

export type LoadWindow = '3mo' | '12mo' | 'all';

export const TRAINING_LOAD_WINDOWS: readonly LoadWindow[] = ['3mo', '12mo', 'all'];

export const DEFAULT_LOAD_WINDOW: LoadWindow = '12mo';

/** Allow-list, default `'12mo'`. */
export function parseLoadWindow(raw: string | null): LoadWindow {
  if (raw !== null && (TRAINING_LOAD_WINDOWS as readonly string[]).includes(raw)) {
    return raw as LoadWindow;
  }
  return DEFAULT_LOAD_WINDOW;
}

// ---------------------------------------------------------------------------
// Model series (D-14 — an unconfigured model must yield an empty chart, never zeros)
// ---------------------------------------------------------------------------

export interface LoadPoint {
  x: number;
  ctl: number;
  atl: number;
  tsb: number;
  trimp: number;
}

/**
 * Maps `days` to the chosen model's four values; `x` is the epoch-ms of the
 * day (a `'linear'` Chart.js scale value, never a Chart.js date-axis
 * scale). A day whose `banister` is `null` while `model === 'banister'` is
 * EXCLUDED from the emitted array entirely rather than contributing a
 * zero-valued point — an unconfigured model must produce an empty chart the
 * view can detect, not a flat line at zero that reads as real data.
 */
export function selectModelSeries(days: readonly DailyLoadEntry[], model: TrimpModel): LoadPoint[] {
  const points: LoadPoint[] = [];

  for (const day of days) {
    const series = model === 'edwards' ? day.edwards : day.banister;
    if (series === null) continue;

    const ms = Date.parse(`${day.date}T00:00:00Z`);
    if (!Number.isFinite(ms)) continue;

    points.push({ x: ms, ctl: series.ctl, atl: series.atl, tsb: series.tsb, trimp: series.trimp });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Thin-HR-coverage spans (D-15 — the phase's single most load-bearing
// honesty requirement, the user's own verbatim constraint: "I don't want to
// delete activities but I want to make sure those absences are visible and
// not 'made up'")
// ---------------------------------------------------------------------------

export interface CoverageSpan {
  startX: number;
  endX: number;
  startDate: string;
  endDate: string;
  days: number;
  runsWithoutHr: number;
}

/**
 * A thin-coverage span is a maximal run of consecutive days in which every
 * day satisfies `runsWithHr === 0`, AND the span contains at least one day
 * with `runs > 0`. A pure rest gap (no runs at all across the whole span)
 * is NOT a coverage span — it is genuine rest, and shading it would claim
 * missing data that is not missing. This is D-15's core function: both
 * halves of the rule (every day has `runsWithHr === 0`, AND at least one
 * day has `runs > 0`) must hold for a span to be emitted.
 */
export function findThinCoverageSpans(days: readonly DailyLoadEntry[]): CoverageSpan[] {
  const spans: CoverageSpan[] = [];

  let spanStart = -1;
  let spanHasRuns = false;
  let spanRunsWithoutHr = 0;

  const flush = (endIndex: number): void => {
    if (spanStart === -1) return;
    if (spanHasRuns) {
      const startDay = days[spanStart];
      const endDay = days[endIndex];
      const startX = Date.parse(`${startDay.date}T00:00:00Z`);
      const endX = Date.parse(`${endDay.date}T00:00:00Z`);
      spans.push({
        startX,
        endX,
        startDate: startDay.date,
        endDate: endDay.date,
        days: endIndex - spanStart + 1,
        runsWithoutHr: spanRunsWithoutHr,
      });
    }
    spanStart = -1;
    spanHasRuns = false;
    spanRunsWithoutHr = 0;
  };

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const isNoHrDay = day.runsWithHr === 0;

    if (isNoHrDay) {
      if (spanStart === -1) spanStart = i;
      if (day.runs > 0) {
        spanHasRuns = true;
        spanRunsWithoutHr += day.runs;
      }
    } else {
      flush(i - 1);
    }
  }
  flush(days.length - 1);

  return spans;
}

/**
 * Returns the exact § 11 copy when `spans.length > 0`, and `''` when there
 * are none, so the caption and the shading appear and disappear together.
 */
export function coverageCaption(spans: readonly CoverageSpan[]): string {
  return spans.length > 0 ? 'Shaded regions indicate no HR data (not zero training).' : '';
}
