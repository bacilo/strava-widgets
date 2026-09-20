---
phase: 32-unreliable-segment-detection-calibration
plan: 15
subsystem: analytics
tags: [typescript, vitest, tdd, reachability, gap-closure]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "pace-single-source.test.ts's SEG-05a detector-importer scan (32-04), unreliable-segments.test.ts's D-05/D-09 negative controls (32-05/32-08) and gap-boundary convention block (32-13), validate-unreliable-segments-1hz.mjs's buildActivityFinding (32-09), and 32-VERIFICATION.md's three 2026-09-20 warnings this plan closes"
provides:
  - "The SEG-05a detector-importer scan is quote-variant proof: a double-quoted or backtick module specifier is caught exactly like the single-quoted form, in both the .js and extensionless forms, watched failing against the pre-change 2-needle array first"
  - "The D-05 and D-09 negative controls each carry a reachability pair, independently re-deriving from raw t/d which of two distinct shipped mechanisms (the speed limit or the excess floor) actually protects each fixture, and proving a lowered variant of that specific parameter fires"
  - "buildActivityFinding returns a skipped finding instead of throwing when the committed stream is missing, unparseable, or has no array t/d channels, matching its own never-throws docblock"
affects: [33-pace-derivation-integration, 35-best-effort-integration, 36-gap-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a reachability check that asserts a single hand-picked discriminator (e.g. vMax < a limit) can itself be a vacuous or false guard if the real protecting mechanism is different for different fixtures — derive and report BOTH candidate discriminators, assert at least one genuinely holds, and lower whichever one actually applies for the red-direction proof"
    - "a pre-change 'watched failing' recording for a test-only source file can be captured with a scratch probe file that imports the target module's real exports, run once via vitest, then deleted before the real edit — no git stash, no temporary commit needed"

key-files:
  created: []
  modified:
    - src/analytics/pace-single-source.test.ts
    - src/analytics/unreliable-segments.test.ts
    - scripts/validate-unreliable-segments-1hz.mjs

key-decisions:
  - "DETECTOR_IMPORTER_NEEDLES extended from 2 to 6 entries (single/double/backtick x .js/extensionless), keeping the original two verbatim and first, per the plan's explicit instruction — not switched to the review's alternative regex-based fix (WR-02's suggested `/unreliable-segments(\\.js)?[\"'\\`]/`), since the plan's own action text explicitly specifies extending the array"
  - "Rule 1 deviation: the plan's proposed D-05/D-09 reachability discriminator (a single vMax < UNRELIABLE_SPEED_LIMIT_MPS assertion) is measurably FALSE for 2 of the 3 locked/trivia fixtures — 7409028052 (vMax=8.70 m/s) and the D-09 pair (vMax=8.80 m/s) both exceed the 7.35 m/s shipped limit and are actually protected by the 3.0 m excess floor (measured maxRunExcess 1.50 m and 2.60 m respectively), exactly matching 32-CONTEXT.md's own D-09 description. Only 3647739864 (vMax=5.88 m/s) is genuinely speed-protected. Rewrote the reachability check to independently re-derive BOTH discriminators, assert the correct one for each fixture, and lower whichever parameter that fixture is actually protected by for the red-direction proof — a uniform single-discriminator check would have been false for two of the three real fixtures"
  - "Task 3's CLI proof of the real-activity direction could not reach a full 'normal finding shape' because this bare worktree has no export_data/ (gitignored, developer-only) — a real committed stream (3475724402) was used with a dummy (empty) .fit.gz to prove the fix reaches segment detection and gracefully skips at FIT decode rather than throwing; the missing-stream and malformed-JSON directions (the actual CR-03 fix target) are demonstrated in full"

requirements-completed: [SEG-03, SEG-04, SEG-05a]

# Metrics
duration: 55min
completed: 2026-09-20
---

# Phase 32 Plan 15: Reachability Gap-Closure (SEG-05a Quoting, D-05/D-09 Controls, CR-03) Summary

**Three guards that previously could not fail — the SEG-05a importer scan's quote-blindness, the D-05/D-09 negative controls' vacuity, and `buildActivityFinding`'s unguarded stream read — are each now shown failing on a broken input and passing on the fixed one, with the D-05/D-09 check additionally correcting a false assumption in its own planned discriminator (measured: two of three fixtures are protected by the excess floor, not the speed limit).**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-20T21:59:00Z (worktree base, post-reset to `09b4a42a`)
- **Completed:** 2026-09-20T22:54:00Z
- **Tasks:** 3 completed, 3 committed
- **Files modified:** 3

## Accomplishments

- Extended `DETECTOR_IMPORTER_NEEDLES` from 2 to 6 entries covering single/double/backtick
  quoting for both `.js` and extensionless specifier forms; watched the double-quoted and
  backtick plants pass through UNCAUGHT against the pre-change 2-needle array first
- Renamed both D-05/D-09 describe blocks to carry `negative control` for the `-t` filter, and
  added a reachability pair per fixture that independently re-derives (from raw `t`/`d` via
  `advanceSteps`) which of two genuinely distinct shipped mechanisms — the speed limit or the
  excess floor — actually protects each fixture, discovering the plan's proposed single-check
  design was false for 2 of 3 fixtures
- Made `buildActivityFinding` catch the committed-stream read and validate its `t`/`d` shape
  before ever reaching `validateStreamSeries`'s unguarded dereference, closing CR-03; proved the
  pre-change throw and the post-change graceful skip from the CLI in both directions

## Task Commits

Each task was committed atomically:

1. **Task 1: SEG-05a importer scan quote-variant proof** - `e8cc80f9` (test)
2. **Task 2: D-05/D-09 negative control reachability** - `fb11572c` (test)
3. **Task 3: `buildActivityFinding` never-throws contract** - `9a5dccc6` (fix)

## Files Created/Modified

- `src/analytics/pace-single-source.test.ts` — `DETECTOR_IMPORTER_NEEDLES` extended to 6 entries
  with an updated docblock; two new planted-violation tests `(2a)` (double-quote/backtick proof,
  both `.js` and extensionless) and `(2b)` (allowance predicate exercised for all three quote
  styles at the detector itself, its one allowed importer, and a `.test.ts` file)
- `src/analytics/unreliable-segments.test.ts` — Both `D-05`/`D-09` describe blocks renamed to
  carry `negative control`; new `deriveWindowDiscriminators` helper (re-derives `vMax` and
  `maxRunExcess` from raw `t`/`d` via `advanceSteps`, mirroring but never repeating the shipped
  `isFastStep`/`groupFastRuns`/`excessMetres` literal text); one reachability test per fixture
  (3 total) asserting the overlapping-step set is non-empty, the fixture is protected by the
  correct discriminator, and a lowered variant of that specific parameter fires an overlapping
  segment
- `scripts/validate-unreliable-segments-1hz.mjs` — `buildActivityFinding`'s committed-stream read
  wrapped in try/catch (returns a skipped finding on ENOENT/SyntaxError instead of throwing), plus
  an explicit `Array.isArray(t) && Array.isArray(d)` guard before `validateStreamSeries`; docblock
  updated to list what "never throws" now covers

## Reachability Evidence (both directions, per this plan's own bar)

### Task 1 — SEG-05a quote-variant proof

**Pre-change (2-needle array, unfixed) — quoted from a scratch probe run against the CURRENT
`pace-single-source.test.ts` before any edit, deleted after capture (not committed):**
```
PRE-IMAGE dqResult []
PRE-IMAGE btResult []
PRE-IMAGE sqResult [{"path":"src/analytics/planted-second-importer-sq.ts","needle":"unreliable-segments.js'","count":1}]
```
The double-quoted (`dqResult`) and backtick (`btResult`) importer plants returned `[]` —
completely uncaught — while the existing single-quote form (`sqResult`) was caught. This is the
load-bearing evidence the four new needles are necessary, not decorative.

**Post-change (6-needle array) — both new quote styles now caught, verified via the file's own
tests `(2a)`/`(2b)` (see below) and by direct re-run:**
```
Tests  83 passed (83)                        // whole file
Tests  9 passed | 74 skipped (83)            // -t "SEG-05a" (>= 7 baseline)
```
`npx tsc --noEmit` exits 0. `grep -n "^const DETECTOR_IMPORTER_NEEDLES" -A 8` shows exactly 6
needle lines, with the original two (`"unreliable-segments.js'"`, `"unreliable-segments'"`)
unchanged and first. `grep -c "unreliable-segments"` on the whole file returns 32 (usages across
comments/tests/docblocks); the array declaration itself carries exactly 6 entries. The real tree
still produces zero detector-importer violations (`SEG-05a` describe block's own non-vacuous
test, included in the 83-pass count).

### Task 2 — D-05/D-09 reachability (with the Rule 1 correction)

**Measured discriminators, independently re-derived from raw `t`/`d` via
`deriveWindowDiscriminators`, logged during the passing run:**
```
[D-05 reachability] 7409028052 vMax=8.7000 m/s (headroom=-1.3500 m/s), maxRunExcess=1.5000 m (headroom=1.5000 m)
[D-05 reachability] 3647739864 vMax=5.8846 m/s (headroom=1.4654 m/s), maxRunExcess=0.0000 m (headroom=3.0000 m)
[D-09 reachability] 3475734189 vMax=8.8000 m/s (headroom=-1.4500 m/s), maxRunExcess=2.6000 m (headroom=0.4000 m)
```
`UNRELIABLE_SPEED_LIMIT_MPS=7.35`, `UNRELIABLE_EXCESS_FLOOR_M=3`.

| Fixture | vMax (m/s) | Speed headroom | maxRunExcess (m) | Floor headroom | Protected by |
|---|---|---|---|---|---|
| `7409028052` t=586-624 | 8.70 | **-1.35** (above limit) | 1.50 | 1.50 | **excess floor** |
| `3647739864` t=945-971 | 5.88 | 1.47 | 0.00 (no fast run) | 3.00 | **speed limit** |
| `3475734189` t=1581-1583 (D-09) | 8.80 | **-1.45** (above limit) | 2.60 | 0.40 | **excess floor** |

**Pre-existing assumption falsified (RED, quoted from the first implementation attempt before
correction):**
```
AssertionError: 7409028052: the window's own measured vMax must be below UNRELIABLE_SPEED_LIMIT_MPS
for the locked control to hold for the reason claimed: expected 8.700000000000045 to be less than 7.35

AssertionError: 3475734189: the window's own measured vMax must be below UNRELIABLE_SPEED_LIMIT_MPS
for the locked control to hold for the reason claimed: expected 8.800000000000182 to be less than 7.35
```
This is the plan's own proposed single-discriminator check (`vMax < UNRELIABLE_SPEED_LIMIT_MPS`),
run against the REAL fixtures — 2 of 3 failed, proving the plan's assumption (that the speed limit
alone explains every locked control) is false. Per 32-CONTEXT.md's own D-09 entry ("trivia like
3475734189's 8.5/8.8 m/s pair ... does not clip pace ... [because of] a calibrated excess-metres
significance floor"), the excess floor — not the speed limit — is the documented mechanism for
that fixture, and measurement shows `7409028052` shares the same mechanism.

