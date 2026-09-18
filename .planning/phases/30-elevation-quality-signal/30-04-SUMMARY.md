---
phase: 30-elevation-quality-signal
plan: 04
subsystem: analytics
tags: [scripts, calibration, elevation, archive-sweep, digest-gate, requirements-correction]

# Dependency graph
requires:
  - phase: 30-elevation-quality-signal
    plan: 01
    provides: "elevationSignal(stream, metadata) assembly, the three detectors, LOOP_RADIUS_M and the three threshold constants, all exported from src/analytics/pace-quality.ts"
provides:
  - "scripts/compute-elevation-calibration.mjs — the archive-wide dry run, D-16's digest gate, and the markdown renderer; single declared write target 30-CALIBRATION.md"
  - "30-CALIBRATION.md — the regenerable artifact of record for ELEV-02, with the loop-gated cohorts (11/21/39, union 60), the raw-definition union (71) and its decomposition, the derived 100 m loop radius and its justification, the D-08 carry-forward finding, and the D-16 stream-integrity digest"
  - "ROADMAP.md Criterion 1/3 and REQUIREMENTS.md ELEV-01 corrected to the loop-gated count (D-04), citing 30-CALIBRATION.md, checkboxes left unticked"
affects: [30-05, 30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Calibration script calls the shipped elevationSignal(stream, metadata) assembly directly for every activity (not the three sub-detectors separately) so the loop-gated cohorts and the distance distribution are read from ONE call to the actual shipped classifier, never re-derived"
    - "closureDriftSignal's startEndDistM is retained whenever position is normalizable, regardless of alt validity — reused to build the D-03 distance distribution over ALL activities without a second haversine implementation"
    - "D-16's digest gate and the inclusion-exclusion arithmetic check both exit non-zero with a named message BEFORE the report is written, so a mutated archive or a broken overlap matrix can never produce a report that looks clean"

key-files:
  created:
    - scripts/compute-elevation-calibration.mjs
    - scripts/compute-elevation-calibration.test.mjs
    - .planning/phases/30-elevation-quality-signal/30-CALIBRATION.md
  modified:
    - package.json
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Printed the raw-definition union (71) explicitly in 30-CALIBRATION.md's Mode Independence section (a small addition after the initial Task 1/2 commits) so Task 3's ROADMAP Criterion 3 citation is grounded in a number the report actually states, not merely implied by the raw drift decomposition."
  - "Carry-forward correlation measured 39 of 72 (54.2%) by this script's own stated operationalization (precedingIdenticalRun >= 2), diverging from 30-RESEARCH.md's own preliminary 19/72 (26%) estimate. Spot-checked five correlated pairs against raw archive bytes — all genuine carry-forward-filled flat runs followed by a jump, no bug found. 30-RESEARCH.md's own Assumption A2 explicitly flagged this operationalization as its own construction with LOW risk to the qualitative finding (manufactures, never masks) regardless of the exact count, so the live-measured 39/72 stands as this run's own number rather than being forced to match the prior estimate."
  - "Used elevationSignal(stream, metadata) — the full shipped assembly — for every activity rather than calling subGroundSignal/closureDriftSignal/verticalRateSignal separately, per 30-RESEARCH.md Pitfall 1's warning that a report disagreeing with the shipped detector is an implementation bug, not a wording slip."

patterns-established:
  - "A calibration report's digest gate and internal arithmetic checks (inclusion-exclusion) both fail BEFORE the write, never after — the report file itself can never exist in a state that contradicts its own gates."

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-09-18
---

# Phase 30 Plan 04: Elevation Calibration Report and the D-04 Requirement Correction Summary

**The archive-wide elevation dry run ELEV-02 requires now exists as a regenerable, digest-verified report measuring a loop-gated union of 60 activities (not the raw 71 the requirement originally cited), and ROADMAP/REQUIREMENTS are corrected to that measured figure with the correction fully auditable — both the loop-gated and raw-definition numbers stay visible.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-18T~15:35 CEST (approx.)
- **Completed:** 2026-09-18T16:21 CEST
- **Tasks:** 3 (plus one small refinement commit between Tasks 2 and 3)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `scripts/compute-elevation-calibration.mjs` — imports `elevationSignal` and the four threshold constants directly from `dist/analytics/pace-quality.js` (the one script this phase allows to), sweeps `data/activities/` + `data/streams/` read-only, and computes: live denominators, the D-03 start/end distance distribution, per-mode cohorts with worst-3 lists, the loop-gated 3×3 overlap matrix with an asserted inclusion-exclusion check, device-family breakdown, the D-04 raw-drift decomposition (21 loop-gated + 12 point-to-point + 1 no-position), the archive-wide drift not-computable cohort (207), and the D-08 carry-forward correlation with a live-derived worst-case trace.
- D-16's digest gate: sha256 of `data/streams/` rolled before and after the sweep, exits non-zero on mismatch before the report is ever written. Demonstrated failing then passing against a disposable temp directory (verbatim output below).
- `scripts/compute-elevation-calibration.test.mjs` — 32 tests: import-time no-op (with and without a pre-existing report), every pure helper (overlap matrix, inclusion-exclusion, device bucketing, distance bucketing, run-length, the digest gate itself), and a source-scan test proving neither the calibration script nor `src/analytics/pace-quality.ts` has any `fs` write call resolving under `data/`.
- `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md` generated and regenerated — every figure matches 30-RESEARCH.md's own live-measured predictions exactly: loop-gated union **60**, sub-ground **11**, drift **21**, vertical rate **39**, raw union **71**, 207 drift not-computable, device breakdown Suunto 9 46 / fēnix 6 Pro 11 / no device name 2 / vívoactive 4 1.
- ROADMAP.md Criterion 1/3 and REQUIREMENTS.md ELEV-01 corrected to the loop-gated figures (D-04), each citing `30-CALIBRATION.md` by name; checkboxes and the Requirements Coverage table left `Pending` (untouched).

## Task Commits

1. **Task 1: The sweep script, its digest gate, and its guard tests** - `3d823d7a` (feat)
2. **Task 2: Generate 30-CALIBRATION.md and prove it regenerable** - `56c0891a` (docs)
3. **(refinement) Print the raw-definition union in the report** - `33f0b86a` (feat) — needed before Task 3 so its ROADMAP citation is grounded in a number the report states
4. **Task 3: Correct the two requirement documents to the measured loop-gated counts** - `1ce7e5dc` (docs)

## Files Created/Modified

- `scripts/compute-elevation-calibration.mjs` — new, 615 lines. Pure exported helpers (`idFromFilename`, `isStreamFile`, `hasAltChannel`, `formatPct`, `rawClosureDelta`, `computeOverlapMatrix`, `checkInclusionExclusion`, `deviceFamilyBreakdown`, `distanceDistribution`, `precedingIdenticalRunLength`, `scanVerticalRatePairs`, `computeStreamsDigest`, `checkDigestGate`, `renderCalibrationMarkdown`) plus I/O (`readArchive`, `buildReport`, `main`) behind a self-execution guard.
- `scripts/compute-elevation-calibration.test.mjs` — new, 32 tests.
- `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md` — new, generated document (167 lines).
- `package.json` — one new script line, diff confined to the scripts block.
- `.planning/ROADMAP.md` — Phase 30 Criterion 1 and Criterion 3 corrected (4 lines changed).
- `.planning/REQUIREMENTS.md` — ELEV-01's cohort figure and barometric-closure-drift bullet corrected (4 lines changed).

## Decisions Made

- **D-03 (loop radius):** re-derived live at `LOOP_RADIUS_M = 100`, confirming 30-RESEARCH.md's finding — the 1,658 positioned activities are bimodal with a literal zero-width gap: 1,048 at exactly 0 m, 610 at ≥ 552.44 m, nothing between. Any radius in `(0, 552.4)` is archive-equivalent; 100 m is used for headroom.
- **D-04 (the correction):** implemented as a live re-derivation, not a copy — the script computes the raw (un-loop-gated) drift cohort itself (`rawClosureDelta`, using the imported `CLOSURE_DRIFT_SEVERE_DELTA_M` threshold) and cross-references each raw-flagged activity against the shipped `closureDriftSignal`'s own `state` field to classify it as loop-gated / point-to-point / no-position — never a second, independent drift implementation.
- **D-08 (carry-forward disclosure):** stated in the report as a finding, not a defect; the detector is explicitly not changed. The measured correlation (39/72, 54.2%) diverges from research's preliminary estimate (19/72) — investigated via a direct spot-check of five correlated pairs against raw archive data (see Deviations); all genuine, no bug.
- **D-16 (stream integrity):** the digest gate runs and exits non-zero BEFORE the report is written, not after — a report file can never exist alongside a failed integrity check.
- Chose to compute `elevationSignal(stream, metadata)` once per activity (the full shipped assembly) rather than calling the three detectors separately, so every cohort in the report is read from exactly the code path the dashboard itself uses — eliminates an entire class of "report disagrees with shipped detector" bugs by construction (30-RESEARCH.md Pitfall 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `deviceFamilyBreakdown` test's expected sort order was wrong, not the implementation**
- **Found during:** Task 1, first `vitest run` after writing the test file
- **Issue:** The hand-built test expected `[['Suunto 9', 2], ['(no device name)', 3]]`, but the function correctly sorts by count descending, so `(no device name)` (count 3) sorts before `Suunto 9` (count 2).
- **Fix:** Corrected the test's expected array order; the implementation was already correct.
- **Files modified:** `scripts/compute-elevation-calibration.test.mjs`
- **Verification:** `npx vitest run scripts/compute-elevation-calibration.test.mjs` — all pass.
- **Committed in:** `3d823d7a` (Task 1 commit)

**2. [Rule 1 - Bug] The import-time mtime guard test assumed the report already existed**
- **Found during:** Task 1, same first test run — `30-CALIBRATION.md` does not exist until Task 2 runs the script
- **Issue:** Copied verbatim from `compute-pace-quality-calibration.test.mjs`'s precedent (which assumes a pre-existing committed report from an earlier phase), the test unconditionally asserted `existsSync(OUTPUT_PATH) === true`. Task 1 commits before Task 2 generates the file, so this failed.
- **Fix:** Made the test branch on whether the report existed before import — if not, assert it still does not exist after import (proving the guard, not merely skipping the check); if it does, assert the mtime is unchanged (the original assertion).
- **Files modified:** `scripts/compute-elevation-calibration.test.mjs`
- **Verification:** Passes both before Task 2 (file absent) and after (file present, mtime stable).
- **Committed in:** `3d823d7a` (Task 1 commit)

**3. [Rule 1 - Bug] The literal, case-sensitive "manufactures" acceptance-criteria grep would have failed against "MANUFACTURES"**
- **Found during:** Writing the renderer, before first report generation — caught by re-reading the plan's exact acceptance criteria (`grep -c "manufactures"`, no `-i` flag)
- **Issue:** The D-08 section originally read "... MANUFACTURES apparent vertical-rate violations ..." (uppercase for emphasis); plain `grep -c "manufactures"` is case-sensitive and would return 0.
- **Fix:** Lowercased to "manufactures" (still bolded/readable in context); "never masks" was already lowercase and unaffected.
- **Files modified:** `scripts/compute-elevation-calibration.mjs`
- **Verification:** `grep -c "manufactures" .planning/phases/30-elevation-quality-signal/30-CALIBRATION.md` returns 1.
- **Committed in:** `3d823d7a` (Task 1 commit, before the report existed — verified again after Task 2's generation)

**4. [Rule 2 - Missing functionality] The raw-definition union (71) was computed internally (`overlapRaw`) but never printed**
- **Found during:** Preparing Task 3 — the ROADMAP Criterion 3 correction needed to cite "how the raw-definition union decomposes," but the generated report never stated that number explicitly (only its constituent pieces).
- **Issue:** Citing `30-CALIBRATION.md` for a figure the document didn't actually print would be an unverifiable citation.
- **Fix:** Added one paragraph to the Mode Independence section printing the raw union (71) explicitly, with the live-measured comparison to the loop-gated union (60). Re-verified idempotence and all greps after the change.
- **Files modified:** `scripts/compute-elevation-calibration.mjs`, `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md`
- **Verification:** `grep -n "Raw-definition union" 30-CALIBRATION.md` shows the line; idempotence re-confirmed (diff clean modulo timestamp).
- **Committed in:** `33f0b86a` (separate small commit between Task 2 and Task 3)

---

**Total deviations:** 4 auto-fixed (3 Rule 1 test/wording bugs caught before generating the report, 1 Rule 2 addition needed for Task 3's citation to be grounded)
**Impact on plan:** No scope creep. All four were required either to make the guard tests actually exercise what they claim (Rule 1) or to make Task 3's citation auditable per D-04's own instruction (Rule 2). No behavior beyond what the plan's own acceptance criteria and Task 3's action text already demanded.

## Verbatim Evidence

### Digest gate demonstrated failing then passing (Task 1 acceptance criterion)

```
BEFORE: {
  digest: '9c9e09135d042691cf93678eee43eff5e0454dc051f04fb6a0d1d2df2521665b',
  fileCount: 2,
  error: null
}
AFTER (mutated): {
  digest: '619edaa9d01cb2e631c0c83566c91b2dfe47d4ef45d729f683a570e3fb44a9b6',
  fileCount: 2,
  error: null
}
GATE (mutated): {
  pass: false,
  message: 'FATAL: data/streams/ changed during the calibration sweep (before=9c9e09135d042691cf93678eee43eff5e0454dc051f04fb6a0d1d2df2521665b [2 files], after=619edaa9d01cb2e631c0c83566c91b2dfe47d4ef45d729f683a570e3fb44a9b6 [2 files]) — this script must never write to data/, and the sweep itself must be read-only. Refusing to write the calibration report.'
}
GATE (restored): {
  pass: true,
  message: 'data/streams/ is byte-unchanged (digest match, 2 files): 9c9e09135d042691cf93678eee43eff5e0454dc051f04fb6a0d1d2df2521665b'
}
```

The mutation happened entirely in a disposable `mkdtempSync` temp directory under `os.tmpdir()`; `data/` was never touched (confirmed by `git status --porcelain data/` returning empty throughout).

### Idempotence (Task 2 acceptance criterion)

Two consecutive `npm run compute-elevation-calibration` runs, diffed with the `**Generated:**` line filtered out:

```
$ diff <(grep -v '^\*\*Generated:\*\*' run1.md) <(grep -v '^\*\*Generated:\*\*' run2.md)
(no output)
IDENTICAL modulo timestamp
```

Re-confirmed after the Deviation #4 report-renderer change (added the raw-union line) — still byte-identical modulo timestamp.

### Carry-forward correlation spot-check (Deviation, investigated not fixed)

Live sweep: **total violating pairs = 72** (matches 30-RESEARCH.md exactly), **correlated (`precedingIdenticalRun >= 2`) = 39** (30-RESEARCH.md's own preliminary estimate was 19). Five spot-checked examples, all genuine carry-forward-filled flat runs immediately preceding the jump (e.g. `3149636661` at index 21: `alt = [191.8, 191.6, 191.6, 30.8]`, `t = [76, 78, 80, 82]` — the violating jump is the last pair). No implementation bug found; 30-RESEARCH.md's Assumption A2 explicitly names its own 19/72 figure as "this research's own construction" with "LOW" risk to the qualitative finding regardless of the exact operationalization chosen.

### Task 3's exact verify command, run and passing

```
$ bash -c 'grep -c "at least 34\|34 barometric-closure-drift" .planning/ROADMAP.md .planning/REQUIREMENTS.md | grep -qv ":[1-9]" && grep -q "raw-difference" .planning/ROADMAP.md && grep -q "raw-difference" .planning/REQUIREMENTS.md && echo CORRECTED'
CORRECTED
```

### The exact corrected sentences

**ROADMAP.md Criterion 1** (full corrected text):
> All three modes are detected archive-wide: a dry-run report over the full committed archive independently reproduces at least the 11 sub-ground-level activities (worst: −282 m, Lisbon), at least the 21 loop-gated barometric-closure-drift activities (start/end within the derived 100 m loop radius differing >60 m, worst 198 m), and at least the 39 implausible-vertical-rate activities — each count read from the report, not inferred from the detector's own self-description. *(D-04 correction, `30-CALIBRATION.md`: the original "34" was a raw start/end altitude difference measured WITHOUT the loop condition; it decomposes into 21 loop-gated + 12 point-to-point + 1 no-position. The 12 point-to-point activities are excluded by design — their endpoints are 626 m–9,584 m apart, and a real 60–90 m altitude change is plausible between endpoints kilometres apart. See `30-CALIBRATION.md` § Correction of the raw-difference count (D-04).)*

**ROADMAP.md Criterion 3** (full corrected text):
> Flag rate reconciles archive-wide and nothing is corrected: the report's total flagged count reconciles with the measured 60-activity (3.2%) LOOP-GATED cohort, AND separately shows how the raw-definition 71-activity (3.8%) union — the requirement's originally-measured figure — decomposes against it, so the correction is visible rather than silent (see `30-CALIBRATION.md` § Overlap matrix (loop-gated) and § Mode independence (Criterion 2)); sampled across all four named device families (Suunto 9 46, Garmin fēnix 6 Pro 11, no device name 2, vívoactive 4 1, loop-gated breakdown); a code/behavior audit confirms `data/streams/` files are byte-unchanged after running the detector — flag only, no DEM lookup, no correction, no grade-adjusted pace.

**REQUIREMENTS.md ELEV-01** (corrected cohort line and drift bullet):
> Implausible altitude is detected and flagged archive-wide by *mechanism*, not by a single bound. Measured cohort (loop-gated, as the shipped detector actually flags): **60 activities (3.2%)** carry at least one anomaly, spanning all device families (Suunto 9 46, Garmin fēnix 6 Pro 11, no device name 2, vívoactive 4 1) — this is not one device's quirk. ...
> **Barometric closure drift (loop-gated)** — 21 activities whose start and end altitudes differ by >60 m despite returning to the same place (start/end within the derived 100 m loop radius, tested via activity metadata `start_latlng`/`end_latlng`), worst at 198 m. This is the largest single-mode cohort and a simple floor bound cannot catch any of it. *(D-04 correction, `30-CALIBRATION.md`: the original figure of 34 was a raw-difference measurement (start and end altitudes differing by >60 m, no loop condition applied) taken WITHOUT the loop condition — it decomposes into 21 loop-gated + 12 point-to-point (626 m–9,584 m apart, excluded by design) + 1 no-position. The un-loop-gated raw union across all three modes is 71 (3.8%), matching this requirement's original cited figure; see `30-CALIBRATION.md` § Correction of the raw-difference count (D-04).)*

## Live Figures vs. 30-RESEARCH.md (delta and disposition)

| Quantity | 30-RESEARCH.md | This run | Delta | Disposition |
|---|---|---|---|---|
| Activities / alt-carrying streams | 1,890 / 1,865 | 1890 / 1865 | 0 | No archive drift since research (same day) |
| Sub-ground | 11 | 11 | 0 | Exact match |
| Loop-gated drift | 21 | 21 | 0 | Exact match |
| Vertical rate | 39 | 39 | 0 | Exact match |
| Loop-gated union | 60 | 60 | 0 | Exact match |
| Raw union | 71 | 71 | 0 | Exact match |
| Overlap matrix (sub∩drift/sub∩rate/drift∩rate/all-three) | 6/3/3/1 | 6/3/3/1 | 0 | Exact match |
| Device breakdown (loop-gated union) | Suunto 9 46 / fēnix 6 Pro 11 / no device 2 / vívoactive 4 1 | identical | 0 | Exact match |
| Drift not-computable (archive-wide) | 207 | 207 | 0 | Exact match |
| Carry-forward correlation | 19/72 (26%), preliminary/MEDIUM confidence | 39/72 (54.2%) | +20 pairs | Behavioral (different operationalization, not archive drift) — spot-checked, no bug; see Deviations |

Every archive-measured cohort figure reproduces 30-RESEARCH.md's own live measurement exactly (same-day archive, zero drift). The one divergence (carry-forward correlation count) is explicitly a difference in this script's own stated operationalization versus research's preliminary estimate, not a defect — both are internally consistent with the qualitative D-08 finding (manufactures, never masks).

## Issues Encountered

None beyond the four auto-fixed deviations above — all caught and resolved before their respective task's commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `30-CALIBRATION.md` is the artifact of record plan 30-08's checkpoint will read against; every figure it needs (loop-gated cohorts, device breakdown, D-08 disclosure, D-16 integrity) is present and regenerable.
- `scripts/compute-elevation-calibration.mjs` is available for plan 30-07's byte-stability regression check and for re-running before the checkpoint plan drafts its rows.
- ROADMAP.md and REQUIREMENTS.md now state the number the shipped detector actually flags; no downstream plan needs to reconcile a stale "34"/"71" figure.
- No blockers for downstream plans. Per this wave's tracking-write rule, STATE.md's progress/position sections and the ROADMAP plan checklist were deliberately left untouched — the orchestrator will consolidate wave 2 (30-02/30-03/30-04) after all three agents complete.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 6 files listed under Files Created/Modified verified present on disk. All four commit hashes
(`3d823d7a`, `56c0891a`, `33f0b86a`, `1ce7e5dc`) verified present in `git log --oneline --all`.
