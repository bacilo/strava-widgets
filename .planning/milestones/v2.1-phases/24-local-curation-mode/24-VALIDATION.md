---
phase: 24
slug: local-curation-mode
status: complete
nyquist_compliant: true
wave_0_complete: true
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

## Round 1 Checkpoint (R1-R14)

*(plan 24-08, Task 2, 2026-08-27)*

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
| R10 | **PASS** | Performed by the **developer** (the only human-hand row this round). Confirm dialog text, in the developer's own words: **“Removing this exclusion deletes it and changes PR history. Continue?”** — it names the consequence, per D-08. After Cancel then a second untick with OK, read back from disk: (a) **no entry with `"activityId": "4556693525"` remains**; (b) `grep -c '"distances": \[\]' data/best-effort-exclusions.json` → **`0`**; (c) `exclusions` array length back to **`2`** = the Task-1-recorded length. `git status --porcelain data/best-effort-exclusions.json` was already **empty** at this point. *Not independently observed by the agent:* that Cancel left the entry in place and returned the checkbox to ticked — recorded on the developer's report plus the final length of 2. |
| R11 | **PASS** | After the second Recompute, `data/stats/best-efforts.json` `rankings['400m']` rank 1 is once more **`4556693525`** at `durationSec` **45.2**, with `3475727228` back at rank 2 (46.5). Rendered Records screen 400 m rank 1: time **`0:45`**, date **`Jan 2, 2021`**, link **`#/activity/4556693525`**; the word “Excluded” appears **nowhere** on the page. `git status --porcelain data/best-effort-exclusions.json` → **no output** — byte-identical to its pre-checkpoint state. |
| R12 | **PASS** | Curate stopped; `dist/widgets` served by a plain static Node server under `/strava-widgets` (port 4180) and loaded in real Chrome. (a) **No curation control renders** — the enumeration of `button,input,textarea` inside the Best Efforts panel returned **`[]`**, and the panel shows the normal `400m 0:45 … PR` table. (b) **`document.documentElement.outerHTML.includes('__curate')` → `false`**; the document's only script src is `./assets/index-xwaleiOf.js` — no overlay tag. Served `index.html` contains **0** occurrences of `__curate` per `curl \| grep -c`. (c) `GET /strava-widgets/__curate/health` → **404**, `…/overlay.js` → **404**, `…/exclusions/4556693525` → **404** (control: `GET /strava-widgets/` → 200). (d) In the DevTools console, the `PUT` to `/strava-widgets/__curate/exclusions/4556693525` returned **status 404** (`ok: false`), and `git status --porcelain data/best-effort-exclusions.json` afterwards was **empty**. |
| R13 | **PASS** | Planted `dist/widgets/__curate/overlay.js` containing the literal `__curate`. `npm run build-widgets` → **exit code 1** with two guard lines: **`✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/__curate — a directory named "__curate" must never exist under the published bundle`** and **`✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/__curate/overlay.js — file contents contain the literal "__curate" marker — the curation write path must be structurally absent from the published bundle`**. After `rm -rf dist/widgets/__curate`, re-running exited **0** with **`✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`** The clean rebuild reproduced the same asset hashes (`index-xwaleiOf.js`, `index-B573RjUr.css`), so R12 ran against the pinned build identity. |
| R14 | **PASS** | `-H "Origin: http://evil.example"` → **`HTTP/1.1 403 Forbidden`**. `-H "Host: evil.example"` → **`HTTP/1.1 403 Forbidden`**. Neither request altered the file: the stored reason was still `CHECKPOINT-2026-08-27 edited` immediately afterwards. Run out of plan order (before R10/R11), so the file was legitimately still modified by R5/R7 at the time; the empty-`git status` half of this row is re-checked after R11. |

### Final state check

| Assertion | Observed |
|---|---|
| `git status --porcelain data/best-effort-exclusions.json` empty | **empty** (`''`) |
| `exclusions` array length restored | **2** (Task-1-recorded length) |
| `dist/widgets/__curate` absent | **absent** |
| HEAD unchanged across the curate session | **held.** R1-R11 ran against `BASELINE_HEAD` `44e6f3ad…`, unchanged throughout — curate created no commit (D-09). The agent then made one **docs-only** commit (`5262b91`, this file) between R14 and R10, so R10-R13 ran against baseline `5262b91…`, also unchanged. Neither commit came from curate; D-09 is about the curate write path and holds for both segments. |
| Working tree otherwise clean | only the pre-existing, unrelated `D dist/widgets/test.html` |

---

## Gap-Closure Record

**GAP-24-01 — `Excluded — {reason}` badge does not render at Save (ROW R5, FAIL).**

Observed, verbatim: after ticking the box, entering `CHECKPOINT-2026-08-27 GPS device unreliable`
and pressing Save, the page reloaded and the Best Efforts panel showed **no** `Excluded — …` badge
on any distance row. The entry was on disk and correct at that moment
(`{"activityId": "4556693525", "distances": null, "reason": "CHECKPOINT-2026-08-27 GPS device unreliable"}`),
and the browser had re-fetched it: `performance.getEntriesByType('navigation')[0].type` was
`"reload"`, the app fetched `best-effort-exclusions.json` twice after that reload, and a
cache-busted fetch returned byte-identical JSON (`identical: true`, `exclusions.length: 3`).
The documented staged-build cache trap was therefore excluded before the FAIL was recorded.

The badge did render — `Excluded — CHECKPOINT-2026-08-27 edited`, on all five distance rows —
only after ROW R8's "Recompute records". The reverse asymmetry was also observed at R11: with the
exclusion already deleted from disk but the stats not yet recomputed, the panel showed the
reason-less fallback badge **`Excluded from records`** on all five rows.

ROADMAP criterion 2 requires the reason to render "in the same session, with no rebuild". It does
render in-session and with no `npm run build-widgets` — but only after the Recompute step, not
after Save alone, which is the sequencing ROW R5 asserts.

No fix is proposed here, per the house rule since 16-09. The next planning round diagnoses it.

**RESOLVED 2026-09-01 (plan 24-10, Round 2 Checkpoint, R15 and R19 both PASS).** Plan 24-09
derived `buildBestEffortsPanelRows`'s `excluded` flag from a live `data/best-effort-exclusions.json`
read at render time instead of the precomputed `excludedFromRecords` flag. Round 2 re-ran R5's
exact sequencing (tick, reason, Save, badge check, BEFORE any Recompute) as **ROW R15**: the badge
rendered immediately as `Excluded — ROUND2-2026-09-01 GPS device unreliable`, cache trap excluded
first (`navigation[0].type === "reload"`, refetch confirmed, cache-busted fetch identical). The
mirror direction closed at **ROW R19**: after untick + confirm + OK, WITHOUT any Recompute, no
badge of any kind rendered (neither `Excluded — {reason}` nor the reason-less `Excluded from
records` fallback R11 observed) — and this was proven against an independently-derived value, not
the UI agreeing with itself: the precomputed `data/stats/best-efforts.json` still carried
`excludedFromRecords === true` for all five distances at that moment (R17's Recompute had not
been rerun since), so a badge gated on the old precomputed flag would have shown the reason-less
fallback. It showed nothing — the flag can only have come from the live document. GAP-24-01 is
**CLOSED**.

---

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

**F-2 (incidental, out of Phase 24 scope; NOT a new defect — a known one, wider than recorded) —
the raw-epoch tooltip title also affects Trends → Volume → Monthly, not only Training Load.**
Observed while gathering R9's monthly figure. The tooltip title read **`1,609,459,200,000`** for
Jan 2021 and **`1,693,526,400,000`** for Sep 2023 (= 2021-01-01 and 2023-09-01 in epoch
milliseconds) where a label like `Jan 2021` belongs. The value line beneath it is correct
(`362.2 km, 29 runs` and `201.4 km, 15 runs` respectively). Reproduced on a freshly loaded page
with **no** instrumentation attached, so it is not an artefact of the canvas patching used earlier
in the session.

This is the same defect already on record: `23-07-SUMMARY.md` finding 6 logged it as
**pre-existing from Phase 18** (verified against `61ee687`) and `23-10-PLAN.md` explicitly scoped
it out of Phase 23. What is new here is only its **extent** — the existing record names the
*Training Load* tooltip; this round shows the *Volume → Monthly* tooltip has it too, so whoever
picks it up should treat it as a shared formatter defect across `trends-charts.ts` rather than a
single-chart fix. Nothing about CUR-01 depends on it.

**F-3 (incidental, out of Phase 24 scope; UNCONFIRMED — needs a dedicated check, do not treat as
established) — Monthly volume chart zoom-out may still be caged at a 5-year window.** The `−` /
"Zoom out" button reported `disabled: false`, but two consecutive clicks left the chart's own
`aria-label` unchanged at `Monthly distance chart, Aug 2021 to Aug 2026`; only the `←` pan button
moved the window, to `May 2020 to May 2025`. The archive begins well before 2020.

Confidence and its limits: clicks in that same control row were landing (the `←` click at the
adjacent coordinate did change the range), which argues the `−` clicks were not simply missing —
but this was a two-click incidental observation taken while gathering R9's monthly figure, not a
row with a pinned expected value, and no reachable-extent value was derived independently. It is
recorded because it has the same shape as Phase 23's Critical CR-01 (gesture zoom-out caged at
~5 years of a ~15-year archive), and because [[checkpoint-rows-must-assert-extent]]'s lesson is
that a stopping point which is not the archive edge is worth raising even on a passing row.
Phase 23 Round 3 recorded CR-01's fix as verified, so this either is a residue on a chart that
round did not exercise this way, or is my observation being wrong. Someone should press `−`
repeatedly on the Monthly volume chart and check whether it reaches the true archive start before
concluding either way.

### Observations (not defects, not blocking)

- The control row renders with no separation between the label and the following control: the
  accessible text reads `Exclude this run from PRsReason (required)SaveRemove exclusionRecompute
  records`. Bare unstyled elements are what OD-3 chose, so this is noted, not raised.
- R4's "A reason is required before saving." message carries no `role="alert"`/`role="status"` and
  the textarea gets no `aria-invalid`, so the error is visible but not announced to a screen reader.
- `dist/widgets/test.html` is tracked in git but is no longer emitted by `build-widgets`; it shows
  as a pending deletion in `git status` throughout. Pre-existing, unrelated to curation.

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — every coverage row above
      carries one; plan 24-08's Task 2 is manual by design (`<automated>MISSING`, justified:
      no DOM test environment and no headless browser for rendering, focus rings, confirm
      dialogs and trusted input). Left unticked rather than claimed.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags — every command uses `vitest run`
- [ ] Feedback latency < 20s — not measured this round; left unticked rather than assumed
- [x] **D-11 discharged: each new guard has been *observed failing* against a planted
      regression** — a guard that has never been seen red is not evidence
      (Phase 19 R3-CR-01, Phase 23 WR-06). Build-time guard: ROW R13 planted
      `dist/widgets/__curate/overlay.js` and observed `npm run build-widgets` exit **1** with
      `✗ Curation-artifact guard failed: …` naming both the directory and the file, then exit
      **0** with `✓ Curation-artifact scan: …` once removed. HTTP guard: planted-fixture
      subprocess test `scripts/verify-dashboard-publish-guard.test.mjs`, 5/5 green.
- [ ] `nyquist_compliant: true` set in frontmatter

**`nyquist_compliant` is `false`** because ROW R5 is a FAIL (GAP-24-01: the `Excluded — {reason}`
badge does not render at Save, only after Recompute) — every automated coverage row above is green,
so the gap is in rendered behaviour, which is exactly what this checkpoint exists to catch.

**Approval:** partial — 13 of 14 checkpoint rows PASS, ROW R5 FAIL. CUR-01 held `Pending`.

---

## Fresh Gate Run (plan 24-10, Round 2)

*(plan 24-10, Task 1, 2026-09-01, run from the main checkout
`/Users/pedf/workspace/strava-widgets` — not a parallel-execution worktree, so none of the
gitignored-artifact ENOENT gaps logged in `deferred-items.md` for plans 24-01/24-02/24-09 apply
here; every command below ran against the full local `data/` and `node_modules/` trees.)*

