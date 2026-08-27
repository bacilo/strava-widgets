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
`05a2d9beee2fa0f7afffc58c9ae27388bdd7e153` (the pre-Task-1 tree). Task 1's own docs-only commits
of `24-VALIDATION.md` then advance HEAD past that value, so no literal hash written INTO this file
can name the HEAD that will be in place once the file itself has been committed — each correction
invalidates its own pin. The checkpoint baseline is therefore defined operationally, not as a
literal: see "Expected Values" below.

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
- `git rev-parse HEAD` (BASELINE for R5/R11/the final state check) — **recorded by the
  developer, not pinned here**. Before ROW R1, run `git rev-parse HEAD` and write the value down;
  that recorded value is `BASELINE_HEAD`. R5, R11 and the final state check pass only if
  `git rev-parse HEAD` still equals it. This is what D-09 actually asserts: curate creates no
  commit, so HEAD at the end of the session equals HEAD at the start. A literal pin cannot serve
  here — committing the pin moves HEAD past it (this is exactly how `cf18820` was stale on
  arrival, corrected at hand-off).
  - (for reference only: HEAD immediately before Task 1's first docs commit was
    `05a2d9beee2fa0f7afffc58c9ae27388bdd7e153`; at checkpoint hand-off it was
    `1d58c79cf98ed1a8762231203d8eaf2d27130179` plus this correction commit)
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

---

## Checkpoint Round 1 (plan 24-08, Task 2, 2026-08-27)

**BASELINE_HEAD recorded at session start:** `44e6f3ad56a441c939c12e673671b3107f8579e8`

**Build identity verified in-browser before ROW R1:** DevTools `performance` resource entries
reported `index-xwaleiOf.js` and `index-B573RjUr.css` — exactly the hashes Task 1 recorded. The
round is valid against those bytes. A cache-busting query string was used on every page load, and
the documented staged-build cache trap was explicitly ruled out at R5 (see that row).

### Evidence provenance (non-waivable disclosure)

Per the developer's explicit delegation this round was driven by the agent via Claude-in-Chrome
against a real Chrome browser, NOT by a human hand. Recording it as a human round would be false.
Specifically:

| Evidence class | How it was produced | Counts as |
|---|---|---|
| Mouse clicks (tickbox, Save, Recompute, tabs, zoom/pan buttons) | `computer` tool `left_click` in real Chrome | Real browser, agent-injected |
| Keyboard (typing reasons, Tab order, Shift+Tab) | `computer` tool `key`/`type`; `isTrusted: true` verified and recorded per focus stop | Trusted keyboard, agent-injected — NOT a human gesture |
| Hover (chart tooltips) | `computer` tool `hover` | Real browser, agent-injected |
| Terminal rows (R1, R2, R13, R14) | Run by the agent, not the developer | Exit codes are the agent's, not the developer's |
| ROW R10 confirm() dialogs | **Deferred to the developer** — a native `window.confirm()` blocks the browser-automation extension outright | Human-only |

No row below was passed on a synthesised event, a headless probe, or a `window.confirm` override.

### Row verdicts

