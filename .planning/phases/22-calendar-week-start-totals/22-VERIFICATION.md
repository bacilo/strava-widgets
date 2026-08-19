---
phase: 22-calendar-week-start-totals
verified: 2026-08-19T09:30:00Z
status: gaps_found
score: 5/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "Narrow, calendar-scoped throwing-localStorage crash (T-22-WK-02) — unchanged from Round 2's close, reconfirmed: resolveWeekStartStorage now delegates to storage.ts's shared resolveStorage(), same guarantee."
    - "The literal Round 2 Gap 2 (app-level module-scope crash under blocked site data, main.ts:19 unguarded) — CLOSED. main.ts:19 now reads `applyThemeMode(readStoredMode(resolveStorage()))`; confirmed by direct source read. R22 (Safari, Block all cookies, full reload) observed the app boot, nav render, grid render, Monday default, no console errors — the first real-browser exercise of this exact path in the phase."
  gaps_remaining:
    - "The ~380px-and-below day-cell/week-total overflow (CAL-02) is fixed ONLY inside `@media (max-width: 380px)`. This was never actually a full close of SC3 ('legible at every viewport the app is expected to render at') — R19 observed exactly one width (375px). Confirmed by direct read of styles.css: `.calendar-day { min-width: 32px }`, `.calendar-grid { grid-template-columns: repeat(7, 1fr) auto }` and `.calendar-week-total { white-space: nowrap }` all apply UNCONDITIONALLY outside the 380px block, with no other @media rule in the file touching `.view`, `.calendar-grid`, `.calendar-day`, or `.calendar-week-total` between 381px and 1000px. This reproduces the same defect class (a nowrap content floor on the Total track, plus a fixed per-day min-width) at common phone widths (390px iPhone 12-15, 393px iPhone 15/16 Pro, 412px Pixel) that R19/R11/R13 never tested."
  regressions:
    - "CR-01 (new this round, code-review-discovered, confirmed by direct source read): the header theme toggle (nav.ts:210-215, handleThemeToggleClick) re-derives the current mode from storage on every click instead of holding in-memory state. readStoredMode(null) always returns 'auto', and cycleThemeMode('auto') always returns 'light' — so whenever the storage handle is null or unusable (the EXACT blocked-site-data configuration this round's own BL-03 fix targeted, plus Safari private mode), the toggle is permanently stuck on light and dark/auto are unreachable. This bug is NEWLY REACHABLE because of this phase's own fix: before Round 3, the same blocked-storage configuration crashed the whole bootstrap blank (main.ts:19), so the toggle could never be clicked in that state; after Round 3's app-wide resolveStorage() wiring (plan 22-11), the page now renders and the broken toggle becomes exercisable. R22 did not click the theme toggle under blocked storage — it only checked that nav/grid rendered — so the checkpoint did not catch this."
  new_findings_this_round:
    - "WR-01 (code review) confirmed: theme.ts:108/145 do `resolveStorage(options.storage ?? undefined)`. Passing `storage: null` therefore becomes `undefined`, which falls through resolveStorage's `if (override)` check to `globalThis.localStorage`, NOT to the null-handle path the JSDoc claims ('unless ... no storage handle could be resolved'). The three theme.test.ts BL-03 cases that pass `storage: null` (lines ~199, ~206, ~267) pass only because vitest.config.ts sets `environment: 'node'` repo-wide and there is no globalThis.localStorage in that environment, so the fallthrough happens to land on `null` anyway — confirmed by reading vitest.config.ts and grep for any setupFile assigning globalThis.localStorage (none exists). Under jsdom or a real browser these same tests would silently read/write the REAL localStorage instead of honoring the null override. This is a genuine test-quality gap, not merely a code-review nitpick — it is exactly the kind of vacuous-pass the phase's own history (Rounds 1-2) was penalized for."
