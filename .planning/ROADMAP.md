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
- [x] **Phase 20: Row-Click Interaction Pattern** - Every activity row, on every screen, is clickable, keyboard-accessible, and free of redundant "View Activity" buttons (8 plans executed 2026-08-13, including gap-closure round 20-06..20-08; NOT complete — re-run `20-VERIFICATION.md` scored 2/4 must-haves, `status: gaps_found`. **Round 1's two BLOCKERs are CLOSED and independently re-confirmed against source:** CR-01 fixed by 20-06 (`highlightAndFocus` at `list.ts:1097` now branches on `el.tagName === 'A'`, so card rows focus themselves) — also confirmed on real browser evidence via Round 2 row R13; CR-02 fixed by 20-07 (`statusBadgeTexts`/`composeRowAriaLabel`/`activityRowAriaLabel` in `list.ts` plus `recentPrRowAriaLabel` in `overview.ts` fold badge text back into the accessible name on all three surfaces). **Two new gaps block the phase:** (1) a NEW BLOCKER at `row-navigation.ts:58-67` — `attachRowNavigation` checks only `closest('a')`, ignoring mouse button, modifier keys and active text selection, so Cmd/Ctrl/Shift+click navigates in-tab, middle-click does nothing, and drag-select inside a row navigates away; newly load-bearing because `670e368` removed the "View Activity" anchor from Records PR tables, leaving five of six cells reliant on this path. (2) SC4 still not discharged — `20-VALIDATION.md` Round 2 is `status: partial`, `nyquist_compliant: false`, with only 4 of 17 rows individually evidenced (R5, R6, R13 fully; R10 missing its theme pair) and 13 rows recorded FAIL for insufficient evidence against a blanket approval; R15/R16/R17 were built to confirm CR-02 in a real screen reader and were never individually reported, so CR-02's silent-failure mode is unobserved against real assistive tech despite green automated coverage. Also two WARNING guard-layer defects, both mutation-proven: case-sensitive `tabindex` D-01 guards miss the camelCase `tabIndex` the code actually writes, and four Phase 20 CSS assertions use first-wins `declarationsFor` instead of last-wins `bodyForSelectorListToken`. **Round-3 gap closure executed 2026-08-17 (plans 20-09..20-11, waves 8-9) — still NOT complete:** re-run `20-VERIFICATION.md` scores 1/4 must-haves, `status: gaps_found`. **Closed this round:** the `row-navigation.ts` BLOCKER is genuinely fixed — 20-09 extracted `shouldNavigateOnRowClick` implementing all four refusal classes (in-anchor, non-primary button, any modifier, active text selection), confirmed by direct source read, 21 passing unit tests, and real-browser evidence (R21 drag-select PASS; the current-tab-not-hijacked half of R18/R19 PASS); and SC4's two-round blanket-approval problem is closed for the first time in this phase's history — `20-VALIDATION.md` Round 3 carries 18 individually-evidenced rows (13 PASS, 2 BLOCKED, 2 FAIL, 1 not exercisable), with most rows observed by agent browser automation against the staged build rather than by the developer's own eyes, an observer split recorded per-row. **Newly open:** (1) a NEW CRITICAL at `list.ts:1112-1131` — `applyReturnHighlight` is the sole clearer of `notedActivityId` but `mount()` reaches it from one of three render branches, so the one-shot return hint leaks and a later unrelated render steals keyboard focus and scrolls the page; a regression in the very mechanism plan 20-06 built for SC3, untouched by this round and unexercised by any of the 21 checkpoint rows. (2) R18/R19 FAIL against their stated expectation — modified clicks on the five anchor-less Records PR cells no longer hijack the tab but still open no new tab or window, because those cells carry no `<a>`; `list.ts`'s real-`<a href>` pattern is therefore not actually propagated. D-12 was accepted by the developer, but R18/R19's disposition was explicitly deferred to the next planning round. (3) WARNING guard-layer residue — 3 of 7 Phase 20 CSS assertions still read through any-rule-wins `selectorListDeclares`, the new cascade helper skips `@media`-scoped rules, the D-01 role guard is value-keyed not receiver-keyed (misses `role="presentation"`), and `RowClickContext` has no double-click field (WR-05), so the first click of a double-click still navigates away. REC-08 verified and ticked; UX-01, UX-02, UX-03 remain open. Gap-closure round 4 planned 2026-08-17 as plans 20-12..20-18 in waves 10-13, after the developer locked D-13 (real anchors on every content-carrying cell of both Records tables, superseding D-12's no-real-anchor clause), D-14 (refuse navigation on the first click of a double-click) and D-15 (close the three guard-layer WARNINGs this phase's own work introduced) in 20-CONTEXT.md. **Round-4 gap closure executed 2026-08-18 (plans 20-12..20-18, waves 10-13) — all 18 plans complete, phase gate still NOT closed:** 20-18's Round 4 checkpoint recorded `status: blocked`, `nyquist_compliant: false` — 8 of 12 rows PASS, 1 BLOCKED, 1 NOT EXERCISABLE, 2 FAIL. R18/R19's original expectation is closed (R23/R24 PASS: a genuine background tab now opens on a modified click for both Records tables) and the `notedActivityId` focus-leak regression is exercised and confirmed fixed (R22 PASS) — but plan 20-17's real cell anchors introduced a new shipped defect, GAP 12: dragging inside a Records cell starts a native link drag instead of a text selection (R31 FAIL, defeats D-12), and double-clicking a value still navigates away (R32 FAIL, defeats D-14), because both guards live in the row-level click listener rather than on the anchors the browser now handles natively. UX-02 is closed (badge-fixture gap resolved, clean sweep of its four mapped rows). UX-01 and UX-03 remain open, pending a Round 5 plan to reconcile D-13 with D-12/D-14, plus outstanding re-tests for R25 (Shift+click new-window observability) and R28 (D-12/D-13 disposition question). No fix designed or applied this round, per the house rule in force since checkpoint 16-09.) **Round-5 gap closure executed 2026-08-18 (plans 20-19..20-20, wave 15) — PHASE GATE CLOSED, clean sweep.** Plan 20-19 shipped D-16 (a per-anchor click guard mirroring `shouldNavigateOnRowClick`, plus `draggable = false`) and D-17 (per-cell accessible names, only the Date anchor keeps a curated label). Plan 20-20's Round 5 checkpoint recorded all ten rows (R34-R43) PASS against bundle `assets/index-F1PDLvBt.js`: GAP 12 is fully closed (R34 drag-select PASS; R35 double-click PASS on the developer's explicit accepted-behaviour disposition — a double-click still navigates on its first click because `MouseEvent.detail` is 1 at fire time and no non-degrading fix exists, and the developer said yes to accepting that as shipped; R36 modifier-click regression check PASS on both Records tables); GAP 11 is closed on R39's written disposition (D-12's auxclick clause still stands, but is no longer load-bearing); CR-01 is observed for the first time (R38, six distinct per-cell accessible names, Flags cell announces its own badge text). A new accepted scope boundary was found and explicitly approved by the developer: D-16's guard does not cover the Date-cell anchor (`records.ts:502-507`, built outside `buildCellLink`), and the developer chose to accept it as shipped rather than extend the contract. UX-01 and UX-03 both tick complete, joining the already-complete UX-02 and REC-08 — Phase 20's success criterion 4 is discharged and the phase gate is closed. (completed 2026-08-18)
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

