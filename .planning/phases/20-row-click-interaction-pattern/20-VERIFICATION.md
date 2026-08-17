---
phase: 20-row-click-interaction-pattern
verified: 2026-08-17T22:10:00Z
status: gaps_found
score: 1/4 must-haves cleanly verified (2 partial, 1 newly-blocked)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "The row-click BLOCKER (row-navigation.ts:58-67 ignoring mouse button/modifiers/text-selection) is genuinely fixed. shouldNavigateOnRowClick (row-navigation.ts:103-117) implements all four refusal classes in the documented order; attachRowNavigation (:127-142) builds the RowClickContext from event.button/metaKey/ctrlKey/shiftKey/altKey/closest('a')/window.getSelection() and gates navigateTo on the predicate. Confirmed independently by direct source read (not taken on 20-09-SUMMARY.md's word), by 21 passing unit tests, and by real-browser evidence: R21 (drag-select survives) PASS, and the current-tab-not-hijacked half of R18/R19 PASS."
    - "SC4's evidence-quality problem (Round 1 and Round 2's blanket 'all pass' answers) is closed for the first time in this phase's history. Round 3 of 20-VALIDATION.md carries 18 individually-described rows, each with a mechanically-enforced Required-detail predicate, not a blanket statement — a first since the checkpoint agenda opened at Round 1."
  gaps_remaining:
    - "R18/R19 (D-12's own checkpoint rows) are recorded FAIL against their stated expectation: a modified click on the five anchor-less Records PR-table cells (Rank, Time, Pace, Age-Grade, Flags) no longer hijacks the current tab (fixed), but it also does not open a new background tab or window (not fixed) because those cells carry no <a> for the browser to act on. REQUIREMENTS.md keeps UX-01/UX-03 open specifically citing this. The developer's own checkpoint disposition was 'record as FAIL, defer to the next planning round' — not acceptance that the gap is closed."
  regressions:
    - "NEW CRITICAL (found by the fresh 20-REVIEW.md and independently confirmed here by direct source read, not present in the prior verification round's scope): list.ts:1112-1131's applyReturnHighlight is the only writer that clears notedActivityId, and mount() reaches it from exactly one of three render branches (list.ts:1322-1324). The zero-match branch (:1293-1299), the load-failure branch (:1239-1259) and the stale-container branch (:1322) all skip the call, so notedActivityId survives an unrelated navigation and a later render steals focus and scrolls the page for a row the user never returned from. This is a regression in the exact keyboard-focus mechanism this phase built (plan 20-06's CR-01 fix) to satisfy SC3's 'keyboard-operable ... correct' requirement, and it is untouched by the 20-09/20-10/20-11 gap-closure round (git diff confirms list.ts is byte-identical to the prior round) and unexercised by any of the 21 Round 3 checkpoint rows."
