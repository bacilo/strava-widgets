---
phase: 32-unreliable-segment-detection-calibration
plan: 14
subsystem: analytics-calibration
tags: [javascript, vitest, tdd, calibration-generator, gap-closure]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments/mapGapToIndices (32-02, 32-03, 32-07, 32-09, 32-13's boundary-convention fix), scripts/compute-unreliable-segment-calibration.mjs (32-05/32-06), and 32-REVIEW.md CR-04/CR-06/WR-07's reproduced findings"
provides:
  - "findValley bins only in-interval mass (v >= lowMetres && v < highMetres), so out-of-interval histogram mass can no longer manufacture a valley — proven both directions (positive case at a pinned specific edge; negative case reproducing 32-REVIEW.md's CR-04 exactly, watched RED against the unfixed function)"
  - "parseDecisionText validates every parsed fixtures entry (non-empty id/span, finite bounds, endSec > startSec) and throws naming the offending entry verbatim, closing CR-06's silent-NaN defect while leaving the real 32-05 Decision fixtures line unaffected"
  - "namedItemSegmentMetres (now exported) collects ALL overlapping segments and fails closed — null on zero overlap, that segment's metres on exactly one, a descriptive throw naming the item id and every overlapping segment's span/metres on two or more — closing WR-07"
  - "32-CALIBRATION.md regenerated against the CR-04-fixed detector, proven idempotent on a second run, with the three shipped constants and valleyFound:false unchanged"
affects: [33-pace-derivation-integration, 35-best-effort-integration, 36-gap-classification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["a valley/dip search over a bounded interval must filter its input population to the interval BEFORE binning, not merely construct edges that span the interval — edge construction alone does not exclude out-of-interval mass from the shoulder bins that gate a candidate"]

key-files:
  created: []
  modified:
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs
    - .planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md

key-decisions:
  - "findValley fix implemented as a single pre-filter (`values.filter(v => v >= lowMetres && v < highMetres)`) feeding the existing binning/candidate/threshold logic unchanged, per the plan's explicit instruction to leave edge construction, binWidth, the candidate condition, the D-13 empty-population guard, the threshold and the break exactly as they are"
  - "parseDecisionText's fix does NOT widen the hyphen split to accept en-dashes — the plain-hyphen format is the contract; accepting a look-alike separator is exactly how a wrong span would reach a shipped constant undetected"
  - "namedItemSegmentMetres was made exported (was module-private) so its fail-closed contract has a direct unit test, not only indirect coverage through deriveHiddenPauseBoundary"
  - "STOP condition checked and cleared: running the real generator against the live 1,874-stream archive does not throw the new ambiguous-overlap error — no named item's window genuinely overlaps two or more segments today, so no developer escalation was needed"

requirements-completed: [SEG-04]

# Metrics
duration: 55min
completed: 2026-09-20
---

# Phase 32 Plan 14: Calibration-Generator Warning Closure (CR-04, CR-06, WR-07) Summary

**Closed all three calibration-generator warnings 32-VERIFICATION.md raised but did not score: `findValley` now bins only in-interval mass and is proven suppressing a manufactured valley as well as finding a real one; `parseDecisionText` fails loudly on a malformed parsed span instead of silently yielding NaN; `namedItemSegmentMetres` fails closed on ambiguous named-item overlap instead of silently taking the first — and 32-CALIBRATION.md is regenerated against the fixed detector, proven idempotent, with all three shipped constants (7.35 / 3.0 / 116.95) and `valleyFound: false` unchanged.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-20T21:59:xxZ (worktree base, post-reset to `09b4a42a`)
- **Completed:** 2026-09-20T22:5xZ
- **Tasks:** 3 completed (5 commits: 2 test/RED + 2 feat/GREEN for Tasks 1-2, 1 docs commit for Task 3)
- **Files modified:** 3

## Accomplishments

- Closed CR-04: `findValley` now filters its input population to `[lowMetres, highMetres)` before
  binning, so out-of-interval mass can no longer raise a shoulder maximum and manufacture a valley.
  Proven in both directions with a specific-edge positive case and a negative case that reproduces
  32-REVIEW.md's CR-04 finding exactly, watched RED against the unfixed function.
- Closed CR-06: `parseDecisionText` now validates every parsed `fixtures:` entry and throws a
  descriptive error naming the offending entry verbatim on a missing id/span, a non-finite bound,
  or an inverted/equal span — closing the silent-NaN defect an en-dash typo would otherwise produce,
  while leaving the real, correctly-hyphenated 32-05 Decision line unaffected.
- Closed WR-07: `namedItemSegmentMetres` (now exported) collects every overlapping segment instead
  of returning the first, and fails closed with a descriptive throw naming the item id and every
  overlapping segment's span/metres when two or more genuinely overlap — checked against the STOP
  condition on the real archive, which does not throw today.
- Regenerated `32-CALIBRATION.md` against the CR-04-fixed detector, proved idempotence with a
  second generator run (`git diff --exit-code` clean), and confirmed the three shipped constants
  and the `valleyFound: false` outcome are unchanged.

## Task Commits

Each task followed the RED/GREEN TDD cycle and was committed atomically:

1. **Task 1 RED — Pin CR-04 both-directions findValley fixtures** - `1496d0a4` (test)
2. **Task 1 GREEN — Close CR-04, findValley bins only in-interval mass** - `96c7ad79` (feat)
3. **Task 2 RED — Pin CR-06/WR-07 fixtures** - `fe076c2a` (test)
4. **Task 2 GREEN — Close CR-06/WR-07** - `929e6209` (feat)
5. **Task 3 — Regenerate 32-CALIBRATION.md, prove idempotence** - `6133c699` (docs)

_TDD plan: RED (`test`) then GREEN (`feat`) for Tasks 1 and 2; Task 3 is generator-only (no source
change) so it is a `docs` commit of the regenerated artifact._

## Files Created/Modified

- `scripts/compute-unreliable-segment-calibration.mjs` — `findValley`: pre-filters `values` to
  `[lowMetres, highMetres)` before binning; docblock rewritten naming the defect, its one-way
  direction, and the practical consequence. `parseDecisionText`: validates each fixtures entry
  (id/span presence, finite bounds, `endSec > startSec`), throwing a descriptive error quoting the
  offending entry. `namedItemSegmentMetres`: exported; collects all overlapping segments, returns
  null/single-metres/throws on zero/one/multiple overlaps respectively, naming the item id and every
  overlapping segment in the throw message.
- `scripts/compute-unreliable-segment-calibration.test.mjs` — Extended `findValley`'s describe block
  with a `CR-04` sub-block (4 new tests: specific-edge positive case, the CR-04-reproducing negative
  case, a values-only-outside-interval case, and the `lowMetres >= highMetres` boundary case).
  Extended `parseDecisionText`'s describe block with a `CR-06` sub-block (6 new tests: real-fixtures
  regression, en-dash, missing colon, missing span, non-numeric bound, inverted/equal span). Added a
  new `namedItemSegmentMetres` describe block (4 new tests: single overlap, no overlap, unknown item
  id, two-overlap throw). 14 new tests total (56 -> 70 in this file, matching the 32-12-adjusted
  baseline the plan names).
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` — Regenerated by
  the generator (never hand-edited). Only the D-08 histogram table changed (bin edge 40: 166 -> 40;
  bin edge 180: 7 -> 0 — the out-of-interval mass CR-04's fix now excludes). No other section changed.

## Decisions Made

- Implemented the `findValley` fix as the minimal pre-filter the plan's action text specified
  (`values.filter(v => v >= lowMetres && v < highMetres)` feeding the unchanged binning/candidate
  logic), rather than the review's alternative clamped-bin-boundary shape — both are mathematically
  equivalent on this code path since only fully-contained values were ever counted after the filter,
  and the plan explicitly required leaving edge construction, `binWidth`, the candidate condition,
  the D-13 guard, the threshold and the break untouched.
- Did not widen `parseDecisionText`'s span split to accept en-dashes or other look-alike separators
  — the plain-hyphen format is the contract per the plan and CR-06's own fix guidance; validation
  fails loudly instead.
- Exported `namedItemSegmentMetres` (previously module-private) specifically so its fail-closed
  contract has direct unit coverage, per the task's explicit behavior requirements ("returns... /
  throws naming the item id and the overlapping spans").
- Confirmed the plan's STOP condition does not trigger: `node scripts/compute-unreliable-segment-
  calibration.mjs` against the real, live 1,874-stream archive completes without throwing — no
  named item's window genuinely overlaps two or more segments today, so no developer blocker or
  finding needed to be recorded.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues were discovered outside the plan's own
described defects (CR-04, CR-06, WR-07), which were the plan's explicit subject.

### Notable Finding (not a code deviation): the plan's own Task 3 verify script's literal grep
does not match the artifact's actual rendered prose

- **Found during:** Task 3 verification
- **Issue:** The plan's `<verify>` block for Task 3 runs `grep -c "valleyFound: false" "$A"` against
  the regenerated `32-CALIBRATION.md` and requires it to print `>= 1`. The generator never renders
  the literal string `valleyFound: false` into the artifact — it renders human prose instead
  (`"NO clean valley found — anchor-interval midpoint fallback"` in the constants table, and
  `"No clean valley exists in this interval"` in the D-08 narrative section, both driven by the same
  `boundary.valleyFound` field via a ternary at `compute-unreliable-segment-calibration.mjs:2355`).
  `grep -c "valleyFound: false"` on the artifact returns `0` and (being `grep -c` with no match)
  exits non-zero, which would break the plan's own `&&`-chained verify command at that step
  regardless of whether the valley was genuinely found or suppressed — i.e. the literal string this
  step searches for can never appear in this artifact, pre-fix or post-fix.
- **Resolution:** Verified the same claim by the artifact's actual rendered text instead:
  `grep -c "NO clean valley found" 32-CALIBRATION.md` → `1`. This is semantically equivalent to
  `boundary.valleyFound === false` (that string is only emitted by the `!boundary.valleyFound`
  branch of the ternary at line 2355). Cross-checked against the constants table row —
  `HIDDEN_PAUSE_MIN_METRES | 116.95 | valley search over the anchor interval [52.4, 181.5) m; NO
  clean valley found — anchor-interval midpoint fallback | 116.95 m | yes` — confirming the shipped
  value is still the honest midpoint fallback, not a found valley.
- **Not a code change:** This is a mismatch in the plan's own verify-script literal, not a defect in
  `compute-unreliable-segment-calibration.mjs` or the artifact. No plan file was edited (executors do
  not modify PLAN.md); flagging it here for the phase record since 32-VERIFICATION.md gap-closure
  gates elsewhere in this phase have specifically been sensitive to verify-script string mismatches.

---

**Total deviations:** 0 auto-fixed; 1 non-code finding documented above (verify-script literal
mismatch, worked around with an equivalent semantic check).

## Reachability Evidence (both directions, per the executor's reachability bar)

### Task 1 — findValley (CR-04)

**RED (unfixed `findValley`), quoted from `-t "findValley"`:**
```
Tests  1 failed | 6 passed | 53 skipped (60)
```
Failure detail (the negative case, run against the unfixed source):
```
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ ... reports valleyFound false when the only large counts lie BELOW low and AT OR ABOVE high,
       with sparse in-interval mass — the pre-fix function returns true here
```
All other new cases in this task's block (the specific-edge positive case, the values-only-outside
case, and the `lowMetres >= highMetres` boundary case) already passed unfixed — they do not depend
on the in-interval-only binning fix, only the CR-04-reproducing negative case does.

**GREEN (fixed `findValley`), quoted:**
```
Tests  60 passed (60)                     // whole file
Tests  7 passed | 53 skipped (60)         // -t "findValley"
```
`grep -c "maxLeft === 0 || maxRight === 0" scripts/compute-unreliable-segment-calibration.mjs` → `1`
(the D-13 guard is intact, untouched).

### Task 2 — parseDecisionText / namedItemSegmentMetres (CR-06 / WR-07)

**RED (unfixed functions), quoted from the full-file run:**
```
Tests  6 failed | 64 passed (70)
```
En-dash case detail (direct reproduction, quoted before the fix):
```
node -e "... parseDecisionText('...fixtures: 7409028052:586–624...')"
-> [{"id":"7409028052","startSec":null}]     // startSec: NaN (JSON-serialised as null),
                                              // endSec: undefined (dropped by JSON.stringify) —
                                              // no error at all, exactly CR-06's finding
```
Other RED failures (missing colon, missing span, non-numeric bound, endSec<=startSec): each either
threw an opaque `TypeError` (`Cannot read properties of undefined (reading 'split')`) or silently
returned `undefined` fields — never the named, actionable error the fix adds.
Two-overlap case (unfixed `namedItemSegmentMetres`): silently returned `50` (the FIRST overlapping
segment's metres), never surfacing the second overlapping segment (`30-35`, metres `60`).

**GREEN (fixed functions), quoted:**
```
Tests  70 passed (70)                     // whole file
```
`node -e` probe against the real `32-05-SUMMARY.md` Decision:
```
DECISION-PARSE-OK [{"id":"7409028052","startSec":586,"endSec":624},{"id":"3647739864","startSec":945,"endSec":971}]
```
STOP-condition check against the real archive:
```
node scripts/compute-unreliable-segment-calibration.mjs
-> completes without throwing (Streams scanned: 1874, not computable: 0, ... report written)
```
`Number.isFinite` occurrence count (per-line `grep -c`: 2 -> 3; per-occurrence `grep -o | wc -l`:
2 -> 4, since one new line carries two uses) — recorded both ways per the acceptance criteria.

## Archive Impact (Task 3 measurement)

| Measurement | Result |
|---|---|
| `npm run build` then first `node scripts/compute-unreliable-segment-calibration.mjs` run | Completes; `32-CALIBRATION.md` diff: D-08 histogram table only, bin edge 40 `166 -> 40`, bin edge 180 `7 -> 0` |
| Second generator run, `git diff --exit-code` on the artifact | Clean — `IDEMPOTENT` |
| `grep -c "NO clean valley found" 32-CALIBRATION.md` (semantic equivalent of the plan's literal `valleyFound: false` grep — see Deviations) | `1` |
| Constants table row for `HIDDEN_PAUSE_MIN_METRES` | `116.95 | ... NO clean valley found — anchor-interval midpoint fallback | 116.95 m | yes` |
| Three-constant grep (`UNRELIABLE_SPEED_LIMIT_MPS = 7.35`, `UNRELIABLE_EXCESS_FLOOR_M = 3;`, `HIDDEN_PAUSE_MIN_METRES = 116.95` in `src/analytics/unreliable-segments.ts`) | `3` — unchanged |
| `node scripts/compute-unreliable-segment-recount.mjs` | `PASS: recount agrees with the calibration artifact's detector table.` |
| `npm test` (this bare worktree) | `7 test files failed / 83 passed / 1 skipped (91)`; `3 tests failed / 2695 passed / 23 skipped (2721)`. All 7 file failures are the same pre-existing `ENOENT` errors reading gitignored `data/stats/*.json` this bare worktree's `data/` copy never generated (`trends-yoy-logic.test.ts`, `detail-sections.test.ts`'s three pace-quality shard cases, and the others 32-13-SUMMARY already documented) — environmental, not caused by this plan. None of `compute-unreliable-segment-calibration.test.mjs`, `unreliable-segment-recount-crosscheck.test.mjs`, or `compute-unreliable-segment-recount.mjs` appear in the failure list. Test-count delta vs. 32-13's own recorded bare-worktree baseline (2707 total) is exactly +14, matching the 14 new tests this plan added (4 CR-04 + 6 CR-06 + 4 WR-07) — every delta attributed. The orchestrator's post-merge `npm test` on the primary checkout is the authoritative gate for this delta, not this bare-worktree run. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three calibration-generator warnings 32-VERIFICATION.md raised but did not score (CR-04,
  CR-06, the ambiguous-overlap warning WR-07) are closed, proven in both directions, and the
  artifact of record is regenerated and idempotent against the fixed generator.
