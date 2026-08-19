---
phase: 23-trends-zoom-pan-taller-bands
plan: 01
subsystem: ui
tags: [chart.js, chartjs-plugin-zoom, hammerjs, vitest, trends]

# Dependency graph
requires: []
provides:
  - "chartjs-plugin-zoom@2.2.0 and hammerjs@2.0.8 installed as declared dependencies (D-16), not yet imported anywhere"
  - "src/dashboard/views/trends-zoom-logic.ts — the pure, DOM-free logic module every later Phase 23 plan imports from (D-06/D-09/D-12/D-13/D-14/D-22)"
  - "src/dashboard/views/trends-zoom-logic.test.ts — 39 by-value assertions pinning the exact expected values the D-25 browser checkpoint (plan 23-07) will read back"
affects: [23-02, 23-03, 23-04, 23-05, 23-06, 23-07]

# Tech tracking
tech-stack:
  added: [chartjs-plugin-zoom@^2.2.0, hammerjs@^2.0.8]
  patterns:
    - "*-logic.ts pure-module split (mirrors trends-training-load-logic.ts / trends-volume-logic.ts): total, DOM-free, never constructs new Date() with no args, type-only imports of sibling *-logic.ts types"
    - "computeLimits emits literal numeric bounds only — never the chartjs-plugin-zoom 'original' sentinel string (Pitfall 1)"
    - "panDeltaPx sign convention: 'earlier' is positive, 'later' is negative, matching the plugin's verified pixel-delta semantics (Pitfall 5)"
    - "modifierKeyForPlatform takes the platform string as an argument rather than reading navigator internally, keeping the function testable under vitest's environment: 'node'"

key-files:
  created:
    - src/dashboard/views/trends-zoom-logic.ts
    - src/dashboard/views/trends-zoom-logic.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "D-16 scope correction (a): Hammer.js is on the critical path for ALL panning including plain desktop mouse drag-to-pan (D-15), not only touch/pinch as D-16's original text stated — verified against chartjs-plugin-zoom@2.2.0's shipped source (startHammer wires Hammer.Pan for the pan gesture regardless of pointer type). The dependency decision stands; only its stated scope was too narrow. Nothing later in this phase may assume Hammer could be loaded only on touch devices."
  - "D-16 scope correction (b): hammerjs has had no release since 2022-11-18 (~3.75 years stale) and no maintained fork drops it (chartjs/chartjs-plugin-zoom#938 open, no timeline). This is a knowingly-accepted, recorded cost per D-16, not a new discovery — recorded here per the plan's own instruction to restate it in the plan summary."
  - "isAtFullRange is defined as isAtEarliestEdge(current, full) && isAtLatestEdge(current, full) — not explicitly spelled out as a formula in the plan text, but follows directly from the plan's own edge-predicate tolerance rule and is exercised by its own describe block."

patterns-established:
  - "Test-file-deferred-to-a-later-task split: Task 2 (tdd=\"true\") creates only the implementation; the plan's own text explicitly defers trends-zoom-logic.test.ts to Task 3 and states Task 2's verify deliberately excludes the test gate. Honored literally per the plan's stated intent rather than the generic RED-before-GREEN TDD flow."

requirements-completed: [TRN-01, TRN-02, TRN-04]

# Metrics
duration: ~12min
completed: 2026-08-19
---

# Phase 23 Plan 01: Zoom dependencies and pure zoom-logic module Summary

**Installed chartjs-plugin-zoom@2.2.0 + hammerjs@2.0.8 and built `trends-zoom-logic.ts`, a 290-line pure module covering D-06 default windows, D-09 limits, D-12 zoom/pan arithmetic, D-13 label formatting, D-14 modifier-key resolution and D-22 restore-or-default, pinned by 39 by-value assertions in `trends-zoom-logic.test.ts`.**

## Performance

- **Duration:** ~12 min (17:04:58 to first commit through 17:08:20 last commit)
- **Started:** 2026-08-19T17:04:58+02:00
- **Completed:** 2026-08-19T17:08:20+02:00
- **Tasks:** 3 (all auto)
- **Files modified:** 4 (package.json, package-lock.json, trends-zoom-logic.ts, trends-zoom-logic.test.ts)

## Accomplishments

