/**
 * Pure, client-safe WMA age-grading lookup/interpolation/formula module
 * (REC-06, D-09). No `fs`, no `fetch`, no Node-only imports, no `document` —
 * this is imported by both the build-time age-grading compute step (plan
 * 18-08) and, potentially, browser code, so it must stay free of any
 * environment-specific dependency.
 *
 * Mirrors `streak-utils.ts`/`date-utils.ts`'s UTC-only date-arithmetic
 * convention and `detail-zones.ts`'s `parseAthleteConfig` total/never-throws
 * validation idiom.
 */

import { TARGET_METERS } from './best-effort.types.js';
import type { TargetDistanceKey } from './best-effort.types.js';

export type WmaSurface = 'road' | 'track';

/**
 * Structurally identical to the type declared in `athlete-private.ts`
 * (plan 18-01), but declared independently here so this module never
 * imports anything from the build-only athlete-config split — this file
 * must stay reachable from browser code.
 */
export type AthleteSex = 'male' | 'female';

/** The parsed shape of `data/wma/road-factors.json` / `data/wma/track-factors.json`. */
export interface WmaFactorTable {
  schemaVersion: number;
  surface: WmaSurface;
  edition: string;
  source: string;
  openStandardSec: Record<AthleteSex, Record<string, number>>;
  factors: Record<AthleteSex, Record<string, Record<string, number>>>;
}

/** Own-property read only — guards against prototype-pollution reachability (T-18-PROTO-01). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses one sex's `openStandardSec` map, tolerantly dropping any entry
 * that isn't a positive finite number. The literal key `__proto__` is
 * skipped explicitly: unlike a plain string/number value (which the
 * `__proto__` accessor silently ignores per spec), an object-typed dynamic
 * assignment through that key would otherwise reach the prototype chain —
 * this function itself only ever assigns numbers, but keeping the guard
 * here documents the same discipline used in `parseFactorDistanceMap` below,
 * where an object-typed assignment through a dynamic key really is at risk.
 */
function parseOpenStandardMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const result: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    if (key === '__proto__') continue;
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Parses one sex's `factors` map (`distanceKey -> age -> factor`). Tolerant,
 * entry-level: a single malformed age or distance is dropped rather than
 * invalidating the rest (mirrors `parseGearDocument`'s discipline). A
 * distance left with zero valid ages after filtering is dropped entirely so
 * it can never satisfy `parseWmaFactorTable`'s "at least one valid
 * distance" gate below. The `__proto__` guard on `distanceKey` is load-
 * bearing here (not merely defensive): `result[distanceKey] = ages` assigns
 * an OBJECT through a dynamic key, and `result['__proto__'] = ages` would
 * silently replace `result`'s prototype rather than adding a reachable
 * property.
 */
function parseFactorDistanceMap(raw: unknown): Record<string, Record<string, number>> {
  if (!isPlainObject(raw)) return {};
  const result: Record<string, Record<string, number>> = {};
  for (const distanceKey of Object.keys(raw)) {
    if (distanceKey === '__proto__') continue;
    const agesRaw = raw[distanceKey];
    if (!isPlainObject(agesRaw)) continue;

    const ages: Record<string, number> = {};
    for (const ageKey of Object.keys(agesRaw)) {
      if (ageKey === '__proto__') continue;
      const value = agesRaw[ageKey];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1) {
        ages[ageKey] = value;
      }
    }
    if (Object.keys(ages).length > 0) {
      result[distanceKey] = ages;
    }
  }
  return result;
}

/**
 * Total, never-throwing parse of a committed `data/wma/*-factors.json` body.
 * Rejects (returns `null`) unless BOTH `male` and `female` carry at least
 * one distance with at least one numeric factor in `(0, 1]` AND a positive
 * open standard for that same distance — a table that is structurally
 * present but numerically empty (or corrupted down to nothing by the
 * tolerant per-entry filtering above) is treated the same as a missing one.
 */
