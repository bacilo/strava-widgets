---
phase: 28
slug: pr-plausibility-ceiling
status: gaps_found
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
| 28-10-T1 | 28-10 | gap-closure 1 | PR-04, PR-05 | T-28-10-A, T-28-10-B | RED: failing tests for `recountCeilingSweep`, `parseInputPaths` and the pinned-fixture verdict, none of which exist yet | unit (TDD RED) | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs 2>&1 \| grep -E "failed\|Failed"` (expected: at least one failure at this RED step) | ✅ | ✅ green (RED demonstrated) |
| 28-10-T2 | 28-10 | gap-closure 1 | PR-04, PR-05 | T-28-10-A, T-28-10-B, T-28-10-C | GREEN: sweep/verdict/path-flags implemented; CLI run against the real pre-fix archive exits 1 as predicted (18 vs 31, 13 labels, `guardIsCeiling=false`) | unit + integration (TDD GREEN, demonstrated failing pre-fix) | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs && node scripts/compute-pr-ceiling-recount.mjs --best-efforts /Users/pedf/workspace/strava-widgets/data/stats/best-efforts.json --index /Users/pedf/workspace/strava-widgets/data/dashboard/index.json; test $? -eq 1` | ✅ | ✅ green |
| 28-11-T1 | 28-11 | gap-closure 1 | PR-01, PR-02, PR-03, PR-05 | T-28-11-A, T-28-11-B | RED: real-exclusion pinned regression (4556693525), precedence, non-circularity, determinism tests fail against pre-fix Pass 3 | unit (TDD RED) | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "REAL committed exclusion" 2>&1 \| grep -E "failed"` (expected at this RED step) | ✅ | ✅ green (RED demonstrated) |
| 28-11-T2 | 28-11 | gap-closure 1 | PR-01, PR-02, PR-03, PR-05 | T-28-11-A, T-28-11-C, T-28-11-E | GREEN: ceiling applied to owner-excluded efforts in Pass 3 (CR-01 closed); full suite + tsc + npm test green | unit + integration (TDD GREEN) | `npx vitest run src/analytics/compute-best-efforts.test.ts && npx tsc --noEmit && npm test` | ✅ | ✅ green |
| 28-12-T1 | 28-12 | gap-closure 1 | PR-02, PR-04 | T-28-12-A, T-28-12-C | Diff generator: per-effort (not per-activity) exclusion, owner-excluded ceiling listing, temp cleanup (WR-04, IN-04); committed 28-DIFF.md left byte-unchanged | unit + integration | `npm run build && npx vitest run scripts/compute-pr-ceiling-diff.test.mjs` | ✅ | ✅ green |
| 28-12-T2 | 28-12 | gap-closure 1 | PR-02, PR-04 | T-28-12-C | Calibration generator: population mirrors compute-best-efforts.ts Pass 1 exactly (WR-03); committed 28-CEILING-CALIBRATION.md left byte-unchanged | unit + integration | `npm run build && npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs scripts/compute-pr-ceiling-diff.test.mjs` | ✅ | ✅ green |
| 28-13-T1 | 28-13 | gap-closure 1 | PR-03 | T-28-13-A, T-28-13-C | Guard-accurate Records demotion note/empty-state (CR-02) and scope-aware note (WR-01) | unit | `npx vitest run src/dashboard/views/records-logic.test.ts src/dashboard/views/records.test.ts && npx tsc --noEmit` | ✅ | ✅ green |
| 28-13-T2 | 28-13 | gap-closure 1 | PR-03 | T-28-13-D, T-28-13-B | Dark-theme demoted-badge WCAG AA contrast token (WR-02) and non-"excluded" badge wording (IN-02) | unit + integration | `npx vitest run src/dashboard/styles.test.ts src/dashboard/views/detail-best-efforts-logic.test.ts src/dashboard/views/detail-sections.test.ts && npx tsc --noEmit && npm test` | ✅ | ✅ green |
| 28-14-T1 | 28-14 | gap-closure 2 | PR-03, PR-04, PR-05 | T-28-14-A, T-28-14-B, T-28-14-D | `data/stats/best-efforts.json` regenerated against the pinned snapshot; ceiling state unchanged; 22-assertion structural comparison shows exactly the 13 predicted efforts changed | integration | `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65 && git diff --quiet -- data/best-effort-ceiling.json && grep -c "Round 2 Evidence" .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` | ✅ | ✅ green |
| 28-14-T2 | 28-14 | gap-closure 2 | PR-03, PR-04, PR-05 | T-28-14-C, T-28-14-B | 28-DIFF.md and 28-CEILING-CALIBRATION.md regenerated twice each (idempotent), reconciled 31/31/31, four unchanged sections byte-identical | integration | `test "$(grep -c '^\| .* \| 400m \| .* \| 5.1098 \|$' .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md)" -eq 11 && grep -q "Ceiling demotions on owner-excluded efforts" .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md && node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` | ✅ | ✅ green |
| 28-14-T3 | 28-14 | gap-closure 2 | PR-03, PR-04, PR-05 | (docs-only, no threat surface) | Per-Task Verification Map extended for 28-10..28-15; deferred items logged (this row) | docs | `grep -c "28-1[0-5]" .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md && grep -c "Gap closure 28-10..28-15" .planning/phases/28-pr-plausibility-ceiling/deferred-items.md` | ✅ | ✅ green |
| 28-15-T1 | 28-15 | gap-closure 3 | PR-03, PR-04, PR-05 | T-28-15-A, T-28-15-B, T-28-15-C | Digest-verified build served; every Round 2 expected value re-derived independently of the browser/records-logic.ts; Round 2 rows drafted | integration | `npm test && npx tsc --noEmit && npm run verify-dashboard && node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65 && grep -c "Round 2 Checkpoint" .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` | ✅ | ⬜ pending (this plan) |
| 28-15-T2 | 28-15 | gap-closure 3 | PR-03, PR-04, PR-05 | T-28-15-B, T-28-15-C, T-28-15-D, T-28-15-E | CHECKPOINT (blocking, human-verify): Round 2 browser verification (R2-1..R2-6) and a fresh PR-04 sign-off bound to 28-DIFF.md's new sha256 | manual (browser checkpoint) | `npm test && npx tsc --noEmit && npm run verify-dashboard && node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` | ✅ | ⬜ pending (this plan) |

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

### Pre-run re-verification (2026-09-16, Task 2, before any row was presented)

The rows were drafted on 2026-09-11; the evidence was re-gathered before presenting them:

- Gates: `npm test` (79 files, 2286 tests) exit 0; `npx tsc --noEmit` exit 0; `npm run build`
  exit 0; `npm run build-widgets` exit 0; `npm run verify-dashboard` 64 checks, 0 failures;
  `node scripts/compute-pr-ceiling-recount.mjs` exit 0 with figures unchanged from the stdout
  recorded above (52 total; 19/15/18 by guard; 400m 36, 1k 11, 1mi 5).
- The rebuild emitted the same content-hashed bundle. `dist/widgets/index.html` references
  `assets/index-vmd1d_n_.js` (two older `index-*.js` files remain in `dist/widgets/assets/`
  but are not referenced). Served from `http://127.0.0.1:8917`, FETCHED digest
  `affdf2f9e9aa7261368a4981323376cb159a3b30e1e881c107605329627b810a` — identical to the digest
  recorded on 2026-09-11.
