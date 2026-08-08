/**
 * Activity provider abstraction.
 *
 * The pipeline consumed Strava directly for its first three milestones. Strava
 * then paywalled Standard-tier API access (June 2026) and Garmin has no personal
 * API at all, so the ingestion source has to be swappable — the analytics, geo
 * and widget layers must never care where an activity came from.
 *
 * Everything downstream reads the canonical record below, which is the Strava
 * summary shape the 1,808 archived activities are already stored in. Keeping
 * that shape means a new provider costs one adapter and nothing else.
 */

import type { StravaActivity } from '../types/strava.types.js';

/**
 * Canonical activity record written to data/activities/{id}.json.
 *
 * Historically named StravaActivity; the alias is the name to use in new code.
 * Renaming the interface itself would touch eight modules for no behaviour
 * change, so the old name stays as the definition and this is the front door.
 */
export type CanonicalActivity = StravaActivity;

/**
 * The nine fields every downstream consumer actually reads.
 *
 * Verified by grepping field access across src/analytics and src/geo. A provider
 * that populates these drives the full pipeline: stats, geo, all ten widgets and
 * the standalone pages. Everything else on the record is passthrough detail.
 */
export const REQUIRED_FIELDS = [
  'id',
  'name',
  'type',
  'start_date',
  'distance',
  'moving_time',
  'total_elevation_gain',
  'start_latlng',
  'map.summary_polyline',
] as const;

/**
 * Who a set of credentials belongs to — surfaced by probe commands so you can
 * confirm you are talking to the right account before syncing anything.
 */
export interface ProviderIdentity {
  athleteId: string;
  name?: string;
  raw: Record<string, unknown>;
}

export interface ListOptions {
  /** Only return activities that started after this instant. */
  since?: Date;
  /** Cap the number returned. Probe commands use this; a full sync does not. */
  limit?: number;
}

/**
 * A source of activities.
 *
 * Implementations own their own auth, rate limiting and pagination, and are
 * responsible for emitting well-formed CanonicalActivity records.
 */
export interface ActivityProvider {
  /** Short identifier used in logs and sync state, e.g. 'strava', 'intervals'. */
  readonly name: string;

  /** Confirm credentials work and report whose account they open. */
  verify(): Promise<ProviderIdentity>;

  /** List activities newest-first, normalised to the canonical shape. */
  listActivities(options?: ListOptions): Promise<CanonicalActivity[]>;

  /**
   * Fetch the raw, unmapped payload for an activity.
   *
   * Used by probe tooling to diff what a provider really returns against what
   * the mapper assumes. Optional: not every provider exposes activity detail.
   */
  fetchRaw?(activityId: string): Promise<Record<string, unknown>>;
}
