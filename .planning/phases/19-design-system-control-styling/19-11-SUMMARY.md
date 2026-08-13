---
phase: 19-design-system-control-styling
plan: 11
subsystem: ui
tags: [css, border-radius, opacity, focus-ring, accessibility, vitest, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling
    provides: "plan 19-10's four-rung z-index ladder (CR-01) and its assertNotAtRuleHead-guarded test helpers, both in the same two files this plan edits"
provides:
  - "border-radius: 0 on .segmented__option (0,1,0), cancelling the button baseline's border-radius: var(--radius-control) (0,0,1) so every middle option in a 3+-option segmented group renders square instead of a fully-rounded pill (CR-02)"
  - "opacity: 1 restored under :disabled:focus-visible, [aria-disabled=\"true\"]:focus-visible (0,2,0), so a focusable-and-disabled control (calendar rest days) no longer composites its focus ring below the file's audited 3.40:1/6.02:1 contrast (CR-03)"
  - "Two anchored vitest assertions, each watched RED against the shipped defect before its stylesheet fix landed"
  - "Corrected D-10 comment naming all three live 3+-option segmented groups; corrected disabled-rule comment removing the false 'pagination labels' claim"
affects: [19-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anchored ';'-split fragment assertions (not .toContain substring checks) for border-radius/opacity values whose neighbouring declarations share a text prefix, so a merged or restructured rule cannot false-positive"
    - "RED-before-fix discipline applied to CSS specificity-cascade defects: the failing assertion is written and run against the shipped rule body first, its verbatim failure recorded, only then is the declaration added"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Both RED assertions were written and run BEFORE their respective CSS fixes landed, and the verbatim failures (Task 1: missing border-radius: 0 fragment in .segmented__option's body; Task 2: no rule found declaring opacity: 1 for :disabled:focus-visible/[aria-disabled=\"true\"]:focus-visible) were recorded, per the plan's anti-false-green requirement"
  - "WR-03 (ten selectors with literal 4px/8px/6px radii) stayed out of scope per the plan's own scope_fence — no literal border-radius was migrated in this plan"
  - "The 5 pre-existing npm test file-collection failures (ENOENT on gitignored data/stats/*.json, documented in 19-10-SUMMARY.md and deferred-items.md) recur unchanged in this plan's gate runs — confirmed unrelated to styles.css/styles.test.ts and not re-logged as a new finding"

patterns-established: []

requirements-completed: [UI-02]

# Metrics
duration: 20min
completed: 2026-08-13
---

# Phase 19 Plan 11: CR-02/CR-03 segmented-radius and focus-ring-opacity fixes Summary

**Closed two shipped defects the 19-05 checkpoint never exercised — segmented middle options rendering as rounded pills instead of square-jointed segments (CR-02), and a focus ring compositing below its own documented 3:1 contrast floor on focusable-but-disabled calendar rest days (CR-03) — each fix guarded by an anchored assertion watched failing against the real shipped rule body before the stylesheet changed.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-13T07:09:00Z
- **Completed:** 2026-08-13T07:29:00Z
- **Tasks:** 2
- **Files modified:** 2 (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`)

## Accomplishments

- Added `border-radius: 0` to `.segmented__option` (specificity `0,1,0`), cancelling the `button` baseline's `border-radius: var(--radius-control)` (`0,0,1`) that reached every option with no cancellation — the three live 3+-option Trends groups (5-option tablist, 3-option volume granularity, 3-option training-load window) were rendering fully-rounded middle options; the two `0,1,1` end-child rules and the `button` baseline itself are untouched
- Added `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` (specificity `0,2,0`) immediately after the base disabled rule, restoring the audited 3.40:1 light / 6.02:1 dark ring contrast on calendar rest days (real, focusable `<button>`s carrying only `aria-disabled="true"`) — previously composited at 2.19:1 / 2.93:1, both failing the 3:1 SC 1.4.11 non-text floor
- Corrected the D-10 comment (`.segmented__option:first-child`'s preceding comment) to name CR-02, the `0,0,1`/`0,1,0`/`0,1,1` specificity chain, and all three live 3+-option groups with their `trends.ts` line numbers and middle-option labels
- Corrected the disabled-rule comment's false "pagination labels" claim — `.pagination__label` is a `<span>` that no disabled selector ever matches; the real disabled pagination controls (prev/next) use the native `disabled` property and are therefore never focusable, confirmed by reading `list.ts:491`, `:521`, `:526-528`
- Both fixes' RED failures were recorded verbatim before any CSS edit, proving the new assertions would have caught the shipped defects

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the middle-option assertion RED, then cancel the baseline radius on .segmented__option (CR-02)** - `cd13723` (fix)
2. **Task 2: Write the ring-contrast assertion RED, then keep the focus ring at full opacity on focusable disabled controls (CR-03)** - `af4685c` (fix)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — STATE.md/ROADMAP.md excluded; orchestrator applies those centrally after merge)

## Files Created/Modified

- `src/dashboard/styles.css` — `.segmented__option` gained `border-radius: 0` and its preceding D-10 comment was rewritten to name CR-02 and all three affected groups; a new `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` rule was added after the base disabled rule, whose own comment was corrected to remove the false "pagination labels" claim and gained a new reconciliation paragraph explaining the CR-03 fix.
- `src/dashboard/styles.test.ts` — added one anchored assertion for `.segmented__option`'s own `border-radius: 0` fragment (plus a baseline-intact check) inside the `Phase 19 focus ring` describe block, and one anchored assertion for the `:focus-visible` opacity restoration (plus an at-rest `opacity: 0.6` check) inside the `Phase 19 disabled treatment` describe block.

## Task 1 — Verbatim RED output (Step 1, recorded before any CSS change)

```
AssertionError: expected [ 'background: var(--surface)', …(4) ] to include 'border-radius: 0'

 ❯ src/dashboard/styles.test.ts:591:23

Test Files  1 failed (1)
     Tests  1 failed | 50 passed (51)
```

The full fragment list from the shipped `.segmented__option` body, captured via the acceptance-criteria node one-liner immediately after the RED run (confirming the assertion's failure message reflects the real defect):

```json
["background: var(--surface)","color: var(--text-secondary)","border: none","padding: var(--space-xs) var(--space-md)","cursor: pointer"]
```

No `border-radius` fragment anywhere — proving the assertion would have caught CR-02 before it shipped.

## Task 1 — Declaration added, with line numbers (post-fix)

- `src/dashboard/styles.css` — `.segmented__option` gains `border-radius: 0;` as its fourth declaration (after `border: none`, before `padding`). No other declaration in that rule changed.
- `src/dashboard/styles.css` — the D-10 comment preceding `.segmented__option:first-child` was rewritten (net +21 lines) to add the CR-02 finding, the specificity chain, and the three-group audit; the original "reproduce the previous rounded silhouette without clipping anything" sentence is preserved verbatim.
- The `button` baseline (`border-radius: var(--radius-control)`), both end-child rules, `.segmented__option--active`, and `.segmented`'s own `border-radius` are all byte-identical to before this plan — confirmed by the acceptance-criteria node one-liner.

## Task 1 — Amended D-10 comment (as written)

> D-10: .segmented used to get its rounded silhouette entirely from `overflow: hidden` clipping its square children — which also clipped the focus ring (D-09) on the active option. The container's own `border-radius` above still draws the outer border sliver; these two end-child rules reproduce the previous rounded silhouette without clipping anything.
>
> CR-02 (19-REVIEW.md): that "without clipping anything" claim was true for exactly two options. `button { border-radius: var(--radius-control) }` (this file, § Phase 19 — Design System & Control Styling button baseline) is specificity `0,0,1` and reaches every `.segmented__option`, which declared no `border-radius` of its own and so never cancelled it — every middle option in a 3+-option group got 4px on all four corners, while the page background showed through a notch at every internal join (nothing else clips them square once `overflow: hidden` was removed from `.segmented`, see the note above). `.segmented__option`'s own `border-radius: 0` above is `0,1,0`: it beats the `0,0,1` baseline and is itself beaten by these two end-child rules at `0,1,1`, so end caps keep their radii with no ordering dependency and the button baseline itself is never touched. Three live 3+-option groups exist, all in `src/dashboard/views/trends.ts`: the 5-option Trends tablist (`trends.ts:1110`, 3 middle options — Year-over-Year, Cadence & HR, Training Load), the 3-option volume-granularity group (`trends.ts:595`, 1 middle option — Monthly), and the 3-option training-load-window group (`trends.ts:867`, 1 middle option — 12mo). The two-option Edwards/Banister model group (`trends.ts:811`) and the detail view's two-option x-axis toggle (`detail-charts.ts:258`) have no middle option and were never affected. This shipped unobserved because the only segmented control any 19-05 checkpoint row had ever named was that two-option detail-view toggle.

## Task 1 — Reachability audit (Step 4)

Every `.segmented` container in the codebase, derived by reading `trends.ts` and `detail-charts.ts` (not by grep count alone):

| Container | File:line | `role` | Options | Middle option(s) | Changes under this fix? |
|-----------|-----------|--------|---------|-------------------|--------------------------|
| Trends tab list | `trends.ts:1110` (container), `TREND_TAB_KEYS` at `trends-logic.ts:20-26` (5 keys) | `tablist` | 5 — Volume, Year-over-Year, Cadence & HR, Training Load, Gear | **3: Year-over-Year, Cadence & HR, Training Load** | **Yes** — those 3 now render square |
| Volume granularity | `trends.ts:595` | `group`, `aria-label="Volume granularity"` | 3 — Weekly, Monthly, Yearly | **1: Monthly** | **Yes** |
| Training-load window | `trends.ts:867`, options from `TRAINING_LOAD_WINDOWS` at `trends-training-load-logic.ts:158` | `group`, `aria-label="Training load window"` | 3 — 3mo, 12mo, All | **1: 12mo** | **Yes** |
| TRIMP model toggle | `trends.ts:811` | `group`, `aria-label="TRIMP model"` | 2 — Edwards, Banister | none | **No — must look byte-identical** |
| Detail view x-axis toggle | `detail-charts.ts:258` | `group`, `aria-label="Chart x-axis"` | 2 — Distance, Time | none | **No — must look byte-identical** |

The active-option fill (`--accent-strong`) makes the defect loudest on an active middle option — selecting "12mo", "Monthly", or any of the three middle Trends tabs previously rendered a fully-rounded accent pill inside its group; inactive middles showed a subtler surface-vs-background notch, more visible in dark theme.

## Task 2 — Verbatim RED output (Step 1, recorded before any CSS change)

```
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/dashboard/styles.test.ts:521:75

Test Files  1 failed (1)
     Tests  1 failed | 51 passed (52)
```

`selectorListDeclares(':disabled:focus-visible', 'opacity: 1')` returned `false` because no rule in the shipped stylesheet declared that selector at all — proving the assertion would have caught CR-03 before it shipped, against a suite that had 838 tests passing at this point with the defect present.

## Task 2 — Declaration added, with line numbers (post-fix)

- `src/dashboard/styles.css` — new rule `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1; }` added immediately after the base `:disabled, [aria-disabled="true"] { color; opacity: 0.6; cursor: default; }` rule. The base rule's own three declarations are unchanged.
- `src/dashboard/styles.css` — the base disabled rule's comment was corrected (the false "pagination labels" sentence removed and replaced with the corrected facts) and a new comment was added above the new rule, covering: the focusable-while-`aria-disabled` mechanism, the opacity-composites-box-shadow mechanism, the measured 2.19:1/2.93:1 vs the 3:1 floor, the D-07 reconciliation (persisting cues), and the rejected inner-content alternative.
- The bare `:focus-visible` rule (`outline: none`, the two-tone `box-shadow`, `position: relative`, `z-index: 1`) is unchanged — confirmed both by `git diff` showing no hunk inside it and by the file still containing exactly one `box-shadow` declaration.

## Task 2 — Corrected pagination-label facts (as written, with `list.ts` line numbers)

> CORRECTED (CR-03, 19-REVIEW.md): this comment used to cite "pagination labels" as a second informative-but-disabled case the 0.6 opacity keeps legible. That was never true, confirmed by reading `list.ts`: `.pagination__label` is a `<span>` (`list.ts:526-528`) that neither `:disabled` nor `[aria-disabled="true"]` ever matches. The genuinely disabled pagination controls are prev/next (`list.ts:491`, `list.ts:521`), which use the real `disabled` property and are therefore never focusable — a `<button disabled>` cannot receive focus, so they never interact with the `:focus-visible` restoration below.

`grep -c 'pagination labels' src/dashboard/styles.css` returns `0` — the false claim is fully gone.

## Task 2 — New rule's comment (as written)

> CR-03 (19-REVIEW.md): `opacity` applies to an element's entire rendered output, including its own `box-shadow` — so the disabled rule above composited the `:focus-visible` ring (styles.css, § Global focus ring) at 60% on any element that is BOTH focusable and disabled/aria-disabled. `[aria-disabled="true"]` controls can still be focusable, and calendar rest days deliberately are (`calendar.ts:118-131`): real `<button>` elements with no `disabled` attribute, kept in the Tab order on purpose. Recomputing the focus-ring comment's own W3C relative-luminance numbers with the accent ring stop blended at 60% over the backdrop gives 2.19:1 light and 2.93:1 dark — both fail the 3:1 SC 1.4.11 non-text floor that comment documents the unblended ring clearing at 3.40:1 / 6.02:1. Full opacity restored under `:focus-visible` recovers those audited numbers.
>
> This does not re-open D-07 while focused: `color: var(--text-secondary)` and `cursor: default` both persist from the rule above (only `opacity` is overridden here), and the shared hover rule (this file, § Phase 19 button baseline) still lists both `:disabled` and `[aria-disabled="true"]` in its `:where(:not(...))` exclusion regardless of focus state — so the control keeps reading as disabled at rest and while focused; the only cue dropped is the dimming, in the one state where the ring must be legible.
>
> Rejected alternative: moving the dimming off the disabled element onto an inner content wrapper instead of restoring `opacity`. The disabled rule above is global and reaches elements with no inner wrapper (e.g. bare `<button disabled>`), and a `> *` variant would not dim bare text nodes, so this alternative cannot replace the element-level `opacity` uniformly.
>
> `:disabled:focus-visible` is specificity `0,2,0`, mirroring D-07's dual selector even though it is symmetric rather than live today — a `<button disabled>` is not focusable, so only the `[aria-disabled="true"]:focus-visible` arm actually fires (calendar rest days). Both are kept so a future disabled-but-focusable case is covered without another edit here.

## Task 2 — Stated non-proof

Neither this task's assertion nor Task 1's proves anything about rendered contrast or rendered silhouette. `vitest` runs `environment: 'node'` — there is no CSSOM and no rendering engine in this test run. The assertions above prove only that the declarations exist, are anchored to the correct rule, and do not regress the declarations around them. **Row 17 of plan 19-12's checkpoint (tab to a calendar rest day, in both themes) is the sole proof the ring is actually legible there; rows 14-16 are the sole proof the three affected segmented groups actually render square.**

## Test counts

- `npx vitest run src/dashboard/styles.test.ts`: **52/52 passing** (up from 50 pre-plan — one new assertion per task, 2 net new).
- `npm test` (full suite): **839 tests passed, 0 failed**. Delta: 837 (19-10-SUMMARY.md baseline) → 838 after Task 1's new assertion → 839 after Task 2's new assertion, +2 total, 0 removed. 5 test *files* still fail to collect (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) with `ENOENT` on gitignored `data/stats/*.json` fixtures — the same pre-existing, worktree-environment-caused gap 19-10-SUMMARY.md logged in `deferred-items.md`, confirmed unchanged and unrelated to `src/dashboard/styles.css`/`styles.test.ts`, not re-logged as a new finding.
- `npx tsc --noEmit -p tsconfig.json`: exit 0 (both task gates).
- `npm run build-widgets`: exit 0, zero `css-syntax-error` occurrences in either captured log (`/tmp/bw11a.log`, `/tmp/bw11b.log`).

## Decisions Made

- Both RED assertions were written and run before their respective CSS edits, and the verbatim failures are recorded above — confirming each new assertion is a real guard against the shipped defect, not a fix restated as a test.
- Used the plan's mandated anchored `;`-split fragment check (not `.toContain` substring matching) for both `border-radius: 0` and `opacity: 1`, because in both cases a neighbouring declaration's value begins with the same characters as the target fragment (`border-radius: 0 var(...)` on the end-child rules; no direct collision for `opacity` today, but the pattern was applied uniformly per the plan's Step 1 instruction).
- Did not migrate any of WR-03's ten literal-radius selectors — out of scope per the plan's own `<scope_fence>`.

## Deviations from Plan

### Auto-fixed Issues

None — this plan's two tasks were followed exactly as written; no bugs, missing functionality, or blocking issues were discovered during execution beyond what the plan itself already diagnosed.

**Total deviations:** 0.

## Issues Encountered

None. The 5 pre-existing `npm test` file-collection failures (ENOENT on gitignored `data/stats/*.json`, a structural characteristic of this git-worktree-isolated checkout) recurred identically in both task gates, exactly as documented in `19-10-SUMMARY.md` and `deferred-items.md` — confirmed unrelated to this plan's two files and not re-logged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Not proven by anything in this plan** (stated per the plan's own `<verification>` closing note): that middle options actually render square, or that the ring is actually legible on a focused calendar rest day, in a real browser. Rows 14-17 of plan 19-12's checkpoint are the sole proof of both rendered outcomes. This plan's green source-level suite is the precondition for opening that checkpoint, never a substitute for it.
- All acceptance-criteria code-level checks pass for both tasks: RED-then-GREEN on each assertion, exact declarations added with no collateral changes to neighbouring rules, `:focus-visible`'s own rule body byte-identical, exactly one `box-shadow` declaration in the file, no TypeScript view file touched, no `package.json` entry touched, no DOM/rendering test dependency introduced.
- WR-03 (ten literal-radius selectors) remains open and out of scope, per the plan's `<scope_fence>` — unchanged by this plan.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `src/dashboard/styles.css`
- FOUND: `src/dashboard/styles.test.ts`
- FOUND: `.planning/phases/19-design-system-control-styling/19-11-SUMMARY.md`
- FOUND commit: `cd13723` (Task 1)
- FOUND commit: `af4685c` (Task 2)
- FOUND commit: `7f8389e` (SUMMARY metadata)
