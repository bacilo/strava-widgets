/**
 * Geocoding module with coordinate rounding and caching
 *
 * Wraps offline-geocode-city for offline reverse geocoding.
 * Uses coordinate rounding for cache efficiency (4 decimals ≈ 11m precision).
 */

import { getNearestCity } from 'offline-geocode-city';
import type { StravaActivity } from '../types/strava.types.js';

/**
 * Geographic location result
 */
export interface GeoLocation {
  cityName: string;
  countryName: string;
  countryIso2: string;
}

/**
 * Cache of coordinate lookups
 * Key format: "lat,lng" with 4 decimal places
 */
export interface GeoCache {
  [coordKey: string]: GeoLocation;
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
 * @returns GeoLocation or null if no GPS data or geocoding failed
 */
export function geocodeActivity(
  activity: StravaActivity,
  cache: GeoCache
): GeoLocation | null {
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
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // Perform offline geocoding
  const result = getNearestCity(lat, lng);

  // Guard: Invalid result
  if (!result || !result.cityName || !result.countryName) {
    return null;
  }

  // Store in cache and return
  const location: GeoLocation = {
    cityName: result.cityName,
    countryName: result.countryName,
    countryIso2: result.countryIso2,
  };

  cache[cacheKey] = location;
  return location;
}
