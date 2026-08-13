---
phase: 20-row-click-interaction-pattern
verified: 2026-08-13T21:15:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Row-level navigation is keyboard-operable and announced correctly to assistive tech (SC3 / UX-03)"
    status: failed
    reason: "CR-02 (confirmed in source, both list.ts and overview.ts): renderActivityRow and renderRecentPrRow append status badges (Low confidence, No streams, Excluded from records, N PR) as children of the row's own <a>, whose accessible name is overridden by a curated aria-label that does not include badge text. Every 'honesty' disclosure badge this repository ships is silently dropped from what a screen reader announces for the row link on Activities mobile cards, Overview Recent Activities, and Overview Recent PRs. The aria-describedby wiring inside appendLowConfidenceBadge is also inert on these surfaces (its host span's text is subsumed by the ancestor's aria-label, so it has no announcement point)."
    artifacts:
      - path: "src/dashboard/views/list.ts"
        issue: "renderActivityRow (lines 221-244): rowEl is the <a>, carries an overriding aria-label (226-229), and appendStatusBadges(rowEl, row) (241) appends badges as direct anchor children"
      - path: "src/dashboard/views/overview.ts"
        issue: "renderRecentPrRow (lines 89-114): identical shape — PR-count badge appended inside the aria-labeled anchor (108-112); Recent Activities row shares renderActivityRow directly"
    missing:
      - "Fold badge text into the curated aria-label, or move badges outside the anchor into a sibling element that remains announceable, for all three whole-row-anchor call sites (list.ts card, overview.ts Recent Activities, overview.ts Recent PRs)"
  - truth: "Row-level navigation uses list.ts's existing established pattern, propagated rather than reinvented (SC1 / phase goal)"
    status: failed
    reason: "CR-01 (confirmed in source): highlightAndFocus (list.ts:963-968) recovers focus via el.querySelector('a')?.focus(). This phase made the card row element itself the <a> (list.ts:222) and deleted its descendant CTA anchor, so on the card branch querySelector('a') now returns null and the optional chain silently no-ops. applyReturnHighlight (977-996) calls highlightAndFocus on both the <tr> and the card unconditionally; below the 720px breakpoint the card is the only visible/focusable branch, so D-08's return-from-detail focus restoration is completely dead on mobile — the row still gets the highlight class (so it visually looks 'restored') but keyboard focus silently stays on the page <h1>. Not covered by any test: row-semantics.test.ts and row-navigation.test.ts both state explicitly they cannot observe DOM behavior."
    artifacts:
      - path: "src/dashboard/views/list.ts"
        issue: "highlightAndFocus (963-968) still assumes a descendant <a> exists inside the passed element; that assumption became false the moment renderActivityRow (222) made the row itself the anchor"
    missing:
      - "highlightAndFocus must special-case el instanceof HTMLAnchorElement (focus el directly) vs. el containing a descendant <a> (querySelector as before)"
deferred: []
human_verification: []
---

# Phase 20: Row-Click Interaction Pattern Verification Report

**Phase Goal:** Every row representing an activity, on every screen, is clickable through to that activity using the same pattern `list.ts` already established — propagated, not reinvented — and is keyboard-accessible rather than a click handler on a bare `<div>`.
**Verified:** 2026-08-13T21:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Summary

The structural work is real and mostly correct: `row-navigation.ts`'s single shared helper genuinely exists and is called from `list.ts`, `overview.ts` and `records.ts`; the three "View Activity" CTAs are genuinely gone (`grep -rn "View Activity" src/dashboard/` returns zero hits outside comments and the test that pins their absence); Records' PR table and PR-progression table genuinely navigate on row click via `attachRowNavigation`, with column counts correctly reduced (6 and 3); no row anywhere carries a fake `tabindex`/`role="link"` hack; `npx tsc --noEmit` is clean and `npm test` passes 960/960. Requirements traceability is clean — `REQUIREMENTS.md` still correctly shows UX-01/UX-02/UX-03/REC-08 as `Pending`, not prematurely ticked, matching `20-VALIDATION.md`'s own explicit decision not to close them on `status: partial` evidence.

But two BLOCKER-severity defects from `20-REVIEW.md` are independently confirmed against the current source, both bearing directly on this phase's own success criteria, and neither is offset by anything in the automated suite (both test files that touch this phase state explicitly, in their own header comments, that they cannot observe DOM/rendering behavior):

