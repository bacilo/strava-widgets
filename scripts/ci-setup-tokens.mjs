#!/usr/bin/env node

/**
 * CI Token Setup Script
 *
 * Prepares data/tokens.json for GitHub Actions CI runs.
 *
 * Behavior:
 * - If tokens.json already exists: skips setup (committed tokens are more current)
 * - If tokens.json missing: creates it from STRAVA_REFRESH_TOKEN env var
 * - Sets expires_at to 0 to force immediate token refresh on first use
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const tokensPath = join(projectRoot, 'data', 'tokens.json');

// Check if tokens.json already exists
if (existsSync(tokensPath)) {
  console.log('✓ tokens.json already exists, skipping setup');
  console.log('  (Using committed tokens from previous CI run)');
  process.exit(0);
}

// Read refresh token from environment
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
if (!refreshToken) {
  console.error('ERROR: STRAVA_REFRESH_TOKEN environment variable is required');
  process.exit(1);
}

// Create data directory if it doesn't exist
const dataDir = dirname(tokensPath);
mkdirSync(dataDir, { recursive: true });

// Create tokens.json with bootstrap structure
const tokens = {
  access_token: '',
  refresh_token: refreshToken,
  expires_at: 0  // Force immediate refresh on first use
};

writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
console.log('✓ Created tokens.json from STRAVA_REFRESH_TOKEN');
console.log('  (expires_at set to 0, will refresh on first API call)');