export function parseWmaFactorTable(raw: unknown): WmaFactorTable | null {
  if (!isPlainObject(raw)) return null;

  if (!hasOwn(raw, 'schemaVersion')) return null;
  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) return null;

  if (!hasOwn(raw, 'surface')) return null;
  const surface = raw.surface;
  if (surface !== 'road' && surface !== 'track') return null;

  if (!hasOwn(raw, 'edition')) return null;
  const edition = raw.edition;
  if (typeof edition !== 'string' || edition.length === 0) return null;

  if (!hasOwn(raw, 'source')) return null;
  const source = raw.source;
  if (typeof source !== 'string' || source.length === 0) return null;

  if (!hasOwn(raw, 'openStandardSec')) return null;
  const openStandardSecRaw = raw.openStandardSec;
  if (
    !isPlainObject(openStandardSecRaw) ||
    !hasOwn(openStandardSecRaw, 'male') ||
    !hasOwn(openStandardSecRaw, 'female')
  ) {
    return null;
  }
  const openStandardSec: Record<AthleteSex, Record<string, number>> = {
    male: parseOpenStandardMap(openStandardSecRaw.male),
    female: parseOpenStandardMap(openStandardSecRaw.female),
  };

  if (!hasOwn(raw, 'factors')) return null;
  const factorsRaw = raw.factors;
  if (!isPlainObject(factorsRaw) || !hasOwn(factorsRaw, 'male') || !hasOwn(factorsRaw, 'female')) {
    return null;
  }
  const factors: Record<AthleteSex, Record<string, Record<string, number>>> = {
    male: parseFactorDistanceMap(factorsRaw.male),
    female: parseFactorDistanceMap(factorsRaw.female),
  };

  for (const sex of ['male', 'female'] as const) {
    const hasValidDistance = Object.keys(factors[sex]).some((distanceKey) =>
      hasOwn(openStandardSec[sex], distanceKey)
    );
    if (!hasValidDistance) return null;
  }

  return { schemaVersion, surface, edition, source, openStandardSec, factors };
}

interface UtcDateOnly {
  year: number;
  month: number; // 1-indexed
  day: number;
}

/**
 * Parses a date-only or full-ISO string into its UTC `[year, month, day]`
 * triple, normalizing by taking `slice(0, 10)` and appending `T00:00:00Z`
 * (the same Z-suffix discipline `list.ts`'s `formatActivityDate` documents).
 * Rejects any input whose year/month/day round-trip through `Date` does not
 * match what was written — this is what lets a genuinely invalid date
 * (`2001-02-29`, which does not exist) be rejected without ever throwing,
 * while a genuinely valid one (`2000-02-29`, a real leap day) still parses.
 */
