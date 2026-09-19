# Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation - Research

**Researched:** 2026-09-19
**Domain:** Compute-layer/test-layer hardening + documentation reconciliation in an existing TypeScript+vitest codebase. No new library, no new runtime surface.
**Confidence:** HIGH — every claim below is grounded in a direct source read (file:line) or a command run in this session against the live repo/archive; no Context7/WebSearch was needed because this phase touches only this project's own code and conventions.

## Summary

This phase has no new technology to research — it is six surgical fixes to code and docs that
already exist, each already scoped precisely by `31-CONTEXT.md`'s D-01..D-14. The job of this
research is therefore not "what library to use" but "where exactly do these fixes land, what do
they touch, and what will break if the planner gets a name or a line wrong." Every code site named
in the task brief was read directly in this session; several details in the brief and in
`31-CONTEXT.md` itself are close-but-not-exact (a function name, a distances-null nuance, a
call-site count) and are corrected below with file:line evidence so the planner does not propagate
them.

**Primary recommendation:** Six independent-ish plans/waves, one per TD-ID, each landing a source
fix + its negative/demonstrated-failing test in the same task, ending in one docs-reconciliation
wave (TD-05/TD-06) that runs last because it regenerates artifacts TD-01..TD-04's own fixes will
have altered (TD-04's reason-string change flows into `28-DIFF.md`'s content, which is why TD-04
must land before the final regeneration-and-resign in TD-05).

Two corrections to the task brief, load-bearing for planning:

1. **TD-01's "3475711469 400m-only" is a mischaracterization of the real file.** `data/best-effort-exclusions.json`'s entry for `3475711469` has `"distances": null` — i.e. it is an **all-distance** exclusion in the real file, identical in shape to `4556693525`'s entry. It only *behaves* as 400m-only in the CR-01 tests because those tests never construct a 1k stream for `3475711469` (`buildPinnedArchive`'s bulk1k path exists only for `4556693525`). The fixture D-01 asks the planner to create should therefore copy the real entries **verbatim** (both `distances: null`), not manufacture a `distances: ['400m']` entry for `3475711469` that does not match the real file it's supposedly a copy of.
2. **The queue's exclusion-map builder is named `buildExclusionsMap`, not `buildExclusionReasonMap`** (`scripts/curate-queue/derive-flagged.mjs:52`). `buildExclusionReasonMap` does not exist anywhere in the repo. D-09/TD-03c's plan should extend `buildExclusionsMap`.

One factual update since the audit: the no-device-name cohort on the now-merged 1,899-activity
archive is **still 663** (unchanged from the 1,890-activity audit measurement — the 9 merged
activities added no no-device-name rows), so D-13's ERA-02/Criterion-5 correction is **663 of
1,899 (34.9%)**, not 663 of 1,890 as `27-VALIDATION.md` currently says. Measured live in this
session: `node -e` over `data/dashboard/index.json` → `{'intervals-icu':87,'no-device-name':663,'garmin-fenix-6-pro':908,'strava-app-gpx':35,'suunto-9':205,'garmin-vivoactive-4':1}`, total 1899.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TD-01 fixture decoupling | Test layer (`src/analytics/*.test.ts`) | — | Pure test-fixture engineering; no production code path changes |
| TD-02 copy-data-tree digest compare | Build tooling (`scripts/lib/*.mjs`) | — | Node build script, runs in CI and locally, no browser/runtime surface |
| TD-03a `other` bucket | Frontend/dashboard view logic (`src/dashboard/views/*.ts`) | — | Pure, DOM-free sentence-builder consumed by the Records screen; no DOM change needed since `records.ts` already renders whatever `describeDemotionCounts` returns |
| TD-03b recount fail-closed | CI verifier script (`scripts/*.mjs`) | — | Gates nothing by itself today (advisory script) but is the pattern `main()`'s `process.exitCode = 1` already uses for other malformed-data classes |
| TD-03c queue degrade-visibly | Curate browser client (`scripts/curate-queue/*.mjs` + `index.ts`) | Local-only dev tool (`npm run curate`), never published | Runs only in `npm run curate`'s local Express server; publish guards already keep it out of `dist/widgets` |
| TD-04 margin in reason string | Analytics/compute layer (`src/analytics/best-effort-ceiling.ts`) | Dashboard display (reads the string verbatim, no reformatting) | Single string-template change; every consumer (Records note, detail badge, queue prefill) reads the string as-is |
| TD-05 generator fixes + regeneration | Build/reporting scripts (`scripts/compute-*.mjs`) | Docs artifacts (`.planning/phases/*/*.md`) | Generators live in `scripts/`; their output is committed prose under `.planning/`, never `data/` |
| TD-06 validation record | Process/docs (`*-VALIDATION.md` frontmatter) | — | No code; a frontmatter flip gated on TD-05's G-02 fix landing |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TD-01 | `npm test` no longer depends on the live, owner-editable exclusions file for the four CR-01 regression tests | Exact 4 test names/line ranges identified; `computeBestEfforts`'s `exclusionsPath` option confirmed to accept an arbitrary absolute path via `FileStore.readJson`'s `path.resolve` (absolute wins); existing premise-check test at line ~944 identified as the one to keep and strengthen |
| TD-02 | `copyJsonTree`'s mtime skip replaced by size-then-digest, with a staleness log line | Full 60-line source read; both call sites found (`build-widgets.mjs:233` AND `curate-server.mjs:691`, not just the one named in the brief); no existing test file — Wave 0 gap |
| TD-03 | Silent folds become honest degrade / fail-closed, per role, each with a negative test | All three sites read in full; exact test-literal blast radius counted (14 lines) for TD-03a; exact function names corrected for TD-03c |
| TD-04 | Ceiling demotion reason always states the margin at 3 decimals | Exact reason-template site found; every string/regex assertion that touches this format enumerated across 3 files |
| TD-05 | All artifacts of record match code + merged archive; generators fixed; hand-edits corrected in place | All 5 `OUTPUT_PATH` targets confirmed under `.planning/`, never `data/`; the `**Generated:**` timestamp-line pitfall for "byte-identical" documented; exact REQUIREMENTS.md/ROADMAP.md line numbers found; live re-measurement of the ERA-02 cohort done |
| TD-06 | No v2.2 phase carries a pre-execution validation record | `27-VALIDATION.md` frontmatter confirmed `status: partial`, gated explicitly on G-02 by its own prose |

## Standard Stack

No new runtime dependency of any kind. Every mechanism below already exists in the project.

