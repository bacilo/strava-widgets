---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 15
subsystem: analytics-diff-generator
tags: [PR-09, CR-01, WR-01, gap-closure]
requires: []
provides:
  - applyOldCeilings
  - excluded and demoted-guard-changed diff kinds
  - fail-closed splitReinstatements
  - per-kind reconcileCounts addends
affects: [36-16, 36-19, 36-20]
key-files:
  modified:
    - scripts/compute-clean-window-diff.mjs
    - scripts/compute-clean-window-diff.test.mjs
decisions:
  - "OLD ceiling derived from the pre-ceiling reconstruction, then applied with the shipped ceilingDemotion (D-04, D-09)"
metrics:
  tasks: 2
  files: 2
  completed: 2026-11-24
requirements-completed: []
---

# Phase 36 Plan 15: Diff generator CR-01 / WR-01 fix Summary

The diff generator's OLD state now applies the pre-phase ceiling via the shipped `ceilingDemotion`, so a ceiling reinstatement is expressible. A real committed pair proves the bucket can be non-zero.

## Commits

- fbc3f59b: generator fix and synthetic tests (Task 1)
- 2026e407: real-pair test (Task 2)

main() wiring (derive `oldCeilings` from the pre-ceiling `buildPopulations(..., {useOld:true})`, then `applyOldCeilings`, then `buildDiffReport`) landed in fbc3f59b. Line order in the file is 1047, 1049, 1066.

## Task 1 results

- RED: 17 of 34 tests failed before the generator change (export missing, old four-kind contract).
- GREEN: 34 of 34 pass.
- `-t "applyOldCeilings CR-01"` matched 7 tests, all passing.
- `-t "owner-excluded and guard-changed kinds WR-01"` matched 5 tests, all passing.
- All seven headline prefixes verified present with `grep -F`.

### Pre-existing tests whose expectation changed

- Four-kind classification test: allowed-kinds list extended from 4 to 6 (`excluded`, `demoted-guard-changed` added). No record's kind changed.
- reconcileCounts test 1: fixtures gained `contaminatedReason`; now also asserts 2 rows and an `addends` object.
- reconcileCounts test 2 (disagreement): looked up the row by `'moved-but-ranked'`; now by `'contaminated'`, because check 2 sums over every kind. Still expects lists 0, walked 5, agrees false.
- Disagreeing-row render test: check name changed to the new wording and `addends` added. The `| 10 | 15 | NO |` assertion is unchanged.
- splitReinstatements test: kept; a fail-closed test was added.
- `makeOldEffort` now sets `impliedSpeedMps` (meters / duration) instead of null.

## Task 2 results

### Selected pair: 3475714424 @ 400m

Probed all 400m, 1k and 1mi OLD rows in 36-DIFF.md. Measured values for the selected pair:

- (i) Both `data/streams/3475714424.json` and `data/activities/3475714424.json` are tracked (`git ls-files`). The id is absent from `data/best-effort-exclusions.json`, and the effort's `excludedFromRecords` is not true.
- (ii) NEW effort: contaminated non-null, demotion null (real segments from `classifyGapsWithSegments`).
- (iii) OLD implied speed 6.0332 m/s (66.3 s) against pinned pre-phase ceiling 5.1098; activity max_speed 21.2, so `reconstructOldEfforts` leaves demotion null.
- (iv) NEW clean speed 3.2232 m/s (124.1 s), below the post-phase ceiling 5.0295 (selection only, not asserted).

Many other candidates satisfied the checks too (for example 3475723743, 3475712272, 3475725279 at 400m). The reviewer's and verifier's measurements are therefore consistent with the real archive.

### Watched red

With `applyOldCeilings` temporarily made a copy-only no-op, the describe failed: `TypeError: Cannot read properties of null (reading 'guard')` on the applied record's demotion (1 failed, 1 passed). The generator was restored from a backup and is not in the diff. The second `it` (defect path: kind `moved-but-ranked`, ceiling bucket 0) stays green by design.

- `-t "real-pair ceiling reinstatement CR-01"` matched exactly 2 tests, both passing.

## Verification

- `npx vitest run scripts/ src/analytics/pace-single-source.test.ts`: 34 files passed, 1 skipped, 1 failed; 1184 tests passed.
- The one failing file, `scripts/verify-dashboard-publish-stats.test.mjs`, needs the untracked, built `dist/widgets/data/stats/best-efforts.json`. That file is missing in this bare worktree. This is a fixture failure from missing untracked data, not a regression. The single-source audit passes.
- `git diff --exit-code 40cf1651 -- scripts/compute-ceiling-recalibration.mjs <36-DIFF.md>` exits 0.
- `git status --porcelain data/` is empty. 36-DIFF.md was not regenerated; plan 36-19 owns that.
- No pinned probe count in code or tests. The only "31"/"15" mentions were removed from the docblock.

## Deviations from Plan

None. The generator's top docblock and the "FOUR POPULATIONS" paragraph were rewritten as specified.

## Known Stubs

None.

## Self-Check: PASSED

- scripts/compute-clean-window-diff.mjs and .test.mjs exist and are committed (fbc3f59b, 2026e407).
