---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 03
subsystem: testing
tags: [typescript, vitest, records-logic, recount-verifier, silent-failure-guards]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: DemotionCounts, describeDemotionCounts, compute-pr-ceiling-recount.mjs's evaluateReport/problems[] fail-closed shape
provides:
  - "DemotionCounts.other: a required (not optional) field counting demotions with an unrecognized guard value"
  - "describeDemotionCounts's fourth, trailing sentence part: \"N by another guard\""
  - "recountDemotedActivities's malformedExclusions: string[] field, naming four malformation classes"
  - "evaluateReport's sibling problems[] check reading flaggedActivities.malformedExclusions"
affects: [31-04-curation-queue-D-09, records-logic, compute-pr-ceiling-recount]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-not-optional field on a shared interface used as both return type and test-literal shape, to make the compiler enforce a silent-fold guarantee"
    - "Fixed-order sentence builder: append a new trailing part guarded by `count > 0`, after all named parts"
    - "problems[] fail-closed accumulation extended with a sibling block, never a new error channel"

key-files:
  created: []
  modified:
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
    - scripts/compute-pr-ceiling-recount.mjs
    - scripts/compute-pr-ceiling-recount.test.mjs

key-decisions:
  - "D-07: DemotionCounts.other is required, not optional — matches RESEARCH.md's Anti-Pattern A2 and the plan's own explicit instruction not to shrink the 16-site diff by widening the type"
  - "D-08: malformed-exclusion detection order is activityId-type check, then __proto__ check, then duplicate check, then reason-shape check — a duplicate id whose first occurrence has a bad reason still registers as 'seen' so the second occurrence is correctly reported as a duplicate, not a second reason defect"

patterns-established:
  - "Negative-test discipline for a closed union: fabricate the invalid value via `as unknown as <GuardType>` at the call site rather than widening the production type"

requirements-completed: []  # TD-03 spans three code sites across 31-03 and 31-04 (curation queue) — see Requirements Note below. NOT ticked by this plan.

# Metrics
duration: ~55min
completed: 2026-09-19
---

# Phase 31 Plan 03: Silent-Fold Guards for Records Display and the Ceiling Recount Summary

**Records screen gains a required `other` demotion bucket rendered last ("N by another guard"), and `compute-pr-ceiling-recount.mjs` now fails closed on four named exclusion-file malformation classes (duplicate id, bad reason, `__proto__`, non-string id) via its existing `problems[]` channel.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `DemotionCounts` interface gained a REQUIRED `other: number` field; `countDemotedAtDistance`'s `default:` switch branch now increments it instead of silently dropping the count, closing the gap where the on-screen total could exceed the sum of its named, visible parts.
- `describeDemotionCounts` appends a fourth, always-trailing sentence part — exact wording `${counts.other} by another guard` — only when `other > 0`; the fixed order (ceiling, world-record, max-speed, other) is enforced by a test that compares `indexOf` positions, not mere substring presence.
- All 16 `DemotionCounts` object literals in `records-logic.test.ts` (14 single-line + 2 multi-line) updated with `other: 0`; `tsc --noEmit` is the structural proof none was missed.
- `recountDemotedActivities` in `scripts/compute-pr-ceiling-recount.mjs` gained a `malformedExclusions: string[]` field, detecting: duplicate `activityId`, non-string/missing/empty/whitespace-only `reason`, `activityId === '__proto__'`, and non-string `activityId` (named by array index when not safely stringifiable).
- `evaluateReport` gained a sibling block reading `report.flaggedActivities.malformedExclusions` and pushing one `problems[]` entry per offender — reusing the existing fail-closed shape and `main()`'s `process.exitCode = 1` wiring; no new error channel, no new import.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the required `other` bucket and the fourth sentence part (D-07)** - `f7528a13` (feat)
2. **Task 2: Make the recount fail closed on a malformed exclusions entry (D-08)** - `e9dbc293` (feat)

**Plan metadata:** committed separately per worktree-mode convention (SUMMARY.md + REQUIREMENTS.md only)

## Files Created/Modified

