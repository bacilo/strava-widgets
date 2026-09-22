---
phase: 34-pause-classification-forgotten-stop
plan: 07
subsystem: analytics
tags: [pause-classification, forgotten-stop, d-18, independent-recount, zero-import-guard, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-CALIBRATION.md's Chosen constants and Per-interval class table for 3475724402 from plan 34-06's fourth (clear) run"
  - phase: 32-unreliable-segment-detection-calibration
    provides: "compute-unreliable-segment-recount.mjs's zero-import recountGapFirst/localGapSpans/checkStream/parseCalibrationArtifact/RECOUNT_ACTIVITY_ID (D-15)"
provides:
  - "scripts/compute-pause-classification-recount.mjs: D-18's independent per-interval class recount for 3475724402 — zero-import of the classifier/detector/pace-derivation, gap-first traversal reused from the Phase 32 recount, an independently-written class ladder (localClassify), fail-closed artifact parsing (parseChosenConstants with a GATE FAILED fallback, parseClassTable), and a fail-closed evaluator (evaluatePauseRecount) scoped to recording-gap/merged-segment rows"
  - "The npm script compute-pause-classification-recount"
  - "The printed final recount table (quoted below) — plan 34-10's own expected values for the criterion-1 browser checkpoint row"
affects: [34-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second recount layered on TOP of an existing zero-import recount (compute-unreliable-segment-recount.mjs), never re-deriving the gap-first merge a third way — only the NEW behaviour (lone recording gaps, class arithmetic) is independently written"
    - "An independently-written speed ladder checks the SAME boundaries in a structurally different order/shape than the code it verifies (ascending inclusive checks + transported-as-residual, vs the classifier's own isTransported-first strict-> residual) — a deliberate second code path, not a copy"
    - "Phase-directory name built from two separately-literal string parts, joined at runtime, so a zero-import string-scan guard does not mistake its own artifact path for a forbidden import specifier (compute-walking-break-evidence.mjs's own established trick, reused verbatim)"
    - "A constants parser with a documented, tested fallback to a second PUBLISHED location for the same numbers in the artifact (the Gates table's own order row) when the primary location is absent under a specific artifact state (GATE FAILED) — never a re-derivation, and still fails closed when neither location exists (NO SHAPE CLEARS)"

key-files:
  created:
    - scripts/compute-pause-classification-recount.mjs
    - scripts/compute-pause-classification-recount.test.mjs
  modified:
    - package.json

key-decisions:
  - "D-18: the recount imports ONLY compute-unreliable-segment-recount.mjs's pure zero-import functions (itself zero-import of the detector) — never the classifier, pace-derivation, or the detector in any spelling, verified by a string-scan guard over the comment-stripped source, watched failing against an in-test planted import string first."
  - "Scope: only recording-gap and merged-segment table rows are compared; zero-advance-pause rows are counted into outOfScopeRows and reported, never verified, since this recount has no independent zero-advance-pause rule of its own (that rule lives entirely inside pace-derivation.ts, which this file is forbidden to import)."
  - "parseChosenConstants falls back to the Gates table's own 'order' row (A < B < C) when '## Chosen constants' is absent — discovered live during Task 2's required watched-failing exercise, documented as a Rule 3 blocking-issue fix (see Deviations)."

patterns-established:
  - "Pattern: when a deliberate breakage for a watched-failing exercise trips MORE than the one gate/output the plan anticipated (here: a classifier bug also breaking a post-selection anchor gate, collapsing the artifact's rendered shape entirely), fix the verifying SCRIPT to be resilient to the artifact's OTHER valid rendered shape rather than picking a different, less honest breakage to dodge the problem."

requirements-completed: []  # this plan ticks nothing (its own Requirement-tick safety note) — PAUSE-01's disposition is plan 34-11's job

# Metrics
duration: ~40min, single session, 2026-09-23
completed: 2026-09-23
---

# Phase 34 Plan 07: D-18 Independent Recount of 3475724402's Class Table Summary

**Zero-import recount script (`compute-pause-classification-recount.mjs`) that re-derives 3475724402's 18-row per-interval class table from raw `t`/`d` using its own independently-written speed ladder on top of the Phase 32 recount's zero-import gap-first merge — shown FAILING (18 named class-mismatch problems) against a deliberately walked/ran-through-swapped classifier before any passing run counted, then PASSING against the shipped classifier with `walked=1 ran-through=17`.**

## Performance

- **Duration:** ~40 min, single session, 2026-09-23
- **Tasks:** 2 of 2
- **Files modified:** 3 (2 created, 1 modified: `package.json`)

## Accomplishments

- **Task 1:** Built `scripts/compute-pause-classification-recount.mjs` and its test file. The script imports only `compute-unreliable-segment-recount.mjs`'s pure functions (`checkStream`, `localGapSpans`, `recountGapFirst`, `parseCalibrationArtifact`, `RECOUNT_ACTIVITY_ID`) — that script is itself zero-import of the detector (D-15) — and reuses its gap-first merge verbatim for `source: 'merged-segment'` rows, adding every `localGapSpans` span not contained inside a merged row as a lone `source: 'recording-gap'` row. Classification uses `localClassify`, an independently-written D-02 ladder (ascending inclusive checks, `transported` as the residual — the classifier's own `classifyPauseSpeed` checks `isTransported` FIRST via a strict `>` residual, a structurally different code path over the identical boundaries). `parseChosenConstants`/`parseClassTable` parse `34-CALIBRATION.md`'s `## Chosen constants` line-anchored text and its `## Per-interval class table` respectively, both failing closed. `evaluatePauseRecount` compares only recording-gap/merged-segment rows, counting `zero-advance-pause` rows into `outOfScopeRows` without verifying them, and is vacuous-safe on an empty table. All 4 required `-t` filters matched and passed: `"recount"` 14, `"evaluate"` 9, `"contract"` 11, `"zero-import guard"` 3 (36 tests total after Task 2's fix, see below). The comment-stripped source names none of `unreliable-segments`/`pace-derivation`/`pause-classification`; the guard is watched failing against an in-test-only planted import string mutation.
- **Task 2:** Baseline run (`npm run compute-pause-classification-recount`) against the shipped, unmodified classifier PASSED immediately (exit 0) — no stop-and-report needed. Deliberately swapped the `walked`/`ran-through` return labels in `classifyPauseSpeed`, rebuilt, and regenerated `34-CALIBRATION.md` — the generator exited 1 (`d12-anchor-i` FAIL, the walking-control anchor, an expected and irrelevant consequence of the same swap). The recount was then watched FAILING with 18 named class-mismatch problems, one per row (quoted in full below). Reverted the classifier via `git checkout --`, rebuilt, regenerated the artifact (exit 0), confirmed `git diff --exit-code` clean on both `pause-classification.ts` and `34-CALIBRATION.md`, and ran the final recount: exit 0, PASS, table quoted below (`walked=1 ran-through=17 stationary=0 transported=0 outOfScope(zero-advance-pause)=0`). `git status --porcelain data/streams` empty throughout.
- **Mid-Task-2 fix (Rule 3 — blocking issue):** the walked/ran-through swap regenerated the artifact into its `## GATE FAILED` shape (the generator's own all-or-none shipping contract, established by plans 34-13/34-14, pre-existing and out of this plan's scope to change), which prints NO `## Chosen constants` heading and no `NAME = value` lines anywhere — even though the per-interval class table this recount actually verifies still rendered in full. `parseChosenConstants` could not reach the evaluator at all under this state, only fail one step earlier with `"artifact missing ## Chosen constants"` (not the `"class problems"` the plan's own Task 2 verification step calls for). Fixed by adding a documented fallback: when `## Chosen constants` is absent, parse the three band numbers from the `## Gates` table's own `order` row (`| order | A < B < C | ... |`), which is published whenever any family cleared at all (GATE FAILED or a full pass) and is absent only under `## NO SHAPE CLEARS` (where `parseChosenConstants` still correctly throws). Two new tests cover both branches. See Deviations below.

## Task Commits

1. **Task 1: zero-import class recount + fail-closed evaluator + import guard** - `d75a8327` (feat)
2. **Mid-Task-2 fix: parseChosenConstants GATE FAILED fallback** - `ecbaa641` (fix)

**Plan metadata:** (this commit, next) `docs(34-07): complete plan`

_Task 2 itself made no commit to `src/` or to the artifact, per its own instruction — only the pre-existing fix above was committed, to the recount script and its tests._

## Files Created/Modified

- `scripts/compute-pause-classification-recount.mjs` (NEW) - the zero-import D-18 recount: `recountPauseIntervals`, `localClassify`, `parseChosenConstants` (with GATE FAILED fallback), `parseClassTable`, `evaluatePauseRecount`, `formatRecountTable`, guarded `main()`.
- `scripts/compute-pause-classification-recount.test.mjs` (NEW) - 36 tests: zero-import guard (3), `recountPauseIntervals` (5), `localClassify` (5), `evaluatePauseRecount` (9, including a uniform-swap non-vacuity test), `parseChosenConstants`/`parseClassTable` contract tests (12, including the two GATE FAILED/NO SHAPE CLEARS fallback tests), `formatRecountTable` (2).
- `package.json` - added the `compute-pause-classification-recount` npm script.

## Decisions Made

See `key-decisions` in the frontmatter: the zero-import scope (D-18), the recording-gap/merged-segment-only comparison scope with zero-advance-pause rows counted not verified, and the `parseChosenConstants` GATE FAILED fallback.

## Non-vacuity: how I know the recount is not trivially agreeing

The phase context flagged a real risk: 3475724402's 18 intervals classify almost uniformly (`ran-through`) at the shipped 2.2 m/s boundary, so a recount that merely returned a hardcoded constant class would "agree" by construction. Three independent pieces of evidence rule that out here:

1. **The recount computes real, non-uniform output from real arithmetic.** The final table is NOT uniform: 17 rows classify `ran-through` and exactly 1 (`recording-gap`, row 12, 1.929 m/s) classifies `walked` — computed by `localClassify` applying its own independently-written ladder to metres/seconds it derived itself from the raw stream, not copied from anywhere. A constant-returning stub could not have produced this split.
2. **The seeded-wrong-table RED demonstration actually discriminates.** Swapping `walked`/`ran-through` in the real classifier and regenerating the artifact produced a table where the SAME 18 rows now read 17×`walked` + 1×`ran-through` (see the quoted broken table below). The recount's own independently-computed classes did NOT change (it still computed 17×`ran-through` + 1×`walked`, from its own arithmetic against the unchanged bands) — so it disagreed with the broken table on EVERY ONE of the 18 rows, not zero, not a subset. A vacuous/constant recount would have either always agreed (never failing) or always disagreed (never passing); this one did both, correctly, depending on what the artifact actually said.
3. **A dedicated unit test proves the discriminator survives a uniform-class artifact.** `evaluatePauseRecount`'s "this recount is not vacuously agreeing" test builds a uniform-swap scenario directly (a synthetic table where every row is given the wrong class, mirroring the archive's own mostly-uniform shape) and confirms the evaluator names a problem on every single row, not just a row-count check — so the discriminator's power does not depend on the real table happening to have more than one class.

