---
phase: 18-records-trends-differentiators
plan: 11
subsystem: infra
tags: [cli, ci, build-pipeline, publish-verifier, data-contract]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    plan: 01
    provides: "expect200/expect404 assertion primitives, copyDataFiles data/wma entry, assertNoPrivateArtifacts build guard"
  - phase: 18-records-trends-differentiators
    plan: 05
    provides: "src/analytics/compute-gear-aggregate.ts (computeGearAggregate), gearName on the dashboard index"
  - phase: 18-records-trends-differentiators
    plan: 07
    provides: "src/analytics/compute-training-load.ts (computeTrainingLoad), data/stats/training-load.json contract"
  - phase: 18-records-trends-differentiators
    plan: 08
    provides: "src/analytics/compute-age-grading.ts (computeAgeGrading), data/stats/age-grading.json contract"
provides:
  - "compute-training-load / compute-age-grading / compute-gear-aggregate CLI subcommands, wired into compute-all-stats in dependency order"
  - "Nightly CI generation of all three new data files before build-widgets"
  - "Publish-time reachability + shape assertions for every file this phase adds (training-load.json, age-grading.json, gear-aggregate.json, road/track-factors.json, dashboard index gearName)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-file, four-touch-point CLI subcommand wiring (async command function, switch case, help-text line, compute-all-stats chain entry) reused a third and fourth and fifth time, matching the existing computeBestEfforts/computeDashboardIndex precedent"
    - "Per-step continue-on-error + warn CI steps, matching the existing compute-best-efforts/compute-dashboard-index pattern, rather than collapsing into one compute-all-stats CI call"
    - "Publish-verifier assertions match JSON keys (quoted-key-plus-colon), not raw substrings, when scanning for identity-field leaks in prose-bearing documents"

key-files:
  created: []
  modified:
    - src/index.ts
    - package.json
    - .github/workflows/daily-refresh.yml
    - scripts/verify-dashboard-publish.mjs

key-decisions:
  - "compute-all-stats chain order: basic -> advanced -> geo -> best-efforts -> age-grading -> dashboard-index -> gear-aggregate -> training-load. compute-dashboard-index is newly added to this chain (previously only a standalone CI step) because compute-gear-aggregate depends on its output. compute-training-load runs last because it depends only on the stream manifest, mirroring why compute-best-efforts used to run last."
  - "Used computeGearAggregate's actual option name (outDir) rather than the plan action text's literal 'statsDir' — the plan's prose named the wrong key; the compute step's real ComputeGearAggregateOptions contract (confirmed by reading the file) takes indexPath/outDir."
  - "age-grading.json's identity-leak guard matches JSON keys (\"birthDate\":, \"restingHr\":, \"sex\":) rather than raw substrings — see Deviations."

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-08-11
---

# Phase 18 Plan 11: Wire Compute Steps, CI & Publish Verifier Summary

**Three new compute steps (`compute-training-load`/`compute-age-grading`/`compute-gear-aggregate`) registered as CLI subcommands and wired into `compute-all-stats` in dependency order, generated nightly in CI before the publish build, and asserted reachable and correctly shaped at their production URLs by an extended `verify-dashboard-publish.mjs` (37 checks, up from 25).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-11
- **Tasks:** 3/3
- **Files modified:** 4 (all pre-existing, no new files)

## Accomplishments

- `src/index.ts` gained `computeTrainingLoadCommand`, `computeAgeGradingCommand`, `computeGearAggregateCommand`, each a structural copy of `computeBestEffortsCommand`, plus matching `switch` cases, help-text lines, and Examples-block lines.
- `compute-all-stats` now runs all eight steps from a clean state in dependency-correct order — verified by deleting `data/stats/age-grading.json`, `data/stats/gear-aggregate.json`, and `data/dashboard/index.json` and confirming a single `compute-all-stats` run recreates all three.
- `package.json` gained `compute-training-load`/`compute-age-grading`/`compute-gear-aggregate` npm script wrappers.
- `.github/workflows/daily-refresh.yml` gained three new per-step, continue-on-error CI steps between `compute-dashboard-index` and `build-widgets`, each with a warn-on-failure follow-up step matching the existing `compute-best-efforts`/`compute-dashboard-index` convention. The age-grading step carries an explicit comment that `enabled: false` in CI is expected, not a defect.
- `scripts/verify-dashboard-publish.mjs` gained positive shape assertions for `/data/stats/training-load.json`, `/data/stats/age-grading.json`, `/data/stats/gear-aggregate.json`, `/data/wma/road-factors.json`, `/data/wma/track-factors.json`, and an extension to the existing `/data/dashboard/index.json` check asserting `gearName` survives publication with no leaked raw gear id. Total assertion count: 25 (before) -> 37 (after).
- Both required negative controls run live, observed failing with the expected message and exit code, then reverted to a clean `git diff` and re-verified green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register three CLI subcommands and extend the compute-all-stats chain** - `3bcc604` (feat)
2. **Task 2: Generate the new files in the nightly CI workflow** - `fffbaca` (feat)
3. **Task 3: Assert every new data file is reachable and correctly shaped in production** - `057aab4` (feat)

