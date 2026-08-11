---
phase: 16-dashboard-shell-data-contract
verified: 2026-08-11T12:27:50Z
status: human_needed
score: 43/43 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 33/38
  gaps_closed:
    - "SC1 — dashboard deployed to GitHub Pages, hash routing works with no reloads/404s"
    - "SC2 — per-activity detail fetched lazily, including for i-prefixed intervals.icu ids"
    - "SC3 — theme toggle visible and legible in light mode, color-scheme synced to data-theme"
    - "P07 — opening an activity lazy-fetches and renders its stats header (i-prefixed ids)"
    - "P08/D-08 — the deployed gh-pages tree carries the SPA at root and the showcase at widgets.html"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "View the light-mode theme toggle and hamburger on an actual light-OS machine (all live-origin observation so far was performed under a dark-OS host with the toggle switched to the light theme in-app)."
    expected: "Exactly one icon visible, legible against #f5f5f7, contrast ~3.12:1 for the toggle / ~11.60:1 for the hamburger, matching the dark-OS observation."
    why_human: "16-11 pinned color-scheme to data-theme (not the OS), so this should be identical by construction, but no light-OS machine was available to 16-15 to confirm it directly."
  - test: "Cold-load the live origin in dark mode and watch the very first rendered frame for a light-mode flash before the dark theme applies."
    expected: "No white/light flash — dark paints on frame one."
    why_human: "The synchronous inline bootstrap running before the stylesheet link is confirmed in the deployed HTML, but the actual first frame was not observed by a human eye; this is a timing property no static inspection can fully rule out."
  - test: "With theme mode set to 'auto', change the OS-level light/dark appearance while the dashboard tab is open (no reload)."
    expected: "The page's effective theme follows the OS change live, per watchSystemTheme's matchMedia listener."
    why_human: "Not reachable from in-page script or curl; requires a human to toggle OS appearance and observe the tab."
  - test: "Find or synthesize a late-evening (21:00-23:59 local) intervals.icu-sourced activity and confirm its displayed date matches its local wall-clock date across list, overview and detail."
    expected: "Displayed date equals the local calendar date of startDateLocal, not shifted by the UTC-normalization fix."
    why_human: "No such activity exists in the current archive (all 56 intervals.icu rows are morning runs, latest 07:19) so the 0/100-mismatch live observation cannot exercise this edge; the guarantee currently rests on 16-12's unit tests (mutation-checked: reverting the fix reproduces 2 failures), which is real coverage but not a live observation."
---

# Phase 16: Dashboard Shell & Data Contract Verification Report

**Phase Goal:** A navigable, themed single-page dashboard shell is deployed to GitHub Pages, loading only a compact index up front.
**Verified:** 2026-08-11T12:27:50Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 16-10..16-16)

## Goal Achievement

This is the third verification pass on Phase 16. The first (16-09's internal UAT) was a false pass against a local server. The second (this verifier's own prior run, 16-VERIFICATION.md dated 2026-08-11T08:23:19Z) correctly found the site was never deployed, the id-validation regex rejected all 55 intervals.icu activities, and the theme toggle was invisible in light mode — and scored 33/38. A third defect (root-absolute asset URLs producing a black page on the real `/strava-widgets/` project path) was found and fixed *after* that second pass's own "deployed" plan (16-14) reported success, which is exactly the kind of false-pass this phase has a track record of producing. This pass re-verifies every one of the prior gaps against the live origin directly, independently of the SUMMARY narrative, and finds all five closed.

**All verification below was performed against `https://bacilo.github.io/strava-widgets/` directly by this verifier (`curl`, `git ls-tree origin/gh-pages`, `gh run view`) — not by trusting the 16-14/16-15/16-16 SUMMARY claims, and not by treating a local dist/widgets/ HTTP check as a stand-in for the deployed origin.**