### Core
| Tool | Version | Purpose | Why Standard (already in use) |
|------|---------|---------|-------------------------------|
| Node.js `crypto.createHash` | built-in (Node 22/25) | TD-02's content digest | Already used identically for stream-integrity checks in `scripts/compute-elevation-calibration.mjs:34,278,286` and `scripts/verify-dashboard-publish-guard.test.mjs:25` — no new import pattern |
| Node.js `fs.statSync`/`readdirSync` | built-in | TD-02's size-first check | Already imported in `copy-data-tree.mjs:10` |
| vitest 4.0.18 | pinned (`package.json`) | All new/extended unit tests | Existing framework, `fileParallelism: false` (deliberate, see Pitfalls) |
| TypeScript 5.9.3 | pinned | `tsc --noEmit` gate | Existing gate, unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SHA-1 for TD-02's digest | SHA-256, or a non-cryptographic hash (xxhash/CRC32) | SHA-1 is already measured in `31-CONTEXT.md` D-04 (≈1.4s/186MB) and is adequate for a staleness comparison, not a security boundary — collision resistance is irrelevant here. A non-cryptographic hash would need a new npm dependency (`xxhash-wasm`, etc.) that STACK.md's "no new runtime dependencies" convention (see `REQUIREMENTS.md` Out of Scope table) would reject for a build-tooling nicety. **Recommendation: `crypto.createHash('sha1')`, built-in, zero new dependency, already the number D-04's measurement is based on.** |

**Installation:** none — zero new packages for this phase.

**Version verification:** N/A — no new packages. Existing pins reconfirmed live: `node --version` → v25.2.1 (session), vitest `^4.0.18` / typescript `^5.9.3` in `package.json` devDependencies (unchanged since Phase 30).

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages (`31-CONTEXT.md` phase boundary: "No new capability... no threshold retune"; every fix listed above uses only Node built-ins and existing project modules). The Package Legitimacy Gate is skipped per its own governing condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram — how the six fixes relate

```
                         TD-01                     TD-02
   compute-best-efforts.test.ts        build-widgets.mjs ──┐
   (4 tests) ── reads ──► data/best-  scripts/lib/           │
                effort-exclusions.json copy-data-tree.mjs ◄──┘ curate-server.mjs
                       │                    (mtime skip →         (Recompute
              [D-01: copy 2 entries        size+digest)            records step)
               into committed fixture;
               keep 1 premise-only test]

                         TD-03a                  TD-03b                    TD-03c
   best-efforts.json ──► records-logic.ts   best-efforts.json +      best-efforts.json +
   (demotion.guard)      countDemotedAtDistance /  exclusions.json ──►  exclusions.json ──►
                         describeDemotionCounts     compute-pr-ceiling-   derive-flagged.mjs
                         [add `other` bucket]       recount.mjs           (buildExclusionsMap)
                                                    [fail-closed on        ──► curate-queue/
                                                     malformed exclusions] index.ts header
                                                                            [skipped-count line]

                         TD-04
   best-effort-ceiling.ts:ceilingDemotion()
   [reason template: add "by {margin} m/s", 2dp→3dp]
        │
        ├──► data/stats/best-efforts.json (gitignored, per-effort .demotion.reason)
        ├──► records-logic.ts / detail-best-efforts-logic.ts (renders the string verbatim)
        └──► scripts/compute-pr-ceiling-diff.mjs → 28-DIFF.md (embeds reason text in diff rows)

                         TD-05 (runs LAST — depends on TD-04's format landing first)
   5 generator scripts ──► regenerate twice each ──► 5 committed .planning/*.md artifacts
   (compute-pace-residual, compute-pace-quality-calibration [no code change, archive-only],
    compute-pr-ceiling-calibration, compute-pr-ceiling-diff, compute-elevation-calibration)
                                                              │
                                                    28-DIFF.md's new sha256 ──► TD-05's PR-04
                                                                                  re-sign
                         TD-06
   27-VALIDATION.md frontmatter: status: partial ──[gated on D-13's G-02 doc fix landing]──► passed
```

### Recommended Task/Wave Structure (discretion item: plan/wave breakdown)

The six TD-IDs have almost no code-level interdependency (different files, different modules)
except one hard ordering constraint: **TD-04 must land before TD-05's final regeneration pass**,
because TD-04 changes the demotion `reason` string that `compute-pr-ceiling-diff.mjs` embeds
verbatim into `28-DIFF.md`, which is the artifact TD-05's PR-04 re-sign is bound to. Regenerating
`28-DIFF.md` before TD-04 lands would produce a diff that still needs a second regeneration (and a
second sign-off) once TD-04 ships — wasted human-review cycles. Recommended wave order:

1. **Wave 1 (parallel-safe):** TD-01, TD-02, TD-03a, TD-03b, TD-03c, TD-04 — six independent
   source+test tasks, no file overlap between them (verified: TD-01 touches only
   `compute-best-efforts.test.ts` + a new fixture file; TD-02 touches only
   `scripts/lib/copy-data-tree.mjs` + a new test file; TD-03a touches only `records-logic.ts` +
   its test; TD-03b touches only `compute-pr-ceiling-recount.mjs` + its test; TD-03c touches only
   `derive-flagged.mjs` + `curate-queue/index.ts` + their tests; TD-04 touches only
   `best-effort-ceiling.ts` + 2 test files).
2. **Wave 2 (blocked on Wave 1, specifically TD-04):** TD-05 — fix the three generator defects
   (26 G-03, 28 WR-07, 28 WR-08), regenerate all five artifacts twice each, verify byte-identity
   modulo the `**Generated:**` line, commit, obtain the one fresh PR-04 sign-off, hand-correct the
   remaining stale prose (REQUIREMENTS.md/ROADMAP.md/the audit file).
3. **Wave 3 (blocked on Wave 2, trivial):** TD-06 — flip `27-VALIDATION.md` frontmatter
   `status: partial` → `passed` in the same plan/commit that lands D-13's ERA-02 correction (the
   two are the same fix from two angles: the doc correction closes G-02; TD-06 is "and now update
   the status field that was waiting on it").

This is Claude's Discretion territory per `31-CONTEXT.md` ("Plan/wave breakdown; whether the docs
pass is one plan or split by artifact") — the above is a recommendation, not a lock.

### Pattern 1: The `{ ok: false, reason }` / `problems: string[]` fail-closed shape (TD-03b)

**What:** `compute-pr-ceiling-recount.mjs` already has a two-tier error-reporting convention:
`readShippedJson` returns `{ ok: false, reason }` for I/O-level failures, and `evaluateReport`
accumulates a flat `problems: string[]` array for data-level failures (unrecognised guards, ranked-
but-demoted efforts, a missing pinned fixture, etc.), then `main()` prints each problem and sets
`process.exitCode = 1` when `problems.length > 0`.

**When to use:** TD-03b's malformed-exclusions check is the same class of data-level failure and
should extend the same `problems` array, not invent a third error channel.

