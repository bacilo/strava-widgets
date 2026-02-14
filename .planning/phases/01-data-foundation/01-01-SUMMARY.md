---
phase: 01-data-foundation
plan: 01
subsystem: foundation
tags: [setup, typescript, oauth, storage, config]
dependency_graph:
  requires: []
  provides:
    - strava-oauth-client
    - atomic-file-storage
    - sync-state-tracking
    - environment-config
  affects:
    - api-client (next plan)
    - sync-orchestrator (next plan)
tech_stack:
  added:
    - typescript (ES2022/Node16 with strict mode)
    - dotenv (environment variable management)
    - bottleneck (rate limiting, ready for API client)
    - p-retry (retry logic, ready for API client)
  patterns:
    - atomic file writes (temp + rename pattern)
    - lazy config getters with descriptive errors
    - proactive token refresh (1 hour before expiration)
    - refresh token rotation persistence
key_files:
  created:
    - package.json (project manifest with type:module)
    - tsconfig.json (strict TypeScript with ES2022/Node16)
    - .gitignore (blocks .env, node_modules, dist, data)
    - .env.example (documents required Strava credentials)
    - src/types/strava.types.ts (StravaTokens, StravaActivity, SyncState)
    - src/config/strava.config.ts (env var validation and path config)
    - src/auth/strava-oauth.ts (OAuth with refresh rotation)
    - src/storage/file-store.ts (atomic JSON read/write)
    - src/storage/sync-state.ts (high watermark sync tracking)
  modified: []
decisions:
  - decision: "Use native fetch instead of HTTP libraries"
    rationale: "Node.js 18+ has built-in fetch, avoids external dependency for simple OAuth calls"
    alternatives: ["axios", "node-fetch"]
  - decision: "Manual OAuth implementation instead of simple-oauth2"
    rationale: "OAuth flow is just two fetch calls (exchange code, refresh token), manual approach is simpler and avoids dependency"
    alternatives: ["simple-oauth2 library"]
  - decision: "Manual atomic write pattern instead of write-file-atomic package"
    rationale: "Temp file + rename pattern is 5 lines, avoids dependency, provides same atomicity guarantee"
    alternatives: ["write-file-atomic npm package"]
  - decision: "Lazy config getters with descriptive errors"
    rationale: "Throws immediately when missing env var is accessed, provides actionable error messages with links to Strava dashboard"
    alternatives: ["Validate all env vars on startup", "Return undefined and check at call sites"]
metrics:
  duration_minutes: 3
  completed_date: 2026-02-14
  tasks_completed: 2
  files_created: 9
  files_modified: 0
  commits: 2
---

# Phase 01 Plan 01: Initialize TypeScript Project and Foundation Modules

**One-liner:** TypeScript project with env-validated config, OAuth token refresh with rotation, and atomic file storage for Strava data sync.

## What Was Built

Initialized a strict TypeScript project (ES2022/Node16) with the foundational modules required for Strava API integration:

1. **Project Infrastructure**: package.json with type:module, all dependencies (dotenv, bottleneck, p-retry, typescript), tsconfig with strict mode, .gitignore blocking secrets
2. **Type Definitions**: Complete TypeScript interfaces for Strava API responses (tokens, activities) and sync state
3. **Configuration Module**: Lazy env var loading with descriptive errors guiding users to Strava API dashboard
4. **OAuth Client**: Token refresh with proactive expiration check (1 hour early), refresh token rotation persistence, and initial authorization flow
5. **Atomic File Storage**: Temp-file-then-rename pattern for crash-safe JSON persistence
6. **Sync State Manager**: High watermark tracking for incremental activity sync with sensible defaults

## Deviations from Plan

None - plan executed exactly as written.

## Tasks Completed

| Task | Name                                                   | Commit  | Files                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Initialize TypeScript project with dependencies       | ed32854 | package.json, tsconfig.json, .gitignore, .env.example, package-lock.json                                                                                                                               |
| 2    | Create config, types, OAuth auth, and storage modules | 9001e91 | src/types/strava.types.ts, src/config/strava.config.ts, src/auth/strava-oauth.ts, src/storage/file-store.ts, src/storage/sync-state.ts                                                                |