| Row | Verdict | Quoted evidence |
|-----|---------|-----------------|
| R1 | **PASS** | `FATAL: dist/widgets is not fully built.` / `Missing: /Users/pedf/workspace/strava-widgets/dist/widgets/index.html` / ``Run `npm run build-widgets` first, then re-run `npm run curate`.`` — exit code **1**, no server started. `dist/widgets` restored afterwards. |
| R2 | **PASS** | Banner: `curate server running at http://127.0.0.1:4173/strava-widgets/`. Second launch: `FATAL: port 4173 is already in use.` / ``curate deliberately does not hunt for a free port (OD-4) …`` — exit **1**. First server still answering `200` afterwards. |
| R3 | **PASS** | Document contains `<script src="/__curate/overlay.js"></script>` (quoted verbatim from `outerHTML`). `document.querySelectorAll('section[data-activity-id="4556693525"]').length` → **1**. Best Efforts panel rendered normally (400m `0:45`, 1K `3:27`, 1 Mile `6:34`, 5K `24:59`, 10K `55:08`) with the curation controls appended below it. |
| R4 | **PASS** | On-screen message: **“A reason is required before saving.”** `git diff --stat data/best-effort-exclusions.json` → **no output**. Array length still **2**. |
| R5 | **FAIL** (write half PASS, render half FAIL) | Write half PASS: entry `{"activityId": "4556693525", "distances": null, "reason": "CHECKPOINT-2026-08-27 GPS device unreliable"}`; `git rev-parse HEAD` still `44e6f3ad…` = BASELINE_HEAD (D-09 holds). Render half FAIL: **no `Excluded — …` badge appeared after Save.** See FINDING F-1. |
| R6 | **PASS** | Save button: `min-height` **`32px`**, `border-radius` **`4px`**. Textarea: `min-height` **`32px`**, `border-radius` **`4px`**. `--radius-control` resolves to **`4px`** — the token is live, not dead (Phase 19 GAP 1 does not recur). Keyboard-only Tab order textarea → Save → Remove exclusion → Recompute records, every stop `isTrusted: true`. Focus ring is delivered via `box-shadow` (`rgb(26,26,46) 0 0 0 2px, rgb(255,107,53) 0 0 0 …` — dark halo + orange ring), `outline-style: none`. Ring confirmed visually on Save, Remove exclusion and Recompute records: unclipped on all four sides and painted OVER the adjacent control rather than under it (Phase 19 GAP 2 does not recur). |
| R7 | **PASS** (write half; badge half blocked by F-1) | After hard reload: checkbox **pre-ticked**, textarea **pre-filled** with `CHECKPOINT-2026-08-27 GPS device unreliable`. After editing to `CHECKPOINT-2026-08-27 edited` and Save, on-disk reason became `CHECKPOINT-2026-08-27 edited` and the `exclusions` array length is **3** — Task-1 length 2 **plus one**, not plus two. Badge did not render at this point (F-1); it did render after R8's recompute. |
| R8 | **PASS** | Records screen 400 m table rank 1 now displays time **`0:47`**, date **`Apr 2, 2019`**, and its row links to **`#/activity/3475727228`** (read from the `href`, not a label). **`3475727228` DIFFERS from the excluded activity `4556693525`.** Matches Task 1's pinned rank-2 promotion target (`3475727228`, `durationSec` 46.5; the UI displays 46.5 s as `0:47`). The excluded activity no longer appears anywhere in the 400 m table. Header `PR — 400m` badge on the excluded activity disappeared. **Not observed:** the streaming progress text — the recompute completed and reloaded before a frame could be captured. Recorded as not-observed rather than passed. |
| R9 | **PASS** | Weekly, week of 2020-12-28 (pinned **88.864 km / 7 runs**): the Calendar clips week totals to month boundaries, so the week renders as two cells — `Partial week, 4 days shown, week of December 28–31, 2020, 46.6 km, 4h 33m, 4 runs` and `Partial week, 3 days shown, week of January 1–3, 2021, 42.3 km, 4h 10m, 3 runs` → **46.6 + 42.3 = 88.9 km** (88.864 at 1 dp) and **4 + 3 = 7 runs**. Monthly, Jan 2021 (pinned **362.2411 km / 29 runs**): Trends → Volume → Monthly tooltip read **`362.2 km, 29 runs`**. Both match their pinned pre-exclusion values while the exclusion was active. |
| R10 | *(deferred to developer — native `confirm()` blocks the automation extension)* | — |
| R11 | *(pending R10)* | — |
| R12 | *(pending R10/R11)* | — |
| R13 | *(pending R10/R11)* | — |
| R14 | **PASS** | `-H "Origin: http://evil.example"` → **`HTTP/1.1 403 Forbidden`**. `-H "Host: evil.example"` → **`HTTP/1.1 403 Forbidden`**. Neither request altered the file: the stored reason was still `CHECKPOINT-2026-08-27 edited` immediately afterwards. Run out of plan order (before R10/R11), so the file was legitimately still modified by R5/R7 at the time; the empty-`git status` half of this row is re-checked after R11. |

