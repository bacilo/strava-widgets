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
import { DISTANCE_DISPLAY_NAMES } from './detail-best-efforts-logic.js';

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

/**
 * Per-guard breakdown of demoted EFFORTS at one distance (CR-02). `total`
 * is the sum of `ceiling` + `worldRecord` + `maxSpeed` PLUS any demotion
 * whose `guard` value this module does not recognize — a defensive-only
 * case, since `EffortDemotionGuard` is a closed union today. Never confuse
 * this with PR-05's cohort, which is counted in ACTIVITIES elsewhere.
 */
export interface DemotionCounts {
  total: number;
  ceiling: number;
  worldRecord: number;
  maxSpeed: number;
}

/**
 * Counts demoted EFFORTS at `distance` across every activity in
 * `activities` — NOT activities, and broken down per guard (CR-02) so the
 * Records note and empty-state copy can attribute each demotion to the
 * mechanism that actually produced it rather than blaming every rejection
 * on "the plausibility ceiling". PR-05's cohort is counted in ACTIVITIES
 * elsewhere; the two must never be conflated. Walks `Object.keys` with the
 * same `hasOwn` guard `buildEvolutionSeries` uses. Reads `effort.demotion`
 * only through `!= null` (T-28-02-A), so a stale shard shipped without the
 * field degrades to "not demoted" rather than a TypeError.
 *
 * An owner-excluded effort is skipped ENTIRELY here, even if it also
 * carries a `demotion` (D-10): `excludedFromRecords` is the owner's stated
 * intent and a demotion is the machine's judgment, and this count must not
 * let the machine's judgment leak into a sentence about what the owner
 * chose. This is what keeps CR-01's fix (which lets an excluded effort
 * carry a ceiling demotion) from inflating the Records-screen count with
 * efforts the owner already removed on their own authority.
 */
export function countDemotedAtDistance(
  activities: BestEffortsDocument['activities'],
  distance: TargetDistanceKey
): DemotionCounts {
  const counts: DemotionCounts = { total: 0, ceiling: 0, worldRecord: 0, maxSpeed: 0 };

  for (const activityId of Object.keys(activities)) {
    if (!hasOwn(activities, activityId)) continue;
    const activity = activities[activityId];
    if (!activity) continue;

    for (const effort of activity.efforts) {
      if (effort.distance !== distance) continue;
      if (effort.excludedFromRecords === true) continue;
      if (effort.demotion == null) continue;

      counts.total++;
      switch (effort.demotion.guard) {
        case 'ceiling':
          counts.ceiling++;
          break;
        case 'world-record':
          counts.worldRecord++;
          break;
        case 'max-speed':
          counts.maxSpeed++;
          break;
        default:
          // Unrecognized guard value — still counts toward total, matching
          // the module's existing degrade-rather-than-throw discipline.
          break;
      }
    }
  }

  return counts;
}

/**
 * Builds the shared, guard-accurate sentence both `resolvePrTableDemotionNote`
 * and `resolvePrTableEmptyState`'s all-time-with-demotions branch use, so the
 * two copy surfaces cannot drift apart (CR-02). Zero-count parts are omitted;
 * the fixed order is ceiling, world-record, max-speed. Register: named
 * condition plus measured value (Phase 27 D-09) — a guard's name plus its
 * count, never an adjective.
 */
function describeDemotionCounts(label: string, counts: DemotionCounts): string {
  const effortWord = counts.total === 1 ? 'effort' : 'efforts';
  const verb = counts.total === 1 ? 'was' : 'were';

  const parts: string[] = [];
  if (counts.ceiling > 0) parts.push(`${counts.ceiling} by the personal ceiling`);
  if (counts.worldRecord > 0) parts.push(`${counts.worldRecord} by the world-record pace guard`);
  if (counts.maxSpeed > 0) parts.push(`${counts.maxSpeed} by the activity max-speed guard`);
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  return `${counts.total} ${label} ${effortWord} ${verb} demoted by a plausibility guard${breakdown}. Efforts the owner excluded are not counted here. See the activity detail view for each reason.`;
}

/**
 * The three-branch copy for the Records screen's per-distance empty state
 * (D-03, D-09, CR-02). The `this-year` branch and the all-time-with-nothing-
 * demoted branch reproduce `records.ts`'s pre-existing `buildPrTableEmptyState`
 * copy VERBATIM — this function exists to be the pinned, testable source
 * those two branches move to, not a rewrite. `counts` is ignored for
 * `scope === 'this-year'`: the year filter's own absence is the dominant
 * explanation there, and the guard language belongs on the permanent,
 * all-time emptying D-03 accepts, not a temporary date-filtered one.
 *
 * The third branch's heading names "the plausibility ceiling" only when
 * `counts.ceiling > 0` — otherwise it names "the plausibility guards"
 * generically, since a distance that empties purely on world-record/max-
 * speed demotions (the latent marathon case CR-02 flagged) never had a
 * ceiling to pass or fail. The body is `describeDemotionCounts`'s shared,
 * guard-accurate sentence in both cases, so the note and the empty state
 * can never state a different count for the same underlying breakdown.
 */
