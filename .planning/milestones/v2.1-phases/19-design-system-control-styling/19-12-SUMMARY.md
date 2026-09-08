---
phase: 19-design-system-control-styling
plan: 12
subsystem: ui
tags: [css, validation, human-checkpoint, focus-ring, z-index, segmented-control, gap-closure]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling
    provides: "plan 19-10's sticky-layer z-index ladder (CR-01 fix) and plan 19-11's segmented-radius/focus-ring-opacity fixes (CR-02/CR-03 fixes), both in src/dashboard/styles.css"
provides:
  - "Six independently-verdicted Round 3 checkpoint rows (14-19) in 19-VALIDATION.md, each with its own PASS/FAIL token, row-specific content anchors and both-theme confirmation"
  - "Four verbatim objective probe outputs (A, B, C, D) recorded before the rows that depend on them were judged, including one probe (D) added mid-session to test row 18's own premise"
  - "GAP 4 and GAP 5 (CR-02, CR-03) resolved on rendered evidence; GAP 6 (CR-01) recorded as declaration-shipped/effect-unconfirmed; GAP 7 (new) — sticky nav does not remain on screen while scrolling — recorded with no fix or root-cause theory"
  - "UI-01/UI-03/ACT-01 confirmed-unregressed via row 19's sub-checks, dated in REQUIREMENTS.md; UI-02 left open with an updated annotation naming the row and gap still blocking it"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Probe added mid-checkpoint, outside the plan's own script, to test a row's premise before judging it (Probe D) — the same probe-gated-row mitigation applied reactively rather than only pre-planned"

key-files:
  created: []
  modified:
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Row 18 judged FAIL not because a focus ring occluded the nav, but because the row's own premise (a sticky nav staying on screen to be scrolled under) could not be exercised at all — Probe D (navH 77 = parentH 77) confirmed this on Activities before the row was judged on appearances"
  - "CR-01's z-index:20 declaration is confirmed present in the shipped bundle (Probe B: '20'), but its rendered paint-order effect is left unconfirmed rather than assumed correct, because row 18 failed for an unrelated, newly-discovered reason (GAP 7) before the original paint-order question could be observed"
  - "GAP 6 and GAP 7 kept as two separate register entries rather than merged: GAP 6 documents the original CR-01 diagnosis/fix status (declaration shipped, effect unverified, superseded), GAP 7 is the new defect found this round, entered with zero suggested fix or root-cause theory per house rule"
  - "The developer's terse 'looks fine' answer to an explicit both-theme prompt spanning rows 14-17 was recorded exactly as given in each row, not expanded into invented per-theme detail"
  - "The row-16 'some more separation wouldn't hurt' remark was logged as a UX backlog note, explicitly not counted against the row's PASS verdict, per the checkpoint's own instruction"
  - "Row 17 sub-check 2 (still reads non-interactive while focused) recorded as an observed and accepted narrowing of the D-07 disabled affordance — the fix un-dims the label along with the ring while focused — rather than a silent pass"
  - "Lessons note updated the phase's running false-green-mechanism count from three to four: this session's Probe B/Probe D sequence exposed that a defect (CR-01) diagnosed and fixed entirely from source-code reading was never checked against the rendered page, and the state its fix targets may be unreachable as assumed"

patterns-established: []

requirements-completed: [UI-01, UI-03, ACT-01]

# Metrics
duration: ~10min agent time (Task 1 gate + Task 3 resolution); Task 2 was a held human checkpoint spanning a separate session
completed: 2026-08-13
---

# Phase 19 Plan 12: Round 3 human checkpoint — CR-01/CR-02/CR-03 re-verification Summary

**CR-02 (segmented middle-option radius) and CR-03 (focus-ring opacity on disabled controls) are confirmed closed on rendered evidence across five independently-verdicted rows, but row 18 failed on a newly-discovered defect — the sticky nav does not remain on screen while scrolling — leaving UI-02 open and the phase gate closed pending another gap-closure pass.**

