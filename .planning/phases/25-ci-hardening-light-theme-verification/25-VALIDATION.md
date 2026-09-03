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

Plan/Task columns are `TBD` until `/gsd-plan-phase` writes PLAN.md files; the planner must fill them and keep the row set intact.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FIX-02 (D-12) | — | Non-string / empty `gearName` degrades to the Unknown bucket rather than reaching `slugify(undefined)` | unit | `npx vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ existing | ⬜ pending |
| TBD | TBD | TBD | FIX-02 (D-12, second site) | — | `buildGearCoverage` (`gear-aggregate-logic.ts:207`) uses the same widened predicate — silent mis-bucketing closed alongside the crash | unit | `npx vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ existing | ⬜ pending |
| TBD | TBD | TBD | FIX-02 (D-13) | V5 Input Validation | `gearName` optional on the row type; every consumer making the presence assumption is enumerated by the compiler and either fixed or recorded as a todo | type-check | `npx tsc --noEmit` | N/A — compiler check | ⬜ pending |
| TBD | TBD | TBD | CI-01 (D-01) | — | The eight compute steps' order and mandatory/tolerated disposition are declared once, in an importable data structure, and asserted by test | unit | `npx vitest run <new step-table test file>` | ❌ **Wave 0** | ⬜ pending |
| TBD | TBD | TBD | CI-01 (D-02) | — | The CI flag flips tolerated-step disposition to warn-and-continue and leaves mandatory steps fail-fast | unit | same new file | ❌ **Wave 0** | ⬜ pending |
| TBD | TBD | TBD | CI-01 (D-03) | — | End-of-run failure summary names every degraded step; `::warning::` annotations still surface in the Actions run summary | unit + manual (workflow run) | same new file; evidence from `gh workflow run` | ❌ **Wave 0** | ⬜ pending |
| TBD | TBD | TBD | CI-02 (D-09) | — | Each of the six documents returns 200, parses as JSON, and satisfies one structural invariant a truncated/empty file would fail | integration (HTTP smoke) | `npm run verify-dashboard` | ✅ existing, extended | ⬜ pending |
| TBD | TBD | TBD | CI-02 (D-10) | — | The per-activity best-effort shard sample is derived at runtime (no pinned ids), following `verify-dashboard-publish.mjs:430-455` | integration | `npm run verify-dashboard` | ✅ existing, extended | ⬜ pending |
| TBD | TBD | TBD | CI-02 (D-11) | Tampering — "the verifier lies" | Each of the six new assertions observed RED once, naming its own document | scripted one-off (validation-round activity, not a committed test) | delete/truncate target in a scratch `dist/widgets` → `npm run verify-dashboard` exits non-zero **naming that document** → restore → green | N/A — round activity | ⬜ pending |
| TBD | TBD | TBD | WR-19 (folded todo) | V1 Architecture — fail-closed | A mode-000 directory under `dist/widgets` is reported as a violation, not thrown as an uncaught `EACCES`; the guard stays fail-**closed** | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ existing — add mode-000-**directory** fixture | ⬜ pending |
| TBD | TBD | TBD | WR-19 (D-11 precedent) | — | The new directory fixture observed RED before the guard fix lands | scripted one-off | run the new fixture against unfixed `curation-guard.mjs`, confirm failure | N/A — round activity | ⬜ pending |
| TBD | TBD | TBD | VER-01 (D-06) | — | Inline bootstrap in `index.html` resolves the same `(mode, prefersDark) → effective theme` as `theme.ts` across all combinations; `'light' \| 'dark' \| 'auto'` allow-list intact (T-16-TH-01); script still ordered before the stylesheet link | unit (behavioural, `node:vm` sandbox) | `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` *(name is the planner's call)* | ❌ **Wave 0** | ⬜ pending |
| TBD | TBD | TBD | VER-01 (D-04/D-05/D-07/D-08) | — | Legibility, first-paint, and live OS-follow confirmed from a genuine light-OS environment against the production build | **manual — human checkpoint** | N/A (see § Manual-Only Verifications) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **New test file for CI-01's step table** — `src/index.ts` has *zero* test coverage today; no command in it is imported and unit-tested anywhere. Per RESEARCH Pattern 1, extract an exported ordered array of `{ name, mandatory, run }` and test that constant directly, importing only the constant so the test never touches `process.exit`.
- [ ] **`src/dashboard/theme-bootstrap-parity.test.ts`** (suggested name) — D-06's `node:vm` behavioural pin. Must sit alongside `theme.test.ts` per CONTEXT.md canonical refs.
- [ ] **mode-000-directory fixture in `scripts/lib/curation-guard.test.mjs`** — the file-shaped sibling (WR-14 case c) exists; the directory-shaped one does not.
- [ ] **Six new assertion blocks in `scripts/verify-dashboard-publish.mjs`** — additive to an existing file in its existing `expect200`/`ok`/`fail` style; no framework gap.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard is legible with light appearance set at the **OS** level | VER-01 / criterion 4 | Requires a real OS appearance setting; no jsdom or headless browser in this repo, and an in-page toggle explicitly cannot satisfy it | **D-04:** start from cleared site data (or a fresh profile) and quote `localStorage.getItem('dashboard-theme')` returning `null` *at the instant of observation* — `theme.ts` reads the persisted mode **before** falling back to `prefers-color-scheme`, so a browser whose in-page control has ever been touched ignores the OS entirely and a masked row is indistinguishable from a passing one. Quote `matchMedia('(prefers-color-scheme: dark)').matches` before and after. **D-08:** run against `https://bacilo.github.io/strava-widgets/` with hard-reload after every change (this repo has a documented history of a stale cached `index.html` producing false evidence). |
| No first-paint white flash | VER-01 / criterion 4 | Same as above, plus frame capture | **D-05 — deliberate deviation from criterion 4's literal wording, which MUST be disclosed as such in the write-up, not quietly substituted.** Observe this row with the OS in **dark** appearance. Light `--bg` is `#ffffff` (`styles.css:18`), so on a light OS a white first paint *is* the correct final state and cannot discriminate a working pre-paint theme from a broken one. On dark OS, a white first frame is the failure and `#1a1a2e` (`styles.css:105`) is the pass. Legibility stays on light OS; live-follow spans both. |
| Live-follows an OS appearance change light → dark → back | VER-01 / criterion 4 | The gesture the requirement calls human stays human | **D-07 hybrid execution**, mirroring Phase 24's R34: the developer personally changes appearance in System Settings; the agent handles the surrounding instrumentation (cleared-storage assertion, frame capture, `matchMedia` reads before and after). `osascript`-driven switching was considered and **rejected** for the recorded rows. |
| A real (or dry-run) nightly workflow execution | CI-01 / criterion 5 | Exercises the actual Actions runner | `daily-refresh.yml` already has `workflow_dispatch` (confirmed present). Trigger with `gh workflow run "Daily Widget Refresh"`, then capture the run's step output — specifically that the single collapsed compute step's log carries the per-step names and the end-of-run failure summary that the eight separate green/red boxes used to provide (D-01's accepted cost). |
| Green `verify-dashboard-publish.mjs` run | CI-02 / criterion 5 | Runs against a served build | `npm run verify-dashboard` exits 0 and reports the six new checks among its "N check(s) passed" total. |

---

## Checkpoint Row Discipline (inherited precedents — non-negotiable)

This phase's checkpoint rows have a documented failure history in this repo. Three rules carry forward:

1. **A guard only counts once observed RED** (Phase 24 D-11). Applies to all six CI-02 assertions and to WR-19's new fixture. GAP-24-02 existed precisely because a guard's blind spot was never observed failing.
2. **Rows assert reachable extent against an independently-derived value, never internal agreement** (Phase 23 CR-01, Phase 24 R32). D-04's quoted `null` storage read and D-05's dark-OS framing exist to give VER-01's rows a real discriminator.
3. **HALT before presenting a row whose discriminator is unreachable** (Phase 24 § "Round 4 Checkpoint (R32-R35)"). A row's own mandated setup can empty the thing it exists to test — check reachability before blaming the code. VER-01's first-paint row is the live instance: as literally worded it is vacuous, which is why D-05 reframes it.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references (4 items above)
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 7s
- [ ] All six CI-02 assertions + WR-19's fixture observed RED and recorded
- [ ] D-05's deviation from criterion 4's literal wording disclosed in the write-up
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
