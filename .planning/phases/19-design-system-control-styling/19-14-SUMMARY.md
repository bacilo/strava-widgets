---
phase: 19-design-system-control-styling
plan: 14
subsystem: ui
tags: [css, sticky-positioning, vitest, chrome-console-probe, gap-closure]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plan 13)
    provides: "GAP 7 root-cause diagnosis confirming H1 (zero-travel containing block) as the sole cause"
provides:
  - "The H1-prescribed CSS fix: position: sticky/top: 0/z-index: 20 moved from .app-nav to #app-nav-root"
  - "A ladder test that fails when the positioning precondition (not just the z-index numbers) is deleted"
  - "Rendered-page confirmation (Probe F, two routes) that the nav now holds during scroll"
affects: [19-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sticky-layer ladder test now asserts position values, not only z-index numbers, closing R3-WR-01"
    - "Fix confirmation requires a Chrome console probe against a served production-shaped build, never a source-only assertion, for any claim about rendered CSS positioning behavior"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - .planning/phases/19-design-system-control-styling/19-GAP7-DIAGNOSIS.md

key-decisions:
  - "Applied exactly the H1 row of the fix-decision table: moved the sticky rung to #app-nav-root, the nav's own containing block, rather than any other candidate edit"
  - "Left .app-nav's box properties (display, flex, background, border, padding) untouched so updateJumpOffset's live-height read is unaffected"
  - "Rubber-band bounce reported by the developer on #/list is recorded as an observed non-defect (macOS overscroll) with spec-derived reasoning, not investigated as a new gap"
  - "UI-02 is NOT marked complete by this plan; plan 19-17 performs the gate-quality re-verification (both themes, full agenda) as Probe G"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-08-13
---

# Phase 19 Plan 14: GAP 7 Fix (H1) and Rendered Confirmation Summary

**Moved the sticky rung from `.app-nav` to `#app-nav-root`, closing GAP 7's zero-travel containing block, and confirmed on a served production-shaped build via two Chrome console probes that the nav now holds at the viewport top while scrolling on both `#/list` and `#/records`.**

## Performance

- **Duration:** ~8 min (task 1 fix + task 2 stage/build at 13:11-13:13; task 3 recording in this continuation session)
- **Started:** 2026-08-13T13:11:41+02:00 (Task 1 commit)
- **Completed:** 2026-08-13T13:19:12+02:00 (Task 3 commit)
- **Tasks:** 3 (2 executed by prior agent, 1 completed in this continuation)
- **Files modified:** 3 (`styles.css`, `styles.test.ts`, `19-GAP7-DIAGNOSIS.md`)

## Accomplishments

- Applied the H1-prescribed fix: `position: sticky`, `top: 0`, `z-index: 20` moved from `.app-nav` to a new `#app-nav-root` rule — the nav's own containing block, whose parent (`BODY`) has real scroll travel room, unlike the tight 77px-in-77px wrap `.app-nav` itself sat inside.
- Closed R3-WR-01: the sticky-layer ladder test in `styles.test.ts` now pins `position: sticky` on the nav rung, `.records-jump` and `.splits-table__km`, pins `position: relative` on the focus ring, and asserts `.app-nav` does NOT itself declare `position: sticky` — the exact nested-sticky shape GAP 7 was. Both required mutations were executed and observed: deleting `position: sticky` from `#app-nav-root` fails the ladder test; deleting `z-index: 20` from `#app-nav-root` still fails it.
- Full gate green before staging: `npm test` (46/46 files, 921/921 tests), `tsc --noEmit`, `build-widgets` (0 `css-syntax-error`), `verify-dashboard` (37/37 checks).
- Rebuilt and restaged `dist/widgets` under `/tmp/gh-pages/strava-widgets`, served on `:8099`, and independently confirmed the served CSS bundle (`assets/index-OOJ4Ed94.css`) contains `#app-nav-root{position:sticky;top:0;z-index:20}` before the human probe ran.
- Recorded two verbatim Probe F outputs — one per route — both meeting the numeric pass condition (`sy: 600` >= 400, `rootTop: 0` and `navTop: 0` <= 1, `rootPos: sticky` / `navPos: static`), confirming the fix on the rendered page rather than by reading the stylesheet back.
- Recorded the developer's verbatim qualitative observations for both routes, including the Records jump-bar behavior that is the rendered confirmation of `updateJumpOffset`'s live-height coupling still resolving after the fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply the H1 fix and pin it with a failing-first guard** - `4a5bc27` (fix)
2. **Task 2: Rebuild, restage, prepare Probe F** - `817f7bd` (docs)
3. **Task 3: Record Probe F output verbatim on both routes** - `a20250c` (docs)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `src/dashboard/styles.css` - Sticky rung (`position: sticky; top: 0; z-index: 20`) moved from `.app-nav` to `#app-nav-root`; `.app-nav`'s box properties unchanged.
- `src/dashboard/styles.test.ts` - Sticky-layer ladder test extended to assert `position: sticky` on three rungs, `position: relative` on the focus ring, and that `.app-nav` does NOT declare `position: sticky` (GAP 7 / H1 invariant, dated).
- `.planning/phases/19-design-system-control-styling/19-GAP7-DIAGNOSIS.md` - `## Fix confirmation (Round 4)` section completed with Probe F snippet, pass condition, and two verbatim recorded outputs (`#/list`, `#/records`).

## Decisions Made

- **H1 fix applied exactly as prescribed.** Confirming field value from `19-GAP7-DIAGNOSIS.md`: `#app-nav-root` entry `ch` (77) = `.app-nav` entry `oh` (77) — zero travel distance. The decision table's H1 row (move the sticky rung to `#app-nav-root`) was applied without blending in any other row.
- **`.app-nav`'s rendered height is unaffected.** `display`, `flex-direction`, `align-items`, `background`, `border-bottom`, `padding` are all unchanged, so `updateJumpOffset`'s live-height read (`records.ts`) continues to return the same values it did before the fix.
- **Rubber-band bounce on `#/list` treated as a non-defect, not a new gap.** The developer reported the nav "slides away 'slightly' then bounces back" at the scroll extremes. This is macOS overscroll — the document itself drags beyond its bounds at the top/bottom edge and everything painted in it, including sticky elements, travels with it until the platform snaps back. This is stated explicitly in the diagnosis file as spec-derived reasoning (an assessment, not a probe measurement), distinguished from the numeric Probe F result. No gap opened, nothing patched.
- **UI-02 stays open.** This plan's Task 3 is the fix-time rendered smoke check on one theme, not the phase gate. Plan 19-17 restates the same probe (as Probe G) as a gate-quality row across both themes with a full agenda. `requirements-completed` for this plan is therefore empty — UI-02 is not claimed here.

## Deviations from Plan

None - plan executed exactly as written, including in this continuation. Task 3 changed no source file (verified: `git status --porcelain src scripts` returns 0 lines after the Task 3 commit).

## Probe F Outputs (verbatim)

**`#/list`:**
```
{"route":"#/list","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}
```

**`#/records`:**
```
{"route":"#/records","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}
```

Both runs clear the `sy >= 400` floor (not failed captures) and both `rootTop`/`navTop` read `0`, well within the `<= 1` pass condition. `rootPos: sticky` / `navPos: static` confirms the sticky rung lives on `#app-nav-root` alone with no duplicate declaration on `.app-nav`.

## Issues Encountered

None. Both probe runs passed the numeric condition on the first attempt; no re-run or failed capture was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GAP 7 is closed on rendered evidence: the H1 fix holds the nav at the viewport top on both routes measured.
- Plan 19-17's checkpoint re-runs the same Probe F snippet (as Probe G) across both themes as its own gate-quality row before UI-02 can be marked complete in `REQUIREMENTS.md` — this plan intentionally does not mark it.
- The rubber-band overscroll behavior observed on `#/list` is recorded as a known, expected non-defect; a future round should not reopen it as a gap.
- The Records jump-bar's live-height coupling to `.app-nav` is confirmed resolving on the rendered page, closing the last open must_have of this plan without requiring a code reading.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*
