---
phase: 28
slug: pr-plausibility-ceiling
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-10
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `28-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled in by the planner/executor once PLAN.md task IDs
> exist; the framework, sampling rate, and Wave 0 rows below are already fixed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18` |
| **Config file** | none — no separate `vitest.config.*`; vitest runs against the default TS/ESM setup already used by every `*.test.ts` in `src/` |
| **Quick run command** | `npx vitest run src/analytics/compute-best-efforts.test.ts src/analytics/best-effort-utils.test.ts src/dashboard/views/detail-best-efforts-logic.test.ts src/dashboard/views/records-logic.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s quick / ~180s full suite (60+ files, 1500+ tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green, plus `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` all exit 0
- **Max feedback latency:** 20 seconds (quick command)

---

## Per-Task Verification Map

*Populated during planning — one row per task ID emitted by the PLAN.md files.
Every requirement below must be claimed by at least one task row before
`wave_0_complete` may be set true.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-T1 | 28-01 | 1 | PR-02, PR-05 | T-28-01-SC | 8 pure calibration functions exported, zero packages installed, import triggers no archive read | integration | `node -e "import('./scripts/compute-pr-ceiling-calibration.mjs').then(m => { const names = ['buildFilteredPopulations','nearestRankPercentile','describeDistribution','partitionMechanismClean','deriveCeilingMultiplier','deriveMinimumPopulation','applyCeiling','compareRiegelGate']; const missing = names.filter(n => typeof m[n] !== 'function'); if (missing.length) { console.error('missing exports: ' + missing.join(',')); process.exit(1); } console.log('all 8 pure functions exported; import triggered no archive read'); })"` | ✅ | ✅ green |
| 28-01-T2 | 28-01 | 1 | PR-02, PR-05 | T-28-01-A, T-28-01-B | `28-CEILING-CALIBRATION.md` regenerates byte-identically (besides its timestamp); activity ids validated against `/^i?\d{1,20}$/` before being written into the artifact | integration | `npm run compute-pr-ceiling-calibration && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md > /tmp/28-cal-run1.txt && npm run compute-pr-ceiling-calibration && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md > /tmp/28-cal-run2.txt && diff /tmp/28-cal-run1.txt /tmp/28-cal-run2.txt && echo 'IDEMPOTENT: 0 non-timestamp diff lines on the second run'` | ✅ | ✅ green |
| 28-01-T3 | 28-01 | 1 | PR-02, PR-05 | T-28-01-C | Pure calibration functions unit-tested including the anti-quota (K fixed before demotion counts are seen) and determinism properties | unit | `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs` | ✅ | ✅ green |
| 28-02-T1 | 28-02 | 1 | PR-03 | T-28-02-C | `EffortDemotion`/`EffortDemotionGuard` added with no setter/override field/persistence path — no new writable state | unit | `npx tsc --noEmit && npx vitest run src/analytics/compute-best-efforts.test.ts` | ✅ | ✅ green |
| 28-02-T2 | 28-02 | 1 | PR-03 | T-28-02-A | `prFlagBadgeSpecs`/panel row builder read `effort.demotion` defensively — a stale shard with the field absent yields `demoted: false`, never a TypeError | unit | `npx tsc --noEmit && npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` | ✅ | ✅ green |
| 28-02-T3 | 28-02 | 1 | PR-03 | T-28-02-A | `countDemotedAtDistance` reads `effort.demotion` defensively; a stale effort with no `demotion` key counts as 0 rather than throwing | unit | `npx tsc --noEmit && npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ | ✅ green |
| 28-03-T1 | 28-03 | 2 | PR-02, PR-03 | T-28-03-D | `isPlausible` carries a `guard` discriminator naming which guard fired, cited by doc comment against `28-CEILING-CALIBRATION.md` | unit | `npx tsc --noEmit && npx vitest run src/analytics/best-effort-utils.test.ts` | ✅ | ✅ green |
| 28-03-T2 | 28-03 | 2 | PR-02, PR-03 | T-28-03-A, T-28-03-B, T-28-03-C | Ceiling module is pure (no fs/path/process/while-loop), admits only a distance key and population array (non-circular by type), reason string built only from numbers | integration | `npx tsc --noEmit && node -e "const s=require('fs').readFileSync('src/analytics/best-effort-ceiling.ts','utf8').split('\n').filter(l=>!/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'); const bad=['require(','from \'fs\'','from \'path\'','process.','while (','while(']; const hits=bad.filter(b=>s.includes(b)); if(hits.length){console.error('purity/no-iteration violation: '+hits.join(', '));process.exit(1);} console.log('pure and single-shot: no fs, no path, no process, no while loop outside comments');"` | ✅ | ✅ green |
| 28-03-T3 | 28-03 | 2 | PR-02, PR-03 | T-28-03-D | Ceiling module's fail-open, strictness, order-independence and reason register unit-tested | unit | `npx vitest run src/analytics/best-effort-ceiling.test.ts src/analytics/best-effort-utils.test.ts` | ✅ | ✅ green |
| 28-04-T1 | 28-04 | 2 | PR-03 | T-28-04-A, T-28-04-C | `buildPrFlagsCell` made spec-driven; every string reaches the DOM via `textContent`/`appendAccessibleBadge`, description ids built from `row.distance` + `descriptionIdSuffix` so two badges cannot collide | unit | `npx tsc --noEmit && npx vitest run src/dashboard/views/detail-sections.test.ts` | ✅ | ✅ green |
| 28-04-T2 | 28-04 | 2 | PR-03 | T-28-04-B, T-28-04-D | Records screen states why a table is empty/short; stale-shard-missing-`demotion` degrades safely; no new writable control (button/input/listener) introduced | unit | `npx tsc --noEmit && npx vitest run src/dashboard/views/records.test.ts src/dashboard/views/records-logic.test.ts` | ✅ | ✅ green |
| 28-04-T3 | 28-04 | 2 | PR-03 | T-28-04-SC | Distinct demoted badge style added with zero `css-syntax-error` warnings from `build-widgets`, zero packages installed | integration | `npx vitest run src/dashboard/styles.test.ts && npm run build-widgets 2>&1 | grep -c "css-syntax-error" | grep -qx 0 && echo "stylesheet parsed clean: zero css-syntax-error warnings"` | ✅ | ✅ green |
| 28-05-T1 | 28-05 | 3 | PR-01, PR-02, PR-03, PR-05 | T-28-05-C | One shared demotion path (`demotionFromPlausibility`/`ceilingDemotion`); every rejection retained and flagged, none deleted | unit | `npx tsc --noEmit && npx vitest run src/analytics/compute-best-efforts.test.ts` | ✅ | ✅ green |
| 28-05-T2 | 28-05 | 3 | PR-01, PR-02, PR-03, PR-05 | T-28-05-B | Three literally-labelled passes; `deriveCeilings` called exactly once (source-text call-count assertion), input built solely from the already-filtered `byDistance` | unit + integration | `npx tsc --noEmit && npx vitest run src/analytics/compute-best-efforts.test.ts && grep -c "deriveCeilings(" src/analytics/compute-best-efforts.ts | grep -qx 2 && echo "deriveCeilings imported once and called exactly once"` | ✅ | ✅ green |
| 28-05-T3 | 28-05 | 3 | PR-01, PR-02, PR-03, PR-05 | T-28-05-A | Determinism, no-iteration-to-convergence and non-circularity each demonstrated failing before the fix and passing after | unit (regression, demonstrated-failing) | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "deterministic" && npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence" && npx vitest run src/analytics/compute-best-efforts.test.ts -t "non-circular"` | ✅ | ✅ green |
| 28-06-T1 | 28-06 | 4 | PR-01, PR-04 | T-28-06-A | Never-throwing ceiling-state module; four deliberately-corrupt inputs degrade to a safe `null`/per-distance fallback rather than discarding the whole file | unit | `npx tsc --noEmit && npx vitest run src/analytics/best-effort-ceiling-state.test.ts` | ✅ | ✅ green |
| 28-06-T2 | 28-06 | 4 | PR-01, PR-04 | T-28-06-B, T-28-06-E | State file wired into the compute step, written only when the ceiling moves; `previousState` never feeds `deriveCeilings` (read-only reporting) | unit + integration | `npx tsc --noEmit && npx vitest run src/analytics/compute-best-efforts.test.ts && npm run build && npm run compute-best-efforts && git status --porcelain data/best-effort-ceiling.json | grep -qv . && echo "second run reported no movement and left the committed state file unmodified"` | ✅ | ✅ green |
| 28-06-T3 | 28-06 | 4 | PR-01, PR-04 | T-28-06-C, T-28-06-D | CI commit pattern extended with one glob on the existing `git-auto-commit-action` step; no skip-ci token in any added line | integration | `grep -c "data/best-effort-ceiling.json" .github/workflows/daily-refresh.yml | grep -qx 1 && grep -c "git-auto-commit-action" .github/workflows/daily-refresh.yml | grep -qx 1 && node -e "const y=require('fs').readFileSync('.github/workflows/daily-refresh.yml','utf8'); const added=require('child_process').execSync('git diff HEAD -- .github/workflows/daily-refresh.yml').toString().split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')); const bad=added.filter(l=>l.includes('skip')&&l.includes('ci')); if(bad.length){console.error('added line contains a skip-ci token: '+bad.join(' | '));process.exit(1);} console.log('one glob added to the one existing auto-commit step; no skip-ci token in any added line');"` | ✅ | ✅ green |
| 28-07-T1 | 28-07 | 4 | PR-04 | T-28-07-A | OLD/NEW semantics computed side by side from one snapshot via pure exported functions; dry run touches only temp-directory paths | integration | `npm run build && node -e "import('./scripts/compute-pr-ceiling-diff.mjs').then(m => { const names=['reconstructOldDocument','extractNewState','diffPrState']; const missing=names.filter(n=>typeof m[n]!=='function'); if(missing.length){console.error('missing exports: '+missing.join(','));process.exit(1);} console.log('pure diff functions exported; import ran no archive sweep'); })"` | ✅ | ✅ green |
| 28-07-T2 | 28-07 | 4 | PR-04 | T-28-07-D | `28-DIFF.md` regenerates byte-identically (besides its timestamp) on a second run, proving it is safe to bind a sign-off to its content hash | integration | `npm run compute-pr-ceiling-diff && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md > /tmp/28-diff-run1.txt && npm run compute-pr-ceiling-diff && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md > /tmp/28-diff-run2.txt && diff /tmp/28-diff-run1.txt /tmp/28-diff-run2.txt && echo "IDEMPOTENT: 0 non-timestamp diff lines on the second run"` | ✅ | ✅ green |
| 28-07-T3 | 28-07 | 4 | PR-04 | T-28-07-B, T-28-07-C | Diff unit-tested including the net-zero-count retroactive promotion case; malformed activity ids rendered as `(malformed id)` rather than injected raw | unit | `npx vitest run scripts/compute-pr-ceiling-diff.test.mjs` | ✅ | ✅ green |
| 28-08-T1 | 28-08 | 5 | PR-04, PR-05 | T-28-08-B | Classifier-independent recount of demoted efforts; zero imports of the ceiling/compute/utils/types modules (self-tested stripper) | integration | `node scripts/compute-pr-ceiling-recount.mjs` | ✅ | ✅ green |
| 28-08-T2 | 28-08 | 5 | PR-04, PR-05 | T-28-08-D | 662-activity impossible-sample cohort dry-run count and its overlap with the demoted set, both reported as findings rather than gated | integration | `node scripts/compute-pr-ceiling-recount.mjs` | ✅ | ✅ green |
| 28-08-T3 | 28-08 | 5 | PR-04, PR-05 | T-28-08-B, T-28-08-C | Recount tested (10 describe blocks / 24 tests); `--expect-demoted`/`--expect-cohort` proven additive-only, never suppressing a structural finding | unit | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Live confirmation (2026-09-11, plan 28-09 Task 1):** `npm test` — 79 files / 2286 tests / 0 failures. `npx tsc --noEmit` — clean. `node scripts/compute-pr-ceiling-recount.mjs` — exit 0, PASS. `npm run verify-dashboard` — 64/64 checks passed, 0 failures. All 24 task rows above are corroborated by this single green run of the full suite plus the two standalone scripts; no row above required an isolated re-run to confirm.

