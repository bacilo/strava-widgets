import polyline from '@mapbox/polyline';

import { IntervalsClient } from './intervals-client.js';
import type {
  ActivityProvider,
  CanonicalActivity,
  ListOptions,
  ProviderIdentity,
} from './provider.js';

/**
 * intervals.icu implementation of ActivityProvider.
 *
 * Maps intervals.icu activities onto the canonical (Strava-summary-shaped)
 * record the rest of the pipeline reads, so analytics, geo and every widget
 * keep working unchanged.
 *
 * Field names below are taken from the published API docs. intervals.icu
 * borrows most of Strava's naming, but this has NOT been verified against a
 * live account — run `node dist/index.js probe-intervals` to diff the real
 * payload against these assumptions before trusting a sync.
 */

/** How a canonical field got its value — reported by the probe command. */
export type FieldProvenance = 'direct' | 'derived' | 'missing';

export interface MappingReport {
  field: string;
  provenance: FieldProvenance;
  sourceKey?: string;
  value?: unknown;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Pick the first present key from a list of candidates.
 *
 * intervals.icu has renamed fields over time and differs from Strava in
 * places, so each canonical field accepts several plausible source names
 * rather than betting on one.
 */
function pick<T>(
  raw: Record<string, unknown>,
  keys: string[],
  coerce: (v: unknown) => T | undefined
): { value?: T; sourceKey?: string } {
  for (const key of keys) {
    const value = coerce(raw[key]);
    if (value !== undefined) return { value, sourceKey: key };
  }
  return {};
}

export class IntervalsProvider implements ActivityProvider {
  readonly name = 'intervals';

  constructor(private client: IntervalsClient) {}

  async verify(): Promise<ProviderIdentity> {
    const athlete = await this.client.getAthlete();
    return {
      athleteId: String(athlete.id ?? this.client.athleteId),
      name: str(athlete.name),
      raw: athlete,
    };
  }

  async listActivities(options: ListOptions = {}): Promise<CanonicalActivity[]> {
    const raw = await this.fetchRawActivities(options);
    return raw.map(activity => this.toCanonical(activity));
  }

  /** Raw provider payloads, newest first — the probe command diffs against these. */
  async fetchRawActivities(options: ListOptions = {}): Promise<Record<string, unknown>[]> {
    const oldest = options.since ? options.since.toISOString().slice(0, 10) : undefined;
    const activities = await this.client.getActivities({ oldest });

    // The API documents newest-first ordering; sort defensively rather than rely on it.
    const sorted = [...activities].sort((a, b) => {
      const aDate = str(a.start_date_local) ?? str(a.start_date) ?? '';
      const bDate = str(b.start_date_local) ?? str(b.start_date) ?? '';
      return bDate.localeCompare(aDate);
    });

    return options.limit ? sorted.slice(0, options.limit) : sorted;
  }

  async fetchRaw(activityId: string): Promise<Record<string, unknown>> {
    return this.client.getActivity(activityId);
  }

  /**
   * Rebuild an encoded polyline from the activity's latlng stream.
   *
   * Strava shipped `map.summary_polyline` on every activity; intervals.icu is
   * not known to, so route geometry costs one extra request per activity. The
   * encoding is the same format the widgets already decode.
   *
   * Returns undefined for activities with no GPS (treadmill runs).
   */
  async fetchPolyline(activityId: string): Promise<string | undefined> {
    const streams = await this.client.getStreams(activityId, ['latlng']);

    // Streams come back either as a keyed object or an array of {type, data}.
    let points: unknown;
    if (Array.isArray(streams)) {
      points = (streams as Array<Record<string, unknown>>).find(s => s.type === 'latlng')?.data;
    } else {
      const latlng = streams.latlng as Record<string, unknown> | undefined;
      points = latlng?.data ?? latlng;
    }

    if (!Array.isArray(points) || points.length === 0) return undefined;

    const coordinates = points.filter(
      (p): p is [number, number] =>
        Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number'
    );

    if (coordinates.length === 0) return undefined;

    return polyline.encode(coordinates);
  }

