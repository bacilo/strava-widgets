---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 10
subsystem: analytics
tags: [pace-quality, unreliable-segments, quality-shard, dashboard-index, vitest]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "09"
    provides: "UnreliableSegmentsSignal / unreliableSegmentsSignal(t, d, segments, options?), resolveCoverage's shared {coverage, segments} resolution, VALID_SEGMENT_MECHANISMS and parseUnreliableSegmentsSignal (Rule 2 deviation there)"
provides:
  - "PaceQualityShard.unreliableSegments / unreliableSegmentsTruncated (D-08): parts-free per-segment evidence list, capped at 100 like impossibleSamples, projected by the pure exported projectUnreliableSegments(segments)"
  - "parseUnreliableSegment(raw) in pace-quality-client.ts: total, never-throwing, drop-on-failure per-entry parser for the shard's list, mirroring parseGapInterval's contract, wired into parsePaceQualityShard"
  - "DashboardIndexRow.quality.unreliableSegments documented as the additive seventh signal; DASHBOARD_INDEX_SCHEMA_VERSION confirmed to stay 1; compute-dashboard-index.ts confirmed untouched by all of Phase 33 so far (empty diff against base commit 6772dca5)"
  - "Direct sum-vs-row-scalar cross-checks on genuinely multi-segment real activities (3475724402 N=16, 3475740390 N=5), and a synthetic 150-segment cross-check proving row scalars stay uncapped when the shard's own list truncates at 100"