### Findings (recorded verbatim, left UNPATCHED per the house rule since 16-09)

**F-1 — the `Excluded — {reason}` badge does not appear at Save; it requires the Recompute step.**
R5 expects the badge in the same session immediately after Save, before Recompute. It did not appear.
Cache was explicitly ruled out first, per T-24-CACHE: the page reload was confirmed
(`performance.getEntriesByType('navigation')[0].type === "reload"`), the app re-fetched
`best-effort-exclusions.json` after that reload, and a cache-busted fetch returned byte-identical
JSON already containing the new entry (`identical: true`, `exclusions.length: 3`). So the data was
present and correct while the badge was absent.

Mechanism, from source: `detail-sections.ts:348` gates the badge on `row.excluded`, which
`detail-best-efforts-logic.ts:95` reads from `effort.excludedFromRecords` — a field baked into the
precomputed `data/stats/best-efforts.json`, NOT from the live exclusions file. Only
`exclusionReason` is loaded live (`detail.ts:507`), and it merely decorates a badge that the
precomputed flag must first enable. Saving writes `best-effort-exclusions.json` alone, so the flag
stays false until `compute-best-efforts` reruns.

After R8's Recompute the flag flipped (`"excludedFromRecords": true` on all five efforts) and the
badge rendered correctly on every distance row: **`Excluded — CHECKPOINT-2026-08-27 edited`**.

Assessment: criterion 2 IS reachable in-session and with no `npm run build-widgets` — but via
Save **then Recompute**, not via Save alone. The defect is in the plan's stated sequencing versus
the implementation's data flow, not in the feature being unreachable. Severity: Medium. The
CUR-01 disposition below is written against what was actually observed.

**F-2 (incidental, out of Phase 24 scope) — Trends → Volume → Monthly tooltip title renders a raw
epoch timestamp instead of a month label.**
Observed while gathering R9's monthly figure. The tooltip title read **`1,609,459,200,000`** for
Jan 2021 and **`1,693,526,400,000`** for Sep 2023 (= 2021-01-01 and 2023-09-01 in epoch
milliseconds) where a label like `Jan 2021` belongs. The value line beneath it is correct
(`362.2 km, 29 runs` and `201.4 km, 15 runs` respectively). Reproduced on a freshly loaded page
with **no** instrumentation attached, so it is not an artefact of the canvas patching used earlier
in the session. This belongs to the Trends/volume chart work, not to CUR-01 — recorded here only
because this checkpoint is where it surfaced.

**F-3 (incidental, out of Phase 24 scope) — Monthly volume chart zoom-out appears caged at a
5-year window.** The `−` / "Zoom out" button is enabled but two consecutive clicks left the
chart's own `aria-label` unchanged at `Monthly distance chart, Aug 2021 to Aug 2026`; only the `←`
pan button moved the window (to `May 2020 to May 2025`). The archive begins well before 2020. This
is the same shape as Phase 23's Critical CR-01 (zoom-out caged at ~5 years of a ~15-year archive)
and should be checked against that fix rather than assumed resolved. Not investigated further —
outside this phase's scope.

### Observations (not defects, not blocking)

- The control row renders with no separation between the label and the following control: the
  accessible text reads `Exclude this run from PRsReason (required)SaveRemove exclusionRecompute
  records`. Bare unstyled elements are what OD-3 chose, so this is noted, not raised.
- R4's "A reason is required before saving." message carries no `role="alert"`/`role="status"` and
  the textarea gets no `aria-invalid`, so the error is visible but not announced to a screen reader.
- `dist/widgets/test.html` is tracked in git but is no longer emitted by `build-widgets`; it shows
  as a pending deletion in `git status` throughout. Pre-existing, unrelated to curation.

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
