# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- ✅ **v1.2 Maps & Geo Fix** — Phases 10-13 (shipped 2026-02-18)
- ✅ **v2.0 Training Dashboard** — Phases 14-18 (shipped 2026-08-12)
- 🚧 **v2.1 Interface Polish** — Phases 19-25 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-14</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-14
- [x] Phase 2: Analytics (2/2 plans) — completed 2026-02-14
- [x] Phase 3: Widgets (4/4 plans) — completed 2026-02-14
- [x] Phase 4: Pipeline (1/1 plan) — completed 2026-02-14

</details>

<details>
<summary>✅ v1.1 Geographic & Widget Customization (Phases 5-9) — SHIPPED 2026-02-16</summary>

- [x] Phase 5: Geocoding Infrastructure (1/1 plan) — completed 2026-02-15
- [x] Phase 6: Geographic Statistics (2/2 plans) — completed 2026-02-15
- [x] Phase 7: Widget Attribute System (3/3 plans) — completed 2026-02-15
- [x] Phase 8: Geographic Table Widget (2/2 plans) — completed 2026-02-15
- [x] Phase 9: CI/CD Integration (2/2 plans) — completed 2026-02-16

</details>

<details>
<summary>✅ v1.2 Maps & Geo Fix (Phases 10-13) — SHIPPED 2026-02-18</summary>

- [x] Phase 10: Geocoding Foundation & Map Infrastructure (4/4 plans) — completed 2026-02-17
- [x] Phase 11: Route Map Widgets (3/3 plans) — completed 2026-02-17
- [x] Phase 12: Heatmap & Pin Map Widgets (2/2 plans) — completed 2026-02-17
- [x] Phase 13: Standalone Pages (2/2 plans) — completed 2026-02-18

</details>

<details>
<summary>✅ v2.0 Training Dashboard (Phases 14-18) — SHIPPED 2026-08-12</summary>

- [x] Phase 14: Stream Ingestion Foundation (5/5 plans) — completed 2026-08-10
- [x] Phase 15: Best-Effort Engine (4/4 plans) — completed 2026-08-10
- [x] Phase 16: Dashboard Shell & Data Contract (16/16 plans) — completed 2026-08-11
- [x] Phase 17: Activity Browser & Detail Views (15/15 plans) — completed 2026-08-11
- [x] Phase 18: Records, Trends & Differentiators (16/16 plans) — completed 2026-08-12

Full phase details: [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) · Audit: [`v2.0-MILESTONE-AUDIT.md`](v2.0-MILESTONE-AUDIT.md)

</details>

### 🚧 v2.1 Interface Polish (Phases 19-25, in progress)

**Milestone Goal:** Bring the whole dashboard up to the standard its best screens already set — consistent interaction, properly styled controls, and charts you can actually navigate. Refinement of shipped v2.0 capability, not new capability.

**Phase Numbering:**

- Integer phases (19, 20, 21...): Planned milestone work
- Decimal phases (19.1, 19.2): Urgent insertions (marked with INSERTED)
- Continues from v2.0, which ended at Phase 18.