## Verification Results

All plan verification criteria passed:

1. ✓ `npx tsc --noEmit` passes with zero TypeScript errors
2. ✓ All 5 source files exist in their respective directories
3. ✓ FileStore atomic write works (verified via smoke test)
4. ✓ SyncStateManager returns sensible defaults for fresh state (verified via smoke test)
5. ✓ No secrets present in any committed file (only env var name references)
6. ✓ .gitignore blocks .env, node_modules/, dist/, data/

## Must-Have Compliance

All must-have requirements satisfied:

- ✓ Project initializes, installs dependencies, and compiles TypeScript without errors
- ✓ Config module loads STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN from environment and throws descriptive errors if missing
- ✓ OAuth module can refresh an expired access token and persist the rotated refresh token
- ✓ File store writes activity JSON atomically (temp file + rename) and reads it back
- ✓ Sync state persists and loads a high watermark timestamp for incremental sync tracking
- ✓ Secrets (.env) are excluded from version control via .gitignore

All artifacts present with expected content:

- ✓ package.json provides project manifest with bottleneck dependency
- ✓ tsconfig.json provides TypeScript compilation config with outDir
- ✓ .gitignore provides git ignore rules containing .env
- ✓ .env.example provides template containing STRAVA_CLIENT_ID
- ✓ src/config/strava.config.ts exports config object
- ✓ src/types/strava.types.ts exports StravaTokens, StravaActivity, SyncState
- ✓ src/auth/strava-oauth.ts exports StravaOAuth class
- ✓ src/storage/file-store.ts exports FileStore class
- ✓ src/storage/sync-state.ts exports SyncStateManager class

All key links established:

- ✓ src/auth/strava-oauth.ts imports config (via dependency injection pattern)
- ✓ src/auth/strava-oauth.ts uses FileStore for token persistence (saveTokens method)
- ✓ src/storage/sync-state.ts imports and uses FileStore for atomic state persistence

## Success Criteria Met

- ✓ TypeScript project compiles cleanly with strict mode
- ✓ Config module enforces presence of all required environment variables
- ✓ OAuth module implements token refresh with rotation persistence and code exchange
- ✓ FileStore performs atomic writes (temp file + rename pattern)
- ✓ SyncStateManager tracks high watermark with sensible defaults
- ✓ No secrets in version-controlled files

## What's Next

**Next Plan (01-02):** Implement Strava API client with rate limiting and sync orchestrator to fetch activities incrementally.

**Ready to Build On:**
- OAuth client ready to provide valid access tokens
- FileStore ready to persist activities atomically
- SyncStateManager ready to track last sync timestamp
- Config provides all paths (tokensPath, syncStatePath, activitiesDir)

**User Setup Required Before Plan 02:**
1. Create Strava API Application at https://www.strava.com/settings/api
2. Copy Client ID and Client Secret to .env file
3. Run `npm run auth` to complete OAuth flow and obtain refresh token (helper script will be created in Plan 02)

## Self-Check: PASSED

All claimed files verified:

```
FOUND: /Users/pedf/workspace/housing-price-denmark/package.json
FOUND: /Users/pedf/workspace/housing-price-denmark/tsconfig.json
FOUND: /Users/pedf/workspace/housing-price-denmark/.gitignore
FOUND: /Users/pedf/workspace/housing-price-denmark/.env.example
FOUND: /Users/pedf/workspace/housing-price-denmark/src/types/strava.types.ts
FOUND: /Users/pedf/workspace/housing-price-denmark/src/config/strava.config.ts
FOUND: /Users/pedf/workspace/housing-price-denmark/src/auth/strava-oauth.ts
FOUND: /Users/pedf/workspace/housing-price-denmark/src/storage/file-store.ts
FOUND: /Users/pedf/workspace/housing-price-denmark/src/storage/sync-state.ts
```

All claimed commits verified:

```
FOUND: ed32854 (chore(01-01): initialize TypeScript project with dependencies)
FOUND: 9001e91 (feat(01-01): implement config, types, OAuth auth, and storage modules)
```
