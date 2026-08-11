/**
 * Pure, DOM-free logic behind the Trends page's Gear tab (TREND-05,
 * decisions D-17/D-18/D19). Parses the published `data/stats/gear-aggregate.json`
 * document, provides click-to-sort semantics for the table (mirroring
 * `list-logic.ts`'s `compareRows`/`sortRows` shape) with the Unknown row
 * always pinned last, and buckets the top-8-by-distance named shoes plus a
 * merged Other bar for the chart (18-UI-SPEC § 12).
 */

import type {
  GearAggregateDocument,
  GearShoeAggregate,
  GearYearCoverage,
} from '../../analytics/gear-aggregate.types.js';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseShoe(raw: unknown): GearShoeAggregate | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'key') || typeof raw.key !== 'string') return null;
  if (!hasOwn(raw, 'label') || typeof raw.label !== 'string') return null;
  if (!hasOwn(raw, 'isUnknown') || typeof raw.isUnknown !== 'boolean') return null;
  if (!hasOwn(raw, 'runs') || !isFiniteNumber(raw.runs)) return null;
  if (!hasOwn(raw, 'distanceM') || !isFiniteNumber(raw.distanceM)) return null;
  if (!hasOwn(raw, 'movingTimeSec') || !isFiniteNumber(raw.movingTimeSec)) return null;

  const avgPaceSecPerKm =
    hasOwn(raw, 'avgPaceSecPerKm') && (raw.avgPaceSecPerKm === null || isFiniteNumber(raw.avgPaceSecPerKm))
      ? (raw.avgPaceSecPerKm as number | null)
      : null;
  const avgHr =
    hasOwn(raw, 'avgHr') && (raw.avgHr === null || isFiniteNumber(raw.avgHr))
      ? (raw.avgHr as number | null)
      : null;
  const runsWithHr = hasOwn(raw, 'runsWithHr') && isFiniteNumber(raw.runsWithHr) ? raw.runsWithHr : 0;
  const firstDate =
    hasOwn(raw, 'firstDate') && (raw.firstDate === null || typeof raw.firstDate === 'string')
      ? (raw.firstDate as string | null)
      : null;
  const lastDate =
    hasOwn(raw, 'lastDate') && (raw.lastDate === null || typeof raw.lastDate === 'string')
      ? (raw.lastDate as string | null)
      : null;

  return {
    key: raw.key,
    label: raw.label,
    isUnknown: raw.isUnknown,
    runs: raw.runs,
    distanceM: raw.distanceM,
    movingTimeSec: raw.movingTimeSec,
    avgPaceSecPerKm,
    avgHr,
    runsWithHr,
    firstDate,
    lastDate,
  };
}

function parseYearCoverage(raw: unknown): GearYearCoverage | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'year') || !isFiniteNumber(raw.year)) return null;
  if (!hasOwn(raw, 'runs') || !isFiniteNumber(raw.runs)) return null;
  if (!hasOwn(raw, 'runsWithGear') || !isFiniteNumber(raw.runsWithGear)) return null;
  if (!hasOwn(raw, 'percentWithGear') || !isFiniteNumber(raw.percentWithGear)) return null;
  return { year: raw.year, runs: raw.runs, runsWithGear: raw.runsWithGear, percentWithGear: raw.percentWithGear };
}

/**
 * Total, never-throwing parse. Returns `null` unless `shoes` is an array
 * and `totals` is an object with a numeric `runs`. Malformed individual
 * shoe entries are dropped rather than rejecting the whole payload
 * (the tolerant entry-level parse discipline established by
 * `parseGearDocument`/`parseYearOverYear`). Own-property reads only.
 */
export function parseGearAggregate(raw: unknown): GearAggregateDocument | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'shoes') || !Array.isArray(raw.shoes)) return null;
  if (!hasOwn(raw, 'totals') || !isRecord(raw.totals) || !isFiniteNumber((raw.totals as Record<string, unknown>).runs)) {
    return null;
  }

  const shoes: GearShoeAggregate[] = [];
  for (const rawShoe of raw.shoes) {
    const shoe = parseShoe(rawShoe);
    if (shoe !== null) shoes.push(shoe);
  }

  const totalsRaw = raw.totals as Record<string, unknown>;
  const totals: GearAggregateDocument['totals'] = {
    runs: isFiniteNumber(totalsRaw.runs) ? totalsRaw.runs : 0,
    runsWithGear: isFiniteNumber(totalsRaw.runsWithGear) ? totalsRaw.runsWithGear : 0,
    runsWithoutGear: isFiniteNumber(totalsRaw.runsWithoutGear) ? totalsRaw.runsWithoutGear : 0,
    percentWithGear: isFiniteNumber(totalsRaw.percentWithGear) ? totalsRaw.percentWithGear : 0,
    distinctShoes: isFiniteNumber(totalsRaw.distinctShoes) ? totalsRaw.distinctShoes : 0,
  };

  const byYear: GearYearCoverage[] = [];
  if (hasOwn(raw, 'byYear') && Array.isArray(raw.byYear)) {
    for (const rawYear of raw.byYear) {
      const year = parseYearCoverage(rawYear);
      if (year !== null) byYear.push(year);
    }
  }

  const schemaVersion = hasOwn(raw, 'schemaVersion') && isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 1;
  const generatedAt = hasOwn(raw, 'generatedAt') && typeof raw.generatedAt === 'string' ? raw.generatedAt : '';
  const note = hasOwn(raw, 'note') && typeof raw.note === 'string' ? raw.note : '';

  return { schemaVersion, generatedAt, note, totals, byYear, shoes };
}

// ---------------------------------------------------------------------------
// Sorting (D-18 — Unknown is always pinned last)
// ---------------------------------------------------------------------------

