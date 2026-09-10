---
phase: 27-per-activity-quality-signals
reviewed: 2026-09-10T17:28:16Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/analytics/pace-quality.ts
  - src/analytics/best-effort-utils.ts
  - src/analytics/compute-dashboard-index.ts
  - src/analytics/dashboard-index.types.ts
  - src/analytics/pace-fixtures.ts
  - src/dashboard/data/pace-quality-client.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/list-logic.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/styles.css
  - scripts/compute-pace-quality-calibration.mjs
  - scripts/compute-pace-quality-recount.mjs
  - scripts/verify-dashboard-publish.mjs
  - package.json
  - src/analytics/pace-quality.test.ts
  - src/analytics/best-effort-utils.test.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/analytics/pace-fixtures.test.ts
  - src/dashboard/data/pace-quality-client.test.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/list-logic.test.ts
  - src/dashboard/views/detail-sections.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-09-10T17:28:16Z
**Depth:** standard
**Files Reviewed:** 23 (14 production/script + 1 css/config + 8 test files read for failure-mode analysis)
**Status:** issues_found

## Summary

`pace-quality.ts` itself is careful, well-guarded code: every exported function is total against malformed input (`validateStreamSeries` gates every stream-derived signal, `notComputableSignals` is a single constructor, no `?? 0`/`|| 0` coercion anywhere). The calibration and recount scripts are properly separated (recount imports nothing from the classifier, writes nothing, single-shot `writeFileSync` after the full markdown string is built) and their mutation tests genuinely exercise a clean-vs-mutated-document diff rather than comparing an implementation to itself.

The one real defect found is a genuine, reproducible crash: `list.ts`'s new quality-badge code (`qualityBadgeSpecs`, and its callers `appendQualityBadges`/`activityRowAriaLabel`) destructures `row.quality` without a null/undefined guard, while three other places touched by this same phase (`list-logic.ts`'s `rowIsAnySevere`, `detail.ts`'s `indexClient.getRow(...)?.quality ?? null`, and this repo's own `ParsedDashboardIndexRow` type contract) all explicitly document and defend against exactly this row shape. See CR-01 below — this is not a hypothetical, it reproduces in three lines of Node.

Concern #1 (the `EXPLANATION_PROBE_SPECS` indirection) was investigated in detail and is answered below: the drift test does catch the specific silent-empty failure mode, for a subtle but real reason (an `undefined`-vs-`''` mismatch in the comparison), but that protection is accidental rather than asserted directly, and the probe object is hand-duplicated between production and test source with no shared constant (WR-01).

Concerns #2 (self-referential tests) and #3 (brittle `composeRowAriaLabel` occurrence-counting) did not turn up new instances beyond what already existed pre-phase; the phase's own new "cannot fail" guard tests (`anySevere` filter tests, recount mutation tests, fetch-count tests) are all independently derived and genuinely exercised. Concerns #4/#5/#6 (formatting/div-by-zero, `rawDeviceName` fabrication, script write-safety) turned up no defects — every numeric formatter checked null/NaN/zero cases explicitly, `rawDeviceName` never reaches the DOM outside `textContent`, and both scripts write their artifact only after the full output is assembled in memory.

## Critical Issues

### CR-01: `list.ts`'s quality-badge code crashes the entire Activities list / Overview render when a row's `quality` field is absent

**File:** `src/dashboard/views/list.ts:400-402` (`qualityBadgeSpecs`), reached via `src/dashboard/views/list.ts:535-537` (`appendQualityBadges`, called from `appendStatusBadges` at `list.ts:514`) and `src/dashboard/views/list.ts:593-597` (`activityRowAriaLabel`, called from `renderActivityRow` at `list.ts:648`)

**Issue:** `qualityBadgeSpecs` destructures `row.quality` unconditionally:

```ts
export function qualityBadgeSpecs(row: Pick<DashboardIndexRow, 'quality'>): QualityBadgeSpec[] {
  const specs: QualityBadgeSpec[] = [];
  const { decimation, gapProfile, impossibleSamples } = row.quality;   // <-- throws if row.quality is absent
  ...
```

