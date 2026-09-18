---
phase: 30-elevation-quality-signal
plan: 06
subsystem: ui
tags: [typescript, vitest, detail-view, quality-signals, altitude]

# Dependency graph
requires:
  - phase: 30-elevation-quality-signal
    provides: "30-01's ElevationSignal/SubGroundSignal/ClosureDriftSignal/VerticalRateSignal types and elevationSignal(stream, metadata) assembly; 30-03's parseElevationSignal client parse and PaceQualityShard's elevationVerticalRateSamples/elevationLoopRadiusM/elevationStartEndDistM evidence fields"
provides:
  - "subGroundRow, closureDriftRow, verticalRateRow — three always-on detail-view rows in decimationRow's exact shape (D-11)"
  - "Three standalone elevation explanation constants (SUB_GROUND_EXPLANATION, CLOSURE_DRIFT_EXPLANATION, VERTICAL_RATE_EXPLANATION), deliberately not routed through tieringExplanation"
  - "qualitySignalsSectionPlan/notAvailableRows both return eight rows (was five); buildQualitySignalsSection's render loop untouched"
  - "14 elevation-rows tests covering every branch the three builders can take, including three pinned-real-activity read-backs against the committed shard"
affects: [30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "closureDriftRow reads ClosureDriftSignal.state as authoritative (never gated on the whole-signal notComputableReason) — an activity with a usable stream but no position renders healthy sub-ground/vertical-rate lines beside a position-unknown drift line, per D-02"
    - "subGroundRow/verticalRateRow take the whole-signal notComputableReason directly (not gated through elevation.tier === 'not-computable') since the two are provably equivalent: notComputableSignals() sets both together and elevationSignal() is never called on that cohort"
    - "closureDriftRow's evidenceText (loop radius) is independent of signal.state — shown whenever a shard is present, since the radius describes the detection method, not the outcome; subGroundRow's evidenceText is always null (no shard evidence field exists for sub-ground)"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "Fixed five pre-existing tests (Rule 3 blocking fix) that hardcoded plan.rows.toHaveLength(5) and plan.rows[3]/plan.rows[4] index assumptions for deviceEra/elapsedVsMoving — inserting the three elevation rows before deviceEraRow shifted those two rows to index 6/7. Committed in the same commit as Task 1's row-builder addition, since it is a direct, mechanical consequence of that change (not in Task 1's declared files_modified, but the plan's own acceptance criteria require npm test to exit 0)."
  - "closureDriftRow uses four distinct value-text templates (not-computable / excluded-not-a-loop / clear-in-a-loop / flagged) rather than reusing one template with a state-name prefix, so the four strings read as genuinely different sentences a screen reader user or checkpoint reviewer cannot mistake for variations of the same claim."
  - "subGroundRow's evidenceText is unconditionally null — the shard carries no sub-ground-specific evidence field (only elevationVerticalRateSamples/elevationLoopRadiusM/elevationStartEndDistM exist), so there is nothing beyond minAltM (already in valueText) to show."

requirements-completed: [ELEV-01]

# Metrics
duration: ~15min
completed: 2026-09-18
---

# Phase 30 Plan 06: Three Always-On Elevation Detail Rows Summary

**The detail view's Quality Signals section grew from five rows to eight — `subGroundRow`, `closureDriftRow`, `verticalRateRow` — with the drift line reading all four of the detector's distinguishable states in words, never a fabricated zero on a stream-less activity, and 14 new tests (including three pinned-real-activity read-backs against the committed shard) covering every branch.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-18T16:28:00+02:00 (approx., worktree setup)
- **Completed:** 2026-09-18T16:37:23+02:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `subGroundRow`, `closureDriftRow`, `verticalRateRow` in `decimationRow`'s exact shape (not-computable branch first, then healthy/tiered `valueText`, then shard-derived `evidenceText`), appended to `qualitySignalsSectionPlan`'s returned array between the three tiering rows and `deviceEraRow` — the section is now eight rows, `buildQualitySignalsSection`'s render loop byte-unchanged
- `closureDriftRow` reads all FOUR of `ClosureDriftSignal.state`'s distinguishable outcomes in words: flagged (`start and end altitudes differ by 198 m on a loop whose endpoints are 0 m apart`), clear-in-a-loop (`start/end altitude differ by 4 m (loop, 38 m apart)` — D-11's own example phrasing, reproduced exactly), excluded-not-a-loop (`start/end position measured 9600 m apart — not a loop, so drift was not checked`), and position-unknown (`start/end position unknown — drift not checked`) — never falling back to a raw delta on the two no-delta branches
- Three standalone module-level explanation constants (`SUB_GROUND_EXPLANATION`, `CLOSURE_DRIFT_EXPLANATION`, `VERTICAL_RATE_EXPLANATION`) beside `DEVICE_ERA_EXPLANATION`/`ELAPSED_VS_MOVING_EXPLANATION`, deliberately NOT routed through `tieringExplanation` (D-10's one rolled-up list badge across three elevation modes has no 1:1 probe-spec counterpart) — the module-load assertion loop still lists exactly `decimation`/`gapProfile`/`impossibleSamples`
- `notAvailableRows()` extended to eight entries in D-11's order, same literal shape the existing five use
- 14 new tests under `describe('elevation rows — subGroundRow / closureDriftRow / verticalRateRow (D-02, D-11)', ...)`: healthy, sub-ground flagged, drift flagged/clear/excluded/position-unknown, vertical-rate flagged, whole-signal not-computable (no fabricated `0 m`/`0 m/s`), `quality === null`, shard null vs. present evidence degradation, plus three pinned-real-activity tests reading a row plan straight from the committed `data/stats/pace-quality/*.json` shard
- Demonstrated (not merely asserted) that collapsing the drift-excluded and drift-position-unknown states into one phrasing fails a real test — verbatim output recorded below
- Whole tree green: `npx tsc --noEmit` exits 0; `detail-sections.test.ts` 132/132 passing (was 119 before this plan — net +13 new tests, since 5 pre-existing tests were edited in place for the index shift, not added)

## Task Commits

1. **Task 1: Three always-on elevation rows with the drift line's four phrasings** - `e1431a81` (feat)
2. **Task 2: Prove every phrasing renderable, including the ones that are easy to never reach** - `e4697854` (test)

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` — `ClosureDriftSignal`/`SubGroundSignal`/`VerticalRateSignal` type imports; `SUB_GROUND_EXPLANATION`/`CLOSURE_DRIFT_EXPLANATION`/`VERTICAL_RATE_EXPLANATION`; `subGroundRow`/`closureDriftRow`/`verticalRateRow`; `qualitySignalsSectionPlan`'s rows array extended to eight; `notAvailableRows()` extended to eight entries; doc-comment updates ("five rows" → "eight rows") on `QualitySignalsSectionPlan`, `notAvailableRows`, `qualitySignalsSectionPlan`'s own docstring
- `src/dashboard/views/detail-sections.test.ts` — `loadShard()` helper (mirrors `loadStream()`); five pre-existing tests corrected for the row-index shift (`toHaveLength(5)` → `toHaveLength(8)` ×2, `rows[3]`/`rows[4]` → `rows[6]`/`rows[7]` ×5); new `describe('elevation rows ...')` block with 14 tests including a nested `describe('pinned real activities ...')` with the three 30-03-pinned exemplars

## Decisions Made

- `closureDriftRow` takes only `(signal, shard)` — no `notComputableReason` parameter — since D-02 requires the drift line's own `state` to be authoritative: an activity with a usable stream but no start/end position must show healthy sub-ground/vertical-rate lines beside a position-unknown drift line, which a reason-gated implementation could not express.
- `subGroundRow`/`verticalRateRow` take the WHOLE-SIGNAL `notComputableReason` (`quality.notComputableReason`) directly rather than gating through `quality.elevation.tier === 'not-computable'` (as `30-PATTERNS.md`'s snippet showed) — the two are provably equivalent, since `notComputableSignals()` (the sole constructor for the whole-signal-not-computable cohort) sets both fields together and `elevationSignal()` — the only place `elevation.tier` becomes anything else — is never invoked on that cohort. Using the reason directly reads more plainly and mirrors the three existing tiering rows' own parameter shape exactly.
- Five pre-existing tests that hardcoded `plan.rows.toHaveLength(5)` / `plan.rows[3]` / `plan.rows[4]` (deviceEra/elapsedVsMoving) were corrected in Task 1's own commit, not deferred to Task 2 — they are a direct, mechanical consequence of inserting three rows before `deviceEraRow`, and the plan's own acceptance criteria require `npm test` to exit 0 after Task 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated five pre-existing tests broken by the row-index shift**
- **Found during:** Task 1 (`npx vitest run src/dashboard/views/detail-sections.test.ts` after landing the three new rows)
- **Issue:** Five tests in the existing `qualitySignalsSectionPlan` describe block hardcoded `plan.rows.toHaveLength(5)` (×2) and `plan.rows[3]`/`plan.rows[4]` to read the `deviceEra`/`elapsedVsMoving` rows — both broke once the three elevation rows were inserted between the three tiering rows and `deviceEraRow`, shifting those two rows to indices 6 and 7.
- **Fix:** Updated the two `toHaveLength` assertions to `8` and all five index references from `[3]`/`[4]` to `[6]`/`[7]`. No assertion content changed — only the row's position in the array.
- **Files modified:** `src/dashboard/views/detail-sections.test.ts`
- **Verification:** `npx vitest run src/dashboard/views/detail-sections.test.ts` — 119/119 pass (Task 1 baseline before Task 2's new tests were added).
- **Committed in:** `e1431a81` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, required for a genuinely green tree)
**Impact on plan:** No scope creep — the fix is a direct, mechanical consequence of the row insertion Task 1 explicitly required, touching only index literals and count literals, never assertion content.

## Verbatim Evidence: T-30-25 Drift-Collapse Guard Demonstrated Failing (Task 2 acceptance criterion)

Per the plan's explicit instruction, `closureDriftRow`'s position-unknown branch was temporarily changed to return the SAME string as its excluded-not-a-loop branch, the distinguishing test was run, then the change was reverted and the full suite re-run.

**Mutation applied** (`closureDriftRow`'s `state === 'not-computable'` branch):
```diff
- valueText = 'start/end position unknown — drift not checked';
+ valueText = 'start/end position measured 9600 m apart — not a loop, so drift was not checked';
```

**Failing run — exact output:**
```
FAIL  src/dashboard/views/detail-sections.test.ts > elevation rows — subGroundRow / closureDriftRow / verticalRateRow (D-02, D-11) > drift position unknown: the row says position is unknown in words, contains no distance and no delta, and is distinguishable from the excluded case by its text
AssertionError: expected 'start/end position measured 9600 m ap…' to be 'start/end position unknown — drift no…' // Object.is equality

Expected: "start/end position unknown — drift not checked"
Received: "start/end position measured 9600 m apart — not a loop, so drift was not checked"

 ❯ src/dashboard/views/detail-sections.test.ts:830:36

 Test Files  1 failed (1)
      Tests  1 failed | 131 skipped (132)
```

**Restored** — `git diff` against the Task 1 commit for `detail-sections.ts` shows zero lines changed after reverting; `npx vitest run src/dashboard/views/detail-sections.test.ts` returns 132/132 passing.

## Three Pinned-Real-Activity Expected Strings (for plan 30-08's checkpoint)

Read back from `qualitySignalsSectionPlan(shard.signals, shard)` where `shard` is `data/stats/pace-quality/{id}.json` parsed verbatim (no fixture, no mock) — recorded here so the checkpoint compares the rendered page against a value derived independently of the render path, not against the page agreeing with itself.

**`4556693525`** (severe, sub-ground exemplar) — source: `data/stats/pace-quality/4556693525.json` (`subGround.minAltM: -282`, `closureDrift.deltaM: -5.600000000000023, startEndDistM: 0`, `verticalRate.worstRateMps: 3.3000000000000114`):
```
lowest altitude -282 m — below plausible ground level
start/end altitude differ by 6 m (loop, 0 m apart)
max vertical rate 3.3 m/s
```

**`17257505831`** (healthy exemplar) — source: `data/stats/pace-quality/17257505831.json` (`subGround.minAltM: 7.800000000000011`, `closureDrift.deltaM: 2.3999999999999773, startEndDistM: 0`, `verticalRate.worstRateMps: 1.3999999999999773`):
```
lowest altitude 8 m
start/end altitude differ by 2 m (loop, 0 m apart)
max vertical rate 1.4 m/s
```

**`i184264408`** (drift not-computable, position-unknown exemplar) — source: `data/stats/pace-quality/i184264408.json` (`subGround.minAltM: -1`, `closureDrift.state: 'not-computable'`, `verticalRate.worstRateMps: 1.200000000000001`):
```
lowest altitude -1 m
start/end position unknown — drift not checked
max vertical rate 1.2 m/s
```

All three read from the same `qualitySignalsSectionPlan` code path `buildQualitySignalsSection` (the actual DOM emitter, exercised only by the human browser checkpoint per this file's own header convention — there is no DOM-simulation library in this tree) will call in production.

## Issues Encountered

None beyond the pre-existing-test index-shift deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The detail view's Quality Signals section is fully wired for elevation: eight rows, all four drift phrasings distinguishable, and no fabricated zero on a stream-less activity.
- Plan 30-08's human browser checkpoint can read `4556693525`'s three lines back against the values recorded above (and against `data/stats/pace-quality/4556693525.json` directly) — the worked-example activity used everywhere else in this milestone.
- This plan touched only `src/dashboard/views/detail-sections.ts` and its test file — no overlap with plan 30-05 (`list.ts`/`list.test.ts`/`detail.ts`, the row badge and stat-card caveat) or plan 30-07 (`scripts/compute-elevation-recount*.mjs`/`package.json`), both running in the same wave.
- No blockers for downstream plans.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*

## Self-Check: PASSED

Both files listed under Files Created/Modified verified present on disk
(`src/dashboard/views/detail-sections.ts`, `src/dashboard/views/detail-sections.test.ts`).
Both task commit hashes (`e1431a81`, `e4697854`) verified present in `git log --oneline --all`.
