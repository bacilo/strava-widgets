# Phase 1: Data Foundation - Research

**Researched:** 2026-02-14
**Domain:** Strava API Integration, OAuth 2.0, Rate Limiting, Local Data Storage
**Confidence:** HIGH

## Summary

Phase 1 requires implementing OAuth 2.0 authentication with Strava API, incremental activity syncing with rate limit compliance, and local JSON file storage. The Strava API follows standard OAuth 2.0 patterns with access tokens expiring every 6 hours, requiring refresh token rotation. Rate limits are strict: 100 requests/15min and 1,000/day for read operations, with 429 responses when exceeded.

The standard approach uses native Node.js fetch (available since v18) for HTTP requests, bottleneck for rate limiting, simple-oauth2 for OAuth flows, and atomic file writes for data persistence. GitHub Secrets provide secure token storage for CI/CD, while dotenv handles local development. The architecture should separate concerns: OAuth client, API client with rate limiting, sync orchestrator, and file storage layer.

**Primary recommendation:** Use native fetch with bottleneck rate limiter, implement atomic file writes with temp+rename pattern, track sync state via high watermark timestamp in separate state file, and never commit secrets to version control.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v18+ | Runtime | Native fetch API support, modern async features |
| TypeScript | 5.x | Type safety | Catches OAuth/API integration errors at compile time |
| dotenv | latest | Local env vars | Industry standard for local development secrets (never in production) |
| bottleneck | 2.19.x | Rate limiting | Battle-tested, zero dependencies, clustering support, designed for API clients |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-oauth2 | latest | OAuth 2.0 client | Simplifies token exchange and refresh flows (276K weekly downloads) |
| write-file-atomic | latest | Atomic file writes | Prevents corrupted JSON files during writes |
| p-retry | latest | Exponential backoff | Retry 429 responses and network failures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | axios/got | More features but adds dependencies; native fetch sufficient for this use case |
| simple-oauth2 | Manual implementation | More control but error-prone (token rotation, expiry handling) |
| bottleneck | p-limit/rate-limiter-flexible | Less specialized for API clients; bottleneck purpose-built for this |
| Strava client library | strava-v3/strava npm | Abstraction but many are unmaintained; direct API calls more reliable |

**Installation:**
```bash
npm install dotenv bottleneck simple-oauth2 write-file-atomic p-retry
npm install -D @types/node typescript
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── config/              # Environment variables, constants
│   └── strava.config.ts # Client ID, secrets, API endpoints
├── auth/                # OAuth 2.0 implementation
│   └── strava-oauth.ts  # Token exchange, refresh, storage
├── api/                 # Strava API client
│   ├── strava-client.ts # Rate-limited HTTP client wrapper
│   └── activities.ts    # Activity-specific endpoints
├── storage/             # Local file persistence
│   ├── file-store.ts    # Atomic JSON file operations
│   └── sync-state.ts    # High watermark tracking
├── sync/                # Sync orchestration
│   └── activity-sync.ts # Incremental sync logic
└── index.ts             # Entry point for manual sync
```

### Pattern 1: OAuth Token Refresh with Rotation
**What:** Strava returns new refresh token with every access token refresh
**When to use:** Every API request should check token expiry first
**Example:**
```typescript
// Source: https://developers.strava.com/docs/authentication/
interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix epoch timestamp
}

class StravaOAuth {
  async getValidAccessToken(): Promise<string> {
    const tokens = await this.loadTokens();

    // Check if token expires within 1 hour (Strava recommendation)
    const expiresWithinHour = tokens.expires_at < (Date.now() / 1000) + 3600;

    if (expiresWithinHour) {
      const newTokens = await this.refreshAccessToken(tokens.refresh_token);
      // CRITICAL: Always persist new refresh token
      await this.saveTokens(newTokens);
      return newTokens.access_token;
    }

    return tokens.access_token;
  }

  async refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  }
}
```

