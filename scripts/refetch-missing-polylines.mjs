#!/usr/bin/env node

/**
 * Re-fetch activities with missing GPS polylines from Strava's detail endpoint.
 *
 * The list endpoint (/athlete/activities) returns resource_state: 2 which sometimes
 * omits summary_polyline. The detail endpoint (/activities/{id}) returns resource_state: 3
 * with full GPS data.
 *
 * Usage: node scripts/refetch-missing-polylines.mjs [--dry-run]
 *
 * Requires .env with STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and valid data/tokens.json
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ACTIVITIES_DIR = './data/activities';
const TOKENS_PATH = './data/tokens.json';
const DRY_RUN = process.argv.includes('--dry-run');
const API_BASE = 'https://www.strava.com/api/v3';

// Rate limiting: Strava allows 100 requests per 15 minutes, 1000 per day
const DELAY_MS = 1500; // 1.5s between requests (safe margin)

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAccessToken() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env');
  }

  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));

  // Check if token needs refresh
  const now = Date.now() / 1000;
  if (tokens.expires_at > now + 3600) {
    return tokens.access_token;
  }

  console.log('Refreshing access token...');
  const res = await fetch(`${API_BASE.replace('/api/v3', '')}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}\nRun 'npm run auth' to re-authenticate.`);
  }

  const newTokens = await res.json();
  // Save rotated tokens
  fs.writeFileSync(TOKENS_PATH, JSON.stringify({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: newTokens.expires_at,
  }, null, 2));

  return newTokens.access_token;
}

async function fetchActivityDetail(accessToken, activityId) {
  const res = await fetch(`${API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Log rate limit
  const usage = res.headers.get('X-ReadRateLimit-Usage');
  const limit = res.headers.get('X-ReadRateLimit-Limit');
  if (usage && limit) {
    const [short] = usage.split(',');
    const [shortLimit] = limit.split(',');
    process.stdout.write(` [rate: ${short}/${shortLimit}]`);
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '900', 10);
    console.log(`\n\nRate limited! Waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return fetchActivityDetail(accessToken, activityId);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch activity ${activityId} (${res.status}): ${err}`);
  }

  return res.json();
}

async function main() {
  console.log('Scanning activity files for missing polylines...\n');

  const files = fs.readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'));
  const missing = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, file), 'utf-8'));
    if (!data.map?.summary_polyline) {
      missing.push({
        id: data.id,
        file,
        date: data.start_date,
        name: data.name,
        distance: data.distance,
      });
    }
  }

  console.log(`Found ${missing.length} activities with missing polylines out of ${files.length} total\n`);

  if (missing.length === 0) {
    console.log('Nothing to re-fetch!');
    return;
  }

  // Sort by date for readable output
  missing.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Show date distribution
  const byMonth = {};
  for (const m of missing) {
    const month = m.date?.slice(0, 7) || 'unknown';
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
  console.log('Missing polylines by month:');
  for (const [month, count] of Object.entries(byMonth)) {
    console.log(`  ${month}: ${count}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN — no API calls made. Remove --dry-run to fetch.');
    return;
  }

  // Get access token
  const accessToken = await getAccessToken();

  let fetched = 0;
  let updated = 0;
  let stillEmpty = 0;

  for (const activity of missing) {
    process.stdout.write(`[${fetched + 1}/${missing.length}] Fetching ${activity.id} (${activity.date?.slice(0, 10)})...`);

    try {
      const detail = await fetchActivityDetail(accessToken, activity.id);

      // Check both summary_polyline and full polyline (some activities only have the full version)
      const polyline = detail.map?.summary_polyline || detail.map?.polyline;
      if (polyline) {
        // Merge detail data into existing file
        const filePath = path.join(ACTIVITIES_DIR, activity.file);
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Update map data — copy full polyline to summary_polyline if missing
        existing.map = detail.map;
        if (!existing.map.summary_polyline && detail.map?.polyline) {
          existing.map.summary_polyline = detail.map.polyline;
        }
        existing.start_latlng = detail.start_latlng;
        existing.end_latlng = detail.end_latlng;

        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
        console.log(` ✓ polyline recovered (${polyline.length} chars)`);
        updated++;
      } else {
        console.log(' ✗ still empty (no GPS data on Strava)');
        stillEmpty++;
      }
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }

    fetched++;
    await sleep(DELAY_MS);
  }

  console.log(`\n--- Results ---`);
  console.log(`Total re-fetched: ${fetched}`);
  console.log(`Polylines recovered: ${updated}`);
  console.log(`Still empty (no GPS): ${stillEmpty}`);

  if (updated > 0) {
    console.log(`\nNext steps:`);
    console.log(`  1. npm run compute-all-stats    # Recompute stats`);
    console.log(`  2. npm run build-widgets         # Rebuild widgets with new route data`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