export type GearSortKey = 'label' | 'distanceM' | 'runs' | 'avgPaceSecPerKm' | 'avgHr' | 'firstDate';

export const GEAR_SORT_KEYS: readonly GearSortKey[] = [
  'label',
  'distanceM',
  'runs',
  'avgPaceSecPerKm',
  'avgHr',
  'firstDate',
];

/** Allow-list, default `'distanceM'`. */
export function parseGearSort(raw: string | null): GearSortKey {
  if (raw !== null && (GEAR_SORT_KEYS as readonly string[]).includes(raw)) {
    return raw as GearSortKey;
  }
  return 'distanceM';
}

function getSortValue(shoe: GearShoeAggregate, key: GearSortKey): number | string | null {
  switch (key) {
    case 'label':
      return shoe.label;
    case 'distanceM':
      return shoe.distanceM;
    case 'runs':
      return shoe.runs;
    case 'avgPaceSecPerKm':
      return shoe.avgPaceSecPerKm;
    case 'avgHr':
      return shoe.avgHr;
    case 'firstDate':
      return shoe.firstDate;
  }
}

/**
 * Returns a NEW array — the Unknown row is always pinned LAST regardless of
 * `key`/`dir` (D-18: its presence, not its position, is what makes the
 * absence honest; letting it float to the top of a distance sort would
 * misread as the biggest "shoe"). `null` values (`avgPaceSecPerKm`, `avgHr`,
 * `firstDate` on an empty bucket) always sort AFTER non-null values in BOTH
 * directions, so a missing measurement never masquerades as the best or
 * worst. `label` compares as a plain string (no natural/numeric-aware
 * ordering — "Shoe 10" sorts before "Shoe 9" ascending, the standard
 * lexicographic result; this is the documented, tested behaviour, not an
 * accident).
 */
export function sortShoes(
  shoes: readonly GearShoeAggregate[],
  key: GearSortKey,
  dir: 'asc' | 'desc'
): GearShoeAggregate[] {
  const named = shoes.filter((s) => !s.isUnknown);
  const unknown = shoes.filter((s) => s.isUnknown);

  const sortedNamed = [...named].sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);

    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;

    let cmp: number;
    if (typeof av === 'string' && typeof bv === 'string') {
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    } else {
      cmp = (av as number) - (bv as number);
    }

    return dir === 'asc' ? cmp : -cmp;
  });

  return [...sortedNamed, ...unknown];
}

// ---------------------------------------------------------------------------
// Chart bucketing (top 8 + Other)
// ---------------------------------------------------------------------------

export const GEAR_CHART_MAX_CATEGORIES = 8;

export interface GearChartBucket {
  label: string;
  distanceM: number;
  isOther: boolean;
  mergedCount: number;
}

/**
 * Takes the NAMED shoes (`isUnknown === false`), sorts by `distanceM`
 * descending, keeps the top `GEAR_CHART_MAX_CATEGORIES`, and merges the
 * remainder into a single `{ label: 'Other ({m} shoes)', isOther: true,
 * mergedCount: m }` bucket whose `distanceM` is the sum. Emits no Other
 * bucket when nothing remains. The Unknown bucket is EXCLUDED from the
 * chart but never from the table — the chart answers "which shoes did the
 * distance", and a bar labelled Unknown would compete as a category; the
 * table and `caption` carry the full picture. `caption` names the total
 * shoe count INCLUDING Unknown (all `shoes.length`), matching § 12's exact
 * copy, or `''` when no merging was needed.
 */
export function buildGearChartBuckets(
  shoes: readonly GearShoeAggregate[]
): { buckets: GearChartBucket[]; caption: string } {
  const named = shoes.filter((s) => !s.isUnknown);
  const totalShoeCount = shoes.length;

  const sortedByDistance = [...named].sort((a, b) => b.distanceM - a.distanceM);
  const top = sortedByDistance.slice(0, GEAR_CHART_MAX_CATEGORIES);
  const rest = sortedByDistance.slice(GEAR_CHART_MAX_CATEGORIES);

  const buckets: GearChartBucket[] = top.map((s) => ({
    label: s.label,
    distanceM: s.distanceM,
    isOther: false,
    mergedCount: 0,
  }));

  let caption = '';
  if (rest.length > 0) {
    const otherDistanceM = rest.reduce((sum, s) => sum + s.distanceM, 0);
    buckets.push({
      label: `Other (${rest.length} shoes)`,
      distanceM: otherDistanceM,
      isOther: true,
      mergedCount: rest.length,
    });
    caption = `Top ${GEAR_CHART_MAX_CATEGORIES} shoes shown by distance; see the table below for all ${totalShoeCount}.`;
  }

  return { buckets, caption };
}

// ---------------------------------------------------------------------------
// Coverage sentence (D-18 — real coverage in plain numbers, never hardcoded)
// ---------------------------------------------------------------------------

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * A single sentence giving the archive-wide gear-coverage percentage and
 * the most recent year's percentage, entirely derived from `totals`/
 * `byYear` — never a hardcoded number. Handles zero runs without dividing
 * by zero (the `totals.percentWithGear`/`GearYearCoverage.percentWithGear`
 * fields are already pre-computed percentages, so this function only
 * formats them).
 */
export function coverageSentence(
  totals: GearAggregateDocument['totals'],
  byYear: readonly GearYearCoverage[]
): string {
  const overall = `Gear is recorded for ${formatCount(totals.runsWithGear)} of ${formatCount(totals.runs)} runs (${formatPercent(totals.percentWithGear)})`;

  if (byYear.length === 0) {
    return `${overall}.`;
  }

  const mostRecent = byYear[byYear.length - 1];
  return `${overall}; in ${mostRecent.year} it is ${formatPercent(mostRecent.percentWithGear)}.`;
}
