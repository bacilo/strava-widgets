---
phase: 25-ci-hardening-light-theme-verification
fixed_at: 2026-09-04T22:08:00Z
review_path: .planning/phases/25-ci-hardening-light-theme-verification/25-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-09-04T22:08:00Z
**Source review:** `.planning/phases/25-ci-hardening-light-theme-verification/25-REVIEW.md`
**Iteration:** 1
**Fix scope:** `critical_warning` (CR-01 + WR-01..WR-10; the six Info findings are out of scope)

**Summary:**
- Findings in scope: 11
- Fixed: 11
- Skipped: 0
- Out of scope (Info, not attempted): 6

## Verification actually run

Everything below was executed, not asserted.

| Check | Baseline (before fixes) | After fixes |
|---|---|---|
| `npx vitest run` | 63 files / **1604 tests passed**, exit 0 | 63 files / **1617 tests passed**, exit 0 |
| `npx tsc --noEmit` | clean | clean |
| `node scripts/verify-dashboard-publish.mjs` | 56 checks / 0 failures, exit 0 | 56 checks / 0 failures, exit 0 |

The 13 new tests are the regression coverage added alongside the fixes
(CR-01 x1, WR-02 x3, WR-07 x2, WR-08 x2, WR-09 x5). **Every one of them was
run against the pre-fix code and observed to fail**, so none of them is a
test that would have passed anyway.

Work was done in an isolated git worktree on a temporary branch, then
fast-forwarded onto `master`.

**Baseline caveat, stated because it affects how to read the table:** the
worktree starts without the gitignored `data/stats/`, `data/dashboard/` and
`dist/` trees, and 6 test files read them. Those directories were symlinked
in from the main checkout read-only before the baseline was taken, which is
why the baseline is green rather than 6-files-failing. No test mutated them
(`verify-dashboard-publish-stats.test.mjs`'s own "never mutates the real
dist/widgets tree" assertion passed throughout).

## Fixed Issues

### CR-01: Best-efforts shard assertion encodes an invariant live data already violates

**Files modified:** `scripts/verify-dashboard-publish.mjs`, `scripts/verify-dashboard-publish-stats.test.mjs`
**Commit:** `80421fc1`
**Status:** fixed

Confirmed the reviewer's claim against the committed archive before touching
anything: 1861 shards on disk, 1861 index rows with `streams.available ===
true`, **1 shard with `efforts: []`** (`11865310195`), 0 stream-available
rows missing a shard. So the emptiness half of the invariant is already false
today; the today-sample happens to miss it, making the failure latent rather
than immediate.

Applied fix:
- Assert **shape, not census**: `Array.isArray(parsedShard.efforts)` replaces
  `efforts.length > 0`, with the reason (activity under the 400 m shortest
  target, or every candidate rejected by the plausibility filter) recorded in
  the comment.
- Changed the **sample population** from `indexDoc.activities.filter(streams.
  available)` to `best-efforts.json`'s own `activities` keys. This is a
  departure from the literal snippet in the review, chosen because it is
  strictly stronger: only the aggregate's key set is a producer guarantee
  (shards and that map are written from the same `activities[id]` map),
  whereas `streams.available` mirrors the *manifest*. An activity whose
  stream `compute-best-efforts` tolerated as unreadable (T-15-02,
  `skippedUnreadable`) has no shard **and** no aggregate entry, so it is
  simply never sampled — the 404-on-tolerated-defect deploy block the review
  describes cannot occur. Set equality of the two populations was verified
  (1861 = 1861, symmetric difference 0).
- The truncated-copy detection the check exists for is **preserved**: a shard
  the producer did write but the directory copy dropped is still listed in
  the aggregate and still 404s. The existing `omitShardId` test case still
  passes for exactly that reason.
- The test's sampler mirror was updated to the same rule (it re-implements
  rather than imports it — that duplication is IN-05, left open).

New test `LEGITIMATE — a sampled shard with an empty "efforts" array passes
the gate` fails against the old `length > 0` assertion and passes against the
new one.

### WR-01: Tolerated compute steps whose outputs a blocking gate hard-requires