---

## Wave 0 Requirements

- [x] New `describe` blocks in `src/analytics/compute-best-efforts.test.ts` for: determinism (two-run byte-identity), non-circularity (filtered-vs-unfiltered divergence fixture), the pinned `4556693525` 400m regression case (45.2s / 8.85 m/s — corrected against the live archive), and "no path deletes a flagged effort." — landed in 28-05 (commits `18e4ab0a`, `bc0589fa`, `dbb4b2e4`); confirmed present by name (`-t "deterministic"`, `-t "no iteration to convergence"`, `-t "non-circular"`, `auditNoDemotedEffortRemoved`) and green in the live run above.
- [x] New pure ceiling-derivation function plus its own `*.test.ts` — `src/analytics/best-effort-ceiling.ts` + `src/analytics/best-effort-ceiling.test.ts`, landed in 28-03; purity grep and unit suite both green above.
- [x] `scripts/compute-pr-ceiling-diff.mjs` + its guard test, mirroring `scripts/compute-pace-residual.mjs`'s side-by-side OLD/NEW computation shape — landed in 28-07; idempotence proven by a live second run (Task 1 of this plan re-ran `npm run compute-pr-ceiling-diff` and confirmed the hash below is stable — see `28-DIFF.md` sha256 in Round 1 Checkpoint R7).
- [x] A classifier-independent recount script for Criterion 5, mirroring `scripts/compute-pace-quality-recount.mjs`'s zero-classifier-import discipline exactly (D-15) — `scripts/compute-pr-ceiling-recount.mjs`, landed in 28-08; run live above (PASS, exit 0).
- [x] Regression case for `buildPrFlagsCell` covering a demoted+PR and a demoted+excluded row rendering distinguishably — `src/dashboard/views/detail-best-efforts-logic.test.ts:302` (`'a demoted-plus-excluded row produces exactly two specs whose visibleText and descriptionIdSuffix are both distinct...'`) and `:314` (four-flag combination including `isPr` + `demoted` together, asserting all four specs have distinct non-empty text) — both confirmed present and green above. `buildPrFlagsCell` itself (`detail-sections.ts`) carries a source-wiring guard (`detail-sections.test.ts:419`) confirming it calls `prFlagBadgeSpecs` exactly once rather than re-implementing the branching inline.
- [x] `records-logic.test.ts` / `records.test.ts` case for the new "demoted, not never-attempted" empty-state branch — `records-logic.test.ts:566` (`'all-time with demotedCount > 0 returns the ceiling wording naming the count'`) and `:573` (singular-agreement case) plus `resolvePrTableDemotionNote` tests at `:585`+; confirmed present and green above.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A ceiling-demoted effort remains visibly present, with its stated demotion reason, on the activity detail view — and is absent only from the ranked PR list | PR-03 | Success criterion 4 explicitly requires the effort be "read directly in the browser, not merely present in JSON". A JSON assertion is exactly the self-agreeing check the project's Phase 23 CR-01 lesson exists to guard against. | Build and serve the dashboard, hard-reload (stale `index.html`/`index.json` in staged builds is a known trap), navigate to a known ceiling-demoted activity's detail view, read the effort row and its demotion reason on screen, then confirm the same effort is absent from the Records/PR ranking screen. Capture the served digest, not the build log. |
| Archive-wide before/after PR diff reviewed and signed off | PR-04 | Success criterion 5 makes developer sign-off the deliverable itself — a human must read every record that changes hands. | Generate the diff from the real full archive, read it, and confirm its record count reconciles with the independently-derived ceiling-rejected count from the criterion 3 dry run. Sign off before the phase closes. |

