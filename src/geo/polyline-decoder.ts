/**
 * Polyline decoding and route sampling for multi-city detection
 *
 * Decodes Strava's summary_polyline format using @mapbox/polyline library
 * and provides route point sampling for geocoding multiple cities per run.
 */

import polyline from '@mapbox/polyline';
import type { StravaActivity } from '../types/strava.types.js';

/**
 * Decoded route with coordinates and bounds
 */
export interface DecodedRoute {
  activityId: number;
  coordinates: [number, number][]; // [[lat, lng], ...]
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  pointCount: number;
}

/**
 * Decode activity polyline into coordinate array with bounds
 *
 * @param activity - Strava activity with map.summary_polyline
 * @returns DecodedRoute or null if no polyline data
 */
export function decodeActivityPolyline(activity: StravaActivity): DecodedRoute | null {
  // Guard: Missing polyline data
  if (!activity.map?.summary_polyline) {
    return null;
  }

  // Decode polyline (returns [[lat, lng], [lat, lng], ...])
  const coordinates = polyline.decode(activity.map.summary_polyline);

  // Guard: Empty coordinates
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  // Calculate bounds from min/max lat/lng
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const [lat, lng] of coordinates) {
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  }

  return {
    activityId: activity.id,
    coordinates,
    bounds: { north, south, east, west },
    pointCount: coordinates.length,
  };
}

/**
 * Sample route points for multi-city detection
 *
 * Always includes first and last point. For longer routes, samples
 * ~10 intermediate points evenly distributed along the route.
 *
 * @param coordinates - Array of [lat, lng] coordinate pairs
 * @returns Sampled subset of coordinates for geocoding
 */
export function sampleRoutePoints(coordinates: [number, number][]): [number, number][] {
  if (coordinates.length === 0) {
    return [];
  }

  // Always include first and last point
  if (coordinates.length <= 5) {
    return coordinates;
  }

  const sampled: [number, number][] = [];

  // Add first point
  sampled.push(coordinates[0]);

  // Sample every Nth point to get ~10 total samples
  const step = Math.floor(coordinates.length / 10);

  for (let i = step; i < coordinates.length - 1; i += step) {
    sampled.push(coordinates[i]);
  }

  // Add last point (deduplicate if already sampled)
  const lastPoint = coordinates[coordinates.length - 1];
  const lastSampled = sampled[sampled.length - 1];

  if (lastPoint[0] !== lastSampled[0] || lastPoint[1] !== lastSampled[1]) {
    sampled.push(lastPoint);
  }

  return sampled;
}
