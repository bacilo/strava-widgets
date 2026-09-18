---
phase: 30-elevation-quality-signal
plan: 07
subsystem: analytics
tags: [scripts, recount, elevation, independent-verification, regression-gate]

# Dependency graph
requires:
  - phase: 30-elevation-quality-signal
    plan: 03
    provides: "quality.elevation on all 1,890 shipped index rows, the shape the recount reads"
  - phase: 30-elevation-quality-signal
    plan: 04
    provides: "30-CALIBRATION.md's classifier-derived cohort figures, the third leg of this plan's reconciliation"
provides:
  - "scripts/compute-elevation-recount.mjs — the D-15 shipped-index recount: reads data/dashboard/index.json only, zero import of the classifier, its own three-member elevation tier set, an inclusion-exclusion cross-check against the shipped elevation.tier field, --expect support"
  - "scripts/compute-elevation-recount.test.mjs — 22 guard tests incl. source-scan independence checks, malformed-row degradation, and a demonstrated-failing mutation case"
  - "A three-way reconciliation (calibration / recount / shipped index) for sub-ground, loop-gated drift, vertical rate, the union and the drift not-computable cohort — every cell agrees exactly, zero deltas"
  - "Proof that the untouched Phase 27 recount (scripts/compute-pace-quality-recount.mjs) still reports composite 299 with the byte-identical pre-phase per-signal breakdown"
