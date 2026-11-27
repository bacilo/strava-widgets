---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 04
subsystem: analytics
tags: [best-effort, clean-window-search, unreliable-segments, typescript, vitest]

# Dependency graph
requires:
  - phase: 36-02
    provides: "findBestEffort's zero-copy {startIndex, endIndex} bound and RawEffort.startIndex/.endIndex — the primitive this plan's per-sub-interval search reuses with no second sweep"
  - phase: 36-03
    provides: "EffortContamination, ComputedEffort.contaminated, the widened EffortDemotionGuard union and D-08's precedence prose — the record shape this plan populates for real"
provides:
  - "wholeSpanCuts/complementSubIntervals/segmentsIntersectingWindow — the partition primitives and index-space overlap predicate, with the +1 boundary correction against 36-RESEARCH.md's off-by-one snippet"
  - "segmentIntersectionReason/noCleanWindowReason/CONTAMINATION_REASON_SEGMENT_CAP — the bounded, house-register reason strings"
  - "contaminationRecord/unreliableSegmentDemotion — the two single-owner record constructors that actually construct a first 'unreliable-segment' guard value"
  - "ActivityEffortInput.segments (required) and the three-branch clean-window search wired live into computeActivityEfforts, fed by classifyGapsWithSegments in the per-activity loop"
affects: [36-05, 36-06, 36-07, 36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Partition-not-splice: cut the stream at the detector's own whole merged segment span, complement it into clean sub-intervals with the +1 boundary correction, search each bounded sub-interval with the SAME two-pointer sweep (findBestEffort + bounds), never a second sweep implementation"
    - "Structural contamination trigger (D-04): a window is contaminated iff its pair range overlaps a detected segment's pair range, index-based, no movement threshold, no new calibrated constant"
    - "Exactly one home per figure (D-05/D-06): a clean sub-interval exists -> top-level fields carry the clean figure, contaminated carries the raw one; no clean sub-interval exists -> top-level fields carry the raw figure, demotion carries the new guard; never both populated"
    - "D-08 short-circuit: when no clean window exists, isPlausible is never independently evaluated against the raw figure — exactly one rejected row per demoted effort, preserving the file's existing rejected[]/totals.effortsRejected identity"

key-files:
  created: []
  modified:
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - src/analytics/best-effort-fixtures.test.ts

key-decisions:
  - "D-01/D-04/D-05/D-06/D-07/D-08/D-14 (per 36-CONTEXT.md, implemented not re-litigated here): whole-merged-span partitioning, structural contamination trigger, the sibling-field/demotion split, the bounded reason strings, the clean-figure-only absolute-guard precedence, and Pass-1 placement before the PASS 1 marker — all implemented exactly as locked/delegated"
  - "UnreliableSegment is imported into compute-best-efforts.ts via pace-derivation.ts's own re-export, never directly from unreliable-segments.ts — pace-single-source.test.ts's SEG-05a audit confines a direct detector-module import to the detector itself, its one allowed importer (pace-derivation.ts) and *.test.ts files; a direct type-only import from the detector module still trips that audit"
  - "The pre-existing 'a world-record-guard rejection is retained and flagged' test's original 80 m/s two-sample-burst fixture became structurally impossible to exercise in isolation once this plan wires the real detector into computeBestEfforts: 400m's world-record ceiling (~9.296 m/s) unconditionally exceeds the detector's own UNRELIABLE_SPEED_LIMIT_MPS (7.35 m/s), so ANY window failing 400m's world-record guard is now also flagged as an unreliable segment, routing through Branch 2/3 instead. Redesigned the fixture around the half-marathon distance (world-record ~6.133 m/s, safely below the detector's 7.35 m/s threshold), preserving the test's original demonstrated properties unchanged (absolute-guard demotion retained-not-deleted; a different distance on the same activity survives untouched)"

patterns-established:
  - "Hoisted-and-lazy per-activity complement: complementSubIntervals is computed at most once per activity (not once per target distance), and only when segments.length > 0, so a segment-free activity (the common case) does zero extra work"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-09-28
---

# Phase 36 Plan 04: Clean-Window Search & Structural Contamination Summary

**`computeActivityEfforts` now partitions the stream at the detector's own whole merged segment span, searches each clean sub-interval with the existing bounded two-pointer sweep, and writes exactly one unambiguous record per branch — clean-and-contaminated, clean-and-untouched, or kept-and-demoted under the new `'unreliable-segment'` guard — while `best-effort-ceiling.ts` stays byte-identical and the "no iteration to convergence" audit passes with zero edits.**

## Performance

- **Duration:** ~35 min (commit-to-commit span 16:05–16:27, plus preceding reads/environment setup)
- **Started:** 2026-09-28T16:05:18+02:00 (Task 1 commit)
- **Completed:** 2026-09-28T16:27:24+02:00 (Task 3 commit)
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments

- `CleanSubInterval`, `wholeSpanCuts`, `complementSubIntervals` (with the `+1` boundary correction against `36-RESEARCH.md`'s off-by-one snippet, pinned by a hand-computed unit asserting the exact value `5` for cut `{4,7}`), and `segmentsIntersectingWindow` (index-based, touching-is-not-overlap) — all sitting textually before the `// PASS 1` marker, outside the audited `PASS 2..PASS 3` slice.
- `CONTAMINATION_REASON_SEGMENT_CAP`, `segmentIntersectionReason`, `noCleanWindowReason` — bounded, house-register (Phase 27 D-09) reason strings, every number read directly off `UnreliableSegment`/`RawEffort` and formatted with `toFixed(1)`.
- `contaminationRecord`/`unreliableSegmentDemotion` — the two single-owner constructors; outside comments, the literal `guard: 'unreliable-segment'` appears in exactly these two places in `compute-best-efforts.ts`.
- `ActivityEffortInput.segments` is now a **required** field, computed by the per-activity loop's one `classifyGapsWithSegments(stream.t, stream.d)` call (the detector's one permitted accessor — `detectUnreliableSegments` appears nowhere in this file).
- `computeActivityEfforts`'s per-target loop is now exactly three branches: no intersection (byte-identical to the pre-plan path apart from `contaminated: null`), a clean sub-interval found (ranks on the clean figure, `contaminated` populated with the raw figure), no clean sub-interval (kept-and-demoted under `'unreliable-segment'`, exactly one `rejected` row, `isPlausible` never independently evaluated — D-08's short-circuit).
- Ran the real, wired-in search across the full committed archive (`npm run compute-best-efforts`, 1899 activities) with zero thrown errors, confirming the implementation is total over real data, not just synthetic fixtures.
- 18 new unit tests pin the complement's boundary rule (7), all three search branches including D-08's short-circuit and Branch-2-crossed-with-an-absolute-guard (6), and the bounded reason strings (5).

