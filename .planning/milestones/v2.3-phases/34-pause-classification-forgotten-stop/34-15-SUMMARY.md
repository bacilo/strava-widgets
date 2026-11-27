---
phase: 34-pause-classification-forgotten-stop
plan: 15
subsystem: analytics
tags: [pause-classification, forgotten-stop, d-22, union-merge, bugfix, disclosure, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "src/analytics/pause-classification.ts's findCreepStretches, STATIONARY_MAX_SPEED_MPS/WALK_RUN_BOUNDARY_MPS/FORGOTTEN_STOP_MIN_SEC/SHIPPED_STOP_PARAMS (plan 34-06); the Pauses summary row and section (plan 34-09); the drafted Manual-Only checkpoint rows R1-R9 (plan 34-10)"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-CONTEXT.md D-22 (2026-09-23): union semantics for covered-creep merging, retiring plan 34-06's stronger per-stretch-bounded claim"
provides:
  - "src/analytics/pause-classification.ts: findCreepStretches rewritten to D-22 union semantics — collect every individually-bounded qualifying window, then merge any two sharing at least one sample index, never consulting the growing union's own speed as a merge condition"
  - "src/analytics/pause-classification.test.ts: 'independent scan' describe block (oracle-vs-production equality, coverage-scope reconciliation, no-overlap, totals) on 6286234101 and 3475715143; 5 new D-22 semantics-clause unit tests in 'findCreepStretches'; the walking-break control block's retired DEFINITIONAL tripwire replaced by a CONSTITUENT-WINDOW PROPERTY test against the same oracle"
  - "src/dashboard/views/detail-sections.ts: pausesSummaryRow discloses pauseClassification.notClassifiableCount as a trailing '(N not-classifiable: isolated-jump/hidden-pause)' parenthetical when > 0"
  - "Regenerated data/dashboard/index.json and data/stats/pace-quality/*.json against the fix; 34-CALIBRATION.md regenerated (archive-wide covered-creep stretch count only: 363->300, still 82 activities; three shipped constants unchanged); archive-wide oracle reconciliation (82 activities, 69 full agreement, 13 explained by coverage-scope divergence, 0 unexplained)"
  - "34-VALIDATION.md: R7's quoted figures refreshed; dated re-check note correcting this plan's own drafted <recheck> prediction about R2; three Per-Task Verification Map rows added"
affects: [34-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent-oracle test comparison scoped by structural explanation rather than blind equality: when production is correctly MORE restrictive than an independent oracle (here, covered-run boundaries vs. the oracle's simpler raw-dt local-gap rule), the test partitions the oracle's own output into 'within one covered run' (must match production exactly) and 'crosses a boundary' (expected to have no production match, verified structurally rather than asserted blindly) — never loosened into a blanket subset check that could hide a real miss."
    - "Two-pass collect-then-merge union algorithm (collect every independently-qualifying window first, merge by index-overlap in a second pass) mirrors the independent oracle's own algorithm shape exactly, rather than the retired single-pass conditional-extend approach — the shared shape is what makes the window-for-window equality test possible in the first place."

key-files:
  created: []
  modified:
    - src/analytics/pause-classification.ts
    - src/analytics/pause-classification.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - .planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md
    - .planning/phases/34-pause-classification-forgotten-stop/34-VALIDATION.md
    - data/dashboard/index.json (gitignored, regenerated only)
    - data/stats/pace-quality/*.json (gitignored, regenerated only)

key-decisions:
  - "The independent-scan test's per-activity equality assertion was corrected mid-implementation from a blind array-length/order equality to a structural partition (oracle windows within one covered run vs. oracle windows crossing a covered-run boundary), after discovering 3475715143 has one oracle window (2672-2746) that bridges a genuine zero-advance pause boundary the oracle's own local-gap rule (blocks only on raw per-sample dt > 10s) does not recognise. This is the <oracle> section's own documented coverage-scope divergence, now also verified true on a NAMED activity, not only archive-wide — never closed by loosening a threshold, verified structurally (the unmatched oracle window is confirmed to cross a real covered-run boundary) rather than silently accepted."
  - "34-VALIDATION.md's own drafted <recheck> block predicted R2 (3475724402's Pauses summary row) would need re-verification because 'Task 2 adds the not-classifiable clause wherever notClassifiableCount > 0'. Verified against the regenerated data that 3475724402's notClassifiableCount is 0 both before and after this plan (it carries no covered-creep stretches and no not-classifiable intervals), so the clause never fires and the row text is byte-identical. Corrected in the dated re-check note rather than left uncorrected — the executor's own instruction to 'correct this list in the SUMMARY if reality differs' was followed."
  - "The archive-wide reconciliation script was written as a one-off Node probe (not committed) against the compiled dist/ output and the independent oracle, per Task 3's 'reported finding, never a test' framing — it partitions every production covered-creep stretch into 'oracle-matched' vs 'unmatched', then confirms every unmatched stretch's containing oracle window structurally crosses a covered-run boundary, rather than accepting disagreement counts without a structural check."

requirements-completed: []  # This plan ticks nothing — plan 34-11 (browser checkpoint) still owns every disposition, per the plan's own Requirement-tick safety instruction (requirements mark-complete and roadmap update-plan-progress were both deliberately NOT run).

# Metrics
duration: ~20min, single session, 2026-09-23
completed: 2026-09-23
---

# Phase 34 Plan 15: Fix Double-Counted Covered-Creep Stretches (D-22) Summary

**`findCreepStretches` rewritten to D-22 union semantics (collect every individually-bounded qualifying window, then merge by shared sample index, never consulting the union's own speed as a merge condition) — closing the double-count defect plan 34-11's checkpoint found (6286234101: three overlapping stretches, 171s, became two disjoint stretches, 133s); the Pauses summary row now discloses `notClassifiableCount`; archive regenerated and reconciled against the independent oracle (82 covered-creep-flagged activities, 69 full agreement, 13 explained by a coverage-scope divergence, 0 unexplained).**

## Performance

- **Duration:** ~20 min, single session, 2026-09-23 (commit span 09:02-09:16 local, plus pre-commit reading/investigation)
- **Tasks:** 3 of 3
- **Files modified:** 6 tracked (2 production, 2 test, 2 `.planning`) + 2 gitignored data trees regenerated

## Accomplishments

- **Task 1 — D-22 union-merge fix (`137c2556`'s successor):** Rewrote `findCreepStretches` to collect every window that independently satisfies `maxSpeedMps` first, then merge any two windows sharing at least one sample index (including sharing only the boundary sample) in a second pass — mirroring the independent oracle's (`localCreepWindows`) own two-pass shape exactly, so the two now agree window-for-window wherever coverage does not intervene. The merge step never consults the growing union's own aggregate speed; that speed is a disclosed OUTPUT of the returned interval (D-22), never a merge condition or a guarantee. RED watched first: reverting only the production fix reproduced the exact 6286234101 overlap (3 stretches vs. the oracle's 2) and a synthetic fixture built to reproduce the defect split into 5 overlapping rows instead of 1. 10 new tests in `findCreepStretches`/`independent scan` (5 D-22 semantics-clause unit tests: overlap, containment, boundary-sharing, disjoint, union-exceeds-bound; plus the oracle-comparison suite), and the walking-break control block's retired DEFINITIONAL tripwire (every RETURNED stretch stays within the bound — false under union semantics) replaced with a CONSTITUENT-WINDOW PROPERTY test against the same oracle. No defect figure (6286234101's window bounds, seconds, metres or speed) is pinned as a literal anywhere in the new tests.
- **Task 2 — `notClassifiableCount` disclosure:** `pausesSummaryRow`'s classification clause now appends `(N not-classifiable: isolated-jump/hidden-pause)` whenever `pauseClassification.notClassifiableCount` is a positive number; adds nothing when it is `0` (clean row stays clean) or `null` (CR-01 stale-row fallback — renders exactly as before this disclosure existed, never an invented zero). RED watched first (both new failures quoted below). The Pauses SECTION itself and the not-computable forgotten-stop clause (D-10) are unchanged.
- **Task 3 — regeneration, archive-wide reconciliation, and validation update:** Regenerated `data/dashboard/index.json` and every `data/stats/pace-quality/*.json` shard on the merged tree; `34-CALIBRATION.md` regenerated twice byte-identically (sha256 `e40aeaca...`) with its three shipped constants and provenance lines unchanged — the only diff is the archive-wide "Covered-creep flagged" finding (363 stretches → 300, still 82 activities). D-18 recount re-confirmed exit 0. Five upstream artifacts confirmed byte-identical. Wrote a one-off archive-wide reconciliation probe (see Decisions) comparing every activity's production covered-creep stretches against the independent oracle. Updated `34-VALIDATION.md`: refreshed R7's quoted figures, added a dated re-check note (correcting this plan's own drafted `<recheck>` prediction about R2), and added three Per-Task Verification Map rows. `status`/`nyquist_compliant` left untouched. Full gate green: `npm test` 3478/3478, `tsc --noEmit` clean, `build-widgets` clean, `verify-dashboard` 66/66, served digest equals the freshly built digest (`13a244ed...`).

## RED Evidence (quoted verbatim)

**Task 1, `findCreepStretches` (production reverted to pre-fix code, `-t "independent scan"` and `-t "findCreepStretches"`):**
```
FAIL independent scan > 6286234101: findCreepStretches' stretches equal localCreepWindows' windows...
AssertionError: expected 3 to be 2 // Object.is equality

FAIL independent scan > 3475715143: ... never pinned
AssertionError: expected 8 to be 5 // Object.is equality

FAIL findCreepStretches > D-22: a union whose OWN aggregate speed exceeds maxSpeedMps is still returned as ONE stretch...
AssertionError: expected 5 to be 1 // Object.is equality
```
6 of 8 new tests failed in this initial RED pass; restoring the fix turned all green.

**Task 2, `pausesSummaryRow` (production reverted, `-t "Pauses"`):**
```
FAIL Pauses summary row ... > notClassifiableCount > 0 ... discloses the count and mechanism label...
AssertionError: expected '5 intervals: 0 stationary, 5 walked, …' to contain '5 intervals: 0 stationary, 5 walked, … (5 not-classifiable: isolated-jump/hidden-pause)'
Received: "5 intervals: 0 stationary, 5 walked, 0 ran through, 0 transported · possible forgotten stop: none found"

FAIL Pauses summary row ... > the not-computable forgotten-stop clause (D-10) is unchanged...
AssertionError: expected '...' to contain '(5 not-classifiable: isolated-jump/hidden-pause)'
```

## Matched `-t` Filter Counts (Rule 1 — every filter checked non-zero)

- `pause-classification.test.ts -t "independent scan"` — 9 matched, passed
- `pause-classification.test.ts -t "walking-break control"` — 5 matched, passed
- `pause-classification.test.ts -t "findCreepStretches"` — 10 matched, passed
- `detail-sections.test.ts -t "Pauses"` — 15 matched, passed (up from 34-09's 11)

## Task Commits

1. **Task 1: D-22 union-merge fix, independent-scan tests, D-22 semantics-clause tests** - `a879e9c6` (fix)
2. **Task 2: notClassifiableCount disclosure in the Pauses summary row** - `bd6c37e9` (feat)
3. **Task 3: regeneration, archive-wide reconciliation, 34-VALIDATION.md update** - `cdb74792` (docs)

**Plan metadata:** (this commit, next) `docs(34-15): complete plan`

## Files Created/Modified

- `src/analytics/pause-classification.ts` — `findCreepStretches` rewritten (two-pass collect-then-merge, D-22 union semantics); docblock restates the constituent-vs-union property and names D-22, removing plan 34-06's retired stronger claim.
- `src/analytics/pause-classification.test.ts` — `independent scan` describe block (new); 5 new D-22 semantics-clause unit tests in `findCreepStretches`; the walking-break control block's DEFINITIONAL tripwire replaced with the CONSTITUENT-WINDOW PROPERTY test; `@ts-expect-error`-guarded import of the independent oracle (`localCreepWindows`).
- `src/dashboard/views/detail-sections.ts` — `pausesSummaryRow`'s classification clause gains the `notClassifiableCount` disclosure.
- `src/dashboard/views/detail-sections.test.ts` — 4 new tests under the "Pauses summary row" describe block covering all four `notClassifiableCount` states.
- `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` — regenerated (archive-wide finding count only).
- `.planning/phases/34-pause-classification-forgotten-stop/34-VALIDATION.md` — R7 refreshed, dated re-check note added, three Per-Task rows added.
- `data/dashboard/index.json`, `data/stats/pace-quality/*.json` (gitignored) — regenerated against the fix.

## Decisions Made

See `key-decisions` in the frontmatter above: (1) the independent-scan test's structural partition correction after discovering a real coverage-scope divergence on 3475715143 itself (not only archive-wide); (2) the R2 re-check correction; (3) the archive-wide reconciliation probe's design.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed. The one substantive adjustment (the independent-scan test's equality-vs-structural-partition redesign) is documented as a key-decision above rather than a deviation, since it corrects the TEST's own methodology to match the plan's own `<oracle>` scope note, not a change to plan-specified behavior or scope.

**Total deviations:** 0
**Impact on plan:** None — plan executed as specified, with the test-design refinement staying inside Task 1's own stated boundaries (the `<oracle>` section explicitly anticipates and requires exactly this kind of coverage-scope accounting).

## Required Report

### Before/After Table

| Activity | Metric | Before | After |
|---|---|---|---|
| 3475724402 | forgottenStop count/totalSec/longestSec | 0 / 0 / 0 | 0 / 0 / 0 (unaffected — no covered-creep) |
| 3475724402 | rendered Pauses-section row count | 18 | 18 (unaffected) |
| 6286234101 | forgottenStop count/totalSec/longestSec | 3 / 171 / 77 | **2 / 133 / 77** |
| 6286234101 | covered-creep entries | `5866-5915 (49s,21.7m)`, `5877-5922 (45s,19.7m)`, `6236-6313 (77s,26.7m)` | `5866-5922 (56s,35.6m)`, `6236-6313 (77s,26.7m)` |
| 6286234101 | rendered Pauses-section row count | 4 | 3 |
| 3475740390 | forgottenStop | not-computable (unaffected) | not-computable (unaffected) |
| 3475740390 | pauseClassification.notClassifiableCount | 5 (undisclosed) | 5 (**now disclosed** in the summary row) |
| 3475740390 | rendered Pauses-section row count | 5 | 5 (unaffected) |
| 3475715143 | forgottenStop count/totalSec/longestSec | 9 / 384 / 66 | **5 / 232 / 66** |
| 3475715143 | forgottenStop creepCount/creepTotalSec | 8 / 358 | **4 / 206** |
| 3475715143 | covered-creep entries | `1708-1750`, `2454-2520`, `2782-2828`, `3444-3496`, `3446-3488`, `3450-3492`, `3454-3494`, `3456-3496` (5 overlapping fragments in the 3444-3496 region) | `1708-1750`, `2454-2520`, `2782-2828`, **`3444-3496` (one union, 52s, 36.9m)** |
| 3475715143 | rendered Pauses-section row count | 9 | 5 |

`longestSec` is unchanged on both affected activities (77s and 66s respectively) — the double-counted fragments were never the longest stretch; only `count` and `totalSec` moved, exactly as STOP-01's amended text (count/totalSec/longestSec) predicted.

### 3475715143's first creep row confirmation

**Unchanged.** `pause-classification.test.ts`'s `independent scan` describe block pins this as a dedicated regression guard: production's first covered-creep stretch is `startSec 1708, endSec 1750, seconds 42, metres 21` — identical before and after this plan, and identical to the independent oracle's own first window. Directly re-confirmed via a live probe against the regenerated shard.

### Archive-wide reconciliation finding

Of the 82 activities with at least one production covered-creep stretch (unchanged from before the fix — only the per-activity stretch counts moved, never which activities are flagged):

- **69 activities** show full agreement with the independent oracle: every oracle window that sits fully inside a single covered run has an exact production match, and vice versa.
- **13 activities** show disagreement, comprising **31 production windows** with no exact oracle-array match. **Every one of these 31 is structurally explained**: each has a containing oracle window whose span bridges across at least one covered-run boundary (a `pause`, `recording-gap`, or `unreliable` segment) — the independent oracle's own rule blocks a window's construction only on raw per-sample `dt > 10s`, so it freely bridges through a boundary interval whose own internal sampling stays dense (which zero-advance `pause` intervals almost always are, since the device keeps recording through them), while production correctly NEVER crosses a covered-run boundary (D-09). This is exactly the coverage-scope divergence the plan's own `<oracle>` section anticipates ("the oracle scans the whole stream under its own local-gap rule; production is restricted to covered runs"), now confirmed archive-wide with a structural check rather than an assumption. **Zero unexplained disagreements** — no threshold was moved on either side to close any of these.
- **Zero misses**: no oracle window confined to a single covered run was ever absent from production's output, on any of the 1,874 streams scanned.

### Which checkpoint rows (R1-R9) actually moved

**Must be re-checked by plan 34-11's human:**
- **R4** — 3475740390's Pauses summary row TEXT changed (gains the `notClassifiableCount` disclosure parenthetical).
- **R7** — its quoted evidence figure changed (`totalSec=384, count=9` → `totalSec=232, count=5` for 3475715143); the row's own CLAIM ("no badge appears") is unaffected.

**Corrected — this plan's own drafted `<recheck>` predicted R2 would move; verified it does NOT:**
- **R2** — 3475724402's row is byte-identical before and after (its `notClassifiableCount` is `0` both times, so Task 2's clause never fires).

**Confirmed provably unaffected (re-quote only, do not re-judge):**
- **R1**, **R3**, **R5**, **R6**, **R8** — all confirmed unaffected against the regenerated data (see the dated re-check note in `34-VALIDATION.md` for the per-row confirmation).
- **R9** — re-run (required, since the build changed): served digest, `dist/widgets/` copy and `data/dashboard/index.json` all equal a NEW digest `13a244ed...` (the VALUE was never pinned, only the equality claim); the claim still holds.

## Issues Encountered

The independent-scan test's initial design (blind array-length/order equality between production and the oracle) failed on 3475715143 even AFTER the production fix was correct: production found 4 stretches, the oracle found 5. Investigated rather than loosening the assertion or tuning a threshold — traced the extra oracle window (2672-2746) to a genuine 26-second zero-advance `pause` interval (2700-2726) that sits between two covered runs, densely sampled (dt=2s throughout) so the oracle's own `dt > 10s` blocking rule never fires there, while production correctly treats the `pause` as a covered-run boundary it never crosses. Redesigned the test to partition the oracle's own output by whether each window sits inside one covered run (must match production exactly) versus crosses a boundary (verified structurally, never silently accepted) — then confirmed the SAME structural cause explains all 13 archive-wide disagreement activities via the reconciliation probe.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None beyond the plan's own `<threat_model>` (T-34-41..T-34-46), all mitigated as specified: D-22 union semantics written down before the code, with a no-overlap assertion on both named activities and a defect-reproducing synthetic fixture (T-34-41); every independent-scan expected value parsed from the oracle at test time, no defect figure pinned, watched RED first (T-34-42); the archive-wide reconciliation's every disagreement carries a structural reason, none tuned away, with a stronger per-activity structural check than a bare threshold (T-34-43); the not-classifiable disclosure states count and reason with the CR-01 null case preserved (T-34-44); the before/after table plus the dated, corrected re-check note (T-34-45); the three shipped constants and their provenance lines confirmed unchanged, generator still exits 0 (T-34-46).

## Next Phase Readiness

- Plan 34-11's browser checkpoint can now re-run against a served build whose digest (`13a244ed...`) is confirmed equal to the freshly built and freshly regenerated data — only R4 and R7 need fresh human eyes; R1/R3/R5/R6/R8/R9 keep their prior verdicts (R2 also keeps its prior verdict, contrary to this plan's own initial prediction).
- `data/streams/` and `data/stream-checksums.json` are untouched throughout; `32-CALIBRATION.md`/`33-CALIBRATION.md`/`33-COVERAGE-IDENTITY.md` remain byte-identical.
- This plan ticks nothing — STOP-01, PAUSE-01 and PAUSE-02's dispositions remain plan 34-11's job.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `src/analytics/pause-classification.ts`
- FOUND: `src/analytics/pause-classification.test.ts`
- FOUND: `src/dashboard/views/detail-sections.ts`
- FOUND: `src/dashboard/views/detail-sections.test.ts`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-VALIDATION.md`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-15-SUMMARY.md` (this file)
- FOUND commits: `a879e9c6`, `bd6c37e9`, `cdb74792`