**Example (existing code, the pattern to extend):**
```javascript
// Source: scripts/compute-pr-ceiling-recount.mjs:476-591 (evaluateReport)
export function evaluateReport(report, expectedDemoted, expectedCohort, expectedFlaggedActivities) {
  const problems = [];
  // ... existing checks push onto `problems` ...
  if (demoted.byGuard.unrecognisedGuards.length > 0) {
    problems.push(
      `${demoted.byGuard.unrecognisedGuards.length} unrecognised guard value(s) found: ${demoted.byGuard.unrecognisedGuards.join(', ')}`
    );
  }
  // TD-03b lands a sibling check here, sourced from a new
  // `flaggedActivities.malformedExclusions: string[]` field that
  // `recountDemotedActivities` (line 250) populates while it walks
  // `exclusionsDoc.exclusions`, naming each offending entry (its index or
  // its raw activityId, whichever is safely stringifiable) and the
  // specific defect (duplicate id / non-string or empty reason / __proto__
  // key / non-string id).
  return { pass: problems.length === 0, problems };
}
```

**Current gap this pattern must close:** `recountDemotedActivities` (`scripts/compute-pr-ceiling-recount.mjs:250-273`) today *silently* `continue`s on a non-string `activityId` and never checks `reason` shape, duplicate ids, or the `__proto__` key at all — it only guards `entry.activityId` type. D-08 requires all four malformation classes to surface as named problems.

### Pattern 2: Size-then-digest replaces mtime (TD-02)

**What:** Replace `copy-data-tree.mjs:41-49`'s `destMtime >= srcMtime` check with: compare
`statSync(srcPath).size` vs `statSync(destPath).size`; if they differ, copy; if they match, compare
a digest (SHA-1) of both files' contents; copy only if the digests differ. Log
`replaced stale ${destPath}` (per D-05, using the **destination** path so the message names what
was overwritten) whenever a same-size-different-digest replacement happens.

**When to use:** Exactly the `copyJsonTree` recursion step, `copy-data-tree.mjs:37-55`.

**Example (target shape, following the digest style already used in `compute-elevation-calibration.mjs`):**
```javascript
// Source: scripts/compute-elevation-calibration.mjs:278,286 (existing digest style to mirror)
import { createHash } from 'node:crypto';
// ...
const perFileDigest = createHash('sha1').update(readFileSync(srcPath)).digest('hex');
```
Both call sites (`build-widgets.mjs:233` and `curate-server.mjs:691`) get the new behavior for
free since the change lives inside `copyJsonTree` itself — neither caller needs to change.

**A size-only short-circuit is safe and recommended** (Claude's Discretion, D-04's own text: "whether to short-circuit on identical size + mtime before hashing as a pure optimisation, provided a same-size different-content file is still always replaced"): if `srcMtime <= destMtime` AND sizes match, it is still possible content differs (a doctored file could be touched to an old mtime deliberately, which is exactly the D-06 attack the fix defends against) — so **do not** let mtime skip the digest step; only use mtime, if at all, as a tie-breaker for logging clarity, never as a skip condition.

### Pattern 3: Named-condition-plus-measured-value copy register (TD-03a/TD-03c/TD-04)

**What:** This project's established house register (cited explicitly in `records-logic.ts:216`'s
docblock and Phase 27 D-09): every user-facing string states a named condition plus its measured
number, never an adjective (no "suspicious", "a few", "some"). `describeDemotionCounts`'s existing
three parts (`"8 by the personal ceiling"`, `"17 by the world-record pace guard"`, `"10 by the
activity max-speed guard"`) are the pattern to extend with a fourth: `"1 by another guard"` (D-07's
exact wording), appended in the fixed order **after** the three named guards.

**When to use:** TD-03a's `other` bucket, TD-03c's "N exclusion entries ignored (malformed)" line.

### Anti-Patterns to Avoid
- **Silently normalizing distances-null vs distances-array in the TD-01 fixture:** copying the real
  file's semantics inexactly (e.g., writing `distances: ['400m']` for `3475711469` because the
  brief called it "400m-only") would make the fixture a *different* document from the one it
  claims to mirror. Copy both real entries verbatim (`distances: null` for both).
- **Making `DemotionCounts.other` optional** to avoid touching the 14 test-literal call sites: this
  would let `describeDemotionCounts` silently treat `undefined` as `0`, defeating the whole point
  of D-07 (an unrecognized guard would again be invisible if a future test literal simply omits
  the field and TypeScript never complains). Make `other: number` **required** and touch all 14
  sites in the same task — they are all one-line changes (see Common Pitfalls below for the exact
  list).
- **Importing the classifier into `compute-pr-ceiling-recount.mjs` to validate exclusions "the easy
  way":** D-08 explicitly reaffirms D-15 of Phase 28 (zero imports of the ceiling/compute/utils/
  types modules). The malformed-exclusion validation is pure JSON-shape checking and needs no
  import at all.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Content-equality check for TD-02 | A custom byte-by-byte comparator | `crypto.createHash('sha1')` (built-in) | Already the exact mechanism `compute-elevation-calibration.mjs` uses for stream-integrity digests; zero new dependency; already measured at ~1.4s/186MB in `31-CONTEXT.md` D-04 |
| Malformed-JSON-entry detection for TD-03b/TD-03c | A schema-validation library (zod/ajv) | Hand-rolled type guards matching the existing `buildExclusionsMap`/`recountDemoted` style (`typeof x === 'string'`, `Array.isArray`, explicit `__proto__` check) | This project's own `REQUIREMENTS.md` Out-of-Scope table explicitly rejected new runtime dependencies for exactly this class of problem ("every algorithm needed is a 15-40 line pure function, matching what this project already hand-rolls"); the existing exclusion-parsing functions are already 10-20 lines of exactly this shape |

**Key insight:** every "problem" this phase solves already has a sibling solved the same way
elsewhere in this codebase (digest checks, fail-closed verifiers, degrade-and-count patterns,
named-condition-plus-value copy). The research task was locating those siblings, not inventing new
mechanisms.

## Common Pitfalls

### Pitfall 1: `DemotionCounts.other` as a required field breaks 14 existing test literals
**What goes wrong:** Adding `other: number` to the `DemotionCounts` interface (TD-03a) without
updating every existing object literal shaped `{ total, ceiling, worldRecord, maxSpeed }` in
`records-logic.test.ts` fails `tsc --noEmit` (missing property) at every one of these sites.
**Why it happens:** `DemotionCounts` is both `countDemotedAtDistance`'s return type and
`describeDemotionCounts`/`resolvePrTableEmptyState`/`resolvePrTableDemotionNote`'s parameter type,
so it appears as a hand-written literal in test assertions, not just as a computed value.
**How to avoid:** Update all 14 sites in the same task as the interface change:
`src/dashboard/views/records-logic.test.ts` lines 496, 510, 526, 546, 557, 567, 573, 581, 611, 619,
624, 629, 636, 643 (grep confirmed count: `grep -c "ceiling:.*worldRecord\|worldRecord:.*maxSpeed"`
→ 14 matching lines in this session). Each needs `other: 0` added (all existing fixtures have zero
unrecognized-guard efforts, so `0` is correct for every one of them).
**Warning signs:** `tsc --noEmit` reporting `Property 'other' is missing in type '{ total: number; ...}'` at each of those 14 lines.

