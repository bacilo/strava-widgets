import { StravaClient } from '../api/strava-client.js';
import { FileStore } from '../storage/file-store.js';
import { SyncStateManager } from '../storage/sync-state.js';

export class ActivitySync {
  private client: StravaClient;
  private fileStore: FileStore;
  private syncStateManager: SyncStateManager;
  private activitiesDir: string;

  constructor({
    client,
    fileStore,
    syncStateManager,
    activitiesDir,
  }: {
    client: StravaClient;
    fileStore: FileStore;
    syncStateManager: SyncStateManager;
    activitiesDir: string;
  }) {
    this.client = client;
    this.fileStore = fileStore;
    this.syncStateManager = syncStateManager;
    this.activitiesDir = activitiesDir;
  }

  async syncNewActivities(): Promise<{
    newRuns: number;
    totalFetched: number;
    pagesProcessed: number;
  }> {
    // Load current sync state
    const state = await this.syncStateManager.load();
    const after = state.last_sync_timestamp === 0 ? undefined : state.last_sync_timestamp;

    if (after === undefined) {
      console.log('Starting sync from beginning of time (first sync)');
    } else {
      const lastSyncDate = new Date(after * 1000).toISOString();
      console.log(`Starting sync from ${lastSyncDate} (timestamp: ${after})`);
    }

    let newRuns = 0;
    let totalFetched = 0;
    let pagesProcessed = 0;
    let page = 1;
    const perPage = 200;

    while (true) {
      console.log(`Fetching page ${page}...`);
      const activities = await this.client.getActivities({ after, page, perPage });

      // If empty array returned, no more activities
      if (activities.length === 0) {
        console.log('No more activities to fetch (empty page)');
        break;
      }

      totalFetched += activities.length;

      // Filter to only Run type activities
      const runs = activities.filter((activity) => activity.type === 'Run');

      // Save each run as individual JSON file
      for (const run of runs) {
        const filePath = `${this.activitiesDir}/${run.id}.json`;
        await this.fileStore.writeJson(filePath, run);
        newRuns++;
      }

      // Update sync state with the highest timestamp from the page
      // IMPORTANT: Track maximum timestamp across ALL activities in the page
      let maxTimestamp = state.last_sync_timestamp;
      for (const activity of activities) {
        const timestamp = Math.floor(new Date(activity.start_date).getTime() / 1000);
        if (timestamp > maxTimestamp) {
          maxTimestamp = timestamp;
        }
      }

      // Save sync state after each page (enables resume on failure)
      await this.syncStateManager.save({
        last_sync_timestamp: maxTimestamp,
        last_activity_id: activities[0]?.id || state.last_activity_id,
        total_activities: state.total_activities + activities.length,
        last_sync_date: new Date(maxTimestamp * 1000).toISOString(),
      });

      pagesProcessed++;
      console.log(`Page ${page}: ${activities.length} activities, ${runs.length} runs saved`);

      // If activities.length < perPage, this is the last page
      if (activities.length < perPage) {
        console.log('Last page reached (partial page)');
        break;
      }

      page++;
    }

    console.log(
      `Sync complete: ${newRuns} new runs saved (${totalFetched} total activities fetched across ${pagesProcessed} pages)`
    );

    return { newRuns, totalFetched, pagesProcessed };
  }
}
