import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';

/**
 * HTTP client for the intervals.icu Open API.
 *
 * intervals.icu holds Garmin partner access and syncs activities automatically
 * once connected via OAuth, so it acts as a bridge to Garmin data without
 * depending on Garmin's enterprise-only developer program or on reverse
 * engineered logins (garth was deprecated in March 2026 when Garmin added TLS
 * fingerprinting).
 *
 * Auth is HTTP Basic with the literal username 'API_KEY' and the personal API
 * key as the password. Generate one under Settings > Developer Settings.
 *
 * Docs: https://intervals.icu/api/v1/docs/swagger-ui/
 */

const BASE_URL = 'https://intervals.icu/api/v1';

export interface IntervalsClientOptions {
  apiKey: string;
  /** Numeric athlete id, or '0' for whoever owns the key. */
  athleteId?: string;
}

export class IntervalsClient {
  private limiter: Bottleneck;
  private authHeader: string;
  readonly athleteId: string;

  constructor({ apiKey, athleteId = '0' }: IntervalsClientOptions) {
    if (!apiKey) {
      throw new Error(
        'Missing intervals.icu API key. Set INTERVALS_API_KEY in .env — ' +
        'generate one at https://intervals.icu/settings under Developer Settings.'
      );
    }

    this.athleteId = athleteId;
    this.authHeader = `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;

    // intervals.icu publishes no hard rate limit and is a small, donation-funded
    // service. Stay deliberately gentle: serialised, ~3 requests/second.
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 350,
    });
  }

  async request<T>(endpoint: string): Promise<T> {
    return this.limiter.schedule(async () => {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
              Authorization: this.authHeader,
              Accept: 'application/json',
            },
          });

          if (res.status === 401 || res.status === 403) {
            throw new Error(
              `HTTP ${res.status}: intervals.icu rejected the API key. ` +
              `Check INTERVALS_API_KEY and that INTERVALS_ATHLETE_ID matches the key owner.`
            );
          }

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }

          return res;
        },
        {
          retries: 3,
          onFailedAttempt: (error: any) => {
            console.warn(`intervals.icu request failed (attempt ${error.attemptNumber}):`, error.message);
          },
          shouldRetry: (error: any) => {
            // Retry transient failures only; 4xx means the request is wrong.
            if (error.message && error.message.includes('HTTP 4')) return false;
            return true;
          },
        }
      );

      return response.json() as Promise<T>;
    });
  }

  /** The athlete record for the key owner. */
  async getAthlete(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/athlete/${this.athleteId}`);
  }

  /**
   * List activities in a date window, newest first.
   *
   * `oldest`/`newest` are yyyy-MM-dd. The endpoint returns the whole window in
   * one response rather than paging, so a first sync over many years should be
   * chunked by the caller.
   */
  async getActivities(params: { oldest?: string; newest?: string } = {}): Promise<Record<string, unknown>[]> {
    const query = new URLSearchParams();
    if (params.oldest) query.set('oldest', params.oldest);
    if (params.newest) query.set('newest', params.newest);

    const suffix = query.toString() ? `?${query}` : '';
    return this.request<Record<string, unknown>[]>(`/athlete/${this.athleteId}/activities${suffix}`);
  }

  /** Full detail for a single activity. */
  async getActivity(activityId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/activity/${activityId}`);
  }

  /**
   * Streams (per-sample series) for an activity.
   *
   * The route map needs `latlng`. Unlike Strava, intervals.icu is not known to
   * return a ready-made encoded polyline on the activity summary, so route
   * geometry is rebuilt from this series — see intervals-provider.
   */
  async getStreams(activityId: string, types: string[] = ['latlng']): Promise<Record<string, unknown>> {
    const query = new URLSearchParams({ types: types.join(',') });
    return this.request<Record<string, unknown>>(`/activity/${activityId}/streams?${query}`);
  }

  /**
   * Every stream for an activity, with no type filter.
   *
   * Asking for a single type can return a narrower payload than expected — a
   * 'latlng' request came back holding latitudes with no longitudes anywhere —
   * so the unfiltered response is the ground truth about what exists.
   */
  async getAllStreams(activityId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/activity/${activityId}/streams`);
  }
}
