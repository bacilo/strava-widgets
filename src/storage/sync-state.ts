import type { SyncState, StravaActivity } from '../types/strava.types.js';
import { FileStore } from './file-store.js';

/**
 * Manages sync state with high watermark tracking.
 *
 * Tracks the most recent activity timestamp for incremental sync.
 */
export class SyncStateManager {
  constructor(
    private statePath: string,
    private fileStore: FileStore
  ) {}

  /**
   * Load sync state from disk.
   *
   * Returns default state if file doesn't exist.
   */
  async load(): Promise<SyncState> {
    const exists = await this.fileStore.exists(this.statePath);
    if (!exists) {
      return {
        last_sync_timestamp: 0,
        last_activity_id: '',
        total_activities: 0,
        last_sync_date: '',
      };
    }

    return this.fileStore.readJson<SyncState>(this.statePath);
  }

  /**
   * Save sync state atomically.
   */
  async save(state: SyncState): Promise<void> {
    await this.fileStore.writeJson(this.statePath, state);
  }

  /**
   * Update state after syncing new activities.
   *
   * Computes high watermark from most recent activity and updates counts.
   */
  async updateAfterSync(activities: StravaActivity[]): Promise<SyncState> {
    const currentState = await this.load();

    if (activities.length === 0) {
      return currentState;
    }

    // Find most recent activity (activities are sorted newest first from API)
    const mostRecent = activities[0];
    const timestamp = new Date(mostRecent.start_date).getTime() / 1000; // Convert to Unix epoch seconds

    const newState: SyncState = {
      last_sync_timestamp: Math.max(timestamp, currentState.last_sync_timestamp),
      last_activity_id: mostRecent.id.toString(),
      total_activities: currentState.total_activities + activities.length,
      last_sync_date: new Date().toISOString(),
    };

    await this.save(newState);
    return newState;
  }
}
