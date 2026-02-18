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