- `src/dashboard/views/records-logic.ts` - `DemotionCounts.other` (required), `countDemotedAtDistance`'s `default:` branch counts `other`, `describeDemotionCounts` appends the fourth trailing part
- `src/dashboard/views/records-logic.test.ts` - 16 literals updated with `other: 0`; 4 new tests (unrecognized-guard counting/rendering, owner-excluded-with-unrecognized-guard still skipped, four-part fixed order by index position, zero-`other` sentence unchanged)
- `scripts/compute-pr-ceiling-recount.mjs` - `recountDemotedActivities` returns `malformedExclusions`; `evaluateReport` reports them as `problems[]`
- `scripts/compute-pr-ceiling-recount.test.mjs` - 7 new tests (four malformation classes, one combined-shapes case, two `evaluateReport` pass/fail cases)

## Decisions Made

- Followed `31-CONTEXT.md` D-07/D-08 and `31-PATTERNS.md`'s exact target shapes verbatim; no deviation from the prescribed field names (`other`, `malformedExclusions`), wording (`"N by another guard"`), or channel (`problems[]`).
- Malformed-exclusion detection order (activityId-type → `__proto__` → duplicate → reason-shape) was chosen so a duplicate id's first occurrence is always evaluated for duplicate status before its reason is checked, keeping "seen id" tracking independent of that entry's own reason validity — this was not specified in the plan and is Claude's Discretion, documented here for a future reader.

## Deviations from Plan

None — plan executed exactly as written for both tasks. One clarification worth recording (not a deviation, a correction to a test I wrote and fixed before committing): my first draft of the "all four malformed shapes at once" test asserted `exclusionsTotal: 1`, but the well-formed FIRST occurrence of a later-duplicated id also counts toward `exclusionsTotal` (only its second occurrence is malformed) — corrected to `exclusionsTotal: 2` before the commit; caught by the test itself failing on first run, not shipped.

## Issues Encountered

**The plan's own acceptance-criteria grep for the zero-import guard does not literally return 0.** Task 2's acceptance criteria specify:
```
grep -nE "^\s*(import|const .*= *require|await import)" scripts/compute-pr-ceiling-recount.mjs | grep -vE "node:" | wc -l
```
This returns **3**, not 0 — but the three matches are `import { readFileSync } from 'fs'`, `import { join, dirname } from 'path'`, and `import { fileURLToPath, pathToFileURL } from 'url'`: pre-existing bare Node built-in imports written without the `node:` prefix, present before this plan touched the file (confirmed via `git diff HEAD -- scripts/compute-pr-ceiling-recount.mjs`, which shows zero import-line changes). The actual D-08/D-15 binding constraint — zero imports naming the ceiling module, the compute step, the best-effort utils, or the best-effort types, by any spelling — is separately and correctly enforced by the file's own `zero-import guard (D-15)` describe block in `compute-pr-ceiling-recount.test.mjs`, which strips comments before searching for `FORBIDDEN_MODULE_NAMES` and passed both before and after this plan's changes (2 tests, confirmed green). No import was added by this plan. The plan's literal grep command is a minor pre-existing pitfall in the acceptance-criteria text, not a defect this plan introduced or needs to fix (out of this plan's declared file scope).

## Verification Evidence

