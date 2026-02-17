/**
 * Pre-compute route data from activity JSON files
 * Extracts polylines and metadata for route map widgets
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_DIR = join(__dirname, '../data/activities');
const OUTPUT_DIR = join(__dirname, '../data/routes');
const LATEST_RUNS_COUNT = 20;

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }
}

function readActivities() {
  const files = readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'));
  const activities = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(ACTIVITIES_DIR, file), 'utf8');
      const activity = JSON.parse(content);
      activities.push(activity);
    } catch (error) {
      console.warn(`Warning: Failed to read ${file}:`, error.message);
    }
  }

  return activities;
}

function extractRouteData(activities) {
  const routes = [];

  for (const activity of activities) {
    // Skip activities without polylines (treadmill/manual entries)
    if (!activity.map?.summary_polyline) {
      continue;
    }

    // Extract start coordinates
    const [startLat, startLng] = activity.start_latlng || [null, null];

    // Skip if no start coordinates
    if (startLat === null || startLng === null) {
      continue;
    }

    routes.push({
      id: activity.id,
      name: activity.name,
      date: activity.start_date_local,
      distance: activity.distance,
      movingTime: activity.moving_time,
      polyline: activity.map.summary_polyline,
      startLat,
      startLng
    });
  }

  // Sort by date descending (newest first)
  routes.sort((a, b) => new Date(b.date) - new Date(a.date));

  return routes;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function writeRouteFiles(routes) {
  // Write full route list
  const routeListPath = join(OUTPUT_DIR, 'route-list.json');
  writeFileSync(routeListPath, JSON.stringify(routes, null, 2), 'utf8');
  const routeListSize = statSync(routeListPath).size;

  // Write latest runs (top 20)
  const latestRuns = routes.slice(0, LATEST_RUNS_COUNT);
  const latestRunsPath = join(OUTPUT_DIR, 'latest-runs.json');
  writeFileSync(latestRunsPath, JSON.stringify(latestRuns, null, 2), 'utf8');
  const latestRunsSize = statSync(latestRunsPath).size;

  return { routeListSize, latestRunsSize };
}

function main() {
  console.log('Computing route data from activities...\n');

  // Ensure output directory exists
  ensureOutputDir();

  // Read all activity files
  console.log(`Reading activities from ${ACTIVITIES_DIR}...`);
  const activities = readActivities();
  console.log(`Found ${activities.length} total activities`);

  // Extract route data
  const routes = extractRouteData(activities);
  console.log(`Extracted ${routes.length} activities with polylines`);
  console.log(`Filtered out ${activities.length - routes.length} activities without polylines\n`);

  // Write output files
  console.log('Writing route data files...');
  const { routeListSize, latestRunsSize } = writeRouteFiles(routes);

  console.log(`\n✓ route-list.json: ${routes.length} routes (${formatBytes(routeListSize)})`);
  console.log(`✓ latest-runs.json: ${Math.min(routes.length, LATEST_RUNS_COUNT)} routes (${formatBytes(latestRunsSize)})`);
  console.log('\nRoute data computation complete!');
}

main();