**Files modified:** `src/compute-all-stats-steps.ts`, `src/compute-all-stats-steps.test.ts`, `.github/workflows/daily-refresh.yml`
**Commit:** `0b4cc604`
**Status:** fixed: requires human verification

Took the first of the two options the review offers (promote to `mandatory:
true`) rather than the second (make verify assertions conditional), because
the second would *change* what ships — publishing a site with a missing data
document — while the first is outcome-neutral.

Established before changing anything that it really is outcome-neutral:
- `mandatory` only has an effect under `--ci`; without it every step already
  rethrows and halts the walk (`continueOnError: false`, D-02).
- Under `--ci` the run already ended in a red verify gate and no deploy, and
  because `Commit updated data` and `Deploy widgets` both sit after the gate
  with no `if: always()`, the freshly fetched activities were not persisted
  either. Tolerance only moved *where* the failure was reported.

Promoted: `compute-best-efforts`, `compute-age-grading`,
`compute-dashboard-index`, `compute-gear-aggregate`, `compute-training-load`.
That is five, not the three the review names — `training-load.json` and
`age-grading.json` are also hard-required by `expect200` in the verifier, and
the point of the finding is consistency. `compute-age-grading` writes its
document even on the CI-expected disabled path, so promoting it does not make
CI's `enabled: false` a failure.

`compute-geo-stats` stays tolerated and is now the only tolerated step: it
writes committed `data/geo/`, so a failure leaves real data in place and the
site still publishes. That is a genuine degrade path.

Verified end to end against a compiled build in a throwaway cwd:
- With `compute-dashboard-index` forced to fail, `compute-all-stats --ci`
  now exits 1 at that step and steps 7-8 do not run (previously it warned and
  continued to a 404 in the gate).
- With `compute-geo-stats` forced to fail, the run still completes, warns,
  and exits 0.

**Why human verification:** this reverses the posture D-03 declared for five
steps. The reasoning and the outcome-neutrality argument are above and in the
code comments, but the decision itself is a judgement call about the phase's
own design, and the true confirmation is a real nightly run.

### WR-02: CI-02 assertions abort the whole gate on the first malformed body

**Files modified:** `scripts/verify-dashboard-publish.mjs`, `scripts/verify-dashboard-publish-stats.test.mjs`
**Commit:** `64283b19`
**Status:** fixed

Added `parseJsonOrFail(path, body)` and `entryZeroOrFail(path, parsed)`, both
of which `fail()` and return `null`, and routed all six CI-02 documents
through them. Three new MALFORMED cases (truncated body, literal `null`,
`[null]`) assert the failure is named, the `N check(s) passed` summary still
prints, checks after the broken document still run, and no
`SyntaxError`/`TypeError` reaches the output. All three fail against the
unguarded version.

Scoped to the six documents the finding names. The same unguarded
`JSON.parse` pattern exists earlier in the file (gear, athlete, training-load,
age-grading, wma) and was left alone as out of scope.

### WR-03: "All statistics generated successfully!" on a degraded run

**Files modified:** `src/index.ts`
**Commit:** `0e62b8aa`
**Status:** fixed

Applied the review's fix verbatim. Confirmed in a real run: with one tolerated
step forced to fail, the output now reads `Statistics generated with 1
degraded step(s).` followed by the DEGRADED STEPS block, instead of an
unqualified success claim that the next lines contradict.

### WR-04: `process.exit(0)` can truncate the summary on a piped stdout

**Files modified:** `src/index.ts`
**Commit:** `7d76b1d9`
**Status:** fixed

Replaced `process.exit(0/1)` with `process.exitCode = 0/1; return;` in the
nine compute-* commands (the ten sites the finding lists, minus the two sync
commands — see below).

**Deviation, deliberate:** `syncCommand` and `syncIntervalsCommand` keep
their hard exit, with a comment saying why. They hold HTTP keep-alive sockets
and rate-limiter timers, so returning risks the process lingering; the
nightly runs `sync-intervals` under `continue-on-error: true`, where a hang
would burn the job's 30-minute timeout. A hang is a worse failure than a
truncated three-line summary, and unlike the compute path I cannot exercise
the network path here to prove otherwise. The compute chain is pure
filesystem work with nothing to hold the event loop open, which is what makes
the change safe there.