- The remaining gap-closure items assigned to this wave (SEG-05a single-quote needle warning, the
  D-05 negative-control non-vacuity warning, CR-03's throwing `buildActivityFinding`) are owned by
  sibling plan 32-15, not touched here.
- Phase 32's SEG-04 requirement ("calibrated, regenerable, non-circular artifact") no longer rests
  on an unsound `findValley` derivation, an unvalidated Decision-span parse, or a silently
  tie-broken named-item overlap — all three are now sound and demonstrated so.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `scripts/compute-unreliable-segment-calibration.mjs`
- FOUND: `scripts/compute-unreliable-segment-calibration.test.mjs`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`
- FOUND: commit `1496d0a4` (test(32-14): pin CR-04 both-directions findValley fixtures, watched RED)
- FOUND: commit `96c7ad79` (feat(32-14): close CR-04 — findValley bins only in-interval mass)
- FOUND: commit `fe076c2a` (test(32-14): pin CR-06/WR-07 span-validation and ambiguous-overlap fixtures, watched RED)
- FOUND: commit `929e6209` (feat(32-14): close CR-06/WR-07 — validate Decision spans, fail closed on ambiguous overlap)
- FOUND: commit `6133c699` (docs(32-14): regenerate 32-CALIBRATION.md against the CR-04-fixed detector)
