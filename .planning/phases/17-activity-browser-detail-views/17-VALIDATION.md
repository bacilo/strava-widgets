---
phase: 17
slug: activity-browser-detail-views
status: draft
nyquist_compliant: false
wave_0_complete: false
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

## Per-Task Verification Map

> One row per task across plans 17-01..17-15, assigned during planning (2026-08-11).
> Status is updated during execution; plan 17-15 Task 3 records the final result.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 17-01 | 1 | BROWSE-01..06, DETAIL-02..05 | T-17-CSS-02 | Literal hex tokens only; no user value in a CSS declaration | unit (source-text) | `npm test -- --run src/dashboard/styles.test.ts` | ❌ extends existing | ⬜ pending |
| 17-01-T2 | 17-01 | 1 | BROWSE-01, BROWSE-02, BROWSE-05, BROWSE-06 | T-17-CSS-01 | Tint derived from already-public distance only | source assertion | `npm test -- --run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| 17-01-T3 | 17-01 | 1 | DETAIL-02..05 | T-17-CSS-02 | `--accent-strong` consumed by exactly 2 controls | source assertion | `npm test -- --run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| 17-02-T1 | 17-02 | 1 | BROWSE-01, BROWSE-02 | T-17-URL-01, T-17-URL-02 | Sort key allow-listed; page clamped; no NaN/Infinity | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-02-T2 | 17-02 | 1 | BROWSE-03, BROWSE-04, BROWSE-06 | T-17-URL-03, T-17-VW-01 | `q` trimmed + 200-char capped; chips are plain strings | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-03-T1 | 17-03 | 1 | BROWSE-05 | T-17-URL-04 | `?month=` allow-listed to `YYYY-MM` with range checks | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-03-T2 | 17-03 | 1 | BROWSE-05 | T-17-CAL-01, T-17-CAL-02 | Grid bounds never query-driven; bad dates skipped | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-04-T1 | 17-04 | 1 | DETAIL-04 | T-17-STR-01, T-17-STR-02 | `validateStreamSeries` gate; no non-finite pace | unit | `vitest run src/dashboard/views/detail-splits.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-04-T2 | 17-04 | 1 | DETAIL-03 | T-17-LS-01, T-17-GEO-01 | Overlay config allow-listed + capped on READ | unit | `vitest run src/dashboard/views/detail-charts-logic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-05-T1 | 17-05 | 1 | DETAIL-05 | T-17-STR-04 | Zero-distance segments excluded, no Infinity bucket | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-05-T2 | 17-05 | 1 | DETAIL-05 | T-17-CFG-01, T-17-CFG-02, T-17-STR-03 | All-or-nothing config gate; HR clamped to 5 zones | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-06-T1 | 17-06 | 1 | DETAIL-01, DETAIL-05 | T-17-CFG-03 | No tokens/ids in committed config; disclosure documented | CLI (JSON shape) | `node` JSON shape assertion (in-plan) | n/a — new files | ⬜ pending |
| 17-06-T2 | 17-06 | 1 | DETAIL-01, DETAIL-05 | T-17-PUB-01, T-17-PUB-02 | Publish verifier asserts shape, not just reachability | integration (HTTP) | `npm run build-widgets && npm run verify-dashboard` | ✅ extends existing | ⬜ pending |
| 17-07-T1 | 17-07 | 2 | DETAIL-01 | T-17-CFG-04, T-17-CFG-06, T-17-VW-02 | Raw gear id never returned; wrong shape → null | unit | `vitest run src/dashboard/data/gear-client.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-07-T2 | 17-07 | 2 | DETAIL-05 | T-17-CFG-05, T-17-DC-01 | Single validation chokepoint; failure never poisons client | unit | `vitest run src/dashboard/data/athlete-config-client.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-08-T1 | 17-08 | 2 | BROWSE-01, BROWSE-02 | T-17-VW-01, T-17-URL-01, T-17-VW-03 | `textContent` only; no `innerHTML`; href via property | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group A) | ✅ list.test.ts | ⬜ pending |
| 17-08-T2 | 17-08 | 2 | BROWSE-01 | T-17-URL-02, T-17-VW-04 | Render uses `clampedPage`; scroll/focus stale-guarded | source + manual | `npm test -- --run src/dashboard` + browser (17-15 A6, F36) | ✅ | ⬜ pending |
| 17-09-T1 | 17-09 | 3 | BROWSE-03, BROWSE-04 | T-17-URL-02, T-17-VW-05 | Debounce timer cleared on unmount | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group B) | ✅ | ⬜ pending |
| 17-09-T2 | 17-09 | 3 | BROWSE-06 | T-17-VW-01, T-17-VW-06 | Chip labels via `textContent`; named zero-match state | source + manual | `npm test -- --run src/dashboard` + browser (17-15 B11-B13) | ✅ | ⬜ pending |
| 17-10-T1 | 17-10 | 2 | BROWSE-05 | T-17-URL-04, T-17-VW-04 | Shared IndexClient; stale guard on both paths | source + manual | `npm test -- --run src/dashboard` + browser (17-15 group C) | ✅ | ⬜ pending |
| 17-10-T2 | 17-10 | 2 | BROWSE-05 | T-17-VW-01, T-17-CAL-03, T-17-REG-01 | Picker reuses safe card renderer; stub-revert guard | unit + manual | `vitest run src/dashboard/view-registry.test.ts` + browser (C17) | ✅ extends existing | ⬜ pending |
| 17-11-T1 | 17-11 | 2 | DETAIL-02 | T-17-VW-01, T-17-MAP-03 | `showPopup: false`; polyline decoded once | source + manual | `npx tsc --noEmit` + browser (17-15 D20-D21) | n/a — no jsdom | ⬜ pending |
| 17-11-T2 | 17-11 | 2 | DETAIL-02 | T-17-POLY-01, T-17-MAP-02 | Decode/import failure → retryable error state | build + manual | entry-chunk Leaflet-free assertion + browser (D20, E33) | n/a — no jsdom | ⬜ pending |
| 17-12-T1 | 17-12 | 2 | DETAIL-03 | T-17-STR-02, T-17-CHT-01 | No non-finite point plotted; LTTB caps at 500 | source + manual | `npx tsc --noEmit` + browser (17-15 E24, E29) | n/a — no jsdom | ⬜ pending |
| 17-12-T2 | 17-12 | 2 | DETAIL-03 | T-17-LS-01, T-17-LS-02, T-17-CHT-02 | Cap enforced via `parseOverlayConfig`, not DOM counting | build + manual | entry-chunk Chart.js-free assertion + browser (E25-E28) | n/a — no jsdom | ⬜ pending |
| 17-13-T1 | 17-13 | 2 | DETAIL-04, BROWSE-06 | T-17-VW-01, T-17-VW-07, T-17-VW-08 | Widths are clamped numbers; scroll confined to wrapper | source + manual | `npx tsc --noEmit` + browser (17-15 E30) | n/a — no jsdom | ⬜ pending |
| 17-13-T2 | 17-13 | 2 | DETAIL-05 | T-17-CFG-02 | No zone boundary constructed; null renders nothing | source + manual | `npx tsc --noEmit` + browser (17-15 E31-E32) | n/a — no jsdom | ⬜ pending |
| 17-14-T1 | 17-14 | 3 | DETAIL-01 | T-17-URL-05, T-17-VW-01, T-17-CFG-06 | `isValidActivityId` chokepoint preserved; gear ladder only | source + manual | `npm test -- --run src/dashboard` + browser (17-15 D22-D23) | ✅ | ⬜ pending |
| 17-14-T2 | 17-14 | 3 | DETAIL-04, DETAIL-05, BROWSE-06 | T-17-VW-04, T-17-CFG-05 | Config-load await stale-guarded; null → append nothing | source + manual | `npx tsc --noEmit` + browser (17-15 E30-E32) | ✅ | ⬜ pending |
| 17-14-T3 | 17-14 | 3 | DETAIL-02, DETAIL-03 | T-17-MAP-02, T-17-VW-04 | Every await stale-guarded; both handles destroyed | build + manual | entry-chunk assertions + browser (17-15 D20, F34) | n/a — no jsdom | ⬜ pending |
| 17-15-T1 | 17-15 | 4 | all 11 | T-17-PUB-03 | Build served under `/strava-widgets`, never at root | integration | `npm test && npm run build-widgets && npm run verify-dashboard` | ✅ | ⬜ pending |
| 17-15-T2 | 17-15 | 4 | all 11 | T-17-PUB-04, T-17-MAP-04 | Failures recorded verbatim, never patched under pressure | manual (blocking) | MISSING — no jsdom / no headless browser dep; browser walkthrough | n/a | ⬜ pending |
| 17-15-T3 | 17-15 | 4 | all 11 | T-17-PUB-04 | Sign-off resolves to approved or partial, never draft | CLI | `node` frontmatter assertion (in-plan) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Type (from research, pre-planning)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Pagination math (page size, page count, page-1 reset on filter/sort change) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ W0 |
| BROWSE-02 | Sort comparators for date/distance/pace/duration/HR, direction flip | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ W0 |
| BROWSE-02 | Table renders, header click sorts, `aria-sort` set | manual | real-browser checkpoint | — |
| BROWSE-03 | Date-range/numeric-range filter predicates (AND semantics, preset values) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ W0 |
| BROWSE-04 | Text-search matching (case-insensitive substring) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ W0 |
| BROWSE-05 | Month-grid date math (day-of-week offsets, leap years, month boundaries, group-by-day) | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ W0 |
| BROWSE-05 | Calendar renders, cell tinting, multi-run picker opens | manual | real-browser checkpoint | — |
| BROWSE-06 | Filter-chip serialization/removal, zero-match empty-state message | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ W0 |
| BROWSE-06 | Missing-HR/cadence badges render cleanly | manual | real-browser checkpoint | — |
| DETAIL-01 | Gear/`device_name` fallback resolution (gear.json → device_name → omit) | unit | `vitest run src/dashboard/data/gear-client.test.ts` | ❌ W0 |
| DETAIL-01 | Stats header renders all named tiles | manual | real-browser checkpoint | — |
| DETAIL-02 | Route map renders, hover-syncs a position marker | manual | real-browser checkpoint (Leaflet untestable under Node) | — |
| DETAIL-03 | Smoothing rolling-window math, LTTB decimation input prep | unit | `vitest run src/dashboard/views/detail-charts-logic.test.ts` | ❌ W0 |
| DETAIL-03 | Chart bands render, overlay picker limits to 2, x-axis toggle | manual | real-browser checkpoint (Chart.js canvas untestable under Node) | — |
| DETAIL-04 | Per-km split computation (interpolated boundary crossings, final partial km) | unit | `vitest run src/dashboard/views/detail-splits.test.ts` | ❌ W0 |
| DETAIL-04 | Splits table renders 7 columns, responsive collapse | manual | real-browser checkpoint | — |
| DETAIL-05 | Pace-bucket histogram; HR-zone time-in-zone vs `data/athlete.json` boundaries | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ❌ W0 |
| DETAIL-05 | Zone panel hides entirely when config/HR absent | unit + manual | logic unit-tested; visual absence confirmed manually | ❌ W0 (logic) |

