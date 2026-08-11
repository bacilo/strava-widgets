/**
 * Contracts for the published gear-aggregate document (`data/stats/gear-aggregate.json`).
 *
 * This is a **published public artifact**: `key` is a slug (`shoe-1`…,
 * `unknown`), never a gear id — the same D-09/17-D32/D33 discipline
 * `dashboard-index.types.ts` documents for `gearName`.
 */

/** Bump only via an explicit, coordinated regeneration of `data/stats/gear-aggregate.json`. */
export const GEAR_AGGREGATE_SCHEMA_VERSION = 1;

/** Per-shoe rollup, one entry per distinct resolved gear label plus one always-last Unknown bucket. */
export interface GearShoeAggregate {
  /** Slug derived from `label` (e.g. `shoe-1`, `pegasus-40`), or the literal `unknown` for the Unknown bucket. Never a raw gear id. */
  key: string;
  label: string;
  isUnknown: boolean;
  runs: number;
  distanceM: number;
  movingTimeSec: number;
  /** `movingTimeSec / (distanceM / 1000)`; null when `distanceM <= 0`. */
  avgPaceSecPerKm: number | null;
  /** Moving-time-weighted mean of non-null `avgHr` values in the bucket; null when `runsWithHr === 0` (never 0, which would read as a real measurement). */
  avgHr: number | null;
  runsWithHr: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** One calendar year's gear-coverage summary. */
export interface GearYearCoverage {
  year: number;
  runs: number;
  runsWithGear: number;
  /** Rounded to 1 decimal. */
  percentWithGear: number;
}

/** The full document written to `data/stats/gear-aggregate.json`. */
export interface GearAggregateDocument {
  schemaVersion: number;
  generatedAt: string;
  note: string;
  totals: {
    runs: number;
    runsWithGear: number;
    runsWithoutGear: number;
    /** Rounded to 1 decimal. */
    percentWithGear: number;
    distinctShoes: number;
  };
  /** Years ascending. */
  byYear: GearYearCoverage[];
  /** Sorted descending by `distanceM`, with the Unknown bucket always last regardless of its size. */
  shoes: GearShoeAggregate[];
}