- Served vs local, byte-identical (sha256 prefix): `dashboard/index.json` `fa8c6576254816e0`,
  `stats/best-efforts.json` `f38e042e2754e929`, shards `4556693525` `82c467ac8de0344a`,
  `3475712118` `072aa1b94c6fb394`, `3475725513` `217cf6a6c578cad5`.
- Local `master` is 9 nightly data commits behind `origin/master`; NOT pulled, so the checkpoint
  runs against the archive the figures above were derived from.
- **Expected-value corrections (rendering format, not criteria):** R2's detail-view duration is
  rendered by `formatEffortDuration` (`src/dashboard/views/list.ts:128`) as `m:ss`, so the
  on-screen value for `durationSec: 71` is **`1:11`**, not the literal `71.0s` — without this
  correction R2 would be unpassable. R3's expected badge for `4556693525`, from
  `data/best-effort-exclusions.json` (`distances: null`, reason `"bad measurement"`) through
  `prFlagBadgeSpecs`, is exactly **`Excluded — bad measurement`**.
- R6's wording sub-finding is confirmed in the source before the row runs:
  `resolvePrTableDemotionNote` (`src/dashboard/views/records-logic.ts:225-235`) renders
  `${count} ${label} efforts were demoted by the plausibility ceiling.` with the all-guard
  `countDemotedAtDistance` count.

