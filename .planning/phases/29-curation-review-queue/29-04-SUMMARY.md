---
phase: 29-curation-review-queue
plan: 04
subsystem: curation
tags: [curation, review-queue, tdd, pure-function, mjs]

# Dependency graph
requires:
  - phase: 29-curation-review-queue plan 03
    provides: "recountDemotedActivities export (scripts/compute-pr-ceiling-recount.mjs), the D-16 cross-check target"
provides:
  - "deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc) — pure, JSDoc-typed, zero-import derivation of the review queue's ordered row set (D-01..D-05, D-11, D-12, PD-01)"
  - "buildPrefillReason(flaggedEfforts) — D-11's reason-field prefill join"
  - "summarizeQueue(rows) — the queue header's flagged/excluded counts"
  - "a collected, TDD-covered test file proving the derivation against hand-built fixtures and the live archive"
affects:
  - "plan 29-05 (queue client) — imports these three exports directly, never reimplements the derivation"
  - "the Phase 29 browser checkpoint for Criterion 1 — the queue header's count traces back to this module"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "zero-import .mjs + JSDoc pure transform, mirroring recountDemoted's defensive shape (default activities to {}, efforts to [], treat a non-object demotion as absent)"
    - "Map-backed lookups (exclusions, names) to make __proto__ keys structurally inert rather than filtered by convention"
    - "classifier-independent live cross-check proved failable by a scratch mutation before being trusted, never committed"

key-files:
  created:
    - scripts/curate-queue/derive-flagged.mjs
    - scripts/curate-queue/derive-flagged.test.mjs
  modified: []

key-decisions:
  - "PD-01 confirmed as planned: the name join reads data/dashboard/index.json and degrades to `Activity <id>` on a miss, verified by two dedicated tests"
  - "Sort comparator implemented as a single three-key comparator (excluded asc, startDate desc via string compare, activityId asc) rather than a pre-sort/stable-sort combination, per the plan's explicit instruction"

patterns-established:
  - "Live cross-check test files must prove their own discriminating power with a scratch mutation observed failing before the block is trusted — recorded here as the second instance of this project's project-wide discrimination convention applied to a brand-new module (the first being compute-pr-ceiling-recount.mjs itself)"

requirements-completed: [CUR-01]

# Metrics
duration: "~30min"
completed: 2026-09-18
---

# Phase 29 Plan 04: Derive Flagged Activities Summary

A pure, zero-import `.mjs` module (`deriveFlaggedActivities`/`buildPrefillReason`/`summarizeQueue`) that turns the two mirrored curation documents into the review queue's ordered row set, TDD'd against 25 hand-built-fixture assertions plus a live cross-check against `recountDemotedActivities` that was proved to discriminate by a scratch mutation before being trusted.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-18T09:15:00Z (approx, worktree branch check)
- **Completed:** 2026-09-18T09:31:42Z
- **Tasks:** 3
- **Files modified:** 2 (`scripts/curate-queue/derive-flagged.mjs`, `scripts/curate-queue/derive-flagged.test.mjs`)

## Accomplishments