function parseUtcDateOnly(iso: string): UtcDateOnly | null {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  const datePart = iso.slice(0, 10);
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;

  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const normalized = `${datePart}T00:00:00Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  // Round-trip check: rejects e.g. "2001-02-29" (Date silently rolls it to
  // March 1st rather than throwing) without ever constructing an invalid date.
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

/**
 * Whole years between two UTC dates, comparing `[year, month, day]` triples
 * so a birthday later in the year does not round up. Returns `null` on any
 * unparseable input or when `onDateISO` is before `birthDateISO`.
 */
export function ageAtDate(birthDateISO: string, onDateISO: string): number | null {
  const birth = parseUtcDateOnly(birthDateISO);
  const on = parseUtcDateOnly(onDateISO);
  if (birth === null || on === null) return null;

  let age = on.year - birth.year;
  const birthdayNotYetReached = on.month < birth.month || (on.month === birth.month && on.day < birth.day);
  if (birthdayNotYetReached) age -= 1;

  if (age < 0) return null;
  return age;
}

/**
 * Exact whole-year factor lookup for one sex/distance. Clamps `age` to the
 * table's own min/max tabulated age FOR THAT DISTANCE (never returns `null`
 * for an out-of-range age — a 12-year-old or a 100-year-old must still
 * grade); returns `null` only when the sex/distance combination itself is
 * absent from the table.
 */
export function lookupFactor(
  table: WmaFactorTable,
  sex: AthleteSex,
  distanceKey: string,
  age: number
): number | null {
  const bySex = table.factors[sex];
  const ages = bySex ? bySex[distanceKey] : undefined;
  if (ages === undefined) return null;

  const tabulatedAges = Object.keys(ages)
    .map(Number)
    .filter((a) => Number.isFinite(a));
  if (tabulatedAges.length === 0) return null;

  const minAge = Math.min(...tabulatedAges);
  const maxAge = Math.max(...tabulatedAges);
  const clampedAge = Math.max(minAge, Math.min(maxAge, Math.round(age)));

  const factor = ages[String(clampedAge)];
  return typeof factor === 'number' ? factor : null;
}

// Log-linear interpolation weight for 1000m between the 800m and mile track
// distances — computed once since the three distances are fixed constants.
// `u` is the same interpolation technique the Alan Jones road-standards
// project itself uses for gap distances (S6 = S5*(1-u) + S10*u).
const INTERPOLATE_1K_D800 = 800;
const INTERPOLATE_1K_DMILE = TARGET_METERS['1mi']; // 1609.344
const INTERPOLATE_1K_D1K = TARGET_METERS['1k']; // 1000
const INTERPOLATE_1K_U =
  (Math.log(INTERPOLATE_1K_D1K) - Math.log(INTERPOLATE_1K_D800)) /
  (Math.log(INTERPOLATE_1K_DMILE) - Math.log(INTERPOLATE_1K_D800));

/**
 * D-09: 1k has no WMA standard at all. Log-linear interpolation between the
 * 800m and mile track factors at 1000m — `ln(1000)` sits nearer `ln(800)`
 * than `ln(1609.344)`, so the result is always closer to the 800m factor
 * than to the midpoint of the two inputs.
 */
export function interpolate1kFactor(factor800: number, factorMile: number): number {
  return factor800 * (1 - INTERPOLATE_1K_U) + factorMile * INTERPOLATE_1K_U;
}

/** Same log-linear weight as `interpolate1kFactor`, applied to the two open standards instead of the two factors. */
function interpolateOpenStandard1k(standard800: number, standardMile: number): number {
  return standard800 * (1 - INTERPOLATE_1K_U) + standardMile * INTERPOLATE_1K_U;
}

/**
 * Canonical age-grade percentage formula: divide the open standard by the
 * actual time, then divide that ratio by the age factor, then scale to a
 * percentage.
 *
 * Pitfall 5's failure signature: an implementation that MULTIPLIES by
 * `ageFactor` instead of DIVIDING inverts the age-reward direction — it
 * would make an athlete further from their age's factor-1.0 peak score
 * HIGHER on an identical time, not lower. Do not "simplify" or reorder the
 * expression below; the division order is load-bearing and is exactly what
 * `wma-factors.test.ts`'s mutation check exists to catch.
 */
export function ageGradePercent(openStandardSec: number, actualSec: number, ageFactor: number): number {
  if (!(actualSec > 0) || !(ageFactor > 0)) return 0;
  return (openStandardSec / actualSec / ageFactor) * 100;
}

/** One resolved age-grade result for a specific effort. */
export interface AgeGradeResult {
  percent: number;
  /** True only for `1k` — interpolated, never presented as a published WMA standard (D-09). */
  derived: boolean;
  surface: WmaSurface;
}

/**
 * Routes a `TargetDistanceKey` to the road or track table per D-09:
 * `5k`/`10k`/`half`/`marathon` -> road; `400m`/`1mi` -> track; `1k` -> track,
 * with both the factor and the open standard log-linearly interpolated
 * between the `800m` and `1mi` track entries and `derived` forced `true`.
 * Returns `null` whenever any required lookup (factor or open standard) is
 * missing from the relevant table for the given sex/age.
 */
export function resolveAgeGrade(
  road: WmaFactorTable,
  track: WmaFactorTable,
  sex: AthleteSex,
  distance: TargetDistanceKey,
  age: number,
  actualSec: number
): AgeGradeResult | null {
  if (distance === '5k' || distance === '10k' || distance === 'half' || distance === 'marathon') {
    const factor = lookupFactor(road, sex, distance, age);
    if (factor === null) return null;
    const openStandardSec = road.openStandardSec[sex]?.[distance];
    if (typeof openStandardSec !== 'number') return null;
    return { percent: ageGradePercent(openStandardSec, actualSec, factor), derived: false, surface: 'road' };
  }

  if (distance === '400m' || distance === '1mi') {
    const factor = lookupFactor(track, sex, distance, age);
    if (factor === null) return null;
    const openStandardSec = track.openStandardSec[sex]?.[distance];
    if (typeof openStandardSec !== 'number') return null;
    return { percent: ageGradePercent(openStandardSec, actualSec, factor), derived: false, surface: 'track' };
  }

  // distance === '1k'
  const factor800 = lookupFactor(track, sex, '800m', age);
  const factorMile = lookupFactor(track, sex, '1mi', age);
  if (factor800 === null || factorMile === null) return null;
  const factor = interpolate1kFactor(factor800, factorMile);

  const standard800 = track.openStandardSec[sex]?.['800m'];
  const standardMile = track.openStandardSec[sex]?.['1mi'];
  if (typeof standard800 !== 'number' || typeof standardMile !== 'number') return null;
  const openStandardSec = interpolateOpenStandard1k(standard800, standardMile);

  return { percent: ageGradePercent(openStandardSec, actualSec, factor), derived: true, surface: 'track' };
}