### The rows

- **R1 — served digest.**
  The developer confirms the page under test was served from the digest recorded above, by
  reading the asset filename in the Network panel and comparing it to `index-vmd1d_n_.js`.
  Expected: Network panel shows a request for `assets/index-vmd1d_n_.js` (or a document whose
  `<script>`/`<link>` tags name that exact file).
  CAN PASS: the Network panel shows exactly `index-vmd1d_n_.js` as the loaded JS asset.
  CAN FAIL: a stale bundle serves a different asset filename (e.g. an older hashed name from a
  previous build still cached by the browser or a stale `dist/` copy).
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.

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
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.

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
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.

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
  **Verdict: NOT EXERCISABLE — no live distance has both zero ranked rows and a positive demoted count; the branch is unit-tested but not end-to-end reachable in the browser today.** The developer's blanket "approved" (2026-09-16) does not convert this to PASS: a state that does not exist cannot be observed.

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
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.

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
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.
  **Sub-finding carried forward, not resolved by this verdict:** the blanket "approved" does not individually address the wording caveat stated above (the note attributes all 36 400m demotions to "the plausibility ceiling" while the independent recount shows 8 ceiling, 18 world-record, 10 max-speed). It is recorded here as an open observation for a later round, not as a gap and not as a pass of that specific claim.

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
  **Verdict: PASS (blanket)** — developer, 2026-09-16, verbatim: "approved". Recorded as a blanket verdict covering this row; no per-row observation was supplied, and none is invented here.

### Round 1 Outcome (2026-09-16)

Developer response, verbatim, to the seven rows as presented (resume signal: `"approved"` = blanket
PASS across all rows): **"approved"**.

| Row | Verdict |
|-----|---------|
| R1 served digest | PASS (blanket) |
| R2 demoted effort visible with reason (`3475712118`) | PASS (blanket) |
| R3 absent from ranking, excluded badge on detail (`4556693525`) | PASS (blanket) |
| R4 empty 400m table explains itself | NOT EXERCISABLE |
| R5 two separable badges (`3475725513`) | PASS (blanket) |
| R6 non-empty 400m table carries its demotion note | PASS (blanket), wording sub-finding carried forward |
| R7 diff reviewed and reconciled (18 = 18) | PASS (blanket) |

No row FAILED or was BLOCKED; no Gap-Closure Record is opened. Open observations carried forward
(not gaps, not fixed here): (a) R6's note wording over-attributes non-ceiling demotions to the
ceiling; (b) R4's ceiling-emptied branch has no live end-to-end reachable state; (c) the real
activity `4556693525` is kept off the rankings by manual exclusion (`demotion: null`,
recount: `guard=null ... guardIsCeiling=false`) — PR-05's guard rejection of that fixture is
demonstrated by the synthetic unit fixture `src/analytics/compute-best-efforts.test.ts:687`
(green on 2026-09-16), not by the shipped document.

`git status --porcelain src scripts` was empty after the checkpoint.

