/**
 * Contracts for the published dashboard index manifest (`data/dashboard/index.json`).
 *
 * Two invariants this whole contract rests on:
 * - The index is browse-complete: anything a Phase 17 sort or filter needs is
 *   a row field, because a field absent from the index cannot be sorted or
 *   filtered without fetching all 1,867 detail files.
 * - The index is a public artifact published to GitHub Pages, so it carries
 *   only the D-09 field set and never copies athlete identifiers, upload
 *   ids, external ids, gear ids, or privacy flags out of the source activity
 *   record. This rule still forbids copying **gear ids** verbatim; D-17
 *   deliberately threads a resolved *name* through instead (`gearName`
 *   below), which is why that field is a `string | null` label and never an
 *   id. Adding this field is what settles the "gear as an index field"
 *   question Phase 17 deferred.
 *
 * `DASHBOARD_INDEX_SCHEMA_VERSION` stays at `1` for the `gearName` addition
 * below — it is a purely additive field, and `scripts/verify-dashboard-publish.mjs`
 * asserts `schemaVersion === 1`.
 */

import type { DistanceSource, StreamUnavailableReason } from '../streams/stream.types.js';

/** Bump only via an explicit, coordinated regeneration of `data/dashboard/index.json`. */
export const DASHBOARD_INDEX_SCHEMA_VERSION = 1;

/** Per-activity stream-availability summary shown as a badge in list/detail views. */
export interface DashboardIndexStreams {
  available: boolean;
  /** Present only when `available` is false. */
  reason?: StreamUnavailableReason;
  hr: boolean;
  cadence: boolean;
  elevation: boolean;
  distanceSource?: DistanceSource;
}

/** One row in the published dashboard index — one row per activity, no more and no fewer fields than D-09 requires. */
export interface DashboardIndexRow {
  /** The activity id as a string, matching the stream manifest's key type and the `#/activity/:id` route param type. */
  id: string;
  /** The activity's `start_date` (UTC ISO). */
  startDate: string;
  /** The activity's `start_date_local` — the value list/calendar views sort and group on. */
  startDateLocal: string;
  /** Athlete free text. Untrusted: must be rendered with `textContent`, never `innerHTML`. */
  name: string;
  distanceM: number;
  movingTimeSec: number;
  /** `movingTimeSec / (distanceM / 1000)`; null when `distanceM` is 0 or missing. */
  paceSecPerKm: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  /**
   * RAW single-leg rpm, straight from `StravaActivity.average_cadence`.
   * Deliberately NOT doubled to steps-per-minute — Phase 14 keeps
   * cadence-unit conversion in exactly one place (stream derivation).
   */
  avgCadenceRpm: number | null;
  /** First city name from `data/geo/activity-cities.json`, falling back to `StravaActivity.location_city`, then null. */
  location: string | null;
  sportType: string;
  streams: DashboardIndexStreams;
  /** True when the activity's stream `distanceSource` is `'geo'`. */
  lowConfidence: boolean;
  /** Mirrors `ActivityBestEfforts.excludedFromRecords` (plan 01); false when the activity has no best-efforts entry. */
  excludedFromRecords: boolean;
  /** Count of that activity's efforts with `wasPRAtTheTime === true`; 0 when unknown. */
  prCount: number;
  /** Resolved human gear label from data/config/gear.json, or the deterministic "Shoe N" ordinal, or null when the activity has no gear. NEVER the raw gear id (17-D32/D33, D-17). Optional because rows are re-parsed from data/dashboard/index.json at runtime, where the producer's (compute-dashboard-index.ts) required-key guarantee does not survive serialization + re-parse; making the key optional lets the compiler enumerate every consumer that assumed it was always present (D-13). */
  gearName?: string | null;
}

/** Aggregate counts written alongside the row array, mirroring `best-effort.types.ts`'s `totals` convention. */
export interface DashboardIndexTotals {
  activities: number;
  withStreams: number;
  withoutStreams: number;
  withHr: number;
  withCadence: number;
  lowConfidence: number;
  excludedFromRecords: number;
  skippedUnreadable: number;
  withGear: number;
}

/** The full document written to `data/dashboard/index.json`. */
export interface DashboardIndexDocument {
  schemaVersion: 1;
  generatedAt: string;
  note: string;
  totals: DashboardIndexTotals;
  /** Ordered newest-first by `startDateLocal`. */
  activities: DashboardIndexRow[];
}
