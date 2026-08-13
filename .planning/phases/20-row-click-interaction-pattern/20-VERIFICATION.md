---
phase: 20-row-click-interaction-pattern
verified: 2026-08-13T22:25:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "CR-01: highlightAndFocus now resolves the correct focus target for both row shapes (card <a> and <tr>); D-08 return-from-detail focus restoration works on mobile — confirmed in source (list.ts:1097-1101) and independently re-verified by 20-REVIEW.md's fresh mutation-informed read, and re-confirmed on real browser evidence at R13 (keyboard-back) in 20-VALIDATION.md Round 2."
    - "CR-02: status-badge text (No streams/No HR, Low confidence, Excluded from records, N PR) is now folded into the row's aria-label on all three previously-affected surfaces (Activities mobile card, Overview Recent Activities, Overview Recent PRs) — confirmed in source and independently re-traced call-site-by-call-site by 20-REVIEW.md. records.ts confirmed unaffected/unaffected-by-design."
  gaps_remaining:
    - "SC4 (human checkpoint) still not discharged: 20-VALIDATION.md Round 2 records status: partial, nyquist_compliant: false. Only 4 of 17 rows carry genuine individual evidence (R5, R6, R13 in full; R10 on substance only). 13 rows (R1-R4, R7-R9, R11, R12, R14-R17) are recorded FAIL for insufficient evidence — a blanket 'all pass' / 'all good' was offered instead of per-row observation."
    - "R15/R16/R17 specifically — the rows built to confirm CR-02 in a real screen reader — remain unobserved. CR-02's failure mode was badge text being SILENTLY dropped from the accessible name, so an unrecorded 'yes' is indistinguishable from the defect still being present. CR-02's fix is source-verified but not screen-reader-verified."
  regressions:
    - "NEW BLOCKER (not present in the prior verification round, found by 20-REVIEW.md and independently confirmed here): row-navigation.ts:58-67's attachRowNavigation ignores mouse button, modifier keys (Cmd/Ctrl/Shift/Alt) and active text selection. Cmd/Ctrl+click, Shift+click and Alt+click all navigate in the current tab instead of respecting the browser's link contract; middle-click (auxclick) does nothing on any row-only cell; drag-selecting text inside a row and releasing the mouse inside it discards the selection and navigates away. This is newly load-bearing because plan 20-03 (670e368) deleted the 'View Activity' anchor column from Records' PR tables, making the row-click-only path the sole affordance on five of six cells there."
gaps:
  - truth: "Human checkpoint (SC4) confirms consistent focus order, correct click targets and screen-reader announcement across Overview and Records, both themes"
    status: failed
    reason: "20-VALIDATION.md Round 2 frontmatter itself records status: partial, nyquist_compliant: false. Of 17 rows, only R5, R6 and R13 carry full individually-described evidence (R10 has substance but no theme pair). The other 13 rows (R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15, R16, R17) are recorded R2-VERDICT: FAIL for insufficient evidence — the developer offered only a blanket 'all pass' / a six-question follow-up answered '1. Yes 3. yes 6. confirm' (naming no theme, no badge text, no activity ids) / 'all good'. Critically, R15/R16/R17 exist specifically to hear what VoiceOver announces for a badge-carrying row on the three CR-02-affected surfaces, and none of the three was individually reported — CR-02's failure mode (badge text silently dropped) is indistinguishable from an undescribed pass, so CR-02 remains unobserved in a real screen reader despite its source-level fix."
    artifacts:
      - path: ".planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md"
        issue: "Round 2 frontmatter: status: partial, nyquist_compliant: false; 13/17 rows FAIL for insufficient evidence"
    missing:
      - "Individually-described, per-row observations for R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15, R16, R17 (R15-R17 covering CR-02's real screen-reader announcement are the highest-priority subset)"
      - "A named theme pair (light + dark) for R10, which currently has substance but incomplete theme coverage"
  - truth: "Row-level click navigation honours the browser's native link contract (modifier-click opens in new tab/window, middle-click, and drag-select-to-copy do not hijack navigation) on every row where the row itself — not a descendant anchor — is the sole clickable affordance"
    status: failed
    reason: "row-navigation.ts:58-67's attachRowNavigation click listener calls navigateTo() unconditionally for any click whose target is not inside an <a>, without checking event.button, any modifier key, or an active (non-collapsed) text selection. Confirmed by direct source read at the cited lines. This was not caught by the prior verification round because it predates plan 20-03's removal of the 'View Activity' anchor column (670e368) becoming the row's ONLY residual affordance on five of six Records PR-table cells (Rank, Time, Pace, Age-Grade, Flags — only Date carries a real anchor, confirmed at records.ts:396-419). Cmd/Ctrl/Shift/Alt+click on any of those five cells navigates in the current tab instead of respecting the modifier; middle-click (auxclick, not click) does nothing; a drag-select ending inside the row discards the selection and navigates away. `.activity-table__row--navigable { cursor: pointer }` (styles.css:1544) actively advertises these cells as link-shaped, so users reaching for standard link gestures on them get silently wrong behavior."
    artifacts:
      - path: "src/dashboard/row-navigation.ts"
        issue: "attachRowNavigation (lines 58-67): click listener checks only closest('a'), not event.button/metaKey/ctrlKey/shiftKey/altKey/text-selection state, before calling navigateTo()"
    missing:
      - "Guard the click listener: return early when event.button !== 0, when any modifier key is set, or when window.getSelection() is non-collapsed and non-empty — the concrete patch is spelled out in 20-REVIEW.md's Critical Issues section"
      - "A decision (recorded, D-02-style) on whether middle-click/auxclick is handled or explicitly out of scope"
