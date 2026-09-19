---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 08
subsystem: infra
tags: [reporting-generator, regeneration, idempotence, pr-ceiling, docs-reconciliation, vitest]

# Dependency graph
requires:
  - phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
    provides: "31-05 (TD-04 margin-bearing reason string), 31-06 (27 G-03 manifest-count fix, scripts/lib/stream-files.mjs), 31-07 (WR-07/WR-08 calibration-generator fixes)"
provides:
  - "Five regenerated artifacts of record (26-RESIDUAL.md, 27-CALIBRATION.md, 28-CEILING-CALIBRATION.md, 28-DIFF.md, 30-CALIBRATION.md), each proven idempotent against the merged 1,899-activity archive"
  - "A fixed compute-pace-quality-calibration.mjs (the 31-06 re-export bug that made every archive sweep call site throw 'idFromFilename is not defined')"
  - "28-DIFF.md's owner-excluded ceiling table now carries the TD-04 margin-bearing demotion reason verbatim, closing the gap between this plan's own must-have and the generator's prior numeric-only rendering"
  - "The three-way ceiling reconciliation (28-DIFF.md ceiling-only demoted = byGuard.ceiling = independentCeilingCount = 32) re-derived against the merged archive, plus the new 28-DIFF.md sha256 for plan 31-10's re-sign"
affects: [31-10 (PR-04 Round 4 sign-off, TD-05 tick, ROADMAP/REQUIREMENTS hand-corrections)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotence proof by copy-aside + full six-step regeneration replay + diff with the **Generated:** line stripped, run twice for good measure (once before, once after an in-flight generator fix)"
    - "import-then-re-export (not `export { x } from 'mod'`) when a module both re-exports a shared helper for its own guard test AND calls that helper at its own module scope"

key-files:
  created: []
  modified:
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md
    - .planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md
    - .planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md
    - .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md
    - .planning/phases/30-elevation-quality-signal/30-CALIBRATION.md
    - scripts/compute-pace-quality-calibration.mjs
    - scripts/compute-pr-ceiling-diff.mjs
    - scripts/compute-pr-ceiling-diff.test.mjs

key-decisions:
  - "27-CALIBRATION.md must be regenerated with `-- --sweep` (not the bare npm script the plan's action text names), because the committed artifact's own footer instructs this and 27-VERIFICATION.md/QUAL-05 treat the six-row Threshold Sensitivity table as part of this artifact's committed evidence. Regenerating without --sweep would have silently dropped that table from the committed record — caught before committing, not after."
  - "28-DIFF.md's buildCeilingDemotedExcluded gained a `reason` field (from effort.demotion.reason) and the render table gained a Reason column, because the generator never surfaced the TD-04 margin text anywhere in the artifact — the plan's own must_haves.truths ('the signed diff carries the final wording') was unreachable without this. Rendered via the existing safeCell escaper; a missing reason degrades to an em dash, never the literal string 'null'."
  - "data/best-effort-ceiling.json needed no commit: `git status --porcelain data/best-effort-ceiling.json` is empty against HEAD (it was already current from the compute-all-stats run that opened Task 1, and none of the five report generators write into data/)."

patterns-established:
  - "When a generator's rendered artifact is asserted to 'carry' a value from a shared data structure, verify by grepping the actual rendered output for the value's pattern before trusting the plan's key_links table — the assumption can be stale even when every upstream fix has genuinely landed."

requirements-completed: []
# TD-05 tick rule (per this plan's own <output> spec): TD-05 spans 31-06, 31-07,
# 31-08, 31-09 and 31-10 and ticks only in 31-10, after the PR-04 Round 4
# verdict. Left unticked here deliberately.

# Metrics
duration: ~65min
completed: 2026-09-19
---

# Phase 31 Plan 08: Regenerate the Five Artifacts of Record Summary

**All five TD-05 artifacts regenerated against the merged 1,899-activity archive in dependency order, each proven idempotent twice; two real generator bugs found and fixed along the way (a broken re-export that crashed the quality-calibration sweep, and a missing reason-string column that made the plan's own "signed diff carries the final wording" claim false) — three-way ceiling reconciliation holds at 32 = 32 = 32.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-09-19T11:04:27Z (STATE.md session start for this plan)
- **Completed:** 2026-09-19T11:41:00Z (approx, this commit)
- **Tasks:** 2 (Task 1 committed; Task 2 is verification/reconciliation with no new file changes to commit — see below)
- **Files modified:** 8 (5 regenerated artifacts, 3 script/test files)

## Accomplishments

- Refreshed computed data first (`npm run build` then `npm run compute-all-stats`) so TD-04's margin-bearing reason format was present in `data/stats/best-efforts.json` before any report generator ran. Reverted the one incidental `data/` diff (`data/geo/geo-metadata.json`, timestamp-only) with `git checkout --`.
- Regenerated all five artifacts in the plan's exact dependency order — `compute-pace-residual` → `compute-pace-quality-calibration -- --sweep` → `compute-pace-residual` (again, so `26-RESIDUAL.md`'s committed content is unambiguously its own generator's last output, not the quality-calibration subprocess's side effect) → `compute-pr-ceiling-calibration` → `compute-pr-ceiling-diff` → `compute-elevation-calibration` — with full stdout captured for every step.
- Proved idempotence for all five artifacts twice: once immediately after the initial regeneration pass (before the `compute-pr-ceiling-diff.mjs` fix below), and once more in a clean, final six-step replay after both bugs were fixed. Every diff, with the `**Generated:**` line stripped from both sides via `diff <(grep -v '^\*\*Generated:\*\*' A) <(grep -v '^\*\*Generated:\*\*' B)`, was empty.
- **Found and fixed two real bugs while regenerating (deviations, below).**
- Re-derived the three-way ceiling reconciliation and every headline figure against the Round 3 / MERGE-01 baseline (table below) — all unchanged despite the archive growing from the pre-merge population to 1,899/1,874.
- Ran the full phase gate: `npm test` (85/85 files, 2596/2596 tests), `npx tsc --noEmit` (clean), `npm run build-widgets` (zero `css-syntax-error`, six `replaced stale` lines explained below), `npm run verify-dashboard` (66/66), and all three recount scripts (all PASS).
- Computed the new `28-DIFF.md` sha256 and confirmed the superseded Round 3 hash appears nowhere in the regenerated artifact (`grep -c "cdf9d654"` → 0).
- Confirmed `data/best-effort-ceiling.json` needs no commit (unchanged against HEAD).

## Task Commits

1. **Task 1: Regenerate all five artifacts in dependency order and prove idempotence** - `c71f9177` (feat) — includes the two in-flight bug fixes (Rule 1/2), since both were discovered mid-regeneration and were required to produce a correct, complete artifact set.
2. **Task 2: Re-derive the three-way ceiling count, hash the diff, and commit** - no separate commit. `data/best-effort-ceiling.json` is unchanged against HEAD (nothing to commit) and `28-DIFF.md` was already committed as part of Task 1's regeneration (the plan's action text describes a single combined commit; this execution split the work across two commits at the natural task boundary — Task 1 commits the regenerated artifacts and their generator fixes, Task 2 is pure verification/reconciliation with no new file state to stage). All of Task 2's required records (gate output, three-way figures, sha256, ceiling.json decision) are captured below and are this plan's contribution to `28-VALIDATION.md`, which plan 31-10 owns.