- `chartjs-plugin-zoom@2.2.0` and `hammerjs@2.0.8` installed and declared in `package.json`, with no source file importing either yet (verified: `grep -rn "chartjs-plugin-zoom\|hammerjs" src/ | wc -l` → `0`)
- `trends-zoom-logic.ts` created: 20 named exports (types, constants, functions) matching the plan's `<interfaces>` block exactly, `npx tsc --noEmit` clean, and the forbidden-token gate (`original`/`localStorage`/`sessionStorage`/`Date.now`/`new Date()`/`document`/`window.`) passes
- `trends-zoom-logic.test.ts` created: 39 assertions across 11 describe blocks, all five `-t` filters from `23-VALIDATION.md` (`computeDefaultWindow`, `computeLimits`, `panDeltaPx`, `formatRangeLabel`, `restoreOrDefault`) resolve to real, passing tests
- Every exact expected value the plan pre-computed matched my implementation on the first test run with zero adjustment needed — confirms the constant tables (`PERIOD_MS`/`DEFAULT_SPAN_MS`/`MIN_RANGE_MS`/`LOAD_WINDOW_SPAN_MS`) were transcribed correctly
- Mutation check executed and reverted: flipping `DEFAULT_SPAN_MS['volume-weekly']` to `null` turned exactly the two weekly-default/no-2011 assertions RED (2 failures, 37 still passing); reverted, confirmed green again (39/39); `git diff --stat` on the source file after revert shows no residual diff from the Task 2 commit
- Full suite green: 54 test files, 1311 tests (see Deviations for the fixture-copy step that raised this from 48/1179 pre-copy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install chartjs-plugin-zoom and hammerjs** - `c002025` (feat)
2. **Task 2: Create trends-zoom-logic.ts** - `76cdcce` (feat)
3. **Task 3: Create trends-zoom-logic.test.ts** - `65c1840` (test)

_Note: Task 2 is marked `tdd="true"` in the plan, but the plan's own text explicitly splits implementation (Task 2) and tests (Task 3) into separate tasks and states Task 2's verify deliberately excludes the test gate ("Task 3's verify is the real gate for this module's behaviour") — honored as written rather than forcing a RED-before-GREEN commit order the plan itself does not ask for._

## Files Created/Modified

- `package.json` / `package-lock.json` - added `chartjs-plugin-zoom@^2.2.0` and `hammerjs@^2.0.8` as declared dependencies
- `src/dashboard/views/trends-zoom-logic.ts` - pure, DOM-free logic: `volumeScaleKey`, `computeArchiveBounds`, `computeFullRange`, `computeDefaultWindow`, `computeLimits`, `loadWindowRange`, `panDeltaPx`, `formatRangeLabel`, `withRangeSuffix`, `restoreOrDefault`, `rangesEqual`, `isAtFullRange`/`isAtEarliestEdge`/`isAtLatestEdge`, `modifierKeyForPlatform`, `zoomHintText`, plus `ZOOM_FACTOR`/`PAN_FRACTION` constants and `ZoomScaleKey`/`ZoomRange` types
- `src/dashboard/views/trends-zoom-logic.test.ts` - 39 assertions pinning every behaviour above by value against the real archive bounds

## npm audit summary

```
13 vulnerabilities (1 low, 10 high, 2 critical)
```
All 13 pre-existing and unrelated to the two new packages: `node-tar` (via `offline-geocoder` → `sqlite3` → `node-pre-gyp`, no fix available), `vite` (5 advisories, fix available via `npm audit fix`), `vitest` (1 critical, fix available). No advisory names `chartjs-plugin-zoom` or `hammerjs` — confirmed by reading the full `npm audit` output line by line, not just the summary count. Per the plan's own instruction, a pre-existing advisory unrelated to these two package names is recorded context, not a blocker.

## Decisions Made

- D-16 scope correction (a) and (b) — see `key-decisions` above (Task 1's plan action required both be recorded verbatim in substance).
- `isAtFullRange(current, full)` implemented as the conjunction of `isAtEarliestEdge` and `isAtLatestEdge` — the plan's `<action>` text states the tolerance convention for each edge predicate individually but does not spell out `isAtFullRange`'s own formula; the conjunction is the only definition consistent with "true exactly at the full range" and is exercised by its own test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied gitignored `data/stats/*.json` and `data/dashboard/index.json` fixtures into the worktree to run `npm test`**
- **Found during:** Task 1 verification (`npm test`, first run before any code change in this plan)
- **Issue:** 5 test files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) read gitignored, pipeline-generated files directly from disk at module load time (`data/stats/*.json`, `data/dashboard/index.json`). These files are present in the main repo checkout but absent from this fresh git worktree — worktrees do not carry untracked/gitignored files, and this repo's data pipeline output is deliberately gitignored (`.gitignore:11`). This is the same known limitation plan 22-01/22-02 documented and resolved identically (see `22-02-SUMMARY.md` Deviations).
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main checkout (`/Users/pedf/workspace/strava-widgets/data/`) into this worktree.
- **Files modified:** None tracked — `git status --short` after the copy shows only `package.json`/`package-lock.json` (Task 1's real change); the copied data files do not appear in git status at all (gitignored).
- **Verification:** `npm test` went from 48/53 files passing (1179/1179 individual tests passing, 5 files failing to even load) to 53/53 files, 1272/1272 tests passing immediately after the copy, before any of this plan's own code was written.
- **Committed in:** N/A — untracked, gitignored, not committed (matches plan 22-01/22-02's precedent exactly).

---

**Total deviations:** 1 auto-fixed (1 blocking, pre-existing environment gap unrelated to this plan's own file changes)
**Impact on plan:** No scope creep — the fixture copy is a worktree-environment workaround with an established precedent in this same phase-execution model, not a code or architecture change. All of this plan's own three tasks (`package.json`/`package-lock.json`, `trends-zoom-logic.ts`, `trends-zoom-logic.test.ts`) executed exactly as written with no further deviations.

## Issues Encountered

None beyond the fixture-copy deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `trends-zoom-logic.ts`'s full documented contract (20 exports) is ready for plan 23-04 to import inside the lazy `trends-charts.ts` chunk — no source file imports `chartjs-plugin-zoom`/`hammerjs` yet, so the LAZY-CHUNK BOUNDARY rule is untouched by this plan.
- The exact expected-value table plan 23-07's browser checkpoint will read back is pinned in `trends-zoom-logic.test.ts`: weekly default window `2025-08-13T12:00:00.000Z` to `2026-08-13T12:00:00.000Z` (label `"Aug 2025 to Aug 2026"`), monthly default window `2021-08-15T23:15:00.000Z` to `2026-08-16T05:15:00.000Z`, yearly default window equals yearly full range `2010-07-02T09:00:00.000Z` to `2026-07-02T15:00:00.000Z`, training-load 12mo default `2025-08-11T12:00:00.000Z` to `2026-08-11T12:00:00.000Z`.
- No blockers. This worktree still lacks generated `data/stats`/`data/dashboard` in git-tracked form (by design, gitignored) — any downstream plan executed in a *different* fresh worktree will need the same fixture-copy step if its own tasks touch a `*-logic.test.ts` file reading those paths.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*
