---
phase: 21-overview-rebuild
plan: 06
subsystem: ui
tags: [typescript, vitest, dom, dashboard]

# Dependency graph
requires:
  - phase: 21-overview-rebuild (plan 21-01)
    provides: "currentStreakEnd threaded through streak-utils.ts -> analytics.types.ts -> compute-advanced-stats.ts -> streaks.json, and records-logic.ts's selectCurrentStreak reading it"
  - phase: 21-overview-rebuild (plan 21-04)
    provides: "Overview's private row renderer retired; both cards call the shared renderActivityRow(row, surface) from list.ts"
provides:
  - "Overview's Headline Stats grid renders eight tiles: the original six plus Distance This Year and Hours This Year, sourced from data/stats/yearly-stats.json matched on periodLabel against the browser's current UTC year"
  - "Overview's Current Streak tile gains an `ended {date}` third line (buildStatCard's new optional sublabel parameter) when the streak has ended and its end day is known, mirroring records.ts's buildSuperlativeTile"
  - "Three exported pure functions (selectThisYearStats, thisYearTileValues, currentStreakSublabel) making every rendered value on this card assertable without a DOM"
affects: ["21-07 (browser checkpoint proving the two new tiles' placement/theming and the sub-label's visible third line, rows R11-R13)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "records-logic.ts's isRecord/hasOwn tolerant-parse idiom copied locally into overview.ts for selectThisYearStats, matched on periodLabel rather than array position (D-11) so a clock-dependent lookup never silently degrades to the wrong year's numbers"
    - "buildStatCard's third optional sublabel parameter mirrors records.ts's buildSuperlativeTile exactly (same guard, same className, same parameter name) so both view modules' tile-with-context shape stay grep-discoverable as one pattern"

key-files:
  created: []
  modified:
    - src/dashboard/views/overview.ts
    - src/dashboard/views/overview.test.ts

key-decisions:
  - "currentStreakSublabel only adds the 'ended' branch, not an 'active' branch — D-15 scopes this change to the case Overview was missing; Records' 'active' sub-label was not ported since D-15 does not ask for it"
  - "Overview keeps its own local StreaksStats interface (now exported) rather than importing records-logic.ts's shape — matches the existing cross-view duplication rather than introducing a new module dependency"
  - "selectThisYearStats and thisYearTileValues are separate pure functions (parse, then format) so a test can assert the parsed value and the formatted value independently, matching this file's fetchStatsJson/render separation"

patterns-established: []

requirements-completed: [OVR-04, FIX-01]

# Metrics
duration: ~20min
completed: 2026-08-18
---

# Phase 21 Plan 06: Overview Headline Stats — this-year tiles and streak sub-label Summary

**Headline Stats grows from six tiles to eight (Distance This Year, Hours This Year, sourced from `yearly-stats.json` matched on the current UTC year), and the Current Streak tile gains the `ended {date}` sub-label the Records tile already had — closing OVR-04 and the Overview half of FIX-01.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-18
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments
- `buildStatCard(value, label, sublabel?)` gained a third, optional parameter that appends a guarded third `.text-label` line — the exact shape `records.ts`'s `buildSuperlativeTile` already used, so both view modules' "tile with context" idiom is now identical.
- `currentStreakSublabel(streaks)` reads `StreaksStats.currentStreakEnd` (now present on the interface thanks to plan 21-01) through a `typeof` guard, returning `` `ended ${date}` `` only when the streak has genuinely ended and its end day is known — D-13's degrade path (a pre-compute-run `streaks.json` with the field absent) renders the tile with no third line, never a crash or the literal string `'ended undefined'`.
- `selectThisYearStats(raw, year)` tolerantly parses `yearly-stats.json`, matching the entry whose `periodLabel` equals `String(year)` — never by array position, so a January run before the nightly rebuild degrades honestly to em-dashes instead of silently showing last year's totals as "This Year" (D-11).
- `thisYearTileValues(stats)` formats the two new tile strings, converting `yearly-stats.json`'s `totalMovingTimeMin` (minutes) to hours via `/ 60` — an asymmetry against `all-time-totals.json`'s `totalHours`, which already publishes hours.
- The grid now appends "Distance This Year" and "Hours This Year" after the existing six tiles, with zero reordering and zero CSS change (`.stat-grid`'s `repeat(auto-fit, minmax(200px, 1fr))` already handles 6-to-8 children).
- `mount()`'s `Promise.all` gained one guarded `fetchStatsJson` call for `yearly-stats.json`; a missing/unreachable file degrades only the two new tiles to em-dashes, leaving the other six and the error state's trigger untouched.
- 18 new/updated test cases in `overview.test.ts` pin every value string either new feature can render, including the D-11 last-entry regression guard and the Pitfall-1 discriminator (a `currentStreakStart` present alongside `currentStreakEnd` must not leak into the sub-label).

## Task Commits

Each task was committed atomically:

1. **Task 1: buildStatCard gains a sub-label, and the Current Streak tile uses it (D-15)** - `bfebaef` (feat)
2. **Task 2: This-year distance and hours tiles (OVR-04)** - `082fc00` (feat)
3. **Task 3: Value, format and degradation coverage** - `dfefe68` (test)

**Plan metadata:** committed separately per worktree-mode convention (SUMMARY.md only; STATE.md/ROADMAP.md updates deferred to orchestrator)

## Files Created/Modified
- `src/dashboard/views/overview.ts` - `StreaksStats` exported and gained `currentStreakEnd`; `buildStatCard` gained an optional `sublabel` parameter; new exported `currentStreakSublabel`, `ThisYearStats`, `selectThisYearStats`, `thisYearTileValues`, plus local `isRecord`/`hasOwn` helpers; `buildHeadlineStatsCard` takes a third `thisYear` parameter and appends the two new tiles; `mount()`'s `Promise.all` fetches `yearly-stats.json` and resolves the current UTC year
- `src/dashboard/views/overview.test.ts` - two new describes covering `selectThisYearStats`/`thisYearTileValues` (OVR-04/D-10/D-11) and `currentStreakSublabel` (FIX-01/D-15); header comment extended to name the manual-only remainder and point at plan 21-07's checkpoint rows R11-R13

## Decisions Made
See `key-decisions` in frontmatter. No decisions outside what the plan's `<interfaces>` and `<action>` blocks already specified.

## Deviations from Plan

None in source code — plan executed exactly as written for all three tasks.

**One environment-only action outside the plan's file list:** as noted in this session's environment guidance, the fresh git worktree does not carry gitignored, locally-generated `data/stats/` and `data/dashboard/` directories. Task 2's verification runs `npm run build-widgets`, which reads `data/stats/*.json` to publish it into `dist/widgets/data/`. Copied both directories from the main checkout at `/Users/pedf/workspace/strava-widgets` (local generated JSON, no network or git operations, nothing committed — both are gitignored) before running the build. This is a worktree-isolation artifact of the execution environment, not a code change.

## Issues Encountered

- Task 1's own verification script tests for `typeof streaks.currentStreakEnd === 'string'` (the positive form). My first draft of `currentStreakSublabel` used the logically-equivalent negated form (`!== 'string' || ... === 0`) with an early return; the automated verify's regex only matched the positive form. Rewrote to the positive `if (typeof ... === 'string' && ...length > 0) return ...; return undefined;` shape to match the plan's specified idiom exactly (same behavior, same idiom as the plan's `<action>` text) — no scope change, just matching the plan's literal wording rather than an equivalent rewording.
- My first draft of Task 3's "LAST-ENTRY REGRESSION GUARD" test accidentally included the real 2026 entry in the reordered fixture (just moved to a non-last position), so the correct implementation legitimately found it and the test failed with an assertion mismatch — not a source bug, a test-authoring mistake. Fixed by dropping the 2026 entry from that fixture entirely (only 2024 and 2025 entries, last position 2025) so the guard actually exercises "no entry matches the target year" rather than "the target year is present at position 0". Full gate (`npm test && npx tsc --noEmit && npm run build-widgets`) is green after the fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Overview's Headline Stats card now has eight tiles and the Current Streak tile's sub-label — both entirely covered by automated exact-string assertions in `overview.test.ts`, per this plan's own `<verification>` scope. Nothing here can confirm the two new tiles' visual placement in `.stat-grid`, how they read in either theme, or that the sub-label renders as a visible third line in a real browser — that is plan 21-07's checkpoint, rows R11-R13, as `21-VALIDATION.md` already lists them manual-only. No blockers.

---
*Phase: 21-overview-rebuild*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: src/dashboard/views/overview.ts
- FOUND: src/dashboard/views/overview.test.ts
- FOUND: .planning/phases/21-overview-rebuild/21-06-SUMMARY.md
- FOUND: bfebaef (Task 1 commit)
- FOUND: 082fc00 (Task 2 commit)
- FOUND: dfefe68 (Task 3 commit)
