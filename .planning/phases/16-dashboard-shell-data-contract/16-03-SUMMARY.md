---
phase: 16-dashboard-shell-data-contract
plan: 03
subsystem: ui
tags: [typescript, hash-router, spa, vitest, tdd]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 01)
    provides: ActivityBestEfforts / BestEffort shapes used to document excludedFromRecords and prCount fields
  - phase: 14/15 (streams, best-efforts)
    provides: StreamUnavailableReason, DistanceSource, StreamChannels contracts reused by the index streams badge
provides:
  - DASHBOARD_INDEX_SCHEMA_VERSION, DashboardIndexRow, DashboardIndexDocument, DashboardIndexStreams, DashboardIndexTotals (the published index manifest contract)
  - DashboardView, ViewMountContext, ROUTES, ALL_ROUTES, NAV_ORDER, STUB_PHASE (view registry record + canonical route/nav tables)
  - parseHash, matchRoute, resolveHash, isValidActivityId, createRouter, navigateTo (hash router with dual-trigger resolution)
affects: [16-04, 16-05, 16-06, 16-07, 16-08, 16-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document envelope convention (schemaVersion/generatedAt/note/totals/payload) reused from best-effort.types.ts for the new dashboard index contract"
    - "Pure-core + thin-DOM-binding split for router.ts, matching repo's zero-DOM-test precedent (all .test.ts files run in vitest's node environment)"
    - "Dual-trigger route resolution: hashchange listener + immediate/DOMContentLoaded resolve, to handle deep links on initial load (MDN-cited pitfall)"

key-files:
  created:
    - src/analytics/dashboard-index.types.ts
    - src/dashboard/view.types.ts
    - src/dashboard/router.ts
    - src/dashboard/router.test.ts
  modified: []

key-decisions:
  - "isValidActivityId is the single exported id-validation chokepoint in src/dashboard/ — every future fetch-URL builder and DOM writer must call it before using the :id route param (T-16-RT-01)"
  - "ALL_ROUTES orders '/activity/:id' last so matchRoute's order-sensitive iteration tries literal routes before the param pattern"
  - "decodeURIComponent inside matchRoute is wrapped in try/catch, returning null on malformed percent-escapes instead of throwing (T-16-RT-02)"
  - "createRouter and navigateTo are deliberately excluded from unit tests (require window/location, unavailable in vitest's node environment) — covered by manual verification in plan 08 per repo precedent"

patterns-established:
  - "Pattern: leaf contract modules (view.types.ts) declare types/constants only, no mount implementations, to avoid import cycles with the modules that will implement DashboardView"

requirements-completed: [DASH-01, DASH-02]

duration: 12min
completed: 2026-08-10
---

# Phase 16 Plan 03: Dashboard Data Contract and Hash Router Summary

**Published dashboard index manifest contract, view registry record shape, and a hand-rolled hash router with dual-trigger (hashchange + initial-load) resolution and a single id-validation chokepoint, all unit-tested via TDD.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-10T18:32:00Z (approx)
- **Completed:** 2026-08-10T18:44:30Z
- **Tasks:** 3 (Task 3 executed as RED → GREEN TDD cycle)
- **Files modified:** 4 created

## Accomplishments
- Declared `DashboardIndexRow`/`DashboardIndexDocument` (D-09/D-01) as the single index-row contract every Phase 16/17 plan codes against, privacy-scoped to exclude athlete/upload/external/gear identifiers
- Declared `DashboardView`/`ROUTES`/`NAV_ORDER` as the single view-registry contract (D-03/D-05), with the detail route correctly excluded from nav
- Built and TDD-tested a pure hash-parsing/route-matching core (`parseHash`, `matchRoute`, `resolveHash`, `isValidActivityId`) plus a thin DOM binding (`createRouter`, `navigateTo`) implementing the dual-trigger pattern that avoids RESEARCH.md Pitfall 1 (deep links not rendering on initial load)

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the published index manifest contract** - `858f50f` (feat)
2. **Task 2: Declare the view registry record and canonical routes** - `1fbafef` (feat)
3. **Task 3: Build the hash router with dual-trigger resolution and id validation** - `7f3e0e1` (test, RED) → `b2f66dd` (feat, GREEN)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree execution — no plan-metadata commit made here)

_Note: Task 3 used the full TDD RED/GREEN cycle; no REFACTOR commit was needed (implementation was clean on first pass, all 26 tests green)._

## Files Created/Modified
- `src/analytics/dashboard-index.types.ts` - Published index manifest contract: `DASHBOARD_INDEX_SCHEMA_VERSION`, `DashboardIndexStreams`, `DashboardIndexRow`, `DashboardIndexTotals`, `DashboardIndexDocument`
- `src/dashboard/view.types.ts` - View registry record (`DashboardView`, `ViewMountContext`) and canonical route/nav tables (`ROUTES`, `ALL_ROUTES`, `NAV_ORDER`, `STUB_PHASE`)
- `src/dashboard/router.ts` - Pure hash parser/matcher (`parseHash`, `matchRoute`, `resolveHash`, `isValidActivityId`) plus DOM binding (`createRouter`, `navigateTo`)
- `src/dashboard/router.test.ts` - 26 unit tests covering every case in the plan's `<behavior>` block, importing the real `ALL_ROUTES` table (not a fixture copy)

## Decisions Made
- Matched `best-effort.types.ts`'s exact document-envelope convention (schemaVersion/generatedAt/note/totals/payload) for `DashboardIndexDocument`, keeping the two sibling contract files stylistically consistent
- Reworded a doc-comment in `view.types.ts` that would have caused the plan's own contract-grep verification script to false-positive (the script's `s.indexOf('NAV_ORDER')` picked up an earlier prose mention of the constant name rather than the export site, pulling `'/activity/:id'` into the slice it checks) — no functional change, comment-only rewording so the literal string `NAV_ORDER` first appears at the actual export
- `isValidActivityId` uses a 20-digit ceiling per the plan's explicit spec, deliberately generous relative to real id lengths (well under 20 digits) to reject pathological input without hardcoding an exact length

## Deviations from Plan

None — plan executed exactly as written. The one doc-comment reword (see Decisions Made) was a wording adjustment to satisfy the plan's own verification script, not a deviation from the specified contract shape.

## Issues Encountered

Initial worktree setup required a manual `git reset --hard` to the plan's declared base commit (`db65c04`) — the worktree's HEAD had not yet been fast-forwarded to that commit when the agent started (merge-base check found `4967a8b` instead). Resolved before any file changes were made; no impact on plan execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 04 (index generator) and 05 (index client) can now import `dashboard-index.types.ts` directly
- Plans 06 (stub views) and 07 (view registry) can now import `view.types.ts` directly, with `NAV_ORDER` and `STUB_PHASE` ready to drive nav rendering and stub copy
- Plan 08 (manual verification) has the DOM-binding pieces (`createRouter`, `navigateTo`) ready for browser-based smoke testing, including the deep-link-on-initial-load scenario
- No blockers

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-10*