### Pitfall 2: "Byte-identical on the second run" is not literally true — every artifact carries a `**Generated:**` timestamp
**What goes wrong:** All five TD-05 target artifacts (`26-RESIDUAL.md`, `27-CALIBRATION.md`,
`28-CEILING-CALIBRATION.md`, `28-DIFF.md`, `30-CALIBRATION.md`) open with a
`**Generated:** <ISO timestamp>` line (confirmed by direct read: e.g. `28-DIFF.md:5` currently
`2026-09-19T07:43:38.019Z`). A literal `diff` of two consecutive runs will always show at least
this one-line difference.
**Why it happens:** Every generator calls `new Date().toISOString()` (or equivalent) and writes it
unconditionally as part of the markdown header, by design (so a reader can tell an artifact's age).
**How to avoid:** Follow the project's own established idiom from
`compute-best-efforts.test.ts`'s "two runs of the real-exclusion fixture produce byte-identical
documents apart from generatedAt" test (line ~1131): strip the `**Generated:**` line (or the
`generatedAt` field, for JSON) from both outputs before comparing, and assert the **remainder** is
byte-identical. State this explicitly in the idempotence proof so "regenerated twice, second run
byte-identical" is not a claim that silently fails on day one for the wrong reason.
**Warning signs:** A homemade idempotence check that does `execSync(cmd); const a = readFileSync(...); execSync(cmd); const b = readFileSync(...); expect(a).toBe(b)` will ALWAYS fail — even on a generator with zero bugs — because of the timestamp line alone.

