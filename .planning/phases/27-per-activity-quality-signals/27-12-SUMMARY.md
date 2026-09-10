---
phase: 27-per-activity-quality-signals
plan: 12
subsystem: ui
tags: [typescript, vitest, dashboard, badges, quality-signals, gap-closure]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-07's qualityBadgeSpecs (list.ts) and 27-09's always-on Quality Signals detail section (detail-sections.ts), both reviewed in 27-REVIEW.md"
provides:
  - "qualityBadgeSpecs widened to Pick<ParsedDashboardIndexRow, 'quality'>, guarded so an absent/null quality key returns [] instead of throwing (G-04, CR-01)"
  - "detail-sections.ts's EXPLANATION_PROBE_QUALITY exported as a single-origin fixture; a module-load-time eager assertion that fails loudly if any tiering signal's explanation goes empty (G-05, WR-01)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Widen a list-row consumer's parameter type to Pick<ParsedDashboardIndexRow, K> rather than Pick<DashboardIndexRow, K> whenever the field is read from a value that ultimately comes from a re-parsed data/dashboard/index.json — matches rowPaceDisagreement's and rowIsAnySevere's existing precedent for exactly this hazard class"
    - "Eager module-load assertion as the 'fail loudly at construction, not at first render' pattern for a module-level fixture that a per-call ?? fallback would otherwise paper over silently"
    - "Export a synthetic test-fixture-shaped constant from production code (EXPLANATION_PROBE_QUALITY) so a drift test in a sibling test file exercises the exact object production is built from, rather than a hand-duplicated literal that can silently diverge from it"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "qualityBadgeSpecs's parameter widened to Pick<ParsedDashboardIndexRow, 'quality'> (quality?: ActivityQualitySignals) rather than Pick<Partial<DashboardIndexRow>, 'quality'> — reuses the type dashboard-index.types.ts already ships for exactly this hazard instead of inlining a second Partial<> spelling of the same shape."
  - "Audited every other row.quality read reachable from the list/overview render path (list-logic.ts, detail.ts, overview.ts, records.ts, calendar.ts, calendar-logic.ts): list-logic.ts's rowIsAnySevere and detail.ts's indexClient.getRow(...)?.quality ?? null already guard correctly; overview.ts/records.ts/calendar.ts never touch .quality directly at all — they consume rows only through the now-fixed renderActivityRow — so they are fixed transitively with zero additional changes. list.ts:402's unguarded destructure was the ONLY unguarded consumer found; widening the type did not surface any further ones because DashboardIndexRow's required quality is structurally assignable to the widened optional-quality parameter with no compile error at any call site."
  - "tieringExplanation's `?? ''` fallback was NOT removed — instead, a new eager assertion runs immediately after EXPLANATION_PROBE_SPECS is built (true module load, before any render), throwing if any of the three tiering signals produced no explanation. The `?? ''` inside tieringExplanation is now unreachable defense-in-depth; the throw is the actual safety net. Chosen over making tieringExplanation itself throw per-call, since the review's wording ('fail loudly at module load') is satisfied literally by placing the check at the top-level constant's own construction site, not deferred to whichever row builder happens to call tieringExplanation first."
  - "EXPLANATION_PROBE_QUALITY exported from detail-sections.ts rather than exporting EXPLANATION_PROBE_SPECS (the derived result) — the test needed the INPUT object (to feed its own independent qualityBadgeSpecs(...) call and qualitySignalsSectionPlan(...) call and compare), not the already-computed output, so exporting the input is what actually removes the duplication."

requirements-completed: [QUAL-01, QUAL-03]

duration: ~40min
completed: 2026-09-10
---

# Phase 27 Plan 12: Gap Closure — G-04 Quality Badge Crash Guard, G-05 Explanation Non-Emptiness Summary

**Closed a real, reproduced crash where a parsed list/overview row missing `quality` took down the entire Activities render loop, and replaced an accidental `''`-vs-`undefined` test safety net with a direct assertion plus an eager module-load guard on the detail view's tiering explanations.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2/2 completed
- **Files modified:** 4

## Accomplishments

