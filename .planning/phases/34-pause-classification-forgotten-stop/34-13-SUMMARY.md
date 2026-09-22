---
phase: 34-pause-classification-forgotten-stop
plan: 13
subsystem: analytics
tags: [calibration, d20, pause-classification, forgotten-stop, gap-closure, vitest, provenance, tdd]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "scripts/compute-pause-classification-calibration.mjs (PREDECLARED_SHAPES G4/G5, standstill episodes, proportional planting) from plan 34-12"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-06-HALT-2.md's diagnosis: G4/G5 measured base 0.029873 m/s over n=6, both D-13 axes fail — the second independent Family G population that could not clear"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-CONTEXT.md D-20 (2026-09-22): the developer decision declaring STATIONARY_MAX_SPEED_MPS at 0.5 m/s and retiring Family G's arbitration for this one constant"
provides:
  - "scripts/compute-pause-classification-calibration.mjs: DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT/DECLARED_STATIONARY_MAX_SPEED_MPS/STATIONARY_PROVENANCE_TEXT constants with a module-load round-trip assert; runFamily's `arbitrate` option (default true, false for Family G only); mwFloorFromDeclared presence/finiteness gate; runCalibration wired to ship the declared value (never ceilToSignificant on a G row) as the M/W floor; the D-20 basis gate in applyGates; decideOutcome's passing-strawman-G branch; the rewritten driftSection (carries G4/G5 measured bases) and renderDrift (MEASURED NON-ISSUE disposition, prose-only bound, definitional caveat); Chosen-constants provenance lines; the NOT ARBITRATED (D-20) Family G render block"
  - "scripts/compute-pause-classification-calibration.test.mjs: 'declared constant', 'drift non-issue', 'evidence only' and 'provenance chain' describe blocks (27 new tests), D-20 basis-gate and exit-contract additions, and the two pre-existing tests whose premise D-20 retires (the shippedG-gated drift line; 'a G HALT blocks M/W') rewritten to the new behaviour — 122 tests total, up from 34-12's 95"