_No plan-metadata commit in worktree mode — SUMMARY.md is committed separately below per worktree protocol._

## Files Created/Modified

- `src/index.ts` - three new command functions, three new `switch` cases, help-text/Examples lines, `compute-all-stats` chain extended to 8 steps with an ordering-rationale comment
- `package.json` - three new npm script entries (`compute-training-load`, `compute-age-grading`, `compute-gear-aggregate`)
- `.github/workflows/daily-refresh.yml` - three new steps (`Compute age grading`, `Compute gear aggregate`, `Compute training load`) plus matching warn-on-failure steps, inserted between `Compute dashboard index` and `Build widgets`; commit/push step and `on:` trigger block untouched
- `scripts/verify-dashboard-publish.mjs` - six new positive assertion blocks (training-load, age-grading + identity-leak guard, gear-aggregate, two WMA tables) plus an extension to the existing dashboard-index check for `gearName`

## Decisions Made

- Followed `computeBestEffortsCommand`'s exact structural shape for all three new command functions, per the plan's own `<read_first>` instruction and `18-PATTERNS.md`'s CLI-wiring pattern.
- `compute-dashboard-index` is now genuinely part of `compute-all-stats` (it was previously only invoked as a standalone CI step) — required because `compute-gear-aggregate` reads its output, matching the plan's explicit dependency ordering.
- Used `computeGearAggregate`'s real option name `outDir` (confirmed by reading `src/analytics/compute-gear-aggregate.ts`'s `ComputeGearAggregateOptions` interface) rather than the plan's action-text literal `statsDir`, which does not exist on that interface — using the real option name doesn't change behavior (both default to `data/stats`) but is the more correct wiring.
- Did not collapse the three new CI steps into a single `compute-all-stats` CI call — the plan explicitly required per-step failure attribution, matching the existing `compute-best-efforts`/`compute-dashboard-index` steps' shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] age-grading.json identity-leak guard false-positived on its own required Copywriting Contract prose**
- **Found during:** Task 3, first `npm run verify-dashboard` run after adding all six new assertion blocks
- **Issue:** The plan's action text specified asserting the `/data/stats/age-grading.json` body does not contain the substrings `birthDate`, `restingHr`, or `"sex"`. In CI's normal, expected state (`enabled: false`, no private config present — the exact state Task 3's own acceptance criteria requires this assertion to pass against), the document's `disabledReason` field is the literal Copywriting Contract string `"Age-grading is off — add birthDate and sex to data/private/athlete-private.json to enable it."` (plan 18-08's shipped, tested string). A raw substring match against `birthDate`/`sex` therefore always fails on the CI-normal document, which is exactly the local-shape trap (T-18-VERIFY-01) this same plan's threat model requires the assertion to avoid.
- **Fix:** Changed the match from raw substrings to quoted-JSON-key patterns (`"birthDate":`, `"restingHr":`, `"sex":`) — this still catches the real regression class (an actual identity field value published as a JSON property) while not matching legitimate prose that merely names the field in user-facing copy. Confirmed the published document never contains these keys in either the enabled or disabled state (0 matches in both).
- **Files modified:** `scripts/verify-dashboard-publish.mjs`
- **Verification:** `npm run verify-dashboard` — the specific check (`age-grading.json body has no birthDate/restingHr/sex JSON keys`) passes against the live CI-normal (`enabled: false`) document; the full gate is 37/37 green.
- **Committed in:** `057aab4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in the assertion's own literal reading of the plan text, caught by running it against the actual shipped document before committing)
**Impact on plan:** No scope creep. The fix preserves the assertion's stated purpose (a second, independent line of defence against identity-field leaks) while making it compatible with the CI-normal state the plan's own acceptance criteria require it to pass against.

### Negative Control Observations (Task 3)

**Negative control A** — removed the `{ src: 'data/wma', ... }` entry from `copyDataFiles` in `scripts/build-widgets.mjs`, deleted the stale `dist/widgets/data/wma/` directory left over from a prior build (build-widgets does not delete directories no longer listed — a genuine copy-list removal only stops future updates, so the stale directory had to be removed manually to produce a true negative), then ran `npm run build-widgets && npm run verify-dashboard`:
- **Exit code:** 1
- **Message:** `✗ GET /data/wma/road-factors.json expected 200, got 404` and `✗ GET /data/wma/track-factors.json expected 200, got 404`
- **Result:** 33 checks passed, 2 failures — both new WMA assertions failed exactly as expected.
- Restored `build-widgets.mjs` (confirmed `git diff scripts/build-widgets.mjs` empty against HEAD), rebuilt, re-verified: 37/37 green.

**Negative control B** — deleted `data/stats/gear-aggregate.json` and the stale `dist/widgets/data/stats/gear-aggregate.json`, then ran `npm run build-widgets && npm run verify-dashboard`:
- **Exit code:** 1
- **Message:** `✗ GET /data/stats/gear-aggregate.json expected 200, got 404`
- **Result:** 35 checks passed, 1 failure.
- Restored by re-running `node dist/index.js compute-gear-aggregate`, rebuilt, re-verified: 37/37 green.

### Verify-dashboard assertion count

- **Before this plan:** 25 checks passed, 0 failures (confirmed by running the pre-Task-3 script version against the live archive).
- **After this plan:** 37 checks passed, 0 failures.
- **Net new:** 12 assertions across training-load, age-grading (2, including the identity-leak guard), gear-aggregate, both WMA tables (2), and the dashboard-index `gearName` extension.

## Issues Encountered

- Running `compute-all-stats` and `compute-geo-stats` (as part of the verification chain) produced an incidental `data/geo/geo-metadata.json` timestamp-only diff each time — reverted via `git checkout -- data/geo/geo-metadata.json` before each commit, matching the exact precedent in plans 18-01/18-05/18-08's summaries. Not a plan deviation; out of this plan's file scope.
- `dist/widgets/` is not fully cleaned between `build-widgets` runs — a `copyDataFiles` entry removed from the list does not delete files already copied by a prior run. Both negative controls required manually removing the stale published artifact to get a true negative signal rather than a false pass from leftover state. This is pre-existing `build-widgets.mjs` behavior, out of this plan's file scope, and did not affect the final shipped state (only the developer-run negative-control procedure).

## User Setup Required

None — no external service configuration required. The phase continues to pass with `data/private/athlete-private.json` absent, exactly as designed; `compute-age-grading` and the Banister half of `compute-training-load` both correctly report their disabled states.

## Verification

- `npm run build && npm test && npm run build-widgets && npm run verify-dashboard` — green end to end (838/838 tests, 37/37 publish checks).
- `compute-all-stats` regenerates `data/stats/age-grading.json`, `data/stats/gear-aggregate.json`, and `data/dashboard/index.json` from a clean state (all three deleted, one `compute-all-stats` run recreates all three) in dependency-correct order.
- Both negative controls observed failing (exit 1, naming the missing file), then reverted to a clean `git diff` and re-verified green.
- `.github/workflows/daily-refresh.yml`'s `on:` trigger block and commit/push step are byte-identical to before (`git diff` shows only added steps and comments).
- `npm run compute-training-load` (npm script wrapper) exits 0.

## Next Phase Readiness

- Every data file this phase's build steps produce (training-load.json, age-grading.json, gear-aggregate.json) is now generated by both the local `compute-all-stats` chain and the nightly CI workflow, and is provably reachable and correctly shaped at its production URL.
- The two committed WMA factor tables (`data/wma/*.json`) are confirmed to survive `copyDataFiles` and are asserted at their production URL — closing the "committed file silently dropped from the copy list" failure class this plan's threat model names (T-18-AVAIL-03).
- No blockers for downstream plans. Any UI plan reading these three `data/stats/*.json` files can rely on them being present in production, not just on a developer's machine.

## Self-Check: PASSED

All four modified files (`src/index.ts`, `package.json`, `.github/workflows/daily-refresh.yml`, `scripts/verify-dashboard-publish.mjs`) confirmed present and containing the expected changes on disk. All three task commit hashes (`3bcc604`, `fffbaca`, `057aab4`) confirmed present in `git log --oneline`.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
