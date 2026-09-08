---
phase: 20-row-click-interaction-pattern
plan: 11
subsystem: testing
tags: [validation, checkpoint, accessibility, browser-automation, voiceover, click-guards]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "plan 20-09's D-12 modifier-click/middle-click/drag-select guards on the Records PR-table row-click listener; plan 20-07's CR-02 status-badge accessible-name fix; plan 20-06's CR-01 focus-restoration fix"
provides:
  - "Round 3 of the phase's human validation checkpoint: eighteen individually-observed rows, closing the two-round blanket-approval failure pattern for the first time"
  - "First real-browser confirmation that plan 20-09's D-12 guards stop a modified click from hijacking the current tab/window on the Records PR-table's five anchor-less cells (R18/R19 partial pass, partial fail)"
  - "First real screen-reader confirmation of CR-02's badge text on Overview Recent PRs (R17) and Activities mobile cards (R15), with the shipped badge string quoted verbatim"
  - "A newly-discovered, honestly-recorded gap: the five anchor-less Records PR-table cells still do not open a new tab/window on a modified click, despite no longer hijacking the current one"
affects: [21-overview-redesign, requirements-ux-01, requirements-ux-02, requirements-ux-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-observer checkpoint recording: every Observation cell states its observer explicitly (developer / agent browser-automation / both), rather than blurring who actually performed each row"
    - "Four-state verdict vocabulary (PASS/FAIL/BLOCKED/NOT EXERCISABLE) distinguishing a dataset-coverage gap or hardware limitation from an actual behavioural defect"

key-files:
  created: []
  modified:
    - .planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R18/R19 FAILs are recorded verbatim against their stated expectation and left unpatched, per house rule — no suggested fix or root-cause remediation, diagnosis deferred to the next planning round"
  - "R2/R16 recorded BLOCKED rather than FAIL or a manufactured PASS: the dataset genuinely contains no badge-carrying Overview Recent Activities row, so the Required-detail badge quote cannot be produced regardless of how the row is exercised"
  - "R20 recorded NOT EXERCISABLE for a hardware reason (no middle button on a trackpad); D-12's disposition question was still answered directly and accepted by the developer"
  - "UX-02 is NOT ticked despite R4 and both carried-forward rows passing, because R2 (one of its four mapped rows) is BLOCKED, not a clean PASS, and the plan's own gating rule requires every mapped row to pass"

patterns-established: []

requirements-completed: []

# Metrics
duration: N/A (Task 1 executed 2026-08-13; Task 2's checkpoint was conducted and recorded 2026-08-17)
completed: 2026-08-17
---

# Phase 20 Plan 11: Round 3 Gap-Closure Checkpoint Summary

**Eighteen rows individually observed for the first time in this validation record's history — thirteen clean passes, two dataset-coverage blocks, two confirmed-but-incomplete D-12 guard fixes, and one hardware-blocked row — closing the blanket-approval failure pattern that undischarged Rounds 1 and 2.**

## Performance

- **Task 1 (gate + staging):** completed and committed 2026-08-13 (`b99cf26`)
- **Task 2 (checkpoint conduct + recording):** conducted and recorded 2026-08-17
- **Tasks:** 2/2 complete
- **Files modified:** 2 (`20-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- Every one of the eighteen Round 3 agenda rows now carries an individually-described, non-blanket observation with its own required detail — the first time this validation record has cleared that bar since it was opened at Round 1.
- Confirmed plan 20-09's BLOCKER fix works: a modified click (Cmd/Ctrl/Shift/Alt) on the Records PR-table's five anchor-less cells no longer hijacks the current tab or window (R18, R19 partial-pass halves; R21 full pass on drag-select preservation).
- Found and recorded, without patching, that the same guards' other half is incomplete: a modified click on those cells does not open a new background tab (R18) or a new window (R19) either — there is no anchor for the browser to act on. Recorded as `GAP 9`, deferred to the next planning round.
- Confirmed CR-02 (plan 20-07) in a real screen reader for the first time: R15 (Activities mobile cards) and R17 (Overview Recent PRs) both PASS with the announced string quoted verbatim, excluding CR-02's silent-badge-drop failure mode on those two surfaces.
- Honestly recorded, rather than forced into a false PASS, that Overview Recent Activities currently has no badge-carrying row in the dataset (`GAP 10`, blocking R2/R16) and that middle-click could not be exercised on either observer's hardware/tooling this round (`GAP 11`, blocking R20).

## Task Commits

1. **Task 1: Full gate, production-shaped staging, and the eighteen-row Round 3 agenda** - `b99cf26` (docs) — 1022/1022 tests across 49/49 files (up from Round 2's 991/991 across 48), `tsc --noEmit` clean, `build-widgets` exit 0 with zero `css-syntax-error` occurrences, `verify-dashboard` 37/37. Build staged under `/tmp/gh-pages/strava-widgets` (symlink to the absolute `dist/widgets` path), served on port 8099, confirmed live at `http://localhost:8099/strava-widgets/`.
2. **Task 2: BLOCKING human browser checkpoint** - this commit (docs) — recording half only; the checkpoint itself was conducted by the orchestrator directly via Chrome browser automation against the staged build, with four rows (R3, R14, R15's badge-text detail, R20's D-12 disposition) answered by the developer. No code under `src/` or `scripts/` was touched.

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` - all eighteen Round 3 Observation cells filled with named verdicts and explicit observer attribution; frontmatter updated to `status: partial`, `round3_recorded: 2026-08-17`; three new closing sections appended (`## Checkpoint Outcome (Round 3)`, `## Evidence Quality (Round 3)`, `## Gap-Closure Record (Round 3)` with GAP 9/10/11). Rounds 1 and 2 preserved byte-identical (34 pre-Round-3 `VERDICT:` tokens, 22 `R2-VERDICT` occurrences, all three Round 2 closing sections intact).
- `.planning/REQUIREMENTS.md` - UX-01, UX-02, UX-03 entries updated with Round 3 evidence and pointers to the specific rows still blocking each; traceability table rows updated. REC-08 left untouched (already Complete).

## Decisions Made

**The observer split, stated plainly.** This round is unusual and the record says so explicitly. The developer answered four rows directly: R3 (desktop-table checks), R14 (keyboard-back re-test), R15's specific missing detail (the badge text "no streams"), and R20's D-12 disposition question (accepted as recorded). The orchestrator performed the remaining rows itself, driving the live build at `http://localhost:8099/strava-widgets/` through Chrome browser automation — real clicks, real Tab/Enter/Space key presses, real drag-selects, and computed-style reads on the rendered page. That is genuine observation of the shipped build, not an automated repo test, but it is not the developer's own eyes either. Every Observation cell states its observer explicitly using one of three phrases (`observed by developer`, `observed by agent (browser automation against the staged build)`, `observed by developer, corroborated by agent`) so a future reader can tell which verdicts rest on which kind of observation.

**Final tally, eighteen rows:**
- **PASS (13):** R1, R3, R4, R7, R8, R9, R10, R11, R12, R14, R15, R17, R21
- **BLOCKED (2):** R2, R16 — both blocked on the same cause: no Overview Recent Activities row in the current dataset carries a status badge
- **FAIL (2):** R18, R19 — both against their stated expectation (see main finding below)
- **NOT EXERCISABLE (1):** R20 — no middle button available to either observer
- **Carried forward from Round 2 as passes, not re-asked:** R5, R6, R13

**The round's main finding, stated as an observation, not a fix.** Plan 20-09's D-12 guards work: a modified click (Cmd/Ctrl/Shift/Alt) on the Records PR-table's five anchor-less cells (Rank, Time, Pace, Age-Grade, Flags) no longer navigates the current tab in place — the BLOCKER this phase's row-click affordance had is fixed. But the row's full expectation is not met: those same modified clicks do not open a new background tab (R18) or a new window (R19) either, because the five cells carry no `<a>` element for the browser's own tab/window-open behaviour to act on. Phase 20's goal of propagating `list.ts`'s real-`<a href>` pattern to every navigable row is therefore only partially met on the Records tables — the row click itself behaves correctly, but the affordance still isn't a real link where the browser's own gesture handling is concerned. No fix or root-cause theory is proposed here, per house rule; this is deferred to the next planning round as `GAP 9`.

**D-12 was explicitly accepted by the developer at the checkpoint even so.** Asked directly whether D-12 (middle-click and the other guarded gestures deliberately doing nothing on the five anchor-less cells) is accepted as recorded, with the concrete consequence spelled out — a PR row's Pace cell cannot be Cmd+clicked into a background tab — the developer answered yes.

**The R15 discrepancy.** The shipped badge string, read directly off the rendered accessible name in the staged build, is `"No streams (no-original)"` — more specific than the bare `"No streams"` this round's agenda anticipated (and than what the developer, when re-asked, described hearing as "no streams"). Not a defect: CR-02's failure mode was the badge text being *silently dropped*, and it demonstrably is not; the extra `(no-original)` qualifier is additional detail, not a missing one.

**UX-02 is not ticked.** Despite R4 (full PASS) and both carried-forward Round 2 rows (R5*, R6*) passing cleanly, R2 — one of UX-02's four mapped rows — is recorded BLOCKED rather than PASS, because its own Required-detail badge quote cannot be produced against the current dataset. Per the plan's own gating rule ("tick a requirement only if every one of its mapped rows passed"), UX-02 stays open. UX-01 and UX-03 stay open for the same reason plus the R18/R19 FAILs.

## Deviations from Plan

**1. [Rule 1 - documentation defect] Renamed the Gap-Closure section heading to avoid a self-inflicted false-positive on the file's own structural invariant.**
- **Found during:** Task 2, while adding closing sections
- **Issue:** The plan's own action text instructs adding a section literally titled `## Round 3 Gap-Closure Record`. But this file's own established structural check (used by both Task 1's and Task 2's automated verify blocks, and restated in this plan's `<critical_attribution_rule>`/success criteria) asserts the substring `## Round 3` appears exactly once in the whole file — it is how the file distinguishes "the Round 3 heading" from everything above it. A section titled `## Round 3 Gap-Closure Record` would make that substring appear twice, breaking the very invariant the plan asks to preserve.
- **Fix:** Named the section `## Gap-Closure Record (Round 3)` instead — the exact naming convention Round 2's own closing sections already use (`## Checkpoint Outcome (Round 2)`, `## Evidence Quality (Round 2)`, `## Gap-Closure Record (Round 2)`), which is both more consistent with this file's existing precedent and avoids the collision. Verified afterward: the substring `## Round 3` appears exactly once in the file.
- **Files modified:** `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md`
- **Verification:** `s.split('## Round 3').length - 1 === 1` confirmed via a standalone node check after the edit.

**2. [Rule 1 - verify-script gap, documented not silently worked around] The plan's Task 2 automated verify script only recognizes `R3-VERDICT: PASS` / `R3-VERDICT: FAIL` tokens; it was written before this round's more honest four-state vocabulary (PASS/FAIL/BLOCKED/NOT EXERCISABLE) was introduced by the orchestrator's checkpoint instructions.**
- **Found during:** Task 2, while recording R2, R16 (BLOCKED) and R20 (NOT EXERCISABLE)
- **Issue:** Task 2's embedded `<verify><automated>` script extracts each row's verdict with the regex `/R3-VERDICT:\s*(PASS|FAIL)/` and throws if no match is found. Three rows in this round are honestly recorded `BLOCKED` or `NOT EXERCISABLE` — states that are more accurate than a forced `PASS` (which would misrepresent what was actually observed) or a forced `FAIL` (which would misrepresent an evidence gap as a shipped defect). Running the plan's literal automated check against the file as recorded will therefore report these three rows as missing a verdict token.
- **Resolution:** Did not force R2/R16/R20 into PASS/FAIL to satisfy a verify script that predates this round's evidence — that would be manufacturing detail that was not observed, which the plan's own house rules forbid more strongly than they favor script compliance. Recorded honestly instead, and documented this mismatch here so the next planning round can decide whether to extend the verify script's vocabulary or accept the discrepancy as recorded history.
- **Files modified:** none (script itself is embedded in `20-11-PLAN.md`, not modified)
- **Verification:** Manually confirmed all 18 rows carry the `R3-VERDICT:` prefix and their required detail; the PASS/FAIL-only subset of the automated check (13 PASS + 2 FAIL rows) was independently confirmed to satisfy its own per-row required-detail predicates.

No other deviations. `git status --porcelain src scripts` is empty — no source file was touched by this checkpoint, and no failing row was patched under checkpoint pressure.

## Requirements Impact

**requirements-completed (this checkpoint): none.** UX-01, UX-02 and UX-03 all remain open — each has at least one mapped row that is not a clean PASS this round (R18/R19 FAIL for UX-01/UX-03; R2 BLOCKED for UX-02). REC-08 was already Complete (Round 2) and is untouched. See `.planning/REQUIREMENTS.md` for each requirement's updated evidence pointer.

## Open Items for the Next Round

- **R2/R16 (`GAP 10`):** need a dataset containing at least one status-badge-carrying row in Overview Recent Activities (real fixture or synthetic) before these can be re-asked meaningfully.
- **R20 (`GAP 11`):** needs a mouse with a middle button, or an automation tool capable of dispatching a real `auxclick` event, to observe the anchor-less-cell and Date-cell outcomes. D-12 itself is already accepted by the developer regardless.
- **R18/R19 (`GAP 9`):** needs a decision on whether the Records PR-table's five anchor-less cells (Rank, Time, Pace, Age-Grade, Flags) should become real links — matching `list.ts`'s established pattern — so a modified click can open a new tab/window the way the row's own pointer-cursor affordance implies, or whether the rows' stated expectation should be revised to match D-12's narrower scope (guards that prevent hijacking, not guards that guarantee a new context opens).

## Self-Check: PASSED

- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: commit `b99cf26` (Task 1, `git log --oneline --all | grep b99cf26`)
- Round 3 verdict-token counts confirmed via node check: 18 `R3-VERDICT` tokens, 22 `R2-VERDICT` occurrences, 34 pre-Round-3 `VERDICT:` tokens, exactly one `## Round 3` heading occurrence, all three Round 2 closing sections present.
