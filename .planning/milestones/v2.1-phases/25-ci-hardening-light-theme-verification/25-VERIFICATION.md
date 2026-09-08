---
phase: 25-ci-hardening-light-theme-verification
verified: 2026-09-04T20:40:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
must_haves:
  truths:
    - "gear-aggregate-logic.ts degrades into Unknown bucket instead of crashing slugify(undefined) for an absent gearName key, with regression test"
    - "daily-refresh.yml and compute-all-stats share a single source of truth for compute-step ordering"
    - "verify-dashboard-publish.mjs asserts reachability by name for weekly-distance, monthly-stats, yearly-stats, year-over-year, best-efforts.json, and a per-activity shard sample"
    - "On a genuinely light-OS machine the dashboard is legible, shows no first-paint white flash, and live-follows an OS appearance change light->dark->light"
---

# Phase 25: CI Hardening / Light-Theme Verification — Verification Report

**Phase Goal:** Close FIX-02 (gear-aggregate crash), CI-01 (single source of truth for compute-step ordering), CI-02 (by-name publish verification), and VER-01 (Phase 16's three untested theme/first-paint items, confirmed on a real light-OS machine).

**Verified:** 2026-09-04T20:40:00Z
**Status:** passed
**Re-verification:** No — initial verification of this phase (post-gap-closure Round 2)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `gear-aggregate-logic.ts` degrades absent/undefined/empty/non-string `gearName` into Unknown bucket, not a crash, with regression tests | ✓ VERIFIED | `src/analytics/gear-aggregate-logic.ts:146` uses `typeof label !== 'string' \|\| label === ''` (widened from `=== null`) at both `buildGearAggregate` and `buildGearCoverage` call sites. Independently re-ran `npx vitest run src/analytics/gear-aggregate-logic.test.ts --reporter=verbose`: 19/19 pass, including all 8 named FIX-02/D-12 regression cases. `npx tsc --noEmit` exits 0 with `gearName` optional on `DashboardIndexRow` (confirmed independently). |
| 2 | Nightly workflow and `compute-all-stats` share one source of truth for step ordering — no two hand-maintained orderings | ✓ VERIFIED | `src/compute-all-stats-steps.ts` (218 lines) declares `COMPUTE_ALL_STATS_STEPS` once with an explicit dependency-order comment block; `src/index.ts:computeAllStatsCommand` imports and walks it. `daily-refresh.yml:96-97`'s "Compute all statistics" step is a single collapsed `node dist/index.js compute-all-stats --ci` call with an inline comment stating the order is declared once in the TS file and "no ordering of the chain is re-expressed here" — read directly from the file. `git show origin/master:.github/workflows/daily-refresh.yml \| grep -c "compute-all-stats --ci"` returns `1` on current `origin/master` (`7916affb`), independently re-confirmed. Live dispatched run `33903407761` (event `workflow_dispatch`, conclusion `success`) log shows all 8 step names in declared order from one invocation. |
| 3 | `verify-dashboard-publish.mjs` asserts reachability by name for the six documents (`weekly-distance`, `monthly-stats`, `yearly-stats`, `year-over-year`, `best-efforts.json`, per-activity shards) | ✓ VERIFIED | Read `scripts/verify-dashboard-publish.mjs:441-598` directly: each of the six documents has its own named `expect200` + `JSON.parse` + structural-invariant `fail()`/`ok()` block (not a directory-copy check). `npm run verify-dashboard` independently reproducible at `56 check(s) passed, 0 failure(s).` (orchestrator-confirmed, corroborated by VALIDATION.md's D-11 RED-then-green cycle log showing each of the 6 assertions was observed failing-by-name against a broken fixture before this phase, then restored green). |
| 4 | On a genuinely light-OS machine: legible, no first-paint white flash, live-follows OS light->dark->light | ✓ VERIFIED (with one disclosed, developer-approved deviation) | Round 1 R1 (light-OS legibility, quoted `data-theme:'light'`, `dashboard-theme` in null/'auto' class, developer verbatim "Legible. Toggle is visible.") PASS. R3/R4 (live-follow light->dark and dark->light, same open document, `timeOrigin` byte-identical proving no reload, `matchMedia`/`data-theme` both flip) PASS. R7 (first-paint, Round 2) PASS but run on a **dark**-appearance OS per D-05's disclosed, developer-approved deviation — see adjudication below. |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/gear-aggregate-logic.ts` | Widened Unknown-bucket predicate at both call sites | ✓ VERIFIED | Confirmed by direct read; predicate widened at lines ~146 and ~207 (buildGearAggregate/buildGearCoverage) |
| `src/analytics/gear-aggregate-logic.test.ts` | 8 new regression cases | ✓ VERIFIED | 19/19 tests pass, 8 match FIX-02/D-12 names exactly, independently re-run |
| `src/compute-all-stats-steps.ts` | Single ordered step table, importable | ✓ VERIFIED | 218 lines, substantive, exported `COMPUTE_ALL_STATS_STEPS`, imported by `src/index.ts` |
| `src/compute-all-stats-steps.test.ts` | Unit coverage of walker semantics | ✓ VERIFIED | Present, part of the 62-file/1596-test green suite |
| `.github/workflows/daily-refresh.yml` | Single collapsed compute step, no separate hand-maintained ordering | ✓ VERIFIED | Line 96-97, comment cross-references CI-01/D-01; confirmed on `origin/master` |
| `scripts/verify-dashboard-publish.mjs` | Six new by-name assertion blocks | ✓ VERIFIED | Confirmed present and wired (lines 441-598), each with its own `fail()`/`ok()` messages naming the document |
| `src/dashboard/theme-bootstrap-parity.test.ts` | Behavioral parity pin, inline bootstrap vs `theme.ts` | ✓ VERIFIED | Landed plan 25-05, part of green 62-file suite |
| `scripts/first-paint-capture.mjs` | First-paint capture harness used for R7's evidence | ⚠️ WIRED but has unresolved robustness defects (CR-01, WR-01, WR-02 — see Anti-Patterns) | Functioned correctly for the R7 run that produced this phase's evidence; code review found real crash-on-error-path risks for *future* runs, disclosed as instrumentation not shipped code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/index.ts:computeAllStatsCommand` | `src/compute-all-stats-steps.ts` | `import { COMPUTE_ALL_STATS_STEPS, runComputeAllStatsSteps }` | WIRED | Confirmed by direct read; steps announced (`console.log('> ${step.name}')`) and walked |
| `.github/workflows/daily-refresh.yml` | `dist/index.js compute-all-stats --ci` | single collapsed shell step | WIRED | Confirmed on `origin/master`; live dispatched run `33903407761` log shows all 8 names |
| `scripts/verify-dashboard-publish.mjs` | `dist/widgets/data/stats/*.json` | HTTP `expect200` + `JSON.parse` + structural invariant, per document | WIRED | Confirmed by direct read and by independently-reproduced `56 check(s) passed, 0 failure(s).` |
| `src/dashboard/index.html` inline bootstrap | `src/dashboard/theme.ts` `resolveEffectiveTheme` | `node:vm` behavioral parity test | WIRED | `theme-bootstrap-parity.test.ts` landed and green |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FIX-02 | 25-01 (fix), 25-06/25-11 (gate/round), 25-12 (tick) | gear-aggregate Unknown-bucket degrade, not crash | ✓ SATISFIED | R6a PASS (Round 2): 8 named regression cases + 5-command gate on pushed merge commit `70e00840`/`67ed20f1`; independently re-verified on current tree |
| CI-01 | 25-02 (fix), 25-06/25-11 (gate/round), 25-12 (tick) | single source of truth for compute-step order | ✓ SATISFIED | R6c PASS (Round 2): live dispatched run `33903407761` success, all 8 names in order, `origin/master` confirmed carrying the collapsed step |
| CI-02 | 25-03/25-04 (fix), 25-06/25-11 (gate/round), 25-12 (tick) | by-name publish reachability assertions | ✓ SATISFIED | R6b PASS (Round 2): `56 check(s) passed, 0 failure(s).`, all 6 named documents + runtime-sampled shards individually confirmed |
| VER-01 | 25-05/25-07/25-08/25-09/25-10/25-12 | 3 untested theme/first-paint items confirmed on real light-OS | ✓ SATISFIED (with disclosed deviation, see below) | Round 1 R1/R3/R4/R5 PASS + Round 2 R7 PASS, GAP-25-01 CLOSED |

No orphaned requirements — REQUIREMENTS.md's traceability table maps all four IDs to Phase 25 and no additional IDs are mapped that were not claimed by a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/index.ts` | 314 | Unconditional success log line printed before the conditional DEGRADED STEPS block (WR-04, code review) | ⚠️ Warning | Real defect for future log-scraping/alerting; does NOT invalidate R6c's verdict (see adjudication below) |
| `src/analytics/gear-aggregate-logic.ts` | 143 | Raw NUL byte (`'\x00unknown'`) instead of the intended `' unknown'` sentinel | ⚠️ Warning (hygiene, pre-existing) | Makes git classify the file as binary (no reviewable diff/blame for this or future commits touching it); functionally harmless (tests/tsc green, NUL sorts before real labels same as intended space) — pre-exists Phase 25 (introduced Phase 18, commit `a70aa10c3`), already self-disclosed in `deferred-items.md` |
| `scripts/first-paint-capture.mjs` | 303-314, 396-417 | Unhandled promise rejection in CDP screencast-frame handler can crash the harness, skipping Chrome-process/temp-dir cleanup (CR-01, code review) | 🛑 Critical (in review, but scoped to test harness, not shipped product) | Did not affect R7's actual successful run (this code path was not triggered); is a real robustness gap for *future* capture runs |
| `scripts/first-paint-capture.mjs` | 191-232, 464 | No timeout/error listener on CDP WebSocket — a dead socket can hang the harness (WR-01) | ⚠️ Warning | Same disposition as CR-01 — instrumentation only |
| `scripts/first-paint-capture.mjs` | 236-249, 452-453 | No `error` listener on spawned Chrome process — `ENOENT` crashes instead of hitting the FATAL path (WR-02) | ⚠️ Warning | Same disposition |
| `scripts/verify-dashboard-publish.mjs` | ~35 call sites | Unguarded `JSON.parse` — a truncated file aborts the whole gate with a raw stack trace instead of a named `fail()` (WR-03) | ⚠️ Warning | Gate still correctly exits 1 (verified by review); loses per-document diagnostic specificity and the summary line on this specific failure mode. Does not affect the 6 D-11-observed break/restore cycles, all of which produced valid-but-wrong-shaped JSON, not truncation |
| `scripts/first-paint-capture.mjs` | 36, 505 | Redundant dynamic `import('node:fs')` (IN-01) | ℹ️ Info | Cosmetic |
| `scripts/first-paint-capture.mjs` | 357-360 | Dead `navigatedAt` state, written never read (IN-02) | ℹ️ Info | Cosmetic |

**Debt-marker gate:** No unreferenced `TBD`/`FIXME`/`XXX` markers found in files modified by this phase.

## Adjudication of the Two Findings the Orchestrator Flagged

### Finding A — `src/index.ts:314`'s unconditional success line (WR-04)

**Confirmed by independent read.** `console.log('\nAll statistics generated successfully!')` at line 314 executes unconditionally, before the `if (degraded.length > 0)` block at line 316. `process.exit(0)` at the end of `computeAllStatsCommand` is also unconditional on `degraded.length` — a mandatory-step failure still throws and is caught (exit 1), but a run with only tolerated (non-mandatory) steps degraded still exits 0. This is a real, disclosed-by-review defect: a log-scraping alert that greps for "successfully" would miss a run with tolerated degradation.

**Verdict: does NOT undermine R6c / CI-01's tick.** R6c's actual pass condition rests on three independently-verifiable facts, none of which depend on the flawed print line's mere presence:
1. The eight `> NAME` lines, enumerated from `src/compute-all-stats-steps.ts` SOURCE (not the log) and confirmed present in that exact order from ONE invocation — this is solid, source-independent evidence for criterion 2 (single source of truth).
2. The run's `conclusion: success`, reported by GitHub's own `gh run view --json status,conclusion` — an independent, out-of-band signal from the workflow runner, not derived from any printed string.
3. The **absence** of the "DEGRADED STEPS" block, confirmed by `grep` across the full step log. Unlike the unconditional success line, this block genuinely IS gated on `degraded.length > 0` (confirmed by direct read of `src/index.ts:316-323`) — its absence is real, conditional evidence that no tolerated step actually failed in this specific run. R6c's own row text explicitly does NOT rely on the success line's presence as discriminating evidence — it states the DEGRADED STEPS block "is NOT part of the pass condition" and separately records its absence as a fact, not an inference from the success banner.

CI-01's roadmap criterion (single source of truth for step ordering) is satisfied independently of this logging wart. **WR-04 is a genuine, real defect that should be fixed** (the review's suggested fix — conditioning the message on `degraded.length` — is correct and low-risk) but it is an operational-observability gap, not a falsification of any of the four requirements' truths. Recorded as a WARNING, not a BLOCKER.

### Finding B — raw NUL byte in `gear-aggregate-logic.ts:143`

**Confirmed by independent byte-level read** (`python3` byte read: exactly one `\x00` at that exact offset, inside `'<NUL>unknown'`). Confirmed this is the **only** source file (excluding the legitimate binary `data/geo/geonames.db`) among all git-tracked files containing a NUL byte. Also confirmed via `git blame` and `git show a70aa10c3:...` that this NUL byte **pre-dates Phase 25** — it was already present in Phase 18's commit (`a70aa10c3`, 2026-08-11), long before plan 25-01 touched this file. Plan 25-01 widened the predicate at the lines around it but did not introduce, and did not fix, this pre-existing byte. The team's own `deferred-items.md` for plan 25-01 already discloses this exact finding, with the identical conclusion: functionally harmless (a NUL sorts before any printable character, same as the intended leading space, so the "sorts before any real label" invariant still holds), confirmed by 19/19 green tests and `tsc --noEmit` exit 0, with the only externally-visible effect being that git classifies the file as binary (no line-level diff/blame).

**Verdict: does NOT affect FIX-02's tick.** FIX-02's truth is about `gearName`-absence handling, which is orthogonal to the byte-encoding of an unrelated internal sentinel constant. R6a's discriminator (8 named regression cases + tsc clean) genuinely cannot see this defect and does not need to — it is not part of what FIX-02 asks for. This is correctly classified as a pre-existing hygiene defect, already self-disclosed, and appropriately left unfixed under this project's "don't patch under checkpoint pressure" house rule. It is worth a low-risk one-line follow-up (replace `\x00` with a literal space) in a future cleanup plan, as the team's own deferred-items.md already recommends.

## Adjudication of Criterion 4 Across Both Rounds

Criterion 4 has three sub-items: legibility, no first-paint flash, live-follow both directions — "on a genuinely light-OS machine."

- **Legibility (R1):** genuinely run on light-OS. PASS, unambiguous.
- **Live-follow both directions (R3/R4):** the session starts on light OS, storage cleared, hard-reloaded; the developer flips Appearance to dark (R3) then back to light (R4) with the same document alive throughout (`timeOrigin` byte-identical, no reload). This is a genuinely light-OS-anchored session exercising both transition directions. PASS, with a disclosed-but-non-defeating caveat (backgrounded-tab DOM lag, recorded not smoothed over).
- **No first-paint flash (R7):** run on a **dark**-appearance OS, per D-05's explicit, pre-registered, developer-approved deviation. The reasoning is sound and independently checkable: light `--bg` is `#ffffff`, so on a light OS a white first frame is the *correct* final state and the row is structurally incapable of discriminating a working pre-paint bootstrap from a broken one (verified directly: `styles.css:18` sets `--bg: #ffffff` for light theme). The dark-OS substitution exercises the *identical* code path (the same inline pre-paint bootstrap script, theme-symmetric logic) where a failure is diagnostically visible (white would indicate the bootstrap did not apply before paint). This is cross-validated in both directions: a negative control (pre-paint bootstrap deliberately deleted) reproducibly captured white strictly *before* first paint under the identical mechanism, proving the harness detects real regressions; three separate production runs (C-1/C-2/C-3) and R7 itself all captured the correct dark color 5-12ms *before* first paint. The deviation is disclosed prominently in both plan and validation artifacts, not smuggled in, and was explicitly approved by the developer as part of the phase's own governance (D-05).

**Adjudication: criterion 4 is discharged across both rounds taken together.** The dark-OS substitution for the first-paint sub-item is a sound, disclosed, symmetric-code-path test design decision rather than an evasion of the requirement — it tests the same bootstrap logic that runs on light OS, in the one condition where the outcome is diagnostic rather than vacuous. This does not leave criterion 4 partly unmet; it is the only way to make that specific sub-item non-vacuous, and the team recognized and handled that correctly rather than silently declaring a vacuous light-OS test as PASS.

### Human Verification Required

None outstanding. All human-checkpoint items for this phase (light-OS legibility, live-follow both directions, first-paint capture judgment) were already executed by the developer during the phase's own Round 1/Round 2 checkpoints, with verbatim judgments recorded in `25-VALIDATION.md`.

### Gaps Summary

No gaps. All four requirements (FIX-02, CI-01, CI-02, VER-01) have independently re-verified, source-level evidence supporting their roadmap success criteria. The two findings the orchestrator specifically flagged (WR-04's unconditional success line, and the pre-existing NUL byte) are both real, both correctly disclosed by the team's own process (code review and deferred-items.md respectively), and neither falsifies any of the four requirements' truths — both are recorded here as WARNING-level follow-up items rather than BLOCKERs. The code review's one Critical and three of four Warnings (CR-01, WR-01, WR-02) are scoped to `scripts/first-paint-capture.mjs`'s error-path robustness — explicitly disclosed as test instrumentation, not shipped product code — and did not manifest during the actual run that produced this phase's VER-01 evidence; they are legitimate follow-up work, not phase-goal blockers.

**Recommended follow-up (non-blocking):**
1. Fix `src/index.ts:314`'s success-line ordering (WR-04) — low-risk, one-line change.
2. Replace the NUL byte in `gear-aggregate-logic.ts:143` with a literal space (already flagged in `deferred-items.md`).
3. Harden `scripts/first-paint-capture.mjs`'s CDP event-listener and Chrome-spawn error handling (CR-01/WR-01/WR-02) before it is relied on again for a future checkpoint.
4. Wrap `scripts/verify-dashboard-publish.mjs`'s `JSON.parse` calls to preserve per-document diagnostics on truncated files (WR-03).

---

_Verified: 2026-09-04T20:40:00Z_
_Verifier: Claude (gsd-verifier)_
