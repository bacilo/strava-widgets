# Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 12 (8 modified, 4+ created; `.test.mjs`/`.test.ts` siblings counted with their generator/module)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/best-effort-utils.ts` (`findBestEffort`) | utility (pure algorithm) | transform (batch sweep) | itself, today's unbounded call (additive param change) | exact — extend in place |
| `src/analytics/best-effort.types.ts` (`ComputedEffort.contaminated`, `EffortDemotionGuard`) | model / types | CRUD (document shape) | `totals.effortsDemoted` / `ceilings` additive-field precedent, same file (:225-234, :239-245) | exact |
| `src/analytics/compute-best-efforts.ts` (Pass 1 partition-and-search) | service (batch orchestrator) | batch / transform | itself — `computeActivityEfforts`'s existing per-target loop (:128-169) | exact — extend in place |
| `src/analytics/compute-best-efforts.ts` (write-gate, D-11) | config / CLI wiring | request-response (CLI flag → conditional write) | itself, the existing conditional write at :569-573 | exact — extend in place |
| `src/analytics/best-effort-ceiling.ts` | service (pure derivation) | transform | **no change expected** — confirmed by call-graph read below | n/a (zero-change target) |
| `src/dashboard/data/best-efforts-client.ts` (`parseContaminated`, `VALID_DEMOTION_GUARDS`) | utility (browser parser) | transform (total parse) | `parseDemotion`, same file (:58-65) | exact |
| `src/dashboard/views/records-logic.ts` (switch case + walk-the-document count) | service (view-model builder) | transform (document walk) | `countDemotedAtDistance`'s switch, same file (:187-228) | exact |
| `src/dashboard/views/detail-best-efforts-logic.ts` (`BestEffortPanelRow.contaminated`, badge branch) | component (view-model builder) | transform | `demoted`/`demotionReason` field pair + `prFlagBadgeSpecs`'s `demoted` branch, same file (:119-121, :261-269) | exact |
| `scripts/compute-ceiling-recalibration.mjs` + `.test.mjs` | script (generator, dev tooling) | batch / file-I/O | `scripts/compute-pr-ceiling-calibration.mjs` + `28-CEILING-CALIBRATION.md` | exact |
| `scripts/compute-clean-window-diff.mjs` + `.test.mjs` | script (generator, dev tooling) | batch / file-I/O | `scripts/compute-pr-ceiling-diff.mjs` | exact |
| `scripts/compute-clean-window-recount.mjs` + `.test.mjs` | script (independent verifier) | batch / file-I/O, fails-closed | `scripts/compute-pr-ceiling-recount.mjs`, `scripts/compute-elevation-recount.mjs` | exact |
| `.planning/phases/36-.../36-CEILING-RECALIBRATION.md` | config (generated artifact of record) | file-I/O (regenerable, committed) | `28-CEILING-CALIBRATION.md`, `30-CALIBRATION.md` | exact |
| new archive-wide equivalence/overlap test (D-01, D-03) | test | batch (full-archive sweep) | `pace-derivation.test.ts`'s `readStream` helper + archive-sweep `describe` blocks (:65-68, :835-872) | exact |
| `src/index.ts` / `compute-all-stats-steps.ts` (D-11 CLI flag threading) | route / config (CLI entry point) | request-response | `--ci` flag threading at `src/index.ts:315-333` | role-match |

## Pattern Assignments

### `src/analytics/best-effort-utils.ts` — `findBestEffort` gains `startIndex`/`endIndex`

**Analog:** itself, current implementation (read in full, lines 133-170).

**Current signature and sweep** (lines 141-170):
```typescript
export function findBestEffort(
  t: number[],
  d: number[],
  targetMeters: number
): RawEffort | undefined {
  const n = t.length;
  if (n < 2 || d[n - 1] - d[0] < targetMeters) return undefined;

  let best: RawEffort | undefined;
  let j = 0;

  for (let i = 0; i < n; i++) {
    if (j < i + 1) j = i + 1;
    while (j < n && d[j] - d[i] < targetMeters) j++;
    if (j >= n) break;

    // Linear interpolation at the exact crossing — never snap to d[j]/t[j].
    const needed = targetMeters - (d[j - 1] - d[i]);
    const segMeters = d[j] - d[j - 1];
    const frac = segMeters > 0 ? needed / segMeters : 0;
    const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);

    const durationSec = crossingTime - t[i];
    if (durationSec > 0 && (!best || durationSec < best.durationSec)) {
      best = { durationSec, startOffsetSec: t[i], endOffsetSec: crossingTime };
    }
  }

  return best;
}
```

