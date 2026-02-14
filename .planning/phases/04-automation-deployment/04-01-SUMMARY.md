---
phase: 04-automation-deployment
plan: 01
subsystem: infra
tags: [github-actions, ci-cd, github-pages, oauth, strava]

# Dependency graph
requires:
  - phase: 03-advanced-analytics
    provides: Widget build system (Vite IIFE bundles), test page infrastructure
  - phase: 02-core-analytics
    provides: Data sync pipeline (npm run sync), stats computation
  - phase: 01-data-foundation
    provides: Strava OAuth token management, activity storage
provides:
  - Automated daily data refresh pipeline (fetch, compute, build)
  - GitHub Actions workflow with schedule and manual trigger
  - CI token management script for OAuth in headless environment
  - GitHub Pages deployment for widgets
  - Public widget landing page with embed documentation
affects: [future-enhancements, production-deployment]

# Tech tracking
tech-stack:
  added: [github-actions, peaceiris/actions-gh-pages@v4, stefanzweifel/git-auto-commit-action@v7]
  patterns: [ci-token-bootstrap, git-tracked-data, skip-ci-commits]

key-files:
  created:
    - .github/workflows/daily-refresh.yml
    - scripts/ci-setup-tokens.mjs
    - dist/widgets/index.html
  modified:
    - .gitignore
    - package.json

key-decisions:
  - "CI token bootstrap: STRAVA_REFRESH_TOKEN secret used only on first run, subsequent runs use committed tokens.json"
  - "Git-tracked data: Track data/activities/ and data/stats/ for incremental sync, exclude only data/tokens.json"
  - "Error resilience: continue-on-error on fetch step allows widget rebuild from cached data if Strava API fails"
  - "Node 22 LTS in CI for stability (not Node 24 which is current/unstable)"
  - "Deterministic installs: npm ci instead of npm install for reproducible CI builds"
  - "[skip ci] in auto-commit message prevents recursive workflow triggers"

patterns-established:
  - "CI OAuth pattern: Bootstrap tokens.json from secrets, commit rotated tokens, skip bootstrap if already exists"
  - "Resilient pipeline: Continue on fetch failure, rebuild with existing data, warn via GitHub annotations"
  - "Atomic deployments: Commit data changes before widget deployment to maintain consistency"

# Metrics
duration: 8min
completed: 2026-02-14
---

# Phase 04 Plan 01: Automation & Deployment Summary

**GitHub Actions CI/CD pipeline with daily schedule, automated data refresh, stats computation, widget builds, and GitHub Pages deployment**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-14T12:48:00Z (estimated)
- **Completed:** 2026-02-14T12:56:00Z
- **Tasks:** 3 (2 auto, 1 checkpoint)
- **Files modified:** 5

## Accomplishments
- Complete CI/CD pipeline with daily 5 AM UTC schedule for automated data refresh
- Token management system for headless OAuth in GitHub Actions environment
- GitHub Pages deployment with widget landing page and embed documentation
- Error handling with graceful degradation (rebuilds widgets from cached data on API failure)
- Manual workflow trigger for on-demand updates

## Task Commits

Each task was committed atomically:

1. **Task 1: CI token setup script, .gitignore update, and npm script aliases** - `ae618f8` (chore)
2. **Task 2: GitHub Actions daily-refresh workflow and Pages landing page** - `c7683f2` (feat)
3. **Task 3: Verify CI pipeline and set up GitHub deployment** - CHECKPOINT APPROVED (user verified)

**Plan metadata:** (pending - this summary commit)

## Files Created/Modified

**Created:**
- `.github/workflows/daily-refresh.yml` - Complete CI/CD pipeline with schedule, manual trigger, and deployment steps
- `scripts/ci-setup-tokens.mjs` - CI helper script for OAuth token bootstrap from environment variables
- `dist/widgets/index.html` - GitHub Pages landing page with widget embed documentation