If `row.quality` is `undefined` (or `null`), this throws `TypeError: Cannot destructure property 'decimation' of ... as it is undefined`. Reproduced directly:

```
$ node -e "
function f(row) { const {decimation} = row.quality; }
try { f({ quality: undefined }); } catch (e) { console.log('THREW:', e.message); }
"
THREW: Cannot destructure property 'decimation' of 'row.quality' as it is undefined.
```

This is not a hypothetical shape. This exact phase's own code proves it is real and expected:

- `src/analytics/dashboard-index.types.ts:146-160` — `ParsedDashboardIndexRow = Partial<DashboardIndexRow> & { id: string }`, with its own doc comment stating "no key can be assumed present" for data re-parsed from `data/dashboard/index.json` at runtime — which is exactly the data `list.ts` consumes (via `index-client.ts`, whose `fetchDocument()` does a blind `as DashboardIndexDocument` cast on the network response with zero field-level validation).
- `src/dashboard/views/list-logic.ts:341-350` — `rowIsAnySevere` reads `row.quality?.anySevere === true` specifically because "the list view consumes `ParsedDashboardIndexRow`-shaped data where no key is guaranteed present (T-27-28) ... a row with `quality` absent entirely is excluded rather than crashing."
- `src/dashboard/views/detail.ts:599` — `const quality = indexClient.getRow(detail.id)?.quality ?? null;` — same defensive pattern, applied correctly.
- `src/dashboard/views/list.ts:342` (`rowPaceDisagreement`) — `return row.paceDisagreement ?? null;` — the exact same "newly-added, possibly-stale" field, in the exact same file, defended correctly one field over.

So three sibling call sites in this same phase all defend against exactly this shape; `qualityBadgeSpecs` alone does not, despite being new code from this phase.

**Concrete failure scenario:** a browser tab left open across this deploy, or a CDN edge (GitHub Pages) still serving a cached pre-Phase-27 `data/dashboard/index.json` during its cache TTL, has rows with no `quality` key at all (schema version did not bump — this is documented in `dashboard-index.types.ts` as a "purely additive" field, exactly the scenario that makes stale caches plausible). The client fetches this old index, `index-client.ts` casts it straight to `DashboardIndexRow[]` with no validation, and the first row rendered by `buildMobileCardList`/`buildDesktopTable` (both loop with no per-row try/catch — `list.ts:846-848`, `list.ts:898-900`) throws inside `activityRowAriaLabel` → `qualityBadgeSpecs`. The uncaught exception aborts the `for` loop entirely: the Activities list renders empty/partial instead of degrading gracefully. `overview.ts` reuses the same `renderActivityRow` (`overview.ts:244`, `264`), so the Overview page breaks the same way. Contrast with `detail-sections.ts`'s `qualitySignalsSectionPlan`, which explicitly handles `quality === null` by returning five "not available" rows (D-08) — the render surface, alone among this phase's four touched consumers, has no equivalent fallback.

**Fix:** guard the destructure the same way `rowIsAnySevere`/`detail.ts` already do:

```ts
export function qualityBadgeSpecs(row: Pick<DashboardIndexRow, 'quality'>): QualityBadgeSpec[] {
  const specs: QualityBadgeSpec[] = [];
  const quality = row.quality;
  if (!quality) return specs;
  const { decimation, gapProfile, impossibleSamples } = quality;
  ...
```

and widen the parameter type to acknowledge the real runtime shape (`Pick<Partial<DashboardIndexRow>, 'quality'>` or reuse `ParsedDashboardIndexRow`), then add a test mirroring `list-logic.test.ts`'s `absent-quality` case (`makeRow({ quality: undefined as unknown as ActivityQualitySignals })`) through `qualityBadgeSpecs`/`activityRowAriaLabel`/`renderActivityRow` to close the gap permanently.