**Extension shape (from RESEARCH.md, not yet in the tree):** add an optional 4th parameter
`bounds?: { startIndex: number; endIndex: number }`, default `lo = bounds?.startIndex ?? 0`,
`hi = bounds?.endIndex ?? t.length`, and rewrite every `0`/`n` in the loop above to `lo`/`hi`.
Zero-risk additive — the existing single call site (`computeActivityEfforts`) omitting `bounds`
reproduces today's behavior exactly, so no existing test changes.

**Docblock convention to preserve** (line 133-139): every algorithmic function in this file states
its invariant in prose before the code — "Assumes a validated series — callers run
`validateStreamSeries` first." A new `startIndex`/`endIndex` doc line should state the same
zero-copy/no-slice guarantee RESEARCH.md's Pattern 1 argues for.

---

### `src/analytics/best-effort.types.ts` — `ComputedEffort.contaminated`, `EffortDemotionGuard` widened

**Analog:** the additive-field precedent already in this exact file — `totals.effortsDemoted` (lines
225-234) and `ceilings` (lines 239-245), both introduced without a `BEST_EFFORTS_SCHEMA_VERSION`
bump (line 16's own comment: "Bump only via an explicit, coordinated recomputation").

**Additive-field comment shape to mirror** (lines 225-234):
```typescript
    /**
     * Efforts demoted by any guard (world-record, max-speed or ceiling —
     * Phase 28 D-08), across every distance and regardless of
     * `excludedFromRecords` — an owner-excluded effort that also exceeds
     * its ceiling is counted here too (Phase 28 CR-01). Purely additive:
     * does not require a `BEST_EFFORTS_SCHEMA_VERSION` bump per that
     * constant's own comment, matching Phase 26 D-14's precedent for
     * additive fields.
     */
    effortsDemoted: number;
```
The new `contaminated: {...} | null` field on `ComputedEffort` (D-05) should carry an equivalent
comment naming this phase and citing the same schema-version non-bump rule.

**Guard union to widen** (line 82):
```typescript
export type EffortDemotionGuard = 'world-record' | 'max-speed' | 'ceiling';
```
becomes `'world-record' | 'max-speed' | 'ceiling' | 'unreliable-segment'`. Its own docblock (lines
79-81) already states the pattern to follow: name the new guard, state what it means, in the same
comment block — do not add a bare union member with no prose.

**Precedence docblock to extend** (lines 110-129, `ComputedEffort.demotion`'s comment) — this is
where D-08's "resolves the input FIRST, not a fourth guard racing to overwrite" rule belongs,
mirroring how the existing comment already states "once `demotion` is non-null, no later pass
re-evaluates it" for world-record/max-speed vs ceiling.

---

### `src/analytics/compute-best-efforts.ts` — Pass 1 partition-and-search + write-gate

**Analog:** itself. Two distinct edit sites in the same file, both confirmed by direct read (full
586 lines).

**Site 1 — the per-target loop inside `computeActivityEfforts`, where the search lands** (lines
128-169, reproduced above the `raw = findBestEffort(...)` call at line 130). The new
partition/complement/search logic (RESEARCH.md Pattern 1's `complementSubIntervals` +
minimum-across-sub-intervals loop) is textually inside this function, which is defined starting at
line 111 — entirely before the file's own `PASS 1` comment (line 235) even begins, so it is
categorically outside the `PASS 2`...`PASS 3` audited slice (see Constraints below). Add
`segments: UnreliableSegment[]` to `ActivityEffortInput` (line 88-96) per RESEARCH.md's
recommendation, computed by the caller (the per-activity loop at lines 252-333, which already reads
`stream.t`/`stream.d` at line 270 — add one `classifyGapsWithSegments(stream.t, stream.d).segments`
call there and pass it into `computeActivityEfforts`'s input object at line 264-272).

**Site 2 — the ceiling-state write, gated behind D-11's new flag** (lines 556-573):
```typescript
  if (ceilingMovement.length > 0) {
    const stateFile = buildCeilingStateFile(doc.ceilings, doc.generatedAt);
    await fileStore.writeJson(ceilingStatePath, stateFile);
    console.log(`  Committed ceiling state updated: ${ceilingStatePath}`);
  }
```
D-11's recommended gate widens the `if` to `options.writeCeilingState && ceilingMovement.length > 0`,
with `writeCeilingState?: boolean` (default `false`) added to `ComputeBestEffortsOptions` (lines
174-182, alongside the existing `ceilingStatePath?: string` sibling already there).

**Single shared demotion-construction discipline to preserve** (lines 54-85,
`demotionFromPlausibility`'s docblock): "nothing else in this file may assign to an effort's
`demotion` field, so one guard cannot silently diverge from another." The new
`'unreliable-segment'` guard's `demotion`/`contaminated` construction (D-06's no-clean-window case)
should follow the same one-function-owns-this-assignment discipline — a new sibling constructor,
never an inline object literal scattered across call sites.

**`byDistance` accumulator — confirmed unchanged, structural filter already sufficient** (lines
296-313, especially line 304): `if (effort.demotion !== null) continue;` — this is the exact
mechanism RESEARCH.md's Pattern 2 cites as the reason `best-effort-ceiling.ts` needs zero code
change: once the top-level `durationSec` is always the clean figure when one exists, a contaminated
timing can never reach `byDistance` through any new branch, only through this existing one.

---

### `src/analytics/best-effort-ceiling.ts` — confirmed zero-change target

**Call graph verified this session:** `deriveCeilings`/`deriveCeiling` read only
`impliedSpeedsByDistance` (built at `compute-best-efforts.ts:347-352`, itself built only from
`byDistance`, itself fed only by the `effort.demotion === null` branch at line 304). No new
parameter, branch or import is needed in this file. Record this explicitly in the plan rather than
silently omitting the file — RESEARCH.md and CONTEXT.md both flag it as a claim to confirm, not
assume.

---

### `src/dashboard/data/best-efforts-client.ts` — `parseContaminated` mirrors `parseDemotion`

**Analog:** `parseDemotion`, same file, lines 58-65 (read in full):
```typescript
function parseDemotion(raw: unknown): EffortDemotion | null {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) return null;
  const { guard, reason } = raw;
  if (typeof guard !== 'string' || !VALID_DEMOTION_GUARDS.has(guard)) return null;
  if (typeof reason !== 'string') return null;
  return { guard: guard as EffortDemotionGuard, reason };
}
```

**The allowlist it depends on** (lines 44-48):
```typescript
const VALID_DEMOTION_GUARDS: ReadonlySet<string> = new Set<EffortDemotionGuard>([
  'world-record',
  'max-speed',
  'ceiling',
]);
```
This is the **exact site named by D-06** as one of the three homes the new guard value needs —
omitting `'unreliable-segment'` here makes every no-clean-window demotion silently vanish in the
browser (returns `null` from `parseDemotion`, same as an unrecognized/future guard).

**`parseContaminated`'s shape** — follow `parseDemotion`'s total, never-throwing structure, but
additionally validate the four numeric fields (`durationSec`, `paceSecPerKm`, `startOffsetSec`,
`endOffsetSec`) the way `parseEffort` validates its own numeric fields immediately below (lines
68-88, especially the `typeof durationSec !== 'number'` checks at line 72-73). Call it from
`parseEffort`'s own field destructure (line 70) exactly where `demotion` is parsed today (line 86),
adding a parallel `contaminated: parseContaminated(contaminated)` field to the returned `BestEffort`
object.

---

### `src/dashboard/views/records-logic.ts` — guard switch + walk-the-document disclosure

**Analog:** `countDemotedAtDistance`, same file, lines 187-228 (read in full).

**The switch to extend** (lines 204-223):
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
          // Unrecognized guard value ...
          counts.other++;
          break;
      }
```
This is the **second of D-06's three required homes** — omitting `'unreliable-segment'` here does
not vanish the guard (it still hits `default`/`other`), but buckets it into an unexplained "other"
count rather than a named one, per D-06's own text ("would otherwise bucket it into `other`").

**Walk-the-document count for D-16 (the ~1,200 moved efforts, which carry no `demotion` at all)** —
the analog is the same function's own shape (walk `Object.keys(activities)`, then
`activity.efforts`, respecting `excludedFromRecords`), but counting `effort.contaminated != null`
instead of `effort.demotion != null`, per RESEARCH.md's D-16 recommendation. This is also the
pattern named directly in CONTEXT.md D-16 ("the `effortsDemoted` precedent at
`compute-best-efforts.ts:450-462`") — that function's shape (a plain `for` loop, not `.filter`, so a
source-text audit can distinguish a read-only count from a mutation) is the one to mirror for the
new function, not `countDemotedAtDistance`'s `Object.keys` idiom alone.

**`effortsDemoted`, the walk-the-document precedent in the other module** (`compute-best-efforts.ts`,
lines 450-462):
```typescript
  let effortsDemoted = 0;
  for (const activity of Object.values(sortedActivities)) {
    for (const effort of activity.efforts) {
      if (effort.demotion !== null) effortsDemoted++;
    }
  }
```

---

### `src/dashboard/views/detail-best-efforts-logic.ts` — `BestEffortPanelRow.contaminated` + badge branch

**Analog:** the `demoted`/`demotionReason` field pair and its badge branch, same file (read in
full, 290 lines).

**Field pair to mirror** (lines 110-121, plus the population site at lines 200-201):
```typescript
  /**
   * True when a plausibility guard (world-record, max-speed or ceiling —
   * Phase 28 D-08) demoted this effort — a MACHINE judgment, entirely
   * separate from `excluded` (the owner's stated intent, D-10). ...
   */
  demoted: boolean;
  /** The demoting guard's reason string, or `null` when `demoted` is false or the reason itself is absent. */
  demotionReason: string | null;
```
```typescript
      demoted: effort.demotion != null,
      demotionReason: effort.demotion?.reason ?? null,
```
New fields: `contaminated: boolean`, `contaminatedReason: string | null`, populated from
`effort.contaminated != null` / `effort.contaminated?.reason ?? null` — same total-read,
never-throws-on-a-stale-shard idiom (`!= null`, T-28-02-A discipline stated in the existing
comment).

**Badge spec branch to mirror** (lines 246-289, `prFlagBadgeSpecs` — note: the actual exported name
is `prFlagBadgeSpecs`, not `buildPrFlagBadgeSpecs` as named in the phase's `<known_targets>`/
`<analogs_to_prioritize>` hints — correct this in the plan). The `demoted` branch:
```typescript
  if (row.demoted) {
    specs.push({
      kind: 'demoted',
      visibleText: row.demotionReason ? `Demoted — ${row.demotionReason}` : 'Demoted from ranking',
      explanation:
        'this effort is left out of the ranked PR list because a plausibility guard rejected it; it stays visible here with its reason',
      descriptionIdSuffix: 'demoted',
    });
  }
```
`PrFlagBadgeSpec.kind` (line 217) is a closed union `'pr' | 'demoted' | 'low-confidence' |
'excluded'` — the new branch needs its own `kind` value (e.g. `'contaminated'`) added to that union,
plus a new `if (row.contaminated) { specs.push({...}) }` block, per D-15's copy direction ("Ranked
on clean window — {reason}"). Emission order is currently `pr`, `demoted`, `low-confidence`,
`excluded` (line 237's own stated order) — place the new branch per Claude's Discretion (D-15), but
state the chosen position explicitly since the existing comment states the order as a deliberate
fact, not an accident.

---

### `scripts/compute-ceiling-recalibration.mjs` + `.test.mjs` — D-09's artifact generator

**Analog:** `scripts/compute-pr-ceiling-calibration.mjs` (963 lines, read structurally) producing
`28-CEILING-CALIBRATION.md` (116 lines, read in full).

**Provenance convention — no git hash, timestamp only** (`28-CEILING-CALIBRATION.md` line 5, and
the generator at line 569):
```
**Generated:** 2026-09-19T12:44:36.122Z
```
```javascript
    generatedAt: new Date().toISOString(),
```
This is exactly the "must not embed a `git rev-parse HEAD`" constraint — the shipped artifact's
provenance line is a wall-clock ISO timestamp plus the *input documents'* own `generatedAt` values
(see the artifact's `## Inputs` section below), never a source/commit hash. The idempotence test
strips exactly this one line before diffing (see next section).

**Artifact structure to mirror** (full file read, `28-CEILING-CALIBRATION.md`):
1. Header sentence naming the exact `npm run <script>` regeneration command and what constants/
   figures the report records.
2. `**Generated:** <ISO timestamp>` line.
3. A "Chosen constants" or headline table.
4. Per-distance table(s) with reconciliation against the phase's own CONTEXT.md figures, explicitly
   labeled "drift is reported, never silently absorbed" (line 34) — this is D-12's exact
   requirement (every row's movement gets a stated cause) already precedented here.
5. A closing `## Inputs` section naming every source document's own path + `generatedAt`, plus the
   regeneration command repeated in a fenced code block (lines 106-116).

**Generator shape** (grepped structurally): pure exported functions (`buildFilteredPopulations`,
`describeDistribution`, `deriveCeilingMultiplier`, `buildCalibrationReport`,
`renderCalibrationMarkdown`, etc.) plus one `main()` (line 888) gated behind
`if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }` (lines 961-962) —
so the `.test.mjs` sibling can import and call the pure functions directly without triggering a real
file read/write as an import-time side effect.

**`renderCalibrationMarkdown`'s own idempotence contract** (line 597, its docblock states the
function "must produce byte-identical output between two calls over an unchanged `report` (aside
from `generatedAt`)") — the new `compute-ceiling-recalibration.mjs`'s renderer needs the identical
contract stated and tested (run twice, diff everything except the `**Generated:**` line).

---

### `scripts/compute-clean-window-diff.mjs` + `.test.mjs` — PR-09 leg 1

**Analog:** `scripts/compute-pr-ceiling-diff.mjs` (715 lines, read structurally + key sections in
full), producing `28-DIFF.md`.

**Throwaway-path pattern, the direct precedent named in CONTEXT.md D-11** (lines 55-73, 657-704):
```javascript
import { computeBestEfforts } from '../dist/analytics/compute-best-efforts.js';
...
async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), 'pr-ceiling-diff-'));
  const throwawayStatsDir = join(tempDir, 'stats');
  ...
  try {
    const newDoc = await computeBestEfforts({
      statsDir: throwawayStatsDir,
      ceilingStatePath: throwawayCeilingStatePath,
    });
    ...
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```
Both `statsDir` and `ceilingStatePath` are OS-temp paths — the generator can never mutate
`data/stats/best-efforts.json` or the tracked `data/best-effort-ceiling.json` it describes. With
D-11's new `writeCeilingState` option defaulting `false`, this script is "doubly safe" per
RESEARCH.md's Code Examples note — it need not even pass `writeCeilingState: true`.

**Sanitization helpers to reuse verbatim** (lines 74-90):
```javascript
const VALID_ACTIVITY_ID = /^i?\d{1,20}$/;
function safeActivityId(activityId) {
  if (typeof activityId === 'string' && VALID_ACTIVITY_ID.test(activityId)) return activityId;
  return '(malformed id)';
}
function safeCell(value) {
  return String(value).replace(/[\n\r|]/g, ' ').trim();
}
```
Any activity ID or reason string (including the new bounded-length, multi-segment `contaminated`
reason strings, D-07) rendered into a markdown table cell in the new diff must pass through
equivalent sanitizers — this is the T-28-07-B discipline against a `|`/newline injecting into the
artifact's own table structure.

**Reconstruction-not-second-sweep pattern** (lines 94-119, `reconstructOldDocument`'s docblock and
body): the OLD state is derived by filtering the NEW shipped document's own efforts (drop
excluded, drop absolute-guard demotions, retain everything else) and re-running the SAME pure
`markPRs`/`rankTopN` functions — never a second orchestration run. RESEARCH.md's D-08 finding
flags a **new** reconstruction wrinkle this phase needs beyond Phase 28's: for the retained
population, "OLD" duration must be the pre-Phase-36 **unconstrained** sweep result (today's `raw`),
not the new clean-window result — record this explicitly, since it is a genuinely new rule, not a
copy of Phase 28's.

**Sign-off is external, never embedded in the artifact** (`28-DIFF.md` line 3, generator lines
426-438): "NO sign-off block by design (D-14): the developer's approval lives in `28-VALIDATION.md`,
bound to this file's content hash." The signature PR-09 needs is a sha256 computed externally
(e.g. `sha256sum 36-DIFF.md`) and recorded in the phase's own VALIDATION.md — never a field the
generator writes into the artifact itself. Mirror this discipline exactly; do not invent an in-file
sign-off block.

---

### `scripts/compute-clean-window-recount.mjs` + `.test.mjs` — PR-09 leg 3, D-13

**Analog:** `scripts/compute-pr-ceiling-recount.mjs` (865 lines) and
`scripts/compute-elevation-recount.mjs` (430 lines), both read in full for their header docblocks
and import lists.

**Zero-import discipline, stated as an explicit FORBIDDEN list in the header** (recount, lines 1-22;
elevation-recount, lines 1-25):
```javascript
/**
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the ceiling module (`dist/analytics/best-effort-ceiling.js` or its `src/` equivalent),
 * the compute step (`dist/analytics/compute-best-efforts.js` / `src/` equivalent), the
 * best-effort utils (`dist/analytics/best-effort-utils.js` / `src/` equivalent), or the
 * best-effort types (`dist/analytics/best-effort.types.js` / `src/` equivalent), by any spelling.
 */
```
Only import: `fs.readFileSync` + `path`/`url`. Actual imports observed (recount, lines 60-62):
```javascript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
```

**Own local constant table, duplicated deliberately** (recount, lines 77-90):
```javascript
const TARGET_METERS_LOCAL = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
};
```
Comment above it states the reason explicitly: "this file must not import `best-effort.types.js`/
`.ts` or any other classifier module for these numbers... Duplicating this tiny constant table is
the price of staying a genuinely independent recount." The new recount needs its own such
constant, and per RESEARCH.md's D-13 resolution, must NOT import `classifyGapsWithSegments`
either (importing it is importing "the detector" by the same bar) — its "different algorithm"
must be a self-referential per-window outlier statistic computed fresh from the raw stream, not a
rearrangement of the two-pointer sweep or the detector's own arithmetic.

**"THE BOUND ON ITS CLAIM" header convention** (recount lines 16-22, elevation-recount lines
22-25) — both state explicitly what the recount does NOT arbitrate (the classifier's own calibrated
constants). The new recount's header must state the equivalent bound: it confirms an anomaly exists
and the shipped counts are internally consistent; it does not and cannot judge whether Phase 32's
detector thresholds are exactly right.

**Pinned regression fixture pattern** (recount, lines 72-75):
```javascript
const PINNED_ACTIVITY_ID = '4556693525';
const PINNED_DISTANCE = '400m';
const PINNED_DURATION_SEC = 45.2;
```
PR-09's own three scoping activities (`3475740390`, `3475724402`, `3475734189`, their 400m efforts
at 3:20/3:21/3:22 today) are the direct analog for this recount's own pinned fixtures.

---

### `.planning/phases/36-.../36-CEILING-RECALIBRATION.md` — the artifact of record

**Analog:** `28-CEILING-CALIBRATION.md` (full structure above) and `30-CALIBRATION.md` (same
milestone-artifact convention, not re-read in full — same generator/test-sibling/provenance shape
confirmed via directory listing and the shared `compute-*-calibration.mjs` naming convention).

Key transferable properties, all directly observed in `28-CEILING-CALIBRATION.md`:
- Every number/table is templated from the generator's own computed values, never hand-typed.
- Drift against a prior document's quoted figures is reported explicitly, not silently absorbed
  (D-12's exact bound).
- A trailing `## Inputs` section names every source document's own path and `generatedAt`.
- A fenced regeneration command closes the file.
- No sign-off block (same discipline as `28-DIFF.md`).

---

### Archive-wide equivalence / overlap test (D-01, D-03)

**Analog:** `pace-derivation.test.ts`'s `readStream` helper and its archive-sweep `describe` blocks
(read in full, relevant lines 65-68, 835-872).

**The helper to mirror** (lines 65-68):
```typescript
/** Reads a committed stream file from `data/streams/` — never the derived stats output. */
function readStream(activityId: string): CanonicalStream {
  return JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  );
}
```
`data/streams/` is confirmed tracked in git (not gitignored — only `data/stats/`,
`data/dashboard/`, `data/tokens.json`, `data/private/*.json` are excluded, per RESEARCH.md's direct
`.gitignore` check), so a full-archive sweep inside `npm test` reads real committed fixtures, no
mocking required. The named archive-sweep test at line 835 ("itemised identity holds for a named
sample of real archive activities") is the shape to mirror for D-01's whole-span-vs-burst-only
equivalence sweep and D-03's overlap invariant — both need to iterate every activity in
`data/streams/manifest.json`, not a hand-picked sample.

---

## Shared Patterns

### Total, never-throwing browser-side parsing
**Source:** `src/dashboard/data/best-efforts-client.ts:58-88` (`parseDemotion` + `parseEffort`)
**Apply to:** `parseContaminated`, the new fourth `VALID_DEMOTION_GUARDS` member.
Every malformed/missing field degrades to `null`/a safe default; nothing throws into the render
path. This is ASVS V5's control for this phase per RESEARCH.md's Security Domain section.

### Additive document fields need no schema-version bump
**Source:** `best-effort.types.ts:15-16` (`BEST_EFFORTS_SCHEMA_VERSION`'s own comment: "Bump only
via an explicit, coordinated recomputation") + the two live precedents at lines 225-234, 239-245.
**Apply to:** `ComputedEffort.contaminated`.

### One function owns a guard's `demotion`/`contaminated` construction
**Source:** `compute-best-efforts.ts:54-85` (`demotionFromPlausibility`'s docblock: "nothing else in
this file may assign to an effort's `demotion` field").
**Apply to:** the new `'unreliable-segment'` guard's construction, in both the D-06 (no-clean-window,
sets `demotion`) and D-05 (clean window exists, sets `contaminated`) branches.

### A guard value's three required homes (D-06's own list)
**Source:** `best-effort.types.ts:82` (`EffortDemotionGuard` union) → `best-efforts-client.ts:44-48`
(`VALID_DEMOTION_GUARDS`) → `records-logic.ts:204-223` (the switch). Every one of the three must be
edited together; the allowlist silently drops an unlisted guard (browser-visible regression with no
type error), and the switch silently buckets an unlisted guard into `other` (a visible but
mis-labeled regression).
**Apply to:** the new `'unreliable-segment'` guard.

### Walk-the-shipped-document counts, never an incrementing counter
**Source:** `compute-best-efforts.ts:450-462` (`effortsDemoted`, a plain `for` loop over the built
document) and `records-logic.ts:187-228` (`countDemotedAtDistance`).
**Apply to:** D-16's records-view disclosure of the ~1,200 moved-but-ranked efforts (walk
`effort.contaminated != null`, never a counter threaded through the pipeline).

### Generated artifact discipline: timestamp-only provenance, idempotence proven by a second run, no embedded sign-off
**Source:** `scripts/compute-pr-ceiling-calibration.mjs` (`generatedAt: new Date().toISOString()`,
line 569) + `28-CEILING-CALIBRATION.md` line 5 + `28-DIFF.md` line 3 ("NO sign-off block by
design... the developer's approval lives in `28-VALIDATION.md`, bound to this file's content hash").
**Apply to:** all three new generated artifacts (`36-CEILING-RECALIBRATION.md`, the diff, and by
extension the recount's own console/exit-code verdict).

### Zero-import, fails-closed, own-local-constants recount
**Source:** `scripts/compute-pr-ceiling-recount.mjs:1-90`, `scripts/compute-elevation-recount.mjs:1-45`.
**Apply to:** `scripts/compute-clean-window-recount.mjs` (D-13) — must not import
`compute-best-efforts.js`, `best-effort-ceiling.js`, `best-effort-utils.js`, `best-effort.types.js`,
**or** (per RESEARCH.md's sharper D-13 reading) `pace-derivation.js`'s `classifyGapsWithSegments`,
since that transitively imports the detector.

### Full-archive sweep inside vitest, reading tracked `data/streams/`
**Source:** `pace-derivation.test.ts:65-68, 835-872`.
**Apply to:** D-01's whole-span-vs-burst-only equivalence test, D-03's overlap invariant.

---

## Constraints Confirmed Against the Live Tree

- **`pace-single-source.test.ts`'s `BANNED_LITERALS`** (grepped and read, lines 144-156, 358):
  bans exactly two literal strings — `'dt / (dd / 1000)'` (the pace-division shape) and
  `'speedLimitMps * seconds'` (`DETECTOR_ARITHMETIC_LITERALS`, the detector's own excess-metres
  arithmetic). **It does not ban a duplicate two-pointer sweep** (`d[j] - d[i] >= targetMeters`
  or any rewording of it) — RESEARCH.md's finding 2 is confirmed directly against the source. The
  planner must not rely on this file to catch a second sweep implementation; if drift-prevention is
  wanted, it is new work this phase must add, not an existing guard it can lean on.

- **`compute-best-efforts.test.ts`'s "no iteration to convergence" suite** (confirmed at lines
  1696-1831, the exact audit at 1812-1830): does `source.indexOf('PASS 2')` /
  `source.indexOf('PASS 3')` on the file's own source text and asserts the slice between those two
  literal markers contains no `for`/`while` outside comments. `computeActivityEfforts` (where the
  new partition-and-search code belongs, per D-14) is defined at line 111 — entirely before the
  `PASS 1` comment at line 235, let alone `PASS 2` at line 335 — so any new code inside that
  function, including its own `for` loops over sub-intervals, sits textually outside the audited
  slice and cannot break this test. Zero modification to the test is needed or permitted.

- **`compute-best-efforts.ts:556-573` is the exact ceiling-state write site D-11 gates** — confirmed
  by full read; the conditional today is `if (ceilingMovement.length > 0)` and the file's own
  comment (lines 556-568) already documents the hazard D-11 must close ("a nightly commit against a
  repository whose CI already races `origin/master`... dirty this CI-committed file with a
  locally-derived baseline CI never produced").

- **CLI entry points for D-11's flag threading**: `src/index.ts:197` (`computeBestEffortsCommand`)
  and the existing `--ci` flag precedent at lines 315-333 (`continueOnError = process.argv.includes
  ('--ci')`, threaded into `runComputeAllStatsSteps`) — confirmed as the shape to extend for a new
  `--write-ceiling-state` flag, not yet threaded anywhere per RESEARCH.md's own verification.

- **`unreliable-segments.ts`'s `UnreliableSegment`/`SegmentPart` shapes** (confirmed by full read,
  lines 154-211): `SegmentPart.kind: 'burst' | 'gap'`, both carrying `startIndex`/`endIndex`/
  `startSec`/`endSec`/`metres`/`seconds`. `UnreliableSegment.parts[]` is exactly what D-01's two
  readings (whole-span vs burst-only) partition over, and what D-07's reason string can quote
  per-part.

- **`classifyGapsWithSegments`'s own docblock is the one sanctioned accessor** (confirmed, lines
  492-544 read in full): "This function is the SOLE call site of `detectUnreliableSegments` in this
  module... any module needing BOTH the coverage accounting AND the detector's own
  `UnreliableSegment[]`... calls this function once." Its Pass 3 containment rule (lines 574-579,
  `for (let i = seg.startIndex; i < seg.endIndex; i++) { pairKinds[i] = 'unreliable'; }`) is the
  EXACT index-boundary convention D-01's whole-merged-span reading reuses — confirmed identical.

## No Analog Found

None. Every file in the known-targets list has a direct, in-repo precedent — this phase is
described in its own RESEARCH.md as "composition and one new field, not new algorithms," and that
held up against direct reads of every named file.

## Metadata

**Analog search scope:** `src/analytics/`, `src/dashboard/data/`, `src/dashboard/views/`,
`scripts/`, `.planning/milestones/v2.2-phases/{28-pr-plausibility-ceiling,30-elevation-quality-signal}/`.
**Files read in full or structurally this session:** `best-effort-utils.ts`, `best-effort.types.ts`,
`compute-best-efforts.ts` (586 lines, full), `compute-best-efforts.test.ts` (targeted, the
1696-1831 "no iteration to convergence" suite), `unreliable-segments.ts` (lines 140-360),
`pace-derivation.ts` (lines 490-590), `best-efforts-client.ts` (185 lines, full), `records-logic.ts`
(lines 160-330), `detail-best-efforts-logic.ts` (lines 90-291), `28-CEILING-CALIBRATION.md` (116
lines, full), `compute-pr-ceiling-calibration.mjs` (structural grep + targeted reads),
`compute-pr-ceiling-diff.mjs` (targeted reads of throwaway-path, sanitizer, reconstruction, sign-off
sections), `compute-pr-ceiling-recount.mjs` (lines 1-90), `compute-elevation-recount.mjs` (lines
1-45), `pace-single-source.test.ts` (grepped for `BANNED_LITERALS`/`DETECTOR_ARITHMETIC_LITERALS`),
`pace-derivation.test.ts` (grepped for archive-sweep structure), `src/index.ts` (grepped for CLI
flag threading), `28-VALIDATION.md` (grepped for the sha256 sign-off convention), `28-DIFF.md`
(grepped for the "no sign-off block" line).
**Pattern extraction date:** 2026-09-28
