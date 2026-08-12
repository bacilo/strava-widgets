/**
 * Fetch-once, memoized browser client for the published age-grading
 * document (`data/stats/age-grading.json`, REC-06/D-09/D-10/D-20/D-13).
 *
 * Follows `gear-client.ts`'s fetch-once/memoize shape exactly: per D-13, a
 * missing or malformed document is a legitimate degraded state, not an
 * error — `load()` resolves to `null` rather than rejecting, and a `null`
 * result is deliberately NOT memoized so the next `load()` issues a genuine
 * new fetch rather than replaying a cached failure. An `enabled: false`
 * document (the athlete-config-unfilled default state, D-13) is a VALID
 * parse result — the detail view still needs its `disabledReason` and its
 * (empty) `activities` map to render every age-grade cell as an honest
 * em-dash rather than a fabricated value.
 */

import type { FetchLike } from './index-client.js';
import type { AgeGradingDocument } from '../../analytics/age-grading.types.js';

/** Own-property read only — no prototype key is ever reachable through the parsed document. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Total, error-free parse of the published `data/stats/age-grading.json`
 * body (T-18-PROTO-05). Requires a non-array object with a numeric
 * `schemaVersion`, a boolean `enabled`, and non-array-object `rankings` and
 * `activities` — every other field (`generatedAt`, `note`, `disabledReason`,
 * `editions`) is passed through as-is rather than re-validated field by
 * field, since only `rankings`/`activities`/`enabled` are ever read by a
 * downstream derivation. Returns null on any structural failure, including
 * a `__proto__`-keyed top-level input (rejected by the plain-object check).
 */
export function parseAgeGradingDocument(raw: unknown): AgeGradingDocument | null {
  if (!isPlainObject(raw)) return null;

  if (!hasOwn(raw, 'schemaVersion') || typeof raw.schemaVersion !== 'number') return null;
  if (!hasOwn(raw, 'enabled') || typeof raw.enabled !== 'boolean') return null;
  if (!hasOwn(raw, 'rankings') || !isPlainObject(raw.rankings)) return null;
  if (!hasOwn(raw, 'activities') || !isPlainObject(raw.activities)) return null;

  return raw as unknown as AgeGradingDocument;
}

export interface AgeGradingClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface AgeGradingClient {
  load(): Promise<AgeGradingDocument | null>;
  /** Test-support only: clears the cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createAgeGradingClient(options: AgeGradingClientOptions = {}): AgeGradingClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const url = `${baseUrl}stats/age-grading.json`;

  let inFlight: Promise<AgeGradingDocument | null> | null = null;

  async function fetchAgeGrading(): Promise<AgeGradingDocument | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parseAgeGradingDocument(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(): Promise<AgeGradingDocument | null> {
    if (inFlight) {
      return inFlight;
    }

    inFlight = fetchAgeGrading().then((result) => {
      // fetchAgeGrading always resolves rather than rejecting (it degrades to null internally), but a
      // null result — 404, malformed body, wrong shape — must not be
      // memoized: the next load() has to issue a genuine new fetch rather
      // than replaying the cached failure. Only a successful document is
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
