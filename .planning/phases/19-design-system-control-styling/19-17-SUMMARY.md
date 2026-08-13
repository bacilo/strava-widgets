---
phase: 19-design-system-control-styling
plan: 17
subsystem: ui
tags: [css, sticky-positioning, stacking-context, focus-visible, human-checkpoint, leaflet]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plans 13-16)
    provides: GAP 7's diagnosed root cause and fix (19-13/19-14), mutation-proven guard layer (19-15), and a truth-repaired sticky-layer ladder comment (19-16)
provides:
  - Rows 20-24 of 19-VALIDATION.md, each with an independent PASS verdict from a real-browser Round 4 checkpoint
  - GAP 6 and GAP 7 resolved on rendered evidence; Phase 19's UI-02 requirement ticked complete
  - GAP 8 opened and recorded (Leaflet map tiles paint over the nav; a totality defect in the 19-16 ladder comment), unpatched, disposition deferred
  - A fifth documented false-green mechanism (guard-documented-but-inert) and its two Round 4 mitigations (mutation-based acceptance criteria; a diagnosis plan with cited-field hypothesis exclusion)
affects: [phase-20-row-click-interaction-pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blocking human checkpoint with probe-gated premises (Probe G/H run and recorded before any dependent row is judged)"
    - "Refused blanket verdict re-asked explicitly and re-recorded as two independent per-theme verdicts (row 22)"

key-files:
  created: []
  modified:
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "GAP 8 (Leaflet map tiles over the nav) does not block UI-02 — argued explicitly: UI-02's own text concerns controls (buttons/selects) sharing a treatment with a conforming focus ring; GAP 8 concerns a third-party map library's own stacking values on an unrelated component, never named by any checkpoint row"
  - "GAP 8 left unpatched per house rule since 16-09 — no fix under checkpoint pressure, even though the developer said they would accept a quick fix; disposition (follow-up plan vs. deferred item) is the user's call after the phase closes"
  - "Records 'View Activity' links now observed working — recorded as a status change with cause explicitly unestablished; no Round 4 plan touched records.ts or Records markup"

requirements-completed: [UI-01, UI-02, UI-03, ACT-01]

# Metrics
duration: ~25min (continuation session)
completed: 2026-08-13
---

# Phase 19 Plan 17: Round 4 Human Checkpoint — Continuation (Task 2 + Task 3) Summary

**Round 4's five-row human checkpoint returned a clean sweep — GAP 7 and GAP 6 both closed on rendered evidence, UI-02 ticked complete, and one new unpatched gap (GAP 8, Leaflet map tiles over the nav) recorded and argued not to block it.**

## Performance

- **Duration:** ~25min (continuation from a prior session that completed Task 1 and reached the Task 2 checkpoint)
- **Tasks:** 2 of 3 (Task 1 completed in the prior session, commit `781b3e5`; this session completed Task 2 and Task 3)
- **Files modified:** 3 (`19-VALIDATION.md`, `REQUIREMENTS.md`, `ROADMAP.md`)

## Accomplishments

- Recorded Probe G (both routes) and Probe H verbatim, both matching expectation exactly, before any dependent row was judged
- Recorded independent PASS verdicts for all five Round 4 rows (20-24), rows 20-23 each carrying both theme verdicts as required
- Correctly handled a refused blanket verdict on row 22 — the developer's first answer ("pass") was explicitly rejected as insufficient and re-asked; the confirmed answer ("yes both themes, both checks") is recorded as two independent theme verdicts, not compressed into one
- Resolved GAP 7 (row 20: the nav holds on both routes, both themes) and GAP 6 (row 21: the original CR-01 paint-order question, finally observable and PASS) with dated Round 4 entries quoting the closing observations
- Recorded three for-the-record items verbatim, including the Records "View Activity" links status change with its cause marked unestablished rather than attributed to any Round 4 plan
- Opened GAP 8 — an unprompted developer report that Leaflet map tiles paint over the nav — with a source-derived (not measured) Leaflet z-index analysis, and flagged a second, more consequential face: plan 19-16's own sticky-layer ladder comment claims totality over "four rungs" but does not list Leaflet's panes (z-index 400) or controls (z-index 1000) as a fifth rung above all of them
- Ticked UI-02 complete in `REQUIREMENTS.md`, with an explicit argument for why GAP 8 does not block it, and appended dated row-24-sub-check-backed confirmed-unregressed notes to UI-01, UI-03 and ACT-01
- Extended `ROADMAP.md`'s Phase 19 entry and plan list with the Round 4 clean-sweep outcome; ticked the phase-level checkbox
- Recorded a fifth false-green mechanism (a guard that read correct in source but was proven inert only by mutation, per `19-REVIEW-round3.md` R3-CR-01/R3-CR-02) and its two Round 4 mitigations: mutation-based acceptance criteria (19-15) and a diagnosis plan requiring cited-field hypothesis exclusion with an INCONCLUSIVE stop (19-13)

## Task Commits

1. **Task 1: Run the gate, stage the build, write the five Round 4 agenda rows** (prior session) - `781b3e5` (docs)
2. **Task 2: Record the probe outputs and the five row verdicts** (this session) - `9bb6cd7` (docs)
3. **Task 3: Resolve the sign-off, the gap register and the requirement statuses** (this session) - `2dbb4f8` (docs)

_Note: this is a documentation-only plan — `git status --porcelain src scripts` was empty throughout both sessions; no source file was touched at any point._

## Gate Results (this session, re-confirmed before Task 3's commit)

- `npm test`: **927/927 passing**, exit 0
- `npx tsc --noEmit -p tsconfig.json`: exit 0, clean
- `npm run build-widgets`: exit 0, **zero `css-syntax-error` occurrences** (checked via redirect-and-capture, not a `tee`/grep pipeline)
- `npm run verify-dashboard`: **37/37 checks passed**, 0 failures
- Staging (unchanged from Task 1, re-confirmed live): `/tmp/gh-pages/strava-widgets` symlinks to `/Users/pedf/workspace/strava-widgets/dist/widgets`; `index.html` resolves; the orchestrator independently verified the served bundle at `http://localhost:8099/strava-widgets/` is byte-identical to the local `dist/widgets` build and contains `#app-nav-root{position:sticky;top:0;z-index:20}` before any observation was made

## Round 4 Probe Outputs (verbatim)

**Probe G** — run on `#/list` and `#/records`, before judging rows 20-22:

```
#/list:    {"route":"#/list","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}
#/records: {"route":"#/records","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}
```

Expected `sy` >= 400 and `rootTop`/`navTop` both 0 — matched exactly on both routes, no re-run needed.

**Probe H** — run once, before judging row 21:

```
{"position":"sticky","zIndex":"20","navContainsLinks":true}
```

Expected `sticky`, `"20"`, `true` — matched exactly.

## The Five Round 4 Verdicts (verbatim, condensed — full text in `19-VALIDATION.md`)

| Row | Behavior | Verdict |
|-----|----------|---------|
| 20 | The nav stays on screen while scrolling, two routes | PASS — "pass all" to Activities light/dark, Records light/dark |
| 21 | A focused control scrolled under the nav stays underneath it (original CR-01 paint-order question, first ever observation) | PASS — "pass all" to Activities light/dark, Records light/dark |
| 22 | Records jump bar parking + paint order | PASS — refused blanket "pass", re-asked, confirmed "yes both themes, both checks"; recorded as two independent theme verdicts |
| 23 | A focused nav link's own ring, all four sides | PASS — "pass both" (light, dark) |
| 24 | No-regression sweep, five sub-checks | PASS — "a. pass b. pas c. pass d. pass e. pass" |

## Non-Phase-19 Issues — Round 4 status

1. **JavaScript SyntaxError on page load** — STILL PRESENT, and now surfaces with *less* localizing information than before (no file/line at all, vs. the earlier "can't see any line or file, doesnt expand").
2. **Records "View Activity" links** — STATUS CHANGE, now observed working ("'view activity' links work fine... I click and goes to activity. From records."). No Round 4 plan touched `records.ts` or Records markup; the cause of the change is explicitly unestablished — the earlier "does not navigate" record may itself have been wrong.
3. **Calendar month picker** — STILL a plain wide text box (Safari's `type="month"` degradation, unchanged in kind), now inheriting the shared control styling — not a new defect.

## GAP 8 (new, opened this round)

Reported unprompted by the developer during Group C: "By the way I noticed that the map tiles go over the navbar. That's the only weird thing i noticed. I really don't care about this so if it's more than just a very quick fix you can skip it." Source-derived analysis (marked as reasoning, not measurement): Leaflet's own panes (`z-index: 400`) and controls (`z-index: 1000`) are untouched by this project's stylesheet (`grep -n "leaflet" src/dashboard/styles.css` returns nothing) and sit well above `#app-nav-root`'s `z-index: 20`. Second face: plan 19-16's sticky-layer ladder comment claims a totally-ordered four-rung ladder that does not list Leaflet's panes as a fifth, unlisted rung above it — a truth defect in work 19-16 was written to make truthful. **Not patched**, per house rule since 16-09. Disposition (a small follow-up plan, or a deferred item) is left to the user.

**Does GAP 8 block UI-02?** Argued explicitly, not assumed: no. UI-02's own text is "Buttons, selects and other controls share one visual treatment, with a consistent `:focus-visible` ring meeting non-text contrast requirements" — a claim about controls, not about a third-party map library's own layering. No checkpoint row, this round or any prior round, ever named the map view against the nav. UI-02 is ticked complete on the clean sweep of rows 20-24; GAP 8 is tracked separately.

## Files Modified

- `.planning/phases/19-design-system-control-styling/19-VALIDATION.md` — Round 4 Probe Outputs subsection; rows 20-24 filled with independent verdicts; GAP 6/GAP 7 Round 4 resolutions; GAP 8 opened; Non-Phase-19 Issues Round 4 addendum; Round 4 Approval addendum and requirements-completed block; lessons section extended (fifth false-green mechanism); Next step superseded; frontmatter `status: approved`, `nyquist_compliant: true`
- `.planning/REQUIREMENTS.md` — UI-02 ticked complete with explicit GAP 8 non-blocking argument; UI-01/UI-03/ACT-01 each get a dated Round 4 confirmed-unregressed note citing their own row 24 sub-check; traceability table UI-02 row set to Complete
- `.planning/ROADMAP.md` — Phase 19 line extended with the Round 4 clean-sweep outcome and phase checkbox ticked; plan list's 19-17 entry ticked; plans summary line appended with the closure note

## Decisions Made

- GAP 8 does not block UI-02 (argued in both `19-VALIDATION.md` and `REQUIREMENTS.md`, same reasoning: different component, no checkpoint row named it)
- GAP 8 left unpatched despite the developer offering to accept a quick fix — the house rule against patching under checkpoint pressure applies regardless of how small the developer estimates the fix to be
- The Records "View Activity" status change is recorded as observed-but-unattributed rather than credited to any plan, since no Round 4 plan's `git diff --name-only` touches that code path

## Deviations from Plan

None — plan executed exactly as written across both sessions. GAP 8 is new work the plan's own action text anticipated ("If any row still fails, add its own numbered entry (GAP 8 onward)") generalized correctly to a newly-found, unprompted defect outside the five agenda rows, which the plan's broader house rule (record verbatim, don't patch) already covers.

## Issues Encountered

None beyond the checkpoint's own designed friction points (the refused blanket verdict on row 22), which is the mechanism working as intended, not a problem.

## Next Phase Readiness

Phase 19's gate is closed: `nyquist_compliant: true`, all four requirements (UI-01, UI-02, UI-03, ACT-01) are Complete in `REQUIREMENTS.md`, and no further `/gsd-plan-phase 19 --gaps` pass is required. Phase 20 (Row-Click Interaction Pattern) depends on Phase 19's shared control/focus styling and is unblocked. One open item carries forward outside this phase's own gate: GAP 8 (Leaflet map tiles over the nav; the 19-16 ladder comment's totality claim is incomplete) is recorded, unpatched, and awaiting the user's disposition — either a small follow-up plan or a logged deferral.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*