Verified against a compiled build: `compute-all-stats --ci` with a degraded
step exits 0 in 2.5s with the **complete** DEGRADED STEPS block present on a
redirected (piped) stdout; the error path exits 1 promptly with no hang;
`compute-stats` success and ENOENT paths both terminate in under 0.3s with
the correct code and the final line intact.

### WR-05: Raw NUL byte makes `gear-aggregate-logic.ts` binary to git

**Files modified:** `src/analytics/gear-aggregate-logic.ts`
**Commit:** `ea51679b`
**Status:** fixed

Took the reviewer's preferred shape rather than the `' unknown'`
re-escape fallback: the Unknown bucket is no longer in the label-keyed map at
all, it is held in its own `unknownBucket` variable. Collision-safety then
falls out of the structure instead of a control character, and `namedBuckets`
no longer needs to filter the sentinel back out.

Verified:
- `file src/analytics/gear-aggregate-logic.ts` now reports `Java source,
  Unicode text, UTF-8 text` (was `data`), and `git show HEAD:<file> | file -`
  confirms the committed blob is text.
- Runtime value unchanged: recomputing `gear-aggregate.json` from the
  committed index produces output identical to the committed document
  (17 shoes, same keys, same totals, `shoes identical: true`).
- The 19 pre-existing `gear-aggregate-logic` tests pass.

The WR-05 commit itself still shows as `Bin 8701 -> 9130 bytes` in
`git log --stat`, because the *old* side of that diff is the binary blob.
Diffs from this commit forward are textual.

### WR-06: Optional `gearName` weakens the producer's contract

**Files modified:** `src/analytics/dashboard-index.types.ts`, `src/analytics/gear-aggregate-logic.ts`, `src/analytics/gear-aggregate-logic.test.ts`, `src/analytics/compute-gear-aggregate.ts`
**Commit:** `d64a6add`
**Status:** fixed

Applied the review's split:
- `DashboardIndexRow.gearName` is required again (producer side).
- `ParsedDashboardIndexRow = Partial<DashboardIndexRow> & { id: string }`,
  plus `ParsedDashboardIndexDocument`, for the runtime re-parse.
- `buildGearAggregate` / `buildGearCoverage` / `applyRow` typed against the
  parsed variant; `compute-gear-aggregate` reads the parsed document type
  (`readJson` is an unchecked assertion over `JSON.parse` output).

The compiler then flagged `localDayKey`/`localYear`, whose parameters claimed
`string` while their bodies already guarded for a non-string — signatures
widened to match the guard that was always there. `makeRowWithoutGearName` in
the tests no longer needs its `as DashboardIndexRow` cast.

Verified the restored contract actually bites: dropping `gearName` from the
row `compute-dashboard-index` builds now fails `tsc` with `Property
'gearName' is missing ... but required in type 'DashboardIndexRow'`.

Note the SPA (`index-client.ts` and the list/trends/calendar consumers) still
uses `DashboardIndexRow` for its own re-parse. Migrating those to the parsed
type would cascade through the whole dashboard and is well outside this
finding's scope; the review's fix scopes the retype to the two gear
functions, which is what was done.

### WR-07: Unknown bucket key bypasses slug de-duplication

**Files modified:** `src/analytics/gear-aggregate-logic.ts`, `src/analytics/gear-aggregate-logic.test.ts`
**Commit:** `7a074bed`
**Status:** fixed

Seeded `usedSlugs` with `'unknown'` so a real shoe named `Unknown` falls
through to the existing `-2`/`-3` suffixing. Two new tests (a single
`Unknown` shoe alongside ungeared rows; all three case variants at once)
assert key uniqueness across the published array and that the two buckets
stay separate. Both fail against the unseeded set.

### WR-08: D-12 hardening applied to `gearName` only

**Files modified:** `src/analytics/gear-aggregate-logic.ts`, `src/analytics/gear-aggregate-logic.test.ts`
**Commit:** `21d04382`
**Status:** fixed

