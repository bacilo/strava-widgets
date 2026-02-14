/**
 * Strava OAuth token response
 */
export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix epoch seconds
}

/**
 * Strava Activity API response
 *
 * Includes all fields needed for analytics. Broad index signature
 * allows storage of full API response for future extensibility.
 */
export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string; // ISO 8601
  start_date_local: string; // ISO 8601
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  start_latlng?: number[];
  end_latlng?: number[];
  map?: {
    summary_polyline: string;
  };
  [key: string]: unknown; // Allow future fields
}

/**
 * Sync state tracking high watermark for incremental sync
 */
export interface SyncState {
  last_sync_timestamp: number; // Unix epoch seconds
  last_activity_id: number | string; // Activity ID (number from API, string for compatibility)
  total_activities: number;
  last_sync_date: string; // ISO 8601
}