### Pattern 2: Rate-Limited API Client with Bottleneck
**What:** Wrap fetch calls in bottleneck limiter matching Strava's rate limits
**When to use:** All Strava API requests
**Example:**
```typescript
// Source: https://www.npmjs.com/package/bottleneck
import Bottleneck from 'bottleneck';

class StravaAPIClient {
  private limiter: Bottleneck;

  constructor(private oauth: StravaOAuth) {
    // Strava limits: 100 req/15min, 1000/day for non-upload endpoints
    this.limiter = new Bottleneck({
      reservoir: 100,              // Initial capacity
      reservoirRefreshAmount: 100, // Refill to 100
      reservoirRefreshInterval: 15 * 60 * 1000, // Every 15 minutes
      maxConcurrent: 1,            // Serialize requests
      minTime: 200                 // Min 200ms between requests (safety buffer)
    });
  }

  async request<T>(endpoint: string): Promise<T> {
    return this.limiter.schedule(async () => {
      const token = await this.oauth.getValidAccessToken();

      const response = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Check rate limit headers
      const limit = response.headers.get('X-ReadRateLimit-Limit');
      const usage = response.headers.get('X-ReadRateLimit-Usage');

      if (response.status === 429) {
        throw new Error('Rate limit exceeded despite bottleneck');
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    });
  }
}
```

### Pattern 3: Incremental Sync with High Watermark
**What:** Track last synced activity timestamp to fetch only new activities
**When to use:** Every sync operation
**Example:**
```typescript
// Source: Incremental sync best practices
interface SyncState {
  last_sync_timestamp: number; // Unix epoch
  last_activity_id: string;    // For idempotency
  total_activities: number;
}

class ActivitySync {
  async syncNewActivities(): Promise<void> {
    const state = await this.loadSyncState();

    // Fetch activities after last sync timestamp
    let page = 1;
    const perPage = 200; // Strava max
    let hasMore = true;

    while (hasMore) {
      const activities = await this.apiClient.request<Activity[]>(
        `/athlete/activities?after=${state.last_sync_timestamp}&page=${page}&per_page=${perPage}`
      );

      if (activities.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to only runs
      const runs = activities.filter(a => a.type === 'Run');

      // Save activities atomically
      for (const run of runs) {
        await this.storage.saveActivity(run);
      }

      // Update high watermark
      if (activities.length > 0) {
        const latest = activities[0]; // Activities ordered newest first
        state.last_sync_timestamp = Math.floor(new Date(latest.start_date).getTime() / 1000);
        state.last_activity_id = latest.id.toString();
        state.total_activities += runs.length;
        await this.storage.saveSyncState(state);
      }

      page++;

      // Strava pagination: less than per_page means last page
      if (activities.length < perPage) {
        hasMore = false;
      }
    }
  }
}
```

### Pattern 4: Atomic JSON File Writes
**What:** Write to temp file, then atomically rename to prevent corruption
**When to use:** All JSON file writes
**Example:**
```typescript
// Source: https://thelinuxcode.com/nodejs-file-system-in-practice-a-production-grade-guide-for-2026/
import { writeFile, rename, unlink } from 'fs/promises';
import { join } from 'path';

class FileStorage {
  async saveActivity(activity: Activity): Promise<void> {
    const filename = `${activity.id}.json`;
    const finalPath = join(this.dataDir, filename);
    const tempPath = join(this.dataDir, `.${filename}.tmp.${process.pid}`);

    try {
      // Write to temp file
      await writeFile(tempPath, JSON.stringify(activity, null, 2), 'utf-8');

      // Atomic rename (atomic on Unix-like systems)
      await rename(tempPath, finalPath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
```

### Pattern 5: GitHub Secrets Access in Local Script
**What:** Load tokens from environment variables, fallback to .env for local dev
**When to use:** Script initialization
**Example:**
```typescript
// Source: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
import 'dotenv/config'; // Loads .env if exists

class Config {
  static get stravaClientId(): string {
    const id = process.env.STRAVA_CLIENT_ID;
    if (!id) {
      throw new Error('STRAVA_CLIENT_ID not set. Check .env or GitHub Secrets.');
    }
    return id;
  }

  static get stravaClientSecret(): string {
    const secret = process.env.STRAVA_CLIENT_SECRET;
    if (!secret) {
      throw new Error('STRAVA_CLIENT_SECRET not set. Check .env or GitHub Secrets.');
    }
    return secret;
  }

  static get stravaRefreshToken(): string {
    const token = process.env.STRAVA_REFRESH_TOKEN;
    if (!token) {
      throw new Error('STRAVA_REFRESH_TOKEN not set. Complete OAuth flow first.');
    }
    return token;
  }
}

// .env file (NEVER commit this):
// STRAVA_CLIENT_ID=your_client_id
// STRAVA_CLIENT_SECRET=your_client_secret
// STRAVA_REFRESH_TOKEN=your_refresh_token
```

