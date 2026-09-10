---
phase: 27-per-activity-quality-signals
plan: 01
subsystem: analytics
tags: [typescript, vitest, device-taxonomy, data-quality, gap-aware-pace]

requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "classifyGaps/quantile/advanceIntervals in pace-derivation.ts, validateStreamSeries in best-effort-utils.ts, PINNED_FIXTURES/loadPinnedActivity in pace-fixtures.ts, the T-26-01/T-26-02 totality/no-coercion contract"
provides:
  - "The full Phase 27 type contract in src/analytics/pace-quality.ts: QualityTier, DeviceFamilyKind, DeviceEraSignal, DecimationSignal, GapProfileSignal, ImpossibleSampleSignal, ElapsedVsMovingSignal, ActivityQualitySignals, ActivityQualityMetadata"
  - "resolveDeviceFamily(metadata) implementing D-12's three-outcome device-family ladder (known family / unrecognized-device / no-device-name), gated on device_name then source_provider"
  - "elapsedVsMovingSignal(metadata) — untiered elapsed/moving ratio fact (D-14)"
  - "notComputableSignals(deviceEra, elapsedVsMoving, reason) — the explicit D-06 not-computable constructor, fresh object per call"
  - "KNOWN_DEVICE_FAMILIES lookup table and NOT_COMPUTABLE_NO_STREAM / NOT_COMPUTABLE_UNUSABLE_STREAM closed reason set"
  - "Resolution of the unknown-device vs unrecognized-device taxonomy collision: pace-fixtures.ts's real-pause fixture renamed to no-device-name"
affects: [27-02, 27-03, 27-04, 27-05, 27-08, 27-09, 27-10]

tech-stack:
  added: []
  patterns:
    - "Pure/client-safe analytics module (no fs/fetch/DOM), total functions returning not-computable/zeroed results rather than throwing, copied verbatim from pace-derivation.ts's header contract"
    - "Closed-set notComputableReason strings (never free-form) so downstream scripts and views can key on exact values"
    - "Fresh-object-per-call constructor for shared not-computable state, mirroring pace-derivation.ts's zeroCoverage() pattern"

key-files:
  created:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - .planning/phases/27-per-activity-quality-signals/deferred-items.md
  modified:
    - src/analytics/pace-fixtures.ts
    - src/analytics/pace-fixtures.test.ts

key-decisions:
  - "Resolved the unknown-device/unrecognized-device taxonomy collision by renaming pace-fixtures.ts's real-pause fixture's deviceFamily from the stale pre-taxonomy string to 'no-device-name' — activity 3475742397 has no device_name and no source_provider, so no-device-name IS its correct family under D-12; it was never a second taxonomy concept"
  - "sourceProvider === 'strava-export' falls through to 'no-device-name' rather than getting a fourth device family, per D-12/ERA-02 — those are genuinely Strava-recorded, device-less activities and ERA-02 never names them as a separate population"
  - "elapsedVsMovingSignal and deviceEra carry no severity tier (D-13/D-14) — QualityTier stays a closed 4-member union including 'not-computable' rather than QualityTier | null, so a reader cannot write 'tier ?? none' and fabricate a clean-looking zero"

requirements-completed: [ERA-01, ERA-02, QUAL-02]

duration: ~20min
completed: 2026-09-10
---

# Phase 27 Plan 01: Quality-Signal Type Contract and Device-Family Resolution Summary

**Established the full Phase 27 `ActivityQualitySignals` type tree in `pace-quality.ts` plus `resolveDeviceFamily`, `elapsedVsMovingSignal`, and `notComputableSignals`, and closed the `unknown-device`/`unrecognized-device` taxonomy collision the pattern search flagged by renaming a stale pinned-fixture annotation to `no-device-name`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified in `src/`), plus 1 process file (`deferred-items.md`)

## Accomplishments
- `src/analytics/pace-quality.ts` exports the complete Phase 27 type contract (7 interfaces/types + 2 constants) with no algorithm belonging to plan 27-02, verified via `npx tsc --noEmit` and identifier presence checks.
- `resolveDeviceFamily` reproduces every one of the 11 `PINNED_FIXTURES` entries' declared `deviceFamily` from that fixture's real `data/activities/{id}.json`, proven by an `it.each` test rather than asserted.
- Resolved the `unknown-device` vs `unrecognized-device` taxonomy collision: exactly one taxonomy name (`unrecognized-device`) now exists across `src/` and `scripts/` for that concept; `pace-fixtures.ts`'s `real-pause` fixture is corrected to `no-device-name` with a comment explaining the resolution.
- `elapsedVsMovingSignal` and `notComputableSignals` implement the two untiered facts and the explicit D-06 not-computable state, with a demonstrated object-identity/non-mutation guarantee.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pace-quality.ts with the full Phase 27 type contract** - `412a2069` (feat)
2. **Task 2: resolveDeviceFamily, and resolve the unknown-device taxonomy collision** - `39470d92` (feat)
3. **Task 3: Untiered elapsed-vs-moving and the explicit not-computable state** - `84bb4031` (feat)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified
- `src/analytics/pace-quality.ts` - Full type contract, `KNOWN_DEVICE_FAMILIES`, `resolveDeviceFamily`, `elapsedVsMovingSignal`, `notComputableSignals`, `NOT_COMPUTABLE_NO_STREAM`/`NOT_COMPUTABLE_UNUSABLE_STREAM`
- `src/analytics/pace-quality.test.ts` - New file: `device family`, `no-device-name category`, and `not computable` describe blocks (25 tests)
- `src/analytics/pace-fixtures.ts` - `PinnedFixture.deviceFamily` narrowed from `string` to `DeviceFamilyKind`; `real-pause` fixture's `deviceFamily` corrected from the stale pre-taxonomy string to `'no-device-name'` with an explanatory comment
- `src/analytics/pace-fixtures.test.ts` - Replaced the now-false "no-device-name never shared" assertion with a `DeviceFamilyKind`-membership guard over every `PINNED_FIXTURES` entry
- `.planning/phases/27-per-activity-quality-signals/deferred-items.md` - Logs 8 pre-existing, out-of-scope `npm run test` failures (see Issues Encountered)