- **G-04 (Critical, closed):** `qualityBadgeSpecs` in `list.ts` no longer throws when `row.quality` is absent or `null`. The parameter type widened from `Pick<DashboardIndexRow, 'quality'>` to `Pick<ParsedDashboardIndexRow, 'quality'>`, and the destructure is guarded (`const quality = row.quality; if (!quality) return specs;`) the same way the three sibling call sites this phase already defends this way (`rowIsAnySevere`, `detail.ts`'s `?? null`, `list.ts`'s own `rowPaceDisagreement`). A stale-cached pre-Phase-27 `index.json` — the concrete scenario the review names — now degrades one row's badges instead of blanking the whole Activities list or Overview render.
- **Audit (G-04, required by acceptance criteria):** every other `.quality` read reachable from the render path was checked. `list-logic.ts` and `detail.ts` already guard correctly (pre-existing). `overview.ts`, `records.ts`, `calendar.ts`, `calendar-logic.ts` were grepped for `.quality` — none read the field directly at all; `overview.ts` reuses `list.ts`'s `renderActivityRow` verbatim, so it is fixed transitively with zero changes of its own. Widening the parameter type surfaced no further unguarded consumers via the compiler, because `DashboardIndexRow`'s required `quality` is structurally assignable to the widened optional-quality parameter at every existing call site — the compiler couldn't have caught this class of bug through the type system alone, which is exactly why the guard itself (not just the type widening) was the required fix.
- **New tests (5), demonstrated failing first:** a `rowMissingQuality()` fixture mirrors `rowMissingPaceDisagreement()`'s established pattern (destructuring the key off a `ParsedDashboardIndexRow`-typed `baseRow()` so the key is genuinely ABSENT, not present-and-`undefined`). Against the unguarded destructure, 3 of the 5 new tests failed with the exact verbatim crash the review reproduced — `TypeError: Cannot destructure property 'decimation' of 'row.quality' as it is undefined.` — captured below. One test asserts function-level behavior (`qualityBadgeSpecs` returns `[]`), one asserts `activityRowAriaLabel` doesn't throw, and one is a render-loop-level test: a `for (const row of pageItems)` loop calling `activityRowAriaLabel` on a mixed array including the missing-quality row, mirroring `buildMobileCardList`/`buildDesktopTable`'s own loop shape verbatim (the DOM-construction half of those loops cannot be exercised at all in this repo's `environment: 'node'` vitest config — no jsdom, documented at this file's own header — so `activityRowAriaLabel`, the exact call those loops make unconditionally per row, is the closest available render-loop-level proxy).
- **G-05 (Warning, closed):** Added a direct assertion in `detail-sections.test.ts` that each of the three tiering explanation strings (`decimation`, `gapProfile`, `impossibleSamples`) has non-zero length — independent of the pre-existing drift test, which only compares the detail section's explanation against `list.ts`'s `qualityBadgeSpecs` output for equality and would pass even if BOTH sides were `''`. Demonstrated the new assertion failing (see verbatim output below) by temporarily breaking the probe's `gapProfile` tier to `'minor'` (with the new eager module-load guard also temporarily disabled to isolate the demonstration) — the pre-existing equality drift test stayed green throughout, confirming the reviewer's own finding that its safety net is accidental; the new direct assertion failed cleanly with `expected 0 to be greater than 0`. Both production changes restored before committing.
- **Probe deduplication (G-05):** `EXPLANATION_PROBE_QUALITY` (the synthetic always-severe input object `EXPLANATION_PROBE_SPECS` is built from) is now exported from `detail-sections.ts` and imported directly into `detail-sections.test.ts`'s drift test, replacing a hand-duplicated `severeQuality` literal that had no shared origin with production. The two sides can no longer silently diverge from each other.
- **The `?? ''` fallback decision:** kept, but demoted to unreachable defense-in-depth. A new loop runs immediately after `EXPLANATION_PROBE_SPECS` is constructed — at true module load, before any render — asserting all three tiering signals produced a non-empty explanation, and throwing with a named signal if not. This satisfies the review's "fail loudly at module load" literally (the check lives at the top-level constant's own construction site, not deferred to whichever row builder calls `tieringExplanation` first) while remaining safe for any unrelated import: the throw fires only if the invariant is actually broken, which it is not for any present-day import of the module.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard qualityBadgeSpecs against a row with no quality** - `9c0f6c20` (fix)
2. **Task 2: Assert the explanation strings non-empty directly** - `f143fd0e` (fix)

_Plan metadata commit for this SUMMARY/STATE/ROADMAP update is separate and owned by the orchestrator per this plan's execution instructions._

## Verbatim Failing-Test Output (Task 1, G-04)

Captured with the unguarded `const { decimation, gapProfile, impossibleSamples } = row.quality;` still in place (before the guard was added):

```
FAIL src/dashboard/views/list.test.ts > G-04 (27-REVIEW.md CR-01) — a row missing quality does not crash qualityBadgeSpecs or the render loop > qualityBadgeSpecs returns [] for the missing-key row, rather than throwing (function level)
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot destructure propert…' was thrown
- Expected: undefined
+ Received: "TypeError: Cannot destructure property 'decimation' of 'row.quality' as it is undefined."

FAIL src/dashboard/views/list.test.ts > G-04 (27-REVIEW.md CR-01) — a row missing quality does not crash qualityBadgeSpecs or the render loop > activityRowAriaLabel does not throw for the missing-key row and still folds the curated base label
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot destructure propert…' was thrown

FAIL src/dashboard/views/list.test.ts > G-04 (27-REVIEW.md CR-01) — a row missing quality does not crash qualityBadgeSpecs or the render loop > a for-of loop mirroring buildMobileCardList/buildDesktopTable's own `for (const row of pageItems)` shape completes over every row, including the missing-quality one, without throwing (render-loop level ...)
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot destructure propert…' was thrown

Test Files  1 failed (1)
     Tests  3 failed | 2 passed | 93 skipped (98)
```

