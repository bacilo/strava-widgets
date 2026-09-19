---
phase: 28
slug: pr-plausibility-ceiling
status: approved
nyquist_compliant: true
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
| 28-06-T3 | 28-06 | 4 | PR-01, PR-04 | T-28-06-C, T-28-06-D | CI commit pattern extended with one glob on the existing `git-auto-commit-action` step; no skip-ci token in any added line | integration | `grep -c "data/best-effort-ceiling.json" .github/workflows/daily-refresh.yml | grep -qx 1 && grep -c "git-auto-commit-action" .github/workflows/daily-refresh.yml | grep -qx 1 && ! grep "data/best-effort-ceiling.json" .github/workflows/daily-refresh.yml | grep -qiE "skip.?ci|ci.?skip" && echo "one glob on the one auto-commit step; the glob line carries no skip-ci token"` (amended 2026-09-17: the original `git diff HEAD` form became vacuous once committed — it could no longer fail. The pre-existing `[skip ci]` tags elsewhere in the file are deliberate loop-safety tags and are excluded by checking only the line the plan added)` | ✅ | ✅ green |
| 28-07-T1 | 28-07 | 4 | PR-04 | T-28-07-A | OLD/NEW semantics computed side by side from one snapshot via pure exported functions; dry run touches only temp-directory paths | integration | `npm run build && node -e "import('./scripts/compute-pr-ceiling-diff.mjs').then(m => { const names=['reconstructOldDocument','extractNewState','diffPrState']; const missing=names.filter(n=>typeof m[n]!=='function'); if(missing.length){console.error('missing exports: '+missing.join(','));process.exit(1);} console.log('pure diff functions exported; import ran no archive sweep'); })"` | ✅ | ✅ green |
| 28-07-T2 | 28-07 | 4 | PR-04 | T-28-07-D | `28-DIFF.md` regenerates byte-identically (besides its timestamp) on a second run, proving it is safe to bind a sign-off to its content hash | integration | `npm run compute-pr-ceiling-diff && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md > /tmp/28-diff-run1.txt && npm run compute-pr-ceiling-diff && grep -v '^\*\*Generated:\*\*' .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md > /tmp/28-diff-run2.txt && diff /tmp/28-diff-run1.txt /tmp/28-diff-run2.txt && echo "IDEMPOTENT: 0 non-timestamp diff lines on the second run"` | ✅ | ✅ green |
| 28-07-T3 | 28-07 | 4 | PR-04 | T-28-07-B, T-28-07-C | Diff unit-tested including the net-zero-count retroactive promotion case; malformed activity ids rendered as `(malformed id)` rather than injected raw | unit | `npx vitest run scripts/compute-pr-ceiling-diff.test.mjs` | ✅ | ✅ green |
| 28-08-T1 | 28-08 | 5 | PR-04, PR-05 | T-28-08-B | Classifier-independent recount of demoted efforts; zero imports of the ceiling/compute/utils/types modules (self-tested stripper) | integration | `node scripts/compute-pr-ceiling-recount.mjs` | ✅ | ✅ green |
| 28-08-T2 | 28-08 | 5 | PR-04, PR-05 | T-28-08-D | 662-activity impossible-sample cohort dry-run count and its overlap with the demoted set, both reported as findings rather than gated | integration | `node scripts/compute-pr-ceiling-recount.mjs` | ✅ | ✅ green |
| 28-08-T3 | 28-08 | 5 | PR-04, PR-05 | T-28-08-B, T-28-08-C | Recount tested (10 describe blocks / 24 tests); `--expect-demoted`/`--expect-cohort` proven additive-only, never suppressing a structural finding | unit | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ✅ | ✅ green |
| 28-09-T1 | 28-09 | 6 | PR-03, PR-04, PR-05 | T-28-09-A, T-28-09-B, T-28-09-S | Digest-verified build served; Round 1 expected values derived independently of the browser; rows R1-R7 drafted | integration | `npm test && npx tsc --noEmit && node scripts/compute-pr-ceiling-recount.mjs && npm run verify-dashboard` | ✅ | ✅ green |
| 28-09-T2 | 28-09 | 6 | PR-03, PR-04, PR-05 | T-28-09-B, T-28-09-C, T-28-09-D | CHECKPOINT (blocking, human-verify): Round 1 browser verification (R1-R7) and PR-04 sign-off | manual (browser checkpoint) | `npm test && npx tsc --noEmit && npm run verify-dashboard && node scripts/compute-pr-ceiling-recount.mjs` | ✅ | ✅ green (automated gates); human sign-off SUPERSEDED by 28-15-T2 — Round 1 approval was reopened by the 2026-09-16 gaps_found verification (see § AMENDED) |
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
| 28-15-T1 | 28-15 | gap-closure 3 | PR-03, PR-04, PR-05 | T-28-15-A, T-28-15-B, T-28-15-C | Digest-verified build served; every Round 2 expected value re-derived independently of the browser/records-logic.ts; Round 2 rows drafted | integration | `npm test && npx tsc --noEmit && npm run verify-dashboard && node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65 && grep -c "Round 2 Checkpoint" .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` | ✅ | ✅ green |
| 28-15-T2 | 28-15 | gap-closure 3 | PR-03, PR-04, PR-05 | T-28-15-B, T-28-15-C, T-28-15-D, T-28-15-E | CHECKPOINT (blocking, human-verify): Round 2 browser verification (R2-1..R2-6) and a fresh PR-04 sign-off bound to 28-DIFF.md's new sha256 | manual (browser checkpoint) | `npm test && npx tsc --noEmit && npm run verify-dashboard && node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` | ✅ | ✅ green (automated gates re-run 2026-09-17; human rows R2-1..R2-6 PASS — see § Round 2 Outcome) |

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

### Round 2 Outcome (2026-09-17)

All six rows, verdicted 2026-09-17. Pre-checkpoint gates re-run by the orchestrator immediately
before presenting: `npm test` exit 0 (2330 tests), `npx tsc --noEmit` exit 0, `npm run
verify-dashboard` exit 0 (64/64), `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65`
exit 0 (`independentCeilingCount` 31); served digests re-fetched and all 5 MATCH (asset
`aac17952…`, `best-efforts.json` `e4f206e1…`, `4556693525.json` `9c038b30…`, `3475725513.json`
`8c2c397d…`, `index.json` `74cbb3e5…`); `28-DIFF.md` sha256
`64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`.

| Row | Verdict | Developer's verbatim words | Observation / readback | Disclosure |
|-----|---------|------------------------------|-------------------------|------------|
| R2-1 served build | PASS | "PASS" | Not a string/count row per plan; no quoted observation required. Filename not separately quoted. | Developer only |
| R2-2 pinned activity, both claims, two of five rows | PASS | "PASS (both parts)" | Full paste of all five Best Efforts rows (below) | Developer pasted |
| R2-3 precedence (3475725513) | PASS | "PASS" | Full paste of the 400m and 1K rows (below) | Developer pasted |
| R2-4 guard-accurate Records notes | PASS | "PASS: All three notes check (feel free to use readback but no point pasting the 3 of them). no notes on 5k, 10k and half, and marathon inndeed says no efforts yet" | Agent readback quoting all three notes verbatim, confirmed by the developer's verdict (below) | Disclosed agent readback (Claude-in-Chrome `javascript_tool`), developer-confirmed |
| R2-5 dark-theme badge contrast (WR-02) | PASS | "pass" (see note below on the combined R2-5/R2-6 prompt) | Agent readback: dark `rgb(251, 146, 60)`, light `rgb(179, 57, 10)` | Disclosed agent readback, developer-confirmed |
| R2-6 fresh PR-04 sign-off | PASS | "pass" (see note below on the combined R2-5/R2-6 prompt) | Material presented before the verdict; see § PR-04 Sign-off (Round 2, D-14) | Developer, on presented material |

**Note on the combined R2-5/R2-6 prompt:** the developer's reply of the single word `"pass"` was
given verbatim in answer to a prompt that asked for "your R2-5 verdict and your R2-6 verdict, in
your own words." That single word is recorded here as the developer's verdict for BOTH rows —
one word answering a two-part question, not two separate words. This interpretation is stated
explicitly per the plan's transcription instruction, rather than left implicit.

**R2-1 — no further detail beyond the table** (not a string/count row; filename not separately
quoted by the developer).

**R2-2 — developer's pasted observation, verbatim:**

> 400m 0:45 1:53/km 99.1% Demoted — implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90
> 3.99 m/s over 1825 filtered 400m efforts)this effort is left out of the ranked PR list because a
> plausibility guard rejected it; it stays visible here with its reasonExcluded — bad measurementthe
> owner excluded this effort from records; this is a stated intent, not a machine judgment
> 1K 3:27 3:27/km 69.5%\* Demoted — implied 4.82 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90
> 3.71 m/s over 1843 filtered 1k efforts)this effort is left out of the ranked PR list because a
> plausibility guard rejected it; it stays visible here with its reasonExcluded — bad measurementthe
> owner excluded this effort from records; this is a stated intent, not a machine judgment
> 1 Mile 6:34 4:05/km 58.7% Excluded — bad measurementthe owner excluded this effort from records;
> this is a stated intent, not a machine judgment
> 5K 24:59 5:00/km 53.4% Excluded — bad measurementthe owner excluded this effort from records; this
> is a stated intent, not a machine judgment
> 10K 55:08 5:31/km 49.0% Excluded — bad measurement

Both Demoted strings match the pre-stated text character for character; Demoted precedes Excluded
on 400m and 1K; 1 Mile/5K/10K carry Excluded only (2 of 5 rows demoted). The run-on text after each
badge is that badge's own `.sr-only` `aria-describedby` explanation (`detail-sections.ts`
`buildPrFlagsCell` → `appendAccessibleBadge`), which the developer's copy includes verbatim — it is
the designed accessible separator between the two claims, not a visible run-on string. The 10K
paste ends at the badge (its explanation was not included in the selection). Ranked-table absence
was confirmed by the developer's "both parts" statement; no table text was separately quoted
(an absence observation).

**R2-3 — developer's pasted observation, verbatim:**

> 400m 0:15 0:37/km 303.0% Demoted — implied 27.32 m/s exceeds world-record pace 9.30 m/sthis
> effort is left out of the ranked PR list because a plausibility guard rejected it; it stays
> visible here with its reasonExcluded — Recorded with the same inaccurate GPS device class; its
> 1k time is not trusted as a genuine personal record.the owner excluded this effort from records;
> this is a stated intent, not a machine judgment
> 1K 2:29 2:29/km 95.4%\* Demoted — implied 6.72 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90
> 3.71 m/s over 1843 filtered 1k efforts)this effort is left out of the ranked PR list because a
> plausibility guard rejected it; it stays visible here with its reasonExcluded — Recorded with the
> same inaccurate GPS device class; its 1k time is not trusted as a genuine personal record.

400m names world-record pace (27.32 / 9.30), 1K names personal ceiling (6.72 / 4.75, p90 3.71,
1843) — both character-identical to the pre-stated strings; each followed by the Excluded badge
with the exact owner reason. The precedence rule was observed directly. Trailing text is the same
`.sr-only` explanation pattern as R2-2.

**R2-4 — disclosed agent readback, verbatim** (Claude-in-Chrome `javascript_tool` on a fresh tab,
URL `http://127.0.0.1:8917/?r2=1758030004#/records`, loaded script asset `index-BZIqZhAY.js`,
scope button "All time" `aria-pressed=true`):