**GREEN (corrected two-discriminator check) — quoted:**
```
Tests  93 passed (93)                        // whole file
Tests  6 passed | 87 skipped (93)            // -t "negative control" (>= 3 required)
Tests  6 passed | 87 skipped (93)            // -t "boundary convention" (32-13's exact count, undisturbed)
Tests  12 passed | 81 skipped (93)           // -t "mechanism" (unchanged from 32-13's post-fix count)
```
`npx tsc --noEmit` exits 0. Locked spans unchanged: `grep -c "startSec: 586, endSec: 624"` → `1`;
`grep -c "startSec: 945, endSec: 971"` → `1`.

**Red-direction proof (each fixture's ACTUAL protecting parameter lowered, confirmed firing):**
```
7409028052 lowered excessFloorMetres to 1.49 (just under measured 1.50): 1 overlapping segment
3475734189 (D-09) lowered excessFloorMetres to 2.59 (just under measured 2.60): 1 overlapping segment
3647739864 lowered speedLimitMps to 5.8258 (just under measured 5.88): 1 overlapping segment
```

### Task 3 — `buildActivityFinding` never-throws contract (CR-03)

**Pre-change (unfixed function, restored from `git show HEAD:...` into the working file, probed,
then reverted to the fixed version — no commit ever contained the unfixed state):**
```
$ node probe-missing.mjs
THREW: ENOENT: no such file or directory, open '.../streams-missing/0000000000.json'

$ node probe-malformed.mjs
THREW: Expected property name or '}' in JSON at position 2 (line 1 column 3)
```

**Post-change (fixed function) — same two probes, same inputs:**
```
$ node probe-missing.mjs
RESULT {"id":"0000000000","skipped":"committed stream missing or unparseable: ENOENT: no such file or directory, open '.../streams-missing/0000000000.json'"}

$ node probe-malformed.mjs
RESULT {"id":"0000000000","skipped":"committed stream missing or unparseable: Expected property name or '}' in JSON at position 2 (line 1 column 3)"}
```

**Real-activity direction (3475724402, real `data/streams`/`data/activities`, a dummy empty
`.fit.gz` standing in for `export_data/`, which this bare worktree does not have):**
```
$ node probe-real.mjs
RESULT {"id":"3475724402","skipped":"FIT decode failed (unexpected end of file)"}
```
This shows the real committed stream flows through the CR-03-fixed code (`Array.isArray` +
`validateStreamSeries` + `classifyGaps` + `detectUnreliableSegments`, which finds segments on this
activity per 32-08's own regression fixture) without throwing, and only skips gracefully at the
pre-existing FIT-decode try/catch — because the dummy file is not a real gzip/FIT stream. A full
"normal finding shape" demonstration requires a genuine `export_data/` FIT original, which is not
available in this bare worktree; the environment's `worktree_environment_setup` notes confirm
`export_data/` is developer-machine-only and gitignored.

**Required automated CLI probe (verbatim from the plan's `<verify>` block):**
```
$ node -e "import('./scripts/validate-unreliable-segments-1hz.mjs').then(...)"
NEVER-THROWS-OK {"id":"0000000000","skipped":"FIT original not found on disk (x.fit.gz)"}
```

**Acceptance-criteria note:** `grep -c "\.test\.mjs" scripts/validate-unreliable-segments-1hz.mjs`
returns `3`, not `0` — but this baseline is UNCHANGED by this plan's diff (confirmed via
`git show HEAD~1:...` before this task's edit, also `3`): all three matches are pre-existing
docblock prose explaining WHY no `.test.mjs` sibling exists (D-12), not an actual sibling file.
`ls scripts/validate-unreliable-segments-1hz.test.mjs` confirms no such file exists, and
`git status --porcelain scripts/` shows only the intended file changed. D-12's local-only rule is
intact; the plan's literal `0` expectation does not match this file's own pre-existing prose, but
the substantive criterion (no test sibling created) holds.

## `npm test` Delta (this bare worktree)

`npx vitest run` (whole suite): `7 test files failed | 83 passed | 1 skipped (91)`;
`3 tests failed | 2686 passed | 23 skipped (2712)`. All 7 failing files/3 failing tests are the
same pre-existing environmental `ENOENT` pattern documented in 32-13-SUMMARY.md (gitignored
`data/stats/*.json` derived outputs this bare worktree's `data/` copy never generated:
`trends-*-logic.test.ts` x4, `records-logic.test.ts`, `verify-dashboard-publish-stats.test.mjs`,
`detail-sections.test.ts`'s three pace-quality shard cases) — none touch
`unreliable-segments.test.ts`, `pace-single-source.test.ts`, or
`validate-unreliable-segments-1hz.mjs`. The test-count delta versus 32-13's baseline (2681 → 2686,
+5) is exactly this plan's additions: 2 new tests in `pace-single-source.test.ts` ((2a), (2b)) and
3 new reachability tests in `unreliable-segments.test.ts` (one per D-05/D-09 fixture). The
orchestrator's post-merge `npm test` on the primary checkout is the authoritative gate for this
delta, not this bare-worktree run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the D-05/D-09 reachability discriminator: the plan's proposed
`vMax < UNRELIABLE_SPEED_LIMIT_MPS` check is false for 2 of 3 real fixtures**
- **Found during:** Task 2, first implementation attempt (verification run)
- **Issue:** The plan's action text asked for a single assertion — the window's maximum run-level
  implied speed is below the shipped speed limit — as "the independently-derived REASON the
  control holds." Measured against the real fixtures, this is false for `7409028052` (vMax=8.70
  m/s) and the D-09 pair (vMax=8.80 m/s), both of which exceed `UNRELIABLE_SPEED_LIMIT_MPS=7.35`.
  Only `3647739864` (vMax=5.88 m/s) matches the plan's assumption.
- **Fix:** Added `deriveWindowDiscriminators`, independently re-deriving both `vMax` (single
  fastest overlapping step) and `maxRunExcess` (accumulated excess of any maximal contiguous
  fast-step run touching the window, mirroring the shipped `isFastStep`/`groupFastRuns`/
  `excessMetres` discipline without repeating its literal text). Each fixture now asserts it is
  protected by EITHER the speed limit OR the excess floor (correctly distinguishing "no fast step
  at all" from "a fast run exists but its excess stays under the floor"), and the red-direction
  proof lowers whichever parameter that specific fixture is actually protected by.
- **Files modified:** `src/analytics/unreliable-segments.test.ts`
- **Verification:** `-t "negative control"` → `6 passed`; all three fixtures' red-direction
  lowered-parameter variants confirmed firing (see Reachability Evidence above); whole file
  `93 passed (93)`; `-t "boundary convention"` and `-t "mechanism"` counts undisturbed from 32-13.
- **Committed in:** `fb11572c` (part of Task 2's single commit — this correction was made before
  committing, so the commit already reflects the corrected design; no separate fix-up commit was
  needed)

---

**Total deviations:** 1 auto-fixed (1 bug in the plan's own test design, not in shipped code).
**Impact on plan:** No shipped detector behaviour, calibrated constant, or locked fixture span was
touched — exactly as the plan's `must_haves.truths` requires. The correction makes the
reachability check factually accurate instead of accidentally true for only one of three
fixtures; without it, the D-05/D-09 reachability tests as originally specified would have failed
on real data, which is a materially different (and worse) outcome than "vacuous."

## Issues Encountered

- This bare worktree has no `export_data/` (gitignored, developer-machine-only per D-12), so
  Task 3's third CLI demonstration ("real activity, normal finding shape") could not decode a
  genuine FIT original. Substituted a real committed stream with a dummy (empty) `.fit.gz` to
  prove the fixed code path reaches segment detection and skips gracefully at FIT decode rather
  than throwing — the two directions that actually exercise CR-03 (missing/malformed committed
  stream) are demonstrated in full. Not a plan defect; an environment limitation, documented here
  per the plan's own instruction to paste real CLI output rather than fabricate it.
- The plan's Task 3 acceptance criterion `grep -c "\.test\.mjs" ... remains 0` does not match this
  file's pre-existing baseline of `3` (unchanged by this plan's diff, confirmed via
  `git show HEAD~1`) — the three matches are pre-existing docblock prose about D-12, not an actual
  sibling test file. Documented rather than silently claimed satisfied.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three 2026-09-20 verification warnings covered by this plan (SEG-05a quote-blindness, the
  D-05/D-09 non-vacuity warning extended to D-09, and CR-03) are closed, with each guard shown
  both failing and passing.
- No shipped detector behaviour, calibrated constant, or committed artifact changed in this plan —
  confirmed by `git status` showing only the three intended test/script files modified, and by
  `npx tsc --noEmit` exiting 0 throughout.
- Sibling plan 32-14 (wave 3, same worktree wave) covers CR-04, CR-06, and the ambiguous-overlap
  warning from the same verification report — together with this plan, nothing from the
  2026-09-20 verification's warning list is deferred.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `src/analytics/pace-single-source.test.ts`
- FOUND: `src/analytics/unreliable-segments.test.ts`
- FOUND: `scripts/validate-unreliable-segments-1hz.mjs`
- FOUND: commit `e8cc80f9` (test(32-15): make SEG-05a importer scan quote-variant proof)
- FOUND: commit `fb11572c` (test(32-15): give the D-05 and D-09 negative controls a reachability check)
- FOUND: commit `9a5dccc6` (fix(32-15): make buildActivityFinding honour its never-throws contract)
