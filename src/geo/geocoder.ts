/**
 * Geocoding module with coordinate rounding and caching
 *
 * Wraps offline-geocoder (GeoNames cities1000) for offline reverse geocoding.
 * Uses coordinate rounding for cache efficiency (4 decimals ≈ 11m precision).
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const geocoder = require('offline-geocoder');

import type { StravaActivity } from '../types/strava.types.js';

// Initialize geocoder with GeoNames cities1000 dataset
const geo = geocoder();

/**
 * Geographic location result
 */
export interface GeoLocation {
  cityName: string;
  countryName: string;
  countryIso2: string;
}

/**
 * Versioned cache of coordinate lookups
 */
export interface GeoCache {
  version: number;
  geocoder: string;
  entries: { [coordKey: string]: GeoLocation; };
}

/**
 * Round coordinate to specified decimal places
 * Default 4 decimals ≈ 11m precision (sufficient for city-level)
 */
export function roundCoord(coord: number, decimals: number = 4): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(coord * multiplier) / multiplier;
}

/**
 * Convert lat/lng to cache key using rounded coordinates
 */
export function coordToCacheKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Geocode activity start location using offline library with caching
 *
 * @param activity - Strava activity with start_latlng
 * @param cache - In-memory cache (mutated if new lookup performed)
 * @returns Promise resolving to GeoLocation or null if no GPS data or geocoding failed
 */
export async function geocodeActivity(
  activity: StravaActivity,
  cache: GeoCache
): Promise<GeoLocation | null> {
  // Guard: Missing or invalid GPS data
  if (!activity.start_latlng || activity.start_latlng.length !== 2) {
    return null;
  }

  const [lat, lng] = activity.start_latlng;

  // Guard: Validate coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  // Check cache
  const cacheKey = coordToCacheKey(lat, lng);
  if (cache.entries[cacheKey]) {
    return cache.entries[cacheKey];
  }

  // Perform offline geocoding with GeoNames
  try {
    const result = await geo.reverse(lat, lng);

    // Guard: No result (ocean coordinates, etc.)
    if (!result || !result.name || !result.country || !result.country.id || !result.country.name) {
      return null;
    }

    // Store in cache and return
    const location: GeoLocation = {
      cityName: result.name,
      countryName: result.country.name,
      countryIso2: result.country.id,
    };

    cache.entries[cacheKey] = location;
    return location;
  } catch (error) {
    // Geocoding failed (e.g., ocean coordinates, database error)
    return null;
  }
}