## Performance

- **Task 1 (prior agent):** full gate run, build staged under `/strava-widgets`, six-row Round 3 agenda written — commit `208b18c`
- **Task 2 (human checkpoint, held across a separate session):** developer verified rows 14-19 in a real browser (Safari/WebKit) at `http://localhost:8099/strava-widgets/`, across two exchanges, using four objective probes (one, Probe D, added mid-session)
- **Task 3 (this agent):** resolved sign-off, gap register and requirement statuses from Task 2's recorded outcome
- **Tasks:** 3 (1 prior, 1 checkpoint, 1 this session)
- **Files modified:** 2 (`19-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- Recorded six independent Round 3 verdicts — PASS for rows 14, 15, 16, 17, 19; FAIL for row 18 — each with its own dated observation naming that row's own controls, both-theme confirmation, and traceable probe reference
- Recorded four verbatim probe outputs (A: segmented corner geometry across all four Trends groups; B: nav z-index; C: focus ring on a disabled control, two attempts; D: nav stickiness, added mid-session) in a new `### Round 3 Probe Outputs` subsection, with the plan's own table-parsing hazard (no literal `|` inside any Observation cell) respected throughout
- Closed GAP 4 (CR-02) and GAP 5 (CR-03) in the gap register on Round 3 rendered evidence, without touching GAP 1-3
- Recorded GAP 6 (CR-01's `z-index: 20` declaration confirmed shipped by Probe B, its rendered paint-order effect left unconfirmed) and GAP 7 (a new, distinct defect — the sticky nav does not remain on screen while scrolling on Activities, per Probe D — carrying no suggested fix or root-cause theory)
- Left `nyquist_compliant: false`; updated `REQUIREMENTS.md` so UI-01, UI-03 and ACT-01 carry dated confirmed-unregressed notes citing row 19's relevant sub-check and remain Complete, while UI-02 stays unticked with its phase-status table row agreeing and its annotation naming row 18 and the new nav-stickiness gap
- Updated the phase's lessons note: the three pre-existing false-green mechanisms are joined by a fourth this session surfaced — a defect diagnosed and fixed entirely from source-code reading, never checked against the rendered page until an unrelated probe exposed that the underlying condition may be unreachable as assumed

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the full gate, stage the build, write the six-row agenda** - `208b18c` (docs, prior session)
2. **Task 2: Record Round 3 checkpoint verdicts for rows 14-19** - `9194e86` (docs)
3. **Task 3: Resolve sign-off PARTIAL — CR-02/CR-03 closed, CR-01 superseded by new nav-stickiness gap** - `a3235cc` (docs)

## Files Created/Modified

- `.planning/phases/19-design-system-control-styling/19-VALIDATION.md` — six Round 3 Observation cells filled with dated, verdict-bearing, distinct content; new `### Round 3 Probe Outputs` subsection; GAP 4/GAP 5/GAP 6/GAP 7 added to the Gap-Closure Record (GAP 1-3 untouched); Non-Phase-19 Issues section given a Round 3 "not reported" addendum; Validation Sign-Off given a Round 3 resolution checkbox; Approval line given a Round 3 addendum (19-09 prose left intact); Lessons section given two new numbered entries (3rd and 4th false-green mechanisms); Next step section superseded rather than rewritten. Rows 1-13 confirmed byte-identical via `git diff`.
- `.planning/REQUIREMENTS.md` — UI-01, UI-03, ACT-01 each gained a dated Round 3 confirmed-unregressed note and remain `[x]` Complete; UI-02 stayed `[ ]` with an updated annotation naming row 18 and the new gap; UI-02's Traceability table row updated to `Gaps Found (Round 3, row 18 open)`.

## Round 3 checkpoint outcome — verbatim record

**Row 14 (Trends tab list, 5 options, 3 middles) — PASS.** Probe A's full run (executed on the Training Load tab after the default-view run returned only two incomplete groups) confirmed every middle option computes exactly `0px`: `Volume 4px 0px 0px 4px, Year-over-Year 0px, Cadence & HR 0px, Training Load 0px, Gear 0px 4px 4px 0px`.

**Row 15 (Volume granularity group) — PASS.** Probe A's Volume-tab run: `Weekly 4px 0px 0px 4px, Monthly 0px, Yearly 0px 4px 4px 0px`.

**Row 16 (Training-load window group) — PASS.** Probe A's Training-Load-tab run: `3mo 4px 0px 0px 4px, 12mo 0px, All 0px 4px 4px 0px`; the adjacent Edwards/Banister group computed the correct two-option end-cap shape. Developer's verbatim words: "yes. They are very close to each other so at first sight they might seem like the same. But quickly you see that two boxes are selected and with the rounded corners at the edges it becomes visible. Some more separation wouldn't hurt though." The spacing remark is logged as a UX backlog note, not counted against the row.

**Row 17 (focused calendar rest day) — PASS.** Probe C's first attempt (the plan's 8-second `setTimeout` form) failed to capture a rest day, reading `document.activeElement` as `<body>` — logged as a failed capture, not a result. The second attempt, a focusin-listener form substituted because the timer form is fragile, returned a matching result: class contains `calendar-day--rest`, `aria-disabled` `"true"`, `opacity` `"1"`, ring a non-empty two-stop box-shadow. Developer's verbatim words: "1) yes 2. it reads less non-interactive (becomes slightly more lively (day number and \"-\") but it's very subtle and not a big issue for me)." Sub-check 2 recorded as an observed and accepted narrowing of the D-07 disabled affordance, not a silent pass.

