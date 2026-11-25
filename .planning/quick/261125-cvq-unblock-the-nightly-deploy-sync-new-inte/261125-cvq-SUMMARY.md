---
phase: quick-261125-cvq
plan: 01
subsystem: ci-data-calibration
tags: [intervals-icu, calibration, nightly-deploy, pace-disagreement]
key-files:
  modified:
    - data/activities/*.json
    - data/streams/*.json
    - data/sync-state.json
    - .planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md
    - src/analytics/pace-derivation.ts
    - src/analytics/compute-dashboard-index.test.ts
decisions:
  - "Task 2: developer chose \"Recalibrate (Recommended)\" (2026-11-25). Archive-pinned assertions inside the blocking deploy gate go to a follow-up phase, not this task."
metrics:
  completed: 2026-11-25
---

# Quick 261125-cvq: Unblock the nightly deploy Summary

Synced 55 intervals.icu runs locally and recalibrated PACE_DISAGREEMENT_RUNNING_RATIO (1.0173 to 1.0171) via its generator, so local master passes the full CI sequence, including a fresh fetch, on a clean clone. Nothing is pushed.

## Commits

- a6321d59: plan
- 49ee8386: Task 1, sync of 55 runs (2026-09-20..2026-11-24): data/activities, data/streams, manifest, sync-state only
- c6241d9d: Task 3, regenerated 35-CALIBRATION.md, constant and provenance comments, count row

## Decision (Task 2)

"Recalibrate (Recommended)", chosen 2026-11-25.

## Before / after

| | Before | After |
|---|---|---|
| PACE_DISAGREEMENT_RUNNING_RATIO | 1.0173 | 1.0171 |
| Population C N | 377 | 382 |
| Newly-disputed count (E) | 125 (123 post-Phase-36 detector) | 124 |
| Count row expected | 125 - 2 | 124 (no subtraction) |

- Basis gate PASS (3475724402 eligible, ratio 1.0731 > cut). No HALT.
- Badge flips: ZERO. The flip-diff at cuts 1.0173 vs 1.0171 over the synced archive gives identical 124-activity sets.
- Count row now `toBe(expectedCount)`. The two Phase-36 ids (14675028146, 4598855187) are still asserted unflagged. No other assertion changed. Fixtures (1.0557 flagged, 1.0135 unflagged) stay on their sides of the new cut.

## Idempotence

sha256 of 35-CALIBRATION.md: `52aba8f03762d696a759266e9e4478e383b9873ee0c2f937e13a9fa3dc58232a`. It was identical before and after a second `--write` run following the commit. The tree stayed clean.

## Gates

- Local (build, compute-all-stats without --write-ceiling-state, build-widgets, npm test, verify-dashboard): 108 files / 3971 tests passed, 67 publish checks passed. The geo churn was restored.
- Clean clone (node_modules symlinked, .env copied) with a fresh sync-intervals (it saved 1 newer run, in the clone only), then build, compute-all-stats --ci, build-widgets, vitest and verify-dashboard: 108 files / 3971 tests passed, 67 checks passed. Clone deleted.
- The two target test files after the change: 135 tests passed.
- No vitest -t filter was used in Task 3.

## Deviations

None. The tsc and vitest runs matched the plan. The comment at test line 1276 needed a second sed because the literal sat on a wrapped line.

## Recurrence note (report only)

The blocking `Run test suite` step runs after the fetch. Any test that pins a figure parsed from a committed calibration artifact against the live archive fails the first night a new run moves it. At the observed rate, 55 runs moved the count by 1. Test files that read `.planning/` artifacts and scan data/activities or data/streams:
- src/analytics/compute-dashboard-index.test.ts (the count row, the one that broke)
- src/analytics/best-effort-fixtures.test.ts
- src/analytics/unreliable-segments.test.ts
- scripts/compute-unreliable-segment-recount.test.mjs
- scripts/compute-coverage-identity-recount.test.mjs

This list is from a cheap grep, and not every entry is necessarily archive-count-pinned. Structural options for a follow-up phase, without choosing: run archive-pinned rows against the pre-fetch committed tree; move them to a non-blocking step; or have CI regenerate the artifacts.

## Push instruction for the orchestrator (not done here)

Run `git fetch origin`. If origin is behind or equal (currently 0 behind), run `git push origin master`, a plain push with no force. If origin has moved, merge origin/master first and never rebase. Local master is about 513 commits ahead. The push triggers the push-paths run. No commit message contains the skip-ci token.

## Self-Check: PASSED

Commits a6321d59, 49ee8386 and c6241d9d exist. The artifact sha256 was verified before and after regeneration.