## Warnings

### WR-01: The `qualityBadgeSpecs` explanation-text probe is duplicated, unverified-non-empty source, and its safety net is accidental

**File:** `src/dashboard/views/detail-sections.ts:771-786` (`EXPLANATION_PROBE_SPECS`, `tieringExplanation`); `src/dashboard/views/detail-sections.test.ts:561-579` (the drift test)

**Issue (answering the review's Concern #1 directly):** `detail-sections.ts` sources its three tiering explanation strings from a module-load-time synthetic "always severe" probe row fed through `list.ts`'s `qualityBadgeSpecs`, then reads `.explanation` through `tieringExplanation`, which ends `?? ''` (`detail-sections.ts:784-786`):

```ts
function tieringExplanation(signal: ...): string {
  return EXPLANATION_PROBE_SPECS.find((spec) => spec.signal === signal)?.explanation ?? '';
}
```

**Traced whether the drift test actually catches the failure mode it names:** it does, but for a subtle, non-obvious reason. The drift test (`detail-sections.test.ts:561-579`) builds its own local `severeQuality` object — byte-for-byte identical in shape to the production `EXPLANATION_PROBE_SPECS` literal — feeds it through the SAME pure `qualityBadgeSpecs` function, and compares `sectionRows[N].explanation` (production path, via the `?? ''` fallback) against `bySignal.get(signal)` (test path, a raw `Map.get()` with no fallback, i.e. `undefined` when absent). Because `qualityBadgeSpecs` is pure and both call sites pass structurally identical input, a future gate change that makes the probe stop matching will make BOTH sides fail to produce a spec for that signal identically — but the production side reads `''` (from the fallback) while the test's `Map.get()` reads `undefined`, and `expect('').toBe(undefined)` fails `toBe`'s `Object.is` check. So the test does fire on the exact scenario the concern describes. This is a real, working safety net — but it works by accident of the `''`-vs-`undefined` asymmetry, not because anything asserts "this explanation string is non-empty." No test anywhere in this file directly asserts `row.explanation.length > 0` (checked: only `row.valueText` gets that assertion, at `detail-sections.test.ts:445`).

**Why this is still a Warning, not clean:** the production probe (`EXPLANATION_PROBE_SPECS`) and the test's `severeQuality` literal are two hand-typed copies of the same synthetic object with no shared constant. If a future refactor changes ONE of these two copies (e.g. to satisfy a new field requirement) without changing the other, the two would diverge; the drift test would then correctly fail — but for the wrong-looking reason (a value mismatch), not by directly reporting "the explanation went blank." A reviewer chasing that failure down would have to rediscover the `''`-vs-`undefined` mechanism from scratch.

**Fix:** add a direct, self-explanatory assertion next to the existing drift test, e.g. `for (const row of sectionRows.slice(0, 3)) expect(row.explanation.length).toBeGreaterThan(0);`, and consider exporting `EXPLANATION_PROBE_SPECS`'s input object as a single shared test fixture (or importing it into the test) so the two literals cannot silently diverge.

### WR-02: `qualityBadgeSpecs`'s "cannot render `null`/`NaN`" defence is correct but untested against a severe tier with a null evidence field

**File:** `src/dashboard/views/list.ts:404-441`

**Issue:** `qualityBadgeSpecs` correctly guards each branch with `&& decimation.zeroAdvanceFraction !== null` / `&& gapProfile.gapFraction !== null` / `&& impossibleSamples.count !== null` before formatting a percentage/count, per its own doc comment ("a severe tier whose own evidence field is `null` is a contradiction the classifier cannot produce ... this function returns no spec for that signal rather than printing a fabricated `null%`/`NaN`"). This is good defensive code. However, no test in `list.test.ts` actually constructs a `{ tier: 'severe', zeroAdvanceFraction: null, ... }` row to prove the function takes the "no spec" branch rather than the crash/`NaN` branch — every severe-tier test fixture I found supplies a non-null evidence field. This means the documented defense-in-depth is currently unverified by any test; a future regression that flips `!==` to `===`, or drops the guard, would not be caught.

**Fix:** add one test per signal constructing a severe tier with the evidence field `null` and asserting `qualityBadgeSpecs` returns no spec for that signal (mirroring the existing `not-computable`/`minor` "no spec" tests already present at `list.test.ts:621-631`).

### WR-03: `list.ts`'s new `composeRowAriaLabel` occurrence-count assertion duplicates an existing invariant in a second test file

**File:** `src/dashboard/views/list.test.ts:1042-1045`; cf. pre-existing `src/dashboard/row-semantics.test.ts:501-503`

**Issue:** Concern #3 asked whether the "occurs exactly twice" textual-coupling pattern has spread. It has spread by one instance: `list.test.ts` (new, phase 27) now separately re-asserts `composeRowAriaLabel(` occurs exactly twice in `list.ts`, an invariant `row-semantics.test.ts` (pre-existing, a different file) already asserts on the same source file. This specific instance is a legitimate regression guard — it verifies the phase's new filter-panel code did not accidentally touch the pre-existing aria-label fold — not a "test that cannot fail" in the self-referential sense (concerns #1/#2 were the sharper worry and did not pan out here). It is, however, a second place asserting the identical fact about the identical file, which is a small, avoidable duplication: a future intentional third `composeRowAriaLabel(` call site (a legitimate feature) would need two different test files updated in lockstep rather than one.

**Fix:** no urgent action; if convenient, fold this assertion into `row-semantics.test.ts` instead of duplicating it in `list.test.ts`, or have one delegate to a shared helper so the two counts cannot drift independently.

## Info

### IN-01: `compute-dashboard-index.ts`'s per-shard write loop is not transactional as a whole

**File:** `src/analytics/compute-dashboard-index.ts:412-419`

**Issue:** Each individual `fileStore.writeJson(...)` call is atomic (temp file + rename, confirmed in `src/storage/file-store.ts:15-31`), so no single shard file can end up half-written. But the loop writing all `pace-quality/{id}.json` shards runs after `data/dashboard/index.json` has already been written, and if the process is killed or a write throws partway through (e.g. disk full on shard #900 of 1,890), `index.json` (which references every activity as present) is already committed while some shards are missing. `verify-dashboard-publish.mjs` only spot-checks three sampled shard ids (`verify-dashboard-publish.mjs:775-780`), so this specific partial-failure mode would not necessarily be caught by the existing publish verification. This mirrors a pre-existing architectural pattern (`compute-best-efforts.ts`'s own per-id shard loop) rather than being unique to this phase, and a mid-run crash is a generic, already-accepted operational risk in this codebase — noted for completeness, not as a regression.

**Fix (optional):** if this failure mode is worth hardening, either write shards before the main index (so a partial run at worst leaves stale-but-present shards behind an unmodified index) or have `verify-dashboard-publish.mjs` sample proportionally to archive size rather than a fixed count of three.

### IN-02: `qualityBadgeSpecs` and `hasAnySevereSignal` — no bug found, but worth naming as swept

**File:** `src/analytics/pace-quality.ts:848-856`, `src/dashboard/views/list.ts:400-444`

**Issue:** Not a defect — recorded because this is the exact area three separate JSDoc comments name as the single most dangerous place for silent drift (D-01's "one definition, N readers"). Verified: `hasAnySevereSignal` is genuinely the sole implementation referenced by `list-logic.ts` (filter), `compute-dashboard-index.ts` (writer), and the calibration script (via the compiled `dist/` import) — the ONE deliberate second implementation is `compute-pace-quality-recount.mjs`, which re-derives its own arithmetic from tier strings only and is correctly forbidden from importing the classifier (confirmed: zero imports of `pace-quality` anywhere in that file). No drift found. Recorded here only so the sweep is visible in this report.

---

_Reviewed: 2026-09-10T17:28:16Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
