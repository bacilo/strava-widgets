---
phase: 19-design-system-control-styling
verified: 2026-08-13T06:05:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "UI-01: dead --radius-control token (GAP 1) — confirmed closed. --radius-control now resolves to 4px in the shipped bundle and no code-review finding contradicts input/select/textarea styling."
    - "UI-02 (partial): the specific GAP 1/GAP 2 mechanisms recorded in the prior verification (dead radius token; detail-view segmented-control ring occlusion by chart/sibling) are both confirmed closed in source (styles.css:826-834 use var(--radius-control) correctly; :focus-visible now has position: relative; z-index: 1 at styles.css:382-384)."
  gaps_remaining: []
  regressions:
    - "UI-02 truth is still FAILED overall — not because GAP 1/GAP 2 reopened, but because a code review completed after the 19-09 checkpoint (19-REVIEW.md) found three NEW critical defects that were never covered by the checkpoint's blanket approval: CR-01 (:focus-visible's new z-index: 1 paints focused controls over the sticky .app-nav, which has no z-index of its own — a regression introduced by plan 19-07's own fix for GAP 2), CR-02 (the button baseline's border-radius rounds middle .segmented__option children in every 3+-option segmented group — three shipped Trends controls — because .segmented__option declares no radius of its own; the developer's row-12 check only looked at the two-option detail-view control), and CR-03 (opacity: 0.6 on [aria-disabled=\"true\"] composites the focus ring below the file's own 3:1 contrast floor on calendar rest days, a real and common case). All three are independently confirmed against styles.css and the calling view files in this verification pass, not merely asserted by the review."
gaps:
  - truth: "UI-02 (ROADMAP SC2): buttons and selects share one visual treatment, with a :focus-visible ring that meets non-text contrast requirements, visible in both dark and light themes"
    status: failed
    reason: "Three independently-confirmed defects directly contradict this success criterion. (1) CR-02: segmented controls with 3+ options (Trends tablist — 5 options, volume-granularity group — 3 options, training-load window group — 3 options, all in src/dashboard/views/trends.ts) render their middle options as fully-rounded accent pills instead of square-jointed D-shapes, because `button { border-radius: var(--radius-control) }` (styles.css:1253) reaches every `.segmented__option` and the class declares no `border-radius` of its own (styles.css:837-843) to cancel it — only :first-child/:last-child override it. This is NOT one shared visual treatment across segmented controls; the two-option detail-view control (the only one the 19-09 checkpoint's row 12 agenda names) looks correct, but the 3+-option Trends controls do not. (2) CR-03: `:disabled, [aria-disabled=\"true\"] { opacity: 0.6 }` (styles.css:1300-1304) applies to the same element that carries the :focus-visible ring on calendar rest-day buttons (real, focusable <button> elements per calendar.ts:120-131, only aria-disabled not disabled), and opacity dims the ring's box-shadow along with everything else, dropping computed non-text contrast from the file's own claimed 3.40:1/6.02:1 to roughly 2.19:1 light / 2.93:1 dark — both under the SC 1.4.11 3:1 floor this exact success criterion requires. Neither defect was covered by the 19-09 checkpoint's single blanket verdict (\"Everything looks good. Approved.\") — the checkpoint agenda for row 12 named only the two-option detail-view toggle, and row 5/6 never drove focus onto a calendar rest day to inspect ring contrast."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "Line 1253 (button baseline radius reaches .segmented__option with no override at 837-843, CR-02); lines 1300-1304 (opacity: 0.6 composites the focus ring below 3:1 on focusable aria-disabled elements, CR-03); lines 382-384 (:focus-visible's new z-index: 1 has no counterpart z-index on .app-nav at line ~166, CR-01 — a related paint-order regression from the same GAP-2 fix, affecting every page since .app-nav is global)."
    missing:
      - "Add `.segmented__option { border-radius: 0 }` (or equivalent) so the button baseline's radius does not leak into middle options of 3+-option segmented groups (CR-02 fix)."
      - "Restore full opacity on the focus ring for aria-disabled/disabled elements that remain focusable, e.g. `:disabled:focus-visible, [aria-disabled=\"true\"]:focus-visible { opacity: 1 }` (CR-03 fix)."
      - "Give `.app-nav` an explicit z-index above :focus-visible's z-index: 1 (e.g. z-index: 20) so a focused/scrolled control does not paint over the sticky header (CR-01 fix)."
      - "Add regression assertions for all three, since the current 919-test suite has zero coverage tying .segmented__option's own radius, the disabled-opacity/focus-ring interaction, or .app-nav's stacking order to these invariants."
deferred: []
---

# Phase 19: Design System Control Styling Verification Report