gaps:
  - truth: "Row-level navigation is keyboard-operable and behaves correctly for assistive tech and keyboard users — not a click handler with unpredictable focus side effects"
    status: failed
    reason: "A confirmed, unaddressed regression in list.ts's return-highlight mechanism (the exact code this phase's plan 20-06 built to satisfy SC3's focus-restoration requirement): notedActivityId is only cleared inside applyReturnHighlight, which mount() calls from exactly one of three render branches. Visiting any activity detail sets notedActivityId (detail.ts:665, unconditional on every detail mount). If the next #/list render takes the zero-match, load-error, or stale-container path, the id survives; the following normal render then highlights, scrollIntoView-centers, and FOCUSES a row the user never actually returned from. Confirmed directly at list.ts:1112-1131 (the single clearing call site) and list.ts:1239-1259/1293-1299/1322-1325 (the three paths that skip it). Unexpected focus movement on an unrelated navigation is a WCAG 3.2.x class defect, not cosmetic. No Round 3 checkpoint row exercises this sequence (empty-filter-or-error render, then a later non-empty render), so it was not caught by 21 rows of otherwise-genuine browser evidence."
    artifacts:
      - path: "src/dashboard/views/list.ts"
        issue: "applyReturnHighlight (1112-1131) is the sole clearer of notedActivityId; mount()'s zero-match (1293-1299), load-error (1239-1259) and stale-container (1322) branches all bypass it, so the one-shot return hint leaks into unrelated future navigations."
    missing:
      - "Make the notedActivityId read-and-clear unconditional and early in mount(), independent of which render branch runs (20-REVIEW.md's CR-01 drafts a concrete takeNotedActivityId() patch)."
      - "A regression test driving noteViewedActivity('X') through the empty-filter path, then asserting a subsequent non-empty render does not highlight/focus row X."
  - truth: "Row-level click navigation honours the browser's native link contract (modifier-click opens in new tab/window, middle-click, drag-select-to-copy do not hijack navigation) on every row where the row itself is the sole clickable affordance — propagating list.ts's real-<a href> pattern rather than a lesser substitute"
    status: failed
    reason: "The prior round's genuine BLOCKER (a modified click hijacking the current tab) is fixed and independently confirmed in source, in 21 passing unit tests, and in real-browser evidence (R21 PASS on drag-select; the current-tab-not-hijacked half of R18/R19 PASS). But the row's remaining half is unmet: 20-VALIDATION.md Round 3 records R18 and R19 as FAIL against their own stated expectation — a Cmd/Ctrl+click on an anchor-less Records PR-table cell (Rank, Time, Pace, Age-Grade, Flags) does not open a new background tab, and a Shift+click does not open a new window, because those five cells carry no <a> for the browser's own gesture handling to act on. This is the phase's own goal text failing on its own terms: 'using list.ts's existing pattern' means a real <a href>, which honours these gestures natively; a row-click-only substitute that merely fails safe is not that pattern. D-12 records this as a deliberate, developer-accepted scope decision (deferred to Phase 21's activity-name join), and the developer explicitly accepted D-12 at the checkpoint — but the developer's own recorded disposition on R18/R19 specifically was to record them as FAIL and defer the decision to the next planning round, not to accept the gap as closed. REQUIREMENTS.md UX-01 and UX-03 both stay open citing exactly this. Separately, 20-REVIEW.md's WR-05 (independently confirmed in source: row-navigation.ts's RowClickContext has no clickCount field) means the first click of a double-click on one of those same five cells still navigates away before the word-select completes — a narrower, not-yet-decided edge case in the same guard."
    artifacts:
      - path: "src/dashboard/views/records.ts"
        issue: "Five of six PR-table cells (Rank, Time, Pace, Age-Grade, Flags) carry no <a>; only the Date cell does (confirmed records.ts:396-419, 512-521). Row-click is the sole affordance on the other five."
      - path: "src/dashboard/row-navigation.ts"
        issue: "shouldNavigateOnRowClick has no clickCount field, so a double-click's first click (collapsed selection) passes every guard and navigates before the word-select the user intended can happen (WR-05)."
    missing:
      - "A decision (from the developer, per the Round 3 checkpoint's own disposition) on whether the five anchor-less Records PR-table cells become real <a> elements (needs Phase 21's D-05 activity-name join) or whether R18/R19's stated expectation is revised to match D-12's narrower scope."
      - "A decision on the double-click case (WR-05): refuse navigation when event.detail > 1, or record the gap explicitly in D-12 the way auxclick already is."
  - truth: "Human checkpoint (roadmap SC4) confirms consistent focus order, correct click targets and screen-reader announcement across Overview and Records, both themes"
    status: partial
    reason: "Genuinely different from the prior two rounds: 20-VALIDATION.md Round 3 carries 18 individually-described rows for the first time, most with a mechanically-enforced Required-detail predicate (quoted VoiceOver announcements for R15/R17, distinct activity ids for R11, both theme names for the seven theme-sensitive rows, etc.) rather than a blanket 'all pass'. 13 rows PASS cleanly, plus R5/R6/R13 carried forward from Round 2 as genuine passes — 16 of 21 rows resolved. But the round's own frontmatter records status: partial and nyquist_compliant: false, and that is accurate on its own terms: R18/R19 FAIL (see the link-contract gap above), R2/R16 are BLOCKED (not a defect — no badge-carrying row exists in the current Overview Recent Activities dataset to quote, a data-coverage gap not a behavioral one), and R20 is NOT EXERCISABLE (no middle button on the developer's trackpad or the agent's tooling). Separately worth weighing explicitly, as instructed: most Round 3 rows were 'observed by agent (browser automation against the staged build)' rather than by the developer's own eyes — real clicks, real Tab/Enter/Space presses, real drag-selects and computed-style reads against the live build, which is genuine observation of the rendered artifact and materially stronger than any repo test, but it is not identical to a human's own perceptual judgment, particularly for the two rows whose claims are inherently about legibility/appearance rather than mechanics (R9's color legibility, R7's hover paint) — those were settled by computed-style/selector-structure reads, not by a human looking at the screen. This is not scored as a failure; it is recorded as a caveat on the evidence's character, per the instruction not to silently treat agent observation as equivalent to developer observation."
    artifacts:
      - path: ".planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md"
        issue: "Round 3 frontmatter: status: partial, nyquist_compliant: false; 2 FAIL (R18, R19), 2 BLOCKED (R2, R16, dataset-coverage), 1 NOT EXERCISABLE (R20, hardware)."
    missing:
      - "R18/R19's disposition (see the link-contract gap above) — the same gap blocks both this truth and SC1."
      - "A badge-carrying fixture row in Overview Recent Activities, so R2/R16 can be re-asked meaningfully (dataset gap, not implementation work)."
      - "Middle-button hardware or an auxclick-capable automation tool, so R20 can actually be observed (D-12's disposition question was already answered — accepted — independent of this)."
