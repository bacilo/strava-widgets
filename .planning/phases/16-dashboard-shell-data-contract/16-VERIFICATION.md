---
phase: 16-dashboard-shell-data-contract
verified: 2026-08-11T08:23:19Z
status: gaps_found
score: 33/38 must-haves verified
overrides_applied: 0
gaps:
  - truth: "SC1 — User can open the dashboard on GitHub Pages and navigate between list/calendar/detail/records/trends views via hash-based routes without full page reloads or 404s"
    status: partial
    reason: "The routing implementation is correct and was human-confirmed against a LOCAL build, but the dashboard has never been deployed. origin/master does not contain src/dashboard/ at all (local master is 148 commits unpushed), so every nightly CI deploy built the pre-Phase-16 tree. The live gh-pages branch (HEAD 7a1aa8a, deployed 2026-08-11T05:45:56Z) has no assets/ SPA bundle, no widgets.html, and its root index.html is still the old static widget showcase."
    artifacts:
      - path: "origin/master (remote)"
        issue: "Missing src/dashboard/ entirely — 148 local commits containing the whole phase are unpushed"
      - path: "origin/gh-pages:index.html"
        issue: "Is the pre-Phase-16 static widget showcase, not the dashboard SPA"
      - path: "origin/gh-pages:data/"
        issue: "Contains only geo, heatmap, routes, stats — no dashboard/, activities/, or streams/, so the SPA could not load even if the shell were present"
    missing:
      - "Push master to origin so the deploying workflow builds a tree that contains src/dashboard/"
      - "Confirm a post-push daily-refresh run deploys an index.html that is the SPA and a data/ tree containing dashboard/, activities/, and streams/"
      - "Re-run the DASH-01 navigation UAT against the live GitHub Pages URL, not a local server"
  - truth: "SC2 — Dashboard loads a compact activity index manifest immediately and fetches per-activity detail data only when a specific activity is opened"
    status: partial
    reason: "The 'loads index immediately' half is fully verified. The 'opens an activity' half is broken for the 55 newest activities: isValidActivityId in src/dashboard/router.ts is /^\\d{1,20}$/ (digits only), but every activity ingested since the Aug 2026 intervals.icu migration carries an 'i'-prefixed id, and those are rows 1-55 at the top of the list. detail.ts rejects the id and paints the error state before any fetch is attempted."
    artifacts:
      - path: "src/dashboard/router.ts:101-103"
        issue: "isValidActivityId regex /^\\d{1,20}$/ returns false for i174284902 — the id of the very first row in data/dashboard/index.json"
      - path: "src/dashboard/views/detail.ts:219-225"
        issue: "loadAndRender calls renderErrorState (\"Couldn't load this activity\") on the failed id check, before any network request — the exact reported UAT symptom"
      - path: "src/dashboard/data/detail-client.ts:83-86"
        issue: "loadDetail rejects with InvalidActivityIdError on the same regex (defense-in-depth on the same broken pattern)"
      - path: "src/dashboard/router.test.ts:86-108"
        issue: "Every accept case is a bare numeric Strava id; no i-prefixed case exists, which is how 334/334 green tests shipped a broken feature"
      - path: "src/dashboard/data/detail-client.test.ts:39-121"
        issue: "Same gap — no i-prefixed happy path"
    missing:
      - "Widen isValidActivityId to /^i?\\d{1,20}$/ (single chokepoint; both consumers inherit it) while preserving the no-dot/slash/percent/angle-bracket traversal guarantee"
      - "Add isValidActivityId('i174109928') === true and a reject case like 'x123' to router.test.ts"
      - "Add an i-prefixed happy-path case to detail-client.test.ts"
      - "Correct the mis-specified plan must-have 'An activity id that is not all digits is rejected' — as written it mandates the defect"
  - truth: "SC3 — Dashboard respects dark/light theme consistent with the existing widget system's theming"
    status: partial
    reason: "Design-token parity with the widget ThemeManager is exact, and cycling/accent-discipline/no-flash were all human-confirmed. The theme toggle control itself is invisible in light mode (human-confirmed; still clickable). Three compounding structural defects confirmed in code."
    artifacts:
      - path: "src/dashboard/styles.css:141-155"
        issue: ".theme-toggle sets no `color`, so the icons' currentColor falls back to the UA's ButtonText; .theme-toggle__icon--active { fill: var(--accent) } targets the <svg> root and is always beaten by the children's own fill=\"currentColor\" presentation attributes; no rule hides the inactive icon"
      - path: "src/dashboard/nav.ts:59-117,168-169"
        issue: "Every circle/path/line carries its own fill=\"currentColor\"/stroke=\"currentColor\" attribute (defeating the --active rule), and both sun and moon icons are appended unconditionally"
      - path: "src/dashboard/index.html:7"
        issue: "<meta name=\"color-scheme\" content=\"light dark\"> with no CSS syncing the used color-scheme to data-theme — a dark-OS browser renders ButtonText near-white on the forced-light #f5f5f7 nav surface"
    missing:
      - "Add :root[data-theme=\"light\"] { color-scheme: light } and :root[data-theme=\"dark\"] { color-scheme: dark }"
      - "Add .theme-toggle, .app-nav__toggle { color: var(--text) }"
      - "Replace the dead fill rule with .theme-toggle__icon { display: none } and .theme-toggle__icon--active { display: inline; color: var(--accent) }"
      - "Re-run the DASH-03 toggle-visibility UAT step in light mode"
  - truth: "P07 — Opening an activity lazy-fetches only that activity's detail and stream files and renders its stats header"
    status: failed
    reason: "Same root cause as SC2. For the 55 newest activities no fetch is ever issued; the stats header never renders. Verified independently: `npm run verify-dashboard` fetched /data/activities/i174284902.json and /data/streams/i174284902.json over HTTP from the exact built directory and got 200s with parseable JSON — the files are fine, the browser-side id gate is not."
    artifacts:
      - path: "src/dashboard/views/detail.ts:217-232"
        issue: "Guard fires before the fetch for all i-prefixed ids"
    missing:
      - "Fix isValidActivityId (see SC2 gap) — no other change needed for this truth"
  - truth: "P08/D-08 — The dashboard SPA is the generated index.html of the published site, and the widget showcase still exists at its own URL"
    status: partial
    reason: "True of the local publish directory (dist/widgets/index.html is the SPA, dist/widgets/widgets.html is the showcase, verify-dashboard confirms both serve 200). False of the actual published site: origin/gh-pages root index.html is still the old showcase page and no widgets.html exists there."
    artifacts:
      - path: "origin/gh-pages:index.html"
        issue: "Old static showcase, not the SPA"
      - path: "origin/gh-pages (tree)"
        issue: "No widgets.html, no assets/"
    missing:
      - "Push master and let daily-refresh redeploy, then re-check the deployed tree"
