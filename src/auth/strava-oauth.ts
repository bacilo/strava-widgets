import type { StravaTokens } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

/**
 * Strava OAuth token management.
 *
 * Handles token refresh with rotation persistence and initial OAuth flow.
 */
export class StravaOAuth {
  private fileStore: FileStore;

  constructor(
    private config: {
      clientId: string;
      clientSecret: string;
      tokensPath: string;
    }
  ) {
    // FileStore expects baseDir, but tokensPath is already absolute/relative from project root
    // So we'll use current directory as baseDir and pass full path
    this.fileStore = new FileStore('.');
  }

  /**
   * Get a valid access token, refreshing if necessary.
   *
   * Refreshes proactively 1 hour before expiration.
   */
  async getValidAccessToken(): Promise<string> {
    const tokens = await this.loadTokens();

    // Refresh if token expires in less than 1 hour
    const now = Date.now() / 1000; // Unix epoch seconds
    const expiresIn = tokens.expires_at - now;

    if (expiresIn < 3600) {
      const newTokens = await this.refreshAccessToken(tokens.refresh_token);
      await this.saveTokens(newTokens);
      return newTokens.access_token;
    }

    return tokens.access_token;
  }

  /**
   * Refresh access token using refresh token.
   *
   * CRITICAL: Strava rotates refresh tokens, so new refresh_token must be persisted.
   */
  async refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to refresh Strava access token (${response.status}): ${error}. ` +
        'Your refresh token may be invalid. Run `npm run auth` to re-authenticate.'
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };
  }

  /**
   * Exchange authorization code for tokens.
   *
   * Used during initial OAuth flow. Saves tokens after exchange.
   */
  async exchangeCode(code: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange authorization code (${response.status}): ${error}`);
    }

    const data = await response.json();
    const tokens: StravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    await this.saveTokens(tokens);
    return tokens;
  }

  /**
   * Generate OAuth authorization URL.
   *
   * User must visit this URL to authorize the application.
   */
  getAuthorizationUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'activity:read_all',
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Load tokens from disk.
   *
   * Throws descriptive error if tokens don't exist.
   */
  async loadTokens(): Promise<StravaTokens> {
    const exists = await this.fileStore.exists(this.config.tokensPath);
    if (!exists) {
      throw new Error(
        `Tokens file not found at ${this.config.tokensPath}. ` +
        'You need to complete the OAuth flow first. Run `npm run auth` to authenticate with Strava.'
      );
    }

    return this.fileStore.readJson<StravaTokens>(this.config.tokensPath);
  }

  /**
   * Save tokens to disk atomically.
   *
   * CRITICAL: Must persist new refresh_token on every refresh (Strava rotates them).
   */
  async saveTokens(tokens: StravaTokens): Promise<void> {
    await this.fileStore.writeJson(this.config.tokensPath, tokens);
  }
}