### Pitfall 3: `compute-pace-quality-calibration.mjs` regenerates `26-RESIDUAL.md` as a subprocess side effect — ordering matters for the idempotence proof
**What goes wrong:** `compute-pace-quality-calibration.mjs:646` calls
`execSync('npm run compute-pace-residual', { cwd: rootDir, stdio: 'pipe' })` as part of ITS OWN
run. If the planner's Wave 2 task regenerates `26-RESIDUAL.md` directly (`npm run
compute-pace-residual`) and then separately regenerates `27-CALIBRATION.md` (`npm run
compute-pace-quality-calibration`), the second command will ALSO silently regenerate
`26-RESIDUAL.md` again as a side effect — a third, unaccounted-for write to a file already declared
"regenerated twice."
**Why it happens:** `27-CALIBRATION.md`'s own reconciliation table is built against a residual
report that must itself be current, so its generator refreshes the dependency first.
**How to avoid:** Regenerate in dependency order (`compute-pace-residual` in its own step first,
THEN `compute-pace-quality-calibration`, treating its `26-RESIDUAL.md` side-effect regeneration as
the second of the "twice" for that file, not a fresh unaccounted mutation) — or run
`compute-pace-residual` a third time deliberately, after `compute-pace-quality-calibration`, so the
final committed `26-RESIDUAL.md` is unambiguously the output of its OWN generator's last run, not a
side effect of a different script.
**Warning signs:** `git diff --stat` after the "twice" regeneration showing `26-RESIDUAL.md`
touched a third time, or the idempotence proof for `26-RESIDUAL.md` accidentally diffing against a
version written by the wrong script.

### Pitfall 4: `isStreamFile` lives in a file whose only other export triggers CLI parsing / subprocess side effects at module scope
**What goes wrong:** `compute-pace-quality-calibration.mjs:82`'s `isStreamFile` is a clean pure
function, but importing it directly from `compute-pace-residual.mjs` means
`compute-pace-residual.mjs` now has a static `import` edge into a file that also defines
`REGENERATE_COMMAND`/`execSync` machinery at module scope (though guarded behind a
self-execution check per the file's own comment — "Self-execution guard, mirroring
compute-pace-residual.mjs").
**Why it happens:** The two scripts evolved independently; `isStreamFile` was invented in Phase 27
(G-01's fix) and never promoted to a shared location.
**How to avoid:** `31-CONTEXT.md`'s canonical_refs explicitly floats "or lifts it to `scripts/lib/`"
— **take that option.** Create `scripts/lib/stream-files.mjs` exporting `isStreamFile` (and
`idFromFilename`, its usual pair per `compute-pace-quality-calibration.mjs:66`, if the planner
wants both), have both `compute-pace-residual.mjs` and `compute-pace-quality-calibration.mjs`
import from the new shared module, following the exact precedent of `scripts/lib/copy-data-tree.mjs`'s own header comment ("extracted from build-widgets.mjs... so it is importable by both... without triggering [the other file's] self-executing... side effect").
**Warning signs:** A future reader confused about which of the two files is "the real" owner of
`isStreamFile`; a circular-import risk if `compute-pace-quality-calibration.mjs` is ever itself
imported by something `compute-pace-residual.mjs` also touches.

### Pitfall 5: The CR-01 test's "real exclusion" premise checks only `4556693525`, never `3475711469`
**What goes wrong:** If the planner assumes D-01/D-02's "exactly one test keeps reading the real
file, asserting only the premise" needs to check BOTH entries the fixture copies, they will add a
second premise assertion the design doesn't call for and doesn't need — `31-CONTEXT.md` D-01 names
only `4556693525`'s premise as the one kept live.
**Why it happens:** The fixture legitimately needs both entries' *values* (to reproduce the
negative-control assertion that `3475711469` is excluded-but-under-ceiling), but the *premise
check* — the one thing that reads the real file — only needs to protect against `4556693525`'s
entry being removed or changed to non-all-distance, because that is the entry whose absence would
silently degrade the test from "REAL committed exclusion demonstration" to "just another fixture
value," which is the exact regression WR-09 exists to prevent for THAT entry. `3475711469`'s role
in the test is a negative control (proves excluded-but-under-ceiling doesn't over-demote) — its own
fixture copy doesn't need a live premise check, since a false negative-control has no security
consequence.
**How to avoid:** Keep exactly one premise-checking test, on `4556693525` only, per the existing
code at `compute-best-efforts.test.ts:944-960` — just strengthen its failure message per D-02's
"name the entry, name the file, name the test" shape and move the surrounding arithmetic (which
currently reads the real file for all four tests) onto the new fixture.

## Code Examples

### TD-04: exact reason-template site to change
```typescript
// Source: src/analytics/best-effort-ceiling.ts:198-203 (current)
return {
  guard: 'ceiling',
  reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(2)} m/s (${derivation.multiplier.toFixed(2)} x p90 ${p90Mps.toFixed(2)} m/s over ${derivation.populationN} filtered ${derivation.distance} efforts)`,
};
```
Target shape per D-10 (3 decimals on implied/ceiling/p90/margin, 2 decimals kept on the multiplier,
matching the worked example `implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s
(1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)` — this is the REAL live figure for
`3475730418@1mi`, confirmed against `28-VALIDATION.md`'s Round 3 sign-off record and
`data/best-effort-ceiling.json`'s current `1mi` entry (`ceilingMps: 4.6281`, `p90Mps:
3.6156908559874186`, `populationN: 1851`)):
```typescript
const margin = impliedSpeedMps - derivation.ceilingMps;
return {
  guard: 'ceiling',
  reason: `implied ${impliedSpeedMps.toFixed(3)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(3)} m/s by ${margin.toFixed(3)} m/s (${derivation.multiplier.toFixed(2)} x p90 ${p90Mps.toFixed(3)} m/s over ${derivation.populationN} filtered ${derivation.distance} efforts)`,
};
```

**Every site this format touches (must be updated together in TD-04's task):**
- `src/analytics/best-effort-ceiling.ts:200` — the source (above)
- `src/analytics/best-effort-ceiling.test.ts:192` — regex `\d+\.\d{2}` (×4) → needs 3-decimal groups
  plus a new `by \d+\.\d{3} m\/s` clause
- `src/analytics/best-effort-ceiling.test.ts:222` — exact-string assertion, must be recomputed for
  the new format (worked values: `derivation.ceilingMps` = 5.1098 exactly for that fixture, so the
  new string is computable by hand: `implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740
  m/s (1.28 x p90 3.992 m/s over 1825 filtered 400m efforts)`)
- `src/dashboard/views/detail-best-efforts-logic.test.ts:332,341` — exact-string `demotionReason`
  fixture input; not load-bearing for `prFlagBadgeSpecs` itself (it just passes the string through)
  but should be updated for realism/consistency
- `src/analytics/compute-best-efforts.test.ts:987,995` — `.toMatch(/exceeds personal ceiling/)`,
  unaffected (substring still present), no change required
- **NOT affected:** `scripts/curate-queue/derive-flagged.test.mjs:189-193` (synthetic reason
  strings, e.g. `'implied 6.96 m/s exceeds ceiling 5.11 m/s'`, do not match the real generated
  format even today — the word "personal" is absent — so this file was already decoupled from the
  real string shape and needs no change)

### TD-01: `computeBestEfforts`'s `exclusionsPath` accepts an absolute fixture path directly
```typescript
// Source: src/storage/file-store.ts:48-49 (readJson) — confirms path.resolve(baseDir, filePath)
// returns filePath unchanged when filePath is already absolute, regardless of baseDir/tmpDir.
async readJson<T>(filePath: string): Promise<T> {
  const fullPath = path.resolve(this.baseDir, filePath);
  // ...
}
```
This means D-01's fixture can be a plain committed file (e.g.
`src/analytics/__fixtures__/best-effort-exclusions.fixture.json`) referenced via
`fileURLToPath(new URL('../__fixtures__/best-effort-exclusions.fixture.json', import.meta.url))`,
exactly mirroring the existing `realExclusionsPath` construction at
`compute-best-efforts.test.ts:942-944` — no change to `computeBestEfforts`'s signature or to
`loadExclusions`/`best-effort-exclusions.ts` is needed at all; this is purely a test-file change.

### TD-02: existing digest idiom to mirror (not a new pattern to invent)
```javascript
// Source: scripts/compute-elevation-calibration.mjs:278,286
const aggregate = createHash('sha256');
// ...
const perFileDigest = createHash('sha256').update(contents).digest('hex');
```
TD-02 should use `createHash('sha1')` per D-04's own measurement basis (SHA-1 ≈1.4s vs the
unconditional-copy baseline of ≈1.7s — SHA-256 would work equally correctly but D-04's stated
numbers are for SHA-1, and using a different algorithm than the one the decision's own performance
case was built on would make the decision's stated tradeoff unverifiable after the fact).

### TD-03b: the exact validation gap in `recountDemotedActivities` today
```javascript
// Source: scripts/compute-pr-ceiling-recount.mjs:257-262 (current — the ENTIRE malformed-entry handling today)
for (const entry of exclusions) {
  if (!entry || typeof entry.activityId !== 'string') continue;
  exclusionsTotal += 1;
  if (flaggedSet.has(entry.activityId)) excludedWithinFlaggedCount += 1;
}
```
No duplicate-id check, no reason-shape check, no `__proto__` check exists here today — all four of
D-08's named malformation classes currently pass through silently (duplicates double-count into
`exclusionsTotal`; non-string/empty reasons are never inspected at all). This function needs a new
return field (e.g. `malformedExclusions: string[]`) that `evaluateReport` turns into `problems`
entries per Pattern 1 above.

### TD-03c: the exact function to extend (name-corrected)
```javascript
// Source: scripts/curate-queue/derive-flagged.mjs:52-68 (current, function is buildExclusionsMap — NOT buildExclusionReasonMap)
function buildExclusionsMap(exclusionsDoc) {
  const map = new Map();
  const exclusions =
    exclusionsDoc && Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
  for (const entry of exclusions) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.activityId !== 'string' ||
      entry.activityId === '__proto__' ||
      typeof entry.reason !== 'string'
    ) {
      continue;
    }
    map.set(entry.activityId, entry.reason);
  }
  return map;
}
```
This already skips non-string ids, `__proto__`, and non-string reasons — but NOT empty-string
reasons, and NOT duplicates (a later duplicate entry silently overwrites the map value with no
count of the collision). D-09 needs a skipped-count return (e.g. change the return shape to
`{ map, skippedCount }`, threading through to `deriveFlaggedActivities` and `summarizeQueue`, whose
current signature is `{ flaggedCount, excludedCount }` at `derive-flagged.mjs:190-196` and needs a
third field, e.g. `malformedExclusionCount`) rendered by `curate-queue/index.ts`'s
`renderQueue()` (around line 296, next to the existing `summary.textContent` line) as a new line:
`"N exclusion entries ignored (malformed)"`.

## State of the Art

Not applicable in the usual "industry evolved" sense — this is entirely internal-convention
alignment. The one relevant "old → new" shift is within this project's own history:

| Old Approach (Phase 24-28 era) | Current Approach (this phase) | When Changed | Impact |
|--------------------------------|-------------------------------|---------------|--------|
| `copyJsonTree`'s mtime-based skip (Phase 24) | Size-then-digest comparison (TD-02, this phase) | This phase | A locally-edited `dist/widgets/data/` file can no longer masquerade as fresh |
| 2-decimal demotion reason (Phase 28) | 3-decimal + explicit margin (TD-04, this phase) | This phase | Fixes the exact "4.63 exceeds 4.63" self-contradiction observed live in the Round 3 PR-04 sign-off note |
| Silent guard-fold in `records-logic.ts` (Phase 28) | Explicit `other` bucket (TD-03a, this phase) | This phase | A future 4th guard value degrades visibly instead of understating the total silently |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SHA-1 (not SHA-256) is the right digest choice for TD-02, per D-04's own measurement basis | Standard Stack / Code Examples | Low — either works correctly; only affects whether the plan's stated performance numbers remain traceable to D-04's text. `[ASSUMED]` recommendation, not a `[VERIFIED]` requirement — the planner/executor may choose SHA-256 without breaking anything functionally. |
| A2 | `other: number` should be a required (not optional) field on `DemotionCounts` | Anti-Patterns / Pitfall 1 | Medium — if the planner instead makes it optional to reduce the 14-site blast radius, D-07's guarantee ("the on-screen total is never unexplained") becomes weaker: a future test literal omitting `other` would compile without complaint. `[ASSUMED]` design preference, consistent with this codebase's existing preference for exhaustive interfaces (e.g. `DemotionCounts` itself has no optional fields today), but not dictated by `31-CONTEXT.md` verbatim. |
| A3 | `scripts/lib/stream-files.mjs` is the right new-file name/location for the shared `isStreamFile` helper (Pitfall 4) | Common Pitfalls | Low — `31-CONTEXT.md` explicitly leaves this as an open option ("reuse... or an equivalent shared helper" / "should it move to scripts/lib/?"); any reasonable name works as long as both generators import from one place. |

**If this table is empty:** N/A — see above; all three items are low/medium-risk naming or
algorithm-choice preferences within an already-locked design, not open questions about WHETHER to
do something.

## Open Questions

1. **Does `data/best-effort-ceiling.json` need to be committed as part of this phase?**
   - What we know: this file contains only numeric ceiling/p90/populationN values per distance
     (`src/analytics/best-effort.types.ts:249-260`), NOT demotion reason strings — confirmed by
     reading the live file (`data/best-effort-ceiling.json`, current `1mi` entry:
     `ceilingMps: 4.6281, p90Mps: 3.6156908559874186, populationN: 1851`). TD-04's reason-string
     format change therefore does **not** alter this file's content. TD-05's regeneration passes
     also should not move any ceiling/p90/population number, since none of the three generator
     fixes (26 G-03, 28 WR-07, 28 WR-08) touch the ceiling derivation itself — only report
     prose/columns and the residual-manifest count.
   - What's unclear: whether running `npm run build && npm run compute-all-stats` locally as part
     of TD-05's regeneration work will produce a bit-for-bit-identical
     `data/best-effort-ceiling.json` against `HEAD`, or whether some other in-flight nightly-CI
     archive growth between now and execution moves it.
   - Recommendation: after TD-05's regeneration work, run `git status --porcelain
     data/best-effort-ceiling.json` — if it shows a diff, inspect whether the diff is only
     `generatedAt` (no numeric change) and, if so, either revert it (it's gitignored-adjacent
     churn, not a phase deliverable) or commit it alongside the `28-DIFF.md` regeneration following
     the Round 3 sign-off's own precedent ("`data/best-effort-ceiling.json` (tracked) was rewritten
     ... and is committed alongside this record", `28-VALIDATION.md` § PR-04 Sign-off Round 3). Do
     NOT propose the WR-06 CI-only-write gate — that is explicitly out of scope.

2. **Should the TD-03c malformed-count surface as a fourth field on `summarizeQueue`'s return, or
   as a wholly separate function?**
   - What we know: `summarizeQueue(rows)` operates on the already-filtered `QueueRow[]` — malformed
     exclusion entries never become rows at all (they're filtered inside `buildExclusionsMap`
     before `deriveFlaggedActivities` even builds rows), so the skipped-count must originate
     upstream of `summarizeQueue`'s current input and be threaded through as an extra return value
     or a second, parallel export.
   - What's unclear: the cleanest signature change — whether `deriveFlaggedActivities` should
     return `{ rows, malformedExclusionCount }` instead of `QueueRow[]` (a breaking return-shape
     change touching every caller including `derive-flagged.test.mjs`'s many direct calls), or
     whether `buildExclusionsMap`'s malformed count should be computed by a small new sibling
     export (e.g. `countMalformedExclusions(exclusionsDoc)`) called once alongside
     `deriveFlaggedActivities` in `curate-queue/index.ts`'s `renderQueue()`, keeping
     `deriveFlaggedActivities`'s existing return type untouched.
   - Recommendation: the sibling-export approach — it avoids touching
     `deriveFlaggedActivities`'s return shape (and therefore avoids updating every existing test
     that destructures its `QueueRow[]` return directly), matches this codebase's preference for
     small single-purpose pure functions, and keeps `buildExclusionsMap`'s validation logic as the
     single source of truth for "what counts as malformed" (shared by TD-03b's recount script? No —
     D-08 forbids that script from importing anything; the two implementations will necessarily be
     independent, hand-duplicated validation, matching the project's existing "duplicate the tiny
     constant table" precedent in `compute-pr-ceiling-recount.mjs`'s own `TARGET_METERS_LOCAL`
     comment).

## Environment Availability

No new external dependency, service, or CLI tool. Everything below is already installed and in use.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all scripts, tests | ✓ | v25.2.1 (session) | — |
| TypeScript | `tsc --noEmit` gate | ✓ | 5.9.3 (pinned) | — |
| vitest | all tests | ✓ | 4.0.18 (pinned) | — |
| `crypto` (Node built-in) | TD-02's digest | ✓ | built into Node | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, keep this setting; `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` — a `scripts/**/*.test.ts` file is silently never collected, per the project's own header comment in `derive-flagged.mjs`) |
| Quick run command | `npx vitest run src/analytics/compute-best-efforts.test.ts src/analytics/best-effort-ceiling.test.ts src/dashboard/views/records-logic.test.ts scripts/lib/copy-data-tree.test.mjs scripts/compute-pr-ceiling-recount.test.mjs scripts/curate-queue/derive-flagged.test.mjs` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TD-01 | 3 arithmetic tests read a committed fixture, not the real file | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "REAL committed exclusion"` — **verify non-vacuous:** this filter currently matches exactly 1 test (`'4556693525 with its REAL committed exclusion entry is ceiling-demoted at 400m and 1k'`); after TD-01 lands it should still match exactly 1 (the strengthened premise-only test), with the other 3 renamed off "REAL" wording — planner must pick a distinguishing `-t` string for each and verify match count ≥1 per row before treating this table as trustworthy (Pitfall: the Phase 26 audit found a `-t` filter matching 0 tests) | ✅ exists — extending in place |
| TD-01 | Premise failure fails loudly with re-pin instructions | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "premise"` (new test asserting the failure MESSAGE shape, not just that it throws) | ❌ Wave 0 |
| TD-01 | Editing a fixture COPY demonstrates the arithmetic assertions would catch the change (D-03) | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "fixture copy"` | ❌ Wave 0 |
| TD-02 | mtime-stale-but-same-size doctored file is replaced and logged | unit, planted fixture | `npx vitest run scripts/lib/copy-data-tree.test.mjs` | ❌ Wave 0 (new file, mirrors `scripts/lib/curation-guard.test.mjs`'s mkdtemp pattern) |
| TD-02 | Ordinary rebuild still skips unchanged files (no regression on the "under 2 seconds" cost) | unit | `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "skip"` | ❌ Wave 0 |
| TD-03 (records-logic) | Unrecognized `demotion.guard` renders "N by another guard" | unit, planted fixture | `npx vitest run src/dashboard/views/records-logic.test.ts -t "another guard"` | ❌ Wave 0 (extend existing describe block) |
| TD-03 (recount) | Malformed exclusions entry (dup id / bad reason / `__proto__` / non-string id) fails the verdict, naming each | unit, planted fixture ×4 shapes | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` | ❌ Wave 0 (extend `describe('recountDemotedActivities', ...)` at line 198) |
| TD-03 (queue) | Malformed entries are skipped AND counted; header renders the count | unit, planted fixture | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs -t "malformed"` | ❌ Wave 0 |
| TD-04 | Reason string states margin at 3 decimals; house-register regex updated | unit | `npx vitest run src/analytics/best-effort-ceiling.test.ts -t "house register"` | ✅ exists — updating regex/exact-string in place |
| TD-05 | `isStreamFile` correctly excludes `manifest.json` from `compute-pace-residual`'s scan | unit or integration (archive-wide count) | `node scripts/compute-pace-residual.mjs` then check printed "Archive size scanned:" equals the true stream-file count (1899-cohort dependent; verify via `find data/streams -name '*.json' ! -name manifest.json \| wc -l`) | ⚠️ `scripts/compute-pace-residual.test.mjs` EXISTS (covers `isSevereStairStep`/`baselineFastMass`/`adaptiveFastMass`/`renderResidualMarkdown` — the 4 currently-exported functions) but the buggy scan itself lives in an UNEXPORTED `sweepArchive()` (line 273), so no unit test can reach it today — the fix requires either exporting `sweepArchive` (or a small `isStreamFile`-using helper) so a unit test can assert the manifest exclusion directly, or relying solely on the integration-level archive-count check |
| TD-05 | 400m-largest-drift prose is data-derived, not hard-coded | unit | extend `scripts/compute-pr-ceiling-calibration.test.mjs` with a case asserting the rendered sentence names whichever distance has max absolute drift, not literally "400m" | ❌ Wave 0 |
| TD-05 | "Demoted" column reconciles with the pipeline's total (labelled or split) | unit | extend `scripts/compute-pr-ceiling-calibration.test.mjs` asserting the new column/label and that non-excluded + owner-excluded sums to the live total | ❌ Wave 0 |
| TD-05 | All 5 artifacts regenerate twice, byte-identical apart from `**Generated:**` | integration (script, real archive) | `node scripts/compute-pace-residual.mjs && node scripts/compute-pace-quality-calibration.mjs && node scripts/compute-pr-ceiling-calibration.mjs && node scripts/compute-pr-ceiling-diff.mjs && node scripts/compute-elevation-calibration.mjs`, run twice, diff each pair with the `**Generated:**` line stripped (Pitfall 2) | manual verification step, not a vitest row — script exists, no automated idempotence assertion exists today; consider adding one per generator mirroring `compute-best-efforts.test.ts`'s "byte-identical apart from generatedAt" pattern |
| TD-05 | Fresh PR-04 sign-off recorded, bound to new `28-DIFF.md` sha256 | manual (irreducible) | N/A — human sign-off in `28-VALIDATION.md`, presenting the machine diff against the current `cdf9d654…` hash before the verdict | manual-only, see below |
| TD-06 | `27-VALIDATION.md` frontmatter flips `status: partial` → `passed` | doc check | `grep '^status:' .planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` → `status: passed` | doc edit, not a test |

### Sampling Rate
- **Per task commit:** the single new/extended test file for that task (see Quick run command list above)
- **Per wave merge:** `npm run test` (full suite, `fileParallelism: false`) + `npx tsc --noEmit`
- **Phase gate:** full suite green + `tsc --noEmit` clean + `npm run build-widgets` clean +
  `node scripts/compute-pr-ceiling-recount.mjs` PASS (regression: this script itself gets new
  malformed-exclusion checks in TD-03b, so it must also pass against the real, well-formed
  `data/best-effort-exclusions.json`) + `node scripts/compute-elevation-recount.mjs` PASS (D-06
  regression, unaffected by this phase but cheap to re-verify) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (or equivalent name/location, Claude's Discretion) — TD-01's committed fixture, copying `4556693525`/`3475711469` verbatim (both `distances: null`)
- [ ] `scripts/lib/copy-data-tree.test.mjs` — new file, TD-02, no existing test today
- [ ] `scripts/lib/stream-files.mjs` — new shared module for `isStreamFile` (Pitfall 4), if the planner takes the "lift to scripts/lib/" option
- [ ] `scripts/compute-pace-residual.mjs`'s `sweepArchive()` (line 273, currently unexported) needs either exporting or a small extracted/imported `isStreamFile`-filtered variant so TD-05's manifest-exclusion fix has a unit-test seam; `scripts/compute-pace-residual.test.mjs` exists today but only covers the 4 already-exported pure functions, none of which touch the scan
- [ ] `curate-queue/index.ts` — new DOM node for the "N exclusion entries ignored (malformed)" line, next to the existing `data-queue-summary` paragraph (~line 296)

**Framework install:** none needed.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled by default, matching every prior v2.2 phase).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched — TD-03c's queue change is inside the existing local-only `npm run curate` surface, already gated by `curate-server.mjs`'s trusted-origin check (CUR-02, unmodified) |
| V5 Input Validation | Yes | TD-03b/TD-03c both harden input validation on `data/best-effort-exclusions.json` — an owner-editable, hand-maintained JSON file. The `__proto__` key check (already present in `buildExclusionsMap`, being extended in `recountDemotedActivities`) is a prototype-pollution-adjacent defensive pattern already established in this codebase; TD-03b/TD-03c extend the same discipline, they do not introduce it |
| V6 Cryptography | Yes (adjacent) | TD-02's SHA-1 digest is an integrity/staleness check, not a security boundary (mirrors Phase 30's identical use of `crypto.createHash` for stream-digest verification) — using SHA-1 here is fine precisely because collision-resistance is irrelevant to a same-machine build-cache staleness check |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A hand-edited `data/best-effort-exclusions.json` with a `__proto__`-keyed entry reaching `Object.prototype` via an unguarded `index[activityId] = ...` assignment | Tampering (prototype pollution) | Already mitigated project-wide via `Map` (not plain-object) exclusion indices in both `best-effort-exclusions.ts`'s `buildExclusionIndex` and `derive-flagged.mjs`'s `buildExclusionsMap` — a `Map` has no prototype-chain hazard for arbitrary string keys. TD-03b/TD-03c's new validation adds explicit rejection/reporting of a literal `__proto__` id, which is defense-in-depth on top of the already-safe `Map`-based storage, matching D-08/D-09's stated malformation classes |
| A locally-edited `dist/widgets/data/*.json` file surviving a `build-widgets` run and shipping stale/tampered content to the published site | Tampering | TD-02's digest-based replacement is exactly this mitigation — closes the "staged-build browser cache trap" this project's own memory records |

