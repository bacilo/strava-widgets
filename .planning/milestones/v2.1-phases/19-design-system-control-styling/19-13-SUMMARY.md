---
phase: 19-design-system-control-styling
plan: 13
subsystem: ui
tags: [css, sticky-positioning, layout-diagnosis, chrome-devtools, no-source-change]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plan 19-12)
    provides: Round 3 checkpoint record, GAP 6/GAP 7 gap-closure entries, Probe D's ad-hoc finding (navH == parentH == 77) that first raised the sticky-nav suspicion
provides:
  - A single, evidence-confirmed root cause for GAP 7 (H1 — zero-travel containing block), with every competing hypothesis excluded by a named field of a recorded, rendered-build probe output
  - A corrected reading of the H1-versus-H4 discrimination boundary, and a written note that the matrix's original H4 excluding signature ("non-auto height") is unsatisfiable from getComputedStyle() output and should be reworded in any future round
  - An explicit statement that records.ts's updateJumpOffset live-height read is not implicated by H1, so plan 19-14's fix does not need to account for it
affects: [19-14 (GAP 7 fix plan), any future phase touching sticky positioning or the .app-nav / #app-nav-root layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rendered-build probe (Chrome console, single-paste JSON.stringify expressions) as the only admissible evidence for layout/positioning claims in this phase — source reading alone is explicitly disallowed for this class of claim after four recorded false-green mechanisms"

key-files:
  created: []
  modified:
    - .planning/phases/19-design-system-control-styling/19-GAP7-DIAGNOSIS.md
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md

key-decisions:
  - "H1 (zero-travel containing block) confirmed as GAP 7's sole root cause: #app-nav-root.clientHeight (77) equals .app-nav.offsetHeight (77), corroborated by both Probe E2 runs showing after.navTop == after.parTop == 0 - after.sy on #/list and #/records"
  - "H2/H3/H4/H5 each excluded by a specific, cited probe field rather than by reasoning or inspection"
  - "Matrix wording defect recorded rather than silently worked around: getComputedStyle().height never returns the literal string 'auto', so H4's originally-drafted excluding signature is unsatisfiable by construction; H4 was excluded instead via the plan's explicit H1-vs-H4 split (ancestor rendered height equal to its own content size vs. smaller than it)"
  - "records.ts's updateJumpOffset judged not implicated by H1, since it reads .app-nav's live rendered height, which H1's containing-block defect does not change"
  - "No fix nominated and no source file touched, per the plan's constraint; plan 19-14 is now unblocked to write the H1 fix"

patterns-established: []

requirements-completed: []  # UI-02 stays open — this plan diagnoses GAP 7 (root cause H1) but writes no fix, per its own constraint. UI-02 closes only after 19-14 (fix) and 19-17 (Round 4 checkpoint) both land, matching the 19-12 precedent of excluding UI-02 until the row itself passes.

# Metrics
duration: 30min (across two agent sessions, separated by a human-verify checkpoint)
completed: 2026-08-13
---

# Phase 19 Plan 13: GAP 7 Diagnosis Summary

**Confirmed GAP 7's sticky-nav-disappears defect as H1 (zero-travel containing block) via three rendered-build Chrome console probes, excluding four competing hypotheses by cited field values, with zero source files touched.**

## Performance

- **Duration:** ~30 min (Task 1 committed 2026-08-13T12:33:58+02:00; Task 3 committed 2026-08-13T13:03:58+02:00; Task 2 was a human-verify checkpoint spanning a separate agent session)
- **Started:** 2026-08-13T12:33:58+02:00 (Task 1 commit)
- **Completed:** 2026-08-13T13:03:58+02:00 (Task 3 commit)
- **Tasks:** 3 (1 auto, 1 checkpoint:human-verify, 1 auto)
- **Files modified:** 2

## Accomplishments
- Staged the rendered, production-shaped build at `http://localhost:8099/strava-widgets/` and ran three console probes against it (Probe E1 structural chain, Probe E2 scroll behaviour twice) rather than diagnosing from `styles.css`
- Confirmed exactly one root cause (H1) with every one of the four competing hypotheses excluded by a specific named probe field, per the plan's exactly-one-CONFIRMED gate
- Caught and documented a defect in the plan's own discrimination matrix (H4's excluding signature relies on `getComputedStyle().height` ever returning the literal string `auto`, which never happens) instead of silently working around it — flagged for correction in any future round
- Answered the open question about `records.ts`'s `updateJumpOffset` coupling explicitly, so plan 19-14 does not have to rediscover it
- Left `19-VALIDATION.md`'s verdict-token count unchanged at 6 and `nyquist_compliant` unchanged at `false`, touching only the GAP 7 section (verified via `git diff --stat` and a pipe-character scan on the added lines)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate candidate root causes H1-H5, write the discrimination matrix, stage the rendered build** - `25b5b47` (docs)
2. **Task 2: Run Probe E1 once and Probe E2 twice in a real browser, return all three outputs verbatim** - `c6b215f` (docs) — checkpoint:human-verify, resumed with the developer's pasted probe outputs
3. **Task 3: Apply the discrimination matrix, confirm exactly one root cause or stop** - `264c649` (docs)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `.planning/phases/19-design-system-control-styling/19-GAP7-DIAGNOSIS.md` - Candidate root causes H1-H5, discrimination matrix, three verbatim probe outputs, and the Confirmed Root Cause section (H1, four exclusions, matrix-defect note, updateJumpOffset implication statement)
- `.planning/phases/19-design-system-control-styling/19-VALIDATION.md` - GAP 7 gained a dated "Diagnosis (Round 4, 2026-08-13)" subsection; all prior content (rows 1-19, GAP 1-6, the Approval line, the verdict-token count, `nyquist_compliant: false`) left untouched