human_verification:
  - test: "Open the live GitHub Pages URL (not a local server) and navigate Overview -> Activities -> Calendar -> Records -> Trends and back"
    expected: "All five views render via hash routes with no full page reload and no 404; deep-refresh on each hash still works"
    why_human: "Requires the site to actually be deployed and a real browser; no automated tooling in this repo can reach the live Pages origin"
  - test: "After the isValidActivityId fix, click 'View Activity' on the FIRST row of the Activities list (an i-prefixed intervals.icu activity), then reload that #/activity/i... URL cold"
    expected: "The activity's stats header, distance/time/pace/elevation/HR/cadence numbers, and stream summary render — not 'Couldn't load this activity'"
    why_human: "Browser-runtime fetch behavior and rendering; the HTTP smoke script cannot exercise the client-side id gate"
  - test: "After the toggle-styling fix, view the nav in light mode on both a light-OS and a dark-OS machine"
    expected: "Exactly one icon is visible, it is legible against the #f5f5f7 nav surface, and the active state uses the accent color"
    why_human: "Visual contrast against a UA-derived ButtonText fallback; not assessable by grep"
  - test: "With TZ set to a non-UTC zone, check the displayed date of a late-evening and an early-morning intervals.icu activity in the list, overview and detail views"
    expected: "Displayed date matches the activity's local wall-clock date in every timezone"
    why_human: "Confirms the WR-02 fix end to end across all three views; reproduction is scripted below but the rendered output needs eyes"
---

# Phase 16: Dashboard Shell & Data Contract Verification Report

**Phase Goal:** A navigable, themed single-page dashboard shell is deployed to GitHub Pages, loading only a compact index up front.
**Verified:** 2026-08-11T08:23:19Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The engineering underneath this phase is genuinely strong — 334/334 tests green, `tsc --noEmit` clean, a real dependency-free publish probe that passes 15/15, exact design-token parity with the widget ThemeManager, and a router/registry/client layer that is correctly wired end to end. But the phase goal has three load-bearing clauses and **all three fail**:

1. **"deployed to GitHub Pages"** — it is not. This is the finding the phase artifacts do not mention at all.
2. **"loading only a compact index up front"** — the index half works; the lazy-detail half it exists to prove is broken for the newest 55 activities.
3. **"themed"** — the tokens are right, but the control that operates the theme is invisible in light mode.