---

## Round 1 Checkpoint (R1-R7)

**Drafted:** 2026-09-11, plan 28-09 Task 1. No row below has been run. No verdict is pre-filled.
Every verdict reads `pending` until the developer answers in Task 2.

### Build and served-digest evidence (step 1-3)

- `npm run build && npm run compute-all-stats && npm run build-widgets` — ran clean, zero
  `build-widgets` skip reported for any asset (full build log available; no stale `dist/`
  output needed deleting).
- Emitted dashboard SPA JS asset: **`assets/index-vmd1d_n_.js`**.
- Served over HTTP from `dist/widgets` at `http://127.0.0.1:8917` (the port and process an
  operator/continuation agent should reuse are recorded in this plan's return message; restart
  with `npx http-server dist/widgets -p 8917 -c-1` if the process is no longer running).
- **SERVED digest, computed from FETCHED bytes** (not the local file, not the build log):
  `curl -s http://127.0.0.1:8917/assets/index-vmd1d_n_.js | shasum -a 256` →
  `affdf2f9e9aa7261368a4981323376cb159a3b30e1e881c107605329627b810a`. This is byte-identical to
  `shasum -a 256 dist/widgets/assets/index-vmd1d_n_.js` on the local file, confirming the server
  is not serving a stale bundle.