affects: [33-11, 33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure projection function (projectUnreliableSegments) kept separate from its one production call site (buildPaceQualityShard) specifically so a deterministic cap-boundary test (101 synthetic segments) doesn't need a real/synthetic stream — the same shape unreliableSegmentsSignal itself already used for its own synthetic-segments unit tests"
    - "Two different tolerant-parse disciplines living side by side in the same file, deliberately: parseUnreliableSegmentsSignal (a SIGNAL/key) is all-or-nothing — one malformed mechanisms-array entry invalidates the whole signal, matching parseElevationSignal's precedent; parseUnreliableSegment (a LIST ENTRY) is drop-on-failure per entry, matching parseGapInterval's precedent. The threat register (T-33-13b) names both halves of this contract explicitly."

key-files:
  created: []
  modified:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - src/analytics/dashboard-index.types.ts
    - src/analytics/compute-dashboard-index.test.ts

key-decisions:
  - "Plan-text ambiguity investigated and resolved in favor of the already-shipped, threat-register-authoritative behavior: Task 2's <behavior> bullet 5 and its acceptance criteria describe the signal's `mechanisms` array as 'drops that entry and keeps the valid ones' (a per-entry-drop contract), but `parseUnreliableSegmentsSignal` was already shipped in plan 33-09 as all-or-nothing (one malformed mechanism invalidates the WHOLE signal) per `parseElevationSignal`'s precedent, and Task 2's own <action> step 2 and the threat register's T-33-13b both independently confirm all-or-nothing is the intended contract for a SIGNAL/key (drop-on-failure is reserved for LIST ENTRIES — the shard's per-segment list, covered separately by bullet 6 and `parseUnreliableSegment`). No code was changed; this SUMMARY documents the investigation rather than silently accepting either the plan-text wording or the shipped code without reconciling them (see Issues Encountered)."
  - "Added two new cross-check tests (a new commit, not folded into Tasks 1-3) proving directly — not merely inferred by combining two already-true facts — that the shard's per-segment list sums to the row scalars on genuinely multi-segment real activities (3475724402 N=16, 3475740390 N=5), and that row scalars stay uncapped when the shard list itself truncates at 100 (synthetic 150-segment fixture, archive's real max is 20 so no real fixture can reach the cap)."

patterns-established:
  - "Test-title substring hygiene for -t filters: two of Task 3's three new test titles did not contain the substring the task's own behavior bullet named ('unreliable') and were silently excluded from the filtered run (1 of 3 matched, not 3 of 3) despite the plan's own automated verify command passing (it only asserts a NON-ZERO passed count, not the expected count) — renamed both titles to include the substring; re-ran to confirm 3/3 matched and green. Matches this project's own recorded 'vitest -t filter can be vacuous' pattern: record the matched count on every -t row, don't trust a non-zero pass alone."

requirements-completed: []  # SEG-06's disposition is set by plan 33-13 alone, per this plan's own requirement-tick-safety text; this SUMMARY documents evidence only.

# Metrics
duration: ~45min (continuation session only; a prior executor session, terminated by a provider usage limit partway through Task 3, is not separately timed)
completed: 2026-09-21
---

# Phase 33 Plan 10: SEG-06's wire format — shard evidence, tolerant parsers, additive index row Summary

**The lazy quality shard gained a capped, `parts`-free per-segment evidence list (D-08) and its tolerant browser parser; the dashboard index row's seventh signal was confirmed purely additive with `DASHBOARD_INDEX_SCHEMA_VERSION` still `1` and `compute-dashboard-index.ts` untouched — closed out after a mid-plan usage-limit interruption, with two new direct cross-checks proving the shard-list-sums-to-row-scalars invariant on real multi-segment activities and its uncapped-totals-under-truncation counterpart.**

## Performance

- **Duration:** ~45 min (this continuation session; Tasks 1-2 and part of Task 3 were executed by a prior session that hit a provider usage limit)
- **Tasks:** 3 (all three now complete)
- **Files modified:** 6

## Accomplishments

- `PaceQualityShard.unreliableSegments` / `unreliableSegmentsTruncated` (D-08): each entry carries exactly `startSec`/`endSec`/`metres`/`excessMetres`/`seconds`/`mechanism` — no `parts`, `startIndex`, `endIndex` or burst/gap sub-fields — capped at 100 like `impossibleSamples`, projected by the pure exported `projectUnreliableSegments(segments)` from the SAME `resolveCoverage` segments `buildPaceQualityShard` already resolved (no second resolver/detector call)
- `parseUnreliableSegment(raw)` in `pace-quality-client.ts`: total, never-throwing, drop-on-failure-per-entry parser mirroring `parseGapInterval`'s contract, wired into `parsePaceQualityShard`'s existing tolerant-drop loop; a stale shard with no `unreliableSegments` key yields an empty array and `unreliableSegmentsTruncated: false`, never `undefined`
- `dashboard-index.types.ts` gained a comment-only doc addition beside `quality: ActivityQualitySignals`; `DASHBOARD_INDEX_SCHEMA_VERSION` confirmed still `1`; `compute-dashboard-index.ts` confirmed untouched by ALL of Phase 33 (empty `git log`/`git diff --stat` against the phase-33 base commit `6772dca5`)
- Two new direct cross-check tests (this session's own addition, beyond the plan's three tasks): shard-list-sums-to-row-scalars on 3475724402 (N=16: 2148.7 m / 0 excess / 751 s) and 3475740390 (N=5: 166.2 m / 55.95 m excess / 15 s), both matching 33-09-SUMMARY.md's independently-derived anchor values exactly; and a synthetic 150-segment case proving row scalars (count 150, totalMetres 4500) stay uncapped while the shard's own capped-at-100 list sums to less (3000)
- Live artifacts regenerated and verified: `data/dashboard/index.json` and its `dist/widgets/` copy byte-identical (sha256 `95c02c38…`); the 3475740390 shard's 5-entry list byte-identical in both `data/stats/pace-quality/` and `dist/widgets/data/stats/pace-quality/`; composite figures unchanged (`Quality: any severe signal: 299`, `Quality: not computable: 25`)

## Task Commits

1. **Task 1: D-08 — the shard's parts-free, capped per-segment projection** — `468879f8` (feat, prior session)
2. **Task 2: Tolerant browser parsers for the seventh signal and the shard's segment list** — `949c4473` (feat, prior session)
3. **(this session) D-08 cross-checks — multi-segment sum-vs-scalars and uncapped totals under truncation** — `0b997f6d` (test)
4. **Task 3: The index row stayed additive and the schema version stayed 1** — `b9404622` (feat, this session — includes the two renamed test titles)

_No separate plan-metadata commit is created by this response — this SUMMARY documents it; the orchestrator is the single writer for STATE.md/ROADMAP.md/REQUIREMENTS.md per this session's explicit sequential-executor constraint._

## Files Created/Modified

- `src/analytics/pace-quality.ts` — `PaceQualityShard.unreliableSegments`/`unreliableSegmentsTruncated` fields with doc comments stating `parts` is deliberately absent; `projectUnreliableSegments(segments)` pure projection (capped at 100); `buildPaceQualityShard` wired to project from its existing shared `segments` result
- `src/analytics/pace-quality.test.ts` — Task 1's 7 cases (`-t "unreliableSegments"`): empty-array case, exact sorted key-set assertion (excludes `parts`/`startIndex`/`endIndex`/burst-gap sub-fields), 100-vs-101-segment cap boundary, and per-field match against `classifyGapsWithSegments`' own segments on the three named activities; this session's 3 new cross-check tests (2 sum-vs-scalars on N=16/N=5, 1 synthetic uncapped-totals-under-truncation)
- `src/dashboard/data/pace-quality-client.ts` — `parseUnreliableSegment(raw)`, wired into `parsePaceQualityShard`'s existing tolerant-drop loop alongside `impossibleSamples`/`elevationVerticalRateSamples`; `VALID_SEGMENT_MECHANISMS` and `parseUnreliableSegmentsSignal` (both already shipped by plan 33-09) extended, not duplicated
- `src/dashboard/data/pace-quality-client.test.ts` — Task 2's 5 cases (`-t "unreliableSegments"`): well-formed round-trip, missing-key default, malformed-entry drop (one wrong-typed `startSec`, one unknown `mechanism`, both dropped, one valid entry kept — covers orchestrator cross-check (d)), non-boolean `unreliableSegmentsTruncated` degrades to `false`, and a `Record<SegmentMechanism, true>` compile-time + runtime union-enumeration guard
- `src/analytics/dashboard-index.types.ts` — comment-only addition beside `quality: ActivityQualitySignals`; zero field/version/call-site changes
- `src/analytics/compute-dashboard-index.test.ts` — Task 3's 3 cases (renamed 2 of 3 titles to include "unreliable" so `-t "unreliable"` selects all three): schema-version-stays-1-with-signal-present, real 3475734189 row carries every populated field (matches its named-activity anchor exactly), stream-less row reports the not-computable shape

## Decisions Made

- **Plan-text vs. shipped-code reconciliation (investigated, not changed):** Task 2's `<behavior>` bullet 5 and acceptance criteria describe the signal's plural `mechanisms` array as dropping only the bad entry and keeping the rest ("a mechanisms array containing an unknown mechanism string drops that entry and keeps the valid ones... a test asserts the unknown entry is genuinely absent... the SUMMARY quotes the parsed mechanisms array before and after"). The actually-shipped `parseUnreliableSegmentsSignal` (plan 33-09, unchanged by Task 2) is all-or-nothing: ANY malformed mechanism entry invalidates the WHOLE signal, matching `parseElevationSignal`'s precedent (its own doc comment states this explicitly, and 33-09's test — still green — is titled "one malformed mechanisms array entry invalidates the WHOLE unreliableSegments signal, not just that entry"). Three independent sources confirm all-or-nothing is correct and the behavior-bullet wording is the outlier: (1) Task 2's own `<action>` step 2 says to model `parseUnreliableSegmentsSignal` on "parseElevationSignal's all-or-nothing nested-parse shape"; (2) the threat register's T-33-13b names BOTH disciplines explicitly and assigns them to different targets — "all-or-nothing per key" for `parseUnreliableSegmentsSignal` (a signal/key), "drop-on-failure per list entry" for `parseUnreliableSegment` (a shard list entry); (3) 33-09's RED-verified, currently-green test already proves and locks in all-or-nothing. No code changed. This reads as a copy-paste bleed in the plan text (bullet 5's wording duplicates bullet 6's shard-list-entry contract onto the wrong target) rather than a build requirement — see Issues Encountered for the full investigation trail.
- Added the two direct cross-check tests (commit `0b997f6d`) as their own commit rather than folding into Task 1 or Task 3, since they test the interaction between already-committed Task 1/2 code and are explicitly required by the orchestrator's dispatch note independent of the plan's own three tasks.
- Renamed 2 of Task 3's 3 new test titles (neither contained the substring "unreliable") so the plan's own named-case requirement (`-t "unreliable"` selects every new case) is actually satisfied — found by literally running the filter and seeing 1/3 match instead of 3/3, not by inspection alone (see patterns-established).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two of Task 3's new test titles did not contain the substring required by the task's own named-case rule**
- **Found during:** Verifying Task 3's `-t "unreliable"` filter actually selects all 3 new cases (per the task's `<behavior>` bullet "name every new case so that `-t "unreliable"` selects it in this file")
- **Issue:** `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "unreliable"` reported only 1 passed, not 3 — two titles ("Phase 33 (SEG-06, D-08) kept DASHBOARD_INDEX_SCHEMA_VERSION at 1 despite the seventh quality signal arriving on every row" and "a stream-less activity reports the seventh signal in its not-computable shape too, not absent") never used the word "unreliable", only "seventh signal" — the plan's own automated verify command would still have passed (it only asserts a non-zero count, not an exact one), silently leaving two cases unreachable by the decision-coverage gate's filter.
- **Fix:** Renamed both titles to reference `quality.unreliableSegments`/`DASHBOARD_INDEX_SCHEMA_VERSION` and `unreliableSegments` respectively, preserving their assertions unchanged.
- **Files modified:** `src/analytics/compute-dashboard-index.test.ts`
- **Verification:** Re-ran `-t "unreliable"`: 3 passed, 0 failed (up from 1 passed). Whole-file run still 45/45.
- **Committed in:** `b9404622` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the plan's own named-case requirement and this project's own recorded "vitest -t filter can be vacuous" pattern to actually hold. No scope creep — only the two test titles changed, no assertions altered.

