import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';
import { StravaOAuth } from '../auth/strava-oauth.js';
import { StravaActivity } from '../types/strava.types.js';

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'RateLimitError';
  }
}

export class StravaClient {
  private limiter: Bottleneck;
  private oauth: StravaOAuth;

  constructor({ oauth }: { oauth: StravaOAuth }) {
    this.oauth = oauth;
    this.limiter = new Bottleneck({
      reservoir: 100,
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 15 * 60 * 1000, // 15 minutes
      maxConcurrent: 1, // serialize all requests
      minTime: 200, // 200ms minimum between requests as safety buffer
    });
  }

  async request<T>(endpoint: string): Promise<T> {
    return this.limiter.schedule(async () => {
      const accessToken = await this.oauth.getValidAccessToken();

      const response = await pRetry(
        async () => {
          const res = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          // Log rate limit headers
          const limitHeader = res.headers.get('X-ReadRateLimit-Limit');
          const usageHeader = res.headers.get('X-ReadRateLimit-Usage');
          if (limitHeader && usageHeader) {
            console.info(`Rate limit: ${usageHeader} / ${limitHeader}`);
          }

          // Handle 429 specifically
          if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
            throw new RateLimitError(retryAfter);
          }

          // Check for other errors
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
          }

          return res;
        },
        {
          retries: 3,
          onFailedAttempt: (error: any) => {
            console.warn(`Request failed (attempt ${error.attemptNumber}):`, error.message);
          },
          shouldRetry: (error: any) => {
            // Only retry on network errors and 5xx server errors
            // Do NOT retry 4xx client errors or 429 rate limit errors
            if (error instanceof RateLimitError) return false;
            if (error.message && error.message.includes('HTTP 4')) return false;
            return true;
          },
        }
      );

      return response.json() as Promise<T>;
    });
  }

  async getActivities(params: {
    after?: number;
    page?: number;
    perPage?: number;
  } = {}): Promise<StravaActivity[]> {
    const { after, page = 1, perPage = 200 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (after !== undefined) {
      queryParams.set('after', after.toString());
    }

    return this.request<StravaActivity[]>(`/athlete/activities?${queryParams}`);
  }
}