**Plans**: 20 plans in 15 waves (5 shipped in waves 1-4; 3 gap-closure plans in waves 5-7 after the first verification round scored 2/4 must-haves; 3 more in waves 8-9 after re-verification confirmed CR-01/CR-02 fixed but found a new BLOCKER in `row-navigation.ts` and left SC4 undischarged on the checkpoint's own recorded evidence; 7 more in waves 10-13 after the third verification round scored 1/4, found a CRITICAL focus-stealing regression in list.ts, and the developer locked D-13, D-14 and D-15 in response; 2 more in waves 14-15 after the fourth verification round scored 1/4 again, with D-13's own cell anchors found to defeat D-12's drag-select guard and D-14's double-click refusal (GAP 12) and to announce one identical `aria-label` for every cell in a row (CR-01), for which the developer locked D-16 and D-17). The ROADMAP's own criterion-2 citation (`list.ts:224`) is wrong and is not planned from: that line *is* one of the three "View Activity" CTAs this phase removes. The reference pattern is `buildTableRow` at `list.ts:333-360`.

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — the shared row-navigation helper module plus its pure unit test (D-01, D-02, D-03), with the helper's non-testable surface stated explicitly

**Wave 2** *(blocked on Wave 1; the two plans have zero file overlap and run in parallel)*

