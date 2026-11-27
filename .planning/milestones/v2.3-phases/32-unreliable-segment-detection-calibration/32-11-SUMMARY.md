---
phase: 32-unreliable-segment-detection-calibration
plan: 11
subsystem: analytics
tags: [typescript, vitest, tdd, total-function, gap-closure]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments/advanceSteps detector (32-02, 32-03, 32-07, 32-09) and 32-VERIFICATION.md gap #1's five reproduced throw inputs"
provides:
  - "detectUnreliableSegments and advanceSteps are now a total function for shape-level malformed input (non-array t/d/gaps, non-object gaps entries, null/non-object params) — proven against both the TypeScript source and the compiled dist/ artifact the untyped .mjs consumers import"
affects: [33-pace-derivation-integration, 35-best-effort-integration, 36-gap-classification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["shape guard precedes value/field guard: Array.isArray/typeof checks run before validateStreamSeries or any destructure/dereference, so malformed shape never reaches a throw site"]

key-files:
  created: []
  modified:
    - src/analytics/unreliable-segments.ts
    - src/analytics/unreliable-segments.test.ts

key-decisions:
  - "gapListIsWellShaped checks SHAPE only (Array.isArray + non-null-object entries); field-level validity (NaN bounds, endSec<=startSec, bounds matching no sample) stays mapGapToIndices's job — no change to the existing field-level fail-closed behaviour"
  - "Guards ordered: Array.isArray(t)/Array.isArray(d) and gapListIsWellShaped(gaps) run BEFORE validateStreamSeries, because validateStreamSeries dereferences t.length and throws on null"
  - "paramsAreValid and mapGapToIndices each gained a null/typeof check as their first statement, so a null/non-object params or gap span fails closed through the existing return paths instead of throwing on destructure/property access"
  - "isFastStep and excessMetres left byte-identical — plan 32-04's SEG-05a single-source audit bans their exact literal text outside this file"

requirements-completed: [SEG-01]

# Metrics
duration: 8min
completed: 2026-09-20
---

# Phase 32 Plan 11: Shape-Level Total-Function Guards Summary

**Closed 32-VERIFICATION.md gap #1: `detectUnreliableSegments`/`advanceSteps` now return a fresh `[]` instead of throwing `TypeError` on null/non-array `t`, `d`, `gaps`, a `[null]` gap entry, or a `null` `params` — the shape malformation the untyped `.mjs` consumers can produce from `JSON.parse`'d disk data.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-20T21:32Z (worktree base)
- **Completed:** 2026-09-20T21:39:33+02:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added a `shape-level` regression block (title contains the exact `shape-level` string the VALIDATION.md `-t` filter matches) that reproduces all five inputs 32-VERIFICATION.md's gap #1 found against `dist/`, watched RED first against the unguarded source
- Added `gapListIsWellShaped`, an `Array.isArray(t)`/`Array.isArray(d)` guard, a null/non-object `params` guard, and a null/non-object gap-span guard — all shape checks precede the existing field-level checks and `validateStreamSeries`
- Verified the fix on the COMPILED `dist/analytics/unreliable-segments.js` module (not just the TypeScript source), since that is the artifact the untyped `.mjs` consumers actually import
- Rewrote three docblocks (module, `advanceSteps`, `detectUnreliableSegments`) so the "never throws" claim is now true and names the shape-level cases explicitly

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the shape-level total-function block and watch it fail RED** - `c411ad28` (test)
2. **Task 2: Add the shape guards and watch the block turn GREEN** - `be327bd7` (feat)

_TDD plan: RED (`test`) then GREEN (`feat`), no REFACTOR commit needed — no cleanup was required after GREEN._

## Files Created/Modified

- `src/analytics/unreliable-segments.test.ts` - New `detectUnreliableSegments — total function, shape-level malformation (gap closure 32-11)` describe block: `it.each` cases for malformed `gaps` (null/undefined/string/number/non-array object), malformed `gaps` entries (`[null]`/`[undefined]`/`[42]`/`['nope']`/well-formed-then-null), malformed `params` (null/string/number), and malformed `t`/`d` (null/null, null/valid, valid/null, string/string, object/object), for both `detectUnreliableSegments` and `advanceSteps`, plus two freshness assertions (`not.toBe` on two invalid-call results). Added one sentence to the pre-existing `total function` block's new docblock noting it covers field-level malformation only.
- `src/analytics/unreliable-segments.ts` - Added `gapListIsWellShaped(gaps): gaps is readonly GapSpan[]`; `advanceSteps` and `detectUnreliableSegments` each gained `if (!Array.isArray(t) || !Array.isArray(d)) return [];` and `if (!gapListIsWellShaped(gaps)) return [];` as their first statements; `paramsAreValid` gained a leading `params === null || typeof params !== 'object'` check; `mapGapToIndices` gained a leading `span === null || typeof span !== 'object'` check returning `null`. Module, `advanceSteps` and `detectUnreliableSegments` docblocks rewritten to name the shape-level cases and cite 32-VERIFICATION.md gap #1.

## Decisions Made

- Guard ordering matters: the array/shape checks run strictly before `validateStreamSeries` (which throws on `t.length` for a `null` `t`) and before any destructure/property access, per the plan's interface notes.
- `gapListIsWellShaped` is intentionally shape-only — it does not duplicate `mapGapToIndices`'s field-level checks (NaN bounds, ordering, sample matching), preserving the existing fail-closed behaviour for those cases unchanged.
- Left `isFastStep`/`excessMetres` and `validateStreamSeries` untouched per the plan's explicit scope boundary.

## Deviations from Plan

None - plan executed exactly as written. The two verify commands in the plan's `<verify>` blocks referenced the main repo path (`cd /Users/pedf/workspace/strava-widgets`) rather than this worktree; ran the equivalent commands from the worktree root instead (same relative paths, same assertions) since this is a parallel worktree-isolated executor.

## Issues Encountered

The worktree's HEAD had drifted onto a commit two ahead of the assigned base (`5e902283`, an archived-milestone chore commit reachable from `bad4675d` via `origin/master`'s CI auto-commits) rather than behind it — `git merge-base` showed the assigned base commit was an ancestor of, not an ancestor to, current HEAD. Corrected per the worktree-branch-check step by resetting to the assigned base `bad4675daa5a4be804375bdbe689bf83dd8198da` before any task work began. Also: the worktree's `data/` directory already existed with content (unlike the documented "no data/" bare-worktree assumption), so the environment-setup `cp -R` created a stray nested `data/data/`; removed before staging, not part of any commit.