### Anti-Patterns to Avoid
- **Storing tokens in code or committed files:** Always use environment variables + GitHub Secrets
- **Not persisting new refresh tokens:** Strava rotates refresh tokens on every refresh
- **Ignoring rate limit headers:** Monitor X-ReadRateLimit-Usage to detect bottleneck issues
- **Tight retry loops on 429:** Use exponential backoff, respect Retry-After header
- **Direct file overwrites:** Use atomic write pattern to prevent corrupted JSON
- **Polling for new activities:** Use incremental sync with high watermark, not polling
- **Hardcoding pagination limits:** Strava max is 200 per_page, defaults to 30

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token refresh | Manual token expiry checking | simple-oauth2 or robust manual impl | Token rotation, race conditions, edge cases |
| Rate limiting | Request counting logic | bottleneck | 15-min window resets, concurrent requests, cluster support |
| Exponential backoff | Custom retry logic | p-retry | Jitter, max attempts, error filtering |
| Atomic file writes | Direct fs.writeFile | write-file-atomic | Race conditions, corruption on crash |
| Pagination | Manual page incrementing | Iterator pattern with exit conditions | Off-by-one errors, infinite loops |

**Key insight:** OAuth and rate limiting have subtle edge cases (token rotation during refresh, concurrent requests hitting limits, clock skew) that production libraries have hardened over years. The 15-minute rate limit window resets at clock intervals (0, 15, 30, 45 past the hour), not rolling windows—this is easy to get wrong.

## Common Pitfalls

### Pitfall 1: Not Persisting Rotated Refresh Tokens
**What goes wrong:** After refreshing access token, old refresh token becomes invalid. If new refresh token isn't saved, next refresh fails.
**Why it happens:** Strava documentation mentions rotation but developers overlook persistence step
**How to avoid:** Always save both access_token AND refresh_token after every refresh
**Warning signs:** "Invalid refresh token" errors after first token refresh works

### Pitfall 2: Rate Limit Window Misunderstanding
**What goes wrong:** Assuming 15-minute window is rolling (last 15 minutes). It's actually fixed intervals.
**Why it happens:** Most rate limiters use rolling windows; Strava uses fixed clock intervals (0, 15, 30, 45 past hour)
**How to avoid:** Read X-RateLimit-Limit and X-RateLimit-Usage headers, don't assume timing
**Warning signs:** Unexpected 429 errors despite counting requests correctly

### Pitfall 3: Incomplete Token Validation
**What goes wrong:** Checking token exists but not validating expiry, causing mid-sync failures
**Why it happens:** Happy path works if token is fresh, fails randomly when token expires during sync
**How to avoid:** Check expires_at BEFORE every API call, refresh proactively (1 hour buffer)
**Warning signs:** Intermittent 401 errors during long syncs

### Pitfall 4: Pagination Without Exit Condition
**What goes wrong:** Infinite loop if API returns empty array but doesn't signal end differently
**Why it happens:** Assuming page parameter will eventually return error; it returns empty array
**How to avoid:** Exit when activities.length < per_page OR activities.length === 0
**Warning signs:** Script never completes, makes excessive API calls

### Pitfall 5: Race Condition in File Writes
**What goes wrong:** Concurrent writes to same file (e.g., sync state) causes corruption
**Why it happens:** Direct fs.writeFile isn't atomic; partial writes survive on crash/interrupt
**How to avoid:** Use atomic write pattern (temp + rename) or write-file-atomic library
**Warning signs:** Corrupted JSON files, parse errors on restart

### Pitfall 6: Secrets in Logs or Error Messages
**What goes wrong:** Logging API requests with Authorization header exposes tokens
**Why it happens:** Debug logging or error stack traces include sensitive headers
**How to avoid:** GitHub Actions auto-redacts secrets, but manual logs need filtering
**Warning signs:** Tokens visible in console output or log files