**Row 18 (focused control under sticky nav, two routes) — FAIL.** Not because a ring occluded the nav — because the row's premise could not be exercised at all. Developer, first exchange: "not sure what to look for in list. On records the \"superlatives - pr tables - etc...\" (is that the navbar?) that scrolls down with us andthe data scrolls behind it." Second exchange, given a concrete recipe: "not sure what's supposed to happen in /list? If i scroll down the navbar disappears upwards. In records the ring stays put but the focus \"superlatives\" or \"pr evolution\" become orange as we reach that section. Not sure what you mean with opaque." Probe D, added mid-session to test the premise on Activities: `{parent: "HEADER#app-nav-root", navH: 77, parentH: 77, navPos: "sticky", parentPos: "static"}` — `navH` equals `parentH` exactly. What the developer described on Records is the jump bar's own active-section highlighting, not a focus ring.

**Row 19 (no-regression re-confirmation) — PASS.** Developer's verbatim response: "all look good and unchanged," covering all four sub-checks: (a) detail-view x-axis toggle, (b) input/select/textarea baselines, (c) Overview/Records panel rhythm, (d) Activities row-click navigation.

**Themes.** The developer was asked explicitly to flip between light and dark theme and re-glance at rows 14-17; the answer was "looks fine" — recorded exactly as given in each of those rows, not expanded into invented per-theme detail. Row 18 could not be observed in either theme because its premise failed before any themed comparison was possible.

**Known non-Phase-19 issues.** The developer was asked twice for a yes/no on each of the three (WebKit `SyntaxError` on load, Records "View Activity" not navigating, Calendar month picker as a plain text box) and did not report on them this session — recorded as "not reported in the Round 3 session" for all three, per the plan's own protocol for uncalled items.

## Gap Register — Round 3 additions

