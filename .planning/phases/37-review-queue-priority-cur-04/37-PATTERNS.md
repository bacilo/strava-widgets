# Phase 37: Review-Queue Priority & CUR-04 - Pattern Map

**Mapped:** 2026-11-25
**Files analyzed:** 24 (8 new, 16 modified)
**Analogs found:** 24 / 24 (one new file, `data/curation/reviewed.json`, is a seed with only a shape analog)

Line numbers below are from the working tree at mapping time. Phase-37 RESEARCH.md names the proposed shapes; this file points the planner at the real code to copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/curate-queue/derive-flagged.mjs` (modify) | utility (zero-import derive) | transform | itself (`buildExclusionsMap`, `deriveFlaggedActivities`) | exact |
| `scripts/curate-server.mjs` (modify) | route/handler | request-response + file-I/O | `handleExclusionWrite`, `applyUpsert`/`applyRemove`, `writeAtomic` | exact |
| `scripts/curate-overlay/index.ts` (modify) | service (fetch transport) | request-response | `saveExclusion` / `removeExclusion` (lines 121-146) | exact |
| `scripts/curate-queue/index.ts` (modify) | component (DOM) | event-driven render | itself (existing rows, malformed note) | exact |
| `scripts/lib/curation-guard.mjs` (modify) | utility (pure guard) | batch tree-walk | itself (`.curate-dist` name rule, lines 114-151) | exact |
| `scripts/verify-dashboard-publish.mjs` (modify) | guard (HTTP) | request-response | `expect404` list (lines 474-478) | exact |
| `scripts/compute-review-queue-recount.mjs` (new) | utility (zero-import recount) | batch/transform | `scripts/compute-unreliable-segment-recount.mjs` | role-match |
| `scripts/compute-review-queue-recount.test.mjs` (new) | test | transform | `compute-unreliable-segment-recount.test.mjs`, `compute-clean-window-recount.test.mjs` | role-match |
| `scripts/<new>-import-guards.test.mjs` (new, `vi.mock('fs')`) | test | batch | `scripts/unreliable-segment-import-guards.test.mjs` | exact |
| `data/curation/reviewed.json` (new seed) | config/data | file-I/O | `data/best-effort-exclusions.json` (shape only) | shape-match |
| `src/analytics/compute-best-efforts.ts` (modify) | service | transform | itself (`computeActivityEfforts` Branch 2/3, `round1`) | exact |
| `src/analytics/best-effort.types.ts` (modify) | model | n/a | itself (`contaminated` docblock) | exact |
| `src/dashboard/data/best-efforts-client.ts` (modify) | utility (parser) | transform | itself (`parseActivityBestEfforts`, `VALID_DEMOTION_GUARDS`) | exact |
| `scripts/exclusion-cli.mjs` + test (modify, optional A7) | CLI | request-response | itself | exact |
| `package.json` (modify) | config | n/a | existing `compute-*-recount` script entries | exact |
| Tests that assert old behaviour (see section below, 8 files) | test | n/a | themselves | exact |

## Pattern Assignments

### `scripts/curate-queue/derive-flagged.mjs` (utility, transform)

**Analog:** itself. Hard contract: `.mjs`, zero `import`, zero `console` (bundled by esbuild into the browser, run by vitest in Node).

**Reviewed-map parser: copy `buildExclusionsMap`** (lines 62-86), swapping the doc key to `reviewed`, requiring `reviewedAt` and `fingerprint` strings:
```javascript
function buildExclusionsMap(exclusionsDoc) {
  const map = new Map();
  const exclusions =
    exclusionsDoc && Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
  let skippedCount = 0;
  for (const entry of exclusions) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.activityId !== 'string' ||
      entry.activityId === '__proto__' ||
      typeof entry.reason !== 'string' ||
      entry.reason.trim() === ''
    ) {
      skippedCount += 1;
      continue;
    }
    if (map.has(entry.activityId)) {
      skippedCount += 1;   // duplicate counted once
      continue;
    }
    map.set(entry.activityId, entry.reason);
  }
  return { map, skippedCount };
}
```
**Sibling-count export: copy `countMalformedExclusions`** (lines 101-103): `return buildExclusionsMap(doc).skippedCount;` as `countMalformedReviewed`. Do not change existing return shapes (docblock lines 94-96 states this rule).

**Core derive loop to extend** (lines 138-199). Defensive-input idiom to keep: `activities` defaults to `{}`, `efforts` to `[]`, `__proto__` skipped, a `demotion` that is not a non-null object is treated as absent. Existing demotion line extraction (lines 157-168) stays demotion-only (D-17 prefill unchanged); add a separate list from `effortEntry.contaminated`. Existing row push (lines 178-188) gets `tier`, `contaminatedMetres`, `transported`, `fingerprint`, `reviewState`, etc.

**Comparator to replace** (lines 191-196, currently excluded-first); keep the tail:
```javascript
if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
return a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0;
```
Prepend `tier` asc and (tiers 1-2 only) `contaminatedMetres` desc. RESEARCH.md "Code Examples" has the full `compareRows`.

**Name join:** reuse `buildNameMap` (lines 112-124). The index row also supplies `quality.pauseClassification.transportedCount`; add a sibling map in the same style (skip non-object rows, `String(row.id)` keys).

---

### `scripts/curate-server.mjs` (route/handler, request-response + file-I/O)

**Analog:** `handleExclusionWrite` (lines 560-625), `applyUpsert`/`applyRemove` (368-399), `writeAtomic` (414-418), `persistExclusions` (443-446).

**Pure helpers to mirror** (`applyUpsert`, lines 368-378): slice, `findIndex`, replace in place else push, return `{ ...fileDoc, exclusions }`. `applyReviewUpsert` does the same over `reviewed` with the 4-field entry. `applyRemove` (396-399) filters every match out; the docblock (381-391) warns removal must never become a tombstone, which is D-14.

**Handler prefix to extract and share** (lines 561-580): Origin gate (403 text/plain), `decodeURIComponent` of `urlPath.slice(PREFIX.length)` (400 malformed), `isValidCurateActivityId` (400 invalid). Then PUT: `readJsonBody` (status/message pass-through), `normalizeReason(body.reason)` (400 if null); DELETE: persist-remove; else 405. Error shape for persist failures:
```javascript
} catch (error) {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end(`Internal Server Error: ${error.message}`);
  return;
}
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ ok: true }));
```
**Difference from the analog:** `persistReviewed` is `mkdirSync(dirname, {recursive:true})` plus `writeAtomic` and nothing else. Do NOT copy `mirrorExclusions()` (lines 429-437, 443-446). Reading: `readExclusionsFile` (439-441) throws on unparseable JSON, which gives the desired 500; a missing reviewed file should instead read as the default doc.

**Dispatch point** (lines 775-781), add a sibling branch beside it:
```javascript
if (
  (req.method === 'PUT' || req.method === 'DELETE') &&
  urlPath.startsWith(EXCLUSIONS_ROUTE_PREFIX)
) {
  await handleExclusionWrite(req, res, urlPath);
  return;
}
```
**GET gate to copy** for `GET /__curate/reviewed`: the `queue.js` branch (lines 756-773), including the T-29-01 comment (724-732) that explains why queue routes are gated unlike `/health`. 403 body text is the `Forbidden: curate serves only http://${CURATE_HOST}:${CURATE_PORT} ...` string.