## Sources

### Primary (HIGH confidence — direct source reads and live commands, this session)
- `src/analytics/compute-best-efforts.test.ts` (lines 650-1200) — the four CR-01 tests, exact structure
- `src/analytics/compute-best-efforts.ts` (lines 1-220) — `exclusionsPath` option, `loadExclusions` call
- `src/analytics/best-effort-exclusions.ts` (full) — `buildExclusionIndex`, `loadExclusions`, `isExcluded`
- `src/storage/file-store.ts` (readJson) — confirms absolute-path resolution behavior
- `data/best-effort-exclusions.json` (full, live) — confirms `3475711469` is `distances: null`, not 400m-only
- `scripts/lib/copy-data-tree.mjs` (full, 70 lines) — `copyJsonTree`, `RECOMPUTE_DATA_DIRS`
- `scripts/build-widgets.mjs` (lines 200-245) — one call site
- `scripts/curate-server.mjs` (grep) — second call site, `RECOMPUTE_DATA_DIRS` usage
- `src/dashboard/views/records-logic.ts` (lines 150-312) — `DemotionCounts`, `countDemotedAtDistance`, `describeDemotionCounts`, `resolvePrTableEmptyState`, `resolvePrTableDemotionNote`
- `src/dashboard/views/records-logic.test.ts` (lines 490-650) — all 14 literal-object test sites
- `scripts/compute-pr-ceiling-recount.mjs` (full read of key sections, lines 1-800) — `KNOWN_GUARDS`, `recountDemoted`, `recountDemotedActivities`, `evaluateReport`, `main`
- `scripts/curate-queue/derive-flagged.mjs` (full) — `buildExclusionsMap` (name-corrected), `deriveFlaggedActivities`, `summarizeQueue`
- `scripts/curate-queue/index.ts` (lines 280-330) — `renderQueue`, header render site
- `scripts/curate-queue/derive-flagged.test.mjs` (lines 1-60, 189-193) — fixture convention, confirms synthetic reason strings unaffected by TD-04
- `src/analytics/best-effort-ceiling.ts` (lines 150-203) — `deriveCeilings`, `ceilingDemotion`, exact reason template
- `src/analytics/best-effort-ceiling.test.ts` (lines 180-230) — house-register regex and exact-string tests
- `src/dashboard/views/detail-best-efforts-logic.test.ts` (lines 315-345) — badge-wrapping test, confirms not load-bearing on the ceiling format itself
- `scripts/compute-pace-residual.mjs` (grep) — line 277 `f.endsWith('.json')` bug confirmed
- `scripts/compute-pace-quality-calibration.mjs` (lines 1-100, plus subprocess call at 646) — `isStreamFile`, `execSync(RESIDUAL_REGENERATE_COMMAND)` ordering hazard
- `scripts/compute-pr-ceiling-calibration.mjs` (lines 260-660) — `applyCeiling`'s `demotedCount` scope, hard-coded "400m shows the largest drift" prose, table render
- `scripts/compute-pr-ceiling-diff.mjs` test file header (`| Of which owner-excluded |` column) — confirms this script already has the reconciliation column WR-08 needs to borrow the pattern from
- All 5 `OUTPUT_PATH` grep results + all 5 `**Generated:**` line greps — confirms artifact locations and the timestamp pitfall
- `.planning/v2.2-MILESTONE-AUDIT.md` (full) — tech_debt list, MERGE-01 figures, phase-by-phase advisory items
- `.planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` (frontmatter + G-02 section) — confirms `status: partial` gated explicitly on G-02
- `.planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` (PR-04 Sign-off Round 3 section) — confirms the exact `3475730418@1mi` worked example and current sha256 `cdf9d654…`
- `.planning/REQUIREMENTS.md` (grep for exact line numbers: 33, 58-60, 94, 107, 169-171) and `.planning/ROADMAP.md` (line 176, 361) — hand-edit sites
- Live commands this session: `node -e` device-family census over `data/dashboard/index.json` (663/1899 no-device-name); `node -e` over `data/stats/best-efforts.json` (totals.effortsDemoted: 66, ceilingDemotions: 32); `git status`/`git log` (clean tree, HEAD `9b7f0d3a`); `node --version` (v25.2.1); `vitest.config.ts` (full, confirms `fileParallelism: false` and the `.test.ts`-under-`scripts/`-never-collected trap)

### Secondary (MEDIUM confidence)
None — no WebSearch/Context7 lookups were needed or performed; every claim in this document traces to a direct source read or command run in this session.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every mechanism cited is already live in this codebase
- Architecture: HIGH — every file/line cited was read directly in this session, not recalled from training data
- Pitfalls: HIGH — Pitfalls 1-5 are each derived from a specific, quoted piece of existing code/test content, not speculation

**Research date:** 2026-09-19
**Valid until:** This research is tied to the exact commit HEAD `9b7f0d3a` (clean tree, verified this
session) and to the merged 1,899-activity archive's current state (`data/stats/best-efforts.json`
totals: 66 demoted / 32 ceiling; `data/dashboard/index.json` device-family census 663
no-device-name). Any nightly CI sync that lands new activities before this phase executes will move
these numbers again — re-verify the live counts (not just re-read this file) immediately before
writing TD-04's worked example or TD-05's regeneration diffs into any plan or checkpoint row.
