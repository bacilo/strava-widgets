/**
 * Lazy per-activity detail fetching. No detail file is fetched until a
 * specific activity is actually opened (D-10), and the only exported entry
 * point (`loadDetail`) validates its `id` argument before constructing any
 * URL — the single place in the dashboard that turns a route param into a
 * fetch URL (T-16-DC-01).
 */

import { isValidActivityId } from '../router.js';
import type { StravaActivity } from '../../types/strava.types.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import type { FetchLike } from './index-client.js';

export class InvalidActivityIdError extends Error {
  readonly activityId: string;

  constructor(activityId: string) {
    super(`Invalid activity id: ${activityId}`);
    this.name = 'InvalidActivityIdError';
    this.activityId = activityId;
    // Preserve `instanceof` across the ES2022 -> downlevel compile path.
    Object.setPrototypeOf(this, InvalidActivityIdError.prototype);
  }
}

export interface ActivityDetail {
  id: string;
  activity: StravaActivity;
  stream: CanonicalStream | null;
}

export interface DetailClientOptions {
  /** Defaults to `'data/'`, matching the index client's convention. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface DetailClient {
  loadDetail(id: string): Promise<ActivityDetail>;
  /** Test-support only: empties the per-id cache. */
  clear(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createDetailClient(options: DetailClientOptions = {}): DetailClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const inFlight = new Map<string, Promise<ActivityDetail>>();

  async function fetchJson<T>(url: string, doFetch: FetchLike): Promise<T> {
    const response = await doFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async function fetchDetail(id: string): Promise<ActivityDetail> {
    const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

    // Sequential, not Promise.all: a missing/broken activity should not
    // leave an orphaned ~76KB stream request in flight, and the stream is
    // only meaningful in the context of a valid activity.
    const activity = await fetchJson<StravaActivity>(`${baseUrl}activities/${id}.json`, doFetch);

    let stream: CanonicalStream | null;
    const streamResponse = await doFetch(`${baseUrl}streams/${id}.json`);
    if (streamResponse.ok) {
      stream = (await streamResponse.json()) as CanonicalStream;
    } else {
      // A missing stream is a legitimate degraded state (manual/treadmill
      // entries, STREAM-03), not an error — do not reject the whole load.
      console.info(`No stream file for activity ${id} (${streamResponse.status} ${streamResponse.statusText})`);
      stream = null;
    }

    return { id, activity, stream };
  }

  function loadDetail(id: string): Promise<ActivityDetail> {
    if (!isValidActivityId(id)) {
      return Promise.reject(new InvalidActivityIdError(id));
    }

    const existing = inFlight.get(id);
    if (existing) {
      return existing;
    }

    const promise = fetchDetail(id).catch((error: unknown) => {
      // Evict on rejection so a subsequent loadDetail (Retry) issues a
      // genuine new request instead of replaying a cached failure.
      inFlight.delete(id);
      throw error;
    });

    inFlight.set(id, promise);
    return promise;
  }

  function clear(): void {
    inFlight.clear();
  }

  return { loadDetail, clear };
}