### PR-04 Sign-off (D-14)

- **Artifact reviewed:** `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`
- **sha256:** `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6` (recorded in Task 1;
  re-hashed after the checkpoint on 2026-09-16 — identical, the artifact is byte-unchanged)
- **Developer's words, verbatim:** "approved"
- **Date:** 2026-09-16
- Nothing was written into `28-DIFF.md`; it remains purely generated.

### AMENDED 2026-09-16 — Round 1 outcome no longer sufficient

Added after the checkpoint; the Round 1 Outcome and PR-04 Sign-off above are retained verbatim.
The same-day code review (`28-REVIEW.md`, CR-01/CR-02) and phase verification
(`28-VERIFICATION.md`, `gaps_found`, 2/5) found that the ceiling check never runs on owner-excluded
efforts: 13 shipped efforts exceed their distance's `ceilingMps` yet carry `demotion: null`
(11 at 400m, 2 at 1k, all `excludedFromRecords: true`, including `4556693525` at both). No Round 1
row could detect this: R3 asserted the page shows `Excluded — bad measurement` and not a demoted
badge, which is exactly what the defect produces; R7's 18 = 18 reconciliation compared two
artifacts sharing the blind spot. Open observation (a) is CR-02; observation (c) is CR-01.

Consequences, at the developer's direction: PR-03, PR-04 and PR-05 reopened in `REQUIREMENTS.md`;
the PR-04 sign-off above certifies sha256 `08e93d5a…77c6` only and must be renewed against the
regenerated diff; `nyquist_compliant` returned to false, since the recount script cannot fail on
the pinned-fixture check (WR-05). Next: `/gsd-plan-phase 28 --gaps`.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s (quick command measured at 3s, 178 tests, 2026-09-16)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** REOPENED 2026-09-16 after verification gaps_found (see AMENDED section); originally approved 2026-09-16 — developer, verbatim: "approved" (Round 1, blanket; R4 NOT EXERCISABLE)

---

## Round 2 Evidence (gap closure 28-10..28-14)

Produced by plan 28-14, run in the primary working tree (`/Users/pedf/workspace/strava-widgets`,
not a worktree — `data/stats/`, `data/dashboard/` and the pre-fix snapshot are gitignored and
exist only here). Every number below was predicted BEFORE regeneration (in `28-14-PLAN.md`'s
`<interfaces>` block, written before any file in this section was touched) and is now matched
against what regeneration actually produced.

### Snapshot pins

Archive snapshot, confirmed unchanged from the plan's pinned values before regenerating:

- `git rev-parse HEAD:data/streams/manifest.json` = `b8ac1a5494ae1384f9c5b67ce42752335fcbb532`
- `git rev-parse HEAD:data/best-effort-exclusions.json` = `8e942ff6711861a85d62c2e4ed71726968dd0cd0`
- `git rev-parse HEAD:data/best-effort-ceiling.json` = `f6b4f15d52672a915912b056758cc0a3dc51bc37`
- `git rev-parse --show-toplevel` = `/Users/pedf/workspace/strava-widgets`; `git rev-parse --git-dir` = `.git` (not a worktree)
- `git status --porcelain data/` was empty before regeneration
- Pre-fix `data/stats/best-efforts.json` `generatedAt`: `2026-09-10T23:08:32.377Z` (confirmed before touching anything)
- Plans 28-10, 28-11 and 28-12 all have SUMMARY files (confirmed present)
- Snapshot copies: `data/stats/best-efforts.json` → sha256 `f38e042e2754e9290a77b7940b97657137eae01646d4ddbd4e687bed36348d08`; `data/dashboard/index.json` → sha256 `fa8c6576254816e0e0791513f9648be77b79f276539bf65b0e67cf19bdfdd175`, both copied to a scratch directory before any regeneration touched the working tree.

### Pre-fix recount, re-run on the snapshot (prediction: 18 + 13 = 31)