- Task 1 proved the `.test.mjs` sibling is actually collected by vitest (`Test Files  1 passed`) before any real assertion was written — the collection trap this project has hit twice before (RESEARCH.md Pitfall 1).
- Task 2 (TDD) implemented D-01 through D-05, D-11, D-12 and PD-01, observed RED first (14 of 24 assertions failing against the Task-1 stub, including the D-01 all-guards case and the D-05 ordering case), then GREEN (24/24).
- Task 3 added a live archive cross-check against `recountDemotedActivities` (Phase 29 plan 03's export) with no hardcoded count, and proved it discriminates: a scratch edit narrowing the qualifying condition to `demotion.guard === 'ceiling'` dropped the derived row count to 28 (the measured ceiling-only cohort) while the recount's `flaggedActivityCount` stayed at 47 — the block failed exactly as it should, then was reverted to a byte-identical file and re-confirmed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Contracts and collection canary** - `358eb27a` (feat)
2. **Task 2: Derivation behavior — tests then implementation (TDD)**
   - RED: `f8167a08` (test)
   - GREEN: `c294f26f` (feat)
3. **Task 3: Live cross-check against the independent recount** - `9c14e4a8` (test)

No plan-metadata commit in this worktree — SUMMARY.md is committed separately per worktree-mode instructions (STATE.md/ROADMAP.md are excluded; the orchestrator owns those writes after merge).

_TDD task carries two commits (RED → GREEN); no REFACTOR commit was needed, the GREEN implementation required no follow-up cleanup._

## Files Created/Modified

- `scripts/curate-queue/derive-flagged.mjs` - Pure derivation: `deriveFlaggedActivities`, `buildPrefillReason`, `summarizeQueue`. Zero imports, zero `console` calls, JSDoc-typed.
- `scripts/curate-queue/derive-flagged.test.mjs` - 25 assertions: canary, D-01/D-02/D-03/D-05 fixture cases, D-11 prefill cases, D-12 detailUrl, PD-01 name-join cases, degradation cases, `__proto__` safety cases, `summarizeQueue` cases, and the live archive cross-check.

## Decisions Made

- **PD-01 (already locked in the plan, confirmed in implementation):** the name join reads `indexDoc.activities[]` keyed by `String(id)`, degrading to `null`/`Activity <id>` on any miss or on a missing `indexDoc` entirely — verified that omitting `indexDoc` changes neither row count nor order (a test case dedicated to exactly this).
- **Sort implementation:** a single comparator function with three tiers (`Number(excluded)` ascending, `startDate` string-descending, `activityId` string-ascending) rather than separate grouping + per-group sort — simpler and matches the plan's literal instruction.
- **Exclusions/name lookups as `Map`, never plain objects** (T-29-12): both `buildExclusionsMap` and `buildNameMap` explicitly skip a `__proto__` key/activityId before insertion, and the main activities loop skips `activityId === '__proto__'` before ever reading `activities[activityId]`. Two dedicated tests construct a `JSON.parse`'d `__proto__` key/value and assert `({}).__proto__.polluted` stays `undefined` after derivation.

## Deviations from Plan

None — plan executed exactly as written across all three tasks. One necessary within-plan step not itself a deviation: since `data/stats/` and `data/dashboard/` are gitignored and absent in a fresh worktree (per the wave's own environment note), Task 3's live cross-check reads copies made read-only from the primary checkout (`/Users/pedf/workspace/strava-widgets/data/stats/best-efforts.json`, `data/dashboard/index.json`) into this worktree's own gitignored `data/` directories — never committed (confirmed via `git status --short --ignored`), and the primary checkout was never written to.

## Issues Encountered

None specific to this plan's scope. `npm test` in this worktree shows 10 pre-existing failing files unrelated to `scripts/curate-queue/`: several `scripts/compute-*-calibration.test.mjs` / `compute-pr-ceiling-diff.test.mjs` / `verify-dashboard-publish-stats.test.mjs` files and `src/dashboard/views/{records,trends-gear,trends-training-load,trends-yoy,trends-zoom}-logic.test.ts` — all `ENOENT` on `data/stats/*.json` files this plan does not read/write (e.g. `training-load.json`, `year-over-year.json`) or a missing `node_modules/chartjs-plugin-zoom` asset, both environmental gaps of a fresh worktree with a partially-mirrored `data/` tree, not regressions introduced here. `scripts/curate-queue/derive-flagged.test.mjs` (25/25) and `scripts/compute-pr-ceiling-recount.test.mjs` (59/59, this plan's direct dependency) are both green in isolation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/curate-queue/derive-flagged.mjs` is ready for plan 29-05's queue client to import directly (`deriveFlaggedActivities`, `buildPrefillReason`, `summarizeQueue`) — no further derivation logic should be written there.
- The live cross-check gives plan 29-05's eventual browser checkpoint (Criterion 1) a pre-proven, classifier-independent target: the queue header's count should equal `recountDemotedActivities(...).flaggedActivityCount`, re-derived at verification time (D-16), never a value copied from this session.
- No blockers. `data/stats/best-efforts.json` and `data/dashboard/index.json` copies left in this worktree's gitignored `data/` dirs are harmless (never committed) but not needed by any later plan in this wave — they exist only for this plan's Task 3 evidence.

---
*Phase: 29-curation-review-queue*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `scripts/curate-queue/derive-flagged.mjs` — FOUND
- `scripts/curate-queue/derive-flagged.test.mjs` — FOUND
- `.planning/phases/29-curation-review-queue/29-04-SUMMARY.md` — FOUND
- Task 1 commit `358eb27a` — FOUND
- Task 2 RED commit `f8167a08` — FOUND
- Task 2 GREEN commit `c294f26f` — FOUND
- Task 3 commit `9c14e4a8` — FOUND
- `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` → 25/25 passed
