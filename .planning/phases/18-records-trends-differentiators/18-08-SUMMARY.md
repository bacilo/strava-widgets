---
phase: 18-records-trends-differentiators
plan: 08
subsystem: analytics
tags: [age-grading, wma, build-pipeline, privacy, vitest]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    plan: 01
    provides: "src/analytics/athlete-private.ts — loadAthletePrivateConfig, birthDate/sex/restingHr never reaching src/dashboard/"
  - phase: 18-records-trends-differentiators
    plan: 02
    provides: "data/wma/*.json committed factor tables, src/analytics/wma-factors.ts (ageAtDate/resolveAgeGrade), src/analytics/age-grading.types.ts (AgeGradingDocument contract)"
provides:
  - "src/analytics/compute-age-grading.ts — computeAgeGrading build step, writes data/stats/age-grading.json"
  - "data/stats/age-grading.json contract: schemaVersion, enabled/disabledReason, editions, rankings (per-distance graded PR entries), activities (per-effort graded entries) — no identity fields ever"
affects: ["18-XX (Records page age-grade column, detail-view best-efforts panel)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-vs-optional-input split mirrors compute-dashboard-index.ts: best-efforts.json and the committed WMA tables are required and throw; the private athlete config is optional and degrades to a documented disabled state"
    - "Age computed once per activity's own startDate (ageAtDate), never today's date — the age-grading formula's entire point per D-10"
    - "null resolveAgeGrade results are omitted from the output object rather than coerced to 0, so the view can distinguish 'not gradable' from 'graded at 0%'"

key-files:
  created:
    - src/analytics/compute-age-grading.ts
    - src/analytics/compute-age-grading.test.ts
  modified: []

key-decisions:
  - "No CLI command registration added to src/index.ts — the plan's files_modified scope names only compute-age-grading.ts and its test; the verify command invokes computeAgeGrading directly via node -e, matching the plan's own verification command"
  - "Task 2's fixture WMA tables are a minimal, hand-designed shape (not the real committed data/wma/*.json) — formula correctness is plan 18-02's suite's job; this suite only proves the wiring, the date semantics, and every missing/malformed-input path"

requirements-completed: [REC-06]

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 18 Plan 08: Compute Age-Grading Build Step Summary

**`compute-age-grading.ts` cross-references `best-efforts.json`, the committed WMA factor tables, and the private athlete config to emit per-ranking and per-activity age-grade percentages — with `birthDate`/`sex` never reaching the published `data/stats/age-grading.json`, and a documented, non-throwing disabled state when no private config exists.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both created)

## Accomplishments

