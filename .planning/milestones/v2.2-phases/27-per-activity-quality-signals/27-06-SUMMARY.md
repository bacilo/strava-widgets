---
phase: 27-per-activity-quality-signals
plan: 06
subsystem: ui
tags: [typescript, vitest, dashboard-data, lazy-fetch, xss-defense]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-01's ActivityQualitySignals/PaceQualityShard type tree; 27-04's per-activity data/stats/pace-quality/{id}.json shard published alongside every dashboard-index row"
provides:
  - "createPaceQualityClient — fetch-once/memoize/degrade-to-null lazy client for data/stats/pace-quality/{id}.json, structurally mirroring best-efforts-client.ts"
  - "parsePaceQualityShard — total, never-throwing parse with entry-level tolerance and missing-sub-signal degrade, matching best-efforts-client.ts's parseActivityBestEfforts discipline"
  - "D-18's in-CI instrumented fetch-counter proof: zero fetches on construction, exactly one per load(id), non-memoization of failures demonstrated load-bearing"
affects: [27-08, 27-09, 27-10]

tech-stack:
  added: []
  patterns:
    - "Lazy per-activity shard client: fetch-once/memoize/degrade-to-null via a per-id Map, with an explicit if (result === null) inFlight.delete(id) branch so a failure is never memoized — reused verbatim from best-efforts-client.ts for the second per-activity evidence shard in this codebase"
    - "Missing-sub-signal degrade at the parse boundary: a shard whose signals object is present but missing one named sub-signal parses with that sub-signal as {tier: 'not-computable', ...nulls} rather than returning null for the whole shard, so one missing field never loses an entire evidence section for the detail view"

key-files:
  created:
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
  modified: []

key-decisions:
  - "rawDeviceName is parsed and returned completely unmodified (no HTML transform of any kind) at this client boundary — escaping belongs solely at the DOM boundary (textContent, plan 27-09); a comment at the field states this explicitly and a test pins an XSS-shaped payload surviving byte-for-byte, so a later 'helpful' escape added here is caught"
  - "Per-sub-signal parse functions (parseDecimationSignal, parseGapProfileSignal, parseImpossibleSampleSignal, parseDeviceEraSignal, parseElapsedVsMovingSignal) each return null on their own structural failure, and the composite parseActivityQualitySignals substitutes the not-computable default for any one that fails — chosen over failing the whole shard because the shard's signals object has five independent sub-signals (unlike best-efforts' single flat entry shape), and D-17's evidence-shard purpose is defeated if one malformed field discards the other four"

requirements-completed: [QUAL-03]

duration: ~8min
completed: 2026-09-10
---

# Phase 27 Plan 06: Lazy Pace-Quality Shard Client Summary

**Added `createPaceQualityClient` for `data/stats/pace-quality/{id}.json`, a structural mirror of `best-efforts-client.ts` (fetch-once/memoize/degrade-to-null), with a D-18 instrumented fetch-counter test proving zero fetches on construction and exactly one per opened activity — both directions demonstrated, including a verbatim-recorded failing run of the do-not-memoize-a-failure line.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `src/dashboard/data/pace-quality-client.ts` mirrors `src/dashboard/data/best-efforts-client.ts` exactly in structure: same `normalizeBaseUrl`, same `options.baseUrl ?? 'data/'` default, same `options.fetchImpl ?? globalThis.fetch` seam, same per-id `inFlight` `Map`, the same `if (result === null) inFlight.delete(activityId)` non-memoization branch with its explanatory comment, and `reset()`. Only the URL (`stats/pace-quality/${activityId}.json`), the parse function, and the exported names (`PaceQualityClient`, `PaceQualityClientOptions`, `createPaceQualityClient`) differ.
- `parsePaceQualityShard` is total and never-throwing: `isPlainObject` guard, own-property reads via `hasOwn`, `null` on any top-level structural failure (missing/non-string `activityId`, missing `signals` object), entry-level tolerance for `gapIntervals`/`impossibleSamples` (one malformed element is dropped, the rest survive), and a missing/malformed individual sub-signal inside `signals` degrades that one sub-signal to `not-computable` rather than invalidating the whole shard.
- The D-18 fetch-counter test (`describe('createPaceQualityClient — fetch count', ...)`) proves both halves: constructing the client with no `load()` call issues zero fetches (the code-path half of "zero fetches on the list view"), and one `load(id)` issues exactly one fetch to `data/stats/pace-quality/{id}.json`, with concurrent/sequential calls memoized and a different id issuing its own fetch.
- Verified live against the freshly published 1,890-shard archive in the main checkout (`/Users/pedf/workspace/strava-widgets/data/stats/pace-quality/{id}.json`) to confirm the exact on-disk field shape (`activityId`, `signals` with all five named sub-signals, `gapIntervals`, `impossibleSamples`, `impossibleSamplesTruncated`, `zeroAdvanceRunProfile`, `adaptiveWindowSec`, `notComputableReason`) matches what the parser expects, byte for byte.
- 17/17 targeted tests pass; `npx tsc --noEmit` exits 0 repo-wide.

## Task Commits

Each task was committed atomically:

1. **Task 1: createPaceQualityClient, mirroring best-efforts-client.ts** - `f22156ed` (feat)
2. **Task 2: The D-18 instrumented fetch-count test** - `5b6f9f77` (test)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/dashboard/data/pace-quality-client.ts` - `createPaceQualityClient`, `parsePaceQualityShard`, and the per-sub-signal parse helpers (`parseDecimationSignal`, `parseGapProfileSignal`, `parseImpossibleSampleSignal`, `parseDeviceEraSignal`, `parseElapsedVsMovingSignal`, `parseGapInterval`, `parseImpossibleSampleEntry`, `parseZeroAdvanceRunProfile`). Imports types only from `../../analytics/pace-quality.js` and `../../analytics/pace-derivation.js` — no algorithm or type redefinition.
- `src/dashboard/data/pace-quality-client.test.ts` - `parsePaceQualityShard` describe block (round-trip, top-level rejection, entry-level tolerance, missing-sub-signal degrade, unescaped `rawDeviceName` passthrough) and `createPaceQualityClient — fetch count` describe block (8 tests covering zero-fetch construction, one-fetch-per-load, concurrent/sequential memoization, cross-id isolation, `reset()`, and both non-memoization failure paths).

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- **Extra helper functions beyond the analog's shape:** `best-efforts-client.ts` has one entry-level parser (`parseEffort`) because its shard has one flat array of effort entries. `PaceQualityShard`'s `signals` object has five independently-typed named sub-signals, so this client needs five small per-sub-signal parsers plus two array-entry parsers (`parseGapInterval`, `parseImpossibleSampleEntry`) and one run-profile parser. The `diff <(grep -o "function \w*" ...)` acceptance check confirms none of the analog's OWN helpers (`hasOwn`, `isPlainObject`, `normalizeBaseUrl`, the fetch/load/reset trio) were dropped — the additions are new, not substitutions.
- **Acceptance-criterion wording adjustment:** the plan's literal grep `grep -c "escape\|encodeURI\|replace(/</"` returning 0 initially failed because a doc comment explaining that `rawDeviceName` is NOT escaped used the word "escape" itself. Reworded the comment to describe the same guarantee ("passed through UNMODIFIED — no HTML transform of any kind") without using the flagged substrings, preserving the intent (no escaping code exists in this file) while satisfying the literal check. Not a Rule 1-4 deviation — a wording fix to satisfy a grep-based acceptance criterion without changing behavior.

## Deviations from Plan

None — plan executed exactly as written. The one wording adjustment above kept behavior identical and is documented for traceability, not as a rule-triggered deviation.

## Task 2 Demonstrated-Failing Run (recorded verbatim per acceptance criteria)

Temporarily replaced the `if (result === null) { inFlight.delete(activityId); }` body with a no-op comment, then re-ran:
```
npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "does not memoize"
```

Observed failure (both non-memoization tests):
```
FAIL src/dashboard/data/pace-quality-client.test.ts > createPaceQualityClient — fetch count > a 404 response resolves null (never rejects) and does not memoize the failure — a second load fetches again
AssertionError: expected null to deeply equal { activityId: 'a1', …(7) }
 ❯ src/dashboard/data/pace-quality-client.test.ts:215:20
    213|     expect(first).toBeNull();
    214|     const second = await client.load('a1');
    215|     expect(second).toEqual(validShard);
    216|     expect(calls.length).toBe(2);

FAIL src/dashboard/data/pace-quality-client.test.ts > createPaceQualityClient — fetch count > a body that throws on .json() resolves null and does not memoize the failure — a second load fetches again
AssertionError: expected null to deeply equal { activityId: 'a1', …(7) }
```
2 failed, 15 skipped (of 17).

The branch was then restored verbatim (`git diff` against the committed file showed zero diff after restoration) and the full targeted suite re-verified green: `npx vitest run src/dashboard/data/pace-quality-client.test.ts` → 17/17 passed.

## Issues Encountered

`npm run test` (full suite): 62/72 test files pass, 1810/1838 individual tests pass (28 skipped). The 9 failing FILES are the same documented worktree-provisioning artifacts already logged in `deferred-items.md` by plans 27-01/27-04 (gitignored derived `data/stats/*.json`/`data/dashboard/index.json` never generated by the missing compute steps in this worktree, plus the empty-`node_modules/chartjs-plugin-zoom` worktree artifact) — no new entries added, per the established instruction not to duplicate the same documented cause. `src/dashboard/data/pace-quality-client.test.ts` itself is among the 62 passing files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`createPaceQualityClient` is ready for the detail view (plan 27-09) to call `load(activityId)` exactly once when an activity's detail opens, reading the evidence shard beneath the five always-on scalar badges that come straight off the index row. `parsePaceQualityShard`'s missing-sub-signal degrade means 27-09 can render "not reported" per sub-section without a defensive null-check pyramid. Criterion 2's code-path half ("zero fetches on list, exactly one on open") is proven in CI; the human network-panel reading against a production-shaped build (plan 27-10) is the second, independent proof D-18 requires — this plan does not and cannot satisfy that half on its own.

No blockers for 27-08/27-09/27-10.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*

## Self-Check: PASSED