## Task Commits

Each task was committed atomically:

1. **Task 1: The partition primitives, the overlap predicate, the reason builders and the two record constructors** - `ab1ef970` (feat)
2. **Task 2: Wire the detector into Pass 1 and run the clean-window search inside computeActivityEfforts** - `e4b8af5e` (feat)
3. **Task 3: Unit-pin the boundary rule, the three branches and the reason strings** - `99303b39` (test)

**Plan metadata:** this SUMMARY commit is the metadata commit; per the worktree-agent instructions, this agent does not update STATE.md/ROADMAP.md — the orchestrator does so centrally after merge.

## Files Created/Modified

- `src/analytics/compute-best-efforts.ts` — the partition/overlap/reason/record primitives (Task 1); `ActivityEffortInput.segments` (required), the `classifyGapsWithSegments` call site, and the three-branch clean-window search inside `computeActivityEfforts` (Task 2)
- `src/analytics/compute-best-efforts.test.ts` — `baseInput` gains `segments: []` (Task 2, required to keep the file compiling once `ActivityEffortInput.segments` became required); the pre-existing world-record-guard fixture redesigned around the half-marathon distance (Task 2, see Deviations); three new describe blocks pinning the boundary rule, the branches and the reason strings (Task 3)
- `src/analytics/best-effort-fixtures.test.ts` — `segments: []` on the wrapper's `ActivityEffortInput` (Task 2, the other compiler-named construction site)

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every task boundary.
- `npm test` — **101/101 files, 3716/3716 tests pass** (unfiltered, run twice to rule out flake; one isolated timeout in the unrelated `pace-fixtures.test.ts` on the first full run reproduced as a pass in isolation and on a clean re-run — a parallel-load timing flake, not a regression from this plan's diff).
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "complementSubIntervals boundary rule"` — **7 tests matched**.
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "clean-window search branches"` — **6 tests matched**.
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "contamination reason strings"` — **5 tests matched**. (7+6+5 = 18, meeting the plan's stated minimum of 18, none of the three filters matched 0.)
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` — **2/2 tests pass**, unedited (`git diff` on this file's own text shows zero changes inside that describe block).
- `git diff --stat fd25f373024d33715c0ca257c3636cf92fe44358 -- src/analytics/` touches exactly `compute-best-efforts.ts`, `compute-best-efforts.test.ts`, `best-effort-fixtures.test.ts` — the three files in `files_modified`.
- `git diff -- src/analytics/best-effort-ceiling.ts` is empty at every checkpoint — confirmed byte-identical.
- `git status --porcelain data/` is empty at final state (see Deviations for the local `compute-best-efforts` run that briefly dirtied a tracked file and was reverted before any commit).
- The `PASS 2`/`PASS 3` literal each occur exactly once in the final file (their own genuine markers) — verified by `grep -c`, after correcting a docblock draft that had accidentally introduced a second `PASS 2`/`PASS 3` occurrence (caught immediately by the audit test itself; see Deviations).

## Pinned BEFORE Figures (36-02) — Unchanged

`findBestEffort` and `best-effort-utils.ts`/`best-effort-utils.test.ts` were not touched by this plan at all (`git diff --stat` against those files is empty). The three scoping activities' 400m BEFORE pins (3:20/3:21/3:22/km, `best-effort-utils.test.ts`'s `findBestEffort — scoping activities` describe) test `findBestEffort` **directly**, one layer below this plan's orchestration change — re-run and confirmed green (3/3) with zero modification. No pinned BEFORE figure changed.

## Generated Artifacts — Now Stale, Deliberately Not Regenerated

The tracked `data/best-effort-ceiling.json` (Phase 28 D-06/D-07's committed ceiling state) is now **stale** relative to what a fresh `compute-best-efforts` run under this plan's code would produce — the real archive's clean-window search moves populations and p90s at every distance, matching the shape of `36-CONTEXT.md`'s own probe table. Regenerating and re-committing that file (and the `36-CEILING-RECALIBRATION.md` artifact of record, D-09) is explicitly **out of this plan's scope** — it belongs to the ceiling-recalibration/write-gate work (D-09/D-11), assigned to a later plan in this phase. This plan's own worktree-local `compute-best-efforts` run (for environment setup — see Deviations) rewrote the tracked ceiling file locally; it was reverted via `git checkout -- data/best-effort-ceiling.json` **before any commit**, so no stale/incorrect ceiling state was committed by this plan.

## Decisions Made

None beyond what `36-CONTEXT.md`/`36-RESEARCH.md`/`36-PATTERNS.md` already locked or delegated (D-01, D-04, D-05, D-06, D-07, D-08, D-14 implemented as specified; D-01's granularity, D-07's wording, D-08's precedence and D-14's placement were RESEARCH.md's own resolutions, carried through unchanged). The one new judgment call this plan made — importing `UnreliableSegment` via `pace-derivation.ts`'s re-export rather than directly from `unreliable-segments.ts` — is a mechanical consequence of an existing audit (`pace-single-source.test.ts`'s SEG-05a), not a new architectural decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's own automated verify script hardcodes an incorrect `PASS 2` literal count**
- **Found during:** Task 1 verification
- **Issue:** The plan's Task 1 `<verify>` script asserts `s.count('PASS 2')==2`, but the acceptance criteria's own prose states the correct bound is "appears exactly as many times as before this task." The baseline file (confirmed via `git show HEAD:src/analytics/compute-best-efforts.ts | grep -c 'PASS 2'`) contains exactly **1** occurrence, not 2 — the script's hardcoded constant does not match the base state and would fail regardless of implementation correctness.
- **Fix:** Ran a corrected assertion (`count == 1`, matching the verified baseline) instead of the plan's literal script. No source change was needed — the count was genuinely unchanged (1 before, 1 after).
- **Files modified:** none (verification-only)
- **Verification:** `grep -c 'PASS 2' src/analytics/compute-best-efforts.ts` → 1, both before and after Task 1.
- **Committed in:** n/a (caught before Task 1's commit; the commit itself is unaffected)

**2. [Rule 1 - Bug] Task 2's own automated verify script strips the literal text it then searches for**
- **Found during:** Task 2 verification
- **Issue:** The plan's Task 2 `<verify>` script runs `re.sub(r'//[^\n]*','',code)` (stripping every `//` line comment) and THEN calls `code.index('PASS 1')` — but the literal string `PASS 1` exists in the source ONLY inside a `//` comment (`// PASS 1 — ACCUMULATE...`). Stripping comments first removes the only occurrence of that text, so `code.index('PASS 1')` unconditionally raises `ValueError: substring not found`, regardless of implementation correctness.
- **Fix:** Ran a corrected version of the same checks: located `p1` in the UNSTRIPPED source (`s.index('// PASS 1')`), sliced `computeActivityEfforts`'s body from there, and verified every required identifier (`segmentsIntersectingWindow(`, `complementSubIntervals(`, `wholeSpanCuts(`, `findBestEffort(` count of 2, `contaminationRecord(`, `unreliableSegmentDemotion(`, `noCleanWindowReason(`) is present in that slice — same intent, corrected mechanics.
- **Files modified:** none (verification-only)
- **Verification:** Corrected script printed `ok (corrected script)`.
- **Committed in:** n/a (caught before Task 2's commit)

**3. [Rule 1 - Bug] Own docblock addition accidentally introduced a second `PASS 2`/`PASS 3` occurrence, breaking the "no iteration to convergence" audit**
- **Found during:** Task 2, running the "no iteration to convergence" suite (part of Task 2's own required verification)
- **Issue:** `computeActivityEfforts`'s extended docblock (D-14's placement argument) originally spelled out the literal marker text (`` `PASS 2`/`PASS 3` ``) to explain why the search's loops sit outside the audited slice. Since the audit locates its scanned slice via `source.indexOf('PASS 2')`/`indexOf('PASS 3')` (the FIRST occurrence), this new, earlier occurrence shifted the slice the audit computed, and the audit failed with a nonsensical "expected 'PASS 2`/`' to contain 'deriveCeilings('" error.
- **Fix:** Reworded the docblock to describe the two markers without spelling their literal text (referring to "this function sits above PASS ONE's marker" and "the two markers the... audit scans between," with an explicit comment noting why the literal text is deliberately not spelled out).
- **Files modified:** `src/analytics/compute-best-efforts.ts`
- **Verification:** `grep -n "PASS 2\|PASS 3\|PASS 1"` shows each marker occurring exactly once after the fix; `npx vitest run ... -t "no iteration to convergence"` — 2/2 pass.
- **Committed in:** `e4b8af5e` (Task 2 commit — fixed before committing, not a follow-up commit)

**4. [Rule 3 - Blocking] Direct `UnreliableSegment` import from `unreliable-segments.js` trips `pace-single-source.test.ts`'s SEG-05a audit**
- **Found during:** Task 2, `npm test`
- **Issue:** `import type { UnreliableSegment } from './unreliable-segments.js';` in `compute-best-efforts.ts` failed the SEG-05a single-source audit, which confines any `unreliable-segments.js`-naming import (including type-only imports) to the detector file itself, its one allowed importer (`pace-derivation.ts`), and `*.test.ts` files.
- **Fix:** Imported `UnreliableSegment` via `pace-derivation.ts`'s own re-export (`export type { UnreliableSegment, SegmentMechanism } from './unreliable-segments.js';`, already present at that file's line 46) instead of importing directly from the detector module.
- **Files modified:** `src/analytics/compute-best-efforts.ts`
- **Verification:** `npx vitest run src/analytics/pace-single-source.test.ts` — the SEG-05a describe passes; full `npm test` green.
- **Committed in:** `e4b8af5e` (Task 2 commit)

**5. [Rule 1 - Bug] Pre-existing "world-record-guard rejection is retained" test's fixture became structurally impossible to satisfy once the real detector is wired in**
- **Found during:** Task 2, `npm test`
- **Issue:** The pre-existing fixture (400m in 5s = 80 m/s) failed `doc.rejected.length` (expected 1, got 2) once `computeBestEfforts` started calling the real detector on every run. Root-caused with a direct probe of `classifyGapsWithSegments` on the fixture's own stream: the whole 3-sample stream merges into ONE `gap-adjacent` unreliable segment (the huge 295-second gap after the burst absorbs the "remainder"), so BOTH the 400m and 1k targets — not just 400m — end up in the no-clean-window branch. Further analysis proved this is not fixable by tweaking sample counts: 400m's world-record ceiling (~9.296 m/s) unconditionally exceeds the detector's own `UNRELIABLE_SPEED_LIMIT_MPS` (7.35 m/s), so it is mathematically impossible for ANY window to fail 400m's world-record guard without at least one of its constituent steps also exceeding the detector's fast-step threshold — this specific test's original premise (a 400m world-record failure, entirely untouched by the detector) can no longer occur once the detector is load-bearing, by design of this very plan.
- **Fix:** Redesigned the fixture around the half-marathon distance instead, whose world-record pace (~6.133 m/s) sits safely below the detector's 7.35 m/s threshold. A single constant-pace 2-sample stream at 6.2 m/s (`t=[0,3450]`, `d=[0,21390]`) exceeds half's own world record but stays under the detector's threshold (so `classifyGapsWithSegments` returns zero segments, exercising Branch 1 exactly as before this plan) and stays comfortably under every shorter distance's own (much higher) ceiling, so the 400m effort on the same activity, at the same pace, survives untouched — preserving the test's original demonstrated properties (an absolute-guard demotion retained-not-deleted; a different distance surviving on the same activity) with updated, hand-verified numbers.
- **Files modified:** `src/analytics/compute-best-efforts.test.ts`
- **Verification:** `npx vitest run src/analytics/compute-best-efforts.test.ts` — 49/49 pass; full `npm test` green.
- **Committed in:** `e4b8af5e` (Task 2 commit)

**6. [Rule 3 - Blocking] Worktree environment setup: build dist/, run compute-best-efforts, build-widgets to unblock the full `npm test` suite; accidentally dirtied a tracked file, reverted before any commit**
- **Found during:** Task 2, first `npm test` run
- **Issue:** This bare worktree had no `dist/` (16 test files import compiled output) and no `data/stats/best-efforts.json` (`scripts/verify-dashboard-publish-stats.test.mjs` needs `dist/widgets/data/stats/best-efforts.json`), matching the precedent already documented in plan 36-03's SUMMARY. Running `npm run compute-best-efforts` to generate the real stats file as a side effect rewrote the TRACKED `data/best-effort-ceiling.json` (the exact D-11 write-gate hazard `36-CONTEXT.md` names as a carried-forward, out-of-scope-for-this-plan issue).
- **Fix:** Ran `npm run build`, `npm run compute-best-efforts`, `npm run build-widgets` to satisfy the test suite's environment prerequisites, then reverted the accidentally-rewritten `data/best-effort-ceiling.json` via `git checkout -- data/best-effort-ceiling.json` **before staging or committing anything**.
- **Files modified:** none tracked (build artifacts under gitignored `dist/`/`data/stats/`; the one tracked file touched was reverted)
- **Verification:** `git status --porcelain data/` empty before every commit in this plan.
- **Committed in:** n/a (environment setup only, no commit)

---

**Total deviations:** 6 auto-fixed (3 Rule 1 — bugs in the plan's own verify scripts / a self-inflicted docblock collision / a pre-existing test's now-impossible premise; 2 Rule 3 — blocking issues requiring a mechanical import-path change and worktree environment setup; 1 of the Rule 1 entries additionally required a test-fixture redesign, listed once under its root cause).
**Impact on plan:** None of the six touch this plan's own design or scope. Three (#1, #2, #3) are verification-script/self-inflicted-docblock issues caught and corrected without any behavioral change. Two (#4, #6) are mechanical consequences of pre-existing audits/worktree bareness. One (#5) is a pre-existing test whose fixture became unsatisfiable by the intentional, designed consequence of this plan's own detector-wiring — fixed by redesigning the fixture to preserve the exact same demonstrated properties, not by weakening any assertion.

## Issues Encountered

None beyond the six deviations above, all resolved without any change to this plan's design.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeActivityEfforts` now receives the detector's segments as a required input, partitions at the whole merged span with the corrected `+1` boundary, searches each clean sub-interval with the one bounded sweep, and writes exactly one unambiguous record per branch — this is the exact live wiring plan 36-05 (ceiling-population/reachability tests against the real archive, the 4:59/4:50/5:08/km AFTER figures) and plan 36-06 (the whole-span-vs-burst-only archive-wide equivalence test, D-01) both need in place before they can run.
- `best-effort-ceiling.ts` is confirmed byte-identical (empty `git diff`); the ceiling module's own call graph was re-verified, not merely assumed, matching PR-08's "demonstrable rather than asserted in a comment" bound.
- The tracked `data/best-effort-ceiling.json` and the not-yet-created `36-CEILING-RECALIBRATION.md` are now genuinely stale relative to this plan's shipped code — flagged explicitly for whichever later plan owns D-09/D-11's recalibration artifact and write-gate.
- No blockers for 36-05/36-06/36-07.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/analytics/compute-best-efforts.ts
- FOUND: src/analytics/compute-best-efforts.test.ts
- FOUND: src/analytics/best-effort-fixtures.test.ts
- FOUND: commit ab1ef970
- FOUND: commit e4b8af5e
- FOUND: commit 99303b39

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