affects: [30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The recount script's header doc block explains the D-03/D-06 independence rules WITHOUT ever spelling out the forbidden literal substrings ('pace-quality', 'anySevere') in its own prose — the plan's acceptance criteria grep those literal strings and require a 0 count, so even explanatory comments must paraphrase around them rather than name them directly"
    - "The D-02 drift-not-computable cohort (207) is computed by excluding rows whose elevation.tier is itself the whole-signal not-computable value — conflating the two (as a naive closureDrift.state==='not-computable' count does, giving 232) double-counts the 25 stream-less activities into a cohort meant to describe only 'stream computed, position unknown'"

key-files:
  created:
    - scripts/compute-elevation-recount.mjs
    - scripts/compute-elevation-recount.test.mjs
  modified:
    - package.json

key-decisions:
  - "Excluded the whole-signal not-computable rows (elevation.tier === 'not-computable') from the D-02 closureDrift-not-computable count, matching 30-CALIBRATION.md's and 30-03-SUMMARY.md's own 207-vs-232 decomposition rather than reporting the naive 232 total — the naive count double-counts the 25 stream-less activities into a cohort meant to describe only 'stream computed, position unknown' (D-04's own 'these count different things' rule)."
  - "Paraphrased the D-03/D-06 independence rules in the header doc block without ever writing the literal substrings 'pace-quality' or 'anySevere' anywhere in the file (not even in prose explaining the rule) — the plan's own acceptance criteria run a literal case-sensitive grep for these strings and require a 0 count, so an explanatory comment naming them directly would fail its own gate."
  - "Added an --index-path flag (not named in the plan) so the demonstrated-failing fixture run could point the real CLI at a temp-directory index rather than only proving the same behaviour through a unit test — makes the plan's acceptance-criteria demonstration reproducible as an actual command, not just inferred from test coverage."
  - "Reverted 30-CALIBRATION.md after running `npm run compute-elevation-calibration` for Task 2's reconciliation — the regeneration was byte-identical except the `**Generated:**` timestamp (proving regenerability), and that file is outside this plan's declared files_modified, so it was not committed."

patterns-established:
  - "A recount script's own header comments are subject to the same literal-substring acceptance criteria as its code — explaining a forbidden-import or forbidden-composite rule requires paraphrasing the forbidden identifiers, not naming them, when the plan's grep-based acceptance criteria demand a 0 count for that identifier anywhere in the file."

requirements-completed: []  # deferred to plan 30-08's checkpoint, per this phase's own convention (see 30-04-SUMMARY.md)

# Metrics
duration: ~40min
completed: 2026-09-18
---

# Phase 30 Plan 07: Elevation Recount and Reconciliation Summary

**An elevation recount that reads only the shipped `data/dashboard/index.json`, recomputes the severe union from independent per-mode arithmetic with zero literal reference to the classifier module or the pace-trust composite flag, and reconciles three independently produced figures (calibration / recount / shipped index) for one cohort with every cell agreeing exactly — plus proof the untouched Phase 27 composite stayed at 299.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-18T~16:00 UTC (approx.)
- **Completed:** 2026-09-18T16:40 UTC
- **Tasks:** 2 (Task 2 required no code changes — reconciliation was exact on the first run)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `scripts/compute-elevation-recount.mjs` — reads `data/dashboard/index.json` only, zero `import`/`require`/dynamic-`import()` of the classifier module in any form, defines its own three-member `VALID_ELEVATION_TIERS` set (no `'minor'` band) and its own `ELEVATION_MODE_KEYS` evidence-key list (never a tiering-composite key list), recomputes the severe union from `subGround.flagged`/`closureDrift.state === 'flagged'`/`verticalRate.flagged` with a printed inclusion-exclusion cross-check, and cross-checks the recounted union against the shipped `elevation.tier === 'severe'` field per row — a disagreement exits non-zero naming every offending row.
- `scripts/compute-elevation-recount.test.mjs` — 22 tests: union/overlap semantics, malformed/absent-row degradation (never throws), the demonstrated-failing mutation case (a row whose per-mode evidence disagrees with its own shipped tier), `--expect` predicate behaviour, `readShippedIndex`'s never-throw contract on a missing file and malformed JSON, import-time no-read guard, and four source-scan independence tests (no classifier import, no composite-flag reference, no tiering-key array containing `'elevation'`, no `fs` write call anywhere in the source).
- `package.json` gained one line: `"compute-elevation-recount": "node scripts/compute-elevation-recount.mjs"` — no `npm run build` prefix, since the script imports nothing from `dist/`.
- Three independently produced figures for the same cohort — `npm run compute-elevation-calibration` (imports the classifier, sweeps `data/activities/`+`data/streams/`), `node scripts/compute-elevation-recount.mjs` (reads only the shipped index, no classifier import), and the raw index counts recorded in `30-03-SUMMARY.md` — reconcile with **zero deltas** across sub-ground (11), loop-gated drift (21), vertical rate (39), the union (60), and the D-02 drift-not-computable cohort (207).
- The untouched `scripts/compute-pace-quality-recount.mjs --expect 299` still prints `PASS` with the byte-identical pre-phase per-signal breakdown (decimation 154 / gapProfile 127 / impossibleSamples 31) — the Phase 27 composite is demonstrated unmoved by a script this phase never edited.

## Task Commits

1. **Task 1: An elevation recount that never imports the classifier** - `6bd64f06` (feat)
2. **Task 2: Reconcile three figures and prove the Phase 27 composite unmoved** - no commit; reconciliation was exact on the first run (all cells zero-delta, `scripts/compute-elevation-recount.mjs` needed no fix), and `30-CALIBRATION.md`'s regeneration was reverted as byte-identical modulo timestamp (see Deviations)

## Files Created/Modified

- `scripts/compute-elevation-recount.mjs` — new, 341 lines. Pure exported helpers (`readShippedIndex`, `recountElevation`, `evaluateReport`) plus a guarded `main()` behind a self-execution check.
- `scripts/compute-elevation-recount.test.mjs` — new, 22 tests.
- `package.json` — one new script line, diff confined to the scripts block.

## Decisions Made

- **D-02/D-04 (drift not-computable denominator):** the recount's `closureDriftNotComputableCount` excludes rows whose `elevation.tier` is itself the whole-signal not-computable value, reproducing the calibration report's 207 figure exactly rather than the naive 232 (207 D-02 cohort + 25 stream-less cohort) a flat `closureDrift.state === 'not-computable'` count would produce.
- **D-03/D-06 (literal-substring independence):** the header doc block and every inline comment explain the forbidden-import and forbidden-composite rules by paraphrase (e.g. "the analytics module that computes these six signals", "the pace-trust severity composite the sibling recount reads") rather than naming the literal identifiers — confirmed by `grep -c "pace-quality"` and `grep -c "anySevere"` both returning 0 against the file.
- **Reconciliation runs (Task 2):** ran the classifier-backed calibration sweep, the new classifier-free recount, and cited the raw index counts already recorded in `30-03-SUMMARY.md` — all three agree exactly on every cohort; no delta needed a cause, since none exists.
- **30-CALIBRATION.md regeneration reverted:** running `npm run compute-elevation-calibration` for Task 2's reconciliation regenerated the file with only its `**Generated:**` timestamp changed (byte-identical content otherwise, confirming regenerability) — reverted with `git checkout --` since the file is outside this plan's declared `files_modified` and committing a timestamp-only diff would misattribute a Plan 04 artifact to this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial `closureDriftNotComputableCount` conflated the D-02 cohort with the whole-signal not-computable cohort**
- **Found during:** Task 1, first run of the script against the live shipped index
- **Issue:** The first implementation counted every row with `closureDrift.state === 'not-computable'`, which includes both the 207-activity "position unknown, stream otherwise computable" cohort (D-02) AND the 25-activity whole-signal not-computable (stream-less) cohort — printing 232, not the 207 the calibration report and `30-03-SUMMARY.md` both establish as the D-02-specific figure.
- **Fix:** Excluded rows where `elevation.tier === 'not-computable'` from the D-02 count, matching the calibration report's own 207-vs-232 decomposition exactly.
- **Files modified:** `scripts/compute-elevation-recount.mjs`
- **Verification:** `node scripts/compute-elevation-recount.mjs` now prints `207 of 1865 (11.1%)`, matching `30-CALIBRATION.md` and `30-03-SUMMARY.md` to the digit.
- **Committed in:** `6bd64f06` (Task 1 commit — caught before the commit, not a follow-up fix)

**2. [Rule 3 - Blocking] The plan's literal-substring acceptance criteria ("pace-quality" and "anySevere" must grep to 0) apply to the whole file, including explanatory comments**
- **Found during:** Task 1, immediately after drafting the header doc block, before running any grep
- **Issue:** A first draft of the header doc block named the classifier module and the composite flag literally (`pace-quality.ts`, `dist/analytics/pace-quality.js`, `anySevere`) while explaining WHY the file must not import or reference them — which would itself fail the plan's own `grep -c "pace-quality"` / `grep -c "anySevere"` acceptance criteria, since those greps run against the whole file, not just import statements.
- **Fix:** Rewrote every comment to paraphrase both identifiers (e.g. "the analytics module that computes these six signals", "the pace-trust severity composite the sibling recount reads from `totals.qualityAnySevere`" — note even this second phrase was itself caught and rewritten again before the substring disappeared) without ever spelling out the forbidden literal substring.
- **Files modified:** `scripts/compute-elevation-recount.mjs`
- **Verification:** `grep -c "pace-quality" scripts/compute-elevation-recount.mjs` and `grep -c "anySevere" scripts/compute-elevation-recount.mjs` both return `0`.
- **Committed in:** `6bd64f06` (Task 1 commit — caught before the commit, not a follow-up fix)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 arithmetic bug caught before generating output that would have contradicted the calibration report, 1 Rule 3 blocking issue where the plan's own acceptance criteria made a first comment draft unshippable)
**Impact on plan:** No scope creep. Both were required either to make the script's own numbers agree with the calibration report (Rule 1) or to satisfy the plan's own literal acceptance criteria (Rule 3). No behavior beyond what the plan's action text and acceptance criteria already demanded.

## Verbatim Evidence

### The recount script's full stdout (Task 1 acceptance criterion)

```
$ node scripts/compute-elevation-recount.mjs
D-15 independent elevation recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows: 1890
Rows carrying a "quality" object: 1890 of 1890 (100.0%)
Rows carrying "quality.elevation": 1890 of 1890 (100.0%)

Per-mode flagged counts (own arithmetic, read from each row's per-mode fields):
  subGround.flagged:              11 of 1890 (0.6%)
  closureDrift.state==='flagged': 21 of 1890 (1.1%)
  verticalRate.flagged:           39 of 1890 (2.1%)

Overlaps:
  subGround ∩ closureDrift: 6
  subGround ∩ verticalRate: 3
  closureDrift ∩ verticalRate: 3
  all three: 1
  inclusion-exclusion check: 11 + 21 + 39 - 6 - 3 - 3 + 1 = 60 vs. direct union 60: MATCH

Recounted union (own arithmetic, subGround OR closureDrift OR verticalRate): 60
  vs. shipped elevation.tier === 'severe' count: 60

closureDrift not-computable (position unknown, D-02 — among elevation-computable rows): 207 of 1865 (11.1%)
elevation.tier not-computable (whole-signal, stream-less cohort): 25 of 1890 (1.3%)

Device-family breakdown of the recounted severe set:
  suunto-9: 46
  garmin-fenix-6-pro: 11
  no-device-name: 2
  garmin-vivoactive-4: 1

PASS: recount agrees with the shipped elevation tiers; no disagreements found.
```

### `--expect 60` (the elevation union — the number plan 30-08's checkpoint states as expected)

```
$ node scripts/compute-elevation-recount.mjs --expect 60
...
--expect 60: MATCH

PASS: recount agrees with the shipped elevation tiers; no disagreements found.
```

### Demonstrated failing (Task 1 acceptance criterion): a hand-built fixture where `elevation.tier` disagrees with its own per-mode evidence

Fixture built in a disposable temp directory (`/tmp/elev-recount-demo/index.json`, one row with `elevation.tier: 'none'` while `subGround.flagged: true`), pointed at via the script's `--index-path` flag, then discarded — `data/` was never touched (`git status --porcelain data/` empty before and after):

```
$ node scripts/compute-elevation-recount.mjs --index-path /tmp/elev-recount-demo/index.json
D-15 independent elevation recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows: 1
Rows carrying a "quality" object: 1 of 1 (100.0%)
Rows carrying "quality.elevation": 1 of 1 (100.0%)

Per-mode flagged counts (own arithmetic, read from each row's per-mode fields):
  subGround.flagged:              1 of 1 (100.0%)
  closureDrift.state==='flagged': 0 of 1 (0.0%)
  verticalRate.flagged:           0 of 1 (0.0%)

Overlaps:
  subGround ∩ closureDrift: 0
  subGround ∩ verticalRate: 0
  closureDrift ∩ verticalRate: 0
  all three: 0
  inclusion-exclusion check: 1 + 0 + 0 - 0 - 0 - 0 + 0 = 1 vs. direct union 1: MATCH

Recounted union (own arithmetic, subGround OR closureDrift OR verticalRate): 1
  vs. shipped elevation.tier === 'severe' count: 0

closureDrift not-computable (position unknown, D-02 — among elevation-computable rows): 0 of 1 (0.0%)
elevation.tier not-computable (whole-signal, stream-less cohort): 0 of 1 (0.0%)

Device-family breakdown of the recounted severe set:
  suunto-9: 1

FAIL:
  - 1 row(s) disagree between the recounted per-mode union and the shipped elevation.tier: demo-disagreeing-row (recounted=true, shipped=false)
$ echo $?
1
```

### The vitest guard suite (Task 1 acceptance criterion)

```
$ npx vitest run scripts/compute-elevation-recount.test.mjs
 ✓ scripts/compute-elevation-recount.test.mjs (22 tests) 13ms

 Test Files  1 passed (1)
      Tests  22 passed (22)
```

### Three-way reconciliation (Task 2 acceptance criterion)

Ran back to back against the same unchanged archive (`data/streams/` digest confirmed unchanged before/after the calibration sweep: `0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61`, both runs):

| Cohort | Calibration (`compute-elevation-calibration`) | Recount (`compute-elevation-recount`) | Index (`30-03-SUMMARY.md` raw count) | Delta | Cause |
|---|---|---|---|---|---|
| Sub-ground | 11 | 11 | 11 | 0 | Exact match — no cause needed |
| Loop-gated drift | 21 | 21 | 21 | 0 | Exact match — no cause needed |
| Vertical rate | 39 | 39 | 39 | 0 | Exact match — no cause needed |
| Union (severe) | 60 | 60 | 60 | 0 | Exact match — no cause needed |
| Drift not-computable (D-02 cohort) | 207 | 207 | 207 | 0 | Exact match — no cause needed |

No delta required a stated cause because none exists — all three independently produced figures agree exactly on every row of the table. Device-family breakdown of the severe union also agrees three ways: Suunto 9 46 / Garmin fēnix 6 Pro 11 / no device name 2 / Garmin vívoactive 4 1.

`npm run compute-elevation-calibration`'s own stdout, confirming the same numbers from the classifier side and the D-16 digest gate passing:

```
Computing pre-sweep data/streams/ digest (D-16)...
  1865 files, digest 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
Reading the live archive (data/activities/, data/streams/)...
Activities: 1890; streams present: 1865
Computing elevation signals for every activity (shipped classifier, no overrides)...
Loop-gated union: 60
Computing post-sweep data/streams/ digest (D-16)...
  1865 files, digest 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
data/streams/ is byte-unchanged (digest match, 1865 files): 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
Inclusion-exclusion check: PASS.

Wrote .../30-CALIBRATION.md
```

### The Phase 27 gate, untouched script, full stdout (Task 2 acceptance criterion)

```
$ node scripts/compute-pace-quality-recount.mjs --expect 299
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
--expect 299: MATCH

PASS: recount agrees with the shipped totals; no disagreements found.
```

This is byte-identical to `30-03-SUMMARY.md`'s own pre-phase run (same composite 299, same per-signal breakdown 154/127/31) — the Phase 27 composite is demonstrated unmoved by a script this phase never edited. Confirmed: `git diff --name-only` shows no change to `scripts/compute-pace-quality-recount.mjs`, and `git status --porcelain data/` is empty throughout.

### Literal-substring independence checks (acceptance criteria, run directly)

```
$ grep -c "pace-quality" scripts/compute-elevation-recount.mjs
0
$ grep -c "anySevere" scripts/compute-elevation-recount.mjs
0
$ grep -c "elevation" scripts/compute-pace-quality-recount.mjs
0
$ git diff --name-only | grep -c compute-pace-quality-recount.mjs
0
$ grep -c "compute-elevation-recount" package.json
1
```

## Issues Encountered

None beyond the two auto-fixed deviations above — both caught and resolved before the Task 1 commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `scripts/compute-elevation-recount.mjs` is available for plan 30-08's checkpoint to re-run if needed; its `--expect 60` invocation is the number the checkpoint plan should state as expected before drafting its rows.
- The three-way reconciliation (calibration / recount / index, all zero-delta) is the auditable evidence ELEV-02's "validated against the whole archive" requires, mirroring Phase 27's own D-03 precedent one signal later.
- `scripts/compute-pace-quality-recount.mjs` is confirmed byte-unchanged and its composite confirmed unmoved (299, identical per-signal breakdown) — D-06's byte-stability claim now has its own regenerated number, not just a citation.
- No blockers for plan 30-08. Per this wave's tracking-write rule (worktree mode), STATE.md and ROADMAP.md were deliberately left untouched — the orchestrator will consolidate wave 3 (30-05/30-06/30-07) after all three agents complete.
- Known environmental-only test failure, unrelated to this plan: `scripts/verify-dashboard-publish-stats.test.mjs` fails in this bare worktree because `dist/widgets/data/stats/best-efforts.json` does not exist (no `npm run build-widgets` has run here) — confirmed pre-existing per the orchestrator's own environment notes, not a regression from this plan's changes. All other 2,486 tests pass.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 3 files listed under Files Created/Modified verified present on disk
(`scripts/compute-elevation-recount.mjs`, `scripts/compute-elevation-recount.test.mjs`,
`package.json`). Task 1 commit hash `6bd64f06` verified present in `git log --oneline --all`.
