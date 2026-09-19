---
phase: 28-pr-plausibility-ceiling
plan: 02
subsystem: analytics
tags: [typescript, vitest, best-effort-engine, dashboard-logic, plausibility-ceiling]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: badge-wording register (named condition + measured value, never an adjective) and the `qualityBadgeSpecs` spec-object precedent
provides:
  - "EffortDemotion/EffortDemotionGuard and the required ComputedEffort.demotion field (D-10), separate from BestEffort.excludedFromRecords"
  - "CeilingDerivation, BestEffortsDocument.ceilings, totals.effortsDemoted, BestEffortCeilingStateFile — all additive, no schema bump"
  - "BestEffortPanelRow.demoted/demotionReason and the pure prFlagBadgeSpecs(row, exclusionReason) function"
  - "countDemotedAtDistance, resolvePrTableEmptyState, resolvePrTableDemotionNote in records-logic.ts"
affects: [28-04-rendering, 28-05-three-pass-restructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A demotion is carried on a separate, required field from the owner-intent exclusion flag, read only via `!= null` so a stale/pre-migration document degrades safely rather than throwing"
    - "Badge visible-text decisions moved out of DOM builders into pure, node-testable spec functions (mirrors Phase 27's qualityBadgeSpecs)"

key-files:
  created: []
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/compute-best-efforts.ts
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
    - src/dashboard/data/best-efforts-client.ts
    - src/dashboard/data/best-efforts-client.test.ts
    - src/analytics/compute-age-grading.test.ts
    - src/analytics/compute-dashboard-index.test.ts

key-decisions:
  - "D-10: demotion is a separate, required field from excludedFromRecords, declared on ComputedEffort so BestEffort inherits it at the point of computation rather than a later .map()"
  - "D-02/D-06 precedent followed: ceilings/effortsDemoted are purely additive, no BEST_EFFORTS_SCHEMA_VERSION bump"
  - "D-11 respected: no override/write surface added; demotion is read-only machine judgment"
  - "Deviation: best-efforts-client.ts's browser shard parser now actually parses demotion (via a total, never-throwing parseDemotion) rather than hardcoding null, so a later plan's real demotion values are not silently defeated by this plan's own typecheck fix"

patterns-established:
  - "PrFlagBadgeSpec mirrors list.ts's QualityBadgeSpec shape ({visibleText, explanation, descriptionIdSuffix}) under a kind discriminant, for plan 28-04 to render via the existing appendAccessibleBadge"

requirements-completed: [PR-03]

# Metrics
duration: 27min
completed: 2026-09-10
---

# Phase 28 Plan 02: Demotion Data Model & Pure Dashboard Logic Summary

**Required `ComputedEffort.demotion` field plus two extended pure logic modules (`prFlagBadgeSpecs`, `countDemotedAtDistance`/`resolvePrTableEmptyState`/`resolvePrTableDemotionNote`) landed and unit-tested ahead of any compute or rendering code depending on them.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-10T23:12:25+02:00
- **Completed:** 2026-09-10T23:39:46+02:00
- **Tasks:** 3
- **Files modified:** 10 (6 in-scope, 4 auxiliary blocking fixes)

## Accomplishments

- `EffortDemotion`/`EffortDemotionGuard`, a REQUIRED `ComputedEffort.demotion: EffortDemotion | null` field, `CeilingDerivation`, `BestEffortsDocument.ceilings`, `totals.effortsDemoted`, and `BestEffortCeilingStateFile` all land in `best-effort.types.ts`, purely additive (no `BEST_EFFORTS_SCHEMA_VERSION` bump).
- `compute-best-efforts.ts` typechecks against the new required field with a 3-line diff (`demotion: null` at the single construction site, `effortsDemoted: 0`, `ceilings: {}` — each commented with the plan that starts computing it); `resolveExcluded` and the schema version constant are byte-unchanged.
- `BestEffortPanelRow` gains `demoted`/`demotionReason`; the new pure `prFlagBadgeSpecs(row, exclusionReason)` decides every PR-flags-cell badge string (`pr`, `demoted`, `low-confidence`, `excluded`) — the first test coverage that string has ever had, closing the `PRExcluded — {reason}` run-on-claim hazard named in Phase 24 Round 2's R15.
- `records-logic.ts` gains `countDemotedAtDistance` (counts demoted EFFORTS, never conflated with `excludedFromRecords`), and `resolvePrTableEmptyState`/`resolvePrTableDemotionNote`, which reproduce the two pre-existing Records empty-state copy branches verbatim and add a third (the all-time ceiling-emptied state, D-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: The demotion data model on best-effort.types.ts** - `49207073` (feat)
2. **Task 2: Panel row demotion fields and the pure prFlagBadgeSpecs function** - `4cd5e5b7` (feat)
3. **Task 3: Records-side demoted counting and the three-branch empty-state copy** - `ccbf9f2d` (feat)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `src/analytics/best-effort.types.ts` - EffortDemotion(Guard), required ComputedEffort.demotion, CeilingDerivation, BestEffortsDocument.ceilings/totals.effortsDemoted, BestEffortCeilingStateFile
- `src/analytics/compute-best-efforts.ts` - `demotion: null` at the single construction site; `effortsDemoted: 0`, `ceilings: {}` in the output document
- `src/dashboard/views/detail-best-efforts-logic.ts` - `BestEffortPanelRow.demoted/demotionReason`; `PrFlagBadgeSpec` + `prFlagBadgeSpecs`
- `src/dashboard/views/detail-best-efforts-logic.test.ts` - stale-shard fixture builder default, `panelRow()` helper, 8-case `prFlagBadgeSpecs` describe block, 3 new `buildBestEffortsPanelRows` cases
- `src/dashboard/views/records-logic.ts` - `countDemotedAtDistance`, `resolvePrTableEmptyState`, `resolvePrTableDemotionNote`
- `src/dashboard/views/records-logic.test.ts` - fixture default update, 3 new describe blocks (13 cases) pinning the verbatim copy and the new ceiling branch
- `src/dashboard/data/best-efforts-client.ts` - (deviation, out of plan scope) `parseDemotion`, wired into `parseEffort`, so the browser shard parser actually surfaces `demotion` rather than silently discarding it
- `src/dashboard/data/best-efforts-client.test.ts` - (deviation) `validShard` fixture updated + 3 new tests (stale-shard absent key, malformed guard, well-formed parse)
- `src/analytics/compute-age-grading.test.ts`, `src/analytics/compute-dashboard-index.test.ts` - (deviation) `demotion: null` added to 7 pre-existing inline effort fixtures to satisfy the new required field

## Decisions Made

- Followed the plan's interfaces block verbatim for every new type name, field name, and function signature.
- `resolvePrTableEmptyState`/`resolvePrTableDemotionNote` import `DISTANCE_DISPLAY_NAMES` from `detail-best-efforts-logic.ts` rather than duplicating `records.ts`'s local `DISTANCE_LABELS` map — the two are identical, and the plan's own single-source discipline (e.g. `resolveExcluded`) argues against a third copy.
- `effort.demotion` is read via loose `!= null` (not the threat model's literally-quoted `!== null`) everywhere a stale/absent field must degrade to "not demoted" — strict `!== null` would incorrectly treat an absent (`undefined`) key as demoted, which contradicts T-28-02-A's own stated mitigation outcome ("yields `demoted: false`").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `best-efforts-client.ts`'s browser shard parser needed to parse the new required `demotion` field**
- **Found during:** Task 1 (`npx tsc --noEmit` after adding the required field)
- **Issue:** The parser builds `BestEffort` objects from untyped fetched JSON field-by-field; the new required field broke its return-type assignability. Hardcoding `demotion: null` would have typechecked but would silently discard any real demotion value a later plan (28-05) starts writing, defeating D-08/D-09's entire purpose without any test ever catching it.
- **Fix:** Added a total, never-throwing `parseDemotion` (validates `guard` against the three known values and `reason` as a string, degrading anything else to `null`) and wired it into `parseEffort`. Matches T-28-02-A's stated mitigation for this exact trust boundary.
- **Files modified:** `src/dashboard/data/best-efforts-client.ts`, `src/dashboard/data/best-efforts-client.test.ts`
- **Verification:** 3 new tests (absent key, malformed guard, well-formed parse) plus the existing 12 all green.
- **Committed in:** `49207073` (Task 1 commit)

**2. [Rule 3 - Blocking] Two out-of-scope fixture files needed `demotion: null` added to inline effort literals**
- **Found during:** Task 1 (`npx tsc --noEmit`)
- **Issue:** `compute-age-grading.test.ts` and `compute-dashboard-index.test.ts` construct `BestEffort[]` literals inline (not through a shared helper with a default); the new required field broke 7 of these literals.
- **Fix:** Added `demotion: null,` to each of the 7 literals — mechanical, no test-intent change.
- **Files modified:** `src/analytics/compute-age-grading.test.ts`, `src/analytics/compute-dashboard-index.test.ts`
- **Verification:** Both suites green (10 and existing counts respectively).
- **Committed in:** `49207073` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3, blocking typecheck failures caused directly by this plan's additive schema change)
**Impact on plan:** Necessary for `npx tsc --noEmit` to pass across the whole tree, which the plan's own `<verification>` block requires. No scope creep — the shard-parser fix is the minimal correct response to a plan-created gap, not a rendering or compute change.

## Issues Encountered

- `data/stats/*.json` did not exist in this worktree (gitignored, not generated). `records-logic.test.ts` reads several of these files directly via `fs`. Ran `npm run build && npm run compute-all-stats` locally to generate them (no network calls; all steps are local-file-based) so the plan's own named verification command (`records-logic.test.ts`) could execute. This regenerated `data/geo/geo-metadata.json`'s `generatedAt` timestamp as a side effect; reverted with `git checkout -- data/geo/geo-metadata.json` before committing, since that file is unrelated to this plan.
- Two full-suite (`npm test`) failures are pre-existing environment gaps unrelated to this plan's changes, confirmed present before any edit: `scripts/verify-dashboard-publish-stats.test.mjs` requires a built `dist/widgets/data/stats/best-efforts.json` (this worktree has no `dist/` build), and `src/dashboard/views/trends-zoom-logic.test.ts` requires `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`, which is absent from this worktree's `node_modules` install. Both are gitignored build/install artifacts outside this plan's scope (analytics/dashboard-logic files only) and outside the SCOPE BOUNDARY rule for auto-fixing pre-existing, unrelated failures.

## Known Stubs

None — every new function is fully wired to its stated inputs; no hardcoded empty/placeholder values were introduced. `compute-best-efforts.ts`'s `demotion: null` / `effortsDemoted: 0` / `ceilings: {}` are the plan's own explicitly-specified Pass-1 values (plan 28-05 is named as the plan that starts computing real values), not stubs standing in for missing work in this plan's scope.

## Threat Flags

None — all three threats named in this plan's `<threat_model>` (T-28-02-A DoS via stale-shard property access, T-28-02-B tampering via unescaped reason strings, T-28-02-C elevation via a write surface) are exactly the surfaces this plan's own code touches, and no new surface was introduced beyond them. The `best-efforts-client.ts` deviation is itself a T-28-02-A mitigation, not a new threat surface — it reads through the same total, never-throwing pattern the rest of that file already uses for every other field.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The demotion contract (`ComputedEffort.demotion`, `CeilingDerivation`, `BestEffortCeilingStateFile`) is now fixed and available for plan 28-05's three-pass restructuring to populate for real.
- `prFlagBadgeSpecs` and `resolvePrTableEmptyState`/`resolvePrTableDemotionNote` are ready for plan 28-04 to render through the existing `appendAccessibleBadge`/`appendBadge` helpers in `list.ts` — no DOM code in this plan reads them yet.
- `resolveExcluded`, `buildPrBadgeLabels`'s required second parameter, `BEST_EFFORTS_SCHEMA_VERSION`, and `isEmptyRanking` are all confirmed byte-unchanged by this plan's own acceptance-criteria greps, re-verified after the final commit.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-10*