## Decisions Made
- The `unknown-device`/`unrecognized-device` collision is resolved as a rename, not a dual-concept split: activity `3475742397` (the `real-pause` fixture) has neither `device_name` nor `source_provider`, so under D-12's ladder its family is unambiguously `no-device-name`. `unrecognized-device` by definition requires a non-blank `device_name` absent from the lookup table, which this activity cannot satisfy.
- `resolveDeviceFamily` consults `source_provider` as step 2 of a three-step ladder specifically because `device_name` alone cannot distinguish the intervals.icu-migrated cohort from the genuine no-device-name cohort — both have blank `device_name`.
- `sourceProvider === 'strava-export'` was deliberately left folded into `no-device-name` (not given its own family) per the plan's explicit instruction and ERA-02's scope.

## Deviations from Plan

None — plan executed exactly as written. The only addition beyond the plan's literal text was `deferred-items.md`, which documents (does not fix) pre-existing unrelated test failures — this is process documentation, not a code deviation.

## Task 2 Demonstrated-Failing Run (recorded verbatim per acceptance criteria)

Temporarily replaced `resolveDeviceFamily`'s step-3 `no-device-name` return with
`{ family: 'unrecognized-device', rawDeviceName: null }`, then re-ran
`npx vitest run src/analytics/pace-quality.test.ts -t "no-device-name category"`.

Observed failure:
```
FAIL src/analytics/pace-quality.test.ts > resolveDeviceFamily — no-device-name category (ERA-02) > an activity with no device_name and no source_provider reports the explicit no-device-name category, never a fabricated device
AssertionError: expected 'unrecognized-device' to be 'no-device-name' // Object.is equality

Expected: "no-device-name"
Received: "unrecognized-device"

 ❯ src/analytics/pace-quality.test.ts:101:29
    99|     const activity = loadPinnedActivity('no-device-name');
   100|     const resolved = resolveDeviceFamily(metadataOf(activity));
   101|     expect(resolved.family).toBe('no-device-name');
```

The branch was then restored verbatim and the full targeted suite re-verified green
(`npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts` →
60/60 passed).

## Live Archive Counts (drift tracking only, not an assertion)

Observed at execution time (2026-09-10), consistent with the plan's CONTEXT.md D-06 figures:
- `data/activities/`: 1,890 files
- `data/streams/`: 1,866 files

## Issues Encountered

`npm run test` (full suite) does NOT exit 0 in this worktree — 8 pre-existing failures, all
unrelated to this plan's files, logged to `deferred-items.md`:
- 5 files fail with `ENOENT` reading gitignored, derived `data/stats/*.json` /
  `data/dashboard/index.json` output that has never been generated in this fresh worktree
  (the CI compute pipeline was never run here).
- 1 file (`src/dashboard/views/trends-zoom-logic.test.ts`) fails reading
  `node_modules/chartjs-plugin-zoom/dist/...` via a relative `fs` path — this worktree's own
  `node_modules/` directory exists but is empty (dependency install never ran here); Node's
  module-resolution fallback to the parent repo's `node_modules/` covers `import` specifiers
  but not this test's direct relative-path `fs.readFileSync`.

None of these 8 files are touched by this plan. The plan's own verification target —
`npx tsc --noEmit` (0 errors) and
`npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts`
(60/60 passed) — is fully green. Fixing the underlying environment gap (full `npm install` +
full compute pipeline) is outside this plan's scope (interface-first, pure TypeScript, no I/O)
and outside the deviation rules' auto-fix boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`src/analytics/pace-quality.ts` now carries the full type contract every later Phase 27 plan
compiles against (`DeviceFamilyKind`, `QualityTier`, `ActivityQualitySignals`, etc.), plus the
two untiered-fact functions and the not-computable constructor. Plan 27-02 can now implement
`DecimationSignal`/`GapProfileSignal`/`ImpossibleSampleSignal`'s algorithms against these exact
types without redefining any of them. The taxonomy collision blocking a clean `DeviceFamilyKind`
union is fully resolved — no `unknown-device` string remains anywhere in `src/` or `scripts/`.

No blockers for 27-02. The `npm run test` full-suite gap (see Issues Encountered) may still be
present when later plans run the full suite in a fresh worktree — future executors should be
aware this is a pre-existing worktree-provisioning gap, not something introduced by this phase.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
