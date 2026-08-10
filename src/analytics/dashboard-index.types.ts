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
 *   record.
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