### ROADMAP Success Criteria (the contract)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC1 | User can open the dashboard **on GitHub Pages** and navigate between list/calendar/detail/records/trends views via hash-based routes without reloads or 404s | ✗ FAILED | Routing logic verified (`view-registry.ts` exposes all 6 routes, `main.ts` starts `createRouter` with dual triggers, human confirmed navigation locally) — but **the dashboard is not deployed**. `git ls-tree origin/master src/` shows no `src/dashboard`; local master is **148 commits ahead and unpushed**. `origin/gh-pages` HEAD `7a1aa8a` (2026-08-11T05:45:56Z) has no `assets/`, no `widgets.html`, and its root `index.html` is the pre-Phase-16 static showcase. Its `data/` contains only `geo, heatmap, routes, stats`. |
| SC2 | Dashboard loads a compact activity index manifest immediately and fetches per-activity detail data only when a specific activity is opened | ✗ FAILED | First half VERIFIED: `main.ts:31` fires `clients.indexClient.loadIndex().catch(() => {})` without awaiting; `index-client.ts` memoizes on a single `inFlight` promise and does not memoize failures. Second half FAILED: `isValidActivityId('i174284902')` → `false` (executed), and `i174284902` is **row 1** of the generated index. `detail.ts:219-225` paints "Couldn't load this activity" before any fetch. |
| SC3 | Dashboard respects dark/light theme consistent with the existing widget system's theming | ✗ FAILED | Token parity is **exact** — `styles.css` light `#ffffff/#333333/#fc4c02` and dark `#1a1a2e/#e0e0e0/#ff6b35` match `src/widgets/shared/theme-manager.ts:44-70` character for character. Pre-paint bootstrap present in `index.html:19-37` before the stylesheet link. But the toggle is invisible in light mode (human-confirmed) with three confirmed structural causes — see WR-04 below. |

### Merged Must-Have Truths (ROADMAP SCs + PLAN frontmatter)

**Score: 33/38 truths verified**