- **GAP 4 (CR-02, segmented middle-option radius) — CLOSED.** Rows 14-16 all PASS on Probe A's rendered evidence.
- **GAP 5 (CR-03, focus-ring opacity on disabled controls) — CLOSED.** Row 17 PASS on Probe C's rendered evidence.
- **GAP 6 (CR-01, sticky-nav paint order) — declaration shipped, effect unconfirmed, superseded by GAP 7.** Probe B confirms `z-index: 20` is present in the shipped bundle exactly as plan 19-10 wrote it, but row 18 FAILED, so the original paint-order question was never actually observable this round.
- **GAP 7 (new) — sticky nav does not remain on screen while scrolling.** Blocks row 18 and UI-02. Recorded with the developer's verbatim words (both exchanges), Probe D's verbatim output, the blocked row/requirement, and the implicated decisions (D-09, D-10, D-12) — no suggested fix and no root-cause theory, per the plan's own rule for still-failing rows.

## Lessons — running count updated

The phase's lessons note previously recorded two false-green mechanisms (source-text-vs-parse-result; a misclassified build warning). This plan's Task 3 added a third (agenda generalisation + an untraceable blanket verdict, with its four now-shipped mitigations: per-row verdict tokens, per-row content anchors, both-theme requirements, probe-gated rows) as the plan itself anticipated. This session then surfaced a **fourth**, unanticipated by the plan: a defect (CR-01) diagnosed and "fixed" entirely from reading `styles.css`, never checked against the rendered page, until Probe D — run for an unrelated reason — showed the state the fix targets may be unreachable as assumed. The running count is stated in the file as four, not three, because the plan's own drafted text predates this session's finding.

## Deviations from Plan

### Auto-fixed Issues

None — no source file was touched in this plan (`git status --porcelain src scripts` confirmed empty after both Task 2 and Task 3), per the plan's own scope fence and house rule against patching defects under checkpoint pressure.

**1. [Rule 3 — self-inflicted gate risk, fixed inline] Pre-existing intro text above the Manual-Only Verifications table contained two literal `VERDICT:` tokens**
- **Found during:** Task 3, pre-flight count of `VERDICT:` occurrences before running Task 3's own gate
- **Issue:** Task 1's own descriptive prose ("requires its own independent `VERDICT: PASS`/`VERDICT: FAIL` in its own Observation cell") matched the same regex Task 3's gate uses to count verdicts (`/VERDICT:\s*(PASS|FAIL)/g`), pushing the file-wide total to 8 before any gap-register text was even added, against a hard requirement of exactly 6.
- **Fix:** Reworded the descriptive sentence to "requires its own independent PASS/FAIL verdict token" — same meaning, no literal `VERDICT:` prefix. Also caught and fixed three further self-inflicted instances inside the newly-written GAP 4/GAP 5/GAP 6 prose during drafting, before any of it was run against the gate.
- **Files modified:** `.planning/phases/19-design-system-control-styling/19-VALIDATION.md`
- **Committed in:** `a3235cc` (Task 3's commit — all four fixes landed together, verified by a file-wide token count returning exactly 6 before Task 3's own gate was run)

**Total deviations:** 1 (a table-parsing/gate-integrity fix to this plan's own documentation text, not a code change).

## Issues Encountered

None beyond the deviation above. `npm test` (921/921, 46 files) and `npm run build-widgets` (exit 0, zero `css-syntax-error` occurrences) were both re-confirmed green after Task 3, per the plan's own verification requirement that nothing slipped in during the checkpoint session.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**The phase gate does NOT close.** `nyquist_compliant` remains `false`. UI-02 remains open, blocked by row 18 (FAIL) and the newly-found GAP 7 (sticky nav does not remain on screen while scrolling). UI-01, UI-03 and ACT-01 are confirmed-unregressed and remain Complete. **Another `/gsd-plan-phase 19 --gaps` pass is required** to diagnose and fix the nav-stickiness defect before this phase can close — per house rule, this plan records the defect verbatim and unpatched rather than fixing it under checkpoint pressure.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.planning/phases/19-design-system-control-styling/19-12-SUMMARY.md`
- FOUND: `.planning/phases/19-design-system-control-styling/19-VALIDATION.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND commit: `208b18c` (Task 1, prior session)
- FOUND commit: `9194e86` (Task 2)
- FOUND commit: `a3235cc` (Task 3)