**No plan-metadata commit** — SUMMARY.md/STATE.md/ROADMAP.md are committed after this document, per the sequential-executor protocol.

## Regeneration Order Actually Executed (verbatim stdout)

Command 0 (data refresh, before the six-step sequence): `npm run build` then `npm run compute-all-stats` — output ended with `All statistics generated successfully!`; `data/stats/best-efforts.json` reason strings confirmed to already carry the TD-04 margin format (`... by 0.524 m/s (1.28 x p90 ...)`) before any report generator ran.

### Step 1 — `npm run compute-pace-residual`
```
Computing PACE-06 residual report from the committed stream archive...

Archive size scanned: 1874
Severe stair-step cohort size: 154
Residual count (after fast mass > 0.5%): 14
Max residual: 2.44%
Criterion 1: 153 strictly improved, 1 tied at zero, 0 regressed

Zero Criterion 1 violations.

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md
```
Archive size scanned is 1874 (not 1866/1865), confirming 31-06's manifest-exclusion fix (27 G-03) is live.

### Step 2 — `npm run compute-pace-quality-calibration -- --sweep`
```
Reading the live archive (data/activities/, data/streams/)...

Activity count: 1899
Stream count: 1874
Computing per-activity quality signals (shipped thresholds, no overrides)...

Composite (anySevere) count: 299
  vs activity-count denominator: 15.7%
  vs stream-count denominator: 16.0%
Sanity gate: PASS

--sweep: recomputing under threshold overrides (no source edit)...

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md
```
**Deviated from the plan's literal command** by adding `-- --sweep` — see Deviations. This run also silently regenerated `26-RESIDUAL.md` as its documented subprocess side effect (expected, per RESEARCH Pitfall 3); Step 3 below re-runs `compute-pace-residual` so the final committed `26-RESIDUAL.md` is unambiguously its own generator's last output.