gaps:
  - truth: "SC3/CAL-02 — each week row's total and day-cell values render legibly, with no overflow, at every viewport the app is expected to render at"
    status: partial
    reason: "Round 3's R19 PASS only proves the claim at a single stated width (375px, inside the ≤380px block). The fix (plan 22-09) is deliberately and explicitly scoped to `@media (max-width: 380px)` only (22-09-PLAN.md's own must-have: 'D-10's eight-column contract survives as the DEFAULT-breakpoint shape ... Only the track SIZING FUNCTIONS change at 380px'). Confirmed by direct read of the current styles.css: outside that block, `.calendar-day` keeps an unconditional `min-width: 32px`, `.calendar-grid` keeps `grid-template-columns: repeat(7, 1fr) auto`, and `.calendar-week-total` keeps `white-space: nowrap` with no `min-width`/`white-space` override — the exact BL-01 defect shape, just one pixel above where it was fixed. No other @media rule between the file's 465px, 544px, 640px, 720px, and 1000px breakpoints touches `.view`'s padding or any of these three selectors. This reproduces the overflow class at ordinary phone widths (390px, 393px, 412px) that were never exercised by any Round 1/2/3 checkpoint row — R19 explicitly names 375px, and no row above 380px and below desktop width exists anywhere in 22-VALIDATION.md."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "The BL-01/BL-02/GC-4 overflow fix (lines 926-960) is gated at `@media (max-width: 380px)`. The pre-existing, unconditional rules at lines 743 (`grid-template-columns: repeat(7, 1fr) auto`), 766-769 (`.calendar-day { min-width: 32px }`), and 825-833 (`.calendar-week-total { white-space: nowrap }`, no min-width override) apply at every width from 381px to at least 1000px (the next `min-width` breakpoint the file defines), and were not touched by Round 3."
    missing:
      - "Either widen the fix's breakpoint (22-REVIEW.md's own suggested fix: raise to `max-width: 640px` or split into a floor-removal block at 640px plus the font-size compaction retained at 380px) or add an explicit, developer-observed checkpoint row at a realistic phone width above 380px (e.g. 390px or 412px) before re-closing this gap. A single 375px observation is not evidence for the 381px+ band; the two bands are governed by disjoint CSS rule sets."
  - truth: "No new Critical defect is introduced by this phase's own gap-closure work (an implicit but load-bearing condition of 'phase goal achieved' — a phase that fixes one crash by introducing a different, newly-reachable broken control has not cleanly closed its own gap)"
    status: failed
    reason: "Confirmed by direct source read: nav.ts:210-215's handleThemeToggleClick calls `readStoredMode(resolveStorage())` fresh on every click rather than holding in-memory theme state (contrast calendar.ts:443's `let weekStart`, reassigned by setWeekStart, which is why the week-start toggle does NOT have this bug). Under any configuration where resolveStorage() returns null or getItem is unusable — which, after this round's own BL-03 fix, includes the exact blocked-site-data browser configuration R22 exercised, plus the pre-existing Safari-private-mode case — readStoredMode(null) unconditionally returns 'auto', and cycleThemeMode('auto') unconditionally returns 'light'. Every click therefore reapplies 'light'; dark and auto are permanently unreachable. This is NEWLY REACHABLE as a symptom because of this phase's own Round 3 fix: pre-fix, the identical browser configuration crashed the whole module graph (main.ts:19 unguarded) and rendered a blank page before the toggle button existed to click; post-fix (plan 22-11), the page renders correctly and the broken toggle becomes clickable. R22's checkpoint row only confirmed nav/grid render and no console error — it never clicked the theme toggle under the blocked-storage condition it was otherwise thoroughly exercising, so this regression escaped the checkpoint entirely."
    artifacts:
      - path: "src/dashboard/nav.ts"
        issue: "Lines 210-215: handleThemeToggleClick derives `current` from a fresh resolveStorage()+readStoredMode() call on every invocation instead of an in-memory mode variable seeded once at mount and reassigned on each toggle."
    missing:
      - "Make the in-session mode the source of truth in nav.ts, seeded once from storage at mount and reassigned by the click handler (mirroring calendar.ts's `let weekStart` pattern) — 22-REVIEW.md CR-01 provides a concrete fix sketch."
      - "A checkpoint row that clicks the theme toggle at least twice while storage is unusable (blocked site data or a throwing getItem), confirming the mode actually advances past 'light'."
