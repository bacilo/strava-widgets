---
phase: 32-unreliable-segment-detection-calibration
plan: 04
subsystem: analytics
tags: [typescript, vitest, single-source-audit, structural-scan, planted-fixture]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    plan: "01"
    provides: "findConfinedCallSites, readSourceTree, stripComments, countOccurrences, SourceFile, StreamPaceViolation — the reused scanner primitives"
  - phase: 32-unreliable-segment-detection-calibration
    plan: "02"
    provides: "src/analytics/unreliable-segments.ts — advanceSteps, detectUnreliableSegments, DetectorParams, the exact arithmetic/structural/param-key literal text this plan confines"
provides:
  - "findUnreliableSegmentViolations(files) — pure scanner covering the detector's arithmetic literal, structural call site (advanceSteps() and importer confinement"
  - "DETECTOR_ARITHMETIC_LITERALS / DETECTOR_STRUCTURAL_LITERALS / DETECTOR_IMPORTER_NEEDLES / DETECTOR_PARAM_LITERALS — the four confined-literal sets, exported implicitly via the live and planted describe blocks that exercise them"
affects: [32-06, 32-08, 32-09, phase-33-pace-derivation-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-vacuity precedes every empty-offenders assertion (mirrors PACE-01's own lines 336-365 pattern), applied to a second detector rather than re-derived ad hoc"
    - "Two-directional planted proof: a permanent in-suite describe block (4 planted files, each asserted flagged-then-clean) plus a one-off planted probe against the REAL source tree, watched failing, deleted, and confirmed leaving git status --porcelain src clean"

key-files:
  created: []
  modified:
    - src/analytics/pace-single-source.test.ts

key-decisions:
  - "Planted file (4) (advanceSteps( structural check) deliberately omits an actual import statement — including one would also trip the importer needle and turn a single-needle assertion into a two-violation one, which the plan's exact-match assertion for that file does not want"
  - "DETECTOR_PARAM_LITERALS confinement is asserted via the existing findConfinedCallSites helper (OverrideMatch shape) rather than folded into findUnreliableSegmentViolations's StreamPaceViolation return shape — mirrors how OVERRIDE_LITERALS/GAP_MEMBERSHIP_LITERALS are already asserted separately from findStreamPaceViolations earlier in this same file"

patterns-established:
  - "isDetectorOrTestFile / isDetectorOrImporterOrTestFile confinement predicates, reusable by any future plan extending this audit to a third module"

requirements-completed: [SEG-05a]

# Metrics
duration: ~15min
completed: 2026-09-20
---

# Phase 32 Plan 04: Single-Source Audit Extended to the Unreliable-Segment Detector Summary

**Extends `src/analytics/pace-single-source.test.ts` (PACE-01's audit) with `findUnreliableSegmentViolations`, confining `unreliable-segments.ts`'s core arithmetic (`speedLimitMps * seconds`), its `advanceSteps(` call site, its `DetectorParams` keys (colon/comma/shorthand-close), and any importer of the module — proven catching a planted second implementation both in a permanent in-suite block and against the real source tree.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added a `SEG-05a (Phase 32)` docblock section mapping the audit's two historically-real blind spots (non-arithmetic re-implementation `f32dddd8`; formatting-variant misses CR-03) onto the new confinement checks, and stating explicitly that the audit bans a second IMPLEMENTATION or IMPORTER, not a second caller reached through the one allow-listed importer (`pace-derivation.ts`, per Phase 33's planned fold).
- `findUnreliableSegmentViolations(files)` — pure, total, same shape as `findStreamPaceViolations` — scans for `DETECTOR_ARITHMETIC_LITERALS` (`'speedLimitMps * seconds'`, covering both `isFastStep` and `excessMetres`), `DETECTOR_STRUCTURAL_LITERALS` (`'advanceSteps('`), and `DETECTOR_IMPORTER_NEEDLES` (`"unreliable-segments.js'"`, `"unreliable-segments'"`), each confined to `unreliable-segments.ts`, `*.test.ts`, and (for the importer check only) `pace-derivation.ts`.
- `DETECTOR_PARAM_LITERALS` (the colon/comma/shorthand-close forms of `speedLimitMps`, `excessFloorMetres`, `hiddenPauseMinMetres`) confined via the existing `findConfinedCallSites` helper — reused, not re-implemented.
- New live describe `SEG-05a — single-source audit extended to the unreliable-segment detector` with three tests: (a) non-vacuity — `unreliable-segments.ts` itself contains `'speedLimitMps * seconds'` ≥ 2 times, `'advanceSteps('` ≥ 1 time, and the param-literal scan finds ≥ 1 real match (from `unreliable-segments.test.ts`'s explicit `DetectorParams` object literals); (b) `findUnreliableSegmentViolations(files)` equals `[]` on the real tree; (c) the param-literal confinement offenders equal `[]`.
- New permanent planted describe `SEG-05a — the audit is demonstrated catching a reintroduced second unreliable-segment implementation (planted, permanent)` with four tests, each asserting BOTH directions (flagged as expected; clean once the literal/shape is removed): (1) inline arithmetic re-implementation, (2) non-arithmetic second importer, (3) formatting-variant object-shorthand param usage, (4) a bare `advanceSteps(` call site.
- One-off planted probe (`src/dashboard/views/planted-second-unreliable-impl.ts`, importing `detectUnreliableSegments` from `../../analytics/unreliable-segments.js` AND inlining `metres > speedLimitMps * seconds`) run against the real tree, watched failing (both needles named), deleted, and `git status --porcelain src` confirmed clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Detector containment scans, non-vacuity, and the permanent planted SEG-05a block** - `ab45bdea` (test)
2. **Task 2: One-off planted probe against the REAL tree, watched red, deleted, tree confirmed clean** - `442b9992` (docs)

## Verbatim Evidence (Task 2's one-off real-tree proof)

### Step 2 — watched FAILING (probe planted, before deletion)

```
 ❯ src/analytics/pace-single-source.test.ts (81 tests | 1 failed) 62ms
     ...
     ✓ non-vacuous: unreliable-segments.ts itself carries the arithmetic and structural literals, and the param-literal scan finds real matches 8ms
     × zero arithmetic, structural or importer violations exist outside unreliable-segments.ts, its one allowed importer, and *.test.ts files 7ms
     ✓ zero DetectorParams param-key (colon/comma/shorthand-close) offenders exist outside unreliable-segments.ts and *.test.ts files 7ms
     ...

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/analytics/pace-single-source.test.ts > SEG-05a — single-source audit extended to the unreliable-segment detector > zero arithmetic, structural or importer violations exist outside unreliable-segments.ts, its one allowed importer, and *.test.ts files
AssertionError: violations found:
src/dashboard/views/planted-second-unreliable-impl.ts: contains "speedLimitMps * seconds" (1x)
src/dashboard/views/planted-second-unreliable-impl.ts: contains "unreliable-segments.js'" (1x): expected [ { …(3) }, { …(3) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "count": 1,
+     "needle": "speedLimitMps * seconds",
+     "path": "src/dashboard/views/planted-second-unreliable-impl.ts",
+   },
+   {
+     "count": 1,
+     "needle": "unreliable-segments.js'",
+     "path": "src/dashboard/views/planted-second-unreliable-impl.ts",
+   },
+ ]

 ❯ src/analytics/pace-single-source.test.ts:603:57

 Test Files  1 failed (1)
      Tests  1 failed | 80 passed (81)
```

Both needles — the arithmetic literal and the importer specifier — are named against the exact planted path, confirming the scan reaches the real tree and both confinement checks independently fire.

### Step 4 — `git status --porcelain src` after deleting the probe

```
(no output)
```

Confirmed empty — the tree is clean apart from this plan's own intended edit to `pace-single-source.test.ts`.

### Step 5 — watched GREEN (probe deleted)

```
 RUN  v4.0.18 /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-af496633426bddf52

stdout | src/analytics/pace-single-source.test.ts > PACE-01 Criterion 4 / D-18 — single-source stream-pace audit > scanned more than 100 .ts files under src/ (proof the walk reached the tree, not an empty directory) — scanned 200
[pace-single-source] scanned 200 .ts files under src/

 ✓ src/analytics/pace-single-source.test.ts (81 tests) 73ms

 Test Files  1 passed (1)
      Tests  81 passed (81)
```

`scanned 200` (not 201) after deletion — an independent confirmation the probe file is gone from the tree, not merely from `git status`'s view.

## Files Created/Modified

- `src/analytics/pace-single-source.test.ts` - Extended: `SEG-05a` docblock section; `DETECTOR_FILE_SUFFIX`, `DETECTOR_ARITHMETIC_LITERALS`, `DETECTOR_STRUCTURAL_LITERALS`, `DETECTOR_IMPORTER_NEEDLES`, `DETECTOR_PARAM_LITERALS`; `isDetectorOrTestFile`/`isDetectorOrImporterOrTestFile`; `findUnreliableSegmentViolations`; two new describe blocks (live SEG-05a audit, planted SEG-05a proof, 7 new tests total). Task 2 additionally appended one sentence to the SEG-05a docblock paragraph pointing at this SUMMARY.

## Decisions Made

- Reused every existing scanner primitive (`SourceFile`, `readSourceTree`, `findConfinedCallSites`, `countOccurrences`, `stripComments`, `SRC_ROOT`) rather than writing parallel copies — the file already documents this as its own precedent (`row-semantics.test.ts`'s idiom).
- Kept `findUnreliableSegmentViolations`'s return shape identical to `findStreamPaceViolations`'s `StreamPaceViolation[]` (`{ path, needle, count }`) so the two audits are structurally comparable at a glance.
- Planted file (4)'s source deliberately contains no import statement (see Key Decisions in frontmatter) so its assertion can pin an exact single-violation array without the importer needle also firing.

## Deviations from Plan

None — plan executed exactly as written. Both must-have traps were honored: every new scan's non-vacuity assertion runs and passes against the real `unreliable-segments.ts`/`unreliable-segments.test.ts` content before the empty-offenders assertion is exercised, and the two-directional proof (permanent in-suite planted block, one-off real-tree probe) was run for real rather than simulated, with verbatim output captured above.

## Known Stubs

None. No new UI surface, no empty-value stubs — this plan is a pure test-file scanner extension with no runtime/production code touched.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or schema change — it extends an existing structural test-only audit over `src/` source text already read by `readSourceTree`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEG-05a is fully discharged: the single-source audit now confines `unreliable-segments.ts`'s arithmetic, structural call site, param keys and importers, proven catching a planted second implementation in both the permanent in-suite block and against the real tree.
- SEG-05b (consumers actually read the detector) stays open per the plan's explicit scope boundary — Phase 33 wires `pace-derivation.ts` to import `unreliable-segments.ts`, at which point this audit's `pace-derivation.ts` allow-listing becomes load-bearing rather than dormant.
- No blockers. `npx tsc --noEmit` exits 0; the whole `pace-single-source.test.ts` file passes at 81/81 (74 pre-existing PACE-01 tests unchanged + 7 new SEG-05a tests), and `-t "SEG-05a"` matches exactly 7 tests (3 live + 4 planted), clearing the plan's ≥6 acceptance bar.

## Self-Check: PASSED

- FOUND: `src/analytics/pace-single-source.test.ts`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-04-SUMMARY.md`
- FOUND commit: `ab45bdea` (Task 1)
- FOUND commit: `442b9992` (Task 2)

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*