### ROADMAP Success Criteria (the contract)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC1 | User can open the dashboard **on GitHub Pages** and navigate between list/calendar/detail/records/trends views via hash-based routes without reloads or 404s | ✓ VERIFIED | Independently curled the live origin: `/` → 200, body contains `id="app-nav-root"`; `/assets/index-DJmOzHMs.js` and `.css` → 200 with real minified JS content (not GitHub's 404 HTML — the exact prior black-page defect); `git ls-tree origin/gh-pages` shows `index.html`, `widgets.html`, `assets/`, `data/`. `gh run view 31488806924` confirms the deploying workflow ran green with `Build widgets → Run test suite → Verify dashboard publish contract → Deploy widgets to GitHub Pages` in that order, all `success`. Human UAT (16-15) additionally confirmed cold-load-per-hash for all five views plus `#/nonsense`→Overview fallback and hamburger behavior, on the live origin in a real browser. |
| SC2 | Dashboard loads a compact activity index manifest immediately and fetches per-activity detail data only when a specific activity is opened | ✓ VERIFIED | Independently fetched the live `/data/dashboard/index.json` (200, schemaVersion 1, 1868 rows, first row `i174601247`) and its detail/stream files (both 200). `isValidActivityId` in `src/dashboard/router.ts:104` is now `/^i?\d{1,20}$/`, confirmed by direct file read; `router.test.ts` asserts `isValidActivityId('i174109928') === true`. Human UAT (16-16) additionally confirmed on the live origin via network panel: cold `#/list` issues exactly one data request (the index), zero detail/stream requests; opening `i174601247` issues exactly two, both 200, and renders a populated stats header. |
| SC3 | Dashboard respects dark/light theme consistent with the existing widget system's theming | ✓ VERIFIED | `src/dashboard/styles.css` confirmed to contain `color-scheme: light`/`dark` inside each `:root[data-theme=...]` block, `.theme-toggle`/`.app-nav__toggle { color: var(--text) }`, and the `display: none` / `display: inline; color: var(--accent)` icon-swap pair — all read directly from the file, not from the SUMMARY's description of it. `nav.ts:182-183` toggles the `--active` class correctly. Human UAT (16-15) measured contrast on the live origin: 3.12:1 (toggle) and 11.60:1 (hamburger) in light mode, both above WCAG AA's 3:1 non-text threshold, and confirmed exactly one icon renders at a time across all three theme cycles, with persistence across reload. See Human Verification for the residual light-OS-hardware and OS-live-change caveats, which are inference-backed but not directly observed. |

### Gap-Closure Verification (5 previously-failed truths)

| # | Prior Status | Truth | Now | Evidence |
|---|--------------|-------|-----|----------|
| 1 | ✗ FAILED | SC1 — dashboard actually deployed to GitHub Pages (not just built locally) | ✓ VERIFIED | `git status`: local master is 2 commits ahead of `origin/master`, both docs-only (`.planning/ROADMAP.md`, two SUMMARY.md files) — no code is unpushed. `git ls-tree origin/master src/ --name-only` includes `src/dashboard`. `origin/gh-pages` HEAD carries the SPA; independently curled and confirmed rendering-capable (JS parses as JS, not a 404 HTML page). |
| 2 | ✗ FAILED | SC2 — `isValidActivityId` accepts intervals.icu `i`-prefixed ids | ✓ VERIFIED | `src/dashboard/router.ts:104`: `/^i?\d{1,20}$/`. `router.test.ts:88-123` covers accept (`i174109928`, `i174284902`, 20-digit ceiling) and reject (`ii123`, `I174109928`, `1i23`, 21-digit) cases. `detail-client.test.ts` carries an i-prefixed happy-path fixture per 16-10's SUMMARY, confirmed present. |
| 3 | ✗ FAILED | SC3 — theme toggle visible and legible in light mode | ✓ VERIFIED | `styles.css` fix confirmed by direct read (see SC3 row above); `styles.test.ts` (10 assertions) locks all six WR-04 rules at the text level; 16-11's SUMMARY documents a mutation check (flipped `display: inline`→`none`, confirmed the suite fails, restored, re-verified green) — this verifier did not re-run the mutation but did confirm the resulting file state matches what the mutation check claims to protect. |
| 4 | ✗ FAILED | P07 — opening an activity lazy-fetches and renders its stats header for i-prefixed ids | ✓ VERIFIED | Same root-cause fix as #2. Live-origin human UAT (16-16) confirmed the rendered stats header content ("Herlev Running / Aug 11, 2026 / 10.0 km / ..."), not the error state. |
| 5 | ✗ FAILED | P08/D-08 — deployed gh-pages tree has the SPA at root and the showcase at widgets.html | ✓ VERIFIED | `git ls-tree origin/gh-pages` (fetched fresh by this verifier): `index.html` (SPA, `app-nav-root` count 1, relative asset paths), `widgets.html` present, `data/` contains `activities, dashboard, geo, heatmap, routes, stats, streams`. |

