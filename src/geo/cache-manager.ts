/**
 * File-based cache persistence for geocoding results
 *
 * Loads and saves location cache to disk for fast subsequent builds.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GeoCache } from './geocoder.js';

const CURRENT_VERSION = 2;
const CURRENT_GEOCODER = 'geonames-cities1000';

/**
 * Create empty cache with current version
 */
export function createEmptyCache(): GeoCache {
  return {
    version: CURRENT_VERSION,
    geocoder: CURRENT_GEOCODER,
    entries: {},
  };
}

/**
 * Load geocoding cache from JSON file
 *
 * @param cachePath - Path to cache file (e.g., data/geo/location-cache.json)
 * @returns Parsed cache object or empty cache if file not found or version mismatch
 */
export async function loadCache(cachePath: string): Promise<GeoCache> {
  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    const data = JSON.parse(content);

    // Check for version and geocoder match
    if (data.version === CURRENT_VERSION && data.geocoder === CURRENT_GEOCODER) {
      return data as GeoCache;
    }

    // Version mismatch - start fresh
    console.log(`Cache version mismatch (expected v${CURRENT_VERSION} ${CURRENT_GEOCODER}), starting fresh`);
    return createEmptyCache();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('Cache not found, starting fresh');
      return createEmptyCache();
    }
    // Rethrow other errors (permissions, invalid JSON, etc.)
    throw error;
  }
}

/**
 * Save geocoding cache to JSON file with git-friendly formatting
 *
 * @param cachePath - Path to cache file
 * @param cache - Cache object to persist
 */
export async function saveCache(
  cachePath: string,
  cache: GeoCache
): Promise<void> {
  // Ensure parent directory exists
  const dir = path.dirname(cachePath);
  await fs.mkdir(dir, { recursive: true });

  // Write with pretty formatting for git diffs
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

  console.log(`Cache saved: ${Object.keys(cache.entries).length} locations`);
}
