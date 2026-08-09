import 'dotenv/config';
import { StravaOAuth } from './auth/strava-oauth.js';
import { StravaClient } from './api/strava-client.js';
import { FileStore } from './storage/file-store.js';
import { SyncStateManager } from './storage/sync-state.js';
import { ActivitySync } from './sync/activity-sync.js';
import { config } from './config/strava.config.js';
import { computeAllStats } from './analytics/compute-stats.js';
import { computeAdvancedStats } from './analytics/compute-advanced-stats.js';
import * as fs from 'fs/promises';

const command = process.argv[2];

async function authCommand() {
  try {
    const oauth = new StravaOAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tokensPath: config.tokensPath,
    });

    const authCode = process.argv[3];

    if (!authCode) {
      // Print authorization URL
      const authUrl = oauth.getAuthorizationUrl('http://localhost');
      console.log('Visit this URL to authorize:');
      console.log(authUrl);
      console.log('\nAfter authorizing, copy the "code" parameter from the redirect URL and run:');
      console.log('node dist/index.js auth YOUR_CODE_HERE');
    } else {
      // Exchange code for tokens (already saves tokens internally)
      await oauth.exchangeCode(authCode);
      console.log('Tokens saved successfully. You can now run: npm run sync');
    }
  } catch (error: any) {
    console.error('Auth error:', error.message);
    if (error.message.includes('STRAVA_CLIENT_ID')) {
      console.error('\nMake sure you have created a .env file with your Strava API credentials.');
      console.error('See .env.example for the required variables.');
    }
    process.exit(1);
  }
}

async function syncCommand() {
  try {
    // Instantiate all dependencies
    const fileStore = new FileStore('.');
    const oauth = new StravaOAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tokensPath: config.tokensPath,
    });
    const client = new StravaClient({ oauth });
    const syncStateManager = new SyncStateManager(
      config.syncStatePath,
      fileStore
    );
    const activitySync = new ActivitySync({
      client,
      fileStore,
      syncStateManager,
      activitiesDir: config.activitiesDir,
    });

    // Run sync
    console.log('Starting activity sync...\n');
    const result = await activitySync.syncNewActivities();

    console.log('\n=== Sync Summary ===');
    console.log(`New runs saved: ${result.newRuns}`);
    console.log(`Total activities fetched: ${result.totalFetched}`);
    console.log(`Pages processed: ${result.pagesProcessed}`);

    process.exit(0);
  } catch (error: any) {
    console.error('Sync error:', error.message);

    if (error.message.includes('ENOENT') && error.message.includes('tokens.json')) {
      console.error('\nTokens file not found. Please run: npm run auth');
    } else if (error.message.includes('STRAVA_CLIENT_ID')) {
      console.error('\nMissing environment variables. Check your .env file.');
      console.error('See .env.example for required variables.');
    } else if (error.message.includes('Rate limit')) {
      console.error('\nRate limit exceeded. Please wait before trying again.');
    }

    process.exit(1);
  }
}

