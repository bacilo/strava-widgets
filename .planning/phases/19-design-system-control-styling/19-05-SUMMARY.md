---
phase: 19-design-system-control-styling
plan: 05
subsystem: ui
tags: [css, validation, human-checkpoint, gap-closure, dashboard]

# Dependency graph
requires:
  - phase: 19-01
    provides: "--radius-control (4px) and --radius-panel (8px) theme-invariant :root tokens; panel rhythm normalization"
  - phase: 19-02
    provides: "input/select/textarea control baseline"
  - phase: 19-03
    provides: "button baseline, shared hover, disabled treatment, .cta:hover repair, row-hover retrofit"
  - phase: 19-04
    provides: "two-tone focus ring, .segmented overflow removal and end-child radii, 5 new styles.test.ts describe blocks"
provides:
  - "Reconciled 19-VALIDATION.md: full four-command automated gate green (909/909 tests, clean tsc, clean build-widgets, 37/37 verify-dashboard checks), all 13 Manual-Only Verifications rows recorded with verbatim developer observations from a real-browser checkpoint"
  - "PARTIAL verdict with an explicit Gap-Closure Record naming 3 Phase 19 gaps and a separately-tracked Non-Phase-19 Issues subsection"
  - "Discovery: a stray `*/` inside a CSS comment at styles.css lines 54-56 silently discards --radius-control from the parsed stylesheet, invisible to every Phase 19 text-assertion test"