**A sixth, previously-undetected defect was found and fixed between the second and third verification passes:** root-absolute Vite asset URLs (`base: '/'` default) resolved outside the `/strava-widgets/` GitHub Pages project path, so the browser fetched GitHub's 404 HTML in place of the JS bundle and rendered a black page — this happened *after* 16-14 reported a successful deploy. Fixed in `0b59d8c` (`base: './'` in `scripts/build-widgets.mjs:217`, confirmed by direct file read) and closed with a hardened `verify-dashboard-publish.mjs` that now mounts under `/strava-widgets` and fails hard on absolute asset URLs rather than silently stripping the leading slash before checking. Independently re-ran the probe locally: **16/16 checks pass**, including the two new asset-URL checks.

### Merged Must-Have Truths (ROADMAP SCs + all PLAN frontmatter, 16-01..16-16)

**Score: 43/43 truths verified** (38 from the original 9 plans, all now closing after gap closure, plus 5 new gap-closure-plan truths for the deploy/UAT evidence chain)

The 33 truths already VERIFIED in the prior pass (P01 exclusions, P02 theme engine, P03 router contracts, P04 index generator, P05 fetch-once/lazy clients, P06 nav/bootstrap, most of P07/overview/list, P09 URL probe) were spot-checked for regression only, per re-verification methodology, and show no regression: `npm test` → 368/368 passing (up from 334 at the original pass, reflecting the new gap-closure test cases), `npx tsc --noEmit` → clean, both re-run directly by this verifier.

Full detail on the 5 closed failures is in the Gap-Closure table above. Additional gap-closure-only truths, all independently checked:

