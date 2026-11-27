---
phase: 32-unreliable-segment-detection-calibration
plan: 16
subsystem: process
tags: [gsd-bookkeeping, gap-closure-reclose, verification-reopen]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration (32-10..32-15)
    provides: "the reopened 32-VALIDATION.md/ROADMAP.md/REQUIREMENTS.md/STATE.md (32-10) and the three gap-closures (32-11 GAP 1, 32-12 GAP 2, 32-13 GAP 3) plus the three warning-closures (32-14 CR-04/CR-06/WR-07, 32-15 SEG-05a quoting/D-05-D-09/CR-03)"
provides:
  - "32-VALIDATION.md re-closed (status: complete, closed: 2026-09-20) with a fresh Re-Approval section recording every gate output and matched -t count against the post-gap-closure tree"
  - "REQUIREMENTS.md SEG-01/SEG-02/SEG-04 re-ticked complete with dated closure clauses naming the closing plan(s); Traceability cells set to Complete"
  - "STATE.md hand-edited to status: verifying (16/16 plans executed, phase awaiting /gsd-verify-work re-run — NOT declared complete by this plan)"
  - "ROADMAP.md 32-16-PLAN.md line ticked (its own SUMMARY now exists); Phase 32 progress-table row 16/16 In Progress; Phase 32 checkbox deliberately left unticked"
  - "32-15's CR-03 environment limitation (no export_data/ in its bare worktree) closed on this primary checkout: buildActivityFinding('3475724402', ...) now demonstrated returning a full 16-segment normal finding shape against the real FIT original"
affects: [phase-32-verification-rerun, 33-pace-derivation-integration, 35-best-effort-integration, 36-gap-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-closing a gaps_found verification: re-reproduce every scored gap directly against the compiled/shipped artifact in the closing plan itself, never trust a sibling plan's SUMMARY narration as the evidence of record"
    - "When a plan's own acceptance-criterion literal (a grep target) cannot match reality for a structural reason (legend caption sharing a substring, prose vs. a literal field name), document the discrepancy and verify the substantive claim by an equivalent check, rather than editing the plan file"

key-files:
  created: []
  modified:
    - .planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "32-16-PLAN.md's Task 2 verify command scopes its ROADMAP tick-count grep to `32-1[0-5]-PLAN.md` (deliberately excluding 32-16 itself, since Task 2 runs before this plan's own SUMMARY exists). Ticked 32-16's own ROADMAP line separately, after writing this SUMMARY, since by then its SUMMARY is no longer absent — satisfying the plan's own must_haves truth ('no gap-closure plan is ticked in the ROADMAP whose SUMMARY is absent') rather than leaving a completed plan's own line permanently unticked."
  - "Closed 32-15's documented CR-03 environment limitation in this plan rather than carrying it forward again: this primary checkout has a real, populated `export_data/strava/` (32-15's bare worktree did not), so `buildActivityFinding` was re-run directly against activity 3475724402's genuine `.fit.gz` original, producing the full 16-segment 'normal finding shape' 32-15 could only approximate with a dummy file."
  - "Documented, rather than silently satisfied, a plan-verify-literal mismatch discovered in 32-16-PLAN.md's own acceptance criteria: `grep -c \"⬜ pending\" 32-VALIDATION.md` cannot print 0 because the Per-Task table's own status legend caption shares that exact combination — confirmed identical (count 1) at the phase's original, fully-closed 2026-09-20 pre-reopen state (`60e3ef6a`). The substantive criterion (no per-task row's own Status cell reading pending) holds; the literal grep count does not, for a reason unrelated to this plan's work — same pattern as 32-14's `valleyFound: false` and 32-15's `.test.mjs` baseline findings."
  - "Did not call `phase.complete` or `roadmap.update-plan-progress`/`state.planned-phase` for any of the four bookkeeping artifacts — all four were hand-edited per the plan's explicit standing-hazard warning. The Phase 32 ROADMAP checkbox stays unticked and STATE.md stays `status: verifying`, not `complete`; that decision belongs to `/gsd-verify-work`, not this plan."

patterns-established: []

requirements-completed: [SEG-01, SEG-02, SEG-03, SEG-04, SEG-05a]

# Metrics
duration: ~50min
completed: 2026-09-20
---

# Phase 32 Plan 16: Re-Close the Gap-Closure Bookkeeping Against the Post-Merge Gate Summary

**Re-ran the phase's full closing gate on the merged post-gap-closure tree (build/tsc clean, 91 files/2,847 tests, recount PASS, calibration artifact byte-identical), re-reproduced all three verifier-scored gaps directly against the compiled `dist/analytics/unreliable-segments.js` module rather than trusting any sibling SUMMARY's narration, and re-closed 32-VALIDATION.md/REQUIREMENTS.md/STATE.md/ROADMAP.md by hand — leaving the Phase 32 checkbox itself unticked for `/gsd-verify-work` to decide.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-20T22:10:00Z (session continuation, primary checkout at `080ea7da`)
- **Completed:** 2026-09-20T22:60:00Z (approx.)
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Re-ran the full closing gate on the merged tree: `npm run build` and `npx tsc --noEmit` both exit
  0; `npm test` is 91/91 files, 2,847/2,847 tests (up from the pre-gap-closure 90/2,788 baseline —
  every one of the +59 test / +1 file deltas attributed by name to 32-11 through 32-15);
  `node scripts/compute-unreliable-segment-recount.mjs` exits 0 PASS; `32-CALIBRATION.md`
  regenerates byte-identically (sha256 `f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e`,
  unchanged); `npm run compute-stream-checksums` printed `added 0`; `git status --porcelain
  data/streams` is empty.
- Re-reproduced all three verifier-scored gaps directly against `dist/analytics/unreliable-segments.js`:
  GAP 1 (total-function contract) — all five verifier inputs returned a fresh, distinct `[]`
  without throwing; GAP 3 (gap-boundary convention) — both verifier fixtures now classify
  `gap-adjacent`, 21m/13s/1 gap; GAP 2 (import-time guard) — the guard's 5/5 pass was confirmed,
  and its watched-failing demonstration was re-run (pointing the recount guard's negative
  assertion at the named-import probe, observing a red failure with a recorded `readFileSync`
  call), then reverted cleanly.
- Recorded a non-zero matched `-t` count for every gap-closure row named in the plan: `shape-level`
  31, `boundary convention` 6, `findValley` 7, `SEG-05a` 9 (≥7 baseline), `negative control` 6
  (≥3 required), `3475724402` 4, `mechanism` 12, `decimation` 3.
- Closed 32-15's documented CR-03 environment limitation: its bare worktree had no `export_data/`
  and could only prove the missing/malformed-stream directions with a dummy `.fit.gz`. This
  primary checkout has a real, populated `export_data/strava/`; re-ran `buildActivityFinding`
  directly against activity `3475724402`'s genuine FIT original (`activities/3711971403.fit.gz`)
  and confirmed the full "normal finding shape" (`skipped: null`, 3,655 FIT samples, 16 segments,
  all `gap-adjacent`, matching the recount table row-for-row) — the direction 32-15 could not reach.
- Re-closed 32-VALIDATION.md (`status: complete`, `closed: 2026-09-20`, `reopened: 2026-09-20`
  retained), re-ticked SEG-01/SEG-02/SEG-04 in REQUIREMENTS.md with dated closure clauses and
  Traceability cells set to Complete, hand-edited STATE.md to `status: verifying` /
  `completed_plans: 16` / `total_plans: 16`, and ticked 32-16's own ROADMAP line (its SUMMARY now
  exists) — all without touching the Phase 32 checkbox itself.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-run the closing gate and re-reproduce all three gaps against dist** - `42600312` (docs)