### Step 3 — `npm run compute-pace-residual` (again)
```
Computing PACE-06 residual report from the committed stream archive...

Archive size scanned: 1874
Severe stair-step cohort size: 154
Residual count (after fast mass > 0.5%): 14
Max residual: 2.44%
Criterion 1: 153 strictly improved, 1 tied at zero, 0 regressed

Zero Criterion 1 violations.

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md
```
Byte-identical (mod `**Generated:**`) to Step 1's output, confirming the archive itself is stable across the two runs and Step 2's subprocess side-effect run.

### Step 4 — `npm run compute-pr-ceiling-calibration`
```
Computing the PR-plausibility ceiling calibration...

Minimum population floor: 100 (10 points above p90 boundary)
Chosen K: 1.28 (argmax distance: 10k)
  400m: n=1834 max=6.033182503770739 p90=3.992015968063872 ratio=1.51131221719457 mechanismClean=false floorEligible=true
  1k: n=1852 max=6.19962802231866 p90=3.7105751391465676 ratio=1.670799752014879 mechanismClean=false floorEligible=true
  1mi: n=1851 max=5.6074703832752615 p90=3.6156908559874186 ratio=1.5508710801393728 mechanismClean=false floorEligible=true
  5k: n=1788 max=4.239803273128127 p90=3.394663588838346 ratio=1.2489612481980839 mechanismClean=true floorEligible=true
  10k: n=1468 max=4.194806829145517 p90=3.2971743216063834 ratio=1.272242963211544 mechanismClean=true floorEligible=true
  half: n=104 max=4.048414023372287 p90=3.4388192531499078 ratio=1.1772686277896112 mechanismClean=true floorEligible=true
  marathon: n=0 max=— p90=— ratio=— mechanismClean=true floorEligible=false

Applied ceiling:
  400m: ceilingMps=5.1098 eligible=true n=1834 demotedCount=8 demotedTop10Count=8
  1k: ceilingMps=4.7496 eligible=true n=1852 demotedCount=7 demotedTop10Count=7
  1mi: ceilingMps=4.6281 eligible=true n=1851 demotedCount=4 demotedTop10Count=4
  5k: ceilingMps=4.3452 eligible=true n=1788 demotedCount=0 demotedTop10Count=0
  10k: ceilingMps=4.2204 eligible=true n=1468 demotedCount=0 demotedTop10Count=0
  half: ceilingMps=4.4017 eligible=true n=104 demotedCount=0 demotedTop10Count=0
  marathon: ceilingMps=no personal ceiling eligible=false n=0 demotedCount=0 demotedTop10Count=0

Riegel cross-distance gate (fastest 10k: 7827165619):
  400m: outside Riegel's calibrated range
  1k: riegelCeilingMps=4.816282652363282 riegelOnly=0 ourOnly=0
  1mi: riegelCeilingMps=4.680723996193899 riegelOnly=0 ourOnly=1
  5k: riegelCeilingMps=4.372942492726715 riegelOnly=0 ourOnly=0
  10k: riegelCeilingMps=4.194806829145517 riegelOnly=0 ourOnly=0
  half: riegelCeilingMps=4.01105028529232 riegelOnly=1 ourOnly=0
  marathon: riegelCeilingMps=3.847656619490288 riegelOnly=0 ourOnly=0

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md
```

