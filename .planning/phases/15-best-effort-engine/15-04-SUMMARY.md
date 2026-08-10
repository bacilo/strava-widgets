---
phase: 15-best-effort-engine
plan: 04
subsystem: analytics
tags: [vitest, best-effort, external-validation, fixtures, testing]

# Dependency graph
requires:
  - phase: 15-best-effort-engine (plan 01)
    provides: best-effort.types.ts contracts, best-effort-utils.ts sweep/guard/PR functions
  - phase: 15-best-effort-engine (plan 02)
    provides: computeActivityEfforts (pure per-activity computation seam)
  - phase: 15-best-effort-engine (plan 03)
    provides: Verified data/stats/best-efforts.json over the real 1,842-activity archive, used to select fixture candidates
provides:
  - "15-FIXTURE-CANDIDATES.md worksheet with 8 candidate rows and the developer's human-verified reported times/notes"
  - "src/analytics/best-effort-fixtures.test.ts: 6 frozen external-reference fixtures proving the engine's computed times match Strava/intervals.icu's own reported values within 2%"
  - "D-05 (external reference validation) and REC-01 satisfied"
affects: [16-dashboard-shell, 17-activity-browser, 18-records-and-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External-reference fixture suite reads the real committed archive (data/streams/, data/activities/) directly via node:fs, never the gitignored derived-stats output — proven by running the suite with data/stats/ removed entirely"
    - "Fixture rows a developer could not verify against a platform panel are dropped, never estimated or backfilled from the engine's own output — enforced by the file's own doc comment and by review, not by code"

key-files:
  created:
    - src/analytics/best-effort-fixtures.test.ts
  modified:
    - .planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md

key-decisions:
  - "Rows 3 and 6 (5k efforts on activities 7827165619 and 9716153503) were dropped from the frozen fixture set: Strava does not display a 5k best-effort panel for either activity, so the only available confirmation was the developer's manual judgment/calculation rather than a platform-reported value. Freezing them would have violated the plan's own anti-circularity rule (no expected value may be derived from the engine's own output) and the worksheet's explicit no-estimation rule. The remaining 6 rows still clear every coverage guard (>=5 rows, a 400m/1k row, >=2 distinct sources)."
  - "Activities 3475726256 and 3475725513 (rows 1-2, 400m and 1k) were recorded with a poor/inaccurate GPS device per the developer. Their platform-reported values still matched the engine's computed output exactly, so they were kept as fixtures (device accuracy affects real-world PR trustworthiness, not whether the engine reproduces what the platform itself reports) — but the caveat is recorded in the worksheet Notes and below for provenance."

patterns-established: []

requirements-completed: [REC-01]

# Metrics
duration: 36min
completed: 2026-08-10
---

# Phase 15 Plan 04: External-Reference Fixture Validation Summary

**Best-effort engine validated against Strava's and intervals.icu's own reported best-effort times on 6 source-diverse fixtures (400m, 1k, 10k, half, plus two intervals-sourced 5k/10k efforts), all matching within the 2% D-05 tolerance, with two unverifiable candidate rows correctly dropped rather than approximated.**

## Performance

- **Duration:** 36 min (Task 1 commit to Task 3 commit)
- **Started:** 2026-08-10T17:49:45+02:00 (Task 1, prior executor)
- **Completed:** 2026-08-10T18:25:33+02:00
- **Tasks:** 3 (Task 1 by prior executor; Tasks 2-3 this session)
- **Files modified:** 2

## Accomplishments

- Transcribed the developer's per-row Strava/intervals.icu verification of all 8 candidate rows into `15-FIXTURE-CANDIDATES.md`'s `Reported time` and `Notes` columns, faithfully preserving the human's exact confirmations without fabricating any precision beyond what was given.
- Correctly identified and dropped 2 of 8 candidate rows (5k on `7827165619` and `9716153503`) as `not available` because Strava does not surface a 5k best-effort panel for either activity — the human's manual judgment/calculation on those rows is documented in Notes but excluded from the frozen fixture set per the plan's explicit no-estimation, no-circularity rules.
- Created `src/analytics/best-effort-fixtures.test.ts`: 6 frozen `FIXTURES` rows (400m, 1k, 10k, half on native-fit activities; 5k, 10k on the sole `intervals`-sourced activity `i174284902`), each read from the developer-verified worksheet, each asserting `computeActivityEfforts`'s output matches the platform-reported duration within 2%.
- Verified the suite reads only the real committed archive (`data/streams/`, `data/activities/`) — confirmed by deleting `data/stats/` entirely and re-running the suite, which still passed (fresh-clone / CI safety proof required by the plan).
- Full test suite: 201/201 passing (191 prior + 10 new: 6 fixture assertions + 4 coverage-guard assertions), `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the fixture-candidate worksheet** - `788ea04` (docs) — completed by prior executor before the checkpoint
2. **Task 2: Collect the externally-reported best-effort times** - `9dfe9f5` (docs) — transcribed the human's verbal confirmations into the worksheet's `Reported time`/`Notes` columns
3. **Task 3: Freeze the fixtures and assert the engine against them** - `027dc25` (test)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `src/analytics/best-effort-fixtures.test.ts` - 6-row external-reference fixture suite, `it.each` tolerance assertions plus 4 coverage-guard tests, reads real archive via `node:fs`
- `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` - worksheet updated with all 8 rows' `Reported time`/`Notes`, plus a "Verification Notes" section documenting the poor-device caveat and the future exclusion-list follow-up

## Decisions Made

- Dropped rows 3 and 6 (5k on `7827165619` and `9716153503`) from the frozen fixture set rather than freezing the human's "looks correct" judgment as an expected value — see key-decisions above for full reasoning. The remaining 6 rows still satisfy every plan-level coverage guard.
- Kept rows 1-2 (400m/1k on `3475726256`/`3475725513`) as fixtures despite the developer's poor-device caveat, because the platform's own reported value — the thing this suite actually checks — matched the engine's output exactly; device-accuracy concerns are a personal-best-trustworthiness question, not an engine-correctness question, and are tracked separately (see Follow-ups below).

## Deviations from Plan

None - plan executed exactly as written. The plan itself anticipated and pre-authorized the "drop rows the platform doesn't report" outcome (see Task 2's action text and acceptance criteria), so applying that rule to rows 3 and 6 is plan-compliant execution, not a deviation.

## Issues Encountered

None.

## Follow-ups (not implemented in this plan)

- **Manual activity exclusion for personal-best calculations:** the developer requested a future feature to manually exclude specific activities (e.g. `3475726256`, `3475725513`) from personal-best/PR calculations, because they were recorded with an inaccurate GPS device and are not fully trustworthy despite matching Strava's own reported values. This is out of scope for Phase 15 (which validates engine correctness, not source-activity curation) and no code changes were made for it. Recommend surfacing this during Phase 18 (Records & Trends) planning, since that is where PR-list presentation and any exclusion/override UI would live. Not filed as a `.planning/todos/pending/` item by this executor — flagging here for the next planning session to triage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-05 (external reference validation) is satisfied: `src/analytics/best-effort-fixtures.test.ts` proves the engine's computed times agree with Strava's/intervals.icu's own reported values within 2% on a source-diverse, decimation-sensitive fixture set.
- REC-01 requirement marked complete.
- Phase 15 (best-effort-engine) is now fully validated: unit tests (plans 01-02) prove internal consistency, the real archive run (plan 03) proves the pipeline works end-to-end at scale, and this plan proves external correctness. Ready for Phase 16 (dashboard shell) and beyond to consume `data/stats/best-efforts.json` with confidence.
- Full test suite: 201/201 passing, no regressions, `tsc --noEmit` clean.

---
*Phase: 15-best-effort-engine*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` (worksheet with all 8 rows filled)
- FOUND: `src/analytics/best-effort-fixtures.test.ts` (178 lines, 6 FIXTURES rows, 10 tests)
- FOUND commits: `788ea04`, `9dfe9f5`, `027dc25` (`git log --oneline -5`)
- Re-ran plan-level `<verification>`:
  - `npx vitest run src/analytics/best-effort-fixtures.test.ts` — exit 0, 10/10 passing
  - `npx vitest run` (full suite) — exit 0, 201/201 passing, no regressions
  - `npx tsc --noEmit` — exit 0
  - Deleted `data/stats/` and re-ran the fixture suite — still exit 0, proving fresh-clone/CI safety; restored `data/stats/` afterward
- Re-ran all task-level `<acceptance_criteria>`:
  - Task 2: every candidate row has a non-empty `Reported time` cell (`MM:SS` or `not available`); 6 rows carry `MM:SS`; row 1 targets `400m`; 2 distinct sources (`fit`, `intervals`) among `MM:SS` rows; no `Reported time` equals the engine's computed time without explicit developer confirmation
  - Task 3: `npx vitest run src/analytics/best-effort-fixtures.test.ts` exit 0; `grep -c "expectedDurationSec"` = 11 (≥5); `grep -q "TOLERANCE = 0.02"` matches; `grep -Ec "best-efforts.json"` = 0; `grep -q "computeActivityEfforts"` matches; every fixture row carries a non-empty `reference`; suite passes with `data/stats/` absent; full suite exit 0
