---
phase: 35-stream-derived-running-pace
plan: 09
subsystem: analytics
tags: [running-pace, dashboard-index, publish-verify, rpace-01, rpace-03, unpassable-criterion, wr-06, single-read]

# Dependency graph
requires:
  - phase: 35-stream-derived-running-pace (plan 35-08)
    provides: "detectPaceDisagreement(metadataPaceSecPerKm, runningPace, options?) retargeted onto RunningPace; PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173; compute-dashboard-index.ts already compiling against the new signature behind a one-wave RETIRED_STREAM_READ_GATE_SEC_PER_KM carry-over this plan deletes"
  - phase: 35-stream-derived-running-pace (plan 35-03)
    provides: "deriveRunningPace(stream) — total, never throws, returns the not-computable shape for null/invalid streams"
provides:
  - "The retired 200 sec/km metadata-implausibility stream-read gate is DELETED, along with the streamReadAttempted flag, the duplicate read it guarded, and 35-08's one-wave RETIRED_STREAM_READ_GATE_SEC_PER_KM carry-over constant"
  - "deriveRunningPace and detectPaceDisagreement now run exactly once per activity, unconditionally, on the single stream read the quality-signal block already performed — exactly one readJson<CanonicalStream> call site remains in compute-dashboard-index.ts"
  - "DashboardIndexRow.runningPace: RunningPaceRow | null — a new REQUIRED, additive row field (DASHBOARD_INDEX_SCHEMA_VERSION stays 1). null means 'no stream at all' (entry.available === false); a present-but-not-computable stream carries a populated object with computable: false and a reason, never null and never a fabricated zero"
  - "scripts/verify-dashboard-publish.mjs asserts every row carries the runningPace key (possibly null) and, when non-null, that computable/notComputableReason/runningPaceSecPerKm are internally consistent — proven able to FAIL (a deleted key and a fabricated computable/reason mismatch were both injected into the real built index.json and rejected, then reverted and re-accepted)"
  - "ROADMAP criterion 3 diagnosed UNPASSABLE (not unfailable/vacuous) while the gate stood: 3475724402's stream could never be read, so paceDisagreement could never become non-null for it regardless of any threshold or comparator change — this was the read GATE, not the eligibility gate (D-02) or the calibrated cut, blocking the criterion. Fixed by deleting the gate, not by rewording the criterion."