deferred: []
human_verification: []
---

# Phase 20: Row-Click Interaction Pattern Verification Report

**Phase Goal:** Every row representing an activity, on every screen, is clickable through to that activity using the same pattern `list.ts` already established — propagated, not reinvented — and is keyboard-accessible rather than a click handler on a bare `<div>`.
**Verified:** 2026-08-17T22:10:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure round 3 (plans 20-09, 20-10, 20-11)

## Summary

This is the third verification pass on Phase 20. The prior round scored 2/4 and named two blockers: an unguarded row-click listener (`row-navigation.ts:58-67`) that hijacked the current tab on any modified click, and SC4's human checkpoint being undischarged on its own recorded evidence (13 of 17 rows FAIL for insufficient evidence, behind a blanket "all pass").

Both of those specific problems are genuinely fixed, and neither claim is taken on trust:

- **The modifier-click BLOCKER is closed.** `shouldNavigateOnRowClick` (`row-navigation.ts:103-117`) now refuses navigation for a non-primary button, any of meta/ctrl/shift/alt, or an active text selection, in that order, with `closest('a')` unchanged and first. Confirmed by direct source read, by 21 passing unit tests (`npx vitest run src/dashboard/row-navigation.test.ts`), and by real-browser evidence in Round 3 of `20-VALIDATION.md`: R21 (drag-select survives) is a clean PASS, and the "current tab does not get hijacked" half of both R18 and R19 is confirmed PASS.
- **SC4's evidence-quality problem is closed for the first time in this phase's three-round history.** Round 3 carries 18 individually-described rows, most with a mechanically-enforced "Required detail" predicate that makes a blanket answer structurally impossible (quoted VoiceOver announcements, distinct activity ids, both theme names, etc.). 16 of 21 rows (13 fresh PASSes plus R5/R6/R13 carried forward) are genuine, individually-evidenced passes — a first for this validation record.

But the phase goal is still not achieved, for two independent reasons, one of them newly found by this verification pass rather than carried over from the prior round:

1. **A newly-confirmed CRITICAL regression in `list.ts`'s return-highlight mechanism** — the exact code this phase built (plan 20-06) to satisfy "keyboard-operable ... correctly." `notedActivityId` is cleared only inside `applyReturnHighlight`, which `mount()` reaches from exactly one of three render branches; the zero-match, load-error and stale-container branches all skip it, so the one-shot return hint leaks into a later, entirely unrelated navigation and silently steals focus and scrolls the page. Confirmed directly at `list.ts:1112-1131` and the three bypass sites. This file is byte-identical to the prior verification round (untouched by plans 20-09/20-10/20-11), and none of Round 3's 21 checkpoint rows exercises the sequence that triggers it, so it was invisible to both this phase's own checkpoint and the prior verification pass.
2. **SC1's own literal wording — "using `list.ts`'s existing pattern" — is not fully true**, and this is recorded honestly by the project's own artifacts, not manufactured here. Round 3's R18 and R19 are FAIL against their stated expectation: a modified click on the five anchor-less Records PR-table cells no longer hijacks the current tab (fixed), but it also does not open a new background tab or window (not fixed), because those cells carry no `<a>` for the browser to act on. This is a decision-documented, developer-accepted scope boundary (D-12, deferred to Phase 21's activity-name join) — but the developer's own recorded disposition on R18/R19 specifically was "record as FAIL, defer to the next planning round," not "accept as closed." `REQUIREMENTS.md` keeps UX-01 and UX-03 open citing exactly this.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — every activity row on Overview and Records navigates to that activity's detail view on click, using `list.ts`'s established pattern | ⚠️ PARTIAL | Plain click navigates to the correct activity everywhere, extensively confirmed in real Round 3 browser evidence (R1/R3/R4/R11/R12/R14 PASS with named activity ids). The prior BLOCKER (modifier-click hijacking the current tab) is fixed and independently confirmed. But R18/R19 are recorded FAIL: the five anchor-less Records PR-table cells do not open a new tab/window on a modified click, so they do not fully replicate `list.ts`'s real-`<a href>` pattern — the literal clause the roadmap goal names. `REQUIREMENTS.md` UX-01 stays open citing this. |
| 2 | SC2 — redundant "View Activity" CTA buttons removed from Records and everywhere the row itself is now the affordance | ✓ VERIFIED | `grep -rn "View Activity" src/dashboard/` returns zero live occurrences (only a pinning test assertion and code comments). Confirmed independently in Round 3 browser evidence: R2 (CTA absence confirmed both themes, dataset-coverage BLOCKED only on the separate badge-text detail) and R4 (clean PASS). |
| 3 | SC3 — row-level navigation is keyboard-operable and announced correctly to assistive tech via real link/button semantics | ✗ FAILED | Most of this truth is genuinely, independently verified: R1/R3/R4/R7/R8/R9/R10/R13/R14 PASS in real browser evidence, and R15/R17 PASS with the VoiceOver announcement quoted verbatim, closing CR-02's last unconfirmed link. But a newly-confirmed, unaddressed regression in the return-highlight mechanism (`list.ts:1112-1131`) means keyboard focus can be silently stolen and the page scrolled on a navigation that has nothing to do with returning from a detail view — a WCAG 3.2.x class defect in the exact mechanism this phase built for this truth. Confirmed by direct source read; not caught by any of the 21 Round 3 checkpoint rows, none of which exercises the triggering sequence. |
| 4 | SC4 — human checkpoint under `/strava-widgets`, keyboard-only tab-through of Overview and Records, consistent focus order, correct click targets, both themes | ⚠️ PARTIAL | `20-VALIDATION.md` Round 3 frontmatter: `status: partial`, `nyquist_compliant: false` — accurate on its own terms. 16 of 21 rows are genuine, individually-evidenced passes (a first for this phase), but 2 FAIL (R18/R19), 2 are BLOCKED on a dataset-coverage gap (R2/R16, not a defect), and 1 is NOT EXERCISABLE on a hardware limitation (R20). Most rows were observed by the orchestrator driving real browser automation against the live staged build rather than by the developer's own eyes — genuine observation of the rendered artifact, stronger than any repo test, but explicitly not equivalent to a human's own perceptual judgment for the two rows whose claims are inherently about appearance (R7 hover paint, R9 color legibility), which were settled by computed-style reads rather than a human looking at the screen. |