### Step 5 — `npm run compute-pr-ceiling-diff`
```
Computing the PR-04 archive-wide before/after diff...

Generated best efforts:
- Activities considered: 1874
- Activities with efforts: 1873
- Efforts computed: 8991
- Low-confidence efforts: 181
- Efforts excluded (records): 61
- Skipped (no stream): 25
- Skipped (unreadable): 0
  400m: 10 ranked / 1k: 10 ranked / 1mi: 10 ranked / 5k: 10 ranked / 10k: 10 ranked / half: 10 ranked / marathon: 0 ranked

Ceilings (Phase 28 PR-01/PR-02):
  400m: ceiling 5.1098 m/s (p90 3.9920 m/s over 1834), 19 demoted (11 of them owner-excluded)
  1k: ceiling 4.7496 m/s (p90 3.7106 m/s over 1852), 9 demoted (2 of them owner-excluded)
  1mi: ceiling 4.6281 m/s (p90 3.6157 m/s over 1851), 4 demoted (0 of them owner-excluded)
  5k/10k/half: 0 demoted each; marathon: fail-open (population 0 below minimum 100)

Archive size: 1874
Total demoted (ceiling-only, this report): 32
Of which owner-excluded: 13
Total flag flips: 13
Total retroactive promotions: 2
Total ranking rows moved: 49
  400m: demoted=19 demotedExcluded=11 flagsBefore=11 flagsAfter=6 flagsFlipped=5
  1k: demoted=9 demotedExcluded=2 flagsBefore=11 flagsAfter=9 flagsFlipped=6
  1mi: demoted=4 demotedExcluded=0 flagsBefore=14 flagsAfter=12 flagsFlipped=2
  5k/10k/half/marathon: demoted=0, flagsFlipped=0 each

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md
```
(The "Demoted efforts and unexpected errors" per-effort listing — 50+ lines, world-record/max-speed/ceiling reasons for every rejected effort — is omitted here for length; it is unchanged in shape from the pre-merge Round 3 run and is preserved verbatim in the committed artifact itself.)

### Step 6 — `npm run compute-elevation-calibration`
```
Computing pre-sweep data/streams/ digest (D-16)...
  1874 files, digest 74b1230198ed82bd2a40612a9e88a7127ef3741574b71c438704ade1686a3e00
Reading the live archive (data/activities/, data/streams/)...
Activities: 1899; streams present: 1874
Computing elevation signals for every activity (shipped classifier, no overrides)...
Loop-gated union: 60
Computing post-sweep data/streams/ digest (D-16)...
  1874 files, digest 74b1230198ed82bd2a40612a9e88a7127ef3741574b71c438704ade1686a3e00
data/streams/ is byte-unchanged (digest match, 1874 files): 74b1230198ed82bd2a40612a9e88a7127ef3741574b71c438704ade1686a3e00
Inclusion-exclusion check: PASS.

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md
```

## Idempotence Proofs

**Diff command used (all five, both rounds):**
```
diff <(grep -v '^\*\*Generated:\*\*' <run-N-copy>) <(grep -v '^\*\*Generated:\*\*' <regenerated-file>)
```
The `**Generated:**` line is stripped from both sides before comparing (RESEARCH Pitfall 2) — every artifact opens with a `**Generated:** <ISO timestamp>` line that a literal byte comparison would always flag, for a reason that has nothing to do with generator correctness.

**Round 1** (immediately after the initial six-step pass, before the `compute-pr-ceiling-diff.mjs` Reason-column fix): all five diffs empty.

**Round 2 (final, after both bug fixes, clean six-step replay with `-- --sweep` at Step 2):** all five diffs empty:

| Artifact | Idempotence result |
|---|---|
| `26-RESIDUAL.md` | exit 0 (empty diff) |
| `27-CALIBRATION.md` | exit 0 (empty diff) — including the full six-row Threshold Sensitivity table |
| `28-CEILING-CALIBRATION.md` | exit 0 (empty diff) |
| `28-DIFF.md` | exit 0 (empty diff) — including the new Reason column |
| `30-CALIBRATION.md` | exit 0 (empty diff) |

