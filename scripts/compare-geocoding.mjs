#!/usr/bin/env node

/**
 * Geocoding Comparison Script
 *
 * Compares old (UN/LOCODE) vs new (GeoNames) geocoding results to verify accuracy improvement.
 * Reads from data/geo/v1/ (old) and data/geo/ (new) directories.
 */

import fs from 'fs/promises';
import path from 'path';

async function compareGeocoding() {
  try {
    // Check if v1 data exists
    try {
      await fs.access('data/geo/v1');
    } catch {
      console.log('⚠️  Warning: data/geo/v1/ directory not found. Old geocoding data not available for comparison.');
      return;
    }

    // Load old data (v1)
    const oldCities = JSON.parse(await fs.readFile('data/geo/v1/cities.json', 'utf-8'));
    const oldCountries = JSON.parse(await fs.readFile('data/geo/v1/countries.json', 'utf-8'));
    const oldCacheRaw = await fs.readFile('data/geo/v1/location-cache.json', 'utf-8');
    const oldCache = JSON.parse(oldCacheRaw);

    // Load new data (current)
    const newCities = JSON.parse(await fs.readFile('data/geo/cities.json', 'utf-8'));
    const newCountries = JSON.parse(await fs.readFile('data/geo/countries.json', 'utf-8'));
    const newCacheRaw = await fs.readFile('data/geo/location-cache.json', 'utf-8');
    const newCache = JSON.parse(newCacheRaw);

    // Extract cache entries (handle versioned vs flat format)
    const oldCacheEntries = oldCache.entries || oldCache;
    const newCacheEntries = newCache.entries || newCache;

    console.log('=== Geocoding Comparison: UN/LOCODE vs GeoNames ===\n');

    // Summary
    console.log('SUMMARY:');
    console.log(`  Old: ${oldCities.length} cities in ${oldCountries.length} countries`);
    console.log(`  New: ${newCities.length} cities in ${newCountries.length} countries`);
    console.log(`  Cache entries: old ${Object.keys(oldCacheEntries).length}, new ${Object.keys(newCacheEntries).length}`);
    console.log();

    // Compare city names at same coordinates
    console.log('CITY NAME CHANGES (same coordinate, different city):');
    const cityChanges = [];

    for (const [coordKey, oldLocation] of Object.entries(oldCacheEntries)) {
      if (newCacheEntries[coordKey]) {
        const newLocation = newCacheEntries[coordKey];
        if (oldLocation.cityName !== newLocation.cityName) {
          cityChanges.push({
            coord: coordKey,
            old: oldLocation.cityName,
            new: newLocation.cityName,
          });
        }
      }
    }

    if (cityChanges.length > 0) {
      // Show first 20 changes
      cityChanges.slice(0, 20).forEach(change => {
        console.log(`  ${change.coord}: ${change.old} → ${change.new}`);
      });
      if (cityChanges.length > 20) {
        console.log(`  ... and ${cityChanges.length - 20} more changes`);
      }
      console.log();
      console.log(`Total city name changes: ${cityChanges.length}`);
    } else {
      console.log('  (No city name changes found)');
    }
    console.log();

    // New cities
    const oldCityNames = new Set(oldCities.map(c => c.cityName));
    const newCityNames = new Set(newCities.map(c => c.cityName));

    const addedCities = [...newCityNames].filter(name => !oldCityNames.has(name));
    const removedCities = [...oldCityNames].filter(name => !newCityNames.has(name));

    console.log('NEW CITIES (in new but not old):');
    if (addedCities.length > 0) {
      addedCities.slice(0, 20).forEach(city => {
        const cityData = newCities.find(c => c.cityName === city);
        console.log(`  ${city} (${cityData.countryIso2}) - ${cityData.activityCount} activities`);
      });
      if (addedCities.length > 20) {
        console.log(`  ... and ${addedCities.length - 20} more`);
      }
    } else {
      console.log('  (None)');
    }
    console.log();

    console.log('REMOVED CITIES (in old but not new):');
    if (removedCities.length > 0) {
      removedCities.slice(0, 20).forEach(city => {
        const cityData = oldCities.find(c => c.cityName === city);
        console.log(`  ${city} (${cityData.countryIso2}) - ${cityData.activityCount} activities`);
      });
      if (removedCities.length > 20) {
        console.log(`  ... and ${removedCities.length - 20} more`);
      }
    } else {
      console.log('  (None)');
    }
    console.log();

    // Country changes
    const oldCountryCodes = new Set(oldCountries.map(c => c.countryIso2));
    const newCountryCodes = new Set(newCountries.map(c => c.countryIso2));

    const addedCountries = [...newCountryCodes].filter(code => !oldCountryCodes.has(code));
    const removedCountries = [...oldCountryCodes].filter(code => !newCountryCodes.has(code));

    console.log('COUNTRY CHANGES:');
    if (addedCountries.length > 0 || removedCountries.length > 0) {
      if (addedCountries.length > 0) {
        console.log('  Added:');
        addedCountries.forEach(code => {
          const country = newCountries.find(c => c.countryIso2 === code);
          console.log(`    ${country.countryName} (${code})`);
        });
      }
      if (removedCountries.length > 0) {
        console.log('  Removed:');
        removedCountries.forEach(code => {
          const country = oldCountries.find(c => c.countryIso2 === code);
          console.log(`    ${country.countryName} (${code})`);
        });
      }
    } else {
      console.log('  (No country changes)');
    }
    console.log();

    // Cache coordinate coverage
    const oldCoords = new Set(Object.keys(oldCacheEntries));
    const newCoords = new Set(Object.keys(newCacheEntries));
    const addedCoords = [...newCoords].filter(coord => !oldCoords.has(coord));
    const removedCoords = [...oldCoords].filter(coord => !newCoords.has(coord));

    console.log('CACHE COVERAGE:');
    console.log(`  Coordinates in both: ${[...oldCoords].filter(c => newCoords.has(c)).length}`);
    console.log(`  New coordinates: ${addedCoords.length}`);
    console.log(`  Removed coordinates: ${removedCoords.length}`);
    console.log();

  } catch (error) {
    console.error('Error comparing geocoding data:', error.message);
    process.exit(1);
  }
}

compareGeocoding();
