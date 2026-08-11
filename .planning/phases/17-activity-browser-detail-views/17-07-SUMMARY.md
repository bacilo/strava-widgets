---
phase: 17-activity-browser-detail-views
plan: 07
subsystem: dashboard-data
tags: [fetch-client, gear-resolution, athlete-config, tdd, browser-client]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    plan: 05
    provides: "parseAthleteConfig — the single tolerant, all-or-nothing validation chokepoint, imported and never redeclared"
  - phase: 17-activity-browser-detail-views
    plan: 06
    provides: "data/config/gear.json and data/config/athlete.json — the committed documents both clients fetch, publish-verified"
provides:
  - "GearClient / createGearClient — fetch-once, memoized gear-map client that resolves null on every failure mode"
  - "resolveGearLabel — the pure three-step gear/device_name/omit resolution ladder (D-32/D-33)"
  - "AthleteConfigClient / createAthleteConfigClient — fetch-once athlete-config client validated exclusively through parseAthleteConfig"
affects: [17-13-detail-view-zone-panel-rendering, 17-14-detail-view-stats-header-gear-tile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-once/memoize-on-success-only client shape: unlike index-client.ts's inFlight (memoized indefinitely once resolved), these two clients clear inFlight when the resolved value is null — a degraded load (404/malformed) must retry on the next call, not replay a cached null forever"
    - "Degrade-to-null caller contract (fetchStatsJson idiom from overview.ts) applied to a memoized fetch-once client for the first time in this codebase"

key-files:
  created:
    - src/dashboard/data/gear-client.ts
    - src/dashboard/data/gear-client.test.ts
    - src/dashboard/data/athlete-config-client.ts
    - src/dashboard/data/athlete-config-client.test.ts
  modified: []

key-decisions:
  - "Memoization only caches successful loads: a null result (404, throwing json(), or a shape that fails parseGearDocument/parseAthleteConfig) clears the in-flight cache before returning, so a Retry issues a genuine new fetch rather than replaying the failure forever. This is a deliberate deviation from index-client.ts's inFlight (which stays memoized once settled, success or reject) — required by the plan's explicit behavior bullet, since these two clients resolve rather than reject on failure and a resolved null would otherwise be indistinguishable from a resolved success in the memo cache."
  - "athlete-config-client.ts imports and re-exports AthleteConfig from detail-zones.ts rather than redeclaring it, and contains zero zone-shape checks of its own (verified by the plan's grep acceptance criterion) — parseAthleteConfig remains the single validation chokepoint."

patterns-established:
  - "A fetch client whose caller contract is 'never reject, resolve null on degradation' needs its own inFlight-reset rule distinct from index-client.ts's reject-only reset — future config-file clients (if any) should copy this success-only memoization shape, not index-client.ts's literal reset code."

requirements-completed: [DETAIL-01, DETAIL-05]

# Metrics
duration: 25min
completed: 2026-08-11
---

# Phase 17 Plan 07: Gear & Athlete Config Browser Clients Summary

**Two fetch-once browser clients (gear map, athlete HR-zone config) copying `index-client.ts`'s memoization shape but degrading to `null` instead of rejecting, plus the pure three-step gear-resolution ladder that never leaks a raw gear id or renders an empty tile.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed (both TDD: RED then GREEN)
- **Files modified:** 4 (all created)

## Accomplishments

- `gear-client.ts`: `parseGearDocument` (tolerant, entry-level parse of the committed `data/config/gear.json` body) and `resolveGearLabel` (the D-32/D-33 three-step ladder: mapped gear name → device name → omit), both pure and total, plus `createGearClient` following `index-client.ts`'s fetch-once shape.
- `athlete-config-client.ts`: `createAthleteConfigClient`, structurally identical to the gear client, but validation is delegated entirely to `parseAthleteConfig` (imported from `detail-zones.ts`, plan 17-05) — no second validation path.
- Both clients: `load()` never rejects; a 404, a throwing `json()` (HTML error page served with 200), or a well-formed-but-wrong-shape body all resolve to `null`. Three concurrent `load()` calls invoke the underlying fetch exactly once. After a failed/null load, the next `load()` issues a genuine new fetch rather than replaying the cached failure — only successful loads are memoized for the rest of the page session.
- 37 new tests (26 gear-client, 11 athlete-config-client), all passing; full suite (591 tests / 27 files) green; `npx tsc --noEmit` clean.

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: Gear client and the gear/device_name/omit resolution ladder**
   - `48c4818` (test) — failing tests for `resolveGearLabel` (9 tests, including a 6-combination raw-id-never-leaked assertion), `parseGearDocument` (10 tests), and `createGearClient` (7 tests: fetch-once, degrade-to-null, reset)
   - `1fad85e` (feat) — real implementation, all 26 tests green
2. **Task 2: Athlete config client routed through the single validation chokepoint**
   - `819c0c6` (test) — failing tests for `createAthleteConfigClient` (11 tests: success path, degrade-to-null across 4 failure modes, reset, URL assertion)
   - `14f639f` (feat) — real implementation, all 11 tests green (plus a type-safety fix to the test fixture's return type, folded into this commit since it landed before the GREEN commit was finalized)

**Plan metadata:** committed alongside this summary (worktree mode — orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md centrally after merge).

## Files Created/Modified

- `src/dashboard/data/gear-client.ts` (143 lines) — `GearMapDocument`, `parseGearDocument`, `resolveGearLabel`, `GearClientOptions`, `GearClient`, `createGearClient`
- `src/dashboard/data/gear-client.test.ts` (211 lines) — 26 tests covering every behavior bullet
- `src/dashboard/data/athlete-config-client.ts` (83 lines) — `AthleteConfigClientOptions`, `AthleteConfigClient`, `createAthleteConfigClient`, re-exports `AthleteConfig`
- `src/dashboard/data/athlete-config-client.test.ts` (167 lines) — 11 tests covering every behavior bullet

## Decisions Made

- Memoization deviates from `index-client.ts`'s literal `inFlight` reset (which only clears on *rejection*): since these clients resolve to `null` instead of rejecting on failure, the `inFlight` promise is cleared whenever the *resolved value* is `null`, not just on a thrown error. This was required by the plan's explicit behavior bullet ("a failed load does not memoize the failure") and is the one place this plan's client shape genuinely differs from its named analog — documented here rather than silently copied wrong.
- `athlete-config-client.ts` re-exports `AthleteConfig` via `export type { AthleteConfig }` sourced from `detail-zones.ts`, per the plan's explicit instruction to re-export rather than redeclare.

## Deviations from Plan

None architectural. Two minor auto-fixes during test authoring (Rule 1 — bugs in my own test code, not the implementation under test):

**1. [Rule 1 - Bug] Fixed a self-contradicting test case in `gear-client.test.ts`**
- **Found during:** Task 1, writing the "never returns the raw gear id" test
- **Issue:** One of the 6 input combinations passed the raw gear id string itself as `deviceName`, which is a legitimately valid (if unusual) device name — the function correctly returned it, causing a false-negative test failure.
- **Fix:** Changed that combination's `deviceName` to a whitespace-only string (`'   '`), which correctly exercises the "blank device name → null" branch instead.
- **Files modified:** `src/dashboard/data/gear-client.test.ts`
- **Commit:** folded into `1fad85e` (test file was staged alongside the GREEN implementation commit since the fix was made before the first passing run)

**2. [Rule 1 - Bug] Fixed a TypeScript spread-type error in `athlete-config-client.test.ts`**
- **Found during:** Task 2, running `npx tsc --noEmit` after the GREEN test pass
- **Issue:** `makeValidAthleteConfigBody()` was typed to return `unknown`, so `{ ...makeValidAthleteConfigBody(), maxHr: 0 }` failed with TS2698 ("Spread types may only be created from object types").
- **Fix:** Gave the fixture function an explicit `ValidAthleteConfigBody` interface return type instead of `unknown`.
- **Files modified:** `src/dashboard/data/athlete-config-client.test.ts`
- **Commit:** folded into `14f639f`

## Issues Encountered

None beyond the two auto-fixed test bugs above.

## User Setup Required

None — no external service configuration required. Both clients read the already-committed `data/config/gear.json` and `data/config/athlete.json` (plan 17-06); no new environment variables, secrets, or manual steps.

## Next Phase Readiness

- `resolveGearLabel` + `createGearClient` are ready for plan 17-14 (detail view stats header) to wire the Gear tile.
- `createAthleteConfigClient` is ready for plan 17-13 (detail view zone panel) to fetch the config and hand it to `computeHrZoneTimes` alongside the stream's `hr` array.
- No blockers. Both clients are DOM-free browser-fetch modules — no Leaflet/Chart.js lazy-import concerns apply here.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## TDD Gate Compliance

Both tasks show the required RED → GREEN commit sequence:
- Task 1: `48c4818` (test, RED) → `1fad85e` (feat, GREEN)
- Task 2: `819c0c6` (test, RED) → `14f639f` (feat, GREEN)

No REFACTOR commits were needed for either task.

## Self-Check: PASSED

- FOUND: src/dashboard/data/gear-client.ts
- FOUND: src/dashboard/data/gear-client.test.ts
- FOUND: src/dashboard/data/athlete-config-client.ts
- FOUND: src/dashboard/data/athlete-config-client.test.ts
- FOUND: .planning/phases/17-activity-browser-detail-views/17-07-SUMMARY.md
- FOUND: commit 48c4818 (test: gear client RED)
- FOUND: commit 1fad85e (feat: gear client GREEN)
- FOUND: commit 819c0c6 (test: athlete config client RED)
- FOUND: commit 14f639f (feat: athlete config client GREEN)
