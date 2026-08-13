# Requirements: Strava Analytics & Visualization Platform — v2.1 Interface Polish

**Defined:** 2026-08-12
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v2.1 Requirements

Refinement of shipped v2.0 capability, not new capability. The dashboard already does what the developer wants and some screens are genuinely good — this milestone brings the rest up to that standard. Requirements derive from a screen-by-screen walkthrough by the developer (2026-08-12) plus a source audit that identified root causes.

Each maps to roadmap phases.

### Design System

- [x] **UI-01**: Form controls (text, date, number, search inputs) are styled consistently across every screen — the stylesheet currently has **zero `input` rules**, so all inputs render as unstyled browser defaults. This is the single root cause of the "raw" feel on Activities and Calendar. **Re-verified 2026-08-13**: plan 19-09's browser checkpoint re-confirmed rows 1-2 clean after GAP 1 (dead `--radius-control` token) was closed by plan 19-06; the developer's blanket verdict "Everything looks good. Approved." covers row 1 alongside rows 3, 6 and 12. See `19-VALIDATION.md` Gap-Closure Record.
- [ ] **UI-02**: Buttons, selects and other controls share one visual treatment, with a consistent `:focus-visible` ring meeting non-text contrast requirements in both themes — **re-verified 2026-08-13**: plan 19-09's browser checkpoint re-confirmed rows 3, 6 and 12 clean after GAP 1 (dead `--radius-control` token, plan 19-06) and GAP 2 (focus-ring paint-order occlusion, plan 19-07) were both closed; the developer's blanket verdict "Everything looks good. Approved." covers all four re-verified rows together. See `19-VALIDATION.md` Gap-Closure Record. **REOPENED 2026-08-13**: `19-REVIEW.md` (post-checkpoint) found three critical defects the browser checkpoint never exercised — CR-01 (`:focus-visible` `z-index: 1` paints over the `z-index`-less sticky `.app-nav`), CR-02 (the `button` baseline's radius rounds middle `.segmented__option`s in the three 3+-option Trends groups), CR-03 (`opacity: 0.6` on focusable `[aria-disabled="true"]` composites the ring to ~2.19:1 light / ~2.93:1 dark, under the 3:1 floor this requirement names). See `19-VERIFICATION.md`.
- [x] **UI-03**: Spacing, density and card treatment follow one rhythm across all five screens, applied without changing the existing visual language

### Interaction Consistency

- [ ] **UX-01**: Any row representing an activity is clickable through to that activity, on every screen. `overview.ts` currently has zero click handlers; `list.ts` already has the pattern to propagate.
- [ ] **UX-02**: Redundant "view activity" call-to-action controls are removed where the row itself is the affordance (`list.ts:224`, Records)
- [ ] **UX-03**: Row-level navigation is keyboard-accessible and announced correctly, not a click handler on a bare `<div>`

### Overview

- [ ] **OVR-01**: Recent PRs rows show name, date, distance and PR badge in a deliberate visual hierarchy rather than three stacked divs, and link to the activity
- [ ] **OVR-02**: Recent Activities rows follow the same structure and linking
- [ ] **OVR-03**: User can switch the records section between at least all-time and current-year views (e.g. a "This year's records" tab)
- [ ] **OVR-04**: Headline Stats includes distance this year and hours this year alongside the existing all-time figures

### Calendar

- [ ] **CAL-01**: User can choose whether weeks start on Sunday or Monday; the choice persists. `calendar-logic.ts` is currently hard-coded Sunday-first, so this changes pure grid logic, not just display.
- [ ] **CAL-02**: Week totals are computed and shown at the end of each week row, and respect the selected week start
- [ ] **CAL-03**: Calendar controls use the shared control styling from UI-01/UI-02

### Trends

- [ ] **TRN-01**: User can zoom in and out of trend charts via `chartjs-plugin-zoom`, so a weekly view no longer shows the entire 15-year archive at once
- [ ] **TRN-02**: User can scroll/pan charts horizontally, with explicit +/− and left/right controls in addition to gestures (controls must work without a pointer)
- [ ] **TRN-03**: Chart bands are taller than the current fixed 140px so the y-axis has usable range on a page with room to spare
- [ ] **TRN-04**: Zoom/pan composes correctly with the existing granularity toggle and the five-tab structure, and does not regress the canvas lifecycle (no "Canvas is already in use" on tab cycling)

### Records & Activities

- [ ] **REC-08**: Records rows navigate on row click rather than via a large button
- [x] **ACT-01**: Activities screen controls adopt the shared styling; the screen's existing interaction model (row click) is preserved as the reference pattern

### Carried Forward from v2.0

- [ ] **CUR-01**: User can toggle an activity's exclusion from PR calculations from the interface rather than hand-editing `data/best-effort-exclusions.json`, via a local curation mode (`npm run curate`) with a localhost-only write path. Per-distance exclusion must be selectable, not just whole-run — a GPS spike typically corrupts only the short splits while the same run's 5k/10k remain honest. A reason is required and is surfaced in the detail view. The write path must be provably absent from the published bundle, verified by an assertion in `verify-dashboard-publish.mjs` following the `assertNoPrivateArtifacts` precedent.
- [ ] **FIX-01**: The "Current Streak" tile's `ended {date}` sub-label renders when a streak has ended. Currently structurally unreachable — it reads `currentStreakStart`, which is only populated while a streak is active (root cause `src/analytics/streak-utils.ts:118`; code review WR-01).
- [ ] **FIX-02**: `gear-aggregate-logic.ts` degrades rather than crashing when an index row lacks a `gearName` key — the Unknown-bucket test is a strict `label === null`, so an absent key reaches `slugify(undefined)` (code review WR-02)
- [ ] **VER-01**: Phase 16's three unverified theme items are confirmed in a real browser: legibility on a light-OS machine, absence of a first-paint white flash, and live following of an OS appearance change. These were never discharged by the Phase 17/18 checkpoints, which evidence suggests both ran from a dark-OS machine.
- [ ] **CI-01**: The nightly workflow and `compute-all-stats` no longer maintain two independent orderings of the compute chain with no shared source of truth
- [ ] **CI-02**: `verify-dashboard-publish.mjs` asserts reachability for every published stats document it currently relies on a whole-directory copy to carry (`weekly-distance`, `monthly-stats`, `yearly-stats`, `year-over-year`, `best-efforts.json` and the per-activity shards)

## Out of Scope

- Design-language refresh (type scale, colour system, density overhaul) — deliberately deferred; revisit after living with the systematic polish
- Any change to the analytics or computation layer beyond FIX-01/FIX-02 and CUR-01's write path
- Garmin export adapter (STREAM-04) — still blocked on the export arriving
- New chart types or new metrics — this milestone makes existing ones better

## Verification Note

Every requirement in this milestone is visual or interactive, and this project has now shipped rendering defects behind a green automated gate three times (Phase 16's black page, Phase 17's two rendering gaps, and Phase 18's near-miss). Automated tests cannot discharge UI-01 through TRN-04. Each phase must end with a human browser checkpoint against a production-shaped URL, and VER-01 in particular requires a genuinely light-OS environment rather than an in-page theme toggle.

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 19 | Complete |
| UI-02 | Phase 19 | Gaps Found |
| UI-03 | Phase 19 | Complete |
| ACT-01 | Phase 19 | Complete |
| UX-01 | Phase 20 | Pending |
| UX-02 | Phase 20 | Pending |
| UX-03 | Phase 20 | Pending |
| REC-08 | Phase 20 | Pending |
| OVR-01 | Phase 21 | Pending |
| OVR-02 | Phase 21 | Pending |
| OVR-03 | Phase 21 | Pending |
| OVR-04 | Phase 21 | Pending |
| FIX-01 | Phase 21 | Pending |
| CAL-01 | Phase 22 | Pending |
| CAL-02 | Phase 22 | Pending |
| CAL-03 | Phase 22 | Pending |
| TRN-01 | Phase 23 | Pending |
| TRN-02 | Phase 23 | Pending |
| TRN-03 | Phase 23 | Pending |
| TRN-04 | Phase 23 | Pending |
| CUR-01 | Phase 24 | Pending |
| FIX-02 | Phase 25 | Pending |
| VER-01 | Phase 25 | Pending |
| CI-01 | Phase 25 | Pending |
| CI-02 | Phase 25 | Pending |

**Coverage:**
- v2.1 requirements: 25 total (corrected from the 24 recorded when this section was drafted — a recount of the requirement list above found 25 distinct IDs: 3 Design System + 3 Interaction Consistency + 4 Overview + 3 Calendar + 4 Trends + 2 Records & Activities + 6 Carried Forward)
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-08-12*