**Score:** 1/4 truths cleanly verified (SC2). SC1 and SC4 are genuinely improved from the prior round but remain partial on the project's own recorded evidence. SC3 is newly FAILED on a regression this verification pass found and confirmed, independent of anything the gap-closure plans targeted.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/row-navigation.ts` | `attachRowNavigation` honours the browser's link contract (button/modifier/selection guards) | ✓ VERIFIED | `shouldNavigateOnRowClick` (103-117) implements all four refusal classes in order; `attachRowNavigation` (127-142) builds the context and delegates. 21/21 tests pass. Confirmed by direct read, not taken on the summary's word. |
| `src/dashboard/row-navigation.test.ts` | Behavioral + wiring coverage of the link-contract predicate | ✓ VERIFIED | 21 tests: 2 baseline, 7 single-guard, 1 anti-over-blocking table case, plus wiring assertions (delegation count, field reads, `closest('a')` count, `auxclick` zero-count). All pass. |
| `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md` | D-12 recorded: guards + explicit auxclick out-of-scope decision | ✓ VERIFIED | D-12 present between D-02 and D-03, states all four refusal conditions, the auxclick disposition with three named reasons, and a Deferred Ideas entry pointing at Phase 21/D-05. |
| `src/dashboard/row-semantics.test.ts` | D-01 guard spelling-agnostic across `tabIndex`/`tabindex`/`role` forms | ⚠️ VERIFIED WITH NARROWER GUARD GAP | `rowSemanticViolations` catches all four spellings on the receiver/value axis WR-02 flagged (confirmed: `row.tabIndex = -1` now correctly flagged). But `isAllowedRoleValue` (`:140`) is still value-keyed — only `role="link"` is rejected, so `role="presentation"` or `role="button"` on a `<tr>` (which removes it from the table a11y tree just as effectively) still passes undetected (fresh review's WR-01, confirmed here by direct read: `value.toLowerCase() !== 'link'`). No runtime code currently does this — a test-guard gap, not a shipped defect. |
| `src/dashboard/styles.test.ts` | All Phase 20 CSS assertions read the cascade winner, not the first match | ⚠️ PARTIALLY VERIFIED | 4 of 7 Phase 20 assertions now use `cascadeWinningBodyDeclaring`/`bodyForSelectorListToken` (last-wins), confirmed by direct read. 3 remain on `selectorListDeclares` (any-rule-wins) at `styles.test.ts:1263/1267/1292` — confirmed present by direct grep, matching the fresh review's WR-02 finding exactly. A later override to those three rules (`a { color: inherit }`, `a { text-decoration: underline }`, `.activity-row { text-decoration: none }`) would still ship silently regressed. Additionally, the new last-wins helpers are structurally blind to `@media`-scoped overrides (WR-03) — not independently re-verified by mutation here, but the code path (`isAtRuleScoped` skip) matches the review's description. |
| `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` | Round 3: 18-row checkpoint, one named verdict + required detail per row | ✓ VERIFIED (as a record) | 18 rows present, each with an `R3-VERDICT` token and a distinct, non-blanket observation. Rounds 1 and 2 preserved unedited above it (confirmed: 34 pre-Round-3 verdict tokens, 22 `R2-VERDICT` occurrences). The record itself is honest about what it does and does not discharge — `status: partial`, `nyquist_compliant: false`. |
| `.planning/REQUIREMENTS.md` | UX-01/UX-02/UX-03/REC-08 status reflects actual verification state | ✓ VERIFIED | REC-08 correctly ticked. UX-01/UX-02/UX-03 correctly left `[ ] Pending`, each with a per-requirement note naming exactly which Round 3 rows still block it (R18/R19 for UX-01/UX-03; R2's dataset-coverage BLOCKED for UX-02) — matches `20-VALIDATION.md` Round 3 precisely; nothing was prematurely closed. |
| `src/dashboard/views/list.ts` | `renderActivityRow`, `highlightAndFocus`, `applyReturnHighlight` correctly manage row focus | ✗ REGRESSION | Byte-identical to the prior verification round (confirmed by `git diff cacc416..HEAD -- src/`, matching `20-REVIEW.md`'s own statement). `applyReturnHighlight`'s one-shot clear is reachable from only one of three `mount()` render branches — see Gaps. This is a shipped defect in a file this phase is responsible for, not a guard-layer gap. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `row-navigation.ts` `attachRowNavigation` | `shouldNavigateOnRowClick` | click listener builds `RowClickContext`, delegates the decision | ✓ WIRED | Confirmed: `shouldNavigateOnRowClick(` occurs exactly twice (definition + one call site); all seven context fields are read from the event/selection. |
| `records.ts` five of six PR-table cells | `attachRowNavigation`'s click listener | row-level click, no descendant anchor | ⚠️ WIRED, PARTIALLY LINK-LIKE | Navigates correctly and safely (no hijack) on a modified click; does not open a new tab/window on one, because there is no anchor to act on. Confirmed at `records.ts:396-419`, `512-521` (only `dateTd` gets an anchor in each table). |
| `detail.ts` `noteViewedActivity` | `list.ts` `applyReturnHighlight` / `highlightAndFocus` | one-shot module state (`notedActivityId`) | ✗ LEAKS ACROSS UNRELATED NAVIGATIONS | `detail.ts:665` sets the id on every detail mount, unconditionally. `list.ts` only clears it inside `applyReturnHighlight`, which `mount()` calls from exactly one of three render branches — see Gaps. The link is correctly wired for the happy path and incorrectly wired (fails to reset) for the other three. |
| `list.ts`/`overview.ts` badge text | the row's `aria-label` | `composeRowAriaLabel(base, statusBadgeTexts(row))` / `recentPrRowAriaLabel` | ✓ WIRED, NOW REAL-WORLD CONFIRMED | Confirmed by direct read (unchanged since the prior round) and, newly, by real VoiceOver evidence: R15 (`"Morning Run, May 25, 2026, 7.0 km, No streams (no-original)"`) and R17 (`"Lunch Run, Sep 18, 2022, 21.3 km, 3 PR"`) both quote the announced string verbatim, closing the last unconfirmed link in CR-02's fix. |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — no fetched/computed data source feeds these rows beyond the already-loaded `DashboardIndexRow`/`PrTableRow` objects, unchanged by this phase.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `shouldNavigateOnRowClick` implements all four D-12 refusal classes in order | `sed -n '103,117p' src/dashboard/row-navigation.ts` | `insideAnchor` → `button !== 0` → modifier keys → `hasTextSelection`, each its own early return | ✓ PASS |
| `attachRowNavigation` builds the context from the real event/selection and delegates | `sed -n '125,143p' src/dashboard/row-navigation.ts` | All seven fields populated from `event`/`window.getSelection()`; `if (!shouldNavigateOnRowClick(context)) return;` before `navigateTo` | ✓ PASS |
| `notedActivityId` is cleared unconditionally on every `#/list` render | grep `notedActivityId = null` call sites vs. `mount()`'s three early-return branches | Only cleared inside `applyReturnHighlight`, reached from one of three branches | ✗ FAIL (new CRITICAL) |
| Three of seven Phase 20 CSS assertions still use `selectorListDeclares` (any-rule-wins) | `grep -n "selectorListDeclares(" src/dashboard/styles.test.ts` around 1263/1267/1292 | Confirmed present | ✗ FAIL (WARNING, guard-layer only) |
| D-01 role guard is value-keyed, not receiver-keyed | `grep -n "isAllowedRoleValue" src/dashboard/row-semantics.test.ts` | `value.toLowerCase() !== 'link'` — any non-`link` role value on any receiver passes | ✗ FAIL (WARNING, guard-layer only) |
| `RowClickContext` has no `clickCount`/`detail` field (WR-05, double-click) | `grep -n "clickCount\|event.detail" src/dashboard/row-navigation.ts` | Not present | ✗ FAIL (WARNING, narrow UX edge case) |
| "View Activity" CTA text absent from all three modified view files | `grep -rn "View Activity" src/dashboard/` | Zero live occurrences | ✓ PASS |
| Full automated suite green | `npm test` | 1022/1022 passed, 49/49 files | ✓ PASS (does not detect the focus-leak regression or R18/R19's gap — this repo has no DOM/browser test environment, stated explicitly in the module's own header) |
| Typecheck clean | `npx tsc --noEmit -p tsconfig.json` | Zero diagnostics | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` shell probes exist for this phase; its verification mechanism is `20-VALIDATION.md`'s manual/agent-assisted browser checkpoint, not a re-executable script.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-01 | 20-01, 20-02, 20-03, 20-05, 20-06, 20-08, 20-09, 20-11 | Every activity row clickable through to that activity, on every screen | ✗ BLOCKED | Plain click works everywhere and lands on the correct activity (extensively confirmed, Round 3). The prior modifier-click hijack BLOCKER is fixed. But R18/R19 FAIL against their own stated expectation on the Records PR table's anchor-less cells, and the new focus-leak regression also bears on this requirement's "clickable through to that activity" framing (a stolen-focus row is not the row the user clicked). `REQUIREMENTS.md`'s `[ ] Pending` is correct. |
| UX-02 | 20-02, 20-03, 20-04, 20-05, 20-08, 20-11 | Redundant "View Activity" CTAs removed | ✗ BLOCKED (checkpoint gating only) / source removal complete | Source removal is complete and grep-confirmed. `REQUIREMENTS.md` correctly leaves it open only because R2 (one of four mapped rows) is BLOCKED on a dataset-coverage gap, not a defect — a conservative, correct reading per the plan's own "every mapped row must pass" gate. |
| UX-03 | 20-01, 20-02, 20-04, 20-05, 20-07, 20-08, 20-09, 20-10, 20-11 | Keyboard-accessible and announced correctly, not a bare `<div>` handler | ✗ BLOCKED | CR-02 is now genuinely confirmed in a real screen reader (R15/R17 PASS with quoted announcements) — real, new-this-round progress. But this verification independently found a fresh, unaddressed keyboard-focus regression (`list.ts`'s stale `notedActivityId`) that directly contradicts "keyboard-accessible ... correctly," plus R18/R19's FAIL and WR-05's double-click gap. `REQUIREMENTS.md`'s `[ ] Pending` is correct and, if anything, understates the newly-found regression since it predates this verification pass. |
| REC-08 | 20-03, 20-05, 20-08 | Records rows navigate on row click rather than via a large button | ✓ SATISFIED | Unaffected by any of this round's findings — both mapped rows (R5, R6) are genuine passes carried forward from Round 2, re-confirmed present and unedited. Correctly ticked in `REQUIREMENTS.md`. |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 20 rows are exactly UX-01, UX-02, UX-03, REC-08, matching the plans' `requirements`/`requirements-completed` frontmatter across the phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/views/list.ts` | 1112-1131, 1239-1259, 1293-1299, 1322-1325 | NEW CRITICAL — `notedActivityId`'s one-shot clear is reachable from only one of three `mount()` render branches | 🛑 BLOCKER | A stale return-highlight steals keyboard focus and scrolls the page on a navigation unrelated to any detail-view return, on every breakpoint since plan 20-06 fixed the card-shape branch of `highlightAndFocus`. WCAG 3.2.x class defect. Untouched by this gap-closure round; unexercised by any Round 3 checkpoint row. |
| `src/dashboard/views/records.ts` / `src/dashboard/row-navigation.ts` | records.ts:396-419,512-521; row-navigation.ts (whole file) | Five of six PR-table cells remain row-click-only, not real anchors, so a modified click cannot open a new tab/window the way `list.ts`'s pattern does | ⚠️ WARNING (decision-documented, developer-accepted as D-12, but recorded FAIL at the checkpoint and deferred, not closed) | R18/R19 FAIL. `REQUIREMENTS.md` UX-01/UX-03 stay open citing this. |
| `src/dashboard/row-navigation.ts` | 80-117 | `RowClickContext` has no field distinguishing a double-click's first click (WR-05) | ⚠️ WARNING | The first click of a double-click on an anchor-less Records cell navigates away before the intended word-selection completes. Narrow edge case, not decision-recorded either way. |
| `src/dashboard/styles.test.ts` | 1263, 1267, 1292 | 3 of 7 Phase 20 CSS assertions still use any-rule-wins `selectorListDeclares` instead of the cascade-winner helper | ⚠️ WARNING | A later cascade-winning override to the bare `a` color/text-decoration rule or `.activity-row`'s `text-decoration: none` would ship silently regressed. |
| `src/dashboard/row-semantics.test.ts` | 140 | D-01 role guard (`isAllowedRoleValue`) is keyed on the value `link`, not on the receiver, so `role="presentation"`/`role="button"` on a `<tr>` passes undetected | ⚠️ WARNING | Guard-layer only; no runtime code currently exercises this, but the invariant D-01 exists to protect (a `<tr>` never gets a `role` at all) is narrower than what the guard actually checks. |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in the phase's files.

## Human Verification Required

None newly required beyond what `20-VALIDATION.md` Round 3 already attempted. The next actionable step is not another checkpoint round — it is (a) fixing the newly-found focus-leak regression in `list.ts`, which is a genuine code defect independent of any checkpoint, and (b) a developer decision on R18/R19's disposition (real anchors on the five Records cells vs. revising the row's stated expectation to match D-12's narrower scope), which the developer already began at the Round 3 checkpoint by accepting D-12 in general but declining to accept R18/R19 specifically as closed.

## Gaps Summary

Two independent problems keep this phase's goal from being fully achieved, even though real, substantial and independently-confirmed progress was made this round:

1. **A newly-found CRITICAL regression** in `list.ts`'s return-highlight mechanism (`applyReturnHighlight`/`notedActivityId`) steals keyboard focus and scrolls the page on navigations unrelated to any detail-view return. This is a defect in the exact code this phase built to satisfy its own keyboard-accessibility success criterion, confirmed by direct source read, untouched by the 20-09/20-10/20-11 gap-closure round, and unexercised by any of the 21 Round 3 checkpoint rows.
2. **SC1's literal wording is not fully true.** The genuinely dangerous half of the prior BLOCKER (modifier-click hijacking the current tab) is fixed and well-evidenced. The remaining half — five of six Records PR-table cells not being real links, so a modified click cannot open a new tab/window — is recorded FAIL against its own stated expectation at the Round 3 checkpoint, with the developer's own disposition being to defer the decision, not accept the gap as closed.

Both are recorded honestly in the project's own artifacts (`20-REVIEW.md`, `20-VALIDATION.md` Round 3, `REQUIREMENTS.md`) — this verification independently confirmed each against source and did not take any of the three at their word.

**Recommended path:** a small follow-up plan fixing the `notedActivityId` leak (the patch is already drafted in `20-REVIEW.md`'s Critical Issues section) plus a regression test for the empty-filter-then-render sequence; separately, a developer decision on R18/R19's disposition before the next checkpoint round is opened. The three WARNING-severity guard-layer gaps (role allowlist, 3 remaining any-rule-wins CSS assertions, no double-click field) do not block the phase goal today but should be closed alongside, since all three were touched by this same phase's own work.

---

_Verified: 2026-08-17T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
