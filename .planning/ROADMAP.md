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
- [x] **Phase 21: Overview Rebuild** - Overview's PR/activity rows, records scope toggle, headline stats, and the Current Streak "ended" label all reach the standard the rest of the dashboard sets (8/8 plans executed 2026-08-18, including gap-closure plan 21-08. Round 1's checkpoint (21-07) left R7 BLOCKED — the live archive holds zero 2026-dated best-effort ranking entries in any distance, so every PR table rendered an empty state under "This year" and OVR-03's re-rank could not be read back; `21-VERIFICATION.md` scored 5/6, success criterion 3 not human-observed. Round 2 (21-08) closed it on rendered evidence: a disclosed staged-only fixture redated two 400m entries into 2026 with their source ranks `4` and `9` deliberately intact, making the row answerable by a value rather than a presence. R14 PASS (hard reload via Command+Option+R, fixture dates read back) and R15 PASS (`#1` / `Mar 14, 2026` and `#2` / `1:02` / `Jun 2, 2026` — the discriminator held, so the scope really re-ranks 1..N over the filtered subset). `21-VALIDATION.md` is `status: passed` / `nyquist_compliant: true`; the fixture was torn down and the staged build restored to archive values. OVR-01..OVR-04 and FIX-01 all Complete in REQUIREMENTS.md. Re-verification 2026-08-18 scored **6/6, `status: passed`**, superseding the earlier 5/6 `gaps_found` result — `gaps_remaining: []`, no regressions; phase gate closed) (completed 2026-08-18)
- [x] **Phase 22: Calendar Week-Start & Totals** - User controls whether the week starts Sunday or Monday, with correct persisted totals either way (5/5 plans executed 2026-08-18; NOT complete — `22-VERIFICATION.md` scores 4/6 must-haves, `status: gaps_found`. **What is genuinely done and independently confirmed against source:** `buildMonthGrid(rows, month, weekStart)` is generalized off its Sunday-first assumption with a required `weekStart` parameter and unit coverage for both values; `MonthGrid.weekTotals` derives from in-month cells only; `calendar-preferences.ts` persists the choice under `dashboard-calendar-week-start` with an allow-list parse; the `.segmented` Sunday/Monday control inherits Phase 19 styling. Round 1's checkpoint (22-05) recorded 10 PASS / 1 FAIL across eleven rows, and its D-16 discriminator held decisively — toggling Sunday→Monday on October 2025 turned rows 3 and 4 from `56.0 km / 5h 27m / ×4` and `104.1 km / 10h 14m / ×7` into `80.0 km / 7h 58m / ×5` and `80.0 km / 7h 42m / ×6`, proving the grid truly re-groups rather than repaints. CAL-01 and CAL-03 tick Complete. **Two gaps block the phase:** (1) R11 FAIL — day-cell values slightly overflow at ~380px viewport; the developer was offered a documented-PASS framing and explicitly chose FAIL, and the documented fallback (a `.splits-scroll`-style horizontal-scroll wrapper, DISC-6b) was deliberately not implemented, so CAL-02 stays unticked / Pending. (2) a confirmed CRITICAL at `calendar.ts:424` (CR-01) — `globalThis.localStorage` is read outside any try/catch, and the property getter itself throws `SecurityError` when site data is blocked, collapsing the entire Calendar view into the generic error panel rather than degrading the preference; `calendar-preferences.ts`'s own header comment claims T-22-WK-02 covers "disabled cookies", which is false as shipped, and no checkpoint row exercised the path (R8 tampers the stored *value*, not the storage handle's *accessibility*). Non-blocking residue: `buildMonthGrid` throws `RangeError` for an off-union `weekStart` against its own "never throws" JSDoc (unreachable via the app path), and the Phase 22 `styles.test.ts` block is false-green for its own 380px `.calendar-week-total__distance` override because it skipped the `assertNoAtRuleOverride` pairings the file documents as mandatory — WR-03 further shows that guard returns clean even when an override exists, since `RULE_SCANNER()` swallows the first nested rule of an at-rule into the prelude. Evidence caveat recorded per-row in `22-VALIDATION.md`: rows R6, R7, R8 and R10 were observed by agent browser automation rather than the developer's own eyes, at the developer's explicit request; R1-R5, R9 and R11 remain developer-observed, and `22-VALIDATION.md` is `status: partial` / `nyquist_compliant: false`.) **Round 3 executed 2026-08-19 (plans 22-09..22-12) — still NOT complete.** `22-VERIFICATION.md` re-verifies at 5/8, `status: gaps_found`. Round 3 genuinely closed the app-level blocked-site-data crash (BL-03): `main.ts:19` now reads `applyThemeMode(readStoredMode(resolveStorage()))`, six call sites are wired to the shared `storage.ts` resolver, and R22 (Safari, "Block all cookies", full reload) observed the app boot with nav, grid, five week-total cells and Monday default — the first real-browser exercise of that path in the phase, superseding Round 2's declined R16. **Two gaps block it:** (1) the day-cell/Total overflow is fixed ONLY inside `@media (max-width: 380px)`; `.calendar-day { min-width: 32px }`, `.calendar-grid { repeat(7, 1fr) auto }` and `.calendar-week-total { white-space: nowrap }` all apply unconditionally above it, with no @media rule touching them between 381px and 1000px, so the same defect class R11/R13 failed on remains structurally exposed at 390/393/412px — widths no row in any of the three rounds ever tested (R19 observed exactly 375px). (2) CR-01, a NEWLY REACHABLE Critical caused by this phase's own BL-03 fix: `nav.ts:210-215`'s `handleThemeToggleClick` holds no in-memory mode and re-reads storage every click, so under a null handle `readStoredMode(null)` → `'auto'` → `cycleThemeMode('auto')` → `'light'` every time and dark is unreachable; pre-fix the page crashed blank before the toggle could be clicked, post-fix it renders and the toggle is broken. R22 never clicked the toggle under blocked storage. Also confirmed: `theme.ts:108/145` do `resolveStorage(options.storage ?? undefined)`, so an explicit `null` falls through to the real global and the three new BL-03 tests in `theme.test.ts` pass only vacuously under `environment: 'node'`. **Round 4 executed 2026-08-19 (plan 22-16) — still NOT complete.** Plans 22-13/22-14 (in-memory theme-mode controller, honoured `storage: null`) and 22-15 (breakpoint widened 380px→640px) shipped clean, and Round 4's checkpoint recorded 3 PASS / 2 BLOCKED across R24-R28. R25 PASS genuinely closed the 381-530px overflow sub-band for the first time in the phase, at a developer-stated 393px with both `matchMedia` confirmations and the full rendered table quoted — real progress on Gap 1. But R26 (the ~600px sub-band where the widened compaction's single-column stack renders for the first time) was recorded BLOCKED: the evidence supplied was at R25's own 393px, not R26's own required ~600px width, so Gap 1 stays STILL OPEN. R27 (Gap 2, the theme toggle under blocked storage) was also recorded BLOCKED: only a summary "Theme dark is reached" claim was given, without the three individual `aria-label` values in click order, the browser/setting used, or a per-click colour-change statement disposition (a) requires — Gap 2 stays STILL OPEN. Both BLOCKED verdicts were held against three successive rounds of pressure to record PASS on incomplete evidence, per the plan's own non-waivable house rule 14 (see `22-16-SUMMARY.md` Deviations). WR-01 (vacuous null-override tests) is CLOSED on automated evidence alone. CAL-01's Round 3 tick is REVERTED to Pending (R27 BLOCKED); CAL-02 stays Pending (R26 BLOCKED); CAL-03 untouched. `22-VALIDATION.md` is `status: partial` / `nyquist_compliant: false`. Next: a further gap-closure round targeting specifically R26's own ~600px band and R27's full three-click evidence.) (completed 2026-08-19) (completed 2026-08-19)
- [x] **Phase 23: Trends Zoom, Pan & Taller Bands** - User can zoom and pan trend charts with mouse, touch, or on-screen controls, on taller bands, without breaking tab-cycling or the canvas lifecycle (13/13 plans executed 2026-08-27; PHASE GATE CLOSED. **Round 2 gap-closure checkpoint closed 2026-08-26/27 (plan 23-11)** against a fresh build (`assets/index-D01ardNQ.js`, differing from Round 1's `assets/index-D2l-GZfl.js`): **21 PASS / 1 FAIL (R35) / 0 BLOCKED** across R21-R42. Plan 23-08's settle-nesting fix and ÷1.5/×1.5 step-magnitude fix, and plan 23-09's year-heatmap scroll wrapper, together closed all three of Round 1's other FAILs (R8, R11, R16) — **TRN-01, TRN-02 and TRN-04 all ticked complete.** **TRN-03 stayed Pending**, blocked by R35: 23-09's wrapper narrowed the phone-width horizontal overflow from Round 1's pinned `documentElement.scrollWidth` 682 down to 460, but 460 still exceeded `clientWidth` (390/393/412/430) at every required phone width — the row's own non-waivable no-horizontal-overflow clause needed equality, not improvement. **Finding 11 (root cause, blocked TRN-03 via R35):** the overflow traced to a *different* element than Round 1's Finding 9 — the five-tab Trends navigation strip (`div.segmented`, Volume/YoY/Cadence & HR/Training Load/Gear), measured 412px wide with `overflow-x: visible` on itself and its parent, never given a scroll wrapper (unlike the 3-button granularity `.segmented`, which was fine). Only manifested below ~460px viewport width. Plan 23-12 closed Finding 11 with `.trends-tablist-scroll` (the fourth `.splits-scroll`/`.year-heatmap-scroll` pattern instance), containing the strip outside the `role=tablist` element. **Round 3 gap-closure checkpoint closed 2026-08-27 (plan 23-13)** against a fresh build (`assets/index-BQy-1dz6.js` / `assets/index-B573RjUr.css`, both differing from Round 2's): **12 PASS / 0 FAIL / 0 BLOCKED / 0 NOT EXERCISABLE — a clean sweep across R43-R54.** R46(b) measured `documentElement.scrollWidth` EQUAL to `clientWidth` at all four phone widths for the first time. **TRN-03 ticked complete; TRN-01, TRN-02 and TRN-04 were each confirmed unregressed by their own Round 3 rows** (R47/R48, R49/R50, R51/R52/R53) rather than assumed, since 23-12 changed the DOM immediately above the tab strip. No new finding was raised. **Finding 12 (gates nothing):** the Training Load tooltip title still renders a raw epoch-millisecond value instead of a formatted date; DEFERRED per its dated disposition in `deferred-items.md` (plan 23-12) — out of scope for this phase's requirements, left for whoever next touches `trends-charts.ts`. `23-VALIDATION.md` is `status: complete` / `nyquist_compliant: true`. All four requirements (TRN-01..04) tick Complete in `REQUIREMENTS.md`.) (completed 2026-08-27)
- [x] **Phase 24: Local Curation Mode** - Developer can toggle whole-activity PR exclusion from a localhost-only UI, with the write path provably absent from the published bundle (10/10 plans executed 2026-09-01; **PHASE GATE CLOSED — see Round 2 note at the end of this entry.** Plan 24-08's Round 1 browser checkpoint recorded **13 PASS / 1 FAIL / 0 BLOCKED** across R1-R14. Criterion 1 is discharged (R2/R3/R4), criterion 3 by R13 — a hand-planted `dist/widgets/__curate/overlay.js` drove `npm run build-widgets` to exit 1 with `✗ Curation-artifact guard failed` naming both the directory and the file, then exit 0 with the `✓ Curation-artifact scan:` line once removed, so D-11 is discharged on an observed-red guard — and criterion 4 by R12 (production bundle served without curate: no curation control renders, `outerHTML.includes('__curate') === false`, all three `/__curate/*` paths 404, and an in-console `PUT` returns 404 leaving the working tree unchanged) plus R14 (403 on mismatched `Origin` and on mismatched `Host`). The two extent rows both PASS against values pinned from `data/stats/*.json` BEFORE any write: **R8** — Records 400 m rank 1 became `0:47` / `Apr 2, 2019` / `#/activity/3475727228`, a DIFFERENT activity from the excluded `4556693525`, exactly the pinned rank-2 target; **R9** — weekly (week of 2020-12-28) reconstructed from rendered Calendar cells as `46.6 + 42.3 = 88.9 km` / `4 + 3 = 7 runs` against pinned 88.864/7, and monthly Jan 2021 read from the rendered tooltip as `362.2 km, 29 runs` against pinned 362.2411/29 — exclusion changed PR rankings and nothing else. R10 (developer-performed; confirm dialog read "Removing this exclusion deletes it and changes PR history. Continue?") and R11 both PASS, and the archive was left byte-identical. **The blocking gap is GAP-24-01 (R5 FAIL):** the `Excluded — {reason}` badge does not render when Save is pressed. The staged-build cache trap was excluded before recording — the reload was confirmed, the app refetched the file, and a cache-busted fetch returned byte-identical JSON already containing the entry. `detail-sections.ts:348` gates the badge on `row.excluded`, which `detail-best-efforts-logic.ts:95` reads from `excludedFromRecords` in the precomputed `data/stats/best-efforts.json` rather than from the live exclusions file; only the reason is loaded live. The badge rendered correctly after R8's Recompute, and R11 showed the mirror-image staleness (reason-less `Excluded from records` once the entry was deleted but the stats not yet recomputed). So ROADMAP criterion 2's reason IS reachable in-session with no rebuild, but via Save **then Recompute**, not Save alone — which is the sequencing R5 asserts. **CUR-01 stayed Pending after Round 1** and the origin todo `2026-08-12-exclusion-tickbox-local-curation-mode.md` stayed in `pending/`, per plan 24-08's own gate. **Evidence provenance:** the round was agent-driven via Claude-in-Chrome against real Chrome at the developer's explicit delegation — real clicks, trusted keyboard verified `isTrusted: true` per focus stop, real hover — with R10 performed by the developer because its native `window.confirm()` blocks the automation extension; R13/R14's exit codes are the agent's, not the developer's. Disclosed per row class in `24-VALIDATION.md` rather than recorded as a human round. `24-VALIDATION.md` is `status: partial` / `nyquist_compliant: false`. Next: a gap-closure round targeting GAP-24-01.) **Plan 24-09 (2026-09-01)** derived the badge's on/off state from the LIVE `data/best-effort-exclusions.json` at render time instead of the precomputed `excludedFromRecords` flag — claimed fixed in code, not yet browser-verified. **Plan 24-10's Round 2 checkpoint (closed 2026-09-01) TICKS this requirement — a clean sweep, 9/9 rows PASS across R15-R23.** R15 closes GAP-24-01's forward direction — the `Excluded — {reason}` badge rendered immediately at Save, before any Recompute, cache trap excluded first — and R19 closes the mirror direction (a human-hand row, since a native `window.confirm()` blocks browser automation): after untick, before any Recompute, no badge of any kind rendered, proven against an independently-derived value rather than the UI agreeing with itself — the precomputed `data/stats/best-efforts.json` still carried `excludedFromRecords === true` at that moment, so a badge gated on the old flag would have shown the reason-less fallback; it showed nothing. R16-R18/R20-R23 re-confirmed edit-in-place, the Recompute extent row, totals, reversibility and the three production-absence/cross-origin rows unregressed by plan 24-09's fix, all against a fresh build (`index-UHckEgvm.js`, confirmed to differ from Round 1's `index-xwaleiOf.js`). `24-VALIDATION.md` is now `status: complete` / `nyquist_compliant: true`. CUR-01 ticked Complete in `REQUIREMENTS.md`, and the origin todo moved to `completed/`. Phase 24's requirement gate was recorded closed on that basis. **REOPENED 2026-09-02 — the gate is NOT closed.** `24-VERIFICATION.md` scores **2/5 must-haves** (`gaps_found`) because the phase code review (`24-REVIEW.md`: 2 Critical, 13 Warning, 12 Info) ran AFTER plan 24-10 wrote its tracking, and invalidates two of the four criteria. **Criterion 3 FAILS on the requirement's own word "provably absent":** `scripts/lib/curation-guard.mjs:37`'s allowlist `SCANNED_EXTENSIONS = ['.js', '.html', '.css', '.map']` skips every other extension at line 90, while `dist/widgets` publishes 22 `.d.ts` files and `scripts/curate-overlay/index.ts` carries the literal `const CURATE_PREFIX = '/__curate'` — a leak of that shape returns `violations === []` under a green `✓ Curation-artifact scan`. Both R13 and R22 planted a `.js`, the one class the allowlist covers, so the blind spot has never been observed failing; the allowlist is deliberate (load-bearing so the guard cannot catch the public `best-effort-exclusions.json`), so closing this needs a denylist rethink. **Criterion 2 is PARTIAL:** plan 24-09 fixed `buildBestEffortsPanelRows` but not `buildPrBadgeLabels` (`detail-best-efforts-logic.ts:32-46`), called from the same `Promise.all` in the same paint (`detail.ts:546` vs `550`) — R15's own quoted evidence contains the unflagged contradiction `PRExcluded — ROUND2-2026-09-01 GPS device unreliable`. Code review **CR-01** additionally kills the curate dev server on any malformed percent-escape (`safeResolve` decodes unguarded at `curate-server.mjs:128`; `serveStaticRoute` is dispatched at line 646 with no `.catch()`, unlike the curate branch at 638) — local tooling only, never the published bundle. Round 2's recorded evidence stands and is not retracted; it is no longer sufficient on its own. CUR-01 returned to **Pending** and the origin todo returned to `pending/`. **Round 3 gap closure executed 2026-09-02 (plans 24-11..24-14, waves 7-8) — GATE STILL OPEN.** Plans 24-11, 24-12 and 24-13 fixed the three code-level gaps; plan 24-14's Round 3 checkpoint (R24-R31) scored **7 PASS / 1 FAIL**, not the clean sweep required to re-tick. **GAP-24-02** (criterion 3, the curation-guard allowlist) is discharged by **R28** (the guard observed RED against a planted `.d.ts`, a planted `.mjs` and a planted extensionless file — exactly the three classes it could not previously see — then GREEN once removed, reproducing the pinned build identity) and **R29** (`verify-dashboard` still exit 0, 40/40, public exclusions file still 200-and-parsing). **GAP-24-03** (CR-01, the curate server's Origin/Host gate never covering the static route) is discharged by **R30** (the `200, 403, 200, 403, 403, 403, 403` sequence: the server survives `GET /%`, stays alive per `kill -0`, and the static route now 403s on cross-origin/mismatched-Host requests same as the write routes). **GAP-24-04** (criterion 2, WR-05) is only PARTIALLY discharged: **R24** proves the forward direction (header badge vs. panel flags cells compared explicitly in one paint, `PRExcluded` string absent) but **R26**, the mirror/untick direction, is **FAIL** — its own discriminator turns out vacuous once R25's mandatory Recompute also clears `wasPRAtTheTime`, so the row structurally cannot tell correct wiring from broken wiring; **R27** shows the 24-13 code is in fact correct, isolating the defect to the checkpoint row's design. Per this plan's own rule, CUR-01 and this gate tick ONLY if every mapped row is PASS — so **the gate stays open**, CUR-01 stays **Pending**, and the origin todo stays in `pending/`. **GAP-24-05** is opened (`24-VALIDATION.md` § "Round 3 Checkpoint (R24-R31)"): the live-document mirror direction of WR-05 remains unproven by any checkpoint row to date and needs a differently-constructed row that the curate UI's own Save->Recompute->Untick sequence cannot itself produce. Next: a further gap-closure round targeting GAP-24-05. **Round 4 gap closure executed 2026-09-02 (plans 24-15..24-17, waves 9-10) — PHASE GATE CLOSED.** Re-verification round 4 (2026-09-02) had already returned `status: passed`, 5/5 must-haves, independently re-deriving each prior gap against live source and surfacing `detail-best-efforts-logic.test.ts:286` ("R19 mirror-image"), an existing unit test proving WR-05's mirror BEHAVIOUR — narrowing the amended GAP-24-05 to three concrete items; the developer held the gate open anyway pending browser-row coverage and two Warnings. All three are now discharged, per item: item 1 (browser-row coverage of the WR-05 mirror direction) by **R32** — the served best-efforts shard hand-edited so `wasPRAtTheTime: true` AND `excludedFromRecords: true` hold simultaneously for `400m` with NO Recompute, the discriminating state R19 and R26 could never reach, rendering exactly one badge `PR — 400m` against an on-disk discriminator quoted at the instant of observation — and by **R34**, a human-performed untick/confirm/re-untick/OK sequence (native `window.confirm()` blocks automation) restoring the identical badge against the same still-stale-true precomputed flag, satisfying ROADMAP criterion 4's own "human checkpoint" wording; item 2 (WR-14, `curation-guard.mjs`'s missing `entry.isFile()` guard) by **plan 24-15**, observed red against four of five failure classes (dangling symlink `ENOENT`, directory symlink `EISDIR`, mode-000 `EACCES`, `.json`-named symlink) turning an unattributed `Widget build failed: …` into an attributed `✗ Curation-artifact guard failed: <path>`, with the fifth class (FIFO) documented as unobservable pre-fix without hanging the build; item 3 (WR-17, no structural pin on `buildPrBadgeLabels`'s call site) by **plan 24-16**, which extracted a shared `resolveExcluded` both derivations now call and added a 12-combination header-vs-panel non-divergence table plus source-structure pins that fail when `buildPrBadgeLabels(bestEffortsEntry, null)` is substituted, while `tsc --noEmit` alone stays clean on that same substitution. Rounds 1-3's recorded evidence stands and is not retracted — R5's original badge-staleness find, R15/R19's Round 2 clean sweep (later found premature by code review), and R24/R28/R29/R30's Round 3 closures are all now sufficient in combination with Round 4's own R32-R35. Round 4's five-command gate (re-run at R35 on the fully integrated tree) is green — 1560/1560 tests, `tsc --noEmit` clean, both `npm run build` and `npm run build-widgets` clean (curation-artifact scan reporting no violations), `verify-dashboard` 40/40 — all four hand-edited files (two best-efforts-shard copies, two exclusions-document copies) restored byte-identical, proven by `sha256` and `cmp` since two of the four are gitignored and `git status` cannot cover them, and `git rev-parse HEAD` never moved during the browser session. CUR-01 ticks Complete in `REQUIREMENTS.md`, and the origin todo moves to `completed/`. See `24-VALIDATION.md` § "Round 4 Checkpoint (R32-R35)" for the full row-by-row evidence. (completed 2026-09-02)
- [ ] **Phase 25: CI Hardening & Light-Theme Verification** - Compute-chain ordering has one source of truth, the publish verifier checks every stats document by name, a gear-aggregate crash is closed, and Phase 16's light-OS theme items are finally confirmed live

  **PHASE GATE HELD OPEN — 2026-09-04 (plan 25-07, Round 1).** All seven plans executed and the closing VER-01 checkpoint ran in full, but the gate is **not** closed. Round 1 returned **R1 PASS, R2 BLOCKED, R3 PASS, R4 PASS, R5 PASS, R6 BLOCKED**. Under the governing all-rows-PASS rule (Phase 24 plan 24-14/24-17 precedent, non-waivable) a single BLOCKED row withholds the whole disposition, so **none** of FIX-02, VER-01, CI-01 or CI-02 is ticked — and FIX-02, CI-01 and CI-02, which had been ticked by plans 25-01/25-02/25-03 before the checkpoint ran, are **reopened** in `REQUIREMENTS.md`.

  **R2 (BLOCKED)** withholds VER-01: the row required a raster frame captured at or before `first-paint`, and the capture landed ~243 ms late (`first-paint` at +612 ms; frames at ~855 ms), so it cannot discriminate a first-paint white flash from its absence. The instrumentation itself was clean. **R6 (BLOCKED)** withholds CI-01, CI-02 and FIX-02: its clause 3 required a dispatched nightly-workflow run id and conclusion, and no dispatch has ever been performed for this phase.

  Substantively, the light-theme behaviour under test **did** verify: R1 confirmed light-OS legibility from the developer's own inspection, and R3/R4 confirmed live OS-follow in both directions within a single document with no reload. What is missing is evidence quality on two specific rows, not working behaviour. Two gaps are open — **GAP-25-01** (no capture mechanism that beats first paint) and **GAP-25-02** (CI-01's live-run evidence, plus the recommended R6a/R6b/R6c row split). Next step: `/gsd-plan-phase 25 --gaps`. See `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` § "Round 1 Checkpoint (R1-R6)".

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

**Plans**: 8 plans in 5 waves (7 executed, plus gap-closure plan 21-08 in Wave 5). Two of the five requirements resolve onto the **Records** screen, not Overview (D-01 puts the scope toggle on `records.ts`'s PR tables, the app's only records section; D-15 puts FIX-01's sub-label on both the Records and the Overview Current Streak tiles) — this is decided in `21-CONTEXT.md`, not scope creep. FIX-01 is planned as a two-layer fix in one plan (`streak-utils.ts:118` AND `records-logic.ts:274-282`, which maps `currentStreakStart` onto `endedISO`), because fixing only the layer the requirement names would ship a confidently wrong date. The `idPrefix` collision the shared renderer introduces is planned explicitly (21-02), not left for the executor to trip on. Criterion 6 is discharged by plan 21-07's thirteen-row checkpoint, served from `127.0.0.1` against a staged ended-streak fixture.

Plans:

**Wave 1** *(independent — no shared files)*

- [x] 21-01-PLAN.md — FIX-01 both layers: `currentStreakEnd` produced unconditionally by `calculateDailyStreaks`, threaded through `StreakData` and `compute-advanced-stats`, and read by `selectCurrentStreak` in place of the misread `currentStreakStart`, with the two-distinct-dates discriminator pinned in tests (FIX-01)
- [x] 21-02-PLAN.md — the shared row renderer: a four-member `RowSurface` scheme so two Overview cards can render the same activity without duplicating an element id, plus D-06's two-line `.activity-row__header` / `.activity-row__badges` DOM (OVR-01, OVR-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 21-03-PLAN.md — the D-06 layout in a Phase 21 banner block with a stated class contract, and cascade-aware assertions pinning every D-08-frozen bordered-card value it must not disturb (OVR-01, OVR-02)
- [x] 21-04-PLAN.md — Overview retires `renderRecentPrRow` / `recentPrBadgeText` / `recentPrRowAriaLabel` outright and both cards delegate to the shared renderer with distinct surfaces, with three invalidated source guards re-pointed at least as strongly (OVR-01, OVR-02)
- [x] 21-05-PLAN.md — the `.segmented` All time / This year control above the PR tables, a pure clock-free year filter that re-ranks 1..N, and a per-distance empty state replacing the hardcoded marathon copy year-scoping would have made far more visible (OVR-03)

**Wave 3** *(blocked on Waves 1 and 2 — both edit `overview.ts`)*

- [x] 21-06-PLAN.md — Distance This Year and Hours This Year appended to the `.stat-grid` from the already-published `yearly-stats.json`, and Overview's Current Streak tile gains the `ended {date}` sub-label, with every rendered value and all three degradation paths asserted as exact strings (OVR-04, FIX-01)

**Wave 4** *(blocked on everything — the checkpoint runs after every fix lands)*

- [x] 21-07-PLAN.md — full gate + BLOCKING thirteen-row human checkpoint on a `127.0.0.1`-served `/strava-widgets` build, with a disclosed staged-only ended-streak fixture whose `currentStreakStart` is deliberately left intact so the two `ended {date}` rows must read the date's value back rather than its presence (OVR-01, OVR-02, OVR-03, OVR-04, FIX-01)

**Wave 5** *(gap closure — `21-VERIFICATION.md` scored 5/6, OVR-03 open because Round 1's R7 was BLOCKED)*

- [x] 21-08-PLAN.md — full gate + BLOCKING two-row Round 2 human checkpoint closing OVR-03's one gap: a disclosed staged-only `best-efforts.json` fixture redating two 400m ranking entries into 2026 with their source ranks `4` and `9` deliberately intact, so the re-rank row must read `#1` / `Mar 14, 2026` back rather than confirm a row appeared, preceded by its own hard-reload freshness row (OVR-03)

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

**Plans**: 16 plans in 14 waves (plans 22-01..22-05 shipped the phase; 22-06..22-08 were gap-closure Round 2; 22-09..22-12 are gap-closure Round 3, opened because `22-VERIFICATION.md` re-verified at 4/7 with the ~380px overflow still open after two developer-observed FAILs (R11, R13) and with a new Critical finding, BL-03, that the CR-01 fix's own documentation overclaimed what it closed. Waves 1-8 were all sequential — 22-02 imports the `WeekStart` union 22-01 exports, and 22-03/22-04 both write `src/dashboard/views/calendar.ts`; Round 3's wave 9 runs 22-09 and 22-10 in parallel because their file sets are disjoint). The phase is deliberately split at the riskiest seam: 22-03 restructures the render loop, and 22-04 adds the toggle handler on its own so D-04's no-focus-theft contract gets its own review and its own source guard (Phase 20 shipped two focus-theft regressions of exactly that shape). 22-13..22-16 are gap-closure Round 4, opened because `22-VERIFICATION.md` re-verified at 5/8: Round 3's overflow fix was pinned to `@media (max-width: 380px)` while the defect-causing rules stayed unconditional at 381px+ (reopening CAL-02 at the 390/393/412px phone widths no round ever tested), and Round 3's own BL-03 fix made a Critical newly reachable — the header theme toggle re-derives its mode from storage per click, so under a null handle it is stranded on light. Round 4's wave 12 runs 22-13 and 22-15 in parallel because their file sets are disjoint. Criterion 5 is discharged by 22-05's eleven-row checkpoint, served from `127.0.0.1` under `/strava-widgets` against ORGANIC archive data — no fixture is needed or permitted, because October 2025 holds exactly one Sunday-dated run and is a natural single-variable discriminator (`22-RESEARCH.md` § D-16).

Plans:
**Wave 1**

- [x] 22-01-PLAN.md — generalize `buildMonthGrid` to a required `weekStart`, derive per-week totals, re-pin every Sunday expectation explicitly

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — the calendar-scoped week-start persistence module (`theme.ts` discipline) and the 8th grid column CSS

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-03-PLAN.md — week-start-aware weekday row, `Total` header, and a non-focusable screen-reader-named total cell after every week

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 22-04-PLAN.md — the `.segmented` Sunday/Monday control, persisting and rebuilding the grid in place without moving focus

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 22-05-PLAN.md — the blocking eleven-row browser checkpoint reading the October 2025 totals back under both week starts

**Wave 6** *(gap closure — blocked on Wave 5's verification result)*

- [x] 22-06-PLAN.md — close Gap 1: deepen the 380px compaction (GC-1), right-align the `Total` header (IN-05), correct the third-block comment (IN-06), and add override-aware CSS guards

**Wave 7** *(blocked on Wave 6 — both waves write `calendar.ts`)*

- [x] 22-07-PLAN.md — close Gap 2: guard the `globalThis.localStorage` property access (CR-01), make `buildMonthGrid` total for an off-union `weekStart` (WR-01), and correct the T-22-WK-01/02 security notes

**Wave 8** *(blocked on Waves 6 and 7 — the checkpoint must observe the fixed build)*

- [x] 22-08-PLAN.md — the blocking Round 2 browser checkpoint (rows R12..R17), re-asking the ~380px question R11 failed and observing the blocked-storage path in a real browser

**Wave 9** *(gap closure Round 3 — blocked on Wave 8's re-verification result; 22-09 and 22-10 touch disjoint files and run in parallel)*

- [x] 22-09-PLAN.md — close Gap 1 properly: land BL-01 (cap the Total track so it participates in the 380px squeeze) and BL-02 (collapse the day cell's inner 3-column grid to a single-column stack) TOGETHER, add the two `overflow-wrap: anywhere` floors, and invert `styles.test.ts:1858`'s assertion that locked the failing shape in place
- [x] 22-10-PLAN.md — open Gap 2's app-wide fix (BL-03, locked user decision): create the shared `resolveStorage()` in `src/dashboard/storage.ts`, reconcile `resolveWeekStartStorage` with it, close WR-01 and WR-02, and correct the two overclaiming source comments

**Wave 10** *(blocked on Wave 9 — imports the module 22-10 creates)*

- [x] 22-11-PLAN.md — wire the app-wide guard: `main.ts:19`, `nav.ts:186`, `nav.ts:206`, `theme.ts:93`, `theme.ts:130`, `detail-charts.ts:218`, plus a repo-wide test proving `storage.ts` is the only storage-global dereference site

**Wave 11** *(blocked on Waves 9 and 10 — the checkpoint must observe the fixed build)*

- [x] 22-12-PLAN.md — the blocking Round 3 browser checkpoint (rows R18..R23): the third narrow-viewport re-ask at a stated width, and the mandatory, non-waivable blocked-site-data row declined in Round 2

**Wave 12** *(gap closure Round 4 — blocked on Wave 11's re-verification result; 22-13 and 22-15 touch disjoint files and run in parallel)*

- [x] 22-13-PLAN.md — close WR-01 / truth #8: honour an explicit `storage: null` in `resolveStorage`, drop `theme.ts`'s `?? undefined` coercions, add `watchSystemTheme`'s `isAuto` guard seam, and replace the three vacuous BL-03 tests with sentinel-backed cases that fail if the override is ignored
- [x] 22-15-PLAN.md — close Gap 1 (CAL-02/SC3, reopened): raise the calendar compaction block from `@media (max-width: 380px)` to `@media (max-width: 640px)` so the 381-530px overflow band — which contains 390/393/412px — is covered, and add a parsed-breakpoint `>= 530px` guard so the fix's breadth is enforced, not just its existence

**Wave 13** *(blocked on Wave 12 — consumes the `isAuto` option 22-13 adds to `theme.ts`)*

- [x] 22-14-PLAN.md — close Gap 2 (CR-01): move the theme mode into an in-session `nav-theme.ts` controller seeded once at mount, so the header toggle reaches dark and auto under a null storage handle, and route `watchSystemTheme`'s auto-only guard through it

**Wave 14** *(blocked on Waves 12 and 13 — the checkpoint must observe the fixed build)*

- [x] 22-16-PLAN.md — the blocking Round 4 browser checkpoint (rows R24..R28): the first observation ever taken in the 381-640px phone-width band, and the first three clicks ever made on the theme toggle under real blocked site data

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

**Plans**: 13 plans in 9 waves. Waves 1-5 shipped the feature; waves 6-7 are the first gap-closure round, opened by Round 1's four FAILs (R8, R11, R15, R16) — wave 6 carries three parallel plans with disjoint file ownership, wave 7 is the blocking Round 2 browser checkpoint. Waves 8-9 are the second gap-closure round, opened by Round 2's single remaining FAIL (R35) and its located root cause (Finding 11, the five-tab `div.segmented` strip's uncontained 412px min-content floor): wave 8 is the containment fix plus Finding 12's deferral, wave 9 is the blocking Round 3 browser checkpoint that closes or re-blocks TRN-03.
**UI hint**: yes — no 23-UI-SPEC.md; the visual contract is 23-CONTEXT.md (D-10/D-11/D-17/D-18..D-21) extending 18-UI-SPEC.md §§ 7, 8, 10, 11, 14, 16.

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — install `chartjs-plugin-zoom` + `hammerjs`, and create the pure `trends-zoom-logic.ts` module + tests (D-06, D-09, D-12, D-13, D-14, D-16, D-22, D-24)
- [x] 23-02-PLAN.md — Trends-only tall-band CSS and zoom-cluster layout classes, with by-value tests (D-18, D-19, D-20, D-21)

**Wave 2** *(23-03 blocked on 23-02; 23-04 blocked on 23-01)*

- [x] 23-03-PLAN.md — shared `buildChartBand` helper; Volume and Training Load gain `.chart-band` markup for the first time (D-04, D-10, D-18, D-20)
- [x] 23-04-PLAN.md — new `chart-zoom.ts`: plugin config, control cluster, hint, grab cursor, and the settle updater every button calls directly (D-05, D-07, D-09, D-11, D-12, D-13, D-14, D-15, D-17)

**Wave 3** *(blocked on 23-03 and 23-04)*

- [x] 23-05-PLAN.md — wire the three zoomable mount functions, one shared controller for the Cadence & HR pair, and D-22 within-tab zoom state incl. the unmount reset (D-01, D-02, D-05, D-06, D-22, D-24)

**Wave 4** *(blocked on 23-05)*

- [x] 23-06-PLAN.md — granularity change resets to the new default window; Training Load's 3mo/12mo/All becomes zoom presets over the full series; `sliceLoadWindow` retired (D-03, D-23)

**Wave 5** *(blocked on 23-06)*

- [x] 23-07-PLAN.md — full gate + lazy-chunk-graph proof + recomputed expected values, then a BLOCKING 20-row human browser checkpoint under /strava-widgets (D-25)

**Wave 6** *(gap closure — blocked on 23-07's Round 1 checkpoint; three parallel plans, disjoint files)*

- [x] 23-08-PLAN.md — nest the settle callbacks inside the plugin's `zoom`/`pan` options and route the four buttons through the pure range math (Findings 10 + 1; closes R8, R11, R16)
- [x] 23-09-PLAN.md — contain the year heatmap's fixed 634px grid in a `.splits-scroll`-style scroll wrapper (Finding 9; closes R15)
- [x] 23-10-PLAN.md — step-aware x-axis tick formatting and an explicit per-chart ResizeObserver (Findings 7 + 8)

**Wave 7** *(blocked on 23-08, 23-09 and 23-10)*

- [x] 23-11-PLAN.md — fresh-build proof + recomputed expected values, then a BLOCKING 22-row Round 2 human browser checkpoint (R21-R42) and strict re-gating of TRN-01..TRN-04

**Wave 8** *(gap closure round 2 — blocked on 23-11's Round 2 checkpoint)*

- [x] 23-12-PLAN.md — contain the five-tab Trends tablist in a `.splits-scroll`-style `.trends-tablist-scroll` wrapper, pinned by value, and record Finding 12's dated deferral (Finding 11; closes R35)

**Wave 9** *(blocked on 23-12)*

- [x] 23-13-PLAN.md — fresh-build + served-bytes proof + re-affirmed expected values and a predicted phone-width geometry table, then a BLOCKING 12-row Round 3 human browser checkpoint (R43-R54) and strict re-gating of TRN-01..TRN-04

### Phase 24: Local Curation Mode

**Goal**: Developer can toggle an activity's exclusion from PR calculations through a localhost-only UI instead of hand-editing `data/best-effort-exclusions.json`, with a required reason surfaced in the detail view — and the write path is provably absent from the published bundle. (**amended 2026-08-27 per D-04**)
**Depends on**: Phase 19 (shared control styling for the curation UI); self-contained otherwise
**Requirements**: CUR-01
**Success Criteria** (what must be TRUE):

  1. Running `npm run curate` starts a localhost-only server exposing a UI to browse activities and toggle whole-activity PR exclusion, surfaced as an inline control on the activity detail view's "Best Efforts This Run" panel (**amended 2026-08-27 per D-04** — the original whole-run-vs-distance selectability clause is dropped; see 24-CONTEXT.md D-04).
  2. Toggling an exclusion requires entering a reason, which is then surfaced in the activity detail view.
  3. `verify-dashboard-publish.mjs` gains a new assertion, following the `assertNoPrivateArtifacts` precedent, that the curation write path (server code, curate UI bundle, write endpoints) is absent from the published GitHub Pages bundle — and that assertion demonstrably fails against a build that regresses this.
  4. **Human checkpoint**: run `npm run curate` locally, toggle a whole-activity exclusion end-to-end with a reason, confirm it lands in `data/best-effort-exclusions.json` and renders in the detail view; separately, load the production build served under `/strava-widgets` in a real browser and confirm no curation write endpoint is present or reachable. (**amended 2026-08-27 per D-04**)

**Plans**: 17 plans in 10 waves

Plans:

**Wave 1** *(three parallel plans, disjoint files — build tier, dashboard seam, docs)*

- [x] 24-01-PLAN.md — widen the vitest glob to `scripts/`, extract `copy-data-tree.mjs`, and ship D-10(a)'s curation guard as a pure violations-returning function called at the END of `buildAllWidgets()` (OD-2), observed red against five planted fixtures (D-11)
- [x] 24-02-PLAN.md — D-03's two inert additions: `data-activity-id` on the Best Efforts `<section>` and one `dashboard:best-efforts-mounted` CustomEvent dispatched as the last statement of `mountBestEffortsAndBadges`, pinned by a source-structure guard observed red
- [x] 24-03-PLAN.md — the D-04 requirements change this phase owns: amend CUR-01, the milestone-checklist line, the Phase 24 goal and criteria 1 and 4, and record OD-1..OD-4 as dated notes in `24-CONTEXT.md`

**Wave 2** *(blocked on 24-01; two parallel plans, disjoint files)*

- [x] 24-04-PLAN.md — the curate server's serving half: FATAL missing-build check, fixed `127.0.0.1:4173` bind (OD-4), `/strava-widgets` prefix mount, in-flight overlay-tag injection, esbuild bundling into gitignored `.curate-dist/`, and `/__curate/health` + `/__curate/overlay.js`
- [x] 24-05-PLAN.md — D-10(b)'s three `expect404` assertions in `verify-dashboard-publish.mjs` plus a subprocess planted-fixture test proving the shipped verifier exits non-zero, with `/data/best-effort-exclusions.json` still 200-and-parsing

**Wave 3** *(24-06 blocked on 24-04; 24-07 blocked on 24-02 and 24-04; disjoint files)*

- [x] 24-06-PLAN.md — the write half: pure `applyUpsert`/`applyRemove` honouring D-05 (`distances: null`, untick deletes and never leaves `[]`), atomic write + instant mirror (D-07), D-12's Origin/Host gate, server-side id/reason validation, body cap, and the ordered recompute chain
- [x] 24-07-PLAN.md — the overlay UI: D-08's two-step commit with a required reason, pre-ticked already-excluded state, confirm-before-delete, OD-1's reload-not-re-render, streamed Recompute, and zero shipped CSS (OD-3)

**Wave 4** *(blocked on 24-02, 24-03, 24-05, 24-06 and 24-07)*

- [x] 24-08-PLAN.md — fresh full gate with recorded asset hashes and expected values derived from `best-efforts.json`/`weekly-distance.json`/`monthly-stats.json` BEFORE any write, then a BLOCKING 14-row human browser checkpoint (R1-R14) whose extent rows assert the promoted next-best effort comes from a different activity and that totals are unchanged

**Wave 5** *(gap closure — blocked on 24-08; closes GAP-24-01 from `24-VALIDATION.md` Round 1 R5)*

- [x] 24-09-PLAN.md — derive the `Excluded — {reason}` badge's on/off state from the LIVE `data/best-effort-exclusions.json` at render time instead of the precomputed `excludedFromRecords` flag, so the badge is correct immediately after Save and immediately after an untick with no Recompute and no rebuild; both new guards observed red against a planted regression (D-11)

**Wave 6** *(blocked on 24-09)*

- [x] 24-10-PLAN.md — BLOCKING Round 2 browser checkpoint (R15-R23) re-running R5 in its original sequencing plus its mirror direction, and re-asserting edit-in-place, the Recompute extent row, totals, untick/restore and the three production-absence rows; then the CUR-01 disposition

**Wave 7** *(gap closure — blocked on 24-10; closes the three gaps in `24-VERIFICATION.md` (`gaps_found`, 2/5 must-haves); three parallel plans, disjoint files)*

- [x] 24-11-PLAN.md — GAP-1 / CR-02: invert `curation-guard.mjs`'s `SCANNED_EXTENSIONS` allowlist to a one-entry, justified skip-list (`UNSCANNED_EXTENSIONS = ['.json']`) so `.ts`/`.d.ts`, `.mjs` and extensionless files under `dist/widgets` fail CLOSED, with planted fixtures for all three classes observed red then green (D-11)
- [x] 24-12-PLAN.md — GAP-2 / CR-01: stop a malformed percent-escape (`GET /%`) from killing the curate server — try/catch in `safeResolve`, a try/catch around the `createServer` listener body via an extracted `respond500`, and D-12's `isTrustedOrigin` gate extended to the static route it never covered, all observed red first
- [x] 24-13-PLAN.md — GAP-3 / WR-05: give `buildPrBadgeLabels` a REQUIRED `liveExclusions` parameter and suppress `BestEffortPanelRow.isPr` for live-excluded rows, so the header PR badges and the Best Efforts flags cells can no longer render `PRExcluded — {reason}` in one paint

**Wave 8** *(blocked on 24-11, 24-12 and 24-13)*

- [x] 24-14-PLAN.md (executed; disposition withheld — 7/8 rows PASS, R26 FAIL, GAP-24-05 opened) — BLOCKING Round 3 checkpoint (R24-R31): the Save/Recompute/untick flow with header-vs-panel compared in one paint against a pre-write pinned PR set, the guard observed red on three previously-unscanned extension classes in the real `dist/widgets`, the curate server's `200 / 4xx / 200` liveness triple and four `403`s; then the CUR-01 and phase-gate disposition, earned only on those verdicts

**Wave 9** *(gap closure round 4 — closes items 2 and 3 of the AMENDED GAP-24-05 in `24-VALIDATION.md`; two parallel plans, disjoint files)*

- [x] 24-15-PLAN.md — WR-14: give `curation-guard.mjs`'s walk an `entry.isFile()` gate and a `readFileSync` try/catch, so a dangling symlink, a directory symlink, a mode-000 file and a FIFO are REPORTED as violations instead of throwing `ENOENT`/`EISDIR`/`EACCES` out of the guard or hanging the build — four of five classes observed red first (D-11), and the build-level message contrasted from an unattributed `Widget build failed: ENOENT` to an attributed `✗ Curation-artifact guard failed: <path>` in the real `dist/widgets`
- [x] 24-16-PLAN.md — WR-17: replace the two verbatim copies of the exclusion ternary with one exported `resolveExcluded` both derivations call, add a 12-combination header-vs-panel non-divergence table, and pin `detail.ts`'s `buildPrBadgeLabels(bestEffortsEntry, liveExclusions)` call site and its shared binding in `curation-seam.test.ts` — with `buildPrBadgeLabels(bestEffortsEntry, null)` observed to fail the suite while still passing `tsc --noEmit`

**Wave 10** *(blocked on 24-15 and 24-16)*

- [x] 24-17-PLAN.md — BLOCKING Round 4 checkpoint (R32-R35) closing item 1 of the amended GAP-24-05: browser-row coverage of the WR-05 mirror direction, reached by hand-editing the per-activity best-efforts shard (both the working-tree and the served `dist/widgets` copy) so `wasPRAtTheTime` stays `true` while `excludedFromRecords` is `true` with NO Recompute — the state R19 and R26 could not reach — with reachability asserted from disk before the row is presented, an exact badge count judged against two documents the round never edits, byte-identity restore proven by digest, and then the CUR-01 and phase-gate disposition (executed 2026-09-02; R32-R35 all PASS, CUR-01 and the Phase 24 gate CLOSED — see `24-VALIDATION.md` § "Round 4 Checkpoint (R32-R35)")

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

**Plans**: 12 plans

Plans:
**Wave 1**

- [x] 25-01-PLAN.md — FIX-02: widen the Unknown-bucket predicate at both `gear-aggregate-logic.ts` call sites (D-12) and make `gearName` optional on the row type with a bounded `tsc` triage (D-13)
- [x] 25-02-PLAN.md — CI-01: extract `COMPUTE_ALL_STATS_STEPS` plus a pure walker into `src/compute-all-stats-steps.ts` (D-01/D-03), add the `--ci` flag (D-02), unit-test both, and collapse the workflow's twelve compute/warn steps into one invocation
- [x] 25-03-PLAN.md — CI-02: six by-name assertions with per-document structural invariants (D-09) and a runtime-derived shard sample (D-10), each observed RED naming its own document (D-11)
- [x] 25-05-PLAN.md — VER-01/D-06: `node:vm` behavioural parity pin on `index.html`'s inline theme bootstrap, proven load-bearing by three deliberate mutations

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 25-04-PLAN.md — WR-19 (folded todo): wrap `curation-guard.mjs`'s `readdirSync` in the sibling try/catch so an unreadable directory is a reported violation, with a mode-000-directory fixture observed RED first; close the todo

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 25-06-PLAN.md — Wave-2 integration gate: the five-command gate on the merged tree, plus a real `gh workflow run` nightly execution proving the collapsed step's log carries all eight step names (criterion 5, items 1-3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 25-07-PLAN.md — VER-01 human checkpoint (R1-R6) on a genuinely light-OS machine against production (D-04/D-05/D-07/D-08), then disposition for FIX-02, VER-01, CI-01 and CI-02 under the all-rows-PASS rule

*Round 1 returned R2 and R6 BLOCKED, withholding all four requirements. Plans 25-08 through 25-12 are the gap-closure round for GAP-25-01 (no capture mechanism beats first paint) and GAP-25-02 (CI-01's live-run evidence does not exist, and R6 is unsplittable while it doesn't).*

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 25-08-PLAN.md — GAP-25-01: build a zero-dependency CDP capture harness, measure three candidate mechanisms against the real 612 ms first paint, and prove the failure direction with a stripped-bootstrap control — mechanism chosen before any row is drafted

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 25-09-PLAN.md — Draft every Round 2 row before it is run (Checkpoint Row Discipline rule 3): R7 for VER-01, plus GAP-25-02's R6a/R6b/R6c split, one requirement each, every row with a bidirectional reachability proof

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 25-10-PLAN.md — Run R7: the observed first-paint row on a genuinely dark OS against production (D-04/D-05/D-07/D-08), with the frame tied to its own navigation by arithmetic

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 25-11-PLAN.md — GAP-25-02: merge and gate the tree to be pushed, obtain explicit authorisation for the production-affecting push and `gh workflow run` dispatch, then score R6a/R6b/R6c independently

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 25-12-PLAN.md — Round 2 disposition under the all-rows-PASS rule, applied one row per requirement, across `25-VALIDATION.md`, `REQUIREMENTS.md`, `ROADMAP.md` and `STATE.md`

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
| 21. Overview Rebuild | v2.1 | 8/8 | Complete    | 2026-08-18 |
| 22. Calendar Week-Start & Totals | v2.1 | 16/16 | Complete   | 2026-08-19 |
| 23. Trends Zoom, Pan & Taller Bands | v2.1 | 13/13 | Complete    | 2026-08-27 |
| 24. Local Curation Mode | v2.1 | 17/17 | Complete    | 2026-09-02 |
| 25. CI Hardening & Light-Theme Verification | v2.1 | 11/12 | In Progress|  |

---
*Last updated: 2026-08-12 — v2.1 Interface Polish roadmap created (phases 19-25, 25 requirements mapped). v1.0-v2.0 preserved above; v2.0 archived to `milestones/v2.0-ROADMAP.md`.*