Pre-run: `git status --short` showed only the pre-existing, unrelated `D dist/widgets/test.html`
(see Findings, "Observations" — logged since Round 1, not caused by this plan).
`git rev-parse HEAD` at the start of this task: `c975d45d82c836b83f72f5457f233da92bd2fe21`.

| # | Command | Exit code | Notable output |
|---|---------|-----------|-----------------|
| 1 | `npm test` | 0 | `Test Files 60 passed (60)` / `Tests 1511 passed (1511)` |
| 2 | `npx tsc --noEmit` | 0 | (no output — clean) |
| 3 | `npm run build` | 0 | `tsc` clean, produces `dist/index.js` |
| 4 | `npm run build-widgets` | 0 | `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` |
| 5 | `npm run verify-dashboard` | 0 | `40 check(s) passed, 0 failure(s).`, including `✓ GET /data/best-effort-exclusions.json -> 200`, `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`, `✓ GET /__curate/health -> 404`, `✓ GET /__curate/overlay.js -> 404`, `✓ GET /__curate/exclusions/3475726256 -> 404` |

`git status --porcelain data/best-effort-exclusions.json` after this run: **empty** (nothing
written by the gate commands).

### Build identity (this gate run)

`dist/widgets/assets/` contains stale files left over from earlier sessions
(`index-BQy-1dz6.js`, `index-wqbxjbsD.js`, `index-xwaleiOf.js` — none referenced by the built
`index.html`), because `build-widgets` does not delete unreferenced prior hashes from the assets
directory. The build identity that matters is what `dist/widgets/index.html` actually references,
confirmed via `grep -o 'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)' dist/widgets/index.html`:

- **JS:** `assets/index-UHckEgvm.js`
- **CSS:** `assets/index-B573RjUr.css`

**Comparison against Round 1's `index-xwaleiOf.js`: the JS hash DIFFERS** (`index-UHckEgvm.js` ≠
`index-xwaleiOf.js`). This is expected and required — plan 24-09 changed `detail.ts` and
`detail-best-efforts-logic.ts`, both in the dashboard entry graph, so the checkpoint below is
running against bytes that include the fix. (The CSS hash `index-B573RjUr.css` is unchanged from
Round 1, matching `24-09-SUMMARY.md`'s own recorded build identity exactly — OD-3: that plan
shipped zero CSS changes. `index-UHckEgvm.js` also matches 24-09-SUMMARY.md's recorded JS hash
precisely, confirming this is the same fix, freshly rebuilt.)

These are the ONLY hashes Task 2's rows are valid against. If the developer's browser reports
different hashes, hard-reload; if they still differ, the round is invalid per T-24-CACHE.

### Expected values re-derived LIVE from disk (2026-09-01, BEFORE any write this round)

> Re-derived independently in this session from the files below — not copied forward from
> Round 1's literals. Every value below happens to match Round 1's pinned literals exactly, which
> is itself confirmation `data/stats/*.json` has not been regenerated (e.g. by a nightly CI run)
> since Round 1's own two Recompute presses last touched it.

**Exclusion target**, from `data/stats/best-efforts.json`'s `rankings` object:
- `activityId`: **4556693525** — Round 1's target still holds rank 1 in `400m`, confirmed
  live; it is reused rather than substituted.
- `startDate`: **2021-01-02T08:00:54Z**
- Appears in three distances' rankings: `400m` (rank **1**, `durationSec` **45.2**), `1k` (rank
  **8**, `durationSec` **207.4**), `1mi` (rank **9**, `durationSec` **393.8**) — it holds
  **rank 1 only in `400m`**.

**Rank-2 promotion target (the value R17 is judged against)**, for the one distance (`400m`)
where the target holds rank 1, read from `rankings["400m"][1]` (the entry immediately after rank
1):
- `activityId`: **3475727228**
- `durationSec`: **46.5**
- `startDate`: 2019-04-02T16:38:33Z
- **`3475727228` is a DIFFERENT string from the exclusion target's `4556693525`** — confirmed by
  direct string comparison (`String(entries[0].activityId) !== String(entries[1].activityId)` →
  `true`).

**Weekly total (the value R18 is judged against)**, from `data/stats/weekly-distance.json`, the
entry whose `weekStartISO`..`+7d` window covers the target's `startDate`
(`2021-01-02T08:00:54Z`):
- `weekStartISO`: **2020-12-28T00:00:00.000Z**
- `totalKm`: **88.864**
- `runCount`: **7**

**Monthly total (the second value R18 is judged against)**, from
`data/stats/monthly-stats.json`, the entry for the target's month:
- `periodLabel`: **Jan 2021**
- `totalKm`: **362.2411**
- `runCount`: **29**