affects: [35-10, 35-11, 35-12, 35-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Writer-level reachability proof pinned to the exact synthetic fixture shape pace-derivation.test.ts already proved reachable (dense covered pairs + one dt=2s/dd=60m isolated-jump burst), rather than inventing a new untested detector shape."
    - "A REQUIRED-key addition to DashboardIndexRow (WR-06 discipline) requires a caller census across every test file with its own row-fixture builder, not just the plan's own files_modified list — the same discipline 35-08 already used for the PaceDisagreement rename."

key-files:
  created: []
  modified:
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/dashboard-index.types.ts
    - scripts/verify-dashboard-publish.mjs
    - src/analytics/compute-dashboard-index.test.ts
    - src/analytics/gear-aggregate-logic.test.ts
    - src/dashboard/data/index-client.test.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/overview.test.ts
    - src/dashboard/views/trends-cadence-hr-logic.test.ts
    - src/dashboard/views/trends-logic.test.ts
    - src/dashboard/views/trends-volume-logic.test.ts

key-decisions:
  - "Criterion 3's unsatisfiability is UNPASSABLE, not unfailable/vacuous: while the 200 sec/km read gate stood, 3475724402's own branch (paceSecPerKm 296.0, above the gate) never executed, so its stream was never read and paceDisagreement stayed null forever — no comparator or threshold change could ever make the criterion evaluate TRUE. This is distinct from the gate excluding it by policy (D-02's excludedM > 0 eligibility filter, which fires AFTER a running pace is computed) — the read gate blocked the activity from ever reaching the comparator at all. Fixed the gate; the ROADMAP criterion's own wording was not touched."
  - "Task 1 and Task 2's row-field wiring were split into separate commits by temporarily deferring the `row.runningPace` object literal and the dashboard-index.types.ts interface out of Task 1's diff (verified Task 1 alone still typechecks and the full suite stays green with the field absent), so each task commit is independently buildable rather than landing as one combined diff."
  - "Task 2's REQUIRED runningPace key broke tsc for 9 test files carrying their own DashboardIndexRow literal builders, none listed in the plan's files_modified. Followed 35-08's own established WR-06 caller-census precedent (a required key must be added to every row-fixture builder, not made optional) rather than weakening the field to optional, which would have reintroduced the exact silent-omission risk WR-06 exists to prevent."

patterns-established:
  - "When a plan asks for a `readJson<CanonicalStream>` count-of-one structural check and a REQUIRED DashboardIndexRow key in the same plan, verify the count check BEFORE wiring the row field (Task 1 first, unconditionally) so the row-field commit (Task 2) is a pure additive diff with no gate-deletion logic mixed in — makes the caller-census fallout isolable to Task 2's own commit."

requirements-completed: []  # Requirement-tick safety (plan's own Objective + orchestrator instruction): this plan ticks nothing; RPACE-01/RPACE-03's tick is the orchestrator's, at review/verify time.

# Metrics
duration: ~65min
completed: 2026-09-28
---

# Phase 35 Plan 09: Delete the Read Gate, Fold Into One Read, Ship the Running-Pace Row Field Summary

**Deleted the retired 200 sec/km stream-read gate that made ROADMAP criterion 3 unpassable (not vacuous), folded `deriveRunningPace`/`detectPaceDisagreement` onto the single unconditional stream read the quality-signal block already performed, shipped a new additive `runningPace` row field enforced by an updated publish-time verifier proven able to fail, and pinned the fix's own reachability with a writer-level test watched RED against the old gate reproduced inline.**

## Performance

- **Duration:** ~65 min
- **Completed:** 2026-09-28
- **Tasks:** 3/3
- **Files modified:** 13

## Accomplishments

- **Task 1 — the gate deletion and single-read fold.** Deleted `RETIRED_STREAM_READ_GATE_SEC_PER_KM` (35-08's one-wave carry-over), the `streamReadAttempted` flag, and the duplicate `readJson<CanonicalStream>` call it guarded. `deriveRunningPace(streamForQuality)` and `detectPaceDisagreement(paceSecPerKm, runningPace)` now run exactly once per activity, unconditionally, bound to a named `const runningPace` right after the single stream read the quality-signal block already performed — confirmed via the plan's own structural check (`grep -c readJson<CanonicalStream>` == 1, both retired identifiers absent, the inline `deriveRunningPace(streamForActivity)` form gone). Added parallel `runningPaceComputableCount`/`runningPaceNotComputableCount` counters, logged in the same style as the existing `paceDisagreementCount` summary line. Verified this task alone (row field NOT yet wired) still typechecks and keeps the full suite green — this is what let Task 1 and Task 2 land as separate, independently-buildable commits. Regenerating the real archive with only this task's code live (measured before Task 2's commit) already showed the reachability fix working: `Pace disagreements flagged: 125` unchanged, `Running pace: computable: 1873, not computable: 26`.
- **Task 2 — the additive `runningPace` row field and publish-time enforcement.** Added `RunningPaceRow` (`runningPaceSecPerKm`, `excludedM`, `excludedSec`, `computable`, `notComputableReason`) and a REQUIRED `DashboardIndexRow.runningPace: RunningPaceRow | null` to `dashboard-index.types.ts`, `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged at `1`, following the `gearName`/`paceDisagreement`/`quality` WR-06 precedent verbatim in the docblock. `compute-dashboard-index.ts` populates the field from Task 1's `runningPace`, `round1`-ing the three numeric members at the CI write boundary; `null` only when `entry.available === false` (35-UI-SPEC.md's "omitted entirely" state) — a present-but-not-computable stream carries a populated `computable: false` object with its reason, never `null`, never a fabricated zero. `scripts/verify-dashboard-publish.mjs` gained a new check block asserting every row carries the key (possibly `null`) and, when non-null, that `computable`/`notComputableReason`/`runningPaceSecPerKm` cannot disagree — **proven able to FAIL**: a deleted `runningPace` key and a fabricated `computable: true` + non-null `notComputableReason` mismatch were both injected directly into the real built `dist/widgets/data/dashboard/index.json` and confirmed rejected (`✗ ... is missing the "runningPace" key entirely` / `✗ ... has a malformed "runningPace"`), then the file was restored and re-confirmed accepted (67 checks, 0 failures, up from 66 pre-plan). Regenerated the real archive end-to-end (`npm run build` → `compute-dashboard-index` → `build-widgets`): 1899 activities, running pace computable 1873 / not computable 26 (25 no-stream + the 1 not-computable stream `35-CALIBRATION.md` already measured), pace disagreements flagged 125 (unchanged). **3475724402 is now badged for the first time**: `runningPace: {runningPaceSecPerKm: 317.6, excludedM: 2253.1, excludedSec: 797, computable: true}`, `paceDisagreement: {runningPaceSecPerKm: 317.6, metadataPaceSecPerKm: 295.9, ratio: 1.07}` — matching `35-CALIBRATION.md`'s own basis-gate measurement (`eligible=true targetValue=1.0731 cut=1.0173 PASS`) and 35-UI-SPEC.md's own probe-reference exclusion-line example (`2,253 m` / `13:17`) exactly.
- **Caller census (Rule 3, blocking).** The new REQUIRED `runningPace` key broke `tsc` for 9 test files carrying their own `DashboardIndexRow` literal builders, none listed in the plan's `files_modified`: `gear-aggregate-logic.test.ts`, `index-client.test.ts`, `calendar-logic.test.ts`, `list-logic.test.ts`, `list.test.ts`, `overview.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-logic.test.ts`, `trends-volume-logic.test.ts`. Each gained a `runningPace: null` default beside its existing `gearName`/`paceDisagreement`/`quality: CLEAN_QUALITY` defaults, following the exact fixture-default precedent already established in those same files (35-08 did the identical caller-census sweep for the `PaceDisagreement.runningPaceSecPerKm` rename). `compute-dashboard-index.test.ts`'s own `EXPECTED_ROW_KEYS` (the no-leaked-field guard) gained `'runningPace'`.
- **Task 3 — writer-level reachability, watched RED against the old gate.** Added a NEW `describe('running pace reachability (RPACE-01/RPACE-03, 35-09 — the retired 200 sec/km gate is deleted)', ...)` block, leaving 35-08's archive-sweep `describe('pace disagreement', ...)` block untouched. Two synthetic fixtures reuse `pace-derivation.test.ts`'s own proven "isolated-jump burst" shape (dense `dt<=10s` covered pairs + one `dt=2s`/`dd=60m` burst), both with metadata pace 296.0 s/km — matching 3475724402's real profile, well above the retired 200 sec/km gate: a **flagged** fixture (coveredM=1600, coveredSec=500, excludedM=60 → running pace 312.5, ratio 1.0557, clears the calibrated cut 1.0173 → `runningPace` populated, `paceDisagreement` non-null) and its **mirror** (coveredM=1500, coveredSec=450, excludedM=60 → running pace 300.0, ratio 1.0135, does NOT clear the cut → `runningPace` populated, `paceDisagreement` null) — proving reachability in both directions, not just the accept case. A third test reproduces the OLD `metadataPace < 200` gate condition inline against the SAME flagged fixture: verbatim result, `296.0 < 200` is `false`, so the stream is never read and `paceDisagreement` stays `null` — directly contrasted against the first test's non-null result, showing the gate itself (not the comparator) was the blocker. A single-read regression guard spies on `FileStore.prototype.readJson` and asserts exactly one call for the stream path across a full row assembly. Three field-shape cases assert `null` only for the no-stream case, a populated not-computable object for an unusable stream (single-sample, fails `validateStreamSeries`), and a populated computable object for a healthy stream. A criterion-4 guard asserts `row.paceSecPerKm` against an INDEPENDENTLY computed `moving_time / (distance / 1000)`, never against the writer's own running-pace or disagreement output. `-t "running pace reachability"` matched 7 tests, all green (not vacuous). Full file: 60/60.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fold the running pace and the disagreement check into the single unconditional stream read** - `13eb102b` (feat)
2. **Task 2: Add the additive runningPace row field and assert it at publish time** - `bb919d04` (feat)
3. **Task 3: Prove the slow-metadata reachability fix, watched failing against the old gate** - `fe75945f` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/analytics/compute-dashboard-index.ts` — deleted the retired gate, the duplicate read and `streamReadAttempted`; single unconditional stream read feeding quality signals, running pace and the disagreement check; new computable/not-computable counters; populates the `runningPace` row field.
- `src/analytics/dashboard-index.types.ts` — `RunningPaceRow` interface and the new REQUIRED `DashboardIndexRow.runningPace: RunningPaceRow | null` field, `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged at `1`.
- `scripts/verify-dashboard-publish.mjs` — new `runningPace` presence/shape/internal-consistency check block, proven able to fail against two distinct injected corruptions.
- `src/analytics/compute-dashboard-index.test.ts` — `EXPECTED_ROW_KEYS` gains `'runningPace'`; new `running pace reachability` describe block (7 tests).
- `src/analytics/gear-aggregate-logic.test.ts`, `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, `src/dashboard/views/list-logic.test.ts`, `src/dashboard/views/list.test.ts`, `src/dashboard/views/overview.test.ts`, `src/dashboard/views/trends-cadence-hr-logic.test.ts`, `src/dashboard/views/trends-logic.test.ts`, `src/dashboard/views/trends-volume-logic.test.ts` — caller-census `runningPace: null` fixture default, following the existing `gearName`/`paceDisagreement`/`quality` precedent in each file.

## Decisions Made

See `key-decisions` in the frontmatter. In brief: (1) criterion 3 was diagnosed UNPASSABLE (not vacuous) — the read gate, not D-02's eligibility gate or the calibrated cut, was what made the criterion unable to ever evaluate TRUE for 3475724402; the gate is what was fixed, the ROADMAP wording is untouched; (2) Task 1 and Task 2 were split into independently-typechecking commits by temporarily deferring the row-field wiring out of Task 1's diff, verified separately; (3) the REQUIRED `runningPace` key's caller-census fallout across 9 test files not in the plan's `files_modified` was resolved by extending each file's existing fixture-default pattern, per 35-08's own established precedent, rather than weakening the field to optional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The new REQUIRED `DashboardIndexRow.runningPace` key broke `tsc` for 9 test files not listed in the plan's `files_modified`**
- **Found during:** Task 2, `npx tsc --noEmit` immediately after adding the required key to `dashboard-index.types.ts`
- **Issue:** Every test file with its own literal `DashboardIndexRow`-typed row-fixture builder (`gear-aggregate-logic.test.ts`, `index-client.test.ts`, `calendar-logic.test.ts`, `list-logic.test.ts`, `list.test.ts`, `overview.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-logic.test.ts`, `trends-volume-logic.test.ts`) failed to compile with "Property 'runningPace' is missing" — none of these files are in the plan's `files_modified` list.
- **Fix:** Added `runningPace: null,` to each builder immediately after its existing `quality: CLEAN_QUALITY,` (or equivalent) line, with a comment following the exact wording already used for the `gearName`/`paceDisagreement` precedent in the same files — matching 35-08's own established caller-census discipline for this exact kind of required-key addition.
- **Files modified:** the 9 files listed above.
- **Verification:** `npx tsc --noEmit` exits 0; full suite green (101 files, 3649 tests at that point).
- **Committed in:** `bb919d04` (Task 2)

**2. [Rule 1 - Bug] The committed `dist/widgets/data/dashboard/index.json` on disk was stale relative to the new schema, failing `verify-dashboard-publish-stats.test.mjs`'s CONTROL and LEGITIMATE cases**
- **Found during:** Task 2, `npx vitest run` (full suite) immediately after wiring the row field
- **Issue:** `verify-dashboard-publish-stats.test.mjs` symlinks the real, locally-built `dist/widgets` tree into a shadow directory and runs the real verifier against it. The `dist/widgets/data/dashboard/index.json` present on disk predated this plan's `runningPace` field, so the new publish-time check correctly reported it missing — the CONTROL case (expects a clean pass) and the LEGITIMATE shard case both failed with exit status 1 instead of 0.
- **Fix:** Regenerated the real archive end-to-end — `npm run build` (tsc) → `npm run compute-dashboard-index` (writes `data/dashboard/index.json` with the new field) → `npm run build-widgets` (copies it into `dist/widgets`) — per the environment notes' own build-digest-not-log-verification discipline. Verified the served digest directly (`node -e` reading `dist/widgets/data/dashboard/index.json`, confirming 3475724402's `runningPace`/`paceDisagreement` populated) rather than trusting the build log alone.
- **Files modified:** none (gitignored `data/`/`dist/` regeneration only; no source change).
- **Verification:** `npx vitest run` full suite green (101 files, 3649 tests); `npm run verify-dashboard` 67/0.
- **Committed in:** n/a (gitignored artifacts, not committed; this is the expected consequence of a schema-widening writer change, not a code defect).

