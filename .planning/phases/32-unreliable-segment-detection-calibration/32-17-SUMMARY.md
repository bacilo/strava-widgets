---
phase: 32-unreliable-segment-detection-calibration
plan: 17
subsystem: analytics
tags: [typescript, vitest, tdd, gap-boundary, gap-closure, conservation]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments/mapGapToIndices's FIRST-at-start/LAST-at-end gap-boundary convention (32-13), the D-06/D-07 gap boundary convention regression block it lives in, buildActivityFinding's CR-03-fixed stream-read guard (32-15), and 32-REVIEW.md round-2's CR-01/WR-01 findings this plan closes"
provides:
  - "detectUnreliableSegments fails closed (a fresh []) when two caller-supplied gap spans map to OVERLAPPING index ranges via a shared duplicate-timestamp boundary, instead of emitting two segments that jointly double-count the shared interval's real distance -- proven on the compiled dist/ module against the reviewer's exact reproduction"
  - "A permanent two-gap overlap regression fixture in the D-06/D-07 gap boundary convention block, watched failing against the pre-fix detector before the guard existed"
  - "A cross-segment conservation assertion (no segment's startIndex precedes the previous segment's endIndex; combined metres never exceed the stream's own independently-derived d[last]-d[first]) added alongside, not instead of, the pre-existing within-segment check -- proven able to fail by temporarily reverting the new guard"
  - "buildActivityFinding's activityDoc.start_date dereference guarded the same way CR-03 guarded the sibling stream read, closing WR-01"
affects: [33-pace-derivation-integration, 35-best-effort-integration, 36-gap-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a boundary-widening fix proven correct for ONE instance of an input shape (a single gap span) must additionally be checked against TWO adjacent instances that could interact at their shared boundary -- the interaction, not either instance alone, is where a combinatorial defect like CR-01 lives"
    - "a conservation guard that checks each unit's own arithmetic (metres === burstMetres + gapMetres) cannot catch two units that are each internally self-consistent but jointly wrong; the guard must be asserted ACROSS units against an independently-derived total, never only within one"

key-files:
  created: []
  modified:
    - src/analytics/unreliable-segments.ts
    - src/analytics/unreliable-segments.test.ts
    - scripts/validate-unreliable-segments-1hz.mjs
    - .planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md
    - .planning/ROADMAP.md

key-decisions:
  - "Chose fail-closed (return a fresh []) over merging overlapping gap blocks: merging still requires deciding which duplicate-timestamp sample 'owns' the shared interval's own metres/seconds -- the same ambiguity that produces divergent answers in the first place. A fresh [] can never emit a conservation-violating result, matching the reviewer's own suggested shape and this module's existing fail-closed discipline for a malformed gap span."
  - "Placed the overlap check ACROSS the mapped gapBlocks array specifically (before it is merged with burstBlocks for chaining), not across the combined blocks list -- this is exactly where the reviewer traced the defect (mapGapToIndices's per-span widening interacting across two spans), and keeps burst-vs-gap adjacency semantics (D-06/D-07) completely untouched."
  - "Did not reopen REQUIREMENTS.md: the genesis commit that created this plan (03d57f53) reopened only 32-VALIDATION.md and ROADMAP.md, leaving SEG-01/SEG-02/SEG-04 ticked throughout -- this plan's own scope note in 32-VALIDATION.md's frontmatter (reopened_reason) confirms CR-01/WR-01 as the sole trigger, so REQUIREMENTS.md's already-complete entries are left as-is rather than reopened and re-closed for a defect that was never live on the committed archive."
  - "Ticked 32-17-PLAN.md's own ROADMAP line and the Phase 32 progress-table row (17/17) after writing this SUMMARY, following 32-16's own precedent -- the Phase 32 checkbox itself and its status ('In Progress') are left untouched, since that decision belongs to /gsd-verify-work, not this plan."

requirements-completed: []

# Metrics
duration: ~16min
completed: 2026-09-20
---

# Phase 32 Plan 17: Close Round-2 CR-01 (Overlapping Gap Blocks) and WR-01 (start_date Guard) Summary

**`detectUnreliableSegments` now fails closed on two adjacent gap spans whose shared duplicate-timestamp boundary maps to overlapping index ranges -- closing the one Critical the gap-closure round introduced into itself -- with a new cross-segment conservation assertion proven able to catch exactly that failure mode, and `buildActivityFinding`'s last unguarded `activityDoc.start_date` dereference now fails closed too.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-20T22:47:07+02:00 (genesis commit `03d57f53`, primary checkout)
- **Completed:** 2026-09-20T23:00:38+02:00
- **Tasks:** 4 completed, 4 committed
- **Files modified:** 5 (3 source/test, 2 bookkeeping)

## Accomplishments

- Pinned the reviewer's exact two-gap overlap reproduction (`t=[0,1,5,5,10,11]`,
  `d=[0,20,25,45,50,140]`, two adjacent gaps sharing the duplicated `t=5` boundary) as a
  permanent regression fixture in the D-06/D-07 gap boundary convention block, watched failing
  against the pre-fix detector first
