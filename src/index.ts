import 'dotenv/config';
import { StravaOAuth } from './auth/strava-oauth.js';
import { StravaClient } from './api/strava-client.js';
import { FileStore } from './storage/file-store.js';
import { SyncStateManager } from './storage/sync-state.js';
import { ActivitySync } from './sync/activity-sync.js';
import { config } from './config/strava.config.js';
import { computeAllStats } from './analytics/compute-stats.js';
import { computeAdvancedStats } from './analytics/compute-advanced-stats.js';
import { COMPUTE_ALL_STATS_STEPS, runComputeAllStatsSteps } from './compute-all-stats-steps.js';
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

    // Deliberately still a hard exit, unlike the compute-* commands (WR-04):
    // this command holds HTTP keep-alive sockets and rate-limiter timers, and
    // returning here would risk the process lingering (or hanging a CI job)
    // waiting for the event loop to drain. Truncated trailing output is the
    // lesser cost for a command whose summary is three short lines.
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
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exitCode = 1;
    return;
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
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute advanced stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exitCode = 1;
    return;
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
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute geo stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeBestEffortsCommand() {
  try {
    const { computeBestEfforts } = await import('./analytics/compute-best-efforts.js');
    console.log('Computing best efforts from committed streams...\n');
    await computeBestEfforts({
      activitiesDir: config.activitiesDir,
      streamsDir: config.streamsDir,
      streamsManifestPath: config.streamsManifestPath,
      statsDir: 'data/stats',
    });
    console.log('\nBest efforts generated successfully!');
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute best efforts error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('streams')) {
      console.error('\nStreams directory not found. Please run: npm run backfill-streams');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeDashboardIndexCommand() {
  try {
    const { computeDashboardIndex } = await import('./analytics/compute-dashboard-index.js');
    console.log('Computing dashboard activity index...\n');
    await computeDashboardIndex({
      activitiesDir: config.activitiesDir,
      streamsManifestPath: config.streamsManifestPath,
      statsDir: 'data/stats',
      geoDir: 'data/geo',
      outDir: 'data/dashboard',
    });
    console.log('\nDashboard index generated successfully!');
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute dashboard index error:', error.message);
    if (error.code === 'ENOENT' || String(error.message).includes('manifest')) {
      console.error('\nStream manifest not found. Please run: npm run backfill-streams');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeTrainingLoadCommand() {
  try {
    const { computeTrainingLoad } = await import('./analytics/compute-training-load.js');
    console.log('Computing training load from committed streams...\n');
    await computeTrainingLoad({
      activitiesDir: config.activitiesDir,
      streamsDir: config.streamsDir,
      streamsManifestPath: config.streamsManifestPath,
      statsDir: 'data/stats',
    });
    console.log('\nTraining load generated successfully!');
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute training load error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('streams')) {
      console.error('\nStreams directory not found. Please run: npm run backfill-streams');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeAgeGradingCommand() {
  try {
    const { computeAgeGrading } = await import('./analytics/compute-age-grading.js');
    console.log('Computing age-grading percentages...\n');
    await computeAgeGrading({
      statsDir: 'data/stats',
      wmaDir: 'data/wma',
    });
    console.log('\nAge-grading generated successfully!');
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute age grading error:', error.message);
    if (error.message.includes('best-efforts')) {
      console.error('\nBest-efforts document not found. Please run: npm run compute-best-efforts');
    } else if (error.message.includes('wma')) {
      console.error('\nWMA factor tables not found. Please run: node scripts/convert-wma-tables.mjs');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeGearAggregateCommand() {
  try {
    const { computeGearAggregate } = await import('./analytics/compute-gear-aggregate.js');
    console.log('Computing per-shoe gear aggregate...\n');
    await computeGearAggregate({
      indexPath: 'data/dashboard/index.json',
      outDir: 'data/stats',
    });
    console.log('\nGear aggregate generated successfully!');
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute gear aggregate error:', error.message);
    if (error.message.includes('index')) {
      console.error('\nDashboard index not found. Please run: npm run compute-dashboard-index');
    }
    process.exitCode = 1;
    return;
  }
}

async function computeAllStatsCommand() {
  try {
    console.log('Computing all statistics from synced activities...\n');

    // --ci selects warn-and-continue for tolerated steps (D-02); without it
    // the walk is fail-fast by default, matching a hand-run's expectations.
    const continueOnError = process.argv.includes('--ci');

    // The chain's order and each step's mandatory/tolerated disposition are
    // declared exactly once, in src/compute-all-stats-steps.ts (D-01) — wrap
    // each step's run only to announce its name before it executes, so the
    // single collapsed Actions step's output still carries the per-step
    // boundary the eight green/red boxes used to provide.
    const announcedSteps = COMPUTE_ALL_STATS_STEPS.map((step) => ({
      ...step,
      run: async () => {
        console.log(`> ${step.name}`);
        await step.run();
        console.log(''); // Blank line separator
      },
    }));

    const degraded = await runComputeAllStatsSteps(announcedSteps, { continueOnError });

    // The headline must not claim success on a degraded run. It used to be
    // unconditional, so a nightly where three tolerated steps failed printed
    // an unqualified "All statistics generated successfully!" and then
    // immediately contradicted itself — anyone grepping the collapsed Actions
    // log for "successfully", or reading only the last screenful, got the
    // wrong answer. That directly undercuts D-03's stated purpose.
    if (degraded.length === 0) {
      console.log('\nAll statistics generated successfully!');
    } else {
      console.log(`\nStatistics generated with ${degraded.length} degraded step(s).`);
    }

    if (degraded.length > 0) {
      // D-03: an end-of-run failure summary names every degraded step, so a
      // nightly that quietly degraded a step is visible at a glance rather
      // than buried mid-log. Printed AFTER the headline above, not
      // interleaved with per-step output.
      console.log(`\n${'='.repeat(70)}`);
      console.log(`DEGRADED STEPS (${degraded.length}) — tolerated failures during this run:`);
      for (const step of degraded) {
        console.log(`  - ${step.name}: ${step.message}`);
      }
      console.log('='.repeat(70));
    }

    // Set the code and return rather than process.exit(). In GitHub Actions
    // process.stdout is a PIPE, and pipe writes in Node are asynchronous;
    // process.exit() forces the process down even with queued stdout writes
    // still pending. This command emits a large volume of per-step output
    // ahead of the summary, so the DEGRADED STEPS block D-03 added for
    // visibility was the output most likely to be dropped — intermittently
    // and as a function of log size, which makes it harder to diagnose, not
    // easier. Returning lets main() resolve and the runtime exit naturally
    // once stdout has drained. Safe here because the compute chain is pure
    // filesystem work with no sockets or timers to hold the event loop open.
    process.exitCode = 0;
    return;
  } catch (error: any) {
    console.error('Compute all stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exitCode = 1;
    return;
  }
}

/**
 * Sync new activities from intervals.icu (which mirrors Garmin Connect).
 *
 * Replacement ingestion path for the Strava sync after Strava paywalled
 * Standard-tier API access. Dedupes against everything already in
 * data/activities/ by start_date epoch, so running it alongside or after the
 * old Strava archive is safe.
 */
async function syncIntervalsCommand() {
  try {
    const { IntervalsClient } = await import('./api/intervals-client.js');
    const { IntervalsSync } = await import('./sync/intervals-sync.js');

    const fileStore = new FileStore('.');
    const client = new IntervalsClient({
      apiKey: process.env.INTERVALS_API_KEY || '',
      athleteId: process.env.INTERVALS_ATHLETE_ID || '0',
    });
    const syncStateManager = new SyncStateManager(config.syncStatePath, fileStore);
    const sync = new IntervalsSync({
      client,
      fileStore,
      syncStateManager,
      activitiesDir: config.activitiesDir,
      streamsDir: config.streamsDir,
      streamsManifestPath: config.streamsManifestPath,
    });

    console.log('Starting intervals.icu activity sync...\n');
    const result = await sync.syncNewActivities();

    console.log('\n=== Sync Summary ===');
    console.log(`New runs saved: ${result.newRuns}`);
    console.log(`Total activities fetched: ${result.totalFetched}`);
    console.log(`Skipped (duplicates/non-runs): ${result.skipped}`);

    // Same reasoning as syncCommand (WR-04): still a hard exit because this
    // command holds keep-alive sockets and retry timers. The nightly runs it
    // under `continue-on-error: true`, so a lingering process here would burn
    // the job's 30-minute timeout — a worse failure than a truncated
    // three-line summary.
    process.exit(0);
  } catch (error: any) {
    console.error('Sync error:', error.message);
    if (error.message.includes('INTERVALS_API_KEY')) {
      console.error('\nSee .env.example — generate a key at https://intervals.icu/settings');
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
    const expectedMeters = typeof sample.distance === 'number' ? sample.distance : 0;
    const geometry = await provider.fetchGeometry(String(sample.id), {
      streamTypes,
      expectedMeters,
    });

    const v = geometry.validation;

    if (geometry.summaryPolyline && geometry.startLatLng && v?.ok) {
      geometryOk = true;
      console.log(`  Rebuilt polyline from latlng stream (${geometry.summaryPolyline.length} chars).`);
      console.log(`  start_latlng derived: [${geometry.startLatLng.join(', ')}]`);
      // Mis-paired coordinates still encode into a plausible-looking polyline,
      // so the route is only trustworthy once its length agrees with the
      // distance the device recorded.
      console.log(
        `  Validated: path ${(v.pathMeters / 1000).toFixed(2)} km vs reported ` +
        `${(expectedMeters / 1000).toFixed(2)} km (${v.ratio.toFixed(3)}x).`
      );

      // Independent check. Distance alone cannot tell latitude from longitude
      // on a route with balanced extent, but a place name can: mirrored
      // coordinates land in the sea. Reuses the offline GeoNames database.
      try {
        const { geocodeCoordinate } = await import('./geo/geocoder.js');
        const [lat, lng] = geometry.startLatLng;
        const place = await geocodeCoordinate(lat, lng, {
          version: 1,
          geocoder: 'geonames-cities1000',
          entries: {},
        });
        console.log(
          place
            ? `  Start point reverse-geocodes to: ${place.cityName}, ${place.countryName}`
            : '  Start point does not resolve to any known city — coordinates may be mirrored.'
        );
      } catch (error: any) {
        console.log(`  (Reverse-geocode check unavailable: ${error.message})`);
      }
    } else {
      console.log(`  REJECTED: ${v?.reason ?? 'no coordinates extracted'}`);
      if (v && v.pathMeters > 0) {
        console.log(
          `  Reconstructed path was ${(v.pathMeters / 1000).toFixed(2)} km against a ` +
          `reported ${(expectedMeters / 1000).toFixed(2)} km.`
        );
      }
      console.log('\n  Streams returned for types=latlng:');
      console.log(Provider.describeStreams(geometry.raw));
      if (geometry.rawAll !== undefined) {
        console.log('\n  Streams returned with NO type filter:');
        console.log(Provider.describeStreams(geometry.rawAll));
      }
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
  console.log('  compute-best-efforts   - Compute best efforts (fastest 400m..marathon) from committed streams');
  console.log('  compute-dashboard-index - Compute the dashboard activity index manifest from the committed archive');
  console.log('  compute-training-load  - Compute CTL/ATL/TSB training load from committed streams');
  console.log('  compute-age-grading    - Compute age-grade percentages from best efforts and WMA tables');
  console.log('  compute-gear-aggregate - Compute the per-shoe gear aggregate from the dashboard index');
  console.log('  compute-all-stats [--ci] - Compute all statistics (basic, advanced, geo, best efforts, age-grading, dashboard index, gear aggregate, training load). --ci: warn and continue on tolerated steps, print a failure summary; default is fail-fast.');
  console.log('  sync-intervals         - Sync new activities from intervals.icu (Garmin bridge)');
  console.log('  consolidate-exports    - Reconcile bulk exports under export_data/ into the archive');
  console.log('  backfill-streams       - Derive committed per-activity streams from export_data/ originals, local only');
  console.log('  probe-intervals        - Dry-run the intervals.icu provider (writes nothing)');
  console.log('\nExamples:');
  console.log('  npm run auth                   # Get authorization URL');
  console.log('  npm run auth CODE              # Exchange code for tokens');
  console.log('  npm run sync                   # Fetch new activities');
  console.log('  npm start status               # Check sync state');
  console.log('  npm run compute-stats          # Generate basic stats');
  console.log('  npm run compute-advanced-stats # Generate advanced stats');
  console.log('  npm run compute-geo-stats      # Generate geo stats');
  console.log('  npm run compute-best-efforts    # Generate best-effort records');
  console.log('  npm run compute-dashboard-index # Generate the dashboard index');
  console.log('  npm run compute-training-load   # Generate CTL/ATL/TSB training load');
  console.log('  npm run compute-age-grading     # Generate age-grade percentages');
  console.log('  npm run compute-gear-aggregate  # Generate the per-shoe gear aggregate');
  console.log('  npm run compute-all-stats      # Generate all stats');
  console.log('  node dist/index.js compute-all-stats --ci   # CI mode: tolerate optional steps');
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
    case 'compute-best-efforts':
      await computeBestEffortsCommand();
      break;
    case 'compute-dashboard-index':
      await computeDashboardIndexCommand();
      break;
    case 'compute-training-load':
      await computeTrainingLoadCommand();
      break;
    case 'compute-age-grading':
      await computeAgeGradingCommand();
      break;
    case 'compute-gear-aggregate':
      await computeGearAggregateCommand();
      break;
    case 'compute-all-stats':
      await computeAllStatsCommand();
      break;
    case 'sync-intervals':
      await syncIntervalsCommand();
      break;
    case 'consolidate-exports': {
      const { consolidateExports } = await import('./exports/consolidate.js');
      await consolidateExports();
      break;
    }
    case 'backfill-streams': {
      const { backfillStreams } = await import('./streams/backfill-streams.js');
      await backfillStreams();
      break;
    }
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
