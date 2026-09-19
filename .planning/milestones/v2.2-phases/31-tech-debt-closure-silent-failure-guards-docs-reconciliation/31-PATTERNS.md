# Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 20 (6 new, 14 modified) — docs-only artifacts under `.planning/` excluded (no code pattern applies; see `## No Analog Found`)
**Analogs found:** 18 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (NEW) | fixture (test data) | file-I/O | `data/best-effort-exclusions.json` (the file it copies from, verbatim) | exact — copy, not synthesize |
| `src/analytics/compute-best-efforts.test.ts` (MODIFIED, TD-01) | test | request-response (in-process compute) | itself, lines 944-1140 (existing premise + idempotence tests) | exact — extend in place |
| `scripts/lib/copy-data-tree.mjs` (MODIFIED, TD-02) | utility (build tooling) | file-I/O / batch | itself (current mtime-skip logic, lines 37-56) + `scripts/compute-elevation-calibration.mjs:265-291` (digest idiom) | role-match + digest pattern from a sibling script |
| `scripts/lib/copy-data-tree.test.mjs` (NEW, TD-02) | test | file-I/O, planted fixture | `scripts/lib/curation-guard.test.mjs` (mkdtemp planted-fixture pattern for a `scripts/lib/*.mjs` module) | exact — same directory, same role, same data flow |
| `scripts/lib/stream-files.mjs` (NEW, TD-05, discretionary) | utility | transform (pure function) | `scripts/compute-pace-quality-calibration.mjs:66-83` (`idFromFilename`/`isStreamFile`, the functions being lifted) | exact — extraction of existing code, not a new pattern |
| `src/dashboard/views/records-logic.ts` (MODIFIED, TD-03a) | service (view-logic, DOM-free) | transform | itself, lines 155-243 (`DemotionCounts`, `countDemotedAtDistance`, `describeDemotionCounts`) | exact — extend in place |
| `src/dashboard/views/records-logic.test.ts` (MODIFIED, TD-03a) | test | transform | itself, lines 493-650 (14 `DemotionCounts` literal sites + `describeDemotionCounts` string assertions) | exact — extend in place |
| `scripts/compute-pr-ceiling-recount.mjs` (MODIFIED, TD-03b) | service (CI verifier script) | batch / fail-closed | itself, `recountDemotedActivities` (256-280) + `evaluateReport` (476+) | exact — extend the existing `problems[]` shape |
| `scripts/compute-pr-ceiling-recount.test.mjs` (MODIFIED, TD-03b) | test | batch, planted fixture | itself, `describe('recountDemotedActivities', ...)` at line 198 | exact — extend in place |
| `scripts/curate-queue/derive-flagged.mjs` (MODIFIED, TD-03c) | service (pure derivation, browser+Node dual-use) | transform | itself, `buildExclusionsMap` (52-69) + `summarizeQueue` (190-196) | exact — extend in place |
| `scripts/curate-queue/derive-flagged.test.mjs` (MODIFIED, TD-03c) | test | transform, planted fixture | itself (fixture-document style, lines 1-70) | exact — extend in place |
| `scripts/curate-queue/index.ts` (MODIFIED, TD-03c) | component (local dev-tool DOM render) | request-response (client-side render) | itself, `renderQueue()`'s `data-queue-summary` paragraph (line 298) | exact — sibling DOM node, same file |
| `src/analytics/best-effort-ceiling.ts` (MODIFIED, TD-04) | service (analytics/compute) | transform | itself, `ceilingDemotion` (188-203) | exact — extend in place |
| `src/analytics/best-effort-ceiling.test.ts` (MODIFIED, TD-04) | test | transform | itself, house-register regex/exact-string tests (~180-230) | exact — extend in place |
| `src/dashboard/views/detail-best-efforts-logic.test.ts` (MODIFIED, TD-04) | test | transform | itself, lines 315-345 (`demotionReason` fixture strings) | exact — cosmetic string update |
| `scripts/compute-pace-residual.mjs` (MODIFIED, TD-05) | service (report generator) | batch | itself, `sweepArchive()` (line 273) — currently `f.endsWith('.json')` | role-match — needs the `isStreamFile` fix from the sibling calibration script |
| `scripts/compute-pace-quality-calibration.mjs` (regenerate only, TD-05) | service (report generator) | batch | itself — no code change, source of `isStreamFile` for the sibling fix above | exact — origin of the pattern being reused |
| `scripts/compute-pr-ceiling-calibration.mjs` (MODIFIED, TD-05) | service (report generator) | batch | itself, lines 580 (hard-coded prose) + 619 (`Demoted` column header) | exact — extend in place |
| `scripts/compute-pr-ceiling-calibration.test.mjs` (MODIFIED, TD-05) | test | batch | existing test file for the same script | exact — extend in place |
| `scripts/compute-pr-ceiling-diff.mjs` (regenerate only, TD-05) | service (report generator) | batch | itself, lines 464/471/682 (`Of which owner-excluded` column already implemented) | exact — reference pattern for WR-08's column reconciliation, no code change needed here |
| `scripts/compute-elevation-calibration.mjs` (regenerate only, TD-05) | service (report generator) | batch | — | no change required; cited only as the digest-idiom donor for TD-02 |

