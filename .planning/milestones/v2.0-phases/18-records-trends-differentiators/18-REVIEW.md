---
phase: 18-records-trends-differentiators
reviewed: 2026-08-12T10:23:25Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - data/private/README.md
  - data/private/athlete-private.example.json
  - scripts/build-widgets.mjs
  - scripts/convert-wma-tables.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/athlete-private.ts
  - src/analytics/compute-age-grading.ts
  - src/analytics/compute-best-efforts.ts
  - src/analytics/compute-dashboard-index.ts
  - src/analytics/compute-gear-aggregate.ts
  - src/analytics/compute-training-load.ts
  - src/analytics/gear-aggregate-logic.ts
  - src/analytics/gear-naming.ts
  - src/analytics/riegel.ts
  - src/analytics/streak-utils.ts
  - src/analytics/compute-advanced-stats.ts
  - src/analytics/training-load.ts
  - src/analytics/trimp.ts
  - src/analytics/wma-factors.ts
  - src/dashboard/data/age-grading-client.ts
  - src/dashboard/data/best-efforts-client.ts
  - src/dashboard/view-registry.ts
  - src/dashboard/views/detail-best-efforts-logic.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/records-charts.ts
  - src/dashboard/views/records-logic.ts
  - src/dashboard/views/records.ts
  - src/dashboard/views/trends-charts.ts
  - src/dashboard/views/trends-gear-logic.ts
  - src/dashboard/views/trends-training-load-logic.ts
  - src/dashboard/views/trends-yoy-logic.ts
  - src/dashboard/views/trends.ts
  - src/index.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-08-12T10:23:25Z
