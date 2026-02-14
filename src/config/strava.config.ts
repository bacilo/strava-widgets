import 'dotenv/config';
import path from 'node:path';

/**
 * Configuration loaded from environment variables.
 *
 * Throws descriptive errors if required variables are missing.
 */
export const config = {
  get clientId(): string {
    const value = process.env.STRAVA_CLIENT_ID;
    if (!value) {
      throw new Error(
        'STRAVA_CLIENT_ID environment variable is required. ' +
        'Create a .env file based on .env.example and fill in your Strava API credentials. ' +
        'Get them from: https://www.strava.com/settings/api'
      );
    }
    return value;
  },

  get clientSecret(): string {
    const value = process.env.STRAVA_CLIENT_SECRET;
    if (!value) {
      throw new Error(
        'STRAVA_CLIENT_SECRET environment variable is required. ' +
        'Create a .env file based on .env.example and fill in your Strava API credentials. ' +
        'Get them from: https://www.strava.com/settings/api'
      );
    }
    return value;
  },

  get refreshToken(): string {
    const value = process.env.STRAVA_REFRESH_TOKEN;
    if (!value) {
      throw new Error(
        'STRAVA_REFRESH_TOKEN environment variable is required. ' +
        'Run `npm run auth` to complete the OAuth flow and obtain a refresh token.'
      );
    }
    return value;
  },

  get dataDir(): string {
    return process.env.STRAVA_DATA_DIR || './data';
  },

  get tokensPath(): string {
    return path.join(this.dataDir, 'tokens.json');
  },

  get syncStatePath(): string {
    return path.join(this.dataDir, 'sync-state.json');
  },

  get activitiesDir(): string {
    return path.join(this.dataDir, 'activities');
  },
};