After the guard was applied: `98/98` tests passed, `npx tsc --noEmit` exited 0.

## Verbatim Failing-Test Output (Task 2, G-05)

Captured with `EXPLANATION_PROBE_QUALITY.gapProfile.tier` temporarily changed from `'severe'` to `'minor'`, and the new eager module-load throw temporarily disabled to isolate the demonstration to the new test alone:

```
FAIL src/dashboard/views/detail-sections.test.ts > qualitySignalsSectionPlan — quality signals section (D-08, D-09, D-12, D-17) > G-05: the three tiering explanation strings are directly asserted non-empty, not only compared for equality against list.ts (the equality check above would pass even if BOTH sides were "")
AssertionError: gapProfile row explanation must not be empty: expected 0 to be greater than 0
 ❯ src/dashboard/views/detail-sections.test.ts:580:95

Test Files  1 failed (1)
     Tests  1 failed | 113 skipped (114)
```

Notably, the pre-existing drift test (`the three tiering explanation strings are identical to the ones list.ts exports...`) did NOT fail during this same broken state — both its production-side and test-side reads returned `''`, confirming the reviewer's WR-01 finding that its safety net is accidental rather than direct.

After both production changes (the probe's `gapProfile` tier, and the eager module-load throw) were restored: `114/114` tests passed, `npx tsc --noEmit` exited 0.

## Files Created/Modified

- `src/dashboard/views/list.ts` — Widened `qualityBadgeSpecs`'s parameter to `Pick<ParsedDashboardIndexRow, 'quality'>`; guarded the destructure to return `[]` for an absent/null `quality`; added the `ParsedDashboardIndexRow` type import.
- `src/dashboard/views/list.test.ts` — Added `rowMissingQuality()` fixture and a new `describe` block (5 tests): key-absence proof, function-level `qualityBadgeSpecs` guard test, `activityRowAriaLabel` guard test, a render-loop-level `for`-loop test, and a positive control proving the guard does not swallow real severe signals. Updated `qualityRow`'s doc comment to reference the widened signature.
- `src/dashboard/views/detail-sections.ts` — Extracted and exported `EXPLANATION_PROBE_QUALITY` (previously an inline, unexported literal); added an eager module-load assertion loop immediately after `EXPLANATION_PROBE_SPECS` is built, throwing if any of the three tiering signals produced no explanation; updated doc comments on `EXPLANATION_PROBE_SPECS` and `tieringExplanation` to reflect the new throw-based safety net.
- `src/dashboard/views/detail-sections.test.ts` — Imported `EXPLANATION_PROBE_QUALITY` from `detail-sections.js`; replaced the drift test's hand-duplicated `severeQuality` literal with the imported constant; added a new direct non-emptiness assertion test.

## Decisions Made

See `key-decisions` in the frontmatter above. In brief: reused `ParsedDashboardIndexRow` rather than inlining a second `Partial<>` spelling; confirmed the type-widening audit surfaced zero further unguarded consumers (the compiler cannot catch this bug class structurally, which is why the runtime guard — not just the type change — was the actual fix); kept `?? ''` as unreachable defense-in-depth behind a new eager module-load throw rather than removing it or making `tieringExplanation` itself throw per-call; exported the probe's INPUT object (`EXPLANATION_PROBE_QUALITY`), not its derived output, since the test needed to feed the same input into its own independent `qualityBadgeSpecs`/`qualitySignalsSectionPlan` calls.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were met without needing Rule 1-4 deviations; the "audit overview.ts" and "consider whether the `??` fallback should throw" instructions were investigation steps built into the plan itself, not deviations from it.

## Known Stubs

None.

## Threat Flags

None — both changes narrow existing crash/silent-failure surface; neither introduces a new network endpoint, auth path, file access pattern, or schema change at a trust boundary.

## Invariants Verified

- `npm test`: 73/73 test files green, 2076 tests (2070 baseline + 5 G-04 tests + 1 G-05 test)
- `npx tsc --noEmit`: 0 errors
- `npm run verify-dashboard`: exit 0, 64/64 checks passed
- `node scripts/compute-pace-quality-recount.mjs`: exit 0, reports 299 (matches `totals.qualityAnySevere` and the row-level count)
- `git diff --stat src/analytics/pace-quality.ts`: empty (no threshold touched, D-02/D-04)
- `composeRowAriaLabel(` occurs exactly twice in `list.ts`'s stripped source (verified via the pre-existing `list.test.ts` assertion, which passed unmodified)

## Self-Check: PASSED

- FOUND: `src/dashboard/views/list.ts` (modified, guard present)
- FOUND: `src/dashboard/views/list.test.ts` (modified, 5 new tests present)
- FOUND: `src/dashboard/views/detail-sections.ts` (modified, eager throw present)
- FOUND: `src/dashboard/views/detail-sections.test.ts` (modified, direct assertion present)
- FOUND: commit `9c0f6c20` (Task 1)
- FOUND: commit `f143fd0e` (Task 2)
