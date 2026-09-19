---
phase: 28-pr-plausibility-ceiling
plan: 14
subsystem: analytics
tags: [best-efforts, ceiling, regeneration, reconciliation, idempotence, recount]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: "The CR-01 fix (plan 28-11, compute-best-efforts.ts Pass 3 now sweeps owner-excluded efforts against the ceiling), the WR-05 recount teeth (plan 28-10, recountCeilingSweep/independentCeilingCount wired into evaluateReport's verdict), and the WR-03/WR-04 generator fixes (plan 28-12, per-effort exclusion in the diff and calibration generators)"
provides:
  - "data/stats/best-efforts.json regenerated against the pinned archive snapshot from the fixed compute step: effortsDemoted/effortsRejected moved 52 -> 65, ceiling state file untouched (population unchanged)"
  - "A 22-assertion structural pre/post comparison proving the ONLY change is: the 13 predicted efforts' demotion field (null -> guard 'ceiling'), 13 appended rejected rows, and the two totals fields -- rankings (sha256-pinned), ceilings, and every other field byte-identical"
  - "28-DIFF.md regenerated (new sha256 64c90981...5cd2): ceiling-only total 31, a new 'Ceiling demotions on owner-excluded efforts' section listing exactly the 13 predicted rows, four pre-existing sections proven byte-identical to the signed-off version, idempotent across two runs"
  - "28-CEILING-CALIBRATION.md regenerated: idempotent, differs from the prior committed version only on the Generated line and the two Inputs generatedAt lines (WR-03 prediction held, no restore needed), seven-row ceiling cross-check against doc.ceilings[d] all match"
  - "A three-way reconciliation (31 diff-reported / 31 recount byGuard.ceiling / 31 recount independentCeilingCount) plus a 13-label set match against plan 28-10's independently-produced pre-fix sweep, closing 28-VERIFICATION.md gap 3's self-agreeing-check defect"
  - "Round 2 Evidence section appended to 28-VALIDATION.md: snapshot pins, both recount outputs (pre-fix FAIL and post-fix PASS), the structural comparison, a predicted-vs-observed table (7/7 rows match), and the D-04 observation on activity 3475726256"
  - "Per-Task Verification Map extended with rows for 28-10 through 28-15; deferred-items.md gained a 'Gap closure 28-10..28-15 (not folded in)' section"