**Path injection:** `createServer()` is zero-arg (line 860-877) and handlers use module constants (`EXCLUSIONS_PATH`/`PUBLISH_EXCLUSIONS_PATH` at lines 77-78). Thread `{ exclusionsPath, publishExclusionsPath, reviewedPath }` through `serveCurateRoute` (704) and the handlers; default to the constants. `main()` (881) calls `createServer()` with no args and must keep working.

**Reuse as-is:** `isTrustedOrigin` (467-476), `isValidCurateActivityId` (491-493), `normalizeReason` (503-508), `readJsonBody` (521-556), `MAX_BODY_BYTES`, `MAX_REASON_CHARS`.

---

### `scripts/curate-overlay/index.ts` (service, request-response)

**Analog:** `saveExclusion` / `removeExclusion` (lines 121-146):
```typescript
export async function saveExclusion(activityId: string, reason: string): Promise<void> {
  const response = await fetch(`${CURATE_PREFIX}/exclusions/${encodeURIComponent(activityId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }
  location.reload();
}
```
`saveReviewed(id, reason, fingerprint)` and `removeReviewed(id)` copy this exactly. Add a 409 branch to `describeFailure` (lines 96-111; it currently maps 400/403/412/413 and falls back to `Request failed (status): body`). `loadReviewedDoc()` is a never-throw GET returning null on non-ok. Constraint: this file must keep exactly two `addEventListener(` (`curate-overlay.test.mjs` line 58).

---

### `scripts/lib/curation-guard.mjs` (utility, batch tree-walk)

**Analog:** the `.curate-dist` name rules, directory branch (lines 114-119) and file branch (lines 137-151). Follow IN-17: one violation per path, then `continue`.
```javascript
if (entry.name === '.curate-dist') {
  violations.push({
    path: entryPath,
    reason: 'a ".curate-dist" directory (...) must never exist under the published bundle',
  });
}
walk(entryPath);
continue;
```
File rule for `reviewed.json` goes in the file branch before the `!entry.isFile()` gate (line 161) and the `UNSCANNED_EXTENSIONS` skip (line 170), which must stay `['.json']` (test at `curation-guard.test.mjs:170`). Directory rule for `data/curation` needs the path relative to `publishDir`; the file imports only `resolve` from `path` (line 55), so add `relative`/`sep` there (this file is not zero-import constrained). Avoid double-reporting a `reviewed.json` inside `data/curation` (directory rule owns the dir, file rule owns the file, as the existing `__curate` (c) test shows at `curation-guard.test.mjs:394-406`).

---

### `scripts/verify-dashboard-publish.mjs` (guard, request-response)

**Analog:** the literal list at lines 474-478 plus the comment block 459-473 (forbids widening to a `/data/` prefix):
```javascript
await expect404(baseUrl, '/__curate/exclusions/3475726256', 'the curate write endpoint must never be published');
await expect404(baseUrl, '/__curate/queue', 'the curate review queue page must never be published');
```
Add three literals: `/__curate/reviewed`, `/__curate/reviewed/3475726256`, `/data/curation/reviewed.json`. `expect404` is at lines 229-236 and prints `ok(\`GET ${path} -> 404 (expected, ${reason})\`)`, which is what the Case A test greps for. Update the "three to five" comment.

---

### `scripts/compute-review-queue-recount.mjs` (utility, batch/transform) NEW

**Analog:** `scripts/compute-unreliable-segment-recount.mjs` (also `compute-clean-window-recount.mjs`, `compute-pr-ceiling-recount.mjs`).

**Header discipline** (lines 1-50 there): name the forbidden modules, explain why independence matters, state the bound of the claim, name every `*_LOCAL` duplicated constant, state "writes nothing, ever".

**Imports** (lines 52-56): only built-ins.
```javascript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
```
**Fail-closed main** (lines 603-687): each failure is `console.error('FAILED: ...')`, `process.exitCode = 1`, `return`; read, then parse, then shape-check, then evaluate, then `PASS:` or `FAIL:` plus bullet list.

**Self-execution guard** (lines 689-691), so import has zero I/O:
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```
Pure exported functions (`recount...`, `evaluate...`, `format...`) are the testable surface; comparison to the derive output lives in the test, never in the script.

---

### `scripts/compute-review-queue-recount.test.mjs` (test) NEW

**Analogs:** `compute-unreliable-segment-recount.test.mjs` and `compute-clean-window-recount.test.mjs` (zero-import source scan with comment stripping and a planted violation, ~lines 434-500 of the latter, per RESEARCH). Mutation set to implement: tier swap, no-dedupe metres, reversed within-tier order, dropped transported row, altered shipped `contaminatedMetres`; plus an unmutated pass and an assertion that each planted input differs from the clean input. Data-dependent live comparison uses the `describe.skipIf(!existsSync(...))` idiom (`derive-flagged.test.mjs:529`).

### Import-time guard test (new file) 

**Analog:** `scripts/unreliable-segment-import-guards.test.mjs` (own file because `vi.mock` is file-wide). Copy the hoisted wrapper and both mocks (lines 38-75), the two positive controls (lines 84-104, using `./lib/import-time-read-probe-named.mjs` and `-default.mjs`), and one negative block per script (lines 106-112):
```javascript
vi.mock('fs', async (importOriginal) => wrapFsModule(await importOriginal()));
vi.mock('node:fs', async (importOriginal) => wrapFsModule(await importOriginal()));
// ...
describe('compute-review-queue-recount.mjs performs no disk read or write at import', () => {
  it('records zero fs calls', async () => {
    calls.length = 0;
    await import('./compute-review-queue-recount.mjs?cache-bust-review-queue-recount-import-guard');
    expect(calls).toEqual([]);
  });
});
```
Alternative: add the new script as one more block in the existing file (the existing file already holds 7 such blocks); a separate file is not required because the mock is already isolated there.

---

### `data/curation/reviewed.json` (seed)

**Shape analog:** `data/best-effort-exclusions.json` (`{ schemaVersion, note, exclusions: [...] }`). Seed: `{ "schemaVersion": 1, "note": "...", "reviewed": [] }`. Not in `build-widgets.mjs` `dataDirs`/`dataFiles`. `daily-refresh.yml` push paths do not list `data/curation/**`.

---

### `src/analytics/compute-best-efforts.ts` + `best-effort.types.ts` + `best-efforts-client.ts`

**Analogs:** the file itself. Follow RESEARCH Pattern 1 (activity-level `contaminatedMetres`, `Map<"start:end", metres>`, `round1`, early-return `seriesError` path must return 0). Browser client: `parseActivityBestEfforts` builds its object field by field, so an unparsed field is silently dropped; parse like `VALID_DEMOTION_GUARDS` fails closed (unknown becomes safe value), here `typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0`. No `BEST_EFFORTS_SCHEMA_VERSION` bump.

---

## Existing tests that assert the OLD behaviour (must be edited and declared in `files_modified`)

| File | What to change |
|---|---|
| `scripts/curate-queue/derive-flagged.test.mjs` | Lines 216-251 "D-05 ordering" assert excluded-last (`pendingNew, pendingOld, excludedNew, excludedOld`) and activityId-asc ties: rewrite for tier/metres comparator. Lines 509-521 `summarizeQueue` asserts the 2-field shape. Lines 529-543 live cross-check asserts `rows.length === recount.flaggedActivityCount` against demotion-only `recountDemotedActivities`: now false (queue is a superset); re-scope to `rows.filter(r => r.flaggedEfforts.length > 0)`. Canary (line 31) lists three exports; add new ones. Helpers `effort()`/`activity()` (lines 38-50) have no `contaminated`/`contaminatedMetres`; extend them. Also add the missing zero-import/zero-console scan. |
| `scripts/curate-queue.test.mjs` | `describe('D-04 — demotions only')` (line 108) amended by D-06; line 56 "no second write call site" should also forbid `/__curate/reviewed`; line 63 "D-08 reads only the mirrored public JSON" keeps its count of 3 but reword (reviewed is the one non-mirrored input, read via the transport). |
| `scripts/curate-overlay.test.mjs` | Line 58 exactly two `addEventListener(`; new transport functions must add none; `saveExclusion` body test must still pass. |
| `scripts/verify-dashboard-publish-guard.test.mjs` | Case A (line 63) title says "five" and lists five `✓ ... -> 404` lines (66-71): add three. Pattern for new plant cases is B-F (lines 77-160): `mkdirSync` plant, `try { runVerifier() } finally { cleanup }`, assert non-zero status plus `GET <path> expected 404`. `afterEach` (line 59) and `cleanupCurateDir` (54-56) only remove `dist/widgets/__curate`; add cleanup of `dist/widgets/data/curation` only (never `dist/widgets/data`). |
| `scripts/lib/curation-guard.test.mjs` | Add a block shaped like `describe('D-19 ...')` (lines 355-420: tmp dir `beforeEach`, `writeFile` helper, `(a)..(d)` cases, clean control returning `[]`, public `data/best-effort-exclusions.json` not flagged). Keep line 170 `UNSCANNED_EXTENSIONS` test and the whole-tree regression. |
| `scripts/curate-server.test.mjs` | Extend with injectable-path real-socket tests, `applyReview*` unit tests, SHA before/after of the two tracked files, no-id-in-both-files committed check. |
| `src/dashboard/data/best-efforts-client.test.ts` | `toEqual(validShard)` (~line 63) now carries one more field. |
| `src/dashboard/views/detail-best-efforts-logic.test.ts`, `records-logic.test.ts`, `src/analytics/compute-age-grading.test.ts`, `src/analytics/compute-best-efforts.test.ts` | `ActivityBestEfforts` literal helpers must gain `contaminatedMetres` if required on the type; whole-result `toEqual` on `ActivityEffortResult`; 36-05 "stubbed segments identical" proof. `tsc` is the final detector. |

## Shared Patterns

### Origin/Host gate on every curate route
**Source:** `scripts/curate-server.mjs` lines 467-476 (`isTrustedOrigin`), applied at 561 and 734/757.
**Apply to:** `GET /__curate/reviewed`, `PUT|DELETE /__curate/reviewed/:id`.

### Malformed-skip-and-count
**Source:** `derive-flagged.mjs` lines 62-103.
**Apply to:** reviewed parser; the queue page note renders only when the count is non-zero.

### Planted-fixture red/green proof
**Source:** `scripts/lib/curation-guard.test.mjs` lines 355-420 (tmp tree) and `verify-dashboard-publish-guard.test.mjs` lines 54-160 (subprocess, cleanup in `finally` and `afterEach`).
**Apply to:** guard-1 path rules, guard-2 literals.

### Import-time no-I/O with positive controls
**Source:** `scripts/unreliable-segment-import-guards.test.mjs` lines 38-112.
**Apply to:** the new recount script. Never use `vi.spyOn(fs, ...)`.

### Queue-page source-text constraints (existing tests)
One `className =` assignment, no `innerHTML`/style, no `/__curate/exclusions` literal in `curate-queue/index.ts`, exactly three `fetch('/strava-widgets/data/` occurrences. New reviewed I/O goes through `curate-overlay/index.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Reviewed-file path-injectable `createServer(options)` | server factory | request-response | Today's `createServer()` takes no args and handlers use module constants; this is a refactor, not a copy. |
| Zero-import/zero-console scan test for `derive-flagged.mjs` | test | source-text | No such test exists for this file; copy the comment-stripping scan from `compute-clean-window-recount.test.mjs` (~lines 434-500). |
| Queue view switcher and orphan list in `curate-queue/index.ts` | component | event-driven | No existing multi-view UI; follow RESEARCH Pattern 6 under the existing source-text constraints. |

## Metadata

**Analog search scope:** `scripts/`, `scripts/curate-queue/`, `scripts/curate-overlay/`, `scripts/lib/`, `src/analytics/`, `src/dashboard/data/`
**Files read for excerpts:** derive-flagged.mjs, curate-server.mjs (360-630, 700-916), curation-guard.mjs, verify-dashboard-publish.mjs (225-255, 450-485), curate-overlay/index.ts (85-160), unreliable-segment-import-guards.test.mjs, compute-unreliable-segment-recount.mjs (head and 600-691), plus targeted greps of the test files listed
**Not re-read (taken from RESEARCH.md, line refs not independently confirmed):** compute-best-efforts.ts branches, best-efforts-client.ts, `compute-clean-window-recount.test.mjs` ~434-500, `copy-data-tree.mjs`
**Pattern extraction date:** 2026-11-25