human_verification:
  - test: "Narrow the viewport to a realistic phone width strictly ABOVE 380px and AT OR BELOW ~530px (e.g. 390px or 412px via device emulation, matching a real iPhone/Pixel CSS width) on the October 2025 calendar month. Read back at least three day-cell distance values and one week-total cell."
    expected: "If CR-02's arithmetic is correct, values will overflow their cells or the grid will overflow the viewport at this width, because the 380px-scoped fix does not apply here. If they render cleanly, CR-02's estimated ~381-530px overflow band is not real (or is narrower than estimated) and this gap can be closed with a source note rather than a CSS change."
    why_human: "This is the exact class of visual/rendering judgement that required the developer's own eyes across R11, R13, and R19 — grep/source-read can confirm which CSS rules apply at this width but not what actually renders."
  - test: "With site-data blocking active in a real browser (the same Safari 'Block all cookies' configuration R22 used), click the header theme toggle two or three times and observe whether the icon/aria-label ever reaches dark or auto, or whether it stays on light every time."
    expected: "Per CR-01, the toggle should be observed stuck on light across every click in this configuration."
    why_human: "Interactive control behavior under a real degraded-storage browser configuration; the same category R22 already required the developer's own eyes for, just testing a different control this round's fix newly exposed to that configuration."
---

# Phase 22: Calendar Week-Start & Totals Verification Report

**Phase Goal:** User can choose whether the training-log week starts Sunday or Monday; the choice persists and correctly drives which days each week-total sums, on calendar controls styled to match the rest of the dashboard.
**Verified:** 2026-08-19T09:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after Round 3 gap-closure (plans 22-09..22-12), superseding the prior verification dated 2026-08-18T21:40:00Z (score 4/7, gaps_found).

## Reconciliation Summary

Round 3 genuinely closed two of the three items the prior verification flagged as open, and this verification independently confirms both by direct source read:

- **The literal main.ts:19 module-scope crash (prior Gap 2) — CLOSED.** `main.ts:19` now reads `applyThemeMode(readStoredMode(resolveStorage()))`; all six previously-unguarded storage-global dereference sites (`main.ts:19`, `nav.ts:186`, `nav.ts:206`, `theme.ts:93`, `theme.ts:130`, `detail-charts.ts:218`) now resolve through a single shared `storage.ts`, proven by a repo-wide comment-stripped source guard. R22's real-browser observation (Safari, "Block all cookies", full reload: nav rendered, grid rendered, Monday default, no console errors) is the first actual exercise of this path in the phase and it PASSED.
- **The narrow calendar-scoped throwing-getter crash (T-22-WK-02) — remains closed**, unchanged in substance from Round 2, now delegated through the same shared resolver.

But this verification does **not** accept two of Round 3's other "CLOSED" dispositions at face value, and re-derives both from source:

1. **CAL-02/SC3 ("legible at every viewport the app is expected to render at") is NOT actually closed.** Round 3's own plan (22-09-PLAN.md) explicitly scoped the fix to `@media (max-width: 380px)` only, by design. Direct read of the current `styles.css` confirms the pre-existing, unconditional rules (`.calendar-day { min-width: 32px }`, `.calendar-grid { grid-template-columns: repeat(7, 1fr) auto }`, `.calendar-week-total { white-space: nowrap }`) still govern every width from 381px up to at least 1000px — the identical defect class R11/R13 failed on, one pixel above where it was fixed. R19, the row that closed this gap in `22-VALIDATION.md`, observed exactly one width: 375px. No checkpoint row in any of the three rounds tests a width between 381px and desktop, and that band includes the three most common real phone CSS widths (390px, 393px, 412px). `22-REVIEW.md`'s CR-02 makes this argument from CSS-arithmetic; this verification confirms every structural premise of that argument by independently reading the same source. **This gap is reopened.**
2. **A new Critical regression, confirmed by source read, that Round 3's own checkpoint did not catch.** `nav.ts`'s theme toggle (`handleThemeToggleClick`) re-derives its current mode from storage on every click rather than holding in-memory state. Under a null/unusable storage handle it is permanently stuck on "light." This bug pre-dates the exact code shape in some sense, but it is **newly reachable** specifically because Round 3's own BL-03 fix stopped the blocked-storage page from crashing blank — trading one failure (blank page) for a different, subtler one (a broken control on a page that now renders). R22's checkpoint row exercised page rendering under blocked storage but never clicked the toggle, so it did not observe this. `22-REVIEW.md`'s CR-01 identifies this independently; confirmed here.

