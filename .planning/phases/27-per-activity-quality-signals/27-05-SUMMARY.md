---
phase: 27-per-activity-quality-signals
plan: 05
subsystem: testing
tags: [independent-verification, classifier-free-recount, roadmap-criterion-4a, d-03, vitest]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-03's calibration report (299/154/127/31, live denominators 1890/1865/25) and 27-04's shipped data/dashboard/index.json row/totals shape (quality.{decimation,gapProfile,impossibleSamples,deviceEra,elapsedVsMoving}, totals.qualityAnySevere/qualityNotComputable)"
provides:
  - "scripts/compute-pace-quality-recount.mjs — the standalone, classifier-free verifier ROADMAP Criterion 4a requires: reads data/dashboard/index.json off disk (readFileSync + JSON.parse only), recounts the severe-tier composite from the three raw tier strings, cross-checks against totals.qualityAnySevere and each row's own anySevere flag, and exits non-zero naming offending ids on any disagreement"
  - "npm run compute-pace-quality-recount (no npm run build prefix, deliberately) and a --expect <n> CI/checkpoint pin"
  - "scripts/compute-pace-quality-recount.test.mjs — 11 cases proving the recount discriminates in both directions, including the exact 'summary flag survives, tier field silently stops being emitted' regression D-03 targets"
affects: [27-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classifier-free recount: reads only the published JSON artifact, never imports the module that produced it, by any spelling — enforced by a grep gate and by the npm script carrying no `npm run build` prefix"
    - "Pure counting function + guarded main() (mirrors compute-pace-residual.mjs), so the test suite drives the arithmetic on hand-built documents without a real file read"

key-files:
  created:
    - scripts/compute-pace-quality-recount.mjs
    - scripts/compute-pace-quality-recount.test.mjs
  modified:
    - package.json

key-decisions:
  - "Read path for local worktree verification: this worktree does not carry the gitignored data/dashboard/index.json. Rather than modifying the script's read path or hardcoding a worktree-specific override, a symlink (data/dashboard/index.json -> the live shipped file at the main checkout) was created inside this worktree's own gitignored data/dashboard/ directory purely for local verification. It is read-only, untracked (git status confirms it never appears), and was not part of any commit."
  - "Fixed a header-comment false positive against the plan's own literal grep acceptance check (`import.*pace-quality`): the prose originally read '...this file imports nothing from `src/analytics/pace-quality.ts`...', which the regex matched as a false hit on the WORDS 'imports' + 'pace-quality' even though there is no actual import statement. Reworded to describe the prohibition without using the word 'import' adjacent to the module name, preserving the exact meaning."
  - "Added an `anySevereFlagCount` field to the report (count of rows with `quality.anySevere === true`) rather than deriving it algebraically from `ownComposite` and `compositeDisagreementIds.length` in the stdout print statement, after noticing the algebraic form was a tautology (always equal to `ownComposite` by construction) rather than an independently-computed number."

requirements-completed: [QUAL-05]

# Metrics
duration: ~40min
completed: 2026-09-10
---

# Phase 27 Plan 05: D-03's Independent Pace-Quality Recount Summary

**Standalone script recomputes the severe-tier composite straight from the shipped `data/dashboard/index.json`'s raw tier strings — zero imports of `src/analytics/pace-quality.ts` or its `dist/` output by any spelling — and reproduces 299 exactly against the live archive, matching `27-CALIBRATION.md` section 4's per-signal cohorts (154/127/31) and the composite to the digit; 11 vitest cases prove it can also fail, including the precise "summary flag survives while the tier field stops being emitted" regression D-03 exists to catch.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `scripts/compute-pace-quality-recount.mjs` reads `data/dashboard/index.json` with `readFileSync` + `JSON.parse` only, recounts the composite from `quality.{decimation,gapProfile,impossibleSamples}.tier === 'severe'` (never reading `row.quality.anySevere` as the answer), and cross-checks that recount against both `totals.qualityAnySevere` and the per-row `anySevere` flag independently.
- Verified live against the shipped index (see "Recount stdout against the live index" below): **299** — exact match against `27-CALIBRATION.md` section 4, with identical per-signal cohorts (154 decimation / 127 gapProfile / 31 impossibleSamples) and identical live denominators (1,890 activities / 1,865 with a computable stream / 25 not computable).
- Zero imports of the classifier by any spelling: `grep -c "import.*pace-quality\|require.*pace-quality\|from '.*dist/" scripts/compute-pace-quality-recount.mjs` returns 0. Its npm script (`compute-pace-quality-recount`) carries no `npm run build` prefix, confirmed by `node -e "...⁄build⁄.test(s)"` exiting 0.
- `scripts/compute-pace-quality-recount.test.mjs` (11 tests, all passing): union semantics (3 distinct severe rows → 3; one row severe on all three signals → 1, not 3, ruling out a marginal-sum bug), a not-computable row excluded from the composite, all three required mutation cases (each asserting clean-passes AND mutated-fails on the SAME document), the `--expect` predicate (match/off-by-one), a `schemaVersion`/totals cross-check, and an import-time guard proving the module performs no `fs.readFileSync` merely by being imported.

## Task Commits

Each task was committed atomically:

1. **Task 1: The independent recount script** - `61bf1002` (feat)
2. **Task 2: Prove the recount can disagree** - `9ba7864e` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below) — per this plan's instructions, STATE.md/ROADMAP.md are NOT touched here; the orchestrator owns those writes.

