---
phase: 34-pause-classification-forgotten-stop
plan: 06
subsystem: analytics
tags: [calibration, pause-classification, forgotten-stop, d-20, d-21, ship-from-artifact, bugfix, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "scripts/compute-pause-classification-calibration.mjs (Family G evidence-only/D-20, Family W evidence-only/D-21, d21-basis gate, per-family strawman exit) from plan 34-14"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-WALKING-BREAK-CONTROL.md's three CONFIRMED_CONTROL lines from plan 34-02; 34-WALKING-BREAK-EVIDENCE.md's Candidates table from plan 34-02"
provides:
  - ".planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md: the FOURTH real-archive run — all three families cleared/evidenced, every gate PASSES for the first time this phase, Family M selects M1 (40s), three constants shipped"
  - "src/analytics/pause-classification.ts: STATIONARY_MAX_SPEED_MPS (0.5, developer-declared D-20), WALK_RUN_BOUNDARY_MPS (2.2, developer-declared D-21), FORGOTTEN_STOP_MIN_SEC (40, calibrated Family M shape M1), SHIPPED_PAUSE_BANDS, SHIPPED_STOP_PARAMS — all shipped FROM the committed artifact under a two-sided equality guard"
  - "src/analytics/pause-classification.ts: a findCreepStretches merge-boundary bug fix (pre-existing, plan 34-03) — every returned covered-creep stretch's own aggregate speed is now provably <= maxSpeedMps, closing a real archive-wide defect (40 of 300 stretches previously exceeded the 0.5 m/s bound)"
  - "src/analytics/pause-classification.test.ts: 'shipped from 34-CALIBRATION' (6 matched) and 'walking-break control' (5 matched) describe blocks"
affects: [34-07, 34-08, 34-09, 34-10, 34-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ship-from-artifact with a two-sided equality guard (33-14 precedent), applied to THREE constants in one module for the first time — two developer-declared (D-20, D-21) and one calibrated (Family M) — all bound to the same artifact's line-anchored 'NAME = value' text, character-for-character, never a runtime String(number)."
    - "A DEFINITIONAL regression-tripwire test, written as the plan specified, falsified an assumed 'cannot fail' invariant in pre-existing production code (findCreepStretches's merge). Treated as a Rule 1 bug (broken behaviour: a 'near-zero creep stretch' whose own reported speed exceeds the near-zero bound that defines it), not a test-scope adjustment — the test was kept as specified and the code was fixed to make its premise true."
    - "Bug-fix commit split from the constants-shipment commit using `git add -p` to isolate non-adjacent hunks in the same file — keeps each commit's diff legible and independently revertable, without touching the working tree's other in-progress edits."

key-files:
  created: []
  modified:
    - .planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md
    - src/analytics/pause-classification.ts
    - src/analytics/pause-classification.test.ts

key-decisions:
  - "The findCreepStretches merge-boundary bug (Rule 1) was fixed in-scope: it is pre-existing (plan 34-03), lives in the exact file/function this task ships production constants through, was discovered while writing this task's own required DEFINITIONAL test, and materially affects the STOP-02 feature this plan ships. Archive-wide impact measured before and after: 40 of 300 covered-creep stretches (36 of 1874 activities) exceeded the 0.5 m/s bound before the fix (worst 0.7196 m/s); 0 of 363 after. No gate verdict in 34-CALIBRATION.md changed — the only affected control's over-threshold stretches sit outside the D-12-gated window — only the archive-wide 'Covered-creep flagged' finding count changed (300 -> 363 stretches, same 82 activities... re-verified: still 82 activities)."
  - "The bug-fix commit and the constants-shipment commit were split via `git add -p` (non-adjacent hunks in the same file) so each commit represents one logical change, per the task_commit_protocol's atomic-commit intent."
  - "RED was proven by temporarily `git checkout --`-reverting the unstaged shipped-constants edit (restoring pause-classification.ts to the just-committed bug-fix-only HEAD), running both `-t` filters and `tsc --noEmit` to confirm failure, then restoring the edit from a scratch-directory copy and re-confirming GREEN — mirroring 34-13/34-14's own transient-real-file-edit RED-proof convention, never a git commit of the RED state itself."

patterns-established:
  - "Pattern: a plan-specified 'cannot fail' claim about existing code is itself a testable assertion — when the test built to prove it fails, that is evidence the code (not the test) is wrong, provided the failure is reproducible and material. Investigate before assuming the plan's premise is infallible."

requirements-completed: []  # this plan ticks nothing — PAUSE-01/STOP-02's disposition is plan 34-11's job, per this plan's own Requirement-tick safety note; requirements mark-complete and roadmap update-plan-progress were both skipped as instructed

# Metrics
duration: ~35min, single session, 2026-09-22
completed: 2026-09-22
---

# Phase 34 Plan 06 Fourth Re-run: Pause-Classification Calibration — All Gates PASS, Constants Shipped Summary

**Ran the real 1,874-stream archive through plan 34-14's D-21-amended generator for the fourth time: strawman G/M/W all watched FAIL first, all three families cleared or rendered as evidence (Family M selected M1 at 40s — the first time any constant has been SELECTED by arbitration on the real archive), every gate PASSED for the first time this phase (order, d12-anchor-i/ii/iii, d10-rule, join, d20-basis, d21-basis), and all three constants — STATIONARY_MAX_SPEED_MPS = 0.5 (developer-declared, D-20), WALK_RUN_BOUNDARY_MPS = 2.2 (developer-declared, D-21), FORGOTTEN_STOP_MIN_SEC = 40 (calibrated, Family M) — shipped from the committed artifact under a two-sided equality guard. A genuine pre-existing bug in `findCreepStretches`'s merge boundary (a "near-zero creep stretch" whose own reported speed could exceed the near-zero bound that defines it) was discovered while building the plan's own required DEFINITIONAL regression test, fixed (Rule 1), and re-verified archive-wide (0 of 363 stretches now exceed the bound, down from 40 of 300).**

## Performance

- **Duration:** ~35 min, single session, 2026-09-22 (commit span 23:28-23:42 local, plus pre-commit investigation)
- **Tasks:** 2 of 2 (clear branch — Task 1 exited 0; Task 2 ran in full)
- **Files modified:** 3 (34-CALIBRATION.md regenerated twice in place across the two Task commits; pause-classification.ts and pause-classification.test.ts modified)

## Accomplishments

- `npm run build` clean (tsc, exit 0) before and after every step.
- **Task 1 — fourth real-archive run, exit 0:** ran `npm run compute-pause-classification-calibration` against the real, unmodified 1,874-stream archive (`data/streams` git tree `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`, newest activity 2026-09-18) using plan 34-14's D-21-amended generator. Unpiped exit code: `0`. All three strawmen quoted FAIL before any shape row was read. Family G (evidence-only, D-20): G4/G5 both FAIL D-13 as expected (unchanged from HALT-2/HALT-3, never re-arbitrated). Family M cleared D-13 for the first time this run and selected **M1** (40s, first-clearing). Family W (evidence-only, D-21): W1/W2 both PASS D-13 (0.0000% both axes), rendered as valley evidence. Every gate PASSES: order (0.5 < 2.2 < 7.35), d12-anchor-i (walked), d12-anchor-ii (2.8257 m/s > 2.2, PASS — this is the SAME gate that failed HALT-3 at the old 6.95 m/s boundary), d12-anchor-iii (no creep intersects the first control's window), d10-rule, join (0 violations), d20-basis (0.029873 < 0.5), d21-basis (control-window max 1.797 < 2.2 < W1 modal bin centre 3.050). Regenerated three times, sha256 `e40aeaca...` identical across all three runs; committed (`530c10a8`); regenerated again, `git diff --exit-code` clean. Regenerated `32-CALIBRATION.md`, `33-CALIBRATION.md`, `33-COVERAGE-IDENTITY.md` — all clean; `git status --porcelain data/streams` empty throughout.
- **Bug fix (Rule 1, discovered mid-Task-2, committed `137c2556`):** building Task 2's plan-specified DEFINITIONAL regression tripwire ("every flagged stretch is at or below `SHIPPED_PAUSE_BANDS.stationaryMaxMps` — this cannot fail...") immediately falsified that "cannot fail" claim: a real merged covered-creep stretch on 6286234101 (t=5866-5922, 56s) measured 0.6357 m/s against the 0.5 m/s bound. Root cause: `findCreepStretches`'s merge step unioned overlapping qualifying sub-windows by taking the raw index-range union (`Math.max` of endpoints) without re-verifying the EXTENDED union's own aggregate speed — two overlapping individually-bounded windows can straddle a faster segment that only surfaces once joined. Archive-wide scan before the fix: 40 of 300 covered-creep stretches (36 of 1874 activities) exceeded 0.5 m/s, worst case 0.7196 m/s (activity 11697817469). Fixed by verifying the candidate union's own speed before extending; a window whose union would exceed the bound starts its own (independently-bounded) stretch instead. After the fix: 0 of 363 stretches exceed the bound (the fix splits formerly-merged over-threshold unions into more, smaller, all-valid stretches). Re-ran `pause-classification.test.ts` (45/45), `pace-single-source.test.ts` (91/91), `pace-derivation.test.ts` (46/46) — all green. Regenerated `34-CALIBRATION.md`: only the archive-wide "Covered-creep flagged" finding count changed (82 activities/300 stretches -> 82 activities/363 stretches); no Gates-table verdict changed (the affected stretches on the D-12-gated control sit outside its confirmed window). Regenerated three times, sha256 `7a19fdc7...` identical; upstream 32/33 artifacts and `data/streams` unaffected.
- **Task 2 — shipped the three constants from the artifact (commits `2486edbd` feat, `ee6baedc` test):** Added `STATIONARY_MAX_SPEED_MPS`, `WALK_RUN_BOUNDARY_MPS`, `FORGOTTEN_STOP_MIN_SEC`, `SHIPPED_PAUSE_BANDS`, `SHIPPED_STOP_PARAMS` to `pause-classification.ts`, each with a house-style docblock quoting its own provenance (winning shape id / declaration decision, raw value, D-13 deltas where calibrated, strawman verdict, rejected-on-argument list). `grep -cE "stationaryMaxMps: [0-9]"` returns `0` (D-07's one-constant rule holds). RED watched first (see below), then GREEN. New tests: "shipped from 34-CALIBRATION" (6 matched) parses the artifact's line-anchored `NAME = value` lines and the source file's own literal text, asserting numeric AND character-for-character equality for all three constants plus the imported `UNRELIABLE_SPEED_LIMIT_MPS` line, plus `SHIPPED_PAUSE_BANDS`/`SHIPPED_STOP_PARAMS` identity. "walking-break control" (5 matched) reads every `CONFIRMED_CONTROL` line from `34-WALKING-BREAK-CONTROL.md` (never pinned): the first control's both-directions reachability proof in one test; every control's own parsed window speed (from `34-WALKING-BREAK-EVIDENCE.md`'s Candidates table, never the 1.264/1.512/1.797 literals) bounding every intersecting flagged stretch strictly below it, with a CAN FAIL demonstration when `stationaryMaxMps` is raised to that same parsed speed; a DEFINITIONAL regression tripwire; a walked-classification check on each window's real metres/seconds. Seeded mutations M1 (production: `WALK_RUN_BOUNDARY_MPS` bumped to 2.3, guard RED, generator exits 2, reverted via `git checkout --`, clean) and M2 (artifact: hand-edited `STATIONARY_MAX_SPEED_MPS = 0.6`, guard RED, restored by the GENERATOR's own next run — not `git checkout` — clean) both watched, quoted below, reverted, confirmed clean. Full suite: `npm test` 97 files / 3371 tests, all green (up from 34-14's 3360 baseline + 11 new tests: 45 in `pause-classification.test.ts`, up from 34).

## RED Evidence (quoted verbatim)

**Bug fix DEFINITIONAL test, before the fix** (real archive, `-t "walking-break control"`):
```
FAIL src/analytics/pause-classification.test.ts > walking-break control > DEFINITIONAL...
AssertionError: expected 0.6357142857143246 to be less than or equal to 0.5
```

**Task 2 constants, before shipping** (production reverted to the just-committed bug-fix-only HEAD via `git checkout --`, both filters re-run):
- `tsc --noEmit`: 5 errors, `Module '"./pause-classification.js"' has no exported member 'FORGOTTEN_STOP_MIN_SEC'/'SHIPPED_PAUSE_BANDS'/'SHIPPED_STOP_PARAMS'/'STATIONARY_MAX_SPEED_MPS'/'WALK_RUN_BOUNDARY_MPS'`.
- `-t "shipped from 34-CALIBRATION"`: 5 of 6 failed (`expected undefined to deeply equal {...}` etc.), 1 passed.
- `-t "walking-break control"`: 4 of 5 failed (`TypeError: Cannot read properties of undefined (reading 'stationaryMaxMps')`), 1 passed.

Restored from a scratch-directory copy; both filters re-run GREEN (6/6, 5/5); `tsc --noEmit` clean.

**M1 mutation** (`WALK_RUN_BOUNDARY_MPS` bumped 2.2 -> 2.3):
```
FAIL ... 'WALK_RUN_BOUNDARY_MPS': the artifact line-anchored value equals the export numerically...
AssertionError: expected 2.2 to be 2.3 // Object.is equality
```
Generator (rebuilt, run): `Exit 2: shipped-mismatch.` Reverted via `git checkout -- src/analytics/pause-classification.ts`; rebuilt; regenerated; `git diff --exit-code` clean on both files; generator exit 0.

**M2 mutation** (artifact `STATIONARY_MAX_SPEED_MPS = 0.5` hand-edited to `0.6`):
```
FAIL ... 'STATIONARY_MAX_SPEED_MPS': the artifact line-anchored value equals the export numerically...
AssertionError: expected 0.6 to be 0.5 // Object.is equality
```
Restored by the GENERATOR's own next run (never `git checkout`); `git diff --exit-code` clean on the artifact; the line reads `STATIONARY_MAX_SPEED_MPS = 0.5` again.

## Task Commits

1. **Task 1: Fourth real-archive run — all gates PASS, Family M selects M1** - `530c10a8` (feat)
2. **Bug fix (Rule 1, mid-Task-2): findCreepStretches merge boundary** - `137c2556` (fix)
3. **Task 2 GREEN: ship the three constants from the artifact** - `2486edbd` (feat)
4. **Task 2 tests: shipped-from-34-CALIBRATION guard + walking-break control** - `ee6baedc` (test)

**Plan metadata:** (this commit, next) `docs(34-06): complete plan`

## Files Created/Modified

- `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` - regenerated twice in place (once per Task 1's real run, once after the bug fix changed the archive-wide creep-stretch count). Chosen constants, Gates (all PASS), Shape arbitration (G evidence/M selects M1/W evidence), Drift-while-stationary, Valley evidence, D-10 blind-spot rule, Join exhaustiveness, the 3475724402 per-interval table, archive-wide findings. Git history keeps HALT-1 at `00c02bda`, HALT-2 at `a740a65b`, HALT-3 at `bc77e8e0`.
- `src/analytics/pause-classification.ts` - `STATIONARY_MAX_SPEED_MPS`, `WALK_RUN_BOUNDARY_MPS`, `FORGOTTEN_STOP_MIN_SEC`, `SHIPPED_PAUSE_BANDS`, `SHIPPED_STOP_PARAMS` (new exports with house-style docblocks); `findCreepStretches`'s merge-boundary bug fix (docblock + implementation).
- `src/analytics/pause-classification.test.ts` - "shipped from 34-CALIBRATION" (6 matched) and "walking-break control" (5 matched) describe blocks.

## Decisions Made

See `key-decisions` in the frontmatter above: the in-scope Rule 1 bug fix and its measured archive-wide impact; the `git add -p` commit split; the RED-proof method (transient revert-and-restore, mirroring 34-13/34-14's own convention).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `findCreepStretches`'s merge boundary could report a covered-creep stretch whose own aggregate speed exceeded `maxSpeedMps`**
- **Found during:** Task 2, while writing the plan's own required DEFINITIONAL regression-tripwire test ("this cannot fail while findCreepStretches admits only such stretches by construction")
- **Issue:** The merge step unioned overlapping qualifying sub-windows via `last.endIdx = Math.max(last.endIdx, j)` — a raw index-range union — without re-checking that the EXTENDED union's own aggregate speed (`metres/seconds` over the new, larger span) still satisfied `maxSpeedMps`. Two individually-bounded overlapping windows can straddle a faster segment that only appears once they are joined into one longer reported interval. Archive-wide scan (real archive, shipped params 0.5 m/s / 40s): 40 of 300 covered-creep stretches (36 of 1874 activities) exceeded 0.5 m/s before the fix; worst 0.7196 m/s (activity 11697817469, 51s stretch).
- **Fix:** Before extending the current stretch to a newly-qualifying window, compute the candidate union's own aggregate speed and only extend if it too satisfies `maxSpeedMps`; otherwise the new window starts its own (independently bounded) stretch. Updated the function's docblock to state the resulting INVARIANT explicitly (every returned stretch's own `metres/seconds` is `<= maxSpeedMps`).
- **Files modified:** `src/analytics/pause-classification.ts`
- **Verification:** Archive-wide re-scan: 0 of 363 stretches exceed the bound. Full `pause-classification.test.ts` (45/45), `pace-single-source.test.ts` (91/91), `pace-derivation.test.ts` (46/46) green. `34-CALIBRATION.md` regenerated: no Gates-table verdict changed (the affected control's over-threshold stretches sit outside the D-12-gated window); only the archive-wide "Covered-creep flagged" stretch count changed (300 -> 363, same 82 activities). `npm test`: 97 files / 3371 tests, all green.
- **Committed in:** `137c2556` (fix)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary to make the plan's own required DEFINITIONAL test's premise true rather than adjusting the test's scope to hide a real defect. No scope creep — same file this task ships production constants through, discovered while implementing this task's own required behavior, verified not to change any gate verdict or shipped constant value.

## Gate-by-Gate Report (every gate id, measured value, bound, verdict)

| gate | measured | bound | verdict |
|---|---|---|---|
| order | 0.5 < 2.2 < 7.35 | 0 <= STATIONARY_MAX_SPEED_MPS < WALK_RUN_BOUNDARY_MPS < UNRELIABLE_SPEED_LIMIT_MPS | PASS |
| d12-anchor-i | walked | walked | PASS |
| d12-anchor-ii | 2.8257182738164475 | > 2.2 | PASS |
| d12-anchor-iii | no creep intersects window | no creep intersecting window | PASS |
| d10-rule | anchors pass, margin clear | anchors match; margin clear | PASS |
| join | 0 | 0 | PASS |
| d20-basis | 0.029873294347019862 | < STATIONARY_MAX_SPEED_MPS (0.5) | PASS |
| d21-basis | control-window max=1.797; W1 modal bin centre=3.050 | boundary > every confirmed control window aggregate speed AND boundary < W1 time-weighted modal bin centre | PASS |

## Shape-Row Report (every row: n, base, removedDelta, plantedDelta, plants, verdict; planted n == base n + plants confirmed)

| row | base n | base | removedDelta | planted (value) | planted n | plantedDelta | plants | verdict | base n + plants |
|---|---|---|---|---|---|---|---|---|---|
| strawman G | 5362 | 0.908333 | — (population emptied) | 0.941667 | 5416 | 3.6697% | 54 | FAIL | 5416 (5362+54, matches) |
| strawman M | 78895 | 4.000000 | — (population emptied) | 4.000000 | 79684 | 0.0000% | 789 | FAIL | 79684 (78895+789, matches) |
| strawman W | 794 | 4.450000 | — (population emptied) | 4.450000 | 848 | 0.0000% | 54 | FAIL | 848 (794+54, matches) |
| G4 (evidence only, D-20, never arbitrates) | 6 | 0.029873 | 89.7455% | 1.195556 | 7 | 3902.0881% | 1 | FAIL | 7 (6+1, matches) |
| G5 (evidence only, D-20, never arbitrates; per-activity `n` held fixed by established convention, internal count 6→7) | 6 | 0.029873 | 89.7455% | 0.496462 | 6 (rendered; 7 internally) | 1561.8912% | 1 | FAIL | 7 (6+1, matches per convention) |
| M1 (per-activity `n` held fixed by established convention) | 1873 | 40.000000 | 0.0000% | 40.000000 | 1873 | 0.0000% | 26276 | PASS — **SELECTED (first-clearing)** | 1873 (per convention) |
| M2 (same convention as M1) | 1873 | 30.000000 | 0.0000% | 30.000000 | 1873 | 0.0000% | 26276 | PASS | 1873 (per convention) |
| W1 (evidence only, D-21, never arbitrates) | 2612365 | 6.950000 | 0.0000% | 6.950000 | 2638590 | 0.0000% | 26225 | PASS | 2638590 (2612365+26225, matches) |
| W2 (evidence only, D-21, never arbitrates) | 2612365 | 6.850000 | 0.0000% | 6.850000 | 2638590 | 0.0000% | 26225 | PASS | 2638590 (2612365+26225, matches) |

Every non-vacuous row's `planted n = base n + plants` holds directly; G5/M1/M2's rendered `n` is held fixed under the established per-activity-aggregate convention (34-12/HALT-2 precedent), with the internal item count confirmed to grow by the plant count.

## Shipped Constants (confirmed shipped from the artifact, FORGOTTEN_STOP_MIN_SEC confirmed SELECTED by arbitration)

- `STATIONARY_MAX_SPEED_MPS = 0.5` — provenance: `developer-declared (D-20), not calibrated`. **NOT selected by arbitration; Family G is evidence-only per D-20 and never arbitrates for this constant.**
- `WALK_RUN_BOUNDARY_MPS = 2.2` — provenance: `developer-declared (D-21), not calibrated`. **NOT selected by arbitration; Family W is evidence-only per D-21 and never arbitrates for this constant.**
- `FORGOTTEN_STOP_MIN_SEC = 40` — provenance: `calibrated (M family, M1)`. **CONFIRMED SELECTED BY ARBITRATION** — Family M's strawman FAILED first, then shape **M1** (pause-rule scale, conservative, R-7 p90 of P_a across activities) cleared D-13 first-clearing (removedDelta 0.0000%, plantedDelta 0.0000%) and was selected over M2 (also cleared, ranks second in the pre-declared order). This is the first time this constant has ever been selected by arbitration on the real archive — never hardcoded.
- `UNRELIABLE_SPEED_LIMIT_MPS = 7.35` — imported from `32-CALIBRATION.md`, unchanged.

## Three-Control Check (D-21/H3 amendment)

For each of the three developer-confirmed walking-break controls, at the shipped params (`{ stationaryMaxMps: 0.5, minSec: 40 }`):

| control | window (t) | own window aggregate speed (parsed from 34-WALKING-BREAK-EVIDENCE.md) | flagged? | flagged stretch(es): seconds / speed | strictly below control's own window speed? |
|---|---|---|---|---|---|
| 6286234101 (first, D-12-gated) | t=5289-5696 | 1.264 m/s | NO | — | n/a (not flagged) |
| 3475733231 (second, informal) | t=1827-2229 | 1.512 m/s | NO | — | n/a (not flagged) |
| 3475715143 (third, informal, D-21's accepted flag) | t=1590-1992 | 1.797 m/s | YES | 42s / 0.5000 m/s | YES (0.5000 < 1.797) |

- No control is flagged FOR ITS WALKING PACE — the only flagged stretch (control 3) sits at exactly the declared 0.5 m/s stationary boundary, strictly below that control's own 1.797 m/s window speed, matching D-21's accepted-flag disclosure exactly (42s stretch, same seconds/speed as HALT-3's own additional check).
- The first control additionally passed the CAN FAIL / CAN PASS reachability proof in both directions in one test: computable and not flagged at the shipped params; flagged once `stationaryMaxMps` was raised to just above its own measured minimum 40s-sub-window speed inside the window.
- Raising `stationaryMaxMps` to each control's own parsed window speed (CAN FAIL direction) produced at least one intersecting flagged stretch for all three controls, confirming the discriminator is not vacuously unfalsifiable.
- D-12's own formal gate (anchor iii, first control only) independently confirms PASS (no creep intersects that window) in the Gates table above.

## 3475724402 Per-Interval Class Distribution at Shipped Constants (finding, never a pass/fail expectation)

All 18 of 3475724402's merged-segment/recording-gap intervals (2.307-4.065 m/s) classify **`ran-through`** at the shipped 2.2 m/s boundary; none classify `walked`. This is the disclosed, expected consequence D-21 named in advance ("at 2.2 m/s every one of 3475724402's merged intervals classifies ran-through rather than splitting") — reported here as the measured finding it is, not scored against D-02's original split expectation, per criterion 1's own text (per-segment agreement with the independent table, never a pinned class).

## Issues Encountered

None beyond the reported and fixed `findCreepStretches` bug above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan touches only the calibration generator's output artifact and the pause-classification module/tests; no UI, no dashboard data path, no hardcoded empty/placeholder values reaching any rendered surface.

## Next Phase Readiness

- **All three constants shipped for the first time this phase.** `STATIONARY_MAX_SPEED_MPS`, `WALK_RUN_BOUNDARY_MPS`, `FORGOTTEN_STOP_MIN_SEC`, `SHIPPED_PAUSE_BANDS`, `SHIPPED_STOP_PARAMS` are all exported from `src/analytics/pause-classification.ts`, bound to `34-CALIBRATION.md` by a two-sided equality guard.
- **Plans 34-07 through 34-11 are unblocked** — they can now consume the shipped constants directly rather than waiting on this plan's own real-archive run.
- `32-CALIBRATION.md`, `33-CALIBRATION.md`, `33-COVERAGE-IDENTITY.md` confirmed byte-identical to their pre-plan state throughout every regeneration; `data/streams/` untouched.
- The `findCreepStretches` bug fix is production-ready and covers every future caller (the generator's own D-12(iii) gate and archive findings; the future Phase 34-09 Pauses-section UI), not merely this plan's own tests.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md`
- FOUND: `src/analytics/pause-classification.ts`
- FOUND: `src/analytics/pause-classification.test.ts`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-06-SUMMARY.md` (this file)
- FOUND commits: `530c10a8`, `137c2556`, `2486edbd`, `ee6baedc`
