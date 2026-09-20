---
phase: 32-unreliable-segment-detection-calibration
plan: 09
subsystem: testing
tags: [vitest, fit-sdk, calibration, stream-checksums, merge]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration (plans 01, 04, 05, 06, 07, 08)
    provides: the shipped detector, its calibrated constants, the D-15 recount, the D-17 checksum
      gate, and the named-activity regression fixtures this plan validates and closes the gate on
provides:
  - A verified merge attempt (truthful no-op — origin/master was already an ancestor of local
    master) with its real outcome recorded, not fabricated
  - D-17's checksum manifest re-run post-merge (added 0, no existing digest changed, data/streams
    clean)
  - The calibration artifact regenerated twice post-merge with a byte-identical second run
  - scripts/validate-unreliable-segments-1hz.mjs — D-12's local-only 1 Hz FIT cross-check, with
    committed, dated findings (32-1HZ-VALIDATION.md) and a graceful-absence path
  - 32-VALIDATION.md closed out: every Per-Task row green, all `-t` filters non-vacuous with
    matched counts recorded, nyquist_compliant/wave_0_complete/status all flipped
  - SEG-04 ticked complete in REQUIREMENTS.md, closing Phase 32's requirement gate
affects: [33-pace-derivation-fold, 34-pause-classification, 36-best-effort-partitioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-12 local-only validation script pattern: imports shipped constants/detector only,
      derives nothing, no .test.mjs sibling (vitest collects scripts/**/*.test.mjs), no CI
      reference, existsSync graceful-absence branch, required --as-of flag for deterministic
      dated provenance instead of a wall-clock timestamp"
    - "MERGE-01 honesty pattern: when origin has nothing new to bring in, run the merge anyway
      (records the attempt), then state the no-op plainly rather than fabricating archive growth"

key-files:
  created:
    - scripts/validate-unreliable-segments-1hz.mjs
    - .planning/phases/32-unreliable-segment-detection-calibration/32-1HZ-VALIDATION.md
  modified:
    - package.json
    - .planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "MERGE-01 was a truthful no-op: origin/master (5e902283) was already an ancestor of local
    master (0 behind, 47 ahead) both at orchestrator-dispatch time and re-verified via a fresh
    git fetch at execution time. The merge was run anyway (git merge origin/master -> 'Already
    up to date') so the attempt is on the record. No new stream files arrived; D-17's append
    printed 'added 0' and data/streams stayed byte-identical."
  - "D-12's 1 Hz sample (4 named activities + first 20 flagged-with-FIT-original activities by
    id ascending, 83 segments total) found ALL 83 segments corroborated by an actual 1 Hz
    consecutive-pair speed above the shipped 7.35 m/s limit inside their own window. The
    STREAM-05 evidence section was written data-driven (branches on the real counts) rather than
    assuming a mixed outcome, after the first draft's hard-coded 'destroys information in both
    directions' narrative was caught contradicting the actual 100%-confirmed result."

requirements-completed: [SEG-04]

# Metrics
duration: ~40min
completed: 2026-09-20
---

# Phase 32 Plan 09: Merge, D-17 Re-Verification, D-12 1 Hz Cross-Check, and Phase Close Summary

**Truthful no-op merge (origin already contained), D-17 append of zero new streams, byte-identical post-merge calibration artifact, and D-12's local-only 1 Hz FIT cross-check finding all 83 sampled segments corroborated at 1 Hz — closing Phase 32's gate with SEG-04 ticked.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 4 created/modified in commits (scripts/validate-unreliable-segments-1hz.mjs, 32-1HZ-VALIDATION.md, package.json, 32-VALIDATION.md), plus REQUIREMENTS.md/STATE.md/ROADMAP.md via SDK state handlers

## Accomplishments

- Verified honestly that `origin/master` had nothing new to merge (0 behind, 47 ahead, re-confirmed with a fresh `git fetch` at execution time) and recorded that fact plainly rather than fabricating archive growth — the merge itself was still run (`git merge origin/master` → "Already up to date") so the attempt is on record.
- Re-ran `npm run compute-stream-checksums` post-merge: `added 0`, exit 0, no existing digest changed, `git status --porcelain data/streams` empty.
- Regenerated `32-CALIBRATION.md` twice post-merge with `git diff --exit-code` succeeding both times — byte-identical, live denominator unchanged at 1874 stream files (consistent with the no-op merge).
- Built `scripts/validate-unreliable-segments-1hz.mjs` (D-12): decodes real FIT originals under `export_data/strava/` (present on this machine, 1,835 `.fit.gz` files), aligns them to the committed stream via `data/activities/{id}.json`'s `start_date`, and measures every segment the shipped detector flags on the four named scoping activities plus the first 20 flagged-with-FIT-original activities (ascending id) at 1 Hz. Committed `32-1HZ-VALIDATION.md` with dated findings (`As of: 2026-09-20`).
- Closed `32-VALIDATION.md`: filled matched counts for all three `-t` filters (decimation: 3, `3475724402`: 4, mechanism: 12 — none vacuous), added the D-12 row's concrete verification, ticked all seven Wave 0 items, and flipped frontmatter to `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`.
- Ticked `SEG-04` complete in `REQUIREMENTS.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge origin, append new streams to the D-17 manifest, regenerate the artifact twice, recount green** — no commit (truthful no-op: the merge, the checksum append, and both calibration regenerations produced zero file changes, so there was nothing to commit; verified with `git status --porcelain` returning empty after every step)
2. **Task 2: D-12 local-only 1 Hz validation script and its dated findings** — `99b974d1` (feat)
3. **Task 3: Closing gate and VALIDATION.md sign-off** — `60e3ef6a` (docs)

**Plan metadata:** this SUMMARY's own commit (docs: complete plan)

## Files Created/Modified

- `scripts/validate-unreliable-segments-1hz.mjs` - D-12's local-only 1 Hz FIT cross-check: `parseArgs`, `loadCsvFilenameMap`, `findFlaggedActivitiesWithFitOriginal`/`buildSampleActivityIds`, `buildRelDistanceSamples`/`distanceAt`/`alignmentResidualMedian`, `measureSegmentAt1Hz`, `buildActivityFinding`, `renderReport`. No `.test.mjs` sibling, no CI reference, `existsSync` graceful-absence branch, required `--as-of` flag.
- `.planning/phases/32-unreliable-segment-detection-calibration/32-1HZ-VALIDATION.md` - Dated (`As of: 2026-09-20`) per-activity alignment table, per-segment 1 Hz measurement table (83 rows), summary, and `## First evidence for STREAM-05` section.
- `package.json` - Added `"validate-unreliable-segments-1hz": "npm run build && node scripts/validate-unreliable-segments-1hz.mjs"`.
- `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md` - Matched counts, D-12 row detail, Wave 0 ticks, sign-off, frontmatter `status: complete`/`nyquist_compliant: true`/`wave_0_complete: true`.
- `.planning/REQUIREMENTS.md` - SEG-04 ticked complete (via `requirements.mark-complete`).
- `.planning/STATE.md` - Position, decisions, session, and progress counters updated (via SDK handlers plus a manual frontmatter fix — see Issues Encountered).

## Decisions Made

- **MERGE-01 honesty**: Rather than treat "nothing to merge" as a plan failure, the merge was run anyway (recording the attempt on the branch history via `git log --merges` search, which correctly shows none — a true fast-forward no-op has no merge commit to make, since there was nothing to reconcile), and both `32-09-SUMMARY.md` (this file) and `32-CALIBRATION.md`'s unchanged figures state the no-op plainly. No archive growth, no new stream files, and no fabricated numbers.
- **D-12 STREAM-05 prose made data-driven**: the script's first draft hard-coded a "decimation destroys information in both directions" narrative assuming some segments would fail 1 Hz corroboration. The real run found 83/83 confirmed, which would have made that sentence false. Fixed before committing by branching the report's STREAM-05 section on the actual measured counts, so the committed finding accurately states a 100%-confirmation result and explicitly scopes what it does and does not settle (burst existence only, not the separate over-measurement-vs-jump discriminator, since no sampled segment carries that ambiguous signature).
- **Sample selection order**: named activities (3475724402, 3475734189, 3475740390, 4556693525) first, then the first 20 flagged-with-FIT-original activities by numeric id ascending, de-duplicated. No overlap occurred in practice (the named ids are numerically larger than the flagged-ascending window).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] STREAM-05 narrative hard-coded a mixed outcome that the real data contradicted**
- **Found during:** Task 2, immediately after the first real run against `export_data/`
- **Issue:** The initial `renderReport` implementation wrote a fixed sentence claiming decimation "manufactures fast-looking aggregates a 1 Hz reading would not corroborate" — written before the real numbers were known. The actual run found 83 of 83 segments confirmed at 1 Hz (0 not confirmed, 0 insufficient), directly contradicting that hard-coded claim.
- **Fix:** Rewrote the STREAM-05 section to branch on the actual `confirmedAt1Hz`/`notConfirmedAt1Hz`/`insufficientCount` values, with distinct honest prose for the all-confirmed case (this run's actual outcome) versus a genuinely mixed case, explicitly scoping what the finding does and does not establish.
- **Files modified:** `scripts/validate-unreliable-segments-1hz.mjs`
- **Verification:** Re-ran the script; `32-1HZ-VALIDATION.md`'s STREAM-05 section now reads "all 83 of 83 segments ... are corroborated" and states this is evidence against 1 Hz re-derivation improving *burst-existence* discrimination on this sample, not a claim the report's data doesn't support.
- **Committed in:** `99b974d1` (Task 2 commit — the fix was made before the first commit, so no separate fix commit was needed)

**2. [Rule 3 - Blocking] `state.record-metric`/`state.add-decision`'s read-modify-write reverted a manual STATE.md frontmatter edit**
- **Found during:** State-update step (post-Task-3)
- **Issue:** `state.advance-plan` correctly flipped `status` to `verifying` and Current Position to "Phase complete — ready for verification", but `state.update-progress` returned `{ updated: false, reason: 'Progress field not found in STATE.md' }` — this project's STATE.md carries `progress:` as YAML frontmatter, not the `**Progress:** [bar]` body line the handler's regex expects. A manual frontmatter edit (`completed_plans: 8 -> 9`, `percent: 0 -> 100`) was twice silently reverted back to `8`/`0` by the next `state.record-metric`/`state.add-decision` call, each of which does its own read-modify-write cycle against what appears to be a stale in-memory copy of the file rather than the just-edited on-disk content.
- **Fix:** Ran every remaining SDK state mutation (`record-metric`, `add-decision`, `record-session`) first, then applied the frontmatter fix (`completed_plans: 9`, `percent: 100`) as the final edit to STATE.md, after which no further SDK mutation touched the file.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Read the file after the final edit; `completed_plans: 9` and `percent: 100` persisted through the final `roadmap.update-plan-progress` and `commit` steps.
- **Committed in:** the final metadata commit for this plan

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness of the committed record; no scope creep.

## Issues Encountered

- `gsd-sdk query state.update-progress` does not recognize this project's STATE.md progress format (YAML frontmatter block, not a `**Progress:** [bar]` body line) and always returns `updated: false`. Worked around by hand-editing the frontmatter's `completed_plans`/`percent` fields directly, applied last (see Deviations #2) so a subsequent SDK mutation would not clobber it.
- `state.record-metric` and `state.add-decision` require named CLI args (`--phase`, `--plan`, `--duration`, `--tasks`, `--files` / `--phase`, `--summary`), not positional args as this workflow's own doc example shows (`state.record-metric "${PHASE}" "${PLAN}" ...`). Adjusted the invocation to the named-arg form the CLI's `parseNamedArgs` actually expects.

## Next Phase Readiness

- Phase 32 is fully closed: every requirement (SEG-01, SEG-02, SEG-03, SEG-04) is ticked complete in `REQUIREMENTS.md`, `32-VALIDATION.md` is `status: complete` / `nyquist_compliant: true`, and the full gate (`npm run build`, `npx tsc --noEmit`, `npm test` at 90 files/2788 tests, the recount, and the byte-identical calibration regeneration) is green on the merged tree.
- **Open item carried forward (pre-existing, out of this plan's declared scope):** `SEG-05a`'s row in `REQUIREMENTS.md` (line 23, and the Traceability table) still reads `[ ]` Pending, even though `32-04-SUMMARY.md`'s own frontmatter records `requirements-completed: [SEG-05a]` and its body states "SEG-05a is fully discharged." This looks like a tick that never made it into `REQUIREMENTS.md` during plan 32-04's execution. This plan's own frontmatter scopes only `SEG-04`, so `SEG-05a` was deliberately left untouched here rather than silently ticked without re-verifying 32-04's own claim first-hand; flagging it for the operator or a follow-up plan to reconcile (re-run `-t "SEG-05a"` — confirmed 7/7 passing in this session's full-suite run — and tick if that re-confirmation is judged sufficient).
- Phases 33 (pace-derivation fold), 34/35 (pause classification, running pace) and 36 (best-effort partitioning/ceiling) can now consume `unreliable-segments.ts`'s shipped output; D-04's one-treatment-per-segment note and D-03's Suunto disclosure-not-correction rule both apply to their wiring.
- `.planning/phases/32-unreliable-segment-detection-calibration/32-1HZ-VALIDATION.md` is the first measured evidence for the deferred STREAM-05 question (carried into v2.3) — a future STREAM-05 revisit is not blocked or required by this phase, but has real data to start from.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `scripts/validate-unreliable-segments-1hz.mjs`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-1HZ-VALIDATION.md`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-VALIDATION.md`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-09-SUMMARY.md`
- FOUND commit `99b974d1` (Task 2)
- FOUND commit `60e3ef6a` (Task 3)
- `SEG-04` confirmed `[x]` in `.planning/REQUIREMENTS.md`
