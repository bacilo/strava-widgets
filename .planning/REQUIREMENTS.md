# Requirements: Strava Analytics & Visualization Platform — v2.1 Interface Polish

**Defined:** 2026-08-12
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v2.1 Requirements

Refinement of shipped v2.0 capability, not new capability. The dashboard already does what the developer wants and some screens are genuinely good — this milestone brings the rest up to that standard. Requirements derive from a screen-by-screen walkthrough by the developer (2026-08-12) plus a source audit that identified root causes.

Each maps to roadmap phases.

### Design System

- [x] **UI-01**: Form controls (text, date, number, search inputs) are styled consistently across every screen — the stylesheet currently has **zero `input` rules**, so all inputs render as unstyled browser defaults. This is the single root cause of the "raw" feel on Activities and Calendar. **Re-verified 2026-08-13**: plan 19-09's browser checkpoint re-confirmed rows 1-2 clean after GAP 1 (dead `--radius-control` token) was closed by plan 19-06; the developer's blanket verdict "Everything looks good. Approved." covers row 1 alongside rows 3, 6 and 12. See `19-VALIDATION.md` Gap-Closure Record. **Round 3 confirmed-unregressed 2026-08-13**: row 19 sub-check (b) — input, select and textarea baselines across Activities and Calendar still render bordered, padded, 4px-cornered boxes with no unstyled browser default, per the developer's "all look good and unchanged" — confirms UI-01 was not broken by the CR-01/CR-02/CR-03 fixes in plans 19-10/19-11. See `19-VALIDATION.md` row 19. **Round 4 confirmed-unregressed 2026-08-13**: row 24 sub-check (b) — inputs across Activities and Calendar remain bordered, padded, 4px-cornered and none reads as a raw browser default, per the developer's verbatim "b. pas[s]" against this specific sub-check (not a blanket approval) — confirms UI-01 was not broken by this round's sticky-rung move or guard-layer rewrite. See `19-VALIDATION.md` row 24.
- [x] **UI-02**: Buttons, selects and other controls share one visual treatment, with a consistent `:focus-visible` ring meeting non-text contrast requirements in both themes — **re-verified 2026-08-13**: plan 19-09's browser checkpoint re-confirmed rows 3, 6 and 12 clean after GAP 1 (dead `--radius-control` token, plan 19-06) and GAP 2 (focus-ring paint-order occlusion, plan 19-07) were both closed; the developer's blanket verdict "Everything looks good. Approved." covers all four re-verified rows together. See `19-VALIDATION.md` Gap-Closure Record. **REOPENED 2026-08-13**: `19-REVIEW.md` (post-checkpoint) found three critical defects the browser checkpoint never exercised — CR-01 (`:focus-visible` `z-index: 1` paints over the `z-index`-less sticky `.app-nav`), CR-02 (the `button` baseline's radius rounds middle `.segmented__option`s in the three 3+-option Trends groups), CR-03 (`opacity: 0.6` on focusable `[aria-disabled="true"]` composites the ring to ~2.19:1 light / ~2.93:1 dark, under the 3:1 floor this requirement names). See `19-VERIFICATION.md`. **Round 3 2026-08-13 — still open**: CR-02 and CR-03 are confirmed closed on rendered evidence (rows 14, 15, 16 and 17 each independently PASS). CR-01's `z-index: 20` declaration is confirmed present in the shipped bundle (Probe B), but row 18 FAILED: the sticky nav does not remain on screen while scrolling on Activities (Probe D, `navH` 77 = `parentH` 77), a newly-found defect (`19-VALIDATION.md` GAP 7) that blocks this requirement independently of the z-index fix. **19-15 2026-08-13 — still open**: closed the guard-layer/test false-green findings from `19-REVIEW-round3.md` (R3-CR-01, R3-CR-02, R3-WR-02, R3-IN-01..04) so the test suite's own claims about the fix are now mutation-verified rather than merely present. This is test-file-only work — `git diff d9b3aaf HEAD -- src/dashboard/styles.css` is empty — and does not itself constitute the rendered re-verification this requirement needs. UI-02 stays open pending plan 19-16 (stylesheet comment fixes for R3-WR-03/WR-04) and plan 19-17's Probe G checkpoint (`autonomous: false`, the plan that actually owns this file's update) across both themes. **Round 4 2026-08-13 — CLOSED, clean sweep.** Plan 19-13 diagnosed GAP 7's root cause empirically (H1 — zero-travel containing block: `#app-nav-root`'s `clientHeight` equalled `.app-nav`'s `offsetHeight`, both 77, leaving the sticky rung zero travel distance), four competing hypotheses excluded by cited probe fields; plan 19-14 applied the fix (moved the sticky rung to `#app-nav-root`). This plan's checkpoint re-verified both GAP 7 and GAP 6 on rendered evidence: row 20 (nav holds on both routes, both themes; Probe G matched expectation on both routes) closes GAP 7, and row 21 (a focused control scrolled under the nav stays underneath it, both routes, both themes; Probe H confirmed the `z-index: 20` declaration live) closes GAP 6 — the first-ever observation of the original CR-01 paint-order question. Rows 22 and 23 also PASS (both themes). Combined with rows 3-6, 10-13 (clean since 19-05/19-09) and rows 14-17 (clean since Round 3), every row this requirement's own row→requirement map names is now PASS — a clean sweep of `19-VALIDATION.md` rows 20-24 is the only condition that ticks this box, and it is met. **Not blocked by GAP 8** (new, found unprompted this round: Leaflet map tiles paint over the nav on the detail-view map, plus a totality defect in plan 19-16's own ladder comment, which does not list Leaflet's panes as a fifth stacking rung) — reasoned explicitly rather than assumed: this requirement's own text concerns "buttons, selects and other controls" sharing one visual treatment with a conforming `:focus-visible` ring; GAP 8 concerns a third-party map library's own stacking values overlaying the nav on one specific view, an unrelated component this requirement's wording does not reach, and no row on this or any prior round's checkpoint agenda ever named the map against the nav. GAP 8 is tracked separately, unpatched, with its disposition (a small follow-up plan or a deferred item) left to the user after this phase closes. See `19-VALIDATION.md` GAP 6/GAP 7 resolutions and GAP 8.
- [x] **UI-03**: Spacing, density and card treatment follow one rhythm across all five screens, applied without changing the existing visual language. **Round 3 confirmed-unregressed 2026-08-13**: row 19 sub-check (c) — the card and panel rhythm on Overview and Records still reads as one rhythm, per the developer's "all look good and unchanged". See `19-VALIDATION.md` row 19. **Round 4 confirmed-unregressed 2026-08-13**: row 24 sub-check (c) — the card and panel rhythm on Overview and Records reads as it did, unchanged, per the developer's verbatim "c. pass" against this specific sub-check. See `19-VALIDATION.md` row 24.

### Interaction Consistency

- [ ] **UX-01**: Any row representing an activity is clickable through to that activity, on every screen. `overview.ts` currently has zero click handlers; `list.ts` already has the pattern to propagate. **Round 2 gap-closure 2026-08-13 — still open**: plan 20-08's Round 2 checkpoint (`20-VALIDATION.md`) recorded genuine, individually-described evidence for two of this requirement's eight mapped rows — R5 PASS (Records six-column header read back verbatim) and R13 PASS (CR-01's focus-restoration fix, plan 20-06, confirmed on rendered evidence via keyboard-back, with a false-alarm history from a mouse-Back procedure trap recorded alongside it). The other six mapped rows (R1, R2, R3, R11, R12, R14) carry no individual observation this round — only a blanket "all pass" / "1. Yes 3. yes 6. confirm" / "all good" — so per the plan's gating rule (every mapped row must pass) this requirement stays open pending those six rows' individual re-verification.
- [ ] **UX-02**: Redundant "view activity" call-to-action controls are removed where the row itself is the affordance (`list.ts:224`, Records). **Round 2 gap-closure 2026-08-13 — still open**: plan 20-08's Round 2 checkpoint recorded genuine, individually-described evidence for two of this requirement's four mapped rows — R5 PASS and R6 PASS (the Records six-column and three-column table headers each read back verbatim). R2 and R4 carry no individual observation this round (blanket approval only), so per the plan's gating rule this requirement stays open pending those two rows.
- [ ] **UX-03**: Row-level navigation is keyboard-accessible and announced correctly, not a click handler on a bare `<div>`. **Round 2 gap-closure 2026-08-13 — still open**: plan 20-08's Round 2 checkpoint recorded genuine evidence for one of this requirement's eleven mapped rows — R10 PASS on substance (the developer's word for the full-width focus ring was "fine", no clipping/overlap/nav-occlusion reported), though no theme was named, leaving an open coverage gap even on this row. The remaining ten mapped rows (R1, R2, R3, R4, R7, R8, R9, R15, R16, R17) carry no individual observation this round. R15/R16/R17 specifically exist to observe CR-02 (plan 20-07, status-badge text in the accessible name) in a real screen reader; CR-02's failure mode was the badge text being *silently dropped*, so an undescribed "yes" is indistinguishable from the defect still being present. CR-02 therefore remains unobserved in a real screen reader, and this requirement stays open.

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

- [x] **REC-08**: Records rows navigate on row click rather than via a large button. **Closed 2026-08-13 (plan 20-08, Round 2)**: plan 20-08's Round 2 checkpoint recorded genuine, individually-described evidence for both of this requirement's mapped rows — R5 PASS (the developer read back the PR table header verbatim: "Rank  Time  Pace  Age-Grade  Date  Flags", six columns, matching exactly) and R6 PASS (the PR-progression header read back verbatim: "Date  Time  Improvement", three columns, matching exactly). Neither row is theme-sensitive. See `20-VALIDATION.md` Round 2.
- [x] **ACT-01**: Activities screen controls adopt the shared styling; the screen's existing interaction model (row click) is preserved as the reference pattern. **Round 3 confirmed-unregressed 2026-08-13**: row 19 sub-check (d) — an Activities row click still navigates to the detail view, per the developer's "all look good and unchanged". See `19-VALIDATION.md` row 19. **Round 4 confirmed-unregressed 2026-08-13**: row 24 sub-check (d) — an Activities row click still navigates to the detail view, per the developer's verbatim "d. pass" against this specific sub-check. See `19-VALIDATION.md` row 24.

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
| UI-02 | Phase 19 | Complete (Round 4, 2026-08-13 — clean sweep of rows 20-24) |
| UI-03 | Phase 19 | Complete |
| ACT-01 | Phase 19 | Complete |
| UX-01 | Phase 20 | Pending |
| UX-02 | Phase 20 | Pending |
| UX-03 | Phase 20 | Pending |
| REC-08 | Phase 20 | Complete (Round 2, 2026-08-13 — R5/R6 individually evidenced) |
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