| # | Source | Truth | Status | Evidence |
|---|--------|-------|--------|----------|
| 1 | ROADMAP | SC1 — navigable on GitHub Pages, no reloads/404s | ✗ FAILED | Not deployed — see SC table above |
| 2 | ROADMAP | SC2 — index up front, detail lazy on open | ✗ FAILED | Detail half broken for 55 newest activities |
| 3 | ROADMAP | SC3 — theme consistent with widget system | ✗ FAILED | Toggle invisible in light mode |
| 4 | P01 | Excluded activities never appear in any per-distance PR ranking | ✓ VERIFIED | `compute-best-efforts.ts:215` gates the accumulator on `isExcluded(exclusions, id, effort.distance)`; suite green |
| 5 | P01 | Excluded activities still computed and flagged, not deleted | ✓ VERIFIED | `compute-best-efforts.ts:237,239` write `excludedFromRecords` rather than dropping the effort |
| 6 | P01 | Next-best genuine effort promoted to rank 1 | ✓ VERIFIED | Covered by `compute-best-efforts.test.ts`; 334/334 pass |
| 7 | P01 | Missing/malformed exclusions file → zero exclusions, no crash | ✓ VERIFIED | `loadExclusions` tolerance covered in `best-effort-exclusions.test.ts` |
| 8 | P02 | Theme resolves concrete light/dark for all 3 modes × 2 system prefs | ✓ VERIFIED | `resolveEffectiveTheme` + matrix coverage in `theme.test.ts` |
| 9 | P02 | Tampered localStorage value falls back to auto | ✓ VERIFIED | `parseThemeMode` (theme.ts:32) + guard test; mirrored in the inline bootstrap |
| 10 | P02 | One global stylesheet declares the same accent/bg/text hexes as the widget ThemeManager | ✓ VERIFIED | Hex-for-hex parity confirmed against `theme-manager.ts:44-70` |
| 11 | P02 | System theme changes only re-render while stored mode is auto | ✓ VERIFIED | `watchSystemTheme` (theme.ts:124) with test coverage |
| 12 | P03 | `#/activity/<id>` resolves to the detail route on initial load and on hashchange | ✓ VERIFIED | `createRouter` binds both `hashchange` and `DOMContentLoaded`; human UAT confirmed the hash updates |
| 13 | P03 | `#/list?year=2024` parses into a URLSearchParams the view receives | ✓ VERIFIED | `parseHash` tests at `router.test.ts:13-19` |
| 14 | P03 | An activity id that is not all digits is rejected before reaching a fetch URL or the DOM | ⚠️ VERIFIED (harmful as specified) | Literally true — and this literal must-have **is** the defect. It mandates rejecting `i`-prefixed intervals.icu ids, which is why a green 334-test suite shipped a broken detail view. Counted as verified; the goal-level failure lands on SC2. |
| 15 | P03 | Every downstream plan codes against one index row shape and one view record shape | ✓ VERIFIED | `dashboard-index.types.ts` + `view.types.ts` are the only shape sources; all views/clients import from them |
| 16 | P04 | Compute step produces `data/dashboard/index.json` with one row per manifest activity | ✓ VERIFIED | 1,867 rows generated vs 1,867 files in `data/activities/` |
| 17 | P04 | Every row carries the full browse-complete field set | ✓ VERIFIED | 17 keys present incl. `paceSecPerKm`, `avgHr`, `avgCadenceRpm`, `location`, `streams`, `prCount` |
| 18 | P04 | Stream/low-confidence/PR/exclusion flags resolved at generation time | ✓ VERIFIED | Flags materialized in the row; no render-time recomputation in the views |
| 19 | P04 | One malformed activity file is skipped with a warning, not an aborted build | ✓ VERIFIED | Covered by `compute-dashboard-index.test.ts` (25 tests). See WR-07 for a related uncovered failure mode. |
| 20 | P04 | Generated index is gitignored and regenerated every CI run | ✓ VERIFIED | `git check-ignore` → `.gitignore:14 data/dashboard/`; workflow step "Compute dashboard index" present |
| 21 | P05 | Index manifest fetched exactly once per page session | ✓ VERIFIED | Single `inFlight` promise in `index-client.ts:69-88`; failures deliberately not memoized |
| 22 | P05 | No detail file fetched until an activity is opened; reuses committed `data/activities`/`data/streams` | ✓ VERIFIED | `detail-client.ts` fetches only from `loadDetail`, called only from `detail.ts` mount |
| 23 | P05 | Non-all-digits id rejected before any network request | ⚠️ VERIFIED (harmful as specified) | Same mis-specification as #14 |
| 24 | P05 | Missing stream file resolves with a null stream instead of failing the load | ✓ VERIFIED | `detail-client.ts:70-78`; probe confirms the expected 404 path for `18702664326` |
| 25 | P06 | Persisted theme applied before first paint — no light flash | ✓ VERIFIED | Synchronous IIFE at `index.html:19-37` sets `data-theme` before the `styles.css` link; human confirmed no flash |
| 26 | P06 | Nav lists Overview, Activities, Calendar, Records, Trends in order, never the detail route | ✓ VERIFIED | `NAV_ORDER` (view.types.ts:56-62); `ROUTES.DETAIL` absent |
| 27 | P06 | Below 640px the nav collapses behind a ≥44×44px hamburger | ✓ VERIFIED | `.app-nav__toggle` min-width/min-height 44px; shown in the `@media` block at styles.css:274 |
| 28 | P06 | Calendar/Records/Trends render the UI-SPEC coming-soon copy naming the right future phase | ✓ VERIFIED | `stub-view.ts:27` interpolates `STUB_PHASE` → Calendar 17, Records 18, Trends 18 |
| 29 | P07 | Landing view shows real archive headline stats and real recent activities | ✓ VERIFIED | `overview.ts` reads `data/stats/*.json` + the index client. See IN-10 for a malformed-stats escalation warning. |
| 30 | P07 | Activities list renders real index rows, each with a View Activity action to the detail route | ✓ VERIFIED | `list.ts:100` builds the CTA against `ROUTES.DETAIL` |
| 31 | P07 | Opening an activity lazy-fetches its detail and stream files and renders its stats header | ✗ FAILED | Never reached for `i`-prefixed ids; error state renders instead. Probe proves the files serve 200. |
| 32 | P07 | Failed detail load shows the exact error copy with a Retry that issues a real new request | ✓ VERIFIED | `detail.ts:64-76` copy; `detail-client.ts:96-101` evicts `inFlight` on rejection so Retry re-requests; human confirmed step 3 |
| 33 | P07 | Registry exposes exactly the six declared routes, detail absent from nav | ✓ VERIFIED | `VIEWS` has 6 entries matching `ALL_ROUTES`; detail excluded from `NAV_ORDER` |
| 34 | P08 | The dashboard SPA is the generated index.html of the published site; showcase at its own URL | ✗ FAILED | True locally (`dist/widgets/index.html` + `widgets.html`), false on `origin/gh-pages` |
| 35 | P08 | Local build produces `dist/widgets/index.html` without wiping widget bundles or standalone pages | ✓ VERIFIED | `dist/widgets/` holds the SPA plus all 11 widget bundles and 4 standalone pages. See WR-05 — the guard protecting this is a misspelled no-op that survives on a Vite default. |
| 36 | P08 | Published directory contains the index manifest and every detail/stream file the SPA can request | ✓ VERIFIED (local publish dir) | `verify-dashboard` 15/15 against `dist/widgets`. **Not** true of the deployed site — folded into gap SC1. |
| 37 | P08 | Nightly workflow regenerates the dashboard index before building, isolating its failure | ✓ VERIFIED | `daily-refresh.yml:86-93` — dedicated step, `continue-on-error: true`, `::warning::` follow-up |
| 38 | P09 | Every URL the dashboard can request resolves over HTTP from the publish directory, no 404s | ✓ VERIFIED | Probe executed by this verifier: 15 checks passed, 0 failures |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/best-effort-exclusions.json` | Committed exclusion list containing 3475726256 | ✓ VERIFIED | schemaVersion 1, contains `"activityId": "3475726256"` with reason |
| `src/analytics/best-effort-exclusions.ts` | loadExclusions / buildExclusionIndex / isExcluded | ✓ VERIFIED | All exports present and imported by `compute-best-efforts.ts:31` |
| `src/dashboard/theme.ts` | 7 declared exports | ✓ VERIFIED | All 7 present (`THEME_STORAGE_KEY`, `parseThemeMode`, `resolveEffectiveTheme`, `cycleThemeMode`, `readStoredMode`, `applyThemeMode`, `watchSystemTheme`) |
| `src/dashboard/styles.css` | Global tokens matching widget theming | ⚠️ ORPHANED RULE | Tokens verified; `.theme-toggle__icon--active { fill: var(--accent) }` at :153-155 is dead code (WR-04) |
| `src/dashboard/router.ts` | parseHash / matchRoute / resolveHash / isValidActivityId / createRouter / navigateTo | ⚠️ WIRED BUT DEFECTIVE | All exports present and used; `isValidActivityId` rejects 55 real archive ids |
| `src/analytics/compute-dashboard-index.ts` | Index generator | ✓ VERIFIED | Produced a 1,221,747-byte, 1,867-row index |
| `src/dashboard/data/index-client.ts` | Fetch-once memoized index access | ✓ VERIFIED | Single `inFlight`; schema-version mismatch warns |
| `src/dashboard/data/detail-client.ts` | Lazy detail + stream fetching | ⚠️ WIRED BUT DEFECTIVE | Correct except it inherits the broken id gate |
| `src/dashboard/index.html` | SPA entry with pre-paint bootstrap | ✓ VERIFIED | Bootstrap before stylesheet; `#app-nav-root` + `#app` containers; noscript fallback |
| `src/dashboard/nav.ts` | Nav, active marking, hamburger, theme toggle | ⚠️ PARTIAL | Structure correct; toggle appends both icons unconditionally with per-child `currentColor` attributes (WR-04) |
| `src/dashboard/view-registry.ts` | VIEWS / getView / clients | ✓ VERIFIED | 6 views, `Map`-backed O(1) lookup, single shared client pair |
| `src/dashboard/main.ts` | Theme → nav → router → prefetch bootstrap | ✓ VERIFIED | Ordering matches `widget-base.ts` `connectedCallback`; non-awaited index prefetch |
| `src/dashboard/views/detail.ts` | The D-07 proving slice | ✗ NON-FUNCTIONAL for 55 newest activities | Guard at :219-225 short-circuits every `i`-prefixed id |
| `src/pages/widgets.html` | Relocated showcase containing `iife.js` | ✓ VERIFIED | Built and served 200 by the probe |
| `scripts/build-widgets.mjs` | Dashboard entry + extended data copy | ⚠️ VERIFIED WITH DEFECT | `buildDashboard()` at :202-216 works; `emptyDir` at :98/:185/:211 is not a Vite option (WR-05) |
| `.github/workflows/daily-refresh.yml` | compute-dashboard-index CI stage | ⚠️ PARTIAL | Index step present; `verify-dashboard` and `npm test` are never run before deploy (WR-06) |
| `scripts/verify-dashboard-publish.mjs` | HTTP smoke check | ✓ VERIFIED | Executed by this verifier — 15/15 |
| `data/dashboard/index.json` | Generated, gitignored manifest | ✓ VERIFIED | Present, gitignored, schemaVersion 1, 1,867 rows |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `compute-best-efforts.ts` | `best-effort-exclusions.ts` | `isExcluded(...)` before the accumulator push | ✓ WIRED | Import at :31, gate at :215 |
| `theme.ts` | `document.documentElement` | `data-theme` attribute (effective, never 'auto') | ✓ WIRED | Matches `:root[data-theme=...]` selectors in styles.css |
| `router.ts` | `window` | Registers **both** `hashchange` and `DOMContentLoaded` | ✓ WIRED | Dual trigger present — initial URL is handled |
| `index.ts` | `compute-dashboard-index.ts` | CLI subcommand, dynamic import | ✓ WIRED | `npm run compute-dashboard-index` produced the live index |
| `detail-client.ts` | `router.ts` | `isValidActivityId` before URL construction | ⚠️ WIRED, WRONG PREDICATE | The link exists exactly as planned; the predicate itself is the blocker |
| `index-client.ts` | `data/dashboard/index.json` | Single memoized fetch | ✓ WIRED | URL built from `baseUrl` default `data/` |
| `index.html` | `styles.css` | Stylesheet link after the bootstrap | ✓ WIRED | Order correct — no flash |
| `nav.ts` | `view.types.ts` | `NAV_ORDER` drives links | ✓ WIRED | Detail route correctly absent |
| `*.stub.ts` | `view.types.ts` | `STUB_PHASE` supplies the phase number | ✓ WIRED | 17/18/18 |
| `list.ts` | `index-client.ts` | Reads in-memory rows, never re-fetches | ✓ WIRED | Shared client from `view-registry.clients` |
| `detail.ts` | `detail-client.ts` | `loadDetail` from mount, after id validation | ✗ NEVER REACHED for `i`-ids | Validation short-circuits |
| `main.ts` | `router.ts` | `createRouter(...).start()` into the registry | ✓ WIRED | With `onNoMatch` → overview fallback |
| `build-widgets.mjs` | `src/dashboard/index.html` | Vite entry writing `dist/widgets/index.html` | ✓ WIRED | Emits the SPA; see WR-05 on the outDir guard |
| `build-widgets.mjs copyDataFiles` | `dist/widgets/data/{dashboard,activities,streams}` | Extended dataDirs list | ✓ WIRED | Probe fetched `/data/activities/i174284902.json` → 200 |
| `daily-refresh.yml` | `node dist/index.js compute-dashboard-index` | Dedicated step, continue-on-error + warning | ✓ WIRED | Lines 86-93 |
| `verify-dashboard-publish.mjs` | `dist/widgets/` | Static server over the exact SPA URLs | ✓ WIRED | Never invoked by CI (WR-06) |
| **`master` (local)** | **`origin/master` → Pages deploy** | **git push** | **✗ NOT WIRED** | **148 commits unpushed; the deploying workflow has never seen `src/dashboard/`** |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `views/overview.ts` | index rows + stats totals | `indexClient.loadIndex()` + `data/stats/*.json` | Yes — 1,867 real rows; stats files serve 200 | ✓ FLOWING |
| `views/list.ts` | `rows` from the index client | Shared memoized `indexClient` | Yes — real rows, real ids, real dates | ⚠️ FLOWING WITH CORRUPTION — dates misparsed for all 55 intervals rows (WR-02, reproduced below) |
| `views/detail.ts` | `detail: ActivityDetail` | `detailClient.loadDetail(id)` | **No** — the call is never made for `i`-prefixed ids | ✗ DISCONNECTED |
| `nav.ts` theme toggle | `mode` / effective theme | `theme.ts` + matchMedia | Yes — state is correct; only the visual is broken | ⚠️ HOLLOW RENDER |
| `dist/widgets/data/**` | published JSON tree | `copyDataFiles` | Yes locally | ✓ FLOWING (local) / ✗ ABSENT on `origin/gh-pages` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Test suite green | `npm test` | 18 files, **334/334 passing** | ✓ PASS |
| Index generated with real rows | `node -e` over `data/dashboard/index.json` | schemaVersion 1, 1,867 rows, 17 keys | ✓ PASS |
| Top-of-list ids are intervals ids | same | first 5 ids all `i`-prefixed; 55 total | ✓ PASS (confirms blast radius) |
| **Id gate accepts a real archive id** | `/^\d{1,20}$/.test('i174284902')` | **`false`** | **✗ FAIL** |
| Detail JSON serves over HTTP | probe `GET /data/activities/i174284902.json` | 200 | ✓ PASS (isolates the bug to the client) |
| Widget/dashboard token parity | diff `styles.css` vs `theme-manager.ts` | identical hexes both modes | ✓ PASS |
| Manifest is gitignored | `git check-ignore -v data/dashboard/index.json` | `.gitignore:14` | ✓ PASS |
| **Date rendering, US viewer** | `TZ=America/New_York` on `2026-08-06T22:30:00` | **`Aug 7, 2026`** (expected Aug 6) | **✗ FAIL** |
| **Date rendering, EU viewer** | `TZ=Europe/Copenhagen` on `2026-08-06T01:30:00` | **`Aug 5, 2026`** (expected Aug 6) | **✗ FAIL** |
| **Dashboard reachable on Pages** | `git ls-tree origin/gh-pages` | no `assets/`, no `widgets.html`, root `index.html` is the old showcase | **✗ FAIL** |
| **Phase code reached the deploy branch** | `git ls-tree origin/master src/` | **no `src/dashboard`**; 148 commits unpushed | **✗ FAIL** |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-dashboard-publish.mjs` | `npm run verify-dashboard` | 15 checks passed, 0 failures | ✓ PASS |

The probe was executed by this verifier, not taken from SUMMARY claims. Its most useful output is diagnostic rather than confirmatory: it fetched `/data/activities/i174284902.json` and `/data/streams/i174284902.json` and got 200s with parseable JSON, which **eliminates** the SUMMARY's stated hypothesis ("fetch URL construction resolving against the wrong base") and localises the defect to `isValidActivityId`.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DASH-01 | 03, 06, 08, 09 | Dashboard SPA on GitHub Pages with hash-based routing between views | ✗ BLOCKED | Routing implementation VERIFIED and human-confirmed locally, but "on GitHub Pages" is unmet — nothing is deployed. REQUIREMENTS.md:97 currently marks this **Complete**; that status is not supported. |
| DASH-02 | 01, 03, 04, 05, 07, 08, 09 | Compact index up front, per-activity detail lazily on demand | ✗ BLOCKED | Index half VERIFIED; lazy-detail half fails for the 55 newest activities. REQUIREMENTS.md:98 correctly marks **Pending**. |
| DASH-03 | 02, 06, 07, 09 | Dark/light theming consistent with the widget system | ✗ BLOCKED | Token parity exact and no-flash confirmed, but the toggle is invisible in light mode. REQUIREMENTS.md:99 correctly marks **Pending**. |

**Orphaned requirements:** none. `grep "Phase 16" .planning/REQUIREMENTS.md` maps exactly DASH-01/02/03, and all three appear across the plan frontmatter.

**Traceability discrepancy:** REQUIREMENTS.md:97 marks DASH-01 Complete on the strength of a locally-served UAT, and ROADMAP.md:54 marks Phase 16 `[x] ... (completed 2026-08-11)`. Both are premature — the 16-09 SUMMARY itself states "Phase 16 is **not** clear to close."

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/router.ts` | 101-103 | Over-narrow validation regex (CR-01) | 🛑 BLOCKER | Rejects all 55 intervals.icu ids — the newest, most-clicked rows. Root cause of DASH-02. |
| *(repo state)* | — | 148 unpushed commits; `origin/master` lacks `src/dashboard/` | 🛑 BLOCKER | The phase goal's "deployed to GitHub Pages" clause cannot be true. Not mentioned in any SUMMARY. |
| `src/dashboard/styles.css` | 141-155 | No `color`; dead `--active` fill rule; no inactive-icon hide (WR-04) | 🛑 BLOCKER (for SC3) | Invisible toggle in light mode; both icons render at once. |
| `src/dashboard/views/list.ts` | 31-34 | `new Date(isoLocal)` on no-`Z` strings then `getUTC*` (WR-02) | ⚠️ WARNING | **Reproduced:** `Aug 6 22:30` → "Aug 7" in `America/New_York`; `Aug 6 01:30` → "Aug 5" in `Europe/Copenhagen`. Wrong dates for all 55 intervals activities in list, overview and detail. Will corrupt Phase 17's calendar bucketing. |
| `src/dashboard/views/list.ts`, `views/overview.ts` | 129-146 / 205-220 | Catch path paints into a container it no longer owns (WR-01) | ⚠️ WARNING | Stale rejection wipes the newly-mounted view. `detail.ts:242-244` does this correctly; the other two do not. |
| `src/analytics/compute-dashboard-index.ts` | 190 | Sort key mixes UTC and machine-local parses, NaN-unsafe (WR-03) | ⚠️ WARNING | Locally-generated index can order same-day boundary activities differently than CI. |
| `scripts/build-widgets.mjs` | 98, 185, 211 | `emptyDir` is not a Vite option — the "CRITICAL" guard is a no-op (WR-05) | ⚠️ WARNING | Build survives only on a Vite default. Any root/outDir change silently wipes 11 widget bundles + the data tree, and the deploy step publishes the gutted directory. |
| `.github/workflows/daily-refresh.yml` | 96-124 | Neither `npm run verify-dashboard` nor `npm test` runs before the Pages deploy (WR-06) | ⚠️ WARNING | The phase's own stated exit gate never executes in the pipeline that publishes. |
| `src/analytics/compute-dashboard-index.ts` | 129-142 | `bestEfforts?.activities[id]` throws per-activity if `activities` is absent (WR-07) | ⚠️ WARNING | A parseable-but-malformed best-efforts file yields a zero-row index that deploys as the live manifest, and pre-push counters break the reconciliation invariant. |
| `src/dashboard/router.test.ts`, `data/detail-client.test.ts` | 86-108 / 39-121 | No `i`-prefixed id case in either suite (IN-07) | ⚠️ WARNING | The test gap that let CR-01 ship at 334/334 green. Any fix must land with these cases or the defect can silently return. |
| `src/dashboard/views/overview.ts` | 112-119, 235 | Malformed stats JSON escalates to a full-page error (IN-10) | ℹ️ INFO | Contradicts `fetchStatsJson`'s documented em-dash degrade contract. |
| `scripts/verify-dashboard-publish.mjs` | 56-65 | `decodeURIComponent` can throw `URIError` and kill the server (IN-01) | ℹ️ INFO | Robustness gap in a function written as a traversal guard. |
| `src/dashboard/index.html` | 8 | CSP `script-src 'self' 'unsafe-inline'` (IN-11) | ℹ️ INFO | Whitelists every inline script for the sake of one bootstrap; a hash would be tighter. |

