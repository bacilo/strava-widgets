---
phase: 25-ci-hardening-light-theme-verification
reviewed: 2026-09-04T21:05:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - scripts/lib/curation-guard.mjs
  - scripts/lib/curation-guard.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/dashboard-index.types.ts
  - src/analytics/gear-aggregate-logic.test.ts
  - src/analytics/gear-aggregate-logic.ts
  - src/compute-all-stats-steps.test.ts
  - src/compute-all-stats-steps.ts
  - src/dashboard/theme-bootstrap-parity.test.ts
  - src/index.ts
findings:
  critical: 1
  warning: 10
  info: 6
  total: 17
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-09-04T21:05:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Round 2 review of the Phase 25 file set (`scripts/first-paint-capture.mjs` was
dropped from this round's scope — see IN-06, its Round 1 findings are still
open and unfixed).

The step-table collapse (`src/compute-all-stats-steps.ts` + its test) is the
strongest part of the phase: the walker's three dispositions (mandatory
rethrow, tolerated rethrow when `continueOnError: false`, tolerated
warn-and-continue when `true`) are correct and directly covered. The
`daily-refresh.yml` reordering of `compute-age-grading` before
`compute-dashboard-index` was traced through both compute modules and is
genuinely behaviour-neutral (neither reads the other's output). The WR-19
`readdirSync` try/catch in `curation-guard.mjs` is correct, fails closed, and
its fixture test observes the real `EACCES`.

The serious problem is in the new CI-02 by-name publish assertions. The
per-activity shard sampler encodes an invariant — "every index row with
`streams.available === true` has a best-efforts shard containing at least one
effort" — that is **already false against the committed archive**:
`data/stats/best-efforts/11865310195.json` exists today with `efforts: []`
(activity `distanceM: 0`, `streams.available: true`). The shard sampler picks
first/middle/last, so the failure is latent rather than immediate — but the
newest row is one of the three samples, so the first night a sub-400 m or
GPS-glitched activity lands, this blocking gate fails and the site stops
deploying. Because the gate is deliberately blocking with no escape hatch,
that means a total publish outage from a data condition the compute step
treats as normal.

A second, structural tension runs through the whole phase: six compute steps
are declared *tolerated* (warn and continue), while the outputs of three of
them are now *hard-asserted* by a blocking verify step later in the same job.
Tolerating a step whose output the same job then requires does not degrade —
it just fails later and louder, with no deploy.

## Critical Issues

### CR-01: The best-efforts shard assertion encodes an invariant that live data already violates — a legitimate empty `efforts` array halts the nightly deploy

**File:** `scripts/verify-dashboard-publish.mjs:570-601`
**Issue:**
The new shard sample assumes two things that `compute-best-efforts.ts` does
not guarantee:

1. **Every stream-available row has a shard on disk.** Shards are written from
   `activities[id]` (`src/analytics/compute-best-efforts.ts:321`), and that
   map is only populated *after* the `seriesError` and `catch` continues at
   `compute-best-efforts.ts:203-206` and `241-246`. A truncated, non-monotonic
   or unreadable stream/activity file is deliberately tolerated there
   (threat T-15-02, `skippedUnreadable`) and produces **no shard at all** —
   while `streams.available` in the index mirrors the *manifest* entry
   (`compute-dashboard-index.ts:160-169`), not shard existence. So the
   verifier turns a tolerated data defect into a 404 and a hard deploy block.

2. **Every shard has a non-empty `efforts` array.** `activities[id].efforts`
   is `result.efforts`, which is legitimately empty when the activity is
   shorter than the shortest target (400 m, `best-effort.types.ts:39-47`) or
   when every candidate effort is rejected by the plausibility filter
   (`best-effort-utils.ts:152-159`). `compute-best-efforts.ts:278-280` counts
   `activitiesWithEfforts` precisely because empty ones exist and are normal.

This is not hypothetical. Against the committed archive today:

```
total shards 1861   empty-efforts 1   -> data/stats/best-efforts/11865310195.json
{"activityId":"11865310195",...,"efforts":[],"excludedFromRecords":false}
index rows with streams.available === true: 1861 (includes 11865310195)
avail rows under 1 km: 6
```

The in-code comment "the 25 index rows with no shard on disk are exactly the
25 rows with `streams.available === false` (set equality verified
2026-09-03)" is a snapshot of one day's data, not an invariant — and it is
already wrong for the emptiness half of the assertion.

Impact: `npm run verify-dashboard` exits 1 → the blocking gate step fails →
`Deploy widgets to GitHub Pages` never runs → the published site silently
freezes at the previous day's bundle. This is the exact failure class the
`push:` trigger comment at the top of `daily-refresh.yml` says bit the project
repeatedly through phases 16-18.

**Fix:** Assert what the producer actually guarantees — shape, not
non-emptiness — and derive the sample from shard-bearing rows, not from
`streams.available`:

```js
// Sample only ids the producer actually shards, and assert shape not census.
const shardCandidates = indexDoc.activities.filter(
  (row) => row.streams?.available === true
);
...
    const parsedShard = JSON.parse(shardBody);
    if (parsedShard === null || typeof parsedShard !== 'object') {
      fail(`/data/stats/best-efforts/${shardId}.json did not parse to an object`);
    } else if (String(parsedShard.activityId) !== String(shardId)) {
      fail(...);
    } else if (!Array.isArray(parsedShard.efforts)) {
      // An EMPTY efforts array is a legitimate producer output (activity
      // shorter than the 400m shortest target, or every effort rejected by
      // the plausibility filter) — only a missing/non-array field is a defect.
      fail(`/data/stats/best-efforts/${shardId}.json "efforts" expected an array, got ${JSON.stringify(parsedShard.efforts)}`);
    } else {
      ok(...);
    }
```

If the census property ("no stream-available row is missing a shard") is
genuinely wanted, it belongs in `compute-best-efforts` as a reported total
(e.g. `skippedUnreadable > 0` warning), not as a 404 probe on three sampled
ids that will fire non-deterministically depending on where the bad activity
happens to sit in the archive.

## Warnings

### WR-01: Six "tolerated" compute steps have their outputs hard-asserted by a blocking gate in the same job — the degrade path cannot actually degrade

**File:** `.github/workflows/daily-refresh.yml:96-118`, `src/compute-all-stats-steps.ts:105-171`
**Issue:** `compute-best-efforts`, `compute-dashboard-index` and
`compute-gear-aggregate` are all `mandatory: false` with warn-and-continue
under `--ci`. But `data/stats/` and `data/dashboard/` are gitignored and
regenerated every run, `copyDataFiles()` silently skips a missing source
directory (`scripts/build-widgets.mjs:231-235`), and the new CI-02 block plus
the pre-existing index checks then hard-require
`best-efforts.json`, `weekly/monthly/yearly`, `year-over-year`, the shards and
a non-empty `gearName` over HTTP. So a tolerated failure produces: warning →
green compute step → build with missing data → **red verify step → no
deploy**. The tolerance buys nothing except a later, less legible failure.
**Fix:** Pick one posture per step and make it consistent. Either promote the
steps whose outputs the gate requires to `mandatory: true` (fail fast at the
compute step, where the error message is actually about the cause), or make
the corresponding verify assertions conditional on the artefact having been
produced this run (e.g. skip-with-notice when `data/stats/best-efforts.json`
is absent, so a degraded night still publishes the rest of the site).

### WR-02: The new CI-02 assertions abort the entire gate on the first malformed body instead of recording a failure

**File:** `scripts/verify-dashboard-publish.mjs:443, 465, 487, 509, 531, 592` (and the `[0].field` accesses at `448, 470, 492, 517`)
**Issue:** Two escape routes out of the accumulate-and-report design this file
otherwise uses:
- `JSON.parse(body)` is unguarded. A truncated `weekly-distance.json` throws
  `SyntaxError`, unwinds out of `main()`, hits `main().catch` (line ~669) and
  exits 1 with a raw stack trace — the `N check(s) passed, M failure(s).`
  summary never prints and every later check (shards, activities, streams,
  pages, asset resolution) is skipped, so one broken document masks all
  remaining diagnostics.
- Entry-0 property access is unguarded: `parsedWeeklyDistance[0].weekStartISO`
  throws `TypeError: Cannot read properties of null` when the array is
  `[null]`; `parsedBestEfforts.schemaVersion` and `parsedShard.activityId`
  throw the same way for a body of literal `null`. These are the exact
  corrupt-document shapes the block was added to detect, and they produce a
  stack trace instead of the intended `✗ ...` line.

**Fix:** Wrap parsing in a helper that reports rather than throws, and use it
for all six documents:

```js
function parseJsonOrFail(path, body) {
  try {
    const value = JSON.parse(body);
    if (value === null || typeof value !== 'object') {
      fail(`${path} parsed to ${JSON.stringify(value)}, expected an object or array`);
      return null;
    }
    return value;
  } catch (error) {
    fail(`${path} returned 200 but did not parse as JSON (${error.message})`);
    return null;
  }
}
// then guard entry 0 as well:
const first = parsed[0];
if (first === null || typeof first !== 'object') { fail(`${path} entry 0 is not an object`); }
```

### WR-03: `computeAllStatsCommand` prints "All statistics generated successfully!" on a degraded run

**File:** `src/index.ts:317` (immediately above the DEGRADED STEPS block at `319-329`)
**Issue:** The success line is unconditional, so a nightly where three
tolerated steps failed prints an unqualified success claim and *then*
contradicts itself. Anyone grepping the collapsed Actions log for
"successfully" — or reading only the last screenful before the exit — gets the
wrong answer. This directly undercuts D-03's stated purpose ("a nightly that
quietly degraded three steps is visible at a glance"). Still open from the
Round 1 review (WR-04).
**Fix:**
```ts
if (degraded.length === 0) {
  console.log('\nAll statistics generated successfully!');
} else {
  console.log(`\nStatistics generated with ${degraded.length} degraded step(s).`);
}
```

### WR-04: `process.exit(0)` immediately after the DEGRADED STEPS summary can truncate that summary on a piped stdout

**File:** `src/index.ts:331` (and the same pattern at `139, 157, 176, 197, 219, 240, 259, 280, 375`)
**Issue:** In GitHub Actions, `process.stdout` is a pipe, and pipe writes in
Node are asynchronous. `process.exit()` "forces the process to exit ... even
if there are still asynchronous operations pending", including queued stdout
writes. The compute chain emits a large volume of log output ahead of the
summary, so the very block D-03 added for visibility is the one most likely to
be dropped. The failure is intermittent and log-size-dependent, which makes it
worse, not better.
**Fix:** Set the code and return instead of exiting mid-flush:
```ts
process.exitCode = 0;
return;
```
(and `process.exitCode = 1; return;` in the catch, so pending output flushes
before the runtime exits naturally).

### WR-05: A raw NUL byte is embedded in `gear-aggregate-logic.ts`, making the file binary to git

**File:** `src/analytics/gear-aggregate-logic.ts:143` (byte offset 4955)
**Issue:** `const unknownKey = '\0unknown';` contains a literal NUL character
in the source, not an escape sequence. `file` reports the source as `data`,
`git diff`/`git blame` refuse to show content (`Bin 8097 -> 8701 bytes` in
this phase's diffstat), and any tool that treats NUL as a terminator
(grep without `-a`, editors, some review UIs) mishandles the file. The
sentinel's *purpose* — a map key that no real gear label can collide with —
is legitimate; the encoding is not, and it costs every future reviewer of this
file their diff.
**Fix:** Get collision-safety without a control character in the source. Keep
the Unknown bucket out of the label-keyed map entirely:
```ts
const buckets = new Map<string, MutableBucket>(); // named labels only
let unknownBucket: MutableBucket | null = null;
...
if (isUnknown) {
  unknownBucket ??= newBucket(UNKNOWN_GEAR_LABEL, true);
  applyRow(unknownBucket, row);
  continue;
}
```
(If the single-map shape must be kept, `' unknown'` as an escape sequence
at minimum keeps the file textual.)

### WR-06: Making `gearName` optional weakens the producer's own contract, not just the consumer's

**File:** `src/analytics/dashboard-index.types.ts:71-72`
**Issue:** `DashboardIndexRow` is the type the *writer*
(`compute-dashboard-index.ts:213, 255-257`) builds against as well as the type
the runtime re-parse is asserted as. Changing `gearName: string | null` to
`gearName?: string | null` to model "re-parsed JSON may lack the key" also
means `compute-dashboard-index` can now silently stop emitting the field with
no compile error — removing the very guarantee (D-17: gearName always present
in the published index) that `verify-dashboard-publish.mjs:234-247` exists to
protect. The comment acknowledges the producer's guarantee is real and then
discards it in the type.
**Fix:** Split the two roles, which also makes the D-12 hardening self-
documenting:
```ts
/** Producer-side row — every key required. */
export interface DashboardIndexRow { ...; gearName: string | null; }
/** Runtime re-parse of index.json — no key can be assumed present. */
export type ParsedDashboardIndexRow = Partial<DashboardIndexRow> & { id: string };
```
and type `buildGearAggregate`/`buildGearCoverage` against the parsed variant.

### WR-07: The Unknown bucket's key bypasses slug de-duplication — a gear literally named "Unknown" produces two aggregates with `key: 'unknown'`

**File:** `src/analytics/gear-aggregate-logic.ts:170-186`
**Issue:** Named buckets get collision-suffixed keys through `usedSlugs`
(lines 170-181), but the Unknown bucket is then assigned `'unknown'`
unconditionally at line 185 without consulting `usedSlugs`. `UNKNOWN_GEAR_LABEL`
is the literal string `'Unknown'` (`gear-naming.ts:21`), and
`data/config/gear.json` is hand-maintained, so a shoe named `Unknown`,
`unknown`, or `UNKNOWN` slugifies to `unknown` and collides. The published
`GearShoeAggregate[]` then carries two entries with the same `key` and the
same `label`, distinguishable only by `isUnknown` — the documented "stable
key" contract is broken and the trends table shows two identically-labelled
rows.
**Fix:** Reserve the sentinel before the named loop, or suffix the collision:
```ts
const usedSlugs = new Set<string>(['unknown']); // reserve the Unknown key
```
(with the named loop's existing `-2`, `-3` suffixing then handling the real
"Unknown" shoe).

### WR-08: The D-12 runtime-parse hardening was applied to `gearName` only — `distanceM`, `movingTimeSec` and `avgHr` are still trusted, and `undefined` avgHr poisons the weighted average with NaN

**File:** `src/analytics/gear-aggregate-logic.ts:88-97, 112-115`
**Issue:** FIX-02's whole premise (stated verbatim at lines 147-152) is that
"rows are parsed from index.json at runtime, where the required-key guarantee
does not hold". That reasoning applies identically to every other field the
same function dereferences, and the guards were not extended:
- `row.avgHr !== null` is an identity check, so `undefined` passes it →
  `hrWeightedSum += undefined * movingTimeSec` → `NaN` → `runsWithHr` is
  incremented → `finalizeBucket` returns `avgHr: NaN` → `JSON.stringify`
  writes `null`.
- `bucket.distanceM += row.distanceM` with a missing field yields `NaN`, which
  poisons the `distanceM` sort at line 189 (comparator returns `NaN`,
  ordering becomes implementation-defined) and serialises as `null`.
- The consumer then rejects the malformed shoe outright
  (`trends-gear-logic.ts:36-62` validates each field), so the shoe silently
  disappears from the trends table rather than failing loudly.

**Fix:** Use the same type-and-finiteness predicate the gearName fix
established:
```ts
const distanceM = Number.isFinite(row.distanceM) ? row.distanceM : 0;
const movingTimeSec = Number.isFinite(row.movingTimeSec) ? row.movingTimeSec : 0;
...
if (typeof row.avgHr === 'number' && Number.isFinite(row.avgHr) && movingTimeSec > 0) { ... }
```

### WR-09: `lastMediaQuery` is never reset, so the matchMedia assertion can pass on a value left by an earlier test

**File:** `src/dashboard/theme-bootstrap-parity.test.ts:50, 77-79, 179-182`
**Issue:** `lastMediaQuery` is module-scoped and only ever written by the
sandbox stub. The test at line 179 calls `runBootstrap` and then asserts
`lastMediaQuery === '(prefers-color-scheme: dark)'` — but by then ten earlier
tests in the same file have already set that exact value. If the bootstrap
were mutated to stop calling `matchMedia` in the `auto` path (e.g. hard-coding
`effective = 'dark'`), this test would still pass on the stale value. That
makes the assertion vacuous against precisely the regression it names, in a
file whose docblock claims "A source-text-only pin would still pass an
inverted branch ... this pin cannot."
**Fix:** Reset the observable at the start of every run:
```ts
function runBootstrap({ ... }): string | null {
  lastMediaQuery = null;   // never assert against a previous test's value
  ...
}
```
and additionally assert it stays `null` for the explicit `light`/`dark` paths,
which pins the "no media query when the mode is explicit" half of parity.

### WR-10: Third-party actions with write access are pinned to mutable tags

**File:** `.github/workflows/daily-refresh.yml:127` (`stefanzweifel/git-auto-commit-action@v7`), `:141` (`peaceiris/actions-gh-pages@v4`)
**Issue:** The job grants `contents: write` and `pages: write`, checks out the
repo with a usable token, and then hands control to two third-party actions
referenced by *moving* tags. Whoever controls those tags can repoint them at
arbitrary code that runs with the repo's write token on a nightly schedule —
the standard GitHub Actions supply-chain exposure, and the highest-privilege
surface this workflow has. (`actions/checkout@v4` and `actions/setup-node@v4`
are first-party and lower risk, but the same argument applies.)
**Fix:** Pin to immutable commit SHAs with the tag in a trailing comment, e.g.
```yaml
uses: stefanzweifel/git-auto-commit-action@<full-40-char-sha>  # v7.0.0
uses: peaceiris/actions-gh-pages@<full-40-char-sha>            # v4.0.0
```

## Info

### IN-01: `scanExtension`'s parameter is named `entryPath` but every call site passes `entry.name`

**File:** `scripts/lib/curation-guard.mjs:80-84, 162`
**Issue:** The parameter name invites the bug it currently avoids: called with
a full path, `lastIndexOf('.')` would find a dot in a *parent directory* name
(`/dist/widgets/v1.2/README` → ext `.2/README`) and mis-classify the file.
Correct today, one careless edit from wrong.
**Fix:** Rename the parameter to `entryName` and note in the docblock that it
must be a bare basename.

### IN-02: The unreadable-directory violation reports an unresolved path while every other violation reports an absolute one

**File:** `scripts/lib/curation-guard.mjs:95-98` vs `:103`
**Issue:** Nested entries are reported as `resolve(dir, entry.name)`; the
top-level `walk(publishDir)` failure reports `publishDir` verbatim, so calling
`findCurationArtifacts('dist/widgets')` on an unreadable root yields a
relative path in an otherwise absolute set. Cosmetic, but the fixture test
matches on `v.path === target` and would need to know which form to expect.
**Fix:** `path: resolve(dir)` in the catch block.

### IN-03: The inline theme bootstrap's `window.matchMedia` call sits outside the try/catch, and the parity test always stubs it

**File:** `src/dashboard/index.html:47-52`, `src/dashboard/theme-bootstrap-parity.test.ts:76-80`
**Issue:** Only the `localStorage` read is guarded. If `window.matchMedia` is
absent or throws, the IIFE dies before
`document.documentElement.setAttribute('data-theme', ...)` and the page paints
with no theme attribute at all — the exact pre-paint failure the bootstrap
exists to prevent. The test harness always installs a working `matchMedia`, so
no test can observe this path.
**Fix:** Extend the guard and add a `matchMedia: undefined` case to
`runBootstrap`:
```js
var effective = mode;
if (mode === 'auto') {
  var prefersDark = false;
  try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  effective = prefersDark ? 'dark' : 'light';
}
```

### IN-04: Redundant workflow configuration — `INTERVALS_ATHLETE_ID: '0'` and a double TypeScript build

**File:** `.github/workflows/daily-refresh.yml:82, 76-89`
**Issue:** `INTERVALS_ATHLETE_ID: '0'` restates the code default
(`src/index.ts:355, 398` both use `process.env.INTERVALS_ATHLETE_ID || '0'`),
so the magic literal now lives in two places. Separately, `npm run fetch`
expands to `npm run build && node dist/index.js sync-intervals`
(`package.json`), so the explicit `Compile TypeScript` step recompiles what
the fetch step already compiled — and, because `fetch` is
`continue-on-error: true`, a compile error there is swallowed and only
surfaces at the next step.
**Fix:** Drop the `INTERVALS_ATHLETE_ID` env line (or promote it to a repo
variable if it will ever be non-zero), and either drop the separate compile
step or change `fetch` to skip its embedded build in CI.

### IN-05: The shard-sampling rule is implemented twice, so the test cannot catch a change to the sampler

**File:** `scripts/verify-dashboard-publish.mjs:570-583` and `scripts/verify-dashboard-publish-stats.test.mjs:154-166`
**Issue:** The test re-implements `filter(streams.available) → first/middle/
last → Set` rather than importing it. If the production sampler is changed
(different filter, different sample positions), the test keeps computing the
old ids and keeps passing — it is pinned to a copy, not to the thing. The file
even comments "derived AT RUNTIME the same way", which is the drift risk
stated as a feature.
**Fix:** Export the sampler from a shared module
(`scripts/lib/shard-sample.mjs`) and have both the script and the test import
it.

### IN-06: Scope note — `scripts/first-paint-capture.mjs` was changed in this phase but excluded from this round; its Round 1 findings are unfixed

**File:** `scripts/first-paint-capture.mjs` (594 lines, added by `5a19967b`)
**Issue:** The file has exactly one commit and no follow-up, so the Round 1
review's `CR-01` (unhandled rejection in the `Page.screencastFrame` handler
skipping all cleanup — Chrome process and temp dir leak), `WR-01`
(`CdpClient.send` with no timeout and no socket `error`/`close` listener) and
`WR-02` (Chrome spawn without an `error` listener) all remain open. Dropping
the file from this round's `files` list means those findings would silently
vanish from the phase artefact if this REVIEW.md is read as the current state.
**Fix:** Either re-include the file in the next review round's scope or carry
`CR-01`/`WR-01`/`WR-02` forward explicitly into the fix backlog.

---

_Reviewed: 2026-09-04T21:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