- Made `detectUnreliableSegments` sort mapped gap blocks by `startIndex` and fail closed (a fresh
  `[]`) on any overlap, closing CR-01; verified on the compiled `dist/analytics/unreliable-segments.js`
  module against the reviewer's exact input
- Added a cross-segment conservation assertion (no segment's `startIndex` precedes the previous
  segment's `endIndex`; combined `metres` never exceed the stream's own independently-derived
  `d[last]-d[first]`) alongside the pre-existing within-segment check, and proved it can fail by
  temporarily reverting the Task 1 guard and observing the sweep go red
- Guarded `buildActivityFinding`'s `activityDoc.start_date` dereference the same way CR-03 guarded
  the sibling stream read, closing WR-01; demonstrated both directions from the CLI and confirmed
  `3475724402` still produces its full 16-segment normal finding, unchanged
- Re-ran the full closing gate on the post-fix tree: build/tsc clean, 91 files/2,848 tests (+1 over
  32-16's baseline, exactly this plan's new fixture), calibration artifact byte-identical across
  two runs (sha256 unchanged), three shipped constants unchanged, recount PASS, and a fresh
  1,874-stream archive scan showing detector output unchanged (0 overlapping-segment activities,
  same shape as the orchestrator's pre-plan measurement)

## Task Commits

Each task was committed atomically (Task 1 as two commits, RED then GREEN, per the plan's own
explicit "watch it fail first" instruction):

1. **Task 1a: Pin the two-gap overlap regression fixture, watched RED** - `91b45743` (test)
2. **Task 1b: Fail closed on overlapping mapped gap blocks (CR-01)** - `24912982` (fix)
3. **Task 2: Assert conservation ACROSS segments, not only within one** - `e79a341e` (test)
4. **Task 3: Guard activityDoc.start_date in buildActivityFinding (WR-01)** - `81c4cbf6` (fix)
5. **Task 4: Re-run the closing gate, record 32-17 rows in 32-VALIDATION.md** - `cfbb91b8` (docs)

**Plan metadata:** committed alongside this SUMMARY in the final metadata commit (see below).

## Files Created/Modified

- `src/analytics/unreliable-segments.ts` - After mapping every gap span to an index block,
  `detectUnreliableSegments` now sorts the mapped `gapBlocks` by `startIndex` and returns a fresh
  `[]` if any two overlap (`sortedGapBlocks[k].startIndex < sortedGapBlocks[k-1].endIndex`) --
  before the blocks are ever merged with burst blocks for chaining. Docblock updated to state the
  new fail-closed case and cite round-2 CR-01.
- `src/analytics/unreliable-segments.test.ts` - Two additions to the existing D-06/D-07 gap
  boundary convention block: (1) the reviewer's exact two-gap overlap fixture, asserting
  `detectUnreliableSegments` returns `[]`; (2) the "conservation holds for every segment produced
  by the adjacency fixtures" sweep extended from 4 to 6 cases (adding the "not swallowed"
  two-separate-segments case and the overlap fixture itself) with a new cross-segment assertion
  per fixture, retained alongside the pre-existing within-segment check.
- `scripts/validate-unreliable-segments-1hz.mjs` - `buildActivityFinding`'s `activityDoc` is now
  checked (`null`/non-object/non-string `start_date`) before the `Date.parse` dereference,
  returning a skipped finding instead of throwing. Docblock updated to name WR-01 alongside CR-03.
- `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md` - Three new
  Per-Task rows (32-17-T1/T2, T3, T4) and a new "Re-Approval 2026-09-20 (plan 32-17, round-2
  CR-01/WR-01 closure)" section recording every RED/GREEN transcript and the full Task 4 gate
  output; frontmatter `status` returned to `complete` with `closed: 2026-09-20` added.