**Debt-marker gate: PASS.** No `TBD`, `FIXME`, or `XXX` markers in any file this phase touched. The single "coming soon" string is the intentional, spec'd stub copy.

### Human Verification Required

Listed for the post-gap-closure pass. Status remains `gaps_found` (code-observable failures take precedence), but these four cannot be discharged by grep or by any tooling in this repo:

#### 1. Live GitHub Pages navigation

**Test:** Open the live GitHub Pages URL — not a local server — and navigate Overview → Activities → Calendar → Records → Trends and back; hard-refresh on each hash.
**Expected:** All five views render via hash routes, no full page reload, no 404.
**Why human:** Requires the site to actually be deployed and a real browser; nothing in this repo can reach the live Pages origin. The prior UAT was performed against a local server and cannot substitute.

#### 2. Deep link to an intervals.icu activity

**Test:** After the `isValidActivityId` fix, click "View Activity" on the **first** row of the Activities list (an `i`-prefixed id), then cold-load that `#/activity/i...` URL directly.
**Expected:** Stats header, distance/time/pace/elevation/HR/cadence, and stream summary render — not "Couldn't load this activity".
**Why human:** Browser-runtime fetch and render behavior; the HTTP probe cannot exercise the client-side id gate.

#### 3. Theme toggle visibility

