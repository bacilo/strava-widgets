---
phase: 16-dashboard-shell-data-contract
plan: 11
subsystem: ui
tags: [css, theming, vitest, dashboard, wr-04]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: "Dashboard shell nav (nav.ts), theme mode logic (theme.ts), and design-token stylesheet (styles.css) built in earlier phase-16 plans; the 16-09 human checkpoint surfaced WR-04 as an open gap on this foundation"
provides:
  - "styles.css theme-toggle rules that make the control visible in both light and dark themes, on both light-OS and dark-OS machines"
  - "color-scheme: light/dark declarations synced to data-theme, replacing OS-derived ButtonText resolution"
  - "styles.test.ts — text-level regression suite locking all six WR-04 rules plus theme-manager.ts token parity"
affects: [16-15, 16-dashboard-shell-data-contract-gate]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Text-level CSS regression testing (readFileSync + comment-stripped selector-head parsing) for a node-environment vitest run with no DOM/CSSOM"]

key-files:
  created: [src/dashboard/styles.test.ts]
  modified: [src/dashboard/styles.css]

key-decisions:
  - "Used color, not fill, for the icon-swap active rule — fill on the svg root is always beaten by each child's own fill=\"currentColor\"/stroke=\"currentColor\" presentation attribute; color is inherited correctly through both fill and stroke references"
  - "color-scheme declared inside each data-theme attribute block rather than via a prefers-color-scheme media query, keeping data-theme the single source of truth (test asserts prefers-color-scheme never reappears in the file)"
  - "CSS regression test parses a comments-stripped view of the stylesheet for selector-head matching, so a header comment mentioning a selector name (e.g. \"Theme toggle\") can never masquerade as part of a rule"

patterns-established:
  - "Mutation-checked CSS regression test: manually flip the asserted declaration, confirm the suite fails, restore exactly (git diff empty), re-verify green — documented verbatim in the SUMMARY per IN-07 lesson (this phase previously shipped a vacuous green test)"

requirements-completed: [DASH-03]

# Metrics
duration: ~15min
completed: 2026-08-11
---

# Phase 16 Plan 11: Theme Toggle Visibility Fix (WR-04 gap closure) Summary

**Fixed three compounding CSS defects that made the dashboard theme toggle invisible in light mode, and locked all six fixes behind a new text-level vitest regression suite.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-11T13:13:00+02:00 (approx)
- **Completed:** 2026-08-11T13:17:06+02:00
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `:root[data-theme="light"]` and `:root[data-theme="dark"]` now declare `color-scheme`, so the browser's used color scheme follows the app's own theme attribute instead of the OS preference — fixes a dark-OS browser painting near-white `ButtonText` on the forced-light `#f5f5f7` nav surface.
- `.theme-toggle` and `.app-nav__toggle` both pin `color: var(--text)`, so the hamburger and sun/moon icons' `currentColor` fill/stroke resolve to a real theme token instead of the UA default.
- Replaced the dead `.theme-toggle__icon--active { fill: var(--accent) }` rule — always beaten by each icon child's own `fill="currentColor"`/`stroke="currentColor"` presentation attribute — with `.theme-toggle__icon { display: none }` / `.theme-toggle__icon--active { display: inline; color: var(--accent) }`, which both hides the inactive icon and correctly accent-colors the active one.
- Added `src/dashboard/styles.test.ts`: 10 assertions reading the real stylesheet off disk (vitest environment is `node`, no CSSOM) covering all six WR-04 rules plus the four design-token hex values that must stay byte-identical to `src/widgets/shared/theme-manager.ts`.
- Ran the plan's mandated mutation check by hand: flipped `display: inline` to `display: none` in `.theme-toggle__icon--active`, confirmed the suite failed exactly on that assertion, restored the file (`git diff` empty afterward), and re-ran to green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync color-scheme to data-theme, pin button color, and swap icons by display** - `a42af39` (fix)
2. **Task 2: Add a stylesheet regression test covering the six WR-04 rules and token parity** - `cc7b13d` (test)

**Plan metadata:** committed separately by orchestrator after wave merge (worktree mode — this agent does not write STATE.md/ROADMAP.md).

## Files Created/Modified

- `src/dashboard/styles.css` - Added `color-scheme` to both theme blocks, pinned `color: var(--text)` on `.theme-toggle`/`.app-nav__toggle`, replaced the dead `fill: var(--accent)` rule with a `display`-based icon swap, extended the header comment
- `src/dashboard/styles.test.ts` - New vitest suite: `declarationsFor()`/`selectorListDeclares()` helpers parse a comments-stripped view of the CSS text; asserts all six WR-04 rules, no `prefers-color-scheme` reintroduction, and token parity with `theme-manager.ts`

## Decisions Made

- Kept the `color-scheme` meta tag in `index.html` untouched (it declares browser support; the new CSS rules pin the actual choice) — plan explicitly forbade touching `index.html`, `nav.ts`, or `theme.ts`, and no edit to those files was needed.
- Chose `color` over `fill` for the active-icon highlight per the plan's explicit rationale (SVG presentation attributes on children always beat an inherited `fill` on the svg root; `color` is not overridden by either `fill="currentColor"` or `stroke="currentColor"`).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify commands, acceptance criteria, and the plan-level `<verification>` block all passed without needing any Rule 1-4 auto-fixes to the two files this plan owns (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`).

One note: the plan-level verification step 4 (`npm run verify-dashboard` reporting 15/15) required locally regenerating gitignored data artifacts (`data/dashboard/index.json` via `compute-dashboard-index`, and `data/stats/*.json` via `compute-all-stats`) that were absent in this fresh worktree checkout — those commands are pre-existing project scripts, not part of this plan's scope, and their outputs are gitignored so nothing was committed for them. A side-effect timestamp-only diff in `data/geo/geo-metadata.json` from that pipeline run was reverted with `git checkout --` since it was unrelated to this plan's files.

## Mutation Check (plan-mandated, task 2)

- Changed `src/dashboard/styles.css` `.theme-toggle__icon--active` from `display: inline;` to `display: none;`.
- Ran `npx vitest run src/dashboard/styles.test.ts` — 9 passed, 1 failed: `.theme-toggle__icon--active is shown and accent-colored` failed with `expected '\n  display: none;\n  color: var(--accent);\n' to contain 'display: inline'`. Confirms the test is load-bearing, not vacuous (per IN-07).
- Restored `.theme-toggle__icon--active` to `display: inline;` exactly. `git diff src/dashboard/styles.css` was empty after restoration.
- Re-ran `npx vitest run src/dashboard/styles.test.ts` — 10/10 passed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC3 (dashboard theme parity) structural CSS defects are resolved and regression-locked; the human checkpoint re-verification of toggle visibility on real light-OS/dark-OS hardware is deferred to plan 16-15 per the threat model's T-16-11-02 disposition, as this plan's own verification is text-level/automated only.
- `npm test` (344/344), `npx tsc --noEmit`, `npm run build-widgets`, and `npm run verify-dashboard` (15/15) all pass at the end of this plan.
- No blockers for the remaining phase-16 gap-closure plans.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*