- [x] 20-02-PLAN.md — `list.ts` and `overview.ts`: div rows become real anchors, the mobile-card CTA is deleted, `buildTableRow` moves onto the helper and its criterion-3-contradicting comment is repaired (D-01, D-04, D-07, D-08)
- [x] 20-03-PLAN.md — `records.ts`: both activity tables drop their CTA column (7→6 and 4→3), the Date cell carries the anchor, both gain the helper (D-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-04-PLAN.md — `styles.css` Phase 20 block (bare `a` link treatment, row-anchor hover, navigable-row scoping), `styles.test.ts` assertions, and a new `row-semantics.test.ts` source-structure guard (D-06, D-09, D-10, D-11)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 20-05-PLAN.md — full gate + BLOCKING human browser checkpoint under `/strava-widgets`, twelve-row agenda, keyboard-only and mouse, both themes

**Wave 5** *(gap closure — blocked on Wave 4; CR-01 from 20-VERIFICATION.md)*

- [x] 20-06-PLAN.md — CR-01: highlightAndFocus resolves the focus target for both row shapes, restoring D-08 return-from-detail focus on the mobile card layout, with a regression test proven RED first (UX-01)

**Wave 6** *(blocked on Wave 5 — same files; CR-02 from 20-VERIFICATION.md)*

- [x] 20-07-PLAN.md — CR-02: status-badge text folded into the whole-row link's accessible name on all three affected surfaces, one badge-text source feeding both spans and label, records.ts pinned unaffected (UX-03)

**Wave 7** *(blocked on Wave 6 — the checkpoint must run after the fixes land)*

- [x] 20-08-PLAN.md — full gate + BLOCKING Round 2 human checkpoint, seventeen rows, one named verdict each, both themes where the claim depends on them, plus return-focus and VoiceOver announcement rows the Round 1 agenda could not ask for

**Wave 8** *(gap closure round 3 — blocked on Wave 7; the two plans have zero file overlap and run in parallel)*

- [x] 20-09-PLAN.md — the BLOCKER: `attachRowNavigation` honours the browser's link contract (modifier keys, non-primary buttons, active text selection), the decision logic extracted into a pure node-testable predicate proven RED first, and D-12 recorded in 20-CONTEXT.md declaring middle-click/`auxclick` out of scope (UX-01, REC-08)
- [x] 20-10-PLAN.md — the two WARNING guard-layer defects: the case-blind D-01 `tabindex`/`role="link"` source guards become spelling-agnostic, and the four Phase 20 CSS assertions move off first-wins `declarationsFor` onto last-wins cascade resolution, each with an in-suite proof of the blind spot they close (UX-01, UX-03)

**Wave 9** *(blocked on Wave 8 — the checkpoint must run after the link-contract fix lands)*

- [x] 20-11-PLAN.md — full gate + BLOCKING Round 3 human checkpoint, eighteen rows asked one at a time with a per-row required detail, re-attempting the thirteen rows Round 2 recorded as insufficiently evidenced, closing R10's theme gap, quoting back what VoiceOver announces for R15/R16/R17, and observing the four newly-guarded gestures on the five anchor-less Records PR-table cells (UX-01, UX-02, UX-03, REC-08)


**Wave 10** *(gap closure round 4 — blocked on Wave 9; the four plans have zero file overlap and run in parallel)*

- [x] 20-12-PLAN.md — the CRITICAL regression: the one-shot return hint is consumed unconditionally at the top of `mount()`, ahead of the load, with a RED-first regression test for the empty-filter / load-error / stale-container leak sequence (UX-01, UX-03)
- [x] 20-13-PLAN.md — D-14: `RowClickContext` gains `clickCount` from `MouseEvent.detail` and a fifth refusal class, closing WR-05's double-click-navigates-away gap (UX-01, UX-03)
- [x] 20-14-PLAN.md — D-15 (WR-02, WR-03): the last three Phase 20 CSS assertions move onto the cascade winner and all seven gain an `assertNoAtRuleOverride` companion, each with an executed blind-spot proof (UX-03)
- [x] 20-15-PLAN.md — D-15 (WR-01): the D-01 `role` allowlist becomes receiver-keyed so `role="presentation"` on a `<tr>` is caught, plus the narrow, receiver-named pre-authorisation D-13 needs (UX-01, UX-03)

**Wave 11** *(gap closure round 4 — blocked on Wave 10; same file as 20-14)*

- [x] 20-16-PLAN.md — the `.pr-table__cell-link` treatment D-13's anchors need, so seven new anchors per Records row do not ship as underlined text links, guarded to 20-14's standard (UX-03)

**Wave 12** *(gap closure round 4 — blocked on Wave 11; the CSS class must exist before the markup uses it)*

- [x] 20-17-PLAN.md — D-13: every content-carrying cell of both Records tables gets a real `<a href>` via one factory, `tabIndex = -1` so the row keeps one keyboard stop, with the invariants pinned in source (UX-01, UX-03, REC-08)

**Wave 13** *(blocked on Wave 12 — the checkpoint must run after every fix lands)*

- [x] 20-18-PLAN.md — full gate + BLOCKING Round 4 human checkpoint, twelve rows each with its own required detail **and** its own named observer, re-asking R18/R19 against real anchors on both tables, exercising the focus-leak sequence for the first time, and unblocking R2/R16 with a disclosed staged-data fixture (UX-01, UX-02, UX-03, REC-08)

**Wave 14** *(gap closure round 5 — blocked on Wave 13; one plan, because D-16 and D-17 modify adjacent lines of the same eight-line factory in the same file)*

- [x] 20-19-PLAN.md — D-16 and D-17: the Records cell anchors are non-draggable and guard their own click through the unmodified shared predicate, and only the Date cell keeps an `aria-label` so every other cell announces its own text and the Flags cell announces its badge, both pinned by source guards with in-suite blind-spot proofs (UX-01, UX-03, REC-08)

**Wave 15** *(blocked on Wave 14 — the checkpoint must run after the fix lands)*

- [x] 20-20-PLAN.md — full gate + BLOCKING Round 5 human checkpoint, ten rows on the full agenda, re-testing R31/R32 against D-16 by a human hand, observing CR-01's per-cell announcement for the first time, answering R25 by the developer's own eyes and R28's disposition in writing, re-asking R29/R33 as lettered sub-questions, and serving from 127.0.0.1 against a bundle proven to be the one on disk (UX-01, UX-02, UX-03, REC-08)

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

**Plans**: 7 plans in 4 waves. Two of the five requirements resolve onto the **Records** screen, not Overview (D-01 puts the scope toggle on `records.ts`'s PR tables, the app's only records section; D-15 puts FIX-01's sub-label on both the Records and the Overview Current Streak tiles) — this is decided in `21-CONTEXT.md`, not scope creep. FIX-01 is planned as a two-layer fix in one plan (`streak-utils.ts:118` AND `records-logic.ts:274-282`, which maps `currentStreakStart` onto `endedISO`), because fixing only the layer the requirement names would ship a confidently wrong date. The `idPrefix` collision the shared renderer introduces is planned explicitly (21-02), not left for the executor to trip on. Criterion 6 is discharged by plan 21-07's thirteen-row checkpoint, served from `127.0.0.1` against a staged ended-streak fixture.

Plans:

**Wave 1** *(independent — no shared files)*

- [x] 21-01-PLAN.md — FIX-01 both layers: `currentStreakEnd` produced unconditionally by `calculateDailyStreaks`, threaded through `StreakData` and `compute-advanced-stats`, and read by `selectCurrentStreak` in place of the misread `currentStreakStart`, with the two-distinct-dates discriminator pinned in tests (FIX-01)
- [x] 21-02-PLAN.md — the shared row renderer: a four-member `RowSurface` scheme so two Overview cards can render the same activity without duplicating an element id, plus D-06's two-line `.activity-row__header` / `.activity-row__badges` DOM (OVR-01, OVR-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 21-03-PLAN.md — the D-06 layout in a Phase 21 banner block with a stated class contract, and cascade-aware assertions pinning every D-08-frozen bordered-card value it must not disturb (OVR-01, OVR-02)
- [x] 21-04-PLAN.md — Overview retires `renderRecentPrRow` / `recentPrBadgeText` / `recentPrRowAriaLabel` outright and both cards delegate to the shared renderer with distinct surfaces, with three invalidated source guards re-pointed at least as strongly (OVR-01, OVR-02)
- [x] 21-05-PLAN.md — the `.segmented` All time / This year control above the PR tables, a pure clock-free year filter that re-ranks 1..N, and a per-distance empty state replacing the hardcoded marathon copy year-scoping would have made far more visible (OVR-03)

**Wave 3** *(blocked on Waves 1 and 2 — both edit `overview.ts`)*

- [ ] 21-06-PLAN.md — Distance This Year and Hours This Year appended to the `.stat-grid` from the already-published `yearly-stats.json`, and Overview's Current Streak tile gains the `ended {date}` sub-label, with every rendered value and all three degradation paths asserted as exact strings (OVR-04, FIX-01)

**Wave 4** *(blocked on everything — the checkpoint runs after every fix lands)*

- [ ] 21-07-PLAN.md — full gate + BLOCKING thirteen-row human checkpoint on a `127.0.0.1`-served `/strava-widgets` build, with a disclosed staged-only ended-streak fixture whose `currentStreakStart` is deliberately left intact so the two `ended {date}` rows must read the date's value back rather than its presence (OVR-01, OVR-02, OVR-03, OVR-04, FIX-01)

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
| 19. Design System & Control Styling | v2.1 | 17/17 | Complete    | 2026-08-13 |
| 20. Row-Click Interaction Pattern | v2.1 | 20/20 | Complete    | 2026-08-18 |
| 21. Overview Rebuild | v2.1 | 5/7 | In Progress|  |
| 22. Calendar Week-Start & Totals | v2.1 | 0/TBD | Not started | - |
| 23. Trends Zoom, Pan & Taller Bands | v2.1 | 0/TBD | Not started | - |
| 24. Local Curation Mode | v2.1 | 0/TBD | Not started | - |
| 25. CI Hardening & Light-Theme Verification | v2.1 | 0/TBD | Not started | - |

---
*Last updated: 2026-08-12 — v2.1 Interface Polish roadmap created (phases 19-25, 25 requirements mapped). v1.0-v2.0 preserved above; v2.0 archived to `milestones/v2.0-ROADMAP.md`.*