Applied the same type-and-finiteness predicate to `distanceM`,
`movingTimeSec` and `avgHr`, coercing to 0 so the run still counts and the
bucket stays well-formed. Written as `typeof x === 'number' &&
Number.isFinite(x)` rather than bare `Number.isFinite(x)` so it also narrows
for the WR-06 parsed type.

Two new tests: an absent-keys case asserts finite outputs and that an
`undefined` avgHr is not counted as an HR sample; a NaN-distance case asserts
the descending `distanceM` ordering stays correct. Both fail against the
unguarded version (confirming the NaN-poisoned comparator really does
misorder).

### WR-09: `lastMediaQuery` never reset

**Files modified:** `src/dashboard/theme-bootstrap-parity.test.ts`
**Commit:** `db9d7d04`
**Status:** fixed

Reset added at the top of `runBootstrap` as suggested, plus the additional
explicit-mode assertions the finding recommends.

**Correction to the finding, verified rather than assumed:** a bootstrap
mutated to stop calling `matchMedia` *entirely* does already fail the old
assertion, because then nothing in the file ever sets the value and it stays
`null`. The defect is narrower than stated but still real — the assertion
depended on cross-test state, so it was order-sensitive and could not
distinguish "this run queried the preference" from "some earlier run did".

The coverage that was genuinely missing is the other half of parity:
`theme.ts` consults the system preference **only** for `auto`. Added four
explicit-mode cases asserting `matchMedia` is not consulted at all, plus an
auto-then-explicit case proving the reset does work.

Discrimination measured against a bootstrap mutated to read `matchMedia`
unconditionally (observably identical behaviour, since the value is only used
in the auto branch): the previous file passes **17/17**; this one fails
**5**.

### WR-10: Third-party actions with write access pinned to mutable tags

**Files modified:** `.github/workflows/daily-refresh.yml`
**Commit:** `df3adce7`
**Status:** fixed: requires human verification

Pinned both write-privileged actions to 40-char commit SHAs, resolved from
the GitHub API rather than invented:

- `stefanzweifel/git-auto-commit-action@v7` -> `4a55954c782fc1ea30b9056cd3e7a2b40ca8887d` (v7.2.0)
- `peaceiris/actions-gh-pages@v4` -> `84c30a85c19949d7eee79c4ff27748b70285e453` (v4.1.0)

`peaceiris`'s `v4` is an annotated tag (`refs/tags/v4` -> tag object
`329bcc8f...`); the pin is the commit that dereferences to, which is what
Actions resolves. Both SHAs are exactly what the moving tags point at today,
so nothing about what runs changes — the pin only removes the ability for it
to change without a commit here.

`actions/checkout` and `actions/setup-node` were left on tags (first-party,
lower risk), noted in the comment as carrying the same argument.

The workflow YAML re-parses correctly (13 steps, both `uses:` values as
intended). **Why human verification:** a workflow change cannot be executed
locally; only a real Actions run proves the pinned refs resolve.

## Out of Scope (not attempted)

The `critical_warning` scope excludes Info findings. These remain open:

- **IN-01** — `scanExtension`'s parameter named `entryPath` but always passed `entry.name`.
- **IN-02** — unreadable-directory violation reports an unresolved path.
- **IN-03** — inline bootstrap's `window.matchMedia` call sits outside the try/catch.
- **IN-04** — redundant `INTERVALS_ATHLETE_ID: '0'` and double TypeScript build.
- **IN-05** — shard-sampling rule implemented twice (script + test). Note this
  one was *touched* by the CR-01 fix: the test's copy was updated to match the
  new rule, so it is correct today, but the duplication — and therefore the
  drift risk IN-05 names — still stands.
- **IN-06** — scope note: `scripts/first-paint-capture.mjs` was excluded from
  this review round and its Round 1 `CR-01`/`WR-01`/`WR-02` remain open and
  unfixed. **This is a carry-forward, not an Info nit** — Round 1's CR-01
  there is an unhandled rejection leaking a Chrome process and temp dir.
  Nothing in this fix pass addresses it.

---

_Fixed: 2026-09-04T22:08:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
