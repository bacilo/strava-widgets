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

> Task IDs are assigned by the planner. This table is filled in during planning (one row per task)
> and status-tracked during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending planning_ | — | — | — | — | — | — | — | — | ⬜ pending |

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