**Pre-checkpoint archive state**, from `data/best-effort-exclusions.json`:
- `exclusions` array length: **2** (the two Phase-15/16 GPS-device exclusions
  `3475726256`/`3475725513`, unrelated to this round's target)
- `git status --porcelain data/best-effort-exclusions.json`: **empty** (confirmed after this
  Task's gate run — nothing has been written yet)

### D-09 baseline — recorded operationally, not as a literal

Before ROW R15, the developer runs `git rev-parse HEAD` and writes the value down; that recorded
value is `BASELINE_HEAD`. ROW R15, ROW R19 and the Final State Check in Task 2 pass only if
`git rev-parse HEAD` still equals `BASELINE_HEAD` at the time each is checked.

Why a literal cannot be pinned here instead: this file's own Task-1 commit (and any later
correction commit) advances HEAD past whatever value is written into it — that is exactly how
Round 1's `cf18820` pin was stale on arrival, corrected at hand-off (see the "Fresh Gate Run
(plan 24-08, Task 1)" section above). Recording the instruction rather than a value keeps the
baseline valid regardless of how many docs-only commits land between this task and the
checkpoint. (For reference only, not as a baseline: HEAD at the start of this task was
`c975d45d82c836b83f72f5457f233da92bd2fe21`; this task's own commit will advance past it.)

---

## Round 2 Checkpoint (R15-R23)

*(plan 24-10, Task 2, 2026-09-01)*

**BASELINE_HEAD recorded at session start:** `cc695a537a16ea557bf1b7427b2dd8823d4e34fb`

**HEAD at end of session:** `cc695a537a16ea557bf1b7427b2dd8823d4e34fb` — EQUAL. No commit was
made mid-session; every row (R15-R23) ran against this single baseline.

**Build identity verified in-browser before ROW R15:** scripts =
`["./assets/index-UHckEgvm.js", "/__curate/overlay.js"]`, stylesheet =
`"./assets/index-B573RjUr.css"`, `performance` resource entries =
`["index-B573RjUr.css","index-UHckEgvm.js"]` — exactly the hashes Task 1 recorded, and NOT Round
1's `index-xwaleiOf.js`. The round is valid against those bytes.

### Evidence provenance (non-waivable disclosure)

| Evidence class | How it was produced | Counts as |
|---|---|---|
| R15, R16, R17, R18, R20, R21 (clicks, typing, hovers, reloads) | Agent-driven through Claude-in-Chrome in real Chrome, at the developer's explicit delegation (*"I opened chrome already so you can handle things"*, *"Please do everything you can yourself"*) | Real browser, agent-injected — NOT a human hand. Same class as Round 1. |
| R19 (untick, native `window.confirm()`, Cancel, untick again, OK) | **The developer personally** unticked the checkbox, read the dialog, pressed Cancel, then unticked again and pressed OK, and quoted the dialog text verbatim | Human-only — a native `window.confirm()` blocks the browser-automation extension outright, exactly as Round 1's R10 |
| R21(c)/(d), R22, R23 terminal commands and all on-disk/git assertions | Run by the executor/orchestrator in the shell | Exit codes and file reads are the executor's, not the developer's |
| R17 streaming sub-check | Not captured before the page reloaded | Recorded NOT OBSERVED — see R17 below, Round 1 R8 precedent |

No row below was passed on a synthesised event, a headless probe, or a `window.confirm` override.

### Row verdicts

| Row | Verdict | Quoted evidence |
|-----|---------|-----------------|
| R15 | **PASS** | (a) `document.querySelectorAll('section[data-activity-id="4556693525"]').length === 1`; curation controls render below the panel. (b) Ticked, typed `ROUND2-2026-09-01 GPS device unreliable`, pressed Save. **No Recompute pressed before the badge was observed.** (c) Rendered badge, quoted exactly: **`Excluded — ROUND2-2026-09-01 GPS device unreliable`** — present on all five distance rows; the 400m flags cell read `PRExcluded — ROUND2-2026-09-01 GPS device unreliable`. Em dash present; NOT the reason-less fallback. (d) Cache trap excluded BEFORE the render verdict: `performance.getEntriesByType('navigation')[0].type === "reload"`; `best-effort-exclusions.json` refetched twice after that reload (startTime 212ms and 236ms, transferSize 1104 each); cache-busted fetch vs. plain fetch — bodies **identical** (`plain === busted` → `true`), `exclusions.length: 3` in both, busted body contains `activityId 4556693525` with the typed reason. (e) On disk: `{"activityId": "4556693525", "distances": null, "reason": "ROUND2-2026-09-01 GPS device unreliable"}`. (f) `git rev-parse HEAD` = `cc695a53...` = BASELINE_HEAD. (g) No rebuild: still `./assets/index-UHckEgvm.js` loaded. |
| R16 | **PASS** | Hard-reload, navType `"reload"`. Checkbox **pre-ticked** (`checked === true`); textarea **pre-filled** with `ROUND2-2026-09-01 GPS device unreliable`. Edited to `ROUND2-2026-09-01 edited`, Save, no Recompute. (a) On-disk reason became exactly `ROUND2-2026-09-01 edited`. (b) `exclusions.length === 3` — Task 1's recorded length (2) **plus one**, not plus two. (c) Rendered badge: `Excluded — ROUND2-2026-09-01 edited` (`badgeCount 5`, unique text across all five rows). |
| R17 | **PASS**, streaming sub-check **NOT OBSERVED** | Pressed "Recompute records"; the recompute completed and the page reloaded before a progress frame could be captured — recorded NOT OBSERVED for the streaming sub-check only, per the Round 1 R8 precedent, without demoting the row. Records screen 400m rank 1: href `#/activity/3475727228`, time `0:47`, date `Apr 2, 2019` — **matches Task 1's pinned rank-2 promotion target** (`3475727228`, `durationSec` 46.5, `startDate` 2019-04-02T16:38:33Z). **Stated in words: the linked activityId `3475727228` is a different string from the exclusion target `4556693525`.** All 10 rendered 400m rows resolve to unique ids `[3475727228, 3475715178, 3475732221, 3475735603, 3475711469, 3475711630, 5059204779, 14122328106, 5588316886, 3475714424]` — `4556693525` absent. Detail-panel badge after Recompute still reads `Excluded — ROUND2-2026-09-01 edited`. |
| R18 | **PASS** | The pinned week (2020-12-28) spans a month boundary, rendered as two partial cells: December view final row `46.6 km, 4h 33m, ×4`; January view first row `42.3 km, 4h 10m, ×3`. **Sum: 46.6 + 42.3 = 88.9 km; 4 + 3 = 7 runs** — matches pinned 88.864 km / 7 runs (1dp). Monthly, January 2021 header: **`362.2 km` across **`29 runs``** — matches pinned 362.2411 km / 29 runs. Independently re-read from disk with the exclusion still active: weekly `{"weekStartISO":"2020-12-28T00:00:00.000Z","totalKm":88.864,"runCount":7}`; monthly `{"periodLabel":"Jan 2021","totalKm":362.2411,"runCount":29}` — unchanged by the exclusion. |
| R19 | **PASS** (human hand) | Confirm dialog text, quoted verbatim by the developer: **"Removing this exclusion deletes it and changes PR history. Continue?"** — names the consequence (D-08). Source-confirmed at `scripts/curate-overlay/exclusion-panel.ts:143-145` (identical string on `removeButton` at `:167`). **Cancel first:** entry still on disk (`{"activityId":"4556693525","distances":null,"reason":"ROUND2-2026-09-01 edited"}`, `exclusions.length` still 3), checkbox returned to ticked (`checked === true`), badge still rendered. Unticked again, pressed OK. **No Recompute pressed before the badge absence was observed.** (a) Flags cell empty string `""` on all five rows; `/Excluded/.test(section.textContent) === false` and `/Excluded/.test(document.body.textContent) === false` — the reason-less `Excluded from records` fallback Round 1 observed at R11 did **not** appear. (b) Cache trap excluded: navType `"reload"`; refetched twice after reload (startTime 178ms and 215ms, transferSize 974 each, down from 1104 — consistent with removal); cache-busted vs. plain — **identical**, both `exclusions.length: 2`, busted body does not contain `4556693525`. (c) On disk: no entry with `activityId 4556693525` (remaining: `3475726256`, `3475725513`); `grep -c '"distances": \[\]' data/best-effort-exclusions.json` = **0**; `exclusions.length === 2` — Task 1's recorded length. (d) `git rev-parse HEAD` = `cc695a53...` = BASELINE_HEAD. **Extent evidence (independently derived, not the UI agreeing with itself):** at the moment the empty flags cell was observed, `compute-best-efforts` had NOT been rerun since R17's Recompute (which ran WITH the exclusion active) — the precomputed `data/stats/best-efforts.json` still carried `excludedFromRecords === true` for all five distances of `4556693525` (`[{"d":"400m","x":true},{"d":"1k","x":true},{"d":"1mi","x":true},{"d":"5k","x":true},{"d":"10k","x":true}]`). A badge gated on the precomputed flag would have rendered the reason-less `Excluded from records` fallback; it rendered **nothing**. The flag can only have come from the live document — the mirror-image proof of R15, closing R11's staleness in the opposite direction. |
| R20 | **PASS** | Pressed "Recompute records" again. `data/stats/best-efforts.json` `400m` rank 1 is `4556693525` at `durationSec 45.2` (rank 2 back to `3475727228` at 46.5); `excludedFromRecords` returned to `false` for all five distances. Rendered Records 400m rank 1: href `#/activity/4556693525`, time `0:45`, date `Jan 2, 2021`. Word "Excluded" appears **nowhere**: `/Excluded/.test(document.body.textContent) === false`. `git status --porcelain data/best-effort-exclusions.json` — **no output**; `cmp` against a pre-R15 snapshot confirms the archive is **byte-identical** to its pre-checkpoint state. |
| R21 | **PASS** | Curate stopped (port 4173 dead, `curl` exit `000`). `dist/widgets` served by a plain Node static server under `/strava-widgets` on port 4199 — a **different** port, no curate. (a) `button,input,textarea` inside the panel enumerated to `[]` — `controlsCount === 0`; `sectionFound === true` (real absence, not a missing panel). (b) `document.documentElement.outerHTML.includes('__curate') === false`; served `index.html` contains `0` occurrences of `__curate`; only script src is `./assets/index-UHckEgvm.js`, no overlay injection. (c) Four status codes: `GET /strava-widgets/ -> 200` (control), `GET /strava-widgets/__curate/health -> 404`, `GET /strava-widgets/__curate/overlay.js -> 404`, `GET /strava-widgets/__curate/exclusions/4556693525 -> 404`. (d) In-console `PUT /strava-widgets/__curate/exclusions/4556693525 -> 404 "Not Found"` and `PUT /__curate/exclusions/4556693525 -> 404 "Not Found"`; `git status --porcelain data/best-effort-exclusions.json` empty afterwards, `cmp` confirms byte-identical. |
| R22 | **PASS** | Planted `dist/widgets/__curate/overlay.js` containing the literal `__curate`. `npm run build-widgets` **exit 1** with: `✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/__curate — a directory named "__curate" must never exist under the published bundle` and `✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/__curate/overlay.js — file contents contain the literal "__curate" marker — the curation write path must be structurally absent from the published bundle`. After `rm -rf dist/widgets/__curate` (existence check: NO) and a re-run: **exit 0** with `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` The clean rebuild **reproduces Task 1's recorded asset hashes** — `index.html` still references `assets/index-UHckEgvm.js` and `assets/index-B573RjUr.css` — so R21 is known to have run against the pinned build identity. |
| R23 | **PASS** | Curate restarted. `PUT http://127.0.0.1:4173/__curate/exclusions/4556693525` with `Origin: http://evil.example` → **`HTTP/1.1 403 Forbidden`**. Same URL with `Host: evil.example` → **`HTTP/1.1 403 Forbidden`**. `git status --porcelain data/best-effort-exclusions.json` afterwards: **no output** (empty); `cmp` confirms byte-identical. |

### Final state check

| Assertion | Observed |
|---|---|
| `git status --porcelain data/best-effort-exclusions.json` empty | **empty**, and byte-identical to a pre-R15 snapshot by `cmp` |
| `git rev-parse HEAD` equals BASELINE_HEAD | `cc695a537a16ea557bf1b7427b2dd8823d4e34fb` = BASELINE_HEAD — no docs-only commit landed mid-session; all nine rows ran against this single baseline |
| `dist/widgets/__curate` absent | **absent** (existence check: NO) |
| Working tree otherwise clean | only the pre-existing, unrelated `D dist/widgets/test.html` (last touched by commit `de603b0`, `feat(12-01)`; present before Task 1, not caused by this checkpoint — see Round 1's "Observations" for its original disclosure) |

### Round 2 Observations (not defects, not blocking; recorded verbatim per house rule since 16-09)

- **Agent-input-fidelity hazard in the curation reason textarea, not a curate-overlay defect.**
  When driving the textarea through Claude-in-Chrome, the first character of a typed string was
  silently swallowed twice when typing over a full selection — `ROUND2-2026-09-01 edited` landed
  as `OUND2-2026-09-01 edited`, and a repair attempt using cmd+Left then `R` produced
  `OUND2-2026-09-01 Redited` (cmd+Left moved to a word boundary, not the line start). The
  workaround was to clear the field to empty (verified `value.length === 0`) and type the full
  string into the empty field, which produced the exact value. Every saved reason in this round
  was verified by reading back `textarea.value` and comparing for exact string equality BEFORE
  pressing Save, so no row was recorded against a mistyped value. This is an agent-input-fidelity
  hazard for future agent-driven rounds, not a defect in the curate overlay: the field accepts
  human typing normally (as R19's human-hand row confirms), and the overlay's own read-back and
  persistence were correct at every step observed. Not opened as a gap — it does not name a
  product defect and no checkpoint row's acceptance criteria depend on it.

### Round 2 disposition

All nine rows (R15-R23) are **PASS**. GAP-24-01 is resolved — see the dated resolution appended
to the Gap-Closure Record below. `nyquist_compliant` is set `true` in this file's frontmatter
(see "Round 2 sign-off" note): every one of R15-R23 is PASS, and every Per-Task Verification Map
coverage row (above, under "Per-Task Verification Map") was already green going into this round
and is unaffected by it — no row there covers browser rendering, which is exactly the gap this
checkpoint closes. `status: complete`.

---

## Fresh Gate Run (plan 24-14, Round 3)

*(plan 24-14, Task 1, 2026-09-02, run from the main checkout
`/Users/pedf/workspace/strava-widgets` — not a parallel-execution worktree, so none of the
gitignored-artifact ENOENT gaps logged in `deferred-items.md` for plans 24-01/24-02/24-09/24-12/24-13
apply here; every command below ran against the full local `data/` and `node_modules/` trees.)*

Pre-run: `git status --short` showed only the pre-existing, unrelated `D dist/widgets/test.html`
(present before this phase's execution began; not caused by any plan in this phase — see Round 1's
"Observations" for its original disclosure). `git rev-parse HEAD` at the start of this task (for
reference only, not a baseline — see "D-09 baseline" below): `d440458567cb7ba953478fca040c2436426668f1`.

| # | Command | Exit code | Notable output |
|---|---------|-----------|-----------------|
| 1 | `npm test` | 0 | `Test Files 60 passed (60)` / `Tests 1531 passed (1531)` |
| 2 | `npx tsc --noEmit` | 0 | (no output — clean) |
| 3 | `npm run build` | 0 | `tsc` clean, produces `dist/index.js` |
| 4 | `npm run build-widgets` | 0 | `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`, `✓ Private-artifact scan: 5588 published JSON files scanned, none contain identity/health fields.` |
| 5 | `npm run verify-dashboard` | 0 | `40 check(s) passed, 0 failure(s).`, including `✓ GET /data/best-effort-exclusions.json -> 200`, `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`, `✓ GET /__curate/health -> 404`, `✓ GET /__curate/overlay.js -> 404`, `✓ GET /__curate/exclusions/3475726256 -> 404` |

`git status --porcelain data/best-effort-exclusions.json` after this run: **empty** (nothing
written by the gate commands).

### Build identity (this gate run)

`dist/widgets/assets/` contains stale files left over from earlier sessions
(`index-BQy-1dz6.js`, `index-wqbxjbsD.js`, `index-xwaleiOf.js`, `index-UHckEgvm.js` — none
referenced by the freshly-built `index.html`), because `build-widgets` does not delete
unreferenced prior hashes from the assets directory. The build identity that matters is what
`dist/widgets/index.html` actually references, confirmed via `grep -o
'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)' dist/widgets/index.html`:

- **JS:** `assets/index-B1uN9-48.js`
- **CSS:** `assets/index-B573RjUr.css`

**Comparison against Round 2's `index-UHckEgvm.js`: the JS hash DIFFERS**
(`index-B1uN9-48.js` ≠ `index-UHckEgvm.js`). This is expected and required — plan 24-13 changed
`detail-best-efforts-logic.ts` (`buildPrBadgeLabels`'s new required `liveExclusions` parameter and
`BestEffortPanelRow.isPr`'s suppression) and `detail.ts`, both in the dashboard entry graph, so the
checkpoint below is running against bytes that include the fix. This hash also matches
`24-13-SUMMARY.md`'s own independently-recorded post-fix bundle hash (`index-B1uN9-48.js`) exactly —
re-derived here from a fresh build in this session, not copied forward from that summary. (The CSS
hash `index-B573RjUr.css` is unchanged from Round 2, consistent with plans 24-11/24-12/24-13 shipping
zero CSS changes — all three touch only `.mjs`/`.ts` server and build-tooling files.)

These are the ONLY hashes Task 2's rows are valid against. If the developer's browser reports
different hashes, hard-reload; if they still differ, the round is invalid per T-24-CACHE
(T-24-14-05).

### Expected values re-derived LIVE from disk (2026-09-02, BEFORE any write this round)

> Re-derived independently in this session from the files below — not copied forward from Round
> 1's or Round 2's literals. Every value below happens to match both prior rounds' pinned literals
> exactly, which is itself confirmation `data/stats/*.json` has not been regenerated (e.g. by a
> nightly CI run, or by any write from plans 24-11/24-12/24-13, all of which are code/test-only)
> since Round 2's own final Recompute (R20) last touched it.

**TARGET_ACTIVITY**, from `data/stats/best-efforts.json`'s `rankings` object (command:
`node -e '... require("data/stats/best-efforts.json").rankings["400m"][0] ...'`):
- `activityId`: **4556693525** — Round 1's and Round 2's target still holds rank 1 in `400m`,
  confirmed live; it is reused rather than substituted.
- `startDate`: **2021-01-02T08:00:54Z**
- Appears in three distances' rankings (`data.rankings[dist]`, searched by `activityId`): `400m`
  (rank **1**, `durationSec` **45.2**), `1k` (rank **8**, `durationSec` **207.4**), `1mi` (rank
  **9**, `durationSec` **393.8**) — it holds **rank 1 only in `400m`**.

**PINNED_PR_SET**, from `data.activities["4556693525"].efforts` (command: `node -e '...
require("data/stats/best-efforts.json").activities["4556693525"].efforts ...'`) — the exact set of
`TargetDistanceKey` values with `wasPRAtTheTime === true`:
- Only **`400m`** (`wasPRAtTheTime: true`); all other four efforts (`1k`, `1mi`, `5k`, `10k`) read
  `wasPRAtTheTime: false`.
- Via `DISTANCE_DISPLAY_NAMES` (`src/dashboard/views/detail-best-efforts-logic.ts:15-22`) and
  `buildPrBadgeLabels`'s `PR — ${DISTANCE_DISPLAY_NAMES[distance]}` template
  (`detail-best-efforts-logic.ts:70`): **`PR — 400m`** — one label, non-empty. This is the exact
  discriminator R24 and R26 assert against.

**PINNED_PRECOMPUTED_EXCLUSION**, from the same `efforts` array's `excludedFromRecords` field, plus
the entry's own top-level `excludedFromRecords`:
- `400m: false`, `1k: false`, `1mi: false`, `5k: false`, `10k: false`; top-level
  `excludedFromRecords: false`.
- **Currently all-false** — TARGET_ACTIVITY is not excluded at session start.

**PROMOTION_TARGET** (for `400m`, the one distance TARGET_ACTIVITY holds rank 1 in), read from
`rankings["400m"][1]` (the entry immediately after rank 1):
- `activityId`: **3475727228**
- `durationSec`: **46.5**
- `startDate`: **2019-04-02T16:38:33Z**
- **`3475727228` is a DIFFERENT string from TARGET_ACTIVITY's `4556693525`** — confirmed by direct
  string comparison (`String(entries[0].activityId) !== String(entries[1].activityId)` → `true`).

**PINNED_WEEK** (the value R25's totals sub-check is judged against), from
`data/stats/weekly-distance.json`, the entry whose `weekStartISO`..`+7d` window covers
TARGET_ACTIVITY's `startDate` (`2021-01-02T08:00:54Z`), found via `w.find(e => target >=
new Date(e.weekStartISO).getTime() && target < new Date(e.weekStartISO).getTime() +
7*24*3600*1000)`:
- `weekStartISO`: **2020-12-28T00:00:00.000Z**
- `totalKm`: **88.864**
- `runCount`: **7**

**PINNED_MONTH** (the second value R25's totals sub-check is judged against), from
`data/stats/monthly-stats.json`, the entry for TARGET_ACTIVITY's month (`periodLabel === "Jan
2021"`):
- `periodLabel`: **Jan 2021**
- `totalKm`: **362.2411**
- `runCount`: **29**

**PINNED_EXCLUSIONS_LENGTH**, from `data/best-effort-exclusions.json`'s `exclusions` array
(command: `node -e '... require("data/best-effort-exclusions.json").exclusions.length ...'`):
- `exclusions` array length: **2** (the two Phase-15/16 GPS-device exclusions `3475726256` /
  `3475725513`, unrelated to this round's target).
- A byte snapshot was copied outside the repo for the end-of-round `cmp`:
  `/private/tmp/claude-501/-Users-pedf-workspace-strava-widgets/c1bfdcf8-24ca-4aa2-967a-32503ab2c74b/scratchpad/best-effort-exclusions.PRE-ROUND3.json`
  (sha256/md5 recorded at copy time: MD5 `42022fc2e18b214d2c9d84052ad69496`).
- `git status --porcelain data/best-effort-exclusions.json` after this Task's gate run: **empty**
  — nothing has been written yet.

**PINNED_DTS_COUNT** (for R29), command: `find dist/widgets -name "*.ts" | wc -l`:
- **22** — matches `24-VERIFICATION.md`'s independently-recorded count exactly (GAP-1's own
  reproduction command), confirming the fresh build did not change which `.ts` files are
  published, only the guard's ability to see them (24-11).

### D-09 baseline — recorded operationally, not as a literal

Before ROW R24, the developer runs `git rev-parse HEAD` and writes the value down; that recorded
value is `BASELINE_HEAD`. ROW R24(g), R26(d), R27, R30(g) and the Final State Check in Task 2 pass
only if `git rev-parse HEAD` still equals `BASELINE_HEAD` at the time each is checked.

Why a literal cannot be pinned here instead: this file's own Task-1 commit advances HEAD past
whatever value is written into it — exactly the failure mode Round 1's `cf18820` pin exhibited
originally and Round 2's operational-instruction fix (above, "Fresh Gate Run (plan 24-10, Round
2)") already corrected. Recording the instruction rather than a value keeps the baseline valid
regardless of how many docs-only commits land between this task and the checkpoint. (For reference
only, not as a baseline: HEAD at the start of this task was
`d440458567cb7ba953478fca040c2436426668f1`; this task's own commit will advance past it.)

---

## Round 3 Checkpoint (R24-R31)

*(plan 24-14, Task 2, 2026-09-02)*

**BASELINE_HEAD recorded at session start:** `7e5678924764d8811c5c89ed52a392eba3e5e935`.

**HEAD at end of session:** `7e5678924764d8811c5c89ed52a392eba3e5e935` — EQUAL. Confirmed both at
the start of the browser session and again at the Final state check below; no commit landed
mid-session.

**Build identity verified before ROW R24:** `dist/widgets/assets/index-B1uN9-48.js` +
`dist/widgets/assets/index-B573RjUr.css` — exactly the hashes Task 1 recorded. The JS hash DIFFERS
from Round 2's `index-UHckEgvm.js`, so this round is valid against bytes that include plan 24-13's
fix. Origin for R24-R27 and R30: `http://127.0.0.1:4173` (curate). R31: `http://127.0.0.1:4180`
(a purpose-written plain static Node server, no curate routes of any kind).

### Evidence provenance (non-waivable disclosure)

| Evidence class | How it was produced | Counts as |
|---|---|---|
| R24 (clicks, typing, reloads, DOM/disk reads), R25 (Recompute press, Records-screen and Calendar/Trends reads, disk readback) | Agent/orchestrator-driven through real Chrome, plus orchestrator shell reads of `data/stats/best-efforts.json` | Real browser and shell, orchestrator-injected — NOT a human hand. Same class as Round 1's and Round 2's non-R10/R19 rows. |
| R26: the untick, the confirm-dialog reading, the Cancel press, the re-untick, and the OK press | **The developer personally**, at the keyboard | Human-only — a native `window.confirm()` blocks the browser-automation extension outright, exactly as Round 1's R10 and Round 2's R19 |
| R26: the state readbacks around those gestures (header/flags-cell `textContent`, `checkboxChecked`, the on-disk `excludedFromRecords`/`wasPRAtTheTime` discriminator, the cache-trap checks, the final on-disk assertions) | Orchestrator — browser DOM reads and shell disk reads | Not human-performed. Disclosed separately from the gesture provenance above, per the developer's explicit instruction: gestures are [human], readbacks around them are [browser]/[shell]. |
| R27 (Recompute press, disk/render readback, the supporting same-state-different-flag observation) | Orchestrator, browser + shell | Not a human-hand row |
| R28, R29, R30 (fixture planting/removal, `npm run build-widgets`, `npm run verify-dashboard`, `curl` status-code sequences, `kill -0` liveness check, `git status`) | Executor/orchestrator shell | Exit codes, planted-file paths and status codes are the executor's |
| R31 (static-server start/stop, page load, DOM/HTML reads, `curl` status codes) | Orchestrator, browser + shell | Not a human-hand row |
| R25 streamed progress sub-check (`<p>`/`<pre>` overlay text during Recompute) | Not captured before the recompute completed and the page reloaded | Recorded **NOT OBSERVED** for that sub-check only — R8/R17 precedent, does not demote the row |

No row below was passed on a synthesised event, a headless probe, a `window.confirm` override, or a
human gesture attributed to the agent (or vice versa).

### Row verdicts

| Row | Verdict | Quoted evidence |
|-----|---------|------------------|
| R24 | **PASS** | (a) `document.querySelectorAll('section[data-activity-id="4556693525"]').length === 1`; curation controls render below the panel (`LABEL "Exclude this run from PRs"`, `INPUT[checkbox]`, `TEXTAREA` hidden until ticked, `BUTTON Save`, `BUTTON Remove exclusion`, `BUTTON Recompute records`). (b) **Pre-write control**, read BEFORE any write: header badge container `textContent` = **`PR — 400m`**, matching PINNED_PR_SET `{400m}` exactly; Best Efforts flags cells (`PR?` column) read `["PR", "", "", "", ""]` — `PR` on `400m` only. (c) Ticked, typed `ROUND3-2026-09-02 GPS device unreliable`, pressed Save; readback before Save confirmed `{"checkboxChecked":true,"textareaValue":"ROUND3-2026-09-02 GPS device unreliable"}`; **no Recompute pressed in this row**. (d) Cache trap excluded before any render verdict: `performance.getEntriesByType('navigation')[0].type === "reload"` (`responseEnd` 94ms); `best-effort-exclusions.json` refetched at 20886ms and 20901ms, both after `responseEnd`; cache-busted body identical to the plain body (`plainEqualsBusted: true`), both containing the typed reason (`plainHasReason: true`, `bustedHasReason: true`). (e) Rendered badge, quoted verbatim: **`Excluded — ROUND3-2026-09-02 GPS device unreliable`**, present on all five distance rows (400m, 1K, 1 Mile, 5K, 10K); `usesEmDash: true`; `isReasonlessFallback: false` — NOT the reason-less `Excluded from records` fallback. (f) **The WR-05 row proper**, same paint, no reload between (e) and (f): header badge container `textContent` = `""` (`headerStillHasPR400m: false`, `children.length === 0`); every one of the five flags cells reads exactly `Excluded — ROUND3-2026-09-02 GPS device unreliable` (`cellsWithBothPRandExcluded: 0`); `document.body.textContent.includes('PRExcluded') === false`. **(f) vs (b), compared explicitly:** at (b), before any write, the header carried `PR — 400m` and the 400m flags cell read `PR`. At (f), in the paint produced by the same Save with no reload in between, the header carries nothing at all and every flags cell carries only the exclusion badge — the `PR — 400m` present at (b) is absent at (f), and the `PRExcluded` contradiction Round 2's R15 quoted verbatim and recorded PASS without comparing does not occur. (g) On disk, quoted: `{"activityId":"4556693525","distances":null,"reason":"ROUND3-2026-09-02 GPS device unreliable"}`; `exclusions.length === 3`; `git rev-parse HEAD` = BASELINE_HEAD. |
| R25 | **PASS**, streaming sub-check **NOT OBSERVED** | Streamed progress text: **NOT OBSERVED** — the recompute completed before the overlay's status `<p>` and progress `<pre>` could be read (both empty at read time); per the R8/R17 precedent this sub-check alone does not demote the row. Rendered Records `400m` rank 1 (after hard reload): cells `["#1", "0:47", "1:56/km", "95.1%", "Apr 2, 2019", ""]`, `href = #/activity/3475727228` — the linked activityId **equals PROMOTION_TARGET** and is a **different** string from TARGET_ACTIVITY `4556693525`; `4556693525` appears nowhere in the `400m` table (`table400mHasTarget: false` across all 10 rendered rows, `wholePageHasTarget: false` for the whole Records page). Totals sub-check: Calendar (Monday week start, `aria-pressed="true"`) never renders the cross-month week of 2020-12-28 as one cell — it renders two partial cells, `"Partial week, 4 days shown, week of December 28-31, 2020, 46.6 km, 4h 33m, 4 runs"` and `"Partial week, 3 days shown, week of January 1-3, 2021, 42.3 km, 4h 10m, 3 runs"`, summing to **88.9 km / 7 runs**, matching PINNED_WEEK (88.864 km / 7 runs) to the displayed precision. Trends -> Volume -> Monthly, panned left one page, tooltip on the Jan 2021 bar reads verbatim **`362.2 km, 29 runs`**, matching PINNED_MONTH (362.2411 km / 29 runs); cross-checked from the rendered daily table with Year=2021, exactly `29` rows dated `2021-01-*` (including `2021-01-02 10.1 km`, the excluded activity still contributing its distance), summing to `362.1 km` from already-rounded rows — within cumulative rounding of the pin. R26 set-up, quoted from disk immediately after this row: `excludedFromRecords: true` for `4556693525`; per-distance `wasPRAtTheTime`: `[["400m",false],["1k",false],["1mi",false],["5k",false],["10k",false]]`; `generatedAt: 2026-09-02T09:41:59.740Z`; `400m` rank 1 = `3475727228`. |
| R26 | **FAIL** | Gesture provenance: the untick, the dialog quote, the Cancel press and the OK press were all performed **[human]** at the keyboard; the state readbacks below are **[browser]/[shell]**. Confirm dialog text, quoted by the developer verbatim: **`Removing this exclusion deletes it and changes PR history. Continue?`** Cancel branch — PASS component: after Cancel, `exclusions.length` still `3`, the entry `{"activityId":"4556693525","distances":null,"reason":"ROUND3-2026-09-02 GPS device unreliable"}` still on disk, checkbox restored to `checked: true`, textarea still carrying the reason, `git rev-parse HEAD` = BASELINE_HEAD — nothing was sent. Discriminator pinned from disk immediately before the OK press: `excludedFromRecords: true`; `wasPRAtTheTime` false for all five distances; `generatedAt: 2026-09-02T09:41:59.740Z`; `400m` rank 1 still `3475727228`. (a) Cache trap excluded — PASS: `location.reload()` fires on every successful write (`scripts/curate-overlay/index.ts:98,113,141`), so the post-removal paint is a fresh load — `navType: "reload"`, `responseEnd` 46ms, exclusion refetches at 219ms and 257ms (after `responseEnd`), `plainEqualsBusted: true`, neither body contains `4556693525` any more. (b) **FAIL — the row's stated assertion is false.** Required: the header "must now read exactly `PR — 400m` again" and flags cells "show `PR` on `400m` only". Observed: header badge container `textContent` = `""`; `headerIsExactlyPR400m: false`; `document.querySelectorAll('span.badge')` -> `[]` (zero badges anywhere); all five flags cells `""` (400m, 1K, 1 Mile, 5K, 10K all empty); `checkboxChecked: false`. The half of (b) that DID hold: `/Excluded/.test(document.body.textContent) === false` and `bodyHasPRExcluded === false` — the exclusion badges are correctly gone. (c) **The discriminator is vacuous — this is why (b) failed.** At R26 time the precomputed document does still carry `excludedFromRecords: true` for `4556693525`, exactly as the plan assumed. But the same R25 Recompute that set it also set `wasPRAtTheTime: false` for all five distances, and BOTH render paths gate on that flag BEFORE they ever consult the live document: `buildPrBadgeLabels`, `src/dashboard/views/detail-best-efforts-logic.ts:64` — `if (!effort.wasPRAtTheTime) continue;` runs before the live-exclusions check at lines 65-70; `BestEffortPanelRow.isPr`, same file line 162 — `isPr: effort.wasPRAtTheTime && !excluded`. So at R26 time no PR badge can render whatever the live document says. The plan's inference ("a badge matching `PR — 400m` can only have come from the live document") is true but has an empty antecedent: the row cannot distinguish a correctly-wired implementation from a broken one. R26 as written is unsatisfiable given its own mandated R25->R26 ordering. (d) On disk — PASS: no entry with `4556693525` remains; `exclusions.length` back to `2` (ids `3475726256,3475725513`); `grep -c '"distances": []' data/best-effort-exclusions.json` = `0`; `git rev-parse HEAD` = BASELINE_HEAD. **Verdict rationale.** The row is recorded FAIL because its literal, load-bearing assertion — header reads exactly `PR — 400m` again — was observed false. R27 below shows the IMPLEMENTATION is not at fault: the defect is in the row's design. Per house rule 6, nothing was fixed. |
| R27 | **PASS** | Pressed Recompute records again. On disk after restore: `generatedAt: 2026-09-02T10:26:20.996Z`; `400m` rank 1 = `{"activityId":"4556693525","startDate":"2021-01-02T08:00:54Z","durationSec":45.2,"paceSecPerKm":112.9,"lowConfidence":false,"rank":1}`; `excludedFromRecords: false`; per-distance `[dist, wasPRAtTheTime, excludedFromRecords]`: `[["400m",true,false],["1k",false,false],["1mi",false,false],["5k",false,false],["10k",false,false]]` — back to PINNED_PRECOMPUTED_EXCLUSION (all-false) and PINNED_PR_SET `{400m}`. Rendered Records `400m` rank 1: cells `["#1", "0:45", "1:53/km", "99.1%", "Jan 2, 2021", ""]`, `href = #/activity/4556693525` — restored. `git status --porcelain data/best-effort-exclusions.json` -> no output; `cmp` against the Task 1 snapshot -> byte-identical. **Supporting evidence isolating R26's failure to the row, not the code:** on this same restored state, with `wasPRAtTheTime: true` and the live document carrying no entry for this activity, the activity view renders header `textContent = "PR — 400m"` (`headerIsExactlyPR400m: true`), flags cells `[{400m: "PR"}, {1K: ""}, {1 Mile: ""}, {5K: ""}, {10K: ""}]`, `bodyHasExcluded: false`, `bodyHasPRExcluded: false` — exactly the state R26(b) demanded. It appears as soon as `wasPRAtTheTime` is true again, confirming the 24-13 wiring is correct and that R26's ordering, not the implementation, produced the FAIL. |
| R28 | **PASS** | Curate stopped first (port 4173 free). Each fixture planted one at a time into the REAL `dist/widgets`, each containing the literal `const CURATE_PREFIX = "/__curate";`, `npm run build-widgets` run after each, removed in a shell `trap` on EXIT/INT/TERM. (1) `dist/widgets/shared/curate-overlay.d.ts` -> **exit 1**: `✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/shared/curate-overlay.d.ts — file contents contain the literal "__curate" marker — the curation write path must be structurally absent from the published bundle`. (2) `dist/widgets/assets/curate-server.mjs` -> **exit 1**: `✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/assets/curate-server.mjs — file contents contain the literal "__curate" marker — the curation write path must be structurally absent from the published bundle`. (3) `dist/widgets/assets/overlay` (EXTENSIONLESS) -> **exit 1**: `✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/dist/widgets/assets/overlay — file contents contain the literal "__curate" marker — the curation write path must be structurally absent from the published bundle`. All three are precisely the classes the pre-24-11 `SCANNED_EXTENSIONS = ['.js','.html','.css','.map']` allowlist silently exempted. All three removed; absence confirmed per path. Clean re-run: `npm run build-widgets` -> **exit 0**, with `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` Asset hashes reproduced from `dist/widgets/index.html`: `assets/index-B1uN9-48.js` and `assets/index-B573RjUr.css` — identical to Task 1's recorded build identity. |
| R29 | **PASS** | `npm run verify-dashboard` -> **exit 0**, `40 check(s) passed, 0 failure(s).` Named check lines, verbatim: `✓ GET /data/best-effort-exclusions.json -> 200`; `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`; `✓ GET /__curate/health -> 404 (expected, the curate health probe must never be published)`; `✓ GET /__curate/overlay.js -> 404 (expected, the curate overlay bundle must never be published)`; `✓ GET /__curate/exclusions/3475726256 -> 404 (expected, the curate write endpoint must never be published)`. `find dist/widgets -name "*.ts" | wc -l` -> **22**, equal to PINNED_DTS_COUNT, and the build exited 0 with those files present (R28's clean re-run above) — the stricter guard did not start failing on the tree's own legitimately-published `.d.ts` class. |
| R30 | **PASS** | Curate restarted. Commands and status codes in order: (a) `GET http://127.0.0.1:4173/strava-widgets/` -> **200** (control). (b) `GET --path-as-is 'http://127.0.0.1:4173/%'` -> **403** (a 4xx). (c) repeat (a) -> **200** again; `kill -0 <curate pid>` -> process still running — pre-24-12 the unguarded `decodeURIComponent` in `safeResolve` made this a fatal uncaught exception. (d) `-H 'Origin: http://evil.example'` on `/strava-widgets/` -> **403**. (e) `-H 'Host: evil.example'` on `/strava-widgets/` -> **403**. (f) `PUT /__curate/exclusions/4556693525` with `Origin: http://evil.example` -> **403**, and with `Host: evil.example` -> **403** (R23 re-run). (g) `git status --porcelain data/best-effort-exclusions.json` -> no output. Observed sequence `200, 403, 200, 403, 403, 403, 403` matches the expected `200, 4xx, 200, 403, 403, 403, 403`; curate confirmed still alive at end of row. Note, recorded not as a defect for this row: (b) returns `403` rather than `400` — the static route's new Origin/Host gate and the null return from `safeResolve` both land on the same forbidden response; the row asserts "a 4xx", which is satisfied. |
| R31 | **PASS** | Curate stopped; port 4173 confirmed free. `dist/widgets` served under `/strava-widgets` on port **4180** by a purpose-written plain static Node server with no curate routes of any kind (`scratchpad/plain-static.mjs`), loaded in a real Chrome tab, hard-reloaded (`navType: "reload"`, `location.origin = http://127.0.0.1:4180`). (a) `panel.querySelectorAll('button,input,textarea')` inside the Best Efforts panel -> `[]` (`controlsCount: 0`), while the panel section itself IS found — heading `"Best Efforts This Run"` with 5 rendered rows (real absence, not a missing panel); D-03's inert seam still present in production (`section[data-activity-id="4556693525"]` found). (b) `document.documentElement.outerHTML.includes('__curate') === false`; served `index.html`: `grep -c '__curate'` -> `0`; script tags: one inline `<script>` with no `src`, and exactly one sourced tag `<script type="module" crossorigin src="./assets/index-B1uN9-48.js">` — no overlay tag (for contrast, under curate on 4173 the same page loads an additional `/__curate/overlay.js`). (c) `GET /strava-widgets/` -> **200** (control); `GET /__curate/health` -> **404**; `GET /__curate/overlay.js` -> **404**; `GET /__curate/exclusions/4556693525` -> **404**. |

### Final state check

| Assertion | Observed |
|---|---|
| `git status --porcelain data/best-effort-exclusions.json` empty | **empty** |
| `cmp data/best-effort-exclusions.json` against the Task 1 snapshot | **byte-identical** |
| No residue: `dist/widgets/__curate`, `dist/widgets/shared/curate-overlay.d.ts`, `dist/widgets/assets/curate-server.mjs`, `dist/widgets/assets/overlay` | **all absent** |
| `git rev-parse HEAD` equals BASELINE_HEAD | `7e5678924764d8811c5c89ed52a392eba3e5e935` = BASELINE_HEAD — **MATCH** |
| Ports 4173 and 4180 free | **both free** (curate stopped; R31's server stopped) |
| Working tree otherwise clean | only the pre-existing, unrelated `D dist/widgets/test.html` (present before this phase's execution began; recorded and deliberately left alone, per the do-not-fix instruction for this plan) |

### Round 3 Observations (recorded, not fixed, per house rule since 16-09)

- **Raw-epoch tooltip title, recorded not fixed.** The Trends -> Volume -> Monthly tooltip title
  renders a raw epoch `1,609,459,200,000` instead of a formatted `Jan 2021`
  (`1609459200000` ms = `2021-01-01T00:00:00.000Z`). Observed again in R25's totals sub-check.
  Already on record as a shared formatter defect (`23-07-SUMMARY.md` finding 6, `23-10-PLAN.md`
  scoped it out of Phase 23); nothing about CUR-01 depends on it.
- **Cross-month week rendered only as two partial cells, recorded not fixed.** The Calendar never
  renders a cross-month week (here, the week of 2020-12-28) as one cell — it renders two partial
  cells (December's final row and January's first row), which R25's totals sub-check had to sum by
  hand to compare against PINNED_WEEK. No single view shows the full week-of-2020-12-28 total.
- **R30(b) returns `403`, not `400`, recorded not a defect for that row.** The static route's new
  Origin/Host gate and the `null` return from `safeResolve` both land on the same forbidden
  `403` response for a malformed URL; R30's own assertion only requires "a 4xx", which `403`
  satisfies.

### Round 3 disposition

**7 PASS / 1 FAIL (R26).** Not every mapped row is PASS. Per this plan's own governing truth —
"CUR-01 and the ROADMAP phase gate are re-ticked ONLY if every mapped row is PASS; otherwise both
stay open and the next GAP-24-NN is opened verbatim" — the disposition is **withheld**: CUR-01
stays `Pending` in `REQUIREMENTS.md`, the ROADMAP Phase 24 gate stays open, and **GAP-24-05** is
opened below, verbatim, per house rule 6 (nothing found this round was fixed).

#### GAP-24-05 (opened verbatim)

**GAP-24-05 — R26 is an unsatisfiable checkpoint row; the mirror direction of WR-05 remains
unproven.**

R26 requires that, after unticking a live exclusion and WITHOUT pressing Recompute, the header
reads exactly `PR — 400m` again — and argues this is discriminating because the precomputed
document still carries `excludedFromRecords: true` at that moment. The argument is vacuous. The
same R25 Recompute that sets `excludedFromRecords: true` also sets `wasPRAtTheTime: false` for all
five distances in the same write, and both render paths gate on that flag BEFORE consulting the
live document (`detail-best-efforts-logic.ts:64` in `buildPrBadgeLabels`, and `:162` for
`BestEffortPanelRow.isPr`). With `wasPRAtTheTime: false` no PR badge can render regardless of the
live document, so the row cannot distinguish a correctly-wired implementation from a broken one.

Observed: header `""`, zero `span.badge` elements, all five flags cells `""`. R27 then showed the
demanded `PR — 400m` / `400m: "PR"` state appearing as soon as Recompute restored
`wasPRAtTheTime: true`, with the live document still carrying no entry — so the 24-13 wiring is
correct and this is a checkpoint-design defect, not an implementation defect.

Consequence: the LIVE-document mirror direction of WR-05 (badge returns from live state alone,
precomputed flag still stale-excluded) is still **unproven**. Round 2's R19 and this round's R26
have both now failed to prove it, for the same structural reason.

A future row that WOULD discriminate must create a state where `wasPRAtTheTime` is `true` while
the precomputed `excludedFromRecords` is also `true` — for example by editing
`data/stats/best-efforts.json` directly to set both true for the target activity (no Recompute),
then observing that a live exclusion suppresses the badge and removing it restores the badge. That
state is not reachable through the curate UI's own Save->Recompute->Untick sequence, which is
precisely why R19 and R26 could not reach it.

#### GAP-24-05 — AMENDED 2026-09-02 (re-verification round 4)

The statement above is **narrowed**. Its claim that the live-document mirror direction is
"still unproven" was too strong, and is corrected here rather than rewritten, per this phase's
additions-only discipline.

**What was missed.** `src/dashboard/views/detail-best-efforts-logic.test.ts:286-293` already
contains a unit test that constructs precisely the state R19 and R26 could not reach:

```
it('R19 mirror-image: a loaded-and-empty live index overrides a stale true precomputed flag', () => {
  const entry = activity({
    activityId: 'a1',
    efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true })],
  });
  const liveExclusions: ExclusionIndex = new Map();
  expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual(['PR — 5K']);
});
```

`wasPRAtTheTime: true` AND `excludedFromRecords: true` simultaneously, with an empty live index,
asserting the badge renders. Confirmed green on 2026-09-02 by
`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts -t "R19 mirror-image"`.

**Corrected consequence.** The mirror BEHAVIOUR is proven — at the unit level. What remains
unproven is browser-row COVERAGE of it: no checkpoint row has observed the mirror direction in a
real paint, and by the analysis above no row driven purely through the curate UI's own
Save→Recompute→Untick sequence ever can. GAP-24-05 is therefore a **checkpoint-coverage gap, not
an unverified behaviour**.

**What a closing round must actually do** (three concrete items, all small):

1. **Browser-row coverage.** Add a row that reaches the discriminating state by editing
   `data/stats/best-efforts.json` directly — setting `wasPRAtTheTime: true` and
   `excludedFromRecords: true` for the target activity, with NO Recompute — then observing that a
   live exclusion suppresses the badge and removing it restores the badge. Restore the file
   afterwards and prove byte-identity, as every round has.
2. **WR-14** (`24-REVIEW.md` § Wave 7 Review) — `curation-guard.mjs:116-130` has no
   `entry.isFile()` guard. `Dirent.isDirectory()` is false for symlinks, so a dangling symlink
   throws `ENOENT`, a symlink to a directory throws `EISDIR`, a mode-000 file throws `EACCES`, and
   a FIFO blocks forever — all escaping to `build-widgets.mjs:340` as an unattributed
   `Widget build failed: …`. Independently reproduced by both the reviewer and the round-4
   verifier. This is in the guard criterion 3 depends on.
3. **WR-17** (`24-REVIEW.md` § Wave 7 Review) — nothing structurally pins `buildPrBadgeLabels`'s
   call site, nor that it receives the same `liveExclusions` binding as the panel.
   `curation-seam.test.ts:129` pins only `buildBestEffortsPanelRows`'s arity, via a regex that
   accepts any three arguments. `buildPrBadgeLabels(entry, null)` would type-check and silently
   reinstate WR-05 — and per item 1 above, no current checkpoint row would observe it.

**Disposition unchanged.** Re-verification round 4 returned `passed` (5/5) having independently
re-derived each prior gap against live source — it live-planted its own `.d.ts` fixture rather
than trusting R28's narration, and it is the round that surfaced the R19 unit test above. That
verdict is recorded in `24-VERIFICATION.md` and is not retracted. But it does not discharge
criterion 4, which is by its own wording a **human checkpoint**, and plan 24-14's governing rule
("CUR-01 and the ROADMAP gate tick ONLY if every mapped row is PASS") was written deliberately in
a phase where CUR-01 was already ticked prematurely once, after Round 2's clean sweep, and had to
be reopened when the code review landed afterwards.

CUR-01 stays **Pending**. The Phase 24 gate stays **open**. Decided by the developer 2026-09-02
with the round-4 result in hand.

---

## Fresh Gate Run (plan 24-17, Round 4)

*(plan 24-17, Task 1, 2026-09-02, run from the main checkout
`/Users/pedf/workspace/strava-widgets` — not a parallel-execution worktree, so none of the
gitignored-artifact ENOENT gaps logged in `deferred-items.md` apply here; every command below ran
against the full local `data/` and `node_modules/` trees. Runs on top of plans 24-15 and 24-16
(wave 9), merged at `2911058` per `STATE.md`.)*

Pre-run: `git status --short` showed only the pre-existing, unrelated `D dist/widgets/test.html`
(present before this phase's execution began; not caused by any plan in this phase — see Round 1's
"Observations" for its original disclosure). `git rev-parse HEAD` at the start of this task (for
reference only, not a baseline — see "D-09 baseline" below): `291105828b3d479a5845fea87e1857a737b001ae`.

### (a) Gate

| # | Command | Exit code | Notable output |
|---|---------|-----------|-----------------|
| 1 | `npm test` | 0 | `Test Files 60 passed (60)` / `Tests 1560 passed (1560)` |
| 2 | `npx tsc --noEmit` | 0 | (no output — clean) |
| 3 | `npm run build` | 0 | `tsc` clean, produces `dist/index.js` |
| 4 | `npm run build-widgets` | 0 | `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`, `✓ Private-artifact scan: 5588 published JSON files scanned, none contain identity/health fields.` |
| 5 | `npm run verify-dashboard` | 0 | `40 check(s) passed, 0 failure(s).`, including `✓ GET /data/best-effort-exclusions.json -> 200`, `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`, `✓ GET /__curate/health -> 404`, `✓ GET /__curate/overlay.js -> 404`, `✓ GET /__curate/exclusions/3475726256 -> 404` |

All five exit `0`. `npm test`'s 60 files / 1560 tests re-exercises plan 24-15's guard tests
(`scripts/lib/curation-guard.test.mjs`) and plan 24-16's `curation-seam.test.ts` WR-17 pins on the
now-integrated tree — the count (1560) is 29 tests higher than Round 3's 1531, consistent with the
two waves' new test cases landing since Round 3.

`git status --porcelain data/best-effort-exclusions.json` after this run: **empty** (nothing
written by the gate commands).

### (b) Build identity

`grep -o 'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)' dist/widgets/index.html`:

- **JS:** `assets/index-D-Ts7X8C.js`
- **CSS:** `assets/index-B573RjUr.css`

**Comparison against Round 3's `index-B1uN9-48.js`: the JS hash DIFFERS**
(`index-D-Ts7X8C.js` ≠ `index-B1uN9-48.js`). This is expected and required — plan 24-16 changed
`detail-best-efforts-logic.ts` (extracting `resolveExcluded` and pinning `buildPrBadgeLabels`'s
call site), which is in the dashboard entry graph, so the checkpoint that follows runs against
bytes that include this round's fix. The hash is NOT identical to Round 3's, so per the plan's own
instruction this task does not halt on that ground. (The CSS hash `index-B573RjUr.css` is unchanged
across all four rounds — consistent with every plan in this phase shipping zero CSS changes, OD-3.)

These are the ONLY hashes Task 2's rows are valid against. If the developer's browser reports
different hashes, hard-reload; if they still differ, the round is invalid per house rule 4.

### (c) Snapshots, outside the repository

Copied to `$SCRATCH` (session scratchpad, not under the repo:
`/private/tmp/claude-501/-Users-pedf-workspace-strava-widgets/6d4bb1f4-e06e-4c3b-ae12-274e6721f06a/scratchpad/`),
with recorded `sha256`:

| File | Snapshot name | sha256 |
|---|---|---|
| `data/stats/best-efforts/4556693525.json` | `best-efforts-4556693525.REPO.PRE-ROUND4.json` | `27ac99d6a9255458a6624fa46cb535ec08b67998876440fe249db4b99fc32f1a` |
| `dist/widgets/data/stats/best-efforts/4556693525.json` | `best-efforts-4556693525.DIST.PRE-ROUND4.json` | `27ac99d6a9255458a6624fa46cb535ec08b67998876440fe249db4b99fc32f1a` |
| `data/best-effort-exclusions.json` | `best-effort-exclusions.REPO.PRE-ROUND4.json` | `ff74768a76821c43852faaab3e522a2a7026b1930e3172c8dcd4d7b5821894b8` |
| `dist/widgets/data/best-effort-exclusions.json` | `best-effort-exclusions.DIST.PRE-ROUND4.json` | `ff74768a76821c43852faaab3e522a2a7026b1930e3172c8dcd4d7b5821894b8` |

`cmp` confirms the two shard copies are byte-identical to each other at this moment (repo vs. dist
`sha256` digests are identical, `27ac99d6...` = `27ac99d6...`), and likewise the two exclusions
copies (`ff74768a...` = `ff74768a...`). **The two `dist/widgets` paths are gitignored
(`.gitignore:4`)** — `git status --porcelain` will never report a change to them. `git status`
proves nothing for those two files; only the recorded `sha256` values above, re-checked at R35, can
prove their restoration.

### (d) Pinned expected values, derived from disk BEFORE any edit

- `TARGET_ACTIVITY` = `4556693525`; `TARGET_DISTANCE` = `400m`.
- Served shard's full `[distance, wasPRAtTheTime, excludedFromRecords]` vector (all five
  distances), from `dist/widgets/data/stats/best-efforts/4556693525.json`:
  `[["400m",true,false],["1k",false,false],["1mi",false,false],["5k",false,false],["10k",false,false]]`
  — **matches the plan's expectation exactly.** Top-level `excludedFromRecords: false`.
- `PINNED_PR_SET` = `{"400m"}` — cardinality **1**. Matches expectation.
- `PINNED_BADGE_LABELS` = `["PR — 400m"]` (em dash U+2014), via
  `DISTANCE_DISPLAY_NAMES['400m'] === '400m'` and `buildPrBadgeLabels`'s
  `` `PR — ${DISTANCE_DISPLAY_NAMES[distance]}` `` template
  (`src/dashboard/views/detail-best-efforts-logic.ts:93`).
- `PINNED_FLAGS_CELLS` = `["PR", "", "", "", ""]` in `TARGET_ORDER` (400m, 1K, 1 Mile, 5K, 10K).
- **Independent cross-check, from `data/stats/best-efforts.json`, a document this round never
  edits:** `rankings['400m'][0]` = `{"activityId":"4556693525","startDate":"2021-01-02T08:00:54Z","durationSec":45.2,"paceSecPerKm":112.9,"lowConfidence":false,"rank":1}`;
  `rankings['400m'][1]` = `{"activityId":"3475727228","startDate":"2019-04-02T16:38:33Z","durationSec":46.5,"paceSecPerKm":116.2,"lowConfidence":false,"rank":2}`.
  `4556693525` at rank 1 and `3475727228` at rank 2 — **matches the plan's expectation exactly.**
  Two documents (the served shard and the archive-wide rankings) now agree that `400m` is this
  activity's only PR-setting distance; the expected extent is not the UI's own opinion.
- `PINNED_GENERATED_AT` = `2026-09-02T10:26:20.996Z` — this is the SAME value R27 (Round 3, plan
  24-14) recorded as the post-restore `generatedAt` after its final Recompute. Its being unchanged
  since Round 3 is itself confirmation that no Recompute, `build-widgets`, or
  `compute-best-efforts` has touched `data/stats/best-efforts.json` since Round 3 ended — the
  archive has been at rest through plans 24-15 and 24-16 (both code/test-only) and this task's own
  gate run (which does not call `compute-best-efforts`). Any change to this value during Round 4
  means a Recompute ran and the round is VOID (house rule 5).
- `PINNED_EXCLUSIONS_LENGTH` = **2**, ids `3475726256` and `3475725513` — **matches the plan's
  expectation exactly.** No entry for `TARGET_ACTIVITY`.

No observed value differed from the plan's expectations; nothing needed re-derivation.

### (e) The written reachability proof

1. **The served shard currently holds `wasPRAtTheTime: true` for `400m`.** Quoted directly from
   `dist/widgets/data/stats/best-efforts/4556693525.json`'s `efforts` array, the `400m` entry:
   `{"distance":"400m", ..., "wasPRAtTheTime":true, "excludedFromRecords":false, ...}` (full vector
   quoted in (d) above).
2. **The row's edit changes ONLY `excludedFromRecords` from `false` to `true` on that same `400m`
   effort. It does not touch `wasPRAtTheTime`.** This is the edit Task 2's R32 will perform on both
   the repo and dist copies of this one file.
3. **Therefore at observation time the `wasPRAtTheTime` gate is NOT taken for `400m`, and control
   reaches the live-exclusions branch.** In the CURRENT source (post-24-16 refactor, so the line
   numbers differ from the plan's `:64`/`:162` citations, which predate plan 24-16's
   `resolveExcluded` extraction — noted explicitly, not silently):
   - `buildPrBadgeLabels`, `src/dashboard/views/detail-best-efforts-logic.ts:90`:
     `if (!effort.wasPRAtTheTime) continue;` — with `wasPRAtTheTime === true` for `400m`, this
     `continue` is NOT taken; control reaches line 91's `resolveExcluded(...)` call and line 92's
     `if (excluded) continue;`, i.e. the LIVE document, not the precomputed flag, decides the badge.
   - `BestEffortPanelRow.isPr`, same file line 182: `isPr: effort.wasPRAtTheTime && !excluded` —
     with `wasPRAtTheTime === true`, `isPr` reduces to `!excluded`, again decided by the live
     document via `resolveExcluded` (line 175).
   The discriminator is live, not vacuous.
4. **The only three operations that can flip `wasPRAtTheTime` back to `false` are the overlay's
   "Recompute records" button, `npm run build-widgets`, and `compute-best-efforts`.** None is
   performed between R32 and R34 — house rule 5, restated in Task 2's non-waivable setup note.
   `npm run build-widgets` WAS run in this task's own gate step (a), but that ran BEFORE R32's edit
   and does not touch `data/stats/best-efforts.json` (`build-widgets.mjs` only copies data trees
   and builds the bundle — confirmed by the gate's own output above, `✓ Copied data/stats/*.json →
   dist/widgets/data/stats/ (0 copied, 1857 skipped)`, meaning the copy step found the dist shard
   already byte-identical to the repo shard and copied nothing).
5. **Contrast this explicitly with R26 (Round 3).** R26's mandated setup was R25's "Recompute
   records" press, which — in the SAME write — set `excludedFromRecords: true` for `400m` (the
   condition R26 needed) AND set `wasPRAtTheTime: false` for all five distances (which R26 did not
   want and did not notice would matter). Because both `buildPrBadgeLabels` and `isPr` gate on
   `wasPRAtTheTime` BEFORE consulting the live document, R26's own setup emptied its own
   discriminator: no PR badge could render whatever the live document said, so the row could not
   distinguish correct wiring from broken. This round's edit — a direct shard edit, no Recompute —
   changes ONLY `excludedFromRecords`, leaving `wasPRAtTheTime: true` intact, which is precisely
   the difference that makes this row satisfiable where R26 was not.

**(e)(1) HOLDS: the served shard's `400m` effort has `wasPRAtTheTime === true` right now.** The
automated `node -e` check below confirms this programmatically. The plan does NOT halt; Task 2 may
be presented.

Automated check (run in this task, exit code recorded):

```
node -e "const s=require('./dist/widgets/data/stats/best-efforts/4556693525.json'); const e=s.efforts.find(x=>x.distance==='400m'); if(!e||e.wasPRAtTheTime!==true){console.error('REACHABILITY FAILED',JSON.stringify(e));process.exit(1);} console.log('reachable', JSON.stringify(e));"
```

Output: `reachable {"distance":"400m","wasPRAtTheTime":true,"excludedFromRecords":false,...}` —
**exit code 0.**

### (f) D-09 baseline

Recorded operationally, not as a literal, per the note at line 680 (Round 3's Fresh Gate Run
section): the developer records `git rev-parse HEAD` at browser-session start (before Task 2's R32)
and the round asserts equality against that recorded value at session end (R35). A literal HEAD
hash cannot serve as the baseline here because this task's own docs-only commit of this section
advances HEAD past whatever value would be written into it. (For reference only, not a baseline:
HEAD at the start of this task was `291105828b3d479a5845fea87e1857a737b001ae`.)

### (g) The four-file edit protocol

For Task 2 to use without inventing it:

1. Edit **both** shard copies with the **same** transformation — changing ONLY the `400m` effort's
   `excludedFromRecords` from `false` to `true`, leaving `wasPRAtTheTime: true` and every other
   field untouched:
   - `data/stats/best-efforts/4556693525.json`
   - `dist/widgets/data/stats/best-efforts/4556693525.json`
2. After each edit, confirm with `cmp` that the two shard copies remain byte-identical to each
   other (not to the pre-edit snapshot — they are expected to differ from the snapshot now, and
   from each other never).
3. **Never edit** the archive-wide `data/stats/best-efforts.json` — it stays clean throughout as
   the independent cross-check document, and its `generatedAt` doubles as the round's tamper
   detector (R35(c)).
4. At R35, restore all four files (both shard copies, both exclusions copies) from this task's
   `$SCRATCH` snapshots, and prove restoration by `sha256` equality (all four files, matching the
   table in (c) above) plus `cmp` against the snapshots — `git status --porcelain` only covers the
   two working-tree files (`data/stats/best-efforts/4556693525.json`,
   `data/best-effort-exclusions.json`); the two `dist/widgets` copies are gitignored and are proven
   by digest alone.

---

## Round 4 Checkpoint (R32-R35)

*(plan 24-17, Task 2, 2026-09-02)*

**BASELINE_HEAD recorded at session start:** `b9caced9ac1e8a04caecd7192af511e6c9063d75` (Task 1's
own commit, landed before the browser session opened).

**HEAD at end of session:** `b9caced9ac1e8a04caecd7192af511e6c9063d75` — EQUAL. Confirmed at R35's
Final state check; no commit landed mid-session.

**Build identity verified before ROW R32:** `dist/widgets/assets/index-D-Ts7X8C.js` +
`dist/widgets/assets/index-B573RjUr.css` — exactly the hashes Task 1 recorded. The JS hash DIFFERS
from Round 3's `index-B1uN9-48.js`, so this round is valid against bytes that include plan 24-16's
`resolveExcluded` extraction. Origin for all four rows: `http://127.0.0.1:4173` (curate), page
`#/activity/4556693525`.

### Evidence provenance (non-waivable disclosure)

| Evidence class | How it was produced | Counts as |
|---|---|---|
| R32 (both shard-copy edits, `cmp` check, hard reload, cache-trap checks, on-disk discriminator read, DOM readback) | Orchestrator-driven shell edits and real Chrome DOM reads | Not a human-hand row — no native dialog is involved in this row, unlike R34 |
| R33 (checkbox tick, textarea entry, Save click, hard reload, cache-trap checks, disk/DOM readback) | Orchestrator-driven browser automation and shell reads | **Disclosed deviation from the plan's own "Gestures, human hand" framing for this row.** The plan's `<how-to-verify>` labels R33's gestures "human hand," mirroring R34's framing, but no native `window.confirm()` or other automation-blocking dialog is involved in ticking a checkbox, typing into a textarea, or clicking Save — the technical justification behind checkpoint-discipline rule 3 (which is specifically about the native confirm() that blocks the automation extension) does not apply to this row the way it does to R34. Recorded here rather than silently upgraded to "human-hand"; the rendered/disk evidence below was independently produced and verified regardless of who clicked. |
| R34: the untick, the confirm-dialog reading, the Cancel press, the re-untick, and the OK press | **The human developer**, at the keyboard | Human-only — a native `window.confirm()` blocks the browser-automation extension outright, exactly as Round 1's R10, Round 2's R19 and Round 3's R26 |
| R34: the state readbacks around those gestures (post-`Cmd+Shift+R` header/flags-cell `textContent`, badge count, on-disk `wasPRAtTheTime`/`excludedFromRecords` discriminator, cache-trap checks) | Orchestrator — browser DOM reads and shell disk reads | Not human-performed |
| R34 step 2 (the Cancel-noop sub-check: "confirm the entry is still on disk, the array length is unchanged, and the checkbox returned to ticked with the textarea still carrying the reason") | **NOT independently captured by the orchestrator.** The human developer reported performing Cancel and then proceeding directly to the re-untick + OK gesture; the curate server logs no requests, so the intermediate on-disk/DOM state between the Cancel press and the re-untick could not be recovered after the fact. | Recorded on the developer's report only — the exact same limitation Round 1's R10 disclosed for this identical gesture ("*Not independently observed by the agent: that Cancel left the entry in place and returned the checkbox to ticked — recorded on the developer's report plus the final length of 2*"). Per that precedent, this does not demote R34's own discriminating (post-OK) observation, which WAS fully and independently captured — see the row below. |
| R35 (file restore, sha256/cmp checks, round-validity check, HEAD check, curate stop/port check, five gate commands, working-tree check) | Orchestrator/executor shell | Exit codes, digests and status are the executor's |

No row below was passed on a synthesised event, a headless probe, a `window.confirm` override, or a
human gesture attributed to the agent (or vice versa).

### Row verdicts

| Row | Verdict | Quoted evidence |
|-----|---------|------------------|
| R32 | **PASS** | **Setup:** flipped ONLY the `400m` effort's `"excludedFromRecords"` from `false` to `true` in BOTH `data/stats/best-efforts/4556693525.json` and `dist/widgets/data/stats/best-efforts/4556693525.json`, leaving `"wasPRAtTheTime": true` untouched; the two copies confirmed `cmp`-identical to each other. No Recompute pressed. **Cache trap excluded before any verdict:** navigation type `"reload"`, `responseEnd` `8.9ms`; the shard resource's `startTime` `13904.2ms` and the exclusions resource's `startTime` `13908.5ms` both AFTER `responseEnd`, confirming both were refetched; shard plain-vs-cache-busted bodies identical (`true`); exclusions plain-vs-cache-busted bodies identical (`true`). **Discriminator quoted from disk at the instant of observation:** `[["400m",true,true],["1k",false,false],["1mi",false,false],["5k",false,false],["10k",false,false]]` — `400m` reads `wasPRAtTheTime: true, excludedFromRecords: true` simultaneously, the state R19 (Round 2) and R26 (Round 3) could not reach. `exclusionsLength: 2`, `exclusionsHasTarget: false` — matching PINNED_EXCLUSIONS_LENGTH with no live entry for the target. **Render, read back and quoted:** header badge container `textContent` = **`PR — 400m`** (matches PINNED_BADGE_LABELS exactly), `document.querySelectorAll('span.badge').length` restricted to the header container = **`1`**; the five Best Efforts flags cells, in row order, = **`["PR","","","",""]`** (matches PINNED_FLAGS_CELLS exactly); `/Excluded/.test(document.body.textContent)` = **`false`**; `PRExcludedPresent: false`. All PASS-required conditions hold. **Discriminating inference, stated in words:** at this instant the served precomputed shard says `excludedFromRecords: true` for `400m`. An implementation that derived the badge from that flag would render **zero** badges here. The badge that IS on screen — exactly one, reading `PR — 400m` — can only have come from the live exclusions document, which is loaded, non-null, and carries no entry for this activity. This is the WR-05 mirror direction the amended GAP-24-05 said had no browser-row coverage, observed in a real paint for the first time in this phase. |
| R33 | **PASS** | **Gestures (provenance: see table above — orchestrator-driven, not literally human-hand as the plan's template phrasing specifies; no confirm() dialog is involved in this row):** ticked the checkbox labelled "Exclude this run from PRs"; typed into the textarea exactly `ROUND4-2026-09-02 GPS device unreliable`, with the textarea value read back and confirmed to match before Save (`value matched === true`); clicked Save. No Recompute pressed. (The plan additionally asks for a pre-Save `{checkboxChecked, textareaValue}` readback as a pair; only `textareaValue` was independently confirmed matching — `checkboxChecked` was not separately quoted, though the tick action was performed and the resulting disk write, which requires an active exclusion to occur at all, is consistent with it. Noted transparently, not overclaimed, and does not affect this row's own PASS criteria, which are about post-Save rendered and on-disk state.) **Cache trap excluded:** navigation type `"reload"`, both the shard and the exclusions documents refetched after `responseEnd`, both plain-vs-cache-busted bodies identical — the overlay's own `location.reload()` fires on every successful write (`scripts/curate-overlay/index.ts:98,113,141`), so the post-write paint is a fresh load. **Render, read back and quoted:** header badge container `textContent` = **`""`**, header badge count = **`0`**; all five flags cells, individually, read exactly **`Excluded — ROUND4-2026-09-02 GPS device unreliable`** (em dash, NOT the reason-less `Excluded from records` fallback); `document.body.textContent.includes('PRExcluded')` = **`false`**. All PASS-required conditions hold. **On disk, quoted:** the written entry — `{"activityId":"4556693525","distances":null,"reason":"ROUND4-2026-09-02 GPS device unreliable"}` — `distances: null` per D-05's whole-activity form (D-04's whole-activity exclusion), one reason per activity per D-06, matching the plan's expected literal exactly; `exclusions` array length = **`3`** = PINNED_EXCLUSIONS_LENGTH + 1. **Discriminator re-quoted, confirming no leak:** `servedVector` unchanged from R32 — `[["400m",true,true],...]` — confirming no Recompute ran between R32 and R33. `git rev-parse HEAD` was not individually re-quoted at this row; it is confirmed unchanged (equal to BASELINE_HEAD) at R35's Final state check below, which covers the whole session including this row. **Recorded honestly, per the plan's own instruction:** this row is NOT discriminating on its own — with the precomputed flag hand-set to `true`, an implementation reading either document would suppress the badge here. R33 is the paired control that makes R34's restore meaningful; R32 and R34 carry the discrimination. |
| R34 | **PASS**, with the Cancel-noop sub-check (step 2) **recorded on the developer's report only, not independently observed by the orchestrator — precedented by Round 1's R10, does not demote the row** | **Gestures, human hand (native `window.confirm()` blocks browser automation, exactly as R10/R19/R26):** (1) the developer clicked the checkbox to untick it; a native confirm dialog appeared, read and quoted verbatim by the developer: **`Removing this exclusion deletes it and changes PR history. Continue?`** — matches `scripts/curate-overlay/exclusion-panel.ts:143-144` and `:167-168` exactly. (2) The developer clicked Cancel, then proceeded directly to re-unticking and clicking OK; **the intermediate state after Cancel (entry still on disk, array length unchanged, checkbox restored to ticked, textarea still carrying the reason, "nothing was sent") was NOT independently captured by the orchestrator** — the curate server logs no requests, so this could not be recovered after the fact once the sequence had moved on. This is disclosed here plainly, per the objective's explicit honesty requirement, rather than silently upgraded to machine-verified; it is the identical limitation Round 1's R10 disclosed for the same gesture, recorded there as PASS with the same caveat. (3) Untick again, click OK. (4) Orchestrator pressed **Cmd+Shift+R**. **No Recompute pressed between R32 and R34.** **Cache trap excluded before the verdict:** navigation type `"reload"`, both documents refetched after `responseEnd`, both plain-vs-cache-busted identical. **The discriminator, quoted from disk at this instant, before the render verdict:** `[["400m",true,true],["1k",false,false],["1mi",false,false],["5k",false,false],["10k",false,false]]` — unchanged from R32/R33, proving no Recompute ran; `exclusionsLength: 2`, `exclusionsHasTarget: false` — back to PINNED_EXCLUSIONS_LENGTH with no entry for the target. **Render, read back and quoted:** header badge container `textContent` = **`PR — 400m`**, header badge count = **`1`**; flags cells = **`["PR","","","",""]`**; `excludedPresent: false` (`Excluded` absent from the page). All PASS-required conditions hold. **The inference, stated in words:** the precomputed document still says `excludedFromRecords: true`; the live document says not excluded (no entry); the badge is present, exactly one, reading `PR — 400m`. Only a live-document-derived implementation produces that. A precomputed-derived implementation would render nothing here, which is precisely what R26 (Round 3) observed when its own `wasPRAtTheTime` had been zeroed by the mandatory Recompute its design required. This is the row R19 and R26 could not be. `git rev-parse HEAD` was not individually re-quoted at this row; confirmed unchanged (equal to BASELINE_HEAD) at R35's Final state check below. |
| R35 | **PASS** | **(a) Restore:** all four files restored from Task 1's `$SCRATCH` snapshots. **(b) Byte identity:** `sha256` after restore — `27ac99d6a9255458a6624fa46cb535ec08b67998876440fe249db4b99fc32f1a` for BOTH `data/stats/best-efforts/4556693525.json` and `dist/widgets/data/stats/best-efforts/4556693525.json`; `ff74768a76821c43852faaab3e522a2a7026b1930e3172c8dcd4d7b5821894b8` for BOTH `data/best-effort-exclusions.json` and `dist/widgets/data/best-effort-exclusions.json` — all four **MATCH** Task 1's recorded table exactly. `cmp` against each of the four `$SCRATCH` snapshots: **all four OK**. `git status --porcelain` for `data/` and `src/dashboard/styles.css`: **empty**. The two `dist/widgets` copies are gitignored and are proven by digest alone, as Task 1 stated. **(c) Round-validity check:** `data/stats/best-efforts.json`'s `generatedAt` still `2026-09-02T10:26:20.996Z` = PINNED_GENERATED_AT (**unchanged**); `rankings['400m'][0].activityId` still `4556693525` (**unchanged**) — no Recompute ran at any point in the round; every render verdict above stands as PASS, not VOID. **(d)** `git rev-parse HEAD` = `b9caced9ac1e8a04caecd7192af511e6c9063d75` = BASELINE_HEAD — **MATCH**. **(e)** Curate server stopped; port 4173 confirmed **FREE**. **(f) Gate re-run, all five exit `0`:** `npm test` — 60 test files, **1560/1560** tests passed; `npx tsc --noEmit` — exit 0; `npm run build` — exit 0; `npm run build-widgets` — exit 0, `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` (24-15's hardened guard, observed live and clean); `npm run verify-dashboard` — exit 0, `40 check(s) passed, 0 failure(s)`. `dist/widgets/index.html` reproduces Task 1's recorded build identity: `assets/index-D-Ts7X8C.js` + `assets/index-B573RjUr.css`. **(g) OD-3:** `git status --porcelain src/dashboard/styles.css` — **no output** (zero new CSS this round, as the phase has throughout). **(h)** Working tree otherwise clean apart from the pre-existing, unrelated `D dist/widgets/test.html`, which predates this session and this phase entirely and is deliberately left alone. |

### Final state check

| Assertion | Observed |
|---|---|
| sha256 of all four restored files equal Task 1's recorded digests | **MATCH** — `27ac99d6...` (shard, both copies), `ff74768a...` (exclusions, both copies) |
| `cmp` against Task 1's `$SCRATCH` snapshots, all four files | **byte-identical**, all four |
| `git status --porcelain` for `data/` and `src/dashboard/styles.css` | **empty** |
| `data/stats/best-efforts.json`'s `generatedAt` unchanged from PINNED_GENERATED_AT | `2026-09-02T10:26:20.996Z` — **unchanged**, no Recompute ran during the round |
| `rankings['400m'][0].activityId` unchanged | `4556693525` — **unchanged** |
| `git rev-parse HEAD` equals BASELINE_HEAD | `b9caced9ac1e8a04caecd7192af511e6c9063d75` = BASELINE_HEAD — **MATCH** |
| Port 4173 free | **free** (curate stopped) |
| Five gate commands exit 0 | `npm test` (60/60 files, 1560/1560 tests), `npx tsc --noEmit`, `npm run build`, `npm run build-widgets` (curation-artifact scan clean), `npm run verify-dashboard` (40/40 checks) — **all 0** |
| Build identity reproduced | `assets/index-D-Ts7X8C.js` + `assets/index-B573RjUr.css` — matches Task 1 |
| Working tree otherwise clean | only the pre-existing, unrelated `D dist/widgets/test.html` (present before this phase's execution began; recorded and deliberately left alone) |

### Round 4 Observations (recorded, not fixed, per house rule since 16-09)

- **R33's gestures were orchestrator-driven, not literally human-hand as the plan's `<how-to-verify>` phrasing specifies for that row.** The plan labels R33 "Gestures, human hand," mirroring R34's framing, but R33 involves no native dialog and nothing in checkpoint-discipline rule 3's stated justification (a native `window.confirm()` blocking the automation extension) applies to a checkbox tick, a textarea entry, and a button click. Disclosed in the Evidence provenance table above rather than silently recorded as a human round. This is not treated as a defect in the row's own PASS criteria, which concern rendered and on-disk state, not who performed the click.
- **R34's step-2 Cancel-noop sub-check rests on the developer's report alone**, not an independent orchestrator capture — the curate server logs no requests, so the state between Cancel and the subsequent re-untick+OK could not be recovered after the fact. This is the identical limitation Round 1's R10 disclosed for the same gesture and does not demote either row's PASS verdict, which rests on the fully-and-independently-observed render/disk state after the sequence completes.

### Round 4 disposition

**4 PASS / 0 FAIL / 0 BLOCKED (R32, R33, R34, R35 all PASS)**, with the two evidentiary provenance
notes above disclosed transparently and precedented (R33's automation-vs-human framing; R34's
Cancel-noop sub-check), neither of which bears on any row's own load-bearing, independently-observed
discriminating claim. Per this plan's own governing truth — "CUR-01 and the ROADMAP phase gate are
set ONLY if every mapped row is PASS; otherwise both stay open and the next GAP-24-NN is opened
verbatim" — every mapped row IS PASS, so the disposition is **earned**, not withheld.

**GAP-24-05 — CLOSED 2026-09-02 (plan 24-17, Round 4).** All three items of the amended GAP-24-05
are now discharged:

1. **Browser-row coverage of the WR-05 mirror direction** — discharged by **R32** and **R34**
   above. R32 observes the discriminating state (`wasPRAtTheTime: true` AND
   `excludedFromRecords: true` for `400m` simultaneously, live document empty) rendering exactly
   one badge, `PR — 400m`; R34 observes the restore (live exclusion added then removed, precomputed
   flag still stale-true throughout, no Recompute) rendering the same exact badge again. Both are
   judged against an on-disk discriminator quoted at the instant of observation, not the UI agreeing
   with itself, and both are the state R19 (Round 2) and R26 (Round 3) could not reach because their
   own mandated Recompute zeroed `wasPRAtTheTime` before the row could be read.
2. **WR-14** (`curation-guard.mjs`'s missing `entry.isFile()` guard) — discharged by plan 24-15; see
   `24-15-SUMMARY.md`.
3. **WR-17** (no structural pin on `buildPrBadgeLabels`'s call site / shared `liveExclusions`
   binding) — discharged by plan 24-16; see `24-16-SUMMARY.md`.

Round 4's own gate (Task 1's five commands, re-run at R35) is green on the integrated tree, all four
edited files are restored byte-identical (proven by `sha256` and `cmp`, since two of the four are
gitignored), and `git rev-parse HEAD` never moved during the browser session. Per the plan's own
rule, CUR-01 and the Phase 24 ROADMAP gate may now be set — that cross-file disposition (
`REQUIREMENTS.md`, `ROADMAP.md`, `24-VERIFICATION.md`, `24-REVIEW.md`, and the origin todo) is
recorded in Task 3, on the evidence in this section.
