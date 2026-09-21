---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 04
subsystem: dashboard-views
tags: [detail-sections, gap-classification, coverage-caption, gap-profile-row, vitest]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: 01
    provides: "classifyGaps widened to four-way GapKind (unreliable at top priority), PaceCoverage.unreliableSec"
provides:
  - "splitGapAnnotations: three-way accumulation (recordingGapSec/pauseSec/unreliableSec), closing the trap where an unreliable interval was silently disclosed as a pause"
  - "dominantGapKindLabel (now exported): unreliable-first priority over the existing recording-gap/pause magnitude and tie rules"
  - "coverageCaptionText: fourth always-on unreliable term, independent rounding preserved"
  - "gapProfileRow: 'Coverage gaps' label in all three branches, healthy/tiered copy naming all three categories, evidence line itemising unreliable segments separately from gap/pause intervals"
affects: [33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unreliable-first priority check before an existing two-way magnitude/tie rule, applied identically at both the accumulation site (splitGapAnnotations) and the label-selection site (dominantGapKindLabel)"
    - "Always-on disclosure for a category that can legitimately be zero (D-10's fourth caption term, D-11's zero-unreliable evidence clause) — an omitted clause reads as 'unknown', not 'none'"
    - "A previously-unexported pure render-plan helper (dominantGapKindLabel) exported solely for direct unit-test reachability, since its only production call site sits inside a DOM builder this test file cannot exercise"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "D-09/D-10/D-11 implemented exactly as specified: three-way split accumulation, unreliable-first dominant label (new label 'unreliable segment'), four-term always-on caption, 'Coverage gaps' label + itemised evidence"
  - "Exported dominantGapKindLabel (Rule 2/testability) — it was private and reachable only through buildSplitsSection, a DOM builder this file's own established convention never exercises; the plan's worked-example behaviour bullets require testing the label decision directly, which was otherwise impossible without re-deriving the same logic independently in-test (a strictly weaker check)"
  - "Fixed notAvailableRows' quality===null fallback label ('Recording gaps' -> 'Coverage gaps', Rule 1) — outside this plan's three named gapProfileRow branches but caught by this plan's own whole-file grep acceptance gate; left unfixed it would leave one of the four rendering paths for this signal disagreeing with the other three"
  - "Copied data/stats and data/dashboard from the primary checkout into this bare worktree (environment setup, not a deviation) using a per-subdirectory cp rather than cp -R data, after a first attempt nested a redundant data/data/ copy inside the pre-existing tracked data/ directory; removed before any commit"

requirements-completed: []  # Per this plan's own requirement-tick-safety text (PACE-09, COV-03 are plan 33-13's job, against rendered checkpoint evidence)

# Metrics
duration: ~50min
completed: 2026-09-21
---

# Phase 33 Plan 4: detail-sections.ts three-way split, four-term caption, itemised gap-profile evidence Summary

**Closed both silent-inheritance traps named in this plan's objective — `splitGapAnnotations`' two-way else no longer folds an unreliable interval into `pauseSec`, and `gapProfileRow`'s copy now names all three categories it actually counts — while shipping the caption's fourth always-on `unreliable` term and the unreliable-first split marker.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 2 (both in the plan's own declared scope)

## Accomplishments

- `SplitGapAnnotation` gains `unreliableSec`; `splitGapAnnotations`' `else { pauseSec += overlapSec }` replaced with an explicit three-way `if/else if/else`, watched failing (RED) on a temporary restoration of the old branch before being trusted, then reverted clean
- `dominantGapKindLabel` (exported for direct testability) checks `unreliableSec > 0` first and returns `'unreliable segment'`, unconditionally, before falling through to the existing byte-for-byte-unchanged recording-gap/pause magnitude and tie rule
- Real-fixture regression pinned: `3475740390` split 8 (the t=2508 isolated GPS jump, `d=7305 m`, derived in-test from the raw stream — matches 33-VALIDATION.md's prediction) carries `unreliableSec > 0` and the unreliable label
- `coverageCaptionText` renders a fourth, always-on `{u}% unreliable` term (never behind an `> 0` guard), independent rounding preserved and widened to four terms in its own docblock
- `gapProfileRow`'s label is `'Coverage gaps'` in all three branches (not-computable, healthy, tiered); healthy text names all three categories; tiered text reads `'... in gaps, pauses or unreliable segments'`; evidence line itemises `shard.gapIntervals` by kind, always stating the unreliable count including zero
- Found and fixed a fourth rendering path for the same signal that the plan's own three-branch scope did not name: `notAvailableRows()`'s `quality === null` fallback still said `'Recording gaps'` — caught by this plan's own whole-file grep acceptance gate, not by the three-branch read_first scope

## Task Commits

1. **Task 1: D-09 - three-way split annotation and the unreliable-first dominant label** - `32a58494` (feat)
2. **Task 2: D-10 - the caption's fourth always-on term** - `16d8a7f8` (feat)
3. **Task 3: D-11 - gapProfileRow copy and an itemised evidence line** - `e2e3ba3f` (feat)

_No plan-metadata commit — this is a worktree-isolated parallel execution; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` — `SplitGapAnnotation`/`splitGapAnnotations` widened to three-way (D-09); `dominantGapKindLabel` widened and exported; `coverageCaptionText` widened to four terms (D-10); `gapProfileRow` relabelled and its evidence line itemised (D-11); `notAvailableRows`' gap-profile entry relabelled to match (Rule 1)
- `src/dashboard/views/detail-sections.test.ts` — every pre-existing `SplitGapAnnotation`/caption/gap-profile-row assertion updated to the new shape; new cases for the unreliable branch, the dominant-label priority rule (four worked examples), the real 3475740390 split-8 fixture, the caption's always-on 0% case, the non-summing-to-100 fixture, the real 3475724402/4556693525 caption strings, and D-11's itemised evidence (severe-with-unreliable, zero-unreliable, singular/plural)

## Task 1 verification detail (D-09)

**Km index derivation for 3475740390's t=2508 jump** (derived in-test, not trusted from 33-VALIDATION.md):
- `stream.t.findIndex(t => t === 2508)` = index 629; `stream.d[629]` = **7305 m** (matches the plan's stated `d=7305 m`)
- The split whose `[startTimeSec, endTimeSec]` window contains `t=2508` is **km 8** (`startTimeSec: 2393.34`, `endTimeSec: 2684.46`) — matches 33-VALIDATION.md's predicted split 8
- That interval's `kind` is `'unreliable'` (`{startSec: 2508, endSec: 2513, kind: 'unreliable'}`), confirmed live via `derivePaceWithCoverage`

**Watched-RED demonstration** (two-way `else { pauseSec += overlapSec }` temporarily restored, `npx vitest run src/dashboard/views/detail-sections.test.ts -t "splitGapAnnotations"` run, then reverted):

```
FAIL src/dashboard/views/detail-sections.test.ts > splitGapAnnotations — gap marker source of truth > an unreliable-kind interval overlapping a split contributes to unreliableSec and totalSec, and ZERO to pauseSec — a test that would still pass under the old two-way else is not acceptable
AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]
  { km: 1, pauseSec: 30 (expected 0), recordingGapSec: 0, totalSec: 30, unreliableSec: 0 (expected 30) }

FAIL src/dashboard/views/detail-sections.test.ts > splitGapAnnotations — gap marker source of truth > totalSec equals the three-term sum, and a split with only unreliable overlap is still emitted (totalSec > 0)
AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]
  { km: 2, pauseSec: 5 (expected 0), recordingGapSec: 0, totalSec: 5, unreliableSec: 0 (expected 5) }

FAIL src/dashboard/views/detail-sections.test.ts > splitGapAnnotations — real activity 3475740390 (split-8 unreliable fixture, PACE-09) > the split covering t=2508's isolated GPS jump is derived in-test as km 8 and carries unreliableSec > 0 with the unreliable label
AssertionError: expected 0 to be greater than 0

Test Files  1 failed (1)
     Tests  3 failed | 14 passed | 126 skipped (143)
```

All three failures name exactly the unreliable-counted-as-pause case. After reverting to the three-way fix, `npx tsc --noEmit` passed and all 17 filtered tests passed; `git diff --exit-code src/dashboard/views/detail-sections.ts` after the revert showed the file restored to the intended three-way state (verified by re-running `tsc`/the filtered suite, which matched the pre-experiment green state exactly).

**Every call site of `dominantGapKindLabel`** (grepped): exactly one production call site, `buildSplitsSection` (`src/dashboard/views/detail-sections.ts:376`, `const kindLabel = dominantGapKindLabel(annotation);`). Its expected-copy test is `splitGapAnnotations — real activity 10198771331` (`10198771331`'s km 11 annotation), updated to call the real function directly (`dominantGapKindLabel(annotations[0])`) instead of re-deriving the label independently, asserting `'recording gap'`.

## Task 2 verification detail (D-10)

- `'{c}% of elapsed time covered · {r}% recording gaps · {p}% paused · {u}% unreliable'` rendered for a coverage with `unreliableSec: 0`: `'75% of elapsed time covered · 25% recording gaps · 0% paused · 0% unreliable'`
- Non-summing fixture (spanSec 7, coveredSec 2, recordingGapSec 2, pauseSec 2, unreliableSec 1): rounded integers **29, 29, 29, 14**, sum **101** (not 100)
- Real stream `4556693525`: `'98% of elapsed time covered · 1% recording gaps · 0% paused · 1% unreliable'` (measured live: spanSec 3394, coveredSec 3331, recordingGapSec 31, pauseSec 0, unreliableSec 32)
- Real stream `3475724402`: `'82% of elapsed time covered · 1% recording gaps · 0% paused · 17% unreliable'` (measured live: spanSec 4345, coveredSec 3548, recordingGapSec 46, pauseSec 0, unreliableSec 751)

## Task 3 verification detail (D-11)

Rendered `valueText`/`evidenceText` for three fixtures:

- **Healthy:** `valueText: 'No gaps, pauses or unreliable segments'`, `label: 'Coverage gaps'`, `evidenceText: null` (no shard)
- **Tiered, with unreliable intervals** (3 gap/pause + 2 unreliable): `valueText: '27% of recorded time in gaps, pauses or unreliable segments'`, `evidenceText: '3 gap/pause intervals, 2 unreliable segments; longest 16:43'`
- **Tiered, zero unreliable intervals** (2 gap/pause + 0 unreliable): `evidenceText: '2 gap/pause intervals, 0 unreliable segments; longest 16:43'` — the zero is stated explicitly, not omitted
- Singular/plural: 1-of-each fixture renders `'1 gap/pause interval, 1 unreliable segment; longest 0:49'`; 2-of-each renders `'2 gap/pause intervals, 2 unreliable segments; longest 0:49'`

## Decisions Made

- Followed D-09/D-10/D-11 exactly as specified in 33-CONTEXT.md and 33-PATTERNS.md — no deviation on core design (unreliable-first priority, no second marker, no three-way magnitude comparison, itemise not raw-count for the evidence line).
- Exported `dominantGapKindLabel` (previously private) so the plan's own worked-example behaviour bullets could be tested against the real function rather than a re-derived copy of its logic.
- `pace-quality.ts`'s `gapFraction` computation (which this plan's D-11 comment references as "plan 33-03 widens") was not touched — confirmed out of this plan's declared file scope, sibling plan 33-03's job, running in a separate worktree this session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Testability] Exported `dominantGapKindLabel`**
- **Found during:** Task 1, writing the worked-example tests the plan's own `<behavior>` bullets require
- **Issue:** The function was private, reachable only through `buildSplitsSection` (a DOM builder this test file's own header comment establishes is never exercised here) — the plan's exact worked examples ("pauseSec 200 and unreliableSec 2.7 returns the unreliable label") could not be tested against the real function at all, only re-derived independently in-test (a strictly weaker check per this project's stated conventions)
- **Fix:** Added `export` to the function declaration with a docblock paragraph stating why
- **Files modified:** `src/dashboard/views/detail-sections.ts`
- **Verification:** `npx tsc --noEmit` exits 0; four new direct tests pass
- **Committed in:** `32a58494`

**2. [Rule 1 - Bug] Fixed `notAvailableRows`' stale `'Recording gaps'` label**
- **Found during:** Task 3, running this plan's own whole-file acceptance grep (`grep -c "label: 'Recording gaps'"` expected `0`)
- **Issue:** `notAvailableRows()` (the `quality === null` fallback, a fourth rendering path for the gap-profile signal outside `gapProfileRow`'s own three named branches) still read `'Recording gaps'`, disagreeing with the label every other path now uses
- **Fix:** Relabelled to `'Coverage gaps'` with a comment citing D-11 and the consistency reasoning
- **Files modified:** `src/dashboard/views/detail-sections.ts`
- **Verification:** `grep -v '^\s*\*' src/dashboard/views/detail-sections.ts | grep -c "label: 'Recording gaps'"` prints `0`
- **Committed in:** `e2e3ba3f`

---

**Total deviations:** 2 auto-fixed (1 Rule 2 testability, 1 Rule 1 bug/consistency)
**Impact on plan:** Both required for this plan's own stated acceptance criteria (worked-example direct testing; whole-file grep gate). No scope creep into `pace-quality.ts`, `pace-quality-client.ts`, or `list.ts` — all changes confined to `detail-sections.ts`/`detail-sections.test.ts`, the plan's declared files.

## Environment Setup (not a code deviation)

This worktree is a bare clone per the environment notes. `node_modules` was symlinked; `data/` needed `data/stats` and `data/dashboard` (both gitignored, absent in a bare worktree). The first attempt (`cp -R <source>/data data`) nested a redundant `data/data/` inside the pre-existing tracked `data/` directory (most of `data/` — activities, streams, etc. — IS tracked in git, so it already existed at worktree checkout; only `data/stats`/`data/dashboard`/`data/tokens.json`/`data/private/*.json` are gitignored). Corrected by removing `data/data` and copying only the two missing subdirectories directly into `data/`. Confirmed `git status --short` clean (both are gitignored) before any commit.

## Full Verification Gate

- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0
- `npm run build-widgets` — exit 0 (also regenerates `dist/widgets/data/stats/best-efforts.json`, resolving an initially-observed environmental ENOENT in `scripts/verify-dashboard-publish-stats.test.mjs` unrelated to this plan's files)
- `npx vitest run src/dashboard/views/detail-sections.test.ts -t "splitGapAnnotations"` — **17 passed**, 0 failed
- `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverageCaptionText"` — **9 passed**, 0 failed
- `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gapProfileRow"` — **2 passed**, 0 failed
- `npx vitest run src/dashboard/views/detail-sections.test.ts` (whole file) — **146 passed**, 0 failed
- `npm test` (full suite, post `build-widgets`) — **91 files, 2866 tests, all passed, 0 failed, 0 skipped**

No environmental ENOENT failures remained once `data/stats`/`data/dashboard` were correctly populated and `dist/widgets` was built — this worktree's `npm test` is fully green, stronger evidence than the environment notes anticipated (they warned of possible fixture-driven ENOENT failures, including up to 3 in this exact file; none occurred here).

## Issues for Orchestrator

None. No sibling-owned files (`pace-quality.*`, `pace-quality-client.*`, `list.*`, `detail-charts-logic.test.ts`, `detail-zones.test.ts`) were touched or found broken by this plan's changes.

## Next Phase Readiness

- `detail-sections.ts` now fully discloses the three-way `GapKind` split's classification everywhere it renders it — the split marker, the coverage caption, and the gap-profile row all name unreliable segments explicitly.
- Depends on plan 33-05's `VALID_GAP_KINDS` widening in `pace-quality-client.ts` for the gap-profile evidence line's unreliable count to be non-zero in the actual browser (the logic here is correct now regardless; only the parsed data feeding it is starved until 33-05 lands) — documented in-source with a dated comment.
- Requirement ticks (PACE-09, COV-03) are deliberately NOT set by this plan, per its own requirement-tick-safety text — plan 33-13 alone sets their disposition against rendered checkpoint evidence.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/detail-sections.ts`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-04-SUMMARY.md`
- FOUND commit: `32a58494`
- FOUND commit: `16d8a7f8`
- FOUND commit: `e2e3ba3f`
