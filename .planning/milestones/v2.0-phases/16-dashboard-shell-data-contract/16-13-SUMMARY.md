---
phase: 16-dashboard-shell-data-contract
plan: 13
subsystem: infra
tags: [vite, github-actions, ci-cd, build-pipeline, gap-closure]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 09)
    provides: dashboard SPA build (buildDashboard) and verify-dashboard-publish.mjs exit-gate script, both landed but the first was silently unprotected and the second was never wired into CI
provides:
  - Correctly-spelled emptyOutDir guard on all three Vite build configurations (build-widgets.mjs x3, vite.config.pages.ts, vite.config.ts) — the dist/widgets/ protection is now real, not a silently-ignored misspelling
  - npm test and npm run verify-dashboard as blocking pre-deploy gates in daily-refresh.yml, positioned after Build widgets and before the gh-pages deploy
affects: [16-14, any future plan touching scripts/build-widgets.mjs or .github/workflows/daily-refresh.yml]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "emptyOutDir (not emptyDir) is Vite's real build option name — grep for the correct spelling before trusting any future Vite config touching outDir"
    - "CI publish pipeline gates: blocking steps (no continue-on-error) placed between the artifact-producing step and the deploy step, distinct from the pipeline's deliberate continue-on-error resilience steps upstream"

key-files:
  created: []
  modified:
    - scripts/build-widgets.mjs
    - vite.config.pages.ts
    - vite.config.ts
    - .github/workflows/daily-refresh.yml

key-decisions:
  - "All five emptyDir->emptyOutDir renames are behavior-preserving: each occurrence's boolean value already matched Vite's own default for that outDir/root relationship (outDir inside root defaults to emptying; outDir outside root defaults to not emptying), so the rename only makes an already-true guard declared instead of assumed."
  - "scripts/build-widgets.ts (the .ts sibling, not .mjs) was left untouched — confirmed stale dead code, last modified 2026-02-14 in phase 03-03, superseded by build-widgets.mjs which is what package.json and CI actually run, excluded from tsconfig's src/**/* include. Noted as a cleanup candidate for a later phase, not touched in this gap-closure plan."
  - "16-CONTEXT.md's canonical-refs line (which also carries the emptyDir misspelling) was left untouched — it is the historical record of the decision as taken; the correction belongs in code."
  - "Comment text naming emptyOutDir was kept on the same line as (or immediately trailing) the actual option assignment rather than on a separate standalone comment line, so the grep -c 'emptyOutDir' acceptance counts (3 for build-widgets.mjs, 1 each for the two vite.config files) match the real code occurrences exactly, with no inflation from prose repeating the token."

patterns-established:
  - "Publish-pipeline gate placement: test-then-verify ordering (fast logic check before slower HTTP probe), inserted strictly between artifact build and deploy, with an explanatory comment recording both why the gate exists and its known limits (HTTP probe cannot catch browser-side/client logic regressions like CR-01)."

requirements-completed: [DASH-01]

# Metrics
duration: 25min
completed: 2026-08-11
---

# Phase 16 Plan 13: Real outDir guard + wired publish-pipeline exit gate