affects: [34-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evidence-only family pattern: runFamily(familyId, views, { arbitrate: false }) evaluates every row exactly like an arbitrated family but never calls selectShape — selectedId/chosen stay null and `arbitrated: false` is returned, so a family can measure and render without ever being able to select or influence a constant. Family G is the only caller of this; M and W keep `arbitrate` at its default `true`."
    - "Provenance line convention: every Chosen-constants value line gains a sibling `<NAME> provenance: <text>` line in the same section — `developer-declared (D-20), not calibrated` for the declared constant, `calibrated (<family> family, <winning shape id>)` for M and W. The value regex stays anchored on `<NAME> = ` so a provenance line can never be mistaken for a value line."
    - "Presence/finiteness gate as an exported pure function (mwFloorFromDeclared) rather than an inline null check: lets a test exercise the 'declared constant absent or non-finite' branch directly with an injected NaN/undefined/null, since the real module-level DECLARED_STATIONARY_MAX_SPEED_MPS is always a real, finite 0.5 and cannot itself be made absent at runtime."
    - "Provenance-chain binding tests write to REAL repo files transiently (34-CONTEXT.md and the generator itself), watch the seeded break, then `git checkout --` the single file in a finally block — never a blanket reset, never left dirty, never committed. A live cache-busted dynamic import (`import(path + '?seed=' + Date.now())`) re-reads the on-disk edit within the same vitest process without a subprocess."

key-files:
  created: []
  modified:
    - scripts/compute-pause-classification-calibration.mjs
    - scripts/compute-pause-classification-calibration.test.mjs

key-decisions:
  - "Task 1's module-load assert (`String(DECLARED_STATIONARY_MAX_SPEED_MPS) === DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT`) was kept exactly as originally written — NOT weakened for Task 3's convenience. S3's seeded edit (a renderer that emits String(number) instead of source text) needs a source-text value with a trailing zero to be demonstrable, which the strict assert would reject at import time; resolved by making S3's transient copy remove that one assert line ONLY in the on-disk edit that gets `git checkout --`-reverted at the end of the test, never touching the assert's permanent, committed form. This keeps Task 3's `<files>` scope (test file only) honest — the generator file is byte-identical to its Task 2 commit both before and after the full test run."
  - "The D-20 basis gate compares against `shipped.STATIONARY_MAX_SPEED_MPS` (the value threaded through applyGates), not the module-level `DECLARED_STATIONARY_MAX_SPEED_MPS` constant directly — consistent with how the pre-existing order/D-12 gates already read `shipped`, and it lets the gate be tested with injected shipped values independent of the real module constant."
  - "M/W provenance line format `calibrated (<family> family, <winning shape id>)` was not specified verbatim by the plan beyond 'names the winning shape id' — chosen to read naturally beside the stationary line's `developer-declared (D-20), not calibrated` and to keep the word 'calibrated' scoped correctly (never bare, always inside a longer phrase, for M/W)."
  - "renderDrift's prose refers to the declared bound in general terms ('the Chosen constants section when every family clears') rather than literally embedding the string '## Chosen constants' — an early draft did embed that heading text in prose, which made the substring '## Chosen constants' appear inside the HALT fixture's rendered Markdown even though the actual section never renders there, breaking the 'HALT fixture has no such section' assertion. Caught by the very RED-first test it was meant to satisfy."

patterns-established:
  - "Pattern: an evidence-only family (arbitrate: false) is exercised with the SAME evalEntry/plantShapes/removeNeighbourhoods machinery as an arbitrated family — the only difference is whether `selectShape` is reached. This keeps G4/G5's rows byte-identical whether or not arbitration is on, proven directly by an equality assertion between an `arbitrate: true` and an `arbitrate: false` run on the same views."

requirements-completed: []  # this plan ticks nothing — PAUSE-01/STOP-02's disposition is plan 34-11's job, per this plan's own Requirement-tick safety note; requirements mark-complete and roadmap update-plan-progress were both skipped as instructed

# Metrics
duration: single session, 2026-09-22 (~25 min across 3 task commits, 21:07-21:21 local)
completed: 2026-09-22
---

# Phase 34 Plan 13: D-20 Gap Closure — Declared Stationary Constant, Drift Non-Issue, Family G Evidence-Only Summary

**Family G stops arbitrating: STATIONARY_MAX_SPEED_MPS ships as the developer-declared 0.5 m/s (source text, honest provenance, a three-way character-level binding test), drift-while-stationary renders as a MEASURED NON-ISSUE with G4/G5 kept as live evidence, and M/W keep their own D-06/D-08/D-13 calibration unchanged on that declared floor — proven with 27 new synthetic-fixture tests (122 total) and RED evidence quoted from three independent seeded breaks of the provenance chain.**

## Performance

- **Duration:** single session (~25 min across the three task commits, 21:07-21:21 local time)
- **Tasks:** 3 of 3
- **Files modified:** 2 (both existing: the generator script and its test file)

## Accomplishments

- **Task 1 — Declared constant, provenance rendering, drift non-issue section:** Added `DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT` ('0.5'), its parsed numeric sibling with a module-load round-trip assert, and `STATIONARY_PROVENANCE_TEXT`. `renderCalibrationMarkdown`'s Chosen-constants block now ships the declared source text verbatim (never `String(number)`) with a sibling provenance line; M and W gained their own provenance lines naming the winning shape id. `driftSection` now also carries G4's and G5's measured bases (computed live from the views via `shapeG4`/`shapeG5`, never hardcoded); `renderDrift` was rewritten to state the D-20 MEASURED NON-ISSUE disposition, the declared bound in prose, and the definitional single-pause caveat, unconditionally — the old `shippedG`-gated "Drift matters" / "No chained episode exists" branch is retired. Two new describe blocks ("declared constant": 3 of 6 tests genuinely RED before the fix — module-load exports and the clear-fixture render assertion; "drift non-issue": all 3 RED, since `driftSection` didn't carry g4Base/g5Base and the disposition text didn't exist) watched RED first, then GREEN.
- **Task 2 — Family G evidence-only, M/W on the declared floor, D-20 basis gate:** `runFamily` gained an `arbitrate` option (default `true`; `false` for Family G only) — strawman G, G4 and G5 are still evaluated and rendered, but `selectShape` is never reached (`arbitrated: false`, `selectedId`/`chosen` always null). `runCalibration` now ships the declared value (via the new `mwFloorFromDeclared` presence/finiteness gate) as the M/W floor and never calls `ceilToSignificant` on a G row; M and W keep their own shapes, tolerance, strawman-first and first-clearing arbitration and HALT branch unchanged. `applyGates` gained the D-20 basis gate (declared value must exceed G4's measured base when non-null; PASSES with a stated reason on a null base; a failure HALTs, never retunes). `decideOutcome` now also exits 1 when strawman G passes. The Shape-arbitration render block states Family G is `NOT ARBITRATED (D-20)` while still rendering every row and verdict. New "evidence only" describe block (7 tests, all RED before the fix — `arbitrate` option didn't exist) plus D-20 basis-gate tests (both PASS branches and the FAIL/HALT branch) and exit-contract additions. Two pre-existing tests whose premise D-20 retires — "rounding: G ... via ceilToSignificant" and "a G HALT makes M and W render not computed" — were rewritten to the new behaviour (both watched RED against the post-Task-1, pre-Task-2 code, then GREEN). 34-12's untouched 24-cell reachability matrix still passes unmodified, proving G4/G5/M1/M2/W1/W2's own mechanics are byte-for-byte unchanged.
- **Task 3 — Provenance chain watched RED from three sides:** New "provenance chain" describe block reads 34-CONTEXT.md's D-20 `DECLARED STATIONARY_MAX_SPEED_MPS = 0.5` line, the generator's own source text, and a rendered clear-fixture's Chosen-constants line, and asserts all three agree character-for-character. Three seeded edits, each writing to a REAL repo file, watched failing, then reverted via `git checkout --` in a `finally` block (never committed, never left dirty) — RED evidence quoted below. Full generator test file (122 tests) and `npm test` (3326 tests, up from 34-12's 3299 baseline) are green throughout. `main()` was never invoked; no real stream is read (`grep -c "data/streams"` on the test file is 0); `34-CALIBRATION.md` and `34-CONTEXT.md` are byte-identical to HEAD.

