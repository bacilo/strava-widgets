---
phase: 27-per-activity-quality-signals
plan: 09
subsystem: ui
tags: [typescript, vitest, dashboard, detail-view, quality-signals, accessibility, xss-defense]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-06's createPaceQualityClient/parsePaceQualityShard lazy shard client; 27-07's qualityBadgeSpecs/appendAccessibleBadge/.badge--severe; 27-01/27-02's ActivityQualitySignals type tree and device-family taxonomy"
provides:
  - "qualitySignalsSectionPlan (pure) and buildQualitySignalsSection (DOM emitter) — the always-on, five-row Quality Signals section on the activity detail view, never null even for a quality === null row"
  - "deviceFamilyDisplayName — the exhaustive switch (family) with no default branch mapping DeviceFamilyKind to its ERA-02 display string"
  - "paceQualityClient wired as the fourth member of mountBestEffortsAndBadges's single Promise.all, fetched exactly once per detail open, never reachable from list.ts/overview.ts/records.ts"
affects: [27-10]

tech-stack:
  added: []
  patterns:
    - "Explanation-string sourcing via a module-load-time synthetic probe row fed through list.ts's qualityBadgeSpecs, so the always-on detail section's explanation text for the three tiering signals can never drift from the severe-tier list badge's own text without retyping it or exporting new symbols from a file this plan does not own"
    - "Exhaustive switch (family) with an explicit return type and no default branch — TS2366 (not all code paths return a value) makes an eighth DeviceFamilyKind member a compile error rather than a silent fallthrough, without needing noImplicitReturns"
    - "evidenceText genuinely depends on the fetched shard (gapIntervals list, zeroAdvanceRunProfile, the raw impossibleSamples list) while valueText depends only on the index row's own scalars — so the section still renders its five value rows when the shard fetch fails or is in flight (T-27-31), and the fetch earns its place by supplying evidence the index scalars alone do not carry (D-17)"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "qualityBadgeSpecs (already exported from list.ts, owned by the parallel 27-08 worktree in this wave) is imported and fed a synthetic all-severe probe row ONCE at module load to source the three tiering signals' explanation strings, rather than retyping them or adding new exports to list.ts — list.ts is out of scope for this plan/worktree pair, so the probe-and-extract pattern satisfies 'reuse the same explanation strings' without touching a file another agent owns concurrently"
  - "deviceEra and elapsedVsMoving carry a distinct literal tier value 'untiered' rather than QualityTier | null, for the exact T-26-02 reason QualityTier's own union documents: a nullable tier invites 'tier ?? none' and would style an untiered fact as a clean tiering result"
  - "The impossible-samples row's evidenceText reads the fastest implied speed from shard.impossibleSamples' own per-pair list (not the index row's maxImpliedSpeedMps scalar, even though the values agree) so this row's evidence genuinely depends on the fetched shard rather than merely duplicating an already-available scalar through it"
  - "Two literal-grep acceptance criteria (innerHTML count, Promise.all count, paceQualityClient.load count) were satisfied by rewording explanatory comments rather than the underlying code — e.g. 'no raw-markup DOM assignment of any kind' instead of naming innerHTML in prose — following the same wording-adjustment precedent 27-06's SUMMARY documents, not a Rule 1-4 deviation since behavior is unchanged"

requirements-completed: [QUAL-01, QUAL-04, ERA-02]

duration: ~35min
completed: 2026-09-10
---

# Phase 27 Plan 09: Always-On Quality Signals Detail Section Summary

**Added the always-on, five-row Quality Signals section to the activity detail view (decimation, gap profile, impossible samples, device era, elapsed-vs-moving — all tier-styled, all disclosed even when healthy or not-computable), backed by a single lazy fetch of 27-06's evidence shard wired as the fourth member of the detail view's one existing `Promise.all`, unreachable from any list-view render path.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (2 code tasks + 1 build/verification task with no additional code changes)
- **Files modified:** 3

## Accomplishments