---

## Wave 0 Requirements

- [ ] `src/dashboard/views/list-logic.test.ts` — sort/filter/paginate/URL-state pure functions (BROWSE-01..04, BROWSE-06)
- [ ] `src/dashboard/views/calendar-logic.test.ts` — month-grid date math, group-by-day (BROWSE-05)
- [ ] `src/dashboard/views/detail-splits.test.ts` — per-km split computation, partial-km handling (DETAIL-04)
- [ ] `src/dashboard/views/detail-zones.test.ts` — pace-bucket + HR-zone bucketing (DETAIL-05)
- [ ] `src/dashboard/data/gear-client.test.ts` — gear/`device_name` fallback resolution, tolerant fetch (DETAIL-01)
- [ ] `src/dashboard/data/athlete-config-client.test.ts` — tolerant fetch/parse of `data/athlete.json` (DETAIL-05 zone-config gate)
- [ ] No framework install needed — vitest is already configured; these are new test files, not new tooling

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table renders; header click sorts; `aria-sort` reflects state | BROWSE-02 | No jsdom — `document` undefined under `environment: 'node'` | Open list view, click each sortable header twice, confirm order flips and `aria-sort` toggles |
| Filter chips add/remove; live result count updates | BROWSE-03, BROWSE-04, BROWSE-06 | DOM interaction | Apply date + distance + text filters, remove each chip, confirm count tracks visible rows |
| Calendar renders; cell tinting; multi-run day picker opens | BROWSE-05 | DOM interaction | Navigate ≥3 months incl. a month boundary and a multi-run day |
| Missing-HR/cadence badges render cleanly | BROWSE-06 | Visual | Find an activity with no HR and one with no cadence; confirm badge, no broken layout |
| Stats header renders all named tiles incl. gear fallback | DETAIL-01 | Visual | Open one activity with `gear_id` and one of the 708 gear-less activities |
| Route map renders; hover syncs position marker | DETAIL-02 | Leaflet untestable under Node | Open an activity with a polyline and one of the 27 with a `map` object but no usable `summary_polyline` |
| Chart bands render; overlay picker caps at 2; x-axis toggle | DETAIL-03 | Chart.js canvas untestable under Node | Toggle overlays past the cap, switch x-axis between distance and time |
| Splits table renders 7 columns; responsive collapse | DETAIL-04 | Visual/responsive | View at desktop and narrow widths |
| Zone panel hidden entirely when config or HR absent | DETAIL-05 | Visual absence | Open an activity with no HR; confirm no empty panel shell |
| **Production publish check** — new data files reachable, dynamic Leaflet/Chart.js chunk loads | all | Phase 16 postmortem: 15/15 automated green but black page in production | After `npm run build-widgets`, serve `dist/` and load list + calendar + a detail view; confirm no 404s in the network panel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
