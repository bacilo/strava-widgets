---
phase: 25
slug: ci-hardening-light-theme-verification
status: draft
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
| 25-07-T2 | 25-07 | 4 | VER-01 (D-04/D-05/D-07/D-08) | — | Legibility, first-paint, and live OS-follow confirmed from a genuine light-OS environment against the production build | **manual — human checkpoint** | N/A (see § Manual-Only Verifications) | N/A | ⬜ pending — plan 25-07 owns this row |

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

*(plan 25-07, Task 1, drafted 2026-09-04 — not yet run; every Verdict cell below reads `pending`)*

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

| Row | Verdict | Discriminator | Evidence (to be filled in Task 2) |
|-----|---------|----------------|-----------------------------------|
| R1 | pending | | |
| R2 | pending | | |
| R3 | pending | | |
| R4 | pending | | |
| R5 | pending | | |
| R6 | pending | | |

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
Verdict: **pending**.

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
Verdict: **pending**.

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
Verdict: **pending**.

**R4 — Live-follow dark -> light (the "and back" half of criterion 4).**
Same shape as R3, page still open from R3, NOT reloaded, theme toggle NOT clicked at any point.
Setup: developer changes Appearance back to LIGHT in System Settings.
Discriminator: same three quotes as R3, expected to flip back (`true`->`false`, `'dark'`->
`'light'`), `dashboard-theme` still `null`/`'auto'` throughout. Kept as a separate row from R3
rather than folded in, because "and back" is a distinct transition and the listener could
plausibly fire in one direction only.
Verdict: **pending**.

**R5 — Cache-trap exclusion (D-08).**
Setup: no further OS or storage change; runs against the same loaded page state as R4 (or a fresh
hard reload if needed to re-establish a clean read).
Discriminator: the served `index.html`'s hashed module-script filename, quoted and shown to match
the asset in the latest deployed build; `performance.getEntriesByType('navigation')[0].type ===
'reload'`; and a cache-busted refetch of `index.html` (e.g. `fetch('./index.html?cachebust=' +
Date.now())`) shown byte-identical to the document the browser actually used. This repo has a
documented history of a stale cached `index.html` producing false evidence (T-25-21).
Verdict: **pending**.

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
Verdict: **pending** — pending Task 3's read of whether the CI-01 live-run gap affects this row's
disposition (see Task 3's row-to-requirement mapping and the governing all-rows-PASS rule).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — confirmed by plan 25-06 Task 1's Per-Task Verification Map pass
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed, no gap found
- [x] Wave 0 covers all ❌ MISSING references (4 items above) — all four now landed (waves 1-2) and confirmed present/green by this task
- [x] No watch-mode flags (`vitest run`, never bare `vitest`) — `npm test` invokes `vitest run` per `package.json`; confirmed by the three quoted runs above, none of which hung waiting on watch mode
- [x] Feedback latency < 7s — all three `npm test` runs quoted above completed in 6.65s-6.89s
- [x] All six CI-02 assertions + WR-19's fixture observed RED and recorded — transcribed verbatim in the RED-evidence section above
- [ ] D-05's deviation from criterion 4's literal wording disclosed in the write-up — plan 25-07 owns this (human checkpoint write-up)
- [ ] `nyquist_compliant: true` set in frontmatter — plan 25-07 owns this (gated on the human checkpoint)

**Approval:** pending — automated half (this plan, 25-06) complete; plan 25-07's human checkpoint (VER-01 row) still required before sign-off can close.