- 400m `p.text-label`: "35 400m efforts were demoted by a plausibility guard (8 by the personal
  ceiling, 17 by the world-record pace guard, 10 by the activity max-speed guard). Efforts the
  owner excluded are not counted here. See the activity detail view for each reason."
- 1K `p.text-label`: "11 1K efforts were demoted by a plausibility guard (7 by the personal
  ceiling, 1 by the world-record pace guard, 3 by the activity max-speed guard). Efforts the owner
  excluded are not counted here. See the activity detail view for each reason."
- 1 Mile `p.text-label`: "5 1 Mile efforts were demoted by a plausibility guard (3 by the personal
  ceiling, 2 by the activity max-speed guard). Efforts the owner excluded are not counted here. See
  the activity detail view for each reason."
- Programmatic string equality against the pre-stated expected text: 400m EXACT MATCH, 1K EXACT
  MATCH, 1 Mile EXACT MATCH; 5K/10K/Half Marathon/Marathon: no demotion note. Marathon heading "No
  Marathon efforts yet" present. (The 1K block also carries the pre-existing WMA footnote "\*
  Interpolated between 800m and mile factors — no official WMA standard exists for 1k." — not a
  demotion note.)

The developer's verdict ("PASS: All three notes check...") explicitly declines to paste the three
notes itself and directs the agent readback to stand in, confirming it rather than independently
re-quoting it.