deferred: []
human_verification: []
---

# Phase 20: Row-Click Interaction Pattern Verification Report

**Phase Goal:** Every row representing an activity, on every screen, is clickable through to that activity using the same pattern `list.ts` already established — propagated, not reinvented — and is keyboard-accessible rather than a click handler on a bare `<div>`.
**Verified:** 2026-08-13T22:25:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (round 2)

## Summary

This is a re-verification following a gap-closure round (plans 20-06, 20-07, 20-08) that targeted the two BLOCKERs (CR-01, CR-02) this phase's initial verification found. Both are genuinely fixed, and the fixes were not taken on the summaries' word — they were independently re-traced against the current source in this pass, matching the fresh `20-REVIEW.md`'s own independent re-verification:

- **CR-01 (return-from-detail focus restoration)** — `list.ts:1097-1101`'s `highlightAndFocus` now branches on `el.tagName === 'A'`, focusing the card element itself when the row IS the anchor and delegating to `querySelector('a')` when the row (`<tr>`) contains one. Confirmed by direct read. Also confirmed on real browser evidence: `20-VALIDATION.md` Round 2 row R13 passed on genuine keyboard-back testing, with a documented false-alarm history (mouse Back vs. keyboard Back) that makes the pass credible rather than assumed.
- **CR-02 (status badges silently dropped from accessible name)** — `list.ts`'s `activityRowAriaLabel`/`composeRowAriaLabel`/`statusBadgeTexts` and `overview.ts`'s `recentPrRowAriaLabel` now fold badge text into the curated `aria-label` on all three previously-affected surfaces, fed from the same array that renders the visible badge spans so the two representations cannot drift apart. `records.ts` confirmed unaffected by design (badges live in a sibling `<td>`, not inside the anchor).

But this re-verification does not clear the phase, for two independent reasons that must both be weighed:

1. **A NEW BLOCKER**, found by the fresh code review and independently confirmed here by direct source read: `row-navigation.ts:58-67`'s `attachRowNavigation` ignores mouse button, modifier keys and active text selection before navigating. This was not a defect in the original verification's scope because it predates plan 20-03's removal of the "View Activity" anchor column from Records' PR tables (`670e368`) — that removal is what makes the row-click-only path the *sole* affordance on five of six Records PR-table cells. Cmd/Ctrl/Shift/Alt+click no longer respects the browser's link contract on those cells; middle-click does nothing; drag-selecting text inside a row and releasing the mouse there discards the selection and navigates away. This directly undercuts the phase's own goal text ("clickable through to that activity using the same pattern `list.ts` already established") — a genuine `<a href>` (the pattern being propagated) honours all of these gestures natively; this synthetic row-click substitute does not.
2. **The human checkpoint (roadmap SC4) is still not discharged.** `20-VALIDATION.md` Round 2 itself records `status: partial`, `nyquist_compliant: false`. Only 4 of 17 rows carry genuine individually-described evidence (R5, R6, R13 in full; R10 on substance but with an open theme-coverage gap). The other 13 rows are recorded `R2-VERDICT: FAIL — insufficient evidence` because the developer offered a blanket "all pass" / a partial six-question follow-up answer ("1. Yes 3. yes 6. confirm") / "all good", rather than individual observations. Most consequentially, R15/R16/R17 — built specifically to confirm what VoiceOver announces for a badge-carrying row on the three CR-02-affected surfaces — were never individually reported. CR-02's failure mode was the badge text being *silently* dropped, so an undescribed "yes" carries zero diagnostic value; CR-02 remains unobserved in a real screen reader even though its source-level composition is proven correct.