## Decisions Made
- **H1 confirmed, four hypotheses excluded by cited fields** (see key-decisions above for the field-level detail). No architectural decision was made here — this plan explicitly writes no fix.
- **Matrix wording defect documented rather than hidden**: rather than quietly excluding H4 by whatever reasoning was convenient, the diagnosis states plainly that the literal "non-auto height" excluding signature can never be satisfied by real `getComputedStyle()` output, and that H4 was excluded instead through the plan's own explicit H1-vs-H4 split paragraph (ancestor height equal to vs. smaller than its own content size). This is recorded as a defect to fix in the matrix wording for any future round, not as a one-off workaround.
- **updateJumpOffset not implicated**: recorded as a one-sentence, explicit answer so plan 19-14 doesn't need to re-derive it — H1's containing-block defect doesn't change `.app-nav`'s own rendered height, which is the value `updateJumpOffset` reads live.

## Deviations from Plan

None - plan executed exactly as written. Task 2's human-verify checkpoint was answered by the developer with three raw probe pastes (not paraphrased) in a separate session; the continuation agent recorded them verbatim and proceeded, per the plan's continuation-handling instructions. No Rule 1-4 deviation was needed: no bug was found, no missing functionality was added, nothing blocked completion, and no architectural change was required — the plan's own constraint that no source file be touched was honored throughout (`git status --porcelain src scripts` empty after every task).

## Issues Encountered

None beyond the matrix wording defect, which is not an "issue" in the blocking sense — it's the exact kind of finding this plan was designed to surface, and it's documented in full in `19-GAP7-DIAGNOSIS.md` under "Matrix wording defect, recorded honestly rather than papered over" for the next round to correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `19-GAP7-DIAGNOSIS.md`'s `## Confirmed Root Cause` names `H1` unambiguously, satisfying the key_link plan 19-14 needs (`hypothesis id (H1..H5 or INCONCLUSIVE) read by the next plan before any CSS is written`, pattern `H[1-5]|INCONCLUSIVE`).
- Plan 19-14 (the GAP 7 fix plan) is unblocked to proceed: it now knows the fix must address `#app-nav-root`'s zero-travel containing block (H1), that `records.ts`'s `updateJumpOffset` does not need special handling, and that the matrix's H4 wording should be corrected before it is reused.
- `19-VALIDATION.md`'s `nyquist_compliant` remains `false` and UI-02 remains open — row 18 is still recorded FAIL until 19-14 ships and is re-verified; this plan only established the root cause, per its own constraint.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.planning/phases/19-design-system-control-styling/19-GAP7-DIAGNOSIS.md`
- FOUND: `.planning/phases/19-design-system-control-styling/19-VALIDATION.md`
- FOUND: `.planning/phases/19-design-system-control-styling/19-13-SUMMARY.md`
- FOUND: `25b5b47`, `c6b215f`, `264c649`, `6345f41` (all commits present in git log)
