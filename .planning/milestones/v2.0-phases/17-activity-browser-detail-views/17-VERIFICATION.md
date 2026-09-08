---
phase: 17-activity-browser-detail-views
verified: 2026-08-11T16:54:36Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 17: Activity Browser & Detail Views Verification Report

**Phase Goal:** User can browse, filter, and drill into any of the 1,867+ archived activities, viewing full pace/HR/cadence/elevation detail per run.
**Verified:** 2026-08-11T16:54:36Z
**Status:** passed
**Re-verification:** No — initial verification

## Summary

This verification independently re-ran every automated check and independently inspected the
source that implements each requirement, rather than trusting `17-VALIDATION.md`'s narrative. The
phase's own validation record is unusually forthcoming — it documents two real, human-caught
defects (basemap tiles blocked by the dashboard's own CSP; chart-band x-axis misalignment) that
slipped through a fully green automated gate, and records commit hashes for both fixes. I treated
that record as a claim to falsify, not as evidence, and checked the claims against the actual
committed code.

**Independently re-run and confirmed:**
- `npm test` → 592/592 passed, 27 files (matches the claimed count)
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npm run build-widgets && npm run verify-dashboard` → 20/20 checks passed, 0 failures
- Entry chunk (`index-DQtaLB-_.js`, 60,045 B) contains zero Leaflet and zero Chart.js references;
  `detail-map-*.js` and `detail-charts-*.js` are separate async chunks — confirmed by direct grep
  on the rebuilt `dist/` output, not by reading the claim.
- `src/dashboard/index.html`'s CSP `img-src` directive lists exactly the four tile hosts
  (`*.basemaps.cartocdn.com`, `*.tile.openstreetmap.org`, `*.tile.opentopomap.org`, plus `'self'
  data:`) that `src/widgets/shared/route-utils.ts`'s `addBasemapSwitcher` actually requests —
  confirmed by cross-referencing the two files directly, not by trusting the gap-closure narrative.
- `src/dashboard/views/detail-charts.ts` contains `Y_AXIS_WIDTH_PX = 72` wired into an `afterFit`
  hook on the y-scale, applied uniformly across bands — confirmed present in the built entry as
  committed code (commit `1e652ef`), not merely claimed in a SUMMARY.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can browse a paginated, sortable list of all 1,867+ activities by date, distance, pace, duration, and HR | ✓ VERIFIED | `src/dashboard/views/list-logic.ts` `SORT_KEYS`/`sortRows`/`paginate` (PAGE_SIZE-based, no newest-100 cap); `list.ts` builds a real `<table>` with `aria-sort` per header, wired to `view-registry.ts`'s `/list` route |
| 2 | User can filter by date/distance/pace/duration range and text-search by name, with removable chips and a live count | ✓ VERIFIED | `list-logic.ts` `filterRows` (AND semantics), `buildFilterChips`/`removeChip`; `list.ts` renders chip UI and result count from `filterRows` output |
| 3 | User can view a calendar/month-grid training log | ✓ VERIFIED | `calendar-logic.ts` month-grid math (41 tests); `calendar.ts` (328 lines) renders real grid + multi-run picker, routed via `/calendar` in `view-registry.ts` (no longer a stub) |
| 4 | User can open any activity and see a stats header, route map, and pace/HR/cadence/elevation charts | ✓ VERIFIED | `detail.ts` builds stat tiles then lazily mounts `detail-map.ts` (route + basemap) and `detail-charts.ts` (stacked bands) via `await import()`; both confirmed present as separate async chunks in the real `dist/` build |
| 5 | User can view an auto-computed per-km splits table and pace/HR-zone breakdown, with missing-data states rendering cleanly | ✓ VERIFIED | `detail-splits.ts`/`detail-zones.ts` pure logic (50 tests combined); `detail-sections.ts` `buildBreakdownSection` returns `null` (renders nothing) when both buckets and zoneTimes are empty/absent — confirmed by direct code read, not by claim |
| 6 | Route map basemap tiles actually render in a browser (not blocked by the SPA's own CSP) | ✓ VERIFIED | `index.html` CSP `img-src` explicitly allow-lists the 3 tile CDN hosts used by `addBasemapSwitcher`; commit `edef601` is in the current `git log`, working tree is clean (fix is committed, not left uncommitted) |
| 7 | Chart bands share one x-axis origin across pace/HR/cadence/elevation | ✓ VERIFIED | `detail-charts.ts:78` `Y_AXIS_WIDTH_PX = 72` consumed by an `afterFit` callback on every band's y-scale (line ~513); commit `1e652ef` present in `git log` |
| 8 | Gear tile resolves gear_id → human name → device_name → omitted, never a raw id | ✓ VERIFIED | `gear-client.ts` `resolveGearLabel` ladder is pure/total, never returns raw `gearId`; `data/config/gear.json` has all 16 archive gear ids as keys (values currently blank — hand-fill placeholder per the file's own `note` field, not a code defect; fallback to `device_name` covers this) |
| 9 | Committed `data/config/{gear,athlete}.json` exist with the documented envelope and are served in production | ✓ VERIFIED | Both files present with `schemaVersion`/`note` envelope; `verify-dashboard` confirms `GET /data/config/gear.json -> 200` and `athlete.json` parses with a 5-entry `hrZones` array |
| 10 | View registry actually routes `/list`, `/calendar`, `/activity/:id` to real (non-stub) views | ✓ VERIFIED | `view-registry.ts` `VIEWS` array wires `createListView`/`createCalendarView`/`createDetailView`; only `/records` and `/trends` remain `*.stub.ts` (correctly out of Phase 17 scope, deferred to Phase 18 per `STUB_PHASE`) |
| 11 | Every behavior this repo cannot automate (DOM/Chart.js/Leaflet rendering) was confirmed in a real browser, with genuine defects surfaced rather than hidden | ✓ VERIFIED | `17-VALIDATION.md` Gap-Closure Record documents 2 real defects found in a live browser walkthrough despite a fully green automated gate at the time; both fixes are present as committed, buildable code (confirmed above), and the automated gate was independently re-run green post-fix |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/list.ts` + `list-logic.ts` | Sortable/filterable/paginated activity table | ✓ VERIFIED | 1,116 + ~470 lines; `SORT_KEYS`, `filterRows`, `paginate`, chip UI all present and wired |
| `src/dashboard/views/calendar.ts` + `calendar-logic.ts` | Month-grid calendar, real (not stub) | ✓ VERIFIED | 328 lines; routed via `view-registry.ts`, multi-run picker implemented |
| `src/dashboard/views/detail.ts` | Detail-page orchestration: stats header, lazy map/chart mount, splits/zone sections | ✓ VERIFIED | 653 lines; stale-guarded async mounts confirmed (`myToken`/`mountedContainer` checks) |
| `src/dashboard/views/detail-map.ts` | Lazily-loaded route map w/ basemap switcher | ✓ VERIFIED | 338 lines; separate async chunk confirmed in built `dist/`; `tileerror` handler present |
| `src/dashboard/views/detail-charts.ts` | Lazily-loaded stacked pace/HR/cadence/elevation bands | ✓ VERIFIED | 648 lines; separate async chunk confirmed; `Y_AXIS_WIDTH_PX` alignment fix present |
| `src/dashboard/views/detail-sections.ts` | Splits table + pace/zone breakdown renderers | ✓ VERIFIED | 325 lines; `buildBreakdownSection` correctly returns `null` when no data |
| `src/dashboard/data/gear-client.ts` | Gear resolution client + ladder | ✓ VERIFIED | Pure `resolveGearLabel`, tolerant fetch/parse, memoized-except-on-failure |
| `src/dashboard/data/athlete-config-client.ts` | HR-zone config client | ✓ VERIFIED | Exists, tested (11 tests) |
| `data/config/gear.json`, `data/config/athlete.json` | Committed config files | ✓ VERIFIED | Both present, correct envelope, served 200 by `verify-dashboard` |
| `src/dashboard/view-registry.ts` | Routes `/list`, `/calendar`, `/activity/:id` to real views | ✓ VERIFIED | `VIEWS` array wires all three; no-stub confirmed by import inspection |
| `src/dashboard/index.html` | CSP allows basemap tile hosts | ✓ VERIFIED | `img-src` explicitly lists the 3 tile CDN hosts used by the map code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `main.ts` router | `view-registry.ts` `getView()` | `onMatch` handler | ✓ WIRED | `main.ts` calls `getView(match.route)` and `view.mount(...)`, with an app-wide error boundary and stale-navigation guard |
| `view-registry.ts` | `list.ts`/`calendar.ts`/`detail.ts` | direct import + `VIEWS` array entries | ✓ WIRED | All three imported and constructed with real dependencies (`indexClient`, `detailClient`, `gearClient`, `athleteConfigClient`) |
| `detail.ts` | `detail-map.ts` / `detail-charts.ts` | `await import('./detail-map.js')` / `await import('./detail-charts.js')` | ✓ WIRED | Confirmed both as separate content-hashed async chunks in the actual `dist/` build (not just source-level import statements) |
| `detail-charts.ts` chart config | y-scale `afterFit` | `Y_AXIS_WIDTH_PX` constant | ✓ WIRED | Constant declared once, referenced in the `afterFit` callback applied to every band |
| `index.html` CSP | `route-utils.ts` `addBasemapSwitcher` tile URLs | `img-src` allow-list | ✓ WIRED | 3 of 3 tile CDN hostnames used by the map code appear verbatim in the CSP directive |
| `gear-client.ts` `resolveGearLabel` | `detail.ts` stat-grid gear tile | conditional `statGrid.appendChild` only when `gearLabel !== null` | ✓ WIRED | Confirmed at `detail.ts:502` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `list.ts` table rows | `sorted`/`pageItems` | `indexClient.loadIndex()` → `data/dashboard/index.json` | Yes — `verify-dashboard` confirms a non-empty `activities` array is served in production | ✓ FLOWING |
| `calendar.ts` day cells | index rows grouped by day | same `indexClient` | Yes — same production index feed | ✓ FLOWING |
| `detail.ts` charts/map | `detail.stream` | `detailClient` → per-activity `data/streams/*.json` | Yes — `verify-dashboard` confirms a real stream file (`i174284902.json`) parses with a non-empty `t` array | ✓ FLOWING |
| `detail.ts` gear tile | `gearLabel` | `gearClient.load()` → `data/config/gear.json` | Partial — map exists and is served, but all 16 values are currently blank placeholders (falls back to `device_name`); this is a content-authoring gap in committed data, not a code/wiring defect | ⚠️ STATIC (data content, not code) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` | 592/592 passed, 27 files | ✓ PASS |
| Type check | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| Build + publish verification | `npm run build-widgets && npm run verify-dashboard` | 20/20 checks passed | ✓ PASS |
| Entry chunk excludes Leaflet/Chart.js | `grep -c leaflet/Chart.register` on rebuilt entry chunk | 0 matches for both | ✓ PASS |
| CSP allow-lists exactly the tile hosts the map code requests | cross-file grep, `index.html` vs `route-utils.ts` | 3/3 hosts match | ✓ PASS |
| DOM rendering / Leaflet map mounting / Chart.js canvas mounting | — | not automatable (no jsdom, `environment: 'node'`) | ? SKIP — routed to the phase's own documented real-browser checkpoint (17-15), which is where GAP 1 and GAP 2 were actually caught |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| BROWSE-01 | 17-01, 17-02, 17-08, 17-15 | Paginated list of all 1,867+ activities | ✓ SATISFIED | `list-logic.ts` no page cap; `verify-dashboard` confirms full index served |
| BROWSE-02 | 17-01, 17-02, 17-08, 17-15 | Sort by date/distance/pace/duration/HR | ✓ SATISFIED | `SORT_KEYS`, `compareRows`, `aria-sort` header wiring |
| BROWSE-03 | 17-02, 17-09, 17-15 | Filter by date/distance/pace/duration range | ✓ SATISFIED | `filterRows` AND semantics, tested (54 list-logic tests) |
| BROWSE-04 | 17-02, 17-09, 17-15 | Text-search by name | ✓ SATISFIED | `filterRows` substring match, tested |
| BROWSE-05 | 17-01, 17-03, 17-10, 17-15 | Calendar/month-grid training log | ✓ SATISFIED | `calendar-logic.ts` + `calendar.ts`, routed, no longer a stub |
| BROWSE-06 | 17-01, 17-02, 17-09, 17-13, 17-14, 17-15 | Removable filter chips, live count, missing-data states render cleanly | ✓ SATISFIED | `buildFilterChips`/`removeChip`; `buildBreakdownSection` returns `null` on absent data |
| DETAIL-01 | 17-06, 17-07, 17-14, 17-15 | Stats header incl. gear | ✓ SATISFIED | `detail.ts` stat grid; `resolveGearLabel` ladder |
| DETAIL-02 | 17-01, 17-11, 17-14, 17-15 | Route map, reusing existing map infra | ✓ SATISFIED | `detail-map.ts` reuses `RouteRenderer`/`addBasemapSwitcher` from `route-utils.ts`; CSP fix (`edef601`) confirmed committed and correct |
| DETAIL-03 | 17-01, 17-04, 17-12, 17-14, 17-15 | Pace/HR/cadence/elevation charts | ✓ SATISFIED | `detail-charts.ts` stacked bands; x-axis alignment fix (`1e652ef`) confirmed committed and correct |
| DETAIL-04 | 17-04, 17-13, 17-14, 17-15 | Per-km splits table | ✓ SATISFIED | `detail-splits.ts` interpolated boundary crossings, tested (17 tests) |
| DETAIL-05 | 17-01, 17-05, 17-06, 17-07, 17-13, 17-14, 17-15 | Pace-distribution/zone breakdown | ✓ SATISFIED | `detail-zones.ts` pace buckets + HR zones, tested (33 tests); panel hides cleanly when absent |

No orphaned requirements — all 11 IDs (BROWSE-01..06, DETAIL-01..05) appear in at least one plan's `requirements:` frontmatter and are cross-referenced in `REQUIREMENTS.md` as `Phase 17 | Complete`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `data/config/gear.json` | all 16 entries | Blank gear-name values (hand-fill placeholder, documented in the file's own `note` field) | ℹ️ Info | Not a code defect — `resolveGearLabel` correctly falls back to `device_name`; the map "exists and covers all 16 ids" as the plan's truth requires, it just has no filled-in names yet. Does not block the phase goal. |
| `.planning/ROADMAP.md` / `.planning/STATE.md` | phase-17 summary lines | Still describe the pre-gap-closure PARTIAL/OPEN state (last touched by commit `ad7f6dd`, before the fix commits `edef601`/`1e652ef`/`31a5654`) | ℹ️ Info | Documentation-sync lag, not a functional defect. `REQUIREMENTS.md` and `17-VALIDATION.md` were updated by the later commit `31a5654`; `ROADMAP.md`/`STATE.md` were not. Does not affect actual application behavior — flagging so the next `/gsd-verify-work` or docs pass reconciles these two files. |
| `src/dashboard/views/detail-charts.ts`, `list.ts` | scattered | Empty-array-literal initializations (`const bands: BandState[] = []`, etc.) | ℹ️ Info | Verified these are populated later in the same function before being rendered — not stubs, standard accumulator pattern |

No `TBD`/`FIXME`/`XXX` debt markers found anywhere in `src/dashboard/`.

### Human Verification Required

None. All behaviors that require DOM/Chart.js/Leaflet rendering (uncoverable by this repo's
`environment: 'node'` test setup) were already routed through and confirmed by the phase's own
blocking real-browser checkpoint (17-15), which is documented with verbatim human quotes, two
named defects, and confirmed fixes in `17-VALIDATION.md`'s Gap-Closure Record. I independently
verified that both fixes are present as committed, buildable code rather than merely claimed, and
re-ran the full automated gate myself rather than trusting the recorded numbers. No further human
verification is needed to close this phase gate.

### Gaps Summary

No blocking gaps. Two informational (non-blocking) documentation items are noted above: (1)
`data/config/gear.json` has all-blank gear names — a data-authoring task, not a code gap, and the
resolution ladder degrades correctly; (2) `ROADMAP.md`/`STATE.md` were not updated by the final
gap-closure commit and still narrate the earlier PARTIAL state — a docs-sync task for a subsequent
commit, not a functional gap in the delivered feature.

---

_Verified: 2026-08-11T16:54:36Z_
_Verifier: Claude (gsd-verifier)_