## Files Created/Modified

- `scripts/compute-pace-quality-recount.mjs` — The classifier-free recount: `readShippedIndex` (readFileSync + JSON.parse, never throws — returns `{ok:false, reason}` on failure), `recountComposite` (pure arithmetic over `doc.activities`, tracking per-signal severe counts, the union composite, missing-field/invalid-tier ids, and both cross-checks), `evaluateReport` (assembles the pass/fail verdict plus an optional `--expect` pin), and a guarded `main()` printing both denominators, the three per-signal counts, the composite against both cross-checks, and exiting non-zero on any disagreement.
- `scripts/compute-pace-quality-recount.test.mjs` — 11 cases across 5 describe blocks (union semantics, mutation cases, `--expect`, schemaVersion/totals cross-check, import-time side effects), all driven off hand-built documents via `cleanQuality`/`notComputableQuality`/`row`/`doc` helpers.
- `package.json` — Added `"compute-pace-quality-recount": "node scripts/compute-pace-quality-recount.mjs"`, deliberately with no `npm run build &&` prefix (building first and importing the classifier is exactly what D-03 forbids).

## Recount Stdout Against the Live Index

Run from this worktree, reading the live shipped `data/dashboard/index.json` (verified via a local read-only symlink into the main checkout's `data/dashboard/index.json` — see "Live Archive Path" below):

```
$ node scripts/compute-pace-quality-recount.mjs
D-03 independent recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows (activity-count denominator): 1890
Rows with a computable stream (notComputableReason === null): 1865
Not-computable count: 25
Per-signal severe counts (own arithmetic, tier === 'severe'):
  decimation:        154
  gapProfile:        127
  impossibleSamples: 31
Recomputed composite (own arithmetic, union of the three tiers): 299
  vs. totals.qualityAnySevere:        299
  vs. count of row.quality.anySevere:  299

PASS: recount agrees with the shipped totals; no disagreements found.
EXIT=0
```

With the CI/checkpoint pin:

```
$ node scripts/compute-pace-quality-recount.mjs --expect 299
...
--expect 299: MATCH

PASS: recount agrees with the shipped totals; no disagreements found.
EXIT=0
```

## Comparison Against `27-CALIBRATION.md` Section 4

**MATCH — exact, no delta.**

| Figure | This recount (live) | `27-CALIBRATION.md` §4 | Match |
|---|---|---|---|
| Activity count | 1890 | 1890 | Yes |
| Stream-count denominator | 1865 | 1865 | Yes |
| Not-computable count | 25 | 25 | Yes |
| Decimation severe | 154 | 154 | Yes |
| Gap profile severe | 127 | 127 | Yes |
| Impossible-sample severe | 31 | 31 | Yes |
| **Composite (any severe)** | **299** | **299** | **Yes** |

This is the recount's own arithmetic (union of three raw tier strings) reaching the exact same numbers as the classifier sweep in `27-CALIBRATION.md` (Task 1) and 27-04's independent index re-read — the fourth independently-executed path to reproduce 299, none sharing code with any of the other three. **No adjustment was made to the script to reach this number; it matched on the first run.**

## Live Archive Path

Per this plan's parallel-execution instructions, the isolated worktree does not carry the gitignored `data/` tree. Numbers above come from `/Users/pedf/workspace/strava-widgets/data/dashboard/index.json` (the shipped index at the main checkout), verified directly with a read-only `node -e` before writing the script:

```
schemaVersion 1
activities.length 1890
totals {"activities":1890,"withStreams":1865,"withoutStreams":25, ... ,"qualityAnySevere":299,"qualityNotComputable":25}
```

For local execution of the script inside this worktree (never for a commit), a symlink was created at `data/dashboard/index.json` pointing at the live file — `data/dashboard/` is gitignored (`.git/info/exclude` and the repo's own `.gitignore`), confirmed absent from `git status --short` throughout, and not part of either task commit.

## Demonstrated-Failing Runs (verbatim, per acceptance criteria)

All three mutation cases are proven at the pure-function level (`recountComposite` + `evaluateReport`, no file I/O) inside `scripts/compute-pace-quality-recount.test.mjs`, per the task's explicit instruction that the test "must not run `main()` or read the real index." The exact `evaluateReport` output for each case, captured from a throwaway scratch run (not committed) driving the same helpers the test file uses:

**(a) Tier flip `severe` → `none` while `anySevere` stays `true` — the exact regression D-03 targets:**
```
CLEAN:   {"pass":true,"problems":[]}
MUTATED: {"pass":false,"problems":[
  "recomputed composite (0) disagrees with totals.qualityAnySevere (1)",
  "1 row(s) disagree between the recomputed tier-based verdict and their own \"anySevere\" flag: victim"
]}
```

**(b) Delete `quality` entirely from one row:**
```
CLEAN:   {"pass":true,"problems":[]}
MUTATED: {"pass":false,"problems":[
  "1 row(s) missing \"quality\" or one of its five named sub-objects: has-quality"
]}
```

**(c) Set one tier to the invalid string `'critical'`:**
```
CLEAN:   {"pass":true,"problems":[]}
MUTATED: {"pass":false,"problems":[
  "1 row(s) have a tier string outside the closed set (none/minor/severe/not-computable): a"
]}
```

Each case's clean counterpart passes and the mutated copy of the SAME document fails, naming the offending id — proving the check discriminates in both directions, not just one.

`npx vitest run scripts/compute-pace-quality-recount.test.mjs`: **11/11 passed.**

## Decisions Made

See `key-decisions` in frontmatter. Summary:

- Used a local, gitignored, read-only symlink (`data/dashboard/index.json` → the main checkout's live file) purely to exercise the script inside this isolated worktree; never committed, never written to.
- Reworded one header-comment sentence that produced a false-positive match against the plan's own literal `grep -c "import.*pace-quality..."` acceptance check (the prose said "imports nothing from `pace-quality.ts`", which the regex matched on the words alone, not an actual import statement) — meaning unchanged, regex now correctly returns 0.
- Added `anySevereFlagCount` as its own independently-tracked counter rather than deriving the printed "vs. count of row.quality.anySevere" figure algebraically from other fields (which would have been a tautology, always equal to `ownComposite` by construction and therefore not actually an independent check).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header comment triggered a false-positive match against the plan's own acceptance-criterion grep**

- **Found during:** Task 1, running the acceptance check `grep -c "import.*pace-quality\|require.*pace-quality\|from '.*dist/" scripts/compute-pace-quality-recount.mjs` after the file was first drafted; it returned 1 instead of the required 0.
- **Issue:** The header comment's prose read "this file imports nothing from `src/analytics/pace-quality.ts`" — the regex `import.*pace-quality` matched on the substring "imports" (containing "import") followed later on the same line by "pace-quality", even though there is no actual `import`/`require`/dynamic-`import()` statement anywhere in the file naming the classifier.
- **Fix:** Reworded the sentence to "this file has zero `import`/`require`/dynamic-`import()` statements naming the classifier module ... by any spelling" — same meaning, no longer matches the literal grep pattern.
- **Files modified:** `scripts/compute-pace-quality-recount.mjs`.
- **Verification:** `grep -c "import.*pace-quality\|require.*pace-quality\|from '.*dist/" scripts/compute-pace-quality-recount.mjs` returns 0 after the fix; re-ran `node scripts/compute-pace-quality-recount.mjs` to confirm the script's actual behavior was unaffected (still exits 0, still prints 299).
- **Committed in:** `61bf1002` (Task 1 commit — fixed before the initial commit, not a follow-up).

**2. [Rule 1 - Bug] Tautological "vs. count of row.quality.anySevere" stdout line**

- **Found during:** Task 1, reviewing the draft `main()` print statements before running the live verification.
- **Issue:** The line printing "vs. count of `row.quality.anySevere`" was computed as `report.ownComposite - report.compositeDisagreementIds.length + report.compositeDisagreementIds.length`, which algebraically always equals `report.ownComposite` regardless of the actual data — not an independent measurement, defeating the point of printing it as a cross-check.
- **Fix:** Added a real, independently-tracked `anySevereFlagCount` counter (incremented per-row when `quality.anySevere === true`, computed in the same loop but as its own accumulator, not derived from `ownComposite`) and printed that instead.
- **Files modified:** `scripts/compute-pace-quality-recount.mjs`.
- **Verification:** Live run still shows `vs. count of row.quality.anySevere: 299`, now backed by an independent counter rather than algebra; confirmed by inspection of the accumulator logic.
- **Committed in:** `61bf1002` (Task 1 commit — fixed before the initial commit, not a follow-up).

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes, both caught and corrected before the Task 1 commit — no follow-up commits needed).
**Impact on plan:** Both fixes are internal correctness/precision issues in the script's own header prose and stdout output; neither changes the script's read path, its arithmetic, or any acceptance-criterion result. No scope creep.

## Issues Encountered

None beyond the two auto-fixed issues documented above as deviations.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ROADMAP Criterion 4a's "standalone script counting top-tier flags from the shipped index reproduces the same count WITHOUT importing the classifier (D-03)" clause is now satisfied and independently verified: `scripts/compute-pace-quality-recount.mjs` reproduces 299 with zero imports of the classifier, demonstrated failing in both directions on three distinct mutations.
- Plan 27-10's browser checkpoint can invoke `npm run compute-pace-quality-recount -- --expect 299` directly to pin the number against `27-CALIBRATION.md` at checkpoint time, without the recount script itself ever reading that report (which would make it agree with the thing it is checking).
- No blockers for downstream plans. This plan touched only `scripts/compute-pace-quality-recount.mjs`, `scripts/compute-pace-quality-recount.test.mjs`, and `package.json` — no files owned by the parallel 27-06/27-07 worktrees were touched.

## Self-Check: PASSED

- `scripts/compute-pace-quality-recount.mjs` — FOUND.
- `scripts/compute-pace-quality-recount.test.mjs` — FOUND.
- Commit `61bf1002` — FOUND in `git log --oneline --all`.
- Commit `9ba7864e` — FOUND in `git log --oneline --all`.
- `node scripts/compute-pace-quality-recount.mjs` — exits 0, prints composite 299.
- `npx vitest run scripts/compute-pace-quality-recount.test.mjs` — 11/11 passed.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
