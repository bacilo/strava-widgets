---
phase: 19-design-system-control-styling
plan: 07
subsystem: styling
tags: [css, focus-ring, stacking-context, accessibility, gap-closure]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plan 06)
    provides: The restored --radius-control token and the parse-level test gate this plan builds its own gates on top of
provides:
  - "A :focus-visible rule promoted to its own stacking context (position: relative; z-index: 1), closing GAP 2 (19-05 checkpoint row 6)"
  - "Two mutation-checked assertions pinning the stacking declarations and the .records-jump ordering invariant"
  - "A corrected button-baseline comment naming the three real class-less <button> sites it is the first CSS for (WR-02/GD-02)"
  - "19-VALIDATION.md row 3 extended to put the class-less buttons on plan 19-09's re-verification agenda"
affects: [19-08, 19-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global :focus-visible stacking promotion: position: relative + a small positive z-index (1) promotes a focused element to CSS 2.1 Appendix E step 9, above step-7 in-flow siblings and step-8 positioned neighbours with no z-index of their own, while staying below any deliberately higher sticky layer (.records-jump at 10)"
    - "Numeric z-index comparison in tests: parse both values with a small regex helper and assert with toBeGreaterThan, not a string/substring check, so the assertion is retuning-proof"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md

key-decisions:
  - "GD-02 (from the plan): corrected the button baseline's comment instead of scoping the rule away from class-less buttons — scoping would re-open the inherited-font/cursor gap D-05 exists to close, and no TypeScript view file may be touched under D-05's no-refactor stance."

requirements-completed: [UI-02]

# Metrics
duration: 55min
completed: 2026-08-12
---

# Phase 19 Plan 07: Focus-Ring Paint-Order Fix & Button-Baseline Comment Correction Summary

**Promoted the global `:focus-visible` rule to its own CSS 2.1 Appendix E step-9 stacking context (`position: relative; z-index: 1`), closing GAP 2 (the 19-05 checkpoint's row 6 failure where the ring was covered by a later sibling and a positioned neighbour), pinned the fix with two mutation-checked source-level assertions, and corrected the `button` baseline's comment so it no longer claims a false "nothing changes shape or color" for three real, shipped class-less buttons.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 3 (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `19-VALIDATION.md`)

## Accomplishments

- GAP 2 closed at the source level: `:focus-visible` now declares `position: relative; z-index: 1` in addition to the existing `outline: none` and two-tone `box-shadow`, promoting every focused element above later in-flow siblings and positioned neighbours with no `z-index` of their own — while staying strictly below `.records-jump`'s deliberate `z-index: 10`
- A full blast-radius audit of applying that promotion globally was performed and is recorded below, covering every `position:`/`z-index:` rule in the file
- Two new assertions pin the stacking declarations and the sticky-layer ordering numerically; both were mutation-checked (three separate mutations, all failed for the expected reason, all reverted)
- WR-02/GD-02 closed: the `button` baseline comment no longer asserts a false blanket claim; it now names the three real class-less `<button>` sites (all in `calendar.ts`) and the three concrete visual deltas they receive
- `19-VALIDATION.md` row 3's test instructions extended to put those three buttons on plan 19-09's re-verification agenda; the Manual-Only table is still exactly 13 rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote the focus ring in paint order, and audit the blast radius of doing it globally** - `f389c8d` (fix)
2. **Task 2: Pin the stacking behaviour with assertions, mutation-check them, and state plainly what they do not prove** - `7900f9d` (test)
3. **Task 3: Make the button baseline's governing comment true (WR-02/GD-02)** - `6fdc4eb` (fix)

**Plan metadata:** this SUMMARY + updated docs, committed by the executor immediately after this file (worktree mode — STATE.md/ROADMAP.md excluded, owned by the orchestrator).

## Files Created/Modified

- `src/dashboard/styles.css` — added `position: relative; z-index: 1` to the bare `:focus-visible` rule (line 380); extended its governing comment with the paint-order mechanism, the two occluders the developer saw, and the `z-index: 1` rationale; rewrote the `button` baseline's comment (line ~1224) to name the three class-less sites and drop the false claim
- `src/dashboard/styles.test.ts` — added two assertions to the `Phase 19 focus ring` describe block (stacking-declaration presence, numeric ordering vs `.records-jump`), two new helper functions (`bodyForSelectorListToken`, `extractNumericDeclaration`), and extended the block's banner comment to state what the assertions do/do not prove
- `.planning/phases/19-design-system-control-styling/19-VALIDATION.md` — row 3's Test Instructions cell extended to name the three class-less buttons; row count unchanged at 13

## Exact Declarations Added to `:focus-visible` (Task 1)

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
  position: relative;
  z-index: 1;
}
```

`outline: none` and the box-shadow are unchanged (both load-bearing per D-09/D-12). The new
lines are `position: relative;` and `z-index: 1;`. The selector remains exactly `:focus-visible`
— bare, unscoped, no element/class/descendant qualifier prepended (D-12).

## Reasoning Comment as Written (Task 1, appended to the existing D-09/D-12 comment)

> GAP 2 (19-05 checkpoint row 6, closed by plan 19-07): a `box-shadow` paints as part of its OWN
> element's box, in that element's normal paint step. A non-positioned, non-promoted focused
> element paints in CSS 2.1 Appendix E step 7 (in-flow, in tree order) — so any later in-flow
> sibling paints over the overflow of its ring, and any positioned neighbour (step 8) paints
> over it regardless of tree order. That is exactly what the developer saw on the detail view's
> x-axis segmented control: the "Distance" option's ring was covered on the right by its later
> sibling, the "Time" option (`.segmented__option`, an in-flow step-7 sibling with an opaque
> `background: var(--surface)`), and on the bottom by `.chart-band__canvas-wrap`, a
> `position: relative` step-8 neighbour with no `z-index` of its own. This is a different
> mechanism from the `overflow: hidden` clip plan 19-04 already removed from `.segmented` — that
> fix remains necessary, it just was not sufficient. `position: relative` + `z-index: 1` below
> promotes the focused element to its own step-9 stacking context, painted after every step-7
> sibling and every step-8 positioned neighbour, so the ring always wins. `1` is the smallest
> value that clears those occluders (none of which declare a `z-index` above `auto`) while
> staying strictly below `.records-jump`'s deliberate `z-index: 10` (line ~1020), so the sticky
> jump bar still paints above a focused control elsewhere on the page. See 19-07-SUMMARY.md for
> the full blast-radius audit of promoting every focused element this way.

## Blast-Radius Audit (Task 1) — All Five Bullets, Named Rules and Line Numbers

**Full inventory of `position:`/`z-index:` rules re-checked against the fix** (`grep -n
"position:\|z-index" src/dashboard/styles.css` after the edit): app nav sticky (line 166, no
z-index), `:focus-visible` itself (lines 380-384, new), `.activity-table` (no position rules at
all — confirmed unaffected), `.chart-band__canvas-wrap` (line 799, `position: relative`, the
occluder), `.splits-table__km` (line 885, `position: sticky; z-index: 1`), `.pace-bar` (`position:
relative`) and its two `position: absolute` children `.pace-bar__tick`/`.pace-bar__fill`,
`.sr-only` (`position: absolute`), `.records-jump` (line 1020, `position: sticky; z-index: 10`),
`.pr-evolution-card__canvas-wrap` (line 1108, `position: relative`, same occluder class as the
chart wrap).

1. **Containing-block change for absolutely-positioned descendants.** Enumerated every
   `position: absolute` rule in the file: `.pace-bar__tick`, `.pace-bar__fill` (children of
   `.pace-bar`, a plain `<div>` created in `detail-sections.ts:88` with no `tabIndex` — never
   itself focusable, so its `position: relative` is pre-existing and unaffected by this change),
   and `.sr-only` (a visually-hidden `<span>`, `list.ts:170`, likewise never focusable; its
   sibling `.badge` container is a non-interactive `<span>` too). Grepped every view file for
   `tabIndex`/`tabindex` usage (`nav.ts`, `calendar.ts`, `detail.ts`, `list.ts`, `overview.ts`,
   `records.ts`, `trends.ts`): every hit is a heading (`tabIndex = -1`, scroll-to-heading pattern)
   or `trends.ts`'s tablist buttons/panel (`tabIndex = 0`/`-1`, no absolute-positioned
   descendant). **Conclusion: no absolutely-positioned element in this codebase is currently a
   descendant of any focusable element, so no containing-block change actually moves anything
   today.** This remains a latent class of risk for future additions (an absolutely-positioned
   child added inside a focusable ancestor would now resolve against that ancestor once
   focused), which is why the audit enumerates it rather than dismissing it.

2. **The `.splits-table__km` tie at `z-index: 1`.** `.splits-table__km` (line 885) is applied to
   `<td>`/`<th>` in `detail-sections.ts:55,168` and carries no `tabIndex` anywhere in the
   codebase — it is never itself focusable, so it never becomes the *subject* of the new
   `:focus-visible` rule. If a different, later cell in the same row became focusable and tied
   at `z-index: 1` with the sticky km column, standard CSS stacking resolves same-`z-index` ties
   by tree order — the later element in the DOM wins. Since `.splits-table__km` is always the
   first (leftmost) cell in its row, any focusable content elsewhere in that row is later in
   tree order and would win the tie, which is the desired outcome (the ring must not be covered
   by the sticky column). No focusable element inside `.splits-table__km` exists today, so this
   is confirmed structurally rather than observed.

3. **`.records-jump` (10) vs. a focused control elsewhere on the page.** Confirmed both
   numerically (Task 2's new assertion: `10 > 1`, mutation-checked by lowering `.records-jump`
   to `1` and observing the assertion fail) and by construction — `z-index: 1` was chosen
   specifically as the smallest value clearing the step-8 occluders while remaining below 10.
   `.records-jump` still paints above any focused control elsewhere on the page.

4. **Table-cell focusability and `position: relative` support on `<td>`/`<th>`.** Same
   `tabIndex` grep as bullet 1: no `<td>`/`<th>` in `src/dashboard` carries a `tabIndex` or
   `tabindex` attribute anywhere in the codebase, so no table cell is itself focusable and the
   new rule never actually applies `position: relative` to a `<td>`/`<th>` today. For the
   record, `position: relative` on table cells is well-supported across evergreen browsers (no
   CSS2.1 §17 restriction analogous to the historical `position: absolute`-on-table-box quirks)
   — moot here since it doesn't currently apply, but confirmed so a future change that DID make
   a cell focusable would not be silently unsupported.

5. **Ancestor `overflow` still clips a relatively-positioned element.** `position: relative`
   does not opt an element out of ancestor `overflow` clipping — clipping is governed by the
   ancestor's own `overflow` property regardless of the descendant's positioning scheme. Plan
   19-04's `.splits-scroll` `padding: var(--space-xs)` (verified still present, line ~848) and
   `.segmented`'s removed `overflow: hidden` (verified still absent — `.segmented` declares no
   `overflow` anywhere) remain necessary and are not superseded by this change; both are also
   pinned by existing `styles.test.ts` assertions in the same `Phase 19 focus ring` block that
   this plan's new assertions join.

**T-19G-ACT-08 (Activities row-click reference pattern).** `.activity-table` declares no
`position:`/`z-index:` rule at all (confirmed by the grep above), and `list.ts` is not touched by
this plan. The only focusable descendant of an `.activity-table` row is the activity-name anchor
(per `list.ts:331`'s comment, "already Tab+Enter operable"); that anchor gains
`position: relative; z-index: 1` on focus like every other link in the dashboard, with no
sibling/positioned-neighbour occlusion risk in that table (no positioned rule exists inside
`.activity-table` for it to be occluded by, or to occlude). No regression to the reference
pattern Phase 20 depends on.

**No interaction that would break the recommended fix was found.** The audit did not surface a
case requiring an improvised variant; the fix as specified in `<groundwork>` was applied exactly.

## Mutation-Check Transcript (Task 2 — three mutations, all reverted)

**Mutation 1 — removed `z-index: 1;` from `:focus-visible`:**
```
FAIL styles.css — Phase 19 focus ring > :focus-visible establishes a stacking context above later siblings and positioned neighbours
AssertionError: expected false to be true // Object.is equality

FAIL styles.css — Phase 19 focus ring > .records-jump paints above a focused control (strictly greater z-index, compared numerically)
Error: No numeric z-index declaration found in:
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
  position: relative;

Tests 2 failed | 44 passed (46)
```

**Mutation 2 — restored `z-index: 1`, removed `position: relative` instead:**
```
FAIL styles.css — Phase 19 focus ring > :focus-visible establishes a stacking context above later siblings and positioned neighbours
AssertionError: expected false to be true // Object.is equality

Tests 1 failed | 45 passed (46)
```
(The ordering assertion stayed green here, correctly — `z-index: 1` was still present, so the
numeric comparison itself had nothing to fail on; only the stacking-declaration presence check
failed, for the right reason.)

**Mutation 3 — restored `position: relative`, lowered `.records-jump`'s `z-index` from `10` to
`1`:**
```
FAIL styles.css — Phase 19 focus ring > .records-jump paints above a focused control (strictly greater z-index, compared numerically)
AssertionError: expected 1 to be 10 // Object.is equality

Tests 1 failed | 45 passed (46)
```

All three mutations reverted; `git status --porcelain src/dashboard/styles.css` returned empty
at task end. Final `npx vitest run src/dashboard/styles.test.ts`: **46/46 passing** (44 baseline
+ 2 new). Final `npm test`: **915/915 passing** (913 wave-6 baseline + 2 new).

**The two z-index values the ordering assertion read:** focus ring `z-index: 1`, `.records-jump`
`z-index: 10` — asserted via `extractNumericDeclaration` (parses `/property:\s*(-?\d+)/` out of
the rule body) and compared with `toBeGreaterThan`, not a string/literal comparison.

## Definitive Class-Less `<button>` List (Task 3, WR-02/GD-02)

**Method used to derive it:** started from the seven candidates GD-02 named (WR-02's original
three plus the four the 19-07 planning scan's 12-line-lookahead heuristic flagged in `trends.ts`)
and resolved each by reading its surrounding code directly — not by re-running or trusting the
lookahead heuristic, which the plan flagged as unreliable in either direction.

**Confirmed class-less (3 — matches WR-02 exactly):**
- `src/dashboard/views/calendar.ts:74` — `closeBtn`, the multi-run day picker's "Close" button.
  No `className`/`classList` assignment anywhere in `renderPicker` (lines 62-90).
- `src/dashboard/views/calendar.ts:257` — `prevBtn`, the month-nav "‹ {month}" button. No class
  assignment in its creation block (lines 257-263).
- `src/dashboard/views/calendar.ts:265` — `nextBtn`, the month-nav "{month} ›" button. Same
  scope, lines 265-271, no class assignment.

**Resolved as classed (4 — the planning scan's heuristic over-reported these as candidates):**
- `trends.ts:225` (`buildTabButton`) — classed via `applyTabButtonState(btn, isActive)`, called
  at line 231 before the button is returned/appended; sets `className` to
  `'segmented__option'`/`'segmented__option--active'`.
- `trends.ts:815`/`819` (`edwardsBtn`/`banisterBtn`) — both classed via `updateModelButtons()`,
  called synchronously at line 833, before either button is appended to the DOM (lines 848-849).
- `trends.ts:882` (the per-window button inside the `TRAINING_LOAD_WINDOWS.forEach` loop) —
  classed via `updateWindowButtons()`, called synchronously at line 894, immediately after the
  loop that creates and stores every button, before any of them render.
  In all four cases the class assignment happens in a separate update function outside the
  12-line lookahead window from the `createElement` call, which is exactly why the heuristic
  flagged them — but since that function always runs synchronously before the button is ever
  appended/painted, none of the four is actually class-less in the rendered DOM.

**Cross-check:** `grep -rn "createElement('button')" src/dashboard/` returns 31 sites total,
matching D-05's documented "31 `createElement('button')` sites" count exactly — confirms the
inventory this scan operated over is complete, not a partial grep.

## `19-VALIDATION.md` Row 3 Amendment

Row 3's Test Instructions cell (UI-02, "Buttons and selects read as one treatment...") now
reads, appended to the original instruction: *"Also inspect the three class-less `<button>`
elements the baseline styles directly (resolved by plan 19-07, WR-02/GD-02): the multi-run day
picker's 'Close' button and the month-nav '‹'/'›' buttons, all on Calendar
(`src/dashboard/views/calendar.ts:74`, `:257`, `:265`). Confirm their font, 32px height floor and
rounded corners read consistently with the 12 classed buttons, not as a fourth, differently-styled
treatment."* This extends row 3's existing scope rather than adding a new row; the Manual-Only
table still has exactly 13 rows (verified programmatically).

## Row 6 Status — Explicitly Unproven

**Row 6 (the focus-ring visibility itself) remains unproven by this plan.** No automated test in
this repository can observe rendered paint order — `vitest` runs `environment: 'node'`, with no
DOM/CSSOM. Everything in this SUMMARY and in the two new assertions proves that the *source*
declares the intended stacking (`position: relative; z-index: 1` present, `.records-jump`'s
z-index strictly greater) — none of it proves the ring is actually visible in a real browser on
the detail view's segmented control. Plan 19-09's human checkpoint, re-running row 6 in a real
browser, is the sole remaining proof.

## Decisions Made

- **GD-02 (from the plan, followed exactly).** Left the `button` rule itself untouched and
  unscoped; corrected only its comment. Rejected scoping the rule away from class-less buttons
  (would re-open the inherited-font/cursor gap D-05 exists to close) and rejected giving those
  buttons classes (would edit `calendar.ts`, contradicting D-05's no-refactor stance and
  widening Phase 19's file surface for zero rendered-result difference).

## Deviations from Plan

None — plan executed exactly as written. The blast-radius audit did not surface any interaction
that would break the recommended fix, so no architectural deviation (Rule 4) was triggered.

## Issues Encountered

None. Every mutation-check failure matched the expected reason on the first attempt; the
class-less-button resolution matched the plan's prediction that the heuristic "is not
authoritative in either direction" (it over-reported four `trends.ts` candidates that turned out
classed).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GAP 2 is closed at the source level; row 6 re-verification in a real browser is the one
  remaining open item, owned by plan 19-09's checkpoint.
- WR-02/GD-02 is closed; the comment is now accurate and the affected buttons are on plan 19-09's
  agenda via the row 3 amendment.
- `19-VALIDATION.md`'s Manual-Only table is unchanged in row count (13) and internally consistent
  with this plan's changes.
- No blockers identified for plan 19-08 or plan 19-09.

## Self-Check: PASSED

- FOUND: src/dashboard/styles.css
- FOUND: src/dashboard/styles.test.ts
- FOUND: .planning/phases/19-design-system-control-styling/19-VALIDATION.md
- FOUND commit: f389c8d (Task 1)
- FOUND commit: 7900f9d (Task 2)
- FOUND commit: 6fdc4eb (Task 3)

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
