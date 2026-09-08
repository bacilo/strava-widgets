---
phase: 24-local-curation-mode
plan: 03
subsystem: docs
tags: [requirements, roadmap, planning-decisions, d-04, orchestrator-decisions]

# Dependency graph
requires: []
provides:
  - Amended CUR-01 in REQUIREMENTS.md describing whole-activity (not per-distance) PR exclusion, dated to D-04
  - Amended Phase 24 milestone checklist line, Goal, and success criteria 1 and 4 in ROADMAP.md, dated to D-04
  - OD-1..OD-4 orchestrator decisions recorded as dated sub-bullets in 24-CONTEXT.md, beside D-07 and D-10 and inside Claude's Discretion
affects: [24-01, 24-02, 24-04, 24-05, 24-06, 24-07, 24-08]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/24-local-curation-mode/24-CONTEXT.md

key-decisions:
  - "CUR-01 and Phase 24's written criteria now match D-04's whole-activity exclusion semantics, closing the gap where every future verification pass would have judged the phase against per-distance wording it deliberately doesn't build."
  - "OD-1 discharges D-07's 're-renders' as a full location.reload() after the server mirrors the exclusions file into dist/widgets, reconciling D-07 with D-03's rejection of overlay-side panel rebuilding."
  - "OD-2 moves D-10's build-time absence guard to the END of buildAllWidgets(), after buildDashboard(), because the call site beside assertNoPrivateArtifacts runs before buildPages()/buildDashboard() and could never see a leaked curate bundle."
  - "OD-3: no UI-SPEC.md for this phase — the overlay is a developer-only tool inheriting Phase 19's bare-element control baseline with zero new CSS."
  - "OD-4: curate server binds a fixed port 4173 and fails fast if occupied, rather than hunting for a free port."

patterns-established: []

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-27
---

# Phase 24 Plan 03: Requirements & Roadmap Amendment (D-04) Summary

**Rewrote CUR-01 and Phase 24's success criteria to match the developer's whole-activity exclusion decision (D-04), and recorded four orchestrator amendments (OD-1..OD-4) as dated sub-bullets beside the locked decisions they clarify, so every downstream verification pass judges the phase against what it actually builds.**

## Performance

- **Duration:** ~20min
- **Started:** 2026-08-27T09:52:00Z (approx)
- **Completed:** 2026-08-27T10:11:36Z
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- CUR-01 in REQUIREMENTS.md no longer requires per-distance exclusion selectability; it now describes whole-activity exclusion with a dated D-04 note explaining the engine facts that de-fang the original per-distance rationale.
- ROADMAP.md's Phase 24 milestone checklist line, Goal, and success criteria 1 and 4 all now describe whole-activity exclusion, each carrying a dated `amended 2026-08-27 per D-04` marker. Criteria 2 and 3 left byte-identical.
- 24-CONTEXT.md now carries OD-1 (under D-07, the re-render mechanism), OD-2 (under D-10, the build-time guard's call site), OD-3 (no UI-SPEC for this phase), and OD-4 (fixed port 4173) — all as dated, additions-only sub-bullets so a later reader can see exactly which locked wording was amended and why.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend CUR-01 in REQUIREMENTS.md (D-04)** - `c65fb92` (docs)
2. **Task 2: Amend ROADMAP.md's Phase 24 goal, checklist line and criteria 1 and 4 (D-04)** - `46baeb8` (docs)
3. **Task 3: Record the four orchestrator decisions as dated notes in 24-CONTEXT.md** - `dcc0489` (docs)

**Plan metadata:** (this SUMMARY.md commit, made by the orchestrator after wave merge)

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - CUR-01's body rewritten to whole-activity exclusion, plus a dated D-04 amendment note; checkbox stays unticked, traceability row stays Pending
- `.planning/ROADMAP.md` - Phase 24 milestone checklist line, Goal, and success criteria 1 and 4 amended to whole-activity exclusion, each dated to D-04; criteria 2 and 3 untouched
- `.planning/phases/24-local-curation-mode/24-CONTEXT.md` - OD-1..OD-4 added as dated sub-bullets under D-07, D-10, and inside `### Claude's Discretion`; no existing D-01..D-12 sentence altered

## Decisions Made
- Every amended clause carries the literal date `2026-08-27` and cites `D-04`, satisfying T-24-DOC-01 (repudiation) from the plan's threat model.
- OD-1 and OD-2 are dated sub-bullets under the decisions they amend rather than free-floating notes, satisfying T-24-DOC-02 — an amendment to a locked decision must be indistinguishable-from-ignored only if it's undocumented, and it isn't.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Task 2's own action text contradicted its acceptance criteria**
- **Found during:** Task 2 (Amend ROADMAP.md's Phase 24 goal, checklist line and criteria 1 and 4)
- **Issue:** The plan's action for criterion 1 (T2, sub-item c) explicitly instructed appending the phrase "the original **per-distance** clause is dropped" inside the amendment marker. But the task's own acceptance criteria and verify block require `grep -F -c "per-distance"` within the Phase 24 ROADMAP.md block to return exactly `0`. Following the action text verbatim would have made the task's own verify command fail.
- **Fix:** Reworded the amendment note's clause from "the original per-distance clause is dropped" to "the original whole-run-vs-distance selectability clause is dropped" — same meaning, no literal `per-distance` substring. This satisfies both the acceptance criteria (0 occurrences of `per-distance`) and the intent (a reader still understands what was dropped and why, with the D-04 pointer for the exact rationale).
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `sed -n '/### Phase 24/,/### Phase 25/p' .planning/ROADMAP.md | grep -F -c 'per-distance'` returns `0`; `grep -F -c 'amended 2026-08-27 per D-04'` over the same range returns `3`; all other Task 2 acceptance criteria (line 74 wording, criterion 3 byte-identical, criterion 4 retains the write-endpoint clause, exactly 4 numbered criteria) independently confirmed.
- **Committed in:** `46baeb8` (part of Task 2 commit)

## Known Stubs

None — this plan touches only `.planning/` documentation, no application code or UI.

## Threat Flags

None — this plan touches only `.planning/` documents (T-24-CUR-01 in the plan's own threat model correctly disposes this as `accept`, since nothing it writes reaches `dist/widgets`).

## Self-Check: PASSED

- FOUND: `.planning/REQUIREMENTS.md` (CUR-01 amended, checkbox unticked, traceability row Pending — confirmed by grep)
- FOUND: `.planning/ROADMAP.md` (Phase 24 block amended, criteria 2/3 byte-identical, 4 criteria present — confirmed by diff and grep)
- FOUND: `.planning/phases/24-local-curation-mode/24-CONTEXT.md` (OD-1..OD-4 present, correctly positioned, additions-only diff — confirmed by node script and `git diff`)
- FOUND commit `c65fb92` (Task 1) — confirmed via `git log --oneline`
- FOUND commit `46baeb8` (Task 2) — confirmed via `git log --oneline`
- FOUND commit `dcc0489` (Task 3) — confirmed via `git log --oneline`
- `git diff --name-only` against the plan's base commit lists exactly the three files in `files_modified`: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/24-local-curation-mode/24-CONTEXT.md`