- `.planning/ROADMAP.md` - `32-17-PLAN.md` line ticked (`[x]`); Phase 32 progress-table row set to
  `17/17` (still `In Progress`, not `Complete`); the Phase 32 checkbox itself left untouched.

## Decisions Made

- Fail-closed (not merge) for overlapping gap blocks -- see key-decisions above for the full
  conservation-invariant argument. This is the reviewer's own suggested shape and the module's
  existing fail-closed discipline for a malformed gap span, applied one level up (across gap
  blocks rather than within one).
- Left REQUIREMENTS.md untouched: the plan's own genesis commit reopened only 32-VALIDATION.md and
  ROADMAP.md (SEG-01/SEG-02/SEG-04 stayed ticked throughout), and this plan's `requirements-completed`
  is therefore empty -- there is nothing new to mark complete; the existing "Closed 2026-09-20 by
  32-11/32-13" clauses already stand and CR-01/WR-01 were never a REQUIREMENTS.md-visible regression.

## Deviations from Plan

None -- plan executed exactly as written. Both tasks' "prove it can fail" instructions were
followed literally (temporarily disabling the Task 1 guard for Task 2's reachability proof, and
temporarily disabling the Task 3 guard for its own pre-fix throw demonstration), with `git diff`
confirmed clean before each restoration and before the corresponding commit.

## Issues Encountered

None. The reviewer's exact reproduction reproduced identically on the first attempt (both the
pre-fix double-count and the post-fix fail-closed result), and the archive scan confirmed the
hard constraint holds: the fix changed zero committed-stream outputs (0 of 1,874 streams carry a
duplicate timestamp exactly on an adjacent gap boundary, so the guard's `return []` path is
reachable but not exercised anywhere in the current archive).

## Reachability Evidence (both directions, per the executor's reachability bar)

### Task 1 -- CR-01 fail-closed

**Pre-fix (dist/, before any source change) -- reviewer's exact input:**
```
seg0 startIndex 0 endIndex 3 metres 45 seconds 5
seg1 startIndex 2 endIndex 5 metres 115 seconds 6   (overlaps seg0 at [2,3])
sum 160 m  vs  actual d[5]-d[0] = 140 m  ->  20 m double-counted
```
Test RED (permanent fixture, before the guard existed): `1 failed | 93 passed (94)` whole-file;
`1 failed | 6 passed (7 matched)` for `-t "boundary convention"`.

**Post-fix -- same input, same params, against the rebuilt `dist/analytics/unreliable-segments.js`:**
```
POST-FIX-RESULT []
CR-01-CLOSED-FAILS-CLOSED-OK
```
Whole-file `94 passed (94)`; `-t "round-2 CR-01"` `1 matched, 1 passed`; `-t "boundary convention"`
`7 matched, 7 passed` (up from 32-13's 6 -- coverage only grew, the original 6 fixtures are
untouched); `-t "mechanism"` unchanged at `12 matched, 12 passed`. `npx tsc --noEmit` exits 0.

### Task 2 -- cross-segment conservation

**RED (Task 1 guard temporarily disabled, restored immediately after -- `git diff` on the source
file confirmed clean before re-committing):**
```
AssertionError: expected 2 to be greater than or equal to 3
 ❯ src/analytics/unreliable-segments.test.ts:503:40
```
This is `segments[1].startIndex=2 < segments[0].endIndex=3` on the CR-01 fixture -- exactly the
overlap CR-01 describes, caught by the new cross-segment ordering check before the metres-total
check even runs.

**GREEN (guard restored):** whole-file `94 passed (94)`.

Fixture count in the "conservation holds for every segment produced by the adjacency fixtures"
sweep: 4 before this plan, 6 after (both additions are named in the file's own comment above the
`cases` array) -- coverage only grew, no existing case was removed or altered.

### Task 3 -- WR-01 `activityDoc.start_date` guard

**Pre-fix (guard temporarily reverted, restored immediately after -- `git diff` confirmed clean
before re-committing), CLI probe with `activityDoc = null`:**
```
THREW: Cannot read properties of null (reading 'start_date')
```

