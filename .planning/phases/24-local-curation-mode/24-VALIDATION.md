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