**Phase Goal:** Form controls, buttons, selects and card/spacing rhythm follow one shared visual treatment across all five screens (Overview, Activities, Calendar, Records, Trends), fixing the root cause of the "raw" feel without changing the existing visual language.
**Verified:** 2026-08-13T06:05:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 19-06..19-09) and a subsequent code review (19-REVIEW.md)

## Summary

Plans 19-01..19-05 shipped, but the 19-05 human checkpoint returned PARTIAL on two defects (dead `--radius-control` token; occluded focus ring). Plans 19-06..19-09 closed both — this is independently confirmed in source below. The 19-09 checkpoint then returned a **single blanket approval** ("Everything looks good. Approved.") covering rows 1, 3, 6 and 12 together, not a per-sub-check report; `19-VALIDATION.md` states this granularity limit explicitly. An objective probe did independently confirm the precondition those rows depend on (`--radius-control` resolving to `4px`, a sampled control computing `border-radius: 4px`) — that part of the evidence is solid and is treated as such below.

A code review completed after that checkpoint (`19-REVIEW.md`, `status: issues_found`, 3 critical) found three defects the checkpoint never exercised. This verification independently re-confirmed all three directly against `styles.css` and the relevant view files (not by trusting the review's prose):

- **CR-01** — `:focus-visible`'s `z-index: 1` (styles.css:382-384) has no counterpart on `.app-nav` (`position: sticky`, styles.css:159-168, no `z-index` declared anywhere in the file for it — confirmed via `grep -n z-index styles.css`, which shows exactly three declarations: `:focus-visible`, `.splits-table__km`, `.records-jump`, none of them `.app-nav`). A focused/scrolled control now paints over the sticky header on every page.
- **CR-02** — `button { border-radius: var(--radius-control) }` (styles.css:1253) reaches every `.segmented__option`, which declares no `border-radius` of its own (styles.css:837-843) to cancel it; only the `:first-child`/`:last-child` rules override it. Confirmed three live 3+-option segmented groups exist in `src/dashboard/views/trends.ts`: the tab list (`TREND_TAB_KEYS`, 5 keys, trends-logic.ts:20-26 → 3 middle options), the volume-granularity group (`VOLUME_GRANULARITIES`, 3 values → 1 middle option), and the training-load window group (`TRAINING_LOAD_WINDOWS`, 3 values → 1 middle option). The only control the 19-09 checkpoint's row 12 agenda named is the two-option detail-view toggle, which is unaffected — the defect is real and unobserved.
- **CR-03** — `[aria-disabled="true"] { opacity: 0.6 }` (styles.css:1300-1304) applies to calendar rest-day buttons, confirmed in `calendar.ts:120-131` to be real, focusable `<button>` elements (no `disabled` attribute, only `aria-disabled="true"`) — so `:focus-visible` matches them and the ring is dimmed to ~0.6 alpha alongside everything else, per the review's contrast recomputation dropping both themes below the file's own documented 3:1 SC 1.4.11 floor.

None of these three is covered by any test in `styles.test.ts` (confirmed by grep: no assertion references `.app-nav`'s z-index, `.segmented__option`'s own `border-radius`, or a disabled/focus-ring contrast interaction). All 919 tests still pass; that is expected and does not bear on these gaps.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01 — every input/select/textarea renders with consistent border, padding, background, min-height and control radius across all five screens | ✓ VERIFIED | `--radius-control` resolves to `4px` (probe-confirmed in `19-VALIDATION.md`, precondition independently sound). No code-review finding contradicts input/select/textarea styling specifically. |
| 2 | UI-02 — buttons/selects share one visual treatment, with a `:focus-visible` ring that meets non-text contrast requirements, visible in both themes | ✗ FAILED | CR-02 (segmented middle-option rounding on 3+-option Trends controls) and CR-03 (ring contrast drops below 3:1 on focusable calendar rest days) both directly and verifiably contradict this criterion. CR-01 (nav z-index) is a related paint-order regression affecting every page. |
| 3 | UI-03 — spacing, density and card treatment read as one rhythm across all five screens | ✓ VERIFIED | `--radius-panel` resolves correctly; five D-13 panel/grid edits ship as valid CSS. WR-03 (partial token adoption — 10 selectors still hardcode literal `4px`/`8px`/`6px`) is a maintainability warning, not a rendering break: the literal values match the token values, so the rendered rhythm is currently consistent. |
| 4 | ACT-01 — Activities controls adopt shared styling; row-click interaction model preserved as reference pattern | ✓ VERIFIED | `src/dashboard/views/list.ts` has zero diff across the entire Phase 19 commit range (confirmed via `git log`). No CSS rule affects `pointer-events`/hit-testing on `.activity-table` rows. |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/styles.css` | Radius tokens, control baselines, focus ring, panel rhythm, segmented control, disabled treatment | ⚠️ PARTIAL | GAP 1/GAP 2 (dead token, ring occlusion) are genuinely closed. Three new confirmed defects remain: `.segmented__option` has no own `border-radius` (CR-02, line 837-843 vs. 1253), `[aria-disabled="true"]`'s `opacity: 0.6` composites under the ring on focusable elements (CR-03, lines 1300-1304), `.app-nav` has no `z-index` to beat `:focus-visible`'s new `z-index: 1` (CR-01, line ~166 vs. 382-384). |
| `src/dashboard/styles.test.ts` | Regression coverage for Phase 19 rules | ⚠️ PARTIAL | 919/919 tests pass; zero tests cover any of the three defects above (confirmed via targeted grep — no assertion references `.app-nav` z-index, `.segmented__option`'s own radius, or focus-ring/opacity interaction). |
| `src/dashboard/views/list.ts` | Unmodified | ✓ VERIFIED | Zero diff across the Phase 19 commit range. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `button` baseline (styles.css:1253) | `.segmented__option` middle children | inherited `border-radius: var(--radius-control)`, no override | ✗ NOT_WIRED (defect) | Middle options of 3+-option segmented groups render fully rounded instead of square-jointed; confirmed live in Trends (tablist, volume-granularity group, training-load window group). |
| `:focus-visible` box-shadow ring | `[aria-disabled="true"]` elements (calendar rest days) | shared element, `opacity: 0.6` composited over box-shadow | ✗ NOT_WIRED (defect) | Ring drops below the file's own documented 3:1 non-text contrast floor when the element is both focused and aria-disabled. |
| `:focus-visible` z-index: 1 | `.app-nav` (sticky, no z-index) | CSS 2.1 Appendix E paint order | ✗ NOT_WIRED (defect) | Focused control paints over the sticky global nav on every route; confirmed no `.app-nav` z-index exists anywhere in the file. |
| `--radius-control` token | `input, select, textarea` / `button` baselines | `var(--radius-control)` | ✓ WIRED | Confirmed resolves to `4px` per the 19-09 objective probe; GAP 1 genuinely closed. |
| `.segmented` `overflow: hidden` removal + end-child radius rules | Two-option detail-view toggle | `:first-child`/`:last-child` radius | ✓ WIRED | Confirmed correct for the specific two-option control the checkpoint examined. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/styles.css` | 382-384 vs. ~166 | `:focus-visible`'s `z-index: 1` with no counterpart `z-index` on `.app-nav` | 🛑 BLOCKER | CR-01 — focused controls paint over the sticky global nav on every page. |
| `src/dashboard/styles.css` | 837-843 vs. 1253 | `.segmented__option` has no own `border-radius` to cancel the `button` baseline | 🛑 BLOCKER | CR-02 — middle options of 3+-option segmented groups render as rounded pills, breaking "one shared visual treatment" for segmented controls specifically. |
| `src/dashboard/styles.css` | 1300-1304 vs. 382-384 | `opacity: 0.6` composites under the focus ring on focusable aria-disabled elements | 🛑 BLOCKER | CR-03 — non-text contrast requirement (SC1.4.11, 3:1) fails on calendar rest days, a common, real case (roughly a third to half of a typical month's grid). |
| `src/dashboard/styles.css` | various (10 selectors) | Partial radius-token adoption — literal `4px`/`8px`/`6px` instead of `var(--radius-control)`/`var(--radius-panel)` | ⚠️ WARNING | WR-03 — not currently a rendering defect (values match), but a future retune of either token will silently split the control set. |
| `src/dashboard/styles.test.ts` | 379-388 | Hover-exclusion test only asserts 2 of 4 required tint exclusions | ⚠️ WARNING | WR-01 — test would still pass if two of the four exclusions were deleted. |
| `src/dashboard/styles.test.ts` | 97, 121, 164 | Rule-scanning helpers cannot see inside `@media` blocks | ⚠️ WARNING | WR-02 — no current assertion is wrong because of it, but any future responsive-rule claim would silently fail closed or match the wrong block. |
| — | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan | — | None found. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite green | `npm test` | 919/919 passed, 46 files | ✓ PASS |
| TypeScript clean | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| `.app-nav` has no z-index; `:focus-visible` has `z-index: 1` | `grep -n "z-index\|position: sticky" src/dashboard/styles.css` | Confirmed: exactly 3 `z-index` declarations in the file (`:focus-visible`, `.splits-table__km`, `.records-jump`); `.app-nav` (line 166, `position: sticky`) has none | ✓ PASS (confirms CR-01) |
| `.segmented__option` declares no own `border-radius` | Read `src/dashboard/styles.css:837-843` | Confirmed — only `background`, `color`, `border`, `padding`, `cursor` | ✓ PASS (confirms CR-02 precondition) |
| 3+-option segmented groups exist in Trends | `grep -n TREND_TAB_KEYS/VOLUME_GRANULARITIES/TRAINING_LOAD_WINDOWS` across trends.ts and logic files | Tablist = 5 keys, volume-granularity = 3, training-load window = 3 — all rendered via `.segmented`/`.segmented__option` | ✓ PASS (confirms CR-02 reachability) |
| Calendar rest days are real, focusable buttons with `aria-disabled` only | Read `src/dashboard/views/calendar.ts:120-131` | Confirmed — no `disabled` attribute set, only `aria-disabled="true"` | ✓ PASS (confirms CR-03 reachability) |
| No test covers any of the three new defects | `grep -n "app-nav.*z-index\|segmented__option.*radius\|focus-visible.*opacity"` in `styles.test.ts` | No matches | ✓ PASS (confirms review's "none of the three is detectable by the current suite" claim) |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 19-02, 19-04, 19-05, 19-06 | Form controls styled consistently | ✓ SATISFIED | Dead-token gap genuinely closed; no review finding contradicts input styling. `REQUIREMENTS.md`'s `[x]` is defensible. |
| UI-02 | 19-03, 19-04, 19-05, 19-07 | Shared button/select treatment + focus ring meeting contrast | ✗ BLOCKED | CR-02 and CR-03 directly contradict this requirement's own wording ("share one visual treatment", "meets non-text contrast requirements"). **`REQUIREMENTS.md` currently marks this `[x]` Complete — that mark is not defensible against the evidence in this verification and should be reopened.** |
| UI-03 | 19-01, 19-04, 19-05 | Spacing/density/card rhythm | ✓ SATISFIED | Independently re-verified; WR-03 is a maintainability warning only. |
| ACT-01 | 19-02, 19-03, 19-05 | Activities shared styling + preserved row-click model | ✓ SATISFIED | `list.ts` unmodified; no interaction-blocking CSS found. |

No orphaned requirements. **One requirement-status discrepancy found:** `REQUIREMENTS.md` line 15 currently reads `[x] UI-02 ... Complete`, citing the 19-09 checkpoint's blanket approval. This verification finds that mark not defensible — the checkpoint never exercised the specific controls (3+-option Trends segmented groups; focused calendar rest days) where the requirement's own text ("share one visual treatment", "meets non-text contrast requirements") demonstrably fails.

## Human Verification Required

None new for this pass — CR-01/CR-02/CR-03 are all deterministically confirmed against source (element structure, cascade specificity, computed z-index ordering, contrast arithmetic on documented color values), not matters of visual judgment. A future gap-closure pass should still include a brief human confirmation that the CSS fixes for CR-01/CR-02/CR-03 render as intended (this is standard practice for any CSS change in this codebase, per the project's own three-strikes history of green-gate rendering misses), but the defects themselves do not require human judgment to establish.

## Gaps Summary

**UI-02 remains FAILED**, carried forward from the prior verification round but for materially different reasons. The two specific mechanisms that blocked it before (dead `--radius-control` token; detail-view segmented-control ring occlusion) are genuinely closed by plans 19-06/19-07 — confirmed independently in source, not merely from the 19-09 checkpoint's blanket approval. However, a code review completed after that checkpoint found three new critical defects that the checkpoint's narrow agenda never exercised:

1. **CR-02** — the `button` baseline's `border-radius` leaks into every middle option of 3+-option `.segmented` groups (three live examples in Trends), because `.segmented__option` declares no radius of its own to cancel it. This is a direct, verifiable violation of "buttons and selects share one visual treatment" — the checkpoint's row 12 only looked at the two-option detail-view control, which is unaffected.
2. **CR-03** — `opacity: 0.6` on `[aria-disabled="true"]` composites under the `:focus-visible` ring on calendar rest-day buttons (real, focusable, aria-disabled-only elements), dropping non-text contrast below the file's own documented 3:1 floor — a direct violation of "a `:focus-visible` ring that meets non-text contrast requirements."
3. **CR-01** — `:focus-visible`'s new `z-index: 1` (the very fix that closed the prior round's GAP 2) has no counterpart on the sticky `.app-nav`, so a focused control can now paint over the global nav on any page. This is a genuine regression introduced by the gap-closure work itself.

All three are reproducible from source inspection alone (cascade specificity, DOM structure, z-index arithmetic, documented contrast math) and are not covered by any of the 919 passing tests. `REQUIREMENTS.md` currently marks UI-02 complete based on the 19-09 blanket approval; this verification finds that mark not defensible given these findings and recommends it be reopened pending a fix-and-reverify pass for CR-01/CR-02/CR-03.

UI-01, UI-03 and ACT-01 are independently confirmed genuinely complete and are not contradicted by any review finding.

---

_Verified: 2026-08-13T06:05:00Z_
_Verifier: Claude (gsd-verifier)_