Net: **two prior gaps close, one prior gap reopens on closer inspection, one new regression is discovered.** Status stays `gaps_found`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — User can toggle Sunday/Monday via a control and the choice persists across a real reload | ✓ VERIFIED (evidence-quality caveat) | Round 1 R2/R5/R7/R8 PASS (pre-Round-3 build). Round 3 R20 regression-checks the read path end-to-end (all five Monday-start totals match, Mon-first headings confirm Monday-start) against the post-refactor build. Source confirms `calendar.ts:443`'s `let weekStart = readStoredWeekStart(storage)` and `calendar-preferences.ts`'s read/write functions are untouched in substance by 22-10/22-11 (only the storage-handle resolution was refactored to delegate through the new shared `resolveStorage()`). R23's week-start half (select Sunday, hard-reload, confirm `Sun` first) was answered only by a stale pre-R22 "confirm" and not re-stated with detail post-restore — a real evidence-quality gap, but the underlying code path is unchanged from Round 1's fully-observed R7 and is independently regression-checked by R20. Judged sufficient on the strength of source-code continuity plus R20, not on R23 alone. |
| 2 | SC2 — `buildMonthGrid`'s hard-coded Sunday-first math is generalized to a required `weekStart` parameter and covered by unit tests for both week-start values | ✓ VERIFIED | Unchanged since Round 2's close, reconfirmed: `buildMonthGrid(rows, month, weekStart: WeekStart)` still required at `calendar-logic.ts:214-217`, `weekStartOffset()` is total (`calendar-logic.ts:182`). `npx tsc --noEmit` exits 0; `npx vitest run src/dashboard` (30 files) is 896/896 passing (a subset run; full-suite `data/stats/`-dependent failures are pre-existing and environmental, documented in `deferred-items.md`, unrelated to this phase). |
| 3 | SC3 — Each week row shows a computed total, correct for the selected week start, legible at every viewport the app is expected to render at | ✗ FAILED | R19 (Round 3) confirmed legibility at exactly 375px only. Direct read of `styles.css` confirms the fix is gated at `@media (max-width: 380px)` and the identical pre-existing overflow-causing rules (unconditional 32px day-cell min-width, `nowrap` Total-track floor, `repeat(7,1fr) auto` grid) govern 381px through at least 1000px with no override in between. No checkpoint row in any round tests this band, which includes the three most common real phone widths (390/393/412px). See Gaps. |
| 4 | SC4 — The week-start control and other Calendar inputs use Phase 19's shared styling | ✓ VERIFIED (minor cosmetic caveat, unchanged from Round 2) | R9/R10 (Round 1), R17 (Round 2 confirm-unregressed), R21 (Round 3 confirm-unregressed, thin/waived but non-gating) all PASS. WR-05's 8px header/value cosmetic offset remains open and non-blocking, as previously noted. |
| 5 | SC5 — The mandatory human browser checkpoint confirms the grid re-flows and week totals recompute correctly across all rounds | ✗ FAILED | 23 rows total across three rounds with genuine per-row, quoted evidence. But the checkpoint's own coverage has a structural hole: R19 (the decisive narrow-viewport row, non-waivable) tested exactly one width, 375px, never the 381-530px band the current CSS structurally still exposes; and R22 (the decisive blocked-storage row, non-waivable) tested page rendering but never the theme-toggle interaction that this round's own fix newly exposed to the same configuration. The checkpoint genuinely closed what it asked; it did not ask the full set of questions the shipped CSS/JS changes required. |
| 6 | T-22-WK-02 (narrow) — a throwing/inaccessible `localStorage` GETTER does not crash the Calendar mount | ✓ VERIFIED | Unchanged in substance from Round 2's close; `resolveWeekStartStorage()` now delegates to `storage.ts`'s shared `resolveStorage()`, same guarantee, confirmed by source read. |
| 7 | BL-03 / GC-5 — the app-level blocked-site-data threat is closed end to end, and the fix's own documentation accurately describes what is covered, with no regression introduced elsewhere | ✗ FAILED | The module-scope crash IS closed: `main.ts:19` guarded, confirmed by source read and by R22's real-browser PASS (Safari, "Block all cookies," full reload: nav+grid render, Monday default, no console errors). But the SAME fix that closed this made a different, Critical defect newly reachable: `nav.ts`'s theme toggle is permanently stuck on "light" under the identical blocked-storage configuration (CR-01, confirmed by direct source read of `nav.ts:210-215`). R22 never exercised the toggle, so this was not caught. "End to end, no regression" is not true as shipped. |
| 8 | (New, this round) `theme.test.ts`'s three BL-03 null-storage-handle test cases are real proofs of the `storage: null` code path, not vacuous passes of a different path | ✗ FAILED | Confirmed by direct source read: `theme.ts:108`/`:145` compute `resolveStorage(options.storage ?? undefined)`. `null ?? undefined` evaluates to `undefined`, which `resolveStorage` treats as "no override supplied" and falls through to `globalThis.localStorage` — NOT to an honored `null`. The three tests pass only because `vitest.config.ts` sets `environment: 'node'` project-wide (confirmed by reading the config; no setup file assigns `globalThis.localStorage`), so the fallthrough happens to land on `null` anyway in this specific test environment. Under jsdom or a real browser, the same test bodies would read/write the REAL global instead of honoring the null override — this is exactly the vacuous-pass pattern the phase's own history was already penalized for in Rounds 1-2 (22-REVIEW.md WR-01). |