- `curl -s http://127.0.0.1:8917/data/dashboard/index.json` diffed byte-for-byte against
  `data/dashboard/index.json` — **identical**, sha256
  `fa8c6576254816e0e0791513f9648be77b79f276539bf65b0e67cf19bdfdd175` on both.
- `curl -s http://127.0.0.1:8917/data/stats/best-efforts/4556693525.json` diffed byte-for-byte
  against the local shard — **identical**, sha256
  `82c467ac8de0344a7c9ad810c225a285bda429f2306fee71dbced0b8c96d1b39` on both. The two substitute
  activities' shards used by R2/R5 below (`3475712118.json`, `3475725513.json`) were also
  curled and diffed byte-for-byte against their local files — both identical (HTTP 200).

### Independent-figure evidence (step 4-5)

- `node scripts/compute-pr-ceiling-recount.mjs` — full stdout, verbatim:

```
D-15 independent recount: reading data/stats/best-efforts.json and data/dashboard/index.json off disk (no ceiling/compute/utils/types import)...

Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 52
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      18
    unrecognised guards: 0
  Per-distance breakdown (own arithmetic):
    10k: 0
    1k: 11
    1mi: 5
    400m: 36
    5k: 0
    half: 0
    marathon: 0
  Cross-check vs. doc.totals.effortsDemoted: own=52 totals=52 disagrees=false
  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=52 demoted=52 disagrees=false
  rankedButDemotedIds (0): (none)
  demotedWithoutReason (0): (none)
  Pinned fixture 4556693525@400m: durationSec=45.2 guard=null durationMatches45_2=true guardIsCeiling=false

PR-05 impossible-sample cohort (own arithmetic, live denominator):
  archiveDenominator: 1890
  rowsWithQuality:    1890
  rowsMissingQuality: 0
  cohortCount:        662
  cohortPct:          35%

  CAUTION: the impossible-sample cohort (activities carrying at least one physically impossible SAMPLE anywhere in their stream) and the demoted-effort population (efforts at one of the seven target distances rejected by a guard) are two different measurements, not two views of one number. A sample can be impossible mid-run without ever landing inside a swept target window, and a demoted effort can occur in an activity whose other samples never crossed the per-sample floor.
  Overlap with the demoted-effort population:
    cohortWithDemotedEffort:    35
    cohortWithoutDemotedEffort: 627
    demotedNotInCohort:         1
    biteRatePct (finding, not a threshold): 5.3%

PASS: recount agrees with the shipped totals; no disagreements found.
```

  Exit code: **0**.