## Issues Encountered

**Investigated but not changed: Task 2's `mechanisms`-array behavior bullet contradicts the already-shipped, threat-register-authoritative code.** See "Decisions Made" above for the full three-source reconciliation (Task 2's own `<action>` text, the threat register's T-33-13b, and 33-09's already-green RED-verified test). Resolution: the shipped all-or-nothing behavior for `parseUnreliableSegmentsSignal`'s `mechanisms` field is correct and untouched; the plan's `<behavior>` bullet 5 / acceptance-criteria wording describing a per-entry-drop contract for that same field is treated as a plan-drafting inconsistency (most likely bullet 6's shard-list-entry contract bleeding onto the wrong target), not a build requirement. No checkpoint was raised because no code change was at stake either way — Rule 4 applies to architectural changes, and reverting shipped, tested, threat-model-sanctioned behavior to match an internally-contradicted plan sentence would itself have been the risky move.

No other issues beyond the deviation above.

## Known Stubs

None. Every field this plan adds (`PaceQualityShard.unreliableSegments`/`unreliableSegmentsTruncated`, the parser side, and the index row's documentation-only addition) is fully wired to real computed/parsed data; no hardcoded or empty value flows to any rendering surface. This plan adds no rendering surface — the detail-view row and list badge remain out of scope per D-08's own row-scalar/shard-evidence split (unchanged from 33-09's own "Known Stubs" note).

## Threat Flags

None. This plan's T-33-13/T-33-13b/T-33-13c/T-33-13d mitigations were all implemented and verified exactly as the threat register specifies: the shard projection is `parts`-free with an exact-key-set test (T-33-13); both parsers follow the file's existing tolerant discipline, all-or-nothing per key and drop-on-failure per list entry (T-33-13b, including the reconciliation above); `DASHBOARD_INDEX_SCHEMA_VERSION` stays pinned at 1 with `compute-dashboard-index.ts` confirmed untouched (T-33-13c); the 100-entry cap with truncation flag matches `impossibleSamples`' own convention (T-33-13d). No new network endpoint, auth path, or trust-boundary change introduced.

## Verification Evidence

**Task 1 (`-t "unreliableSegments"` in `pace-quality.test.ts`):** file total 112 passed (0 failed), 19 match the filter (includes this session's 3 new cross-check tests). Exact sorted key set asserted: `['endSec', 'excessMetres', 'mechanism', 'metres', 'seconds', 'startSec']` — confirmed absent: `parts`, `startIndex`, `endIndex`, `burstMetres`, `burstSeconds`, `gapMetres`, `gapSeconds`. 100-segment case: 100 entries, `truncated: false`. 101-segment case: 100 entries, `truncated: true`, first/last entries `startSec: 0`/`startSec: 990` (order preserved, no re-sort). Per-named-activity projected entry count equals the seventh signal's own `count` field on all three (3475724402, 3475734189, 3475740390) — console-logged, all matched. `grep -c "resolveCoverage(" ` inside `buildPaceQualityShard`'s body: 1 (confirmed by direct read — the function calls it exactly once and shares the `segments` half with `unreliableSegmentsSignal`).

**Task 2 (`-t "unreliableSegments"` in `pace-quality-client.test.ts`):** file total 48 passed (0 failed), 16 match the filter. Missing-signal fallback (parsed from a shard with `signals.unreliableSegments: undefined`) returns exactly `{ tier: 'not-computable', count: null, totalMetres: null, totalExcessMetres: null, totalSeconds: null, excessFraction: null, mechanisms: null }`, never throws. Malformed-shard-entry case: input array of 1 valid + 2 malformed (one wrong-typed `startSec: 'nope'`, one unknown `mechanism: 'bogus-mechanism'`) entries → parsed array length 1, the surviving entry exactly `{ startSec: 10, endSec: 18, metres: 30, excessMetres: 2, seconds: 8, mechanism: 'hidden-pause' }` — this is this plan's own realization of the orchestrator's cross-check (d): malformed and wrong-typed entries both degrade via drop, never throw, never half-parse. `VALID_SEGMENT_MECHANISMS` is its own `ReadonlySet`, docblocked, with a union-enumeration test present. `parseGapInterval`/`VALID_GAP_KINDS` confirmed byte-identical to their post-33-05 state (the only diff hunk touching either symbol across `210e7267..949c4473` is a doc comment in a NEW function referencing `parseGapInterval` by name, zero lines inside either symbol's own body changed).

**Mechanism-allowlist guard, re-run and watched RED this session (verbatim, `pace-quality-client.ts`'s `VALID_SEGMENT_MECHANISMS` temporarily shortened to `['gap-adjacent', 'hidden-pause']`, `isolated-jump` removed):**
```
 Test Files  1 failed (1)
      Tests  4 failed | 12 passed | 32 skipped (48)

 FAIL  src/dashboard/data/pace-quality-client.test.ts > parsePaceQualityShard > a well-formed shard unreliableSegments list round-trips every entry and field (Phase 33 SEG-06, plan 33-10)
 FAIL  src/dashboard/data/pace-quality-client.test.ts > parsePaceQualityShard > a well-formed unreliableSegments object round-trips every field (Phase 33 SEG-06, plan 33-09 Task 3)
AssertionError: expected 'not-computable' to be 'minor' // Object.is equality
 FAIL  src/dashboard/data/pace-quality-client.test.ts > parsePaceQualityShard > unreliableSegments with tier: "minor" (a genuinely valid tier for this signal, unlike elevation) round-trips minor rather than degrading
AssertionError: expected [] to deeply equal [ { startSec: +0, endSec: 5, …(4) } ]
 FAIL  src/dashboard/data/pace-quality-client.test.ts > parsePaceQualityShard > VALID_SEGMENT_MECHANISMS accepts every declared SegmentMechanism union member on a shard unreliableSegments entry, and rejects an unknown one
```
4 tests failed, exactly matching the prior session's commit-message claim (3 pre-existing 33-09 tests plus this plan's own union-enumeration test). Restored via `git checkout -- src/dashboard/data/pace-quality-client.ts`; `git diff --exit-code` clean (exit 0); re-ran filtered: 16/16 passed.

**Task 3 (`-t "unreliable"` in `compute-dashboard-index.test.ts`):** file total 45 passed (0 failed), 3/3 match the filter (up from 1/3 before the title rename — see Deviations). `grep -c 'DASHBOARD_INDEX_SCHEMA_VERSION = 1'` on `dashboard-index.types.ts` → `1`. `git diff` on `dashboard-index.types.ts` is comment-only (quoted in full below). `compute-dashboard-index.ts` confirmed untouched: `git log --oneline 6772dca5..HEAD -- src/analytics/compute-dashboard-index.ts` and `git diff --stat 6772dca5..HEAD -- src/analytics/compute-dashboard-index.ts` both empty (phase-33 base commit `6772dca5`, named in `33-06-SUMMARY.md`). Top-level key-set: the pre-existing `EXPECTED_ROW_KEYS` array (20 members, sorted, unchanged) already covers this requirement without edit, since the addition is nested inside the existing `quality` field.

**`dashboard-index.types.ts` diff, quoted verbatim (comment-only):**
```diff
@@ -128,6 +128,15 @@ export interface DashboardIndexRow {
    * version and this field's presence on every row.
    * `ParsedDashboardIndexRow`'s `Partial<>` covers the re-parse side with no
    * change needed there.
+   *
+   * Phase 33 (SEG-06, D-08, plan 33-09/33-10) added a SEVENTH signal inside
+   * this same nested object — `quality.unreliableSegments` (tier, segment
+   * count, total metres, total excess metres, total seconds, which
+   * mechanisms fired) — purely additively, following this field's own
+   * precedent verbatim: no call site here changed, and
+   * `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`. The shard-only evidence
+   * (the parts-free per-segment list, D-08) lives on `PaceQualityShard`
+   * instead, never on this row.
    */
   quality: ActivityQualitySignals;
```

**This session's own D-08 cross-checks (commit `0b997f6d`), quoted values — matching 33-09-SUMMARY.md's independently-derived anchor figures exactly:**
- 3475724402 (N=16): summed shard entries `metres=2148.7 excessMetres=0 seconds=751`, row scalars `totalMetres=2148.7 totalExcessMetres=0 totalSeconds=751` — exact match.
- 3475740390 (N=5): summed shard entries `metres=166.1999999999989 excessMetres=55.94999999999891 seconds=15`, row scalars identical — exact match.
- Synthetic 150-segment case: row scalars `count=150 totalMetres=4500 totalExcessMetres=150 totalSeconds=750` (uncapped); the capped shard list itself (100 entries) sums to `metres=3000` — strictly less than the row total, proving genuine decoupling.
- Archive's real per-activity max is **20 segments** (activity `3475712117`, of 1,873 shards carrying a numeric `count` — checked directly against the on-disk `data/stats/pace-quality/` archive before regeneration), far under the 100 cap, so a real fixture can never reach the cap; both the 101-segment (Task 1) and 150-segment (this session) cap-proving cases remain synthetic by necessity, exactly as the plan's own `projectUnreliableSegments` doc comment and this session's dispatch note both anticipate.

**Which npm script owns shard generation:** `compute-dashboard-index` (`node dist/index.js compute-dashboard-index`) — `compute-dashboard-index.ts` calls `buildPaceQualityShard` once per row in the same pass that builds the row itself, then writes `<statsDir>/pace-quality/{id}.json` in a dedicated shard-write loop immediately after the main index write. There is no separate shard-generation script.

**Byte-identity (all three generated artifacts):**
- `32-CALIBRATION.md` (`npm run compute-unreliable-segment-calibration`): regenerated, `git diff --exit-code` clean.
- `33-COVERAGE-IDENTITY.md` (`npm run compute-coverage-identity-recount`): regenerated, `git diff --exit-code` clean, `identityViolations=0 recountMismatches=0`.
- `33-CALIBRATION.md` (`npm run compute-unreliable-segment-severity-calibration`): regenerated, `git diff --exit-code` clean, exits 0.

**Local gitignored artifacts, regenerated and confirmed:**
- `data/dashboard/index.json` / `dist/widgets/data/dashboard/index.json`: sha256 `95c02c387436320455a2b21baf150eacb9225787d1f5ea261ce188dcd80ab2d6` on both — matched.
- `data/stats/pace-quality/3475740390.json` / `dist/widgets/data/stats/pace-quality/3475740390.json`: sha256 `3bfa98f1fa78632716e77e027e44f21826e43424ee4351ef58a26aa2c83b64a9` on both — matched; `unreliableSegments.length` 5, `unreliableSegmentsTruncated: false` on both; entry key set `['endSec', 'excessMetres', 'mechanism', 'metres', 'seconds', 'startSec']` — no `parts`.
- Composite figures unchanged from 33-09's baseline: `Quality: any severe signal: 299`, `Quality: not computable: 25`.
- `git status --porcelain data/streams`: empty throughout.

**Full-suite counts:**
- Dispatch baseline (`210e7267`, before this plan): 93 files / 3,052 tests.
- After Tasks 1-2 (prior session, `949c4473`): not separately re-verified this session (inherited as committed).
- After this session's cross-check commit (`0b997f6d`): 93 files / 3,070 tests (net after Task 3 folded in — see below), all green.
- Final, after Task 3 (`b9404622`) and full artifact regeneration: **93 files / 3,070 tests**, all green (+18 over the dispatch baseline: 7 Task 1 + 5 Task 2 + 3 Task 3 + 3 this session's own D-08 cross-checks).
- `npx tsc --noEmit`: clean. `npm run build`: clean. `npm run build-widgets`: clean.
- `git status --short` at session end: clean.

## Next Phase Readiness

- SEG-06's full wire format is now shipped end to end: computed (33-09), shard-projected and parsed (this plan), and confirmed additive on the index row with the schema version unmoved — ready for plan 33-11's rendering work without any further wiring here.
- The two disciplines this plan's parsers follow (all-or-nothing per signal/key, drop-on-failure per shard list entry) are now both directly tested and RED-verified, and the plan-text ambiguity around the signal's `mechanisms` array is documented above so a future reader doesn't re-litigate it.
- `data/streams/`, `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` are untouched by every commit in this plan.
- Plan 33-13 alone still sets SEG-06's actual `REQUIREMENTS.md` disposition — nothing is ticked here.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/analytics/pace-quality.ts`
- FOUND: `src/analytics/pace-quality.test.ts`
- FOUND: `src/dashboard/data/pace-quality-client.ts`
- FOUND: `src/dashboard/data/pace-quality-client.test.ts`
- FOUND: `src/analytics/dashboard-index.types.ts`
- FOUND: `src/analytics/compute-dashboard-index.test.ts`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-10-SUMMARY.md`
- FOUND commit: `468879f8`
- FOUND commit: `949c4473`
- FOUND commit: `0b997f6d`
- FOUND commit: `b9404622`
- FOUND commit: `1f0077c6`
