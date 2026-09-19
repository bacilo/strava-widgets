---
phase: 32-unreliable-segment-detection-calibration
plan: 01
subsystem: infra
tags: [sha256, vitest, planning-docs, requirements-split, ci-gate]

# Dependency graph
requires: []
provides:
  - "SEG-05 split into SEG-05a (Phase 32's single-source audit half) and SEG-05b (per-consumer, Phases 33/35/36) in REQUIREMENTS.md and its Traceability table"
  - "SEG-04 / ROADMAP criterion 4 amended (D-03): Suunto over-measurement sample (activity 4556693525) disclosed by ID in the calibration artifact, never a fourth mechanism label"
  - "PITFALLS.md Pitfall 2 and research/SUMMARY.md's Phase 32 Delivers line superseded (D-01): the Suunto sample is no longer pinned as a must-not-fire fixture"
  - "D-04 one-treatment-per-segment note recorded on the Phase 33 and Phase 36 ROADMAP detail blocks"
  - "scripts/compute-stream-checksums.mjs: append-only sha256 manifest generator for data/streams/, built on the shared isStreamFile filter"
  - "data/stream-checksums.json: committed sha256 manifest of all 1,874 existing stream files, sibling to data/streams/, never colliding with data/streams/manifest.json"
  - "npm run compute-stream-checksums"
affects: [32-02, 32-03, 32-04, 32-05, 32-06, 32-07, 32-08, 32-09, 33, 34, 35, 36]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only manifest guard: appendToManifest refuses (ok:false, no write) on any existing-key digest change or deletion; checkManifest iterates only the manifest's own keys so unlisted new files are structurally invisible to it"
    - "Dated in-place amendment markers (Amended/Split/Superseded 2026-09-19 (32-CONTEXT.md D-NN)) so a grep finds every planning-doc correction"

key-files:
  created:
    - scripts/compute-stream-checksums.mjs
    - scripts/compute-stream-checksums.test.mjs
    - data/stream-checksums.json
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/research/PITFALLS.md
    - .planning/research/SUMMARY.md
    - package.json

key-decisions:
  - "D-14: SEG-05 is split into SEG-05a (Phase 32) and SEG-05b (Phases 33/35/36, per-consumer) — an unsplittable row is a planning defect (Phase 25's R6 lesson)."
  - "D-03: no fourth mechanism enum member. The Suunto over-measurement sample (activity 4556693525) is disclosed by activity ID in the calibration artifact rather than given its own label; the detector cannot tell over-measurement from an isolated GPS jump from t/d alone."
  - "D-01: the Suunto sample is no longer a must-not-fire fixture — measured (32-RESEARCH.md D-02) at 18.0-21.0 m/s on the committed stream, above all five named isolated jumps (10.0-14.3 m/s), so a run-level rule that flags the jumps will also flag the Suunto sample. If it fires, it IS a segment."
  - "D-04: every unreliable segment gets one downstream treatment (withhold a claim; never alter distance/totals/splits) regardless of mechanism — recorded on Phase 33 and 36 so neither adds a per-mechanism branch."
  - "D-17: the stream-checksum manifest lives at data/stream-checksums.json, a sibling of data/streams/, deliberately outside it, so it can never collide with the unrelated data/streams/manifest.json availability index (the Phase 27 G-01/G-03 glob defect)."

patterns-established:
  - "Pattern: a manifest generator's main() distinguishes 'manifest absent -> buildManifest' from 'manifest present -> appendToManifest', with appendToManifest as the only path that can refuse and exit 1 without writing."

requirements-completed: []  # Deliberate: this plan's `requirements: [SEG-05]` frontmatter names SEG-05 only as the split carrier. Task 1 replaces the unsplit SEG-05 row and its traceability cell with SEG-05a/SEG-05b, so `requirements mark-complete SEG-05` matches nothing and ticks nothing. SEG-05a belongs to plan 32-04; neither SEG-05a nor SEG-05b is ticked here.

# Metrics
duration: ~20min
completed: 2026-09-19
---

# Phase 32 Plan 01: Planning Amendments & D-17 Stream-Immutability Gate Summary

**Split the unsplittable SEG-05 requirement into SEG-05a/SEG-05b, recorded the D-03/D-01/D-04 Suunto-disposition amendments with dated provenance across REQUIREMENTS.md/ROADMAP.md/research, and landed a committed sha256 manifest + append-only generator + vitest gate that fails on any digest change to the 1,874 committed `data/streams/` files while tolerating new ones.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-19
- **Tasks:** 2
- **Files modified:** 8 (4 docs edited, 1 config edited, 3 created)