## RED Evidence (quoted verbatim, walked/ran-through swap, real archive)

Generator (rebuilt, run against the swapped classifier):
```
Exit 1: gate-failed. See the artifact for full detail.
```
(`d12-anchor-i` FAIL — measured `ran-through`, bound `walked` — the first walking control's own anchor point flipped labels too, an expected and irrelevant consequence of the same swap.)

Recount (before the GATE FAILED fallback fix, exit 1 one step earlier):
```
FAILED: could not parse .../34-CALIBRATION.md's Chosen constants: artifact missing ## Chosen constants
```

Recount (after the fallback fix, against the same broken artifact — exit 1, 18 named class problems):
```
walked=1 ran-through=17 stationary=0 transported=0 outOfScope(zero-advance-pause)=0

FAIL:
  - row 1 field "class" mismatch: recount=ran-through, table=walked
  - row 2 field "class" mismatch: recount=ran-through, table=walked
  - row 3 field "class" mismatch: recount=ran-through, table=walked
  - row 4 field "class" mismatch: recount=ran-through, table=walked
  - row 5 field "class" mismatch: recount=ran-through, table=walked
  - row 6 field "class" mismatch: recount=ran-through, table=walked
  - row 7 field "class" mismatch: recount=ran-through, table=walked
  - row 8 field "class" mismatch: recount=ran-through, table=walked
  - row 9 field "class" mismatch: recount=ran-through, table=walked
  - row 10 field "class" mismatch: recount=ran-through, table=walked
  - row 11 field "class" mismatch: recount=ran-through, table=walked
  - row 12 field "class" mismatch: recount=walked, table=ran-through
  - row 13 field "class" mismatch: recount=ran-through, table=walked
  - row 14 field "class" mismatch: recount=ran-through, table=walked
  - row 15 field "class" mismatch: recount=ran-through, table=walked
  - row 16 field "class" mismatch: recount=ran-through, table=walked
  - row 17 field "class" mismatch: recount=ran-through, table=walked
  - row 18 field "class" mismatch: recount=ran-through, table=walked
```

Reverted via `git checkout -- src/analytics/pause-classification.ts`; rebuilt; regenerated `34-CALIBRATION.md` (generator exit 0); `git diff --exit-code` confirmed clean on both `src/analytics/pause-classification.ts` and `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md`; `git status --porcelain data/streams` empty.

## Final Recount Table (shipped classifier, exit 0 — plan 34-10's expected values for the criterion-1 checkpoint row)

```
| # | source | startSec | endSec | seconds | metres | speedMps | class |
| --- | --- | --- | --- | --- | --- | --- | --- |
 | 1 | merged-segment | 1030 | 1048 | 18 | 52.4 | 2.911 | ran-through |
 | 2 | merged-segment | 1064 | 1135 | 71 | 288.6 | 4.065 | ran-through |
 | 3 | merged-segment | 1461 | 1515 | 54 | 124.6 | 2.307 | ran-through |
 | 4 | merged-segment | 1589 | 1611 | 22 | 52.2 | 2.373 | ran-through |
 | 5 | recording-gap | 1663 | 1685 | 22 | 58.1 | 2.641 | ran-through |
 | 6 | merged-segment | 1729 | 1760 | 31 | 88.4 | 2.852 | ran-through |
 | 7 | merged-segment | 2102 | 2125 | 23 | 53.4 | 2.322 | ran-through |
 | 8 | merged-segment | 2139 | 2169 | 30 | 90.1 | 3.003 | ran-through |
 | 9 | merged-segment | 2179 | 2236 | 57 | 157.5 | 2.763 | ran-through |
 | 10 | merged-segment | 2491 | 2525 | 34 | 81.7 | 2.403 | ran-through |
 | 11 | merged-segment | 2957 | 3067 | 110 | 305.4 | 2.776 | ran-through |
 | 12 | recording-gap | 3364 | 3388 | 24 | 46.3 | 1.929 | walked |
 | 13 | merged-segment | 3438 | 3456 | 18 | 49.2 | 2.733 | ran-through |
 | 14 | merged-segment | 3486 | 3547 | 61 | 157.8 | 2.587 | ran-through |
 | 15 | merged-segment | 3975 | 4028 | 53 | 154.4 | 2.913 | ran-through |
 | 16 | merged-segment | 4056 | 4121 | 65 | 201.7 | 3.103 | ran-through |
 | 17 | merged-segment | 4133 | 4212 | 79 | 219.0 | 2.772 | ran-through |
 | 18 | merged-segment | 4238 | 4263 | 25 | 72.3 | 2.892 | ran-through |

walked=1 ran-through=17 stationary=0 transported=0 outOfScope(zero-advance-pause)=0

PASS: recount agrees with the calibration artifact's class table.
```

## A note on a prior narrative inconsistency (observed, not fixed here)

`34-06-SUMMARY.md`'s own "3475724402 Per-Interval Class Distribution" disclosure states "All 18 ... classify `ran-through`; none classify `walked`", and D-21's disclosed-consequence text says the same ("at 2.2 m/s every one of 3475724402's merged intervals classifies `ran-through`... none classify `walked`"). The CURRENT, committed `34-CALIBRATION.md` artifact this plan read and independently re-verified does NOT match that: row 12 (`recording-gap`, 1.929 m/s) classifies `walked`, and has since at least the 34-06 fourth run that produced the currently-committed artifact. Re-reading D-21's own wording closely, it scopes its claim to "merged intervals" specifically (16 of the 18 rows; the 2 `recording-gap` rows, including row 12, are a separate `source` kind) — so the underlying constant/gate math is not in question, only the SUMMARY/D-21 prose's "all 18... none classify walked" phrasing over-generalizes from "all *merged* intervals" to "all 18 intervals". This plan's own scope is D-18's verification only; per this plan's Requirement-tick safety note and its own task list, no other phase document was edited to correct that phrasing — flagged here for whoever next touches `34-06-SUMMARY.md` or D-21's text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `parseChosenConstants` could not reach the evaluator under a GATE FAILED artifact, the exact state Task 2's own deliberate breakage produces**
- **Found during:** Task 2, immediately after the required walked/ran-through swap + regenerate + recount sequence
- **Issue:** `compute-pause-classification-calibration.mjs` renders `## Chosen constants` only when `allCleared && !gateFailed`; any gate failure (including the `d12-anchor-i` walking-control-anchor failure this plan's own required breakage produces as an expected, irrelevant side effect) instead renders `## GATE FAILED` with NO `NAME = value` lines anywhere in the document, even though the `## Per-interval class table` this recount verifies still renders in full. `parseChosenConstants` as first written could only find the heading or throw, so the required watch failed one step too early (`"artifact missing ## Chosen constants"`) instead of producing the "class problems" the plan's own Task 2 acceptance criteria call for.
- **Fix:** Added a documented, tested fallback: when `## Chosen constants` is absent, parse the three band numbers from the `## Gates` table's own `order` row (`| order | A < B < C | ... |`), a row that renders in the SAME numeric order whenever any family cleared at all (both the passing and GATE FAILED shapes), and is absent only under `## NO SHAPE CLEARS` (where the function still correctly throws `"artifact missing ## Chosen constants"`, confirmed by a new test). Never a re-derivation — the fallback reads a second, already-published location for the identical numbers, which are themselves unaffected by any classifier bug (bands gate the classifier, not the reverse).
- **Files modified:** `scripts/compute-pause-classification-recount.mjs`, `scripts/compute-pause-classification-recount.test.mjs`
- **Verification:** Two new tests (GATE FAILED fallback succeeds; NO SHAPE CLEARS still throws). Full test file re-run green (36/36). Re-ran the complete Task 2 sequence end to end with the fix in place: swap → build → regenerate (exit 1, expected) → recount (exit 1, 18 named class problems, quoted above) → revert → build → regenerate (exit 0) → recount (exit 0, PASS, quoted above). `git diff --exit-code` clean on `src/analytics/pause-classification.ts` and `34-CALIBRATION.md`; `git status --porcelain data/streams` empty.
- **Committed in:** `ecbaa641` (fix)

---

**Total deviations:** 1 auto-fixed (1 blocking issue, Rule 3)
**Impact on plan:** Necessary to complete Task 2's own required watched-failing exercise as specified (a real class-problem-naming failure, not an earlier parse failure). No scope creep — the fix lives entirely inside this plan's own new recount script and its tests; `pause-classification.ts` and `34-CALIBRATION.md` both ended the plan byte-identical to their pre-plan committed state.

## Issues Encountered

None beyond the Rule 3 fix documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan adds only a standalone recount script and its tests; no UI, no dashboard data path, no hardcoded empty/placeholder values reaching any rendered surface.

## Verification Evidence

- `npx vitest run scripts/compute-pause-classification-recount.test.mjs -t "recount"` — 14 matched, passed
- `npx vitest run scripts/compute-pause-classification-recount.test.mjs -t "evaluate"` — 9 matched, passed
- `npx vitest run scripts/compute-pause-classification-recount.test.mjs -t "contract"` — 11 matched, passed (of 13 total contract-describe tests; 2 were the GATE FAILED fallback tests added mid-Task-2, both also passed when filtered individually)
- `npx vitest run scripts/compute-pause-classification-recount.test.mjs -t "zero-import guard"` — 3 matched, passed
- `npx vitest run scripts/compute-pause-classification-recount.test.mjs` (full file) — 36/36 passed
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0
- `npm test` — 98 files / 3407 tests, all green (up from 34-06's 97 files / 3371 tests baseline; +36 new tests, matching this plan's new test file exactly)
- `git diff --exit-code src/analytics/pause-classification.ts .planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` — clean
- `git status --porcelain data/streams` — empty

## Next Phase Readiness

- **Plan 34-10** (the browser checkpoint) can quote the Final Recount Table above verbatim as its expected values for criterion 1's per-segment agreement row — computed independently of the classifier, watched failing first against a real breakage, and confirmed non-vacuous by three separate pieces of evidence (see above).
- `npm run compute-pause-classification-recount` is a standing, committed, fail-closed verification any future change to `pause-classification.ts`'s bands or ladder can be checked against without rebuilding this plan's exploratory work.
- No blockers. The narrative-inconsistency note above is informational only, scoped outside this plan.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `scripts/compute-pause-classification-recount.mjs`
- FOUND: `scripts/compute-pause-classification-recount.test.mjs`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-07-SUMMARY.md` (this file)
- FOUND commits: `d75a8327`, `ecbaa641`
