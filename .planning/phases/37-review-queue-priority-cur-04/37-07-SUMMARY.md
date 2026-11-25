---
phase: 37-review-queue-priority-cur-04
plan: 07
subsystem: curation-validation
tags: [checkpoint, recount, publish-guards, browser-verification, digest-verified-build]
requires: ["37-01", "37-02", "37-03", "37-04", "37-05", "37-06"]
provides:
  - "Phase 37 checkpoint evidence and verdicts in 37-VALIDATION.md"
  - "CUR-04 and CUR-06 ticked on all-rows-PASS"
affects: [".planning/REQUIREMENTS.md"]
tech-stack:
  added: []
  patterns: ["DOM order diffed against an independent zero-import recount", "three-way served digests", "guards seen red on a planted leak"]
key-files:
  created: []
  modified:
    - .planning/phases/37-review-queue-priority-cur-04/37-VALIDATION.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Both requirements ticked: every mapped row (eight developer steps plus Task 1 guard and recount rows) is PASS"
  - "Plan defect recorded, not patched: guard 2 names /__curate/reviewed only if a directory __curate/ containing a file reviewed is planted"
requirements-completed: [CUR-04, CUR-06]
duration: checkpoint plan (multi-session)
completed: 2026-11-25
---

# Phase 37 Plan 07: Digest-verified browser checkpoint Summary

The queue order, four views, reviewed-and-kept lifecycle and both publish guards were judged on a digest-verified served build against values the queue code did not produce. All eight developer steps and the Task 1 guard and recount rows passed.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1 Regenerate, gates, served digests, recount, guards red/green | 01ac9997 | tsc clean; 122 files / 4274 tests; verify-dashboard exit 0 with three new 404 lines; three equal digest triples; recount 565 rows (T1 5 / T2 556 / T3 4); guards red on planted leak, green after |
| 2 Human-verify checkpoint | 6ed03c05 (verdicts recorded) | 8/8 PASS |
| 3 Record verdicts, tick requirements | 6ed03c05 | CUR-04 and CUR-06 ticked; nyquist_compliant true |

## Key results

- Order: DOM extractions matched the recount list exactly: All 565 rows and To review 553 rows (count, set, position, tier, metres). 565 = 553 + 0 + 12.
- Lifecycle: mark (one entry in reviewed.json, exclusions untouched), mutual exclusion in UI and by 409 on both PUT directions, resurface on fingerprint change, orphan listed under "No longer flagged (1)", un-review back to HEAD.
- Both committed files (reviewed.json, best-effort-exclusions.json) end byte-identical to HEAD. FALLBACK RESTORE was not needed.

## Deviations from Plan

1. **[Plan defect] Guard 2 plant shape.** Planting a file named `dist/widgets/__curate` leaves `/__curate/reviewed` at 404, so guard 2 named only the data/curation path. Naming both needs a directory `__curate/` with a file `reviewed`; that plant was used for the recorded run. Not a code defect.
2. **[Sequencing] Steps 4/5/6 interleaved.** The orchestrator applied the step-5 fingerprint edit and step-6 orphan append before the developer checked step 4's reviewed half. The row had resurfaced, so the fingerprint was restored, steps 4 (reviewed half) and 6 were confirmed together, and the fingerprint was re-broken for step 5. Verdicts unaffected.
3. **[Observation, by design]** Un-review for a "changed" row is shown under To review, not Reviewed (scripts/curate-queue/index.ts:444-447).
4. Task 1 regeneration rewrote only the `generatedAt` stamp of data/geo/geo-metadata.json; reverted with a single-file checkout.
5. Task 3 step 6 (leave ROADMAP/STATE alone) was superseded by the orchestrator's continuation instruction to update STATE.md and ROADMAP.md, with the phase left In Progress.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Commits 01ac9997 and 6ed03c05 exist; VALIDATION.md contains "Checkpoint Evidence" and "Checkpoint Verdicts".