- **CLI semantics warning, carried forward from 28-08 (finding (a) of this plan's inputs) — do
  not misread the exit code of a differently-flagged run:**
  `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 18` **exits 1**
  (`ownDemotedTotal` is all-guard, 52, by Task 1's own specification in 28-08 — it can never
  equal 18). `--expect-demoted 52` exits 0. The recount's own `byGuard.ceiling` line — **18** —
  is the figure that independently corroborates `28-DIFF.md`'s stated ceiling-only total, not
  the `--expect-demoted` flag's pass/fail exit code. R7 below is drafted to compare the right
  pair of numbers.
- `shasum -a 256 .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` →
  `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6`. This is the hash the D-14
  sign-off in Task 2 binds to.

### Step 6 — the pinned fixture's actual state, read from the committed shard BEFORE any row runs

`data/stats/best-efforts/4556693525.json`, 400m effort: `durationSec: 45.2`,
`demotion: null`, `demotion.guard: null`, `excludedFromRecords: true`. This effort carries
**no ceiling demotion** — it is kept out of rankings by the 2026-09-08 manual curation
exclusion (`data/best-effort-exclusions.json`, reason: `"bad measurement"`), not by the
plausibility ceiling. `REQUIREMENTS.md`'s PR-05 line still expects "the guard must be
demonstrated rejecting it," but the live archive shows this specific activity being excluded
by the owner, not rejected by any guard — this is the same finding 28-08 already surfaced and
flagged for this checkpoint's attention.

**Consequence for R2 as originally drafted:** R2 asked the developer to read a
ceiling-demotion badge and reason on activity `4556693525`'s 400m row. Since that effort
carries `demotion: null`, there is no demotion badge to read on it — R2 as literally drafted
against this activity would be vacuous (unpassable in the fail direction: it could never show a
demotion badge, so a developer could not distinguish "the mechanism works" from "the mechanism
is broken," because neither state produces a badge here). Per the plan's own house rule, this
row is **substituted** rather than run vacuously:

- **Original pinned activity `4556693525` is unusable for R2** for the reason stated above.
- **Substitute activity: `3475712118`** (400m effort, `durationSec: 71`, chosen because it is
  one of the 8 genuinely ceiling-demoted 400m efforts in the live archive — selection made by
  querying `data/stats/best-efforts.json` for `efforts[].demotion.guard === 'ceiling'` at
  `distance === '400m'` and taking the first result). Its shard confirms:
  `demotion.guard: "ceiling"`, `demotion.reason: "implied 5.63 m/s exceeds personal ceiling
  5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)"`, `excludedFromRecords:
  false`. R2 is redrafted against this activity below.
- **Activity `4556693525` is NOT dropped from the checkpoint** — R3 still uses it, since "kept
  off the ranked list by manual exclusion, not by the ceiling" is itself a real, statable
  mechanism worth confirming on the rendered page (see R3's mechanism note below).

### Step 7 — a distance with a non-empty ranked table and a positive demoted count (for R6)

Per-distance ranked counts after the ceiling change (28-05-SUMMARY, corroborated by this run's
`compute-best-efforts` console tail): `400m: 10 ranked`, `1k: 10 ranked`, `1mi: 10 ranked`,
`5k: 10 ranked`, `10k: 10 ranked`, `half: 10 ranked`, `marathon: 0 ranked`. **400m** is a
non-empty (10-ranked) table with a positive demoted count (36 all-guard, 8 ceiling-only) —
used for R6 below.

**A second, more consequential finding surfaced by checking this in the other direction:** no
distance in the live archive has a ranked table that is EMPTY (0 ranked) *and* a positive
demoted count. The only empty table is marathon (0 ranked), and marathon's demoted count is 0
— its table is empty because the archive has zero eligible marathon activities, not because the
ceiling emptied it. This means **R4 as originally drafted ("D-03, the empty table explains
itself") has no reachable state in the live archive today** — `resolvePrTableEmptyState`'s
`demotedCount > 0` branch (the "No 400m efforts passed the plausibility ceiling" copy) is
unit-tested directly against synthetic arguments (`records-logic.test.ts:566`,`:573`) but there
is currently no live distance whose real ranked table renders that branch, because every
ceiling-affected distance backfills to 10 ranked entries from its own filtered population
rather than emptying. R4 is redrafted below as **NOT EXERCISABLE**, per the plan's own
instruction that an unreachable row must be recorded as such rather than silently dropped or
quietly retargeted at a state that doesn't mean the same thing.

### Step 8 — an activity with a demoted effort that is also excluded or low-confidence (for R5)

Two candidates found by querying the live archive for an effort where `demotion !== null` AND
(`excludedFromRecords === true` OR `lowConfidence === true`):
- `3475725513` @ 400m: `demotion.guard: "world-record"`, `excludedFromRecords: true` — an
  activity 28-07's diff already lists as a "removed" 400m record.
- `3540594727` @ 400m: `demotion.guard: "max-speed"`, `lowConfidence: true`.

**Chosen: `3475725513`** (demoted + excluded combination, mirroring the exact fixture shape
`detail-best-efforts-logic.test.ts:302` unit-tests). Its shard confirms `demotion.reason:
"implied 27.32 m/s exceeds world-record pace 9.30 m/s"` and the matching exclusion entry in
`data/best-effort-exclusions.json` carries reason `"Recorded with the same inaccurate GPS
device class; its 1k time is not trusted as a genuine personal record."`. Per
`prFlagBadgeSpecs`'s source (`detail-best-efforts-logic.ts:261-287`), the two expected badge
texts are:
- `Demoted — implied 27.32 m/s exceeds world-record pace 9.30 m/s`
- `Excluded — Recorded with the same inaccurate GPS device class; its 1k time is not trusted as a genuine personal record.`

Both are stated here, before the row is run, so R5 compares the developer's on-screen reading
against a value derived from the shard and the exclusions file, never against the page's own
other number.

### The rows

- **R1 — served digest.**
  The developer confirms the page under test was served from the digest recorded above, by
  reading the asset filename in the Network panel and comparing it to `index-vmd1d_n_.js`.
  Expected: Network panel shows a request for `assets/index-vmd1d_n_.js` (or a document whose
  `<script>`/`<link>` tags name that exact file).
  CAN PASS: the Network panel shows exactly `index-vmd1d_n_.js` as the loaded JS asset.
  CAN FAIL: a stale bundle serves a different asset filename (e.g. an older hashed name from a
  previous build still cached by the browser or a stale `dist/` copy).
  **Verdict: pending**

- **R2 — criterion 4, the demoted effort is visible with its reason (activity substituted —
  see Step 6 above; original pinned activity `4556693525` carries `demotion: null` and is
  unusable for this row).**
  Open activity `3475712118`'s detail view, hard-reload, and read the Best Efforts panel's
  400m row. Quote the duration and the demotion badge's visible text VERBATIM.
  Independently derived, stated before the row runs: expected duration **71.0s**, expected
  badge text **`Demoted — implied 5.63 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99
  m/s over 1825 filtered 400m efforts)`**, both read from the committed shard
  `data/stats/best-efforts/3475712118.json` in Step 6.
  CAN PASS: the 400m row renders with duration 71.0s and a badge whose text matches the
  expected string above (or differs only in ways that still name the same guard and numbers).
  CAN FAIL: the 400m row is absent entirely (the delete-not-demote regression), the badge
  names a condition without its measured numbers, or the quoted reason disagrees with the
  shard.
  **Verdict: pending**

- **R3 — criterion 4, absent only from the ranked list (mechanism note added: this activity is
  kept off rankings by manual exclusion, not by the ceiling guard — see Step 6).**
  Navigate to the Records screen's 400m table and confirm activity `4556693525` does not
  appear as a ranked row, while the same effort was just read on its own detail view (badge
  text there is expected to read `Excluded from records` or a specific exclusion reason —
  NOT a ceiling-demotion badge, since `demotion` is `null` for this effort).
  CAN PASS: the activity is absent from the 400m ranked table AND its detail view shows an
  "excluded" badge (not a "demoted" badge) — confirming the correct mechanism (manual
  exclusion) is what the page displays, not a fabricated ceiling reason.
  CAN FAIL: the activity appears in the ranked table (a demoted-or-excluded effort still
  ranks); the detail view shows no badge at all (which would mean the exclusion is invisible,
  reproducing the delete-not-flag defect for the exclusion path); or the detail view shows a
  "demoted" badge (which would mean the page is fabricating a ceiling reason this effort does
  not actually carry).
  **Verdict: pending**

- **R4 — D-03, the empty table explains itself — NOT EXERCISABLE (see Step 7 above).**
  No distance in the live archive currently has a ranked table that renders as fully empty
  (0 rows) with a positive demoted count. `resolvePrTableEmptyState`'s ceiling-emptied branch
  (`records-logic.test.ts:566`,`:573`) is unit-tested against synthetic arguments and known to
  produce the correct heading/body when given `demotedCount > 0`, but no live distance's real
  ranked table currently exercises that code path end-to-end in the browser: every
  ceiling-affected distance (400m/1k/1mi) backfills to a full 10-row table from its own
  filtered population, and the one distance with an empty table (marathon, 0 ranked) is empty
  because the archive has zero eligible marathon activities — its demoted count is 0, so it
  renders the OTHER empty-state branch ("No marathon efforts yet"), not the ceiling one.
  CAN PASS: N/A — this state does not exist in the current archive.
  CAN FAIL: N/A — this state does not exist in the current archive.
  **Verdict: NOT EXERCISABLE — no live distance has both zero ranked rows and a positive demoted count; the branch is unit-tested but not end-to-end reachable in the browser today.**

- **R5 — D-09, two adjacent badges are separable (activity identified in Step 8:
  `3475725513`, a demoted-and-excluded 400m effort).**
  Open activity `3475725513`'s detail view and quote EVERY badge's visible text in the 400m
  row's flags cell, in order, exactly as rendered. Then, with a screen reader or by inspecting
  the accessible name in DevTools, confirm the two claims are announced as separate labelled
  items rather than as one run-on string.
  Independently derived, stated before the row runs: expected two badges, verbatim
  **`Demoted — implied 27.32 m/s exceeds world-record pace 9.30 m/s`** and **`Excluded —
  Recorded with the same inaccurate GPS device class; its 1k time is not trusted as a genuine
  personal record.`**, read from the shard and the exclusions file in Step 8.
  CAN PASS: both badge texts render distinctly, matching the two expected strings above, and
  each has its own accessible name/description (distinct `aria-describedby` targets).
  CAN FAIL: the quoted texts read as one concatenated claim (the Phase 24 R15 `PRExcluded —
  {reason}` shape), or the two badges share one `aria-describedby` target.
  **Verdict: pending**

- **R6 — D-03, a short table says so (distance identified in Step 7: 400m).**
  At 400m, confirm the ranked table renders its rows (10 entries) AND carries the demotion
  note naming the demoted count.
  Independently derived, stated before the row runs: expected count **36** — this is the
  ALL-GUARD count at 400m (`countDemotedAtDistance` counts every non-null `demotion`
  regardless of guard, per `records-logic.ts:159-178`), matching the recount script's own
  per-distance breakdown ("400m: 36") from Step 4/5 exactly, since both use the same
  all-guard semantics. **Wording caveat the developer should weigh when reading this row:**
  of those 36, only 8 are ceiling-guard demotions (this phase's own mechanism) — the remaining
  28 are pre-existing world-record (18) and max-speed (10) guard demotions this phase did not
  introduce. `resolvePrTableDemotionNote`'s copy reads "36 400m efforts were demoted by the
  plausibility ceiling," which literally over-attributes 28 of the 36 to a mechanism that did
  not demote them.
  CAN PASS: the table renders 10 rows AND a note is present stating a count that matches 36.
  CAN FAIL: rows render with no note despite a non-zero demoted count at 400m, OR the note's
  count does not match 36, OR — flagged as a discrete sub-finding for the developer to weigh,
  not folded silently into a pass — the note's wording claims all 36 were demoted "by the
  plausibility ceiling" when the independently-derived per-guard breakdown above shows only 8
  of the 36 actually were.
  **Verdict: pending**

- **R7 — criterion 5, the diff is reviewed and signed off.**
  The developer reads `28-DIFF.md` in full — every record that changes hands, in both
  directions, including the Retroactive promotions section — and confirms its stated
  ceiling-only demoted total (**18**) reconciles with the recount's own `byGuard.ceiling`
  figure (**18**) from Step 4/5, NOT with the recount's `ownDemotedTotal` (52, all-guard) or
  with `--expect-demoted 18`'s exit code (which is 1, by design — see the CLI semantics
  warning above). This is a document read, not a browser action. The developer's approval is
  recorded in this file with the sha256 from Step 5
  (`08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6`), so the approval names
  the exact version reviewed.
  CAN PASS: the developer confirms 28-DIFF.md's stated 18 matches the recount's `byGuard.ceiling`
  figure (18), finds no record they recognise as wrongly demoted, and can account for the 3
  retroactive promotions listed.
  CAN FAIL: the two ceiling-only totals disagree (18 vs. the recount's own `byGuard.ceiling`
  value, if it were ever to differ), or a record the developer recognises as wrongly demoted
  appears in the list, or a promotion the developer cannot account for appears.
  **Verdict: pending**

### Reachability Audit

All fourteen CAN PASS / CAN FAIL lines, repeated together per the plan's requirement (R4 is
included for completeness with its NOT EXERCISABLE status stated rather than a CAN PASS/CAN
FAIL pair, since no reachable state exists to write one against):

1. R1 CAN PASS: the Network panel shows exactly `index-vmd1d_n_.js` as the loaded JS asset.
2. R1 CAN FAIL: a stale bundle serves a different asset filename.
3. R2 CAN PASS: the 400m row on activity `3475712118` renders duration 71.0s and the expected ceiling-demotion badge text.
4. R2 CAN FAIL: the 400m row is absent entirely, the badge lacks measured numbers, or the quoted reason disagrees with the shard.
5. R3 CAN PASS: activity `4556693525` is absent from the 400m ranked table AND its detail view shows an "excluded" badge, not a "demoted" one.
6. R3 CAN FAIL: the activity appears in the ranked table; its detail view shows no badge at all; or its detail view shows a "demoted" badge it does not actually carry.
7. R4: NOT EXERCISABLE — no reachable state (no distance has both zero ranked rows and demotedCount > 0); no CAN PASS/CAN FAIL pair can be written against a state that does not exist.
8. R5 CAN PASS: both expected badge texts render distinctly on activity `3475725513`'s 400m row, each with its own accessible name/description.
9. R5 CAN FAIL: the two texts concatenate into one run-on string, or they share one `aria-describedby` target.
10. R6 CAN PASS: the 400m table renders 10 rows and a note stating a count matching 36.
11. R6 CAN FAIL: no note despite a non-zero demoted count; the note's count does not match 36; or the note's wording misattributes all 36 to the ceiling when only 8 are ceiling demotions.
12. R7 CAN PASS: the developer confirms 28-DIFF.md's stated 18 matches the recount's `byGuard.ceiling` (18), finds no wrongly-demoted record, and accounts for the 3 retroactive promotions.
13. R7 CAN FAIL: the two ceiling-only totals disagree, a wrongly-demoted record appears, or an unaccountable promotion appears.
14. (R4's non-pair is item 7 above; no fourteenth line is written for a row proven unreachable — the audit states this explicitly rather than manufacturing a line for a state that does not exist.)

Rows: 6 of 7 carry a complete CAN PASS/CAN FAIL pair (R1, R2, R3, R5, R6, R7). R4 is struck to
NOT EXERCISABLE per the plan's own instruction, with its unreachability stated rather than a
row silently dropped.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