- `npx tsc --noEmit` exits 0.
- `grep -c "other: number" src/dashboard/views/records-logic.ts` → 1; `grep -c "other?:" ...` → 0; `grep -c "counts.other++" ...` → 1.
- `npx vitest run src/dashboard/views/records-logic.test.ts -t "another guard"` → **2 passed, 0 failed**.
- `npx vitest run src/dashboard/views/records-logic.test.ts` → **53 passed, 0 failed** (up from 49 before this plan — 4 new tests added).
- `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` → **7 passed, 0 failed** (four malformation classes + one combined case + two `evaluateReport` cases; exceeds the ≥5 requirement).
- `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` → **66 passed, 0 failed** (up from 59 before this plan — 7 new tests added).
- Zero-import guard re-verified: `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs -t "zero-import"` → **2 passed, 0 failed**. The file's own docblock rule (lines 7-14) restated: "this file has zero `import`/`require`/dynamic-`import()` statements naming the ceiling module ..., the compute step ..., the best-effort utils ..., or the best-effort types ..., by any spelling" — re-read and confirmed unchanged; no import was added by this plan.
- `node scripts/compute-pr-ceiling-recount.mjs` run against the real archive (this worktree's copied `data/stats/`, `data/dashboard/`, and the primary checkout's tracked `data/best-effort-exclusions.json` — the same 1,899-activity snapshot per the worktree-executor memory lesson) — **exit 0**, verbatim relevant stdout:
  ```
  Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 66
    Per-guard breakdown (own arithmetic):
      world-record: 19
      max-speed:    15
      ceiling:      32
      unrecognised guards: 0
  Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): 47
    of which already excluded (data/best-effort-exclusions.json): 12 of 12 total exclusions
  PR-05 impossible-sample cohort ... cohortCount: 663 ... cohortPct: 34.9%
  PASS: recount agrees with the shipped totals; no disagreements found.
  ```
  Figures (1,899 activities / 32 ceiling / 66 total demoted / 47 flagged activities / 663 impossible-sample cohort) match the `31-CONTEXT.md` MERGE-01 reference figures. Zero malformed-exclusion problems on the real, well-formed 12-entry file, as required.
- `git status --porcelain data/best-effort-exclusions.json` → empty (file is tracked and untouched).
- `npm test` → 2,429 passed, 0 relevant failures. **6 test files fail in this worktree** (`compute-elevation-calibration.test.mjs`, `compute-pace-quality-calibration.test.mjs`, `compute-pace-residual.test.mjs`, `compute-pr-ceiling-calibration.test.mjs`, `compute-pr-ceiling-diff.test.mjs`, `verify-dashboard-publish-stats.test.mjs`), all with `Cannot find module '../dist/analytics/...'` or missing `dist/widgets/data/...` errors — this worktree has no `npm run build` / `npm run build-widgets` output (`dist/` is gitignored, `dist/widgets` exists but is stale/empty of stats data). None of the 6 failing files were touched by this plan; both files this plan modified (`records-logic.test.ts`, `compute-pr-ceiling-recount.test.mjs`) pass fully within the `npm test` run. Per this project's own recorded lesson ("Worktree executors need node_modules + data/" — fixture failures there are not regressions), these 6 are the known bare-worktree limitation, not a regression introduced by this plan.
- `npx tsc --noEmit` exits 0 (confirmed above, also re-confirmed after Task 2's edits).

## Requirements Note (TD-03 tick rule)

**TD-03 is NOT ticked in `REQUIREMENTS.md` by this plan.** Per the plan's own explicit "TD-03 tick rule": TD-03 spans three code sites across two plans — 31-03 (this plan: `records-logic.ts`, the recount) and 31-04 (the curation queue, `scripts/curate-queue/derive-flagged.mjs`). This plan closes two of the three sites (D-07, D-08). The third site (D-09, the curation queue's malformed-entry count and visible line) is 31-04's responsibility. `REQUIREMENTS.md` line 105 (TD-03) and line 182 (the phase-map row) both remain unticked/`Pending`, confirmed unchanged by this plan. TD-03 ticks only once 31-04 has landed AND a full `npm test` is green with all three sites' tests present — that check belongs to 31-04 or a later reconciliation step, not this plan.

## Next Phase Readiness

- `DemotionCounts.other` and `describeDemotionCounts`'s fourth sentence part are available for any future Records-screen consumer; no DOM change was needed (`records.ts` already renders whatever the sentence builder returns).
- `recountDemotedActivities`'s `malformedExclusions` field and `evaluateReport`'s new problems block are available as-is for 31-04's D-09 queue work to reference as the sibling pattern (queue degrades visibly and reports a count; recount fails closed) — no code sharing is required or intended, per D-08/D-09's deliberately independent, hand-duplicated implementations.
- TD-03 stays open pending 31-04.

## Self-Check: PASSED

All four modified files and this SUMMARY.md confirmed present on disk. Both task commits
(`f7528a13`, `e9dbc293`) confirmed present in `git log --oneline` within this worktree branch
(`worktree-agent-a732b4acdba9c3469`). No missing items.
