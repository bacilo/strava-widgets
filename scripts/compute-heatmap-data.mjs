/**
 * Pre-compute heatmap data from route polylines
 * Decodes all polylines at build time for instant client-side rendering
 * Stores per-route points with date metadata to enable client-side date filtering
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import polyline from '@mapbox/polyline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = join(__dirname, '../data/routes/route-list.json');
const OUTPUT_DIR = join(__dirname, '../data/heatmap');
const OUTPUT_FILE = join(OUTPUT_DIR, 'all-points.json');

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }
}

function readRoutes() {
  console.log(`Reading routes from ${ROUTES_FILE}...`);
  const content = readFileSync(ROUTES_FILE, 'utf8');
  return JSON.parse(content);
}

function decodeRoutesToHeatmapData(routes) {
  const heatmapRoutes = [];
  let totalPoints = 0;
  let processedRoutes = 0;
  let skippedRoutes = 0;

  for (const route of routes) {
    // Skip routes without polylines
    if (!route.polyline) {
      skippedRoutes++;
      continue;
    }

    try {
      // Decode polyline to [[lat, lng], ...] array
      const points = polyline.decode(route.polyline);

      // Store route data with id, date, and decoded points
      // This format enables client-side date filtering without re-decoding
      heatmapRoutes.push({
        id: route.id,
        date: route.date,
        points: points
      });

      totalPoints += points.length;
      processedRoutes++;
    } catch (error) {
      console.warn(`Warning: Failed to decode polyline for route ${route.id}:`, error.message);
      skippedRoutes++;
    }
  }

  return { heatmapRoutes, totalPoints, processedRoutes, skippedRoutes };
}

function writeHeatmapData(heatmapRoutes) {
  console.log(`Writing heatmap data to ${OUTPUT_FILE}...`);
  writeFileSync(OUTPUT_FILE, JSON.stringify(heatmapRoutes), 'utf8');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
  console.log('Computing heatmap data from routes...\n');

  // Ensure output directory exists
  ensureOutputDir();

  // Read route data
  const routes = readRoutes();
  console.log(`Found ${routes.length} routes`);

  // Decode polylines
  console.log('Decoding polylines...');
  const { heatmapRoutes, totalPoints, processedRoutes, skippedRoutes } = decodeRoutesToHeatmapData(routes);

  // Write output
  writeHeatmapData(heatmapRoutes);

  // Calculate file size
  const fileStats = readFileSync(OUTPUT_FILE, 'utf8');
  const fileSize = Buffer.byteLength(fileStats, 'utf8');

  // Summary
  console.log('\n✓ Heatmap data computation complete!');
  console.log(`  Routes processed: ${processedRoutes}`);
  console.log(`  Routes skipped: ${skippedRoutes}`);
  console.log(`  Total points: ${totalPoints.toLocaleString()}`);
  console.log(`  Output file: ${OUTPUT_FILE}`);
  console.log(`  File size: ${formatBytes(fileSize)}`);
  console.log(`  Average points per route: ${Math.round(totalPoints / processedRoutes)}`);
}

main();