- `qualitySignalsSectionPlan(quality, shard)` in `detail-sections.ts` always returns exactly five rows in fixed order (decimation, gap profile, impossible samples, device era, elapsed-vs-moving) — never `null`, and still produces five explicit "not available" rows when `quality` itself is `null` (a re-parsed row predating the field). `buildQualitySignalsSection`'s return type is `HTMLElement`, never `HTMLElement | null`.
- A not-computable activity's three tiering rows read `Not computable — {reason}` with `tier: 'not-computable'` and never a healthy statement or `0%`; a healthy row states so explicitly (`No decimation detected`, `No recording gaps`, `No impossible samples`) rather than a blank or a fabricated zero.
- `evidenceText` for the three tiering rows is drawn from the D-17 shard's own evidence fields the index row's scalars do not carry — `zeroAdvanceRunProfile`/`adaptiveWindowSec` for decimation, the classified `gapIntervals` list for gap profile, the raw `impossibleSamples` pair list for impossible samples — and is genuinely `null` whenever `shard` is `null` (fetch failed or still in flight, T-27-31), proven by dedicated tests for both the with-shard and without-shard branches of each row.
- `deviceFamilyDisplayName` maps all seven `DeviceFamilyKind` values via an exhaustive `switch (family)` with zero `default` branches (verified: `grep -A20 "switch (family)" | grep -c "default:"` returns `0`). The Task 2 demonstrated-failing run (below) confirms deleting the `no-device-name` case and adding a `default` makes the exhaustiveness check disappear from `tsc` while the ERA-02 display test fails — proving the `default` branch is exactly what would have silently absorbed the category.
- `paceQualityClient.load(detail.id)` joins `mountBestEffortsAndBadges`'s existing single `Promise.all` as its fourth member (`grep -c "Promise.all" detail.ts` unchanged at `3`; `grep -c "paceQualityClient.load"` returns exactly `1`) and is unreachable from `list.ts`/`overview.ts`/`records.ts` (`grep -rn` returns zero matches) — Criterion 2's "zero fetches on list, exactly one on open" is true by construction.
- The three tiering signals' explanation strings are sourced from `list.ts`'s `qualityBadgeSpecs` at module load via a synthetic all-severe probe row, never retyped — a dedicated test imports both and asserts equality, so a future edit to either surface's wording fails the test.
- 18 new tests (113 total in the file, up from 95); `-t "quality signals section"` selects 17 of them (1 additional test lives in a separate `describe` for the exhaustive-switch guard). `npx tsc --noEmit` exits 0.
- **Task 3 (build verification):** rather than accepting the pre-existing worktree-provisioning gap documented by 27-01/27-04/27-06/27-07 (missing `data/dashboard/index.json` and `data/stats/`), this worktree's `data/activities/` (1,890 files) and `data/streams/` (1,866 files, both git-tracked) were sufficient to run `npm run compute-all-stats` fully offline — no network call, no credentials needed — producing a complete `data/stats/` tree and `data/dashboard/index.json` locally. `npm run build-widgets` then published a real, complete bundle, and `npm run verify-dashboard` exits 0 with **64/64 checks passing** (0 failures), including all four pace-quality-specific checks. This is a stronger result than prior sibling plans' partial/deferred verification — see Issues Encountered for why this was reachable here and reachability details for the ephemeral worktree's generated artifacts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the shard into the single existing mount point** - `fdf88972` (feat)
2. **Task 2: The always-on Quality Signals section** - `93bad39a` (feat)
3. **Task 3: Confirm the section renders on a real build** — no code changes; verification only (see below), no separate commit.

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/dashboard/views/detail.ts` — Added `paceQualityClient?: PaceQualityClient` to `DetailViewDeps` and its default construction; added `paceQualityClient.load(detail.id)` as the fourth `Promise.all` member in `mountBestEffortsAndBadges`; added a synchronous `qualitySignalsContainer` placeholder appended on both branches of the `detail.stream` conditional in `renderSuccess`, filled via `replaceChildren` once the shard resolves (mirroring `bestEffortsContainer`); updated the `mountBestEffortsAndBadges` call site and JSDoc. The mount `CustomEvent` dispatch remains the function's last statement.
- `src/dashboard/views/detail-sections.ts` — Added `QualitySignalRow`, `QualitySignalsSectionPlan`, `qualitySignalsSectionPlan`, `buildQualitySignalsSection`, `deviceFamilyDisplayName`, and the five per-signal row builders (`decimationRow`, `gapProfileRow`, `impossibleSamplesRow`, `deviceEraRow`, `elapsedVsMovingRow`) plus the `EXPLANATION_PROBE_SPECS` module-load-time probe. Imports `appendAccessibleBadge`/`qualityBadgeSpecs` from `list.ts` and the `pace-quality.ts` type tree. `breakdownSectionPlan`/`buildBreakdownSection` are untouched (`git diff` on this file shows changes only to the import block and new additive code).
- `src/dashboard/views/detail-sections.test.ts` — Added the `qualitySignalsSectionPlan — quality signals section (D-08, D-09, D-12, D-17)` describe block (16 tests) and the `deviceFamilyDisplayName exhaustive switch (ERA-02, Criterion 5)` describe block (1 test), plus fixture builders `HEALTHY_QUALITY`, `NOT_COMPUTABLE_QUALITY`, `makeShard`.

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- **`evidenceText` gating**: every tiering row's `evidenceText` is computed independent of tier — it is present whenever the shard carries relevant non-empty data (gap intervals, zero-advance-run profile, impossible-sample list) and `null` otherwise, including when `shard` itself is `null`. This means a `'none'`-tier row with residual shard data (e.g. one harmless recording gap below the minor threshold) can still show evidence text alongside its healthy `valueText` — a deliberate choice, since evidence is a "here's what we measured" disclosure independent of whether that measurement crossed a severity threshold.
- **Row order is fixed by construction**: `qualitySignalsSectionPlan` always returns `[decimationRow, gapProfileRow, impossibleSamplesRow, deviceEraRow, elapsedVsMovingRow]` in that literal array order, matching `qualityBadgeSpecs`'s own fixed decimation → gapProfile → impossibleSamples order for the three shared signals.
- **`.badge--severe` reused unchanged**: only a `'severe'`-tier row gets the existing modifier class from plan 27-07; `'minor'`/`'none'`/`'not-computable'`/`'untiered'` all render the plain `.badge`. No new CSS was added (`styles.css` is out of this plan's file scope) — every row's `valueText` already names the condition and value in text regardless of styling, so accessibility does not depend on the missing minor/not-computable modifier classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Wording adjustment, not a Rule 1-4 deviation] Literal-grep acceptance criteria required rewording explanatory comments**

- **Found during:** Task 1 and Task 2, running the plan's own literal `grep -c` acceptance checks before committing.
- **Issue:** Three of the plan's acceptance criteria are literal substring counts intended as proxies for structural invariants (`grep -c "Promise.all"` unchanged, `grep -c "paceQualityClient.load"` exactly 1, `grep -c "innerHTML"` returns 0). My first-draft doc comments mentioning `Promise.all`, `paceQualityClient.load`, and `innerHTML` in prose (to explain the code to a future reader) inflated these counts above the literal targets, even though the actual code satisfied every invariant the greps are proxies for (exactly one real `Promise.all(` call, exactly one real `paceQualityClient.load(` call, zero `innerHTML` assignments).
- **Fix:** Reworded the affected comments to describe the same guarantees without the flagged substrings (e.g., "the same await batch" instead of naming `Promise.all` a second time; "no raw-markup DOM assignment of any kind" instead of naming `innerHTML`) — following the exact precedent 27-06's SUMMARY documents for the same class of issue.
- **Files modified:** `src/dashboard/views/detail.ts`, `src/dashboard/views/detail-sections.ts` (within Task 1's and Task 2's own commits — no separate commit).
- **Verification:** All three grep counts match their literal targets exactly (`3`, `1`, `0`) after rewording; `npx tsc --noEmit` and the full targeted test suite stayed green throughout.
- **Committed in:** `fdf88972` (Task 1), `93bad39a` (Task 2).

---

**Total deviations:** 1 wording adjustment (not a Rule 1-4 deviation — no behavior change, only comment prose). No architectural changes, no auto-fixed bugs, no missing functionality added beyond the plan's own text.

## Task 2 Demonstrated-Failing Run (recorded verbatim per acceptance criteria)

Temporarily deleted the `case 'no-device-name':` arm from `deviceFamilyDisplayName`'s exhaustive switch and added `default: return 'Unknown device';` in its place, then re-ran both checks the acceptance criteria require:

```
npx tsc --noEmit
```
Output: **no errors** (exit 0) — the exhaustiveness check (TS2366, "not all code paths return a value") disappeared entirely once the `default` branch was added, confirming that branch is exactly what would have silently absorbed a future eighth `DeviceFamilyKind` member with no compile-time signal.

```
npx vitest run src/dashboard/views/detail-sections.test.ts -t "device family"
```
Observed failure:
```
FAIL src/dashboard/views/detail-sections.test.ts > qualitySignalsSectionPlan — quality signals section (D-08, D-09, D-12, D-17) > device family no-device-name maps to a distinct display string: No device name recorded
AssertionError: expected 'Unknown device' to be 'No device name recorded' // Object.is equality

Expected: "No device name recorded"
Received: "Unknown device"

 ❯ src/dashboard/views/detail-sections.test.ts:527:33
    525|     const plan = qualitySignalsSectionPlan(quality, null);
    526|     const deviceRow = plan.rows[3];
    527|     expect(deviceRow.valueText).toBe(expected);
```
1 failed, 5 passed, 107 skipped (of 113).

The branch was then restored verbatim — `diff` against the pre-edit file (byte-for-byte backup) showed zero difference after restoration — and the full targeted suite re-verified green: `npx vitest run src/dashboard/views/detail-sections.test.ts` → **113/113 passed**; `npx tsc --noEmit` → 0 errors.

## Issues Encountered

**`npm run test` (full suite):** 1857 passed, 28 skipped, 9 failed FILES — all pre-existing worktree-provisioning artifacts already documented in `deferred-items.md` by plans 27-01/27-04/27-06/27-07 (missing gitignored `data/stats/*.json`/`data/dashboard/index.json` — *at the point this suite ran, before Task 3's compute step*, plus the empty `node_modules/chartjs-plugin-zoom` worktree artifact). No new entries added; this plan's own targeted files (`detail-sections.test.ts`) are among the passing files. Note: after Task 3's `npm run compute-all-stats` populated `data/stats/` and `data/dashboard/`, most of these `ENOENT`-based failures would likely resolve, but re-running the full suite was not repeated after Task 3 since it is out of this plan's own verification scope and the targeted checks were already green throughout.

**Task 3 reachability (contrasts with 27-01/27-04/27-06/27-07's documented gap):** those prior plans correctly treated the missing `data/dashboard/index.json`/`data/stats/` tree as an out-of-scope environment gap for their own `npm run test` runs, since fixing it would touch "dozens of unrelated files" outside those plans' review scope. Task 3 of *this* plan, however, explicitly requires `npm run verify-dashboard` to exit 0 as its own acceptance criterion — not incidentally, but as the task's stated purpose. Checking reachability in both directions (per this plan's own acceptance-criterion-tension guidance): `npm run compute-dashboard-index` and `npm run compute-all-stats` both read only from this worktree's already-git-tracked `data/activities/` (1,890 files) and `data/streams/` (1,866 files, `data/streams/manifest.json`) — no network call, no credentials, no `data/private/athlete-private.json` required (age-grading/training-load degrade gracefully to disabled/omitted, exactly as `compute-age-grading`'s own console output states). Running both compute steps was therefore reachable and appropriate here, unlike the general `npm run test` gap other plans left undisturbed. `data/geo/geo-metadata.json` (git-tracked, modified as a side effect of `compute-geo-stats`'s geocoding cache) and `dist/widgets/test.html` (git-tracked, deleted as a side effect of `build-widgets`) were reverted with `git checkout --` before committing, since neither is part of this plan's `files_modified` and both are incidental to the compute/build run, not deliverables.

## Verification Results

```
npx tsc --noEmit                                                                # 0 errors
npx vitest run src/dashboard/views/detail-sections.test.ts                      # 113/113 passed
npx vitest run src/dashboard/views/detail-sections.test.ts -t "quality signals section"  # 17/17 passed (96 skipped)
grep -c "Promise.all" src/dashboard/views/detail.ts                             # 3 (unchanged from before Task 1)
grep -c "paceQualityClient.load" src/dashboard/views/detail.ts                  # 1
grep -rn "paceQualityClient\|pace-quality-client" src/dashboard/views/list.ts src/dashboard/views/overview.ts src/dashboard/views/records.ts   # (no output — zero matches)
grep -c "innerHTML" src/dashboard/views/detail-sections.ts                      # 0
grep -A20 "switch (family)" src/dashboard/views/detail-sections.ts | grep -c "default:"  # 0
git diff src/dashboard/views/detail-sections.ts   # shows changes only to the import block + new additive code; breakdownSectionPlan/buildBreakdownSection untouched
npm run build-widgets                                                          # exit 0, 0 css-syntax-error
npm run verify-dashboard                                                       # exit 0, 64 checks passed, 0 failures
```

**Built asset (Task 3 record, plan 27-10 must serve this exact digest):**
- Emitted JS asset: `assets/index-QusZKQ85.js`
- SHA-256: `cea75dd277f419d9dbebb0241190df0375eda8f42e15603d9182d89c73d8eff5`
- Contains the literal string `Quality Signals`: yes (`grep -c` → 1)
- Contains a healthy-statement string (`No recording gaps`): yes (`grep -c` → 1)
- Published `data/stats/pace-quality/` file count: 1,890, matching `data/dashboard/index.json`'s 1,890-row `activities` array exactly.

## Two Real Activity IDs for Plan 27-10's Criterion 3 Read-Back

Both drawn from the live archive (`data/dashboard/index.json`, main checkout, 1,890 rows / 299 with `quality.anySevere === true`), with expected badge numbers copied from their published `data/stats/pace-quality/{id}.json` shard files (verified byte-identical between the main checkout and this worktree's freshly regenerated copy):

### Severe example: `i183546832` (gap profile severe)

- **Index row `quality`:** `decimation.tier: 'none'` (0.5% zero-advance), `gapProfile.tier: 'severe'` (`gapFraction: 0.26551897461673785` → **27%** of recorded time in gaps or pauses; `recordingGapSec: 2112`, `pauseSec: 1`, `spanSec: 7958`), `impossibleSamples.tier: 'none'` (count 0), `deviceEra: { family: 'intervals-icu' }` → **"intervals.icu (migrated)"**, `elapsedVsMoving.ratio: 1.37`.
- **Expected Quality Signals section rows:**
  - Decimation: `No decimation detected`
  - Recording gaps: `27% of recorded time in gaps or pauses` — evidence: `11 gap intervals; longest 16:43` (shard's 11 `gapIntervals`, longest is the 4766s–5769s entry, 1003 seconds)
  - Impossible samples: `No impossible samples`
  - Device / recording source: `intervals.icu (migrated)`
  - Elapsed vs. moving: `1.37× elapsed vs. moving time`
- This is the activity plan 27-10's browser checkpoint should open to verify Criterion 3 (badge text naming both the condition AND its measured value, read directly off the rendered page).

### Healthy example: `i183856843` (all tiers none, no severe/minor signal)

- **Index row `quality`:** `decimation.tier: 'none'` (0% zero-advance), `gapProfile.tier: 'none'` (0% gap fraction), `impossibleSamples.tier: 'none'` (count 0), `deviceEra: { family: 'intervals-icu' }` → **"intervals.icu (migrated)"**, `elapsedVsMoving.ratio: 1.01`.
- **Expected Quality Signals section rows:**
  - Decimation: `No decimation detected`
  - Recording gaps: `No recording gaps`
  - Impossible samples: `No impossible samples`
  - Device / recording source: `intervals.icu (migrated)`
  - Elapsed vs. moving: `1.01× elapsed vs. moving time`
- This is the activity plan 27-10's browser checkpoint should open to verify D-08 (a healthy activity visibly says so on all five rows, none blank, none silent).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

The activity detail view now discloses all five Phase 27 quality signals on every activity, healthy and stream-less included, with the D-17 evidence shard fetched exactly once per detail open from the single existing mount point and never reachable from any list-view render path. Plan 27-10's browser checkpoint can now verify:

- **Criterion 2** (shard stays lazy): open `#/activity/i183546832` or `#/activity/i183856843` with the network panel open — zero `pace-quality` fetches should appear while on `#/list`, and exactly one `GET /data/stats/pace-quality/{id}.json` on opening either detail page. Re-opening the same activity within the same page session should not issue a second fetch (27-06's client memoizes).
- **Criterion 3** (badges explain, not just mark): open `#/activity/i183546832` and read the Quality Signals section's "Recording gaps" row — it should read `27% of recorded time in gaps or pauses` with an evidence line naming `11 gap intervals; longest 16:43`, both measured from that activity's own data, never a constant.
- **Criterion 5** (no silent taxonomy fallthrough): the exhaustive `switch (family)` with no `default` branch is demonstrated failing above; a future eighth `DeviceFamilyKind` member added without updating `deviceFamilyDisplayName` will fail `tsc`, not silently fabricate a device name.

The built asset digest (`assets/index-QusZKQ85.js`, sha256 `cea75dd2...`) is recorded above for plan 27-10 to confirm the served bundle matches — per the project's own "stale served bundle" lesson (build-widgets mtime skip), always verify the served digest, never the build log alone.

No blockers for 27-10.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`src/dashboard/views/detail.ts`,
`src/dashboard/views/detail-sections.ts`, `src/dashboard/views/detail-sections.test.ts`,
`27-09-SUMMARY.md`); both task commits (`fdf88972`, `93bad39a`) confirmed present in
`git log`.
