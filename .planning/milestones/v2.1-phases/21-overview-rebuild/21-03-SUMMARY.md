---
phase: 21-overview-rebuild
plan: 03
subsystem: ui
tags: [css, flexbox, vitest, design-tokens]

# Dependency graph
requires:
  - phase: 21-overview-rebuild (plan 21-02)
    provides: "renderActivityRow's D-06 two-line DOM (div.activity-row__header > div.activity-row__name + div.activity-row__badges, then div.activity-row__meta) and the frozen class contract this plan lays out"
provides:
  - "The D-06 two-line row layout: .activity-row as a column flex container, .activity-row__header as a nowrap row (name grows via flex: 1 1 auto/min-width: 0, badges pinned right via justify-content: space-between and held to flex-shrink: 0), .activity-row__badges never wrapping onto the meta line"
  - "Cascade-aware test coverage proving the D-06 shape and every D-08-frozen bordered-card value (background, border-radius: 8px, padding: var(--space-md) on .activity-row; gap: var(--space-sm) on .activity-list) is unchanged"
affects: ["21-04 (Overview's overview-prs/overview-activities call sites render against this same layout)", "21-07 (checkpoint rows R1-R4 verify the rendered geometry this plan's tests cannot)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multiply-declared top-level selector edits go through cascadeWinningBodyDeclaring + assertNoAtRuleOverride, never bare declarationsFor/selectorListDeclares — .activity-row is now declared three times at top level (base rule, Phase 20's text-decoration: none, this phase's new gap-only block) and .activity-row__name twice (base type-role rule, this phase's flex/min-width block)"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Edited flex-direction/flex-wrap IN PLACE on the existing .activity-row rule (styles.css:338) rather than overriding them in the new Phase 21 block, to avoid the declared-twice trap cascadeWinningBodyDeclaring exists to catch (Phase 19's dead --radius-control token is the project's own precedent for what that costs)"
  - ".activity-row__name's new flex: 1 1 auto/min-width: 0 pair lives in a second top-level rule for the same selector (in the new Phase 21 block), not merged into the pre-existing type-role rule — mirrors how .activity-row itself is already split across concerns (base box rule, Phase 20's text-decoration rule)"
  - "The new .activity-row gap: var(--space-xs) declaration is a NEW property on that selector, not a redeclaration of anything D-08 froze — D-08 never named a .activity-row gap, only .activity-list's"

patterns-established: []

requirements-completed: [OVR-01, OVR-02]

# Metrics
duration: ~15min
completed: 2026-08-18
---

# Phase 21 Plan 03: D-06 Two-Line Activity Row Layout Summary

**`.activity-row` becomes a column flex container with a nowrap header line (name grows, badges pinned right via `justify-content: space-between` + `flex-shrink: 0`) over the meta line, with every D-08-frozen bordered-card value pinned unchanged by a cascade-aware test.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-18
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `.activity-row`'s `flex-direction: row; flex-wrap: wrap` (the literal mechanism behind OVR-01's "three stacked divs" complaint) became `flex-direction: column`, edited in place rather than overridden 1200 lines later
- New Phase 21 banner block adds `.activity-row__header` (nowrap, `justify-content: space-between`, `align-items: baseline`), `.activity-row__name`'s `flex: 1 1 auto`/`min-width: 0` shrink-enabler, and `.activity-row__badges`'s `flex-shrink: 0` — together making the name absorb width pressure so a badge never wraps down onto the metrics line
- Added `.activity-row { gap: var(--space-xs); }` as a genuinely new property (not a D-08 redeclaration) giving the two stacked children breathing room
- 13 new cascade-aware assertions in `styles.test.ts` pin the D-06 shape (including a full scan over every top-level `.activity-row` body proving none declares `flex-wrap: wrap` anymore, not just a single cascade-winner check) and every D-08 non-regression value, using `cascadeWinningBodyDeclaring`/`assertNoAtRuleOverride` throughout since `.activity-row` and `.activity-row__name` are now both multiply-declared at top level

## Task Commits

Each task was committed atomically:

1. **Task 1: The Phase 21 layout block** - `55cc525` (feat)
2. **Task 2: Cascade-aware assertions for the new shape** - `6a5398d` (test)

## Files Created/Modified
- `src/dashboard/styles.css` - two in-place edits on `.activity-row` (`flex-direction: row` → `column`, `flex-wrap: wrap` deleted) plus a new Phase 21 banner block (`.activity-row` gap, `.activity-row__header`, `.activity-row__name` flex/min-width, `.activity-row__badges`)
- `src/dashboard/styles.test.ts` - new `describe('styles.css — Phase 21 two-line activity row (D-06/D-08)')` with 13 assertions

## Decisions Made
See `key-decisions` in frontmatter. No decisions outside what the plan's `<action>` blocks already specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Fresh worktree checkout was missing the gitignored `data/stats/` and `data/dashboard/` directories, causing 5 pre-existing, plan-unrelated test files to fail with `ENOENT` (same failure mode already logged in 21-02-SUMMARY.md's Issues Encountered). Per this session's environment note, copied both directories from the main checkout (`/Users/pedf/workspace/strava-widgets/data/stats`, `/Users/pedf/workspace/strava-widgets/data/dashboard`) — local generated JSON only, no network or git operations. Both directories are gitignored (`.gitignore:11`, `.gitignore:14`) and confirmed absent from `git status --short` after copying, so nothing extraneous was staged. `npm test` is now 49/49 files, 1102/1102 tests green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 21-04 can render `renderActivityRow(row, 'overview-prs')`/`renderActivityRow(row, 'overview-activities')` against this exact layout with no further CSS work needed — the `.activity-row__header`/`.activity-row__badges` class contract is frozen and proven by cascade-aware assertions. Plan 21-07's checkpoint rows R1-R4 remain the only way to confirm the rendered geometry (badges actually right-aligned, no wrap at 360px, reads as a hierarchy) — this plan's tests read stylesheet text only and explicitly cannot prove that. No blockers.

---
*Phase: 21-overview-rebuild*
*Completed: 2026-08-18*

## Self-Check: PASSED

All modified/created files found on disk (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `21-03-SUMMARY.md`). Both task commits found in git log (`55cc525`, `6a5398d`).