## RED Evidence (quoted verbatim from actual test runs)

**Task 1** — before the fix, `-t "declared constant"` and `-t "drift non-issue"` against the unmodified (post-34-12) generator:
- `DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT is the D-20 source text...` — `expected undefined to be '0.5'` (the export didn't exist).
- `a clear fixture renders the line-anchored declared value...` — `expected [markdown] to match /^STATIONARY_MAX_SPEED_MPS = 0\.5$/m` failed (the rendered line was still G4's raw `0.131`).
- `driftSection(views) carries G4 and G5 measured bases...` — `expected undefined to be close to 0.06521739130434782` (`drift.g4Base` didn't exist).
- `the rendered ## Drift-while-stationary section states the MEASURED NON-ISSUE disposition...` — `expected '...Drift-matters not yet determined...' to contain 'MEASURED NON-ISSUE'`.

**Task 2** — before the fix, `-t "evidence only"`:
- `runFamily('G', views, { arbitrate: false }) evaluates...` — `expected undefined to be false` (`family.arbitrated` didn't exist; `runFamily` had no `arbitrate` option, so G always selected a chosen shape when one passed).

Two pre-existing tests, watched RED against the code as it stood immediately after Task 1 (before Task 2's `runCalibration`/`runFamily` rewrite):
- `rounding: STATIONARY_MAX_SPEED_MPS ships the DECLARED value...` — `expected 0.131... to be 0.5` (still G4-derived).
- `Family G never halts the pipeline...` — `expected null not to be null` (M/W were still null on `buildHaltArchive()`, since G's old `gHalted` gate still blocked them).

**Task 3** — the seeded provenance-chain breaks (actual console output from the test run, quoted verbatim):
```
RED (S1, 34-CONTEXT.md DECLARED line edited to 0.7): generator source text ('0.5') !== 34-CONTEXT.md DECLARED line ('0.7')
RED (S2, generator DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT edited to '0.6'): generator source text ('0.6') !== 34-CONTEXT.md DECLARED line ('0.5')
RED (S3, renderer switched to String(number) on source text '0.50'): rendered artifact line ('0.5') !== generator source text ('0.50') — a String(number) renderer silently drops the trailing zero
```
After each seed, `git diff --exit-code` on the single edited file was clean and the value re-read as the original (`0.5` / `0.5` / `0.5`).

## Task Commits

1. **Task 1: Declared constant, provenance rendering, drift non-issue section** - `e67bd7d9` (feat)
2. **Task 2: Family G evidence-only, M/W on the declared floor, D-20 basis gate** - `c3a71acf` (feat)
3. **Task 3: Provenance chain watched RED from three sides, full suite green** - `9d7bbe75` (test)

**Plan metadata:** (this commit) `docs(34-13): complete plan`

## Files Created/Modified

- `scripts/compute-pause-classification-calibration.mjs` - `DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT`/`_MPS`/`STATIONARY_PROVENANCE_TEXT`; `runFamily`'s `arbitrate` option; `mwFloorFromDeclared`; `runCalibration` rewired to the declared floor; the D-20 basis gate in `applyGates`; `decideOutcome`'s strawman-G-passed branch; the rewritten `driftSection`/`renderDrift`; Chosen-constants provenance lines; the NOT ARBITRATED (D-20) Family G render block. **Byte-identical to its Task 2 commit at the end of Task 3** (Task 3 touches only the test file, per the plan's own file list).
- `scripts/compute-pause-classification-calibration.test.mjs` - "declared constant" (11 matched via substring), "drift non-issue" (4), "evidence only" (7), "provenance chain" (4) describe blocks; D-20 basis-gate tests inside "gates"; exit-contract additions; two pre-existing tests rewritten to the D-20 behaviour. 122 tests total (up from 34-12's 95).

## Decisions Made

- **D-20 enacted exactly as declared in 34-CONTEXT.md** — the source text `'0.5'` is the ONE literal this plan ships; no HALT-2 measured figure (684, 678, 6, 0.029873, 0.0087...) appears anywhere in the generator or its tests (`grep -c` verified 0 throughout every task).
- **Task 1's module-load round-trip assert was kept exactly as written, not weakened** — see key-decisions above. Task 3's S3 seed removes that one line only inside its own transient, `git checkout --`-reverted copy of the generator file, never touching the committed form.
- **The D-20 basis gate reads `shipped.STATIONARY_MAX_SPEED_MPS`, not the module constant directly** — keeps it testable and consistent with every other gate's own convention.
- **Production's end of the provenance chain (`pause-classification.ts` against the artifact) is deliberately NOT implemented here** — the constant does not exist in `src/` until plan 34-06's third run ships it (plan 34-06 Task 2's ship-from-artifact guard, per 33-14's precedent). This plan's chain test binds 34-CONTEXT.md, the generator and the rendered artifact only, exactly as scoped.

## Deviations from Plan

None — plan executed exactly as written, including its own explicit RED-first requirement for every new describe block. Two pre-existing tests whose premise the plan's own D-20 behaviour retires ("a G HALT makes M and W render not computed"; "rounding: G ... via ceilToSignificant") were rewritten within Task 1/Task 2's stated `files_modified` scope — this is required maintenance of the plan's own rendering/arbitration changes on files already listed for those tasks, not unplanned scope creep, and each rewrite was itself watched RED against the intermediate (pre-fix) code before being made to pass.

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- An early draft of `renderDrift`'s disposition prose literally embedded the string `` `## Chosen constants` `` as a cross-reference, which made that substring appear in the rendered Markdown even on the HALT fixture (where the section itself never renders) — caught immediately by the "declared constant" describe block's own RED-first run (`no line matching ^STATIONARY_MAX_SPEED_MPS = ... the HALT fixture renders neither the section nor the line` failed on `not.toContain('## Chosen constants')`). Fixed by rephrasing the prose to avoid the literal heading string; re-verified GREEN before proceeding.
- Constructing Task 3's S3 seed (a renderer that would emit `String(number)` instead of source text) required the source text to actually have a trailing zero to be demonstrable — but the real declared value `'0.5'` round-trips cleanly through `Number()`/`String()`, so a straight single-line renderer edit alone produced no observable difference. Resolved by combining the seed into three coordinated, transient edits to the same on-disk file (source text gains a trailing zero, the round-trip assert is removed for that copy only, the render call site switches to numeric interpolation), executed via a cache-busted dynamic `import()` within the same vitest process (verified feasible with a throwaway probe test before committing to the approach), then reverted as a single `git checkout --`.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan touches only a calibration generator and its own tests; no UI, no dashboard data path, no hardcoded empty/placeholder values reaching any rendered surface.

## Next Phase Readiness

- **D-20 is fully implemented and tested.** `STATIONARY_MAX_SPEED_MPS` ships as the developer-declared `0.5` with honest, tested provenance; Family G measures and renders G4/G5 as evidence without arbitrating; M and W calibrate unchanged on the declared floor; the D-20 basis gate guards the declaration against future drift measurements. `main()` was never run in this plan; `34-CALIBRATION.md` is still HALT-2's committed artifact (byte-identical to HEAD); `data/streams` is untouched.
- **Plan 34-06 can run a third time.** It will now: measure Family G's rows as evidence (no longer needing G4/G5 to clear D-13), ship `STATIONARY_MAX_SPEED_MPS = 0.5` from the declaration, and let M and W calibrate on that floor for the first time against the real archive — the D-20 basis gate will assert `0.5` exceeds whatever G4's real measured base turns out to be (expected to pass easily, given HALT-2's own measured ~0.03 m/s base, though that HALT-2 figure is a reference only and was never re-used as an input here).
- Plans 34-07 through 34-11 remain blocked on 34-06's third run producing real shipped constants, per the phase's existing fixed-order dependency chain. This plan ticks no requirement — PAUSE-01/STOP-02's disposition stays plan 34-11's job.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `scripts/compute-pause-classification-calibration.mjs`
- FOUND: `scripts/compute-pause-classification-calibration.test.mjs`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-13-SUMMARY.md` (this file)
- FOUND commits: `e67bd7d9`, `c3a71acf`, `9d7bbe75`
