---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 16
subsystem: verification
tags: [browser-checkpoint, canvas-instrumentation, pace-derivation, requirements-gate]

requires:
  - phase: 26-14
    provides: CR-03 code fix — buildChannelSeries reads derivePaceWithCoverage(stream) directly, derivePaceSeries/PACE_SMOOTHING_WINDOW_SEC deleted
  - phase: 26-15
    provides: CR-02 code fix — rowPaceDisagreement(row) nullish-narrowing helper at both list.ts badge call sites
provides:
  - Round 3 browser checkpoint recorded in 26-VALIDATION.md, all four rows PASS with verbatim developer quotations
  - PACE-01 re-closed in REQUIREMENTS.md, gated on the Round 3 observation
  - A found-and-fixed mtime-based restore bug in copyJsonTree, discovered while restoring the R3-4 fixture
affects: [phase-27]

tech-stack:
  added: []
  patterns:
    - "Fixture restore verification must check the SERVED path via curl, not just the repo file's checksum — a build-copy step's own efficiency guard can silently leave a doctored file in place."

key-files:
  created: []
  modified:
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R3-2's tooltip-median observation (~5:00/km hovered vs. pre-stated 5:40/km) is recorded as its own finding, not smoothed into the PASS verdict — the fail condition (nothing faster than 2:27/km) is what the row actually gates on."
  - "R3-3's PASS is recorded as carrying no evidentiary weight toward CR-03 closure — it is a regression control whose extent is identical before and after the fix by construction; only R3-1 and R3-2 are cited in PACE-01's closure text."
  - "PACE-01 ticked only after all four Round 3 verdicts were transcribed and recorded, per this project's verification-after-requirement-tick lesson — never before."

requirements-completed: [PACE-01]

duration: ~35min (continuation session, Tasks 2-3 only; Task 1 ran in a prior session)
completed: 2026-09-10
---

# Phase 26 Plan 16: Round 3 Browser Checkpoint and PACE-01 Re-closure Summary

**All four Round 3 rows (chart-tick extent, tooltip fast-end, no-regression control, stale-index badge) recorded PASS from a real browser session; PACE-01 re-closed in REQUIREMENTS.md with its CR-03 disposition, gated on that observation.**

## Performance

- **Duration:** ~35min (continuation agent — Task 1 was executed and committed in a prior session, commit `14e6e086`)
- **Started:** 2026-09-10T08:XX:00Z (continuation resume)
- **Completed:** 2026-09-10T09:03:58Z
- **Tasks:** 2 of 3 (Task 1 already complete on entry)
- **Files modified:** 2

## Accomplishments

- Transcribed the developer's four Round 3 verdicts verbatim into `26-VALIDATION.md`, including the R3-2 tooltip-median deviation as its own recorded finding and R3-3's evidentiary-weight caveats, without altering, upgrading, or softening any quotation.
- Confirmed Task 2's transcription check (`## Round 3 Verdicts` heading + four `R3-N Verdict:` lines) exits `0` against the recorded state, after having exited non-zero against Task 1's staged state.
- Restored the doctored R3-4 fixture (`dist/widgets/data/dashboard/index.json`) to its original SHA-256 digest, verified against the SERVED path via `curl`, not just the repo file — and found/fixed a real restore bug in the process (see Deviations).
- Re-closed PACE-01 in `.planning/REQUIREMENTS.md` (checklist + traceability row), citing R3-1 and R3-2 as the discriminating evidence, with `git diff --stat` confirming exactly 2 lines changed and no other requirement touched.
- Stopped the checkpoint server (`nohup npm run curate`, PID 4271) and confirmed the working tree carries only the pre-existing, intentionally-untouched `26-RESIDUAL.md` change.

## Task Commits

Task 1 (prior session): `14e6e086` — "docs(26-16): stage Round 3 browser checkpoint (R3-1..R3-4)"

This session:

1. **Task 2: Human browser checkpoint — transcribe Round 3 verdicts** - `6de51fa6` (docs)
2. **Task 3: Re-close PACE-01 in REQUIREMENTS.md** - `1fa32ff4` (docs)

_No plan-metadata commit separate from Task 3 — REQUIREMENTS.md and VALIDATION.md changes were each committed individually per the task_commit_protocol; this SUMMARY and STATE.md updates follow in the final commit below._

## Files Created/Modified

- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-VALIDATION.md` - Appended `## Round 3 Verdicts` with the four machine-readable verdict lines, the human-readable verdict table, per-row narratives with verbatim developer quotations, the R3-2 deviation recorded as its own finding, R3-3's control caveats, the provenance check for R3-4, and the corrected fixture-restore record (including the mtime-guard bug found during restoration).
- `.planning/REQUIREMENTS.md` - `PACE-01` checklist ticked `[x]`; its traceability row changed from `Pending (reopened 2026-09-09 — CR-03 …)` to `Complete (CR-03 closed — …)`, citing `derivePaceWithCoverage`, the deleted `derivePaceSeries` wrapper, the extended single-source audit, and Round 3 rows R3-1/R3-2.