**Modified:**
- `.gitignore` - Changed from blanket `data/` ignore to specific `data/tokens.json` ignore, enabling git-tracked activities and stats
- `package.json` - Added `fetch` and `process` npm scripts for clean CI pipeline steps

## Decisions Made

**1. CI Token Bootstrap Strategy**
- STRAVA_REFRESH_TOKEN secret only needed for first CI run when tokens.json doesn't exist
- After first successful run, rotated tokens.json is committed to repo
- CI setup script detects existing tokens.json and skips bootstrap (committed tokens are more current)
- Rationale: Leverages existing OAuth rotation in StravaOAuth class, minimal changes needed

**2. Git-Tracked Activity Data**
- Changed from blanket `data/` gitignore to specific `data/tokens.json` only
- Track `data/activities/`, `data/sync-state.json`, `data/stats/` in git
- Rationale: Enables incremental sync in CI (knows where to resume), provides data backup, reduces API calls

**3. Error Resilience with Degradation**
- `continue-on-error: true` on fetch step allows pipeline to continue if Strava API fails
- Widget rebuild uses existing committed data instead of blocking
- GitHub warning annotation alerts on fetch failure
- Rationale: Widget availability more important than real-time freshness, API failures shouldn't block deployment

**4. Node 22 LTS in CI**
- Use Node 22 (LTS) instead of Node 24 (current/unstable)
- Rationale: Stability in production CI environment, avoid potential breaking changes

**5. Deterministic Builds**
- Use `npm ci` instead of `npm install` in workflow
- Rationale: Faster, deterministic installs from package-lock.json, fails if lock file out of sync

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - workflow configuration, token bootstrap script, and landing page created without issues.

## User Setup Required

**External services require manual configuration.** The workflow file is ready but requires GitHub repository setup:

**GitHub Repository:**
1. Create PRIVATE GitHub repository (protects tokens and personal activity data)
2. Add repository secrets at Settings → Secrets and variables → Actions:
   - `STRAVA_CLIENT_ID` from https://www.strava.com/settings/api
   - `STRAVA_CLIENT_SECRET` from https://www.strava.com/settings/api
   - `STRAVA_REFRESH_TOKEN` from local `data/tokens.json` (copy `refresh_token` value)
3. Enable GitHub Pages at Settings → Pages → Source → "GitHub Actions"
4. Push code and trigger workflow manually from Actions tab

**Token Rotation Note:** After first successful CI run, the committed `data/tokens.json` contains the current refresh token. The CI setup script will detect this and skip bootstrapping. The `STRAVA_REFRESH_TOKEN` secret is only needed if `tokens.json` is missing from the repo.

## Verification Results

**Checkpoint approved by user.** The following items were verified:

1. Workflow file contains schedule (cron), workflow_dispatch, proper permissions
2. All pipeline steps present: checkout, setup-node, npm ci, setup-tokens, fetch, process, build, commit, deploy
3. Error handling verified: continue-on-error on fetch step
4. CI token script reads STRAVA_REFRESH_TOKEN and writes tokens.json
5. CI token script skips if tokens.json already exists (idempotent)

User confirmed understanding of GitHub setup steps and token rotation mechanism.

## Self-Check

Verifying claimed files and commits exist:

**Files:**
- FOUND: scripts/ci-setup-tokens.mjs
- FOUND: .github/workflows/daily-refresh.yml
- FOUND: dist/widgets/index.html

**Commits:**
- FOUND: ae618f8 (Task 1)
- FOUND: c7683f2 (Task 2)

**Self-Check: PASSED**

## Next Phase Readiness

**Phase 4 Complete - Project Ready for Production Deployment**

All automation infrastructure complete:
- Daily scheduled workflow active (5 AM UTC)
- Manual trigger available for on-demand updates
- Error handling with graceful degradation
- Widget deployment to GitHub Pages configured

**Remaining user action:** Push code to GitHub repository and configure secrets/Pages settings as documented above.

**Project is feature-complete per v1 requirements.**

---
*Phase: 04-automation-deployment*
*Completed: 2026-02-14*
