/**
 * Records page — pure, DOM-free data transforms (REC-02/03/05/07). Every
 * input is injected (no ambient clock construction, no live DOM globals,
 * no network calls) so every number the page renders can be produced and
 * tested without a DOM, mirroring `calendar-logic.ts`'s discipline.
 *
 * Two explicit empty-state sentinels this module exists to make testable
 * rather than an inline `?.length` check in DOM code: `isEmptyRanking`
 * (marathon's genuinely empty ranking, D-05) and the zero-vs-absent
 * distinction in `selectSuperlatives`'s current-streak tile (a `0`-day
 * current streak is a real value, never conflated with "no data").
 */

import type {
  BestEffortsDocument,
  PRRankingEntry,
  TargetDistanceKey,
} from '../../analytics/best-effort.types.js';
import type { AgeGradeEntry, AgeGradingDocument } from '../../analytics/age-grading.types.js';

/** Own-property read only — no prototype key is ever reachable through a parsed payload. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes a `startDate`/`startDateLocal`-shaped string to epoch-ms,
 * applying the same Z-suffix rule as `list.ts`'s `formatActivityDate` and
 * `calendar-logic.ts`'s `activityDayKey`: append `Z` when the string does
 * not already end in one, so both archive shapes (Strava-era Z-suffixed,
 * intervals.icu-era no-Z) parse to the correct instant. Returns `null` for
 * an unparseable value rather than throwing.
 */