Separately, two guard-layer defects flagged as WARNINGs by the fresh review are confirmed present in the automated suite: the D-01 `tabindex` source guards (`row-semantics.test.ts:158-171`) are case-sensitive and miss the `tabIndex`/`.role =` property forms the codebase actually uses (confirmed: `list.ts` and `records.ts` both use camelCase `tabIndex` in several places, invisible to the lowercase-only guard), and four Phase 20 CSS assertions in `styles.test.ts` (lines ~1090-1112) read through the first-wins `declarationsFor` helper rather than the last-wins `bodyForSelectorListToken` this same file's own header documents as the fix for exactly this class of false-green (R3-WR-02). These do not themselves break anything today, but they mean the automated suite would not catch a regression to either property if one were introduced later. Neither blocks the phase goal on its own; both are recorded as WARNINGs, not BLOCKERs.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — every activity row on Overview and Records navigates to that activity's detail view on click, using `list.ts`'s established pattern | ✗ FAILED | Primary click navigation itself works everywhere (hrefs correct, `attachRowNavigation`/`activityDetailHref` wired on every surface). But "using `list.ts`'s established pattern" is false in a concrete, newly-exposed way: `row-navigation.ts:58-67` does not honour modifier-click, middle-click or text-selection the way a real anchor (the pattern being propagated) does, and this is now the *sole* affordance on five of six Records PR-table cells since `670e368` removed the CTA anchor. Confirmed by direct source read; matches `20-REVIEW.md`'s independently-confirmed CR-01 (Round 2 numbering). |
| 2 | SC2 — redundant "View Activity" CTA buttons removed from Records and everywhere the row is now the affordance | ✓ VERIFIED | `grep -rn "View Activity" src/dashboard/` returns only a pinning test assertion and explanatory comments — zero live CTA text. Records' PR table (6 cols: Rank, Time, Pace, Age-Grade, Date, Flags) and progression table (3 cols) confirmed by direct read of `records.ts:396-419`. Unaffected by the modifier-click gap above (which concerns click *behavior*, not CTA *removal*). |
| 3 | SC3 — row-level navigation is keyboard-operable (Tab/Enter) and announced correctly to assistive tech via a real link/button semantic | Source: ✓ VERIFIED — Real-world: ? UNCERTAIN | The semantic and the two prior BLOCKERs are genuinely fixed at the source level: `highlightAndFocus` (CR-01) and `activityRowAriaLabel`/`recentPrRowAriaLabel` (CR-02) both confirmed correct by direct read here and independently re-traced call-site-by-call-site in `20-REVIEW.md`. R13 (CR-01) additionally passed on real browser evidence in `20-VALIDATION.md` Round 2. But "announced correctly to assistive tech" for CR-02 specifically has **no real screen-reader confirmation**: R15, R16, R17 (the VoiceOver rows built for exactly this) are all recorded FAIL for insufficient evidence in Round 2 — CR-02's failure mode is a *silent* drop, so an unrecorded "yes" cannot distinguish "fixed" from "still broken but sounds fine." |
| 4 | SC4 — human checkpoint under `/strava-widgets`, keyboard-only tab-through of Overview and Records, consistent focus order, correct click targets, both themes | ✗ FAILED | `20-VALIDATION.md` Round 2 frontmatter: `status: partial`, `nyquist_compliant: false`. 13 of 17 rows recorded `R2-VERDICT: FAIL — insufficient evidence`; only R5, R6, R13 carry full evidence and R10 carries partial (substance, no theme). This is the checkpoint's own self-assessment, not an inference. |