### Pitfall 7: Not Handling Activity Type Filtering
**What goes wrong:** Syncing all activity types when only runs are needed
**Why it happens:** /athlete/activities returns all activities; no type filter parameter
**How to avoid:** Filter activities.filter(a => a.type === 'Run') after fetching
**Warning signs:** Storage contains cycling, swimming, etc. activities

### Pitfall 8: Timestamp Precision Issues
**What goes wrong:** Using millisecond timestamps for `after` parameter; Strava expects Unix epoch seconds
**Why it happens:** JavaScript Date.now() returns milliseconds
**How to avoid:** Divide by 1000 for Strava API: Math.floor(Date.now() / 1000)
**Warning signs:** API returns all activities or no activities unexpectedly

### Pitfall 9: Missing .env in .gitignore
**What goes wrong:** Committing .env file with secrets to git
**Why it happens:** Forgot to add .env to .gitignore before first commit
**How to avoid:** Create .gitignore with .env FIRST, before creating .env file
**Warning signs:** .env visible in git status

### Pitfall 10: OAuth Scope Insufficient
**What goes wrong:** Can't access activity data despite valid token
**Why it happens:** Requested read instead of activity:read scope during OAuth
**How to avoid:** Request activity:read or activity:read_all scope in authorization URL
**Warning signs:** 403 Forbidden errors when accessing /athlete/activities

## Code Examples

Verified patterns from official sources:

### OAuth Authorization URL
```typescript
// Source: https://developers.strava.com/docs/authentication/
const authUrl = new URL('https://www.strava.com/oauth/authorize');
authUrl.searchParams.set('client_id', process.env.STRAVA_CLIENT_ID!);
authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/callback');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'activity:read'); // or activity:read_all for private activities

console.log('Visit this URL to authorize:', authUrl.toString());
```

### Token Exchange from Authorization Code
```typescript
// Source: https://developers.strava.com/docs/authentication/
async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const tokens = await response.json();

  // Save tokens to GitHub Secrets or local storage
  // tokens.access_token, tokens.refresh_token, tokens.expires_at
  return tokens;
}
```

