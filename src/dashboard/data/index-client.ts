/**
 * Fetch-once, memoized access to the published dashboard index manifest
 * (`data/dashboard/index.json`). The manifest is ~300-500KB, so it MUST be
 * fetched at most once per page session no matter how many views (overview,
 * list, calendar, ...) ask for it during bootstrap — RESEARCH.md names
 * per-route re-fetching as this phase's anti-pattern (T-16-DC-02).
 */

import type {
  DashboardIndexDocument,
  DashboardIndexRow,
} from '../../analytics/dashboard-index.types.js';
import { DASHBOARD_INDEX_SCHEMA_VERSION } from '../../analytics/dashboard-index.types.js';

/**
 * Minimal fetch shape so tests can supply a fake without constructing real
 * `Response` objects. Matches the subset of the global `fetch` signature
 * this client actually uses.
 */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

export interface IndexClientOptions {
  /** Defaults to `'data/'`, relative to the published site root (matches how every widget addresses `data/stats/...`). */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call so importing this module never touches a global. */
  fetchImpl?: FetchLike;
}

export interface IndexClient {
  loadIndex(): Promise<DashboardIndexDocument>;
  getRows(): DashboardIndexRow[];
  getRow(id: string): DashboardIndexRow | undefined;
  /** Test-support only: clears the cache so the next `loadIndex()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createIndexClient(options: IndexClientOptions = {}): IndexClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const url = `${baseUrl}dashboard/index.json`;

  let inFlight: Promise<DashboardIndexDocument> | null = null;
  let byId: Map<string, DashboardIndexRow> | null = null;
  let document_: DashboardIndexDocument | null = null;

  async function fetchDocument(): Promise<DashboardIndexDocument> {
    const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    const response = await doFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    const doc = (await response.json()) as DashboardIndexDocument;

    if (doc.schemaVersion !== DASHBOARD_INDEX_SCHEMA_VERSION) {
      console.warn(
        `Dashboard index schema mismatch: expected ${DASHBOARD_INDEX_SCHEMA_VERSION}, got ${doc.schemaVersion}`
      );
    }

    return doc;
  }

  function loadIndex(): Promise<DashboardIndexDocument> {
    if (inFlight) {
      return inFlight;
    }

    inFlight = fetchDocument()
      .then((doc) => {
        document_ = doc;
        byId = new Map(doc.activities.map((row) => [row.id, row]));
        return doc;
      })
      .catch((error: unknown) => {
        // Do not memoize a failed load — a transient failure must not
        // permanently poison the client; the next loadIndex() retries.
        inFlight = null;
        throw error;
      });

    return inFlight;
  }

  function getRows(): DashboardIndexRow[] {
    return document_?.activities ?? [];
  }

  function getRow(id: string): DashboardIndexRow | undefined {
    return byId?.get(id);
  }

  function reset(): void {
    inFlight = null;
    byId = null;
    document_ = null;
  }

  return { loadIndex, getRows, getRow, reset };
}
