---
phase: 14-stream-ingestion-foundation
plan: 05
subsystem: data-pipeline
tags: [typescript, intervals-icu, vitest, cli-core, streams, backfill]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Locked CanonicalStream/RawSample contracts and the deriveFromIntervalsStreams normalization seam"
  - phase: 14-02
    provides: "stream-manifest.ts (loadManifest/upsertAvailable/upsertUnavailable/saveManifest)"
  - phase: 14-03
    provides: "backfillStreams() core, classifyUnavailable, buildBackfillTargets over data/provenance.json"
  - phase: 14-04
    provides: "Daily IntervalsSync stream persistence and CI commit of data/streams/"
provides:
  - "Third reconciliation branch (selectReconciliationTargets) closing the last ingestion gap: archived intervals-sourced activities with no export original and no stream file yet"
  - "D-02 size-gate report (formatSizeReport) printed after every backfill run, no git invocation"
  - "backfill-streams CLI command registered in src/index.ts and package.json"
  - "Real, committed data/streams/ archive: 1,842 stream files + manifest.json covering all 1,867 activities"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "source_provider-keyed reconciliation selection, not provenance-membership: robust to activities with no provenance entry, activities in archive_without_original, and any future decode-failure case"
    - "Pure size-report formatting decoupled from filesystem scanning, unit-testable without a real data/streams/"
    - "Never invoke git from an ingestion CLI — print a report, let the human stage and commit"

key-files:
  created: []
  modified:
    - src/streams/backfill-streams.ts
    - src/streams/backfill-streams.test.ts
    - src/index.ts
    - package.json
  data:
    - data/streams/manifest.json
    - "data/streams/<id>.json (1,842 files)"

key-decisions:
  - "selectReconciliationTargets keys on source_provider === 'intervals' rather than provenance membership, per RESEARCH.md Pitfall 3's recommendation — catches every current and future orphan class with one condition"
  - "Reconciliation counters (written/flagged/flaggedByReason) are corrected in-place when a previously-flagged id succeeds via live API, so the final console summary reflects the true end state rather than double-counting"
  - "User explicitly accepted the 138.33 MB size-gate overage (88.33 MB above the 50 MB advisory budget) and approved committing data/streams/ as-is at the current D-01 decimation — no re-derivation, no auto-tightening (D-02 forbids the tool from doing this itself)"

patterns-established:
  - "Checkpoint-gated real-data commits: the CLI produces output and a report; a human-verify checkpoint requires explicit developer approval before `git add`/`git commit` runs, keeping large committed-data decisions out of automated hands"

requirements-completed: [STREAM-01, STREAM-02, STREAM-03]

# Metrics
duration: ~20min
completed: 2026-08-10
---

# Phase 14 Plan 05: Reconciliation Branch, Size Gate, CLI Wiring, and Real Backfill Summary

**Closed the last stream-ingestion gap with a `source_provider`-keyed live-API reconciliation branch, added the D-02 size-gate report, registered `backfill-streams` as a CLI command, and ran the real backfill over all 1,867 archive activities — producing 1,842 committed stream files (138.33 MB, explicitly accepted by the developer over the 50 MB advisory budget) plus a manifest covering the entire archive.**

## Performance

- **Duration:** ~20 min (excluding the human review pause at the checkpoint)
- **Started:** 2026-08-10T14:55:00Z (approx, base commit d5f0e82)
- **Completed:** 2026-08-10T15:06:00Z
- **Tasks:** 3/3 completed (Task 3 required a blocking human-verify checkpoint; approved)
- **Files modified:** 4 source files (Tasks 1-2) + 1,843 data files (Task 3: 1,842 stream files + manifest.json)

## Accomplishments