`node scripts/compute-pr-ceiling-recount.mjs --best-efforts <snap>/best-efforts.json --index <snap>/index.json` — exit 1:

```
Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 52
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      18
    unrecognised guards: 0
  Pinned fixture 4556693525@400m: durationSec=45.2 guard=null durationMatches45_2=true guardIsCeiling=false

Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 31
  overCeilingWithoutDemotion (13): 14122328106@400m, 3475711469@400m, 3475711630@400m, 3475715178@400m, 3475725513@1k, 3475726256@400m, 3475727228@400m, 3475732221@400m, 3475735603@400m, 4556693525@400m, 4556693525@1k, 5059204779@400m, 5588316886@400m
  Per-distance overCeilingWithoutDemotion counts:
    1k: 2
    400m: 11
  ceilingDemotedButNotOverCeiling (0): (none)
  failOpenDistances: marathon
  unevaluable (0): (none)
  ceilingsMissing: false

FAIL:
  - pinned fixture 4556693525@400m guard is null, not "ceiling" (guardIsCeiling=false)
  - 13 over-ceiling effort(s) carry no demotion (CR-01 shape): 14122328106@400m, 3475711469@400m, 3475711630@400m, 3475715178@400m, 3475725513@1k, 3475726256@400m, 3475727228@400m, 3475732221@400m, 3475735603@400m, 4556693525@400m, 4556693525@1k, 5059204779@400m, 5588316886@400m
  - independent ceiling count (31) disagrees with byGuard.ceiling (18)
```

**Prediction confirmed:** byGuard.ceiling 18 + the sweep's 13 missing labels = 31, and the sweep's own `independentCeilingCount` independently reads 31 — two routes, same number, neither reading `effort.demotion` as ground truth.

### Regeneration

`npm run build && npm run compute-all-stats` — completed clean. Console tail: `Loaded previous ceiling state (7/7 distances) from data/best-effort-ceiling.json`, `Ceiling movement vs. previous committed run: unchanged at every distance`. `git status --porcelain data/best-effort-ceiling.json` — empty (file not rewritten; population did not change). Post-fix `data/stats/best-efforts.json` `generatedAt`: `2026-09-16T12:01:32.452Z`. Post-fix totals: `{"activitiesConsidered":1865,"activitiesWithEfforts":1864,"effortsComputed":8946,"effortsRejected":65,"effortsExcluded":61,"lowConfidenceEfforts":181,"skippedNoStream":25,"skippedUnreadable":0,"effortsDemoted":65}` — `effortsDemoted`/`effortsRejected` moved 52 → 65 exactly as predicted; `effortsExcluded` unchanged at 61.

### Pre/post structural comparison (throwaway script, never committed)

22 assertions, all PASS, verbatim output:

```
PASS: rankings deep-equal (string compare)
PASS: post rankings sha256 === cb2a498a...
  post rankings sha256: cb2a498a416b29eb7c8ca3826841b3e768d66c7ca0993d135d2782a9369ec9fb
PASS: ceilings deep-equal
PASS: activity key sets equal
PASS: every effort: non-demotion fields identical (wasPRAtTheTime, excludedFromRecords, durationSec, etc.)
PASS: demotion-diff count === 13 (observed 13)
PASS: demotion-diff label set === predicted 13
PASS: every demotion diff goes null -> guard "ceiling"
  Observed demotion-diff labels: ["14122328106@400m","3475711469@400m","3475711630@400m","3475715178@400m","3475725513@1k","3475726256@400m","3475727228@400m","3475732221@400m","3475735603@400m","4556693525@1k","4556693525@400m","5059204779@400m","5588316886@400m"]
PASS: post rejected length === pre rejected length + 13 (pre=52, post=65)
PASS: post rejected = pre rejected + 13 new rows matching predicted labels
  New rejected-row keys: ["14122328106@400m","3475711469@400m","3475711630@400m","3475715178@400m","3475725513@1k","3475726256@400m","3475727228@400m","3475732221@400m","3475735603@400m","4556693525@1k","4556693525@400m","5059204779@400m","5588316886@400m"]
PASS: totals differ only in effortsDemoted/effortsRejected
PASS: totals.effortsDemoted 52 -> 65 (pre=52, post=65)
PASS: totals.effortsRejected 52 -> 65 (pre=52, post=65)
  Shard file count (post-fix, current dir): 1865
PASS: shard file count equals activity key set count
  4556693525@400m demotion: {"guard":"ceiling","reason":"implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)"}
  4556693525@1k demotion: {"guard":"ceiling","reason":"implied 4.82 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts)"}
PASS: 4556693525@400m guard === ceiling
PASS: 4556693525@400m reason matches predicted EXACTLY
PASS: 4556693525@1k guard === ceiling
PASS: 4556693525@1k reason matches predicted EXACTLY
  3475725513@400m demotion: {"guard":"world-record","reason":"implied 27.32 m/s exceeds world-record pace 9.30 m/s"}
  3475725513@1k demotion: {"guard":"ceiling","reason":"implied 6.72 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts)"}
PASS: 3475725513@400m guard === world-record
PASS: 3475725513@400m reason matches predicted EXACTLY
PASS: 3475725513@1k guard === ceiling
PASS: 3475725513@1k reason matches predicted EXACTLY

SUMMARY: 22 PASS / 0 FAIL
```

The change between pre-fix and post-fix documents is exactly: the 13 named efforts' `demotion` field (null → guard `ceiling`), 13 appended `rejected` rows matching those same 13 `(activityId, distance)` pairs, and `totals.effortsDemoted`/`totals.effortsRejected` (52 → 65). Rankings (string-identical, sha256-pinned), `doc.ceilings`, every `wasPRAtTheTime` flag, and every other `totals` field are unchanged.

### Post-fix recount (prediction: exit 0, PASS, ceiling 31, independentCeilingCount 31, guardIsCeiling=true)

`node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` — exit 0, verbatim:

```
Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 65
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      31
    unrecognised guards: 0
  Per-distance breakdown (own arithmetic):
    10k: 0
    1k: 13
    1mi: 5
    400m: 47
    5k: 0
    half: 0
    marathon: 0
  Cross-check vs. doc.totals.effortsDemoted: own=65 totals=65 disagrees=false
  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=65 demoted=65 disagrees=false
  rankedButDemotedIds (0): (none)
  demotedWithoutReason (0): (none)
  Pinned fixture 4556693525@400m: durationSec=45.2 guard="ceiling" durationMatches45_2=true guardIsCeiling=true
  --expect-demoted 65: MATCH

Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 31
  overCeilingWithoutDemotion (0): (none)
  ceilingDemotedButNotOverCeiling (0): (none)
  failOpenDistances: marathon
  unevaluable (0): (none)
  ceilingsMissing: false

PR-05 impossible-sample cohort (own arithmetic, live denominator):
  archiveDenominator: 1890
  rowsWithQuality:    1890
  rowsMissingQuality: 0
  cohortCount:        662
  cohortPct:          35%

  Overlap with the demoted-effort population:
    cohortWithDemotedEffort:    46
    cohortWithoutDemotedEffort: 616
    demotedNotInCohort:         1
    biteRatePct (finding, not a threshold): 6.9%

PASS: recount agrees with the shipped totals; no disagreements found.
```

The cohort denominator (662 of 1,890, 35%) is unchanged from plan 28-08's recorded figure — no drift.

### Predicted vs. observed

