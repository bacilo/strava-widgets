---
phase: 24-local-curation-mode
plan: 02
subsystem: ui
tags: [dashboard, custom-events, data-attributes, vitest, source-structure-test]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    provides: buildBestEffortsSection, buildPrFlagsCell, the shipped Excluded — {reason} badge
  - phase: 20-row-click-interaction-pattern
    provides: the dataset.activityId naming precedent (list.ts:527) and the row-semantics.test.ts / stripComments source-structure test pattern
provides:
  - a data-activity-id attribute on every Best Efforts <section> (empty-state included)
  - one dashboard:best-efforts-mounted CustomEvent, dispatched after the panel is placed in the DOM
  - src/dashboard/curation-seam.test.ts, a source-structure regression guard for both halves, discharged per D-11
affects: [24-local-curation-mode later plans (curate-server.mjs, the overlay bundle, the D-10/D-11 build/verify guards, the human browser checkpoint in plan 24-08)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inert published-bundle attach seam: a dataset attribute plus a bubbling CustomEvent, both carrying only an id, added to code that already ships publicly, so a later out-of-bundle script can attach without coupling to display strings or table structure"

key-files:
  created:
    - src/dashboard/curation-seam.test.ts
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail.ts

key-decisions:
  - "D-03(a) resolved: section.dataset.activityId is set unconditionally, before the zero-efforts empty-state early return, using the same idiom as list.ts:527 — no new convention."
  - "D-03(b) resolved: the dashboard:best-efforts-mounted CustomEvent is the LAST statement of mountBestEffortsAndBadges, dispatched after both the requestToken/mountedContainer guard and panelContainer.replaceChildren(...) — ordering enforced by curation-seam.test.ts assertion 5 and observed to fail when violated (D-11)."
  - "The JSDoc added above mountBestEffortsAndBadges deliberately avoids repeating the literal event-name string, since curation-seam.test.ts asserts the string appears exactly once in the file (inside the actual dispatch call) — a naming-precedent detail worth recording for later plans in this phase that touch the same file."

patterns-established:
  - "Pattern: dataset.activityId as the naming convention for any future per-row/per-section id-based attach seam in the dashboard views, following list.ts:527."

requirements-completed: []  # CUR-01 stays open — this plan ships only the inert attach seam; the write path, server, and overlay are later plans in this phase.

# Metrics
duration: ~20min
completed: 2026-08-27
---

# Phase 24 Plan 02: D-03 Attach Seam Summary

**Added `data-activity-id` to the Best Efforts section and one `dashboard:best-efforts-mounted` CustomEvent to the published dashboard bundle — both inert, both pinned by a source-structure guard observed failing against each half reverted.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-27T10:12:57Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `buildBestEffortsSection` (`detail-sections.ts`) gained a third `activityId: string` parameter and sets `section.dataset.activityId = activityId` before any early return, so every activity — including the zero-qualifying-efforts empty state — ships the attach seam.
- `mountBestEffortsAndBadges` (`detail.ts`) now passes `detail.id` to `buildBestEffortsSection` and dispatches one bubbling `dashboard:best-efforts-mounted` CustomEvent carrying `{ activityId }` as its last statement, after the `requestToken`/`mountedContainer` guard and after the section is placed in the DOM.
- `src/dashboard/curation-seam.test.ts` created: 8 assertion groups (parameter shape, attribute presence/ordering, event presence/ordering, inertness, D-06 non-regression) proving SOURCE TEXT SHAPE only, following the `row-semantics.test.ts`/`row-navigation.test.ts` precedent exactly — this repo's vitest runs `environment: 'node'` with no DOM library.
- D-11 discharged: both halves of the seam were manually reverted in turn, each observed to turn the new test file RED, then restored and re-verified green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Set data-activity-id on the Best Efforts section (D-03a)** - `8160bc4` (feat)
2. **Task 2: Dispatch dashboard:best-efforts-mounted as the last statement of mountBestEffortsAndBadges (D-03b)** - `1a3506f` (feat)
3. **Task 3: Source-structure regression guard for the seam, observed failing (D-11)** - `738b4c6` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified
- `src/dashboard/views/detail-sections.ts` - `buildBestEffortsSection` gains `activityId: string`, sets `section.dataset.activityId` before the empty-state branch; JSDoc extended naming D-03(a)
- `src/dashboard/views/detail.ts` - `mountBestEffortsAndBadges` passes `detail.id` through and dispatches the mount CustomEvent as its last statement; JSDoc extended naming D-03(b), deliberately not repeating the literal event-name string
- `src/dashboard/curation-seam.test.ts` - new source-structure regression guard, 74 test cases (8 new + 66 inherited via the `stripComments` import re-executing `row-semantics.test.ts`'s own describe blocks)

## Decisions Made
None beyond what 24-CONTEXT.md's D-03 already locked. Two small implementation choices, both within the plan's stated discretion:
- The mount event's dispatch target is `container` (bubbling), matching the plan's TARGET interface exactly.
- The JSDoc above `mountBestEffortsAndBadges` avoids literally repeating `'dashboard:best-efforts-mounted'` in prose, since the plan's own acceptance criteria (and this plan's test) require the literal string to appear exactly once in the file.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3/4 auto-fixes were needed; the two source files behaved exactly as `24-PATTERNS.md`'s exact-insertion-point excerpts predicted.

## D-11 observed failing

Per Task 3's mandatory discharge requirement, each half of the seam was temporarily reverted, `npx vitest run src/dashboard/curation-seam.test.ts` was run and its RED output captured, then the file was restored to its committed state and the suite re-run green. Both reverts were done via plain edits (not git operations) inside this worktree, and `git diff --stat` on `src/dashboard/views/detail-sections.ts` / `detail.ts` confirmed zero diff against the committed state after each restoration.

### Run 1 — `dataset.activityId` line removed

```
 ❯ src/dashboard/curation-seam.test.ts (74 tests | 2 failed) 25ms
     ✓ buildBestEffortsSection's signature includes activityId: string
     × detail-sections.ts sets the data-activity-id attribute, spelling-agnostic (.dataset.activityId or setAttribute)
     × the attribute assignment appears BEFORE the zero-efforts empty-state early return, so every activity ships the seam
     ...
 FAIL src/dashboard/curation-seam.test.ts > D-03(a) — buildBestEffortsSection carries the activityId attach seam > detail-sections.ts sets the data-activity-id attribute, spelling-agnostic (.dataset.activityId or setAttribute)
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/dashboard/curation-seam.test.ts:51:59

 FAIL src/dashboard/curation-seam.test.ts > D-03(a) — buildBestEffortsSection carries the activityId attach seam > the attribute assignment appears BEFORE the zero-efforts empty-state early return, so every activity ships the seam
AssertionError: expected .dataset.activityId = activityId to be present: expected -1 to be greater than or equal to 0
 ❯ src/dashboard/curation-seam.test.ts:57:89

 Test Files  1 failed (1)
      Tests  2 failed | 72 passed (74)
```

### Run 2 — mount-event dispatch moved to immediately after the `requestToken` guard (before `replaceChildren`)

```
 ❯ src/dashboard/curation-seam.test.ts (74 tests | 1 failed) ...
     × the event fires AFTER the requestToken/mountedContainer guard AND AFTER panelContainer.replaceChildren(buildBestEffortsSection(...)), measured inside mountBestEffortsAndBadges

 FAIL src/dashboard/curation-seam.test.ts > D-03(b) — mountBestEffortsAndBadges dispatches the mount event exactly once, in order > the event fires AFTER the requestToken/mountedContainer guard AND AFTER panelContainer.replaceChildren(buildBestEffortsSection(...)), measured inside mountBestEffortsAndBadges
AssertionError: expected the mount event dispatch: expected 547 to be greater than 857
 ❯ src/dashboard/curation-seam.test.ts:82:62

 Test Files  1 failed (1)
      Tests  1 failed | 73 passed (74)
```

### Run 3 — both halves restored, `git diff --stat` clean, full green

```
 ✓ src/dashboard/curation-seam.test.ts (74 tests) 22ms

 Test Files  1 passed (1)
      Tests  74 passed (74)
```

Both target assertions — assertion 3 (attribute ordering) and assertion 5 (event ordering) — were the two Task 3 flagged as most likely to silently rot, and both were the exact assertions observed red.

## Issues Encountered

**`npm test` (full suite) does not exit 0 inside this git worktree — a pre-existing environment gap, not a regression.** 6 of 56 test files fail with `ENOENT` on gitignored build artifacts (`node_modules/chartjs-plugin-zoom/...`, `data/stats/*.json`) that a fresh worktree checkout does not carry (`.gitignore` lists both `node_modules/` and `data/stats/`). These artifacts exist in the main repo checkout but not in this isolated worktree. **Zero assertion failures occurred** — the tally is 1292/1292 executed tests passing; the 6 failures are all import-time errors in files this plan never touched. Logged in detail in `.planning/phases/24-local-curation-mode/deferred-items.md`. In-scope verification (`npx tsc --noEmit`, `npx vitest run src/dashboard/curation-seam.test.ts`, `npx vitest run src/dashboard/row-semantics.test.ts src/dashboard/row-navigation.test.ts`) all pass clean, and `git diff --name-only` against the plan's pre-execution base commit lists exactly the three files the plan's frontmatter declares.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The published dashboard now carries D-03's two inert additions, pinned by a regression guard. Later plans in this phase (the curate server, the overlay bundle, the D-10/D-11 build-time and HTTP absence guards) can build against `section[data-activity-id="<id>"]` and the `dashboard:best-efforts-mounted` event with confidence that both are structurally present and will stay that way. No blockers. `npm test`'s full-suite ENOENT gap (see Issues Encountered) is expected to resolve automatically once the orchestrator merges this worktree's commits into the main checkout, where `node_modules` and `data/stats` are already populated.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail-sections.ts
- FOUND: src/dashboard/views/detail.ts
- FOUND: src/dashboard/curation-seam.test.ts
- FOUND: .planning/phases/24-local-curation-mode/24-02-SUMMARY.md
- FOUND: .planning/phases/24-local-curation-mode/deferred-items.md
- FOUND commit: 8160bc4 (Task 1)
- FOUND commit: 1a3506f (Task 2)
- FOUND commit: 738b4c6 (Task 3)
- FOUND commit: feb2320 (docs: SUMMARY + deferred-items)