`26-RESIDUAL.md`'s committed content is Step 3's output (its own generator's last, direct run), not Step 2's subprocess side effect — confirmed by re-running Step 3 after Step 2 and diffing the two: empty.

## Headline Figures vs. Round 3 / MERGE-01 Baseline

| Figure | Round 3 / MERGE-01 baseline | This run | Status |
|---|---|---|---|
| Activities (indexed) | 1,899 | 1,899 | unchanged |
| Activities considered (best-efforts) | 1,874 | 1,874 | unchanged |
| Ceiling-only demoted (total) | 32 | 32 | unchanged |
| Flag flips | 13 | 13 | unchanged |
| Retroactive promotions | 2 | 2 | unchanged |
| Ranking rows moved | 49 | 49 | unchanged |
| `totals.effortsDemoted` | 66 | 66 | unchanged |
| Flagged activities (queue population) | 47 | 47 | unchanged |
| Elevation severe union | 60 | 60 | unchanged |
| Quality composite (anySevere) | 299 | 299 | unchanged |
| Three-way ceiling reconciliation | 32 = 32 = 32 | 32 = 32 = 32 | unchanged |

**Expected content changes, all confirmed present and archive-drift/fix-explained, not silently waved through:**
- `26-RESIDUAL.md`: "Archive size scanned" 1866 → 1874 (27 G-03 manifest-exclusion fix + archive growth). Residual count stays 14 (matches D-13's stated correction).
- `27-CALIBRATION.md`: activity count 1890 → 1899, stream count 1865 → 1874, per-signal % denominators shift at the decimal (8.3%→8.2%, minor counts 337/631 → 340/632), device-family counts shift (intervals-icu 78→87, reflecting the merge). Composite (299) and all six Threshold Sensitivity rows (+67/-38/+33/-20/+35/-44) are byte-identical — confirmed unaffected by archive growth, matching 27-11's own precedent.
- `28-CEILING-CALIBRATION.md`: per-distance `n` values shift by archive growth (e.g. 400m 1825→1834, 1mi 1842→1851); the drift-reconciliation table's sign flips from negative (pre-merge, population had shrunk vs. `28-CONTEXT.md`'s cited figures) to positive (post-merge growth); the largest-drift sentence now names **10k** (+4) instead of the hard-coded "400m" literal (WR-07 fix); the coverage table gained the reconciled "Demoted (non-excluded)" / "Owner-excluded above ceiling" columns (WR-08 fix), reconciling 19 + 13 = 32.
- `28-DIFF.md`: archive size 1865→1874 in the header prose (unrelated pre-existing typo in one prose line was not touched — out of this plan's scope); the owner-excluded ceiling table gained a Reason column (this plan's own fix, below) carrying the TD-04 margin-bearing text for all 13 rows.
- `30-CALIBRATION.md`: all denominators shift 1890→1899 / 1865→1874; the stream-integrity digest changed (expected — the digest covers file *contents*, and the archive grew); the union (60) and inclusion-exclusion check (PASS) are unchanged, matching MERGE-01's cited figure exactly.

No other movement was observed; every changed cell in every `git diff` traces to one of the five explanations above.

## Three-Way Ceiling Reconciliation (re-derived, Task 2)

```
$ node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 66
...
Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      32
...
Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 32
  overCeilingWithoutDemotion (0): (none)
...
Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): 47
    of which already excluded (data/best-effort-exclusions.json): 12 of 12 total exclusions
--expect-demoted 66: MATCH
PASS: recount agrees with the shipped totals; no disagreements found.
```

- `28-DIFF.md`'s own "Total demoted (ceiling-only, this report)": **32**
- `compute-pr-ceiling-recount.mjs`'s `byGuard.ceiling`: **32**
- `compute-pr-ceiling-recount.mjs`'s `independentCeilingCount`: **32**
- **All three equal — reconciliation holds.**
- Flagged-activity count: **47** (matches the interfaces table's cited Round 3/MERGE-01 figure)
- `--expect-demoted 66`: **MATCH**

Elevation recount (`node scripts/compute-elevation-recount.mjs`): union **60**, inclusion-exclusion `11+21+39-6-3-3+1=60` vs. direct union 60 → **MATCH**; PASS.

Pace-quality recount (`node scripts/compute-pace-quality-recount.mjs --expect 299`): composite **299**, `--expect 299`: **MATCH**; PASS.

## Phase Gate (Task 2)

| Command | Result |
|---|---|
| `npm test` | 85 files passed, 2596 tests passed, exit 0 |
| `npx tsc --noEmit` | exit 0, no errors |
| `npm run build-widgets` | `css-syntax-error` occurrences: **0**. Six `replaced stale` lines (see below), all expected. |
| `npm run verify-dashboard` | **66 check(s) passed, 0 failure(s)** |
| `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 66` | PASS, MATCH |
| `node scripts/compute-elevation-recount.mjs` | PASS, MATCH |
| `node scripts/compute-pace-quality-recount.mjs --expect 299` | PASS, MATCH |

**`replaced stale` lines from `build-widgets` (TD-02's digest-based staleness log, 31-02):**
```
replaced stale dist/widgets/data/stats/age-grading.json
replaced stale dist/widgets/data/stats/all-time-totals.json
replaced stale dist/widgets/data/stats/gear-aggregate.json
replaced stale dist/widgets/data/stats/metadata.json
replaced stale dist/widgets/data/stats/training-load.json
replaced stale dist/widgets/data/dashboard/index.json
```
All six are `data/stats/`/`data/dashboard/` files this session's `compute-all-stats` run (Task 1's data refresh) legitimately regenerated with new content before `build-widgets` copied them into `dist/widgets/`; the digest-based guard correctly detected the same-size-or-different-content change and replaced the stale copy rather than silently skipping it, exactly as TD-02 intends. None of the five `.planning/`-scoped artifacts this plan owns are affected — `dist/widgets/` is gitignored build output.

## New `28-DIFF.md` sha256

- **New (this run):** `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`
- **Superseded (Round 3, signed 2026-09-19 per `28-VALIDATION.md`):** `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`
- `grep -c "cdf9d654" .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` → **0** — no sign-off text was written into the generated artifact (Phase 28 D-14 held).
- The sha256/reconciliation record itself is not written into `28-VALIDATION.md` here — that file belongs to plan 31-10, per this plan's own scope boundary.

## `data/best-effort-ceiling.json` Decision

**Unchanged, untouched.** `git status --porcelain data/best-effort-ceiling.json` against HEAD is empty. This file is written only by `compute-all-stats`'s `compute-best-efforts` step (run once, at the start of Task 1, to refresh TD-04's reason format into `data/stats/best-efforts.json`); none of the five report generators (`compute-pace-residual`, `compute-pace-quality-calibration`, `compute-pr-ceiling-calibration`, `compute-pr-ceiling-diff`, `compute-elevation-calibration`) write into `data/` at all — confirmed by `git status --porcelain data/` returning empty after every one of the six regeneration steps. No numeric ceiling/p90/populationN value moved.

## `git status --porcelain data/` — Final State

Empty, both after the initial `compute-all-stats` refresh (`data/geo/geo-metadata.json`'s timestamp-only diff was reverted with `git checkout --` before proceeding) and after every regeneration step. No unintended tracked churn.

## Commit Message (verbatim, `git log -1 --format=%B`)

```
feat(31-08): regenerate the five TD-05 artifacts against the merged archive

Regenerated 26-RESIDUAL.md, 27-CALIBRATION.md, 28-CEILING-CALIBRATION.md,
28-DIFF.md and 30-CALIBRATION.md against the 1,899-activity merged archive,
in dependency order (residual, quality-calibration --sweep, residual again,
ceiling calibration, ceiling diff, elevation calibration), with the three
generator fixes from 31-05/31-06/31-07 in effect. Each artifact regenerated
twice; all five diffs are empty once the Generated: line is stripped.

Two real bugs found and fixed while regenerating (Rule 1/2):
- compute-pace-quality-calibration.mjs used `export { x } from './lib/...'`
  to reuse 31-06's shared isStreamFile/idFromFilename, which re-exports but
  does not bind local names -- every archive-sweep call site threw
  "idFromFilename is not defined". Changed to import-then-export.
- compute-pr-ceiling-diff.mjs's buildCeilingDemotedExcluded never carried
  the TD-04 margin-bearing demotion reason into 28-DIFF.md at all, so the
  plan's own must-have ("the signed diff carries the final wording") was
  unreachable. Added a Reason column to the owner-excluded ceiling table,
  sourced from effort.demotion.reason, with tests.

Headline figures reconcile against the Round 3 baseline: archive 1874
considered, ceiling-only demoted 32, flag flips 13, retroactive promotions
2, ranking rows moved 49, effortsDemoted 66 -- all unchanged from Round 3.
28-CEILING-CALIBRATION.md's largest-drift sentence now names 10k (WR-07)
and its Demoted/Owner-excluded columns reconcile 19 + 13 = 32 (WR-08).
27-CALIBRATION.md's Threshold Sensitivity table (regenerated with --sweep,
per its own regeneration instructions) reproduces byte-identically.

npm test: 85/85 files, 2596/2596 tests. tsc --noEmit clean. No data/
churn (data/geo/geo-metadata.json's timestamp-only diff reverted).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WdDy2w1nG8rNZC2gpvNkoB
```

Nothing was pushed: `git status -sb` → `## master...origin/master [ahead 31]`.

## Files Created/Modified

- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — regenerated (archive size 1866→1874)
- `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` — regenerated with `--sweep` (denominators 1890/1865→1899/1874; Threshold Sensitivity table preserved byte-identical)
- `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` — regenerated (WR-07 data-derived drift sentence now live; WR-08 reconciled columns now live)
- `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` — regenerated (new Reason column, see below)
- `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md` — regenerated (union 60 unchanged, digest updated for archive growth)
- `scripts/compute-pace-quality-calibration.mjs` — fixed the `export { x } from` re-export bug (Rule 1)
- `scripts/compute-pr-ceiling-diff.mjs` — `buildCeilingDemotedExcluded` now carries `reason`; `renderDiffMarkdown`'s owner-excluded table gained a Reason column (Rule 2)
- `scripts/compute-pr-ceiling-diff.test.mjs` — updated 3 existing tests, added assertions pinning the new Reason column's format (including a TD-04 margin-clause regex) and its null-safe em-dash fallback

## Decisions Made

See `key-decisions` in frontmatter. In short: followed the plan's exact six-step order, but (1) used `-- --sweep` for Step 2 because the committed artifact's own regeneration instructions and prior verification records require it, and (2) extended `compute-pr-ceiling-diff.mjs`'s owner-excluded table with a Reason column because the plan's own must-have truth ("the signed diff carries the final wording") was otherwise false — the generator never rendered `demotion.reason` anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `compute-pace-quality-calibration.mjs`'s re-export of the shared `stream-files.mjs` helpers left them unbound in the file's own module scope**
- **Found during:** Task 1, Step 2 (`npm run compute-pace-quality-calibration`)
- **Issue:** `export { idFromFilename, isStreamFile } from './lib/stream-files.mjs';` is a pure re-export statement in ES modules — it forwards the two names to importers of this file but does NOT bind them as local names usable elsewhere in this same file. Lines 472/486/490 (the archive-sweep loop) called `idFromFilename(...)` and `isStreamFile` as if they were locally imported, throwing `idFromFilename is not defined` on every one of the ~1,899 activity records the sweep processes (confirmed: the run printed the warning for every activity, then completed with a degraded/empty result rather than failing outright, since the sweep's own per-file try/catch swallowed the error as a "failed to parse" warning).
- **Fix:** Changed to `import { idFromFilename, isStreamFile } from './lib/stream-files.mjs'; export { idFromFilename, isStreamFile };` — a real import (binds local names) followed by a named re-export (preserves the guard test's `mod.isStreamFile`/`mod.idFromFilename` access, unaffected by 31-06's move).
- **Files modified:** `scripts/compute-pace-quality-calibration.mjs`
- **Verification:** `npx vitest run scripts/compute-pace-quality-calibration.test.mjs` → 21/21 passed (unchanged). Re-ran `npm run compute-pace-quality-calibration -- --sweep` → zero warnings, `Activity count: 1899`, `Stream count: 1874`, `Composite (anySevere) count: 299` — matches the independently-verified live figures exactly.
- **Committed in:** `c71f9177` (part of Task 1 commit)

**2. [Rule 2 - Missing critical functionality] `28-DIFF.md` never rendered the TD-04 demotion reason anywhere, making this plan's own must-have unreachable**
- **Found during:** Task 1, verify step (`grep -qE "by [0-9]+\.[0-9]{3} m/s" .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` returned no match against the freshly regenerated file)
- **Issue:** `scripts/compute-pr-ceiling-diff.mjs` consults `effort.demotion.guard` (an enum) at three call sites but never reads `effort.demotion.reason` anywhere — the artifact's "Ceiling demotions on owner-excluded efforts" table renders only numeric `Implied speed (m/s)`/`Ceiling (m/s)` columns, and no other section renders per-effort prose at all. This plan's own `must_haves.truths` states "TD-04's reason format is in `data/stats/best-efforts.json` before `28-DIFF.md` is generated, so the signed diff carries the final wording" and its `key_links` table names a direct `ceilingDemotion` reason → `28-DIFF.md` per-effort-reason-text link — neither was true of the generator as it stood, independent of anything this plan changed upstream. Regenerating correctly (with TD-04 fully landed) could not have produced the required substring; the generator itself needed the addition.
- **Fix:** `buildCeilingDemotedExcluded` now includes `reason: effort.demotion?.reason ?? null` on each row; `renderDiffMarkdown`'s owner-excluded table gained a `Reason` column, rendered via the existing `safeCell` escaper (guards against `|`/newlines) with a `'—'` fallback for a missing reason (never the literal string `"null"`).
- **Files modified:** `scripts/compute-pr-ceiling-diff.mjs`, `scripts/compute-pr-ceiling-diff.test.mjs`
- **Verification:** `npx vitest run scripts/compute-pr-ceiling-diff.test.mjs` → 20/20 passed (3 existing tests updated, 1 test extended with a `by \d+\.\d{3} m\/s` regex assertion and the exact worked-example string `implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s`). Regenerated `28-DIFF.md`: `grep -qE "by [0-9]+\.[0-9]{3} m/s"` now matches (13 rows, one per owner-excluded ceiling demotion). Re-ran the full idempotence proof after this fix (Round 2 above) — still empty.
- **Committed in:** `c71f9177` (part of Task 1 commit)

**3. [Deviation — command substitution, not a bug fix] Step 2 run with `-- --sweep`, not the plan's literal `npm run compute-pace-quality-calibration`**
- **Found during:** Task 1, reviewing the regenerated `27-CALIBRATION.md`'s diff before committing
- **Issue:** Running the plain command (matching the plan's action text and `package.json`'s script definition verbatim) silently dropped the committed artifact's six-row "Threshold Sensitivity" section — a section `27-VERIFICATION.md` and QUAL-05's Criterion 4a treat as verified, committed evidence, and which `27-CALIBRATION.md`'s own footer instructs regenerating with `-- --sweep` to reproduce. This is not a code bug (the plain command correctly omits `--sweep`'s extra work when not asked for it) but a plan/artifact mismatch: the plan's action text under-specified the command needed to correctly regenerate this particular artifact without silently deleting part of its own evidentiary record.
- **Fix:** Re-ran Step 2 as `npm run compute-pace-quality-calibration -- --sweep`. Confirmed via `git diff` that the six Threshold Sensitivity rows are now byte-identical to the previously committed values (no diff lines touch that section at all), while the denominator/composite figures elsewhere in the file correctly reflect archive growth.
- **Files modified:** `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` (content only — no script change)
- **Verification:** Full idempotence Round 2 (above) confirms this regeneration path is itself idempotent; `git diff` confirms zero lines touched under `## Threshold Sensitivity`.
- **Committed in:** `c71f9177` (part of Task 1 commit)

---

**Total deviations:** 3 (2 auto-fixed bugs under Rules 1/2, 1 command correction to match the artifact's own regeneration contract). All three were required to make this plan's own stated acceptance criteria (idempotence, the margin-clause grep, an unregressed evidentiary record) actually hold — none is scope creep beyond what TD-05's own must-haves already demanded.

## Issues Encountered

None beyond the three deviations above, all resolved within Task 1 before any commit.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. All three threats this plan's own `<threat_model>` names (T-31-05 hand-corrected artifacts, T-31-26 out-of-order regeneration, T-31-27 a sign-off bound to mismatched bytes, T-31-28 incidental `data/` churn, T-31-29 the CI-skip token) are mitigated per the acceptance criteria and records above: nothing was hand-edited (both fixes are in the generator scripts, not the artifacts); the six-step order was followed exactly, with the residual generator run last for its own file; the sha256 is computed from the actually-committed bytes and recorded here for plan 31-10, not written into the artifact; `data/` churn was inspected and reverted where incidental; the commit message contains no CI-skip token (grep-confirmed).

## Next Phase Readiness

- All five artifacts of record are regenerated, idempotent, and reconcile three ways for the ceiling figure — the material plan 31-10's PR-04 Round 4 sign-off needs is ready: new sha256 `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`, superseded Round 3 hash `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`, and the full headline-figure comparison table above.
- `data/best-effort-ceiling.json` requires no action from plan 31-10 — confirmed unchanged.
- TD-05 stays unticked here per this plan's own tick rule; it ticks only in 31-10 after the Round 4 verdict.
- Plan 31-10 should be aware that `28-DIFF.md`'s owner-excluded table now has one more column (Reason) than the version any earlier round saw — this is new, correctness-serving content (not a cosmetic change) and should be named explicitly when presenting "the machine diff" for the Round 4 sign-off (D-12).

## Self-Check: PASSED

- FOUND: `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md`
- FOUND: `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`
- FOUND: `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md`
- FOUND: `scripts/compute-pace-quality-calibration.mjs` (modified)
- FOUND: `scripts/compute-pr-ceiling-diff.mjs` (modified)
- FOUND: `scripts/compute-pr-ceiling-diff.test.mjs` (modified)
- FOUND commit `c71f9177` (feat(31-08): regenerate the five TD-05 artifacts against the merged archive)
- CONFIRMED: `git status --porcelain data/` is empty
- CONFIRMED: `npm test` exits 0, 85/85 files, 2596/2596 tests
- CONFIRMED: `shasum -a 256 28-DIFF.md` → `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*
