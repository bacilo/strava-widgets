---
phase: 28-pr-plausibility-ceiling
plan: "06"
subsystem: analytics
tags: [best-efforts, pr-ceiling, ci, state-file, audit-trail, github-actions]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "03"
    provides: "CEILING_K/CEILING_MIN_POPULATION, deriveCeilings/ceilingDemotion, CeilingDerivation shape"
  - phase: 28-pr-plausibility-ceiling
    plan: "05"
    provides: "the three-pass compute-best-efforts.ts shape; doc.ceilings populated with real CeilingDerivation output"
provides:
  - "best-effort-ceiling-state.ts: loadCeilingState/buildCeilingStateFile/diffCeilingState/formatCeilingMovement — a never-throwing load/build/diff/format module for the committed ceiling state"
  - "compute-best-efforts.ts wired to load the previous state read-only, diff it against the fresh derivation, print the movement (or an explicit unchanged line), and write the state file ONLY when something moved"
  - "data/best-effort-ceiling.json seeded from a live run over the real 1,865-activity archive"
  - "daily-refresh.yml's existing git-auto-commit-action file_pattern extended by one glob, no new step, no new push"
affects: [28-07-before-after-diff, 28-08-cohort-recount, 28-09-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "loadCeilingState mirrors loadExclusions's try/catch-and-warn shape exactly (T-16-EX-01's discipline carried into T-28-06-A), including per-entry (per-distance) skip-one-bad-row validation"
    - "A read-only previous-state input consulted ONLY at the reporting seam, never at the derivation seam — enforced by naming the variable `previousState` so a source-text grep can assert no line contains both that identifier and `deriveCeilings`"
    - "Conditional write gated on a non-empty diff array, so an unchanged nightly run produces zero git diff and therefore no commit — avoiding a second CI push race"

key-files:
  created:
    - src/analytics/best-effort-ceiling-state.ts
    - src/analytics/best-effort-ceiling-state.test.ts
    - data/best-effort-ceiling.json
  modified:
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - .github/workflows/daily-refresh.yml

key-decisions:
  - "The variable holding the loaded previous state is named exactly `previousState` (not `previousCeilingState`) because Task 2's own acceptance criterion greps the literal string `previousState` for the no-deriveCeilings-co-occurrence audit"
  - "Every pre-existing computeBestEfforts() call site in compute-best-efforts.test.ts (22 sites) was given its own tmp-dir ceilingStatePath, discovered necessary only after a first test run silently wrote a real data/best-effort-ceiling.json into the working tree via the new option's un-overridden default — the tests had no reason to know about a file the plan hadn't wired in yet"
  - "diffCeilingState's per-distance 'first-run' kind is distinct from the whole-file first-run aggregate row: a distance individually skipped by loadCeilingState (one malformed entry) gets its own per-distance first-run row, while previous===null collapses to exactly one aggregate row with distance: null, per the plan's own 'not seven noisy rows' instruction"
  - "formatCeilingMovement renders `null` values as the literal 'n/a' rather than throwing on .toFixed(), since became-fail-open/became-derivable/first-run rows always have one null side by construction"

requirements-completed: [PR-01, PR-04]

# Metrics
duration: ~25min
completed: 2026-09-11
---

# Phase 28 Plan 06: Committed Ceiling State & Drift Reporting Summary

**A never-throwing `best-effort-ceiling-state.ts` module persists the derived per-distance PR ceiling into a committed `data/best-effort-ceiling.json`, diffs every run against it, and reports the movement in words with numbers — seeded from a live run over the real 1,865-activity archive (400m 5.1098 m/s / 1k 4.7513 m/s / 1mi 4.6323 m/s / 5k 4.3458 m/s / 10k 4.2236 m/s / half 4.4017 m/s / marathon fail-open), with a second run confirmed byte-identical (sha1 unchanged) and reporting "unchanged at every distance."**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 6 (2 created source files + test, compute-best-efforts.ts + its test, the seeded JSON, the CI workflow)

## Accomplishments

- `src/analytics/best-effort-ceiling-state.ts` exports `loadCeilingState` (never throws — missing file, invalid JSON, wrong `schemaVersion`, missing `ceilings` object, or an individually malformed per-distance entry all degrade to `null` or a per-distance skip, each after a `console.warn`), `buildCeilingStateFile` (projects `CeilingDerivation` down to the three persisted fields, iterating `TARGET_ORDER` for a diff-stable file), `diffCeilingState` (exact-equality comparison, never epsilon; `previous === null` collapses to one aggregate `first-run` row instead of seven), and `formatCeilingMovement` (house-register console lines, one per row).
- `compute-best-efforts.ts` now loads `previousState` once before Pass 2 (read-only; a comment and a naming convention both make it impossible for `deriveCeilings` to consult it), and after Pass 3 diffs the fresh derivation against it, extending the existing console tail with a movement section or an explicit "unchanged at every distance" line, then writes `data/best-effort-ceiling.json` CONDITIONALLY — only when the diff is non-empty.
- `data/best-effort-ceiling.json` seeded by running `npm run build && npm run compute-best-efforts` against the live committed archive (1,865 activities considered) and committing the file it produced; a second run confirmed the file byte-unmodified (identical sha1 before and after) and the console reporting "unchanged at every distance."
- `.github/workflows/daily-refresh.yml`'s single existing `git-auto-commit-action` step's `file_pattern` gained one glob (`data/best-effort-ceiling.json`); no second commit/push step, no change to the pinned action SHA or `commit_message`, no skip-CI token introduced in any added line.
- Confirmed and stated explicitly: `COMPUTE_ALL_STATS_STEPS` (`src/compute-all-stats-steps.ts`) needed no new entry — `compute-best-efforts` is already step 4 in that chain and now writes the ceiling-state file as part of that same step's own work.

## Task Commits

Each task was committed atomically:

1. **Task 1: A never-throwing ceiling-state module — load, build, diff, format** - `b1cf2e26` (feat)
2. **Task 2: Wire the state file into the compute step, writing only when a ceiling actually moved** - `aad05c1d` (feat)
3. **Task 3: Extend the existing CI commit pattern — one glob, no second commit step** - `810e68ff` (chore)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `src/analytics/best-effort-ceiling-state.ts` - `loadCeilingState`, `buildCeilingStateFile`, `diffCeilingState`, `formatCeilingMovement`, `CeilingMovementRow`/`CeilingMovementKind` types
- `src/analytics/best-effort-ceiling-state.test.ts` - 21 tests: round trip, four corrupt-input cases (missing file, invalid JSON, wrong schemaVersion, one-malformed-distance), all five movement kinds, empty-diff and one-line-per-row invariants
- `src/analytics/compute-best-efforts.ts` - `ceilingStatePath` option, `previousState` load before Pass 2, `diffCeilingState`/`formatCeilingMovement` extending the console tail after Pass 3, conditional `writeJson` gated on non-empty diff
- `src/analytics/compute-best-efforts.test.ts` - added `ceilingStatePath` to all 22 pre-existing `computeBestEfforts()` call sites (see Deviations) plus a new "committed ceiling state" describe block: first-run file shape, second-run byte-identity, and a genuine-population-change producing an updated file
- `data/best-effort-ceiling.json` - seeded, tracked, committed; the live archive's per-distance ceiling snapshot
- `.github/workflows/daily-refresh.yml` - one glob appended to the existing `git-auto-commit-action` step's `file_pattern`, with an explanatory comment naming both D-07 hazards

## Decisions Made

See `key-decisions` in frontmatter. The most consequential one operationally: naming the loaded-state variable exactly `previousState` (not a more descriptive `previousCeilingState`) so Task 2's own literal-string acceptance-criteria grep passes without weakening what it actually verifies (no source line names both the previous state and `deriveCeilings`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Every pre-existing `computeBestEfforts()` test call site needed an explicit `ceilingStatePath` to avoid writing into the real repo tree**
- **Found during:** Task 2, first run of the untouched `compute-best-efforts.test.ts` suite after wiring in the new `ceilingStatePath` option
- **Issue:** `ceilingStatePath` defaults to `data/best-effort-ceiling.json`, resolved by `computeBestEfforts`'s own internal `new FileStore('.')` — i.e. relative to the real worktree root, not any test's `tmpDir`. None of the 24 pre-existing `computeBestEfforts()` call sites in the test file knew to override an option that didn't exist yet when they were written. Since `previousState` is `null` on a fresh checkout, `diffCeilingState(null, ...)` always returns exactly one `first-run` row (non-empty), so EVERY one of those 24 test calls triggered the new conditional write — into the real `data/best-effort-ceiling.json` in the worktree, observed directly (`git status --short` showed `?? data/best-effort-ceiling.json` after a single test run, before Task 2's own seeding step had ever run).
- **Fix:** Added `ceilingStatePath: path.join(tmpDir, 'ceiling-state.json')` to all 22 call sites that set `statsDir` directly (via a scripted insertion keyed on the `statsDir` line, preserving each site's own indentation), plus the shared `common` object used by the two-call determinism/order-independence tests. Re-ran the suite and confirmed `git status --short data/` was clean afterward.
- **Files modified:** `src/analytics/compute-best-efforts.test.ts`
- **Verification:** All 38 pre-existing tests still pass; `git status --short data/` empty both before and after `npx vitest run` and after a full `npm test`; the real `data/best-effort-ceiling.json` (seeded later in the same task, by design) verified byte-unmodified (identical sha1) across an `npm test` run.
- **Committed in:** `aad05c1d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a test-isolation bug the plan's own action text did not anticipate, since the option it introduces did not exist before this task). No scope creep: the fix only adds an isolating parameter to existing test calls: it does not change any test's assertions or the feature's own behavior.
**Impact on plan:** None of the plan's acceptance criteria were weakened. The deviation was necessary to prevent `npm test` from silently corrupting the very file Task 2's own seeding step was about to commit for real.

## Issues Encountered

- The plan's Task 3 verify command embeds a `git diff` call inside a `node -e` one-liner; this worktree's sandbox refuses to execute git invocations nested inside another command it cannot statically verify stays inside the worktree root. Ran the equivalent checks as separate shell steps instead (`git diff HEAD -- .github/workflows/daily-refresh.yml` piped to a temp file, then three separate `grep`/`grep -c` checks against that file) — functionally identical to the plan's verify command, all three passed (0, 0, and no skip-CI-token match respectively).
- Full `npm test` in this worktree shows the same 7 pre-existing, environment-only failing test files the orchestrator's own note for this wave names (missing `dist/`, missing gitignored `data/stats/*.json` compute-all-stats outputs, and a missing `chartjs-plugin-zoom` dist file absent from this worktree's `node_modules`) — none touch this plan's files, and 2,072 tests pass (0 regressions from this plan's changes).

## Live-archive verification (plan's own Task 2 requirement)

First run — `npm run build && npm run compute-best-efforts` against the real committed archive (1,865 activities considered). Console tail, verbatim:

```
Ceilings (Phase 28 PR-01/PR-02):
  400m: ceiling 5.1098 m/s (p90 3.9920 m/s over 1825), 8 demoted
  1k: ceiling 4.7513 m/s (p90 3.7120 m/s over 1843), 7 demoted
  1mi: ceiling 4.6323 m/s (p90 3.6189 m/s over 1842), 3 demoted
  5k: ceiling 4.3458 m/s (p90 3.3951 m/s over 1779), 0 demoted
  10k: ceiling 4.2236 m/s (p90 3.2997 m/s over 1459), 0 demoted
  half: ceiling 4.4017 m/s (p90 3.4388 m/s over 104), 0 demoted
  marathon: fail-open — population 0 below minimum 100 — no personal ceiling derived; world-record and max_speed guards still apply

Output written to: data/stats/best-efforts.json

Ceiling movement vs. previous committed run:
  first run — no previous ceiling state recorded; every distance will report its movement starting next run
  Committed ceiling state updated: data/best-effort-ceiling.json
```

Second run (same archive, unchanged) — console tail, verbatim:

```
Ceiling movement vs. previous committed run:
  unchanged at every distance
```

`sha1(data/best-effort-ceiling.json)` = `8f907c307def0de476de3bdcf3abe406bb5d5047` measured before and after the second run — identical, confirming the file was left byte-untouched. Re-confirmed a third time after a full `npm test` run: hash unchanged.

`data/best-effort-ceiling.json`'s seeded contents (verbatim):

```json
{
  "schemaVersion": 1,
  "note": "Machine-written. Exists because data/stats/ is gitignored and starts empty on every CI runner, so this file is the only durable record of the previous run's derived personal plausibility ceiling. Committed so a ceiling move is a blameable commit (Phase 28 D-06/D-07). Do not hand-edit; a malformed entry degrades that one distance to a warning, never an abort.",
  "generatedAt": "2026-09-10T22:41:35.197Z",
  "ceilings": {
    "400m": { "ceilingMps": 5.1098, "p90Mps": 3.992015968063872, "populationN": 1825 },
    "1k": { "ceilingMps": 4.7513, "p90Mps": 3.711952487008167, "populationN": 1843 },
    "1mi": { "ceilingMps": 4.6323, "p90Mps": 3.6189431077130654, "populationN": 1842 },
    "5k": { "ceilingMps": 4.3458, "p90Mps": 3.395124601072859, "populationN": 1779 },
    "10k": { "ceilingMps": 4.2236, "p90Mps": 3.2996766316900943, "populationN": 1459 },
    "half": { "ceilingMps": 4.4017, "p90Mps": 3.4388192531499078, "populationN": 104 },
    "marathon": { "ceilingMps": null, "p90Mps": null, "populationN": 0 }
  }
}
```

These match `28-CEILING-CALIBRATION.md`'s "Resulting coverage and demotions" table exactly, and reproduce 28-05-SUMMARY.md's own live-run values byte-for-byte (same archive, same day) — confirming this plan's wiring did not alter what plan 28-05 already ships.

**Final `file_pattern` string** (verbatim, from `.github/workflows/daily-refresh.yml`):

```
data/activities/*.json data/sync-state.json data/geo/*.json data/streams/*.json data/best-effort-ceiling.json
```

**`COMPUTE_ALL_STATS_STEPS` needed no new entry** — stated explicitly per the plan's own requirement: `compute-best-efforts` is already step 4 of the ordered chain declared in `src/compute-all-stats-steps.ts`, and this plan's change lives entirely inside that step's own function body (it loads, diffs, reports and conditionally writes the ceiling-state file as part of the same `computeBestEfforts()` call CI already runs) — no new invocation, no new ordering dependency, nothing for that chain's single source of truth to declare.

## Known Stubs

None — every export (`loadCeilingState`, `buildCeilingStateFile`, `diffCeilingState`, `formatCeilingMovement`) is fully implemented against its stated contract and exercised against both synthetic fixtures and the real archive.

## Threat Flags

None. All six threats named in this plan's `<threat_model>` (T-28-06-A parse DoS, T-28-06-B tampering via the derived ceiling's input, T-28-06-C CI push-race DoS, T-28-06-D skip-CI-token DoS, T-28-06-E repudiation, T-28-06-SC package-install tampering) are exactly the surfaces this plan's own code touches: `loadCeilingState` is total and never-throwing with four deliberately-corrupt test cases; `previousState` is verified by source-text audit to never co-occur with `deriveCeilings`; the state file writes only on a non-empty diff and rides the single existing auto-commit step; no added workflow line contains the skip-CI token (mechanically verified); every run prints a movement section or an explicit unchanged line; and zero packages were installed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `data/best-effort-ceiling.json` is committed and tracked, giving plan 28-07's before/after diff script (`scripts/compute-pr-ceiling-diff.mjs`, built concurrently by another wave-4 agent) a durable, git-blameable previous-run value to reconcile against — this plan does not touch `package.json` or that script, per the wave's file-ownership split.
- The live archive's ceiling numbers (400m 5.1098 / 1k 4.7513 / 1mi 4.6323 / 5k 4.3458 / 10k 4.2236 / half 4.4017 m/s, marathon fail-open) are now the committed baseline any future run's movement report will be measured against — a genuine ceiling move (new activities pushing a distance's p90) will show up as a real, reviewable diff in `data/best-effort-ceiling.json` on its very next nightly run.
- The CI wiring is additive and minimal: one glob, no new step, no new push, `COMPUTE_ALL_STATS_STEPS` untouched — nothing here should require touch-up from a later phase unless the ceiling-state file's own schema needs to evolve (which `schemaVersion` exists to gate).

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-11*

## Self-Check: PASSED

All created/modified files verified present on disk: `src/analytics/best-effort-ceiling-state.ts`,
`src/analytics/best-effort-ceiling-state.test.ts`, `data/best-effort-ceiling.json`,
`src/analytics/compute-best-efforts.ts`, `src/analytics/compute-best-efforts.test.ts`,
`.github/workflows/daily-refresh.yml`, and this summary. All three task commits (`b1cf2e26`,
`aad05c1d`, `810e68ff`) confirmed present in `git log --oneline --all`. No missing items.
