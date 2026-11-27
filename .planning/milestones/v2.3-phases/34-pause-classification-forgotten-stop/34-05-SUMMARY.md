---
phase: 34-pause-classification-forgotten-stop
plan: 05
subsystem: analytics
tags: [pause-classification, pace-derivation, calibration-artifact, vitest, pause-03]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop (plan 03)
    provides: "collectPauseIntervals, isTransported, PauseInterval source tagging (dist/analytics/pause-classification.js)"
provides:
  - "scripts/compute-pause-transport-remeasurement.mjs: remeasureActivity, remeasureArchive, renderRemeasurementMarkdown, V22_MIN_INTERVAL_SEC/V22_MIN_ADVANCE_M, guarded main()"
  - "34-PAUSE03-REMEASUREMENT.md: PAUSE-03's figure of record with dated, content-addressed provenance"
  - "v2.2-REQUIREMENTS.md:165's forward pointer now resolves to a real, regenerated artifact"
affects: [34-11-requirements-tick, 36-best-effort-partitioning, 37-review-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v2.2's undocumented rule text re-implemented as named constants (V22_MIN_INTERVAL_SEC/V22_MIN_ADVANCE_M) quoted from REQUIREMENTS.md, applied side by side to a pre-detector interval source (classifyGapsThreeWay) and a post-detector merged source (collectPauseIntervals) — never re-deriving either"
    - "remeasureActivity returns the FULL per-rule interval list (not pre-filtered to qualifying ones); qualifies is `.some(v22Qualifies)` over that list, and remeasureArchive derives qualifying-interval counts/max-km/h by re-filtering the same list — one source of truth for 'every interval considered' vs 'the ones that qualify'"
    - "Content-addressed provenance (git tree id for data/streams, never rev-parse HEAD alone) mirrors compute-coverage-identity-recount.mjs / compute-pause-classification-calibration.mjs exactly"

key-files:
  created:
    - scripts/compute-pause-transport-remeasurement.mjs
    - scripts/compute-pause-transport-remeasurement.test.mjs
    - .planning/phases/34-pause-classification-forgotten-stop/34-PAUSE03-REMEASUREMENT.md
  modified: []

key-decisions:
  - "D-04(a): v2.2's exact rule is re-run on both the pre-detector recording-gap interval alone (classifyGapsThreeWay, exactly v2.2's own unit) and the merged recording-gap/merged-segment interval (collectPauseIntervals) — each interval list is reported in full, with a separate qualifying-interval count and max km/h per rule"
  - "D-04(b): the transported-class count uses the imported isTransported (never a local literal), over every gap-bearing interval collectPauseIntervals returns, with no duration floor (D-03) — verified band-independent by construction since it never reads V22_MIN_INTERVAL_SEC/V22_MIN_ADVANCE_M"
  - "D-05: no `7.35` literal anywhere in the generator (grep-gated in the verify command); the transported figure reaches the boundary only via the imported isTransported function"
  - "Reconciliation is descriptive, never corrective: the artifact quotes v2.2's '9 activities, all at <=14 km/h' and research's illustrative 12/26 probe beside this run's measured 13/22, attributes the difference to archive growth in words, and never asserts equality; a merged-rule count below old-rule would be rendered as a DEFECT SIGNAL rather than smoothed over (did not fire this run: 22 >= 13)"

patterns-established:
  - "Pattern: a rule text with no surviving implementation is re-specified as named constants quoted from the requirements doc itself, applied to two independently-sourced interval lists in one generator, rather than assumed reproducible from an existing script"

requirements-completed: []  # 34-05's own text: "this plan ticks nothing. Skip requirements mark-complete for PAUSE-03" — PAUSE-03 disposition is plan 34-11's job

# Metrics
duration: ~30min (commit span 15:24:10 -> 15:28:06 local, plus prior context-reading time)
completed: 2026-09-22
---

# Phase 34 Plan 05: PAUSE-03 Transport Re-Measurement Summary

**A fresh, tested re-implementation of v2.2's undocumented "transport gap" rule (>=30s interval advancing >100m), re-run side by side on the pre-detector gap interval alone and the merged gap-plus-burst segment, plus the D-05 transported-class count — measured at 13 (old) vs 22 (merged) activities on today's 1,874-stream archive, beside v2.2's historical 9 and research's illustrative 12/26 probe, none asserted equal.**

## Performance

- **Duration:** ~30 min (commit span ~4 min; reading CONTEXT.md/RESEARCH.md/PATTERNS.md/34-03-SUMMARY.md and verifying the real detector's chaining behaviour against a throwaway probe before writing the fixture took most of the time)
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- `scripts/compute-pause-transport-remeasurement.mjs`: a fresh, first-ever committed implementation of v2.2's "9 activities... all at <=14 km/h" rule (no v2.2 script survives — 34-RESEARCH.md Pitfall 3, re-confirmed by re-reading the same `git log --all -S` findings this session), applied side by side to `classifyGapsThreeWay`'s pre-detector `recording-gap` interval (exactly v2.2's own unit) and `collectPauseIntervals`'s merged `recording-gap`/`merged-segment` interval (plan 34-03's classifier core). Plus the D-05 transported-class count via the imported `isTransported`, no duration floor (D-03).
- 23 unit tests (all synthetic fixtures — no real stream file read, grep-gated in the verify command) covering the v2.2 rule's strict/inclusive boundary (30s/100.0m fails, 30s/100.1m passes, 29.9s/500m fails), the burst-blind-spot fixture (raw gap 60m/40s doesn't qualify, merged 150m/50s does — the exact v2.2 correction this plan exists for), the transported class's lack of a duration floor, `remeasureArchive`'s set-difference/aggregation logic, and all seven required render headings including determinism and no-wall-clock/no-bare-HEAD-hash checks. TDD RED->GREEN: the test file was committed first against a non-existent module (confirmed failing), then the implementation landed and all 23 passed.
- `.planning/phases/34-pause-classification-forgotten-stop/34-PAUSE03-REMEASUREMENT.md`: the committed figure of record, regenerated twice with byte-identical sha256 (`964afdf5...`), against the live 1,874-stream archive (git tree `dfdc7b35...`, newest activity 2026-09-18). Old rule: 13 activities (max 13.8 km/h). Merged rule: 22 activities (max 15.3 km/h). Transported: 5 activities, 6 intervals. `3475724402` (the phase's own named criterion-1 fixture) is in the merged-rule list but not the old-rule list — the exact blind spot, confirmed on the real archive, not just the synthetic fixture.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN, then the artifact):

1. **Task 1a (RED): failing tests for the generator** - `edce3342` (test)
2. **Task 1b (GREEN): the generator implementation** - `54ccd9a5` (feat)
3. **Task 2: commit the figure of record** - `885d4dbb` (docs)

## Files Created/Modified

- `scripts/compute-pause-transport-remeasurement.mjs` - `remeasureActivity` (per-activity old-rule/merged-rule/transported measurement), `remeasureArchive` (archive-wide sweep with sorted id lists and qualifying-interval/max-km/h aggregation), `renderRemeasurementMarkdown` (deterministic, content-addressed provenance), guarded `main()`
- `scripts/compute-pause-transport-remeasurement.test.mjs` - 23 tests across `describe` fragments "v2.2 rule", "merged rule", "transported", "remeasureArchive", "render" — every fixture synthetic
- `.planning/phases/34-pause-classification-forgotten-stop/34-PAUSE03-REMEASUREMENT.md` - the generated figure-of-record artifact

## Decisions Made

- **`remeasureActivity`'s `intervals` field is the FULL per-rule list, not pre-filtered to qualifying ones.** The plan's behavior text asks for the boundary-value cases to be checked against `oldRule.intervals[0]`'s own `metres`/`seconds` even on non-qualifying fixtures (e.g. the burst-blind-spot fixture's 60m/40s raw gap). Filtering to qualifying-only broke that contract during GREEN (caught by the RED->GREEN cycle itself: the burst-blind-spot test failed with an empty array where a length-1 array was expected). Fixed by returning the full list and deriving `qualifies` via `.some(v22Qualifies)`; `remeasureArchive` re-filters the same list to compute `oldQualifyingIntervalCount`/`mergedQualifyingIntervalCount`/`maxKmhOld`/`maxKmhMerged`, keeping one source of truth for "every interval considered" vs "the ones that actually qualify."
- **Reconciliation is worded, never corrective.** The render function states the historical 9 and research's 12/26 probe as references, computes the measured 13/22 independently, and states archive growth as the most likely cause of the difference — with an explicit `DEFECT SIGNAL` branch that would fire if the merged-rule count were ever lower than the old-rule count (it is not, this run: 22 >= 13, consistent with the widening's own logic that a merged interval always contains its own gap).
- **Boundary test fixtures use an isolated two-sample gap** (`t = [0, seconds]`, `d = [0, metres]`) rather than a longer stream, since a stream with only two samples cannot have an adjacent burst — this makes the old-rule and merged-rule paths read identically for the strict/inclusive boundary tests, isolating exactly the v2.2 rule arithmetic under test without any detector-chaining interference.

## Deviations from Plan

None — plan executed exactly as written. The one implementation adjustment (full vs. qualifying-only interval lists, above) was caught and fixed entirely within the TDD RED->GREEN cycle before either commit landed, not a post-hoc deviation.

## Issues Encountered

None beyond the interval-list-shape fix documented above, resolved before the GREEN commit.

## User Setup Required

None - no external service configuration required.

## Verification Evidence

### Matched `-t` filter counts (Rule 1 discipline — every filter checked non-zero)

- `compute-pause-transport-remeasurement.test.mjs -t "v2.2 rule"` — 6 matched, all passed
- `compute-pause-transport-remeasurement.test.mjs -t "merged rule"` — 3 matched, all passed
- `compute-pause-transport-remeasurement.test.mjs -t "transported"` — 4 matched, all passed
- `compute-pause-transport-remeasurement.test.mjs -t "render"` — 6 matched, all passed
- Full file: 23/23 passed

### Gate checks

- `grep -c "7\.35" scripts/compute-pause-transport-remeasurement.mjs` — 0 (no literal; the transported boundary is reached only via the imported `isTransported`)
- `grep -c "data/streams" scripts/compute-pause-transport-remeasurement.test.mjs` — 0 (no real stream file referenced, even in a comment string)
- `npx tsc --noEmit` — exit 0
- `npm test` — 97 files / 3,262 tests, all green (full suite, not just this plan's touched files)
- Two consecutive `node scripts/compute-pause-transport-remeasurement.mjs` runs: sha256 `964afdf57144fbc27238f4d8de5e2f9b601758cba7d8862cf47bf6e226e6f00c` both times
- A third run after committing the artifact: `git diff --exit-code` clean (byte-identical post-commit regeneration)
- `git status --porcelain data/streams` — empty throughout

### Figure of record (quoted verbatim from the committed artifact)

"Merged rule (v2.2's own rule re-run on merged gap-bearing intervals, PAUSE-03's corrected figure): **22 activities** (max 15.3 km/h). Old rule (v2.2's rule on the gap interval alone, re-run against today's archive): **13 activities** (max 13.8 km/h). Transported class (D-05, band-independent, no duration floor): **5 activities**, **6 intervals**."

Reconciled against v2.2's "9 activities, all at <=14 km/h" (historical, quoted, not asserted equal) and research's illustrative 12/26 probe on an earlier archive snapshot (also quoted, not asserted equal) — archive growth cited as the most likely single factor for both differences. `3475724402` is in the merged-rule list (`INCLUDES`) but not the old-rule list (`does not include`) — the named criterion-1 fixture reproducing the exact v2.2 blind spot on the real archive, not only the synthetic test fixture.

## Next Phase Readiness

- `.planning/milestones/v2.2-REQUIREMENTS.md:165`'s forward pointer to this artifact now resolves to a real, regenerated, dated file — no further action needed there.
- PAUSE-03's disposition (ticking the requirement) is explicitly deferred to plan 34-11 per this plan's own "Requirement-tick safety" note; `requirements-completed` is empty here by design.
- The transported-class figure (5 activities, 6 intervals) is band-independent (D-05) and will not need re-measurement when plan 34-06 ships the calibrated walk/run and stationary/walk bands — only the PAUSE-01 classifier's OWN band assignment depends on those constants, not this plan's transport figure.
- No blockers.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

All claimed files found on disk (`scripts/compute-pause-transport-remeasurement.mjs`,
`scripts/compute-pause-transport-remeasurement.test.mjs`,
`.planning/phases/34-pause-classification-forgotten-stop/34-PAUSE03-REMEASUREMENT.md`). All three
claimed commit hashes (`edce3342`, `54ccd9a5`, `885d4dbb`) confirmed present in `git log --oneline --all`.