**Score:** 5/8 truths verified (3 FAILED — see Gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/calendar-logic.ts` | `WeekStart` union, required `weekStart` param, total `weekStartOffset`, `WeekTotal`, `weekTotals` | ✓ VERIFIED | Unchanged since Round 2; reconfirmed by source read. |
| `src/dashboard/storage.ts` | Shared `resolveStorage(override?)` handle resolver, sole storage-global dereference site in `src/dashboard/` | ✓ VERIFIED | Confirmed by source read (`storage.ts:46-53`); narrow, no `getItem`/`setItem`/key logic, matches D-06 fence. |
| `src/dashboard/views/calendar-preferences.ts` | `resolveWeekStartStorage` delegates to shared resolver | ✓ VERIFIED | One-line delegation confirmed. |
| `src/dashboard/main.ts` | Module-scope theme read guarded via `resolveStorage()` | ✓ VERIFIED | `main.ts:19` confirmed guarded, closing Round 2's Gap 2. |
| `src/dashboard/nav.ts` | Six-site guard wiring; theme toggle behaves correctly under a null/unusable storage handle | ⚠️ PARTIAL | Storage-handle resolution is correctly wired (guard closed), but the toggle's OWN state-management logic (unrelated to the guard itself) is broken under exactly the configuration the guard now makes reachable — see Gaps, CR-01. |
| `src/dashboard/theme.ts` | Null-tolerant `readStoredMode`/`applyThemeMode`/`watchSystemTheme`; explicit `null` override honored | ⚠️ PARTIAL | Null-tolerance for an ABSENT global is correct. An explicit `storage: null` override is silently upgraded to the real global via `?? undefined` — see Gaps/WR-01. |
| `src/dashboard/styles.css` | 380px compaction fix for CAL-02 overflow, `.calendar-weekday--total` alignment | ⚠️ INSUFFICIENT (breakpoint-scoped only) | BL-01/BL-02 rules present and correctly close the ≤380px case (confirmed by source read of the 380px block). Does not extend to 381px+, where the pre-existing overflow-causing rules are unconditional. See Gaps, CR-02. |
| `.planning/phases/22-calendar-week-start-totals/22-VALIDATION.md` | Round 1 (11 rows) + Round 2 (6 rows) + Round 3 (6 rows) sections, append-only | ✓ VERIFIED | All three rounds present; Round 3 records 6/6 PASS with three disclosed thin/waived rows (R18, R21, R23) and two fully-observed non-waivable rows (R19, R22). |
| `.planning/REQUIREMENTS.md` | CAL-01/02/03 ticked matching row map | ⚠️ OVERSTATED | CAL-02 is ticked "Complete" citing R18/R19/R20; this verification finds R19's single-width evidence insufficient to support the requirement's own "every viewport" language. CAL-01/CAL-03 ticks are supportable on the evidence available. |
| `.planning/phases/22-calendar-week-start-totals/22-REVIEW.md` | Fresh code review post-Round-3 | ✓ VERIFIED | 2 critical / 6 warning / 6 info findings; CR-01 and CR-02 independently reproduced against current source in this verification; WR-01's vacuous-test claim independently reproduced. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `main.ts`'s module-scope theme read | app bootstrap survives blocked storage | `resolveStorage()` | ✓ WIRED | Confirmed by source read and R22 PASS. |
| a click on the header theme toggle, under a null/unusable storage handle | a mode change reaching dark or auto | in-memory mode state | ✗ NOT_WIRED | No in-memory mode exists in `nav.ts`; every click re-derives `'auto'` from a null handle and applies `'light'`. CR-01. |
| `.calendar-day` (7 tracks) + `.calendar-week-total` (8th track) | a squeezed, non-overflowing grid | width-relaxing rules | ⚠️ PARTIAL — WIRED at ≤380px only | The `minmax(0, ...)`/`min-width: 0`/`white-space: normal` relaxations exist only inside `@media (max-width: 380px)`; at 381px+ the tracks keep their unconditional content-based floors. CR-02. |
| `theme.ts`'s `ApplyThemeOptions.storage: null` | an honored "do not persist" instruction | `resolveStorage(options.storage ?? undefined)` | ✗ NOT_WIRED | `null ?? undefined` discards the explicit `null`; falls through to the real global instead of honoring the override. WR-01. |
| a click on either segmented Sunday/Monday option | repainted `.calendar-grid` | `setWeekStart` → `writeWeekStart` + `buildMonthGrid` + `renderGrid` | ✓ WIRED | Unchanged since Round 2; confirmed by source read and R20's regression check. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `calendar.ts`'s week-total cells | `grid.weekTotals[i]` | `buildMonthGrid` → `weekTotals` from in-month cells | Yes — R20 read back all five Monday-start triples matching the independently-recomputed archive table | ✓ FLOWING |
| `nav.ts`'s theme toggle state | `readStoredMode(resolveStorage())`, re-derived every click | storage (no in-memory fallback) | No — when storage is null/unusable, the derivation is a CONSTANT ('auto' → 'light'), not a state machine | ✗ HOLLOW (interaction, not render, but same failure class — the click handler has no memory) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check clean | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| Dashboard test suite green | `npx vitest run src/dashboard` | 30 files, 896/896 passed | ✓ PASS |
| `nav.ts`'s theme toggle holds no in-memory mode (CR-01) | direct read of `nav.ts:210-215` | `readStoredMode(resolveStorage())` called fresh inside the handler, no module/closure-level mode variable | ✗ CONFIRMS GAP |
| `.calendar-grid`/`.calendar-day`/`.calendar-week-total` unconditional rules outside 380px (CR-02) | direct read of `styles.css:743`, `:766-769`, `:825-833`; grep for all `@media` blocks in the file | `repeat(7, 1fr) auto`, `min-width: 32px`, `white-space: nowrap` all unconditional; no other block overrides them between 381px and 1000px | ✗ CONFIRMS GAP |
| `theme.ts`'s `storage: null` override is honored, not discarded (WR-01) | direct read of `theme.ts:108`, `:145`; `vitest.config.ts` | `resolveStorage(options.storage ?? undefined)` discards an explicit `null`; `environment: 'node'` (no setup file sets `globalThis.localStorage`) is why the tests pass anyway | ✗ CONFIRMS GAP |
| No debt markers in phase-touched files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across styles.css, nav.ts, theme.ts, storage.ts, main.ts, calendar.ts, calendar-preferences.ts | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CAL-01 | 22-01..22-05, 22-07, 22-08, 22-10, 22-11, 22-12 | User can choose Sunday/Monday week start; choice persists | ✓ SATISFIED (with disclosed evidence-quality caveat on R23) | Week-start read/write path unchanged in substance by the Round 3 storage refactor, confirmed by source read; R7 (Round 1, fully observed), R20 (Round 3 regression check, fully observed) both support it. R23's week-start half is thin. Judged sufficient on the totality of evidence, not on R23 alone. |
| CAL-02 | 22-01, 22-02, 22-03, 22-05, 22-06, 22-08, 22-09, 22-12 | Week totals computed and shown, respecting selected week start, legible at every viewport | ✗ BLOCKED (reopened) | REQUIREMENTS.md's Round 3 tick relies on R19's single-width (375px) observation and the plan's own deliberate 380px-only fix scope. The requirement's "every viewport" language and the roadmap's SC3 wording are not satisfied above 380px — confirmed by source read that the identical defect-causing CSS rules remain unconditional at 381px+. This verification reopens the requirement. |
| CAL-03 | 22-02, 22-04, 22-05, 22-06 | Calendar controls use shared Phase 19 styling | ✓ SATISFIED | Unchanged since prior verification; R21 (Round 3, confirm-unregressed, non-gating) adds no new information but no regression either. |

No orphaned requirements: `REQUIREMENTS.md`'s Phase 22 table lists exactly CAL-01/02/03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/nav.ts` | 210-215 | Theme toggle click handler holds no in-memory mode; re-derives from storage every click | 🛑 Blocker (new — CR-01) | Under any null/unusable storage handle (blocked site data, Safari private mode), the toggle is permanently stuck on "light"; dark and auto are unreachable. Newly reachable because of this phase's own BL-03 fix. |
| `src/dashboard/styles.css` | 743, 766-769, 825-833 | 380px-scoped fix leaves the identical overflow-causing rules unconditional at 381px+ | 🛑 Blocker (reopened — CR-02) | Ordinary phone viewports (390/393/412px) are structurally exposed to the same overflow class R11/R13 failed on; never tested by any checkpoint row. |
| `src/dashboard/theme.ts` | 108, 145 | `resolveStorage(options.storage ?? undefined)` silently discards an explicit `storage: null` override | ⚠️ Warning (WR-01, confirmed) | Makes three of the new BL-03 tests in `theme.test.ts` vacuous passes of the wrong code path (the "absent global" path, not the "explicit null override" path); this only surfaces as harmless today because `vitest.config.ts` runs `environment: 'node'` with no `globalThis.localStorage` set up anywhere. |
| `src/dashboard/storage.test.ts` | ~143-162 | Repo-wide BL-03 invariant guard has escape hatches (`!f.endsWith('storage.ts')` exempts any similarly-named file; comment-stripping regex can erase content inside string literals; non-portable path handling) | ℹ️ Info (WR-03, code review; not independently re-verified line-by-line here, but plausible from the described pattern and consistent with this file's other regex-based guards) | Lower confidence than the BL-01/BL-02/CR-01 findings, which were directly read; flagged for awareness, not scored as a gap. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers found in any phase-touched file.

### Human Verification Required

See frontmatter `human_verification`. Two items:

1. **A stated width strictly between 380px and ~530px** (e.g. 390px or 412px), reading back day-cell and week-total values, to confirm or refute CR-02's estimated overflow band directly rather than by CSS arithmetic alone.
2. **Clicking the theme toggle under blocked site data**, to directly observe CR-01's predicted stuck-on-light behavior (or refute it, if some other code path compensates that this verification's source read missed).

### Gaps Summary

Two concrete, source-confirmed gaps block the phase from a clean close:

1. **CAL-02/SC3 is not actually achieved at every viewport the app is expected to render at (reopened).** Round 3's own plan (22-09) deliberately scoped the overflow fix to `@media (max-width: 380px)` and explicitly said so in its own must-haves. That scoping decision leaves the identical defect class — a `nowrap`/fixed-min-width content floor on the grid's tracks — fully intact and unconditional from 381px through at least 1000px, confirmed by direct read of the current `styles.css`. No checkpoint row in any of the three rounds observed a width in that band; R19 (the row that closed this gap in `22-VALIDATION.md`) is explicit that it observed 375px only. Ordinary phone widths (390px, 393px, 412px) fall squarely inside the untested, structurally-still-broken band. This is not a hypothetical — it follows directly from reading the same CSS rules that caused the original R11/R13 failures, still present and unconditional one pixel above where they were patched.

2. **A new Critical regression this phase's own fix introduced (CR-01).** The header theme toggle is permanently stuck on "light" whenever the storage handle is null or unusable — exactly the blocked-site-data browser configuration this round's BL-03 fix was built and checkpointed for, plus the pre-existing Safari-private-mode case. This is newly reachable specifically because Round 3 stopped the same configuration from crashing the page blank; the trade was a working page with a broken control, not a working page with a working control. R22's checkpoint row never clicked the toggle under blocked storage, so this escaped detection this round.

A secondary, lower-severity finding (WR-01, `theme.test.ts`'s vacuous null-override tests) is recorded as a Warning, not a blocking gap, but is flagged because it means some of Round 3's own test evidence for BL-03 is weaker than its `theme.test.ts` filenames and descriptions suggest.

Neither gap is addressed by any later phase in the roadmap (Phases 23-25 cover Trends zoom/pan, local curation mode, and CI hardening — none touch Calendar CSS breakpoints or the dashboard-wide theme toggle).

**Genuinely and durably closed this round, confirmed independently:** the literal `main.ts:19` module-scope crash under blocked site data (the actual Round 2 Gap 2, as narrowly stated) — closed by the app-wide `resolveStorage()` wiring and confirmed both by source read and by R22's real-browser PASS. `buildMonthGrid`'s off-union `weekStart` totality and the narrow calendar-scoped throwing-getter guard both remain correctly closed, unchanged from Round 2. `npx tsc --noEmit` is clean and the dashboard test suite (896 tests across 30 files) is green.

---

_Verified: 2026-08-19T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
