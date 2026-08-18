---
phase: 21-overview-rebuild
plan: 02
subsystem: ui
tags: [typescript, dom, accessibility, vitest]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "renderActivityRow as a whole-row `<a>` with activityDetailHref, activityRowAriaLabel, and row-level aria-describedby (D-04/D-07)"
provides:
  - "RowSurface union (activity-card, activity-table, overview-prs, overview-activities) and rowIdPrefix(surface, rowId) — the single element-id-prefix construction site"
  - "renderActivityRow(row, surface) with a defaulted surface param, safe for two simultaneous Overview call sites (plan 21-04)"
  - "D-06's two-line row DOM: div.activity-row__header (name + unconditional badges wrapper) then div.activity-row__meta"
affects: ["21-03 (CSS against the new class contract)", "21-04 (Overview call sites using overview-prs/overview-activities)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-construction-site element-id prefixing: every simultaneously-rendered surface gets a distinct prefix from one pure function (rowIdPrefix) rather than inline template literals per call site"
    - "Unconditional empty flex-child wrapper (div.activity-row__badges) to keep header layout stable across badge-carrying and badge-free rows"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/row-semantics.test.ts

key-decisions:
  - "rowIdPrefix('activity-card', id) and rowIdPrefix('activity-table', id) are pinned byte-identical to their pre-Phase-21 literal values — the surface scheme is additive, not a rename"
  - "The badges wrapper (div.activity-row__badges) is always appended, even for a badge-free row, so the header's space-between layout never shifts the name's width between rows in the same list"
  - "aria-describedby stays on the row anchor itself, not on the new header/badges wrapper elements — a description is only announced when its host is announced, and the row anchor is the only element that gets announced on this surface"

patterns-established:
  - "Pattern: element-id prefixing for simultaneously-rendered UI surfaces goes through one exported pure function (rowIdPrefix), never an inline template literal at the call site"

requirements-completed: [OVR-01, OVR-02]

# Metrics
duration: ~20min
completed: 2026-08-18
---

# Phase 21 Plan 02: Row Surface Scoping and D-06 Two-Line Row Summary

**`renderActivityRow(row, surface)` now scopes its element ids per one of four surfaces via a single `rowIdPrefix` helper, and renders a two-line header/meta DOM instead of three flat sibling children.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-18
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- Added `RowSurface` (four members) and `rowIdPrefix(surface, rowId)` as the single element-id-prefix construction site, replacing two inline template literals in `list.ts` with byte-identical output for the two pre-existing surfaces
- `renderActivityRow` takes a defaulted `surface: RowSurface = 'activity-card'` parameter and derives its `idPrefix` from `rowIdPrefix`, so Overview's two simultaneous cards (plan 21-04) will not collide on the `.sr-only` low-confidence description `id`
- Restructured `renderActivityRow`'s DOM into D-06's two-line shape: `div.activity-row__header` (containing `div.activity-row__name` + an unconditional `div.activity-row__badges`) as the first child, `div.activity-row__meta` as the second — Phase 20's anchor, `href`, curated `aria-label`, and row-level `aria-describedby` are all byte-equivalent in behaviour
- Added a behavioural four-way distinctness proof (`list.test.ts`) over `rowIdPrefix` and `lowConfidenceDescriptionId` across all four surfaces, and re-pointed `row-semantics.test.ts`'s source-shape guard from the two now-deleted inline template literals to `rowIdPrefix`'s single construction site, preserving its `activity-table-wrapper` deviation note

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-surface element-id scoping (RowSurface + rowIdPrefix)** - `324e8fe` (feat)
2. **Task 2: The D-06 two-line row DOM** - `0a3554c` (feat)
3. **Task 3: Behavioural prefix-uniqueness proof, and the source guard re-pointed** - `ada9c30` (test)

## Files Created/Modified
- `src/dashboard/views/list.ts` - `RowSurface` type, `rowIdPrefix` function, `renderActivityRow`'s new `surface` param and two-line header/meta DOM, `buildTableRow`'s badge call re-pointed
- `src/dashboard/views/list.test.ts` - new `describe('rowIdPrefix — D-05 per-surface element-id scoping')` with four behavioural assertions
- `src/dashboard/row-semantics.test.ts` - the id-prefix template-literal guard rewritten to assert the single `${surface}-${rowId}` construction site and zero surviving inline literals

## Decisions Made
- See `key-decisions` in frontmatter. No decisions outside what the plan's `<interfaces>` and `<action>` blocks already specified.

## Deviations from Plan

None - plan executed exactly as written. Task 1 deliberately left `row-semantics.test.ts` red (confirmed: the old id-prefix-template-literal assertion failed with `expected +0 to be 1` after Task 1, as the plan predicted); Task 3 restored it to green.

## Issues Encountered

`npm test` reports 5 pre-existing, unrelated test-file failures (`trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, plus one) — all `ENOENT` against gitignored `data/dashboard/index.json` / `data/stats/*.json`, which are generated pipeline output absent from this fresh worktree checkout. Out of this plan's scope (none of those files are in `files_modified`); logged to `.planning/phases/21-overview-rebuild/deferred-items.md` rather than fixed. The two plan-relevant test files (`list.test.ts`, `row-semantics.test.ts`), `npx tsc --noEmit -p tsconfig.json`, and `npm run build-widgets` are all green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 21-03 can now write CSS against the frozen `.activity-row__header` / `.activity-row__badges` / `.activity-row__name` / `.activity-row__meta` class contract. Plan 21-04 can call `renderActivityRow(row, 'overview-prs')` and `renderActivityRow(row, 'overview-activities')` on the same page without an element-id collision. No blockers.

---
*Phase: 21-overview-rebuild*
*Completed: 2026-08-18*