export function resolvePrTableEmptyState(
  distance: TargetDistanceKey,
  scope: RecordScope,
  year: number,
  counts: DemotionCounts
): { heading: string; body: string } {
  const label = DISTANCE_DISPLAY_NAMES[distance];

  if (scope === 'this-year') {
    return {
      heading: `No ${label} efforts in ${year}`,
      body: `The archive has no ${label} effort recorded in ${year}. Switch to All time to see every ranked effort.`,
    };
  }

  if (counts.total === 0) {
    return {
      heading: `No ${label} efforts yet`,
      body: `The archive has no completed ${label} effort. Once one is recorded, its rank will appear here.`,
    };
  }

  return {
    heading:
      counts.ceiling > 0
        ? `No ${label} efforts passed the plausibility ceiling`
        : `No ${label} efforts passed the plausibility guards`,
    body: describeDemotionCounts(label, counts),
  };
}

/**
 * The SHORT-table half of D-03/CR-02: a table that still ranks efforts
 * after some were demoted must say so, attributing each demotion to the
 * guard that actually made it rather than blaming every rejection on "the
 * plausibility ceiling". Returns `null` when `counts.total` is 0 — no note
 * when nothing was demoted — and also returns `null` for `scope ===
 * 'this-year'` (WR-01): the count is archive-wide and would otherwise sit
 * under a year-filtered table, misleadingly implying those demotions
 * happened within the filtered year.
 */
export function resolvePrTableDemotionNote(
  distance: TargetDistanceKey,
  scope: RecordScope,
  counts: DemotionCounts
): string | null {
  if (scope === 'this-year') return null;
  if (counts.total === 0) return null;

  const label = DISTANCE_DISPLAY_NAMES[distance];
  return describeDemotionCounts(label, counts);
}

/** The two scopes OVR-03 names. Nothing persists this value — D-04. */
export type RecordScope = 'all-time' | 'this-year';

/**
 * Filters a distance's all-time ranking down to the efforts whose
 * `startDate` falls in `year` (UTC) and reassigns `rank` sequentially from
 * 1. A "This year's records" table showing ranks 4, 9 and 17 would be
 * incoherent to a reader — re-ranking within the scope is the only sane
 * presentation (CONTEXT.md's Claude's Discretion default for this plan).
 *
 * The result feeds the UNCHANGED `buildPrTableRows` above; `isEmptyRanking`
 * works on the filtered array too, with no new sentinel needed for the
 * year-scoped empty case.
 *
 * `year` is an injected parameter, never read from an ambient clock — this
 * keeps the function pure and testable, matching this module's header
 * discipline. Every date is normalized through `parseStartDateToEpochMs`
 * (the shared Z-suffix rule) rather than a bare `new Date(startDate)`, and
 * compared via `getUTCFullYear` — a local-timezone `getFullYear` read would
 * move a 31 December or 1 January effort into the wrong year. An entry
 * whose `startDate` fails to parse is dropped from the scoped view rather
 * than thrown on or silently counted as the current year. Source order
 * (already rank-ascending, fastest first, from the build-time generator) is
 * preserved and never re-sorted — that would be a second, divergent ranking
 * policy alongside the generator's. New objects are produced via spread; no
 * input entry is ever mutated, since `bestEfforts` is held for the lifetime
 * of the view and the all-time scope reads the same array again on toggle
 * back.
 */
export function filterRankingsToYear(
  entries: readonly PRRankingEntry[] | undefined,
  year: number
): PRRankingEntry[] {
  if (!entries || entries.length === 0) return [];

  const inYear: PRRankingEntry[] = [];
  for (const entry of entries) {
    const epochMs = parseStartDateToEpochMs(entry.startDate);
    if (epochMs === null) continue;
    if (new Date(epochMs).getUTCFullYear() !== year) continue;
    inYear.push(entry);
  }

  return inYear.map((entry, i) => ({ ...entry, rank: i + 1 }));
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
 *
 * `endedISO` comes from `currentStreakEnd`, and from nothing else.
 * `currentStreakStart` is deliberately NOT read here: it is `null` for an
 * ended streak, and when non-null it names the streak's start day, not
 * the day it ended (D-12 layer 2). `currentStreakEnd` is not added to the
 * required-field guard above — a `streaks.json` written before this field
 * existed still has no `currentStreakEnd` key, and widening the guard
 * would drop the whole tile instead of just the sub-label. The
 * `typeof currentStreakEnd === 'string'` check below already yields
 * `false` for an absent key, so the degrade falls out for free (D-13).
 */
function selectCurrentStreak(raw: unknown): { days: number; active: boolean; endedISO: string | null } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'currentStreak') || !hasOwn(raw, 'withinCurrentStreak')) return null;

  const { currentStreak, withinCurrentStreak, currentStreakEnd } = raw;
  if (typeof currentStreak !== 'number' || typeof withinCurrentStreak !== 'boolean') return null;

  const active = withinCurrentStreak;
  const endedISO =
    !active && typeof currentStreakEnd === 'string' && currentStreakEnd.length > 0
      ? currentStreakEnd
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
