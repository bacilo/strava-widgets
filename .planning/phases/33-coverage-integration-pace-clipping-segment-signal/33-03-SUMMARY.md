---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 03
subsystem: analytics
tags: [pace-quality, gap-profile, coverage, unreliable-segments, vitest]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: 01
    provides: "classifyGaps widened to a four-way GapKind ('recording-gap' | 'pause' | 'unreliable' | covered), PaceCoverage.unreliableSec"
provides:
  - "gapProfileSignal's gapFraction widened to a three-term numerator (recordingGapSec + pauseSec + unreliableSec) / spanSec (D-04)"
  - "GAP_PROFILE_SEVERE_FRACTION (0.2) and GAP_PROFILE_MINOR_FRACTION (0.05) proven frozen by a guard test watched RED on a temporary 0.25 edit (D-05)"
  - "Every docblock in pace-quality.ts that describes gapFraction now names all three categories, dated (widened 2026-09-21, 33-CONTEXT.md D-04)"
  - "buildPaceQualityShard's gapIntervals passthrough proven (not just asserted) to carry kind 'unreliable' entries on a real committed stream"
affects: [33-04, 33-05, 33-06, 33-07, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.doMock('./pace-derivation.js', ...) + vi.resetModules() + dynamic import('./pace-quality.js') to pin a private pure function's (tierGapProfileFromCoverage) arithmetic against an exact hand-specified coverage object, when the function itself is not exported — same technique as pace-single-source.test.ts's D-15 load-bearing proof, applied to a different module pair"
    - "Watched-RED-then-revert anti-quota guard demonstration performed as a manual verification step (sed edit, run filtered test, capture output, sed revert, git diff --exit-code), not committed"

key-files:
  created: []
  modified:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts

key-decisions:
  - "D-04/D-05 implemented exactly as specified: three-term numerator, both tier constants byte-identical (confirmed via git diff showing no change on either export const line)"
  - "unreliableSec is NOT echoed on GapProfileSignal, per 33-CONTEXT.md's planner-decision interfaces block (already locked before this plan ran) — the per-kind itemisation lives on PaceQualityShard.gapIntervals and SEG-06's own signal (plan 33-09)"
  - "Task 2's synthetic-coverage tests mock classifyGaps rather than engineering real streams to hit exact figures, since tierGapProfileFromCoverage is a private unexported pure function of the coverage object and cannot otherwise be pinned to a chosen { recordingGapSec, pauseSec, unreliableSec, spanSec } combination"

patterns-established:
  - "A private pure function inside a module can be behaviour-pinned via vi.doMock on the module IT depends on (not the module itself), avoiding both an unwanted export and unreliable real-stream engineering"

requirements-completed: []  # This plan's own text (requirement-tick safety) forbids ticking COV-03 here; plan 33-13 alone sets its disposition against rendered checkpoint evidence.

# Metrics
duration: ~30min
completed: 2026-09-21
---

# Phase 33 Plan 3: gapFraction three-term numerator (D-04) and frozen tier constants (D-05) Summary

**Widened `gapProfileSignal`'s `gapFraction` numerator to `(recordingGapSec + pauseSec + unreliableSec) / spanSec`, corrected every docblock in `pace-quality.ts` that describes the number, and proved both tier constants stay frozen with a guard watched RED on a temporary edit and reverted clean.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `tierGapProfileFromCoverage`'s arithmetic widened to a three-term numerator per D-04, with an inline comment naming the measured reason (the 63 gap-adjacent activities keep exactly today's fraction under D-01, so excluding unreliable time could only shrink it and drop badges on a re-label)
- Five docblock sites corrected to name all three categories, each dated `(widened 2026-09-21, 33-CONTEXT.md D-04)`: `GapProfileSignal`'s interface doc and inline `gapFraction` comment, `GAP_PROFILE_SEVERE_FRACTION`'s part (1) WHAT IT MEASURES, and `tierGapProfileFromCoverage`'s own docblock (two sites)
- New anti-quota part (5) appended to `GAP_PROFILE_SEVERE_FRACTION`'s docblock restating Phase 27's D-02 rule, and annotating part (3)'s cohort figures as unmoved Phase 27 measurements over the old two-term numerator
- Both tier constants (`0.2`, `0.05`) confirmed byte-identical via `git diff` showing no change on either `export const GAP_PROFILE_*_FRACTION` line
- `notComputableSignals`, `hasAnySevereSignal`'s three-member `Pick<>`, `resolveCoverage`, and `buildPaceQualityShard`'s `gapIntervals: coverage.gapIntervals` passthrough all confirmed untouched
- 7 new tests added (`-t "gapProfile"` selects all of them): 4 synthetic coverage-object cases (severe/minor/matrix/spanSec-0-guard) via `vi.doMock`, the D-05 anti-quota pin, and 2 real-stream cases (numerator arithmetic, shard passthrough) on 3475724402
- Anti-quota pin watched RED: temporarily set `GAP_PROFILE_SEVERE_FRACTION` to `0.25`, ran the filtered test, observed 2 failures (the pin test itself, plus a cascading failure in the unreliableSec-0 matrix's 0.25-boundary case since both read the same shared constant), reverted, confirmed `git diff --exit-code src/analytics/pace-quality.ts` clean

## Task Commits

1. **Task 1: D-04 three-term numerator and every docblock that describes it** - `a745973b` (feat)
2. **Task 2: Numerator, anti-quota and shard-passthrough tests on a real stream** - `4499af0a` (test)

_No plan-metadata commit — this is a worktree-isolated parallel execution; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified

- `src/analytics/pace-quality.ts` — `tierGapProfileFromCoverage`'s numerator widened to three terms; `GapProfileSignal` interface doc and inline comment corrected; `GAP_PROFILE_SEVERE_FRACTION`'s docblock corrected (part 1) and extended (new part 5, anti-quota); both tier constants byte-identical
- `src/analytics/pace-quality.test.ts` — new `describe('gapProfile numerator widening (D-04) and constant freeze (D-05)', ...)` block, 7 tests, all named to match `-t "gapProfile"`

## Verification Evidence

- `npx tsc --noEmit`: exit 0
- `npm run build`: exit 0
- `grep -c 'coverage.recordingGapSec + coverage.pauseSec + coverage.unreliableSec' src/analytics/pace-quality.ts` → `1`
- Stripped-source leftover two-term check: `grep -v '^\s*\*' src/analytics/pace-quality.ts | grep -c 'coverage.pauseSec) / coverage.spanSec'` → `0`
- Dated markers: `grep -c 'widened 2026-09-21, 33-CONTEXT.md D-04' src/analytics/pace-quality.ts` → `5` (at lines 102, 114, 853, 889, 934 — all 5 correction/annotation sites, at least 4 required)
- `hasAnySevereSignal`'s `Pick<>`: `grep -c "signals: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>"` → `1`, unchanged
- Both tier constants byte-identical: `git show a745973b -- src/analytics/pace-quality.ts | grep -E '^[+-].*GAP_PROFILE_(SEVERE|MINOR)_FRACTION ='` → no output (no diff on either line)
- Remaining `'gaps or pauses'`/`'recording gaps and pauses'` matches: `grep -n 'gaps or pauses\|recording gaps and pauses' src/analytics/pace-quality.ts` → one hit, line 958: `// numerator alongside recording gaps and pauses. Measured reason: under`. This is a new comment I wrote for Task 1's D-04 justification note — it reads "unreliable time enters the numerator ALONGSIDE recording gaps and pauses", which correctly describes the widening (it does not claim the numerator counts ONLY gaps and pauses), so it is not the misdescription defect D-11 warns against. No Phase-27-dated figure needed annotating here since it is new prose, not carried-over text.
- `-t "gapProfile"` filtered run: `Tests 7 passed` (0 failed), whole file `Tests 87 passed` (0 failed)
- 3475724402 (from the test's own console output, recomputed independently in-test from `classifyGaps`' own coverage object): `spanSec 4345, recordingGapSec 46, pauseSec 0, unreliableSec 751, threeTermFraction 0.18342922899884925, twoTermFraction 0.010586881472957423` — three-term strictly greater than two-term, confirmed
- `buildPaceQualityShard` on 3475724402: `totalIntervals 18, unreliableIntervals 16`
- Anti-quota RED output (verbatim, temporary `GAP_PROFILE_SEVERE_FRACTION = 0.25` edit, `-t "gapProfile"`):
  ```
  FAIL src/analytics/pace-quality.test.ts > gapProfile numerator widening (D-04) and constant freeze (D-05) > unreliableSec 0 reproduces today's (pre-D-04) tier and fraction exactly, for a matrix of recordingGapSec/pauseSec combinations
  AssertionError: expected 'minor' to be 'severe' // Object.is equality

  FAIL src/analytics/pace-quality.test.ts > gapProfile numerator widening (D-04) and constant freeze (D-05) > D-05: GAP_PROFILE_SEVERE_FRACTION and GAP_PROFILE_MINOR_FRACTION are frozen at their pre-Phase-33 values, never re-derived for the widened numerator
  AssertionError: expected 0.25 to be 0.2 // Object.is equality
  - Expected 0.2
  + Received 0.25

  Test Files  1 failed (1)
       Tests  2 failed | 5 passed | 80 skipped (87)
  ```
  Reverted with `sed`; `git diff --exit-code src/analytics/pace-quality.ts` returned exit `0` (clean) immediately after.
- Scoped file/test counts: `pace-quality.test.ts` whole-file 87/87 passed (was 80 before this plan's own 7 new tests, per this plan's own count — no prior-plan baseline recorded that number specifically, since 33-01/33-02 did not touch this file)
- `npm test`: 91 files / 2742 tests, 7 files / 3 tests failing — the same pre-existing environmental ENOENT set recorded in `33-01-SUMMARY.md` (gitignored `data/stats/*.json`, `data/dashboard/index.json`, `dist/widgets/data/stats/best-efforts.json`, all absent in this bare worktree), same file/test identities. Delta vs 33-01's recorded 2735: +7, exactly this plan's own new tests.
- `git status --porcelain data/streams`: empty

## Decisions Made

- Followed D-04/D-05 exactly as specified in `33-CONTEXT.md` — no deviation on the core arithmetic or the constant-freeze decision.
- Used `vi.doMock('./pace-derivation.js', ...)` + `vi.resetModules()` + dynamic re-`import('./pace-quality.js')` for the four synthetic-coverage test cases (bullets 2-5 of Task 2's `<behavior>`), rather than engineering real streams to hit exact `{ recordingGapSec: 0, pauseSec: 0, unreliableSec: 30, spanSec: 100 }`-style combinations. `tierGapProfileFromCoverage` is a private, unexported pure function of the coverage object — mocking the classifier it's built on is the only way to pin its arithmetic to chosen values without either exporting a function the plan's action text never asked to export, or attempting brittle real-stream engineering against the calibrated detector's own speed-limit/excess-metres thresholds. This mirrors `pace-single-source.test.ts`'s established `vi.doMock` + dynamic-import technique for a different module pair.
- Placed all 7 new tests in one new `describe` block (per Task 2's own instruction: "Extend ... with one describe block covering every bullet in behavior"), inserted directly after the pre-existing `describe('gap profile signal', ...)` block.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3/4 auto-fixes were needed; both tasks' own acceptance criteria were met on the first implementation pass.

## Issues Encountered

- One accidental environment-setup artifact: the worktree-setup `cp -R .../data data` command (from this plan's own environment notes) landed inside the pre-existing tracked `data/` directory rather than replacing it, producing a stray untracked `data/data/` nested copy. Removed with `rm -rf data/data` (a plain filesystem delete of my own accidental copy, not a git operation) before any `git add`/commit — confirmed via `git status --short` showing only the intended `src/analytics/pace-quality.ts`/`.test.ts` changes afterward. Not a code defect; not committed.

## Next Phase Readiness

- `gapProfileSignal`'s three-term `gapFraction`, both frozen tier constants, and the proven `gapIntervals` shard passthrough are ready for plan 33-07 (the archive-wide before/after per-tier migration measurement plan 33-03's own docblock defers to it) and plan 33-09 (SEG-06's own signal, which itemises `unreliableSec` separately where `GapProfileSignal` deliberately does not).
- No blockers. `data/streams/` untouched (`git status --porcelain data/streams` empty). Both tier constants unmoved, confirmed via `git diff` on the exact `export const` lines.
- COV-03 is deliberately NOT ticked by this plan, per its own requirement-tick-safety text — plan 33-13 alone sets its disposition against rendered checkpoint evidence.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/analytics/pace-quality.ts`
- FOUND: `src/analytics/pace-quality.test.ts`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-03-SUMMARY.md`
- FOUND commit: `a745973b`
- FOUND commit: `4499af0a`