## Accomplishments

- REQUIREMENTS.md, ROADMAP.md and both research files carry the D-03/D-14/D-01/D-04 amendments with a literal, greppable dated marker on each — no SEG-0x checkbox is ticked and no unsplit `SEG-05` row or traceability cell remains.
- `scripts/compute-stream-checksums.mjs` + `.test.mjs` land the D-17 immutability gate: watched failing on a real one-byte edit to a non-fixture stream file (`10041312551.json`, named with expected/actual digests), restored, then re-verified green (12/12 tests).
- `data/stream-checksums.json` committed for all 1,874 existing stream files; a second run of `npm run compute-stream-checksums` prints `added 0` with a clean `git diff`, proving idempotence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the D-03 / D-14 / D-01 / D-04 amendments with dated provenance** - `f549bc1e` (docs)
2. **Task 2: D-17 stream-immutability manifest, append-only generator and vitest gate, watched failing** - `dbe6e301` (feat)

**Plan metadata:** (this commit) `docs(32-01): complete plan`

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - SEG-04 Suunto wording amended (D-03); SEG-05 split into SEG-05a/SEG-05b (D-14) with new Traceability rows; Out of Scope "genuine device over-measurement" row reworded; an `**Amendments:**` list added after the standing-conventions paragraph
- `.planning/ROADMAP.md` - Phase 32 `**Requirements**:` line and criterion 4 amended (D-03), criterion 5 annotated (D-14); Phase 33 and Phase 36 detail blocks each gained a D-04 one-treatment note
- `.planning/research/PITFALLS.md` - Pitfall 2 appended with a D-01 supersession note
- `.planning/research/SUMMARY.md` - Phase 32's "Delivers" line appended with the same D-01 supersession note
- `scripts/compute-stream-checksums.mjs` - `hashFile`, `listStreamFilenames`, `buildManifest`, `appendToManifest`, `checkManifest` pure functions plus a guarded `main()`; imports `isStreamFile` from the shared `lib/stream-files.mjs`, never a bare `.endsWith('.json')` glob
- `scripts/compute-stream-checksums.test.mjs` - pure-function tests, the permanent in-suite planted-edit proof (mkdtemp copy of two real stream files, one-byte flip, tolerated new file, restore), and the live gate reading `data/stream-checksums.json` against `data/streams/`
- `data/stream-checksums.json` - the committed manifest (schemaVersion 1, algorithm sha256, 1,874 files, no `manifest.json` key, no timestamp field)
- `package.json` - added `"compute-stream-checksums": "node scripts/compute-stream-checksums.mjs"`

## Decisions Made

See `key-decisions` in frontmatter (D-14, D-03, D-01, D-04, D-17) — all were made at the CONTEXT/discussion stage and this plan's job was to record them with dated provenance and implement D-17; no new decisions were made during execution.

One execution-time judgment call, within the plan's stated discretion: `appendToManifest` treats a since-deleted existing file as a mismatch with `actual: null` (rather than throwing) so the D-17 threat register's "fails on any listed file's digest change **or deletion**" (T-32-01) holds for the append path too, not only for `checkManifest`'s read-only path. This is an elaboration of the plan's own behavior spec (which only explicitly described `checkManifest`'s no-throw contract for deletions), not a deviation from it — covered under Rule 2 (missing critical correctness behavior for a stated threat mitigation).

## Deviations from Plan

None - plan executed exactly as written. The one elaboration above (append-path deletion handling) is documented for transparency but is a direct, literal-text-compatible implementation of D-17's own threat mitigation (T-32-01), not a change of scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1's other two plans (32-02 detector, 32-03 independent recount) can proceed independently — neither depends on this plan's files, and this plan touched none of theirs (`src/analytics/unreliable-segments.ts`, `src/analytics/unreliable-segments.test.ts`, `scripts/compute-unreliable-segment-recount.mjs`, `scripts/compute-unreliable-segment-recount.test.mjs`).
- Every later plan that reads `data/streams/` now has the D-17 gate as a standing regression check under `npm test`; no plan should ever need to hand-verify stream byte-identity again.
- SEG-05a (the single-source audit extension) is unblocked for plan 32-04, which is the plan that will tick it — this plan deliberately left it unticked per its own requirement-tick-safety note.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-19*

## Self-Check: PASSED

All created files confirmed present (`scripts/compute-stream-checksums.mjs`,
`scripts/compute-stream-checksums.test.mjs`, `data/stream-checksums.json`, this SUMMARY.md);
all three commit hashes (`f549bc1e`, `dbe6e301`, `3c943c90`) confirmed in `git log --oneline --all`.