**Verification note:** every phase below ends with a mandatory human browser checkpoint against a production-shaped URL (served under `/strava-widgets`, matching how GitHub Pages actually serves this app — not the server root). This project has shipped rendering defects behind a fully green automated gate three times (Phase 16's black page behind 15/15 checks; Phase 17's two rendering defects behind 592/592 tests, clean `tsc`, and 20/20 `verify-dashboard`; Phase 18's near-miss needing a human checkpoint to confirm ~15 canvases). There is no jsdom and no headless browser in this repo, so no phase's success criteria can be satisfied by `npm test` alone.

- [x] **Phase 19: Design System & Control Styling** - Every input, button, select and card follows one shared visual treatment, with a visible focus ring in both themes, across all five screens (17 plans executed; 19-05 human checkpoint returned PARTIAL — a dead `--radius-control` CSS token and an occluded focus ring were open gaps, closed by plans 19-06/19-07; 19-09 gap-closure re-verification checkpoint returned approved 2026-08-13 on the developer's blanket verdict — see 19-VALIDATION.md Gap-Closure Record; `nyquist_compliant: true`. REOPENED 2026-08-13: post-checkpoint code review (19-REVIEW.md) surfaced three critical defects the checkpoint never exercised; 19-VERIFICATION.md re-verified at 3/4 must-haves with UI-02 failed — see CR-01/CR-02/CR-03. Round 3 (19-10/19-11/19-12) closed CR-02/CR-03 on rendered evidence but found a new defect (GAP 7: sticky nav does not remain on screen while scrolling) blocking row 18/UI-02; `nyquist_compliant: false` again, gate still open. Round 4 (19-13..19-17) planned 2026-08-13: GAP 7 diagnosed empirically (19-13, H1 confirmed — zero-travel containing block) before being fixed (19-14), two critical guard-layer defects from `19-REVIEW-round3.md` closed with mutation-proven fixes (19-15), the ladder comment's truth repaired (19-16), and 19-17's five-row human checkpoint returned a **CLEAN SWEEP**: rows 20-24 all PASS, closing GAP 7 (row 20) and GAP 6 (row 21) on rendered evidence, gated on Probes G and H. `nyquist_compliant: true`; UI-02 ticked complete — phase gate closes 2026-08-13. One new gap found unprompted this round, GAP 8 (Leaflet map tiles paint over the nav, plus a totality defect in the ladder comment itself), left unpatched, reasoned not to block UI-02, disposition deferred to the user as a possible follow-up plan or a logged deferral)
- [ ] **Phase 20: Row-Click Interaction Pattern** - Every activity row, on every screen, is clickable, keyboard-accessible, and free of redundant "View Activity" buttons
- [ ] **Phase 21: Overview Rebuild** - Overview's PR/activity rows, records scope toggle, headline stats, and the Current Streak "ended" label all reach the standard the rest of the dashboard sets
- [ ] **Phase 22: Calendar Week-Start & Totals** - User controls whether the week starts Sunday or Monday, with correct persisted totals either way
- [ ] **Phase 23: Trends Zoom, Pan & Taller Bands** - User can zoom and pan trend charts with mouse, touch, or on-screen controls, on taller bands, without breaking tab-cycling or the canvas lifecycle
- [ ] **Phase 24: Local Curation Mode** - Developer can toggle per-distance PR exclusions from a localhost-only UI, with the write path provably absent from the published bundle
- [ ] **Phase 25: CI Hardening & Light-Theme Verification** - Compute-chain ordering has one source of truth, the publish verifier checks every stats document by name, a gear-aggregate crash is closed, and Phase 16's light-OS theme items are finally confirmed live

## Phase Details

### Phase 19: Design System & Control Styling

**Goal**: Form controls, buttons, selects and card/spacing rhythm follow one shared visual treatment across all five screens (Overview, Activities, Calendar, Records, Trends), fixing the root cause of the "raw" feel without changing the existing visual language.
**Depends on**: Phase 18 (v2.0 shell and screens; this is the v2.1 entry point)
**Requirements**: UI-01, UI-02, UI-03, ACT-01
**Success Criteria** (what must be TRUE):

  1. Every text, date, number and search input across all five screens renders with consistent border, padding, and background — not unstyled browser defaults (the stylesheet currently has zero `input` rules).
  2. Buttons and selects share one visual treatment, with a `:focus-visible` ring that meets non-text contrast requirements, visible in both dark and light themes.
  3. Spacing, density and card treatment read as one rhythm across all five screens, without altering the existing visual language elsewhere.
  4. The Activities screen (`list.ts`) picks up the new control styling while its existing row-click interaction model — the reference pattern for Phase 20 — is visually and functionally unchanged.
  5. **Human checkpoint**: served under a production-shaped `/strava-widgets` URL in a real browser, all five screens are visually compared side by side; every input/button/select looks intentional, and `:focus-visible` rings are checked by tabbing through controls in both themes.

**Plans**: 17 plans in 17 waves (all sequential — every implementation plan writes to `src/dashboard/styles.css` or `src/dashboard/styles.test.ts`). Plans 01-05 shipped; 19-05's checkpoint returned PARTIAL, so plans 06-09 are gap closure; 19-09's blanket approval was found not defensible by `19-VERIFICATION.md`, which reopened UI-02 on three code-review defects (CR-01/CR-02/CR-03), so plans 10-12 are a second gap-closure round; 19-12's checkpoint returned PARTIAL on a newly-found defect (GAP 7, sticky nav does not remain on screen) and a round-3 code review found two critical guard-layer defects, so plans 13-17 are a third gap-closure round — diagnosis before fix, mutation-proven guards, and a five-row human checkpoint. **Closed 2026-08-13:** 19-17's checkpoint returned a clean sweep on all five Round 4 rows; the phase gate is closed and no further gap-closure round is required.

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — radius tokens + card/panel/spacing rhythm (D-13, D-14)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — input/select/textarea baseline + type reset (D-01..D-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-03-PLAN.md — button baseline, scoped shared hover, disabled treatment, row-hover retrofit (D-05..D-08)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-04-PLAN.md — two-tone focus ring, container clipping fixes, five regression describe blocks (D-04, D-09..D-12)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 19-05-PLAN.md — full gate + BLOCKING human browser checkpoint under /strava-widgets (13-row agenda) — returned **PARTIAL**

**Wave 6** *(gap closure — blocked on Wave 5 completion)*

- [x] 19-06-PLAN.md — parse-level CSS gate + dead `--radius-control` token fix + `.segmented` radius token (GAP 1, GAP 3, WR-01)

**Wave 7** *(gap closure — blocked on Wave 6 completion)*

- [x] 19-07-PLAN.md — focus-ring stacking context against neighbour paint order + button-baseline comment correction (GAP 2, WR-02)

**Wave 8** *(gap closure — blocked on Wave 7 completion)*

- [x] 19-08-PLAN.md — parenthesis-aware selector splitting in `styles.test.ts` (WR-03)

**Wave 9** *(gap closure — blocked on Wave 8 completion)*

- [x] 19-09-PLAN.md — BLOCKING human re-verification of rows 1, 3, 6, 12 only, under /strava-widgets

**Wave 10** *(gap closure round 2 — blocked on Wave 9 completion)*

- [x] 19-10-PLAN.md — sticky-layer ladder: `.app-nav` z-index above the focus ring, `.splits-table__km` tie resolved, plus WR-01/WR-02 test hardening (CR-01)

**Wave 11** *(gap closure round 2 — blocked on Wave 10 completion)*

- [x] 19-11-PLAN.md — `.segmented__option` cancels the button baseline radius; focus ring kept at full opacity on focusable aria-disabled controls (CR-02, CR-03)

**Wave 12** *(gap closure round 2 — blocked on Wave 11 completion)*

- [x] 19-12-PLAN.md — BLOCKING human checkpoint, six-row agenda with one named verdict per row, both themes, under /strava-widgets

**Wave 13** *(gap closure round 3 — blocked on Wave 12 completion)*

- [x] 19-13-PLAN.md — diagnose GAP 7 empirically: five candidate root causes, a field-level discrimination matrix, two rendered DOM probes, one confirmed cause or an INCONCLUSIVE stop (no fix written)

**Wave 14** *(gap closure round 3 — blocked on Wave 13 completion)*

- [x] 19-14-PLAN.md — apply the fix the confirmed root cause prescribes, pin the ladder's positioning precondition (R3-WR-01), confirm on rendered evidence with Probe F on two routes

**Wave 15** *(gap closure round 3 — blocked on Wave 14 completion)*

- [x] 19-15-PLAN.md — guard layer: at-rule range rejection, last-wins helpers, anchored numeric extraction, one rule scanner, head-shape hover assertion (R3-CR-01, R3-CR-02, R3-WR-02, R3-IN-01..04)

**Wave 16** *(gap closure round 3 — blocked on Wave 15 completion)*

- [x] 19-16-PLAN.md — stylesheet comment corrections: ladder rung 4, the disproven stickiness claim, the descendant-containment scope, foreign line-citation rot, plus reasoned deferrals (R3-WR-03, R3-WR-04, R3-IN-05, WR-03)

**Wave 17** *(gap closure round 3 — blocked on Wave 16 completion)*

- [x] 19-17-PLAN.md — BLOCKING human checkpoint, five-row Round 4 agenda with one named verdict per row, probe-gated premises, both themes, under /strava-widgets — returned **CLEAN SWEEP, approved**

**UI hint**: yes

### Phase 20: Row-Click Interaction Pattern

**Goal**: Every row representing an activity, on every screen, is clickable through to that activity using the same pattern `list.ts` already established — propagated, not reinvented — and is keyboard-accessible rather than a click handler on a bare `<div>`.
**Depends on**: Phase 19 (shared control/focus styling that the new interactive rows and any surviving controls must match)
**Requirements**: UX-01, UX-02, UX-03, REC-08
**Success Criteria** (what must be TRUE):

  1. Every row representing an activity on Overview (Recent PRs, Recent Activities) and Records navigates to that activity's detail view on click, using `list.ts`'s existing pattern.
  2. Redundant "View Activity" call-to-action buttons are removed from Records (and anywhere else the row itself is now the affordance), matching the reference at `list.ts:224`.
  3. Row-level navigation is keyboard-operable — Tab reaches the row, Enter/Space activates it — and is announced correctly to assistive tech (a real link/button semantic, not a bare clickable `<div>`).
  4. **Human checkpoint**: served under `/strava-widgets` in a real browser, tab through Overview and Records rows keyboard-only, confirm consistent focus order and activation, and confirm mouse clicks on rows across all screens land on the correct activity.

**Plans**: TBD
**UI hint**: yes

### Phase 21: Overview Rebuild

**Goal**: Overview — the weakest of the five screens — reaches the same standard as Activities and Records: structured, linked PR/activity rows, a records scope toggle, this-year figures in Headline Stats, and a Current Streak tile that renders its "ended" state.
**Depends on**: Phase 19 (design system), Phase 20 (row-click pattern Overview's rows now build on)
**Requirements**: OVR-01, OVR-02, OVR-03, OVR-04, FIX-01
**Success Criteria** (what must be TRUE):

  1. Recent PRs rows show name, date, distance and PR badge in a deliberate visual hierarchy (not three stacked divs) and link to the activity via the Phase 20 pattern.
  2. Recent Activities rows follow the same structure and linking as Recent PRs.
  3. User can switch the records section between at least all-time and current-year views (e.g. a "This year's records" tab), styled with the Phase 19 control treatment.
  4. Headline Stats shows distance this year and hours this year alongside the existing all-time figures.
  5. The Current Streak tile's `ended {date}` sub-label renders when a streak has ended, verified against a fixture with a genuinely ended streak (root cause was `currentStreakStart` only being populated while a streak is active — `streak-utils.ts:118`).
  6. **Human checkpoint**: served under `/strava-widgets` in a real browser, confirm Overview visually and interactively matches the polish level of Activities/Records, toggle the records scope, and confirm an ended-streak fixture renders its sub-label.

**Plans**: TBD
**UI hint**: yes

### Phase 22: Calendar Week-Start & Totals

**Goal**: User can choose whether the training-log week starts Sunday or Monday; the choice persists and correctly drives which days each week-total sums, on calendar controls styled to match the rest of the dashboard.
**Depends on**: Phase 19 (control styling for CAL-03); independent of Phases 20-21 and can run in parallel with Phase 23
**Requirements**: CAL-01, CAL-02, CAL-03
**Success Criteria** (what must be TRUE):

  1. User can switch the calendar's week start between Sunday and Monday via a control, and the choice persists across reloads.
  2. The month grid itself re-flows correctly under both settings — `calendar-logic.ts`'s currently hard-coded Sunday-first grid math (`buildMonthGrid`) is generalized and covered by unit tests for both week-start values, not just restyled.
  3. Each week row shows a computed total (distance/time) at its end, and the total is correct for the selected week start — i.e. which days constitute "this week" changes with the setting, and so does the sum.
  4. The week-start control and any other Calendar inputs use the shared styling from Phase 19 (UI-01/UI-02).
  5. **Human checkpoint**: served under `/strava-widgets` in a real browser, toggle week start, confirm the grid re-flows, week totals recompute correctly for a week that straddles the old/new start boundary, and the setting survives a reload.

**Plans**: TBD
**UI hint**: yes

### Phase 23: Trends Zoom, Pan & Taller Bands

**Goal**: User can zoom and pan trend charts — via `chartjs-plugin-zoom`, gesture, and explicit on-screen controls — on taller chart bands, without any of it regressing the five-tab structure, the granularity toggle, or the canvas lifecycle.
**Depends on**: Phase 18 (existing Trends view); independent of the screen-styling phases (19-22) and can run in parallel with them
**Requirements**: TRN-01, TRN-02, TRN-03, TRN-04
**Success Criteria** (what must be TRUE):

  1. User can zoom into a trend chart via `chartjs-plugin-zoom` (wheel/pinch), so a weekly view no longer shows the entire 15-year archive compressed into one screen.
  2. User can pan a chart horizontally via gesture AND via explicit +/− and left/right on-screen controls that work with no pointing device at all.
  3. Chart bands render taller than the current fixed 140px (`.chart-band__canvas-wrap`), giving the y-axis usable range on a page with room to spare.
  4. Zoom/pan composes correctly with the existing granularity toggle and the five-tab structure: rapidly cycling tabs with zoom/pan state present does not throw "Canvas is already in use" and each tab's chart destroys/reinitializes cleanly (the failure mode Phase 18 flagged as the one to watch).
  5. **Human checkpoint**: served under `/strava-widgets` in a real browser, exercise zoom/pan via mouse and via the on-screen controls on multiple tabs, rapidly cycle through all five Trends tabs and the granularity toggle several times, and confirm no console errors and no stuck/duplicated canvases.

**Plans**: TBD
**UI hint**: yes

### Phase 24: Local Curation Mode

**Goal**: Developer can toggle an activity's (or a single distance's) exclusion from PR calculations through a localhost-only UI instead of hand-editing `data/best-effort-exclusions.json`, with a required reason surfaced in the detail view — and the write path is provably absent from the published bundle.
**Depends on**: Phase 19 (shared control styling for the curation UI); self-contained otherwise
**Requirements**: CUR-01
**Success Criteria** (what must be TRUE):

  1. Running `npm run curate` starts a localhost-only server exposing a UI to browse activities and toggle PR exclusion per distance — not just whole-run, since a GPS spike typically corrupts only the short splits while the same run's 5k/10k remain honest.
  2. Toggling an exclusion requires entering a reason, which is then surfaced in the activity detail view.
  3. `verify-dashboard-publish.mjs` gains a new assertion, following the `assertNoPrivateArtifacts` precedent, that the curation write path (server code, curate UI bundle, write endpoints) is absent from the published GitHub Pages bundle — and that assertion demonstrably fails against a build that regresses this.
  4. **Human checkpoint**: run `npm run curate` locally, toggle a per-distance exclusion end-to-end with a reason, confirm it lands in `data/best-effort-exclusions.json` and renders in the detail view; separately, load the production build served under `/strava-widgets` in a real browser and confirm no curation write endpoint is present or reachable.

**Plans**: TBD
**UI hint**: yes

### Phase 25: CI Hardening & Light-Theme Verification

**Goal**: The small, independent carried-forward items land together — a gear-aggregate crash is closed, the nightly compute chain has one source of truth instead of two hand-maintained orderings, the publish verifier checks every stats document by name instead of trusting a directory copy, and Phase 16's three genuinely untested theme/first-paint items are finally confirmed on a real light-OS machine.
**Depends on**: Phase 16 (theme engine being verified); otherwise independent of Phases 19-24 and can run last as a closing phase
**Requirements**: FIX-02, CI-01, CI-02, VER-01
**Success Criteria** (what must be TRUE):

  1. `gear-aggregate-logic.ts` degrades into the Unknown bucket (instead of crashing `slugify(undefined)`) when an index row's `gearName` key is entirely absent, not just `null` — with a regression test for the missing-key case.
  2. The nightly GitHub Actions workflow and `compute-all-stats` share a single source of truth for compute-step ordering; there are no longer two independently hand-maintained orderings of the same chain.
  3. `verify-dashboard-publish.mjs` asserts reachability by name for `weekly-distance`, `monthly-stats`, `yearly-stats`, `year-over-year`, `best-efforts.json`, and a sample of per-activity best-effort shards, rather than relying on the whole-directory copy to carry them.
  4. On a genuinely light-OS machine (light appearance set at the OS level, not toggled via the in-page control), the dashboard is legible, shows no first-paint white flash, and live-follows an OS-level appearance change from light to dark and back — discharging the three Phase 16 UAT items that phases 17 and 18's checkpoints, both apparently run from a dark-OS machine, never actually tested.
  5. **Human checkpoint**: item 4 is run from an actual light-OS environment against the `/strava-widgets`-served production build (this cannot be satisfied by an in-page theme toggle); items 1-3 are confirmed by a green `verify-dashboard-publish.mjs` run and a real (or dry-run) nightly workflow execution.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25

**v2.1 parallelization note:** Phase 23 (Trends) carries no dependency on the screen-styling work in Phases 20-22 and may execute in parallel with them once Phase 19 (Design System) is complete. Phase 24 (Local Curation Mode) similarly only depends on Phase 19.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-14 |
| 2. Analytics | v1.0 | 2/2 | Complete | 2026-02-14 |
| 3. Widgets | v1.0 | 4/4 | Complete | 2026-02-14 |
| 4. Pipeline | v1.0 | 1/1 | Complete | 2026-02-14 |
| 5. Geocoding Infrastructure | v1.1 | 1/1 | Complete | 2026-02-15 |
| 6. Geographic Statistics | v1.1 | 2/2 | Complete | 2026-02-15 |
| 7. Widget Attribute System | v1.1 | 3/3 | Complete | 2026-02-15 |
| 8. Geographic Table Widget | v1.1 | 2/2 | Complete | 2026-02-15 |
| 9. CI/CD Integration | v1.1 | 2/2 | Complete | 2026-02-16 |
| 10. Geocoding Foundation & Map Infrastructure | v1.2 | 4/4 | Complete | 2026-02-17 |
| 11. Route Map Widgets | v1.2 | 3/3 | Complete | 2026-02-17 |
| 12. Heatmap & Pin Map Widgets | v1.2 | 2/2 | Complete | 2026-02-17 |
| 13. Standalone Pages | v1.2 | 2/2 | Complete | 2026-02-18 |
| 14. Stream Ingestion Foundation | v2.0 | 5/5 | Complete    | 2026-08-10 |
| 15. Best-Effort Engine | v2.0 | 4/4 | Complete    | 2026-08-10 |
| 16. Dashboard Shell & Data Contract | v2.0 | 16/16 | Complete    | 2026-08-11 |
| 17. Activity Browser & Detail Views | v2.0 | 15/15 | Complete    | 2026-08-11 |
| 18. Records, Trends & Differentiators | v2.0 | 16/16 | Complete    | 2026-08-12 |
| 19. Design System & Control Styling | v2.1 | 17/17 | Complete   | 2026-08-13 |
| 20. Row-Click Interaction Pattern | v2.1 | 0/TBD | Not started | - |
| 21. Overview Rebuild | v2.1 | 0/TBD | Not started | - |
| 22. Calendar Week-Start & Totals | v2.1 | 0/TBD | Not started | - |
| 23. Trends Zoom, Pan & Taller Bands | v2.1 | 0/TBD | Not started | - |
| 24. Local Curation Mode | v2.1 | 0/TBD | Not started | - |
| 25. CI Hardening & Light-Theme Verification | v2.1 | 0/TBD | Not started | - |

---
*Last updated: 2026-08-12 — v2.1 Interface Polish roadmap created (phases 19-25, 25 requirements mapped). v1.0-v2.0 preserved above; v2.0 archived to `milestones/v2.0-ROADMAP.md`.*