- Implemented `computeAgeGrading`: required inputs (`best-efforts.json`, both committed WMA tables) throw with actionable messages naming their regeneration commands (`compute-best-efforts`, `scripts/convert-wma-tables.mjs`); the optional private config degrades to `enabled: false` with the exact Records-page Copywriting Contract string and never throws.
- Every ranked PR entry and every per-activity effort is graded via `ageAtDate` at the effort's own `startDate` (never today's date) piped into `resolveAgeGrade`; a `null` result (unservable distance/sex combination) is omitted from the output rather than published as a fabricated `0%`.
- Verified against the live archive with a temporary private config: 1843/1843 activities graded, top `5k` age-grade `67.3%`, `1k` correctly flagged `derived: true` and all other distances `false`.
- Confirmed the published document is provably free of identity fields (`grep -cE '"birthDate"|"restingHr"|"sex"|"ageYears"|"age"' data/stats/age-grading.json` returns `0`) and that deleting `data/wma/road-factors.json` makes the step throw naming the converter script, then restored to green.
- 10-case fixture suite pins the wiring (one hand-computed percent), the date-at-effort-not-today directional semantics, the `derived`-only-for-`1k` rule, the null-omitted contract, non-PR-effort coverage, and every missing/malformed-input throw/degrade path — all without touching the real `data/stats|wma|private` files (fixtures only, confirmed by the plan's own grep check).

## Task Commits

1. **Task 1: Emit age-grade percentages for every ranking entry and every effort** - `ac994d8` (feat)
2. **Task 2: Test the cross-referencing and degradation contract** - `7114476` (test)

_No plan-metadata commit yet — this is a worktree-mode executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `src/analytics/compute-age-grading.ts` - `ComputeAgeGradingOptions`, `computeAgeGrading` — required-input throws, optional-input degrade, per-ranking and per-activity grading loops, identity-free document write
- `src/analytics/compute-age-grading.test.ts` - 10 fixture-based test cases covering the wiring/degradation contract (formula correctness is plan 18-02's suite's responsibility)

## Decisions Made

- Followed `compute-dashboard-index.ts`'s established required-vs-optional-input pattern exactly: `best-efforts.json` and the committed WMA tables are genuine repository defects if absent (throw); the private config's absence is the *normal* CI state (degrade, never throw) — matching T-18-AVAIL-02's disposition in the threat model.
- Did not register a `compute-age-grading` CLI subcommand in `src/index.ts` — out of this plan's `files_modified` scope (only `compute-age-grading.ts` and its test were named), and the plan's own verify command invokes the exported function directly rather than through the CLI.

## Deviations from Plan

None — plan executed exactly as written, including both required acceptance-criteria negative controls (deleting `data/wma/road-factors.json` and running with/without a temporary private config).

### Regenerated `best-efforts.json` (stale-data warning compliance)

Per the plan's `<stale_data_warning>`, rebuilt before trusting any record number:
- `generatedAt`: `2026-08-11T19:58:45.717Z`
- `totals`: `{"activitiesConsidered":1843,"activitiesWithEfforts":1842,"effortsComputed":8811,"effortsRejected":34,"effortsExcluded":11,"lowConfidenceEfforts":180,"skippedNoStream":25,"skippedUnreadable":0}`

### Live-archive verification observations

- Disabled path (no `data/private/athlete-private.json`, the state the phase ships in): `enabled false`, `disabledReason` = `"Age-grading is off — add birthDate and sex to data/private/athlete-private.json to enable it."` (character-for-character match to the Copywriting Contract).
- Enabled path (temporary private config, created then deleted): `5k` top age-grade `67.3%`; `1k` top entry `derived: true`; per-distance rankings graded — `400m`:10, `1k`:10, `1mi`:10, `5k`:10, `10k`:10, `half`:10, `marathon`:0 (no marathon PRs in the archive, matching CONTEXT.md's prior finding); 1843/1843 activities graded; 0 `resolveAgeGrade` calls returned `null`.
- Item 93's directional pair search (materially different `startDate` years, near-identical `durationSec`, same distance) found no *exact*-duration match in the live archive, but two near-identical-duration pairs (`400m` rank 8 vs 9: `durationSec` 60.3s vs 62.1s, 4-year gap, `agePercent` 72.9 vs 72.6; `10k` rank 4 vs 5: `durationSec` 2678.4s vs 2679.2s, 5-year gap, `agePercent` 60.2 vs 59.2) confirming the percentages do vary with effort date. Per the plan's own fallback instruction, the precise directional assertion (identical `durationSec`, older-at-effort-time grades higher) is pinned in Task 2's fixture suite (case 3) instead, as no exact match exists in the live archive.
- Deleting `data/wma/road-factors.json` threw: `Could not load committed WMA factor tables from data/wma (File not found: .../data/wma/road-factors.json); these are committed repository files — regenerate them with `scripts/convert-wma-tables.mjs` or restore them from git.` File restored, `git status --short data/wma/` confirmed clean, re-verified green.

## Issues Encountered

- Running `npm run compute-all-stats` (needed to populate `data/stats/year-over-year.json` for an unrelated pre-existing test, `trends-yoy-logic.test.ts`, to pass) produced an incidental `data/geo/geo-metadata.json` timestamp-only diff as a side effect — reverted via `git checkout -- data/geo/geo-metadata.json` before committing, same precedent as plan 18-01's summary. Not a plan deviation; out of this plan's file scope.

## User Setup Required

None — the phase continues to pass with `data/private/athlete-private.json` absent (the disabled path is the CI-normal path).

## Next Phase Readiness

- `data/stats/age-grading.json` is ready for the Records page's age-grade column (D-10) and the detail view's per-effort age-grade display, once a downstream plan builds that UI.
- No blockers identified for downstream plans in this phase.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