---

**Total deviations:** 2 auto-fixed (1 blocking caller-census sweep, 1 stale-artifact regeneration)
**Impact on plan:** Neither deviation altered the shipped behaviour of the writer, the comparator, or the verifier. Both are necessary consequences of adding a REQUIRED, additive field to a widely-consumed shared type, following precedents this same phase (35-08) already established.

## Issues Encountered

None beyond the two documented deviations above. `git status --porcelain data/streams` was empty throughout; no test wrote to or `git checkout`ed a tracked file; no `git stash`, `git clean`, or other destructive operation was used. This plan ran on the primary checkout (sequential executor, no worktree isolation) — no worktree guards applied.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The `runningPace` row field's name and shape (`RunningPaceRow`: `runningPaceSecPerKm`, `excludedM`, `excludedSec`, `computable`, `notComputableReason`) are stable for plan 35-10 (the Running Pace stat tile) to consume directly — 35-UI-SPEC.md's Copywriting Contract's three tile states (computable, zero-excluded, not-computable) and its "omitted entirely" (`null`) state map onto this shape exactly.
- ROADMAP criterion 3's read-gate blocker is resolved; 3475724402 is now badged with figures matching `35-CALIBRATION.md`'s own basis-gate measurement exactly (`ratio 1.0731`, `PASS`). Criterion 3's own remaining clauses (the count-of-newly-disputed finding, the regenerable-artifact requirement) were already satisfied by 35-06/35-07/35-08 and are unaffected by this plan.
- `scripts/verify-dashboard-publish.mjs`'s new check is proven bidirectionally (rejects broken, accepts good) — plan 35-12's merge-and-regenerate-on-the-merged-tree step should re-run `npm run verify-dashboard` after its own regeneration rather than assume this plan's local proof still holds on a different tree state.
- No blockers for plan 35-10.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-28*

## Self-Check: PASSED

All 13 modified files confirmed present via `[ -f ... ]`: `src/analytics/compute-dashboard-index.ts`,
`src/analytics/dashboard-index.types.ts`, `scripts/verify-dashboard-publish.mjs`,
`src/analytics/compute-dashboard-index.test.ts`, `src/analytics/gear-aggregate-logic.test.ts`,
`src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`,
`src/dashboard/views/list-logic.test.ts`, `src/dashboard/views/list.test.ts`,
`src/dashboard/views/overview.test.ts`, `src/dashboard/views/trends-cadence-hr-logic.test.ts`,
`src/dashboard/views/trends-logic.test.ts`, `src/dashboard/views/trends-volume-logic.test.ts`,
plus this summary. All three task commit hashes (`13eb102b`, `bb919d04`, `fe75945f`) confirmed
present via `git log --oneline --all`.
