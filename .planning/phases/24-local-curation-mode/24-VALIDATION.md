---
phase: 24
slug: local-curation-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `24-RESEARCH.md` § "Validation Architecture".

---

## Fresh Gate Run (plan 24-08, Task 1, 2026-08-27)

One fresh build, all five gate commands run in order against `git rev-parse HEAD`
`05a2d9beee2fa0f7afffc58c9ae27388bdd7e153`:

| # | Command | Exit code | Notable output |
|---|---------|-----------|-----------------|
| 1 | `npm test` | 0 | `Test Files 60 passed (60)` / `Tests 1500 passed (1500)` |
| 2 | `npx tsc --noEmit` | 0 | (no output — clean) |
| 3 | `npm run build` | 0 | `tsc` clean, produces `dist/index.js` |
| 4 | `npm run build-widgets` | 0 | `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` |
| 5 | `npm run verify-dashboard` | 0 | `40 check(s) passed, 0 failure(s).` |

Verbatim lines required by the plan's acceptance criteria:

- `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`
- `✓ GET /__curate/health -> 404 (expected, the curate health probe must never be published)`
- `✓ GET /__curate/overlay.js -> 404 (expected, the curate overlay bundle must never be published)`
- `✓ GET /__curate/exclusions/3475726256 -> 404 (expected, the curate write endpoint must never be published)`
- `✓ GET /data/best-effort-exclusions.json -> 200`
- `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`

`git status --porcelain data/best-effort-exclusions.json` after this run: empty (nothing written).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18`, `environment: 'node'` — **no DOM library** (no jsdom/linkedom) |
| **Config file** | `vitest.config.ts` (repo root) — `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` (~55 test files under `src/**`) |
| **Estimated runtime** | ~10-20 seconds full suite; subprocess guard test adds ~1s |

**Critical constraint:** the vitest `include` glob reaches `src/**` only. Script-level
tests (`scripts/**/*.test.mjs`) require widening the glob — this is a Wave 0 item.

**Second constraint:** there is no DOM environment. D-03's `data-activity-id` and
`dashboard:best-efforts-mounted` additions cannot be asserted against a live DOM.
They must be proven with the repo's existing **source-structure regression guard**
pattern (`src/dashboard/**/row-semantics.test.ts`, `row-navigation.test.ts`), which
reads source text and asserts on structure.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test files>`
- **After every plan wave:** Run `npm test` + `npm run build-widgets` + `npm run verify-dashboard`
- **Before `/gsd-verify-work`:** Full suite green, `verify-dashboard-publish.mjs` green
  including both new guard checks
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows below are the required *coverage*;
> the planner must map each to concrete task IDs and may split a row across tasks.

| Coverage Row | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Write mechanics — `upsertExclusion`/`removeExclusion` produce the exact D-05 shape (`distances: null`; untick **deletes the entry**, never leaves `distances: []`) | CUR-01 | — | N/A | unit | `npx vitest run scripts/**/curate-*.test.mjs` | ✅ `scripts/curate-server.test.mjs` | ✅ green — 36/36 passed |
| D-03 attach seam — `data-activity-id` on the `<section>`; `dashboard:best-efforts-mounted` dispatched **after** the `requestToken`/`mountedContainer` guard passes and the panel is placed | CUR-01 | — | N/A | source-structure | `npx vitest run src/dashboard/**/curation-seam.test.ts` | ✅ `src/dashboard/curation-seam.test.ts` | ✅ green — 74/74 passed |
| D-10(a)/D-11 build-time guard — extracted `assertNoCurationArtifacts` returns violations against a **planted** fake curate artifact and an empty list against a clean tree | CUR-01 | T-24-CUR-01 | Curate bundle/marker cannot reach `dist/widgets` | unit, planted-fixture | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ `scripts/lib/curation-guard.test.mjs` | ✅ green — 11/11 passed |
| D-10(b)/D-11 HTTP guard — the real `verify-dashboard-publish.mjs` exits non-zero when a fake `/__curate/*` file is planted in `dist/widgets`, and exits 0 when clean | CUR-01 | T-24-CUR-02 | Write endpoints unreachable in publish bundle | integration, subprocess, planted-fixture | `npx vitest run scripts/**/verify-dashboard-publish-guard.test.mjs` | ✅ `scripts/verify-dashboard-publish-guard.test.mjs` | ✅ green — 5/5 passed |
| **Non-regression** — `/data/best-effort-exclusions.json` still returns 200 and parses (`verify-dashboard-publish.mjs:294`); the new guards must not catch it | CUR-01 | — | N/A | integration | `npm run verify-dashboard` | ✅ exists | ✅ green — 40/40 checks passed (exit 0), including `✓ GET /data/best-effort-exclusions.json -> 200` and `✓ /data/best-effort-exclusions.json parses with an "exclusions" array` |
| D-12 Origin/Host check — write endpoints reject mismatched `Origin`/`Host`, accept matching | CUR-01 | T-24-CUR-03 | Drive-by CSRF / DNS rebinding rejected | unit (pure `isTrustedOrigin`) | `npx vitest run scripts/**/curate-*.test.mjs` | ✅ `scripts/curate-server.test.mjs` | ✅ green — 36/36 passed (same file/run as the Write-mechanics row) |
| Read-path tolerance unchanged — T-16-EX-01 / T-16-EX-02 still green (D-05: do **not** remove distance-array support) | CUR-01 | — | N/A | unit (existing) | `npm test` | ✅ exists | ✅ green — full suite 60 files / 1500 tests passed |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — widen `include` to `['src/**/*.test.ts', 'scripts/**/*.test.mjs']`
      (required by every script-level test above) — done in plan 24-01
