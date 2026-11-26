---
phase: quick-261126-tnj
plan: 01
status: complete
requirements: [quick-261126-tnj, 37.1-WR-05]
commits: [8e2b2759, 5a9e1b76, ea452537]
completed: 2026-11-26
---

# Quick 261126-tnj: Persist IntervalsSync near-match skips (WR-05)

Near-match skips are now written to `data/sync-state.json` as an optional `near_match_skips` map keyed by intervalsId, `{existingId, deltaS, startDate, firstSeen}`. Recording is idempotent, and all three `SyncStateManager.save` callers carry the map.

## Commits

- 8e2b2759 test: failing durability tests (RED)
- 5a9e1b76 fix: persist near_match_skips, carry through `IntervalsSync`, `updateAfterSync`, `ActivitySync`
- ea452537 docs: 37.1-REVIEW-FIX.md now `status: all_fixed`, WR-05 cites 5a9e1b76

## Failing-first (against unmodified source)

- intervals-sync.test.ts: 5 failed, 13 passed. Failing: the updated ING-05 row, Rows A, B, C and D.
- sync-state.test.ts: 1 failed, 1 passed. Failing: the updateAfterSync carry-through row.
- Row A message: `AssertionError: expected undefined to deeply equal { i2001: { …(4) } }` (on-disk `near_match_skips` was absent, so the clobber/absence was real, not vacuous).
- Row E and the legacy-load row passed already, as the plan expected. They are not RED evidence.

## Post-fix

- Both files: 2 passed, 20 tests passed, 0 failed. No `-t` filter used.
- `npx tsc --noEmit` clean. Full `npm test` after `npx tsc`: 125 files, 4350 tests passed.

## Mutations (each restored, git diff confirmed unchanged)

1. Drop `near_match_skips` from the per-activity save: Rows A and D fail (2 failed, 18 passed).
2. Drop the carry-through in `updateAfterSync`: carry-through row fails (1 failed, 19 passed).
3. Always overwrite `firstSeen` (`if (true)`): Rows C and D fail (2 failed, 18 passed).

## Notes on test changes

The existing ING-05 row "skips and reports a delivery 60 s from a hand-seeded FIT-imported record, writing nothing" changed `expect(saveCalls).toHaveLength(0)` to `toHaveLength(1)` plus a `toMatchObject` on `saveCalls[0]`. This reflects the new behaviour (the skip is persisted). It is not a softened guard. Its manifest-bytes and no-activity-file assertions are untouched.

## Deviations from Plan

None. Tests use temp dirs only. `data/sync-state.json`, the workflow and the gates were not touched. Task 3 is complete.

## Known Stubs

None.

## Self-Check: PASSED

Commits 8e2b2759, 5a9e1b76 and ea452537 exist. The new `src/storage/sync-state.test.ts` exists.
