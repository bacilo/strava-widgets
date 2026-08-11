---
phase: 17
slug: activity-browser-detail-views
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-11
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `17-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (installed) |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`) |
| **Quick run command** | `npm test -- --run src/dashboard` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 second (373 tests currently pass in ~540ms) |

**Critical constraint:** No `jsdom`/`happy-dom` is installed and `environment: 'node'` means
`document`/`window` are undefined in test files. Every automated test this phase adds MUST target
pure functions with no DOM dependency. DOM rendering, Chart.js canvas mounting, Leaflet map
mounting, and click/keyboard interaction are **not** automatable under this toolchain and must be
verified manually in a real browser — the same split `src/dashboard/router.ts` already documents
for its hash-binding code.

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/dashboard`
- **After every plan wave:** Run `npm test` **plus** `npm run build-widgets && npm run verify-dashboard`
- **Before `/gsd-verify-work`:** Full suite green, `verify-dashboard` green, AND every row in
  *Manual-Only Verifications* below confirmed in a real browser
- **Max feedback latency:** 5 seconds

---

## Automated Evidence (17-15 Task 1, recorded 2026-08-11)

| Check | Result |
|---|---|
| `npm test` | **592/592 passed**, 27 test files, 624ms. Delta vs. pre-phase baseline of 373: **+219 tests** |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, clean |
| `npm run build-widgets` | succeeded, including the `data/config/*.json` copy step |
| `npm run verify-dashboard` | **20/20 checks passed, 0 failures**, including `GET /data/config/gear.json -> 200` and `GET /data/config/athlete.json -> 200` |

**Chunk inventory** (`dist/widgets/assets/` — resolved fresh this build; filenames are content-hashed and differ from any prior build's recorded names):

| File | Size | Leaflet refs | "chart" substring refs |
|---|---|---|---|
| `index-C4VZzD15.js` (dashboard entry, `<script type="module">` in `index.html`) | 60,045 B | 0 | 6 — all benign (dynamic-`import()` path strings, the `mountChartBands` function name, and the error copy "Couldn't load the charts"); no Chart.js library code present |
| `detail-map-CFE38LJh.js` (async) | 154,129 B | 104 | — |
| `detail-map-CIGW-MKW.css` (async, map chunk's stylesheet) | 15,607 B | — | — |
| `detail-charts-BLeo4CpR.js` (async) | 158,239 B | — | 160 |
| `detail-charts-logic-D7KMi84v.js` (async, small logic helper) | 2,493 B | — | — |

D-25's build-level split holds: the entry chunk carries neither library, both async chunks carry
their respective library, and a CSS asset was emitted for the map chunk. The network-level half of
this proof (does the async `<link>` actually take effect in a live page load under `base: './'`) is
exactly what walkthrough item D21 tests — and GAP 1 below shows it currently does not.

---

## Per-Task Verification Map

> One row per task across plans 17-01..17-15, assigned during planning (2026-08-11).
> Status is updated during execution; plan 17-15 Task 3 records the final result.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 17-01 | 1 | BROWSE-01..06, DETAIL-02..05 | T-17-CSS-02 | Literal hex tokens only; no user value in a CSS declaration | unit (source-text) | `npm test -- --run src/dashboard/styles.test.ts` | ✅ extends existing | ✅ green |
| 17-01-T2 | 17-01 | 1 | BROWSE-01, BROWSE-02, BROWSE-05, BROWSE-06 | T-17-CSS-01 | Tint derived from already-public distance only | source assertion | `npm test -- --run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| 17-01-T3 | 17-01 | 1 | DETAIL-02..05 | T-17-CSS-02 | `--accent-strong` consumed by exactly 2 controls | source assertion | `npm test -- --run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| 17-02-T1 | 17-02 | 1 | BROWSE-01, BROWSE-02 | T-17-URL-01, T-17-URL-02 | Sort key allow-listed; page clamped; no NaN/Infinity | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ | ✅ green |
| 17-02-T2 | 17-02 | 1 | BROWSE-03, BROWSE-04, BROWSE-06 | T-17-URL-03, T-17-VW-01 | `q` trimmed + 200-char capped; chips are plain strings | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ | ✅ green |
| 17-03-T1 | 17-03 | 1 | BROWSE-05 | T-17-URL-04 | `?month=` allow-listed to `YYYY-MM` with range checks | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ | ✅ green |
| 17-03-T2 | 17-03 | 1 | BROWSE-05 | T-17-CAL-01, T-17-CAL-02 | Grid bounds never query-driven; bad dates skipped | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ | ✅ green |
| 17-04-T1 | 17-04 | 1 | DETAIL-04 | T-17-STR-01, T-17-STR-02 | `validateStreamSeries` gate; no non-finite pace | unit | `vitest run src/dashboard/views/detail-splits.test.ts` | ✅ | ✅ green |
| 17-04-T2 | 17-04 | 1 | DETAIL-03 | T-17-LS-01, T-17-GEO-01 | Overlay config allow-listed + capped on READ | unit | `vitest run src/dashboard/views/detail-charts-logic.test.ts` | ✅ | ✅ green |
| 17-05-T1 | 17-05 | 1 | DETAIL-05 | T-17-STR-04 | Zero-distance segments excluded, no Infinity bucket | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ✅ | ✅ green |
| 17-05-T2 | 17-05 | 1 | DETAIL-05 | T-17-CFG-01, T-17-CFG-02, T-17-STR-03 | All-or-nothing config gate; HR clamped to 5 zones | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ✅ | ✅ green |
| 17-06-T1 | 17-06 | 1 | DETAIL-01, DETAIL-05 | T-17-CFG-03 | No tokens/ids in committed config; disclosure documented | CLI (JSON shape) | `node` JSON shape assertion (in-plan) | n/a — new files | ✅ green (re-confirmed by `verify-dashboard`'s gear/athlete shape checks, 17-15 Task 1) |
| 17-06-T2 | 17-06 | 1 | DETAIL-01, DETAIL-05 | T-17-PUB-01, T-17-PUB-02 | Publish verifier asserts shape, not just reachability | integration (HTTP) | `npm run build-widgets && npm run verify-dashboard` | ✅ extends existing | ✅ green (20/20 checks, 0 failures) |
| 17-07-T1 | 17-07 | 2 | DETAIL-01 | T-17-CFG-04, T-17-CFG-06, T-17-VW-02 | Raw gear id never returned; wrong shape → null | unit | `vitest run src/dashboard/data/gear-client.test.ts` | ✅ | ✅ green |
| 17-07-T2 | 17-07 | 2 | DETAIL-05 | T-17-CFG-05, T-17-DC-01 | Single validation chokepoint; failure never poisons client | unit | `vitest run src/dashboard/data/athlete-config-client.test.ts` | ✅ | ✅ green |
| 17-08-T1 | 17-08 | 2 | BROWSE-01, BROWSE-02 | T-17-VW-01, T-17-URL-01, T-17-VW-03 | `textContent` only; no `innerHTML`; href via property | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group A) | ✅ list.test.ts | ✅ green — group A reported no problems |
| 17-08-T2 | 17-08 | 2 | BROWSE-01 | T-17-URL-02, T-17-VW-04 | Render uses `clampedPage`; scroll/focus stale-guarded | source + manual | `npm test -- --run src/dashboard` + browser (17-15 A6, F36) | ✅ | ✅ green — A6/F36 reported no problems |
| 17-09-T1 | 17-09 | 3 | BROWSE-03, BROWSE-04 | T-17-URL-02, T-17-VW-05 | Debounce timer cleared on unmount | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group B) | ✅ | ✅ green — group B reported no problems |
| 17-09-T2 | 17-09 | 3 | BROWSE-06 | T-17-VW-01, T-17-VW-06 | Chip labels via `textContent`; named zero-match state | source + manual | `npm test -- --run src/dashboard` + browser (17-15 B11-B13) | ✅ | ✅ green — B11-B13 reported no problems |
| 17-10-T1 | 17-10 | 2 | BROWSE-05 | T-17-URL-04, T-17-VW-04 | Shared IndexClient; stale guard on both paths | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group C) | ✅ | ✅ green — group C reported no problems |
| 17-10-T2 | 17-10 | 2 | BROWSE-05 | T-17-VW-01, T-17-CAL-03, T-17-REG-01 | Picker reuses safe card renderer; stub-revert guard | unit + manual | `vitest run src/dashboard/view-registry.test.ts` + browser (C17) | ✅ extends existing | ✅ green — C17 reported no problems |
| 17-11-T1 | 17-11 | 2 | DETAIL-02 | T-17-VW-01, T-17-MAP-03 | `showPopup: false`; polyline decoded once | source + manual | `npx tsc --noEmit` + browser (17-15 D20-D21) | n/a — no jsdom | ❌ red — **GAP 1** (D21): basemap tiles do not render, see Gap-Closure Record below |
| 17-11-T2 | 17-11 | 2 | DETAIL-02 | T-17-POLY-01, T-17-MAP-02 | Decode/import failure → retryable error state | build + manual | entry-chunk Leaflet-free assertion + browser (D20, E33) | n/a — no jsdom | ✅ green — D20 (no 404s) and E33 (route-unavailable state) both reported clean; independent of GAP 1's tile-CSS defect |
| 17-12-T1 | 17-12 | 2 | DETAIL-03 | T-17-STR-02, T-17-CHT-01 | No non-finite point plotted; LTTB caps at 500 | source + manual | `npx tsc --noEmit` + browser (17-15 E24, E29) | n/a — no jsdom | ⚠️ flaky — **GAP 2** (E24): band x-axis origins not vertically aligned across bands; E29 (x-axis toggle contrast) itself not flagged |
| 17-12-T2 | 17-12 | 2 | DETAIL-03 | T-17-LS-01, T-17-LS-02, T-17-CHT-02 | Cap enforced via `parseOverlayConfig`, not DOM counting | build + manual | entry-chunk Chart.js-free assertion + browser (E25-E28) | n/a — no jsdom | ⚠️ flaky — **GAP 2** (E25): shared-crosshair guarantee undermined by the same axis-misalignment defect; E26-E28 (overlay shading/independence) not flagged |
| 17-13-T1 | 17-13 | 2 | DETAIL-04, BROWSE-06 | T-17-VW-01, T-17-VW-07, T-17-VW-08 | Widths are clamped numbers; scroll confined to wrapper | source + manual | `npx tsc --noEmit` + browser (17-15 E30) | n/a — no jsdom | ✅ green — E30 reported no problems |
| 17-13-T2 | 17-13 | 2 | DETAIL-05 | T-17-CFG-02 | No zone boundary constructed; null renders nothing | source + manual | `npx tsc --noEmit` + browser (17-15 E31-E32) | n/a — no jsdom | ✅ green — E31-E32 reported no problems |
| 17-14-T1 | 17-14 | 3 | DETAIL-01 | T-17-URL-05, T-17-VW-01, T-17-CFG-06 | `isValidActivityId` chokepoint preserved; gear ladder only | source + manual | `npm test -- --run src/dashboard` + browser (17-15 D22-D23) | ✅ | ✅ green — D22-D23 reported no problems |
| 17-14-T2 | 17-14 | 3 | DETAIL-04, DETAIL-05, BROWSE-06 | T-17-VW-04, T-17-CFG-05 | Config-load await stale-guarded; null → append nothing | source + manual | `npx tsc --noEmit` + browser (17-15 E30-E32) | ✅ | ✅ green — E30-E32 reported no problems |
| 17-14-T3 | 17-14 | 3 | DETAIL-02, DETAIL-03 | T-17-MAP-02, T-17-VW-04 | Every await stale-guarded; both handles destroyed | build + manual | entry-chunk assertions + browser (17-15 D20, F34) | n/a — no jsdom | ✅ green — D20/F34 reported no problems; unaffected by GAP 1/GAP 2 (both cosmetic-rendering, not stale-guard defects) |
| 17-15-T1 | 17-15 | 4 | all 11 | T-17-PUB-03 | Build served under `/strava-widgets`, never at root | integration | `npm test && npm run build-widgets && npm run verify-dashboard` | ✅ | ✅ green — 592/592 tests, clean `tsc`, 20/20 verify-dashboard checks |
| 17-15-T2 | 17-15 | 4 | all 11 | T-17-PUB-04, T-17-MAP-04 | Failures recorded verbatim, never patched under pressure | manual (blocking) | MISSING — no jsdom / no headless browser dep; browser walkthrough | n/a | ⚠️ flaky — **PARTIAL**: 2 named gaps (below), all other groups A/B/C/D(remainder)/E(remainder)/F reported clean by the developer as whole groups, not confirmed step-by-step |
| 17-15-T3 | 17-15 | 4 | all 11 | T-17-PUB-04 | Sign-off resolves to approved or partial, never draft | CLI | `node` frontmatter assertion (in-plan) | n/a | ✅ green — resolved to `partial` per the 16-09 precedent |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Type (from research, pre-planning)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Pagination math (page size, page count, page-1 reset on filter/sort change) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ |
| BROWSE-02 | Sort comparators for date/distance/pace/duration/HR, direction flip | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ |
| BROWSE-02 | Table renders, header click sorts, `aria-sort` set | manual | real-browser checkpoint | confirmed — group A clean |
| BROWSE-03 | Date-range/numeric-range filter predicates (AND semantics, preset values) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ |
| BROWSE-04 | Text-search matching (case-insensitive substring) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ |
| BROWSE-05 | Month-grid date math (day-of-week offsets, leap years, month boundaries, group-by-day) | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ |
| BROWSE-05 | Calendar renders, cell tinting, multi-run picker opens | manual | real-browser checkpoint | confirmed — group C clean |
| BROWSE-06 | Filter-chip serialization/removal, zero-match empty-state message | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ✅ |
| BROWSE-06 | Missing-HR/cadence badges render cleanly | manual | real-browser checkpoint | confirmed — reported clean |
| DETAIL-01 | Gear/`device_name` fallback resolution (gear.json → device_name → omit) | unit | `vitest run src/dashboard/data/gear-client.test.ts` | ✅ |
| DETAIL-01 | Stats header renders all named tiles | manual | real-browser checkpoint | confirmed — group D22-23 clean |
| DETAIL-02 | Route map renders, hover-syncs a position marker | manual | real-browser checkpoint (Leaflet untestable under Node) | **GAP 1** — polyline renders, basemap tiles do not |
| DETAIL-03 | Smoothing rolling-window math, LTTB decimation input prep | unit | `vitest run src/dashboard/views/detail-charts-logic.test.ts` | ✅ |
| DETAIL-03 | Chart bands render, overlay picker limits to 2, x-axis toggle | manual | real-browser checkpoint (Chart.js canvas untestable under Node) | **GAP 2** — band x-axis origins misaligned; overlay cap/toggle themselves not flagged |
| DETAIL-04 | Per-km split computation (interpolated boundary crossings, final partial km) | unit | `vitest run src/dashboard/views/detail-splits.test.ts` | ✅ |
| DETAIL-04 | Splits table renders 7 columns, responsive collapse | manual | real-browser checkpoint | confirmed — group E30 clean |
| DETAIL-05 | Pace-bucket histogram; HR-zone time-in-zone vs `data/athlete.json` boundaries | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ✅ |
| DETAIL-05 | Zone panel hides entirely when config/HR absent | unit + manual | logic unit-tested; visual absence confirmed manually | ✅ (logic) + confirmed — group E31-32 clean |

---

## Wave 0 Requirements

- [x] `src/dashboard/views/list-logic.test.ts` — sort/filter/paginate/URL-state pure functions (BROWSE-01..04, BROWSE-06) — 54 tests, green
- [x] `src/dashboard/views/calendar-logic.test.ts` — month-grid date math, group-by-day (BROWSE-05) — 41 tests, green
- [x] `src/dashboard/views/detail-splits.test.ts` — per-km split computation, partial-km handling (DETAIL-04) — 17 tests, green
- [x] `src/dashboard/views/detail-zones.test.ts` — pace-bucket + HR-zone bucketing (DETAIL-05) — 33 tests, green
- [x] `src/dashboard/data/gear-client.test.ts` — gear/`device_name` fallback resolution, tolerant fetch (DETAIL-01) — 26 tests, green
- [x] `src/dashboard/data/athlete-config-client.test.ts` — tolerant fetch/parse of `data/athlete.json` (DETAIL-05 zone-config gate) — 11 tests, green
- [x] No framework install needed — vitest is already configured; these are new test files, not new tooling

---

## Manual-Only Verifications

Result recorded 2026-08-11 from the 17-15 Task 2 browser checkpoint. The developer's verbatim
summary: *"Looking pretty great! Few small notes (perhaps they will still be attended to): 1. the
map is not showing. The map underlay i mean, the path looks good but stands over a white
background. 2. The x axis of Heart Rate, Elevation, etc... are not aligned at 0. Because the pace
legend is longer '10:00/km' vs '120' for Heart Rate for instance, means that the 0's are not along
the same vertical line. When browsing through the results the lines look a little misaligned as a
consequence."* Everything else was reported clean as whole groups (A–F), not confirmed step-by-step
against all 38 individual items in 17-15-PLAN.md's walkthrough script — recorded honestly below
rather than manufacturing per-step confirmations that were not given.

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Table renders; header click sorts; `aria-sort` reflects state | BROWSE-02 | No jsdom — `document` undefined under `environment: 'node'` | Open list view, click each sortable header twice, confirm order flips and `aria-sort` toggles | ✅ confirmed (group A) |
| Filter chips add/remove; live result count updates | BROWSE-03, BROWSE-04, BROWSE-06 | DOM interaction | Apply date + distance + text filters, remove each chip, confirm count tracks visible rows | ✅ confirmed (group B) |
| Calendar renders; cell tinting; multi-run day picker opens | BROWSE-05 | DOM interaction | Navigate ≥3 months incl. a month boundary and a multi-run day | ✅ confirmed (group C) |
| Missing-HR/cadence badges render cleanly | BROWSE-06 | Visual | Find an activity with no HR and one with no cadence; confirm badge, no broken layout | ✅ confirmed (group E, no-HR/no-cadence step) |
| Stats header renders all named tiles incl. gear fallback | DETAIL-01 | Visual | Open one activity with `gear_id` and one of the 708 gear-less activities | ✅ confirmed (group D, gear steps) |
| Route map renders; hover syncs position marker | DETAIL-02 | Leaflet untestable under Node | Open an activity with a polyline and one of the 27 with a `map` object but no usable `summary_polyline` | ❌ **GAP 1** — polyline + hover-sync marker work, but basemap tiles render as a white background (see Gap-Closure Record) |
| Chart bands render; overlay picker caps at 2; x-axis toggle | DETAIL-03 | Chart.js canvas untestable under Node | Toggle overlays past the cap, switch x-axis between distance and time | ⚠️ **GAP 2** — bands render, overlay cap and x-axis toggle themselves not flagged as broken, but band x-axis origins are not vertically aligned (see Gap-Closure Record) |
| Splits table renders 7 columns; responsive collapse | DETAIL-04 | Visual/responsive | View at desktop and narrow widths | ✅ confirmed (group E30) |
| Zone panel hidden entirely when config or HR absent | DETAIL-05 | Visual absence | Open an activity with no HR; confirm no empty panel shell | ✅ confirmed (group E31-32) |
| **Production publish check** — new data files reachable, dynamic Leaflet/Chart.js chunk loads | all | Phase 16 postmortem: 15/15 automated green but black page in production | After `npm run build-widgets`, serve `dist/` and load list + calendar + a detail view; confirm no 404s in the network panel | ✅ confirmed — 20/20 automated checks (17-15 Task 1) + no 404s reported during the manual walkthrough (group D20) |

---

## Gap-Closure Record (17-15 Task 2, PARTIAL result — 16-09 precedent)

Recorded verbatim rather than patched under checkpoint pressure, per T-17-PUB-04's mitigation and
the 16-09 precedent (STATE.md § Blockers/Concerns: DASH-02/DASH-03 were logged as gaps, not
silently fixed mid-checkpoint).

### GAP 1 — Route map basemap tiles do not render

- **Requirement:** DETAIL-02
- **Walkthrough item:** D21 (17-15-PLAN.md Task 2)
- **Severity:** non-blocking, degrades a core visual surface — the route polyline itself renders
  correctly (confirmed) and the page does not crash, but the map underlay (tile imagery) is absent,
  leaving the route drawn over a plain white background.
- **User's verbatim words:** "the map is not showing. The map underlay i mean, the path looks good
  but stands over a white background."
- **Orchestrator's interpretation (not the user's words):** `RouteRenderer.addBasemapSwitcher()`
  does add the Positron `L.tileLayer` via `.addTo(map)`, so the layer itself is registered — the
  vector-renders-but-tiles-absent signature points at `leaflet/dist/leaflet.css` not taking effect
  for the dynamically-imported map chunk, rather than a missing tile layer. This directly implicates
  the phase's own MEDIUM-confidence assumption (17-UI-SPEC.md's Assumption A1 / threat
  T-17-MAP-04: "Async-CSS `<link>` injection failing under `base: './'`"). Root cause is still under
  active diagnosis — this is recorded as an open gap, not as diagnosed-and-fixed.
- **Automated evidence that does NOT catch this:** `verify-dashboard-publish.mjs` confirmed
  `detail-map-CIGW-MKW.css` (15,607 bytes) is emitted and reachable over HTTP under `/strava-widgets`
  (17-15 Task 1), and the entry-chunk/async-chunk Leaflet-split assertion passed — none of that
  proves the `<link>` actually gets injected into the live DOM before Leaflet paints, which is
  exactly the browser-only failure mode this gap exposes.

### GAP 2 — Chart band x-axes are not vertically aligned across bands

- **Requirement:** DETAIL-03, DETAIL-04
- **Walkthrough items:** E24 (band order/alignment), and undermines the shared-crosshair guarantee
  checked at E25
- **Severity:** non-blocking, cosmetic/readability — all bands render, values are correct, but
  scanning down the stack the plotted lines read as misaligned.
- **User's verbatim words:** "The x axis of Heart Rate, Elevation, etc... are not aligned at 0.
  Because the pace legend is longer '10:00/km' vs '120' for Heart Rate for instance, means that the
  0's are not along the same vertical line. When browsing through the results the lines look a
  little misaligned as a consequence."
- **Orchestrator's interpretation (not the user's words):** each band auto-sizes its own y-axis
  gutter to its widest tick label, so a pace band ("10:00/km") reserves more left-gutter width than
  an HR band ("120"), leaving each band's plot area starting at a different x-offset. Consequence:
  the x=0 origins do not share a vertical line, and — more importantly — this also undermines the
  shared-crosshair guarantee documented in 17-UI-SPEC.md § 4c (item 25 of the walkthrough), since a
  single screen x-coordinate maps to a different data x per band once their plot-area origins
  diverge.
- **Automated evidence that does NOT catch this:** no automated test in this repo renders a Chart.js
  canvas (no jsdom, per Test Infrastructure above) — cross-band pixel alignment is fundamentally
  outside what `detail-charts-logic.test.ts`'s pure-function coverage can prove; it can only be
  caught by eye, exactly as this checkpoint did.

**Everything else reported clean.** Groups A, B, C, the remainder of D (route/gear/stats-header
mechanics apart from the tile underlay), the remainder of E (splits table, pace histogram, zone
panel, overlay independence/persistence, no-HR/no-cadence handling), and F (theme toggle, rapid
navigation, back-button return, keyboard tab order, console errors) were reported clean by the
developer ("Looking pretty great!"). This is recorded as **whole-group** confirmation, not as 38
individually-checked steps — the developer did not itemize a pass/fail per numbered step, and this
document does not manufacture per-step confirmations that were not given.

**Next step:** gap-closure planning via `/gsd-plan-phase 17 --gaps` before the phase gate can close.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — all six Wave 0 files exist and pass (182 tests: 54+41+17+33+26+11 across list-logic/calendar-logic/detail-splits/detail-zones/gear-client/athlete-config-client)
- [x] No watch-mode flags — `vitest run` / `npm test` (maps to `"test": "vitest run"` in package.json), never `test:watch`
- [x] Feedback latency < 5s — full suite runs in ~624ms
- [ ] `nyquist_compliant: true` set in frontmatter — **left false.** The validation *methodology*
      satisfies every box above, but this flag is tied to a fully clean phase gate (17-15-PLAN.md
      Task 3 acceptance criteria: `nyquist_compliant: true` only when every checkpoint group
      passed). Two named gaps remain open (GAP 1, GAP 2), so this stays `false` until gap-closure
      work lands and a re-verification checkpoint confirms both are resolved.

**Approval:** PARTIAL — approved with 2 named gaps (GAP 1: route map basemap tiles absent; GAP 2:
chart band x-axis misalignment). Not ready for `/gsd-verify-work` as a clean pass; gap-closure
planning is the required next step. See Gap-Closure Record above.