affects: ["a future 19-06/gap-closure plan (via /gsd-plan-phase 19 --gaps)", "any phase depending on Phase 19's control/button radius baseline being correct in production"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS comment bodies must never contain the literal sequence `*/` in prose (e.g. writing out a token-name list like `--space-*/--zone-*`) — it terminates the comment early and CSS error recovery silently discards the next declaration up to the following `;`, with zero automated-test visibility when the test suite only asserts against source text"

key-files:
  created:
    - .planning/phases/19-design-system-control-styling/19-05-SUMMARY.md
  modified:
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md

key-decisions:
  - "Recorded the checkpoint as PARTIAL per the 16-09/17-15 house rule: rows 1, 3 and 12 were each judged under a broken rendering condition (dead --radius-control token) and are marked blocked-by-defect rather than passes, even though the developer's verbatim words for those rows read as approving — the underlying defect invalidates the observation, and the record states that plainly instead of quietly upgrading it to a pass."
  - "Did not fix the dead-token CSS comment defect, the focus-ring occlusion, or any of the three non-Phase-19 issues (JS SyntaxError, dead click handler, Safari month-picker chrome) discovered during the checkpoint — per the plan's explicit prohibition on patching under checkpoint pressure and this task's own scope boundary (no changes under src/ or scripts/)."
  - "Logged the three non-Phase-19 issues in a clearly separate subsection of the Gap-Closure Record rather than folding them into the Phase 19 gap count, since Phase 19 shipped exactly two files (styles.css, styles.test.ts) and none of the three issues can originate from either — confirmed via `git diff --name-only 670b3ec..HEAD -- . ':(exclude).planning/*'`."

patterns-established:
  - "CSS comment `*/`-in-prose landmine: any future plan writing a code comment that lists custom-property name patterns with wildcards (`--foo-*`) must not let a `/` immediately follow a `*` inside the comment body."

requirements-completed: [UI-03, ACT-01]

# Metrics
duration: 35min
completed: 2026-08-12
---

# Phase 19 Plan 05: Validation & Human Checkpoint Summary

**Full automated gate green (909/909 tests, clean tsc/build/verify-dashboard) but the real-browser checkpoint returned PARTIAL: a stray `*/` inside a CSS comment silently discards `--radius-control` in the shipped bundle, invalidating three of thirteen manual verification rows, plus a genuine focus-ring occlusion defect on the detail view's segmented control.**

## Performance

- **Duration:** ~35 min (Task 1 in prior agent session + this continuation's Task 2 recording and Task 3)
- **Started:** 2026-08-12 (Task 1)
- **Completed:** 2026-08-12
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint, Task 3 auto)
- **Files modified:** 1 (`19-VALIDATION.md`) + this SUMMARY

## Automated Gate (Task 1, recorded 2026-08-12)

| Check | Result |
|---|---|
| `npm test` | exit 0, **909/909 passed** across 46 files (baseline pre-Phase-19: 884, +25 net) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, clean |
| `npm run build-widgets` | exit 0 |
| `npm run verify-dashboard` | exit 0, **37 checks passed, 0 failures** |

All four gate commands were green before the checkpoint opened. **None of them caught the defect described below** — every Phase 19 automated check is a text assertion over the literal characters of `styles.css`, and the source text does contain the correct `--radius-control: 4px` declaration. It is the *parsed* result, after CSS error recovery, that differs. `npm run build-widgets` did emit a corresponding esbuild warning (`▲ [WARNING] Expected ":" [css-syntax-error]` at `<stdin>:56:59`), which Task 1 recorded as a non-blocking comment warning — that classification was wrong, and is itself logged as a gap (GAP 3 below).

## Checkpoint

**URL:** `http://localhost:8099/strava-widgets/` (symlinked from `dist/widgets`, mounted under the `/strava-widgets` prefix — confirmed production-shaped, not root-served). Browser: Safari (inferred from WebKit-specific error wording and `<input type="month">` degrading to a text field).

**Verdict: PARTIAL 2026-08-12.** `nyquist_compliant: false`.

## All 13 Manual-Only Verifications Observations

1. **Inputs render intentionally (UI-01).** "sure" — **BLOCKED BY DEFECT.** All inputs were rendering 0px corners, not the intended 4px control radius, due to GAP 1 below. Requires re-verification after gap closure.
2. **Native chrome themes correctly (UI-01).** "good". Separate Calendar note: "the month picker is just a text box nothing opens" / "the month picker is not a panel but a text box and is a little wide to be honest" — logged as a non-Phase-19, pre-existing Safari `type="month"` degradation, not a Phase 19 regression.
3. **12 button treatments read as one system (UI-02).** "Everything else seems fine" — **BLOCKED BY DEFECT.** Same dead-token defect; all 12 compared button treatments were rendering 0px corners. Requires re-verification.
4. **`.cta` hover distinguishable (UI-02).** "hover changes it now but clicking still does nothing" — the **hover half PASSES**; the click failure is a separate, non-Phase-19 issue (Records "View Activity" anchors don't navigate).
5. **Five disabled states (UI-02).** Activities pagination — "Sure" (pass). Calendar — "I don't see the disabled kinds" (the rule computes correctly per console probe `{disabled: ["0.6", "rgb(102, 102, 102)"], normal: ["1", "rgb(51, 51, 51)"]}`, but not perceptible by eye). Trends Banister — "Banister is enabled and I can click it... not sure i see a difference" (Banister is configured in this dataset, so no disabled state exists to observe — not applicable, not failed).
6. **Focus ring fully unclipped, both themes (UI-02).** **FAILS.** "The ring... appears hidden partially in the bottom by the first chart and to the right by 'Time'... In activities the ring is around the current page number. i only see a ring, in the activity screen it was just partially hidden." The detail segmented control's ring is occluded by neighbouring painted elements — a distinct mechanism from the `overflow: hidden` clipping plan 19-04 removed. Activities pagination ring sub-check passes; exactly-one-ring sub-check passes.
7. **Spacing/card rhythm reads as one system (UI-03).** "sure... not sure what has changed" — recorded as a pass (no screen's focal point read differently). Error-state/empty-state boxes were not specifically isolated and observed.
8. **Activities row-click model (ACT-01).** "all good" — all four sub-checks (mouse click, Tab/Enter, return-highlight flash, sort/filter/pagination) confirmed good.
9. **Row-hover retrofit, acknowledged deviation (ACT-01).** "looks good" — developer accepts the deviation.
10. **`--accent-strong` fills survive hover (UI-02).** "does not change" — PASS, solid fill preserved.
11. **Calendar distance-tint scale survives hover (UI-02).** "hovering over days does nothing no matter what day" — PASS, tints preserved.
12. **Segmented silhouette after mechanism change (UI-02).** "all good" — **INVALIDATED, not a pass.** The developer was looking at a square-cornered control whose end-child rounding was entirely inert (same dead-token defect: `.segmented__option:first-child`/`:last-child` both fall back to `border-radius: 0`). Requires re-verification.
13. **Button text size after `font: inherit` (UI-02/UI-03).** "looks good" — accepted, no crowding or wrapping. Governed by `min-height: 32px`, independent of the radius-token defect.

## Confirmed vs. Blocked Requirement IDs

- **CONFIRMED:** `UI-03` (rows 7, 13), `ACT-01` (rows 8-9)
- **NOT COMPLETED:**
  - `UI-01` — blocked (row 1 blocked-by-defect; row 2 passes but carries a separate non-Phase-19 note)
  - `UI-02` — blocked (row 3 blocked-by-defect, row 6 fails outright, row 12 blocked-by-defect; rows 4-hover-half/5/10/11/13 pass individually but do not clear UI-02 while rows 3/6/12 remain open)

## Gap-Closure Record (verbatim, unpatched)

### GAP 1 — Dead `--radius-control` token from an early-terminated CSS comment

- **Rows blocked:** 1, 3, 12 · **Requirements:** UI-01, UI-02 · **Decisions:** D-03/D-13 as applicable
- `src/dashboard/styles.css` lines 54-56 contain a CSS comment whose body includes the literal sequence `*/` inside the prose `--space-*/--zone-*/--load-*`, terminating the comment early. The remaining prose becomes live `:root` content. The shipped bundle `dist/widgets/assets/index-U16xFz57.css` emits `--space-3xl: 64px;--zone-*/--load-* precedent rather than the --chart-* per-theme precedent. */ --radius-control: 4px;--radius-panel: 8px;...` — `--zone-*/` is not a valid custom-property name, CSS error recovery discards tokens up to the next `;` (the end of `--radius-control: 4px`), so `--radius-control` is never defined. `--radius-panel` survives. Browser confirmation: `{radiusControl: "(EMPTY)", radiusPanel: "8px", sample: "button.app-nav__toggle", borderRadius: "0px"}`. Exactly 4 rules reference `var(--radius-control)` and all fall back to `border-radius: 0`: line 826 (`.segmented__option:first-child`), line 830 (`.segmented__option:last-child`), line 1165 (`input, select, textarea` baseline), line 1201 (`button` baseline).

### GAP 2 — Focus ring occluded on the detail view's segmented control

- **Row blocked:** 6 · **Requirement:** UI-02 · **Decisions:** D-09/D-10/D-12
- Verbatim: "The ring (red rectangle around button) appears hidden partially in the bottom by the first chart and to the right by 'Time' (when on 'distance')." Occlusion is by neighbouring painted elements, not by `.segmented`'s removed `overflow: hidden` — a distinct mechanism from the one plan 19-04 addressed.

### GAP 3 — The esbuild css-syntax-error warning was misclassified as non-blocking

- **Task implicated:** plan 19-05 Task 1
- `npm run build-widgets` emitted `▲ [WARNING] Expected ":" [css-syntax-error]` at `<stdin>:56:59` — the build-time signature of GAP 1 — and Task 1 recorded it as non-blocking. It was not: it is the reason a 909-green test suite shipped square controls to production.

### Non-Phase-19 Issues (pre-existing / out-of-scope, tracked separately)

Phase 19 shipped exactly two files (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`); `git diff --name-only 670b3ec..HEAD -- . ':(exclude).planning/*'` confirms only those two paths, so none of these can originate from it:

1. JS `SyntaxError: Unexpected token '{'. Expected ')' to end a compound expression.` on every page load; unlocalized (console entry would not expand). All 33 built bundles parse clean under `node --check`. Wording is WebKit-specific.
2. Records "View Activity" links (well-formed hrefs, confirmed via console probe) do not navigate on click. Possibly related to issue 1. Activities row-click (row 8) navigates correctly via a different code path.
3. Calendar month picker (`<input type="month">`, `calendar.ts:280`) renders as a plain over-wide text field in Safari, which doesn't support `type="month"`. Pre-existing cross-browser gap.

## Four Constraint Facts

1. `vitest` runs `environment: 'node'` — no CSSOM, no rendering engine available to any automated test.
2. This phase authorized no new test dependency (no jsdom/happy-dom/@testing-library/puppeteer/playwright); none installed.
3. The two UI-02 contrast ratios (light 3.40:1, dark 6.02:1) were discharged by closed-form W3C relative-luminance computation, not a test (`grep -ci 'luminance' src/dashboard/styles.test.ts` = 0, per D-11).
4. Every automated check in this phase is a text assertion over `styles.css`'s literal source, or the existing `verify-dashboard` integration check — a green suite proves a rule exists in the source, never that it parses or renders as intended. GAP 1 is the concrete instance of that boundary failing silently.

## Task Commits

1. **Task 1: Run the full automated gate and reconcile the validation record** - `36b2b4e` (docs) — prior agent session
2. **Task 2 + Task 3: Record the checkpoint outcome and finalize the gap-closure register** - `03893dc` (docs)

## Next Step

`nyquist_compliant` remains `false` and the phase gate does **not** close. `/gsd-plan-phase 19 --gaps` is the next step: plan and execute closure of GAP 1, GAP 2 and GAP 3, then re-verify rows 1, 3, 6 and 12 specifically in a real browser before this checkpoint can flip to `approved`.

## Deviations from Plan

None beyond the plan's own explicit instructions — no defect was fixed, no source or scripts file was touched, and the PARTIAL/blocked-by-defect distinctions were recorded exactly as directed rather than upgraded to passes.

## Issues Encountered

The primary "issue" IS the phase's finding: a shipped CSS defect invisible to all four automated gate commands, discovered only by the human browser checkpoint this plan exists to run. This validates the plan's own stated purpose (`<objective>`): "A green suite proves a rule exists in the source and proves nothing about computed styles, rendered boxes... or click behaviour."

## User Setup Required

None.

## Next Phase Readiness

Phase 19 does **not** close. `/gsd-plan-phase 19 --gaps` must plan the CSS comment fix (GAP 1), investigate and resolve the focus-ring occlusion (GAP 2), and correct the build-warning classification going forward (GAP 3) before `19-VALIDATION.md`'s `nyquist_compliant` can be set `true` and the phase gate can advance.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: .planning/phases/19-design-system-control-styling/19-05-SUMMARY.md
- FOUND: .planning/phases/19-design-system-control-styling/19-VALIDATION.md
- FOUND commit: 36b2b4e (Task 1)
- FOUND commit: 03893dc (Task 2/3 recording)
