/**
 * Fetch-once, memoized browser client for the committed athlete config
 * (`data/config/athlete.json`), routed through `parseAthleteConfig` — the
 * single validation chokepoint the zone computation itself trusts
 * (`detail-zones.ts`). Do NOT add a second validation path here.
 *
 * Structured identically to `gear-client.ts`: fetch-once/memoize shape
 * copied from `index-client.ts`, but `load()` never rejects — per D-31, a
 * missing or malformed config file is a legitimate degraded state, and the
 * HR-zone panel is simply omitted.
 */

import type { FetchLike } from './index-client.js';
import type { AthleteConfig } from '../views/detail-zones.js';
import { parseAthleteConfig } from '../views/detail-zones.js';

export type { AthleteConfig };

export interface AthleteConfigClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface AthleteConfigClient {
  load(): Promise<AthleteConfig | null>;
  /** Test-support only: clears the cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createAthleteConfigClient(
  options: AthleteConfigClientOptions = {}
): AthleteConfigClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const url = `${baseUrl}config/athlete.json`;

  let inFlight: Promise<AthleteConfig | null> | null = null;

  async function fetchAthleteConfig(): Promise<AthleteConfig | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parseAthleteConfig(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(): Promise<AthleteConfig | null> {
    if (inFlight) {
      return inFlight;
    }

    inFlight = fetchAthleteConfig().then((result) => {
      // A null result (404, malformed body, or a body that parses but
      // fails parseAthleteConfig) must not be memoized: the next load()
      // has to issue a genuine new fetch. Only a validated config is
      // cached for the rest of the page session.
      if (result === null) {
        inFlight = null;
      }
      return result;
    });

    return inFlight;
  }

  function reset(): void {
    inFlight = null;
  }

  return { load, reset };
}
