---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 11
subsystem: ui
tags: [pace-quality, unreliable-segments, quality-badge, quality-signals-section, vitest]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "09"
    provides: "UnreliableSegmentsSignal / unreliableSegmentsSignal(t, d, segments, options?), the seventh ActivityQualitySignals key, structurally excluded from hasAnySevereSignal"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "10"
    provides: "PaceQualityShard.unreliableSegments / unreliableSegmentsTruncated (parts-free per-segment evidence list), parseUnreliableSegment/parseUnreliableSegmentsSignal in pace-quality-client.ts"
provides:
  - "unreliableSegmentsBadgeContent(signal) and segmentMechanismLabel(mechanism) in list.ts — the sixth badge source, severe-tier only, single text builder reused by the detail-view row"
  - "The ninth Quality Signals row (unreliableSegmentsRow) in detail-sections.ts, its not-available twin in notAvailableRows(), and the standalone UNRELIABLE_SEGMENTS_EXPLANATION constant (NOT routed through EXPLANATION_PROBE_SPECS)"
  - "End-to-end compute -> JSON.parse(JSON.stringify(shard)) -> parsePaceQualityShard -> render-plan proof on the three named activities, in both list.test.ts and detail-sections.test.ts, with the measured-value table plan 33-12/33-13 read back against"