**Depth:** standard
**Files Reviewed:** 34 (full scope of 73 files triaged; the above were read in full — production `src/analytics`, `src/dashboard`, and `scripts/` files, prioritized per the review brief. `*-logic.test.ts`/`*.test.ts` files were not individually re-reviewed beyond confirming their existence in 18-VALIDATION.md's Wave 0 map, since they are lower priority per scope and their coverage claims are already recorded there.)
**Status:** issues_found (2 Warnings, 2 Info — no Critical/security findings)

## Summary

This phase is unusually disciplined: every identity-data boundary (`athlete-private.ts` → `compute-age-grading.ts`/`compute-training-load.ts` → `data/stats/*.json`) is enforced by both a total/never-throwing parser at the point of use and a second, independent build-time guard (`assertNoPrivateArtifacts` in `build-widgets.mjs`, plus `verify-dashboard-publish.mjs`'s key-scan and 404 assertions). I traced the full identity-data path from `data/private/athlete-private.json` through to publication and found no leak path — the two-layer guard (own-property source discipline + a scan of every published JSON body for `"birthDate"`/`"restingHr"`/`"sex"` as JSON keys) is genuinely redundant, not just documented as such. The Riegel self-suppression guard is correctly keyed on distinct `activityId`, not row count, exactly as documented. The CTL/ATL/TSB recursion correctly captures `tsb` before the decay step. Chart.js lifecycle management in `records.ts`/`trends.ts`/`detail.ts` is textbook: every async mount point is re-guarded by a monotonic `requestToken` (or the simpler `mountedContainer` identity check in `records.ts`), every `destroy()` is idempotent, and I could not construct a navigation-race sequence that leaks a chart instance or double-mounts one.

The two Warnings below are real defects, not style nits: one is a dead code path that silently drops a documented UI-SPEC behavior (the "ended {date}" superlative sub-label can never render, because the field it reads is empty exactly when the code checks it), the other is a missing runtime-validation gap that lets a malformed/stale `data/dashboard/index.json` crash `compute-gear-aggregate` with an unhandled `TypeError` instead of degrading — the pre-existing sharp edge the review brief flagged, confirmed and traced to its actual crash site.

## Warnings

### WR-01: `selectCurrentStreak`'s "ended {date}" sub-label is structurally unreachable

**File:** `src/dashboard/views/records-logic.ts:268-282`

**Issue:** `selectCurrentStreak` derives `endedISO` from the published `currentStreakStart` field only when `!active`:

```ts
const endedISO =
  !active && typeof currentStreakStart === 'string' && currentStreakStart.length > 0
    ? currentStreakStart
    : null;
```

But trace the producer: `src/analytics/streak-utils.ts:118` sets `currentStreakStart: withinCurrentStreak ? currentStreakStart : null`, and `src/analytics/compute-advanced-stats.ts:215-217` serializes that as `''` (empty string) whenever it is `null`. So the published `currentStreakStart` field is non-empty **only when the streak is active** — i.e. exactly the one case `selectCurrentStreak` never reads it (the ternary's condition is `!active`). Whenever `!active`, `currentStreakStart` is guaranteed to be `''`, so `currentStreakStart.length > 0` is always `false` and `endedISO` is always `null`.

The consequence in `records.ts:285-297` (`buildSuperlativesSection`): the "Current Streak" tile's sub-label expression `currentStreak.active ? 'active' : currentStreak.endedISO ? \`ended ${...}\` : undefined` can never produce the `ended {date}` branch — 18-UI-SPEC.md:347 ("Current Streak — days + 'active' or 'ended {date}' sub-label") is only ever half-implementable given the current data contract. This degrades gracefully (no sub-label is shown, not a fabricated one — consistent with the codebase's honesty-first philosophy) so it is not a crash or a data-integrity issue, but it is a real, provable gap between the documented UI contract and what can ever render, and it was not caught by any test (the field is DOM-rendered, not unit-tested at that boundary) or by the manual browser checkpoint (18-VALIDATION.md's checklist does not separately exercise a broken/inactive current streak).

**Fix:** The producer needs to actually publish the date the streak ended (e.g. the last activity date, or retain `currentStreakStart` even when inactive and rename the consumer-facing semantics), not the start-of-the-active-streak date that is nulled out exactly when it's needed. Minimal fix: add a `lastActivityDate` (or `currentStreakEndedISO`) field to `StreakData` in `compute-advanced-stats.ts`/`streak-utils.ts` that is populated precisely when `!withinCurrentStreak`, and have `selectCurrentStreak` read that field instead of the always-empty `currentStreakStart`.

### WR-02: `buildGearAggregate` crashes on a row with an absent (not `null`) `gearName` key

**File:** `src/analytics/gear-aggregate-logic.ts:141-156`, reached from `src/analytics/compute-gear-aggregate.ts:42-53`

**Issue:** The Unknown-bucket test is `const isUnknown = label === null;` (line 147). A row whose `gearName` key is entirely **absent** (`undefined`, not `null`) fails this test, falls into the named-bucket path, and is handed to `newBucket(isUnknown ? UNKNOWN_GEAR_LABEL : (label as string), isUnknown)` with `label === undefined`. That bucket survives grouping and is later passed to `slugify(bucket.label)` (line 167), which calls `.toLowerCase()` on `undefined` and throws an uncaught `TypeError`, crashing the whole `compute-gear-aggregate` build step.

This is reachable in practice because `compute-gear-aggregate.ts:44` reads `data/dashboard/index.json` via `fileStore.readJson<DashboardIndexDocument>(indexPath)` with **no runtime schema validation** — unlike every other build-time consumer in this phase (`parseAthletePrivateConfig`, `parseWmaFactorTable`, etc.), this call trusts the TypeScript type assertion alone. A stale index (generated by a pre-Phase-18 build before `gearName` existed), a partially-written index from an interrupted `compute-dashboard-index` run, or a hand-edited/corrupted file on disk would all reach this crash path instead of degrading. Given `DashboardIndexRow.gearName` is typed as required (`string | null`, never optional) this cannot happen from a **correctly generated** index today, so likelihood in the current pipeline is low — but the failure mode when it does happen is an opaque `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` instead of an actionable message, and it takes down the whole nightly compute step rather than degrading one row.

**Fix:** Treat any non-string `gearName` as unknown, not just `null`, e.g.:

```ts
const label = row.gearName;
const isUnknown = typeof label !== 'string';
```

This one-line change makes the function total over its declared input type as well as realistic malformed input, matching the tolerant-parsing discipline every other consumer in this phase already follows.

## Info

### IN-01: Dead `!privateConfig.sex` branch in `computeTrainingLoad`

**File:** `src/analytics/compute-training-load.ts:165-167`

**Issue:** `else if (!privateConfig.sex) { banisterDisabledReason = ... }` can never be true: `AthletePrivateConfig.sex` is typed `'male' | 'female'` and `parseAthletePrivateConfig` rejects any config where `sex` isn't exactly one of those two literal strings (`athlete-private.ts:80-82`), so by the time `privateConfig` is non-null, `sex` is always a truthy string. This is unreachable code — harmless, but it implies a validation this function no longer needs to perform (or, if it's meant as defense-in-depth against a future looser `AthletePrivateConfig`, it should be a comment saying so rather than a live-looking `else if`).

**Fix:** Either delete the branch (rely on the type system, matching the "never substitute a default resting HR" discipline the surrounding comment already states) or replace the condition with an explicit type-widening comment if it's intentionally defensive.

### IN-02: `detail.ts`'s `loadExclusionReason` bypasses the injected `fetchImpl`

**File:** `src/dashboard/views/detail.ts:463-473`

**Issue:** Every other network call in this view (`gearClient.load()`, `athleteConfigClient.load()`, `ageGradingClient.load()`, `bestEffortsClient.load()`, and every stats fetch in `records.ts`/`trends.ts`) is routed through an injectable `fetchImpl` so tests can supply a stub. `loadExclusionReason` instead calls the global `fetch` directly (`await fetch('data/best-effort-exclusions.json')`), breaking that pattern. It happens to work today because Node 22 (this repo's CI/dev target) has a global `fetch`, and this function is DOM-adjacent so it isn't currently unit-tested anyway — but it's a latent inconsistency that will bite the first time this path needs a test double.

**Fix:** Accept and use `deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)` here too, matching every sibling fetch in the same file.

---

_Reviewed: 2026-08-12T10:23:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