- `selectReconciliationTargets` — pure selector over the in-memory archive index and current stream-id set, closing RESEARCH.md Pitfall 3's gap (activities neither STREAM-01-eligible nor STREAM-02-eligible)
- Third branch in `backfillStreams()`: constructs `IntervalsClient` only when the branch has work and `INTERVALS_API_KEY` is set; per-target `try`/`catch` settles retention-window misses and decode failures without aborting the run; counters correctly reconcile ids that flip from "flagged" to "written" mid-run
- `formatSizeReport` — pure, unit-tested size report (file count, total MB, ten largest files, mean size, git object estimate, `WARNING:` line above budget) with zero auto-tightening, per D-02
- `backfill-streams` registered as a first-class CLI command (`src/index.ts` switch case, help text, `npm run backfill-streams` script) mirroring the `consolidate-exports` dynamic-import pattern
- Ran the real backfill against the full archive (temporarily symlinking the main repo's gitignored `export_data/` and `.env` into this worktree; both removed immediately after the run) — produced and, after developer approval, committed the entire `data/streams/` archive

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the live-API reconciliation branch for orphaned intervals activities** - `469faa2` (feat)
2. **Task 2: Add the size-gate report and register the CLI command** - `bb9d8fe` (feat)
3. **Task 3: Run the real backfill, inspect the size report, and commit** - `4ad338f` (data) — committed by the developer after the blocking checkpoint was approved

## Files Created/Modified

- `src/streams/backfill-streams.ts` - Added `IntervalsClient`/`deriveFromIntervalsStreams` imports, `selectReconciliationTargets`, the third reconciliation branch inside `backfillStreams()`, and `formatSizeReport` (called at the end of the run, after `saveManifest`)
- `src/streams/backfill-streams.test.ts` - +8 tests: 4 for `selectReconciliationTargets` (selected/excluded-already-present/excluded-wrong-source/empty-archive), 4 for `formatSizeReport` (under-budget no warning, over-budget warning, largest-first ordering, empty-list no-throw)
- `src/index.ts` - `case 'backfill-streams'` registered (dynamic import, mirrors `consolidate-exports`), help text line added
- `package.json` - `"backfill-streams": "npm run build && node dist/index.js backfill-streams"` script added
- `data/streams/manifest.json` - Central availability index covering all 1,867 archive activities
- `data/streams/<id>.json` (1,842 files) - Committed per-activity canonical streams (FIT/GPX-derived + 1 live-intervals-reconciled)

## Real Backfill Results (Task 3 evidence)

**Run summary:**
```
archive total: 1866   (provenance.json was one day stale re: today's i174284902 sync — expected, harmless)
stream files written this run: 1842
skipped as already present: 0
flagged unavailable: 25
  manual: 23
  no-original: 2 (before reconciliation ran)
  no-samples: 1

Reconciling 2 intervals-sourced activities with no local original...
  i174110124: live intervals.icu fetch returned no usable samples; flagged no-samples
  i174284902: reconciled via live intervals.icu API
```

**Final manifest totals:** `{"activities":1867,"with_streams":1842,"without_streams":25,"by_reason":{"manual":23,"no-original":1,"no-samples":1}}` — `totals.activities` matches `data/activities/*.json` (1,867) exactly; `with_streams + without_streams = activities`.

**Size-gate report (D-02) — reviewed and explicitly approved by the developer:**
```
file count: 1843
total size: 138.33 MB
mean file size: 76.86 KB
WARNING: total size 138.33 MB exceeds the 50 MB budget by 88.33 MB
```
`du -sh data/streams` independently confirmed 142M on disk. This is materially larger than RESEARCH.md's "roughly doubles the ~38MB baseline" estimate — committed `data/` grows from ~38MB to ~176MB (≈4.6x, not ≈2x). **The developer reviewed this and approved committing as-is at the current D-01 decimation** — no re-derivation, no auto-tightening; the size delta is a conscious, recorded tradeoff, not an oversight.

**Assumption A1 (intervals.icu `0` cadence = pause/dropout, not real zero-cadence) — CONFIRMED:** `data/streams/i174284902.json` (today's reconciled intervals-sourced run) has `cadence` min 102, max 184, mean 177.47, **zero `0`-entries** across 886 samples. Values cluster in the plausible 140-200 spm running range near the predicted ~174 (the ×2 normalization), confirming raw `0` values were correctly treated as dropout/pause and carry-forward filled rather than passed through as real zero-cadence samples.

**Assumption A2 (intervals.icu ~1yr retention covers `i174110124`, 2026-03-09) — RESOLVED, different outcome than anticipated:** `i174110124` received `available: false, reason: "no-samples"` — not the anticipated `no-original` from a 404/retention-window miss. The live API call succeeded (no 404 thrown); `deriveFromIntervalsStreams` found no usable time+distance series in the response, so it correctly fell through the `null` branch (a fully spec'd, tested outcome from Task 1, just a different branch than A2's write-up assumed). A valid, non-crashing resolution.

**Reconciliation population:** `selectReconciliationTargets` found exactly **2** ids (`i174110124`, `i174284902`) — not the "3" loosely implied by the plan's Interfaces section. Direct cross-check against `data/provenance.json` confirmed no third distinct orphan exists today; the plan's "1 more... in `archive_without_original`" sentence was describing the same `i174110124`, not an additional id.

**Spot-checks:**
- FIT-sourced (`10041312551.json`): `schemaVersion 1, source fit, distanceSource native, sampleCount 939`, all five channels present
- GPX-sourced (`10146303423.json`): `schemaVersion 1, source gpx, distanceSource geo, sampleCount 2545`, `hr: false, cadence: false, elevation: true` — matches the expected extension-free GPX population
- `grep -rl '"lat"' data/streams/` → no matches (no position data leaked)
- `git status --short data/streams` before commit → only `?? data/streams/` untracked; no commit made by the backfill command itself

## Decisions Made

- **`selectReconciliationTargets` keys on `source_provider`, not provenance membership** — RESEARCH.md's explicit recommendation; robust to activities with no provenance entry at all, activities in `archive_without_original`, and any future FIT/GPX decode failure, with one condition instead of three special cases.
- **Reconciliation counters self-correct on state transitions** — when an id that was already flagged unavailable by the earlier passes succeeds via the live API, `written`/`flagged`/`flaggedByReason` are adjusted so the final console summary reflects the true end state rather than double-counting the same activity.
- **Size gate is advisory, not a hard stop** — per D-02, `formatSizeReport` prints a `WARNING:` but the backfill still completes and writes the manifest; the developer reviewed the 138.33 MB total against the 50 MB budget and explicitly approved committing it as-is, a conscious size/scope tradeoff recorded here rather than a silent overage.

## Deviations from Plan

### Auto-fixed / Judgment Calls (Rule 3 — blocking, environment access)

**1. `export_data/` and `.env` are absent from the isolated git worktree**
- **Found during:** Task 3 (running the real backfill)
- **Issue:** `export_data/` (gitignored, local-only FIT/GPX originals) and `.env` (gitignored, holds `INTERVALS_API_KEY`) do not exist inside this worktree's filesystem — each git worktree has its own working tree and gitignored files aren't shared, exactly as noted in 14-02-SUMMARY.md's Issues Encountered.
- **Fix:** Created temporary symlinks (`export_data` → main repo's `export_data/`, `.env` → main repo's `.env`) immediately before running `npm run backfill-streams`, then removed both symlinks immediately after the run completed. `git status --short` confirmed no symlink artifacts or other stray changes remained — only the genuine `data/streams/` output.
- **Files affected:** None (temporary, non-committed tooling; both symlinks existed only for the duration of one command)
- **Verification:** `git status --short | grep -v '^?? data/streams/'` returned empty after cleanup

**2. Assumption A2's anticipated outcome (404/`no-original`) did not occur; the actual outcome (`no-samples`) is a different but equally valid, already-implemented branch**
- **Found during:** Task 3 verification (Assumption A2 evidence gathering)
- **Issue:** RESEARCH.md predicted `i174110124` would either resolve (`available: true`) or 404 past the retention window (`available: false, reason: 'no-original'`). It actually resolved to `available: false, reason: 'no-samples'` — the live fetch succeeded but yielded no derivable time+distance series.
- **Resolution:** No code change needed — Task 1's `null`-result branch (`upsertUnavailable(manifest, id, 'no-samples')`) already covers this exact case. Documented as the actual finding rather than forcing the evidence to match the prediction.
- **Impact:** None on shipped behavior; purely a documentation/expectation correction, reported transparently to the developer at the checkpoint.

---

**Total deviations:** 2 (1 environment-access workaround, 1 expectation-vs-actual documentation correction)
**Impact on plan:** None on shipped code — both are process/documentation notes, not defects. All acceptance criteria and the full verification block were met.

## Issues Encountered

None beyond the two items documented above under Deviations.

## User Setup Required

None — no external service configuration required. `INTERVALS_API_KEY` was already configured in the main repo's `.env` (pre-existing, from Phase 14 plan 04 and earlier intervals.icu migration work).

## Next Phase Readiness

- `data/streams/` is fully committed: 1,842 stream files + `manifest.json`, covering all 1,867 archive activities with either an available stream or a reason-coded unavailable entry.
- Phase 15 (best-effort computation) can now read directly from `data/streams/<id>.json` and `data/streams/manifest.json` as its committed data source — no further backfill work needed for the historical archive.
- The daily `sync-intervals` pipeline (14-04) and this backfill's live reconciliation branch both funnel through the same `derive-stream.ts` seam, so new activities synced going forward will converge on the identical schema with no drift.
- One conscious tradeoff carried forward: committed `data/` is now ~176MB total (up from ~38MB), a developer-approved decision recorded in this summary and in the `data(14)` commit message — worth keeping in mind if future phases add more committed data families.
- No blockers identified for Phase 15.

## Self-Check: PASSED

All modified source files verified present on disk (`src/streams/backfill-streams.ts`, `src/streams/backfill-streams.test.ts`, `src/index.ts`, `package.json`). `data/streams/manifest.json` and 1,842 `data/streams/<id>.json` files verified present and committed. All commit hashes verified present in `git log` (`469faa2`, `bb9d8fe`, `4ad338f`).

---
*Phase: 14-stream-ingestion-foundation*
*Completed: 2026-08-10*