- [x] `scripts/lib/curation-guard.mjs` — extract the guard as a **pure, importable**
      function so D-11 can plant a fixture and observe it failing — done in plan 24-01
- [x] `scripts/lib/copy-data-tree.mjs` — extract the data-copy walk shared by
      `build-widgets.mjs` and the curate server's recompute mirror
      (`build-widgets.mjs` self-executes on import and cannot be reused as-is) — done in plan 24-01
- [x] `src/dashboard/**/curation-seam.test.ts` — new source-structure test file
      (no framework install needed; follows existing precedent) — done in plan 24-02

---

## Expected Values (pinned 2026-08-27, pre-exclusion)

> Derived LIVE from the data files below, BEFORE any exclusion is written by Task 2's
> checkpoint. The checkpoint's job is to compare the rendered UI against these numbers — not to
> check that the UI agrees with itself (T-24-EXTENT). Every one of these values was re-derived
> from disk in this session rather than trusted from the plan's planning-time literals; all of
> them happen to match those literals exactly, which is itself confirmation the nightly workflow
> has not refreshed the archive since planning.

**Build identity (this gate run):**
- `assets/index-xwaleiOf.js`
- `assets/index-B573RjUr.css`
- These are the ONLY hashes Task 2's rows are valid against. If the developer's browser reports
  different hashes, hard-reload; if they still differ, the round is invalid per T-24-CACHE.

**Exclusion target**, from `data/stats/best-efforts.json`'s `rankings` object:
- `activityId`: **4556693525**
- `startDate`: **2021-01-02T08:00:54Z**
- Appears in three distances' rankings: `400m` (rank **1**, `durationSec` 45.2), `1k` (rank 8,
  `durationSec` 207.4), `1mi` (rank 9, `durationSec` 393.8) — it holds **rank 1 only in `400m`**.

**Rank-2 promotion target (the value R8 is judged against)**, for the one distance (`400m`) where
the target holds rank 1:
- `activityId`: **3475727228**
- `durationSec`: **46.5**
- `startDate`: 2019-04-02T16:38:33Z
- This activityId (3475727228) is a **DIFFERENT** activity from the exclusion target
  (4556693525) — confirmed by direct string comparison of the two ids above.

**Weekly total (the value R9 is judged against)**, from `data/stats/weekly-distance.json`, the
entry whose `weekStartISO`..`+7d` window covers the target's `startDate`:
- `weekStartISO`: **2020-12-28T00:00:00.000Z**
- `totalKm`: **88.864**
- `runCount`: **7**

**Monthly total (the second value R9 is judged against)**, from `data/stats/monthly-stats.json`,
the entry for the target's month:
- `periodLabel`: **Jan 2021**
- `totalKm`: **362.2411**
- `runCount`: **29**

**Pre-checkpoint archive state**, from `data/best-effort-exclusions.json`:
- `exclusions` array length: **2**
- `git rev-parse HEAD`: **05a2d9beee2fa0f7afffc58c9ae27388bdd7e153**
- `git status --porcelain data/best-effort-exclusions.json`: **empty** (confirmed after this
  Task — nothing has been written yet)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end curation: `npm run curate`, tick "Exclude this run from PRs", enter a reason, Save | CUR-01 (criteria 1, 2) | No DOM test environment; the loop spans a browser, a Node server and two files on disk | Start `npm run curate`; open an activity detail view under `/strava-widgets`; tick the box; confirm Save is inert with an empty reason; enter a reason; Save; confirm the entry appears in `data/best-effort-exclusions.json` with `distances: null` and the typed reason |
| Reason surfaced in the detail view | CUR-01 (criterion 2) | Rendering assertion; the `Excluded — {reason}` badge at `detail-sections.ts:349` must become reachable without a hand-edit | After Save, confirm the `Excluded — {reason}` badge renders in the Best Efforts panel **in the same session**, without a manual rebuild (D-07's instant mirror) |
| Untick deletes the entry | CUR-01 | Destructive path with a confirm gesture (D-08) | Untick an excluded run, accept the confirm, verify the entry is **removed** from the array — not left as `distances: []` |
| Recompute promotes the next-best effort | CUR-01 (D-07) | Requires observing a cross-activity ranking change | Press "Recompute records"; confirm progress streams, the page reloads, and the promoted next-best effort comes from a **different** activity |
| Production build has no reachable curation write path | CUR-01 (criterion 4) | Requires a real browser against the real publish bundle | Build, serve `dist/widgets` under `/strava-widgets`, load in a real browser; confirm `/__curate/health`, `/__curate/overlay.js` and the write endpoint all 404, and no curation control renders |
| Totals unaffected by exclusion | CUR-01 | Confirms the structural claim in CONTEXT.md § Established Patterns | Confirm weekly distance / monthly / yearly stats are unchanged after excluding an activity (`loadExclusions` reaches only `compute-best-efforts.ts`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] **D-11 discharged: each new guard has been *observed failing* against a planted
      regression** — a guard that has never been seen red is not evidence
      (Phase 19 R3-CR-01, Phase 23 WR-06)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