| Figure | Predicted before regeneration | Observed | Source |
|---|---|---|---|
| Ceiling-only total | 31 (18 + 13, and independently 31 from the sweep on the pre-fix document) | 31 | `byGuard.ceiling` in the post-fix recount |
| World-record | 19 (unchanged; absolute guard runs before exclusion, unaffected by CR-01) | 19 | post-fix recount |
| Max-speed | 15 (unchanged, same reason) | 15 | post-fix recount |
| Total demoted (`effortsDemoted`) | 65 (52 + 13) | 65 | post-fix `data/stats/best-efforts.json` totals + post-fix recount cross-check |
| `independentCeilingCount` | 31 (classifier-independent sweep, never reads `effort.demotion`) | 31 | post-fix recount's own sweep block |
| Over-ceiling without demotion | 0 (the CR-01 shape should no longer exist) | 0 | post-fix recount's `overCeilingWithoutDemotion` |
| Pinned fixture 4556693525@400m | guard `ceiling`, durationSec 45.2, `guardIsCeiling=true` | guard `"ceiling"`, durationSec 45.2, `durationMatches45_2=true`, `guardIsCeiling=true` | post-fix recount's pinned-fixture line |

No row differs. All seven figures were predicted before any regeneration ran (in `28-14-PLAN.md`'s `<interfaces>` block, itself derived from plan 28-10's pre-fix sweep — a different program reading a different, not-yet-regenerated document) and were matched exactly by the post-fix recount and the regenerated document.

### D-04 observation (not a finding — not investigated further, per D-04)

`3475726256@400m`'s shard shows `durationSec: 44, demotion: {"guard":"ceiling","reason":"implied 9.09 m/s exceeds personal ceiling 5.11 m/s (...)"}`  — i.e. exactly 44.0s / 9.0909 m/s, the stale PR-05/ROADMAP figure D-04 recorded as unexplained. Carried to the plan 28-15 checkpoint as an observation only: the likely explanation is that the requirement quoted this activity's value against the wrong id. D-04's pinned fixture (activity `4556693525`, 45.2s) stays as locked and is unaffected — its own demotion (verified above) is guard `ceiling` as predicted.

### 28-DIFF.md and 28-CEILING-CALIBRATION.md, regenerated twice each and reconciled (Task 2)

**Diff idempotence.** Before regenerating, `shasum -a 256 28-DIFF.md` printed `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6` — matching the signed-off hash, confirming the file was untouched by Task 1. `npm run compute-pr-ceiling-diff` was run twice; `diff <(grep -v '^\*\*Generated:\*\*' run1) <(grep -v '^\*\*Generated:\*\*' run2)` printed nothing — **PASS, idempotent**. Two `pr-ceiling-diff-*` directories remain under `os.tmpdir()` (`/var/folders/.../T/pr-ceiling-diff-8q4rpb`, `pr-ceiling-diff-esmapa`), but both carry an mtime of 2026-09-16 09:57–09:58 UTC (11:57–11:58 CEST) — well before this plan's own first action this session (STATE.md's `last_updated` for the prior wave was already 11:43 UTC) and before either of this task's two `compute-pr-ceiling-diff` runs. Neither run created a new temp directory (both cleaned up via `finally`, confirmed by re-checking the directory listing immediately after each run) — **IN-04 holds for this plan's own runs**; the two pre-existing directories are unrelated debris from an earlier session, not touched or added to by this plan.

**Calibration idempotence.** `npm run compute-pr-ceiling-calibration` run twice; the two output files differ only on the `**Generated:**` line (`2026-09-16T12:06:51.453Z` vs `2026-09-16T12:06:54.656Z`) — **PASS, idempotent**.

