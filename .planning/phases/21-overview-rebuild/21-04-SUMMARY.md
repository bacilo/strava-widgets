---
phase: 21-overview-rebuild
plan: 04
subsystem: ui
tags: [typescript, dom, accessibility, vitest]

# Dependency graph
requires:
  - phase: 21-overview-rebuild (plan 21-02, wave 1)
    provides: "renderActivityRow(row, surface) with a defaulted surface param and the RowSurface union (activity-card, activity-table, overview-prs, overview-activities), rowIdPrefix(surface, rowId) as the single element-id-prefix construction site"
provides:
  - "Overview's Recent PRs and Recent Activities cards both delegate to the single shared renderActivityRow, passing distinct RowSurface values ('overview-prs' / 'overview-activities')"
  - "overview.ts builds no row DOM, composes no accessible name, and constructs no href of its own — every athlete string reaches the DOM exclusively through renderActivityRow's textContent assignments"
  - "row-semantics.test.ts source guards updated to assert the post-retirement reality (inverted UX-01/D-03 import/href-count guard for overview.ts, single CR-02 no-second-row-model guard)"
affects: ["21-06 (adds the streak sub-label to overview.ts and re-imports formatActivityDate)", "21-07 (browser checkpoint proving the two cards render identically and Recent PRs rows now show duration/pace)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-renderer delegation: a view module that used to hand-build a DOM row now imports the shared row builder and passes a RowSurface literal — no local row-building code survives"

key-files:
  created: []
  modified:
    - src/dashboard/views/overview.ts
    - src/dashboard/views/overview.test.ts
    - src/dashboard/row-semantics.test.ts
    - src/dashboard/views/list.ts

key-decisions:
  - "recentPrBadgeText, recentPrRowAriaLabel and renderRecentPrRow were deleted outright, not left as thin unused wrappers — D-05's stated rationale is collapsing the duplicated accessible-name builders, not hiding them behind a dead export"
  - "Recent PRs rows now render through the full renderActivityRow (D-06 two-line header/meta shape with status badges), so a PR row's meta line gains duration and pace it did not have before — this is D-07's explicitly declined field-subset option, confirmed intended in 21-CONTEXT.md"
  - "The two Overview call sites pass distinct RowSurface values (overview-prs / overview-activities) specifically because both cards render in the same document at once, and a PR-carrying row inside the ten most recent activities would otherwise emit an identical .sr-only description id in two places simultaneously"

patterns-established: []

requirements-completed: [OVR-01, OVR-02]

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 21 Plan 04: Overview Row Retirement into the Shared Renderer

**Overview's private row renderer (`renderRecentPrRow`/`recentPrBadgeText`/`recentPrRowAriaLabel`) is deleted outright; both Recent PRs and Recent Activities cards now call the one shared `renderActivityRow(row, surface)` with distinct `overview-prs`/`overview-activities` surfaces.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-18
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- Deleted `recentPrBadgeText`, `recentPrRowAriaLabel` and `renderRecentPrRow` from `overview.ts` along with their JSDoc, and the now-dead imports (`composeRowAriaLabel`, `formatActivityDate`, `activityDetailHref` / `row-navigation.js`)
- `buildRecentPrsCard` and `buildRecentActivitiesCard` both delegate to `renderActivityRow`, passing `'overview-prs'` and `'overview-activities'` respectively — the two cards now share one row model by construction, not by hand-maintained duplication
- Added a D-05/D-07 comment above `buildRecentPrsCard` stating the retirement outcome in one place, and fixed a stale `renderRecentPrRow` JSDoc reference inside `list.ts`'s `buildTableRow` comment (comment-only change, verified via `git diff`)
- Re-pointed `overview.test.ts` off the retired exports onto `list.ts`'s `activityRowAriaLabel`/`statusBadgeTexts`, covering the PR-badge-in-accessible-name guarantee (CR-02) with a pinned exact-literal assertion and a no-badge-path assertion for a clean `prCount: 0` row
- Re-pointed `row-semantics.test.ts`'s two invalidated guard groups: the UX-01/D-03 import/href-count guard for `overview.ts` was inverted (now asserts ZERO `row-navigation.js` imports and ZERO `activityDetailHref(` calls, since D-05 moved that construction into the shared renderer), and the CR-02 guard's two Overview assertions were replaced with a single guard proving Overview has no second row model (zero occurrences of the retired builders/`aria-label`/`'activity-row'`/`createElement('a')`, exactly two `renderActivityRow(` calls with distinct surfaces)

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire the private renderer and delegate both cards** - `0a8eb65` (feat)
2. **Task 2: Re-point overview.test.ts onto the shared builder** - `b93884b` (test)
3. **Task 3: Re-point the row-semantics source guards** - `1580519` (test)

## Files Created/Modified
- `src/dashboard/views/overview.ts` - deleted the three retired row-builder functions and their dead imports; both card builders now call `renderActivityRow(row, surface)`
- `src/dashboard/views/overview.test.ts` - re-pointed onto `list.ts`'s `activityRowAriaLabel`/`statusBadgeTexts`; header comment restates the node-environment/no-jsdom disclosure and cites plan 21-07's checkpoint
- `src/dashboard/row-semantics.test.ts` - UX-01/D-03 and CR-02 guards updated to assert the post-retirement reality; the id-prefix guard (plan 21-02's) and the standing `innerHTML`/`outerHTML`/`insertAdjacentHTML` house rule are untouched
- `src/dashboard/views/list.ts` - comment-only fix: `buildTableRow`'s JSDoc no longer names the deleted `renderRecentPrRow`

## Decisions Made
See `key-decisions` in frontmatter. No decisions outside what the plan's `<interfaces>` and `<action>` blocks already specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's own verify script chains `tsc --noEmit` before the node source-check, but `overview.test.ts` still imports the just-deleted exports at that point**
- **Found during:** Task 1 verification
- **Issue:** The plan's Task 1 `<verify>` block is `npx tsc --noEmit -p tsconfig.json && node ...`. Since `tsconfig.json` includes all of `src/**/*` (test files included), `tsc` fails with 2 `TS2305` errors from `overview.test.ts`'s still-live import of the deleted `recentPrBadgeText`/`recentPrRowAriaLabel` — the same reason the plan's own acceptance criteria says `npm test` is "expected to be RED at the end of this task." The plan text only anticipated the vitest-run red, not the equivalent tsc-compile red caused by the identical dead import.
- **Fix:** Ran Task 1's node verification script standalone (skipping the leading `tsc` chain) to confirm the source-shape assertions passed, committed Task 1, then completed Task 2 (which fixes the import) and re-ran `tsc --noEmit` clean immediately after. No source code was changed to work around this — it is a verify-script ordering artifact of the plan itself, not a defect in the implementation.
- **Files modified:** None (verification-process-only; no file changes beyond what Task 1's `<action>` already specified)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 after Task 2's commit; full per-wave gate (`npm test && npx tsc --noEmit -p tsconfig.json && npm run build-widgets`) is green after Task 3
- **Committed in:** N/A (no commit needed; documented here for the record)

---

**Total deviations:** 1 auto-fixed (1 bug — plan verify-script ordering, not implementation)
**Impact on plan:** No functional impact; both `overview.test.ts`'s dead import and the transitive `tsc` red were exactly the "intermediate red" state the plan itself says Task 1 deliberately leaves and Task 2 restores. No scope creep.

## Issues Encountered

Fresh worktree checkout was missing the gitignored generated data directories (`data/stats/`, `data/dashboard/`) that five pre-existing, unrelated `trends-*-logic.test.ts` files read directly. Per this session's environment note, copied both directories (local generated JSON, no network/git operations) from the main checkout at `/Users/pedf/workspace/strava-widgets` rather than editing source. After the copy, `npm test` is 49/49 files, 1090/1090 tests green; `git status --short` stayed clean throughout (both directories are gitignored, so the copy never appeared as untracked). None of those five files are in this plan's `files_modified`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 21-06 can safely add `formatActivityDate` back to `overview.ts`'s imports when it introduces the streak sub-label — this plan deliberately removed it as a then-genuinely-dead import, per the plan's own explicit instruction not to pre-emptively keep it. Plan 21-07's browser checkpoint is the first point at which the two cards' visual identity and the Recent PRs rows' new duration/pace fields can be confirmed; nothing in this plan's automated gates can assert that (per `21-PATTERNS.md`'s textual-assertion-only constraint for this phase). No blockers.

---
*Phase: 21-overview-rebuild*
*Completed: 2026-08-18*