  /**
   * Map one intervals.icu activity onto the canonical record.
   *
   * `map.summary_polyline` is left empty here — it needs the streams endpoint,
   * so callers that want route geometry enrich afterwards via fetchPolyline.
   */
  toCanonical(raw: Record<string, unknown>): CanonicalActivity {
    const startDate =
      pick(raw, ['start_date', 'start_date_utc'], str).value ??
      pick(raw, ['start_date_local'], str).value ??
      '';

    const distance = pick(raw, ['distance', 'icu_distance'], num).value ?? 0;
    const movingTime = pick(raw, ['moving_time', 'icu_moving_time'], num).value ?? 0;

    const averageSpeed =
      pick(raw, ['average_speed'], num).value ??
      (movingTime > 0 ? distance / movingTime : 0);

    const latlng = raw.start_latlng;
    const startLatLng =
      Array.isArray(latlng) && latlng.length >= 2 ? (latlng as number[]) : undefined;

    return {
      // intervals.icu ids are strings such as 'i70023443'; the canonical id is
      // widened to accept them so filenames and route keys stay stable.
      id: (raw.id as number | string) ?? '',
      name: str(raw.name) ?? 'Untitled',
      type: str(raw.type) ?? 'Run',
      start_date: startDate,
      start_date_local: str(raw.start_date_local) ?? startDate,
      distance,
      moving_time: movingTime,
      elapsed_time: pick(raw, ['elapsed_time'], num).value ?? movingTime,
      total_elevation_gain: pick(raw, ['total_elevation_gain', 'icu_elevation_gain'], num).value ?? 0,
      average_speed: averageSpeed,
      max_speed: pick(raw, ['max_speed'], num).value ?? 0,
      average_heartrate: pick(raw, ['average_heartrate', 'icu_average_hr'], num).value,
      max_heartrate: pick(raw, ['max_heartrate', 'icu_max_hr'], num).value,
      start_latlng: startLatLng,
      map: { summary_polyline: str((raw.map as Record<string, unknown>)?.summary_polyline) ?? '' },

      // Provenance, so a mixed archive stays auditable after the migration.
      source_provider: 'intervals',
      source_raw_id: raw.id,
    };
  }

  /**
   * Explain how each required field would be populated from a real payload.
   *
   * This is the point of the scaffold: rather than trusting the docs, run it
   * against the live account and see which assumptions actually hold.
   */
  explainMapping(raw: Record<string, unknown>): MappingReport[] {
    const reports: MappingReport[] = [];

    const direct = (field: string, keys: string[], coerce: (v: unknown) => unknown) => {
      const { value, sourceKey } = pick(raw, keys, coerce as (v: unknown) => unknown);
      reports.push({
        field,
        provenance: value !== undefined ? 'direct' : 'missing',
        sourceKey,
        value,
      });
    };

    direct('id', ['id'], v => (typeof v === 'number' || typeof v === 'string' ? v : undefined));
    direct('name', ['name'], str);
    direct('type', ['type'], str);
    direct('start_date', ['start_date', 'start_date_utc', 'start_date_local'], str);
    direct('distance', ['distance', 'icu_distance'], num);
    direct('moving_time', ['moving_time', 'icu_moving_time'], num);
    direct('total_elevation_gain', ['total_elevation_gain', 'icu_elevation_gain'], num);

    const latlng = raw.start_latlng;
    reports.push({
      field: 'start_latlng',
      provenance: Array.isArray(latlng) && latlng.length >= 2 ? 'direct' : 'missing',
      sourceKey: Array.isArray(latlng) ? 'start_latlng' : undefined,
      value: latlng,
    });

    const summary = (raw.map as Record<string, unknown>)?.summary_polyline;
    reports.push({
      field: 'map.summary_polyline',
      provenance: str(summary) ? 'direct' : 'derived',
      sourceKey: str(summary) ? 'map.summary_polyline' : 'streams?types=latlng (encoded)',
    });

    return reports;
  }
}
