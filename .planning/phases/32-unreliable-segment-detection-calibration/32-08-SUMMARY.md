---
phase: 32-unreliable-segment-detection-calibration
plan: 08
subsystem: testing
tags: [regression-fixtures, real-stream-testing, cross-check, vitest, d15]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "the shipped detector (src/analytics/unreliable-segments.ts, dist/analytics/unreliable-segments.js) and its calibrated constants (32-06/32-07), and scripts/compute-unreliable-segment-recount.mjs's D-15 gap-first recount (32-03)"
provides:
  - "Permanent regression tests on the real committed streams pinning SEG-02 (3475724402 gap-adjacency, both leading and trailing sides) and SEG-03 (3475734189 hidden-pause, 3475740390 isolated jumps) named behaviours"
  - "D-05 locked negative-control fixtures and D-09's trivia pair both asserted never to fire"
  - "scripts/unreliable-segment-recount-crosscheck.test.mjs — the only file importing both the detector and the independent recount, run every npm test"
affects: ["32-09 (post-merge re-validation and SEG-02/SEG-04 completion)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-stream regression fixture shape (readStream helper mirroring pace-derivation.test.ts) with every expected extent computed in-test from raw t/d, never hard-coded from a prior run's output"
    - "npm-test-time detector-vs-recount cross-check as the single file crossing the D-15 zero-import boundary, with a watched-failing broken-row case proving the comparison can fail before trusting it passes"

key-files:
  created:
    - scripts/unreliable-segment-recount-crosscheck.test.mjs
  modified:
    - src/analytics/unreliable-segments.test.ts

key-decisions:
  - "No scoping-probe figure (30 bursts / 18 gaps / 1,694 m / 106 s / 707 s) is asserted anywhere in the new tests — the docblock names this explicitly and the grep gate confirms no such literal appears as an assertion"
  - "D-01 upheld structurally: the Suunto activity ID (4556693525) does not appear anywhere in unreliable-segments.test.ts, confirmed by a zero-count grep"

patterns-established:
  - "Fast-pair-set computed from raw t/d inside the test (never hard-coded which pairs are fast) as the basis for a coverage assertion — the D-13/lesson-learned 'assert extent against an independently derived value' pattern applied to a hidden-pause window"

requirements-completed: [SEG-01, SEG-02, SEG-03]

# Metrics
duration: ~30min
completed: 2026-09-20
---

# Phase 32 Plan 08: Named-Activity Regression Pinning & Nightly Cross-Check Summary

**Pinned SEG-02/SEG-03's named behaviours as permanent tests on the real committed streams (3475724402, 3475734189, 3475740390) with every extent computed in-test from raw t/d, and added the one file that runs the detector-vs-independent-recount agreement check on every `npm test`.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-20 (session start, continuing from 32-07)
- **Completed:** 2026-09-20T12:22:40Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `src/analytics/unreliable-segments.test.ts` gained five new `describe` blocks reading real
  committed streams via a local `readStream` helper: SEG-02's gap-adjacency check on
  `3475724402` (every segment `gap-adjacent`, both a leading burst→gap pair and a trailing
  gap→burst pair found on the activity's own data, plus per-segment conservation), SEG-03's
  hidden-pause window on `3475734189` (the fast-pair set inside `t=[1353,1358]` computed from
  raw `t`/`d` against `UNRELIABLE_SPEED_LIMIT_MPS`, asserted non-empty before asserting a single
  covering `hidden-pause` segment), SEG-03's five named isolated jumps on `3475740390` (including
  a computed-in-test check that a clean step separates the `t=2580`/`t=2587` pair into two
  distinct segment objects), D-05's two locked negative-control fixtures (never fire), and D-09's
  trivia pair (never fires).
- New `scripts/unreliable-segment-recount-crosscheck.test.mjs` is the sole file importing both
  the compiled detector (`../dist/analytics/unreliable-segments.js`) and the independent
  gap-first recount (`compute-unreliable-segment-recount.mjs`'s `recountGapFirst`/
  `localGapSpans`). It asserts the D-15 precondition (`localGapSpans` agrees with
  `classifyGaps(t, d).gapIntervals` on `3475724402`), a non-vacuous row-by-row agreement between
  the detector and the recount, and a watched-failing case that strips a leading burst off one
  segment and shows the comparison genuinely fails before showing the real output matches.
- Verified `compute-unreliable-segment-recount.mjs` itself is untouched
  (`git diff --stat` empty) — the recount script stays detector-free; only the new test file
  crosses that boundary, exactly as D-15 requires.

## Task Commits

1. **Task 1: Real-stream named-activity fixture tests for the shipped detector** - `fd053fe5` (test)
2. **Task 2: npm-test-time detector vs independent recount cross-check on 3475724402** - `9719d5da` (test)

**Plan metadata:** recorded in the final `docs(32-08)` commit that follows this SUMMARY.

## Files Created/Modified

- `src/analytics/unreliable-segments.test.ts` - added SEG-02/SEG-03/D-05/D-09 real-stream
  regression fixtures (184 lines added; existing mechanics tests untouched)
- `scripts/unreliable-segment-recount-crosscheck.test.mjs` - new, D-15 nightly cross-check

## Verification

- `npx vitest run src/analytics/unreliable-segments.test.ts` — **53/53 passed** (37 pre-existing
  mechanics tests + 16 new real-stream tests)
- `npx vitest run src/analytics/unreliable-segments.test.ts -t "3475724402"` — **4 matched, 4
  passed** (SEG-02's four assertions: reachability, leading side, trailing side, conservation)
- `npx vitest run src/analytics/unreliable-segments.test.ts -t "mechanism"` — **12 matched, 12
  passed** (covers the pre-existing "mechanism labelling" describe plus the two new SEG-03
  "mechanism" describes)
- `grep -cE "\b(30|1694|1,694|707|106)\b" src/analytics/unreliable-segments.test.ts` — the only
  hits are three pre-existing unrelated literal arrays (`[0, 10, 20, 30]`); no scoping-probe
  figure appears as an assertion literal
- `grep -c "4556693525" src/analytics/unreliable-segments.test.ts` — **0**
- `npm run build && npx vitest run scripts/unreliable-segment-recount-crosscheck.test.mjs` —
  **4/4 passed**
- `npx vitest run scripts/compute-unreliable-segment-recount.test.mjs` — **47/47 passed**
  (zero-import guard intact)
- `git diff --stat scripts/compute-unreliable-segment-recount.mjs` — empty (script unchanged)
- Full suite: `npm test` — **90 files / 2788 tests passed** (up from the pre-plan 89/2769: one
  new test file, 19 new tests across the two files)
- `npx tsc --noEmit` — clean

## Decisions Made

None new — this plan consumes the 32-05 blocking decision (locked D-05 fixtures
`7409028052:586-624`, `3647739864:945-971`) verbatim, hard-coded in the test with a comment
citing `32-05-SUMMARY.md § Decision`, and confirms the 32-05 disposition (`option-refixture`, not
`option-amend-criterion-3`) meant all five named jumps on `3475740390` remain mandatory, so the
isolated-jump test uses the full five-item list rather than a narrowed one.

## Deviations from Plan

None — plan executed exactly as written. One drafting correction made before committing (not a
deviation from the plan's intent, just tightening my own draft to meet its own acceptance
criteria): the file's docblock originally spelled out the scoping-probe's numeric figures
(30/1,694/106/707) and the Suunto activity ID in prose explaining what is deliberately NOT
asserted — both would have tripped the plan's own literal grep gates
(`grep -cE "\b(30|1694|1,694|707|106)\b"` and `grep -c "4556693525"`, both required to read `0`
matches or be inspectable non-assertions). Reworded both mentions to describe the exclusion
without repeating the literal figures/ID, verified both gates clean, then committed.

## Issues Encountered

None. Measured values from the real streams matched the orchestrator-provided sanity-check
figures exactly on independent recomputation: the hidden-pause window's fast-pair set
(`t=1353..1358`, six pairs at 29.1–29.7 m/s then 14.4 m/s, all exceeding `7.35 m/s`), the five
named jump pairs' speeds, and the clean 6.95/5.55 m/s steps separating `t=2580` and `t=2587`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEG-02 and SEG-03's named behaviours are now permanent, real-stream-backed regression tests —
  a future change to the detector or its calibrated constants that breaks any of these named
  cases will fail `npm test` immediately, not just the calibration artifact's own recount.
- `scripts/unreliable-segment-recount-crosscheck.test.mjs` closes the gap between "the recount
  passes when a human runs `npm run compute-unreliable-segment-recount`" and "the recount is
  re-proven every night" — it now runs at `npm test` time, the nightly deploy gate.
- 32-09 (post-merge re-validation, SEG-02/SEG-04 completion) is unblocked: both requirements this
  plan targets (SEG-01, SEG-02, SEG-03) now have permanent test coverage on the real archive
  alongside 32-02's synthetic mechanics tests already in place.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: commit `fd053fe5` (Task 1) in `git log --oneline --all`
- FOUND: commit `9719d5da` (Task 2) in `git log --oneline --all`
- FOUND: `src/analytics/unreliable-segments.test.ts` (modified)
- FOUND: `scripts/unreliable-segment-recount-crosscheck.test.mjs`
- `grep -c "4556693525" src/analytics/unreliable-segments.test.ts` returns `0`
- `git diff --stat scripts/compute-unreliable-segment-recount.mjs` returns empty