## Pattern Assignments

### `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (fixture, file-I/O)

**Analog:** `data/best-effort-exclusions.json` (the real file) — **copy verbatim, do not paraphrase.**

Confirmed live content of the two entries this fixture must reproduce exactly (both `distances: null`, i.e. all-distance — the task brief's "400m only" for `3475711469` is a mischaracterization per RESEARCH.md correction #1; do NOT write `distances: ['400m']`):
```json
{"activityId": "4556693525", "distances": null, "reason": "bad measurement"}
{"activityId": "3475711469", "distances": null, "reason": "bad measurement"}
```
Wrap in the same top-level shape as the real file (`{ "exclusions": [ ... ] }` — confirm exact top-level keys by reading `data/best-effort-exclusions.json`'s full structure, e.g. `schemaVersion`, before finalizing the fixture, since `buildExclusionsMap`/`loadExclusions` may check for a `schemaVersion` field).

**Location/naming (Claude's Discretion per D-01/CONTEXT.md):** `src/analytics/__fixtures__/best-effort-exclusions.fixture.json`, referenced via the same `fileURLToPath(new URL(...))` idiom `compute-best-efforts.test.ts:942-944` already uses for the real file.

---

### `src/analytics/compute-best-efforts.test.ts` (test, TD-01)

**Analog:** itself — the existing premise test and idempotence test are the two patterns to generalize.

**Premise-check pattern to keep and strengthen** (lines 944-960):
```typescript
it('4556693525 with its REAL committed exclusion entry is ceiling-demoted at 400m and 1k', async () => {
  // Test premise: the real committed exclusion for this activity must
  // actually exist and be all-distance, or this test would silently
  // degrade into the non-excluded case the previous test already
  // covers.
  const realExclusionsPath = fileURLToPath(
    new URL('../../data/best-effort-exclusions.json', import.meta.url)
  );
  const realExclusionsRaw = await fs.readFile(realExclusionsPath, 'utf-8');
  const realExclusionsDoc = JSON.parse(realExclusionsRaw) as {
    exclusions: Array<{ activityId: string; distances: string[] | null; reason: string }>;
  };
  const pinnedEntry = realExclusionsDoc.exclusions.find((e) => e.activityId === '4556693525');
  const premiseOk = pinnedEntry !== undefined && pinnedEntry.distances === null;
  expect(
    premiseOk,
    'test premise: the committed exclusion for 4556693525 must exist and be all-distance'
  ).toBe(true);
  // ... rest of the test currently reads the real file for arithmetic too —
  // D-01 moves that part onto the new fixture, keeping only the premise
  // assertion above pointed at the real file.
```
**D-02's required change to the failure message:** the plain `expect(premiseOk, '...').toBe(true)` message above needs to become actionable in one minute — name the entry, the fixture path, and the test, e.g.:
```typescript
expect(
  premiseOk,
  '4556693525 is no longer excluded all-distance in data/best-effort-exclusions.json; ' +
    'if intentional, update src/analytics/__fixtures__/best-effort-exclusions.fixture.json ' +
    'and this premise in compute-best-efforts.test.ts'
).toBe(true);
```

**Idempotence/byte-comparison pattern to mirror for D-03's fixture-copy demonstration** (lines 1131+, "two runs ... byte-identical apart from generatedAt" — same file):
```typescript
it('two runs of the real-exclusion fixture produce byte-identical documents apart from generatedAt', async () => {
  const realExclusionsPath = fileURLToPath(
    new URL('../../data/best-effort-exclusions.json', import.meta.url)
  );
  await buildPinnedArchive({ withOneKmBulk: true });
  const baseOptions = { activitiesDir: ..., streamsDir: ..., /* strip generatedAt before comparing */ };
```
D-03's "edit a copy of the fixture, show the arithmetic would catch it" test should follow this exact shape: write the fixture to a `tmpDir` copy, mutate one field (e.g. flip `distances: null` to a `['400m']` array on `4556693525`), rerun `computeBestEfforts` with `exclusionsPath` pointed at the mutated copy, and assert the ceiling/demotion assertions that previously passed now fail differently (e.g. `effort1k.demotion` becomes `null` because the 1k distance is no longer excluded).

**Path-injection mechanism already proven safe (no code change needed to `computeBestEfforts` itself):**
```typescript
// Source: src/storage/file-store.ts:48-49 (readJson)
async readJson<T>(filePath: string): Promise<T> {
  const fullPath = path.resolve(this.baseDir, filePath);
  // an absolute filePath (fileURLToPath(new URL(...))) wins over baseDir
```

---

### `scripts/lib/copy-data-tree.mjs` (utility, TD-02)

**Analog A (structure to replace):** itself, lines 1-59 (full file — read in full, small):
```javascript
// Current mtime-skip logic (lines 37-56) — REPLACE:
if (!entry.name.endsWith('.json')) continue;
let shouldCopy = true;
if (existsSync(destPath)) {
  const srcMtime = statSync(srcPath).mtimeMs;
  const destMtime = statSync(destPath).mtimeMs;
  if (destMtime >= srcMtime) {
    shouldCopy = false;
  }
}
if (shouldCopy) {
  copyFileSync(srcPath, destPath);
  copied++;
} else {
  skipped++;
}
```
Header docblock to preserve (lines 1-8) — this is the "no top-level side effects, importable by both build-widgets.mjs and curate-server.mjs" contract; do not add an import that breaks it:
```javascript
/**
 * Side-effect-free data-copy walk, extracted from build-widgets.mjs (Phase 24)
 * so it is importable by both build-widgets.mjs and the curate server without
 * triggering build-widgets.mjs's self-executing buildAllWidgets().catch(...)
 * ...
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
```

**Analog B (digest idiom to import):** `scripts/compute-elevation-calibration.mjs:265-291` — mirror this exact `createHash` usage (swap `sha256` for `sha1` per D-04's stated measurement basis; `[ASSUMED]` per RESEARCH.md A1, either works):
```javascript
// Source: scripts/compute-elevation-calibration.mjs:271-289
export function computeStreamsDigest(dirPath) {
  let files;
  try {
    files = readdirSync(dirPath).filter(isStreamFile).sort();
  } catch (error) {
    return { digest: null, fileCount: 0, error: error.message };
  }
  const aggregate = createHash('sha256');
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(join(dirPath, file));
    } catch (error) {
      return { digest: null, fileCount: files.length, error: error.message };
    }
    const perFileDigest = createHash('sha256').update(contents).digest('hex');
    aggregate.update(file);
    aggregate.update(perFileDigest);
  }
  return { digest: aggregate.digest('hex'), fileCount: files.length, error: null };
}
```
For `copy-data-tree.mjs` this becomes a per-file (not aggregate) digest: `createHash('sha1').update(readFileSync(srcPath)).digest('hex')` compared against the same digest of `destPath`, only computed when `statSync(srcPath).size === statSync(destPath).size` (size-first per D-04). New import needed: `import { createHash } from 'node:crypto';`.

**Staleness log line (D-05):** add `console.log(\`replaced stale ${destPath}\`)` at the point a same-size, different-digest file is overwritten — no existing precedent for this exact line in this file, but it matches the plain `console.log`/`console.warn` style already used project-wide in sibling scripts (e.g. `compute-pace-residual.mjs`'s `console.warn` calls).

---

### `scripts/lib/copy-data-tree.test.mjs` (NEW test, TD-02)

**Analog:** `scripts/lib/curation-guard.test.mjs` — mkdtemp planted-fixture pattern for a `scripts/lib/*.mjs` pure module. Full setup/teardown to copy:
```javascript
// Source: scripts/lib/curation-guard.test.mjs:15-50
import fs from 'node:fs/promises';
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CURATE_DIR_NAME, CURATE_MARKER, UNSCANNED_EXTENSIONS, findCurationArtifacts } from './curation-guard.mjs';

describe('findCurationArtifacts', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curation-guard-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFile(relativePath, contents) {
    const fullPath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, contents, 'utf8');
  }

  it('clean tree: returns exactly []', async () => {
    // ...
  });
});
```
For `copy-data-tree.test.mjs`: `mkdtemp` two dirs (`srcDir`, `destDir`), plant a same-size doctored `destDir` file with a `utimesSync`-forced newer mtime than `srcDir`'s file (proving the OLD mtime rule would have skipped it), call `copyJsonTree(srcDir, destDir)`, assert the file's contents now match `srcDir` (replaced) and the staleness log line fired; a second `it` plants a byte-identical file (no doctoring) and asserts it is skipped (no needless SHA-1 work, `skipped` count still honest).

**Header docblock convention to copy:**
```javascript
/**
 * Planted-fixture regression proof for scripts/lib/copy-data-tree.mjs.
 * Plants a same-size, doctored/newer-mtime destination file inside a
 * throwaway mkdtemp tree (never the real dist/widgets/data) and asserts
 * copyJsonTree replaces it and logs the replacement — the exact "staged
 * build browser cache trap" this project's own memory records.
 */
```

---

### `scripts/lib/stream-files.mjs` (NEW, TD-05 helper extraction)

**Analog:** `scripts/compute-pace-quality-calibration.mjs:66-83` — the two functions to lift verbatim:
```javascript
/** Strips the trailing `.json` from a `data/activities|streams` filename. */
export function idFromFilename(filename) {
  return filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
}

/**
 * True for a `data/streams/` entry that is a genuine per-activity stream
 * file — false for `manifest.json` ...
 */
export function isStreamFile(filename) {
  return filename.endsWith('.json') && filename !== 'manifest.json';
}
```
Header docblock convention to copy (module extracted for dual-import, no top-level side effects) mirrors `copy-data-tree.mjs:1-8`'s own extraction rationale — cite it in the new file's header. Both `compute-pace-residual.mjs` and `compute-pace-quality-calibration.mjs` then `import { isStreamFile } from './lib/stream-files.mjs';` and `compute-pace-residual.mjs`'s `sweepArchive()` (line 273) changes its filter from `readdirSync(STREAMS_DIR).filter((f) => f.endsWith('.json'))` to `.filter(isStreamFile)`.

---

### `src/dashboard/views/records-logic.ts` (TD-03a)

**Analog:** itself — `DemotionCounts` interface (lines 155-160), `countDemotedAtDistance` (181-215), `describeDemotionCounts` (227-243).

**Interface to extend (add `other: number`, required per RESEARCH.md A2 — do NOT make it optional):**
```typescript
// Source: src/dashboard/views/records-logic.ts:155-160
export interface DemotionCounts {
  total: number;
  ceiling: number;
  worldRecord: number;
  maxSpeed: number;
}
```

**Switch statement to extend** (lines 196-211 — currently the `default:` branch is a no-op comment):
```typescript
switch (effort.demotion.guard) {
  case 'ceiling':
    counts.ceiling++;
    break;
  case 'world-record':
    counts.worldRecord++;
    break;
  case 'max-speed':
    counts.maxSpeed++;
    break;
  default:
    // Unrecognized guard value — still counts toward total, matching
    // the module's existing degrade-rather-than-throw discipline.
    break;
}
```
D-07 changes the `default:` branch to `counts.other++;`.

**Sentence-builder to extend** (lines 227-243 — the "named condition plus measured value" register, Phase 27 D-09):
```typescript
function describeDemotionCounts(label: string, counts: DemotionCounts): string {
  const effortWord = counts.total === 1 ? 'effort' : 'efforts';
  const verb = counts.total === 1 ? 'was' : 'were';

  const parts: string[] = [];
  if (counts.ceiling > 0) parts.push(`${counts.ceiling} by the personal ceiling`);
  if (counts.worldRecord > 0) parts.push(`${counts.worldRecord} by the world-record pace guard`);
  if (counts.maxSpeed > 0) parts.push(`${counts.maxSpeed} by the activity max-speed guard`);
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  return `${counts.total} ${label} ${effortWord} ${verb} demoted by a plausibility guard${breakdown}. Efforts the owner excluded are not counted here. See the activity detail view for each reason.`;
}
```
D-07 adds a fourth `parts.push` for `counts.other > 0` **after** the three named guards, e.g. `` `${counts.other} by another guard` `` — fixed order preserved (append last).

---

### `src/dashboard/views/records-logic.test.ts` (TD-03a)

**Analog:** itself — the exact 14 literal-object sites RESEARCH.md's Pitfall 1 lists (lines 496, 510, 526, 546, 557, 567, 573, 581, 611, 619, 624, 629, 636, 643 in that document's grep — re-verify against the live file since line numbers may have shifted; the shape to match is below). Every existing literal needs `other: 0` appended:
```typescript
// Source: src/dashboard/views/records-logic.test.ts (representative literal, e.g. line ~496)
expect(countDemotedAtDistance({}, '400m')).toEqual({ total: 0, ceiling: 0, worldRecord: 0, maxSpeed: 0 });
// becomes:
expect(countDemotedAtDistance({}, '400m')).toEqual({ total: 0, ceiling: 0, worldRecord: 0, maxSpeed: 0, other: 0 });
```
**New negative test to add** (fabricated guard value, per D-07's own text "a negative test with a fabricated guard value pins the sentence") — follow this file's existing `fixtureEffort`/`fixtureActivity` helper style (see the `demotion: { guard: 'ceiling', reason: 'x' }` shape used throughout) but with an invalid guard string cast through `as unknown as EffortDemotionGuard` or equivalent, then assert `describeDemotionCounts`'s output contains `"1 by another guard"` in the fixed trailing position.

---

### `scripts/compute-pr-ceiling-recount.mjs` (TD-03b)

**Analog:** itself — `recountDemotedActivities` (lines 256-280) is the exact gap to close; `evaluateReport` (476+) is the sibling pattern to extend.

**Current gap (the entire malformed-entry handling today, lines 262-280 area):**
```javascript
// Source: scripts/compute-pr-ceiling-recount.mjs (recountDemotedActivities body)
let excludedWithinFlaggedCount = null;
let exclusionsTotal = null;
if (exclusionsDoc !== null && exclusionsDoc !== undefined) {
  const flaggedSet = new Set(flaggedActivityIds);
  const exclusions = Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
  exclusionsTotal = 0;
  excludedWithinFlaggedCount = 0;
  for (const entry of exclusions) {
    if (!entry || typeof entry.activityId !== 'string') continue;
    exclusionsTotal += 1;
    if (flaggedSet.has(entry.activityId)) excludedWithinFlaggedCount += 1;
  }
}
```
No duplicate-id check, no reason-shape check, no `__proto__` check. D-08 needs this loop to also populate a new `malformedExclusions: string[]` return field naming each offending entry.

**`evaluateReport`'s `problems[]` pattern to extend (the shape to follow, not invent a new channel):**
```javascript
// Source: scripts/compute-pr-ceiling-recount.mjs:476-... (evaluateReport)
export function evaluateReport(report, expectedDemoted, expectedCohort, expectedFlaggedActivities) {
  const problems = [];
  for (const err of report.readErrors || []) {
    problems.push(`unreadable input: ${err}`);
  }
  const demoted = report.demoted;
  if (demoted) {
    if (demoted.rankedButDemotedIds.length > 0) {
      problems.push(
        `${demoted.rankedButDemotedIds.length} ranked-but-demoted effort(s) found (a demoted effort is still ranked): ${demoted.rankedButDemotedIds.join(', ')}`
      );
    }
    // TD-03b adds a sibling block here reading report.demotedActivities.malformedExclusions
  }
  return { pass: problems.length === 0, problems };
}
```
**Exit-code wiring already established in `main()`** (lines 796-800):
```javascript
console.error('\nFAIL:');
for (const problem of ...) {
  console.error(`  - ${problem}`);
}
process.exitCode = 1;
```

**Zero-import discipline (D-08's binding constraint, do not violate):**
```javascript
// Source: scripts/compute-pr-ceiling-recount.mjs:1-13 (module docblock)
/**
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the ceiling module ... the compute step ... the best-effort utils ... or the
 * best-effort types ..., by any spelling.
 */
```

---

### `scripts/compute-pr-ceiling-recount.test.mjs` (TD-03b)

**Analog:** itself, `describe('recountDemotedActivities', ...)` at line 198 — existing fixture-building helpers (`bestEffortsDoc`, `effort`) to reuse:
```javascript
// Source: scripts/compute-pr-ceiling-recount.test.mjs:198-215
describe('recountDemotedActivities', () => {
  it('counts an activity with 3 demoted efforts once (dedupe by activity, not effort)', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [ effort('400m', 60, { guard: 'ceiling', reason: 'r1' }) ] },
      },
      rankings: { '400m': [] },
    });
    const result = recountDemotedActivities(doc);
    expect(result.flaggedActivityCount).toBe(1);
  });
});
```
New tests should pass a hand-built `exclusionsDoc` second argument with each of the 4 malformed shapes (duplicate `activityId`, non-string/empty `reason`, `__proto__` key, non-string id) and assert `result.malformedExclusions` names each one, matching `derive-flagged.test.mjs`'s "planted malformed-input fixtures, never the real file" discipline (see next section).

---

### `scripts/curate-queue/derive-flagged.mjs` (TD-03c)

**Analog:** itself — `buildExclusionsMap` (lines 52-69) already skips 3 of 4 malformation classes; `summarizeQueue` (190-196) is the sibling to extend with a count.

**Function to extend (name-corrected — it is `buildExclusionsMap`, NOT `buildExclusionReasonMap`):**
```javascript
// Source: scripts/curate-queue/derive-flagged.mjs:52-69
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
D-09 needs this to also skip empty-string reasons and count duplicates, returning `{ map, skippedCount }` instead of a bare `Map`.

**`summarizeQueue` to extend (current return shape, threading the new field through):**
```javascript
// Source: scripts/curate-queue/derive-flagged.mjs:190-196
export function summarizeQueue(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    flaggedCount: list.length,
    excludedCount: list.filter((r) => r && r.excluded).length,
  };
}
```
Per RESEARCH.md's recommendation, prefer a **new sibling export** (e.g. `countMalformedExclusions(exclusionsDoc)`) over changing `deriveFlaggedActivities`'s return shape, to avoid touching every existing test that destructures its `QueueRow[]` return directly.

**Module-contract docblock to preserve (MUST NOT violate when adding the new export):**
```javascript
// Source: scripts/curate-queue/derive-flagged.mjs:7-12
 * MUST be `.mjs` with JSDoc types, NOT `.ts` ... vitest.config.ts's `include` is
 * ['src/**\/*.test.ts', 'scripts/**\/*.test.mjs'] — a `.test.ts` sibling would never be
 * collected ... MUST have zero `import` statements and zero `console` calls — it runs
 * in the browser, unbundled by any module loader beyond esbuild's own IIFE step.
```

---

### `scripts/curate-queue/derive-flagged.test.mjs` (TD-03c)

**Analog:** itself — fixture-document convention (lines 1-70), never the real file:
```javascript
// Source: scripts/curate-queue/derive-flagged.test.mjs:1-45
import { describe, expect, it } from 'vitest';
import { buildPrefillReason, deriveFlaggedActivities, summarizeQueue } from './derive-flagged.mjs';

function effort(distance, guard, reason, durationSec = 100, paceSecPerKm = 250) {
  return {
    distance,
    durationSec,
    paceSecPerKm,
    demotion: guard === null ? null : { guard, reason },
  };
}

function activity(startDate, efforts, excludedFromRecords = false) {
  return { startDate, efforts, excludedFromRecords };
}

describe('deriveFlaggedActivities — D-01 population (all guards, not ceiling-only)', () => {
  it('an activity flagged only by ceiling ... appear — 3 rows', () => {
    const doc = { activities: { a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'ceiling reason')]) } };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(3);
  });
});
```
New tests for D-09: build an `exclusionsDoc` with a duplicate `activityId`, a `__proto__` key, an empty-string `reason`, and a non-string id — assert the new malformed-count export reports the right number and `deriveFlaggedActivities` itself is unaffected (still silently drops them from the map, per existing behavior).

---

### `scripts/curate-queue/index.ts` (TD-03c)

**Analog:** itself — the existing header-summary render, sibling location for the new line:
```typescript
// Source: scripts/curate-queue/index.ts:294-298 (renderQueue)
const rows = deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc);
const { flaggedCount, excludedCount } = summarizeQueue(rows);

const summary = document.createElement('p');
summary.setAttribute('data-queue-summary', '');
summary.textContent = `${flaggedCount} flagged · ${excludedCount} already excluded`;
main.appendChild(summary);
```
D-09's new line goes right after this block, as a sibling `<p>` with its own `data-*` attribute (e.g. `data-queue-malformed-note`), rendered only when the count is `> 0` (or always rendered with "0" — Claude's Discretion per D-09's wording register, matching Phase 27 D-09's "named condition plus measured value").

---

### `src/analytics/best-effort-ceiling.ts` (TD-04)

**Analog:** itself, `ceilingDemotion` (lines 188-203) — the exact template to change:
```typescript
// Source: src/analytics/best-effort-ceiling.ts:188-203 (current)
export function ceilingDemotion(
  impliedSpeedMps: number,
  derivation: CeilingDerivation
): EffortDemotion | null {
  if (derivation.ceilingMps === null) return null;
  if (!(impliedSpeedMps > derivation.ceilingMps)) return null;

  const p90Mps = derivation.p90Mps!;

  return {
    guard: 'ceiling',
    reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(2)} m/s (${derivation.multiplier.toFixed(2)} x p90 ${p90Mps.toFixed(2)} m/s over ${derivation.populationN} filtered ${derivation.distance} efforts)`,
  };
}
```
**Target shape (D-10 — 3 decimals on implied/ceiling/p90/margin, 2 decimals kept on the multiplier):**
```typescript
export function ceilingDemotion(
  impliedSpeedMps: number,
  derivation: CeilingDerivation
): EffortDemotion | null {
  if (derivation.ceilingMps === null) return null;
  if (!(impliedSpeedMps > derivation.ceilingMps)) return null;

  const p90Mps = derivation.p90Mps!;
  const margin = impliedSpeedMps - derivation.ceilingMps;

  return {
    guard: 'ceiling',
    reason: `implied ${impliedSpeedMps.toFixed(3)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(3)} m/s by ${margin.toFixed(3)} m/s (${derivation.multiplier.toFixed(2)} x p90 ${p90Mps.toFixed(3)} m/s over ${derivation.populationN} filtered ${derivation.distance} efforts)`,
  };
}
```
Worked example to match: `implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)`.

**House-register docblock to preserve/update** (lines 176-187, describes the format the code just above implements) — update its worked example alongside the code change so the comment does not go stale.

---

### `src/analytics/best-effort-ceiling.test.ts` (TD-04)

**Analog:** itself — regex assertion (around line 192, `\d+\.\d{2}` ×4) and exact-string assertion (around line 222) both need updating to the new 3-decimal-plus-margin shape. Worked value already computed in RESEARCH.md for the existing test fixture: `implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s (1.28 x p90 3.992 m/s over 1825 filtered 400m efforts)`.

---

### `src/dashboard/views/detail-best-efforts-logic.test.ts` (TD-04, cosmetic)

**Analog:** itself, lines ~315-345 — `demotionReason` fixture input strings are pass-through (`prFlagBadgeSpecs` does not reformat them), so this file needs only a consistency update, not a logic change.

---

### `scripts/compute-pace-residual.mjs` (TD-05)

**Analog:** `scripts/compute-pace-quality-calibration.mjs:66-83` (`isStreamFile`), applied to `sweepArchive()`:
```javascript
// Source: scripts/compute-pace-residual.mjs:273-281 (current bug)
function sweepArchive() {
  const streams = [];
  let files;
  try {
    files = readdirSync(STREAMS_DIR).filter((f) => f.endsWith('.json'));
    // ^ counts manifest.json as a stream file — the G-01/G-03 bug
  } catch (error) { ... }
```
Fix: import `isStreamFile` from the new `scripts/lib/stream-files.mjs` (see above) and change the filter to `.filter(isStreamFile)`.

---

### `scripts/compute-pr-ceiling-calibration.mjs` (TD-05)

**Analog:** itself — two exact sites:
```javascript
// Source: scripts/compute-pr-ceiling-calibration.mjs:580 (hard-coded prose, WR-07)
'400m shows the largest drift: the live population and its top-10 differ materially from ' +
```
Replace with a data-derived sentence naming whichever distance actually has the max absolute drift (computed from the same data structure already driving the table).
```javascript
// Source: scripts/compute-pr-ceiling-calibration.mjs:619 ("Demoted" column, WR-08)
'| Distance | Ceiling (m/s) | Ceiling (time) | Eligible | n | Demoted | Demoted of top 10 |'
```
**Reference pattern for the reconciliation (borrow from a sibling script that already solved this exact problem):**
```javascript
// Source: scripts/compute-pr-ceiling-diff.mjs:471 (already has the column WR-08 needs)
'| Distance | Ceiling (m/s) | Demoted (ceiling) | Of which owner-excluded | Flags before | Flags after | Flags flipped |'
```
Either relabel `compute-pr-ceiling-calibration.mjs`'s `Demoted` column to clarify it excludes owner-excluded, or add an `Of which owner-excluded` column exactly mirroring `compute-pr-ceiling-diff.mjs`'s existing pattern (Claude's Discretion per D-CONTEXT).

---

### `scripts/compute-pr-ceiling-diff.mjs` (regenerate only — reference, no code change)

**Already-correct pattern other TD-05 sites should borrow:**
```javascript
// Source: scripts/compute-pr-ceiling-diff.mjs:464
`- Of those, also owner-excluded (no ranking effect): ${report.totals.totalDemotedExcluded}`
// Source: line 682
console.log(`Of which owner-excluded: ${report.totals.totalDemotedExcluded}`);
```

## Shared Patterns

### Named-condition-plus-measured-value register (Phase 27 D-09)
**Source:** `src/dashboard/views/records-logic.ts:227-243` (`describeDemotionCounts`)
**Apply to:** TD-03a's `other` bucket sentence, TD-03c's "N exclusion entries ignored (malformed)" line, TD-04's margin wording — every user-facing string states a named condition plus its measured number, never an adjective ("suspicious", "a few", "some" are forbidden).
```typescript
if (counts.ceiling > 0) parts.push(`${counts.ceiling} by the personal ceiling`);
```

### `{ ok: false, reason }` / `problems: string[]` fail-closed shape
**Source:** `scripts/compute-pr-ceiling-recount.mjs:476` (`evaluateReport`) + `main()`'s exit wiring at lines 796-800
**Apply to:** TD-03b's malformed-exclusions check — extend the existing flat `problems` array, do not invent a third error channel.
```javascript
export function evaluateReport(report, expectedDemoted, expectedCohort, expectedFlaggedActivities) {
  const problems = [];
  // ... push onto problems ...
  return { pass: problems.length === 0, problems };
}
```

### Zero-import verifier discipline (Phase 28 D-15)
**Source:** `scripts/compute-pr-ceiling-recount.mjs:1-13` (module docblock)
**Apply to:** TD-03b — the recount script must never import the ceiling/compute/utils/types modules it checks. Pure hand-rolled `typeof`/`Array.isArray`/`__proto__` checks only, matching `buildExclusionsMap`'s existing style.

### mkdtemp planted-fixture test pattern for `scripts/lib/*.mjs`
**Source:** `scripts/lib/curation-guard.test.mjs:15-50`
**Apply to:** TD-02's new `copy-data-tree.test.mjs` — throwaway `fs.mkdtemp`, never the real `dist/widgets`/`data` tree, `afterEach` cleanup via `fs.rm(tmpDir, { recursive: true, force: true })`.
```javascript
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-data-tree-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

### Digest via `crypto.createHash` (built-in, no new dependency)
**Source:** `scripts/compute-elevation-calibration.mjs:271-289`
**Apply to:** TD-02's size-then-digest replacement.
```javascript
const perFileDigest = createHash('sha1').update(readFileSync(srcPath)).digest('hex');
```

### `**Generated:**` timestamp stripping before an idempotence byte-comparison
**Source:** `src/analytics/compute-best-efforts.test.ts:1131` ("two runs ... byte-identical apart from generatedAt")
**Apply to:** TD-05's regenerate-twice proof for all 5 `.planning/*.md` artifacts — strip the `**Generated:**` line (or `generatedAt` JSON field) from both outputs before comparing; a naive `execSync; readFileSync; execSync; readFileSync; expect(a).toBe(b)` will ALWAYS fail on the timestamp alone.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/26.../26-RESIDUAL.md`, `27-CALIBRATION.md`, `28-CEILING-CALIBRATION.md`, `28-DIFF.md`, `30-CALIBRATION.md` (regenerated, TD-05) | docs artifact | batch (generated output) | Not code — these are generator *outputs*, not files whose structure is "copied" from an analog; the pattern that matters is the **generator script's** own existing render logic (see `compute-pr-ceiling-calibration.mjs`/`compute-pr-ceiling-diff.mjs` entries above), not the markdown shape itself. |
| `REQUIREMENTS.md`, `ROADMAP.md`, `27-VALIDATION.md` frontmatter (D-13/D-14, TD-06) | docs (hand-edit) | file-I/O | Prose hand-corrections with a dated italic note, per the project's own established house style at `26-RESIDUAL.md`'s existing "corrected `<date>`" notes (Phase 30 D-04) — no code pattern applies; the planner should read `26-RESIDUAL.md`'s existing correction note directly as its own analog when drafting the wording. |

## Metadata

**Analog search scope:** `scripts/`, `scripts/lib/`, `scripts/curate-queue/`, `src/analytics/`, `src/dashboard/views/`, `src/storage/`
**Files scanned (read in full or targeted ranges):** `scripts/lib/curation-guard.mjs`, `scripts/lib/curation-guard.test.mjs`, `scripts/lib/copy-data-tree.mjs` (full, 70 lines), `scripts/curate-queue/derive-flagged.mjs` (full, 196 lines), `scripts/curate-queue/derive-flagged.test.mjs` (partial), `scripts/curate-queue/index.ts` (260-330), `scripts/compute-pr-ceiling-recount.mjs` (imports, 230-280, 460-500, exit wiring), `scripts/compute-pr-ceiling-recount.test.mjs` (190-230), `src/dashboard/views/records-logic.ts` (150-315), `src/dashboard/views/records-logic.test.ts` (480-650), `src/analytics/best-effort-ceiling.ts` (150-210), `src/analytics/compute-best-efforts.test.ts` (930-1145), `scripts/compute-elevation-calibration.mjs` (265-295), `scripts/compute-pr-ceiling-diff.mjs` (grep for owner-excluded), `scripts/compute-pace-quality-calibration.mjs` (55-100), `scripts/compute-pace-residual.mjs` (255-300, imports), `scripts/compute-pr-ceiling-calibration.mjs` (grep for drift/Demoted), `data/best-effort-exclusions.json` (both target entries, live-verified).
**Pattern extraction date:** 2026-09-19