2. **Task 2: Re-tick the ROADMAP, REQUIREMENTS and STATE against the recorded evidence** - `5942e8b7` (docs)

**Plan metadata:** committed alongside this SUMMARY in the final metadata commit (see below).

## Files Created/Modified

- `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md` - `status: complete`,
  `closed: 2026-09-20` added (`reopened: 2026-09-20` retained); all seven gap-closure Per-Task rows
  flipped from `⬜ pending` to `✅ green` with recorded matched counts; a new `## Re-Approval
  2026-09-20 (plan 32-16, post-gap-closure)` section records the full gate output, the three
  dist-level gap re-reproductions, the GAP 2 watched-failing/revert transcript, every matched
  `-t` count, the unchanged shipped constants and `valleyFound`, all four carry-forward items from
  the six sibling plans (honestly reflected, not silently ticked), and the closed 32-15 CR-03
  environment limitation.
- `.planning/REQUIREMENTS.md` - SEG-01/SEG-02/SEG-04 re-ticked `- [x]`, each retaining its
  "Reopened 2026-09-20" clause plus a new "Closed 2026-09-20 by {plan}" clause naming the closing
  plan(s) and this plan's own re-reproduction; Traceability table rows for all three set to
  `Complete`. SEG-03/SEG-05a untouched (never unticked); SEG-05b untouched (stays Pending).
- `.planning/STATE.md` - Frontmatter `status: verifying`, `stopped_at`, `last_updated`,
  `completed_plans: 16` hand-edited; Current Position and Session Continuity sections rewritten to
  describe the gap-closure-complete-awaiting-re-verification state; a new Decisions entry records
  the full 32-11..32-16 gap-closure arc.