**R2-5 — disclosed agent readback, verbatim** (Claude-in-Chrome `javascript_tool`, own tab, script
asset `index-BZIqZhAY.js`, 2 `.badge--demoted` elements on the page; first = 400m "Demoted —
implied 8.85 m/s exceeds personal ceiling 5.11 m/s (...)"):

- DARK: URL `?r2=1758030005#/activity/4556693525`; stored `dashboard-theme` "auto",
  `prefers-color-scheme` dark → `html data-theme="dark"`; `--demoted-text` `#fb923c`;
  `getComputedStyle(first .badge--demoted).color` = `"rgb(251, 146, 60)"`.
- LIGHT: developer switched the theme to light by hand (stored `dashboard-theme` "light", button
  "Theme: light"); agent reloaded its tab at `?r2=1758030006#/activity/4556693525` →
  `html data-theme="light"`; `--demoted-text` `#b3390a`; computed color = `"rgb(179, 57, 10)"`.

Condition note: the dark reading was taken under `"auto"` resolving to dark (system dark), which
is the page's actual dark rendering (`data-theme="dark"` stamped). The developer's "pass" is
recorded as confirmation of this disclosed readback.

**R2-6 — see § PR-04 Sign-off (Round 2, D-14) below** for the material presented and the
developer's "pass" recorded as the sign-off.

No row FAILED or was BLOCKED; no Round 2 Gap-Closure Record is opened. R4 and WR-01 remain NOT
EXERCISABLE per § R4 and WR-01 above; no verdict was requested for either.

`git status --porcelain src scripts` was empty after the checkpoint.

### PR-04 Sign-off (Round 2, D-14)

- **Artifact reviewed:** `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`, regenerated by
  plan 28-14.
- **sha256:** `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2` (recorded by plan
  28-14 Task 2; re-hashed by this plan's Task 1 and again immediately after the checkpoint — both
  times identical; the artifact is byte-unchanged across the checkpoint).
- **Prior Round 1 signed version:** sha256 `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6`
  at commit `3a71eaeb`, superseded by this sign-off.
- **Material presented before the verdict (2026-09-17):**
  - A machine diff against the Round 1 signed version (commit `3a71eaeb`): the "Records that
    changed hands", "PR-at-the-time flag flips" and "Retroactive promotions" sections are
    byte-identical (both sides sha256 `2ed8bd042f2b861d6c4f37ec368ebeba411f605cda9aa79fbeff25a70bb6e92b`).
  - What changed: the Generated timestamp; the WR-04 per-effort-exclusion sentence; the Summary
    row moving 18 → 31, plus a new "Of those, also owner-excluded: 13" line and a new column (the
    non-excluded 8/7/3 breakdown unchanged); a new "## Ceiling demotions on owner-excluded
    efforts" section (13 rows, listed in full to the developer); the Reconciliation figure moving
    to 31 / 65.
  - The three-way figure: ceiling-only 31 = recount `byGuard.ceiling` 31 = recount
    `independentCeilingCount` 31 (recount exit 0, `ceilingDemotedButNotOverCeiling` 0, run
    2026-09-17 by the orchestrator immediately before presenting).
  - Unchanged relative to the Round 1 sign-off: 48 ranking rows moved, 14 flag flips, 3 retroactive
    promotions.
  - The D-04 observation, surfaced explicitly: `3475726256@400m` is exactly the stale 44.0s /
    9.09 m/s figure.
- **Developer's words, verbatim:** "pass" — given in answer to a prompt requesting both the R2-5
  and R2-6 verdicts together ("your R2-5 verdict and your R2-6 verdict, in your own words"). This
  single word is recorded here as the developer's PR-04 sign-off, per the interpretation stated
  in § Round 2 Outcome above: one word answering a two-part question, not a separate reply for
  each row.
- **Date:** 2026-09-17.
- Nothing was written into `28-DIFF.md`; it remains purely generated. Re-hashed after this record
  was written (see § Post-checkpoint re-hash below) — unchanged.

#### Post-checkpoint re-hash

`shasum -a 256 .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` after all Task 2 edits to
this file: `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2` — matches the sign-off
above; `28-DIFF.md` itself was not touched.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s (quick command measured at 3s, 178 tests, 2026-09-16)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** REOPENED 2026-09-16 after verification gaps_found (see AMENDED section); originally approved 2026-09-16 — developer, verbatim: "approved" (Round 1, blanket; R4 NOT EXERCISABLE). Re-approved 2026-09-17 on Round 2 (28-15): all six rows R2-1..R2-6 PASS, per-row quoted observations or disclosed agent readback confirmed by the developer — see § Round 2 Outcome and § PR-04 Sign-off (Round 2, D-14). R4 and WR-01 remain NOT EXERCISABLE.

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

---

## Round 2 Checkpoint (R2-1..R2-6)

**Drafted:** 2026-09-16, plan 28-15 Task 1. No row below has been run. No verdict is pre-filled.
Every verdict reads `pending` until the developer answers in Task 2.

### Snapshot pins re-confirmed before this build

- `git rev-parse HEAD` = `468106988d6e2be9cba81e235362e0d0b76cc0b2`, `git status --porcelain` empty
  before this task started.
- `git rev-parse HEAD:data/streams/manifest.json` = `b8ac1a5494ae1384f9c5b67ce42752335fcbb532` —
  matches the plan's pinned value.
- `data/stats/best-efforts.json` `totals.effortsDemoted` = **65** — matches plan 28-14's
  regenerated document; `compute-all-stats` was NOT re-run by this task.

### Build and served-digest evidence (step 1)

- `npm run build && npm run build-widgets` — ran clean. `build-widgets`'s own copy step reported
  `Copied data/stats/*.json → dist/widgets/data/stats/ (3768 copied, 0 skipped)` — zero skips, so
  no `cp` fallback was needed anywhere; confirmed independently anyway (below).
- **Source-vs-dist digest check** (`shasum -a 256` on the source file vs. its `dist/widgets/...`
  copy), all four MATCH with no `cp` fallback required:
  - `data/stats/best-efforts.json` → `e4f206e1806ff748e4e896eea90809f4f380acaa2bb365d625fccd1ce93f1b18`
  - `data/stats/best-efforts/4556693525.json` → `9c038b30a0018fb0fe9134b650077869e7fb82192031a2c02c2b9e080062c678`
  - `data/stats/best-efforts/3475725513.json` → `8c2c397d4129eaa2a199aeb35bffdd67d79eb5700c4458b7bed76f263f601406`
  - `data/dashboard/index.json` → `74cbb3e535cd6200f1444dc9de64261cd4236517ca9e94c2a88a03c31f46b7ee`
  (These differ from plan 28-14's recorded PRE-regeneration snapshot-copy hashes
  `f38e042e...`/`fa8c6576...` by design — those were the snapshot taken BEFORE regeneration;
  these are the POST-regeneration document's hashes.)
- A pre-existing `http-server` process (pid 49752, started 11:45:58 this session, cwd
  `/Users/pedf/workspace/strava-widgets`) was already listening on port 8917 and was reused per
  the plan's "reuse the port if one is already serving that directory" instruction, rather than
  starting a second process. `-c-1` (no caching) was confirmed by the digest match below — a
  stale cache would not have picked up this session's rebuilt bytes.
  - **Serve command (for the record, in case the process needs restarting):**
    `npx http-server dist/widgets -p 8917 -c-1`
- Emitted dashboard SPA JS asset (read from `dist/widgets/index.html`'s `<script src="./assets/...">`):
  **`assets/index-BZIqZhAY.js`**.
- **SERVED digest, computed from FETCHED bytes** (`curl -s http://127.0.0.1:8917/assets/index-BZIqZhAY.js | shasum -a 256`):
  `aac17952fc99dac43900fd19fe26656df35e4b1e040c5c71c1b0d0cd6c8430c1` — identical to
  `shasum -a 256 dist/widgets/assets/index-BZIqZhAY.js` on the local file.
- **Fetched-vs-local digests for the four JSON files** (all MATCH, confirming the server is not
  serving stale staged data alongside the fresh bundle):

  | File | Local (`dist/widgets/...`) sha256 | Fetched sha256 | Match |
  |---|---|---|---|
  | `assets/index-BZIqZhAY.js` | `aac17952...430c1` | `aac17952...430c1` | MATCH |
  | `data/stats/best-efforts.json` | `e4f206e1...93f1b18` | `e4f206e1...93f1b18` | MATCH |
  | `data/stats/best-efforts/4556693525.json` | `9c038b30...062c678` | `9c038b30...062c678` | MATCH |
  | `data/stats/best-efforts/3475725513.json` | `8c2c397d...601406` | `8c2c397d...601406` | MATCH |
  | `data/dashboard/index.json` | `74cbb3e5...f46b7ee` | `74cbb3e5...f46b7ee` | MATCH |

- **Round 1 pre-fix digest assertion:** the fetched `4556693525.json` digest
  `9c038b30a0018fb0fe9134b650077869e7fb82192031a2c02c2b9e080062c678` is **NOT**
  `82c467ac8de0344a7c9ad810c225a285bda429f2306fee71dbced0b8c96d1b39` (Round 1's pre-fix digest) —
  **PASS**, the served build reflects the CR-01 fix.

### Step 2 — independent re-derivation (throwaway node script, not committed, not `records-logic.ts`)

Script written to the session scratchpad (outside the repo) and run against
`data/stats/best-efforts.json`, the two committed shards, and `src/dashboard/styles.css` read as
text. Full output, zero mismatches:

```
=== Per-guard, non-excluded counts per distance ===
400m: total=35 ceiling=8 worldRecord=17 maxSpeed=10
1k: total=11 ceiling=7 worldRecord=1 maxSpeed=3
1mi: total=5 ceiling=3 worldRecord=0 maxSpeed=2
5k: total=0 ceiling=0 worldRecord=0 maxSpeed=0
10k: total=0 ceiling=0 worldRecord=0 maxSpeed=0
half: total=0 ceiling=0 worldRecord=0 maxSpeed=0
marathon: total=0 ceiling=0 worldRecord=0 maxSpeed=0

4556693525@400m reason: implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts) -- MATCHES INTERFACES BLOCK
4556693525@1k reason:   implied 4.82 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts) -- MATCHES INTERFACES BLOCK
4556693525@1mi/5k/10k demotion: null (confirmed)
4556693525@1mi implied speed: 4.0867 (ceiling 4.6323) -- MATCHES INTERFACES BLOCK
4556693525@5k implied speed: 3.3364 (ceiling 4.3458) -- MATCHES INTERFACES BLOCK
4556693525@10k implied speed: 3.0230 (ceiling 4.2236) -- MATCHES INTERFACES BLOCK

3475725513@400m reason: implied 27.32 m/s exceeds world-record pace 9.30 m/s -- MATCHES INTERFACES BLOCK
3475725513@1k reason:   implied 6.72 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts) -- MATCHES INTERFACES BLOCK

dark --demoted-text: #fb923c -> rgb(251, 146, 60) -- MATCHES INTERFACES BLOCK
light --demoted-text: #b3390a -> rgb(179, 57, 10) -- MATCHES INTERFACES BLOCK

0 mismatches. ALL RE-DERIVED VALUES MATCH THE INTERFACES BLOCK.
```

**One discovered precision caveat, disclosed rather than absorbed (not a mismatch against the
interfaces block, and not archive drift or a defect):** naively recomputing
`3475725513@400m`'s reason string from the shard's own DISPLAY-rounded `durationSec` field
(`14.6`, which is `round1(rawDurationSec)` per `compute-best-efforts.ts:150`) and
`TARGET_METERS['400m'] / 14.6` yields `27.40`, not the shard's actual `27.32`. Root cause traced
to source: `compute-best-efforts.ts` computes `impliedSpeedMps` from the UNROUNDED
`raw.durationSec` (line 136) BEFORE rounding it to one decimal for the stored `durationSec`
display field (line 150) — so a naive re-derivation from the rounded display value cannot
reproduce a fast/short effort's reason string bit-for-bit purely by arithmetic. This did not
occur for either `4556693525` reason string (the rounding delta was too small there to shift the
second decimal) or for `3475725513@1k` (same reason). The load-bearing comparison — the shard's
ACTUAL `demotion.reason` field character-for-character against the interfaces block's stated
string — passed for all four reason strings with zero mismatches; this caveat concerns only a
disclosed limitation of reconstructing an unrounded number from an intentionally-rounded display
field, not the document's correctness.

Per-guard, non-excluded count breakdowns (400m 35 = 8+17+10, 1k 11 = 7+1+3, 1mi 5 = 3+0+2) all
match the interfaces block exactly; 5k/10k/half/marathon all show 0. The recount script's own
per-distance breakdown (400m: 47, 1k: 13, 1mi: 5 — all-guard, no exclusion filter) is a
DIFFERENT, all-guard measurement by design (see the distinguishing-values paragraph in the
interfaces block); it is not compared directly against this script's excluded-filtered 35/11/5
totals, since the two intentionally measure different populations.

### Gate results (Task 1)

- `npm test` — 79 files / 2330 tests / 0 failures. Exit 0.
- `npx tsc --noEmit` — clean. Exit 0.
- `npm run verify-dashboard` — 64/64 checks passed, 0 failures. Exit 0.
- `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` — exit 0, `PASS: recount
  agrees with the shipped totals; no disagreements found.` `byGuard.ceiling` 31,
  `independentCeilingCount` 31, `overCeilingWithoutDemotion` 0, pinned fixture
  `4556693525@400m` `guard="ceiling"` `guardIsCeiling=true`.

### The rows

- **R2-1 served build.**
  Ask: the developer opens `http://127.0.0.1:8917/?r2=<epoch>`, hard-reloads, and reads the JS
  asset filename in the Network panel.
  Independently derived, stated before the row runs: the asset filename recorded in step 1,
  **`assets/index-BZIqZhAY.js`**, and its served digest
  `aac17952fc99dac43900fd19fe26656df35e4b1e040c5c71c1b0d0cd6c8430c1`.
  CAN PASS: the filename equals `index-BZIqZhAY.js`.
  CAN FAIL: any other filename (a stale bundle).
  Reachability: a stale cache fails it (an older `dist/widgets/assets/index-*.js`, of which three
  other stale copies remain on disk — `index-BHpzXFXA.js`, `index-CLYvAIDH.js`,
  `index-vmd1d_n_.js` — none of which `index.html` currently references), and the fresh build
  passes it.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-1).

- **R2-2 (R3 re-run): the pinned activity carries both claims, on exactly two of five rows.**
  Ask: open `4556693525`'s detail view, hard-reload, and quote every badge on all five Best
  Efforts rows, in order. Then open the Records screen (All time) and confirm the activity is
  absent from the 400m and 1K ranked tables.
  Independently derived, stated before the row runs (from the committed shard, re-derived and
  confirmed above):
  - 400m (45.2s): `Demoted — implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)`, then `Excluded — bad measurement`
  - 1K (207.4s): `Demoted — implied 4.82 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts)`, then `Excluded — bad measurement`
  - 1 Mile (393.8s), 5K (1498.6s), 10K (3308s): `Excluded — bad measurement` only
  CAN PASS:
  - the 400m and 1K rows each show the expected Demoted text followed by `Excluded — bad measurement`
  - the 1 Mile, 5K and 10K rows show only `Excluded — bad measurement`
  - the activity is absent from both ranked tables
  CAN FAIL:
  - the 400m row shows only `Excluded — bad measurement` (the Round 1 PASS state, which is CR-01's own output)
  - a Demoted badge appears on 1 Mile, 5K or 10K
  - the reason numbers differ from the expected text
  - the two claims render as one run-on string
  - the activity appears in a ranked table
  Reachability: the pre-fix build fails it on the first CAN FAIL condition (confirmed — Round 1's
  R3 recorded `demotion: null` for this exact effort, i.e. the CAN FAIL state, and was scored PASS
  there only because R3 as drafted could not detect the missing demotion), and this build's
  regenerated document (confirmed above: `demotion.guard: "ceiling"` on both 400m and 1k) makes
  the CAN PASS state reachable for the first time this phase.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-2).

- **R2-3 precedence: an absolute-guard demotion is not overwritten.**
  Ask: open `3475725513`'s detail view and quote the 400m and 1K rows' badges.
  Independently derived, stated before the row runs:
  - 400m (14.6s): `Demoted — implied 27.32 m/s exceeds world-record pace 9.30 m/s`, then `Excluded — Recorded with the same inaccurate GPS device class; its 1k time is not trusted as a genuine personal record.`
  - 1K (148.9s): `Demoted — implied 6.72 m/s exceeds personal ceiling 4.75 m/s (1.28 x p90 3.71 m/s over 1843 filtered 1k efforts)`, then the same Excluded text
  CAN PASS: 400m shows the world-record Demoted text and 1K shows the ceiling Demoted text, each
  followed by the Excluded text.
  CAN FAIL:
  - 400m names the personal ceiling (the absolute guard was overwritten)
  - 1K shows only Excluded (the pre-fix state — confirmed pre-fix: this shard's 1k `demotion`
    was `null` before regeneration per plan 28-14's structural comparison)
  - either row lacks the Excluded badge
  Reachability: the pre-fix build fails it on the 1K row (confirmed by plan 28-14's 22-assertion
  structural comparison: `3475725513@1k demotion diff null -> guard "ceiling"`), and this
  regenerated build (confirmed above) passes it.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-3).

- **R2-4 (R6 re-run): guard-accurate Records notes.**
  Ask: on Records (All time), quote the note under the 400m, 1K and 1 Mile tables verbatim, and
  confirm there is no note under 5K, 10K or Half Marathon.
  Independently derived, stated before the row runs (counts re-derived above, without the
  browser and without `records-logic.ts`; sentence template pinned by plan 28-13's own test
  fixture, `records-logic.test.ts`):
  - 400m: `35 400m efforts were demoted by a plausibility guard (8 by the personal ceiling, 17 by the world-record pace guard, 10 by the activity max-speed guard). Efforts the owner excluded are not counted here. See the activity detail view for each reason.`
  - 1K: `11 1K efforts were demoted by a plausibility guard (7 by the personal ceiling, 1 by the world-record pace guard, 3 by the activity max-speed guard). Efforts the owner excluded are not counted here. See the activity detail view for each reason.`
  - 1 Mile: `5 1 Mile efforts were demoted by a plausibility guard (3 by the personal ceiling, 2 by the activity max-speed guard). Efforts the owner excluded are not counted here. See the activity detail view for each reason.`
  - 5K, 10K, Half Marathon: no note.
  CAN PASS: all three strings equal the expected text exactly, the three counts are 35, 11 and 5,
  and there is no note at 5K, 10K or Half Marathon.
  CAN FAIL:
  - any note says `demoted by the plausibility ceiling` for the whole count (the pre-CR-02 wording)
  - the 400m count is **36** (Round 1's pre-fix reading) or **47** (the all-guard count with no
    owner-exclusion filter — confirmed above as the recount script's own different, all-guard
    measurement), or anything other than 35
  - the 1K count is **13** (a build missing the exclusion filter — confirmed above as the
    recount's own all-guard 1k figure)
  - the breakdown is not 8/17/10
  - a note appears at 5K, 10K or Half Marathon
  Reachability: pre-fix reads 36 (Round 1's own recorded reading, wording "by the plausibility
  ceiling") and fails; this build (regenerated document, guard-accurate copy landed in plan 28-13)
  reads 35 and passes.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-4).

- **R2-5 dark-theme demoted-badge contrast (WR-02).**
  Ask: with the theme set to dark, open `4556693525`'s detail view, and in DevTools read
  `getComputedStyle` `color` of the first `.badge--demoted` element. Then switch to light and read
  it again.
  Independently derived, stated before the row runs (from `src/dashboard/styles.css` read as
  text, converted hex → rgb above): dark `--demoted-text` is `#fb923c` = `rgb(251, 146, 60)`;
  light `--demoted-text` is `#b3390a` = `rgb(179, 57, 10)`.
  CAN PASS: dark reads `rgb(251, 146, 60)` and light reads `rgb(179, 57, 10)`.
  CAN FAIL: dark reads `rgb(194, 65, 12)` (the pre-fix `--accent-strong` token), or any other value.
  Reachability: this row is only reachable once R2-2 shows a demoted badge exists on that page.
  This build's regenerated document (confirmed above) carries a `ceiling` demotion on
  `4556693525`'s 400m and 1k rows, so a `.badge--demoted` element is expected to exist on that
  page under this build — if R2-2 is FAIL or BLOCKED, this row falls back to activity
  `3475712118`'s 400m row (demoted before the fix too, per Round 1's R2 substitution), which must
  be substituted explicitly rather than silently if used.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-5).

- **R2-6 fresh PR-04 sign-off (a document read, not a browser action).**
  Ask: the developer reads the regenerated `28-DIFF.md` in full — the Summary table, the new
  `## Ceiling demotions on owner-excluded efforts` section (13 rows), and the Reconciliation.
  Independently derived, stated before the row runs (from plan 28-14's Round 2 Evidence, all
  re-confirmed above): current `28-DIFF.md` sha256
  (`shasum -a 256 .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`) =
  **`64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`** (confirmed unchanged from
  plan 28-14's recorded value, re-hashed just now); ceiling-only 31 = recount `byGuard.ceiling` 31
  (confirmed above, this task's own recount run) = recount `independentCeilingCount` 31 (same
  run); the 13 labels match plan 28-10's pre-fix sweep (plan 28-14's own set-equality check); the
  D-04 observation: `3475726256@400m` is exactly the stale 44.0s / 9.09 m/s figure (plan 28-14's
  Round 2 Evidence, D-04 observation paragraph).
  CAN PASS:
  - the developer confirms the three-way 31 reconciliation
  - the developer recognises all 13 owner-excluded rows as their own exclusions and finds none
    wrongly ceiling-demoted
  - the developer accepts that no ranking or flag changed relative to the Round 1 sign-off
  CAN FAIL:
  - any of the three figures differ
  - a listed row is not an activity the developer excluded
  - a change appears outside the predicted sections
  - the developer rejects a demotion
  Reachability: the pre-fix diff states 18 and has no owner-excluded listing, so it fails; this
  regenerated diff (31, with the listing, confirmed above) passes.
  **Verdict: PASS** — see § Round 2 Outcome (row R2-6) and § PR-04 Sign-off (Round 2, D-14).

### R4 and WR-01 (recorded once more, no verdict requested)

- **R4 — D-03, the empty table explains itself — still NOT EXERCISABLE.** Unchanged reason from
  Round 1: no distance in the live archive has a ranked table that renders as fully empty (0 rows)
  with a positive demoted count. The regeneration (plan 28-14) changed which efforts carry a
  `demotion`, not which distances rank empty — every ceiling-affected distance still backfills to
  a full ranked table from its own filtered population. This state remains unreachable in the
  current archive.
- **WR-01 — the This-year scope note path — NOT EXERCISABLE.** No 2026 effort is in any top-10, so
  every This-year table renders its empty state rather than the demotion note; the scope-aware
  `null` branch (`resolvePrTableDemotionNote` under `'this-year'`) is unit-tested directly but has
  no live end-to-end reachable state in the browser today.

### Round 2 Reachability Audit

All twelve CAN PASS / CAN FAIL lines from R2-1..R2-6, repeated together:

1. R2-1 CAN PASS: the filename equals `index-BZIqZhAY.js`.
2. R2-1 CAN FAIL: any other filename (a stale bundle).
3. R2-2 CAN PASS: 400m and 1K rows each show the expected Demoted text followed by `Excluded — bad measurement`; 1 Mile/5K/10K show only `Excluded — bad measurement`; the activity is absent from both ranked tables.
4. R2-2 CAN FAIL: the 400m row shows only `Excluded — bad measurement` (Round 1's PASS state); a Demoted badge appears on 1 Mile/5K/10K; the reason numbers differ; the two claims render as one run-on string; the activity appears in a ranked table.
5. R2-3 CAN PASS: 400m shows the world-record Demoted text and 1K shows the ceiling Demoted text, each followed by the Excluded text.
6. R2-3 CAN FAIL: 400m names the personal ceiling instead of the world-record pace; 1K shows only Excluded; either row lacks the Excluded badge.
7. R2-4 CAN PASS: all three notes equal the expected text exactly (counts 35, 11, 5), and no note appears at 5K/10K/Half Marathon.
8. R2-4 CAN FAIL: a note says "by the plausibility ceiling" for the whole count; the 400m count is 36 or 47; the 1K count is 13; the breakdown is not 8/17/10; a note appears where none should.
9. R2-5 CAN PASS: dark reads `rgb(251, 146, 60)` and light reads `rgb(179, 57, 10)`.
10. R2-5 CAN FAIL: dark reads `rgb(194, 65, 12)` (the pre-fix token), or any other value.
11. R2-6 CAN PASS: the developer confirms the 31/31/31 reconciliation, recognises all 13 rows as their own exclusions with none wrongly demoted, and accepts no ranking/flag changed.
12. R2-6 CAN FAIL: any of the three figures differ; a listed row is not the developer's own exclusion; a change appears outside the predicted sections; the developer rejects a demotion.

All six rows carry a complete CAN PASS/CAN FAIL pair. R4 and WR-01 remain NOT EXERCISABLE with
their unreachability stated rather than a row silently dropped, per Round 1's precedent.

---

## Validation Audit 2026-09-17

Run by `/gsd-validate-phase 28` after phase completion (post Round 2, post re-verification `status: passed`).

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

All 3 were entries in this map, not missing tests. PR-01..PR-05 each already had green automated coverage; no test files were generated.

1. **28-15-T1/T2 still marked pending** although Round 2 passed. Now ticked green.
2. **28-09-T1/T2 had no rows.** Added; T2's human sign-off is marked superseded by 28-15-T2.
3. **28-06-T3 was vacuous.** Its skip-ci check read `git diff HEAD`, which has been empty since the change was committed, so it could not fail. It now inspects the glob line itself, which fails if a skip-ci token is ever put on that line.

Evidence, re-run live this audit (not copied from earlier rounds):

- `npm test`: 79 files / 2330 tests / 0 failures. `npx tsc --noEmit`: exit 0. `npm run verify-dashboard`: 64/64.
- `node scripts/compute-pr-ceiling-recount.mjs`: exit 0, both plain and with `--expect-demoted 65` (PASS).
- The name-filtered rows are not vacuous. `-t "deterministic"` ran 2 tests, `-t "no iteration to convergence"` 2, `-t "non-circular"` 1, `-t "REAL committed exclusion"` 1.
- Grep-gated rows hold: `deriveCeilings(` count 2; ceiling glob 1; auto-commit step 1; 400m/5.1098 DIFF rows 11; owner-excluded section present; `data/best-effort-ceiling.json` unchanged.
- The calibration and diff scripts still export all of their pure functions (8 and 3).
- `28-DIFF.md` sha256 is still `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`, the hash signed off in Round 2.
- **Not re-run:** 28-01-T2, 28-06-T2 and 28-07-T2. These rows regenerate committed artifacts (timestamps / data files). Their idempotence was proven in § Round 2 Evidence, and re-running them here would dirty the tree.

Manual-only rows (PR-03 browser read, PR-04 sign-off) remain satisfied by Round 2. `nyquist_compliant: true` stands.

## PR-04 Sign-off (Round 3 — post-merge, D-14)

Recorded 2026-09-19 by the milestone close-out audit (`v2.2-MILESTONE-AUDIT.md`, MERGE-01), not by a
Phase 28 plan. The Round 2 sign-off above was bound to the pre-merge 1,890-activity snapshot; merging
`origin/master` (11 nightly CI commits, +9 activities, 0 conflicts) and regenerating moved the
population, so a fresh sign-off was required before push.

- **Artifact reviewed:** `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`, regenerated
  2026-09-19T07:43:38Z by `node scripts/compute-pr-ceiling-diff.mjs` against the merged archive
  (1,899 activities, 1,874 considered).
- **sha256:** `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`.
- **Prior Round 2 signed version:** sha256 `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`,
  superseded by this sign-off.
- **Material presented before the verdict (machine diff of the two files, shown in full):**
  - Every per-distance ceiling moved down slightly with the larger population: 1k 4.7513 → 4.7496,
    1mi 4.6323 → 4.6281, 5k 4.3458 → 4.3452, 10k 4.2236 → 4.2204 m/s (`populationN` +9 each).
  - **Exactly one record changed hands.** At 1mi, activity `3475730418` (2018-12-16, "Bellahøj -
    Vigerslev", 28.3 km, no device name; 347.6 s, implied 4.630 m/s) was the post-Phase-28 #1 and is
    now demoted by the ceiling (`demotion.guard: "ceiling"`); every remaining 1mi row moves up one
    and `6454505030` (401.5 s) enters at #10. Its own 400m (29.3 s, 13.65 m/s) and 1k (87 s,
    11.50 m/s) efforts were already world-record-demoted — the same GPS-glitch activity.
  - Summary deltas: ceiling-only demoted 31 → 32 (1mi 3 → 4); flag flips 14 → 13; retroactive
    promotions 3 → 2 (3475730418@1mi's "gained" row removed); ranking rows moved 48 → 49;
    `totals.effortsDemoted` 65 → 66. 400m, 1k, 5k, 10k, half, marathon rank tables unchanged.
  - Owner-excluded ceiling-demotion section: still the same 13 rows (ceiling values updated).
  - The three-way figure: diff ceiling-only 32 = recount `byGuard.ceiling` 32 = recount
    `independentCeilingCount` 32 (`--expect-demoted 66` MATCH, exit 0, `ceilingDemotedButNotOverCeiling`
    0, `rankedButDemotedIds` 0). Flagged activities still 47 (12 of 12 exclusions accounted).
  - Gate on the merged archive: `npm test` 84 files / 2550 tests, `npx tsc --noEmit` clean,
    `npm run verify-dashboard` 66/66, curation-artifact scan clean.
- **Developer's verdict:** "Approve" — chosen from a three-option prompt (approve / approve and
  exclude 3475730418 / hold) whose text named the moved record, the ceiling delta and the three-way
  reconciliation. The developer did not elect to exclude the activity; it remains listed in the
  Phase 29 review queue.
- **Date:** 2026-09-19.
- Nothing was written into `28-DIFF.md`; it remains purely generated. `data/best-effort-ceiling.json`
  (tracked) was rewritten by the local `compute-all-stats` run and is committed alongside this record
  so the committed ceiling state matches the signed diff (WR-06's opt-in write gate remains a deferred
  decision).
- Wording observation carried to the Phase 31 cleanup backlog: the demotion reason renders
  "implied 4.63 m/s exceeds personal ceiling 4.63 m/s" — 2-dp rounding hides a real 0.002 m/s margin.

## PR-04 Sign-off (Round 4 — post-TD-04 regeneration, D-12)

Drafted 2026-09-19 by plan 31-10, Task 1. The Round 3 sign-off above was bound to bytes that no
longer exist: TD-04 (plan 31-05) changed the demotion-reason wording on every ceiling row, and
31-08 regenerated all five TD-05 artifacts of record — including this one — against the merged
1,899-activity archive. No verdict is recorded below; it is filled in verbatim by Task 2 (the
checkpoint) once the developer replies.

- **Artifact reviewed:** `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` (current committed
  bytes).
- **Round 3 signed revision, recovered and hash-verified:** `git show ad59daeb:.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`
  (the last commit that touched this path before 31-08's regeneration) → `shasum -a 256` →
  `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd` — **matches** the hash recorded
  in the Round 3 section above exactly. The baseline is identified by content hash, not by its
  position in history.
- **New sha256 (current committed `28-DIFF.md`):** `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`
  (computed 2026-09-19, matches `31-08-SUMMARY.md`'s recorded figure and `git show HEAD:` of the
  current file).
- **Superseded Round 3 sha256:** `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`.

### Machine diff summary (Round 3 signed bytes vs. current committed `28-DIFF.md`)

Command: `git show ad59daeb:.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md > /tmp/28-DIFF-round3.md && diff /tmp/28-DIFF-round3.md .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`

Total diff: **36 lines** (2 hunks). In full:

```diff
5c5
< **Generated:** 2026-09-19T07:43:38.019Z
---
> **Generated:** 2026-09-19T11:36:51.238Z
143,157c143,157
< | Activity ID | Distance | Duration (s) | Implied speed (m/s) | Ceiling (m/s) |
< |---|---|---|---|---|
< | 14122328106 | 400m | 62.1 | 6.4412 | 5.1098 |
< | 3475711469 | 400m | 57.5 | 6.9565 | 5.1098 |
< | 3475711630 | 400m | 58.2 | 6.8729 | 5.1098 |
< | 3475715178 | 400m | 47.6 | 8.4034 | 5.1098 |
< | 3475726256 | 400m | 44.0 | 9.0909 | 5.1098 |
< | 3475727228 | 400m | 46.5 | 8.6022 | 5.1098 |
< | 3475732221 | 400m | 54.6 | 7.3260 | 5.1098 |
< | 3475735603 | 400m | 55.5 | 7.2072 | 5.1098 |
< | 4556693525 | 400m | 45.2 | 8.8496 | 5.1098 |
< | 5059204779 | 400m | 60.3 | 6.6335 | 5.1098 |
< | 5588316886 | 400m | 65.5 | 6.1069 | 5.1098 |
< | 3475725513 | 1k | 148.9 | 6.7159 | 4.7496 |
< | 4556693525 | 1k | 207.4 | 4.8216 | 4.7496 |
---
> | Activity ID | Distance | Duration (s) | Implied speed (m/s) | Ceiling (m/s) | Reason |
> |---|---|---|---|---|---|
> | 14122328106 | 400m | 62.1 | 6.4412 | 5.1098 | implied 6.441 m/s exceeds personal ceiling 5.110 m/s by 1.331 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475711469 | 400m | 57.5 | 6.9565 | 5.1098 | implied 6.957 m/s exceeds personal ceiling 5.110 m/s by 1.847 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475711630 | 400m | 58.2 | 6.8729 | 5.1098 | implied 6.873 m/s exceeds personal ceiling 5.110 m/s by 1.763 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475715178 | 400m | 47.6 | 8.4034 | 5.1098 | implied 8.403 m/s exceeds personal ceiling 5.110 m/s by 3.294 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475726256 | 400m | 44.0 | 9.0909 | 5.1098 | implied 9.091 m/s exceeds personal ceiling 5.110 m/s by 3.981 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475727228 | 400m | 46.5 | 8.6022 | 5.1098 | implied 8.602 m/s exceeds personal ceiling 5.110 m/s by 3.492 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475732221 | 400m | 54.6 | 7.3260 | 5.1098 | implied 7.326 m/s exceeds personal ceiling 5.110 m/s by 2.216 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475735603 | 400m | 55.5 | 7.2072 | 5.1098 | implied 7.207 m/s exceeds personal ceiling 5.110 m/s by 2.097 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 4556693525 | 400m | 45.2 | 8.8496 | 5.1098 | implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 5059204779 | 400m | 60.3 | 6.6335 | 5.1098 | implied 6.633 m/s exceeds personal ceiling 5.110 m/s by 1.524 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 5588316886 | 400m | 65.5 | 6.1069 | 5.1098 | implied 6.107 m/s exceeds personal ceiling 5.110 m/s by 0.997 m/s (1.28 x p90 3.992 m/s over 1834 filtered 400m efforts) |
> | 3475725513 | 1k | 148.9 | 6.7159 | 4.7496 | implied 6.716 m/s exceeds personal ceiling 4.750 m/s by 1.966 m/s (1.28 x p90 3.711 m/s over 1852 filtered 1k efforts) |
> | 4556693525 | 1k | 207.4 | 4.8216 | 4.7496 | implied 4.822 m/s exceeds personal ceiling 4.750 m/s by 0.072 m/s (1.28 x p90 3.711 m/s over 1852 filtered 1k efforts) |
```

(This is the complete diff — nothing was truncated for length. The second hunk covers all 13
owner-excluded ceiling-demotion rows: 11 at 400m, 2 at 1k.)

**Line-by-line classification:** of 36 changed lines, 1 is the `**Generated:**` timestamp (expected,
every regeneration), 2 are the table header/separator picking up a new `Reason` column, and 13 are
data rows whose five pre-existing columns (Activity ID, Distance, Duration, Implied speed, Ceiling)
are **byte-identical** to Round 3 — the only addition per row is the new trailing `Reason` cell
carrying TD-04's margin-bearing text. **No rank table row moved. No count changed. No activity was
added to or removed from the owner-excluded ceiling table.** This is exactly the predicted content
delta (TD-04's reason-string reformatting) and nothing else.

### The numbers reconcile three ways (re-derived in this task, not copied from 31-08)

`28-DIFF.md`'s own Summary section (current committed file):
- "Total efforts demoted (this report's own count, ceiling-only): **32**"
- "Of those, also owner-excluded (no ranking effect): **13**"
- "Total `wasPRAtTheTime` flag flips: **13**"
- "Total retroactive promotions (flips gained): **2**"
- "Total ranking rows moved: **49**"
- `## Reconciliation` section's own text: "This report counts **32** total ceiling-demoted efforts
  across all distances (of which 13 are also owner-excluded)... the document's own
  `totals.effortsDemoted`... is **66**."

`node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 66` (run fresh, this task, against the
current `data/stats/best-efforts.json` / `data/dashboard/index.json` / `data/best-effort-exclusions.json` —
imports none of the classifier/compute/utils/types code, per Phase 28 D-15):
```
Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      32
Cross-check vs. doc.totals.effortsDemoted: own=66 totals=66 disagrees=false
Pinned fixture 4556693525@400m: durationSec=45.2 guard="ceiling" durationMatches45_2=true guardIsCeiling=true
--expect-demoted 66: MATCH
Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): 47
    of which already excluded (data/best-effort-exclusions.json): 12 of 12 total exclusions

independentCeilingCount: 32
overCeilingWithoutDemotion (0): (none)
ceilingDemotedButNotOverCeiling (0): (none)

PASS: recount agrees with the shipped totals; no disagreements found.
```

**Three-way reconciliation:** `28-DIFF.md`'s own ceiling-only total (**32**) = recount's
`byGuard.ceiling` (**32**) = recount's `independentCeilingCount` (**32**). All three agree.
Flagged-activity count: **47**, all 12 recorded exclusions accounted for (matches Round 3's cited
47). `--expect-demoted 66`: **MATCH**.

Also re-run fresh, this task (unmoved from Round 3/31-08, per D-16 in the elevation case and the
composite gate in the pace-quality case):
- `node scripts/compute-pace-quality-recount.mjs --expect 299` → composite **299**, `--expect 299:
  MATCH`, PASS.
- `node scripts/compute-elevation-recount.mjs` → union **60**, inclusion-exclusion
  `11 + 21 + 39 - 6 - 3 - 3 + 1 = 60` vs. direct union 60 → MATCH, PASS.

### Round 3 baseline figures tabulated (unchanged / changed-with-cause)

| Figure | Round 3 baseline | This run | Status |
|---|---|---|---|
| Activities (indexed) | — | 1,899 | unchanged (archive stable since 31-08's merge) |
| Activities considered (best-efforts) | 1,874 | 1,874 | unchanged |
| Ceiling-only demoted (total) | 32 | 32 | unchanged |
| Flag flips | 13 | 13 | unchanged |
| Retroactive promotions | 2 | 2 | unchanged |
| Ranking rows moved | 49 | 49 | unchanged |
| `totals.effortsDemoted` | 66 | 66 | unchanged |
| Flagged activities (queue population) | 47 | 47 | unchanged |
| Three-way ceiling reconciliation | 32 = 32 = 32 | 32 = 32 = 32 | unchanged |
| `28-DIFF.md` sha256 | `cdf9d654…` | `97e1782c…` | **changed with cause** — TD-04 reason-string reformatting (31-05/31-08), not a data change |
| Owner-excluded ceiling table | 13 rows, 5 columns | 13 rows, 6 columns (+Reason) | **changed with cause** — new Reason column (31-08 Rule 2 fix), same 13 rows/values |
| Rank tables (all 7 distances) | — | byte-identical to Round 3 | unchanged |

No figure moved for a reason other than TD-04's reformatting or the one already-disclosed archive
merge (which Round 3 itself already reflects — this run compares against Round 3, not against
Round 2/pre-merge). Nothing here is a finding beyond what was predicted.

### Drafted rows (verdict PASS on all three — see Developer's Verdict (Round 4) below)

**R4-1 — the content delta is only what was predicted.**
The developer reads the diff summary above and confirms the changes are the reason-string
reformatting plus any stated archive drift, and nothing else.
- CAN PASS: the developer reads the 36-line diff (1 timestamp line + 13 rows gaining only a
  trailing Reason cell, 5 pre-existing columns per row byte-identical) and confirms no rank table
  row moved and no count changed — matching this task's own line-by-line classification above.
- CAN FAIL: a record changes hands that was not named (none observed by this task — 0 rank-table
  changes in the diff); a rank table moves (none observed); a count moves with no stated cause
  (none observed — every changed cell traces to the Reason-column addition).
**Verdict: PASS** — blanket approval, "R4-1/R4-2 PASS" (see Developer's Verdict (Round 4) below).

**R4-2 — the numbers reconcile three ways.**
The developer reads the three independently produced ceiling counts and confirms they agree, and
that the flagged-activity count and the exclusions-accounted line match the recount.
- CAN PASS: `28-DIFF.md`'s own ceiling-only total (32), the recount's `byGuard.ceiling` (32) and the
  recount's `independentCeilingCount` (32) all equal 32; flagged-activity count 47 with 12 of 12
  exclusions accounted for, matching Round 3's cited 47.
- CAN FAIL: any two of the three ceiling figures disagree; the flagged count moves without a cause.
  (Not observed this run — all three agree at 32, flagged stays 47.)
**Verdict: PASS** — blanket approval, "R4-1/R4-2 PASS" (see Developer's Verdict (Round 4) below).

**R4-3 — the margin is legible on a real row.**
The developer reads one regenerated ceiling reason and confirms the implied speed, the ceiling and
the margin are three distinct legible numbers, closing the "4.63 exceeds 4.63" observation from
Round 3.
- **Reachability finding (important, read before answering):** the plan names `3475730418@1mi` as
  the worked example. That activity/distance IS still present in `28-DIFF.md` — it appears in the
  `## Records that changed hands` § 1mi rank-diff table (`3475730418 | 2018-12-16T10:28:01Z | 347.6
  | 4 | — | removed`) — but **that table does not carry implied-speed/ceiling/Reason columns at
  all**; only the separate `## Ceiling demotions on owner-excluded efforts` table gets the new
  Reason column, and `3475730418` is not owner-excluded, so it does not appear there. The
  three-number reason text for this exact effort exists in `data/stats/best-efforts.json` (which
  `28-DIFF.md` is generated from) but is **not itself rendered inside `28-DIFF.md`**:
  `"implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over
  1851 filtered 1mi efforts)"` (queried fresh this task from the committed data file).
  A row from the table that DOES carry the Reason column inside `28-DIFF.md` itself, with a
  comparably thin margin: `4556693525@1k` — `"implied 4.822 m/s exceeds personal ceiling 4.750 m/s
  by 0.072 m/s (1.28 x p90 3.711 m/s over 1852 filtered 1k efforts)"`.
- CAN PASS: the developer reads either row's reason text (from `data/stats/best-efforts.json` for
  `3475730418@1mi`, or directly from `28-DIFF.md`'s Reason column for `4556693525@1k`) and confirms
  implied speed, ceiling and margin are three distinct legible numbers (none reads as equal to
  another).
- CAN FAIL: implied and ceiling still render identically in the chosen row; the margin reads
  `0.000`; OR the developer judges that `3475730418@1mi`'s absence from `28-DIFF.md`'s own rendered
  Reason text (as opposed to its presence in the underlying data file) means the row is **NOT
  EXERCISABLE as originally specified** — struck with this reason recorded, per the plan's own rule,
  rather than silently substituted with `4556693525@1k` without disclosure.
**Verdict: PASS** — "R4-3 PASS via 4556693525@1k" (see Developer's Verdict (Round 4) below); the
developer did not select the declined "NOT EXERCISABLE" alternative.

### Reachability Audit (all six CAN PASS / CAN FAIL lines together)

- R4-1 CAN PASS: diff shows only the Reason-column addition (1 timestamp + 13 rows, 5 pre-existing
  columns byte-identical); no rank table row moved; no count changed with no stated cause.
- R4-1 CAN FAIL: an unnamed record changes hands; a rank table moves; a count moves with no stated
  cause.
- R4-2 CAN PASS: diff ceiling-only (32) = recount `byGuard.ceiling` (32) = recount
  `independentCeilingCount` (32); flagged-activity count (47) and exclusions-accounted (12 of 12)
  match the recount.
- R4-2 CAN FAIL: any two of the three ceiling figures disagree; the flagged count moves without a
  cause.
- R4-3 CAN PASS: the chosen row's implied speed, ceiling and margin are three distinct legible
  numbers.
- R4-3 CAN FAIL: implied and ceiling still render identically; the margin reads `0.000`; OR
  `3475730418@1mi` is judged NOT EXERCISABLE against `28-DIFF.md` itself (struck, reason recorded,
  not silently substituted).

### Developer's Verdict (Round 4)

**Developer's verdict (verbatim):** "Approve — R4-1/R4-2 PASS, R4-3 PASS via 4556693525@1k"

Given 2026-09-19 in answer to a three-option prompt that named the sha256
`97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`, the diff contents, the
three-way ceiling figures, and the R4-3 reachability finding above. This is a **blanket approval**
covering all three rows; no independent per-row observation was volunteered beyond what the chosen
option's text stated. Recorded here exactly as the developer accepted it, not expanded into
invented per-row detail:

- **R4-1:** PASS — the only content change is the Reason column plus the `**Generated:**`
  timestamp; no rank row moved.
- **R4-2:** PASS — 32 = 32 = 32 (diff ceiling-only = recount `byGuard.ceiling` =
  `independentCeilingCount`), total `effortsDemoted` 66, flagged 47.
- **R4-3:** PASS — judged against the in-diff thin-margin row `4556693525@1k` ("implied
  4.822 m/s exceeds personal ceiling 4.750 m/s by 0.072 m/s (1.28 x p90 3.711 m/s over 1852
  filtered 1k efforts)") plus the data-file text for `3475730418@1mi` ("implied 4.630 m/s exceeds
  personal ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)"),
  explicitly acknowledging that `3475730418@1mi`'s own row in the diff's 1mi rank-diff table
  carries no Reason column.

**Alternative offered and declined:** "Approve, R4-3 NOT EXERCISABLE" — which would have withheld
the TD-05 tick pending a Reason column being added to rank tables. The developer did not select
this option.

**Date:** 2026-09-19.
**Bound to sha256:** `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5` (current
committed `28-DIFF.md`), superseding Round 3's
`cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`.

**Disposition (applying the plan's tick rule — TD-05 ticks only if every mapped row PASSes):**
R4-1 PASS, R4-2 PASS, R4-3 PASS — all three rows PASS. TD-05 is eligible to tick; see
`REQUIREMENTS.md`. Nothing was written into `28-DIFF.md` by this transcription.

Nothing further is written into `28-DIFF.md`; it remains purely generated.
