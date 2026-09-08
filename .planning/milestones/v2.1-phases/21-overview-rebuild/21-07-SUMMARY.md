---
phase: 21-overview-rebuild
plan: 07
subsystem: testing
tags: [checkpoint, human-verify, browser-checkpoint, requirements-gating, streak-fixture]

# Dependency graph
requires:
  - phase: 21-overview-rebuild
    provides: "21-01 (FIX-01 producer fix), 21-02/21-03 (shared two-line row renderer + CSS), 21-04 (Overview row-renderer retirement), 21-05 (Records year-scope control), 21-06 (this-year Headline Stats tiles + streak sub-label)"
provides:
  - "Thirteen-row Round 1 human browser checkpoint against a production-shaped, 127.0.0.1-served build"
  - "REQUIREMENTS.md gated on the row-to-requirement map: OVR-01, OVR-02, OVR-04 and FIX-01 ticked complete; OVR-03 left open on a BLOCKED row"
  - "Disclosed staged-build fixture evidence for FIX-01's ended-streak branch (dist/widgets/data/stats/streaks.json only, repository copy proven unmodified by content)"
affects: [22-*, any future phase touching Overview/Records/Activities rows or streak sub-labels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Round N checkpoint pattern in 21-VALIDATION.md: staged agenda (Task 1) -> developer answers (Task 2) -> verdicts + gating sections (Task 3), consistent with 16-09/17-15/19-05/20-05/20-18/20-20 precedent"

key-files:
  created: []
  modified:
    - .planning/phases/21-overview-rebuild/21-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "12 PASS / 1 BLOCKED (R7) / 0 FAIL / 0 NOT EXERCISABLE — per house-rule precedent, a requirement is ticked only when every row mapped to it is PASS"
  - "OVR-01, OVR-02, OVR-04 and FIX-01 ticked complete; OVR-03 stays open because R7 (year-scope re-rank) could not be exercised — no distance table has current-year entries in the archive"
  - "FIX-01's ended-branch evidence rests on a disclosed staged-build fixture (dist/widgets/data/stats/streaks.json), not organic archive data; the field is absent from the published streaks.json until a compute run regenerates it"

patterns-established: []

requirements-completed: [OVR-01, OVR-02, OVR-04, FIX-01]

# Metrics
duration: 55min
completed: 2026-08-18
---

# Phase 21 Plan 07: Round 1 Browser Checkpoint — Verdicts and Requirements Gate Summary

**Thirteen-row human browser checkpoint against a 127.0.0.1-served production build closes OVR-01, OVR-02, OVR-04 and FIX-01 with 12 PASS; OVR-03 stays open because the year-scope re-rank (R7) could not be exercised on an archive with no current-year best efforts.**

## Performance

- **Duration:** 55 min (Task 1 commit 11:04:10 -> Task 3 commit 11:59:28, spans the Task 2 checkpoint handoff)
- **Started:** 2026-08-18T11:04:10+02:00
- **Completed:** 2026-08-18T11:59:28+02:00
- **Tasks:** 3 (Task 1: gate + fixture + agenda; Task 2: checkpoint — developer answers; Task 3: verdicts + gating, this plan segment)
- **Files modified:** 2 (`21-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments
- Recorded all thirteen Round 1 observation cells verbatim, each with its own `R21-VERDICT` token, required detail and named observer
- Added `## Checkpoint Outcome (Round 1)`, `## Evidence Quality (Round 1)` and `## Round 1 Gap-Closure Record` sections to `21-VALIDATION.md`
- Updated the Per-Task Verification Map's eleven Status cells from `⬜ pending` to the state each row's evidence supports (unit rows to `✅ green`, manual rows to `✅ PASS` or `⚠️ BLOCKED`)
- Gated `REQUIREMENTS.md`: ticked OVR-01, OVR-02, OVR-04 and FIX-01 (every mapped row PASS); left OVR-03 open (R7 BLOCKED) and recorded the reason in both the requirement entry and the status table
- Added FIX-01's mandated parenthetical: its `ended` branch was confirmed against a staged-build fixture, and `currentStreakEnd` is absent from the published `streaks.json` until a compute run regenerates it

## Task Commits

Task 1 and Task 2 were completed by prior agent instances before this session began:

1. **Task 1: Gate, production-shaped staging, the ended-streak fixture, and the thirteen-row agenda** - `be546a8` (docs)
2. **Task 2: The thirteen-row browser checkpoint** - no commit (checkpoint; developer answers captured and relayed to this session verbatim)
3. **Task 3: Record the outcome and gate the requirements on it** - `79059b5` (docs)

_No plan-metadata commit beyond Task 3's — this SUMMARY and any STATE/ROADMAP updates are committed separately by the orchestrator per this plan's sequential-executor instructions._

## Files Created/Modified
- `.planning/phases/21-overview-rebuild/21-VALIDATION.md` - Round 1 table filled with thirteen verdicts; three new sections (Checkpoint Outcome, Evidence Quality, Gap-Closure Record); Per-Task Verification Map status cells updated; frontmatter `status: partial`, `round1_answered: 2026-08-18` added
- `.planning/REQUIREMENTS.md` - OVR-01, OVR-02, OVR-04, FIX-01 checkboxes ticked with closure notes; OVR-03 left open with a Round 1 gap note; status table rows updated to `Complete`/`Pending` accordingly

## Decisions Made
- Per STATE.md precedent (16-09, 17-15, 19-05, 20-05), a PARTIAL checkpoint ticks only the requirements whose every mapped row passed. R7 BLOCKED keeps OVR-03 open even though its other four mapped rows (R6, R8, R9, R10) all passed.
- FIX-01's evidence is fixture-dependent; the requirement entry now records this explicitly so a future reader does not mistake the `ended` branch as confirmed against organic data.
- Frontmatter set to `nyquist_compliant: false` / `status: partial` (not a clean sweep) per the plan's own gating rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3's own automated verify script has a heading-collision bug**
- **Found during:** Task 3, running the plan's `<verify><automated>` script verbatim
- **Issue:** The script isolates the Round 1 section via `s.split("## Round 1")` and separately requires the exact string `"## Round 1 Gap-Closure Record"` to be present when any row is non-PASS. Because that mandated heading is itself a superstring of the split token, adding the Gap-Closure Record section (required here, since R7 is BLOCKED) makes the split produce 3 parts instead of 2, tripping `"expected exactly one Round 1 heading"` — a false failure caused by the script's own required content, not by anything wrong in the document.
- **Fix:** Ran the verify script's substantive checks with the isolating split changed from `s.split("## Round 1")` to `s.split(/\n## Round 1\n/)` (anchored to the exact heading line, so it no longer matches the `Gap-Closure Record` heading's shared prefix). No other logic was altered. All substantive checks — verdict tokens, 60-char minimum, unique observations, theme naming on R1/R6/R11/R13, the R12/R13 discriminator and `0 days` check, R7/R9/R10/R5 content checks, the frontmatter nyquist/status pairing, the Gap-Closure/Evidence-Quality/Checkpoint-Outcome section presence, the fixture filename, and the REQUIREMENTS.md checkbox-to-row-map match — all passed.
- **Files modified:** none (the fix was applied only to the ephemeral verification command run in this session, not to any repository file)
- **Verification:** Corrected script printed `13 verdicts recorded, 0 FAIL, requirements gated on the row map` with no errors
- **Committed in:** N/A (no source change; verification-only)

**2. [Rule 1 - Bug] The same script's "no pending rows" check is blunt against the whole document**
- **Found during:** Task 3, same verify run
- **Issue:** `if(/⬜ pending/.test(s))` matches the entire document, including the Per-Task Verification Map's own legend caption (`*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*`), which necessarily and correctly retains the literal string `⬜ pending` to describe the symbol vocabulary. This makes the check permanently fail regardless of whether any actual table row is still pending.
- **Fix:** Scoped the check to the Per-Task Verification Map table body only (between the `## Per-Task Verification Map` heading and the `*Status:` legend line), confirming zero pending rows remain there while leaving the legend caption text untouched.
- **Files modified:** none (verification-only, as above)
- **Verification:** Scoped check printed `Per-Task Verification Map: no pending rows remain (legend caption line intentionally retained)`
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (both Rule 1, both confined to how the plan's own automated verify script was run locally — no repository file was changed as a result of either fix)
**Impact on plan:** Zero impact on deliverable content. Both fixes were needed only to get an accurate pass/fail read from a verify script whose literal text collides with content the same script mandates. All required document content (verdict cells, three sections, map status, requirements gating) matches the plan's specification exactly.

## Issues Encountered
None beyond the two script-collision items documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OVR-01, OVR-02, OVR-04 and FIX-01 are closed for milestone v2.1.
- OVR-03 remains open. The blocker is a dataset-coverage gap (no current-year best efforts in the archive), not a code defect — R7 is recorded BLOCKED and left unpatched per house rules. A future round can close it either by waiting for real current-year PR data to accrue, or by a disclosed fixture edit analogous to R12/R13's, following the same content-assertion guard pattern.
- The staged fixture in `dist/widgets/data/stats/streaks.json` is ephemeral; the next `npm run build-widgets` overwrites it. The repository copy of `streaks.json` was never touched.

---
*Phase: 21-overview-rebuild*
*Completed: 2026-08-18*
