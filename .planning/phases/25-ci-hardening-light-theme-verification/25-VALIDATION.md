---
phase: 25
slug: ci-hardening-light-theme-verification
status: gaps_found
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `25-RESEARCH.md` § "Validation Architecture". Task IDs are filled in by the planner.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`) |
| **Quick run command** | `npx vitest run <path-to-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | Full suite ~7s (measured 2026-09-03: 60 files / 1560 tests / 6.91s, all green). Single file <1s. |

**Baseline confirmed green before planning:** `npm test` → 60 passed (60) / 1560 passed (1560), duration 6.91s.

**No framework installation gap.** vitest is already configured and in use for every automated item below. `jsdom` is *not* installed and is *not* required — D-06's parity pin uses Node's built-in `vm` module (see RESEARCH Pattern 6, Option A). `act` is not installed and is not required — `daily-refresh.yml` already carries a `workflow_dispatch` trigger, so `gh workflow run` produces a real on-demand run, which is stronger evidence than a local emulation.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <affected file>` — plus `npx tsc --noEmit` for any task touching FIX-02's type change (D-13), because the whole point of making `gearName` optional is to let the compiler enumerate consumers.
- **After every plan wave:** `npm test` + `npm run build` + `npm run build-widgets` + `npm run verify-dashboard`.
- **Before `/gsd-verify-work`:** Full suite must be green, and every D-11 RED observation must be recorded.
- **Max feedback latency:** 7 seconds (full suite). No task in this phase needs a slower signal.

---

## Per-Task Verification Map

Task ID / Plan / Wave filled 2026-09-03 by `/gsd-plan-phase 25` against the seven PLAN.md files it wrote. Task IDs read `{plan}-T{n}` where `n` is the task's position in that plan's `<tasks>` block. Row set unchanged from the draft.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-T3 | 25-01 | 1 | FIX-02 (D-12) | — | Non-string / empty `gearName` degrades to the Unknown bucket rather than reaching `slugify(undefined)` | unit | `npx vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ existing | ✅ green |
| 25-01-T3 | 25-01 | 1 | FIX-02 (D-12, second site) | — | `buildGearCoverage` (`gear-aggregate-logic.ts:207`) uses the same widened predicate — silent mis-bucketing closed alongside the crash | unit | `npx vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ existing | ✅ green |
| 25-01-T1 | 25-01 | 1 | FIX-02 (D-13) | V5 Input Validation | `gearName` optional on the row type; every consumer making the presence assumption is enumerated by the compiler and either fixed or recorded as a todo | type-check | `npx tsc --noEmit` | N/A — compiler check | ✅ green |
| 25-02-T2 | 25-02 | 1 | CI-01 (D-01) | — | The eight compute steps' order and mandatory/tolerated disposition are declared once, in an importable data structure, and asserted by test | unit | `npx vitest run src/compute-all-stats-steps.test.ts` | ✅ existing (landed Wave 0/1) | ✅ green |
| 25-02-T2 | 25-02 | 1 | CI-01 (D-02) | — | The CI flag flips tolerated-step disposition to warn-and-continue and leaves mandatory steps fail-fast | unit | same new file | ✅ existing (landed Wave 0/1) | ✅ green |
| 25-02-T3 / 25-06-T2 | 25-02, 25-06 | 1, 3 | CI-01 (D-03) | — | End-of-run failure summary names every degraded step; `::warning::` annotations still surface in the Actions run summary | unit + manual (workflow run) | same new file; evidence from `gh workflow run` | ✅ existing (landed Wave 0/1) | ⚠️ split: unit half ✅ green (25-02-T2's own tests, part of the 62/1596 tally above); live-workflow-run half ⬜ BLOCKED — see § "CI-01 live run evidence — blocked" below |
| 25-03-T1 | 25-03 | 1 | CI-02 (D-09) | — | Each of the six documents returns 200, parses as JSON, and satisfies one structural invariant a truncated/empty file would fail | integration (HTTP smoke) | `npm run verify-dashboard` | ✅ existing, extended | ✅ green |
| 25-03-T1 | 25-03 | 1 | CI-02 (D-10) | — | The per-activity best-effort shard sample is derived at runtime (no pinned ids), following `verify-dashboard-publish.mjs:430-455` | integration | `npm run verify-dashboard` | ✅ existing, extended | ✅ green |
| 25-03-T2 | 25-03 | 1 | CI-02 (D-11) | Tampering — "the verifier lies" | Each of the six new assertions observed RED once, naming its own document | scripted one-off (validation-round activity, not a committed test) | delete/truncate target in a scratch `dist/widgets` → `npm run verify-dashboard` exits non-zero **naming that document** → restore → green | N/A — round activity | ✅ green (see § "D-11 RED evidence log" below) |
| 25-04-T2 | 25-04 | 2 | WR-19 (folded todo) | V1 Architecture — fail-closed | A mode-000 directory under `dist/widgets` is reported as a violation, not thrown as an uncaught `EACCES`; the guard stays fail-**closed** | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ existing — add mode-000-**directory** fixture | ✅ green |
| 25-04-T1 | 25-04 | 2 | WR-19 (D-11 precedent) | — | The new directory fixture observed RED before the guard fix lands | scripted one-off | run the new fixture against unfixed `curation-guard.mjs`, confirm failure | N/A — round activity | ✅ green (see § "D-11 RED evidence log" below) |
| 25-05-T1 / 25-05-T2 | 25-05 | 1 | VER-01 (D-06) | — | Inline bootstrap in `index.html` resolves the same `(mode, prefersDark) → effective theme` as `theme.ts` across all combinations; `'light' \| 'dark' \| 'auto'` allow-list intact (T-16-TH-01); script still ordered before the stylesheet link | unit (behavioural, `node:vm` sandbox) | `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` | ✅ existing (landed Wave 0/1) | ✅ green |
| 25-07-T2 | 25-07 | 4 | VER-01 (D-04/D-05/D-07/D-08) | — | Legibility, first-paint, and live OS-follow confirmed from a genuine light-OS environment against the production build | **manual — human checkpoint** | N/A (see § Manual-Only Verifications) | N/A | ❌ RUN 2026-09-04 — R1/R3/R4/R5 PASS, **R2 and R6 BLOCKED**; see § "Round 1 Checkpoint (R1-R6)" and GAP-25-01/GAP-25-02 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All four confirmed present and green by plan 25-06 Task 1 (see § Wave 1 Integration Gate below).

- [x] **`src/compute-all-stats-steps.test.ts`** (planner's chosen name; the table itself lives in `src/compute-all-stats-steps.ts`) — CI-01's step table. `src/index.ts` has *zero* test coverage today; no command in it is imported and unit-tested anywhere. Per RESEARCH Pattern 1, extract an exported ordered array of `{ name, mandatory, run }` and test that constant directly, importing only the constant so the test never touches `process.exit`. — landed plan 25-02.
- [x] **`src/dashboard/theme-bootstrap-parity.test.ts`** (planner's chosen name) — D-06's `node:vm` behavioural pin. Must sit alongside `theme.test.ts` per CONTEXT.md canonical refs. — landed plan 25-05.
- [x] **mode-000-directory fixture in `scripts/lib/curation-guard.test.mjs`** — the file-shaped sibling (WR-14 case c) exists; the directory-shaped one does not. — landed plan 25-04.
- [x] **Six new assertion blocks in `scripts/verify-dashboard-publish.mjs`** — additive to an existing file in its existing `expect200`/`ok`/`fail` style; no framework gap. — landed plan 25-03.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard is legible with light appearance set at the **OS** level | VER-01 / criterion 4 | Requires a real OS appearance setting; no jsdom or headless browser in this repo, and an in-page toggle explicitly cannot satisfy it | **D-04 (AMENDED 2026-09-03, plan-checker blocker, developer-approved — the amendment MUST be disclosed in the write-up, not quietly applied):** start from cleared site data (or a fresh profile) and quote `localStorage.getItem('dashboard-theme')` *at the instant of observation*, with the value being **`null` or `'auto'`** — never `'light'` or `'dark'`. `theme.ts` reads the persisted mode **before** falling back to `prefers-color-scheme`, so a browser left on an explicit mode ignores the OS entirely and a masked row is indistinguishable from a passing one. A literal `null` is **unreachable on a correctly-functioning page**: `src/dashboard/main.ts:29` calls `applyThemeMode(readStoredMode(resolveStorage()))` at module scope with no options and `persist` defaults to `true` (`theme.ts:118`), so every load writes `'auto'` before any read is possible (`index.html:41` only calls `getItem` — it is not the writer). `null` and `'auto'` are behaviourally identical: `parseThemeMode(null)` returns `'auto'` (`theme.ts:41`) and the live-follow listener gates on `readStoredMode(storage) === 'auto'` (`theme.ts:171`). A row quoting `'light'` or `'dark'` — or quoting nothing — is recorded **BLOCKED**, not PASS. Quote `matchMedia('(prefers-color-scheme: dark)').matches` before and after. **D-08:** run against `https://bacilo.github.io/strava-widgets/` with hard-reload after every change (this repo has a documented history of a stale cached `index.html` producing false evidence). |
| No first-paint white flash | VER-01 / criterion 4 | Same as above, plus frame capture | **D-05 — deliberate deviation from criterion 4's literal wording, which MUST be disclosed as such in the write-up, not quietly substituted.** Observe this row with the OS in **dark** appearance. Light `--bg` is `#ffffff` (`styles.css:18`), so on a light OS a white first paint *is* the correct final state and cannot discriminate a working pre-paint theme from a broken one. On dark OS, a white first frame is the failure and `#1a1a2e` (`styles.css:105`) is the pass. Legibility stays on light OS; live-follow spans both. |
| Live-follows an OS appearance change light → dark → back | VER-01 / criterion 4 | The gesture the requirement calls human stays human | **D-07 hybrid execution**, mirroring Phase 24's R34: the developer personally changes appearance in System Settings; the agent handles the surrounding instrumentation (cleared-storage assertion, frame capture, `matchMedia` reads before and after). `osascript`-driven switching was considered and **rejected** for the recorded rows. |
| A real (or dry-run) nightly workflow execution | CI-01 / criterion 5 | Exercises the actual Actions runner | `daily-refresh.yml` already has `workflow_dispatch` (confirmed present). Trigger with `gh workflow run "Daily Widget Refresh"`, then capture the run's step output — specifically that the single collapsed compute step's log carries the per-step names and the end-of-run failure summary that the eight separate green/red boxes used to provide (D-01's accepted cost). |
| Green `verify-dashboard-publish.mjs` run | CI-02 / criterion 5 | Runs against a served build | `npm run verify-dashboard` exits 0 and reports the six new checks among its "N check(s) passed" total. |

---

## D-11 RED Observation Log

Transcribed verbatim (not paraphrased) from each source plan's own SUMMARY.md, per this plan's
task instruction and D-11's precedent that a guard only counts once observed failing against the
unfixed code. Source: `25-01-SUMMARY.md`, `25-03-SUMMARY.md`, `25-04-SUMMARY.md`.

### From 25-01-SUMMARY.md — gear-aggregate Unknown-bucket regression (FIX-02, D-12)

Verbatim vitest failure output per new case, run against the unwidened predicate
(`gear-aggregate-logic.ts` untouched at that point):

**`buildGearAggregate > absent gearName key lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:141:19
```

**`buildGearAggregate > gearName: undefined lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:150:19
```

**`buildGearAggregate > gearName: empty string lands in the Unknown bucket rather than the shoe fallback key (FIX-02, D-12)`**
```
AssertionError: expected undefined to be 'Unknown' // Object.is equality
- Expected: "Unknown"
+ Received: undefined
 ❯ src/analytics/gear-aggregate-logic.test.ts:161:28
```

**`buildGearAggregate > non-string gearName lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: label.toLowerCase is not a function
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:168:19
```

**`buildGearCoverage > absent gearName key is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:225:33
```

**`buildGearCoverage > gearName: undefined is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:232:33
```

**`buildGearCoverage > gearName: empty string is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:239:33
```

**`buildGearCoverage > non-string gearName is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:246:33
```

Test file run summary at RED: `Test Files 1 failed (1)`, `Tests 8 failed | 11 passed (19)`.
`git diff --name-only` at that point confirmed `src/analytics/gear-aggregate-logic.ts` was NOT
modified. After the predicate widening, all 19 tests in the file pass.

### From 25-03-SUMMARY.md — six CI-02 by-name publish assertions (D-09, D-10, D-11)

Baseline before any cycle: `56 check(s) passed, 0 failure(s).` / `EXIT=0` (end of Task 1).

**1. `weekly-distance.json` — overwrite with `[]`**
- Break applied: `echo '[]' > dist/widgets/data/stats/weekly-distance.json`
- EXIT line: `EXIT=1`
- Failure line: `✗ /data/stats/weekly-distance.json expected a non-empty array, got an array of length 0`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

**2. `monthly-stats.json` — truncate to zero bytes**
- Break applied: `: > dist/widgets/data/stats/monthly-stats.json`
- EXIT line: `EXIT=1`
- Failure line: `✗ GET /data/stats/monthly-stats.json returned 200 but an empty body`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

**3. `yearly-stats.json` — overwrite with `[]`**
- Break applied: `echo '[]' > dist/widgets/data/stats/yearly-stats.json`
- EXIT line: `EXIT=1`
- Failure line: `✗ /data/stats/yearly-stats.json expected a non-empty array, got an array of length 0`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

**4. `year-over-year.json` — first 11 entries only**
- Break applied: parsed the 12-entry snapshot, wrote back only entries `[0..10]` (11 entries)
- EXIT line: `EXIT=1`
- Failure line: `✗ /data/stats/year-over-year.json expected an array of exactly 12 entries (one per calendar month, per compute-advanced-stats.ts:104), got an array of length 11`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)
- Note (25-03's own): the failure line quotes the observed count (11) against the expected 12,
  proving the fixed-length invariant fired rather than a generic non-empty check.

**5. `best-efforts.json` — overwrite with a parses-fine-but-empty document**
- Break applied: `echo '{"schemaVersion":1,"activities":{},"rankings":{}}' > dist/widgets/data/stats/best-efforts.json`
- EXIT line: `EXIT=1`
- Failure line: `✗ /data/stats/best-efforts.json "activities" expected a non-null object with at least one key, got an object with 0 keys`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

**6. One sampled shard — delete the file**
- Sampled id used: `i182358139`
- Break applied: `rm dist/widgets/data/stats/best-efforts/i182358139.json`
- EXIT line: `EXIT=1`
- Failure line: `✗ GET /data/stats/best-efforts/i182358139.json expected 200, got 404`
- Post-restore EXIT line: `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

Final restoration confirmation (25-03's own words): "After all six cycles: `npm run
build-widgets` then `npm run verify-dashboard` exits 0 with the same `56 check(s) passed, 0
failure(s).` total as the end of Task 1. `git status --porcelain data` is empty and `git status
--porcelain dist` is empty."

### From 25-04-SUMMARY.md — WR-19 mode-000-directory fixture, uncaught EACCES (D-11 precedent)

Task 1's fixture, run against the unfixed guard (before Task 2's change to
`curation-guard.mjs`), produced an UNCAUGHT throw — not a clean assertion mismatch:

```
FAIL scripts/lib/curation-guard.test.mjs > WR-14 — non-regular and unreadable entries are reported, never thrown > (f) mode-000 directory: reported via the readdir try/catch, citing EACCES (WR-19) — the directory-shaped sibling of case (c)
Error: EACCES: permission denied, scandir '/var/folders/lr/1kcx1pmd27sg98ghw6nmwf2m0000gn/T/curation-guard-wr14-AbMufq/wr19-locked-dir'
 ❯ walk scripts/lib/curation-guard.mjs:83:36
    81|
    82|  function walk(dir) {
    83|    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      |                                   ^
    84|      const entryPath = resolve(dir, entry.name);
 ❯ walk scripts/lib/curation-guard.mjs:101:9
 ❯ findCurationArtifacts scripts/lib/curation-guard.mjs:175:3
 ❯ scripts/lib/curation-guard.test.mjs:289:45

 Test Files  1 failed (1)
      Tests  1 failed | 21 passed | 1 skipped (23)
```

Exactly one test failed (the new fixture); all other cases in the file were unregressed.
`git diff --name-only` at that point showed only `curation-guard.test.mjs` modified —
`curation-guard.mjs` was untouched, per D-11's precedent that a guard only counts once observed
red against the unfixed code.

**Planted-directory `build-widgets` exit codes (fail-closed proof, real `dist/widgets` tree,
not a fixture/tmpdir):**

Before cleanup — exit 1, attributed:
```
✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-abc376340f858ac00/dist/widgets/wr19-negative-check — could not be listed (EACCES) — an unreadable directory cannot be certified free of the "__curate" marker
```
(confirmed via a separate `echo $?` capture: `REAL_EXIT_CODE=1`)

After `chmod 0700` + `rm -rf` cleanup — exit 0, clean:
```
✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.

Widget library build complete!
Output: dist/widgets/ (widgets, pages, and the dashboard SPA)
```
(`REAL_EXIT_CODE=0`)

Post-fix (Task 2): `npx vitest run scripts/lib/curation-guard.test.mjs` — 22 passed / 1 skipped
(the whole-tree regression test was skipped only because `dist/widgets/index.html` did not yet
exist at that point in the run).

## Wave 1 Integration Gate

Run on the fully-merged worktree (base commit `304afca9f0f18b863583cbfe0f0cdd32fde01311`, which
already carries plans 25-01 through 25-05). This worktree's own `node_modules/` and gitignored
`data/stats/`/`data/dashboard/` trees were empty on entry (a documented worktree-environment gap,
not a merge defect); `npm run build` + `node dist/index.js compute-all-stats` regenerated both
locally from the real archive before this gate ran, following the identical precedent recorded
in `25-03-SUMMARY.md`'s "Local data regeneration" decision. The one incidental side effect
(`data/geo/geo-metadata.json`'s `generatedAt` timestamp) was reverted with `git checkout --`
before any commit, identical to 25-03's own handling of the same side effect.

### The five commands, in order, on the regenerated tree

| # | Command | Exit code |
|---|---------|-----------|
| 1 | `npm test` | 0 |
| 2 | `npx tsc --noEmit` | 0 |
| 3 | `npm run build` | 0 |
| 4 | `npm run build-widgets` | 0 |
| 5 | `npm run verify-dashboard` | 0 |

`npm run verify-dashboard`'s final line: `56 check(s) passed, 0 failure(s).` — higher than the
40/40 recorded at the end of Phase 24 (16 net-new checks landed by plan 25-03's CI-02 work).

### Three consecutive `npm test` tallies (determinism check)

| Run | Test Files | Tests | Duration |
|-----|-----------|-------|----------|
| A | 62 passed (62) | 1596 passed (1596) | 6.89s |
| B | 62 passed (62) | 1596 passed (1596) | 6.89s |
| C | 62 passed (62) | 1596 passed (1596) | 6.65s |

All three identical, zero skipped, zero failed. (An earlier exploratory run against the
worktree's pre-regeneration state — main-repo `node_modules`/`data` symlinked in rather than
regenerated locally — also tallied 62 files / 1596 tests but with 1 file / 11 tests skipped,
because `dist/widgets/index.html` did not yet exist for
`verify-dashboard-publish-guard.test.mjs`'s `skipIf` guard; that skip cleared once
`build-widgets` ran, and is not evidence of nondeterminism in the three consecutive runs quoted
above, which were all taken after `dist/widgets` existed.)

### Tally reconciliation against the 60/1560 pre-planning baseline

**File count: 60 → 62, a delta of exactly +2**, matching the two new test files wave 1 created:
- `src/compute-all-stats-steps.test.ts` (plan 25-02)
- `src/dashboard/theme-bootstrap-parity.test.ts` (plan 25-05)

**Test count: 1560 → 1596, a delta of +36, fully attributed to four plans:**

| Plan | Attribution | Test delta |
|------|-------------|-----------|
| 25-01 | 8 new regression cases in `gear-aggregate-logic.test.ts` (4 shapes × 2 functions) | +8 |
| 25-02 | `src/compute-all-stats-steps.test.ts` — new file, 10 tests | +10 |
| 25-04 | `curation-guard.test.mjs` — 1 new mode-000-directory fixture case (f); file went from 22 tests (21 passed + 1 skipped, confirmed by the RED-cycle tally `1 failed \| 21 passed \| 1 skipped (23)` in the D-11 log above, which already includes the new case) to 23 tests total | +1 |
| 25-05 | `src/dashboard/theme-bootstrap-parity.test.ts` — new file, 17 tests (16 original + 1 structural assertion added mid-plan to close the Mutation B blind spot) | +17 |
| **Total** | | **+36** |

`8 + 10 + 1 + 17 = 36` — matches the observed delta exactly. **No unexplained delta in either
direction.** Plan 25-03 (CI-02) contributes 0 to this tally: its six new assertions live in
`scripts/verify-dashboard-publish.mjs`, exercised by `npm run verify-dashboard`, not by
`npm test`/vitest.

`git status --porcelain data` was empty at the end of this gate — confirmed both immediately
after the five-command run and again after the incidental `geo-metadata.json` revert.

## CI-01 live run evidence — blocked

Plan 25-06's Task 2 (dispatch a real `gh workflow run "Daily Widget Refresh"` and record the
collapsed compute step's log) was **not executed**, and is recorded here as a blocker rather
than fabricated or attempted under pressure, per this project's house rule since plan 16-09.

**Why:** this plan is executing inside a `worktree-agent-*` isolated git worktree (per the GSD
parallel-execution architecture), not in the orchestrator's local `master` checkout. Task 2's own
instructions require, in order: (1) pushing the wave-1 work to `origin/master`, confirming the
pushed copy of `daily-refresh.yml` before dispatch, and (2) dispatching the workflow via
`gh workflow run`. Both steps were examined and found to cross a boundary this isolated
worktree agent should not cross unilaterally:

1. **`git push` to `origin/master` from a worktree-agent branch is not a like-for-like
   substitute for "push the merged tree."** `git merge-base --is-ancestor 304afca9…
   origin/master` returns false — `origin/master` has already advanced two auto-commits ahead
   (`fb0960a4`, `62304636`, both nightly `chore: update activities and stats [skip ci]` commits)
   of the commit this worktree branched from, and this worktree's own commits (25-06 Task 1, this
   file) have not yet been merged into the orchestrator's local `master` by the wave-3 merge step,
   let alone pushed to `origin/master`. Pushing this worktree's branch HEAD onto `origin/master`
   directly would promote an intermediate, single-plan worktree state to production ahead of the
   orchestrator's own merge-back and wave completion, out of order with the rest of wave 3.

2. **`daily-refresh.yml`'s `Deploy widgets to GitHub Pages` and `Commit updated data and stats`
   steps carry no branch guard** (`grep -n "if:\|github.ref" .github/workflows/daily-refresh.yml`
   returns only the two `Warn on *` conditionals — neither the deploy step nor the auto-commit
   step is conditioned on `github.ref == 'refs/heads/master'`). A `workflow_dispatch` run
   against ANY ref — including a `worktree-agent-*` branch pushed under a different name —
   still deploys to the live production Pages site (`bacilo.github.io/strava-widgets`) and
   still commits data back to `origin`. There is no safe, side-effect-free way to dispatch this
   specific workflow from an unmerged worktree state; the "dispatch against a non-master ref to
   avoid touching master" mitigation does not exist for this workflow as currently written.

**Disposition:** recorded as a gap for the phase, per this plan's own governing rule (Task 2's
`<action>`: "If the run FAILS, that is a real finding for this phase... report it in the SUMMARY
as a gap for `/gsd-plan-phase 25 --gaps`"). This is treated identically — a real, structural
finding, not a code defect, surfaced by running the plan inside the wave-3 parallel-worktree
architecture. **Recommended resolution:** after this wave's worktree branches are merged back
into the orchestrator's local `master` (the normal wave-3 merge step) and `origin/master` is
confirmed to carry `compute-all-stats --ci`, the orchestrator (or a follow-up single-context
execution, not a parallel worktree) should perform Task 2's `gh workflow run` dispatch and
transcribe the evidence into this section, replacing this blocker note. The unit-level half of
D-03/CI-01 (this table's own `25-02-T2` rows, `src/compute-all-stats-steps.test.ts`) is fully
green and independent of this blocker — only the live-Actions-log half is outstanding.

## Checkpoint Row Discipline (inherited precedents — non-negotiable)

This phase's checkpoint rows have a documented failure history in this repo. Three rules carry forward:

1. **A guard only counts once observed RED** (Phase 24 D-11). Applies to all six CI-02 assertions and to WR-19's new fixture. GAP-24-02 existed precisely because a guard's blind spot was never observed failing.
2. **Rows assert reachable extent against an independently-derived value, never internal agreement** (Phase 23 CR-01, Phase 24 R32). D-04's quoted storage read (`null` or `'auto'`, never `'light'`/`'dark'`, as amended 2026-09-03) and D-05's dark-OS framing exist to give VER-01's rows a real discriminator.
3. **HALT before presenting a row whose discriminator is unreachable** (Phase 24 § "Round 4 Checkpoint (R32-R35)"). A row's own mandated setup can empty the thing it exists to test — check reachability before blaming the code. VER-01's first-paint row is the live instance: as literally worded it is vacuous, which is why D-05 reframes it.

---

## Round 1 Checkpoint (R1-R6)

*(plan 25-07 — rows drafted by Task 1 on 2026-09-04; RUN by Task 2 on 2026-09-04, 11:05–11:47 UTC.
Every Verdict cell below is now scored. Outcome: R1, R3, R4, R5 PASS; R2 and R6 BLOCKED.)*

**Round outcome in one line:** four of six rows PASS; **R2 is BLOCKED on capture fidelity** (a
frame strictly earlier than first paint could not be obtained on this hardware/tooling) and **R6
is BLOCKED on missing evidence** (CI-01's live-run dispatch was never performed). Under the
governing all-rows-PASS rule this withholds **all four** requirements — see Task 3's disposition
and GAP-25-01 / GAP-25-02 below.

**Target:** `https://bacilo.github.io/strava-widgets/` (D-08). Hard reload after every change; this
repo has a documented history of a stale cached `index.html` producing false evidence (T-25-21).

**Cleared-site-data procedure (concrete, to be used for every row that requires it):** Chrome
DevTools → Application panel → Storage section → the "Clear site data" button, invoked while the
production origin `https://bacilo.github.io` is the active tab, which clears localStorage,
sessionStorage, cookies and cache-storage for that origin in one action. Confirmed cleared by
reading `localStorage.getItem('dashboard-theme')` immediately afterward and observing `null`
(pre-load) before the subsequent hard reload writes `'auto'` (see the D-04 amendment disclosure
below). A fresh browser profile is the accepted alternative where "Clear site data" is unavailable
(e.g. a sandboxed devtools context); whichever is used is named in the row's own evidence at the
time it is run, not assumed here.

**Execution split (D-07, hybrid):** the developer performs every System Settings appearance
change and every legibility/first-frame human judgment; the agent performs every instrumentation
read (`localStorage.getItem`, `matchMedia(...).matches`, `data-theme`, the navigation-timing
check, the hashed-asset check) and the first-frame capture. `osascript`-driven appearance
switching is rejected for any recorded row.

### D-04 amendment disclosure (required, non-optional — same weight as R2's D-05 disclosure)

- **D-04's ORIGINAL wording** (`25-CONTEXT.md`, pre-amendment): every row must quote
  `localStorage.getItem('dashboard-theme')` at the instant of observation and the quoted value
  must be a literal `null`.
- **Why that was unreachable:** `src/dashboard/main.ts:29` runs
  `applyThemeMode(readStoredMode(resolveStorage()))` at module scope, unconditionally, with no
  options, on every load — including the first load of a freshly-cleared profile. `applyThemeMode`
  (`theme.ts:113-133`) defaults `persist` to `true` (`theme.ts:118`) and, when persisting, calls
  `storage.setItem(THEME_STORAGE_KEY, mode)` (`theme.ts:126`). Because `readStoredMode(null-ish
  storage or an empty key)` returns `'auto'` (`theme.ts:72-79`, via `parseThemeMode`'s fallback at
  `theme.ts:41`), the value module-scope `applyThemeMode` writes back is `'auto'` — before any
  DevTools read is possible. `src/dashboard/index.html:36-54`'s inline bootstrap only calls
  `localStorage.getItem` (line 41); it never calls `setItem` and is therefore not the writer. A
  literal `null` is consequently unobtainable on a correctly-functioning page, and the original
  wording would have scored a working implementation BLOCKED.
- **Why `null`-or-`'auto'` preserves the intent exactly, rather than weakening it:**
  `parseThemeMode(null)` returns `'auto'` (`theme.ts:41`), and the live-follow listener in
  `watchSystemTheme` gates its callback on `readStoredMode(storage) === 'auto'` (`theme.ts:171`),
  which holds identically whether the stored raw value is absent (`null`) or literally `'auto'`.
  What D-04 actually needs to establish is that the in-page toggle control has not overridden the
  OS setting — and that is a statement about `'light'`/`'dark'` (the two values `cycleThemeMode`,
  `theme.ts:55`, can leave behind), not about `null`. The amended discriminator therefore still
  catches exactly the failure mode D-04 exists to catch, while accepting the value a working page
  actually produces.
- **Disclosure statement:** this amendment was approved by the developer during plan-check
  (`25-CONTEXT.md` § D-04, "AMENDED 2026-09-03") and is applied here, in the open, not quietly
  substituted. Every row below that quotes `dashboard-theme` treats `null` and `'auto'` as the
  single PASS-compatible class and `'light'`/`'dark'` as BLOCKED.

### Sequencing constraint (non-negotiable for the whole round)

**The in-page theme toggle control must never be clicked during Round 1.** This is NOT because
touching it writes to `dashboard-theme` — the page writes `'auto'` there itself on every load
regardless (`main.ts:29`, see the D-04 disclosure above). It is because `cycleThemeMode`
(`theme.ts:55`) cycles `light -> dark -> auto`, and a toggle click that lands the control on an
explicit `'light'` or `'dark'` mode is exactly the state that makes `readStoredMode` short-circuit
the OS consultation R1-R4 all exist to observe. (A toggle clicked an exact multiple of three times
would land back on `'auto'` and be invisible to this constraint by coincidence — the check the
rows actually make is on the observed VALUE at read time, not on a "never touched" pledge alone.)

### Reachability proof (required before presenting any row, per Checkpoint Row Discipline rule 3)

- **R1/R2 — already established at plan-check time; not re-derived here.** As shown in the D-04
  disclosure above, `main.ts:29`'s unconditional, options-free `applyThemeMode(readStoredMode(...))`
  call persists `'auto'` on every load, including the very first load of a freshly-cleared
  profile, before any DevTools read can happen. A literal `null` is therefore never observable on
  a working page — which is exactly why D-04 was amended to accept `null` OR `'auto'`. The
  discriminator these two rows read (`dashboard-theme` quoted as `null`/`'auto'` vs `'light'`/
  `'dark'`) is reached by simply loading the cleared-storage page; it is not emptied by either
  row's own setup. A quoted `'light'` or `'dark'` is the failure signal, not evidence the row is
  unreachable.
- **R3/R4 — is the effective mode still `'auto'` at the moment of the OS change?** Yes: the page's
  own module-scope load writing `'auto'` (per the D-04 mechanism above) is fine and expected — it
  is exactly the state R3/R4 need. What WOULD empty this discriminator is an explicit `'light'`/
  `'dark'` left behind by a toggle click. The Sequencing constraint above removes that risk by
  construction: the rows are ordered R1 (light OS, load, read, DO NOT touch toggle) -> R2 (dark OS,
  fresh clear, load, read, DO NOT touch toggle) -> R3 (light OS, fresh clear, load, read, then OS
  change to dark with page untouched and unreloaded) -> R4 (OS change back to light, page still
  untouched and unreloaded) -> R5/R6 (no further OS or storage interaction). No row's setup
  requires touching the toggle, so the discriminator stays live for all four rows.
- **R2 — is a first frame actually capturable on this hardware, and can it be attributed to
  pre-paint rather than post-load?** Capture method: the agent will use a screen/window capture
  triggered immediately before the hard-reload keystroke/action and sampled at the earliest
  available frame after navigation start, cross-checked against
  `performance.getEntriesByType('paint')` (specifically `first-paint`/`first-contentful-paint`
  timing) read back from the same page load, so the captured frame can be tied to a timestamp
  before or at first paint rather than an arbitrary later frame. If the capture tooling cannot
  produce a frame earlier than first paint on this hardware, that limitation will be disclosed in
  the row's own write-up rather than presented as a clean capture — the row is reachable in
  principle (dark OS + cleared storage does not empty the discriminator), but the CAPTURE
  mechanism's fidelity is a separate, disclosed concern.

None of R1-R5's discriminators is emptied by its own mandated setup. No HALT is required; all six
rows are presented below.

### Round 1 rows

| Row | Verdict | Discriminator | Decisive evidence |
|-----|---------|----------------|-------------------|
| R1 | **PASS** | `data-theme === 'light'` while `dashboard-theme` is `null`/`'auto'`, on a light OS | `'auto'` / `false` / `'light'` quoted at `11:05:52.180Z`, re-quoted unchanged at `11:06:51.925Z`; developer: *"looked at all 4. Legible. Toggle is visible."* |
| R2 | **BLOCKED** | Captured first frame's background: `#1a1a2e` = PASS, white = FAIL | Instrumentation clean (`'auto'` / `true` / `'dark'`, `body_bg rgb(26,26,46)`), but **both captured frames landed ~243 ms AFTER `first-paint`** (nav start `1788520780021.8`; first-paint `+612 ms`; frames saved `1788520781489`/`1788520781492`). Not the evidence the row required. |
| R3 | **PASS** | Both `matchMedia(...).matches` and `data-theme` flip while `dashboard-theme` stays `null`/`'auto'`, no reload | `false`→`true`, `'light'`→`'dark'`, `rgb(255,255,255)`→`rgb(26,26,46)`; `timeOrigin` identical `1788520516982.4`, `nav_entries_count: 1`. Hidden-tab lag disclosed below. |
| R4 | **PASS** | Same three quotes flip back, no reload | `true`→`false`, `'dark'`→`'light'`, `rgb(26,26,46)`→`rgb(255,255,255)`; `timeOrigin` identical `1788520780021.8`, `nav_entries_count: 1`. Same hidden-tab lag disclosed below. |
| R5 | **PASS** | Hashed asset matches deployment; cache-busted refetch byte-identical | `index-D-Ts7X8C.js` in live DOM, served HTML, and cache-busted refetch; SHA-256 `33fa42bd…37fa1` both, 3169 bytes both; matches `origin/gh-pages` @ `b2b05a4`. |
| R6 | **BLOCKED** | Restates 25-06's three recorded evidence items | Clauses 1–2 present and green (five commands exit 0; `56 check(s) passed, 0 failure(s).`); **clause 3 absent** — no `gh workflow run` dispatch was ever performed (§ "CI-01 live run evidence — blocked"). |

**R1 — Light-OS legibility (VER-01, criterion 4, clause 1).**
Setup: developer sets macOS Appearance to LIGHT. Clear site data for
`https://bacilo.github.io` (or use a fresh profile). Hard reload. Do NOT touch the theme toggle.
Discriminator: `document.documentElement.getAttribute('data-theme') === 'light'` WHILE
`localStorage.getItem('dashboard-theme')` is `null` OR `'auto'` (D-04 as amended — a quoted
`'light'` or `'dark'` means the in-page control is overriding the OS, and the row is recorded
BLOCKED, not PASS). Both values are quoted at the same instant of observation. Also quote
`matchMedia('(prefers-color-scheme: dark)').matches` (expected `false`).
Developer judgment required: legibility (readable text/background contrast) on Overview,
Activities, Records and Trends, no white-on-white or dark-on-dark region, and the theme toggle
control itself visible (the Phase 16 GAP 2 / plan 16-11 defect class).
Verdict: **PASS**.

*Cleared-site-data procedure actually used (named at run time, as the section's procedure note
requires):* the scripted equivalent of DevTools → Application → Clear site data, executed against
the production origin — `localStorage.clear()`, `sessionStorage.clear()`, every `CacheStorage` key
deleted, every cookie expired. Confirmed cleared before the reload:
`localStorage.getItem('dashboard-theme')` → `null`, `localStorage.length` → `0`,
`cache_keys_remaining` → `0`, `document.cookie` → `""`. Then a genuine hard reload (⌘⇧R).

*Agent instrumentation, all four values quoted at one instant (`2026-09-04T11:05:52.180Z`) and
re-quoted unchanged after the four-section walk (`11:06:51.925Z`):*

| Read | Value |
|------|-------|
| `localStorage.getItem('dashboard-theme')` | `'auto'` — PASS-compatible class per D-04 as amended |
| `matchMedia('(prefers-color-scheme: dark)').matches` | `false` |
| `document.documentElement.getAttribute('data-theme')` | `'light'` |
| `performance.getEntriesByType('navigation')[0].type` | `'reload'` |
| computed `body` background / colour | `rgb(255, 255, 255)` / `rgb(51, 51, 51)` |

Full `localStorage` dump at the instant of observation: `{"dashboard-theme":"auto"}` — the theme
toggle was never clicked, so no explicit `'light'`/`'dark'` could have been left behind.

*Developer judgment, recorded VERBATIM:* "looked at all 4. Legible. Toggle is visible."
The granularity given is exactly that: the developer confirms having looked at all four sections
(Overview, Activities, Records, Trends) and reports legibility and toggle visibility. No per-section
detail beyond that was given, and none is invented here (plan 19-09 precedent).
Screenshots: `screenshot-1788519961899-0.jpg` (Overview), `-1.jpg` (Activities), `-2.jpg` (Records),
`-3.jpg` (Trends).

*Observation raised by the developer, recorded as a question and NOT as a defect:* "Toggle is
'sun' when light and 'moon' when dark. Indicating the current state. This is totally fine with my
but wondering whether common practice would be the opposite (indicating 'touch here to go
dark/light')." The developer explicitly framed this as a question, not a fault. Both conventions
are in common use; nothing was changed in response (house rule since plan 16-09 — no fix under
checkpoint pressure). Logged as a deferred item, not a row failure, and it does not affect this
row's PASS.

*Appearance-change provenance for this row:* NONE was required. The machine was already in LIGHT
appearance when the round began (`defaults read -g AppleInterfaceStyle` → key absent, i.e. Light).
This is disclosed rather than presented as a developer-performed flip.

**R2 — First-paint flash (VER-01, criterion 4, clause 2).**
**Disclosure — deliberate deviation from criterion 4's literal wording (D-05), stated here in the
open rather than substituted quietly:** criterion 4's literal wording asks that "on a genuinely
light-OS machine ... [the dashboard] shows no first-paint white flash." As worded, this row would
be vacuous on a light OS: `src/dashboard/styles.css:18` sets light `--bg: #ffffff`, so on a light
OS a white first paint IS the correct final state, and the row could not distinguish a working
pre-paint theme from a broken one (the same defect class as Phase 24's R19/R26 — the row's own
mandated precondition would render identically to its own failure state). D-05 therefore observes
this row with the OS in DARK appearance instead: `styles.css:105` sets dark `--bg: #1a1a2e`, so on
a dark OS a white first frame is an unambiguous failure and `#1a1a2e` is an unambiguous pass.
Setup: developer sets macOS Appearance to DARK. Clear site data. Hard reload while the agent
captures the first painted frame (see Reachability proof above for the capture method). Do NOT
touch the theme toggle.
Discriminator: the captured first frame's background colour — `#1a1a2e` is PASS, white is FAIL —
plus the same `dashboard-theme` (`null`/`'auto'`, D-04 as amended) and `data-theme` (`'dark'`)
quotes as R1.
Verdict: **BLOCKED**.

BLOCKED is used here in its strict sense per this section's vocabulary — *evidence that was not
the evidence the row required*. It is **not** a softer PASS, and nothing below should be read as
one.

*Setup as performed:* the developer set macOS Appearance to DARK by their own hand (D-07).
Storage cleared by the same scripted procedure as R1 (`dashboard-theme` → `null`,
`localStorage.length` → `0`, all `CacheStorage` keys deleted, `prefers_dark` → `true` confirmed
pre-reload). Hard reload (⌘⇧R) issued with screenshot capture batched immediately behind it.

*Instrumentation — all clean, and none of it is the problem:*

| Read | Value |
|------|-------|
| new document confirmed (prior `window` state wiped) | `true` |
| `performance.timeOrigin` | `1788520780021.8` |
| `localStorage.getItem('dashboard-theme')` | `'auto'` |
| `matchMedia('(prefers-color-scheme: dark)').matches` | `true` |
| `document.documentElement.getAttribute('data-theme')` | `'dark'` |
| `performance.getEntriesByType('navigation')[0].type` | `'reload'` |
| computed `body` background | `rgb(26, 26, 46)` = `#1a1a2e` |
| `first-paint` / `first-contentful-paint` | both `612` ms |
| `responseEnd` / `domInteractive` / `loadEventEnd` | `239.6` / `287.9` / `510` ms |

*Why the row is BLOCKED — the capture-fidelity arithmetic, stated explicitly:* navigation started
at `timeOrigin` `1788520780021.8`; first paint occurred `612 ms` later, at wall-clock
`1788520780633.8`. The two frames actually captured were saved at `1788520781489` and
`1788520781492` — roughly `855`/`858 ms` after navigation start, i.e. **~243 ms AFTER first
paint had already happened**. Both frames show the dark `#1a1a2e` background, which is
*consistent with* no flash but **cannot discriminate one**, because any first-paint flash would
have ended before the shutter opened. The browser-extension screenshot round-trip is the floor on
this hardware and tooling, and it could not be beaten; this is exactly the limitation the Task 1
reachability proof anticipated and pre-authorised disclosing ("If the capture tooling cannot
produce a frame earlier than first paint on this hardware, that limitation will be disclosed in
the row's own write-up rather than presented as a clean capture").
Frames, retained for audit: `screenshot-1788520781489-5.jpg`, `screenshot-1788520781492-6.jpg`.

*What was offered as an alternative and deliberately NOT accepted as a substitute:* an ordering
argument — the inline pre-paint bootstrap is a synchronous `<head>` script and therefore completed
by `domInteractive` = `287.9 ms`, `324 ms` before `first-paint` = `612 ms`, and plan 25-05's
`node:vm` behavioural parity pin independently proves that script's logic. That is *inference from
timing and from a unit-level pin*, not the *observation* criterion 4 asks for. It is recorded here
for completeness and explicitly rejected as a basis for PASS.

*Disposition provenance:* the three available dispositions (BLOCKED; PASS-with-disclosed-
limitation on the strength of the ordering argument; or attempt an iframe-proxy capture first)
were put to the developer explicitly, together with the consequence that BLOCKED withholds every
requirement and shuts the phase gate. The developer chose **BLOCKED**. The verdict is the
developer's, not the agent's.

*D-05 disclosure:* present in this row's drafted text above (the dark-OS framing is disclosed as a
deliberate deviation from criterion 4's literal wording, not quietly substituted). Its presence is
confirmed by Task 3.

**R3 — Live-follow light -> dark (VER-01, criterion 4, clause 3).**
Setup: developer sets macOS Appearance to LIGHT, clears site data, hard-reloads one final time.
With the page loaded and untouched (theme toggle NOT clicked), the agent quotes
`matchMedia('(prefers-color-scheme: dark)').matches` (expect `false`), `data-theme` (expect
`'light'`) and `dashboard-theme` (expect `null`/`'auto'` — D-04 as amended; a quoted `'light'`/
`'dark'` here means the toggle was touched or storage was not actually cleared, and BLOCKS the
row). The developer then changes Appearance to DARK in System Settings with the page still open
and NOT reloaded. The agent re-quotes all three values (`true`, `'dark'`, `null`/`'auto'`) plus
`performance.getEntriesByType('navigation')[0].type` at both instants, to prove no reload happened
between the two readings.
Discriminator: `matchMedia(...).matches` and `data-theme` both flip (`false`->`true`,
`'light'`->`'dark'`) with `dashboard-theme` remaining `null`/`'auto'` throughout and no reload
recorded — because the listener in `watchSystemTheme` (`theme.ts:167-183`) gates on
`readStoredMode(storage) === 'auto'` (`theme.ts:171`), which holds identically for `null` and
`'auto'`; a quoted `'light'`/`'dark'` at either instant makes the row vacuous and BLOCKED, per the
D-04 amendment.
Verdict: **PASS** — with an observation caveat disclosed below, not smoothed over.

*BEFORE* (`2026-09-04T11:15:26.832Z`) — light OS, storage cleared (`null` confirmed pre-reload),
hard-reloaded, toggle untouched:
`dashboard-theme` = `'auto'`, `matchMedia('(prefers-color-scheme: dark)').matches` = `false`,
`data-theme` = `'light'`, `nav.type` = `'reload'`, `timeOrigin` = `1788520516982.4`,
computed `body` background = `rgb(255, 255, 255)`, full `localStorage` dump
`{"dashboard-theme":"auto"}`.

*The developer then set macOS Appearance to DARK in System Settings by their own hand* (D-07), with
the page still open, not reloaded and the toggle untouched. No `osascript` was used.

*AFTER, reading 2* (`11:19:06.411Z`) — same document:
`dashboard-theme` = `'auto'`, `matchMedia(...).matches` = `true`, `data-theme` = `'dark'`,
`nav.type` = `'reload'`, `timeOrigin` = `1788520516982.4`, computed `body` background =
`rgb(26, 26, 46)` = `#1a1a2e`, full `localStorage` dump `{"dashboard-theme":"auto"}`.
Screenshot: `screenshot-1788520733645-4.jpg` (dark chrome; toggle glyph now a moon).

*No-reload proof:* `timeOrigin` is byte-identical (`1788520516982.4`) across the BEFORE reading and
every AFTER reading; `performance.getEntriesByType('navigation').length` = `1`; the same document
had been alive for `229433.7 ms` at the final reading. A reload would have produced a new
`timeOrigin` and wiped the `window.__R3_BEFORE__` handle used to carry the BEFORE values — neither
happened. The discriminator held in both required respects: both `matchMedia(...).matches` and
`data-theme` flipped, and `dashboard-theme` remained in the `null`/`'auto'` class at both instants,
so `watchSystemTheme`'s `readStoredMode(storage) === 'auto'` gate (`theme.ts:171`) was live
throughout and the row is not vacuous.

*CAVEAT — recorded as observed, not smoothed over.* Two intermediate readings were taken while the
Chrome tab was backgrounded (`document.visibilityState` = `"hidden"`, `document.hasFocus()` =
`false`), because the developer was in System Settings performing the flip:

| Instant | `prefers_dark` | `data-theme` | `body` background | tab state |
|---------|----------------|--------------|-------------------|-----------|
| `11:18:13.265Z` (+~166 s) | `true` | `'light'` | `rgb(255,255,255)` | `hidden` |
| `11:18:36.979Z` (+~190 s) | `true` | `'light'` | `rgb(255,255,255)` | `hidden` |
| `11:19:06.411Z` (+~219 s) | `true` | `'dark'` | `rgb(26,26,46)` | foregrounded |

So for a period after the OS flip, `matchMedia(...).matches` already read `true` (it evaluates
freshly on each read) while `data-theme` still read `'light'` and the computed background was still
white; the DOM caught up once the tab was brought to the foreground. The most likely mechanism is
Chrome deferring style recalculation and media-query change dispatch for hidden tabs — a browser
scheduling behaviour, not an application defect, and not something this round attempted to fix
(house rule since plan 16-09). It is recorded because a future round should not be surprised by it.
**A future round wanting to eliminate this confound entirely should keep the tab foregrounded
across the OS flip** (second display, or a side-by-side window arrangement), so that the
before/after readings are both taken from a visible document. This caveat does not change the
verdict: the transition demonstrably completed within the same document with no reload, which is
what criterion 4 clause 3 asks for.

**R4 — Live-follow dark -> light (the "and back" half of criterion 4).**
Same shape as R3, page still open from R3, NOT reloaded, theme toggle NOT clicked at any point.
Setup: developer changes Appearance back to LIGHT in System Settings.
Discriminator: same three quotes as R3, expected to flip back (`true`->`false`, `'dark'`->
`'light'`), `dashboard-theme` still `null`/`'auto'` throughout. Kept as a separate row from R3
rather than folded in, because "and back" is a distinct transition and the listener could
plausibly fire in one direction only.
Verdict: **PASS** — with the same disclosed caveat as R3.

*BEFORE* (`2026-09-04T11:20:26.374Z`) — dark OS, page as left by R2's cleared-storage hard reload,
toggle untouched:
`dashboard-theme` = `'auto'`, `matchMedia(...).matches` = `true`, `data-theme` = `'dark'`,
`nav.type` = `'reload'`, `timeOrigin` = `1788520780021.8`, computed `body` background =
`rgb(26, 26, 46)`, full `localStorage` dump `{"dashboard-theme":"auto"}`.

*The developer then set macOS Appearance back to LIGHT in System Settings by their own hand*
(D-07), page still open, not reloaded, toggle untouched. No `osascript` was used.

*AFTER, reading 2* (`11:46:44.187Z`) — same document:
`dashboard-theme` = `'auto'`, `matchMedia(...).matches` = `false`, `data-theme` = `'light'`,
`nav.type` = `'reload'`, `timeOrigin` = `1788520780021.8`, computed `body` background =
`rgb(255, 255, 255)`, full `localStorage` dump `{"dashboard-theme":"auto"}`.
Screenshot: `screenshot-1788522394407-7.jpg` (light chrome; toggle glyph back to a sun).

*No-reload proof:* `timeOrigin` byte-identical (`1788520780021.8`) across BEFORE and both AFTER
readings; `performance.getEntriesByType('navigation').length` = `1`; same document alive for
`1624161.0 ms` at the final reading.

*Same caveat as R3:* the first AFTER reading (`11:46:26.468Z`, `visibilityState` = `"hidden"`,
`hasFocus` = `false`) showed `prefers_dark` already `false` while `data-theme` still read `'dark'`
and the background was still `rgb(26,26,46)`; the DOM caught up on foregrounding. Same mechanism,
same disposition — recorded, not patched.

Kept as a separate row from R3 rather than folded in, as drafted: the reverse transition fired
independently, so the listener is demonstrated to work in **both** directions, which a single
folded row could not have established.

**R5 — Cache-trap exclusion (D-08).**
Setup: no further OS or storage change; runs against the same loaded page state as R4 (or a fresh
hard reload if needed to re-establish a clean read).
Discriminator: the served `index.html`'s hashed module-script filename, quoted and shown to match
the asset in the latest deployed build; `performance.getEntriesByType('navigation')[0].type ===
'reload'`; and a cache-busted refetch of `index.html` (e.g. `fetch('./index.html?cachebust=' +
Date.now())`) shown byte-identical to the document the browser actually used. This repo has a
documented history of a stale cached `index.html` producing false evidence (T-25-21).
Verdict: **PASS**.

*Asset identity, all three sources agreeing:*

| Source | Hashed module script |
|--------|----------------------|
| Live DOM (`script[type=module][src]`) | `./assets/index-D-Ts7X8C.js` |
| Served `index.html` the browser actually used | `./assets/index-D-Ts7X8C.js` |
| Cache-busted refetch (`?cachebust=<Date.now()>`, `cache: 'reload'`) | `./assets/index-D-Ts7X8C.js` |

*Byte-identity of the document itself:* SHA-256 of the served `index.html` =
`33fa42bdef7c6e3eec76b8fffb35041a45f4f60e004391647a17384415137fa1`; SHA-256 of the cache-busted
refetch = the same value; `3169` bytes each; equality asserted programmatically
(`byte_identical: true`). `performance.getEntriesByType('navigation')[0].type` = `'reload'`.

*Independently-derived value the row is checked against* (not internal agreement — Checkpoint Row
Discipline rule 2): the latest deployed build on `origin/gh-pages` @
`b2b05a4054e4f12c7a1fe29448779f11f74dd973`, deployed `2026-09-04 09:10:40 +0000`, contains
`assets/index-D-Ts7X8C.js` per `git ls-tree -r --name-only origin/gh-pages`. The browser's asset
and the deployed tree's asset are the same file. The documented stale-cache trap (T-25-21) is
excluded.

*DISCLOSURE — production is not built from local `master`, and this is stated rather than buried.*
That deployment was built from source commit `623046363f7c86812e3d2aaa907bbf67e7d74f02`, which is
`origin/master`'s HEAD. Local `master` is **ahead** of it: Phase 25's commits are not pushed, so
the production site does **not** contain Phase 25's work. This does not weaken R1–R4, because
`git diff 623046363f7c86812e3d2aaa907bbf67e7d74f02..master -- src/dashboard/theme.ts
src/dashboard/index.html src/dashboard/styles.css src/dashboard/main.ts` is **empty** — every file
governing the behaviour under test is identical between the deployed build and the working tree.
Phase 25 touched analytics, the CI workflow, scripts and tests, not the theme path. The rows
therefore observed the same theme code that the working tree contains. This is disclosed so that a
future reader does not mistake "verified against production" for "verified against local master".

**R6 — Automated-half confirmation (criterion 5, items 1-3).**
Not a re-run. This row restates plan 25-06's already-recorded evidence — the green five-command
gate (`npm test`, `npx tsc --noEmit`, `npm run build`, `npm run build-widgets`, `npm run
verify-dashboard`, all exit 0 on the merged tree per `25-VALIDATION.md` § "Wave 1 Integration
Gate"), the `verify-dashboard` check count (`56 check(s) passed, 0 failure(s).`), and CI-01's
disposition. **CI-01's live-run half is NOT included** — `25-06-SUMMARY.md` and this file's own §
"CI-01 live run evidence — blocked" record that plan 25-06's Task 2 (`gh workflow run` dispatch)
was not executed because this repo's Phase-25 wave-3 work ran inside an isolated
`worktree-agent-*` worktree that could not safely push to `origin/master` or dispatch a
workflow with production side effects ahead of the orchestrator's own merge-back. That gap is
recorded, not closed, and is carried into this row's verdict rather than silently treated as
resolved.
Verdict: **BLOCKED**.

The row as specified restates **three** recorded evidence items. Two are present and green; the
third does not exist.

| Clause | Required evidence | Status |
|--------|-------------------|--------|
| 1 | Green five-command gate | **PRESENT** — `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run build-widgets`, `npm run verify-dashboard`, all exit `0` (§ "Wave 1 Integration Gate") |
| 2 | `verify-dashboard` check count | **PRESENT** — `56 check(s) passed, 0 failure(s).`, up from 40/40 at the end of Phase 24 (16 net-new checks from plan 25-03's CI-02 work) |
| 3 | Dispatched workflow run id + conclusion | **ABSENT** — no `gh workflow run` dispatch was ever performed; § "CI-01 live run evidence — blocked" records why |

A row cannot be PASS while one of its own three mandated evidence items does not exist, so this row
is **BLOCKED**.

*Explicitly NOT done, and recorded so the choice is auditable:* R6 was **not** split into R6a/R6b/
R6c to let clauses 1 and 2 tick FIX-02 and CI-02 independently of clause 3's absence. Redesigning a
row mid-round so that it yields a tick is precisely the failure mode Checkpoint Row Discipline
rule 3 and the Phase 24 R19/R26 precedent exist to prevent. The row was drafted as one row before
the outcome was known, and it is scored as one row now that the outcome is known. A future round
may legitimately draft three separate rows — **before** running them — and GAP-25-02 records that
as the recommended shape.

*Also not done:* the agent did **not** push local `master` to `origin/master` and dispatch the
workflow itself to manufacture clause 3's evidence during the checkpoint. That would have been a
production-affecting action (§ "CI-01 live run evidence — blocked" documents that
`daily-refresh.yml`'s deploy and auto-commit steps carry no branch guard, so any dispatch deploys
to the live Pages site and commits data back to `origin`) taken under checkpoint pressure, against
the house rule since plan 16-09. It is left for a deliberate, separately-authorised step — see
GAP-25-02.

### Execution provenance (D-07) — who did what, disclosed rather than presented as one round

Following the Phase 24 R34 / plan 24-08 provenance-disclosure precedent, the round is not presented
as one undifferentiated block of work.

**Performed by the developer's own hand:**
- Set macOS Appearance to **DARK** in System Settings (between R3's BEFORE and AFTER readings).
- Set macOS Appearance back to **LIGHT** in System Settings (between R4's BEFORE and AFTER readings).
- The R1 legibility and toggle-visibility judgment, recorded verbatim.
- The R2 disposition decision (BLOCKED), chosen from three explicitly-stated options with the
  consequence — that BLOCKED withholds all four requirements — stated before the choice was made.

**Performed by the agent (instrumentation only):**
- All site-data clearing and all hard reloads (⌘⇧R).
- Every quoted read: `localStorage.getItem('dashboard-theme')`, `matchMedia('(prefers-color-scheme:
  dark)').matches`, `document.documentElement.getAttribute('data-theme')`,
  `performance.getEntriesByType('navigation')[0].type`, `performance.timeOrigin`, computed
  background/colour, paint timings.
- All frame captures and section screenshots.
- R5's hashed-asset, cache-busted-refetch and deployed-tree checks.
- R6's citation of plan 25-06's recorded evidence.

**`osascript` was NOT used to change appearance for any recorded row** (D-07), and no appearance
change was simulated, emulated, or performed via DevTools rendering overrides.

**Disclosed deviation from the drafted row sequence — flip count.** Task 1 drafted R1–R4 as though
each row carried its own appearance change (four flips). The round as run used **two** flips,
because the developer asked that their involvement be reduced to the essential minimum and the rows
were re-sequenced so each flip served two purposes: the Light→Dark flip supplied R3's live-follow
transition *and* established R2's dark-OS state, and the Dark→Light flip supplied R4's transition.
This changed the *ordering* of the rows, not any row's discriminator, setup requirement, or
evidence: every row still ran from its own cleared-storage hard reload where it required one
(R1, R2, R3), the toggle was never clicked at any point in the round, and `dashboard-theme` was
quoted in the `null`/`'auto'` class at every instant of observation. **R1 additionally required no
flip at all** — the machine was already in Light appearance when the round began
(`defaults read -g AppleInterfaceStyle` → key absent). This is disclosed rather than presented as a
developer-performed appearance change.

**Environment note carried forward for future rounds.** Both live-follow rows (R3, R4) showed a lag
between the OS flip and the DOM update while the Chrome tab was backgrounded — see R3's caveat
table. Because the developer must leave the browser to reach System Settings, a backgrounded tab is
the *default* condition for this class of row in this project. Any future live-follow round should
arrange for the tab to remain visible across the flip (second display or side-by-side windows)
rather than re-discovering this.

## Gaps opened by Round 1 (2026-09-04)

Two numbered gaps. Both follow the Phase 24 GAP-24-05 shape: each states the state a future row
must hold **simultaneously** in order to discriminate, rather than merely restating what failed.
Next step for both: `/gsd-plan-phase 25 --gaps`.

### GAP-25-01 — VER-01's first-paint row has no capture mechanism that beats first paint

**What withheld the tick:** R2, BLOCKED. Every instrumented value the row asked for was obtained
and was correct (`dashboard-theme` `'auto'`, `prefers_dark` `true`, `data-theme` `'dark'`,
`body` background `rgb(26,26,46)`). What could not be obtained was the *frame*: navigation started
at `timeOrigin` `1788520780021.8`, `first-paint` landed `612 ms` later, and the two captured frames
were saved ~`243 ms` after that. A post-paint frame cannot discriminate a first-paint flash from
its absence, because a flash would already have ended.

**The state a future row must hold simultaneously to discriminate:**
1. OS in DARK appearance (so that white is an unambiguous failure and `#1a1a2e` an unambiguous
   pass — D-05's reasoning, unchanged); AND
2. `dashboard-theme` quoted in the `null`/`'auto'` class at the instant of observation (D-04 as
   amended); AND
3. a captured raster frame whose timestamp is provably **at or before** the load's own
   `first-paint` entry — the timestamp must be tied to the *same* navigation (compare against that
   document's `performance.timeOrigin` + `first-paint.startTime`), not to wall-clock proximity; AND
4. the frame must come from a top-level navigation to the production URL, not a proxy context.

**Why this is not closeable by the current tooling, stated so a future round does not retry it
blindly:** the browser-extension screenshot round-trip is the binding constraint — measured floor
~`855 ms` from navigation start on this hardware, against a `612 ms` first paint. Batching the
reload and the capture into a single round trip was already tried; it produced the `~243 ms`-late
frames recorded in R2. A future round needs a *different mechanism*, not a faster retry.
Candidate mechanisms, none yet validated and none endorsed here: a CDP-level screencast
(`Page.startScreencast`) which timestamps frames against the navigation; a video capture of the
display with a frame-accurate clock; or a deliberately slowed load (network throttling) that widens
the window between navigation start and first paint far enough for the existing capture floor to
land inside it. Each needs its own reachability proof **before** the row is presented.

**Explicitly rejected as a closure route:** the ordering argument (inline `<head>` script complete
by `domInteractive` `287.9 ms`, `324 ms` before `first-paint` `612 ms`, plus plan 25-05's `node:vm`
parity pin). It is sound as inference and it is recorded in R2, but criterion 4 asks for observed
browser behaviour and this round already declined to convert that inference into a PASS. A future
round that closes GAP-25-01 by restating the same inference has not closed it.

### GAP-25-02 — CI-01's live-run evidence still does not exist, and R6 is unsplittable while it doesn't

**What withheld the tick:** R6, BLOCKED — and because R6 is the only row mapped to CI-01, CI-02 and
FIX-02, its BLOCKED verdict withholds all three, including two whose underlying work is fully green.

**The specific absence:** no `gh workflow run "Daily Widget Refresh"` dispatch has ever been
performed for this phase, so there is no run id and no conclusion to cite. § "CI-01 live run
evidence — blocked" records why plan 25-06 could not do it: it executed inside an isolated
`worktree-agent-*` worktree, and `daily-refresh.yml`'s `Deploy widgets to GitHub Pages` and
`Commit updated data and stats` steps carry **no branch guard**, so a dispatch against any ref
deploys to the live Pages site and commits data back to `origin`.

**The state a future row must hold simultaneously to discriminate:**
1. `origin/master` confirmed to carry `compute-all-stats --ci` — i.e. this phase's work is merged
   and pushed, verified by reading the *pushed* copy of `daily-refresh.yml`, not the local one; AND
2. a dispatched run id and its conclusion, quoted from `gh run view`; AND
3. the collapsed compute step's own log excerpt from that run, showing one invocation where the
   workflow previously had eight hand-maintained steps (which is what CI-01 actually claims); AND
4. the dispatch performed from a normal single-context execution with the developer's explicit
   authorisation, **not** from a parallel worktree and **not** opportunistically during a
   checkpoint — the production side effects in (2) above make this a deliberate, separately
   authorised action.

**Recommended row shape for the next round — draft it before running it, not after.** R6 should be
replaced by three separate rows, one per requirement, so that a missing item withholds only its own
requirement:
- R6a → FIX-02: the green five-command gate (evidence already exists and is green today).
- R6b → CI-02: `verify-dashboard`'s `56 check(s) passed, 0 failure(s).` (evidence already exists and
  is green today).
- R6c → CI-01: the dispatched run id, conclusion and collapsed-step log (does not exist yet).
This is recorded as a *planning* correction for a future round. It was deliberately **not** applied
retroactively to this round — see R6's verdict for why splitting a row mid-round to obtain a tick is
the exact failure mode Checkpoint Row Discipline rule 3 forbids.

**Note on scope:** GAP-25-02 is a structural/process gap, not a code defect. Nothing in
`compute-all-stats-steps.ts`, `daily-refresh.yml` or `verify-dashboard-publish.mjs` is known to be
wrong; the unit-level halves of CI-01 and CI-02 are green and independently verified.

### Deferred, non-blocking observation (not a gap)

The developer raised a UI question during R1 about the theme toggle's iconography — it indicates
**current state** (sun when light, moon when dark) rather than the target action ("click for
dark"). Both conventions are in common use and the developer explicitly framed this as a question,
not a fault ("This is totally fine with my but wondering whether common practice would be the
opposite"). Recorded in `deferred-items.md`. It affects no row's verdict and no requirement.

---

## Round 2 Checkpoint (R6a, R6b, R6c, R7)

*(plan 25-09 — drafted 2026-09-04. All rows below are drafted only; none has been run. Every
Verdict cell reads `pending`. Plan 25-10 runs R7; plan 25-11 runs R6a/R6b/R6c. Checkpoint Row
Discipline rule 3 requires this drafting to complete, and commit, strictly before either of those
plans runs any row named here.)*

### Why this round exists

Round 1 (plan 25-07) returned R2 BLOCKED — no capture mechanism on the available hardware could
produce a frame provably at or before production's own first paint — and R6 BLOCKED — CI-01's
live-run dispatch evidence did not exist. Because R6 was drafted and run as one row covering three
requirements, its BLOCKED verdict withheld FIX-02 and CI-02 as well as CI-01, even though FIX-02's
and CI-02's own evidence (the green five-command gate and `56 check(s) passed, 0 failure(s).`) was
already green at the time R6 was scored. GAP-25-01 (the capture-mechanism gap) and GAP-25-02 (the
R6 split) are this round's entire scope; nothing else opened by Round 1 is revisited here.

### Row-to-requirement map

One row per requirement, per GAP-25-02's recommended split:

| Requirement | Row |
|---|---|
| VER-01 | R7 |
| FIX-02 | R6a |
| CI-02 | R6b |
| CI-01 | R6c |

This is GAP-25-02's recommended shape, drafted here — before any of the four rows is run —
precisely because Round 1 declined to apply the split mid-round. R6's own verdict text records
why: "Redesigning a row mid-round so that it yields a tick is precisely the failure mode
Checkpoint Row Discipline rule 3 and the Phase 24 R19/R26 precedent exist to prevent. The row was
drafted as one row before the outcome was known, and it is scored as one row now that the outcome
is known. A future round may legitimately draft three separate rows — before running them — and
GAP-25-02 records that as the recommended shape." This plan is that legitimate future round: the
split is drafted before anything runs.

### What Round 1 already settled and is not re-run

R1 (light-OS legibility), R3 and R4 (live-follow in both directions), and R5 (cache-trap exclusion
/ asset identity) all PASSED in Round 1 and are not re-run here. VER-01's Round 2 tick depends on
R7 PASSING while those four Round 1 PASSes stand — R7 does not re-derive legibility or live-follow,
only the first-paint clause criterion 4 clause 2 asks for.

**One caveat, stated honestly rather than left implicit:** R5's asset-identity evidence was taken
against `origin/gh-pages` @ `b2b05a4054e4f12c7a1fe29448779f11f74dd973` (built from source commit
`623046363f7c86812e3d2aaa907bbf67e7d74f02`, which was `origin/master`'s HEAD at the time R5 ran).
Plan 25-11 will push this phase's work to `origin/master` and dispatch a workflow (for R6c) that
redeploys the Pages site. After that redeploy, R5's specific hashed asset
(`assets/index-D-Ts7X8C.js`) may no longer be what production serves. That is why R7 carries its
own asset-identity clause (clause 5, below) rather than leaning on R5's now-potentially-stale
evidence.

### The governing rule (unchanged, non-waivable)

A requirement ticks ONLY if every row mapped to it is PASS. Under the split, this now means one
row per requirement rather than one row covering three — a missing or BLOCKED item withholds only
its own requirement, not two others whose evidence is unrelated to it.

### Checkpoint Row Discipline, restated as binding for this round

1. **A row is drafted, complete with its reachability proof, before it is run.** This plan
   (25-09) is the drafting; plans 25-10 (R7) and 25-11 (R6a/R6b/R6c) are the running.
2. **Reachability is proved in BOTH directions for every row** — this phase has already been
   bitten in both directions: D-05 caught a row that would have been vacuous (first-paint
   observed on a light OS, where white is the correct final state), and D-04's original wording
   caught a row that would have been unpassable (a literal `null` no working page can ever
   produce, per `main.ts:29`'s unconditional persist-on-load).
3. **Rows assert reachable extent against an independently-derived value, never internal
   agreement** (Phase 23 CR-01, Phase 24 R32).

**Pledge:** if a row turns out unsatisfiable while it is being run, it is HALTED and a new
numbered gap is opened. It is NOT edited to yield a tick.

### Verdict vocabulary

PASS / FAIL / BLOCKED / NOT EXERCISABLE (established Phase 20, used since). **BLOCKED** means the
evidence offered was not the evidence the row required — it is not a softer PASS.

**House rule since plan 16-09:** nothing is patched during a round. A defect observed while
running a row is recorded, not fixed.

### Execution split and environmental hazards carried forward

- **D-07 hybrid execution:** the developer performs every macOS Appearance change by hand;
  `osascript` is rejected for any recorded row in this round, same as Round 1.
- **D-08 target:** `https://bacilo.github.io/strava-widgets/`, hard-reload after every change
  (T-25-21's stale-cache history).
- **R7's cleared-storage mechanism:** the harness's throwaway `--user-data-dir`
  (`scripts/first-paint-capture.mjs`) — an empty profile and an empty HTTP cache by construction,
  which is stronger than a hard reload of an existing profile. This must be NAMED in R7's own
  evidence when it is run, not assumed here.
- **Frontmost-window requirement:** Round 1's R3/R4 caveat showed a backgrounded Chrome tab lags
  DOM updates behind `matchMedia` reads by whole seconds. Any row in this round that depends on
  live browser state must keep the relevant window frontmost during capture/observation.

### Disclosure obligations carried into this round

D-04's amendment disclosure and D-05's dark-OS deviation disclosure both already exist in the
Round 1 section (§ "D-04 amendment disclosure" and R2's drafted row text) and are cross-referenced
here by name, not restated. R7 (drafted in plan 25-09's next task) additionally carries its own
slowed-load disclosure, of the same weight as D-04/D-05, because plan 25-08 selected the throttled
mechanism (Candidate C) — per the § "GAP-25-01 capture-mechanism reachability proof" Part C
disclosure this row cites directly. The absence of a required disclosure is a defect in the round
independent of any row's verdict.

**R7 — First-paint flash, observed (VER-01, ROADMAP criterion 4 clause 2).**
Replaces the BLOCKED R2. **Verdict: pending.**

**DISCRIMINATOR:** the sampled background colour of a captured raster frame whose timestamp is
provably at or before that same navigation's `first-paint`. `rgb(26, 26, 46)` (dark
`--bg: #1a1a2e`, `styles.css:105`) is PASS. `rgb(255, 255, 255)` (light `--bg: #ffffff`,
`styles.css:18`) is FAIL. A frame that cannot be shown to be at or before first paint is BLOCKED,
not PASS — repeating R2's outcome is not a closure of GAP-25-01.

**MECHANISM:** `scripts/first-paint-capture.mjs --mechanism throttled --throttle-ms 1000` against
`https://bacilo.github.io/strava-widgets/`, per plan 25-08's selected Candidate C (emulation:
`offline: false, latency: 1000ms, downloadThroughput: 6400 B/s, uploadThroughput: 6400 B/s`). A
frame only counts as page-content evidence if its timestamp is at or after that navigation's own
`navResponseEnd` — the universal Chrome UA-default artifact frame (`rgb(18, 18, 18)`, from
`<meta name="color-scheme" content="light dark">`) discovered in all 9 of plan 25-08's runs
arrives before `navResponseEnd` in every case and carries no discriminating evidence; it MUST be
excluded from R7's own evidence by this same rule, or R7 would be scorable against a frame that
carries no discriminating information.

**EVIDENCE REQUIREMENT** — carrying GAP-25-01's four numbered clauses into R7 verbatim in
substance:

1. **macOS Appearance in DARK**, quoted from `defaults read -g AppleInterfaceStyle` returning
   `Dark`, set by the developer's own hand (D-07) or disclosed as already-dark. D-05's reasoning
   is cross-referenced: on a light OS, `--bg: #ffffff` (`styles.css:18`) makes white the correct
   final state, so the row would be vacuous.
2. `localStorage.getItem('dashboard-theme')` quoted at the instant of observation, in the
   `null`-or-`'auto'` class per D-04 as amended. A quoted `'light'` or `'dark'` records the row
   BLOCKED, because the in-page control would be overriding the OS setting under test. Also quote
   `matchMedia('(prefers-color-scheme: dark)').matches` (must be `true`) and
   `document.documentElement.getAttribute('data-theme')` (must be `'dark'`).
3. The captured frame's timestamp, the navigation's `performance.timeOrigin`, and that
   navigation's `first-paint` `startTime`, all three quoted, with the arithmetic shown:
   `frame_timestamp - timeOrigin` must be at or below the `first-paint` startTime. Comparing the
   frame to wall-clock proximity to the reload is explicitly NOT acceptable — that attribution is
   what GAP-25-01 clause 3 forbids, and it is a different mistake than the one that sank R2 (R2's
   frames landed ~243 ms after first paint on an honestly-computed arithmetic basis, not on a
   wall-clock-proximity shortcut).
4. A top-level navigation to `https://bacilo.github.io/strava-widgets/` (D-08). The local
   `127.0.0.1` control served in plan 25-08 Part B does NOT satisfy this clause — it is mechanism
   proof only (proving the harness can discriminate at all), and R7's write-up must say so
   explicitly, so a future reader cannot mistake plan 25-08's control run for R7's own production
   evidence.
5. **Cache-trap exclusion in R7's own right** (D-08, T-25-21), not inherited from R5: quote the
   captured document's `script[type=module][src]` hashed asset filename, a cache-busted refetch of
   `index.html` shown byte-identical to the document the browser used (SHA-256 and byte length for
   both), and the matching asset name in the `origin/gh-pages` tree at the commit deployed at that
   moment — the independently-derived value, per Checkpoint Row Discipline rule 2. Also name the
   throwaway `--user-data-dir` as the cleared-storage mechanism used for this row.
6. The developer's own judgment of the captured frame, recorded verbatim (D-07 keeps the human
   judgment human). State the granularity actually given; do not expand a blanket approval into
   per-clause detail it did not contain (plan 19-09 precedent).

**REACHABILITY PROOF, both directions, established before this row is run:**

- **CAN FAIL (not vacuous):** plan 25-08 Part B's negative control, cited by frame path and
  sampled colour — the stripped-bootstrap copy of the same build (inline pre-paint bootstrap
  deleted from `src/dashboard/index.html:36-54`) sampled `rgb(255, 255, 255)` at `8247.048 ms`
  against a first-paint `startTime` of `8256 ms` (`beats_first_paint: true`), served locally under
  the identical `throttled --throttle-ms 1000` mechanism and the same dark OS, frame retained at
  `.planning/phases/25-ci-hardening-light-theme-verification/capture/control-stripped-throttled-1/frames/frame-001.png`.
  A broken pre-paint bootstrap is therefore demonstrably detectable by this row's own instrument,
  under this row's own mechanism — the row is not vacuous (T-25-28 mitigated).
- **CAN PASS (not unpassable):** plan 25-08 Part A's production runs, cited by run id — C-1
  (`+10.3 ms` margin), C-2 (`+8.3 ms` margin), C-3 (`+5.2 ms` margin), all three
  `beats_first_paint: true` against production's own real `first-paint` (`4512 ms`/`4040 ms`/
  `4280 ms` respectively, under the throttled mechanism), all three sampling the correct
  non-artifact colour `rgb(26, 26, 45)`, plus Part B's intact copy also sampling `rgb(26, 26, 45)`
  on the identical local mechanism. This is the clause R2 could not satisfy — R2's frames landed
  ~243 ms after first paint on every run it tried — so R7 is a genuinely different row, grounded
  in a measured, working mechanism, rather than a retry of R2's same capture attempt (T-25-29
  mitigated; if plan 25-08 had HALTED with no working mechanism, R7 would not be drafted at all,
  per this plan's own Task 1 instruction).
- **Residual risk, stated honestly:** if, on the day R7 is actually run, no frame beats first
  paint, the row is BLOCKED and a new numbered gap is opened. It is not re-scored against a later
  frame, and it is not retried in a loop until one succeeds — that would be exactly the
  row-redesign-after-seeing-the-outcome failure mode rule 1 forbids.

**One further residual weakness, disclosed rather than inherited as an unearned assumption:** in
plan 25-08's own negative control, the *intact* copy's earliest non-artifact frame landed at
`8504.021 ms` against a first paint of `8496 ms` — i.e. **8 ms AFTER first paint**,
`beats_first_paint: false`. The white-on-broken direction (stripped copy) was demonstrated
strictly BEFORE first paint; the dark-on-working direction (intact copy) was demonstrated 8 ms
AFTER it, under the identical mechanism and network emulation. Production's own three runs
(C-1/C-2/C-3, cited above) all beat first paint with margins of 5–10 ms, so this reads as a
control-run-specific artifact — the locally-served intact copy's own pre-paint/first-paint gap, or
plain millisecond-scale frame-delivery jitter — rather than evidence the mechanism cannot pass
under real conditions. **R7 is reachable in the PASS direction on the strength of the three
production runs, not the negative control's intact-copy number** — the negative control's job is
only to prove the FAIL direction is detectable, which it does unambiguously (white, strictly
before first paint). If R7's own live production capture also lands within a few milliseconds of
first paint (the same knife-edge margin the intact control showed), that thin margin is itself the
residual risk this paragraph names, and a BLOCKED verdict on that specific failure mode should be
read as "the mechanism's margin is thin on the day," not "the theme code regressed."

**DISCLOSURES R7 must carry:**

- Cross-reference D-05's dark-OS deviation disclosure and D-04's amendment disclosure by section
  name (both already written in the Round 1 section — R2's drafted row text and § "D-04 amendment
  disclosure").
- **Slowed-load disclosure (R7-specific, same weight as D-04/D-05):** R7's capture mechanism
  requires `Network.emulateNetworkConditions` with `offline: false, latency: 1000ms,
  downloadThroughput: 6400 B/s (~50 kbps), uploadThroughput: 6400 B/s` (plan 25-08 Part C). This is
  a deliberate deviation from the row's natural load conditions, disclosed here rather than
  silently applied. It does not weaken the row: a widened navigation-to-first-paint window can
  only make a real flash MORE visible by giving more wall-clock time for an intermediate
  mis-themed frame to render and be captured — it cannot manufacture a pass, because the emulation
  touches only network timing, never `Emulation.setEmulatedMedia`, `data-theme`, or any other
  rendering override (T-25-23 untouched). Plan 25-08's negative control is the direct proof of
  this in the other direction: the identical throttle, applied to a build with the pre-paint
  bootstrap deleted, correctly produced white rather than hiding the defect.

**EXPLICITLY NOT ACCEPTABLE EVIDENCE**, named so the running agent cannot drift into it under
pressure: the ordering argument — inline `<head>` script complete by `domInteractive` `287.9 ms`,
`324 ms` before `first-paint` `612 ms` (Round 1's own production measurement), plus plan 25-05's
`node:vm` parity pin (D-06). GAP-25-01 rejects this by name as a closure route: "A future round
that closes GAP-25-01 by restating the same inference has not closed it." It may be restated as
context in R7's write-up; it may not decide the verdict.

**Pre-flight (Task 1):**

- **Row-baseline check.** `ROW_BASELINE_SHA` (from `25-09-SUMMARY.md`'s `## Row baseline commit`):
  `bf9d1a139fae3563e431981709f3fb0883a9d7ee`. `git diff bf9d1a139fae3563e431981709f3fb0883a9d7ee --
  .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` at plan 25-10's Task 1
  execution time returned **0 lines** — HEAD (`7ce32457`) is byte-identical to the baseline commit
  for this file, so no `-`/`+` line exists anywhere in the file, let alone inside R7's block. R7's
  discriminator, MECHANISM, six-item evidence requirement and both reachability paragraphs are
  confirmed unmodified.
- **Cache-trap comparison value, derived BEFORE the run (independent of the page under test):**
  `git fetch origin gh-pages` succeeded. `git ls-tree -r --name-only origin/gh-pages | grep
  "assets/index-"` returns `assets/index-B573RjUr.css` and `assets/index-D-Ts7X8C.js`.
  `git rev-parse --short origin/gh-pages` = `b2b05a40`. `git log -1 --format="%cI %H"
  origin/gh-pages` = `2026-09-04T09:10:40+00:00 b2b05a4054e4f12c7a1fe29448779f11f74dd973`. This is
  **unchanged** from R5's recorded value (`assets/index-D-Ts7X8C.js` at `origin/gh-pages` `b2b05a4`,
  deployed 2026-09-04 09:10:40 +0000, built from source commit `623046363`) — production has not
  been redeployed since Round 1. `assets/index-D-Ts7X8C.js` is the value R7's own hashed
  module-script quote will be checked against.
- **Exact harness invocation to be run, per plan 25-08's selected Candidate C:**
  `node scripts/first-paint-capture.mjs --mechanism throttled --throttle-ms 1000 --url
  https://bacilo.github.io/strava-widgets/ --out
  .planning/phases/25-ci-hardening-light-theme-verification/capture/r7-production-run`. Emulation
  parameters this invocation applies (from `scripts/first-paint-capture.mjs`'s `runThrottled`):
  `offline: false, latency: 1000ms, downloadThroughput: 6400 B/s (50*1024/8), uploadThroughput:
  6400 B/s`. This is the row's stated method; the run must not quietly differ from it.
- **Pre-run appearance reading:** `defaults read -g AppleInterfaceStyle` = `Dark`, read at plan
  25-10 Task 1 execution time, before Task 2's checkpoint. No developer action has been taken yet on
  this reading — Task 2 re-confirms it and discloses whether a flip was needed.

**R6a — FIX-02's evidence, on the tree that is actually pushed.** **Verdict: pending.**

DISCRIMINATOR: all five gate commands exit 0 on the exact commit plan 25-11 pushes to
`origin/master` — `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run build-widgets`,
`npm run verify-dashboard` — AND all eight FIX-02 regression cases are present and passing in
`src/analytics/gear-aggregate-logic.test.ts`, enumerated by name.

INDEPENDENTLY-DERIVED EXTENT (rule 2): the eight cases are D-12's four shapes — absent `gearName`
key, `undefined`, empty string, non-string — times two functions, `buildGearAggregate` and
`buildGearCoverage`:

| # | Function | Case name |
|---|---|---|
| 1 | `buildGearAggregate` | `absent gearName key lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)` |
| 2 | `buildGearAggregate` | `gearName: undefined lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)` |
| 3 | `buildGearAggregate` | `gearName: empty string lands in the Unknown bucket rather than the shoe fallback key (FIX-02, D-12)` |
| 4 | `buildGearAggregate` | `non-string gearName lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)` |
| 5 | `buildGearCoverage` | `absent gearName key is not counted in runsWithGear (FIX-02, D-12)` |
| 6 | `buildGearCoverage` | `gearName: undefined is not counted in runsWithGear (FIX-02, D-12)` |
| 7 | `buildGearCoverage` | `gearName: empty string is not counted in runsWithGear (FIX-02, D-12)` |
| 8 | `buildGearCoverage` | `non-string gearName is not counted in runsWithGear (FIX-02, D-12)` |

The row asserts these eight named cases individually present and passing, not "the suite is
green." It also reconciles the `npm test` tally against 62 files / 1596 tests (the Wave 1
Integration Gate baseline above); if merging `origin/master` changes the tally, every unit of
delta must be attributed by name, with no unexplained residue, in the same form the Wave 1
Integration Gate table used.

D-13's half: `npx tsc --noEmit` exits 0 with `gearName` optional on the row type
(`DashboardIndexRow`).

CAN FAIL: this file's own § "D-11 RED Observation Log" quotes, verbatim, the eight failures
observed against the unwidened predicate — three `TypeError: Cannot read properties of undefined
(reading 'toLowerCase')` at `gear-aggregate-logic.ts:43:6` plus one `label.toLowerCase is not a
function` (the non-string case), and four `expected 1 to be +0` `buildGearCoverage` assertions.
The row also fails if any of the five commands exits non-zero, or if the tally carries an
unexplained delta.

CAN PASS: the identical five-command gate already ran green on the wave-1/2 merged tree (this
file's § "Wave 1 Integration Gate", three consecutive identical `npm test` tallies of 62 files /
1596 tests). Nothing about merging `origin/master`'s nightly data auto-commits (which touch only
`data/activities`, `data/sync-state.json`, `data/geo/*`, `data/streams/*` — none of which
`gear-aggregate-logic.test.ts` reads) is expected to change it.

NOTE the row must state when it is run: this is a FRESH run on the pushed commit, not a citation
of the wave-1 numbers, because the tree changes when `origin/master` is merged in.

**R6b — CI-02's evidence, on the same tree.** **Verdict: pending.**

DISCRIMINATOR: `npm run verify-dashboard` exits 0, its final line reads `56 check(s) passed, 0
failure(s).` (or a higher passed count with `0 failure(s).`, if the shard sample count differs on
the day), AND each of the six by-name documents below appears among the passing checks.

INDEPENDENTLY-DERIVED EXTENT (rule 2): the six names come from D-09's list, plus D-10's
runtime-sampled shard:

1. `weekly-distance.json`
2. `monthly-stats.json`
3. `yearly-stats.json`
4. `year-over-year.json`
5. `best-efforts.json`
6. one runtime-derived per-activity best-effort shard (D-10; no pinned ids, sampled per
   `verify-dashboard-publish.mjs:430-455`)

— and from the 40/40 total at the end of Phase 24 versus 56 now, i.e. 16 net-new checks. The row
asserts the six names are individually present among the passing checks; a bare total is not
sufficient, because a total can rise for reasons unrelated to these six documents.

CAN FAIL: this file's own § "D-11 RED Observation Log" quotes, verbatim, the six break/restore
cycles, each naming its own document — for example `✗ /data/stats/weekly-distance.json expected a
non-empty array, got an array of length 0` and `✗ GET /data/stats/best-efforts/i182358139.json
expected 200, got 404`. Each of the six assertions has been observed RED naming its own document,
satisfying D-11's "a guard only counts once observed RED" rule.

CAN PASS: the same command already returned `56 check(s) passed, 0 failure(s).` on the merged
tree (§ "Wave 1 Integration Gate").

**R6c — CI-01's evidence, which does not exist yet.** **Verdict: pending.**

DISCRIMINATOR, all four clauses required together (GAP-25-02's numbered contract):

1. `origin/master` confirmed to carry the collapsed step, verified by reading the PUSHED copy:
   `git show origin/master:.github/workflows/daily-refresh.yml | grep -c "compute-all-stats
   --ci"` returns `1`. At planning time (2026-09-04, re-confirmed at this plan's execution time
   against `origin/master` @ `b155fe82bb0e75be599c09dbb783cdea0fb43b71`) it returned `0`, while
   local `master`'s copy (`.github/workflows/daily-refresh.yml:96-97`) returns `1`.
2. A dispatched run id and its conclusion, quoted from `gh run view`. The conclusion must be
   `success`.
3. The collapsed "Compute all statistics" step's own log excerpt from that run, carrying a
   "> NAME" line (`src/index.ts:306`) for each of the eight steps in `COMPUTE_ALL_STATS_STEPS`
   order — read from `src/compute-all-stats-steps.ts:68-166`, NOT read off the log, per rule 2:
   `compute-stats`, `compute-advanced-stats`, `compute-geo-stats`, `compute-best-efforts`,
   `compute-age-grading`, `compute-dashboard-index`, `compute-gear-aggregate`,
   `compute-training-load` — from ONE invocation where the workflow previously had eight
   hand-maintained steps, plus the "All statistics generated successfully!" line
   (`src/index.ts:314`). State explicitly that the conditional "DEGRADED STEPS (N)" summary
   (`src/index.ts:322`, printed only when `degraded.length > 0`) is NOT part of the pass
   condition — it prints only when a tolerated step failed (D-03) — but that if it does appear,
   it must name every degraded step and the row records that fact rather than treating its
   presence as a failure.
4. The dispatch performed from a normal single-context execution with the developer's explicit
   authorisation, NOT from a parallel worktree and NOT opportunistically during a checkpoint.
   Evidence: the authorisation exchange quoted verbatim, and `git rev-parse --show-toplevel`
   shown to be the main checkout (`/Users/pedf/workspace/strava-widgets`, confirmed at this
   plan's execution time to be a real directory, not a path under `.claude/worktrees/`).

CAN FAIL, and concretely so today: `git show origin/master:.github/workflows/daily-refresh.yml |
grep -c "compute-all-stats --ci"` returns `0` right now (re-confirmed at this plan's own
execution time, `origin/master` @ `b155fe82bb0e75be599c09dbb783cdea0fb43b71`), so a dispatch
performed right now would run the OLD eight-hand-maintained-step workflow and its log would show
no single collapsed invocation carrying all eight names. Clause 1 would fail and clause 3 would
fail with it. The row also fails if the run's conclusion is not `success`, or if any one of the
eight names is missing from the collapsed step's log. This is a currently-true failing state, not
a hypothetical one — which is what makes the row non-vacuous (T-25-28 mitigated).

CAN PASS: local `master`'s `daily-refresh.yml:96-97` already carries the collapsed step
(`node dist/index.js compute-all-stats --ci`), `src/compute-all-stats-steps.ts` is unit-tested by
10 cases in `src/compute-all-stats-steps.test.ts` (part of the Wave 0/1 Per-Task Verification Map
above), `gh` `2.86.0` is installed and authenticated (`gh auth status` confirms `Logged in to
github.com account bacilo`, `Token: gho_...`) with sufficient scopes, and `workflow_dispatch` is
already configured on the workflow (`daily-refresh.yml:37-43`, confirmed present). Once the push
lands, the dispatch is expected to produce exactly this log.

THE ROW MUST ALSO STATE, up front, that gathering its evidence has production side effects, so the
running plan gates on an authorisation checkpoint: the push itself matches the workflow's own push
trigger `paths` (`src/**`, `scripts/**`, `.github/workflows/**` among others,
`daily-refresh.yml:15-29`), so pushing alone starts a production run; and `daily-refresh.yml`'s
`Commit updated data and stats` and `Deploy widgets to GitHub Pages` steps carry no `github.ref`
branch guard (confirmed: `grep -n "if:\|github.ref" .github/workflows/daily-refresh.yml` returns
only the two `Warn on *` conditionals), so any run — dispatched or push-triggered — deploys to the
live Pages site and commits data back to `origin`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — confirmed by plan 25-06 Task 1's Per-Task Verification Map pass
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed, no gap found
- [x] Wave 0 covers all ❌ MISSING references (4 items above) — all four now landed (waves 1-2) and confirmed present/green by this task
- [x] No watch-mode flags (`vitest run`, never bare `vitest`) — `npm test` invokes `vitest run` per `package.json`; confirmed by the three quoted runs above, none of which hung waiting on watch mode
- [x] Feedback latency < 7s — all three `npm test` runs quoted above completed in 6.65s-6.89s
- [x] All six CI-02 assertions + WR-19's fixture observed RED and recorded — transcribed verbatim in the RED-evidence section above
- [x] D-05's deviation from criterion 4's literal wording disclosed in the write-up — **confirmed present** in R2's drafted row text (the dark-OS framing is stated as a deliberate deviation with its reasoning, not quietly substituted). Confirmed by plan 25-07 Task 3 on 2026-09-04.
- [x] D-04's amendment disclosed in the write-up — **confirmed present** as the § "D-04 amendment disclosure" paragraph (original literal-`null` wording, why it was unreachable per `main.ts:29` and `persist` defaulting to `true` at `theme.ts:118`, and why `null`-or-`'auto'` preserves the intent). Confirmed by plan 25-07 Task 3 on 2026-09-04. Both disclosures are present, so neither constitutes a defect in the round.
- [ ] `nyquist_compliant: true` set in frontmatter — **NOT set.** Round 1 returned two BLOCKED rows (R2, R6); see GAP-25-01 and GAP-25-02.

**Approval:** **WITHHELD — 2026-09-04.** Round 1 ran in full and returned R1/R3/R4/R5 PASS, R2
BLOCKED (capture fidelity) and R6 BLOCKED (CI-01 live-run evidence absent). Under the governing
all-rows-PASS rule, no requirement ticks: VER-01 is withheld by R2, and CI-01/CI-02/FIX-02 are
withheld by R6. Two gaps are open. Next step: `/gsd-plan-phase 25 --gaps`.

Both disclosure obligations were met — the D-05 deviation disclosure and the D-04 amendment
disclosure are each present in the Round 1 section — so the round carries no disclosure defect
independent of its row verdicts.

---

## GAP-25-01 capture-mechanism reachability proof

### Appearance provenance (D-07)

**Pre-check**, run before any developer action, 2026-09-04:
```
$ defaults read -g AppleInterfaceStyle
The domain/default pair of (kCFPreferencesAnyApplication, AppleInterfaceStyle) does not exist
```
This is the Light signature (key absent) — the machine was in Light appearance, matching the state
recorded at planning time.

**A developer-performed flip WAS required.** This is not the no-flip-required case: the pre-check
above shows Light, so the developer was asked to set System Settings → Appearance → Dark by their
own hand, and did so. The orchestrator confirmed the developer's action before this task resumed.

**Post-check**, run after the developer confirmed the change, 2026-09-04T13:49:18Z:
```
$ defaults read -g AppleInterfaceStyle
Dark
```

**Timestamp:** post-check performed at 2026-09-04T13:49:18Z (UTC).

**`osascript` was NOT used** to perform this appearance change (D-07), and **no DevTools rendering
override** (`Emulation.setEmulatedMedia` or any other CDP colour-scheme override) was applied at any
point. The machine's real OS Appearance setting was changed by the developer's own hand in System
Settings, exactly as D-07 requires, so that the setting can genuinely reach a launched Chrome
instance rather than being simulated.

Measurement results (Part A candidate sweep, Part B negative control, and mechanism selection) are
recorded in a separate subsection below, written after this provenance was captured.

### Part A — candidate sweep against production

Target: `https://bacilo.github.io/strava-widgets/` (D-08). All runs below used
`scripts/first-paint-capture.mjs` with the machine in Dark appearance (provenance above), a fresh
throwaway `--user-data-dir` per run, and no `Emulation.setEmulatedMedia` override at any point.
`prefers-color-scheme: dark` `.matches` read `true` in every single run below — no run is void.

**A methodology finding that applies to every run in this section, discovered during Part B and
applied retroactively here because it changes which frame is the real evidence:** the very first
screencast frame of every run in this entire plan — production or local, intact or stripped copy,
`screencast` or `throttled` mechanism, 9 runs in total — is `rgb(18, 18, 18)` at all five sample
points (four corners plus centre), with **zero variance across all 9 runs**. `rgb(18, 18, 18)`
(`#121212`) appears nowhere in `styles.css`; the page's two authored backgrounds are `#ffffff`
(light) and `#1a1a2e` (dark, = `rgb(26, 26, 46)`). In every run this frame's timestamp arrives
*before* that navigation's own `navResponseEnd` (e.g. production run A-1: frame at `18.4ms` vs
`navResponseEnd` `430.3ms`; throttled run C-1: frame at `9.9ms` vs `navResponseEnd` `1406.4ms`) —
i.e. it is captured before a single byte of the document could have been received. It is Chrome's
own `<meta name="color-scheme" content="light dark">`-driven default canvas fill for an
as-yet-unstyled document in a dark-OS session (a real, documented Chromium anti-flash behaviour,
unrelated to this page's own CSS or `data-theme` logic). Because it is identical regardless of
which build is loaded, it carries **no discriminating evidence** and is excluded from every
"earliest frame beating first paint" determination below. The rule applied: a frame only counts as
page-content evidence if its timestamp is at or after that navigation's own `navResponseEnd`. This
is disclosed here, not silently applied, because using this frame uncorrected would have let
Candidate A appear to win Part A by a wide margin it does not actually have — exactly the
"verifier lies" class T-25-24 exists to catch.

**Candidate A — `--mechanism screencast` (no throttle):**

| Run | timeOrigin | first-paint startTime | earliest non-artifact frame `t_since_navigation_ms` | beats_first_paint | margin (ms) | sampled colour (centre) |
|---|---|---|---|---|---|---|
| A-1 | 1788530286669.1 | 728 ms | 710.997 ms | true | +17.0 | rgb(26, 26, 45) |
| A-2 | 1788530298666.2 | 112 ms | 114.140 ms | **false** | −2.1 | rgb(26, 26, 45) |
| A-3 | 1788530309809.5 | 304 ms | 295.918 ms | true | +8.1 | rgb(26, 26, 45) |

Candidate A beats first paint in 2 of 3 runs once the artifact frame is excluded, with margins as
thin as 8 ms and one outright loss (A-2, missed by 2.1 ms). An earlier exploratory run (kept as
supporting data, not counted toward the "at least three" requirement above since it predates the
artifact-exclusion methodology being fixed) showed the same pattern: `timeOrigin`
`1788529808426.1`, first-paint `1024 ms`, artifact frame at `29.7 ms` excluded, next frame at
`1005.1 ms` (margin `+18.9 ms`, colour `rgb(36, 36, 66)`/`rgb(26, 26, 45)` split across corners).
Candidate A is inconsistent and does not clear the bar reliably.

**Candidate B — `--mechanism screenshot-burst` (no throttle):**

| Run | timeOrigin | first-paint startTime | frames captured | beats_first_paint | result |
|---|---|---|---|---|---|
| B-1 | 1788530339085.8 | null | 0 | — | `Page.captureScreenshot` failed: `{"code":-32000,"message":"Not attached to an active page"}` on the first shot |
| B-2 | 1788530349756 | null | 0 | — | same error |
| B-3 | 1788530360407.8 | null | 0 | — | same error |

Candidate B fails structurally on every run: the cross-origin navigation from `about:blank` to
`https://bacilo.github.io/...` triggers a Chrome renderer-process swap (site isolation) that
detaches the CDP session before the first screenshot in the burst loop completes — the exact
limitation the harness's own header comment anticipated. `first-paint startTime` reads `null` in
all three because `Runtime.evaluate` also runs against the detached session. Candidate B loses
0-for-3, unable to capture even one frame against production. Recorded per the plan's instruction
to record the losing candidate's floor even though it loses — here the floor is "never attaches."

**Candidate C — `--mechanism throttled --throttle-ms 1000`** (emulation:
`offline: false, latency: 1000ms, downloadThroughput: 6400 B/s, uploadThroughput: 6400 B/s` —
recorded exactly, this is the disclosed deviation carried into Part C):

| Run | timeOrigin | navResponseEnd | first-paint startTime | earliest non-artifact frame `t_since_navigation_ms` | beats_first_paint | margin (ms) | sampled colour (centre) |
|---|---|---|---|---|---|---|---|
| C-1 | 1788530384796.4 | 1406.4 ms | 4512 ms | 4501.741 ms | true | +10.3 | rgb(26, 26, 45) |
| C-2 | 1788530403417.2 | 1406.4 ms | 4040 ms | 4031.747 ms | true | +8.3 | rgb(26, 26, 45) |
| C-3 | 1788530415188.8 | 1402.9 ms | 4280 ms | 4274.849 ms | true | +5.2 | rgb(26, 26, 45) |

Candidate C beats first paint in all 3 runs with a genuine, non-artifact frame every time. All three
runs' final `pageState` read `dashboardTheme: "auto"`, `dataTheme: "dark"`,
`bodyBackgroundColor: "rgb(26, 26, 46)"`, `prefersDark: true` — confirming the real OS setting
reached the launched Chrome and the production page resolved to the correct theme. The sampled
`rgb(26, 26, 45)` (one unit off the CSS-authoritative `rgb(26, 26, 46)` in the blue channel) is
consistent across every dark-theme frame captured anywhere in this plan and is attributed to the
screencast PNG re-encode pipeline, not to a colour defect — `getComputedStyle(document.body)`, read
directly via `Runtime.evaluate` rather than sampled from a re-encoded frame, returned the exact
authored value in every run.

### Part B — negative control (failure direction, using Candidate C, the Part A winner)

Build: `npm run build-widgets` (ran clean; output the current `dist/widgets`, including
`assets/index-D-Ts7X8C.js` and `assets/index-B573RjUr.css`). Copied to two scratch directories
OUTSIDE the repo tree (under the session scratchpad, not `.planning/` or `dist/`): `control-intact`
(byte-identical copy) and `control-stripped` (same copy, with the entire inline pre-paint bootstrap
`<script>...</script>` block from `src/dashboard/index.html:36-54` — the one reading
`localStorage.getItem('dashboard-theme')` — deleted; the `<script type="module" ...>` tag and
everything else left untouched). Both served over `node:http` on `127.0.0.1` (ports 8901 intact,
8902 stripped), matching `scripts/verify-dashboard-publish.mjs`'s static-serving shape. Both runs
used the SAME mechanism and emulation parameters that won Part A: `--mechanism throttled
--throttle-ms 1000`.

**Investigation note (the "does NOT sample white" contingency, triggered and resolved):** the
naive earliest frame in both the stripped and the intact run is the same `rgb(18, 18, 18)` artifact
described above (arriving at `18.2`/`18.4 ms`, versus `navResponseEnd` of `1407.2`/`1631.6 ms` in
these two runs specifically) — so by the letter of "does the stripped copy's first frame sample
white," it does not, and this is the trigger to stop and investigate rather than write a selection.
The investigation is the artifact-exclusion finding above, established from all 9 runs' evidence,
not invented to explain away this one result. Applying the same `navResponseEnd` filter here:

| Copy | URL | earliest non-artifact frame `t_since_navigation_ms` | first-paint startTime | beats_first_paint | sampled colour | frame path |
|---|---|---|---|---|---|---|
| Stripped (bootstrap removed) | `http://127.0.0.1:8902/` | 8247.048 ms | 8256 ms | true | **rgb(255, 255, 255)** | `.planning/phases/25-ci-hardening-light-theme-verification/capture/control-stripped-throttled-1/frames/frame-001.png` |
| Intact (unmodified build) | `http://127.0.0.1:8901/` | 8504.021 ms | 8496 ms | false (8 ms after) | **rgb(26, 26, 45)** | `.planning/phases/25-ci-hardening-light-theme-verification/capture/control-intact-throttled-1/frames/frame-001.png` |

This is the bidirectional proof: identical mechanism, identical emulated network conditions,
identical build except for one deleted script block, and the harness reports **white** on the
broken copy and **dark** on the working copy, at the same instant relative to each page's own
first paint. The stripped copy's final `pageState` (`dashboardTheme: null`, `dataTheme: null`,
`bodyBackgroundColor: "rgb(255, 255, 255)"`) confirms `data-theme` was never set at evaluate time —
the module script had not finished executing under the throttle, exactly the race the removed
inline script exists to win. The intact copy's final `pageState` shows `dataTheme: "dark"` already
set (by the surviving synchronous inline script) even though `dashboardTheme` (the `localStorage`
read that only `main.ts` performs) was ALSO still `null` at evaluate time under the same throttle —
proving the synchronous inline bootstrap, not the module script, is what prevents the flash. The
mechanism is proven in both directions and is not vacuous (T-25-24 mitigated).

### Part C — selection

Candidate A (screencast, no deviation) is disqualified: after excluding the universal artifact
frame, it beats first paint in only 2 of 3 production runs (margins as thin as 8 ms, one outright
2.1 ms loss), and a direct investigative run against the stripped local control could not produce a
white frame at all under natural/unthrottled local load — the module script finishes and
re-applies the theme faster than the mechanism's frame-delivery cadence can sample the gap, so the
mechanism cannot prove the failure direction under natural conditions. Candidate B
(screenshot-burst) is disqualified outright: it never once attached to the page target across 3
production runs, capturing zero frames every time. Neither clears the bar.

**SELECTED MECHANISM: Candidate C — `--mechanism throttled --throttle-ms 1000`.** It beat first
paint in all 3 production runs (margins +10.3 ms, +8.3 ms, +5.2 ms against the real, non-artifact
frame) and is the only candidate proven bidirectionally: white on the stripped-bootstrap control,
dark on the intact control, under the identical emulated network conditions.

**Disclosure paragraph (D-04/D-05 weight, per this plan's Part C requirement).** The selected
mechanism required `Network.emulateNetworkConditions` with `offline: false`, `latency: 1000ms`,
`downloadThroughput: 6400 B/s` (~50 kbps), `uploadThroughput: 6400 B/s` — a deliberately slowed load,
which is a disclosed deviation from the row's natural load conditions, exactly as D-05 discloses
the dark-OS requirement and D-04 discloses the amended discriminator wording. This does not weaken
the row: a widened navigation-to-first-paint window can only make a REAL flash more visible by
giving more wall-clock time for an intermediate mis-themed frame to be rendered and captured — it
cannot manufacture a pass on a page that has no flash, because the emulation touches only network
timing, never `Emulation.setEmulatedMedia`, `data-theme`, or any rendering override (T-25-23 is
untouched). The negative control above is the direct proof of this: the SAME throttle, applied to
the SAME kind of build, correctly produced white on the broken copy and dark on the working one —
throttling revealed the defect it was pointed at rather than hiding or inventing one. Candidate A's
disqualification is further evidence for this argument in the other direction: at natural
(unthrottled) speed, the local build's white-flash window is real but too narrow for ANY of these
three candidate mechanisms' frame-delivery cadence to sample reliably — widening it with Candidate
C's emulation is what makes the window observable at all, on this hardware, with zero-dependency
tooling.

**No verdict is scored in this plan.** Part A's production frames are timing evidence — proof that
a capture mechanism exists on this hardware that can obtain a raster frame at or before production's
own `first-paint`, and that the frame it obtains shows the correct theme with no artifact-masked
flash — not a first-paint colour verdict for a checkpoint row. R7 (the row that will actually use
this mechanism to observe production and score PASS/BLOCKED) is drafted in plan 25-09 and run in
plan 25-10.

**Cleanup:** both local HTTP servers were stopped, the scratch `control-intact`/`control-stripped`
directories (outside the repo tree) were used read-only by the harness and are not part of this
repo's working tree, and the harness's own throwaway `--user-data-dir` and Chrome child process
were torn down after every run (`ps aux` confirms no lingering `--remote-debugging-port` Chrome
processes). `git status --porcelain dist data` is empty. `capture/`'s per-run PNG frames and
`report.json` files referenced by path above are retained locally as supporting evidence and are
excluded from git via `.gitignore` (same convention as `dist`/`data` build scratch) rather than
committed, to avoid bloating history with screencast frame binaries; every path cited above is
reproducible by re-running the exact command shown for that row.
