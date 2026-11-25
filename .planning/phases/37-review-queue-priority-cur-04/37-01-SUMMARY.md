---
phase: 37-review-queue-priority-cur-04
plan: 01
subsystem: analytics
tags: [best-efforts, curation, contaminated-metres, fail-closed-parse]
requires: []
provides:
  - "ActivityBestEfforts.contaminatedMetres: de-duplicated, Branch 2 + 3, additive (no schema bump)"
  - "fail-closed browser parse of contaminatedMetres"
affects: [37-04, 37-05]
tech-stack:
  added: []
  patterns: ["index-pair keyed Map dedupe", "fail-closed numeric parse"]
key-files:
  created: []
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - src/dashboard/data/best-efforts-client.ts
    - src/dashboard/data/best-efforts-client.test.ts
    - src/analytics/compute-age-grading.test.ts
    - src/analytics/compute-dashboard-index.test.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/records-logic.test.ts
decisions:
  - "contaminatedMetres is activity-level, required on the type, always present (0 when nothing moved), summed over whole-segment metres keyed startIndex:endIndex, round1"
  - "Branch 3 windows count toward the figure (A5)"
metrics:
  tasks: 2
  completed: 2026-11-25
requirements: [CUR-06]
---

# Phase 37 Plan 01: contaminatedMetres Summary

Every activity in best-efforts.json now carries a numeric `contaminatedMetres`, the de-duplicated metres of unreliable segments touching any Branch 2 or Branch 3 effort window, and the browser client parses it fail-closed.

## Commits

- 92e1caab: compute field, type, Task 1 tests (F1-F5, rounding, end-to-end)
- a5d15b15: client parse, client tests, fixture literals

## Reachability evidence (D-19)

- F1 dedupe: with the Map key changed to a per-distance key, F1 went RED (expected 80 to be 40), F2 RED (105 vs 65) and the round1 test RED (105.1 vs 65.1). Restored: GREEN (86/86).
- F3 Branch 3: with the Branch 3 `set` removed, F3 went RED (expected 0 to be 400). Restored: GREEN.
- Client parse: with the guard replaced by a pass-through, the NaN, Infinity, negative, string, null and absent cases went RED (6 failures). Restored: GREEN (30/30).

## Verification

- `npx tsc --noEmit` exits 0.
- `npm run test:logic`: 120 files, 4133 tests pass.
- Regenerated on this checkout (`npm run build`, `compute-best-efforts`, `build-widgets`): 1930 activities, 0 without a numeric field, 561 with contaminatedMetres above 0 (reference figure, not an expected value), schemaVersion 1.
- BEST_EFFORTS_SCHEMA_VERSION unchanged.

## Deviations from Plan

None. tsc flagged exactly the planned files. Note: the F1/F2 fixtures hardcode the sweep's window indices (400m at 891..1025, 1k at 691..1025, a float tie-break on constant pace) and assert them, so a drift in the sweep fails loudly rather than silently weakening the dedupe test.

## Known Stubs

None.

## Self-Check: PASSED
