/**
 * Geographic statistics computation
 *
 * Reads activity JSON files, geocodes GPS coordinates using offline library,
 * and writes countries.json, cities.json, geo-metadata.json, and location-cache.json.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { StravaActivity } from '../types/strava.types.js';
import { geocodeActivity, geocodeCoordinate, type GeoCache } from './geocoder.js';
import { loadCache, saveCache } from './cache-manager.js';
import { decodeActivityPolyline, sampleRoutePoints } from './polyline-decoder.js';

interface ComputeGeoStatsOptions {
  activitiesDir?: string;
  geoDir?: string;
}

interface CountryStats {
  countryName: string;
  countryIso2: string;
  activityCount: number;
  totalDistanceKm: number;
  cities: string[];
}

interface CityStats {
  cityName: string;
  countryName: string;
  countryIso2: string;
  activityCount: number;
  totalDistanceKm: number;
}

interface GeoMetadata {
  generatedAt: string;
  totalActivities: number;
  geocodedActivities: number;
  coveragePercent: number;
  cacheSize: number;
  totalDistanceKm: number;
  geocoderVersion: string;
}

/**
 * Compute geographic statistics from activity files
 *
 * @param options - Configuration options for directories
 */
export async function computeGeoStats(
  options: ComputeGeoStatsOptions = {}
): Promise<void> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const geoDir = options.geoDir || 'data/geo';

  console.log(`Reading activities from: ${activitiesDir}`);

  // Step 1: Load all activity files
  const files = await fs.readdir(activitiesDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const activities: StravaActivity[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(activitiesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const activity = JSON.parse(content) as StravaActivity;

    // Filter to only include Run activities
    if (activity.type === 'Run') {
      activities.push(activity);
    }
  }

  console.log(`Loaded ${activities.length} run activities from ${jsonFiles.length} files`);

  if (activities.length === 0) {
    console.log('No activities to process');
    return;
  }

  // Step 2: Load cache
  const cachePath = path.join(geoDir, 'location-cache.json');
  const cache: GeoCache = await loadCache(cachePath);

  // Step 3: Geocode activities
  let totalCount = 0;
  let successCount = 0;
  let totalDistanceM = 0;

  const countryMap = new Map<string, {
    countryName: string;
    activityCount: number;
    totalDistanceM: number;
    cities: Set<string>;
  }>();

  const cityMap = new Map<string, {
    cityName: string;
    countryName: string;
    countryIso2: string;
    activityCount: number;
    totalDistanceM: number;
  }>();

  // Map to track which cities each activity passes through
  const activityCitiesMap = new Map<number, string[]>();

  for (const activity of activities) {
    totalCount++;
    const location = await geocodeActivity(activity, cache);

    if (!location) {
      continue;
    }

    successCount++;
    totalDistanceM += activity.distance || 0;

    // Aggregate by country (start city only for distance stats)
    const countryKey = location.countryIso2;
    const existingCountry = countryMap.get(countryKey) || {
      countryName: location.countryName,
      activityCount: 0,
      totalDistanceM: 0,
      cities: new Set<string>(),
    };

    existingCountry.activityCount++;
    existingCountry.totalDistanceM += activity.distance || 0;
    existingCountry.cities.add(location.cityName);
    countryMap.set(countryKey, existingCountry);

    // Aggregate by city (start city only for distance stats)
    const cityKey = `${location.cityName},${location.countryIso2}`;
    const existingCity = cityMap.get(cityKey) || {
      cityName: location.cityName,
      countryName: location.countryName,
      countryIso2: location.countryIso2,
      activityCount: 0,
      totalDistanceM: 0,
    };

    existingCity.activityCount++;
    existingCity.totalDistanceM += activity.distance || 0;
    cityMap.set(cityKey, existingCity);
  }

  // Step 3.5: Multi-city detection via route polyline sampling
  console.log('\nDetecting multi-city routes...');
  let routesWithMultipleCities = 0;

  for (const activity of activities) {
    // Decode polyline
    const decoded = decodeActivityPolyline(activity);
    if (!decoded) {
      continue;
    }

    // Sample route points
    const sampledPoints = sampleRoutePoints(decoded.coordinates);

    // Geocode each sampled point
    const citiesSet = new Set<string>();
    for (const [lat, lng] of sampledPoints) {
      const location = await geocodeCoordinate(lat, lng, cache);
      if (location) {
        citiesSet.add(location.cityName);
      }
    }

    // Store cities for this activity
    const cities = Array.from(citiesSet).sort();
    if (cities.length > 0) {
      activityCitiesMap.set(activity.id, cities);
      if (cities.length > 1) {
        routesWithMultipleCities++;
      }
    }
  }

  console.log(`Found ${routesWithMultipleCities} activities passing through multiple cities`);

  // Step 4: Save updated cache
  await saveCache(cachePath, cache);

  // Step 5: Aggregate countries
  const countries: CountryStats[] = Array.from(countryMap.entries())
    .map(([countryIso2, stats]) => ({
      countryName: stats.countryName,
      countryIso2,
      activityCount: stats.activityCount,
      totalDistanceKm: Math.round((stats.totalDistanceM / 1000) * 10) / 10,
      cities: Array.from(stats.cities).sort(),
    }))
    .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

  // Step 6: Aggregate cities
  const cities: CityStats[] = Array.from(cityMap.values())
    .map((city) => ({
      cityName: city.cityName,
      countryName: city.countryName,
      countryIso2: city.countryIso2,
      activityCount: city.activityCount,
      totalDistanceKm: Math.round((city.totalDistanceM / 1000) * 10) / 10,
    }))
    .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

  // Step 7: Create output directory
  await fs.mkdir(geoDir, { recursive: true });

  // Step 8: Write output files
  await fs.writeFile(
    path.join(geoDir, 'countries.json'),
    JSON.stringify(countries, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(geoDir, 'cities.json'),
    JSON.stringify(cities, null, 2),
    'utf-8'
  );

  const coveragePercent = totalCount > 0
    ? Math.round((successCount / totalCount) * 100)
    : 0;

  const metadata: GeoMetadata = {
    generatedAt: new Date().toISOString(),
    totalActivities: totalCount,
    geocodedActivities: successCount,
    coveragePercent,
    cacheSize: Object.keys(cache.entries).length,
    totalDistanceKm: Math.round((totalDistanceM / 1000) * 10) / 10,
    geocoderVersion: 'geonames-cities1000',
  };

  await fs.writeFile(
    path.join(geoDir, 'geo-metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  // Step 8.5: Write activity-cities mapping
  const activityCitiesObject = Object.fromEntries(activityCitiesMap);
  await fs.writeFile(
    path.join(geoDir, 'activity-cities.json'),
    JSON.stringify(activityCitiesObject, null, 2),
    'utf-8'
  );

  // Step 9: Console log summary
  console.log(`\nGeocoded ${successCount} of ${totalCount} activities (${coveragePercent}%)`);
  console.log(`- ${countries.length} countries`);
  console.log(`- ${cities.length} cities`);
  console.log(`- Total distance: ${(totalDistanceM / 1000).toFixed(1)} km`);
  console.log(`- Cache size: ${Object.keys(cache.entries).length} locations`);
  console.log(`- Multi-city activities: ${routesWithMultipleCities}`);
  console.log(`\nOutput written to: ${geoDir}`);
}