function parseStartDateToEpochMs(startDate: string): number | null {
  if (typeof startDate !== 'string') return null;
  const normalized = startDate.endsWith('Z') ? startDate : `${startDate}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

/** One row in a distance's PR table. */
export interface PrTableRow {
  rank: number;
  activityId: string;
  startDate: string;
  durationSec: number;
  paceSecPerKm: number;
  agePercent: number | null;
  ageDerived: boolean;
  lowConfidence: boolean;
  excluded: boolean;
  exclusionReason: string | null;
}

/**
 * Total, never-throwing parse of a `BestEffortExclusionsFile`-shaped body
 * into an `activityId -> reason` map. A `null`/malformed body, a missing
 * `exclusions` array, or an individually malformed entry all degrade
 * gracefully — a single bad entry is dropped, never the whole document
 * (the `parseGearDocument`/`parseYearOverYear` discipline). D-07 requires
 * the real `reason` string be surfaced here even though the PR ranking
 * entry itself only carries a boolean-shaped exclusion flag.
 */
export function buildExclusionReasonIndex(raw: unknown): Map<string, string> {
  const index = new Map<string, string>();
  if (!isRecord(raw)) return index;
  if (!hasOwn(raw, 'exclusions')) return index;

  const exclusions = raw.exclusions;
  if (!Array.isArray(exclusions)) return index;

  for (const entry of exclusions) {
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'activityId') || !hasOwn(entry, 'reason')) continue;

    const { activityId, reason } = entry;
    if (typeof activityId !== 'string' || activityId.length === 0 || activityId === '__proto__') continue;
    if (typeof reason !== 'string') continue;

    index.set(activityId, reason);
  }

  return index;
}

/**
 * Builds one PR-table row per ranking entry, joined to its age-grade by
 * `(distance, activityId)`. `agePercent` is `null` — never `0` — whenever
 * age-grading is disabled or the entry has no grade, since the view would
 * render a fabricated `0` as a real percentage otherwise (T-18-HONEST-02).
 * `ageDerived` is `true` only for `1k` (D-09's interpolated-factor
 * distance). Returns `[]` for an `undefined` or empty ranking — the
 * genuinely-empty marathon case is a real, testable code path (D-05), not
 * an error.
 */
export function buildPrTableRows(
  entries: readonly PRRankingEntry[] | undefined,
  ageGrading: AgeGradingDocument | null,
  distance: TargetDistanceKey,
  exclusionReasons: ReadonlyMap<string, string>
): PrTableRow[] {
  if (!entries || entries.length === 0) return [];

  const ageGradeByActivityId = new Map<string, AgeGradeEntry>();
  if (ageGrading && ageGrading.enabled) {
    const distanceEntries = ageGrading.rankings[distance];
    if (distanceEntries) {
      for (const entry of distanceEntries) {
        ageGradeByActivityId.set(entry.activityId, entry);
      }
    }
  }

  return entries.map((entry): PrTableRow => {
    const ageGrade = ageGradeByActivityId.get(entry.activityId);
    const exclusionReason = exclusionReasons.get(entry.activityId) ?? null;

    return {
      rank: entry.rank,
      activityId: entry.activityId,
      startDate: entry.startDate,
      durationSec: entry.durationSec,
      paceSecPerKm: entry.paceSecPerKm,
      agePercent: ageGrade ? ageGrade.agePercent : null,
      ageDerived: distance === '1k',
      lowConfidence: entry.lowConfidence,
      excluded: exclusionReason !== null,
      exclusionReason,
    };
  });
}

/**
 * The explicit sentinel `records.ts` branches on to decide whether a
 * distance's table body renders rows or the named empty state (D-05) —
 * testable rather than an inline `?.length` check in DOM code.
 */
export function isEmptyRanking(entries: readonly PRRankingEntry[] | undefined): boolean {
  return !entries || entries.length === 0;
}

/** One point on a distance's PR-evolution step series. */
export interface EvolutionPoint {
  /** Epoch-ms of the effort's activity date — a `'linear'` chart scale value, not a date-adapter-backed one (18-UI-SPEC § 3/§ 14). */
  x: number;
  /** Duration in seconds. */
  y: number;
  activityId: string;
}

/**
 * Every effort at `distance` with `wasPRAtTheTime === true`, sorted
 * ascending by date regardless of the source `activities` map's key order.
 * A distance with no PR-setting efforts (marathon today) returns `[]`.
 */
export function buildEvolutionSeries(
  activities: BestEffortsDocument['activities'],
  distance: TargetDistanceKey
): EvolutionPoint[] {
  const points: EvolutionPoint[] = [];

  for (const activityId of Object.keys(activities)) {
    if (!hasOwn(activities, activityId)) continue;
    const activity = activities[activityId];
    if (!activity) continue;

    const x = parseStartDateToEpochMs(activity.startDate);
    if (x === null) continue;

    for (const effort of activity.efforts) {
      if (effort.distance !== distance) continue;
      if (effort.wasPRAtTheTime !== true) continue;

      points.push({ x, y: effort.durationSec, activityId: activity.activityId });
    }
  }

  points.sort((a, b) => a.x - b.x);
  return points;
}

/** One row in a distance's evolution progression table (18-UI-SPEC § 3). */
export interface ProgressionRow {
  activityId: string;
  startDate: string;
  durationSec: number;
  /** `durationSec - previousDurationSec`; negative means faster (an improvement). `null` for the first row. */
  improvementSec: number | null;
}

/**
 * Derives the progression table from an already-ascending evolution
 * series. The first row's `improvementSec` is `null`, never `0` — there is
 * no prior row to compare against.
 */
export function buildProgressionRows(series: readonly EvolutionPoint[]): ProgressionRow[] {
  return series.map((point, index): ProgressionRow => {
    const previous = index > 0 ? series[index - 1] : null;
    return {
      activityId: point.activityId,
      startDate: new Date(point.x).toISOString(),
      durationSec: point.y,
      improvementSec: previous ? point.y - previous.y : null,
    };
  });
}

/** The four superlative tiles (18-UI-SPEC § 4a). */
export interface Superlatives {
  biggestWeek: { km: number; weekStartISO: string } | null;
  biggestMonth: { km: number; label: string } | null;
  longestStreak: { days: number; startISO: string; endISO: string } | null;
  currentStreak: { days: number; active: boolean; endedISO: string | null } | null;
}

function selectBiggestWeek(raw: unknown): { km: number; weekStartISO: string } | null {
  if (!Array.isArray(raw)) return null;

  let best: { km: number; weekStartISO: string } | null = null;
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'weekStartISO') || !hasOwn(entry, 'totalKm')) continue;
    const { weekStartISO, totalKm } = entry;
    if (typeof weekStartISO !== 'string' || typeof totalKm !== 'number') continue;
    if (!best || totalKm > best.km) best = { km: totalKm, weekStartISO };
  }
  return best;
}

function selectBiggestMonth(raw: unknown): { km: number; label: string } | null {
  if (!Array.isArray(raw)) return null;

  let best: { km: number; label: string } | null = null;
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'periodLabel') || !hasOwn(entry, 'totalKm')) continue;
    const { periodLabel, totalKm } = entry;
    if (typeof periodLabel !== 'string' || typeof totalKm !== 'number') continue;
    if (!best || totalKm > best.km) best = { km: totalKm, label: periodLabel };
  }
  return best;
}

function selectLongestStreak(raw: unknown): { days: number; startISO: string; endISO: string } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'longestStreak') || !hasOwn(raw, 'longestStreakStart') || !hasOwn(raw, 'longestStreakEnd')) {
    return null;
  }

  const { longestStreak, longestStreakStart, longestStreakEnd } = raw;
  if (typeof longestStreak !== 'number') return null;
  if (typeof longestStreakStart !== 'string' || typeof longestStreakEnd !== 'string') return null;

  return { days: longestStreak, startISO: longestStreakStart, endISO: longestStreakEnd };
}

/**
 * A `currentStreak` of `0` is a legitimate value (the archive's live
 * value today) and must still produce a tile — `typeof currentStreak !==
 * 'number'` is the only rejection check, never a falsy/truthy shortcut
 * that would silently drop a real zero (T-18-HONEST-02).
 */
function selectCurrentStreak(raw: unknown): { days: number; active: boolean; endedISO: string | null } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'currentStreak') || !hasOwn(raw, 'withinCurrentStreak')) return null;

  const { currentStreak, withinCurrentStreak, currentStreakStart } = raw;
  if (typeof currentStreak !== 'number' || typeof withinCurrentStreak !== 'boolean') return null;

  const active = withinCurrentStreak;
  const endedISO =
    !active && typeof currentStreakStart === 'string' && currentStreakStart.length > 0
      ? currentStreakStart
      : null;

  return { days: currentStreak, active, endedISO };
}

/**
 * A `max()` over the already-generated weekly/monthly stats files (D-21)
 * plus a read of `streaks.json`. Total and tolerant: each input may be
 * `null` or malformed, in which case that tile alone is `null` and the
 * others still resolve independently.
 */
export function selectSuperlatives(weekly: unknown, monthly: unknown, streaks: unknown): Superlatives {
  return {
    biggestWeek: selectBiggestWeek(weekly),
    biggestMonth: selectBiggestMonth(monthly),
    longestStreak: selectLongestStreak(streaks),
    currentStreak: selectCurrentStreak(streaks),
  };
}

/**
 * Feeds the evolution card's big `.text-display` current-PR number and its
 * "{n} steps, {first}-{last}" label (18-UI-SPEC § 3) — the concrete fix for
 * "charts aren't directly comparable": the reader gets the number from
 * text, never only from a pixel position.
 */
export function evolutionCardSummary(series: readonly EvolutionPoint[]): {
  currentSec: number | null;
  steps: number;
  firstYear: number | null;
  lastYear: number | null;
} {
  if (series.length === 0) {
    return { currentSec: null, steps: 0, firstYear: null, lastYear: null };
  }

  const first = series[0];
  const last = series[series.length - 1];

  return {
    currentSec: last.y,
    steps: series.length,
    firstYear: new Date(first.x).getUTCFullYear(),
    lastYear: new Date(last.x).getUTCFullYear(),
  };
}
