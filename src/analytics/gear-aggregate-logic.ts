/**
 * Pure grouping logic for the per-shoe gear aggregate (TREND-05, D-17/D-18/D-19).
 *
 * No I/O — the compute step (`compute-gear-aggregate.ts`) owns reading the
 * index and writing the document; this module only transforms
 * `DashboardIndexRow[]` into the two published shapes.
 */

import type { DashboardIndexRow } from './dashboard-index.types.js';
import type { GearAggregateDocument, GearShoeAggregate, GearYearCoverage } from './gear-aggregate.types.js';
import { UNKNOWN_GEAR_LABEL } from './gear-naming.js';

/**
 * Returns the `YYYY-MM-DD` local day for a `startDateLocal` value, or null
 * when unparseable. Applies the same Z-suffix normalization rule as
 * `calendar-logic.ts`'s `activityDayKey`: append a `Z` when the string does
 * not already end in one, then read the `getUTC*` components, so both
 * archive shapes (Strava-era Z-suffixed, intervals.icu-era no-Z) yield
 * wall-clock-correct days regardless of the build machine's timezone.
 */
function localDayKey(startDateLocal: string): string | null {
  if (typeof startDateLocal !== 'string') return null;
  const normalized = startDateLocal.endsWith('Z') ? startDateLocal : `${startDateLocal}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;

  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns the local calendar year for a `startDateLocal` value, or null when unparseable. */
function localYear(startDateLocal: string): number | null {
  const dayKey = localDayKey(startDateLocal);
  if (dayKey === null) return null;
  return Number(dayKey.slice(0, 4));
}

/** Lowercases and replaces every run of non-alphanumeric characters with a single hyphen, trimming leading/trailing hyphens. */
function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'shoe';
}

/** Rounds to at most one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface MutableBucket {
  key: string;
  label: string;
  isUnknown: boolean;
  runs: number;
  distanceM: number;
  movingTimeSec: number;
  hrWeightedSum: number;
  hrWeightTotal: number;
  runsWithHr: number;
  firstDayKey: string | null;
  firstDate: string | null;
  lastDayKey: string | null;
  lastDate: string | null;
}

function newBucket(label: string, isUnknown: boolean): MutableBucket {
  return {
    key: '', // assigned once every label is known, so slug collisions can be de-duplicated
    label,
    isUnknown,
    runs: 0,
    distanceM: 0,
    movingTimeSec: 0,
    hrWeightedSum: 0,
    hrWeightTotal: 0,
    runsWithHr: 0,
    firstDayKey: null,
    firstDate: null,
    lastDayKey: null,
    lastDate: null,
  };
}

function applyRow(bucket: MutableBucket, row: DashboardIndexRow): void {
  bucket.runs += 1;
  bucket.distanceM += row.distanceM;
  bucket.movingTimeSec += row.movingTimeSec;

  if (row.avgHr !== null && row.movingTimeSec > 0) {
    bucket.hrWeightedSum += row.avgHr * row.movingTimeSec;
    bucket.hrWeightTotal += row.movingTimeSec;
    bucket.runsWithHr += 1;
  }

  const dayKey = localDayKey(row.startDateLocal);
  if (dayKey !== null) {
    if (bucket.firstDayKey === null || dayKey < bucket.firstDayKey) {
      bucket.firstDayKey = dayKey;
      bucket.firstDate = dayKey;
    }
    if (bucket.lastDayKey === null || dayKey > bucket.lastDayKey) {
      bucket.lastDayKey = dayKey;
      bucket.lastDate = dayKey;
    }
  }
}

function finalizeBucket(bucket: MutableBucket): GearShoeAggregate {
  const avgPaceSecPerKm =
    bucket.distanceM > 0 ? round1(bucket.movingTimeSec / (bucket.distanceM / 1000)) : null;
  const avgHr = bucket.runsWithHr > 0 ? round1(bucket.hrWeightedSum / bucket.hrWeightTotal) : null;

  return {
    key: bucket.key,
    label: bucket.label,
    isUnknown: bucket.isUnknown,
    runs: bucket.runs,
    distanceM: bucket.distanceM,
    movingTimeSec: bucket.movingTimeSec,
    avgPaceSecPerKm,
    avgHr,
    runsWithHr: bucket.runsWithHr,
    firstDate: bucket.firstDate,
    lastDate: bucket.lastDate,
  };
}

/**
 * Groups `rows` by `row.gearName`, with `null` collapsing into a single
 * bucket labelled `UNKNOWN_GEAR_LABEL` (`isUnknown: true`, `key: 'unknown'`).
 * The Unknown bucket is emitted whenever its run count is > 0 and is never
 * filtered out (D-18). Named buckets get a slug key, de-duplicated with a
 * numeric suffix on collision. Sorted descending by `distanceM`, with the
 * Unknown bucket always last regardless of its size, so it reads as a
 * residual rather than competing as a shoe.
 */
export function buildGearAggregate(rows: readonly DashboardIndexRow[]): GearShoeAggregate[] {
  // Named labels only. The Unknown bucket is held in its own variable rather
  // than under a sentinel key in this map. The previous sentinel was
  // '\u0000unknown' written with a LITERAL NUL byte in the source, which made
  // this file binary to git: `file` reported it as `data`, `git diff` and
  // `git blame` refused to show content, and anything treating NUL as a
  // terminator (grep without -a, editors, review UIs) mishandled it. The
  // collision-safety the sentinel bought is free once the bucket simply is
  // not in the label-keyed map.
  const buckets = new Map<string, MutableBucket>();
  let unknownBucket: MutableBucket | null = null;

  for (const row of rows) {
    const label = row.gearName;
    // FIX-02 / D-12: rows are parsed from index.json at runtime, where the
    // required-key guarantee does not hold, so this is a type-and-emptiness
    // test rather than an `=== null` identity check — it also catches an
    // absent key, `undefined`, and a malformed non-string value, none of
    // which can safely reach slugify().
    const isUnknown = typeof label !== 'string' || label === '';

    if (isUnknown) {
      unknownBucket ??= newBucket(UNKNOWN_GEAR_LABEL, true);
      applyRow(unknownBucket, row);
      continue;
    }

    let bucket = buckets.get(label);
    if (!bucket) {
      bucket = newBucket(label, false);
      buckets.set(label, bucket);
    }
    applyRow(bucket, row);
  }

  // Assign slug keys in a deterministic order (by label, then by insertion)
  // so collisions get stable numeric suffixes across runs.
  const namedBuckets = Array.from(buckets.values()).sort((a, b) =>
    a.label < b.label ? -1 : a.label > b.label ? 1 : 0
  );

  // 'unknown' is reserved before the named loop runs. The Unknown bucket is
  // assigned that key unconditionally below, without consulting usedSlugs, so
  // a real shoe named 'Unknown' / 'unknown' / 'UNKNOWN' in the hand-maintained
  // data/config/gear.json slugifies to the same string and would publish two
  // aggregates sharing key 'unknown' AND label 'Unknown' — distinguishable
  // only by isUnknown, breaking the documented stable-key contract and
  // showing two identically-labelled rows in the trends table. Reserving it
  // here routes the real shoe through the existing -2/-3 suffixing.
  const usedSlugs = new Set<string>(['unknown']);
  for (const bucket of namedBuckets) {
    const base = slugify(bucket.label);
    let candidate = base;
    let suffix = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(candidate);
    bucket.key = candidate;
  }

  if (unknownBucket) {
    unknownBucket.key = 'unknown';
  }

  const finalized = namedBuckets.map(finalizeBucket);
  finalized.sort((a, b) => b.distanceM - a.distanceM);

  if (unknownBucket && unknownBucket.runs > 0) {
    finalized.push(finalizeBucket(unknownBucket));
  }

  return finalized;
}

/**
 * Computes overall and per-calendar-year counts of rows with a non-null
 * `gearName`. Years ascending. `percentWithGear` rounded to 1 decimal. This
 * is what makes D-18's "states its real coverage in plain numbers" and the
 * 2026 pipeline-gap erosion visible.
 */
export function buildGearCoverage(
  rows: readonly DashboardIndexRow[]
): { totals: GearAggregateDocument['totals']; byYear: GearYearCoverage[] } {
  let runsWithGear = 0;
  const distinctLabels = new Set<string>();
  const byYearMap = new Map<number, { runs: number; runsWithGear: number }>();

  for (const row of rows) {
    const label = row.gearName;
    // FIX-02 / D-12: same type-and-emptiness predicate as buildGearAggregate
    // above (negated) — see that site's comment for why `=== null` is not
    // sufficient once rows are parsed from index.json at runtime.
    const hasGear = typeof label === 'string' && label !== '';
    if (hasGear) {
      runsWithGear += 1;
      distinctLabels.add(label);
    }

    const year = localYear(row.startDateLocal);
    if (year !== null) {
      let entry = byYearMap.get(year);
      if (!entry) {
        entry = { runs: 0, runsWithGear: 0 };
        byYearMap.set(year, entry);
      }
      entry.runs += 1;
      if (hasGear) entry.runsWithGear += 1;
    }
  }

  const runs = rows.length;
  const percentWithGear = runs > 0 ? round1((runsWithGear / runs) * 100) : 0;

  const byYear: GearYearCoverage[] = Array.from(byYearMap.entries())
    .map(([year, entry]) => ({
      year,
      runs: entry.runs,
      runsWithGear: entry.runsWithGear,
      percentWithGear: entry.runs > 0 ? round1((entry.runsWithGear / entry.runs) * 100) : 0,
    }))
    .sort((a, b) => a.year - b.year);

  return {
    totals: {
      runs,
      runsWithGear,
      runsWithoutGear: runs - runsWithGear,
      percentWithGear,
      distinctShoes: distinctLabels.size,
    },
    byYear,
  };
}