**Post-fix, same probe:**
```
RESULT {"id":"9999999901","skipped":"activity doc missing, not an object, or start_date not a string"}
```
A second probe with a real (copied) activity doc whose `start_date` was overwritten to the number
`12345` (non-string) produced the identical graceful skip.

**`3475724402` unchanged (real `export_data/strava/` on this checkout):**
```
NEVER-THROWS-OK {"id":"3475724402","skipped":null,"fitSampleCount":3655,"segmentCount":16,"mechanisms":["gap-adjacent"]}
```
Matches 32-16's own recorded result for this activity exactly (16 segments, all `gap-adjacent`,
`fitSampleCount: 3655`).

### Task 4 -- closing gate on the post-CR-01/WR-01 tree

```
$ npm run build && npx tsc --noEmit
(both exit 0)

$ npm test
 Test Files  91 passed (91)
      Tests  2848 passed (2848)          // +1 over 32-16's 91/2,847 -- this plan's new fixture

$ node scripts/compute-unreliable-segment-calibration.mjs   (run twice)
sha256 f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e   // unchanged, both runs
git diff --exit-code 32-CALIBRATION.md   (exit 0, clean, both times)

$ grep -E "UNRELIABLE_SPEED_LIMIT_MPS = 7.35|UNRELIABLE_EXCESS_FLOOR_M = 3;|HIDDEN_PAUSE_MIN_METRES = 116.95" src/analytics/unreliable-segments.ts | wc -l
3

$ node scripts/compute-unreliable-segment-recount.mjs
PASS: recount agrees with the calibration artifact's detector table.

$ npm run compute-stream-checksums
added 0

$ git status --porcelain data/streams
(empty)
```

**Archive scan re-run (1,874 committed streams, live `classifyGaps` -> `detectUnreliableSegments`
path):**
```json
{
  "scanned": 1874,
  "withAdjacentSharedBoundary": 383,
  "atDuplicateTimestamp": 0,
  "overlappingSegmentActivities": 0,
  "totalSegments": 1344
}
```
Identical shape to the orchestrator's pre-plan measurement (383/0/0) -- the fix cannot change
output for any committed stream because none of them hits the duplicate-timestamp-on-adjacent-
gap-boundary combination the guard checks for; the byte-identical calibration artifact and PASS
recount independently corroborate this.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- CR-01 (round-2's one Critical, introduced by 32-13's own gap-boundary fix) and WR-01 (the
  residual "never throws" warning) are both closed, each with a watched-failing pre-fix
  observation and a passing post-fix observation.
- `32-VALIDATION.md` is `status: complete` again (`closed: 2026-09-20`, `reopened: 2026-09-20`
  retained as history); `ROADMAP.md`'s Phase 32 progress row reads `17/17` while its checkbox
  stays unticked and its status stays `In Progress`.
- **The phase is NOT complete.** Only `/gsd-verify-work 32` may tick the Phase 32 ROADMAP checkbox
  and flip STATE.md's status to `complete` -- that re-verification has not yet run against this
  tree. `32-REVIEW.md`'s round-2 report (`status: issues_found`, 1 critical/1 warning/1 info) is
  now stale against this plan's fix; a fresh code-review pass (or the verifier's own
  re-reproduction) is the natural next step before the phase gate can close.
- No blockers. `git status --porcelain` is clean after every task commit; the pre-existing
  unstaged `32-REVIEW.md` frontmatter/body edit (present in the working tree before this plan
  started, per the orchestrator's git-status snapshot) was deliberately left untouched -- it is
  outside this plan's declared file scope (`unreliable-segments.ts`, `.test.ts`,
  `validate-unreliable-segments-1hz.mjs`, `32-VALIDATION.md`) and neither reviewing nor archiving
  that file is this plan's job.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `src/analytics/unreliable-segments.ts`
- FOUND: `src/analytics/unreliable-segments.test.ts`
- FOUND: `scripts/validate-unreliable-segments-1hz.mjs`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-17-SUMMARY.md`
- FOUND: commit `91b45743` (test: pin two-gap overlap regression fixture, watched RED)
- FOUND: commit `24912982` (fix: fail closed on overlapping mapped gap blocks, CR-01)
- FOUND: commit `e79a341e` (test: assert conservation ACROSS segments, CR-01)
- FOUND: commit `81c4cbf6` (fix: guard activityDoc.start_date, WR-01)
- FOUND: commit `cfbb91b8` (docs: re-run closing gate, record 32-17 rows)