**Score:** 2/4 truths verified (SC1 FAILED on a newly-confirmed source defect; SC3 mixed — source fixed, real-world unconfirmed; SC4 FAILED on the checkpoint's own recorded evidence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/row-navigation.ts` | Single shared `attachRowNavigation`/`activityDetailPath`/`activityDetailHref`/`NAVIGABLE_ROW_CLASS` module | ⚠️ VERIFIED WITH DEFECT | Exists, exports confirmed, imported by `list.ts`, `records.ts`, `overview.ts`. But `attachRowNavigation` (lines 58-67) has the newly-load-bearing modifier-click/text-selection defect — see Gaps. |
| `src/dashboard/views/list.ts` | `renderActivityRow` returns `<a class="activity-row">`; `highlightAndFocus` resolves focus for both row shapes; badge text folded into `aria-label` | ✓ VERIFIED | CR-01 fix confirmed at lines 1097-1101 (`el.tagName === 'A'` branch). CR-02 fix confirmed: `activityRowAriaLabel`/`composeRowAriaLabel`/`statusBadgeTexts` exported and used by `renderActivityRow`; `aria-describedby` wired conditionally for low-confidence rows. |
| `src/dashboard/views/overview.ts` | `renderRecentPrRow` folds PR-count badge into `aria-label` | ✓ VERIFIED | `recentPrRowAriaLabel`/`recentPrBadgeText` confirmed present and imported from `list.ts`'s shared `composeRowAriaLabel`. |
| `src/dashboard/views/records.ts` | PR tables/progression tables navigate via `attachRowNavigation`, Date-cell anchor, CTA columns removed, badges unaffected by CR-02 (sibling `<td>`) | ✓ VERIFIED | Confirmed at lines 396-419: only the Date cell carries an anchor; Rank/Time/Pace/Age-Grade/Flags cells are click-only, which is exactly what makes the new modifier-click gap load-bearing here. |
| `src/dashboard/row-semantics.test.ts` | Source-structure guard over CTA absence, D-01/D-02 enforcement, CR-02 regression coverage | ⚠️ VERIFIED WITH GUARD DEFECT | 22 CR-02-related tests exist and pass, with executed mutation proof (both CR-02 mutations fail as expected, per `20-07-SUMMARY.md`). But the pre-existing D-01 `tabindex`/`role="link"` guards (lines 158-171) are confirmed case-sensitive and miss the `tabIndex`/`.role =` property spellings the codebase actually uses — a WARNING (WR-02 in `20-REVIEW.md`), not a new gap, since it does not indicate an actual regression today. |
| `src/dashboard/styles.test.ts` | Phase 20 CSS assertions (bare `a`, row hover, navigable-row cursor) | ⚠️ VERIFIED WITH GUARD DEFECT | Rules exist and are correct by direct read. Four Phase 20 assertions (~lines 1090-1112) use first-wins `declarationsFor` instead of last-wins `bodyForSelectorListToken`, reintroducing this file's own previously-documented false-green class (WR-03 in `20-REVIEW.md`) — confirmed by code read, not independently re-executed as a mutation here (the review already did so). |
| `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` | Seventeen-row Round 2 checkpoint, one named verdict per row | ⚠️ PARTIAL | Exists; frontmatter honestly records `status: partial`, `nyquist_compliant: false`. 4/17 rows individually evidenced; 13/17 FAIL for insufficient evidence. |
| `.planning/REQUIREMENTS.md` | UX-01/UX-02/UX-03/REC-08 status reflects actual verification state | ✓ VERIFIED | REC-08 correctly ticked (both mapped rows R5/R6 individually PASS). UX-01/UX-02/UX-03 correctly left `[ ] Pending` with per-requirement notes naming exactly which mapped rows remain undischarged — matches `20-VALIDATION.md` Round 2 precisely; not prematurely closed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `list.ts` `highlightAndFocus` | the row element it is passed | `el.tagName === 'A' ? el : el.querySelector('a')` | ✓ WIRED | CR-01 fix confirmed; resolves correctly for both card and `<tr>` shapes. |
| `list.ts`/`overview.ts` badge text | the row's `aria-label` | `composeRowAriaLabel(base, statusBadgeTexts(row))` / `recentPrRowAriaLabel` | ✓ WIRED | CR-02 fix confirmed; one array feeds both the rendered badge spans and the composed label, so they cannot drift apart. |
| `row-navigation.ts` `attachRowNavigation` | `navigateTo` | unconditional `click` listener, no button/modifier/selection guard | ⚠️ WIRED BUT NON-COMPLIANT | Navigates correctly for a plain primary click, but does not respect modifier keys, non-primary buttons, or an active text selection — the new BLOCKER. Confirmed directly at `row-navigation.ts:58-67`. |
| `records.ts` five of six PR-table cells | `attachRowNavigation`'s click listener | row-level click, no descendant anchor | ⚠️ SOLE AFFORDANCE, NON-COMPLIANT | Since `670e368` removed the CTA anchor, these cells have no fallback real-link path; they inherit the modifier-click gap directly and fully. |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — no fetched/computed data source feeds these rows beyond the already-loaded `DashboardIndexRow`/`PrTableRow` objects, unchanged by this phase or its gap-closure round.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `highlightAndFocus` branches on row shape (CR-01 fix present) | `sed -n '1097,1101p' src/dashboard/views/list.ts` | `const focusTarget = el.tagName === 'A' ? el : el.querySelector('a');` | ✓ PASS |
| Status badges fold into `aria-label` (CR-02 fix present) | `grep -n "activityRowAriaLabel\|composeRowAriaLabel\|statusBadgeTexts" src/dashboard/views/list.ts` | Functions defined and used inside `renderActivityRow` | ✓ PASS |
| `attachRowNavigation` checks button/modifiers/selection | `sed -n '58,67p' src/dashboard/row-navigation.ts` | Only `closest('a')` is checked; no `event.button`, no modifier-key check, no selection check | ✗ FAIL (new BLOCKER) |
| Records PR table: only Date cell has a descendant anchor | `sed -n '396,419p' src/dashboard/views/records.ts` | Confirmed: `dateAnchor` appended only to `dateTd`; Rank/Time/Pace/Age-Grade/Flags cells have no anchor | ✓ PASS (confirms the modifier-click gap's blast radius: 5/6 cells) |
| D-01 `tabindex` guard is case-sensitive | `grep -n "tabIndex" src/dashboard/views/list.ts src/dashboard/views/records.ts` vs. `row-semantics.test.ts:158-171`'s lowercase-only `countOccurrences` | `tabIndex` (camelCase) used in both files; guard only searches lowercase `'tabindex'` | ✗ FAIL (WARNING, guard-layer only) |
| Phase 20 CSS assertions use first-wins helper | `grep -n "declarationsFor" src/dashboard/styles.test.ts` around lines 1090-1112 | Confirmed `declarationsFor` (first-wins), not `bodyForSelectorListToken` (last-wins) | ✗ FAIL (WARNING, guard-layer only) |
| Full automated suite green | `npm test` | 991/991 passed, 49 files | ✓ PASS (does not detect the modifier-click gap or the guard-layer defects) |
| Typecheck clean | `npx tsc --noEmit -p tsconfig.json` | Zero diagnostics | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` shell probes exist for this phase; its verification mechanism is the developer's manual browser checkpoint recorded in `20-VALIDATION.md`, not a re-executable script. See Human Verification / Gaps Summary for that checkpoint's own recorded evidence quality.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-01 | 20-01, 20-02, 20-03, 20-05, 20-06, 20-08 | Every activity row clickable through to that activity, on every screen | ✗ BLOCKED | Click-to-navigate works on primary click everywhere, but the new modifier-click/selection gap in `row-navigation.ts` is unfixed, and `REQUIREMENTS.md` correctly records only 2 of 8 mapped rows (R5, R13) individually evidenced. `[ ] Pending` is correct. |
| UX-02 | 20-02, 20-03, 20-04, 20-05, 20-08 | Redundant "View Activity" CTAs removed | ✗ BLOCKED (checkpoint) / requirement text itself satisfied in source | Source removal is genuinely complete (grep-confirmed). `REQUIREMENTS.md` leaves it open because 2 of 4 mapped checkpoint rows (R2, R4) are still unevidenced — a conservative, correct reading given the requirement also implies confirmed no-regression on the rendered card. |
| UX-03 | 20-01, 20-02, 20-04, 20-05, 20-07, 20-08 | Keyboard-accessible and announced correctly, not a bare `<div>` handler | ✗ BLOCKED | Source-level fix for CR-02 confirmed, but `REQUIREMENTS.md` correctly leaves this open: only 1 of 11 mapped rows (R10, partial) evidenced, and specifically R15/R16/R17 (the real-screen-reader confirmation for CR-02) remain unobserved. |
| REC-08 | 20-03, 20-05, 20-08 | Records rows navigate on row click rather than via a large button | ✓ SATISFIED | Both mapped checkpoint rows (R5, R6) individually PASS on verbatim header read-backs. Correctly ticked in `REQUIREMENTS.md`. Note: REC-08's own text is about CTA removal / row-click existing, not about modifier-key compliance, so the new BLOCKER does not contradict this specific requirement's literal text — though it does undercut the phase's broader "same established pattern" framing that REC-08 sits inside. |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 20 rows are exactly UX-01, UX-02, UX-03, REC-08, matching the plans' `requirements:` frontmatter (`requirements-completed: [UX-01]` in 20-06, `[UX-03]` in 20-07, `[REC-08]` in 20-08).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/row-navigation.ts` | 58-67 | NEW BLOCKER — click listener ignores mouse button, modifier keys, and active text selection before navigating | 🛑 BLOCKER | Cmd/Ctrl/Shift/Alt+click navigate in-tab instead of respecting the browser's link contract; middle-click does nothing; drag-select-then-release-inside-row discards the selection and navigates away. Newly load-bearing on 5/6 Records PR-table cells since the CTA anchor was removed (`670e368`). |
| `src/dashboard/row-semantics.test.ts` | 158-171 | D-01 `tabindex`/`role="link"` guards are case-sensitive and miss the `.tabIndex`/`.role =` property forms actually used in this codebase | ⚠️ WARNING | A future regression that adds `tr.tabIndex = 0; tr.role = 'link';` to a row builder would ship with a green suite — confirmed by the review's executed mutation, not independently re-executed here but source-confirmed. |
| `src/dashboard/styles.test.ts` | ~1090-1112 | Four Phase 20 CSS assertions use the first-wins `declarationsFor` instead of the last-wins `bodyForSelectorListToken` this same file documents as the fix for this exact false-green class | ⚠️ WARNING | A later cascade-winning override to `.activity-row`'s `display: flex` (documented as "load-bearing" in `styles.css`) or the navigable-row cursor/hover rules would ship silently regressed. |
| `src/dashboard/row-navigation.ts` | header comment | `attachRowNavigation` remains the riskiest code in the phase with zero DOM-behavior test coverage (both test files' own headers state they cannot observe it) | ℹ️ INFO | Carried forward from `20-REVIEW.md` (WR-06); explains why the modifier-click gap survived two prior review/gap-closure rounds undetected until this round's fresh review. |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in the phase's files.

## Human Verification Required

None newly identified beyond what `20-VALIDATION.md` Round 2 already attempted and honestly recorded as insufficient. Re-running the checkpoint again in isolation is not the recommended next step — the modifier-click BLOCKER should be fixed first (it is a genuine code defect, not an evidence gap), since re-testing the same checkpoint rows without that fix would not close SC1, and the checkpoint's remaining open rows (R1-R4, R7-R9, R11, R12, R14-R17) still need individual, per-row, both-theme-where-applicable evidence regardless.

## Gaps Summary

Two independent classes of gap keep this phase's goal from being achieved as stated, even though both original BLOCKERs (CR-01, CR-02) are now genuinely and independently confirmed fixed:

1. **A NEW BLOCKER** — `row-navigation.ts:58-67`'s `attachRowNavigation` does not respect mouse button, modifier keys, or an active text selection before navigating. This is not a hypothetical: it is the *sole* click affordance on five of six Records PR-table cells since plan 20-03 removed the "View Activity" CTA anchor, and it directly contradicts the phase's own stated goal of propagating `list.ts`'s established (real-anchor) pattern rather than reinventing a lesser one. Fix is small and spelled out with a concrete patch in `20-REVIEW.md`'s Critical Issues section.
2. **SC4 (human checkpoint) is still not discharged**, on the checkpoint's own self-recorded evidence: `20-VALIDATION.md` Round 2 is `status: partial`, `nyquist_compliant: false`, with 13 of 17 rows FAIL for insufficient evidence. Most consequentially, R15/R16/R17 — built specifically to hear CR-02's fix in a real screen reader — were never individually reported, so CR-02 (source-verified) remains unconfirmed against its actual failure mode (silent badge loss).

Separately, two WARNING-severity guard-layer defects (case-blind D-01 tabindex guards, first-wins CSS assertions on four Phase 20 rules) mean parts of the automated suite would not catch a future regression to either property. These do not block the phase goal today but should be fixed alongside the BLOCKER above, since both were touched by this same phase's own gap-closure work.

**Recommended path:** fix the modifier-click/text-selection gap in `row-navigation.ts` in a small follow-up plan (the patch is already drafted in `20-REVIEW.md`), then run a Round 3 checkpoint that both re-attempts the 13 still-unevidenced rows (individually, per-row, both themes where required) and re-confirms R1/R2/R3/R4/R7 in light of the new fix. R15/R16/R17 (VoiceOver observation of CR-02) should be prioritized given they are the only remaining unconfirmed link in an otherwise source-verified fix.

---

_Verified: 2026-08-13T22:25:00Z_
_Verifier: Claude (gsd-verifier)_