- **CR-01**: `list.ts:963-968` `highlightAndFocus` does `el.querySelector('a')?.focus()`. Confirmed at `list.ts:221-244`: `renderActivityRow` returns `rowEl` where `rowEl` itself is the `document.createElement('a')` — there is no descendant anchor left inside it (only `div`/`span` children are appended). `applyReturnHighlight` (977-996) calls `highlightAndFocus(card)` unconditionally at line 995, where `card` is exactly this row element. Below the 720px breakpoint the card branch is the only visible/focusable one, so the D-08 return-from-detail focus restoration is silently dead on mobile — confirmed by direct code read, not inference.
- **CR-02**: `appendStatusBadges(rowEl, row)` at `list.ts:241` appends badge spans as direct children of `rowEl`, which carries an overriding `aria-label` set two lines above (226-229). Confirmed the identical shape exists in `overview.ts:108-112` (`renderRecentPrRow`'s `N PR` badge appended inside the aria-labeled anchor). This drops "No streams", "Low confidence", "Excluded from records" and "N PR" — this repository's own honesty disclosures — from the accessible name announced for the row link on three of the phase's rendered surfaces (Activities mobile card, Overview Recent Activities, Overview Recent PRs). Records is *not* affected — confirmed by reading `records.ts:396-416`: the anchor lives only in the Date `<td>`, and badges live in a separate sibling `<td>`, so the aria-label there does not swallow them.

Both defects are structural — present in every render of the affected surfaces, not edge cases — and both were introduced by this phase's own conversion of the row wrapper from `<div>` to `<a>`.

Separately, the phase's own `20-VALIDATION.md` records `status: partial` / `nyquist_compliant: false` for the human checkpoint (ROADMAP success criterion 4). All twelve rows carry a PASS verdict, but rows 1-11 rest on a single blanket developer statement ("all approved except 12") with zero per-row detail, and the seven theme-sensitive rows (1-4, 7, 9, 10) have no stated theme coverage at all — thinner than even a single-theme observation, per the validation file's own house rule. This repository has direct precedent for not accepting this shape of evidence: `19-VERIFICATION.md` reopened UI-02 after `19-REVIEW.md` found defects a prior blanket-approval checkpoint never exercised, and only closed it after a later round produced named, per-row, both-theme, probe-gated verdicts. Applying that same standard here, criterion 4 is not defensibly discharged — independent of the two coding blockers above, which the checkpoint's own agenda (rows 1-4 asking about tab-stop counts and Enter-activation) was never positioned to catch anyway, since a blanket "looks fine" statement does not verify keyboard focus restoration or screen-reader announcement content.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — every activity row on Overview and Records navigates to that activity's detail view on click, using list.ts's established pattern | ✗ FAILED | Click-to-navigate itself works (hrefs are correct, `attachRowNavigation`/`activityDetailHref` wired everywhere). But "using list.ts's existing pattern, propagated not reinvented" is false in one concrete respect: the established D-08 return-focus pattern (`highlightAndFocus`) silently breaks the moment the row becomes the anchor itself (CR-01), which is exactly the shape this phase introduced on the card/Overview surfaces. |
| 2 | SC2 — redundant "View Activity" CTA buttons removed from Records and everywhere the row is now the affordance | ✓ VERIFIED | `grep -rn "View Activity" src/dashboard/` returns only a test assertion pinning its absence and two explanatory code comments — zero live button/CTA text remains. Records' PR table (6 cols) and progression table (3 cols) confirmed by direct read of `records.ts:380-420`, `:492-535`. |
| 3 | SC3 — row-level navigation is keyboard-operable (Tab/Enter) and announced correctly to assistive tech via a real link/button semantic | ✗ FAILED | The semantic itself is real (genuine `<a href>` elements; zero `tabindex`/`role="link"` hacks confirmed by grep across `list.ts`, `records.ts`, `row-navigation.ts`). But "announced correctly" is false: CR-02, confirmed in source, drops every status badge from the row's accessible name on the card, Overview Recent Activities and Overview Recent PRs surfaces. CR-01, also confirmed in source, silently breaks keyboard focus restoration on the mobile card layout. |
| 4 | SC4 — human checkpoint under `/strava-widgets`, keyboard-only tab-through of Overview and Records, consistent focus order, correct click targets, both themes | ? UNCERTAIN | `20-VALIDATION.md` itself records `status: partial`, `nyquist_compliant: false`. Rows 1-11 rest on one blanket developer statement with no per-row detail; the seven theme-sensitive rows (1, 2, 3, 4, 7, 9, 10) have no stated theme coverage at all. Phase 19's own precedent (`19-VERIFICATION.md`, reopening UI-02 after a blanket-approval checkpoint missed CR-01/CR-02/CR-03) establishes this repository's standard for what counts as sufficient checkpoint evidence, and this checkpoint does not meet it. |

**Score:** 2/4 truths verified (SC1 and SC3 FAILED on independently-confirmed source defects; SC4 UNCERTAIN on the checkpoint's own admitted evidence gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/row-navigation.ts` | Single shared `attachRowNavigation`/`activityDetailPath`/`activityDetailHref`/`NAVIGABLE_ROW_CLASS` module | ✓ VERIFIED | Exists, exports confirmed (lines 36-64), imported by `list.ts`, `records.ts`, `overview.ts`. |
| `src/dashboard/row-navigation.test.ts` | Unit coverage of the pure, DOM-free surface | ✓ VERIFIED (scoped) | 7 tests pass. File's own header comment states it does not and cannot cover `attachRowNavigation`'s DOM behavior — an honest, not a false, limitation. |
| `src/dashboard/views/list.ts` | `renderActivityRow` returns `<a class="activity-row">`; `buildTableRow` delegates to `attachRowNavigation` | ⚠️ VERIFIED WITH DEFECT | Structure matches the plan exactly, but the same edit that satisfies the plan's own `must_haves` (whole-row anchor) is what causes CR-01 and CR-02 — see Gaps. |
| `src/dashboard/views/overview.ts` | `renderRecentPrRow` returns `<a class="activity-row">` | ⚠️ VERIFIED WITH DEFECT | Confirmed at lines 89-114; carries the same CR-02 shape as `list.ts` (PR badge inside the aria-labeled anchor). |
| `src/dashboard/views/records.ts` | PR tables/progression tables navigate via `attachRowNavigation`, Date-cell anchor, CTA columns removed | ✓ VERIFIED | Confirmed at lines 396-419, 514-532. Badges live in a separate `<td>`, so this surface does not inherit CR-02. |
| `src/dashboard/styles.css` | Phase 20 block — bare `a` rule, row-anchor hover, navigable-row scoping | ✓ VERIFIED | Confirmed present by code review (independently executed mutation tests in `20-REVIEW.md`); not re-derived here beyond the review's own confirmation, since this artifact's WR-04 (hover overriding highlight) is a WARNING, not a BLOCKER. |
| `src/dashboard/row-semantics.test.ts` | Source-structure guard over CTA absence, helper call counts, D-01/D-02 enforcement | ✓ VERIFIED (scoped) | Exists, 91 tests referenced by review pass. File's own header states explicitly it proves source text shape only, not rendering/clicking/focus/announcement — an honest limitation that matches what actually happened (the two blockers are exactly the class of defect this file cannot see). |
| `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` | Twelve-row manual verification agenda, one named verdict per row | ⚠️ PARTIAL | Exists, all twelve rows carry PASS, but the file's own frontmatter records `status: partial`, `nyquist_compliant: false` — the artifact is honest about its own insufficiency, which does not make the checkpoint itself sufficient. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `list.ts` `buildTableRow` | `row-navigation.ts` | `import { attachRowNavigation, activityDetailHref }` | ✓ WIRED | Confirmed by review and by grep; desktop `<tr>` path unaffected by CR-01/CR-02. |
| `list.ts` `renderActivityRow` | `row-navigation.ts` | `activityDetailHref(row.id)` on the row's own `href` | ✓ WIRED | Confirmed line 225. |
| `overview.ts` `renderRecentPrRow` | `row-navigation.ts` | `import { activityDetailHref }` | ✓ WIRED | Confirmed line 16, used line 93. |
| `records.ts` (both tables) | `row-navigation.ts` | `import { attachRowNavigation, activityDetailHref }` | ✓ WIRED | Confirmed line 46, used at 398/419 and 514/532. |
| `list.ts` `highlightAndFocus` | the row element it is passed | `el.querySelector('a')?.focus()` | ✗ NOT WIRED (on the card branch) | This is CR-01: the assumption that the passed element *contains* a descendant `<a>` is false for the card element, which this phase made the anchor itself. The link is broken by this phase's own change, not pre-existing. |
| `appendStatusBadges` / `appendLowConfidenceBadge` | the row's accessible name | `aria-describedby` + sibling `.sr-only` span | ✗ NOT WIRED (on the whole-row-anchor surfaces) | This is CR-02: the badges' host is inside an element whose accessible name is overridden by `aria-label`, so the description has no announcement point on the card/Overview surfaces. Records is unaffected (badges are in a sibling `<td>`, not inside the anchor). |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — no fetched/computed data source feeds these rows beyond the already-loaded `DashboardIndexRow`/`PrTableRow` objects, which are unchanged by this phase. The equivalent question — does the wiring in the DOM actually deliver what the source implies — is exactly what CR-01 and CR-02 answer negatively above.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `renderActivityRow` produces a real `<a>` with no descendant anchor | `sed -n '221,244p' src/dashboard/views/list.ts` | Confirmed: `rowEl = document.createElement('a')`; only `div`/`span` children appended | ✓ PASS (confirms the row IS the link; also confirms CR-01's precondition) |
| `highlightAndFocus` still assumes a descendant anchor | `sed -n '963,968p' src/dashboard/views/list.ts` | `el.querySelector('a')?.focus()` unchanged from the pre-phase shape | ✗ FAIL (CR-01) |
| Status badges land inside the aria-labeled anchor | `sed -n '221,244p' src/dashboard/views/list.ts`, `sed -n '89,114p' src/dashboard/views/overview.ts` | `appendStatusBadges(rowEl, row)` / badge `appendChild(rowEl)` both target the anchor itself | ✗ FAIL (CR-02) |
| Records badges are NOT inside the anchor (surface unaffected) | `sed -n '380,420p' src/dashboard/views/records.ts` | Anchor confined to `dateTd`; badges appended to separate `flagsTd` | ✓ PASS |
| "View Activity" CTA text is fully gone from source | `grep -rn "View Activity" src/dashboard/` | Zero live occurrences (only a comment and a pinning test) | ✓ PASS |
| No fake `tabindex`/`role="link"` hack anywhere in the phase's files | `grep -n "tabindex\|role=\"link\"" src/dashboard/views/list.ts src/dashboard/views/records.ts src/dashboard/row-navigation.ts` | Zero matches (only comments explaining the deliberate absence) | ✓ PASS |
| Full automated suite green | `npm test` | 960/960 passed, 48 files | ✓ PASS (does not detect CR-01/CR-02 — both files' own headers admit this) |
| Typecheck clean | `npx tsc --noEmit -p tsconfig.json` | Zero diagnostics | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` shell probes exist for this phase; its verification mechanism is the developer's manual browser checkpoint recorded in `20-VALIDATION.md`, which is not a re-executable script. Step 7c's shell-probe contract does not apply. See Human Verification / Gaps Summary below for the checkpoint's own recorded evidence quality.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-01 | 20-01, 20-02, 20-03, 20-05 | Every activity row clickable through to that activity, on every screen | ✗ BLOCKED | Click-to-navigate works, but CR-01 breaks the D-08 return-focus half of the established `list.ts` pattern this phase was supposed to propagate, on mobile. `REQUIREMENTS.md`'s `[ ] Pending` is correct and should stay open. |
| UX-02 | 20-02, 20-03, 20-04, 20-05 | Redundant "View Activity" CTAs removed | ✓ SATISFIED | Confirmed by direct grep — genuinely removed everywhere, columns correctly reduced in Records. `REQUIREMENTS.md`'s `[ ] Pending` is conservative but not incorrect; this specific requirement's own text is independently satisfied. |
| UX-03 | 20-01, 20-02, 20-04, 20-05 | Keyboard-accessible and announced correctly, not a bare `<div>` handler | ✗ BLOCKED | The "not a bare div" half is satisfied (real anchors, no tabindex/role hacks). The "announced correctly" half is falsified by CR-02. `REQUIREMENTS.md`'s `[ ] Pending` is correct. |
| REC-08 | 20-03, 20-05 | Records rows navigate on row click rather than via a large button | ✓ SATISFIED | Confirmed independently — Records is the one surface unaffected by both CR-01 (desktop `<tr>` path, not the card path) and CR-02 (badges in a sibling cell, not inside the anchor). This specific requirement's own text is defensibly satisfied even though the phase as a whole is not done. |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 20 rows are exactly UX-01, UX-02, UX-03, REC-08, matching all five plans' `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/views/list.ts` | 963-968 | CR-01 — stale DOM-shape assumption after this phase's own refactor (`querySelector('a')` on an element that is now itself the anchor) | 🛑 BLOCKER | Return-from-detail focus restoration silently dead on the card/mobile layout. |
| `src/dashboard/views/list.ts` + `overview.ts` | list.ts:241, overview.ts:108-112 | CR-02 — accessibility disclosures appended inside an element whose accessible name is overridden by `aria-label` | 🛑 BLOCKER | Status badges (including safety-relevant "Low confidence" / "Excluded from records" disclosures) silently dropped from screen-reader announcement on three rendered surfaces. |
| `src/dashboard/row-navigation.ts` | 43-50 | WR-01 (review) — `activityDetailPath` neither validates nor encodes the activity id | ⚠️ WARNING | Not independently re-verified in depth here; carried forward from `20-REVIEW.md` as a real but non-blocking finding (id shapes reaching this path are Strava-numeric in practice today). |
| `src/dashboard/row-navigation.ts` | header | WR-02 (review) — D-03's "only definition of the URL shape" claim is not true; `detail.ts`/`calendar.ts` still hand-construct the same URL | ⚠️ WARNING | Carried forward from `20-REVIEW.md`, not independently re-verified here. |
| `src/dashboard/row-navigation.ts` | 58-68 | WR-03 (review) — row click ignores modifier keys / text selection | ⚠️ WARNING | Carried forward from `20-REVIEW.md`, not independently re-verified here. |
| `src/dashboard/styles.css` | ~1537 | WR-04 (review) — hover rule beats the return-highlight on the card layout | ⚠️ WARNING | Carried forward from `20-REVIEW.md`, not independently re-verified here. |
| `src/dashboard/row-semantics.test.ts` | 157-171 | WR-05 (review) — `tabindex`/`role="link"` guards are case-blind and miss the property form | ⚠️ WARNING | Carried forward from `20-REVIEW.md`, not independently re-verified here. |

No `TBD`/`FIXME`/`XXX`/unreferenced debt markers found in the phase's own files (`grep -n "TBD\|FIXME\|XXX"` across `row-navigation.ts`, `row-navigation.test.ts`, `row-semantics.test.ts`, `list.ts`, `overview.ts`, `records.ts`, `styles.css` returns zero matches).

## Human Verification Required

None newly identified beyond what `20-VALIDATION.md` already attempted and recorded as insufficient. Re-opening the checkpoint is not the recommended next step in isolation — the two coding blockers (CR-01, CR-02) should be fixed first, since the existing checkpoint agenda's rows 1-4 (tab-stop count, Enter-activation) were never positioned to catch either defect (blanket "looks fine" does not verify screen-reader announcement content or post-navigation focus target), so re-running the same checkpoint without a code fix would not close these gaps even with full per-row, both-theme rigor.

## Gaps Summary

Two BLOCKER-severity, independently-source-confirmed defects prevent this phase's goal from being achieved as stated:

1. **CR-01** — the established `list.ts` return-focus pattern (`highlightAndFocus`) this phase was supposed to propagate, not reinvent, is broken by this phase's own row-to-anchor conversion on the card/mobile layout. Fix is small (branch on `el instanceof HTMLAnchorElement`) and is spelled out with a concrete patch in `20-REVIEW.md`.
2. **CR-02** — status/honesty badges are silently dropped from the accessible name of the row link on three surfaces (Activities mobile card, Overview Recent Activities, Overview Recent PRs), directly contradicting this phase's own success criterion 3 ("announced correctly to assistive tech"). Records is unaffected. Fix requires folding badge text into the curated `aria-label` or restructuring the anchor to not wrap the badges; also spelled out in `20-REVIEW.md`.

Both are structural (present on every render of the affected rows), both were introduced by this phase and not pre-existing, and neither is detectable by this phase's own automated suite — both test files added by this phase state in their own header comments that they cannot observe DOM/rendering/announcement behavior, so the 960/960 green run and the review's own confirmed test pass are not evidence against either finding.

Separately, ROADMAP success criterion 4 (the human checkpoint) is not defensibly discharged on the evidence `20-VALIDATION.md` itself records: `status: partial`, `nyquist_compliant: false`, a blanket approval covering 11 of 12 rows with no per-row detail, and no stated theme coverage for the seven theme-sensitive rows. This repository has direct precedent (Phase 19, `19-VERIFICATION.md`) for treating a blanket-approval checkpoint as insufficient evidence when a subsequent code review surfaces defects the checkpoint's own agenda was not equipped to catch — which is exactly this situation.

**Recommended path:** fix CR-01 and CR-02 in a small follow-up plan, then re-run (or extend) the human checkpoint with per-row, both-theme verdicts specifically covering (a) return-from-detail focus landing on the correct element on mobile, and (b) what a screen reader actually announces for a card row carrying a status badge — neither of which the existing `20-VALIDATION.md` agenda asked the developer to check.

---

_Verified: 2026-08-13T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
