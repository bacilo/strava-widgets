---
phase: 20-row-click-interaction-pattern
plan: 08
subsystem: testing
tags: [checkpoint, accessibility, focus-management, voiceover, keyboard-navigation, gap-closure]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "CR-01's focus-restoration fix (plan 20-06) and CR-02's badge-in-accessible-name fix (plan 20-07), both re-tested this round"
provides:
  - "A Round 2 seventeen-row checkpoint agenda in 20-VALIDATION.md, each row recorded with its own named verdict rather than a blanket approval"
  - "R13's genuine re-test of CR-01, including a documented false-alarm procedure trap (mouse Back vs keyboard Back)"
  - "REC-08 closed on rendered, individually-described evidence (R5, R6)"
  - "An honest record that UX-01, UX-02 and UX-03 remain open pending re-verification of thirteen still-undescribed rows"
affects: [phase-20-closure, future-checkpoint-agendas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-level R2-VERDICT tokens with a minimum-length, non-duplicate observation requirement, to make a blanket approval mechanically distinguishable from per-row evidence"

key-files:
  created: []
  modified:
    - .planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Recorded R10 as PASS-with-open-theme-gap rather than FAIL, because the developer's substance observation ('fine', no clipping/overlap/nav-occlusion) was genuine and row-specific even though no theme was named — distinguishing a partial-coverage PASS from a full insufficient-evidence FAIL"
  - "Recorded the other twelve non-evidenced rows as R2-VERDICT: FAIL for insufficient evidence per the plan's own house rule, quoting the developer's blanket approvals verbatim rather than manufacturing per-row detail"
  - "Ticked REC-08 in REQUIREMENTS.md (both its mapped rows, R5 and R6, individually passed) while leaving UX-01/UX-02/UX-03 open, since each has at least one mapped row still undescribed — applying the plan's Round 2 row-to-requirement map exactly as written"
  - "Renamed the three new narrative sections to 'Checkpoint Outcome (Round 2)' / 'Evidence Quality (Round 2)' / 'Gap-Closure Record (Round 2)' instead of prefixing them '## Round 2 ...', to avoid colliding with the file's own single '## Round 2 —' heading marker used by downstream tooling"

requirements-completed: [REC-08]

# Metrics
duration: ~24min (Task 1 staging through this recording, including the human checkpoint session itself)
completed: 2026-08-13
---

# Phase 20 Plan 08: Round 2 Checkpoint Recording Summary

**Round 2 of the Phase 20 human checkpoint closes on four individually-evidenced rows (R5, R6, R10-partial, R13) and leaves thirteen rows honestly recorded as not evidenced this round — no code defect found, `status: partial`, `nyquist_compliant: false`, REC-08 ticked, UX-01/UX-02/UX-03 still open.**

## Performance

- **Duration:** ~24 min from Task 1's gate/staging commit (`abe5e52`) to this recording commit, spanning the human browser/VoiceOver checkpoint session itself
- **Tasks:** 2 (Task 1: full gate + seventeen-row staging, previously committed at `abe5e52`; Task 2: recording the checkpoint's actual verdicts, this commit)
- **Files modified:** 2 (`20-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- Recorded all seventeen Round 2 rows with their own `R2-VERDICT` token and observation text, quoting the developer's actual words rather than inferring or expanding a blanket approval into per-row detail.
- **R13 (CR-01's focus-restoration fix, plan 20-06) genuinely re-passed**, and its false-alarm history is preserved as a documented trap for future re-runs: the first attempt looked like a regression (Tab landing on the search box after Back) but was traced to a procedure artifact — using the browser's Back **button** with the mouse moves focus into browser chrome, defeating the probe regardless of whether CR-01's fix is present. Re-testing with keyboard back (`Cmd+[`) confirmed the fix works: the row was highlighted and a single Tab moved focus to the next card down.
- R5 and R6 (Records table headers) closed on verbatim header read-backs, which also closes **REC-08** in `REQUIREMENTS.md`.
- R10 recorded as PASS on genuine substance ("fine", no clipping/overlap/nav-occlusion) but with an explicit open theme-coverage gap, since no theme was named for this theme-sensitive row.
- Thirteen rows (R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15, R16, R17) recorded `R2-VERDICT: FAIL — insufficient evidence` per the plan's own house rule, because the only evidence offered for them was a blanket "all pass", a six-question follow-up answered "1. Yes 3. yes 6. confirm" (naming no badge text, no activity ids, no themes), and finally "all good" — none of which is an individual observation of any one row's Test Instructions.
- Round 1's twelve-row record, its Checkpoint Outcome, and its Evidence Quality section are preserved byte-identical (confirmed via a script that isolates the pre-Round-2 slice of the file and counts its `VERDICT:` tokens — still exactly 12).

## Task Commits

1. **Task 1: Full gate, production-shaped staging, seventeen-row Round 2 agenda** — `abe5e52` (docs) — completed in a prior session; not redone here.
2. **Task 2 (recording only): Round 2 checkpoint verdicts recorded** — `5362ba6` (docs)

_No plan-metadata commit separate from Task 2's commit — this continuation only performs the recording step of an already-staged checkpoint; the two files this plan owns (`20-VALIDATION.md`, `REQUIREMENTS.md`) were committed together in `5362ba6`._

## Files Created/Modified

- `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` — filled all seventeen Round 2 Observation cells with the developer's actual verdicts; added `Checkpoint Outcome (Round 2)`, `Evidence Quality (Round 2)` and `Gap-Closure Record (Round 2)` narrative sections below the row table; set frontmatter `status: partial` (was `pending`), kept `nyquist_compliant: false`. Round 1's record (lines above the `## Round 2 —` heading) is unchanged.
- `.planning/REQUIREMENTS.md` — ticked `REC-08` (both mapped rows R5/R6 individually passed) and updated its Traceability table row to "Complete (Round 2, 2026-08-13)"; added Round 2 status notes to `UX-01`, `UX-02` and `UX-03` explaining exactly which of their mapped rows are still undescribed, leaving all three unticked.

## Decisions Made

- **R10 gets a partial-coverage PASS, not a FAIL.** The developer's substance observation was genuine and row-specific ("fine", no clipping/overlap/nav-occlusion), distinct from the blanket-approval rows. Recording it PASS-with-a-noted-gap, rather than folding it into the FAIL bucket, keeps the record honest about what was actually said versus what coverage is still missing (the theme name).
- **Thirteen rows recorded FAIL for insufficient evidence, not skipped or left PENDING.** The plan's own house rule requires this outcome for any row left individually undescribed after a follow-up attempt, and a blanket "all pass" is precisely the failure mode this round exists to correct (it is what left SC4 undischarged in Round 1).
- **REC-08 ticked; UX-01/UX-02/UX-03 left open.** Applied the plan's Round 2 row-to-requirement map literally: a requirement ticks only if every one of its mapped rows passed. REC-08's two mapped rows (R5, R6) both passed; every other requirement has at least one mapped row among the thirteen not-evidenced this round.
- **New narrative section headings avoid the literal string `## Round 2 —` used elsewhere as the file's own section-boundary marker.** Named them `Checkpoint Outcome (Round 2)`, `Evidence Quality (Round 2)`, `Gap-Closure Record (Round 2)` instead of `## Round 2 Checkpoint Outcome` etc., so a `split('## Round 2 —')` on the file still isolates exactly the Round 1 record from everything after it.

## Deviations from Plan

None — this is a straight recording task per explicit instruction from the parent conversation (the actual checkpoint session already happened; this continuation's only job was to transcribe its outcome truthfully). No code was touched (`git status --porcelain src scripts` remains empty), and no verdict was manufactured or extrapolated beyond what the developer actually said.

## Issues Encountered

- Initial draft of the three new narrative section headings (`## Round 2 Checkpoint Outcome`, `## Round 2 Evidence Quality`, `## Round 2 Gap-Closure Record`) collided with the file's existing `## Round 2 —` boundary marker under a `split('## Round 2')` check — a script scoped only to the leading substring `## Round 2 —` (the one actual section-opening heading) would still see 1 match, but a naive `split('## Round 2')` would see 4. Renamed the three sections to avoid starting with the literal substring `## Round 2 ` at all, resolving the ambiguity. Verified afterward: `split('## Round 2 —')` on the current file yields exactly 2 parts, with the pre-Round-2 slice still containing exactly 12 `VERDICT:` tokens.

## Phase 20 Status After This Round

**Not passing.** `20-VALIDATION.md` carries `status: partial`, `nyquist_compliant: false`. No code defect was found this round — R13's re-test of CR-01 passed cleanly, and all four automated gates (recorded in Task 1) were green from a clean tree: `npm test` 991/991 across 49 files, `tsc --noEmit` clean, `build-widgets` with zero `css-syntax-error` occurrences, `verify-dashboard` 37/37. What remains outstanding is **evidence, not implementation**: thirteen rows (R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15, R16, R17) still need their own individually-described observation, and R10 needs a named theme, before SC4 can be discharged in full.

**Worth carrying forward to the next round:** the mouse-Back vs. keyboard-back procedure trap discovered while re-testing R13. Using the browser's Back **button** with the mouse moves focus into browser chrome before the page restores, so a subsequent Tab always restarts at the top of the document — producing a convincing false FAIL for CR-01's focus-restoration claim (R13, and by extension R14) regardless of whether the underlying fix is present. Keyboard back (`Cmd+[`) is the correct probe. Anyone re-running R13/R14 should use keyboard back from the start.

**CR-02 (plan 20-07) remains unobserved in a real screen reader.** R15, R16 and R17 exist specifically to hear what VoiceOver announces for a badge-carrying row on three surfaces; CR-02's failure mode was the badge text being *silently dropped* from the accessible name, so an announcement that sounds fine to a rushed "yes" is indistinguishable from the defect still being present. Its source-level, string-composition coverage is green, but that was never sufficient proof on its own — that is exactly why these three rows exist.

## Next Phase Readiness

Phase 20 is **not** ready to close. The next round needs individually-described answers for the thirteen not-evidenced rows (R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15, R16, R17) plus a named theme pair for R10, using the same build already staged at `http://localhost:8099/strava-widgets/` if it is still live, or a fresh gate re-run if not. No further code changes are implicated — this round's only finding was a procedure artifact (mouse-Back vs. keyboard-back) that produced a false alarm on R13, and that row is now genuinely closed.

---
*Phase: 20-row-click-interaction-pattern*
*Plan: 08*
*Completed: 2026-08-13*
