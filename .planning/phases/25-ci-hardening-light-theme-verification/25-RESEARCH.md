# Phase 25: CI Hardening & Light-Theme Verification - Research

**Researched:** 2026-09-03
**Domain:** CI pipeline consolidation, HTTP publish-verification hardening, a pure-function null/undefined defect, and browser-theme behavioural testing (no jsdom in this repo)
**Confidence:** HIGH (all findings below are read directly from this repo's own source at the cited line numbers — this phase has essentially no external-library research surface)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CI-01 — Compute chain ordering**

- **D-01:** The single ordering lives **in code**. The workflow's eight separate compute steps collapse into one `compute-all-stats` invocation, and `computeAllStatsCommand` (`src/index.ts:289`) becomes the sole declaration of both the order and each step's failure disposition. Per-step tolerance moves into the command, which emits `::warning::` annotations so degraded steps still surface in the Actions run summary. Rejected: a shared manifest with generated YAML (new codegen + freshness gate to maintain), and keeping both orderings behind a parity test (leaves two orderings, one merely checked).
  - **Accepted cost:** the eight separate green/red boxes in the Actions UI become one. Diagnosing a nightly failure moves from the step list into that step's output, so the command's logging has to carry the weight the step names used to.
- **D-02:** Tolerance is **opt-in for CI**. `compute-all-stats` stays fail-fast by default so a hand-run aborts loudly; the workflow passes an explicit flag (`--ci` / `--continue-on-error`, exact spelling is the planner's) to get warn-and-continue behaviour. Drift in a boolean is far cheaper than drift in an ordering.
- **D-03 (Claude's discretion, accepted):** the mandatory/tolerated split is preserved exactly as CI has it today — `compute-stats` and `compute-advanced-stats` mandatory; geo, best-efforts, dashboard-index, age-grading, gear-aggregate and training-load tolerated. The command prints an end-of-run failure summary so a nightly that quietly degraded three steps is visible at a glance rather than buried mid-log.

**VER-01 — Light-OS checkpoint protocol**

- **D-04:** Each round starts from **cleared site data** (or a fresh profile), and the write-up must quote `localStorage.getItem('dashboard-theme')` returning `null` at the instant of observation. Without this the row proves nothing: `theme.ts` reads the persisted mode *before* falling back to `prefers-color-scheme`, so a browser whose in-page control has ever been touched ignores the OS setting entirely — and a masked row looks identical to a passing one.
- **D-05:** The **first-paint flash row is observed with the OS in dark appearance**, not light. As worded, that row is vacuous: light `--bg` is `#ffffff` (`styles.css:18`), so on a light OS a white first paint *is* the correct final state and cannot discriminate a working pre-paint theme from a broken one. On dark OS a white first frame is the failure and `#1a1a2e` is the pass. Legibility stays on light OS; live-follow spans both. **This is a deliberate deviation from criterion 4's literal wording and must be disclosed as such in the validation write-up**, not quietly substituted.
- **D-06:** A **structural pin on the inline theme bootstrap** is folded into this phase. `src/dashboard/index.html` carries a synchronous pre-paint copy of `parseThemeMode`/`resolveEffectiveTheme` whose own comment declares it a deliberate duplication that "must stay behaviourally identical" and that carries the T-16-TH-01 allow-list mitigation — and nothing in the repo tests it. The pin asserts behavioural parity with `theme.ts` across the same mode/`prefersDark` combinations, the `'light' | 'dark' | 'auto'` allow-list intact, and the script still positioned before the stylesheet link. Same fix shape as Phase 24's WR-17 `resolveExcluded` extraction; here the duplication cannot be removed (the inline copy must run before the module loads), so it is pinned instead.
- **D-07:** **Hybrid execution.** The developer personally performs the OS appearance change in System Settings; the agent handles surrounding instrumentation (cleared-storage assertion, frame capture, quoting `matchMedia('(prefers-color-scheme: dark)').matches` before and after). Mirrors Phase 24's R34 — the gesture the requirement calls human stays human, the parts automation does better stay automated. `osascript`-driven switching was considered and rejected for the recorded rows.
- **D-08:** The round runs against the **live production URL** `https://bacilo.github.io/strava-widgets/`, which as of the 2026-09-03 push finally serves current code. This is what criterion 5 asks for literally, and it exercises the real CDN, base path and caching. Hard-reload discipline is mandatory — this repo has a documented history of a stale cached `index.html` producing false evidence.

**CI-02 — Verifier assertion depth**

- **D-09:** Each of the six documents must return **200, parse as JSON, and satisfy one cheap structural invariant** that a truncated or empty file would fail (non-empty array, expected top-level key, plausible count). A bare 200 would pass a zero-byte or `{}` file, which is a real failure mode for generated documents; full schema depth would duplicate what unit tests already own.
- **D-10:** The per-activity best-effort shard sample is **derived at runtime**, following the convention already established at `verify-dashboard-publish.mjs:430-455` (`newestRow` / `newestWithStream` / `newestWithoutStream`). No pinned ids to rot as the archive grows, and it implicitly cross-checks that the index and the shards agree about what exists.
- **D-11:** Every one of the six new assertions must be **observed RED once** before the phase closes — delete or truncate each document in a scratch `dist/widgets`, confirm `verify-dashboard` exits non-zero *naming that document*, restore, confirm green. Inherits Phase 24's D-11 precedent. GAP-24-02 existed precisely because a guard's blind spot was never observed failing.

**FIX-02 — Unknown-bucket hardening**

- **D-12:** The Unknown-bucket test accepts **anything that is not a non-empty string** (`typeof label !== 'string' || label === ''`). Covers `null`, the absent key named in the requirement, malformed shapes a partially-written `index.json` can produce, and the empty string — which today slugifies to nothing and lands in the `'shoe'` fallback key rather than Unknown.
- **D-13:** The **type is made honest**: `gearName` becomes optional on the row type so `tsc` enumerates every consumer making the same presence assumption. The rows are parsed from `index.json` at runtime, where the required-key guarantee does not hold, which is why this defect looked impossible. **Bounded explicitly:** fix gear-aggregate plus anything trivially adjacent; if `tsc` surfaces more than a handful of sites, record the remainder as a todo rather than letting the phase grow.

### Claude's Discretion

- D-03's mandatory/tolerated split and the end-of-run failure summary were offered as defaults and accepted without further discussion.
- The exact flag spelling for D-02, the specific structural invariant chosen per document under D-09, and the shard sample size under D-10 are left to the planner.
- Todo folding was delegated ("you decide what's reasonable") — see Folded Todos and Reviewed Todos below.

### Folded Todos

- **WR-19 — curation-guard directory EACCES** (`.planning/todos/pending/2026-09-02-wr19-curation-guard-directory-eacces.md`). `findCurationArtifacts`'s `readdirSync` (`scripts/lib/curation-guard.mjs:82-83`) is unguarded, so a mode-000 directory under `dist/widgets` throws an uncaught `EACCES` instead of a reported violation — the directory-shaped sibling of the file case plan 24-15 fixed. It fails **closed**, so publish-safety is intact; the cost is operator experience, reintroducing the unattributed `Widget build failed: EACCES` that 24-15 set out to replace. Folded because it is literally CI hardening, its fix shape is already specified (wrap the `readdirSync` in the same try/catch pattern 24-15 applied to `readFileSync`, plus a mode-000-directory fixture in `scripts/lib/curation-guard.test.mjs`), and it sits in the guard family this phase already touches. Per D-11's precedent the new fixture should be observed red.

### Deferred Ideas (OUT OF SCOPE)

- **IN-17 and IN-18** (from the same wave-9 review as WR-19) — a non-regular entry matching `__curate`/`.curate-dist` yields two violation entries for one path; and the WR-17 literal-string pin in `curation-seam.test.ts:152-178` is more brittle than it needs to be. Both Info-level and cosmetic; they stay in `.planning/todos/pending/` rather than riding along with WR-19.
- **Overflow from D-13's triage** — if making `gearName` optional surfaces more than a handful of consumers, the remainder becomes a todo rather than expanding this phase.
- **Garmin export adapter when export arrives** (reviewed, not folded) — matched this phase on generic keywords only. Blocked on the Strava export actually arriving; `REQUIREMENTS.md` § "Out of Scope" lists it explicitly (STREAM-04). Stays pending.

**Not in this phase (Phase Boundary):** anything touching the analytics or computation layer beyond FIX-02; the Garmin export adapter; new metrics or chart types. This is the closing phase of v2.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| FIX-02 | `gear-aggregate-logic.ts` degrades rather than crashing when an index row lacks a `gearName` key — the Unknown-bucket test is a strict `label === null`, so an absent key reaches `slugify(undefined)` | Pattern 4 traces the exact defect path (`isUnknown = label === null` at `:147` lets `undefined` fall into the named-bucket branch, reaching `slugify(undefined).toLowerCase()`); Pattern 4's consumer table confirms D-13's optional-field triage has only two production call sites to fix, both in the same file |
| VER-01 | Phase 16's three unverified theme items (light-OS legibility, first-paint white flash, live OS-follow) confirmed in a real browser | Pitfalls 1-2 restate and ground D-05's discriminator-fix and D-04's cleared-storage requirement in the actual `theme.ts`/`styles.css` source; Pattern 6 supplies the concrete, achievable mechanism (`node:vm` sandbox) for D-06's inline-bootstrap parity pin, which is a prerequisite structural item folded into this requirement's closing round |
| CI-01 | The nightly workflow and `compute-all-stats` no longer maintain two independent orderings of the compute chain | Code Examples section quotes both orderings side by side, confirming the exact drift (`dashboard-index` before `age-grading` in the workflow, reversed in code); Pattern 1 gives the concrete extraction shape (a testable step-list constant) needed because `computeAllStatsCommand` has zero existing test coverage; Pattern 2 confirms the CLI's flag-parsing style for D-02 |
| CI-02 | `verify-dashboard-publish.mjs` asserts reachability for every published stats document (`weekly-distance`, `monthly-stats`, `yearly-stats`, `year-over-year`, `best-efforts.json`, per-activity shards) | Pattern 3 supplies the real on-disk shape of all six documents (verified by parsing the actual generated files, not assumed) plus a per-document invariant table and the exact existing assertion-style template to clone; confirms `build-widgets.mjs` already copies these files, so only new verifier assertions are needed |
</phase_requirements>

## Summary

This phase has no new library to evaluate — every one of its four items is "read the two places
that already disagree/undertest and make them agree/tested." The highest-value research finding is
that **CI-01's drift is not hypothetical**: `daily-refresh.yml` runs `compute-dashboard-index` before
`compute-age-grading`, while `computeAllStatsCommand` (`src/index.ts`) runs `compute-age-grading`
before `compute-dashboard-index` — confirmed by reading both files side by side. Second: FIX-02's
defect path is precise and its blast radius is small — only two call sites in
`gear-aggregate-logic.ts` and the row's own type declaration touch `gearName`'s presence assumption
outside of test fixtures, so D-13's optional-field triage is not going to surface "more than a
handful" of consumers. Third, and the hardest fact for the planner to act on: **there is no jsdom in
this repo** (`vitest.config.ts` sets `environment: 'node'`, and `jsdom` is not an installed
dependency — it appears only as an unused optional peer of vitest in the lockfile). This makes D-06's
parity pin for the inline `index.html` theme bootstrap non-trivial but achievable: Node's built-in
`vm` module can sandbox-execute the extracted `<script>` text with mocked `localStorage`/`window`/
`document` stubs, giving genuine behavioural coverage without adding a dependency. A source-text-only
pin is available as a fallback but is explicitly weaker (a copy-paste behavioural bug can still
contain the right substrings).

**Primary recommendation:** Do the CI-01 collapse exactly as D-01 specifies (single ordering lives in
`computeAllStatsCommand`, extracted into a testable step-list data structure rather than left as
inline sequential `await` calls, since the current function has zero test coverage and calls
`process.exit()` directly); do CI-02 by cloning the existing `expect200` + JSON-shape-assertion
pattern already used for `training-load.json`/`age-grading.json`/`gear-aggregate.json` for the six
new documents (four are arrays, not objects — pick invariants accordingly); do FIX-02 by widening the
Unknown-bucket predicate to D-12's `typeof label !== 'string' || label === ''` and making `gearName`
optional on `DashboardIndexRow`; do VER-01/D-06 with a `node:vm`-sandboxed behavioural pin, not a
source-text pin.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute-chain ordering (CI-01) | Build/CLI tooling (`src/index.ts`, Node CLI) | CI orchestration (`.github/workflows/daily-refresh.yml`) | The order and failure-tolerance policy is business logic about data dependencies between compute steps — it belongs in the program that has the dependency graph in its comments, not in YAML, which can only sequence opaque steps |
| Publish-verifier assertions (CI-02) | Build/CLI tooling (`scripts/verify-dashboard-publish.mjs`, a Node HTTP smoke-test script) | — | This script already owns "does the published bundle serve what the SPA will fetch"; the six new documents are additions to an existing responsibility, not a new one |
| Gear-aggregate Unknown-bucket hardening (FIX-02) | Analytics/compute layer (`src/analytics/gear-aggregate-logic.ts`, pure function, no I/O) | Data contract (`dashboard-index.types.ts`) | Pure grouping logic; the type change is a secondary, coupled edit that makes the compiler enumerate every other place assuming presence |
| Theme resolution + first-paint bootstrap (VER-01) | Browser/Client (inline `<script>` in `index.html` for pre-paint; `src/dashboard/theme.ts` module for everything after) | — | Both live in the browser tier by necessity — the inline copy exists ONLY because the module tier (a deferred `type="module"` script) cannot run before first paint |
| Curation-guard directory-read hardening (WR-19) | Build/CLI tooling (`scripts/lib/curation-guard.mjs`, called from `build-widgets.mjs`) | — | Build-time publish-safety guard; same tier as CI-02's verifier and the guard family it already belongs to |

## Standard Stack

No new libraries are introduced by this phase. Every fix uses Node built-ins already used
elsewhere in this codebase.

### Core (existing, reused)

| Library | Version | Purpose | Why Standard (in this repo) |
|---------|---------|---------|------------------------------|
| `vitest` | ^4.0.18 (installed; confirmed in `package.json`) | Test runner for all four items' regression tests | Already the sole test runner (`vitest.config.ts`, `environment: 'node'`, `fileParallelism: false`) |
| `node:http` | built-in | `verify-dashboard-publish.mjs`'s local static server | Already used, no new dependency needed for CI-02 |
| `node:vm` | built-in | **New usage** — sandboxed execution of the extracted inline theme-bootstrap `<script>` for D-06's behavioural pin | Not currently used anywhere in this repo, but is a Node built-in (zero new dependency), matching the project's stated "Node built-ins only" style for scripts (see `verify-dashboard-publish.mjs`'s own header comment) |
| `node:fs` (`readdirSync`/`readFileSync` with `try`/`catch`) | built-in | WR-19's guard fix | Exact pattern already shipped for the sibling `readFileSync` case (WR-14, plan 24-15) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:vm` sandbox for D-06 | Install `jsdom` and run the real DOM | Adds a new dependency this repo has deliberately avoided everywhere else (`verify-dashboard-publish.mjs`'s own docblock: "deliberately does not attempt to fake [a real browser] with a headless-browser dependency"); also changes `vitest.config.ts`'s `environment` globally or per-file, a bigger footprint for one test file |
| `node:vm` sandbox for D-06 | Source-text-only pin (assert literal strings/structure in `index.html`) | Much weaker: proves the allow-list string and script position exist, but not that the script's actual branching logic matches `theme.ts`'s. CONTEXT.md's D-06 explicitly asks for behavioural parity, not text presence — a text-only pin should be treated as insufficient to close D-06, only as a supplementary structural check (script-before-stylesheet ordering, allow-list literal) |
| Extracting `computeAllStatsCommand`'s new step list into a generated/shared manifest file | Keep the ordering as a plain in-file array/const | D-01 already rejected the manifest+codegen approach explicitly ("new codegen + freshness gate to maintain") — do not reconsider this |

**Installation:** None required — no `npm install` for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new external packages. All four items use Node
built-ins and existing devDependencies (`vitest`) already present in `package.json` and verified
installed in `node_modules`. No `slopcheck`/registry-verification pass is required.

## Architecture Patterns

### System Architecture Diagram — CI-01's collapsed compute chain

```
push (paths filter) ─┐
schedule (05:00 UTC) ─┼─► daily-refresh.yml job
workflow_dispatch ────┘        │
                                ▼
                    npm ci → npm run build (tsc)
                                │
                                ▼
                 node dist/index.js compute-all-stats [--ci]
                 ┌──────────────────────────────────────────┐
                 │ 1. computeAllStats      (MANDATORY)       │
                 │ 2. computeAdvancedStats (MANDATORY)       │
                 │ 3. computeGeoStats            (tolerated) │  ← single source of truth for
                 │ 4. computeBestEfforts         (tolerated) │    BOTH order and disposition
                 │ 5. computeAgeGrading          (tolerated) │    (D-01) — was steps 3-8 as
                 │ 6. computeDashboardIndex      (tolerated) │    EIGHT separate workflow
                 │ 7. computeGearAggregate       (tolerated) │    steps + a differently-
                 │ 8. computeTrainingLoad        (tolerated) │    ordered in-code chain
                 │ [--ci: warn-and-continue + end summary]   │
                 └──────────────────────────────────────────┘
                                │
                                ▼
                      npm run build-widgets
                                │
                                ▼
                  npm test  →  npm run verify-dashboard   (BLOCKING, untouched by this phase)
                                │
                                ▼
                 commit data (continue-on-error) → deploy to Pages
```

### System Architecture Diagram — CI-02's verifier extension

```
scripts/verify-dashboard-publish.mjs
  │
  ├─ starts a local http.Server rooted at dist/widgets, mounted under /strava-widgets
  │
  ├─ existing by-name checks (unchanged):
  │     all-time-totals.json, streaks.json, training-load.json, age-grading.json,
  │     gear-aggregate.json, config/gear.json, config/athlete.json, exclusions.json
  │
  └─ NEW (CI-02, six additions, same expect200+shape-check style):
        weekly-distance.json   → expect200 + Array.isArray + length>0 + shape of item[0]
        monthly-stats.json     → expect200 + Array.isArray + length>0 + shape of item[0]
        yearly-stats.json      → expect200 + Array.isArray + length>0 + shape of item[0]
        year-over-year.json    → expect200 + Array.isArray(length===12) + years object present
        best-efforts.json      → expect200 + object + non-empty "activities" + "rankings" present
        best-efforts/{id}.json → runtime-derived sample (mirrors newestRow pattern at :430-455),
                                  expect200 + "efforts" array present
```

### Recommended file-touch map (no new files needed for CI-01/CI-02/FIX-02; one new test file for VER-01/D-06)

```
.github/workflows/daily-refresh.yml     # 8 steps collapse to 1 (D-01)
src/index.ts                            # computeAllStatsCommand gains step table, --ci flag, summary
scripts/verify-dashboard-publish.mjs    # 6 new assertion blocks, existing style
src/analytics/gear-aggregate-logic.ts   # D-12 predicate widened (2 call sites: :147, :207)
src/analytics/dashboard-index.types.ts  # gearName becomes optional (:72)
scripts/lib/curation-guard.mjs          # readdirSync wrapped in try/catch (WR-19, :83)
scripts/lib/curation-guard.test.mjs     # + mode-000-directory fixture
src/dashboard/index.html                # untouched (read by a NEW test, not modified, unless D-06's
                                         # pin finds it already-correct, which it should)
src/dashboard/theme-bootstrap-parity.test.ts   # NEW — D-06's node:vm behavioural pin (suggested name;
                                         # planner's call, but must sit "alongside" theme.test.ts
                                         # per CONTEXT.md's canonical_refs)
```

### Pattern 1: Extracting a testable step table out of a `process.exit()`-calling CLI command

**What:** `computeAllStatsCommand` (`src/index.ts:289-392`) is currently one large `try { await X(); await Y(); ... } catch { process.exit(1) }` function with **zero existing test coverage** — nothing in `src/index.ts` is imported and unit-tested anywhere in this repo (confirmed: no `index.test.ts` exists, and grepping the whole `src/` tree for `computeAllStatsCommand` finds only its own definition). Every other command in the file has the same shape.

**When to use:** D-01 requires this function to become "the sole declaration of both the order and each step's failure disposition," which is untestable as a monolithic `process.exit`-calling function. Extract an exported, pure data structure — e.g. an ordered array of `{ name: string, mandatory: boolean, run: () => Promise<void> }` — that a unit test can import and assert on (order, mandatory/tolerated flags, and that all 8 steps are present) without executing the actual compute functions or triggering `process.exit`. The imperative walking/warning/exit logic stays thin and wraps that array.

**Example (illustrative shape, not prescriptive of exact names):**
```typescript
// Source: pattern inferred from src/index.ts:289-392's own documented
// "Chain ordering below is load-bearing" comment block; no direct
// Context7/library source since this is project-internal refactoring.
export const COMPUTE_ALL_STATS_STEPS = [
  { name: 'compute-stats', mandatory: true, run: () => computeAllStats({ ... }) },
  { name: 'compute-advanced-stats', mandatory: true, run: () => computeAdvancedStats({ ... }) },
  { name: 'compute-geo-stats', mandatory: false, run: () => computeGeoStats({ ... }) },
  { name: 'compute-best-efforts', mandatory: false, run: () => computeBestEfforts({ ... }) },
  { name: 'compute-age-grading', mandatory: false, run: () => computeAgeGrading({ ... }) },
  { name: 'compute-dashboard-index', mandatory: false, run: () => computeDashboardIndex({ ... }) },
  { name: 'compute-gear-aggregate', mandatory: false, run: () => computeGearAggregate({ ... }) },
  { name: 'compute-training-load', mandatory: false, run: () => computeTrainingLoad({ ... }) },
] as const;
```
A unit test can then assert `COMPUTE_ALL_STATS_STEPS.map(s => s.name)` equals the documented order and that `mandatory` matches D-03's split, closing the "no shared source of truth" gap at the type level — this table IS the shared source of truth, and the workflow's single `compute-all-stats --ci` invocation calls into it.

### Pattern 2: CLI flag parsing style already in this codebase

**What:** `src/index.ts` has **no existing `--flag` parsing** anywhere. All argument handling today is purely positional: `const command = process.argv[2]` (the command name, dispatched through a `switch`), and two commands read a second positional argument directly off `process.argv[3]` (`authCommand`'s `authCode` at line 22, and a `requestedId` at line 475). There is no library like `yargs`/`commander` and none should be introduced for one boolean flag.

**When to use:** D-02's `--ci`/`--continue-on-error` flag (exact spelling left to the planner) should be read the same primitive way: `process.argv.includes('--ci')` (or equivalent) inside `computeAllStatsCommand`, with no new dependency and no change to the existing `command = process.argv[2]` dispatch. This matches the file's own style exactly — introducing `process.argv.slice(3)` parsing conventions here would be the first of its kind in the file and should stay minimal.

**Example:**
```typescript
// Source: inferred from src/index.ts's existing process.argv[2]/[3] usage;
// no new parsing library.
async function computeAllStatsCommand() {
  const ciMode = process.argv.includes('--ci'); // exact flag name is planner's call (D-02)
  // ... walk COMPUTE_ALL_STATS_STEPS, honoring `mandatory` unconditionally
  // and `ciMode` only for the tolerated steps' continue-vs-abort behavior
}
```
Then in the workflow: `run: node dist/index.js compute-all-stats --ci`.

### Pattern 3: CI-02's existing by-name-assertion template (quote verbatim, per research scope item 2)

**What:** every existing document check in `verify-dashboard-publish.mjs` follows the same three-step shape: `expect200` the URL, `JSON.parse` the body, then assert cheap structural invariants with `fail()`/`ok()` calls. Quoted verbatim (the `training-load.json` check, `scripts/verify-dashboard-publish.mjs` lines ~317-336):

```javascript
// Source: scripts/verify-dashboard-publish.mjs (existing code, quoted verbatim)
const trainingLoadBody = await expect200(baseUrl, '/data/stats/training-load.json');
if (trainingLoadBody) {
  const parsedTrainingLoad = JSON.parse(trainingLoadBody);
  if (parsedTrainingLoad.schemaVersion !== 1) {
    fail(`/data/stats/training-load.json schemaVersion expected 1, got ${parsedTrainingLoad.schemaVersion}`);
  } else if (!Array.isArray(parsedTrainingLoad.days) || parsedTrainingLoad.days.length <= 1000) {
    fail(/* ... */);
  } else if (parsedTrainingLoad.models?.edwards !== true) {
    fail(/* ... */);
  } else {
    // ... finite-number checks ...
    ok('/data/stats/training-load.json parses with schemaVersion 1, >1000 days, models.edwards true, and finite days[0].edwards');
  }
}
```

**Real on-disk shapes for the six CI-02 target documents** (verified by parsing the actual generated files in `data/stats/`, not assumed from a schema doc — none of these four have a `schemaVersion` field, unlike `training-load.json`/`age-grading.json`/`gear-aggregate.json`):

| Document | Top-level shape | Item shape (index 0) | Suggested cheap invariant |
|---|---|---|---|
| `weekly-distance.json` | **array**, 489 entries in this archive | `{weekStartISO, totalKm, runCount, avgPaceMinPerKm, elevationGain, totalMovingTimeMin}` | `Array.isArray` + `length > 0` + `typeof arr[0].totalKm === 'number'` |
| `monthly-stats.json` | **array**, 125 entries | `{periodStart, periodLabel, totalKm, runCount, avgPaceMinPerKm, elevationGain, totalMovingTimeMin}` | same shape as weekly; `periodLabel` is a non-empty string |
| `yearly-stats.json` | **array**, 14 entries | `{periodStart, periodLabel, totalKm, runCount, ...}` — same field set as monthly | `Array.isArray` + `length > 0` |
| `year-over-year.json` | **array**, exactly 12 entries (one per calendar month, always pre-filled per `compute-advanced-stats.ts:104` comment) | `{month, monthLabel, years: {"<year>": {totalKm, totalRuns, totalHours}}}` | `Array.isArray(arr) && arr.length === 12` — the fixed length is itself a strong invariant a truncated file would fail |
| `best-efforts.json` | **object**: `{schemaVersion, generatedAt, note, totals, rankings, rejected, activities}` | `activities` is an object keyed by activity id (1859 keys in this archive); `rankings` is an object with one key per distance (7 keys: 400m/1k/1mi/5k/10k/half/marathon-shaped) | `schemaVersion === 1` + `Object.keys(activities).length > 0` + `rankings` is a non-null object |
| per-activity shard `best-efforts/{id}.json` | **object**: `{activityId, startDate, distanceSource, efforts: [...], excludedFromRecords}` | `efforts` is a non-empty array of `{distance, durationSec, paceSecPerKm, ...}` | `Array.isArray(efforts) && efforts.length > 0` |

**D-10's runtime sample derivation to extend** (the exact existing pattern at `verify-dashboard-publish.mjs` lines 355-362, quoted verbatim):
```javascript
// Source: scripts/verify-dashboard-publish.mjs (existing code, quoted verbatim)
const newestRow = indexDoc.activities[0];
const newestWithStream = indexDoc.activities.find((row) => row.streams?.available === true);
const newestWithoutStream = indexDoc.activities.find((row) => row.streams?.available === false);
```
The shard sample should follow this exact idiom: pick one or more activity ids from `indexDoc.activities` (already parsed earlier in `main()`) and `GET /data/stats/best-efforts/${id}.json`, asserting 200 + the shape above. **Directory naming confirmed:** shards live at `data/stats/best-efforts/<activityId>.json` (flat, one file per id, 1861 files in this archive as of research time — note this differs slightly from `best-efforts.json`'s 1859 `activities` keys, an existing and likely-benign discrepancy not in scope for this phase), and this directory is already copied wholesale by `build-widgets.mjs`'s `dataDirs` entry `{ src: 'data/stats', dest: 'dist/widgets/data/stats' }` (`scripts/build-widgets.mjs:141`) — no new copy-config needed, only new verifier assertions.

### Pattern 4: FIX-02's exact defect mechanism (traced, not assumed)

**Confirmed defect path**, read directly from `src/analytics/gear-aggregate-logic.ts`:
```typescript
// Source: src/analytics/gear-aggregate-logic.ts:145-148 (existing code, quoted verbatim)
for (const row of rows) {
  const label = row.gearName;
  const isUnknown = label === null;
  const mapKey = isUnknown ? unknownKey : (label as string);
  // ...
```
When `row.gearName` is `undefined` (the key is absent from a parsed `index.json` row, as opposed to present-and-`null`), `isUnknown` evaluates `false` (since `undefined !== null`), so the row is treated as **named** gear with `mapKey = undefined` and, later, `bucket.label = undefined`. That bucket then reaches:
```typescript
// Source: src/analytics/gear-aggregate-logic.ts:41-47 + :166-168 (existing code)
function slugify(label: string): string {
  const slug = label
    .toLowerCase()   // <-- throws here: Cannot read properties of undefined (reading 'toLowerCase')
    ...
}
// called from:
for (const bucket of namedBuckets) {
  const base = slugify(bucket.label);  // bucket.label is undefined for the malformed row
```
This confirms CONTEXT.md's canonical-ref citation exactly. There is a **second** site with the identical `=== null` assumption, in `buildGearCoverage` (`gear-aggregate-logic.ts:207`): `const hasGear = row.gearName !== null;` — this one does not crash (no `slugify` call), but silently mis-buckets an absent-key row as "has gear" for the coverage totals, which is also wrong and should be fixed by the same D-12 predicate for consistency, even though ROADMAP criterion 1 only names the crash.

**D-13's blast radius (small, confirmed by exhaustive grep of non-test production code touching `.gearName`):**

| File | Line | What it does | Breaks if `gearName` becomes optional? |
|---|---|---|---|
| `src/analytics/gear-aggregate-logic.ts` | 146-148 | `label === null` check | This IS the fix target |
| `src/analytics/gear-aggregate-logic.ts` | 207 | `row.gearName !== null` check | Same predicate widening applies here too (see above) |
| `src/analytics/compute-dashboard-index.ts` | 213-257 | **Producer**, not consumer — always assigns `gearName: gearId !== null ? ... : null`, never omits the key | No change needed; this is the code that (per D-13's own reasoning) does NOT hold once rows are re-parsed from `index.json` at runtime rather than freshly constructed in-memory |
| `scripts/verify-dashboard-publish.mjs` | 239-240 | `row.gearName !== null && row.gearName !== undefined` and `row.gearName ?? ''` | **Already optional-safe** — no change needed, this file already treats `gearName` as possibly absent |
| All `*.test.ts` fixture builders (9 files) | various | Explicitly set `gearName: null` in fixture objects | No change needed — `null` remains a valid value for `string \| null \| undefined` |

**This is the "small, bounded" case D-13 anticipated** — only the two `gear-aggregate-logic.ts` call sites need the predicate fix; nothing else in the codebase needs to change. Report this explicitly to the user/planner: **`tsc --noEmit` should be run after making the field optional as a confirming step**, but based on this grep, no overflow/todo is expected.

### Pattern 5: VER-01/D-06's `theme.test.ts` structure (for reuse, not literally a data table)

**Correction to CONTEXT.md's framing:** `theme.test.ts` does **not** use an `it.each`/table-driven structure over `(mode, prefersDark)` tuples — it is six separate, individually-named `it()` blocks inside `describe('resolveEffectiveTheme', ...)` (lines 139-164), one per combination:
```typescript
// Source: src/dashboard/theme.test.ts:139-164 (existing code, structure quoted)
describe('resolveEffectiveTheme', () => {
  it("explicit 'light' wins over system dark preference", () => { ... });
  it("explicit 'light' matches system light preference", () => { ... });
  it("explicit 'dark' with system light preference stays dark", () => { ... });
  it("explicit 'dark' with system dark preference stays dark", () => { ... });
  it("'auto' with system preferring dark resolves to 'dark'", () => { ... });
  it("'auto' with system preferring light resolves to 'light'", () => { ... });
});
```
D-06's parity pin can reuse this **exact set of six `(mode, prefersDark) → effective` combinations** as its test matrix (either as six more individual `it()` blocks, matching the file's own style, or refactored into a small local array iterated with `for...of` inside the new test file — either is consistent with this codebase, which has no `it.each` usage anywhere in the theme-related test files surveyed).

### Pattern 6: The mechanical answer to "how do you test a `<script>` tag inside an HTML file" (the hard research question)

**Confirmed facts:**
1. Test runner is `vitest` (`package.json:32`, `^4.0.18`).
2. `vitest.config.ts` sets `environment: 'node'` explicitly — **not** `'jsdom'` or `'happy-dom'`.
3. `jsdom` is **not installed**: `grep '"jsdom"' package.json` finds nothing, and `node_modules/jsdom` does not exist. The only `jsdom` reference in `package-lock.json` is as an optional peer dependency of `vitest` itself (never resolved/installed).
4. No file in this repo currently imports or configures a DOM environment for tests. `styles.test.ts` (the closest analog — it also reads a static asset, `styles.css`, for testing) uses `readFileSync` + `esbuild.transformSync`, **not** DOM parsing — it treats CSS as text/AST, never renders it.
5. The inline bootstrap script itself (`src/dashboard/index.html:36-54`) is a **small, self-contained IIFE** with exactly three external touchpoints: `localStorage.getItem(STORAGE_KEY)`, `window.matchMedia('(prefers-color-scheme: dark)').matches`, and `document.documentElement.setAttribute('data-theme', effective)`.

**Two realistic options, honestly weighed:**

**Option A — `node:vm` sandbox execution (RECOMMENDED, behavioural, achievable with zero new dependencies).**
Extract the script's source text from `index.html` via the same kind of regex `verify-dashboard-publish.mjs` already uses to extract `<script src="...">` (`indexHtml.match(/<script type="module"[^>]*\ssrc="([^"]+)"/)` at line 471) — here, extract the **inline** (no `src` attribute) `<script>` block's text content instead. Run that text via `vm.runInNewContext(scriptText, sandbox)` where `sandbox` provides minimal fakes:
```javascript
// Source: pattern using Node's built-in vm module (https://nodejs.org/api/vm.html);
// no Context7/library doc needed since vm is a core module, not a package.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function extractInlineBootstrap(html) {
  // Match the FIRST <script> with no src attribute (the bootstrap), not the
  // trailing <script type="module" src="./main.ts">.
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('inline theme bootstrap script not found in index.html');
  return match[1];
}

function runBootstrap({ storedValue, prefersDark, throwOnGet = false }) {
  let appliedAttr = null;
  const sandbox = {
    localStorage: {
      getItem: () => {
        if (throwOnGet) throw new Error('blocked');
        return storedValue;
      },
    },
    window: { matchMedia: () => ({ matches: prefersDark }) },
    document: {
      documentElement: {
        setAttribute: (name, value) => {
          if (name === 'data-theme') appliedAttr = value;
        },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(extractInlineBootstrap(readFileSync('src/dashboard/index.html', 'utf8')), sandbox);
  return appliedAttr;
}
```
This gives **real behavioural parity testing**: run the same six `(mode, prefersDark)` combinations from Pattern 5 through `runBootstrap()` and assert the result equals `resolveEffectiveTheme(mode, prefersDark)` from the real `theme.ts` module — genuine cross-implementation parity, not string matching. It also directly supports D-04's tamper-guard claim (pass a `storedValue` outside the allow-list and confirm it still falls back to `auto`-equivalent behaviour) and can assert the allow-list literal is intact structurally (three specific strings compared, not regex-guessed).

**Tradeoffs of Option A:** `vm.runInContext` executes arbitrary extracted source in a *shared-realm* sandbox (not a fully isolated V8 context with its own global object unless `vm.createContext` is used, which the example above does use) — safe for this use case since the script is first-party repo code, not untrusted input. It does not model real DOM semantics beyond what's stubbed (no real `Document`, no real CSSOM) — but the bootstrap only touches three APIs, all mocked above, so this is not a limitation for this specific test target.

**Option B — Source-text-only pin (weaker, fallback only).**
Regex/substring-match the extracted script text for structural invariants: the three-way allow-list literal (`'light'`, `'dark'`, `'auto'`), the `STORAGE_KEY` literal `'dashboard-theme'` matching `THEME_STORAGE_KEY` from `theme.ts`, and that the `<script>` tag appears before the `<link rel="stylesheet">` tag in `index.html` (a position invariant, straightforwardly text-based and legitimate on its own). **This does not prove behavioural parity** — a bug where, say, the `auto` branch's condition were accidentally inverted would still pass a source-text pin as long as the literals are present. CONTEXT.md's D-06 explicitly asks for "behavioural parity... across the same mode/prefersDark combinations," which Option B cannot honestly claim to deliver. **Recommendation: use Option A for the behavioural claim; Option B's script-before-stylesheet position check is worth keeping as a supplementary, cheap structural assertion alongside it, not instead of it.**

### Anti-Patterns to Avoid

- **Do not install `jsdom` (or any headless-browser dependency) for D-06.** This repo has twice documented (once in `verify-dashboard-publish.mjs`'s own header comment, once in this phase's CONTEXT.md canonical refs) a deliberate decision to keep browser-behavioural claims out of the automated suite and gated behind human checkpoints instead — the `node:vm` sandbox is a narrow, justified exception because it tests a ~20-line first-party IIFE, not general DOM behaviour, and needs zero new dependencies.
- **Do not build a generated/codegen manifest for CI-01.** D-01 explicitly rejected this shape already; re-litigating it wastes a planning cycle.
- **Do not widen FIX-02's fix beyond `gear-aggregate-logic.ts`'s two call sites** without checking `tsc --noEmit` first, per D-13's bounded-triage rule — the grep in Pattern 4 above found nothing else, but the planner should still run the compiler check as a task, not skip it on the strength of this research alone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Sandboxed JS execution for D-06 | A custom regex-based "interpreter" or manual AST walk of the bootstrap script | `node:vm`'s `runInContext`/`createContext` | Built-in, exactly fit for "run this small trusted script with fake globals," no dependency |
| CLI flag parsing for D-02 | A new `yargs`/`commander`/`minimist` dependency | `process.argv.includes('--ci')`, matching the file's existing positional-arg style | One boolean flag does not justify a new dependency in a codebase with zero existing CLI-parsing libraries |
| Nightly workflow dry-run mechanism | Installing `nektos/act` to fake a local Actions run, or writing a bespoke re-implementation of the eight steps in a shell script | The workflow's **already-configured** `workflow_dispatch` trigger (`daily-refresh.yml:37-43`, confirmed present) — manually triggerable via `gh workflow run "Daily Widget Refresh"` or the Actions UI "Run workflow" button | Zero new infrastructure; this is the literal "real (or dry-run) nightly workflow execution" criterion 5 asks for, and it already exists |

**Key insight:** every "don't hand-roll" item above resolves to "this repo (or Node itself) already has the tool; do not add a dependency or reinvent one line of `process.argv` handling."

## Runtime State Inventory

Not applicable — this phase touches no rename/rebrand/refactor of identifiers, no datastore keys, no OS-registered state, and no secrets. It is a collapse of CI step structure (same underlying compute functions, same file outputs), an additive set of HTTP assertions, a null/undefined predicate fix, and a new test file. Skipping this section per its own trigger condition (rename/refactor/migration phases only).

## Common Pitfalls

### Pitfall 1: VER-01's first-paint row is unsatisfiable as literally worded (already caught in CONTEXT.md D-05, restated here for the planner's benefit)
**What goes wrong:** Observing "no first-paint white flash" on a light-OS machine is vacuous — `--bg: #ffffff` (`styles.css:18`) IS the correct light-theme background, so a white first frame on a light OS is the **passing** state, indistinguishable from a broken bootstrap that always paints white regardless of OS setting.
**Why it happens:** The requirement's literal wording ("legibility on a light-OS machine... absence of a first-paint white flash") reads as one continuous scenario, but the two clauses need different OS states to be discriminating.
**How to avoid:** D-05 already resolves this — observe legibility on light OS, observe the first-paint flash row on **dark** OS (where `--bg: #1a1a2e` makes a white first frame an unambiguous failure and the dark background an unambiguous pass). **This must be disclosed as a deliberate deviation from criterion 4's literal wording in the validation write-up**, per D-05's own text — do not quietly substitute without a written note.
**Warning signs:** A checkpoint row whose "pass" state and its own precondition produce the same rendered output (this is the same defect class as Phase 24's R26/GAP-24-05 — a row whose mandated setup emptied its own discriminator).

### Pitfall 2: A localStorage-touched browser makes every subsequent VER-01 row meaningless
**What goes wrong:** `theme.ts`'s `readStoredMode` reads the persisted mode key BEFORE ever consulting `prefers-color-scheme` — so a browser profile where the in-page theme toggle (or any prior visit) has ever written to `localStorage['dashboard-theme']` will silently ignore the OS-level setting entirely, for both the light-OS legibility row and the live-follow row.
**Why it happens:** `THEME_STORAGE_KEY` persistence is intentional (D-06's own module doc: "persists the chosen MODE... to localStorage"), but it means a masked/stale-storage browser produces a row that LOOKS identical to a correctly-auto-following one.
**How to avoid:** D-04 already specifies the fix — start from cleared site data (or a fresh browser profile) and quote `localStorage.getItem('dashboard-theme')` returning `null` at the instant of observation, for every round.
**Warning signs:** A checkpoint round that reuses a browser profile from an earlier round/phase without an explicit storage-clear step.

### Pitfall 3: The inline bootstrap and `theme.ts` can silently diverge with no test noticing
**What goes wrong:** `index.html`'s inline `<script>` is a hand-maintained COPY of `parseThemeMode`/`resolveEffectiveTheme`'s logic (not an import — it must run synchronously before any module script, per the file's own comment). Nothing in the existing 24-case `theme.test.ts` suite touches `index.html` at all; only `build-widgets.mjs` reads that file (to copy/process it), and never for logic verification.
**Why it happens:** The duplication is structurally necessary (a `type="module"` script is deferred until after HTML parsing, which would let the page paint the wrong theme first) — but structurally-necessary duplication is exactly the kind Phase 24's WR-17 precedent flags as "defeats checkpoints" if left unpinned.
**How to avoid:** D-06's behavioural pin (Pattern 6, Option A above).
**Warning signs:** Any future edit to `theme.ts`'s allow-list or resolution logic that does not also touch `index.html` in the same commit.

### Pitfall 4: `computeAllStatsCommand` has zero test coverage today, which will make a naive D-01 change unverifiable
**What goes wrong:** If the planner edits `computeAllStatsCommand`'s ordering/flag logic in place without extracting a testable data structure, there is no way to write a unit test proving the order or the mandatory/tolerated split without either mocking every `import()` call or actually running the real compute pipeline (which needs a real `data/activities/` archive and takes real time).
**Why it happens:** The function was written as an imperative CLI command, not as a library function; `process.exit()` calls inside it make it fundamentally hard to import-and-test.
**How to avoid:** Pattern 1 above — extract the ordered step list as a plain, exported array/const that a test can import without triggering any of the actual `import()` side effects (test only the metadata: names, order, `mandatory` flags — not the `run` functions themselves, which remain integration-only).
**Warning signs:** A plan that touches `computeAllStatsCommand`'s body directly with no accompanying new/updated test file.

### Pitfall 5: CI-02's six new assertions may still pass on a truncated file if D-09's invariant is too weak
**What goes wrong:** A bare `expect200` (as noted in D-09 itself) would pass a zero-byte or `{}` response. For the four ARRAY-shaped documents (`weekly-distance.json`, `monthly-stats.json`, `yearly-stats.json`, `year-over-year.json`), an empty-array `[]` response is valid JSON, parses fine, and still needs an explicit non-empty-length check to be caught.
**Why it happens:** JSON.parse succeeding is a much weaker signal than "the document has real content" — this is the exact failure mode D-09's docstring anticipates ("a truncated or empty file would fail... non-empty array, expected top-level key, plausible count").
**How to avoid:** Use the length/shape table in Pattern 3 above — every one of the six new assertions needs an explicit non-empty/shape check beyond `expect200`'s default `nonEmpty: true` body-length check (which only catches a literal zero-byte body, not an empty-but-valid `[]` or `{}`).
**Warning signs:** A new assertion block that calls `expect200` and stops, with no follow-up `Array.isArray`/`Object.keys().length` check.

### Pitfall 6: WR-19's fix must not change the guard's fail-closed posture
**What goes wrong:** `findCurationArtifacts` currently fails the **build** (via its caller `assertNoCurationArtifacts` in `build-widgets.mjs`, per the module's own docblock) whenever it throws — which is actually SAFE (nothing unsafe ships), just unattributed. A naive fix that swallows the `readdirSync` error and treats it as "no violations found, continue" would flip a fail-closed defect into a fail-open one — much worse.
**Why it happens:** The natural instinct on seeing an uncaught exception is to catch-and-continue; here the correct fix is catch-and-REPORT-AS-A-VIOLATION (matching the existing `readFileSync` pattern exactly), which still aborts the build, but with an attributed message instead of a raw stack trace.
**How to avoid:** Mirror the exact `readFileSync` try/catch pattern at `curation-guard.mjs`'s content-scan block (quoted in full below) — push a `{ path: dir, reason: 'could not be listed (...) — an unreadable directory cannot be certified free of the "__curate" marker' }`-shaped violation object, `continue`/return without descending further, rather than swallowing silently.
**Warning signs:** A fix where the new test only asserts "does not throw" rather than "throws no exception AND returns a non-empty violations array naming the unreadable directory."

## Code Examples

### CI-01: existing 8-step order in `daily-refresh.yml` vs. `computeAllStatsCommand` (the confirmed drift)

```yaml
# Source: .github/workflows/daily-refresh.yml (existing code, order only, quoted from step names)
# Steps 3-4 are ONE step ("Process statistics"), mandatory (no continue-on-error):
- run: node dist/index.js compute-stats && node dist/index.js compute-advanced-stats
# Steps 5-10, each its own step, all continue-on-error: true, each paired with a
# "Warn on X failure" step using `if: steps.X.outcome == 'failure'`:
- id: geocode          # compute-geo-stats
- id: best-efforts      # compute-best-efforts
- id: dashboard-index   # compute-dashboard-index   <-- BEFORE age-grading here
- id: age-grading       # compute-age-grading       <-- AFTER dashboard-index here
- id: gear-aggregate    # compute-gear-aggregate
- id: training-load     # compute-training-load
```
```typescript
// Source: src/index.ts:329-392 (existing code, order only, quoted from the
// function's own comments and import order)
// "Chain ordering below is load-bearing" — computeAllStatsCommand's actual
// call order:
// 1. computeAllStats (basic)
// 2. computeAdvancedStats
// 3. computeGeoStats
// 4. computeBestEfforts
// 5. computeAgeGrading        <-- BEFORE dashboard-index here
// 6. computeDashboardIndex    <-- AFTER age-grading here
// 7. computeGearAggregate
// 8. computeTrainingLoad
```
**Both orderings are currently harmless** (per the code's own comment: neither `computeAgeGrading` nor `computeDashboardIndex` depends on the other's output — both only need `best-efforts.json`), but they are two independently hand-maintained ORDERS of the same eight names, exactly the "no shared source of truth" CI-01 exists to close. Also note: the workflow's mandatory pairing (`compute-stats && compute-advanced-stats` in one step, `continue-on-error` unset) matches D-03's mandatory/tolerated split exactly, and every one of the six tolerated workflow steps already has a paired `::warning::` annotation step that the planner should note is EXPECTED to disappear (per D-01's "Accepted cost" — the eight separate green/red boxes collapse into one, so the command's own logging must carry that weight going forward, e.g. via a printed end-of-run summary per D-03).

### WR-19: the exact try/catch pattern to mirror (readFileSync case, apply the same shape to readdirSync)

```javascript
// Source: scripts/lib/curation-guard.mjs (existing code for the SIBLING file-read
// case, quoted verbatim — WR-19's fix should apply the identical shape to the
// unguarded `readdirSync(dir, { withFileTypes: true })` call at line 83, inside
// the `walk(dir)` function defined at line 82)
let content;
try {
  content = readFileSync(entryPath, 'latin1');
} catch (error) {
  violations.push({
    path: entryPath,
    reason: `could not be read for scanning (${error.code ?? error.message}) — an unscannable file cannot be certified free of the "${CURATE_MARKER}" marker`,
  });
  continue;
}
```
The corresponding test fixture pattern (from `curation-guard.test.mjs`'s WR-14 describe block) to mirror for the new mode-000-**directory** case:
```javascript
// Source: scripts/lib/curation-guard.test.mjs:227-241 (existing code, the FILE
// case — WR-19's new fixture should be the directory-shaped sibling: chmodSync
// a DIRECTORY to 0o000 instead of a file, then assert the violation's `reason`
// includes 'could not be listed' (or whatever wording the fix uses) and an
// error code, mirroring this exact structure)
it('(c) mode-000 regular file: reported via the read try/catch, citing EACCES (WR-14)', () => {
  if (process.getuid?.() === 0 || process.platform === 'win32') return; // root/win32 skip
  const target = path.join(tmpDir, 'wr14-secret.js');
  writeFileSync(target, 'x');
  chmodSync(target, 0o000);
  const violations = findCurationArtifacts(tmpDir);
  expect(
    violations.some(
      (v) => v.path === target && v.reason.includes('could not be read for scanning') && v.reason.includes('EACCES')
    )
  ).toBe(true);
});
```
Note the existing test file's `afterEach` already contains a `chmodSync(mode000Path, 0o600)` cleanup step for the file case — the new directory fixture will need an analogous cleanup (`chmodSync(mode000DirPath, 0o700)`) before `fs.rm(tmpDir, { recursive: true })`, or the recursive removal itself will fail on the still-unreadable directory (the existing test file's own comment at line 38 already flags this exact concern: "Recursive removal can itself [fail]").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Eight separate workflow steps, each independently `continue-on-error`, mirrored by a differently-ordered in-code chain | One `compute-all-stats --ci` invocation as the single source of truth for order + disposition | This phase (D-01) | Actions UI loses per-step granularity (accepted cost per D-01); diagnosing failures moves into the command's own stdout/summary, which must be written to carry that weight |
| Whole-directory copy (`data/stats` → `dist/widgets/data/stats`) trusted implicitly to carry every stats document | Explicit by-name HTTP reachability + shape assertions for each document `verify-dashboard-publish.mjs` currently doesn't check | This phase (D-09/D-10) | A dropped/renamed compute step or a broken copy config now fails the publish gate loudly instead of silently 404ing in production only |
| `gear-aggregate-logic.ts`'s Unknown-bucket test: strict `label === null` | `typeof label !== 'string' \|\| label === ''` (D-12) | This phase | Catches `undefined` (absent key), non-string malformed shapes, and empty-string labels — all previously either crashing or silently mis-bucketed |

**Deprecated/outdated:** None — this phase does not touch any library version; it is entirely internal code/process hardening.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The exact flag spelling `--ci` used in code examples is illustrative only; D-02 explicitly leaves the final spelling to the planner | Pattern 2, Code Examples | None if the planner picks a different spelling — this is disclosed as illustrative, not prescriptive |
| A2 | `node:vm`'s `runInContext`/`createContext` API is stable across the Node LTS version this repo targets (`.github/workflows/daily-refresh.yml` pins `node-version: '22'`) | Pattern 6 | LOW — `vm` is a long-stable core module; no version-specific API used in the example that isn't available since early Node versions |
| A3 | The suggested new test file name `src/dashboard/theme-bootstrap-parity.test.ts` is a naming suggestion only, not a locked requirement | Recommended file-touch map | None — CONTEXT.md only requires the pin to sit "alongside" `theme.test.ts`, not under a specific filename |

**Note on provenance:** every other claim in this document was verified directly by reading this repository's own source files (`.github/workflows/daily-refresh.yml`, `src/index.ts`, `scripts/verify-dashboard-publish.mjs`, `scripts/build-widgets.mjs`, `src/analytics/gear-aggregate-logic.ts` and its test, `src/analytics/gear-naming.ts`, `src/analytics/dashboard-index.types.ts`, `src/dashboard/theme.ts`, `src/dashboard/index.html`, `src/dashboard/theme.test.ts`, `src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `scripts/lib/curation-guard.mjs` and its test, `package.json`, `vitest.config.ts`, and the generated `data/stats/*.json` files on disk) or by running local commands (`npm view`-equivalent checks were not needed since no packages are installed; `ls`/`python3 -c` shape inspection of the real generated JSON; `command -v gh`/`act` availability checks). These are tagged `[VERIFIED: local source read]` implicitly throughout — no `[CITED]` or `[ASSUMED]` tags were needed beyond the three items in this table, since this phase's research surface is entirely first-party code, not third-party documentation.

## Open Questions

1. **Exact wording of the `--ci`/`--continue-on-error` flag (D-02)**
   - What we know: D-02 explicitly delegates the exact spelling to the planner; the codebase has no existing flag-naming convention to follow (zero prior `--flag`-style arguments anywhere in `src/index.ts`).
   - What's unclear: Whether the planner should also update `printHelp()`'s `compute-all-stats` help line to document the new flag (recommended, for consistency with how every other command is documented there).
   - Recommendation: Pick a short, self-explanatory name (`--ci` is fine) and add one line to `printHelp()`'s existing compute-all-stats help text and examples block (lines ~603, ~621) — this is a one-line addition, not a design decision.

2. **Whether to also fix `buildGearCoverage`'s parallel `!== null` check (`gear-aggregate-logic.ts:207`)**
   - What we know: ROADMAP criterion 1 only names the crash (`slugify(undefined)`), which comes from the `buildGearAggregate` function; `buildGearCoverage`'s separate `hasGear = row.gearName !== null` check has the identical presence-assumption bug but does not crash — it just silently mis-counts an absent-key row as "has gear" in the coverage totals.
   - What's unclear: Whether this is in-scope for FIX-02 or should be filed as a separate follow-up, given D-13's explicit "bounded" instruction not to let the phase grow.
   - Recommendation: Fix it in the same task as the crash fix — it is the exact same one-line predicate change (`typeof label !== 'string' || label === ''` reused), in the same file, requiring no additional investigation; deferring it would leave a known-identical bug pattern unfixed for no savings in scope. If the planner disagrees, record it as a todo rather than silently leaving it.

3. **Whether CI-01's step-table refactor (Pattern 1) is in scope, or whether the planner should make a smaller, non-refactored change**
   - What we know: D-01 requires `computeAllStatsCommand` to become "the sole declaration of both the order and each step's failure disposition," and the function currently has zero test coverage, making an untested inline change hard to verify per this project's own Nyquist-validation discipline.
   - What's unclear: Whether the planner judges the step-table extraction (Pattern 1) worth the extra surface area, versus a minimal inline change with only integration-level (not unit-level) verification.
   - Recommendation: Extract the table — it is a small, low-risk refactor that directly enables the unit test D-01's own intent implies ("single source of truth" should be checkable by a test, not just readable by a human), and this research found no test currently covering `computeAllStatsCommand` at all, which is itself worth closing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All four items (compute chain, verifier script, gear logic, theme test) | ✓ | Repo targets Node 22 in CI (`daily-refresh.yml`); local environment not separately re-verified in this research pass since all work is source-level | — |
| `vitest` | Regression tests for FIX-02, CI-01's step table, WR-19's fixture, VER-01/D-06's parity pin | ✓ | ^4.0.18, installed (`package.json`) | — |
| `jsdom` | Would be needed ONLY if the planner rejects the `node:vm` approach (Pattern 6, Option A) in favor of a real DOM | ✗ | not installed | `node:vm` sandbox (recommended) or source-text-only pin (weaker) — see Pattern 6 |
| `gh` CLI | Manually triggering the nightly workflow for criterion 5's "real (or dry-run) execution" evidence | ✓ | 2.86.0, confirmed installed and on `PATH` | — |
| `act` (local GitHub Actions runner) | An alternative way to "dry-run" the workflow locally | ✗ | not installed | Not needed — `workflow_dispatch` already exists on `daily-refresh.yml` (confirmed, lines 37-43), so `gh workflow run "Daily Widget Refresh"` (or the Actions UI "Run workflow" button) produces a REAL run on demand, which is what criterion 5 asks for; no local runner is necessary |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `jsdom` (fallback: `node:vm` sandbox, recommended over jsdom regardless — see Pattern 6); `act` (fallback: `gh workflow run` against the already-present `workflow_dispatch` trigger, which is a stronger form of evidence than a local `act` run since it exercises the real GitHub Actions runner, not an emulation).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (`environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`) |
| Quick run command | `npx vitest run <path-to-file>` (single file) |
| Full suite command | `npm test` (currently 60 files / 1560+ tests, per Phase 24's last recorded gate run) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| FIX-02 | Absent `gearName` key degrades to Unknown bucket instead of crashing `slugify` | unit | `npx vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ existing file — add new case(s) for the absent-key shape (D-12) |
| FIX-02 | `gearName` optional on the row type; `tsc` enumerates consumers | type-check | `npx tsc --noEmit` | N/A — compiler check, not a test file |
| CI-01 | `compute-all-stats`'s step order and mandatory/tolerated split are a single, testable source of truth | unit | `npx vitest run src/index.test.ts` (or wherever the extracted step-table constant is tested — **Wave 0 gap**, no such file exists today) | ❌ Wave 0 |
| CI-01 | The `--ci` flag changes tolerated-step disposition without changing mandatory-step disposition | unit | same new test file as above | ❌ Wave 0 |
| CI-02 | Six named documents (weekly-distance, monthly-stats, yearly-stats, year-over-year, best-efforts.json, a shard sample) are reachable and structurally sane | integration (HTTP smoke) | `npm run verify-dashboard` (extends the existing script — no new file) | ✅ existing file, extended |
| CI-02 | Each of the six new assertions has been observed RED once (D-11 precedent) | manual/scripted one-off (not a persistent test — a deliberate delete/truncate/restore cycle) | ad hoc: truncate the target file in a scratch `dist/widgets`, run `npm run verify-dashboard`, confirm non-zero exit naming that document, restore, re-run green | N/A — this is a validation-round activity, not a committed test file (mirrors D-11's own framing exactly) |
| WR-19 | Unreadable (mode-000) directory under `dist/widgets` is reported as a violation, not thrown | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ existing file — add the mode-000-directory fixture (D-11 precedent: observe RED first) |
| VER-01 | Inline theme bootstrap resolves the same `(mode, prefersDark) → effective theme` as `theme.ts`, across all six combinations, with the allow-list intact | unit (behavioural, `node:vm` sandbox) | `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` (suggested new filename) | ❌ Wave 0 — new file, Pattern 6 Option A |
| VER-01 | Legibility, first-paint flash, and live OS-follow on a genuinely light/dark-OS machine | manual (human checkpoint) | N/A — browser checkpoint only, per ROADMAP criterion 5 and this project's Verification Note (no jsdom, no headless browser in this repo) | N/A |

### Sampling Rate
- **Per task commit:** run the single affected test file (`npx vitest run <file>`), plus `npx tsc --noEmit` for FIX-02's type change specifically.
- **Per wave merge:** `npm test` (full suite) + `npm run build` + `npm run build-widgets` + `npm run verify-dashboard`.
- **Phase gate:** full suite green, plus the human checkpoint (criterion 5) — a genuinely light-OS-then-dark-OS browser round per D-04/D-05/D-07/D-08, and a real or `workflow_dispatch`-triggered nightly run for CI-01's evidence.

### Wave 0 Gaps
- [ ] A new test file (or extension of an existing one) covering `computeAllStatsCommand`'s extracted step-table — currently **zero** test coverage exists for any command in `src/index.ts`. Suggested: extract the pure step-list constant per Pattern 1 and put a new `src/index-compute-all-stats.test.ts` (or similarly-scoped file) alongside it, importing only the constant (not the CLI wrapper), to avoid needing to mock `process.exit`.
- [ ] `src/dashboard/theme-bootstrap-parity.test.ts` (or planner's chosen name) — D-06's `node:vm`-based behavioural pin; does not exist today.
- [ ] `scripts/lib/curation-guard.test.mjs`'s mode-000-**directory** fixture (WR-19) — the file fixture (WR-14 case c) exists; the directory-shaped sibling does not.
- [ ] `verify-dashboard-publish.mjs`'s six new assertion blocks (CI-02) — additive to an existing, well-tested file; no framework gap, just missing assertions.

*(No framework installation gap — vitest is already fully configured and in use for every item above.)*

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per this project's own convention), so this section is included, though this phase's security surface is minimal — no new external input, no new auth/session code, no new cryptography.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase (the curate server's Origin/Host gating was closed in Phase 24; WR-19 is availability/attribution, not access control) |
| V5 Input Validation | Marginal | FIX-02's widened predicate (`typeof label !== 'string' \|\| label === ''`) IS an input-validation hardening of a value parsed from `index.json` at runtime — treat this as the relevant control, already the correct shape (type + emptiness check, not a hand-rolled sanitizer) |
| V6 Cryptography | No | Not touched |
| V1 Architecture (fail-closed error handling) | Yes | WR-19's fix must preserve fail-closed behaviour (Pitfall 6 above) — an unreadable directory must still abort the build via a reported violation, never silently continue as "clean" |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A build-time guard silently downgrades from fail-closed to fail-open when its own internal call throws | Tampering / Repudiation (an attacker-controlled or accidentally-hostile filesystem entry could suppress detection) | Wrap the throwing call in try/catch and convert the exception into a reported violation (WR-19's fix, mirroring the existing WR-14 `readFileSync` pattern) — never a bare catch-and-ignore |
| A publish verifier's "reachable" check passes on a truncated/empty file, masking a broken compute step in production | Tampering (of data integrity, not security in the classic sense, but the same "verifier lies" failure class this repo has hit three times per its own Verification Note) | D-09's structural invariant per document (non-empty array/expected key), not a bare `expect200` |

## Sources

### Primary (HIGH confidence — direct source reads, this session)
- `.github/workflows/daily-refresh.yml` — full file read, all 8 compute steps, `continue-on-error` dispositions, `::warning::` pairings, `paths` trigger, `workflow_dispatch` presence, blocking `npm test`/`npm run verify-dashboard` gate placement
- `src/index.ts` — lines 1-60, 250-420, 595-690 read; `computeAllStatsCommand`, the CLI command switch, `process.argv` usage, `printHelp()` text
- `scripts/verify-dashboard-publish.mjs` — full 494-line file read; `expect200`/`expect404`/`ok`/`fail` signatures, existing by-name assertions, runtime sample derivation, server/mount-prefix mechanics
- `scripts/build-widgets.mjs` — `dataDirs`/`dataFiles` copy config confirmed (data/stats already wholesale-copied)
- `src/analytics/gear-aggregate-logic.ts`, `gear-aggregate-logic.test.ts`, `gear-naming.ts`, `dashboard-index.types.ts` — full/targeted reads; defect path traced exactly, blast radius grepped exhaustively across `src/` and `scripts/`
- `src/dashboard/theme.ts`, `index.html`, `theme.test.ts`, `styles.css` (lines 10-25, 100-110), `styles.test.ts` (line ~780 region) — full/targeted reads
- `scripts/lib/curation-guard.mjs`, `curation-guard.test.mjs` — full/targeted reads; exact WR-19 fix-mirror pattern confirmed
- `.planning/todos/pending/2026-09-02-wr19-curation-guard-directory-eacces.md` — full read
- `package.json`, `vitest.config.ts`, `package-lock.json` (jsdom grep) — confirmed no jsdom, `type: module`, test scripts
- `data/stats/*.json` (weekly-distance, monthly-stats, yearly-stats, year-over-year, best-efforts.json, a sample shard) — parsed directly with `python3 -c` to confirm real shapes, not assumed from any schema doc
- `.planning/phases/24-local-curation-mode/24-VALIDATION.md` § "Round 4 Checkpoint (R32-R35)" — full section read for row-structure precedent
- Local environment probes: `command -v gh`/`act`, `ls node_modules/jsdom`

### Secondary (MEDIUM confidence)
- None — no external documentation lookups were needed; this phase's entire research surface is first-party repository code.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every tool cited is either already installed or a Node built-in confirmed by direct inspection
- Architecture: HIGH — all patterns and file-touch points read directly from source, not inferred
- Pitfalls: HIGH — each pitfall traces to a specific confirmed code path or a named precedent in this project's own validation history (24-VALIDATION.md, 19-VALIDATION.md)

**Research date:** 2026-09-03
**Valid until:** 30 days (stable, first-party-code-only research; the only external-facing fact — `gh` CLI version and `jsdom`'s non-installed status — is unlikely to change within that window, and the repo's own source is the source of truth regardless)