**Predicted content (28-DIFF.md), checked line by line against `28-14-PLAN.md`'s `<interfaces>` block:**
- Summary bullets: `Archive size (activities considered): 1865`; `Total efforts demoted (...ceiling-only): 31`; `Of those, also owner-excluded (no ranking effect): 13`; `Total wasPRAtTheTime flag flips: 14`; `Total retroactive promotions (flips gained): 3`; `Total ranking rows moved: 48` — all match.
- Summary table, all seven rows match exactly: `400m | 5.1098 | 19 | 11 | 11 | 6 | 5`, `1k | 4.7513 | 9 | 2 | 11 | 9 | 6`, `1mi | 4.6323 | 3 | 0 | 14 | 13 | 3`, `5k | 4.3458 | 0 | 0 | 21 | 21 | 0`, `10k | 4.2236 | 0 | 0 | 16 | 16 | 0`, `half | 4.4017 | 0 | 0 | 6 | 6 | 0`, `marathon (fail-open text) | 0 | 0 | 0 | 0 | 0`.
- `## Ceiling demotions on owner-excluded efforts` — exactly the 13 predicted rows, in the predicted order (`14122328106`, `3475711469`, `3475711630`, `3475715178`, `3475726256`, `3475727228`, `3475732221`, `3475735603`, `4556693525`@400m, `5059204779`, `5588316886`, `3475725513`@1k, `4556693525`@1k), with the predicted duration/implied-speed values byte-for-byte.
- Reconciliation paragraph: "counts **31** total ceiling-demoted efforts... document's own `totals.effortsDemoted`... is 65" — matches.

**Unchanged sections (byte equality against `$SNAP/28-DIFF.signed.md`, extracted heading-to-next-heading):**

```
=== ## Records that changed hands === PASS: byte-identical
=== ## PR-at-the-time flag flips === PASS: byte-identical
=== ## Retroactive promotions === PASS: byte-identical
=== ## Inputs === PASS: byte-identical
```

**Three-way reconciliation (31 / 31 / 31):**

```
Total efforts demoted (this report's own count, ceiling-only): 31   [28-DIFF.md]
    ceiling:      31                                                 [recount byGuard.ceiling]
  independentCeilingCount: 31                                        [recount sweep]
```

All three agree. **13-label set equality:** the diff's 13 owner-excluded `(activityId, distance)` pairs, compared as a set against the 13 labels plan 28-10's pre-fix sweep reported (a different program — `compute-pr-ceiling-recount.mjs`'s `recountCeilingSweep` — reading a different, not-yet-regenerated document): identical sets, confirmed by direct comparison.

**New 28-DIFF.md sha256:** `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2` — this is the hash plan 28-15's fresh sign-off binds to. It differs from the pre-fix signed-off hash `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6`, as expected (the content genuinely changed: 18 → 31 ceiling-only, plus the new owner-excluded section).

**Calibration verdict.** `git diff -U0 HEAD -- 28-CEILING-CALIBRATION.md | grep -E '^[+-][^+-]' | grep -vE 'Generated:|generatedAt:'` printed nothing — the WR-03 prediction held; the file was **not** restored via `git checkout`, the regenerated version was kept. The only three changed lines across the whole file are `**Generated:**` (`2026-09-10T21:38:40.714Z` → `2026-09-16T12:06:54.656Z`) and the two `## Inputs` `generatedAt:` lines (`data/stats/best-efforts.json`: `2026-09-10T21:28:24.587Z` → `2026-09-16T12:01:32.452Z`; `data/dashboard/index.json`: `2026-09-10T21:28:34.541Z` → `2026-09-16T12:01:42.425Z`).

**Seven-row ceiling cross-check** (`28-CEILING-CALIBRATION.md`'s "Resulting coverage and demotions" `Ceiling (m/s)` cell vs. the regenerated `data/stats/best-efforts.json`'s `doc.ceilings[d].ceilingMps.toFixed(4)`):

| Distance | Calibration table | `doc.ceilings[d].ceilingMps.toFixed(4)` | Match |
|---|---|---|---|
| 400m | 5.1098 | 5.1098 | PASS |
| 1k | 4.7513 | 4.7513 | PASS |
| 1mi | 4.6323 | 4.6323 | PASS |
| 5k | 4.3458 | 4.3458 | PASS |
| 10k | 4.2236 | 4.2236 | PASS |
| half | 4.4017 | 4.4017 | PASS |
| marathon | `—` (no-ceiling text) | `null` (no ceiling derived, population 0 below minimum 100) | PASS |