### Fetching Activities with Pagination
```typescript
// Source: https://developers.strava.com/docs/reference/
interface StravaActivity {
  id: number;
  name: string;
  type: string; // "Run", "Ride", etc.
  start_date: string; // ISO 8601
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  average_speed: number; // m/s
  // ... many more fields
}

async function fetchActivitiesPage(
  accessToken: string,
  page: number,
  perPage: number,
  after?: number
): Promise<StravaActivity[]> {
  const url = new URL('https://www.strava.com/api/v3/athlete/activities');
  url.searchParams.set('page', page.toString());
  url.searchParams.set('per_page', perPage.toString());
  if (after) {
    url.searchParams.set('after', after.toString());
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`);
  }

  return await response.json();
}
```

### Reading Rate Limit Headers
```typescript
// Source: https://developers.strava.com/docs/rate-limits/
function checkRateLimitHeaders(response: Response): void {
  // Format: "short_limit,long_limit" e.g., "100,1000"
  const limits = response.headers.get('X-ReadRateLimit-Limit');
  const usage = response.headers.get('X-ReadRateLimit-Usage');

  if (limits && usage) {
    const [shortLimit, longLimit] = limits.split(',').map(Number);
    const [shortUsage, longUsage] = usage.split(',').map(Number);

    console.log(`Rate limits: ${shortUsage}/${shortLimit} (15min), ${longUsage}/${longLimit} (daily)`);

    // Warn if approaching limits
    if (shortUsage / shortLimit > 0.8) {
      console.warn('Approaching 15-minute rate limit');
    }
    if (longUsage / longLimit > 0.8) {
      console.warn('Approaching daily rate limit');
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-fetch library | Native fetch (Node.js) | Node.js v18 (2022) | Zero dependencies for HTTP, standardized API |
| Manual OAuth implementation | simple-oauth2 or native | Ongoing | Less boilerplate, fewer token refresh bugs |
| Callback-based fs | Promises/async-await (fs/promises) | Node.js v10+ (2018) | Cleaner code, better error handling |
| localStorage/cookies for tokens | GitHub Secrets + dotenv | Security best practice | Prevents accidental token leaks |
| Polling for updates | Webhook events (Strava supports) | Not applicable (Phase 1 uses batch sync) | Future optimization for real-time updates |

**Deprecated/outdated:**
- **strava-v3 npm package**: Last updated over a year ago, many endpoints missing
- **Implicit OAuth flow**: OAuth 2.1 deprecates implicit grant, use authorization code
- **Storing refresh tokens in localStorage (browser)**: XSS vulnerability, use HttpOnly cookies
- **Manual rate limiting with setTimeout**: Use purpose-built libraries like bottleneck

## Open Questions

1. **OAuth flow completion**
   - What we know: Developer must visit authorization URL and handle callback manually
   - What's unclear: Should Phase 1 include automated OAuth callback server or manual code entry?
   - Recommendation: Manual code entry via console for simplicity; automated server can be Phase 2

2. **Activity data storage format**
   - What we know: Store as JSON files, one per activity
   - What's unclear: Should we store full Strava response or subset of fields?
   - Recommendation: Store full response for future flexibility; disk space is cheap

3. **Sync trigger mechanism**
   - What we know: Developer can trigger sync manually
   - What's unclear: Command-line script, GitHub Actions workflow, or both?
   - Recommendation: Start with CLI script (node src/index.ts), add GitHub Actions in later phase

4. **Error recovery strategy**
   - What we know: Use p-retry for network failures, atomic writes prevent corruption
   - What's unclear: Should failed syncs roll back or resume from last saved state?
   - Recommendation: Resume from last saved state (high watermark); atomic writes ensure consistency

## Sources

### Primary (HIGH confidence)
- [Strava API Getting Started](https://developers.strava.com/docs/getting-started/) - OAuth flow, rate limits
- [Strava API Authentication](https://developers.strava.com/docs/authentication/) - Token refresh, scopes
- [Strava API Rate Limits](https://developers.strava.com/docs/rate-limits/) - Exact limits, headers
- [Strava API Reference](https://developers.strava.com/docs/reference/) - Activities endpoint, pagination
- [GitHub Actions Secrets Documentation](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions) - Secret management

### Secondary (MEDIUM confidence)
- [Node.js File System in Practice: A Production-Grade Guide for 2026](https://thelinuxcode.com/nodejs-file-system-in-practice-a-production-grade-guide-for-2026/) - Atomic writes
- [Set Up a TypeScript Project in 2026](https://thelinuxcode.com/set-up-a-typescript-project-in-2026-node-tsconfig-and-a-clean-build-pipeline/) - TypeScript setup
- [Node.js — Node.js Fetch](https://nodejs.org/en/learn/getting-started/fetch) - Native fetch API
- [bottleneck - npm](https://www.npmjs.com/package/bottleneck) - Rate limiting library
- [simple-oauth2 - npm](https://www.npmjs.com/package/simple-oauth2) - OAuth library
- [p-retry - npm](https://www.npmjs.com/package/p-retry) - Retry library
- [Incremental Load Strategy for Data Warehouses (2025 Guide)](https://blog.skyvia.com/incremental-load-strategy-for-data-warehouses/) - High watermark pattern
- [Access Token vs Refresh Token: A Practical Breakdown for Modern OAuth (2026)](https://thelinuxcode.com/access-token-vs-refresh-token-a-practical-breakdown-for-modern-oauth-2026/) - OAuth best practices
- [How to Handle API Rate Limits Gracefully (2026 Guide)](https://apistatuscheck.com/blog/how-to-handle-api-rate-limits) - Rate limiting strategies
- [dotenv GitHub Repository](https://github.com/motdotla/dotenv) - Environment variable management

### Tertiary (LOW confidence)
- Community forum discussions about Strava pagination quirks - marked for validation through testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Strava docs, npm package stats, Node.js documentation
- Architecture: HIGH - Official docs, production guides from 2026, established patterns
- Pitfalls: MEDIUM-HIGH - Combination of official docs, blog posts, and inferred from API behavior

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - Strava API is stable, npm packages mature)