**Test:** After the styling fix, view the nav in light mode on both a light-OS and a dark-OS machine.
**Expected:** Exactly one icon visible, legible against the `#f5f5f7` nav surface, active state in the accent color.
**Why human:** Visual contrast against a UA-derived `ButtonText` fallback.

#### 4. Timezone-correct dates

**Test:** With `TZ` set to a non-UTC zone, check the displayed date of a late-evening and an early-morning intervals.icu activity across list, overview and detail.
**Expected:** Displayed date matches the activity's local wall-clock date in every timezone.
**Why human:** The reproduction is scripted above, but confirming the fix across all three rendering sites needs eyes.

### Gaps Summary

Phase 16 built a competent dashboard shell and then failed to land it. Five must-haves fail, and they cluster into three concerns:

**Concern A — the phase's headline clause was never attempted.** The goal says "deployed to GitHub Pages." It is not. `origin/master` does not contain `src/dashboard/` at all; 148 commits sit unpushed on the local branch. Every nightly `daily-refresh` run — including the successful one at 2026-08-11T05:43:50Z, after all phase work was committed locally — built the pre-Phase-16 tree. The live `gh-pages` branch has no `assets/` bundle, no `widgets.html`, and a root `index.html` that is still the old static widget showcase; its `data/` tree contains only `geo, heatmap, routes, stats` — no `dashboard/`, `activities/`, or `streams/`. **No SUMMARY mentions this.** The 16-09 plan quietly narrowed its deployment truth to "resolves over HTTP from the publish directory," and the human UAT was conducted against a local server, so the gap between "the build works" and "the site is live" was never tested by anything. This is the single largest divergence between the phase narrative and the codebase.