## Decisions Made

- R3-2's median-clustering observation (developer hovered values nearer 5:00/km than the pre-stated 5:40/km) was recorded as an honest deviation rather than forced into the verdict — the row's actual PASS/FAIL condition is the fast-end threshold (`2:27/km`), which was satisfied cleanly; the plausible explanation (small ~5-point hover sample against a Δt-weighted median statistic) is stated, not asserted as certain.
- R3-3's PASS is explicitly stated to carry no evidentiary weight toward CR-03 closure in both `26-VALIDATION.md` and the `PACE-01` traceability row — only R3-1 and R3-2 are cited as discriminating evidence, per the plan's own instruction.
- PACE-01 was ticked only after Task 2's verdict transcription was committed (commit `6de51fa6` precedes `1fa32ff4`), honoring the project's recorded verification-after-requirement-tick lesson.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `npm run build-widgets` alone did not restore the doctored R3-4 fixture**
- **Found during:** Task 2's post-checkpoint restore step
- **Issue:** `scripts/lib/copy-data-tree.mjs`'s `copyJsonTree` contains an efficiency guard that skips recopying a file when `destMtime >= srcMtime`. Task 1's doctoring of `dist/widgets/data/dashboard/index.json` (deleting `paceDisagreement` from every row) touched the destination file's mtime to a point after the untouched repo source's mtime, so the guard concluded the doctored copy was "already up to date" and skipped it. The first `npm run build-widgets` run after the checkpoint reported `(0 copied, 1 skipped)` for `data/dashboard` and the served digest remained the doctored one (`0f914382...`), not the original (`b15943de...`).
- **Fix:** Verified the repo source `data/dashboard/index.json` matched the original digest exactly, then force-copied it directly (`cp data/dashboard/index.json dist/widgets/data/dashboard/index.json`) and re-ran `npm run build-widgets` to confirm the tree was otherwise clean and idempotent.
- **Files modified:** `dist/widgets/data/dashboard/index.json` (build output, not committed — regenerated by `npm run build-widgets`)
- **Verification:** `sha256sum dist/widgets/data/dashboard/index.json` matched the original digest `b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da`; `curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json | grep -c paceDisagreement` returned `1890` (all rows); a `curl | sha256sum` of the SERVED path matched the same digest.
- **Committed in:** `6de51fa6` (the restore record is documented in `26-VALIDATION.md`'s Round 3 Verdicts section; `dist/widgets/` is a build output directory and is not itself version-controlled)

This is a genuine finding about the build tooling's copy-skip guard interacting badly with a deliberately-doctored fixture — not a defect in CR-02's fix or in the checkpoint's own design. It is out of scope to fix `copyJsonTree` itself (no task in this plan touches `scripts/`), so it is recorded here as a deviation rather than patched; a future todo could add a `--force` flag to `copyJsonTree` for exactly this restore-after-doctor pattern, but that is not required for this plan's `<files_modified>` scope.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, restore-path only, no source code changed)
**Impact on plan:** The fixture is restored correctly and verified on the served path per the plan's acceptance criteria. No scope creep — no file outside `26-VALIDATION.md`'s restore record was modified to fix this.

## Issues Encountered

None beyond the restore-path bug documented above as a deviation.

## Round 3 Verdicts (for reference)

| Row | Requirement | Verdict | Key evidence |
|-----|-------------|---------|---------------|
| R3-1 | PACE-01/CR-03 | **PASS** | Captured tick array `['3:20/km', '6:40/km', '10:00/km', '13:20/km', '16:40/km', '20:00/km']`; histogram first/last bars `2:15–2:30/km` / `17:15–17:30/km` |
| R3-2 | PACE-01/CR-03 | **PASS** | Fastest hovered tooltip `2:27/km`; median-clustering observation recorded separately |
| R3-3 | PACE-01 control | **PASS** (no evidentiary weight) | 52 bars unchanged, `1:30–1:45/km` / `18:30–18:45/km` |
| R3-4 | PACE-07/CR-02 | **PASS** | Zero `Pace disputed` badges, no `TypeError`; console noise (favicon 403, browser extension) is not application code |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 26's requirement gate is fully closed: `grep -c "Phase 26 | Pending" .planning/REQUIREMENTS.md` returns `0`. All of PACE-01..07 and COV-01/02 read `Complete`. Phase 27 (deferred `F-26-01`, Moving Time tile badge, under `QUAL-01`) is unblocked to plan whenever the milestone chooses to take it up.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-10*

## Self-Check: PASSED

All referenced files found: `26-VALIDATION.md`, `.planning/REQUIREMENTS.md`,
`26-16-SUMMARY.md`. All referenced commits found in `git log`: `14e6e086`, `6de51fa6`,
`1fa32ff4`.