affects: ["28-15 (Round 2 browser checkpoint and fresh PR-04 sign-off, binds to 28-DIFF.md sha256 64c90981...5cd2)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Predict every number before regenerating anything, from a route that does not use the code under test (the pre-fix sweep's 18+13 and its own independent 31), then require the regeneration to land on that number rather than deriving a number from the regeneration and calling it confirmed"
    - "A throwaway, never-committed comparison script asserting exact JSON-field-level equality (rest-destructure the one field expected to change, JSON.stringify-compare everything else) is the load-bearing proof that a fix changed only what it should"

key-files:
  created: []
  modified:
    - .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md
    - .planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md
    - .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md
    - .planning/phases/28-pr-plausibility-ceiling/deferred-items.md

key-decisions:
  - "data/geo/geo-metadata.json's timestamp-only side effect from npm run compute-all-stats was reverted with git checkout -- (not committed) -- it is a tracked file outside this plan's declared scope, and regenerating it was an incidental byproduct of the required compute-all-stats chain, not a change this plan intended to make."
  - "Two pre-existing pr-ceiling-diff-* temp directories under os.tmpdir() (mtime 09:57-09:58 UTC, before this plan's or even the prior wave's STATE.md update at 11:43 UTC) were left alone and documented as unrelated debris, not created by this plan's own two compute-pr-ceiling-diff runs (both of which cleaned up via finally, confirmed by an immediate before/after directory count)."

requirements-completed: []  # Deliberately empty. This plan's frontmatter names PR-03/PR-04/PR-05, but per
# the orchestrator's explicit sequential-execution instruction, PR-03/PR-04/PR-05 stay reopened until
# plan 28-15's blocking human checkpoint and re-verification close them. This plan regenerates and
# reconciles artifacts against independently-predicted numbers; it does not itself constitute the human
# sign-off or browser verification those requirements require.

# Metrics
duration: ~50min
completed: 2026-09-16
---

# Phase 28 Plan 14: Regenerate and Reconcile Against Predicted Values Summary

**`data/stats/best-efforts.json`, `28-DIFF.md` and `28-CEILING-CALIBRATION.md` regenerated from the CR-01-fixed compute step, with every resulting number (ceiling-only 31, world-record 19, max-speed 15, total demoted 65, independentCeilingCount 31, over-ceiling-without-demotion 0) matched exactly against a value predicted before any regeneration ran, closing 28-VERIFICATION.md gap 3's "18 = 18 was two artifacts sharing a blind spot" defect.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-16T11:5x:00Z (approx, after reading plan/context files)
- **Completed:** 2026-09-16T14:1x:00Z (approx)
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Ran the pre-fix independent recount on a snapshot copy of the shipped (pre-regeneration) document: `byGuard.ceiling` 18, `independentCeilingCount` 31, 13 missing labels — confirming the plan's stated prediction (18 + 13 = 31) via two routes that never read `effort.demotion` as ground truth.
- Regenerated `data/stats/best-efforts.json` (`npm run build && npm run compute-all-stats`) against the pinned archive snapshot. The ceiling-state file `data/best-effort-ceiling.json` was NOT rewritten (`git status --porcelain` empty) and the console reported "unchanged at every distance" — the population did not move, only the ceiling *application* changed.
- A 22-assertion structural pre/post comparison (throwaway script, never committed) proved the regeneration changed exactly and only: the 13 predicted efforts' `demotion` field (null → guard `ceiling`), 13 appended `rejected` rows matching those same 13 `(activityId, distance)` pairs, and `totals.effortsDemoted`/`totals.effortsRejected` (52 → 65). Rankings (string-identical, sha256 `cb2a498a...` pinned and confirmed), `doc.ceilings`, every `wasPRAtTheTime` flag, and every other field were byte-identical.
- The post-fix recount (`--expect-demoted 65`) exited 0 PASS: `byGuard.ceiling` 31, world-record 19, max-speed 15, `independentCeilingCount` 31, `overCeilingWithoutDemotion` 0, pinned fixture `4556693525@400m` now `guard="ceiling"`, `guardIsCeiling=true`. The 662-of-1,890 impossible-sample cohort denominator (35%) is unchanged from plan 28-08's recorded figure — no drift.
- `28-DIFF.md` regenerated (new sha256 `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`, prior signed-off hash `08e93d5a...77c6`): ceiling-only total 31, 13 owner-excluded rows in the new "Ceiling demotions on owner-excluded efforts" section in the predicted order with the predicted values, matching the plan's `<interfaces>` block line by line. Idempotent across two runs (diff of non-`Generated` lines is empty). The four pre-existing sections (Records that changed hands, PR-at-the-time flag flips, Retroactive promotions, Inputs) are byte-identical to the signed-off version.
- `28-CEILING-CALIBRATION.md` regenerated: idempotent across two runs (Generated-line-only diff), and differs from the prior committed version only on the Generated line and the two Inputs `generatedAt:` lines — the WR-03 prediction held, so the regenerated file was kept (no `git checkout` restore needed). The seven-row ceiling cross-check against `doc.ceilings[d].ceilingMps.toFixed(4)` matches exactly at every distance, and marathon correctly shows the no-ceiling text.
- Three-way reconciliation confirmed: the diff's ceiling-only total (31), the recount's `byGuard.ceiling` (31) and the recount's `independentCeilingCount` (31) all agree, and the diff's 13 owner-excluded labels match — as a set — the 13 labels plan 28-10's pre-fix sweep independently reported (a different program reading a different, not-yet-regenerated document).
- Appended a `## Round 2 Evidence (gap closure 28-10..28-14)` section to `28-VALIDATION.md` with the snapshot pins, both recount outputs, the structural-comparison output, a predicted-vs-observed table (7/7 rows match with no discrepancy), and the D-04 observation on activity `3475726256` (44.0s/9.0909 m/s — the stale PR-05/ROADMAP figure), worded as an observation per D-04's instruction not to investigate further.
- Extended the Per-Task Verification Map with rows for plans 28-10 through 28-15 (10 rows total, including 28-15's two not-yet-executed rows marked pending), and appended a "Gap closure 28-10..28-15 (not folded in)" section to `deferred-items.md` logging WR-06's second half, IN-05, WR-01's untested browser path, R4 (reconfirmed still not exercisable against the regenerated document), a pre-existing empty-state wording case, and the held `origin/master` merge.

## Task Commits

1. **Task 1: Pin the snapshot, preserve the pre-fix document, regenerate, and prove the change is exactly the 13 efforts** - `658d247e` (docs)
2. **Task 2: Regenerate 28-DIFF.md and 28-CEILING-CALIBRATION.md twice each, and reconcile against the independent figures** - `531f76fc` (docs)
3. **Task 3: Record the Per-Task map rows for 28-10..28-15 and log what was deliberately not folded in** - `3ff9f591` (docs)

`data/stats/best-efforts.json` and `data/dashboard/index.json` are gitignored and were NOT committed by any of the three tasks (per the plan's own instruction) — only the four `.planning/` artifacts above carry commits.

## Files Created/Modified

- `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` - Regenerated from the CR-01-fixed pipeline and the WR-03/WR-04-fixed generator (plan 28-12); ceiling-only total 18 → 31, new owner-excluded section, new sha256
- `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` - Regenerated; unchanged except the Generated line and two Inputs generatedAt lines, confirming WR-03's fix produces byte-stable output against the corrected population
- `.planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` - Appended "Round 2 Evidence" section (Task 1 + Task 2 content) and 10 new Per-Task Verification Map rows (Task 3); frontmatter, Round 1 Checkpoint and AMENDED sections left untouched
- `.planning/phases/28-pr-plausibility-ceiling/deferred-items.md` - Appended "Gap closure 28-10..28-15 (not folded in)" section

## Decisions Made

- `data/geo/geo-metadata.json`'s timestamp-only diff (a side effect of `npm run compute-all-stats`, which regenerates it as part of the full chain) was reverted with `git checkout --` rather than committed — it is a tracked file outside this plan's declared `files_modified` scope, and the diff carried no content change (same activity/geocoded/coverage numbers, only `generatedAt` moved).
- Two pre-existing `pr-ceiling-diff-*` temp directories under `os.tmpdir()` were confirmed (by mtime, 09:57-09:58 UTC, before even the prior wave's STATE.md `last_updated` of 11:43 UTC) to predate this plan's own two `compute-pr-ceiling-diff` runs, both of which cleaned up correctly via `finally` — documented in `28-VALIDATION.md` as unrelated debris rather than an IN-04 regression.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria in all three tasks were independently re-verified after each commit (see verbatim command output below and in `28-VALIDATION.md`'s Round 2 Evidence section).

## Issues Encountered

- The `compare.mjs` throwaway script's first draft assumed `activity.efforts` was an object keyed by distance; the real shape is an array of `{distance, ...}` objects. Caught immediately by the script's own crash (`Cannot read properties of undefined`), fixed before any assertion was trusted, and the corrected script re-run cleanly (22/22 PASS). This was a bug in the disposable verification script itself, never committed, not a defect in any committed file.

## Verbatim Evidence

**Pre-fix recount on the snapshot** (`--best-efforts <snap> --index <snap>`), exit 1:
```
Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 52
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      18
  Pinned fixture 4556693525@400m: durationSec=45.2 guard=null durationMatches45_2=true guardIsCeiling=false

Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 31
  overCeilingWithoutDemotion (13): 14122328106@400m, 3475711469@400m, 3475711630@400m, 3475715178@400m, 3475725513@1k, 3475726256@400m, 3475727228@400m, 3475732221@400m, 3475735603@400m, 4556693525@400m, 4556693525@1k, 5059204779@400m, 5588316886@400m

FAIL:
  - pinned fixture 4556693525@400m guard is null, not "ceiling" (guardIsCeiling=false)
  - 13 over-ceiling effort(s) carry no demotion (CR-01 shape)
  - independent ceiling count (31) disagrees with byGuard.ceiling (18)
```

**Structural pre/post comparison** (22 assertions, 0 FAIL):
```
PASS: rankings deep-equal (string compare)
PASS: post rankings sha256 === cb2a498a416b29eb7c8ca3826841b3e768d66c7ca0993d135d2782a9369ec9fb
PASS: ceilings deep-equal
PASS: activity key sets equal
PASS: every effort: non-demotion fields identical
PASS: demotion-diff count === 13 (observed 13)
PASS: demotion-diff label set === predicted 13
PASS: every demotion diff goes null -> guard "ceiling"
PASS: post rejected length === pre rejected length + 13 (pre=52, post=65)
PASS: post rejected = pre rejected + 13 new rows matching predicted labels
PASS: totals differ only in effortsDemoted/effortsRejected
PASS: totals.effortsDemoted 52 -> 65
PASS: totals.effortsRejected 52 -> 65
PASS: shard file count equals activity key set count (1865)
PASS: 4556693525@400m guard === ceiling
PASS: 4556693525@400m reason matches predicted EXACTLY
PASS: 4556693525@1k guard === ceiling
PASS: 4556693525@1k reason matches predicted EXACTLY
PASS: 3475725513@400m guard === world-record
PASS: 3475725513@400m reason matches predicted EXACTLY
PASS: 3475725513@1k guard === ceiling
PASS: 3475725513@1k reason matches predicted EXACTLY

SUMMARY: 22 PASS / 0 FAIL
```

**Post-fix recount** (`--expect-demoted 65`), exit 0:
```
Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 65
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      31
  Pinned fixture 4556693525@400m: durationSec=45.2 guard="ceiling" durationMatches45_2=true guardIsCeiling=true
  --expect-demoted 65: MATCH

Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 31
  overCeilingWithoutDemotion (0): (none)

PASS: recount agrees with the shipped totals; no disagreements found.
```

**Predicted vs. observed** (all 7 rows match, no discrepancy):

| Figure | Predicted before regeneration | Observed |
|---|---|---|
| Ceiling-only total | 31 | 31 |
| World-record | 19 | 19 |
| Max-speed | 15 | 15 |
| Total demoted (`effortsDemoted`) | 65 | 65 |
| `independentCeilingCount` | 31 | 31 |
| Over-ceiling without demotion | 0 | 0 |
| Pinned fixture 4556693525@400m | guard `ceiling`, 45.2s, `guardIsCeiling=true` | guard `"ceiling"`, 45.2s, `guardIsCeiling=true` |

**Calibration verdict:** `git diff -U0 HEAD -- 28-CEILING-CALIBRATION.md | grep -E '^[+-][^+-]' | grep -vE 'Generated:|generatedAt:'` printed nothing — the regenerated file was kept, not restored.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `data/stats/best-efforts.json`, `28-DIFF.md` and `28-CEILING-CALIBRATION.md` are all regenerated from the fixed pipeline and reconciled against independently-predicted numbers. Plan 28-15 can now serve a digest-verified build over this regenerated document, run its Round 2 browser checkpoint rows against real, correctly-demoted activities, and obtain a fresh PR-04 sign-off bound to the new `28-DIFF.md` sha256 (`64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`).
- Full suite green (79 files / 2330 tests), `npx tsc --noEmit` clean, both post-regeneration recounts PASS.
- PR-03/PR-04/PR-05 remain reopened in `REQUIREMENTS.md` by design — this plan did not touch that file. Re-ticking is plan 28-15's job after its Round 2 checkpoint and re-verification.
- `origin/master` (9+ CI data commits ahead) remains un-merged by design — merge only after plan 28-15's checkpoint closes, per the sequential-execution instruction, and merge (never rebase) when it happens.

---
*Phase: 28-pr-plausibility-ceiling*
*Plan: 14*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/deferred-items.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-14-SUMMARY.md`
- FOUND commit: `658d247e` (Task 1)
- FOUND commit: `531f76fc` (Task 2)
- FOUND commit: `3ff9f591` (Task 3)
