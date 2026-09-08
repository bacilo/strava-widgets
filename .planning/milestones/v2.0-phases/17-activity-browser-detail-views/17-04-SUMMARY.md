---
phase: 17-activity-browser-detail-views
plan: 04
subsystem: analytics
tags: [typescript, vitest, tdd, interpolation, chart-series, localstorage-tamper-guard]

# Dependency graph
requires:
  - phase: 14-stream-ingestion-foundation
    provides: "CanonicalStream contract (src/streams/stream.types.ts) — irregular t/d/hr/cadence/alt arrays"
  - phase: 15-best-effort-engine
    provides: "validateStreamSeries and the exact-crossing interpolation technique in best-effort-utils.ts (findBestEffort)"
provides:
  - "computeSplits — pure per-km split derivation with interpolated boundaries, Δt-weighted HR/cadence, and a labelled final partial (D-28)"
  - "Chart-series module: availableChannels, derivePaceSeries (Δt-weighted, D-22), buildChannelSeries, hover geometry (distanceFractionAtX, pointAtDistanceFraction for D-26), and the overlay tamper-guard (parseOverlayConfig/readStoredOverlayConfig/writeStoredOverlayConfig, D-18/D-20)"
affects: [17-detail-view-rendering, 17-detail-charts-mounting, 17-detail-splits-table-rendering, 17-detail-map-hover-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequential single-forward-pass km-boundary walk (Pattern 2 from 17-RESEARCH.md), mirroring findBestEffort's linear-interpolation-at-crossing instead of re-deriving it"
    - "Left-endpoint (step-function) Δt-weighted channel averaging: value[i] * (t[i+1]-t[i]) per sub-interval, clipped at interpolated split boundaries"
    - "Binary-search time-to-value interpolation (interpValueAtTime) reused for both pace-window smoothing and time-axis hover-to-distance conversion"
    - "theme.ts-style tamper-guard applied to a per-band overlay config: allow-list on READ, self-overlay drop, de-dup, cap at MAX_OVERLAYS_PER_BAND, try/catch every storage call"

key-files:
  created:
    - src/dashboard/views/detail-splits.ts
    - src/dashboard/views/detail-splits.test.ts
    - src/dashboard/views/detail-charts-logic.ts
    - src/dashboard/views/detail-charts-logic.test.ts
  modified: []

key-decisions:
  - "Split boundaries walk forward once (O(n)) using the same segMeters/frac/lerp formula as findBestEffort, rather than reusing the two-pointer sliding search (RESEARCH.md Pattern 2 explicitly calls this out)."
  - "Δt-weighted HR/cadence aggregation uses left-endpoint (step-function) weighting per the plan's explicit contract (value[i] * (t[i+1]-t[i])), not trapezoidal averaging of consecutive samples — verified against the 150-for-30s/100-for-170s -> 107.5 behavior assertion."
  - "distanceFractionAtX and buildChannelSeries share the same raw-d/1000 scale (not offset by d[0]) to stay consistent with each other, since CanonicalStream.d is contractually non-decreasing from a start near 0."

patterns-established:
  - "Any new detail-view computation module reusing an existing interpolation/validation technique from best-effort-utils.ts should import it directly rather than re-deriving the formula (matches RESEARCH.md's Don't-Hand-Roll table)."

requirements-completed: [DETAIL-03, DETAIL-04]

# Metrics
duration: 45min
completed: 2026-08-11
---

# Phase 17 Plan 04: Splits & Chart-Series Computation Summary

**Two pure, DOM-free computation modules for the activity detail page — interpolated per-km splits with Δt-weighted channel averages, and chart-series/pace-smoothing/hover-geometry/overlay-persistence logic — both proven against real irregular-sampling fixtures under vitest.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-11T17:11:00Z (approx, worktree base reset)
- **Completed:** 2026-08-11T15:18:07Z
- **Tasks:** 2 completed (both TDD RED→GREEN)
- **Files modified:** 4 (all new)

## Accomplishments
- `computeSplits` produces per-km splits with exact-crossing interpolated boundaries (mirroring `findBestEffort`), a correctly labelled final partial km (D-28), and Δt-weighted `avgHr`/`avgCadence`/`elevDeltaM` — proven to sum to the stream's true distance/duration within tolerance and to differ from both naive sample-snap and sample-count-mean approaches.
- `detail-charts-logic.ts` derives Δt-weighted pace smoothing (D-22, 20s window), pre-shaped `{x,y}` chart series with band omission for missing channels (D-17), hover-to-distance-fraction geometry for the D-26 map marker sync, and a `theme.ts`-precedent tamper-guard for persisted overlay config (D-18/D-20) — all validated against a throwing/null/invalid-JSON storage double, never a real `localStorage` global.
- 48 total new unit tests (17 + 31), all green; full project suite (421 tests) green; both modules confirmed free of `document.`/`window.` references and `chart.js`/`leaflet` imports via source-assertion grep.

## Task Commits

Each task followed TDD RED → GREEN:

1. **Task 1: Per-km splits with interpolated boundaries and a labelled final partial**
   - `707af08` (test) — failing test suite (RED gate)
   - `822a962` (feat) — `computeSplits` implementation (GREEN gate)
2. **Task 2: Chart series derivation, Δt-weighted pace smoothing, and hover geometry**
   - `555edfd` (test) — failing test suite (RED gate)
   - `e225bc2` (feat) — full `detail-charts-logic.ts` implementation, plus a test-fixture off-by-one fix (GREEN gate)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified
- `src/dashboard/views/detail-splits.ts` (173 lines) — `computeSplits(stream)`, `Split` interface
- `src/dashboard/views/detail-splits.test.ts` (221 lines) — 17 tests covering every behavior bullet
- `src/dashboard/views/detail-charts-logic.ts` (324 lines) — channels/series, pace smoothing, hover geometry, overlay tamper-guard
- `src/dashboard/views/detail-charts-logic.test.ts` (314 lines) — 31 tests covering every behavior bullet

## Decisions Made
- Used left-endpoint (step-function) Δt-weighting for `avgHr`/`avgCadence`, exactly matching the plan's `value[i] * (t[i+1]-t[i])` contract, rather than trapezoidal averaging — confirmed correct via the 107.5 bpm hand-computed fixture.
- Reused a single binary-search `interpValueAtTime` helper inside `detail-charts-logic.ts` for both `derivePaceSeries`'s window-boundary distance lookup and `distanceFractionAtX`'s time-to-distance conversion, avoiding two separate interpolation implementations in one file.
- Kept `distanceFractionAtX`'s x-axis scale consistent with `buildChannelSeries`'s raw `d[i]/1000` (not offset by `d[0]`), since both must agree on what a given x-pixel/x-value means for the same chart.

## Deviations from Plan

None — plan executed exactly as written. One test-fixture bug (not a plan or implementation defect) was caught and fixed during GREEN verification.

### Auto-fixed Issues

**1. [Rule 1 - Bug, test-only] Fixed an off-by-one in the `distanceFractionAtX` time-axis test fixture**
- **Found during:** Task 2 GREEN verification (`npm test -- --run src/dashboard/views/detail-charts-logic.test.ts`)
- **Issue:** The two-speed test fixture built its `t`/`d` arrays with a "push current value, then increment" loop pattern that silently applied the *old* speed to the first second after the pace change, shifting the hand-computed expected distance at `t=250` by 8m (1308 actual vs 1300 expected) and failing the assertion.
- **Fix:** Rewrote the fixture with an explicit closed-form second segment (`d.push(1000 + s * 2)` for `s = 1..400`) so the pace change takes effect exactly at the segment boundary, matching the hand-computed expected value exactly.
- **Files modified:** `src/dashboard/views/detail-charts-logic.test.ts`
- **Verification:** All 31 tests in the file pass; the specific test's assertion (`distanceFraction` differs from `timeFraction` and matches the hand-computed 1300/1800 ratio) passes exactly.
- **Committed in:** `e225bc2` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug, test-fixture-only — no implementation-code defect)
**Impact on plan:** Zero impact on shipped implementation code; the fix only tightened the test fixture's own arithmetic.

## Issues Encountered

None beyond the fixture fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both `computeSplits` and the full `detail-charts-logic.ts` API surface (channels, series, pace smoothing, hover geometry, overlay persistence) are ready for the DOM-rendering plans that mount the splits table, chart bands, and map hover-sync (per 17-RESEARCH.md Pitfall 4, DOM-touching code stays untested by design and is verified manually in a later checkpoint plan).
- No blockers. The interfaces exactly match the plan's `must_haves.artifacts.exports` list — future plans importing from `detail-splits.ts`/`detail-charts-logic.ts` can rely on the full documented export surface.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 created files verified present on disk (`detail-splits.ts`, `detail-splits.test.ts`,
`detail-charts-logic.ts`, `detail-charts-logic.test.ts`, this SUMMARY.md). All 5 referenced
commit hashes (`707af08`, `822a962`, `555edfd`, `e225bc2`, `54f15fc`) verified present in
`git log`.
