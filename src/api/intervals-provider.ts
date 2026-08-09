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
   * Extract the latlng coordinate series from a streams response.
   *
   * Confirmed against a live account: intervals.icu returns an array of stream
   * objects. The coordinate payload has been seen under several key names, and
   * some encodings split latitude and longitude into parallel series, so all
   * known shapes are handled and unknown ones surface via describeStreams.
   */
  static extractCoordinates(streams: unknown): [number, number][] {
    const asArray = Array.isArray(streams) ? (streams as Record<string, unknown>[]) : undefined;
    const asObject = !Array.isArray(streams) && typeof streams === 'object' && streams !== null
      ? (streams as Record<string, unknown>)
      : undefined;

    const seriesNamed = (name: string): unknown => {
      if (asArray) {
        const hit = asArray.find(s => s.type === name || s.name === name);
        return hit?.data ?? hit?.values ?? undefined;
      }
      if (asObject) {
        const entry = asObject[name];
        if (Array.isArray(entry)) return entry;
        if (entry && typeof entry === 'object') {
          const rec = entry as Record<string, unknown>;
          return rec.data ?? rec.values;
        }
      }
      return undefined;
    };

    // Paired form: [[lat, lng], ...]
    for (const key of ['latlng', 'lat_lng', 'position', 'coordinates']) {
      const series = seriesNamed(key);
      if (Array.isArray(series)) {
        const pairs = series.filter(
          (p): p is [number, number] =>
            Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number'
        );
        if (pairs.length > 0) return pairs;

        // Some responses nest objects: [{lat, lng}, ...]
        const objects = series.filter(
          (p): p is Record<string, number> =>
            !!p && typeof p === 'object' && !Array.isArray(p)
        );
        const fromObjects = objects
          .map(o => [
            num(o.lat ?? o.latitude) ?? NaN,
            num(o.lng ?? o.lon ?? o.longitude) ?? NaN,
          ] as [number, number])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        if (fromObjects.length > 0) return fromObjects;
      }
    }

    // Split form: parallel lat and lng series.
    const lats = seriesNamed('lat') ?? seriesNamed('latitude');
    const lngs = seriesNamed('lng') ?? seriesNamed('lon') ?? seriesNamed('longitude');
    if (Array.isArray(lats) && Array.isArray(lngs)) {
      const pairs: [number, number][] = [];
      for (let i = 0; i < Math.min(lats.length, lngs.length); i++) {
        const lat = num(lats[i]);
        const lng = num(lngs[i]);
        if (lat !== undefined && lng !== undefined) pairs.push([lat, lng]);
      }
      if (pairs.length > 0) return pairs;
    }

    // Flat form: the live API returns latlng as one flat series rather than an
    // array of pairs. Two layouts are possible and indistinguishable by type
    // alone, so both are scored and the coherent one wins.
    //
    // Nulls are expected — GPS drops out — so the series is accepted as long as
    // it holds no nested arrays/objects and enough numeric samples to pair.
    for (const key of ['latlng', 'lat_lng', 'position', 'coordinates']) {
      const series = seriesNamed(key);
      if (!Array.isArray(series) || series.length < 4) continue;

      const hasNested = series.some(v => v !== null && typeof v === 'object');
      if (hasNested) continue;

      const numericCount = series.reduce<number>((n, v) => (num(v) !== undefined ? n + 1 : n), 0);
      if (numericCount < 4) continue;

      return IntervalsProvider.pairFlatSeries(series as (number | null)[]);
    }

    return [];
  }

  /**
   * Pair a flat coordinate series into [lat, lng] tuples.
   *
   * Two plausible layouts: interleaved (lat,lng,lat,lng...) or concatenated
   * halves (all lats then all lngs). A GPS track's latitudes cluster tightly and
   * so do its longitudes, whereas mis-splitting mixes the two and produces a
   * wildly wider spread — so scoring by combined spread picks the right one.
   */
  static pairFlatSeries(flat: (number | null)[]): [number, number][] {
    // Nulls mark GPS dropouts. They must survive into the split so that the two
    // halves stay index-aligned; discarding them first would shift latitudes
    // against longitudes and silently bend the route.
    const spread = (values: (number | null)[]): number => {
      const finite = values.filter((v): v is number => num(v) !== undefined);
      if (finite.length === 0) return Infinity;
      return Math.max(...finite) - Math.min(...finite);
    };

    const plausible = (lat: number, lng: number) =>
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    // Layout A: interleaved. An odd trailing value is a truncated sample.
    const evens: (number | null)[] = [];
    const odds: (number | null)[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      evens.push(flat[i]);
      odds.push(flat[i + 1]);
    }

    // Layout B: concatenated halves. Confirmed as the live shape — a real
    // response opened with eight consecutive latitudes.
    const half = Math.floor(flat.length / 2);
    const firstHalf = flat.slice(0, half);
    const secondHalf = flat.slice(half, half * 2);

    const scoreA = spread(evens) + spread(odds);
    const scoreB = spread(firstHalf) + spread(secondHalf);

    const [lats, lngs] = scoreA <= scoreB ? [evens, odds] : [firstHalf, secondHalf];

    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.min(lats.length, lngs.length); i++) {
      const lat = num(lats[i]);
      const lng = num(lngs[i]);
      if (lat !== undefined && lng !== undefined && plausible(lat, lng)) {
        pairs.push([lat, lng]);
      }
    }

    return pairs;
  }

  /**
   * Describe a streams payload's structure without dumping megabytes of samples.
   *
   * Diagnostic aid for probe-intervals: when extractCoordinates comes up empty,
   * this shows the shape that defeated it.
   */
  static describeStreams(streams: unknown): string {
    if (Array.isArray(streams)) {
      const entries = streams as Record<string, unknown>[];
      const summary = entries.map(s => {
        const name = s.type ?? s.name ?? '(unnamed)';
        const data = (s.data ?? s.values) as unknown;
        const len = Array.isArray(data) ? data.length : 0;
        // Several samples, not one: a flat series and a series of pairs look
        // identical from a single element.
        const head = Array.isArray(data) ? JSON.stringify(data.slice(0, 8)) : 'n/a';

        // Element-type census: a single stray null used to disqualify an entire
        // series, so the composition matters as much as the first few values.
        let census = '';
        if (Array.isArray(data)) {
          const counts: Record<string, number> = {};
          for (const v of data) {
            const kind =
              v === null ? 'null'
                : Array.isArray(v) ? 'array'
                  : typeof v;
            counts[kind] = (counts[kind] ?? 0) + 1;
          }
          census = `\n      types: ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(', ')}`;
        }

        return `    ${String(name)}: ${len} samples, first 8 = ${head}${census}`;
      });
      return `  array of ${entries.length} stream object(s)\n${summary.join('\n')}`;
    }

    if (streams && typeof streams === 'object') {
      const rec = streams as Record<string, unknown>;
      const keys = Object.keys(rec);
      const detail = keys.slice(0, 12).map(k => {
        const v = rec[k];
        if (Array.isArray(v)) {
          return `    ${k}: array(${v.length}), first=${v.length ? JSON.stringify(v[0]) : 'n/a'}`;
        }
        if (v && typeof v === 'object') {
          return `    ${k}: object{${Object.keys(v as object).join(', ')}}`;
        }
        return `    ${k}: ${typeof v}`;
      });
      return `  object with keys: ${keys.join(', ')}\n${detail.join('\n')}`;
    }

    return `  ${typeof streams}`;
  }

  /**
   * Fetch route geometry for an activity.
   *
   * intervals.icu ships no encoded polyline on the activity summary and no
   * start_latlng either, so both come from the latlng stream in one request.
   * The encoding matches what the widgets already decode.
   *
   * Returns empty geometry for activities with no GPS (treadmill runs).
   */
  async fetchGeometry(
    activityId: string,
    streamTypes?: string[]
  ): Promise<{ startLatLng?: number[]; summaryPolyline?: string; raw: unknown }> {
    // Ask for whatever coordinate stream the activity says it has, falling back
    // to the documented name.
    const wanted = (streamTypes ?? []).filter(t =>
      ['latlng', 'lat', 'lng', 'position'].includes(t)
    );
    const types = wanted.length > 0 ? wanted : ['latlng'];

    const raw = await this.client.getStreams(activityId, types);
    const coordinates = IntervalsProvider.extractCoordinates(raw);

    if (coordinates.length === 0) return { raw };

    return {
      startLatLng: [coordinates[0][0], coordinates[0][1]],
      summaryPolyline: polyline.encode(coordinates),
      raw,
    };
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

      // intervals.icu keeps the originating Strava id on activities it imported
      // from Strava. That gives an exact join key against the 1,808 archived
      // records — reconciliation by id rather than by fuzzy timestamp match.
      strava_id: raw.strava_id,
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

    // Confirmed against a live payload: intervals.icu carries no start_latlng on
    // the activity summary. It comes from the first sample of the latlng stream,
    // the same request that yields the polyline — so it costs nothing extra.
    const latlng = raw.start_latlng;
    reports.push({
      field: 'start_latlng',
      provenance: Array.isArray(latlng) && latlng.length >= 2 ? 'direct' : 'derived',
      sourceKey: Array.isArray(latlng)
        ? 'start_latlng'
        : 'streams?types=latlng (first sample)',
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