| # | Source | Truth | Status | Evidence |
|---|--------|-------|--------|----------|
| 39 | 16-13 | Every Vite build spells `emptyOutDir` correctly (not `emptyDir`) | ✓ VERIFIED | `grep -n "emptyOutDir" scripts/build-widgets.mjs vite.config.pages.ts vite.config.ts` — all three files use the real option name |
| 40 | 16-13 | `npm test` and `npm run verify-dashboard` are blocking pre-deploy CI gates | ✓ VERIFIED | `.github/workflows/daily-refresh.yml:96-124` — both steps present between `Build widgets` and `Commit updated data and stats`, no `continue-on-error`. `gh run view 31488806924` shows both ran and succeeded on the real runner. |
| 41 | 16-14 | `origin/master` contains `src/dashboard/`; nothing phase-relevant is unpushed | ✓ VERIFIED | `git ls-tree origin/master src/dashboard --name-only` → non-empty; `git log origin/master..master --oneline` → 2 docs-only commits |
| 42 | 16-15 | Live-origin hash navigation and theme-toggle contrast, human-confirmed in a real browser | ✓ VERIFIED (with caveats — see Human Verification) | 16-15-SUMMARY.md's own "Limitations" section is the source of the residual human-verification items in this report's frontmatter; not silently upgraded to fully verified |
| 43 | 16-16 | Live-origin lazy-detail request-count proof and bulk date-correctness check | ✓ VERIFIED (with one edge case unfalsifiable against real data) | 16-16-SUMMARY.md's own "Limitations" section (no late-evening intervals.icu activity exists) is carried into this report's Human Verification section rather than being silently treated as fully closed |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/router.ts` | `isValidActivityId` accepts both Strava and intervals.icu id shapes | ✓ VERIFIED | `/^i?\d{1,20}$/` at line 104, confirmed by direct read |
| `src/dashboard/styles.css` | Theme-toggle visible/legible, `color-scheme` synced to `data-theme` | ✓ VERIFIED | All WR-04 rules present, confirmed by direct read; no `prefers-color-scheme` reintroduced |
| `src/dashboard/nav.ts` | Icon-swap wired to the CSS `--active` class | ✓ VERIFIED | `classList.toggle('theme-toggle__icon--active', ...)` at lines 182-183 |
| `src/dashboard/views/list.ts` | `formatActivityDate` timezone-normalizes no-Z timestamps | ✓ VERIFIED | `isoLocal.endsWith('Z') ? isoLocal : ${isoLocal}Z` then `getUTC*` reads, at lines 37-41 |
| `scripts/build-widgets.mjs` | Dashboard build uses relative `base: './'`; `emptyOutDir` spelled correctly | ✓ VERIFIED | Line 217 `base: './'`; 3 occurrences of `emptyOutDir` |
| `scripts/verify-dashboard-publish.mjs` | Mounts at `/strava-widgets`, fails hard on absolute asset URLs | ✓ VERIFIED | `MOUNT_PREFIX = '/strava-widgets'` at line 62; re-run locally, 16/16 pass |
| `.github/workflows/daily-refresh.yml` | `npm test` and `npm run verify-dashboard` are blocking, ordered after `Build widgets`, before deploy | ✓ VERIFIED | Confirmed by direct read and by the actual `gh run view` step list |
| `origin/gh-pages:index.html` | The dashboard SPA, relative asset URLs, project-path-safe | ✓ VERIFIED | Fetched live; `id="app-nav-root"` present, assets under `./assets/...` |
| `origin/gh-pages:data/` | Contains `dashboard/`, `activities/`, `streams/` alongside the pre-existing `geo/heatmap/routes/stats` | ✓ VERIFIED | `git ls-tree origin/gh-pages:data` — all 7 present |
| `.planning/REQUIREMENTS.md` | DASH-01/02/03 marked Complete, and substantively earned | ✓ VERIFIED | Marked `[x]` and "Complete" in the status table; independently re-derived the same conclusion from live evidence rather than trusting the checkbox |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `detail-client.ts` / `detail.ts` | `router.ts` | `isValidActivityId` before URL construction | ✓ WIRED, CORRECT PREDICATE | Widened regex propagates automatically through the single chokepoint import; `detail-client.test.ts` proves an i-prefixed id reaches URL construction |
| `master` (local) | `origin/master` → Pages deploy | `git push` | ✓ WIRED | `git rev-list --count origin/master..master` = 2, both docs-only, zero code unpushed |
| `daily-refresh.yml` | `scripts/verify-dashboard-publish.mjs` | Blocking step after `Build widgets` | ✓ WIRED | Confirmed present in the workflow file and confirmed executed+green in run `31488806924` via `gh run view` |
| `build-widgets.mjs buildDashboard()` | `dist/widgets/index.html` asset URLs | `base: './'` | ✓ WIRED | Live-origin asset URLs are relative (`./assets/...`), confirmed by curling the deployed `index.html` |
| `nav.ts` theme toggle | `styles.css` `--active` rule | `classList.toggle` | ✓ WIRED | Confirmed by direct read of both files; human-observed on live origin (16-15) — exactly one icon renders, correct accent color |
| `pages-build-deployment` (GH Pages) | `origin/gh-pages` | Post-push, automatic | ✓ WIRED | `gh run list` shows a successful `pages build and deployment` run immediately following each `Daily Widget Refresh` run |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `views/detail.ts` (live origin) | `detail: ActivityDetail` | `detailClient.loadDetail('i174601247')` | Yes — live network panel showed exactly 2 requests, both 200, rendering a populated stats header (16-16 human UAT) | ✓ FLOWING |
| `views/list.ts` (live origin) | `rows` from index client, dates via `formatActivityDate` | Live `data/dashboard/index.json` (1868 rows) | Yes — 100/100 rendered rows matched their raw `startDateLocal` date, including all 56 no-Z intervals.icu rows (16-16 human UAT) | ✓ FLOWING, NO CORRUPTION (previously ⚠️ CORRUPTED, now closed) |
| `nav.ts` theme toggle (live origin) | `mode` / effective theme | `theme.ts` + `matchMedia`, `color-scheme` synced to `data-theme` | Yes — measured contrast and single-icon rendering confirmed live (16-15) | ✓ FLOWING, RENDER CORRECT (previously ⚠️ HOLLOW RENDER, now closed) |
| `origin/gh-pages/data/**` | published JSON tree | Nightly CI `Commit updated data and stats` + deploy | Yes — curled live, 200s with real content | ✓ FLOWING (previously ✗ ABSENT, now closed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Test suite green | `npm test` | 20 files, 368/368 passing | ✓ PASS |
| Id gate accepts a real archive id | direct read of `router.ts:104` + `router.test.ts` assertions | `/^i?\d{1,20}$/`, `isValidActivityId('i174109928') === true` | ✓ PASS |
| Live root serves the SPA | `curl -sS https://bacilo.github.io/strava-widgets/` | 200, `id="app-nav-root"` present | ✓ PASS |
| Live asset URLs are relative and parse as JS | `curl` root doc + asset URL | `./assets/index-DJmOzHMs.js`, first bytes are minified JS (`var e=Object.defineProperty...`), not HTML | ✓ PASS |
| Live index manifest is real | `curl` `/data/dashboard/index.json` | schemaVersion 1, 1868 rows, first row `i174601247` | ✓ PASS |
| Live detail/stream files for the first i-prefixed row | `curl` both URLs | Both 200 | ✓ PASS |
| Live standalone pages intact | `curl` `/widgets.html`, `/heatmap.html`, `/pinmap.html`, `/routes.html` | All 200 | ✓ PASS |
| `origin/master` carries `src/dashboard/` | `git ls-tree origin/master src/dashboard` | Non-empty | ✓ PASS |
| No debt markers in any file this phase's gap-closure plans touched | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across 11 modified files | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo. The phase's own declared exit gate is `scripts/verify-dashboard-publish.mjs`, run both by CI (confirmed via `gh run view 31488806924`) and independently by this verifier locally.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-dashboard-publish.mjs` (local, post-`build-widgets`) | `npm run verify-dashboard` | 16 checks passed, 0 failures (up from 15 — the black-page fix added 2 new asset-URL checks and mounts under `/strava-widgets` now instead of the server root) | ✓ PASS |
| CI's own run of the same probe, on the real GitHub Actions runner, against the deployed artifact | `gh run view 31488806924` → step `Verify dashboard publish contract` | `success` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DASH-01 | 03, 06, 08, 09, 10, 13, 14, 15 | Dashboard SPA on GitHub Pages with hash-based routing between views | ✓ SATISFIED | Routing logic verified; deployment independently confirmed live (curl, `git ls-tree origin/gh-pages`, `gh run view`); human UAT confirmed cold-load-per-hash on the real origin. REQUIREMENTS.md:97 marks Complete — independently corroborated, not merely trusted. |
| DASH-02 | 01, 03, 04, 05, 07, 08, 09, 10, 12, 16 | Compact index up front, per-activity detail lazily on demand | ✓ SATISFIED | Index-fetch-once and lazy-detail-fetch both verified live with request-count-level proof (16-16); the `i`-prefixed id defect that blocked the newest 55 activities is closed and regression-tested. REQUIREMENTS.md:98 marks Complete — independently corroborated. |
| DASH-03 | 02, 06, 07, 09, 11, 15 | Dark/light theming consistent with the widget system | ✓ SATISFIED | Token parity exact (unchanged from the prior pass); toggle visibility/legibility fixed and measured live (3.12:1 / 11.60:1 contrast). REQUIREMENTS.md:99 marks Complete — independently corroborated, with residual light-OS-hardware and live-OS-change caveats routed to Human Verification rather than silently absorbed. |

**Orphaned requirements:** none. `grep "Phase 16" .planning/REQUIREMENTS.md` maps exactly DASH-01/02/03, and all three appear across the plan frontmatter of all 16 plans (9 original + 7 gap-closure).

**Traceability note:** REQUIREMENTS.md's Complete markers for all three DASH requirements are now substantively earned by live-origin evidence gathered independently by this verifier — not solely by trusting the checkbox, per the explicit instruction in the verification prompt. `git diff` shows no undeclared edits to REQUIREMENTS.md beyond what 16-10's SUMMARY documents (the DASH-01 checklist correction and the wording fix), and 16-12's undeclared premature DASH-02 mark was reverted during merge per the prompt's note — confirmed no trace of that premature mark remains (`DASH-02` row reads Complete only in the final, gap-closure-justified state, not a stale earlier one).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/analytics/compute-dashboard-index.ts` | 159 | `bestEfforts?.activities[id]` still throws per-activity if `activities` is absent on an otherwise-parseable best-efforts file (WR-07) | ⚠️ WARNING (non-blocking, deliberately deferred) | Unchanged from the prior pass; 16-12's SUMMARY explicitly scoped this out ("deliberately left out of scope... flagged for a future gap-closure or Phase 17/18 pass"). Does not affect any of the three phase-goal success criteria. |
| `scripts/build-widgets.ts` | — | Stale dead-code sibling of `build-widgets.mjs`, unreachable from `package.json`/CI/`tsconfig` | ℹ️ INFO (non-blocking, documented) | 16-13's SUMMARY flags this explicitly as a known cleanup candidate, not touched by design. |

**Debt-marker gate: PASS.** No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers found in any of the 11 files modified by the gap-closure plans (16-10 through 16-16), confirmed by direct grep against each file, not by trusting the SUMMARYs' own debt-marker claims.

### Human Verification Required

Four items carried forward honestly from the 16-15/16-16 SUMMARYs' own "Limitations" sections — none of them are truth failures, all are inherent limits of the testing environment used during gap closure (single dark-OS machine, no scriptable OS-appearance change, no late-evening activity in the real archive). Escalating per the framework's Step 9 rule that any non-empty human-verification list routes status to `human_needed` even when every truth is otherwise VERIFIED.

#### 1. Light-mode toggle legibility on an actual light-OS machine

**Test:** Load the live origin on a machine whose OS appearance is set to light (not a dark-OS machine with the in-app theme switched to light), and inspect the toggle/hamburger contrast.
**Expected:** Same result as the dark-OS observation — exactly one icon, ~3.12:1/~11.60:1 contrast, legible.
**Why human:** 16-11's fix (`color-scheme` pinned to `data-theme`, not the OS) structurally removes the OS-dependence that caused the original defect, so this should be identical by construction — but that is inference, not a second observation, and no light-OS machine was available during gap closure.

#### 2. No-white-flash on the actual first rendered frame in dark mode

**Test:** Cold-load the live origin with the OS/browser in dark mode and watch the very first frame.
**Expected:** No light/white flash before the dark theme paints.
**Why human:** The synchronous inline bootstrap running before the stylesheet `<link>` is confirmed in the deployed HTML (inspected directly by this verifier), which is a strong structural guarantee — but the actual first frame is a timing property that needs a human eye, not static inspection.

#### 3. `auto` theme mode tracks a live OS appearance change

**Test:** With theme mode set to `auto`, change the OS-level light/dark appearance while the dashboard tab stays open, with no reload.
**Expected:** The page's effective theme updates live via `watchSystemTheme`'s `matchMedia` listener.
**Why human:** Not reachable from page script, curl, or any tooling in this repo — requires a human to physically toggle OS appearance and observe the open tab.

#### 4. Late-evening intervals.icu activity date correctness

**Test:** Find or wait for a late-evening (roughly 21:00–23:59 local) intervals.icu-sourced activity and confirm its displayed date matches its local wall-clock date across list, overview and detail.
**Expected:** Displayed date equals the local calendar date, not shifted by a day.
**Why human:** No such activity currently exists in the archive (all 56 intervals.icu rows are morning runs, latest start 07:19), so the live 0/100-mismatch check performed in 16-16 could not exercise this specific edge. The guarantee currently rests on 16-12's unit tests (`list.test.ts`, mutation-checked: reverting the normalization reproduces exactly the failure this case would expose), which is real, load-bearing coverage — but it is not a live observation of a real record, and one will only become available once the athlete logs a late-evening run via intervals.icu.

### Gaps Summary

No blocking gaps remain. All three ROADMAP success criteria and all five previously-failed must-haves are now VERIFIED against the live origin, independently checked by this verifier (not inferred from SUMMARY prose): the site is deployed and reachable at `https://bacilo.github.io/strava-widgets/`, hash routing works with no reloads or 404s, the compact index loads immediately while per-activity detail (including for `i`-prefixed intervals.icu ids) loads lazily on demand, and the theme system is token-consistent with the widget system with a now-legible, single-icon toggle. A sixth defect not present in the prior verification pass — root-absolute asset URLs producing a black page on the real project path — was found and fixed between passes and is independently confirmed closed (relative `base: './'`, hardened probe, 16/16 local, `success` on the real CI runner).

The remaining four items are genuine environment-limited human-verification gaps, not code defects: they were honestly disclosed in the 16-15/16-16 SUMMARYs rather than silently marked done, and this report neither upgrades them to VERIFIED nor treats them as blocking failures. They should be discharged opportunistically (a light-OS machine, a human watching a cold dark-mode load, a manual OS-appearance toggle test, and — for item 4 — simply waiting for a real late-evening intervals.icu activity to exist) rather than gating the phase close, since none of them contradicts the phase goal's three success criteria as currently, directly observed.

---

_Verified: 2026-08-11T12:27:50Z_
_Verifier: Claude (gsd-verifier)_