## Verification Evidence

- **Task 1 RED** (`-t "shape-level"`, against the unguarded source): `22 failed | 9 passed` (31 matched, 53 skipped by the filter). Failure messages included `gaps is not iterable`, `Cannot read properties of null (reading 'startSec')`, `Cannot destructure property 'speedLimitMps' of 'params' as it is null.`, and `Cannot read properties of null (reading 'length')` — 4 of the 5 verifier-reproduced message shapes present verbatim. `git diff --name-only src/analytics/unreliable-segments.ts` printed nothing at the end of Task 1.
- **Task 2 GREEN**: `npx tsc --noEmit` exits 0. Whole-file run: `84 passed (84)` — pre-existing test count unchanged (53 pre-existing + 31 new shape-level = 84; the file had 53 tests before this plan). `-t "shape-level"` run: `31 passed | 0 failed` (53 skipped) — same 31 matched as the RED run, all now green.
- **dist/ probe**: `npm run build` (tsc) succeeded; `node -e "import('./dist/analytics/unreliable-segments.js')..."` against all five verifier-reproduced inputs printed `DIST-TOTAL-FUNCTION-OK`.
- `grep -c "Array.isArray" src/analytics/unreliable-segments.ts` → `3`. `grep -c "speedLimitMps \* seconds" src/analytics/unreliable-segments.ts` → `2` (SEG-05a audit needle unaffected).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GAP 1 from `32-VERIFICATION.md` is closed: the "never throws" total-function contract is now true for shape-level malformed input, on both source and compiled artifact.
- Gaps #2 (vacuous fs-spy import guards) and #3 (mapGapToIndices/isGapPair boundary mismatch on duplicate timestamps) from the same verification report remain open — tracked in separate gap-closure plans (32-12 and others in this wave), not touched by this plan.
- `validateStreamSeries` in `best-effort-utils.ts` deliberately left unchanged, per the plan's scope boundary.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `src/analytics/unreliable-segments.ts`
- FOUND: `src/analytics/unreliable-segments.test.ts`
- FOUND: commit `c411ad28` (test(32-11): add failing shape-level total-function regression block)
- FOUND: commit `be327bd7` (feat(32-11): add shape-level entry guards, close GAP 1 total-function contract)