**Renamed all five Vite `emptyDir` typos to the real `emptyOutDir` option (behavior-preserving) and inserted `npm test` + `npm run verify-dashboard` as blocking gates between `Build widgets` and the gh-pages deploy in `daily-refresh.yml`, closing WR-05 and WR-06.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-11T13:05:00Z (approx)
- **Completed:** 2026-08-11T13:30:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `scripts/build-widgets.mjs`, `vite.config.pages.ts`, and `vite.config.ts` now spell Vite's real outDir-emptying option (`emptyOutDir`) everywhere; the guard protecting `dist/widgets/` from being wiped mid-build is now actually declared to Vite instead of silently relying on an undocumented default.
- `daily-refresh.yml`'s publish pipeline now runs the full vitest suite and the 15-check `verify-dashboard-publish.mjs` HTTP probe as blocking steps before the GitHub Pages deploy — closing the gap where both were wired in `package.json` but never executed in the pipeline that actually publishes.
- Full local pipeline exercised end-to-end to confirm the gate is green today: `npm run build` -> `compute-stats` -> `compute-advanced-stats` -> `compute-dashboard-index` -> `npm run build-widgets` -> `npm test` (334/334 passed) -> `npm run verify-dashboard` (15/15 passed) -> `npx tsc --noEmit` (clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename every emptyDir option to Vite's real emptyOutDir** - `8b0eff9` (fix)
2. **Task 2: Wire npm test and verify-dashboard into daily-refresh.yml as blocking pre-deploy gates** - `1fa149a` (feat)

**Plan metadata:** (this commit, applied by the orchestrator after wave merge — worktree mode does not self-commit STATE.md/ROADMAP.md)

## Files Created/Modified
- `scripts/build-widgets.mjs` - Renamed 3 occurrences of `emptyDir` to `emptyOutDir` (buildWidget: true, buildPages: false, buildDashboard: false); updated the CRITICAL comment on buildDashboard's outDir option to name `emptyOutDir` explicitly, on the same line as the assignment, without adding an extra grep match
- `vite.config.pages.ts` - Renamed `emptyDir: false` to `emptyOutDir: false`, updated the inline CRITICAL comment to name the option correctly
- `vite.config.ts` - Renamed `emptyDir: true` to `emptyOutDir: true` (unrelated `dist/widget` singular directory, not the publish path)
- `.github/workflows/daily-refresh.yml` - Inserted `Run test suite` (`npm test`) and `Verify dashboard publish contract` (`npm run verify-dashboard`) between the existing `Build widgets` and `Commit updated data and stats` steps, both without `continue-on-error`, with an explanatory comment above the pair

## Decisions Made
- Kept every `emptyOutDir` literal-token mention co-located with its code assignment (either on the same line, as in `vite.config.pages.ts` and the reworked `buildDashboard()` comment, or as a standalone comment block that does not repeat the token) so the plan's exact grep-count acceptance criteria (`3` for `build-widgets.mjs`, `1` for each vite.config file) held precisely rather than approximately. An earlier draft of the `buildDashboard()` comment and the CI-gate comment each accidentally introduced a 4th/6th match (`emptyOutDir` appearing in prose on its own line; `continue-on-error` appearing in prose describing why the new steps have none) — both were caught during acceptance verification and rephrased before committing.
- Ran the full local data pipeline (`compute-stats`, `compute-advanced-stats`, `compute-dashboard-index`) before the final `build-widgets`/`verify-dashboard` verification pass, because `data/stats/` and `data/dashboard/` are gitignored generated directories absent from a fresh worktree checkout — needed to satisfy the plan's acceptance criterion that `dist/widgets/data` contains `dashboard`, `activities`, `streams` and `stats`. This is a verification-environment action, not a change in scope for Task 2's actual deliverable (the workflow YAML edit).

## Deviations from Plan

None — plan executed exactly as written. The two self-corrections above (grep-count-safe comment phrasing) were caught and fixed during the plan's own acceptance-criteria verification loop before any commit was made, not after-the-fact bug fixes to committed code, so they are not logged as Rule 1/2/3 deviations.

## Issues Encountered
- Initial draft of the `buildDashboard()` CRITICAL comment and the new CI-gate explanatory comment each introduced an extra literal match against the plan's exact grep-count acceptance criteria (`emptyOutDir` count and `continue-on-error` count respectively). Resolved before committing by keeping the option name attached to its code line and rephrasing "no continue-on-error" as "no error-tolerant escape hatch" in the CI comment.
- `data/stats/` and `data/dashboard/` did not exist in the fresh worktree checkout (both gitignored, generated by pipeline commands). Ran `npm run build && node dist/index.js compute-stats && node dist/index.js compute-advanced-stats && node dist/index.js compute-dashboard-index` locally, entirely offline (no INTERVALS_API_KEY needed — these commands only read already-committed `data/activities/` and `data/streams/`), to populate them before the final `build-widgets`/`verify-dashboard` verification pass. Neither directory is git-tracked, so this left no trace in the commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- WR-05 and WR-06 are closed: the `dist/widgets/` outDir guard is real, and the publish pipeline's own exit gate now actually runs before every nightly deploy.
- Plan 16-14 (the next plan in this gap-closure sequence, per the plan's own note) will be the first post-push run gated by these two new blocking CI steps — a red test suite or a failed `verify-dashboard` probe will now halt the deploy instead of publishing silently.
- `scripts/build-widgets.ts` remains a known, documented cleanup candidate (stale dead code, unreachable from `package.json`/CI/`tsconfig`) — not addressed in this plan, flagged for a later phase.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: scripts/build-widgets.mjs
- FOUND: vite.config.pages.ts
- FOUND: vite.config.ts
- FOUND: .github/workflows/daily-refresh.yml
- FOUND: .planning/phases/16-dashboard-shell-data-contract/16-13-SUMMARY.md
- FOUND commit: 8b0eff9 (Task 1)
- FOUND commit: 1fa149a (Task 2)
- FOUND commit: 49b3e79 (SUMMARY.md)