async function statusCommand() {
  try {
    const fileStore = new FileStore('.');
    const syncStateManager = new SyncStateManager(
      config.syncStatePath,
      fileStore
    );

    const state = await syncStateManager.load();

    if (state.last_sync_timestamp === 0) {
      console.log('No sync has been performed yet');
      console.log('Run: npm run sync');
      return;
    }

    console.log('=== Sync Status ===');
    console.log(`Last sync: ${state.last_sync_date}`);
    console.log(`Total activities: ${state.total_activities}`);
    console.log(`Last activity ID: ${state.last_activity_id}`);

    // Count JSON files in activities directory
    try {
      const files = await fs.readdir(config.activitiesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      console.log(`Activities on disk: ${jsonFiles.length}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.log('Activities directory: not yet created');
      }
    }
  } catch (error: any) {
    console.error('Status error:', error.message);
    process.exit(1);
  }
}

async function computeStatsCommand() {
  try {
    console.log('Computing statistics from synced activities...\n');
    await computeAllStats({
      activitiesDir: config.activitiesDir,
      statsDir: 'data/stats',
    });
    console.log('\nStatistics generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exit(1);
  }
}

async function computeAdvancedStatsCommand() {
  try {
    console.log('Computing advanced statistics from synced activities...\n');
    await computeAdvancedStats({
      activitiesDir: config.activitiesDir,
      statsDir: 'data/stats',
    });
    console.log('\nAdvanced statistics generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute advanced stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exit(1);
  }
}

async function computeGeoStatsCommand() {
  try {
    const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
    console.log('Computing geographic statistics from synced activities...\n');
    await computeGeoStats({
      activitiesDir: config.activitiesDir,
      geoDir: 'data/geo',
    });
    console.log('\nGeographic statistics generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute geo stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exit(1);
  }
}

async function computeAllStatsCommand() {
  try {
    console.log('Computing all statistics from synced activities...\n');

    // Run basic stats
    await computeAllStats({
      activitiesDir: config.activitiesDir,
      statsDir: 'data/stats',
    });

    console.log(''); // Blank line separator

    // Run advanced stats
    await computeAdvancedStats({
      activitiesDir: config.activitiesDir,
      statsDir: 'data/stats',
    });

    console.log(''); // Blank line separator

    // Run geo stats
    const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
    await computeGeoStats({
      activitiesDir: config.activitiesDir,
      geoDir: 'data/geo',
    });

    console.log('\nAll statistics generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute all stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exit(1);
  }
}

/**
 * Dry-run the intervals.icu provider against a real account.
 *
 * Writes nothing. Confirms the API key works, then diffs what the API actually
 * returns against what the mapper assumes, so the field-name guesses in
 * intervals-provider.ts can be corrected before any sync depends on them.
 */
async function probeIntervalsCommand() {
  const { IntervalsClient } = await import('./api/intervals-client.js');
  const { IntervalsProvider } = await import('./api/intervals-provider.js');

  const client = new IntervalsClient({
    apiKey: process.env.INTERVALS_API_KEY || '',
    athleteId: process.env.INTERVALS_ATHLETE_ID || '0',
  });
  const provider = new IntervalsProvider(client);

  console.log('Probing intervals.icu...\n');

  const identity = await provider.verify();
  console.log(`Authenticated as: ${identity.name ?? '(no name)'} (athlete ${identity.athleteId})\n`);

  // A short recent window keeps the probe to a couple of requests.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const raw = await provider.fetchRawActivities({ since, limit: 3 });

  if (raw.length === 0) {
    console.log('No activities in the last 90 days — nothing to inspect.');
    console.log('Connect Garmin to intervals.icu and let one activity sync, then re-run.');
    return;
  }

  // An explicit id lets you re-probe a known-outdoor activity when the most
  // recent one turns out to be a treadmill run.
  const requestedId = process.argv[3];
  const sample = requestedId
    ? await provider.fetchRaw(requestedId)
    : raw[0];

  console.log(
    requestedId
      ? `Inspecting requested activity ${requestedId}.\n`
      : `Fetched ${raw.length} recent activities. Inspecting the most recent.\n`
  );

  console.log('--- Keys actually returned ---');
  console.log(Object.keys(sample).sort().join(', '));

  console.log('\n--- Migration-relevant fields ---');
  for (const key of ['strava_id', 'source', 'external_id', 'device_name', 'stream_types', 'route_id']) {
    const value = sample[key];
    console.log(`  ${key}: ${value === undefined ? '(absent)' : JSON.stringify(value)}`);
  }

  console.log('\n--- Required field mapping ---');
  const reports = provider.explainMapping(sample);
  for (const r of reports) {
    const mark = r.provenance === 'direct' ? 'ok  ' : r.provenance === 'derived' ? 'calc' : 'MISS';
    const from = r.sourceKey ? ` <- ${r.sourceKey}` : '';
    console.log(`  [${mark}] ${r.field}${from}`);
  }

  const missing = reports.filter(r => r.provenance === 'missing');

  console.log('\n--- Canonical record ---');
  const canonical = provider.toCanonical(sample);
  console.log(JSON.stringify(canonical, null, 2));

  console.log('\n--- Route geometry ---');
  let geometryOk = false;
  const streamTypes = Array.isArray(sample.stream_types)
    ? (sample.stream_types as string[])
    : undefined;

  try {
    const { IntervalsProvider: Provider } = await import('./api/intervals-provider.js');
    const geometry = await provider.fetchGeometry(String(sample.id), streamTypes);

    if (geometry.summaryPolyline && geometry.startLatLng) {
      geometryOk = true;
      console.log(`  Rebuilt polyline from latlng stream (${geometry.summaryPolyline.length} chars).`);
      console.log(`  start_latlng derived: [${geometry.startLatLng.join(', ')}]`);
    } else {
      console.log('  Could not extract coordinates. Actual streams shape:');
      console.log(Provider.describeStreams(geometry.raw));
      console.log('  If a coordinate series is listed above under an unexpected name,');
      console.log('  add it to extractCoordinates in intervals-provider.ts.');
    }
  } catch (error: any) {
    console.log(`  Streams request failed: ${error.message}`);
  }

  console.log('\n--- Verdict ---');
  if (missing.length === 0 && geometryOk) {
    console.log('All required fields resolved. The adapter can drive the full pipeline.');
  } else {
    if (missing.length > 0) {
      console.log(`${missing.length} summary field(s) unresolved: ${missing.map(m => m.field).join(', ')}`);
    }
    if (!geometryOk) {
      console.log('Route geometry unresolved — map widgets would have no route data.');
      console.log(`Re-probe a known outdoor run: node dist/index.js probe-intervals <activityId>`);
    }
  }
}

function printHelp() {
  console.log('Usage: npm run [command]');
  console.log('\nAvailable commands:');
  console.log('  auth                   - Complete OAuth flow with Strava');
  console.log('  sync                   - Sync new activities from Strava');
  console.log('  status                 - Show current sync status');
  console.log('  compute-stats          - Compute basic statistics from synced activities');
  console.log('  compute-advanced-stats - Compute advanced statistics (year-over-year, time-of-day, etc.)');
  console.log('  compute-geo-stats      - Compute geographic statistics (countries, cities) from GPS data');
  console.log('  compute-all-stats      - Compute all statistics (basic, advanced, geo)');
  console.log('  probe-intervals        - Dry-run the intervals.icu provider (writes nothing)');
  console.log('\nExamples:');
  console.log('  npm run auth                   # Get authorization URL');
  console.log('  npm run auth CODE              # Exchange code for tokens');
  console.log('  npm run sync                   # Fetch new activities');
  console.log('  npm start status               # Check sync state');
  console.log('  npm run compute-stats          # Generate basic stats');
  console.log('  npm run compute-advanced-stats # Generate advanced stats');
  console.log('  npm run compute-geo-stats      # Generate geo stats');
  console.log('  npm run compute-all-stats      # Generate all stats');
}

async function main() {
  switch (command) {
    case 'auth':
      await authCommand();
      break;
    case 'sync':
      await syncCommand();
      break;
    case 'status':
      await statusCommand();
      break;
    case 'compute-stats':
      await computeStatsCommand();
      break;
    case 'compute-advanced-stats':
      await computeAdvancedStatsCommand();
      break;
    case 'compute-geo-stats':
      await computeGeoStatsCommand();
      break;
    case 'compute-all-stats':
      await computeAllStatsCommand();
      break;
    case 'probe-intervals':
      await probeIntervalsCommand();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error.message);
  // NEVER log tokens or secrets
  if (error.stack && !error.stack.includes('token') && !error.stack.includes('secret')) {
    console.error(error.stack);
  }
  process.exit(1);
});