- `.planning/ROADMAP.md` - 32-16-PLAN.md's own line ticked (`[x]`); Phase 32 progress-table row set
  to `16/16` (still `In Progress`, not `Complete`); the Phase 32 checkbox at ~line 109 deliberately
  left `[ ]`. 32-10..32-15 were already ticked by a prior tracking commit (`080ea7da`), confirmed
  unchanged by this plan's Task 2.

## Decisions Made

- Ticked 32-16's own ROADMAP line as a separate edit after writing this SUMMARY, since Task 2's
  own verify grep is deliberately scoped to `32-1[0-5]-PLAN.md` (it runs before this plan's SUMMARY
  exists) but the plan's must_haves truth requires no gap-closure plan be ticked with an absent
  SUMMARY — by the time this SUMMARY exists, ticking 32-16 satisfies rather than violates that rule.
- Closed 32-15's CR-03 environment limitation using this checkout's real `export_data/strava/`
  rather than re-carrying it forward, since the state-of-the-tree notes confirmed it is available
  here and the plan's own instruction was to complete it if the environment allows.
- Documented rather than silently satisfied a plan-verify-literal mismatch: `grep -c "⬜ pending"
  32-VALIDATION.md` cannot print `0` because the Per-Task table's own status legend caption shares
  the exact combination being counted — confirmed identical (count `1`) at the phase's ORIGINAL,
  fully-closed 2026-09-20 pre-reopen state (commit `60e3ef6a`), before any row was ever pending.
  The substantive criterion (no per-task row's own Status cell reading pending) holds.
- Did not call `phase.complete`, `roadmap.update-plan-progress`, or `state.planned-phase` for any
  of the four bookkeeping artifacts — all edits were made by hand per the plan's explicit
  standing-hazard warning about these handlers clobbering `stopped_at`/`total_plans` and ticking
  the phase line prematurely.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues were discovered in shipped code. All
findings below are plan-verify-literal or environment-limitation observations, not code defects,
consistent with this plan's own scope (bookkeeping re-close only).

### Notable Findings (not code deviations)

**1. [Documented, not a defect] `grep -c "⬜ pending" 32-VALIDATION.md` cannot print 0**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria state this grep should print `0` once all rows are
  green. It cannot: the Per-Task table's own legend caption
  (`*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*`) spells out the pending marker+word
  combination as part of describing all four possible statuses, and has done so since Wave 0.
- **Resolution:** Confirmed the same grep against the file's ORIGINAL, fully-closed 2026-09-20
  pre-reopen state (`git show 60e3ef6a:...`) also returns `1` — this is a structural property of
  the legend caption, not something this plan (or 32-10's reopen) introduced. Verified the
  substantive claim instead: no per-task ROW's own Status cell reads `⬜ pending` (all seven
  gap-closure rows are `✅ green`). Documented in the new Re-Approval section rather than editing
  the plan or deleting the legend caption.
- **Files modified:** None (documentation-only observation).
- **Not a code change.**

**2. [Closed, not carried forward] 32-15's CR-03 "real activity, normal finding shape" environment
limitation**
- **Found during:** Task 1, while re-reproducing GAP evidence
- **Issue:** 32-15-SUMMARY.md documented that its bare worktree had no `export_data/`, so its CR-03
  demonstration used a dummy `.fit.gz` and could only prove the code path reaches segment detection
  before gracefully skipping at FIT decode — not a full normal finding.
- **Resolution:** This primary checkout has a real, populated `export_data/strava/` (per the
  orchestrator's state-of-the-tree note). Called `buildActivityFinding` directly against activity
  `3475724402` using its real FIT original and confirmed a full 16-segment finding
  (`skipped: null`, `fitSampleCount: 3655`, all segments `gap-adjacent`, matching the recount table).
- **Files modified:** None (read-only CLI probe against committed data and a local export; no
  source file touched).
- **Not a code change:** No script or test file was modified to perform this demonstration.

---

**Total deviations:** 0 auto-fixed. 2 non-code findings documented above (1 plan-verify-literal
mismatch, 1 environment-limitation closure).
**Impact on plan:** None of the plan's own scope (bookkeeping re-close) was affected; both findings
are documentation, not code, and neither required touching any executed 32-01..32-09 artifact.

## Issues Encountered

None beyond the two documented findings above.

## Reachability / Gate Evidence (quoted, per this plan's own bar)

**Closing gate (HEAD `080ea7da`, primary checkout):**
```
$ npm run build && npx tsc --noEmit
(both exit 0)

$ npm test
 Test Files  91 passed (91)
      Tests  2847 passed (2847)

$ node scripts/compute-unreliable-segment-recount.mjs
... 16 rows, all gap-adjacent, agree with 32-CALIBRATION.md's detector table ...
PASS: recount agrees with the calibration artifact's detector table.
(exit 0)

$ node scripts/compute-unreliable-segment-calibration.mjs && git diff --exit-code 32-CALIBRATION.md
(exit 0, clean — byte-identical, sha256 f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e)

$ npm run compute-stream-checksums
added 0

$ git status --porcelain data/streams
(empty)
```

**GAP 1 and GAP 3, re-reproduced against `dist/analytics/unreliable-segments.js`:**
```
GAP1-ALL-FIVE-EMPTY-NO-THROW-DISTINCT-OBJECTS-OK
GAP3-A-AND-B-GAP-ADJACENT-21M-13S-1GAP-OK
```

**GAP 2, guard passing then watched failing then reverted:**
```
$ npx vitest run scripts/unreliable-segment-import-guards.test.mjs
 Test Files  1 passed (1)
      Tests  5 passed (5)

[negative assertion re-pointed at the named-import probe]
$ npx vitest run scripts/unreliable-segment-import-guards.test.mjs -t "performs no disk read at import"
 FAIL  ... compute-unreliable-segment-recount.mjs performs no disk read at import > records zero fs calls
AssertionError: expected [ { fn: 'readFileSync', …(1) } ] to deeply equal []
- []
+ [ { "arg0": "file:///Users/pedf/workspace/strava-widgets/package.json", "fn": "readFileSync" } ]

[reverted — git diff on the file empty afterward]
$ npx vitest run scripts/unreliable-segment-import-guards.test.mjs
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**Matched `-t` counts (all non-zero):**

| Filter | Scope file | Matched | Passed |
|---|---|---|---|
| `shape-level` | `unreliable-segments.test.ts` | 31 | 31 |
| `boundary convention` | `unreliable-segments.test.ts` | 6 | 6 |
| `findValley` | `compute-unreliable-segment-calibration.test.mjs` | 7 | 7 |
| `SEG-05a` | `pace-single-source.test.ts` | 9 | 9 |
| `negative control` | `unreliable-segments.test.ts` | 6 | 6 |
| `3475724402` | `unreliable-segments.test.ts` | 4 | 4 |
| `mechanism` | `unreliable-segments.test.ts` | 12 | 12 |
| `decimation` | `unreliable-segments.test.ts` | 3 | 3 |

**Shipped constants and valleyFound, unchanged:**
```
$ grep -E "UNRELIABLE_SPEED_LIMIT_MPS = 7.35|UNRELIABLE_EXCESS_FLOOR_M = 3;|HIDDEN_PAUSE_MIN_METRES = 116.95" src/analytics/unreliable-segments.ts | wc -l
3
$ grep -c "NO clean valley found" 32-CALIBRATION.md
1
```

**CR-03 full demonstration (closed in this plan, real `export_data/strava/`):**
```
NEVER-THROWS-OK {"id":"3475724402","skipped":null,"csvFile":"activities/3711971403.fit.gz",
"fitSampleCount":3655,"fitDistanceSampleCount":3655,"residualMedian":0.03,
"segments":[16 entries, all "mechanism":"gap-adjacent"]}
```

**Additive-contract check:**
```
$ git diff --name-only -- '.planning/phases/32-unreliable-segment-detection-calibration/32-0*'
(empty)
EXECUTED-PLANS-UNTOUCHED
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 16 Phase 32 plans (9 original + 7 gap-closure) are executed, and the three verifier-scored
  blockers from `32-VERIFICATION.md`'s `gaps_found` result are re-reproduced closed directly
  against the compiled `dist/` module and the committed test suite in this plan — not trusted from
  any sibling SUMMARY's narration.
- `32-VALIDATION.md` is `status: complete`; `REQUIREMENTS.md`'s SEG-01/SEG-02/SEG-04 are re-ticked;
  `STATE.md` is `status: verifying` with `completed_plans: 16`/`total_plans: 16`; `ROADMAP.md`'s
  Phase 32 progress row reads `16/16` while its checkbox stays unticked.
- **The phase is NOT complete.** Per this plan's explicit scope boundary and the standing hazard
  it names, only `/gsd-verify-work 32` may tick the Phase 32 ROADMAP checkbox and flip STATE.md to
  `complete` — that re-verification has not yet run against this tree.
- No blockers. `git status --porcelain` is clean after both task commits; no executed
  32-01..32-09 plan or SUMMARY was touched by this plan or any of its five siblings.

## Self-Check: PASSED

- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md`
- FOUND: `.planning/ROADMAP.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/STATE.md`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-16-SUMMARY.md`
- FOUND commit: `42600312`
- FOUND commit: `5942e8b7`

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*