affects: [33-12, 33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One text builder, two surfaces: unreliableSegmentsBadgeContent (list.ts) is exported and imported directly into detail-sections.ts's unreliableSegmentsRow for its 'minor'/'severe' valueText — the row and the severe-only badge cannot describe the same measured value with two different strings, verified in Task 3 by asserting badgeSpec.visibleText === row.valueText on the two severe named activities."
    - "Standalone explanation constant for a signal excluded from the composite: UNRELIABLE_SEGMENTS_EXPLANATION follows SUB_GROUND_EXPLANATION's exact precedent — a module-level string, never routed through tieringExplanation/EXPLANATION_PROBE_SPECS, so the presence of an explanation can never be misread as composite membership."
    - "Guard-needle false positive resolved by renaming the trigger, not the guard: pace-single-source.test.ts's zero-import audit for unreliable-segments.ts treats any source literal ending in the exact quoted token 'unreliable-segments' as an importer violation (it exists to catch a stray import specifier). list.ts's descriptionIdSuffix, an unrelated DOM-id fragment, happened to match that token; renamed to the singular 'unreliable-segment' rather than weakening the guard."

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "Row position (Claude's Discretion, no UI-SPEC): the ninth row sits FOURTH, immediately after the three tiering rows (Decimation, Coverage gaps, Impossible samples) and before the elevation trio — grouping it with pace/gap-trust signals rather than after elevation or at the very end. Fixed order across qualitySignalsSectionPlan and notAvailableRows, asserted by an explicit nine-element label-array test."
  - "Badge/row copy (Claude's Discretion): visibleText/valueText reads '{count} unreliable {segment|segments}, {metres} m over {m:ss} ({mechanism, mechanism, ...})' — e.g. '1 unreliable segment, 182 m over 0:08 (hidden pause)'. Mechanism labels are space-joined ('hidden pause', 'isolated jump', 'gap adjacent') via a new exported segmentMechanismLabel, an exhaustive switch with no default (deviceFamilyDisplayName's precedent) so a fourth SegmentMechanism member fails tsc rather than falling through silently."
  - "3475724402 (tier minor, 2148.7 m across 16 segments, excess exactly 0 by D-07's gap-dilution definition) renders '16 unreliable segments, 2149 m over 12:31 (gap adjacent)' in the row and NO badge in the list — judged not misleading: the row states the real distance and duration even though excess is 0, so it does not read as 'nothing wrong'. Flagged below for the human checkpoint per the dispatch note's explicit instruction, since this is Claude's own copy, not plan-mandated text to defer to."
  - "descriptionIdSuffix renamed 'unreliable-segments' -> 'unreliable-segment' (Rule 1 bug, see Deviations) after pace-single-source.test.ts's zero-import guard flagged the literal as a detector-importer violation — the guard's needle set treats any quoted 'unreliable-segments' token as suspect regardless of source; the fix changes list.ts, not the guard."

patterns-established:
  - "Row/badge double-disclosure is intentional, not a defect: gapProfileRow (index 1) already itemises unreliable-kind gapIntervals ('N unreliable segments') from plan 33-04/33-05; the new ninth row discloses the SAME detector segments' count/metres/seconds/mechanisms a second time. Both read from the same classifyGapsWithSegments output by construction, so they cannot disagree — proven directly on all three named activities in Task 3 (gapProfileRowResult.evidenceText contains '{signal.count} unreliable' for every activity with count > 0), not merely asserted by design."

requirements-completed: []  # SEG-06's disposition is set by plan 33-13 alone, per this plan's own requirement-tick-safety text; this SUMMARY documents evidence only. STATE.md/ROADMAP.md/REQUIREMENTS.md are untouched by every commit in this plan.

# Metrics
duration: ~2h
completed: 2026-09-21
---

# Phase 33 Plan 11: SEG-06 surfaced — severe-only list badge, always-on ninth detail row Summary

**A severe unreliable-segments signal now badges a list row with its measured count/metres/seconds/mechanisms (unreliableSegmentsBadgeContent, list.ts's sixth badge source), and every activity's detail view discloses the same signal as a ninth always-on Quality Signals row across all four tiers plus not-available — both surfaces proven end to end (compute -> serialise -> parse -> render) on the three named activities, reproducing 32/33-CALIBRATION.md's anchor figures exactly.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3 (all executed as written, plus one Rule-1 follow-up fix)
- **Files modified:** 4

## Accomplishments

- `unreliableSegmentsBadgeContent(signal)` and `segmentMechanismLabel(mechanism)` in `list.ts` — the sixth badge source in `qualityBadgeSpecs`, gated on `tier === 'severe'` only (D-06), stale-cache-tolerant read (`quality.unreliableSegments` may be `undefined` on a pre-Phase-33 cached `index.json`), `null`-evidence defence mirroring `elevationBadgeContent`
- `unreliableSegmentsRow` — the ninth row in `qualitySignalsSectionPlan`'s always-on Quality Signals section (position 4, right after the three tiering rows), reusing `unreliableSegmentsBadgeContent` for its `'minor'`/`'severe'` `valueText` so the row and the severe-only badge cannot drift; `evidenceText` names the first segment's start time and the longest segment's duration from `shard.unreliableSegments`, discloses truncation, `null` for a `null` shard
- `notAvailableRows()` grows to nine matching literals; a new test asserts the full nine-element label array is identical (and in the same order) between `qualitySignalsSectionPlan(HEALTHY_QUALITY, null)` and `qualitySignalsSectionPlan(null, null)`
- `UNRELIABLE_SEGMENTS_EXPLANATION` — a standalone module constant (`SUB_GROUND_EXPLANATION`'s precedent), exported for test assertion, confirmed NOT reachable through `EXPLANATION_PROBE_SPECS`' three-member tiering loop
- End-to-end Task 3 proof on 3475724402/3475734189/3475740390's real committed streams in both `list.test.ts` and `detail-sections.test.ts`: `buildPaceQualityShard` -> `JSON.parse(JSON.stringify(shard))` -> `parsePaceQualityShard` -> `qualityBadgeSpecs`/`qualitySignalsSectionPlan`, with the observed tier reconciled against an excess fraction recomputed independently from `classifyGapsWithSegments`' own segments (never from `unreliableSegmentsSignal`'s own output)
- Fixed a guard false positive: `pace-single-source.test.ts`'s zero-import audit flagged `list.ts`'s `descriptionIdSuffix: 'unreliable-segments'` as a detector-importer violation (its needle set is a raw quoted-token match, not import-aware); renamed to the singular `'unreliable-segment'`, outside the guard's needle set, guard itself unchanged

## Task Commits

1. **Task 1: The sixth badge source, severe-only, with a stale-cache-tolerant read** — `671e3656` (feat)
2. **Task 2: The ninth Quality Signals row, its not-available twin and the standalone explanation** — `23176cfb` (feat)
3. **Task 3: End-to-end render-plan proof on the three named activities** — `149660be` (test)
4. **(follow-up) Rule 1 fix — descriptionIdSuffix guard false positive** — `ac34e62a` (fix)

_No separate plan-metadata commit is created by this response — this SUMMARY documents it; the orchestrator is the single writer for STATE.md/ROADMAP.md/REQUIREMENTS.md per this session's explicit sequential-executor constraint._

## Files Created/Modified

- `src/dashboard/views/list.ts` — `QualityBadgeSpec.signal` widened to add `'unreliableSegments'`; stale-cache-tolerant `unreliableSegments` read in `qualityBadgeSpecs`; the sixth badge block (severe-only); `unreliableSegmentsBadgeContent`/`segmentMechanismLabel` (exported)
- `src/dashboard/views/list.test.ts` — Task 1's 12 cases (`-t "unreliableSegments"`: severe/minor/none/not-computable/absent-signal/null-evidence/aria-label present+absent/no-other-badge-changed/singular-plural/multi-mechanism); Task 3's `it.each` + reachability case (`-t "named activities"`)
- `src/dashboard/views/detail-sections.ts` — `UnreliableSegmentsSignal` import; `UNRELIABLE_SEGMENTS_EXPLANATION` (exported) and `NOT_COMPUTABLE_UNRELIABLE_SEGMENTS` fallback; `unreliableSegmentsRow`; wired into `qualitySignalsSectionPlan` (position 4) and `notAvailableRows()`; doc comments updated from "eight rows"/"eight-row" to "nine rows"/"nine-row" throughout
- `src/dashboard/views/detail-sections.test.ts` — row-index shifts (`rows[4..7]` -> `rows[5..8]`, `slice(3, 6)` -> `slice(4, 7)`) across every pre-existing elevation/device/elapsed-vs-moving assertion; `toHaveLength(8)` -> `9` (3 sites); new `unreliableSegmentsRow` describe block (11 cases, `-t "unreliableSegmentsRow"`); new CR-01 missing-key describe block (2 cases); Task 3's `it.each` + reachability case (`-t "named activities"`)

## Decisions Made

See `key-decisions` in the frontmatter for the full row-position, copy, and guard-fix rationale — restated briefly:

- **Row position (Claude's Discretion):** fourth of nine, immediately after the three tiering rows, grouping SEG-06 with the other pace/gap-trust signals rather than with elevation or at the end.
- **Copy (Claude's Discretion):** `'{count} unreliable {segment|segments}, {metres} m over {m:ss} ({mechanisms})'`, reused verbatim between the badge and the row via the exported `unreliableSegmentsBadgeContent`.
- **descriptionIdSuffix renamed**, not the guard — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `descriptionIdSuffix: 'unreliable-segments'` tripped `pace-single-source.test.ts`'s zero-import detector-importer guard**
- **Found during:** the final `npm test` run before this SUMMARY, after Tasks 1-3 were all individually green
- **Issue:** `pace-single-source.test.ts`'s SEG-05a audit scans every non-test, non-detector, non-allowed-importer file's stripped source for a closed set of needles proving no stray import of `unreliable-segments.ts` exists — one needle is the literal `unreliable-segments'` (a bare module specifier closed by a quote). `list.ts`'s new `descriptionIdSuffix: 'unreliable-segments'` string literal — an unrelated DOM-id fragment, not an import — happened to match that exact quoted token, since the guard scans raw text rather than import statements specifically.
- **Fix:** Renamed the suffix to the singular `'unreliable-segment'`, which contains no substring matching any of the guard's six needles (all require the exact word `unreliable-segments`, plural). The guard itself was not touched, weakened, or special-cased.
- **Files modified:** `src/dashboard/views/list.ts`, `src/dashboard/views/list.test.ts` (the one assertion pinning the suffix value)
- **Verification:** `npx vitest run src/analytics/pace-single-source.test.ts` — 84/84 passed (was 1 failed before the fix). Full `npm test` — 93/93 files, 3102/3102 tests, all green.
- **Committed in:** `ac34e62a`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the full suite to stay green without weakening a security/correctness guard. No scope creep — only the one string literal and its one test assertion changed.

## Issues Encountered

None beyond the deviation above.

## For the human checkpoint (33-13)

Exact rendered strings for the four named activities, computed directly from the real committed streams in Task 3 and reproduced identically by both `list.ts`'s badge path and `detail-sections.ts`'s row path (`badgeSpec.visibleText === row.valueText` asserted directly for the two severe activities):

| Activity | Tier | Badge shown? | Badge / row `visibleText`/`valueText` | Row `evidenceText` |
|---|---|---|---|---|
| **3475734189** | severe | **Yes** | `1 unreliable segment, 182 m over 0:08 (hidden pause)` | `First segment at 22:32; longest 0:08` |
| **3475740390** | severe | **Yes** | `5 unreliable segments, 166 m over 0:15 (isolated jump)` | `First segment at 39:07; longest 0:05` |
| **3475724402** | minor | **No** (D-06: only severe badges a list row) | `16 unreliable segments, 2149 m over 12:31 (gap adjacent)` | `First segment at 17:10; longest 1:50` |
| **10146303423** | not exercised by Task 3 (only the three named activities were driven end to end) — expected `none` tier per 33-09-SUMMARY.md's own anchor table: row renders `No unreliable segments detected` with `evidenceText: null`, no badge. A stream-less activity renders the not-available twin: `Quality data not available for this activity`, `tier: 'not-computable'`, `evidenceText: null`. Both branches are unit-tested (Task 2) but not re-verified against 10146303423's own real stream in this plan — plan 33-13's checkpoint should read this row directly off the served build for that activity if it wants a real-data confirmation. | | | |

Measured-value table (Task 3, full precision as computed, independently reconciled against `classifyGapsWithSegments`' own segments — never against `unreliableSegmentsSignal`'s own output):

| Activity | count | totalMetres | totalExcessMetres | totalSeconds | mechanisms | excessFraction | tier | badge present |
|---|---|---|---|---|---|---|---|---|
| 3475724402 | 16 | 2148.7 | 0 | 751 | `["gap-adjacent"]` | 0 | minor | No |
| 3475734189 | 1 | 181.5 | 122.7 | 8 | `["hidden-pause"]` | 0.017964071856287425 | severe | Yes |
| 3475740390 | 5 | 166.1999999999989 | 55.94999999999891 | 15 | `["isolated-jump"]` | 0.005292732071402116 | severe | Yes |

These figures are byte-identical to 33-09-SUMMARY.md's and 33-14/33-CALIBRATION.md's own anchor values for the same three activities.

**Flagged for the human checkpoint:**

1. **3475724402's minor-tier row copy** ("16 unreliable segments, 2149 m over 12:31 (gap adjacent)" with no badge) — this is Claude's own copy (no dictated UI-SPEC text existed to defer to). Judgment: it reads as informative rather than "nothing wrong", since it states the real 2149 m / 12:31 figures even though `totalExcessMetres` is exactly 0 (D-07's gap-dilution finding, a recorded finding not a bug). Please confirm on the served page that this reads clearly to a human, not just to this executor.
2. **Double disclosure by design, not a defect:** the detail view's "Coverage gaps" row (existing, plan 33-04/33-05) already itemises unreliable segments in its own `evidenceText` ("N gap/pause intervals, M unreliable segments; longest ..."), and the new "Unreliable segments" row (this plan) discloses the same segments a second time with fuller detail (metres, seconds, mechanisms, first/longest location). Task 3 proved directly on all three named activities that the two disclosed counts agree (both read from the same `classifyGapsWithSegments` output) — this is intentional redundancy, not a contradiction, but the checkpoint should visually confirm the two rows don't read as conflicting on the page.
3. **10146303423 (the clean control)** was not driven through Task 3's end-to-end proof (only the three named activities were, per the plan's own scope) — its `none`-tier row and its not-available twin are each unit-tested with synthetic fixtures (Task 2) but not re-verified against this specific activity's real stream in this plan. Recommend the checkpoint spot-check this activity directly on the served build.

## Known Stubs

None. Every string the badge and row render is drawn from the computed/parsed signal's own measured fields (count, metres, seconds, mechanisms) via `unreliableSegmentsBadgeContent` — no placeholder, no hardcoded value, no restatement of the tier alone.

## Threat Flags

None beyond what the plan's own threat register already names and this plan's own verification confirms:
- T-33-14 (a non-severe signal badging a row): mitigated, `tier === 'severe'` gate with three separately-named silence cases (minor/none/not-computable) in `list.test.ts`.
- T-33-14b (a stale cached document throwing): mitigated, `undefined`-tolerant reads in both `list.ts` and `detail-sections.ts`, each with a named non-throwing test case.
- T-33-12 (implying SEG-06 feeds the composite): mitigated, `EXPLANATION_PROBE_SPECS`' three-member loop array is unchanged (grep count 1), `UNRELIABLE_SEGMENTS_EXPLANATION` is a standalone constant.
- T-33-13e (a badge/row showing a placeholder rather than a measurement): mitigated, Task 3's full compute -> serialise -> parse -> render proof on three real streams, with at least one non-`none` tier (in fact two `severe`), so the case cannot pass vacuously.

## Verification Evidence

**Task 1 (`-t "unreliableSegments"` in `list.test.ts`):** whole-file 122 passed, 12 match the filter. `hasAnySevereSignal`'s 3-member `Pick<>` grep count: 1 (unchanged).

**Task 2 (`-t "unreliableSegmentsRow"` in `detail-sections.test.ts`):** whole-file 162 passed, 11 match the filter. `qualitySignalsSectionPlan`/`notAvailableRows` both return the identical nine-element label array `['Decimation', 'Coverage gaps', 'Impossible samples', 'Unreliable segments', 'Lowest altitude', 'Start/end altitude', 'Max vertical rate', 'Device / recording source', 'Elapsed vs. moving']`. `grep -c 'UNRELIABLE_SEGMENTS_EXPLANATION' src/dashboard/views/detail-sections.ts` -> 4. `EXPLANATION_PROBE_SPECS`' three-member loop array unchanged (grep count 1, `unreliableSegments` absent from it).

**Task 3 (`-t "named activities"` across both files):** 8 passed (4 per file), 0 failed. Round trip goes through `JSON.parse(JSON.stringify(shard))` then `parsePaceQualityShard` — stated explicitly in both test files' own titles and comments. `npx tsc --noEmit`, `npm run build`, `npm run build-widgets` all green.

**Guard-fix verification:** `pace-single-source.test.ts` 84/84 passed after the rename (was 1 failed before).

**Byte-identity (all three generated artifacts, regenerated and diffed clean):**
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` — `git diff --exit-code` clean.
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md` — `git diff --exit-code` clean.
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md` — `git diff --exit-code` clean.

**Bundle-presence:** `data/dashboard/index.json` and `dist/widgets/data/dashboard/index.json` sha256-identical (`03a8bda3...`) after `npm run compute-dashboard-index && npm run build-widgets`. Composite figures unchanged: `Quality: any severe signal: 299`, `Quality: not computable: 25`. `dist/widgets/assets/index-B3Etra57.js` (the asset `dist/widgets/index.html` actually references) contains both `unreliable-segment'` (the badge/row builder code) and the literal string `Unreliable segments` (the row label) — the new view code is genuinely in the served bundle, not merely in source.

**`data/streams` untouched:** `git status --porcelain data/streams` empty throughout.

**Full-suite counts:**
- Dispatch baseline (plan 33-10, `HEAD c93b0f35`): 93 files / 3,070 tests.
- Final, after all four commits and full artifact regeneration: **93 files / 3,102 tests**, all green (+32: 12 Task 1 + 15 Task 2 [11 dedicated + 2 CR-01 + 2 healthy/not-computable row extensions minus overlap] + 8 Task 3 — net matches exactly).
- `npx tsc --noEmit`: clean. `npm run build`: clean. `npm run build-widgets`: clean.
- `git status --short` at session end: clean (all regenerated artifacts under `data/dashboard/`, `data/stats/`, `dist/widgets/` are gitignored).

## Next Phase Readiness

- SEG-06 is now fully surfaced end to end: computed (33-09), shard-projected/parsed (33-10), rendered as a severe-only list badge and an always-on ninth detail row with a proven measured-value round trip on all three named activities (this plan).
- Plan 33-13 alone still sets SEG-06's actual `REQUIREMENTS.md`/ROADMAP disposition — nothing is ticked here. The "For the human checkpoint" table above gives plan 33-12/33-13 the exact strings to draft checkpoint rows against.
- `data/streams/`, `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` are untouched by every commit in this plan.
- The three flagged items above (minor-tier copy, intentional double disclosure, 10146303423 not end-to-end-proven) are candidates for the human checkpoint's own attention, not blockers.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*