**Concern B — the proving slice is broken by a one-character regex, and the test suite was shaped to agree with it.** `isValidActivityId` is `/^\d{1,20}$/`. Fifty-five archived activities carry `i`-prefixed intervals.icu ids, and they are rows 1 through 55 of the generated index — the first thing a user sees and clicks. `detail.ts` paints "Couldn't load this activity" before issuing any request. This verifier's probe run proves the files themselves serve 200 with parseable JSON, which eliminates the SUMMARY's stated hypothesis (a base-URL construction problem) and pins the defect to the id gate. Two things make this more than an ordinary bug: the function's own doc comment says "a real Strava/intervals id is well under it" while the pattern excludes every intervals id, and **plan 03's must-have literally specifies the defect** — "An activity id that is not all digits is rejected." Both test suites were written to that mis-specified must-have, so 334/334 passed on a broken feature. The fix must widen the regex to `/^i?\d{1,20}$/`, correct the must-have wording, and add `i`-prefixed cases to both suites — otherwise the same defect can return green.

**Concern C — the theme is right and the control for it is invisible.** Token parity with `theme-manager.ts` is exact in both modes, and no-flash first paint works. But `.theme-toggle` never sets `color`, so `currentColor` falls back to the UA's `ButtonText`; with `<meta name="color-scheme" content="light dark">` and no CSS syncing the used scheme to `data-theme`, a dark-OS browser paints a near-white icon on the forced-light `#f5f5f7` nav. Compounding it, the `--active` highlight rule targets the `<svg>` root and is always beaten by the children's own `fill="currentColor"` presentation attributes (dead code), and no rule hides the inactive icon, so both sun and moon render simultaneously.

**Beyond the five failures, one warning deserves gap-closure attention on its own merits:** `formatActivityDate` misparses the no-`Z` `start_date_local` that every intervals.icu record carries. This verifier reproduced wrong dates in two real timezones — an evening run shows as the next day for US viewers, an early-morning run as the previous day for European viewers. It affects all 55 migrated activities across list, overview and detail, and Phase 17's calendar view will inherit it as date-bucketing corruption. The same root assumption also skews the index sort key (WR-03).

**Recommended sequencing for gap closure:** (1) widen `isValidActivityId` and add the missing test cases — one-line fix, unblocks DASH-02; (2) fix the theme-toggle CSS — unblocks DASH-03; (3) normalize the no-`Z` date parsing in `list.ts` and `compute-dashboard-index.ts`; (4) push `master` and confirm a real Pages deploy carries the SPA and the `dashboard/activities/streams` data tree; (5) add `npm test` and `npm run verify-dashboard` to `daily-refresh.yml` before the deploy step so the phase's own exit gate actually runs; (6) re-run the four human checks — the navigation one against the live URL this time. Also correct REQUIREMENTS.md:97 (DASH-01 is not Complete) and ROADMAP.md:54 (Phase 16 is not complete).

---

_Verified: 2026-08-11T08:23:19Z_
_Verifier: Claude (gsd-verifier)_
