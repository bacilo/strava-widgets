# Phase 37: Review-Queue Priority & CUR-04 - Research

**Researched:** 2026-11-25
**Domain:** Local curation tooling (Node `http` server, esbuild-bundled browser client, zero-import `.mjs` derivation), additive field on the best-efforts compute path, two publish guards, an independent recount script
**Confidence:** HIGH (every structural claim below was read from the code or measured live in this session; the few judgement calls are listed in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** **The reviewed file is never published.** Curate-only state; no public surface reads it. Any copy under `dist/widgets` is a leak. This is what CUR-04's "red under a planted leak" rows test. Contrast: `best-effort-exclusions.json` is deliberately public and stays so.
- **D-02:** **Location: `data/curation/reviewed.json`, committed.** A new directory that is in neither of `build-widgets.mjs`'s `dataDirs`/`dataFiles` lists, so nothing copies it. Rejected: `data/private/` — `.gitignore:22` ignores `data/private/*.json`, so a committed file there needs a negation line that is easy to get wrong.
- **D-03:** **Guard 1 (build layer, `scripts/lib/curation-guard.mjs` / `build-widgets.mjs`) catches the leak by PATH, not content.** Add an explicit existence check for the file's would-be published path(s) in `dist/widgets` (the shape of the existing `data/private` existence check, `build-widgets.mjs:177`). The `.json` content-scan exemption stays untouched — it is load-bearing for keeping the public exclusions file un-flaggable. The check must be watched red on a planted copy before it passes. Research decides whether to also forbid the whole `data/curation/` tree.
- **D-04:** **Guard 2 (HTTP layer, `scripts/verify-dashboard-publish.mjs`) asserts 404** on every new `/__curate/reviewed...` route AND on `/data/curation/reviewed.json` over the served build, as literal paths beside the existing `expect404` list (never widened into a prefix match against `/data/` — the existing comment at ~line 468 forbids that). Red under a planted leak, green on the served build.
- **D-05:** **Entry shape: `{ activityId, reason, reviewedAt, fingerprint }`** in a `{ schemaVersion, note, reviewed: [...] }` document. `reason` required, non-empty after trim; `reviewedAt` ISO date; `fingerprint` per D-12. Malformed entries are skipped AND counted, mirroring `countMalformedExclusions` (Phase 29 D-09) — never silently dropped.
- **D-06:** **"Moved by the unreliable-segment guard" = either kind.** An activity qualifies if any effort has `contaminated != null` (ranks on the clean window) OR `demotion.guard === 'unreliable-segment'` (no clean window). Plus transported-class activities. Phase 29 D-01's "any non-null demotion" membership is kept, so the queue is the union. Amends Phase 29 D-04 ("demotions only") to admit the two CUR-06 populations.
- **D-07:** **"Contaminated metres" = metres of the unreliable segments that intersect the activity's contaminated effort windows, each segment counted once per activity** even when several distances' windows hit it. It is what actually touched a PR. It must come from a numeric source — an additive field computed from the detector's `UnreliableSegment` output (e.g. on `contaminated` and on the unreliable-segment `demotion`), or an equivalent the researcher proposes — **never parsed from the reason string** (finding 1). Additive field ⇒ no `BEST_EFFORTS_SCHEMA_VERSION` bump (Phase 26 D-14 / Phase 36 D-05 precedent); the browser client (`best-efforts-client.ts`) must parse it fail-closed. Rejected: activity-wide `unreliableSegments.totalMetres` (ranks harmless jumps on long runs above a PR that sat on a 50 m jump); "how far the pace moved" (departs from CUR-06's wording).
- **D-08:** **Order (default view):** 1. transported-class activities, by contaminated metres desc; 2. guard-moved activities (D-06), by contaminated metres desc; 3. remaining Phase 29 rows (world-record / max-speed / ceiling demotions only) — no metres key. Ties at every level: newest-first, then activityId — stable across reloads. A transported activity with no contaminated effort has metres 0 and sorts last within tier 1. Replaces Phase 29 D-05 ("not-yet-excluded first, newest-first") for the default view; excluded and reviewed rows are no longer in the default view (D-15), so they need no tier there. Within the Excluded / Reviewed / All views the same comparator applies.
- **D-09:** **The independent recount checks count AND order.** A committed, zero-import script (the `compute-unreliable-segment-recount.mjs` / 32 D-15 / 34 D-18 pattern, fails closed) re-derives the membership set and each row's tier and metres from raw `best-efforts.json`, the dashboard index and the committed streams, without importing the queue's derive function or the detector. It must be shown failing against a deliberately broken derive (wrong tier or wrong metres) before it passes. A count-only check passes on a wrong sort — the internal-agreement trap.
- **D-10:** **Resurface on change.** A reviewed row stays out of the default view only while its current fingerprint equals the stored one. On mismatch it returns to "To review" marked "changed since review", showing the old reason and date. "Reviewed" means "reviewed this evidence".
- **D-11:** **Excluded and reviewed-and-kept are mutually exclusive.** "Kept" contradicts "excluded". The UI does not offer review on an excluded row without un-excluding first (and vice versa), the server rejects a write that would create both, and a test asserts no activityId appears in both files.
- **D-12:** **Fingerprint = which flags, not how much:** the set of (distance, guard) pairs over the activity's flagged efforts (demotion guards and `contaminated`), plus a transported yes/no. It resurfaces when a new distance or guard is flagged or transported appears. Metre drift from re-derivation or recalibration does NOT resurface rows. Canonical, order-independent serialisation so the stored value is stable. No new threshold constant.
- **D-13:** **Orphans are kept and shown.** A reviewed entry whose activity is no longer in the flagged set is never auto-deleted (curate must not rewrite committed state it was not asked to); the Reviewed view lists it as "no longer flagged" with a count, removable by hand via the normal un-review action.
- **D-14:** **Un-review deletes the entry** (DELETE on the route), mirroring exclusion removal. Git history is the audit trail since the file is committed by hand. No tombstones.
- **D-15:** **Four views: To review (default) / Reviewed / Excluded / All.** To review = not excluded and (not reviewed or fingerprint changed). Reviewed includes orphans. Excluded holds today's excluded-but-listed rows. All = the full flagged set, so Phase 29 D-02's "listed set equals the flagged set" still holds under All. The summary line shows a count per view. Amends Phase 29 D-02/D-05 for the default view only.
- **D-16:** **Sibling route sharing the existing machinery:** `PUT`/`DELETE /__curate/reviewed/:activityId`, plus a `GET` for the queue to read the file (it is not mirrored into `dist/widgets`, unlike exclusions — this amends Phase 29 D-08's "derive from already-mirrored JSON" for this one input). Same server, same Origin/Host gate, same `MAX_BODY_BYTES` / `MAX_REASON_CHARS`, same activity-id validator, same atomic write path as `/__curate/exclusions/:id` — so it is not a second write surface. Rejected: one route with a `state` body writing to two files (one handler owning a ranking-critical file and a cosmetic one).
- **D-17:** **Reason is blank and required** for reviewed-and-kept — the developer's judgement, not a copy of the flags (the fingerprint already records those). Exclude keeps its Phase 29 D-11 prefill unchanged.
- **D-18:** **One row at a time.** No bulk action; each review carries its own reason.
- **D-19:** Checkpoint rows assert values derived independently of the code under test (D-09's recount for order/count; a planted copy for each guard). Each discriminator gets the standing reachability check in both directions (can fail, can pass) before it is relied on.
- **D-20:** The browser checkpoint for the filters / resurface behaviour runs on the primary checkout against a freshly built `dist/widgets` (staged-build cache trap; build-widgets mtime skip — verify the served digest).

(Also carried from CONTEXT.md "Measured during this discussion": every figure there — 371 / 365 / 194 / 451 / 5 / 565 — is a REFERENCE to reconcile against, never an expected value.)

### Claude's Discretion

- Exact field name and placement of the D-07 numeric metres (on `contaminated`, on the demotion, or a per-activity aggregate) — bound by D-07: numeric, detector-derived, additive, fail-closed in the browser client, recountable by D-09.
- Whether guard 1 forbids just the file path or the whole `data/curation/` tree (D-03).
- Copy for "changed since review" and "no longer flagged" (house register: measured facts, not adjectives).
- Fingerprint serialisation format (D-12).

### Deferred Ideas (OUT OF SCOPE)

- Bulk review with a shared reason — rejected for now (D-18); revisit if the tail proves tedious.
- CUR-05 per-effort override — already deferred in REQUIREMENTS.md.
- Not in scope: any change to ranking, to `best-effort-exclusions.json`'s meaning, or to the public dashboard.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUR-04 | A queue row can be marked "reviewed and kept" with a required reason, distinct from exclude; persists in its own committed file (not `best-effort-exclusions.json`) through the existing overlay transport only; leaves the default view, reachable under a "reviewed" filter; reversible; both publish guards shown red under a planted leak and green on the served build. | Sections "Server write path", "Guard 1 / Guard 2 design", "Reviewed-file lifecycle", "Queue UI". Concrete handler shape, mutual-exclusion enforcement, guard additions with planted-fixture rows. |
| CUR-06 | The queue also lists activities moved by the unreliable-segment guard and activities with a transported-class pause, ordered transported-first then by contaminated metres, with the count equal to an independent recount. | Sections "D-07 contaminated metres", "Derivation design", "D-09 recount design". Measured feasibility of the metres field (index-space vs seconds-space agreement on every flagged activity), and the dedupe rule's load. |
</phase_requirements>

## Summary

Phase 37 is almost entirely an extension of existing, well-tested seams, with one genuine compute-side change. The queue derivation (`derive-flagged.mjs`) gains two populations (guard-moved, transported), a tiered comparator and a reviewed overlay; the curate server gains one sibling route pair plus a GET; the overlay transport gains two functions; both publish guards gain literal assertions. The only cross-layer change is a new numeric field on the best-efforts document, because the contaminated-window metres do not exist anywhere as a number today (the reason string is length-bounded with "+N more").

The most important findings: (1) `computeActivityEfforts` already holds the exact `intersecting` segment list per distance in Branch 2 and Branch 3, so the per-activity, de-duplicated metres can be computed there by a `Map` keyed on `startIndex:endIndex`, and emitted as one additive activity-level field. I prototyped this against the live archive and compared it with a seconds-space reconstruction from the pace-quality shards plus the shipped window offsets: they agreed on every guard-moved activity, and the de-duplication is load-bearing (a naive per-effort sum would be wrong on a large majority of them). (2) Segment metres in the shards equal `d[endIdx] - d[startIdx]` from the committed stream exactly, which gives the D-09 recount a detector-free source for the metres claim. (3) Regenerating `best-efforts.json` takes about 2.6 s, so there is no cost reason to avoid the compute-side field. (4) Guard 1's `.json` exemption means a leaked `reviewed.json` is invisible to the content scan, so the path check must live inside the pure `findCurationArtifacts` (testable on a planted tmp tree) rather than as an inline `process.exit` in `build-widgets.mjs`. (5) The existing Phase 29 live-archive cross-check, the D-05 ordering tests and several source-text tests assert the old behaviour and must be rewritten and declared in `files_modified`.

**Primary recommendation:** Add `contaminatedMetres: number` as an additive, always-present, activity-level field on `ActivityBestEfforts` (computed once per activity, de-duplicated by segment index pair, rounded to 0.1, covering both Branch 2 and Branch 3 windows); extend `derive-flagged.mjs` with tier/metres/fingerprint/view logic; add `/__curate/reviewed` GET + `/__curate/reviewed/:id` PUT/DELETE through a path-injectable `createServer`; put the guard-1 path check inside `findCurationArtifacts`; and write `compute-review-queue-recount.mjs` that sources metres from pace-quality shards cross-checked against streams, compared to the derive output only inside a test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contaminated-metres figure (D-07) | Build-time compute (`src/analytics/compute-best-efforts.ts`) | Browser client parse (`best-efforts-client.ts`) | Only the compute step has the detector's `UnreliableSegment[]` and the per-distance `intersecting` list; the browser must never re-derive it. |
| Queue membership, tier, order, fingerprint, view filters | Browser (`derive-flagged.mjs`, zero-import, bundled by esbuild) | Node tests (same file imported by vitest) | Phase 29 D-08: derivation happens in the browser from loaded documents; the same pure module is unit-tested in Node. |
| Reviewed-file persistence and read | Local curate server (`curate-server.mjs`) | Overlay transport module (`curate-overlay/index.ts`) | The server owns the write path and Origin/Host gate; the transport module owns the `fetch` call sites so `curate-queue/index.ts` stays free of `/__curate/` literals. |
| Mutual exclusion (D-11) | Curate server (409 on both write handlers) | Committed-files test; exclusion CLI | Server is the only write gate for the UI; the CLI and CI dispatch bypass the server, so a test (and a CLI check) backs it. |
| Publish guard 1 (build layer) | `scripts/lib/curation-guard.mjs` pure function | `build-widgets.mjs` wrapper (unchanged call site) | Pure function is what makes planted-fixture proof possible (D-11 of Phase 24). |
| Publish guard 2 (HTTP layer) | `scripts/verify-dashboard-publish.mjs` | subprocess planted-fixture test | Existing literal-path `expect404` pattern. |
| Independent recount (D-09) | Standalone zero-import script | Test file that imports both recount and derive | Independence means the script cannot import the derive; the comparison therefore lives in a test and in the browser checkpoint. |
| Queue rendering and the view filter | Browser (`curate-queue/index.ts`) | — | `textContent`-only DOM, zero styling, one `className` assignment (existing source-text tests). |

## Standard Stack

### Core

No new dependencies. Everything is built with what is already in the repo.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-ins (`node:http`, `node:fs`, `node:path`) | Node v24.21.0 (installed) | Server routes, atomic write | Already the entire server stack. [VERIFIED: `node --version`] |
| esbuild | already in devDependencies (`node_modules/.bin/esbuild` present) | Bundles `scripts/curate-queue/index.ts` to `.curate-dist/queue.js` | Existing `buildQueueBundle()`. [VERIFIED: codebase grep] |
| vitest | ^4.0.18 | Test runner; `include: ['src/**/*.test.ts','scripts/**/*.test.mjs']`, `fileParallelism: false` | Existing. [VERIFIED: package.json, vitest.config.ts] |
| TypeScript (`tsc`) | existing | `npm run build` compiles `src/**` to `dist/` (required before `compute-best-efforts`) | Existing. [VERIFIED: package.json] |

### Supporting

None to add.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Activity-level `contaminatedMetres` | Per-effort field on `contaminated` and on the `unreliable-segment` demotion (CONTEXT's example) | Per-effort values cannot be de-duplicated across distances in the browser unless each also carries segment identities (extra payload, more parse surface). The activity-level aggregate does the dedupe once, where the `UnreliableSegment` objects are in scope, and gives the browser one number to parse. Rejected. |
| Server recomputes the fingerprint | Client-supplied fingerprint, server validates shape only | Server recompute would couple a write to gitignored generated files (`data/stats/*`) that may be absent. The client derives the fingerprint from the very rows the developer is looking at, which is what "reviewed this evidence" means. Chosen: client-supplied, server-validated. |
| Guard-1 path check inline in `build-widgets.mjs` | Inside pure `findCurationArtifacts` | Inline `process.exit` is not observable in a unit test. The pure function already has the planted-fixture harness and an ordering test pinning when it runs. Chosen: pure function. |

**Installation:** none.

**Version verification:** not applicable (no packages added). Versions above were read from `package.json` and `node --version` in this session.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase, so the slopcheck gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 nightly CI / local compute                                      developer's browser (127.0.0.1:4173)
 ───────────────────────────                                     ─────────────────────────────────────
 data/streams/<id>.json ──► classifyGapsWithSegments ─► segments[]
                                   │
                                   ▼
                    computeActivityEfforts (per distance)
                      Branch 1 (clean)        -> contaminated: null
                      Branch 2 (clean window) -> contaminated{...}  ─┐ intersecting[] per distance
                      Branch 3 (no clean)     -> demotion unreliable ─┤
                                                                      ▼
                          Map<"startIdx:endIdx", metres>  (dedupe once per activity)
                                   │  round1(sum)
                                   ▼
        data/stats/best-efforts.json  activities[id].contaminatedMetres   (+ shards, additive, no schema bump)
                                   │ copied by build-widgets / curate Recompute
                                   ▼
                      dist/widgets/data/stats/best-efforts.json ─────────► queue page fetches 3 mirrored docs
        data/dashboard/index.json (quality.pauseClassification.transportedCount) ─►          │
        data/best-effort-exclusions.json (public, mirrored) ──────────────────────►          │
                                                                                              ▼
 data/curation/reviewed.json (committed, NEVER mirrored)                           deriveFlaggedActivities(
        ▲   │ GET /__curate/reviewed (Origin-gated)  ───────────────────────────►    be, excl, index, reviewed)
        │   │                                                                       tier / metres / fingerprint /
        │   └─────────────────────────────────────────────────────────────────►     view filter, sort
        │ PUT/DELETE /__curate/reviewed/:id  (Origin gate, id validator,                 │
        │   body cap, reason cap, 409 if id in exclusions, atomic write)                 ▼
        └─────────── overlay transport saveReviewed/removeReviewed ◄──────────  render rows, view tabs, forms
                                                                                 (textContent only, data-* attrs)

 Publish side (must stay clean):
   build-widgets ─► dist/widgets ─► findCurationArtifacts(): content scan (.json exempt)
                                      + NEW path rules: data/curation dir, any file named reviewed.json
   verify-dashboard-publish ─► expect404: /__curate/reviewed, /__curate/reviewed/<id>, /data/curation/reviewed.json
   independent recount: best-efforts.json + index + pace-quality shards + streams ─► tier/metres/order list
                         (no derive/detector import) ──► compared to derive output ONLY inside a test + browser checkpoint
```

### Recommended Project Structure

```
data/curation/reviewed.json            # NEW, committed, seeded {schemaVersion:1,note,reviewed:[]}
scripts/curate-queue/derive-flagged.mjs   # extend (still zero import, zero console)
scripts/curate-queue/derive-flagged.test.mjs
scripts/curate-queue/index.ts          # views, review form, orphans, notes
scripts/curate-overlay/index.ts        # + saveReviewed, removeReviewed, loadReviewedDoc
scripts/curate-server.mjs              # + routes, pure applyReview*, path-injectable createServer
scripts/lib/curation-guard.mjs         # + path rules
scripts/verify-dashboard-publish.mjs   # + 3 expect404 literals
scripts/compute-review-queue-recount.mjs (+ .test.mjs)   # NEW, zero-import
src/analytics/best-effort.types.ts, compute-best-efforts.ts   # + contaminatedMetres
src/dashboard/data/best-efforts-client.ts                     # + fail-closed parse
```

### Pattern 1: D-07 contaminated metres (resolves the D-07 open item)

**What:** One additive, activity-level field `contaminatedMetres: number` on `ActivityBestEfforts`, always present (0 when no effort was moved), rounded with the file's own `round1`. Computed inside `computeActivityEfforts` and returned on `ActivityEffortResult`; Pass 1 copies it onto `activities[id]`.

**Where the data is available:** `segmentsIntersectingWindow(segments, raw)` is already called once per eligible distance, producing `intersecting`. Branch 2 (clean window found) and Branch 3 (no clean window) are exactly the "guard-moved" cases of D-06. Branch 1 has `intersecting.length === 0`. Pass 3 (ceiling) only adds a `demotion` to efforts whose `demotion` is null, and never alters Branch 3's guard, so the set {efforts with `contaminated != null` or `demotion.guard === 'unreliable-segment'}` is identical to the set of Branch 2/3 efforts. [VERIFIED: compute-best-efforts.ts lines ~395-560 and the docblock at best-effort.types.ts "the one impossible pair"]

**Dedupe:** key each segment by `${seg.startIndex}:${seg.endIndex}` (index-space, the detector's own convention; the existing code already refuses float-seconds identity because of the 32-13/32-17 defect class). Insert into a per-activity `Map` in both branches. The sum is over the Map's values.

**Which metres:** `UnreliableSegment.metres` (the whole merged segment), matching D-07's "metres of the unreliable segments that intersect". Not the overlap portion.

**Both branches counted:** a Branch-3-only activity would otherwise be 0 metres and indistinguishable in order. CONTEXT's own example ("on `contaminated` and on the unreliable-segment `demotion`") confirms both kinds carry the figure. [CITED: 37-CONTEXT.md D-07]

**Example (illustrative; adapt to the file's own style):**
```typescript
// Source: src/analytics/compute-best-efforts.ts (computeActivityEfforts), proposed addition
const movedSegmentMetres = new Map<string, number>(); // key: `${startIndex}:${endIndex}`
// ...inside the per-target loop, in Branch 2 and again in Branch 3, after `intersecting` is known:
for (const seg of intersecting) movedSegmentMetres.set(`${seg.startIndex}:${seg.endIndex}`, seg.metres);
// ...after the loop:
let contaminatedMetres = 0;
for (const metres of movedSegmentMetres.values()) contaminatedMetres += metres;
return { efforts, rejected, eligibleTargets, contaminatedMetres: round1(contaminatedMetres) };
```
The seriesError early-return path must also return `contaminatedMetres: 0` (or the field must be optional on the early return) so `ActivityEffortResult` stays total.

**Measured feasibility (reference only, live archive, this session):** I reconstructed the figure two ways for every guard-moved activity. Index-space (detector segments via `classifyGapsWithSegments` + `findBestEffort` window indices, de-duplicated by index pair) versus seconds-space (pace-quality shard `unreliableSegments` intersected with the shipped window offsets using strict `<` so touching is not overlap, de-duplicated by `startSec:endSec`). Result: 0 disagreements beyond 0.05 m, 0 activities with zero metres, and de-duplication changed the answer on a large majority of activities (a no-dedupe implementation is a realistic bug and a realistic mutation for the recount). Branch-3-only activities exist in the hundreds-range, so omitting them would flatten a big slice of tier 2. [VERIFIED: scratch probe, scratchpad/proto.mjs; counts are references, not expected values]

**Browser client (D-07 "fail-closed"):** `parseActivityBestEfforts` builds its return object field by field, so an unparsed field is silently dropped. Add to the returned object: `contaminatedMetres: typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0`. A stale shard or malformed value degrades to 0, which sorts last and can never inflate priority. The type field is required (`contaminatedMetres: number`), so `tsc` finds every fixture that builds an `ActivityBestEfforts` literal. The public dashboard never reads the value; this is parity and the lockstep with the type. [VERIFIED: best-efforts-client.ts parseActivityBestEfforts]

**No schema bump:** `best-effort.types.ts` states that purely additive fields do not bump `BEST_EFFORTS_SCHEMA_VERSION` (Phase 26 D-14 precedent, restated in the `contaminated` docblock). [VERIFIED: best-effort.types.ts]

**Regeneration cost:** `computeBestEfforts({ statsDir: <scratch> })` against the current `dist/` took about 2.6 s for the whole archive and was byte-identical to `data/stats/best-efforts.json` except `generatedAt`. `data/stats/` is gitignored and regenerated by CI, so nothing generated needs committing. After the code change: `npm run build`, then `npm run compute-best-efforts`, then re-mirror (`npm run build-widgets`, or curate's Recompute button, which re-copies `RECOMPUTE_DATA_DIRS`). [VERIFIED: probe timing; .gitignore:11; copy-data-tree.mjs]

### Pattern 2: derive-flagged extension (stays zero-import, zero-console)

New inputs and outputs, keeping existing exports backward-compatible:

- `deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc, reviewedDoc?)` returns the full union as rows. The loop must iterate the union of `Object.keys(activities)` and index rows with `transportedCount > 0`, because a transported activity could lack a best-efforts entry; fall back to the index row's `startDate`. (Today all transported activities have entries; do not rely on it.)
- Per row add: `tier` (1 transported, 2 guard-moved, 3 other demotion), `contaminatedMetres` (finite non-negative else 0; absent key on tier 3 per D-08), `transported`, `contaminatedEfforts` (display lines from `effort.contaminated`), `fingerprint`, `reviewState` (`'none' | 'reviewed' | 'changed'`), `reviewReason`, `reviewedAt`.
- **Keep `flaggedEfforts` and `buildPrefillReason` demotion-only.** D-17: the Exclude prefill is unchanged. A contaminated-only row therefore has an empty exclude prefill (the developer types), which is the pre-existing "empty prefill degrades to developer must type one" behaviour. Show contaminated efforts in a separate list.
- Tier membership: `transported` wins (tier 1) regardless of other flags; else any effort with `contaminated != null` or `demotion.guard === 'unreliable-segment'` (tier 2); else any non-null `demotion` (tier 3). Rows with none of these are not in the set.
- Comparator: `tier` asc; within tiers 1-2 `contaminatedMetres` desc; then `startDate` desc (string compare, as Phase 29 did); then `activityId` asc. Tier 3 skips the metres step.
- Siblings, not return-shape changes: `buildReviewedMap(reviewedDoc)` (mirror `buildExclusionsMap`: skip and count non-object, non-string id, `__proto__`, empty/whitespace reason, bad `reviewedAt`, non-string fingerprint, duplicate id), `countMalformedReviewed(reviewedDoc)`, `fingerprintFor(...)`, `rowsForView(rows, view)`, `deriveOrphans(rows, reviewedMap)`, `summarizeViews(...)`.
- **Stale-document visibility:** if a tier-1/2 row's activity entry has no numeric `contaminatedMetres` at all (best-efforts.json predates this phase), the order silently degrades to newest-first within the tier. Return `metresMissingCount` and have the page print a note ("N rows have no contaminated-metres figure; run Recompute"), analogous to the malformed-entries note. Do not leave this silent.
- **Excluded + reviewed conflict (hand-edited files):** define precedence deterministically: the row is shown under Excluded, never under Reviewed, and the derivation returns `conflictIds` for a visible warning. Do not throw.

**Views (D-15):** To review = `!excluded && reviewState !== 'reviewed'`; Reviewed = `reviewState === 'reviewed' && !excluded`, plus orphans; Excluded = `excluded`; All = every row (not orphans). Counts for each view in the summary line.

**Fingerprint serialisation (D-12, resolves the open item):** the sorted, de-duplicated list of `"<distance>:<guard>"` tokens joined by `,`, then `|t=1` or `|t=0`.
```javascript
// Source: proposed, in derive-flagged.mjs
export function fingerprintFor(efforts, transported) {
  const tokens = new Set();
  for (const e of efforts) {
    if (e === null || typeof e !== 'object') continue;
    if (e.demotion && typeof e.demotion === 'object') tokens.add(`${e.distance}:${e.demotion.guard}`);
    if (e.contaminated && typeof e.contaminated === 'object') tokens.add(`${e.distance}:${e.contaminated.guard}`);
  }
  return `${[...tokens].sort().join(',')}|t=${transported ? 1 : 0}`;
}
```
Canonical (sorted set, no metres, no reasons, no durations), so metre drift and re-derivation never change it. Example value shape: `1k:ceiling,400m:unreliable-segment|t=0`. Server-side validation regex: `/^[A-Za-z0-9:,|=-]{1,1000}$/` (7 distances x at most 5 guard tokens x ~20 chars stays well under the cap). A contaminated effort and a Branch-3 demotion at the same distance both yield `<distance>:unreliable-segment`; this follows D-12 literally and they cannot coexist on one effort.

### Pattern 3: Server write path (resolves D-16 and D-11 open items)

Constants beside the exclusion ones: `REVIEWED_PATH = 'data/curation/reviewed.json'`, `REVIEWED_ROUTE = `${CURATE_PREFIX}/reviewed``, `REVIEWED_ROUTE_PREFIX = `${REVIEWED_ROUTE}/``.

- `GET /__curate/reviewed` in `serveCurateRoute`: **Origin-gated** like the two queue routes (the file holds private judgement text; a DNS-rebinding read must not work), not ungated like `/health`. File missing: respond 200 with the default empty document. File unreadable or invalid JSON: respond 500 with the message; the client treats non-ok as "reviewed file unavailable" and shows every row as unreviewed (the direction that adds attention, never hides a row).
- `PUT|DELETE /__curate/reviewed/:id` dispatched next to the exclusions branch with `urlPath.startsWith(REVIEWED_ROUTE_PREFIX)`.
- Do not copy-paste `handleExclusionWrite`. Extract the shared prefix of that handler (gate, decode id, validate id) into a helper both call; keep body parsing via the existing `readJsonBody`. Both handlers keep their own persist step.
- Pure, exported, testable helpers mirroring `applyUpsert`/`applyRemove`: `applyReviewUpsert(doc, entry)` (replace in place at the same index, else append; return a new doc, never mutate) and `applyReviewRemove(doc, id)` (filter out every match). `reviewedAt` is stamped by the server (`new Date().toISOString()`), never trusted from the client. Entry written is exactly `{ activityId, reason, reviewedAt, fingerprint }`.
- `persistReviewed(doc)` = `mkdirSync(dirname, {recursive:true})` + `writeAtomic(REVIEWED_PATH, ...)` and **nothing else**. It must not call `mirrorExclusions()` and must not touch `dist/`. A test asserts no file appears under a tmp publish dir after a write.
- Reading the file for a write: a missing file reads as the default document; an unparseable one throws and the handler responds 500 (never overwrite a corrupt committed file silently).
- **Mutual exclusion:** `PUT /reviewed/:id` reads `EXCLUSIONS_PATH`; if any entry has that `activityId` respond **409** ("excluded: remove the exclusion first"). `PUT /exclusions/:id` gains the symmetric check against the reviewed file (409 "reviewed: un-review first"). DELETE handlers are never blocked. Consequence for the UI: a resurfaced ("changed since review") row offers "Review again" (an in-place upsert) and Exclude only after un-review. Call this out in the copy.
- **Path injection for tests (critical):** the constants are cwd-relative paths of tracked files. A real-socket PUT/DELETE test against the default constants would write to the committed `data/curation/reviewed.json` and `data/best-effort-exclusions.json`. Make `createServer(options = {})` accept `{ exclusionsPath, publishExclusionsPath, reviewedPath }`, threaded through `serveCurateRoute` and the handlers, defaulting to the constants. Tests point these at an `os.tmpdir()` directory. Existing no-argument callers (`curate-server.test.mjs`, `main()`) keep working. Add a test asserting the default `createServer()` resolves to the constant paths, so injection cannot silently become the default.
- `exclusion-cli.mjs` and the daily-refresh dispatch write exclusions without going through the server, so the 409 does not protect them. Either add a reviewed-file check to the CLI (it already validates the activity exists) or rely on the committed-files test alone; recommend the CLI check (see Open Questions).

### Pattern 4: Guard 1 and Guard 2 (resolves D-03, D-04)

**Guard 1:** `findCurationArtifacts(publishDir)` already walks the whole tree and returns violations; `.json` is exempt from the content scan and must stay so (`UNSCANNED_EXTENSIONS` has an existing test pinning it to exactly `['.json']`). Add two PATH rules inside the walk, each pushing one violation and `continue`-ing so one path yields one violation (IN-17 discipline):
1. A directory whose path relative to `publishDir` is `data/curation` (forbid the **whole tree**, not just the file). Rationale: anything under it is curate-only state; forbidding the tree also catches a future sibling file someone adds to the same directory and copies by mistake.
2. A file named `reviewed.json` at any depth. Rationale: the likely mistake is a `dataFiles`-style single copy to `dist/widgets/data/reviewed.json`, which rule 1 would miss. No published file in `dist/widgets` has this name today.

A rule keyed only on the directory would miss the single-file copy; a rule keyed only on the file name would miss a renamed copy inside the directory. Both together cover both plausible leaks. They run after `buildDashboard()` at the existing OD-2 call site, so `curation-guard.test.mjs`'s source-structure ordering tests stay valid and `build-widgets.mjs` needs no code change (at most a comment next to the `data/private` note; do not write the strings `curate-overlay`, `curate-queue` or `.curate-dist` into that file, which tests forbid even in comments).

**Guard 2:** add three literal `expect404` calls beside the existing five, with the same "never widen to a prefix" comment: `/__curate/reviewed`, `/__curate/reviewed/3475726256`, `/data/curation/reviewed.json`. A static plant of `dist/widgets/data/curation/reviewed.json` returns 200 through the verifier's server, so it goes red. Do not add a `/data/` prefix match.

**Planted-fixture rows:** extend `curation-guard.test.mjs` (tmp tree: planted `data/curation/reviewed.json`, planted other file in `data/curation/`, planted `data/reviewed.json`, a clean control, and a case that a legitimate `data/best-effort-exclusions.json` is still not flagged) and `verify-dashboard-publish-guard.test.mjs` (new cases planting `dist/widgets/__curate/reviewed`, `dist/widgets/__curate/reviewed/3475726256`, `dist/widgets/data/curation/reviewed.json`; clean Case A gains the three new `✓ ... -> 404` lines; extend the `afterEach` and the post-suite check to remove and assert absence of `dist/widgets/data/curation`, removing only that directory, never `dist/widgets/data`). Planted `data/curation` left behind would hard-fail the developer's next `build-widgets` by design, so cleanup must be in a `finally` and `afterEach`.

### Pattern 5: D-09 recount design (resolves the recount open item)

`scripts/compute-review-queue-recount.mjs`, template `compute-unreliable-segment-recount.mjs` / `compute-clean-window-recount.mjs`: only `node:fs`, `node:path`, `node:url` imports; pure exported functions; `main()` behind the self-execution guard so import has no I/O; fails closed (exit 1 with a readable message) if any input is missing; its own header names the forbidden modules and its own `*_LOCAL` constants.

It re-derives, per activity, with no import of the derive function, `compute-best-efforts`, `unreliable-segments`, `pace-derivation` or `pause-classification`:
1. **Membership and tier** from raw `data/stats/best-efforts.json` (`contaminated != null`, `demotion.guard === 'unreliable-segment'`, any `demotion`) and `data/dashboard/index.json` (`quality.pauseClassification.transportedCount > 0`). Cross-check the transported set against the pace-quality shards (`pauseIntervals[].pauseClass === 'transported'`); the two must agree, and a truncated shard that could hide a transported interval is reported as a failure, not skipped.
2. **Metres** from `data/stats/pace-quality/<id>.json` `unreliableSegments[]` intersected with each guard-moved effort's window using shipped offsets (Branch 2: `contaminated.startOffsetSec/endOffsetSec`; Branch 3: the effort's own offsets), strict `<` overlap (touching is not overlap), de-duplicated by `startSec:endSec`, summed, rounded `Math.round(x*10)/10`. A truncated segment list (`unreliableSegmentsTruncated`) is a hard failure for that activity. **Independent metres evidence:** each cited segment's `metres` is re-measured as `d[j] - d[i]` from `data/streams/<id>.json`, locating samples by `t[k] - t[0] === startSec / endSec`. In the live archive these agreed exactly for every segment of every guard-moved activity, so the recount's metres claim does not rest on the detector's own arithmetic. (Segment boundaries come from the shard, so the bound of this claim is stated in the header, like the clean-window recount: it does not arbitrate where the detector draws the line, which is Phase 32's calibration question.)
3. **Order**: the same comparator spelled independently, emitted as an ordered list of `{activityId, tier, metres}`.
4. **Shipped-field check:** compare each guard-moved activity's shipped `contaminatedMetres` with the recount's own value; any mismatch or any missing field is a failure.

The script itself never reads the derive output (that would be an import or a shared artifact). The comparison to the derive lives in two places: a vitest test that imports both modules and compares full ordered lists, and the browser checkpoint, which reads `[data-queue-row]` ids from the served page and compares them to the recount CLI's printed ordered list.

**Reachability in both directions (D-19):** the recount's test file must run it against deliberately broken derive outputs built by mutating a real derive result: (a) swap two rows' tiers, (b) replace metres with a no-dedupe per-effort sum (the realistic bug), (c) reverse a within-tier order, (d) drop a transported row, and assert each yields a non-empty mismatch list; assert the unmutated derive output yields an empty one; and assert each planted input differs from the clean input (the `test-partition.test.mjs` idiom). Also plant a document whose shipped `contaminatedMetres` is altered and assert the shipped-field check fails. Add the zero-import source scan with comment stripping and a planted violation, copying `compute-clean-window-recount.test.mjs` lines ~434-500, and an import-time no-I/O guard using the repo's `vi.mock('fs', ...)` wrapper with its positive controls (see Pitfall 5).

### Pattern 6: Queue UI (curate-queue/index.ts)

Constraints from the existing source-text tests: one `className =` assignment in the file, no `innerHTML`/style/CSS, no `paceQuality`/`qualityTier`/`severe`, no `'ceiling'`/`'world-record'`/`'max-speed'` literals, no `/__curate/exclusions`, no `location.reload(`, exactly three `fetch('/strava-widgets/data/` occurrences. So:
- View switcher: four `<button>`s with `data-queue-view`, `aria-pressed`; no class. Persist the active view in `location.hash` (for example `#view=reviewed`) so the transport's `location.reload()` after a write returns to the same view; default To review.
- The reviewed document is fetched through an exported `loadReviewedDoc()` in `curate-overlay/index.ts` (never-throw, null on non-ok), so the queue file contains no `/__curate/` literals; extend the source-text test to forbid `/__curate/reviewed` in the queue file.
- Review control per row: reason textarea, blank, required (`.trim()` check client-side, server re-checks), one button. For a resurfaced row show "changed since review" plus the old reason and date. In the Reviewed view show reason, date, and Un-review (with `confirm()`, mirroring Remove exclusion, since the reason is lost). Excluded rows show no review control and vice versa (D-11).
- Orphans in the Reviewed view: "no longer flagged" with the stored reason/date and Un-review; the summary line shows their count.
- Notes (rendered only when non-zero, like the malformed-exclusion note): malformed reviewed entries ignored, rows without a metres figure, excluded+reviewed conflicts, reviewed file unavailable.
- The existing line "Review queue" summary `N flagged · M already excluded` becomes a per-view count line.

### Anti-Patterns to Avoid

- **Parsing metres out of the reason string.** Bounded with "+N more"; impossible in general (CONTEXT finding 1).
- **Summing metres per effort.** Counts a shared segment once per distance; the recount mutation (b) exists to catch exactly this.
- **Counting only `contaminated` windows.** Misses the no-clean-window population (Branch 3), which is a large share of guard-moved activities.
- **Having the recount import the derive or the detector.** Agrees with itself by construction.
- **A real-socket write test against the default constants.** Writes to tracked files.
- **A prefix assertion against `/data/`** in guard 2 (the existing comment forbids it; the public exclusions file lives there).
- **Mirroring the reviewed file** on write the way `persistExclusions` mirrors exclusions.
- **Bumping `BEST_EFFORTS_SCHEMA_VERSION`.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | A new temp/rename routine | `writeAtomic` in `curate-server.mjs` | Existing, tested; sibling temp + `renameSync`. Only add `mkdirSync` of the parent. |
| Id validation / reason normalisation / body cap | New regex, new limits | `isValidCurateActivityId`, `normalizeReason`, `readJsonBody`, `MAX_BODY_BYTES`, `MAX_REASON_CHARS` | D-16 says same machinery; a second validator is a second surface. |
| Origin/Host gate | A new check | `isTrustedOrigin(req, EXPECTED_HOST)` | DNS-rebinding defence already shared by every curate write. |
| Malformed-entry counting | A different skip policy | Mirror `buildExclusionsMap`/`countMalformedExclusions` | D-05; same classes (non-object, non-string id, `__proto__`, empty reason, duplicate). |
| Segment window overlap | A float-seconds comparison in compute | `segmentsIntersectingWindow` (index space) | Touching-is-not-overlap is already decided there. |
| Rounding | A second rounding rule | `round1` in `compute-best-efforts.ts` | The file already rounds every figure this way. |
| Planted-fixture harness | A new one | `curation-guard.test.mjs` tmp-tree helpers; `verify-dashboard-publish-guard.test.mjs` subprocess pattern | Both already prove red/green. |
| Import-time side-effect probe | `vi.spyOn(fs, 'readFileSync')` | The `vi.mock('fs', ...)` wrapper in `unreliable-segment-import-guards.test.mjs` with its two positive-control probe modules | The spy approach was proven vacuous on this repo. |

**Key insight:** every piece of this phase has a precedent in the repo; the risk is not missing machinery but silently weakening a guard or letting two derivations share an assumption.

## Runtime State Inventory

Not a rename/refactor/migration phase. One note for the new additive field:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/stats/best-efforts.json` and its 1,929 per-activity shards are generated and gitignored; they lack `contaminatedMetres` until recomputed | Regenerate after the code change (about 2.6 s). CI regenerates nightly. No committed data migration. |
| Live service config | None — verified: no external service stores queue state | None |
| OS-registered state | None — verified: no scheduled task or process names involved | None |
| Secrets/env vars | None | None |
| Build artifacts | `dist/` (tsc output) must be rebuilt before `compute-best-efforts` sees the change; `.curate-dist/queue.js` is rebuilt at `npm run curate` start; `dist/widgets/data/stats/*` mirror must be refreshed | `npm run build`, `npm run compute-best-efforts`, then `npm run build-widgets` (or Recompute); verify the served digest |

## Common Pitfalls

### Pitfall 1: The Phase 29 tests encode the old behaviour (declare them in `files_modified`)
**What goes wrong:** executors change `derive-flagged.mjs`, suites go red in files the plan never listed, and an intra-wave overlap check trusting declared files fails to see the collision.
**Specific tests that must change (all read this session):**
- `scripts/curate-queue/derive-flagged.test.mjs`: the D-05 ordering block (~lines 216-251, "not-yet-excluded first, then newest-first" and the equal-`startDate` case) asserts the retired comparator; the `summarizeQueue` block (~509-521) asserts the old two-field shape; the live-archive cross-check (~530-543) asserts `rows.length === recount.flaggedActivityCount` against `recountDemotedActivities` (demotion-only), which is now false because the queue is a superset. Re-scope that check to the demotion-bearing subset (`rows.filter(r => r.flaggedEfforts.length > 0)`), which preserves the Phase 29 D-01 guarantee, and move full-set count and order to the new recount.
- `scripts/curate-queue.test.mjs`: "D-04 — demotions only" is amended by D-06 (reword; it only scans `index.ts`); "no second write call site" should additionally forbid `/__curate/reviewed`; "D-08 reads only the mirrored public JSON" keeps its count of 3 (the reviewed read goes through the transport, not a `/strava-widgets/data/` fetch) but its description must say reviewed is the one input that is not mirrored.
- `scripts/verify-dashboard-publish-guard.test.mjs`: Case A's title and body say "five"; extend, do not weaken.
- `scripts/curate-overlay.test.mjs`: exactly two `addEventListener(` in `curate-overlay/index.ts`; new transport functions must add none. The `saveExclusion` body test must still hold.
- `src/dashboard/data/best-efforts-client.test.ts` (`toEqual(validShard)` at ~line 63) and the `ActivityBestEfforts` literal helpers in `detail-best-efforts-logic.test.ts`, `records-logic.test.ts`, `compute-age-grading.test.ts` (and any literal `tsc` flags, since `tsconfig` includes `src/**`).
- `src/analytics/compute-best-efforts.test.ts`: any `toEqual` on a whole `ActivityEffortResult`; and the 36-05 "stubbed segments identical to today's output" proof, which compares outputs and now carries one more field.

### Pitfall 2: Stale `best-efforts.json` makes the order silently wrong
Without regeneration every `contaminatedMetres` is absent, tiers 1-2 degrade to newest-first, and the recount's shipped-field check is the only thing that notices. Surface `metresMissingCount` on the page and fail the recount closed on a missing field. The browser checkpoint must regenerate first.

### Pitfall 3: Recount shares a blind spot with compute
If the recount sourced segments by re-running the detector, "metres equal" would hold even if the detector were wrong. Using shard segment boundaries plus stream-measured metres, and a strict-overlap rule written independently, keeps it a real second opinion; state the bound of the claim in the header.

### Pitfall 4: Server tests writing tracked files
`EXCLUSIONS_PATH`/`REVIEWED_PATH` are cwd-relative to tracked files. Use the injectable `createServer` options and `mkdtemp`; add a before/after SHA check of the two real files over the suite (reading only). No test may `git checkout` or write them.

### Pitfall 5: Vacuous no-side-effect guard
A `vi.spyOn(fs, ...)` cannot see `import { readFileSync } from 'fs'`. Use the file-scoped `vi.mock('fs', factory)` wrapper with its positive controls (`import-time-read-probe-named.mjs` / `-default.mjs`), in its own test file because `vi.mock` is file-wide.

### Pitfall 6: `-t` filters that match 0 tests exit 0
Prefer file-path selection. Where a `-t` is unavoidable, record the matched-test count on that row and assert it is non-zero.

### Pitfall 7: Browser cache and stale builds at the checkpoint
Stale `index.html`/`index.json`/`best-efforts.json` survive a rebuild; `127.0.0.1` alone is not enough. After every fixture edit, hard-reload and compare digests: `shasum data/stats/best-efforts.json dist/widgets/data/stats/best-efforts.json` against `curl -s http://127.0.0.1:4173/strava-widgets/data/stats/best-efforts.json | shasum`. `copy-data-tree.mjs` now decides skips by size plus SHA-1, not mtime, but verify served bytes anyway. [VERIFIED: copy-data-tree.mjs docblock]

### Pitfall 8: Planted dist artifacts left behind
A leftover `dist/widgets/data/curation/...` is intended to fail the next `build-widgets`; the guard tests must clean in `finally` and `afterEach`, and a post-suite test must assert absence. `vitest.config.ts` sets `fileParallelism: false` precisely because these tests plant into the real `dist/widgets` while another file reads it; do not change that.

### Pitfall 9: Worktree executors
Bare worktrees lack `node_modules` and `data/`; fixture-reading and live-archive tests fail there for non-regression reasons. Checkpoint and guard-subprocess plans (they need a built `dist/widgets` and `data/stats`) run on the primary checkout. The recount and live cross-check tests are `skipIf`-style where data is absent, matching the existing pattern.

### Pitfall 10: Stale gate directions
The mutual-exclusion 409 can block the only available action on a resurfaced row. Offer "Review again" on resurfaced rows and put "un-review first" in the Exclude path's message.

### Pitfall 11: A discriminator that cannot pass or cannot fail
The recount comparison must be shown to fail on a mutated derive and to pass on the real one; the guard-1 path rule must be shown to flag a planted copy and to return `[]` on the real built tree (the existing whole-tree regression test covers the latter and must still pass).

## Code Examples

### Tier and comparator (derive side, zero-import)
```javascript
// Source: proposed, scripts/curate-queue/derive-flagged.mjs
function compareRows(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.tier < 3 && a.contaminatedMetres !== b.contaminatedMetres) {
    return b.contaminatedMetres - a.contaminatedMetres;
  }
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
  return a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0;
}
```

### Guard 1 path rules (pure function addition)
```javascript
// Source: proposed, scripts/lib/curation-guard.mjs, inside walk(), before the content scan
// directory branch:
if (relative(publishDir, entryPath).split(sep).join('/') === 'data/curation') {
  violations.push({ path: entryPath, reason: 'data/curation is curate-only state and must never exist under the published bundle' });
}
// file branch (before the isFile gate / .json exemption):
if (entry.name === 'reviewed.json') {
  violations.push({ path: entryPath, reason: 'a file named "reviewed.json" (curate-only review state) must never exist under the published bundle' });
  continue;
}
```
(The directory rule must not `continue` past descending, matching how the `__curate` directory rule still walks, but a file inside `data/curation` named `reviewed.json` must still be reported once: avoid double reporting by letting the file rule own that path and the directory rule own only the directory.)

### Server handler skeleton (reviewed write)
```javascript
// Source: proposed, mirrors handleExclusionWrite in scripts/curate-server.mjs
// PUT: body { reason, fingerprint }
const reason = normalizeReason(body?.reason);
const fingerprint = normalizeFingerprint(body?.fingerprint); // string, /^[A-Za-z0-9:,|=-]{1,1000}$/ else null
if (reason === null || fingerprint === null) -> 400
if (excludedIds(readExclusions(paths.exclusions)).has(activityId)) -> 409
persistReviewed(paths, applyReviewUpsert(readReviewed(paths.reviewed),
  { activityId, reason, reviewedAt: new Date().toISOString(), fingerprint }));
```

### Recount sketch (independent metres)
```javascript
// Source: proposed, scripts/compute-review-queue-recount.mjs (no imports beyond node:fs/path/url)
function movedMetres(effortsMoved, segments) {
  const seen = new Map();
  for (const w of effortsMoved) {
    for (const s of segments) {
      if (s.startSec < w.endSec && w.startSec < s.endSec) seen.set(`${s.startSec}:${s.endSec}`, s);
    }
  }
  let sum = 0;
  for (const s of seen.values()) sum += s.metres;
  return Math.round(sum * 10) / 10;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Queue = any non-null `demotion`, excluded-first ordering | Union of demotion, guard-moved, transported; tier + metres ordering; four views | This phase (amends Phase 29 D-01/D-04/D-05) | New derive tests; live cross-check re-scoped |
| Queue reads only mirrored public JSON | Plus one non-mirrored, origin-gated GET for the reviewed file | This phase (amends Phase 29 D-08) | Reviewed content never touches `dist/` |
| Guard 1 content-scan only | Content scan + path rules | This phase | `.json` exemption retained |

**Deprecated/outdated:** the Phase 29 statement that the queue is "not drainable" is superseded for the default view only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `reviewedAt` is a full `toISOString()` timestamp (D-05 says "ISO date"; a timestamp satisfies it and sorts) | Pattern 3 | Cosmetic; a date-only string would also work |
| A2 | Field name `contaminatedMetres`, activity-level, always present (0 when none), required on the type | Pattern 1 | Name and placement are Claude's discretion; planner may prefer optional to reduce fixture churn, at the cost of weaker typing |
| A3 | 409 Conflict is the right status for the mutual-exclusion rejection | Pattern 3 | UI maps any non-ok; low |
| A4 | Persisting the active view in `location.hash` is acceptable UI | Pattern 6 | Pure UX; fall back to default view after reload if rejected |
| A5 | Both Branch 2 and Branch 3 windows count toward metres (CONTEXT's "on `contaminated` and on the demotion" implies it) | Pattern 1 | If only Branch 2 was meant, Branch-3-only activities sort as 0 metres within tier 2; confirm with the user if the planner doubts it |
| A6 | A resurfaced row offers "Review again" and routes Exclude through un-review first | Pitfall 10 | Slightly more clicks than an atomic swap; the alternative (one handler writing two files) was rejected by D-16 |
| A7 | Add a reviewed-file check to `exclusion-cli.mjs` so D-11 holds outside the UI | Open Questions | If skipped, D-11 is enforced only by the committed-files test |
| A8 | `startDate` string comparison (as Phase 29 did) is the newest-first rule in both derive and recount | Pattern 2 | A mixed Z/no-Z format would only matter at exact prefix ties; both sides use the same rule |

## Open Questions

1. **Should `exclusion-cli.mjs` reject an id that is in `reviewed.json`?**
   - What we know: the server's 409 protects only the UI path; the CLI and the CI dispatch import `applyUpsert` directly.
   - What's unclear: whether touching the CLI is in scope.
   - Recommendation: yes, add the check (a few lines plus a test); declare `scripts/exclusion-cli.mjs` and its test in `files_modified`. Otherwise D-11 relies on the committed-files test alone.

2. **How should the recount behave when `data/stats/pace-quality/` is absent?**
   - What we know: those shards are gitignored and generated by the compute chain; CI has them.
   - What's unclear: nothing technical.
   - Recommendation: fail closed with a readable message from the CLI; tests that need real data use `describe.skipIf` on the data path, like the existing live cross-checks.

3. **Seed the reviewed file in this phase?**
   - Recommendation: commit `data/curation/reviewed.json` as `{ "schemaVersion": 1, "note": "...", "reviewed": [] }` so the committed-files test (no id in both files) and the guard tests have a real tracked file; the server also tolerates a missing file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.21.0 | — |
| esbuild | queue bundle | ✓ | in node_modules/.bin | — |
| vitest | tests | ✓ | ^4.0.18 | — |
| `dist/` (tsc output) | `compute-best-efforts`, Recompute | ✓ (built today) | — | `npm run build` |
| `dist/widgets` built tree | guard-2 subprocess tests, browser checkpoint | ✓ | — | `npm run build-widgets` (primary checkout only) |
| `data/stats/best-efforts.json`, `pace-quality/`, `data/dashboard/index.json`, `data/streams/` | derive live check, recount | ✓ on the primary checkout (streams are tracked; `data/stats` is gitignored) | — | tests `skipIf` the data is absent |
| A human with a browser | Phase checkpoint (gestures, hard reload) | needs the developer | — | cannot be automated; checkpoint plan runs on the primary checkout |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** worktrees (no `node_modules`/`data/`): symlink `node_modules`, copy `data/` read-only, and expect data-dependent tests to skip; checkpoint plans do not run there.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts','scripts/**/*.test.mjs']`, `fileParallelism: false`); `vitest.logic.config.ts` excludes `*.archive.test.*`; `vitest.archive.config.ts` only archive files |
| Quick run command | `npx vitest run scripts/curate-queue scripts/curate-queue.test.mjs scripts/curate-server.test.mjs scripts/curate-overlay.test.mjs scripts/lib/curation-guard.test.mjs` |
| Full suite command | `npm run test:logic` (blocking in CI), then `npm run build` (tsc catches fixture literals missing the new required field) |

Baseline measured today: the seven curate-related files ran 184 tests green in about 2 s. [VERIFIED: vitest run in this session]

**Test-partition rule (Phase 36.1):** a new test file is classified automatically by `scripts/test-partition.test.mjs`. Data-dependent cross-checks that compare two implementations (not pinned values) stay in the logic suite behind `describe.skipIf(!existsSync(...))`, matching the existing live cross-check; only value-pinned archive tests use the `.archive.test.*` suffix. Do not add a `.archive.` file unless a value is pinned.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUR-06 | `contaminatedMetres` is de-duplicated per activity, covers Branch 2 and 3, 0 when none; early-return paths total | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts` | ✅ extend |
| CUR-06 | Browser client parses the field fail-closed (NaN, negative, string, absent -> 0) | unit | `npx vitest run src/dashboard/data/best-efforts-client.test.ts` | ✅ extend |
| CUR-06 | Membership union, tier assignment, comparator, tie-breaks, transported-with-no-entry, metres-missing count | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ✅ rewrite D-05 block |
| CUR-06 | Derive agrees with the independent recount on count AND order (live data) | integration (`skipIf` no data) | `npx vitest run scripts/compute-review-queue-recount.test.mjs` | ❌ Wave 0 |
| CUR-06 | Recount fails on a mutated derive (tier swap, no-dedupe metres, reversed order, dropped row, altered shipped field) and passes on the real one | unit | same file | ❌ Wave 0 |
| CUR-06 | Recount source has no forbidden import (stripper proven on a planted violation); no import-time I/O (positive controls) | unit | same file, plus the `vi.mock('fs')` guard file | ❌ Wave 0 |
| CUR-04 | `applyReviewUpsert`/`applyReviewRemove` (in-place replace, no mutation, remove-all, exact entry shape) | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend |
| CUR-04 | PUT/DELETE/GET over a real socket against tmp paths: 400 on bad id/empty reason/bad fingerprint, 403 cross-origin, 409 on exclusion conflict (both directions), 413, no file under tmp publish dir | integration | same file (injectable `createServer`) | ✅ extend |
| CUR-04 | Real tracked files unchanged by the suite (SHA before/after) | unit | same file | ✅ extend |
| CUR-04 | Committed `reviewed.json` and `best-effort-exclusions.json` share no activityId | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend |
| CUR-04 | Fingerprint is order-independent and ignores metres/reason/duration; changes when a (distance,guard) or transported flag changes; view membership incl. `changed`, orphans, conflicts | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ✅ extend |
| CUR-04 | Queue client source: reviewed transport imported, no `/__curate/reviewed` literal, one `className`, no forbidden tokens | source-text | `npx vitest run scripts/curate-queue.test.mjs scripts/curate-overlay.test.mjs` | ✅ extend |
| CUR-04 | Guard 1 flags planted `data/curation/reviewed.json`, planted sibling in `data/curation/`, planted `data/reviewed.json`; clean control `[]`; public exclusions not flagged; whole-tree real regression `[]`; `UNSCANNED_EXTENSIONS` still `['.json']` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend |
| CUR-04 | Guard 2: clean run prints the three new `✓ ... -> 404` lines; each planted leak exits non-zero naming the path; cleanup asserted | subprocess | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend |
| CUR-04 | derive-flagged.mjs has zero `import` and zero `console` (comment-stripped scan, planted-violation proof) | source-text | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ add (no such test exists today) |
| CUR-04/06 | Browser behaviour: views, resurface, reversibility, count/order vs recount | manual checkpoint (gestures need a human) | see below | ❌ checkpoint plan |

**Manual checkpoint rows (primary checkout only), each asserting against an independently derived value:** run `npm run build`, `npm run compute-best-efforts`, `npm run build-widgets`, `npm run curate`; confirm the served `best-efforts.json` digest equals the working-tree one; hard-reload; read the DOM row ids and compare to `node scripts/compute-review-queue-recount.mjs`'s printed ordered list (set and order); mark one row reviewed (reload, row leaves To review, appears under Reviewed, `git diff data/curation/reviewed.json` shows exactly the entry, `best-effort-exclusions.json` untouched); un-review (entry gone); edit the committed fixture to change a fingerprint and confirm "changed since review" resurfacing; confirm a reviewed id cannot be excluded and vice versa (409 message); plant `dist/widgets/data/curation/reviewed.json`, show `build-widgets`' guard (or a direct `findCurationArtifacts('dist/widgets')` call) red and `npm run verify-dashboard` red, remove it, show both green. Gestures and viewport behaviour are limited (viewport clamps 500..941); patch the canvas context only if canvas evidence is needed, not expected here.

**Standing evidence rules for every VALIDATION row:**
- Expected values come from the recount or a hand-built fixture with a stated derivation, never from CONTEXT's probe figures (371 / 365 / 194 / 451 / 5 / 565). Print live numbers only to reconcile and explain differences.
- Each discriminator is exercised failing and passing (reachability both ways); a row that cannot fail (vacuous) or cannot pass (unsatisfiable) is a defect in the row, not the code. Check the fixture contradicts nothing in the requirement before redrafting a row.
- Any `-t` selection records its expected matched count and the test asserts it is non-zero; prefer a file path.
- No test writes to or git-checks-out a tracked file (`data/curation/reviewed.json`, `data/best-effort-exclusions.json`, anything under `.planning/`); writes go to `os.tmpdir()`.
- No guard built on `vi.spyOn(fs, 'readFileSync')`; use the `vi.mock('fs')` wrapper with positive controls.

### Sampling Rate
- **Per task commit:** the quick run command above (about 2-3 s).
- **Per wave merge:** `npm run test:logic` plus `npm run build`.
- **Phase gate:** full `npm run test:logic` green, `npm run verify-dashboard` against a fresh `npm run build-widgets` on the primary checkout, and the browser checkpoint recorded, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/compute-review-queue-recount.mjs` and `.test.mjs` — covers CUR-06 count/order and the mutation set; `package.json` script `compute-review-queue-recount`
- [ ] A `vi.mock('fs')` import-time guard for the new script (own file, copying `unreliable-segment-import-guards.test.mjs`'s mechanism and positive controls)
- [ ] `data/curation/reviewed.json` seed (committed)
- [ ] A zero-import/zero-console scan test for `derive-flagged.mjs`
- [ ] Injectable-paths refactor of `createServer` before any write-route test is written
- [ ] Framework install: none needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (localhost developer tool, no accounts) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Bind `127.0.0.1`; `isTrustedOrigin` Host/Origin gate on the new GET and PUT/DELETE; the GET is gated (unlike `/health`) because it returns private review text |
| V5 Input Validation | yes | `isValidCurateActivityId`, `normalizeReason` (trim, 1..2000), `MAX_BODY_BYTES`, fingerprint regex and length cap; server stamps `reviewedAt`; `__proto__` ids rejected and skipped on read; write target is a constant, never derived from the id |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DNS rebinding / drive-by cross-tab write or read | Tampering, Information disclosure | Host/Origin gate on every curate route including the new GET |
| Review text leaked into the published bundle | Information disclosure | Never mirrored; guard 1 path rules; guard 2 literal 404s; `.gitignore`-independent because the file is committed |
| Stored XSS via reason or fingerprint | Tampering | `textContent`-only rendering, CSP on the queue page, no `innerHTML` (existing source-text tests) |
| Prototype pollution via `__proto__` ids in the reviewed file | Tampering | `Map` keyed storage, explicit `__proto__` skip counted as malformed |
| Oversized body / reason | Denial of service | Existing `MAX_BODY_BYTES` and `MAX_REASON_CHARS` |
| Overwriting a corrupt committed file | Tampering | Write handler returns 500 on unparseable existing file instead of replacing it |
| Leaving state half-written | Tampering | `writeAtomic` sibling temp + rename |

## Project Constraints (from CLAUDE.md)

No project-level `./CLAUDE.md` exists in the repo. The user's global `~/.claude/CLAUDE.md` requires GSD commands to be written in the hyphen form (`/gsd-plan-phase`, `/gsd-verify-work`, never the legacy colon form); this document and any plan derived from it should follow that. No `.claude/skills/` or `.agents/skills/` directory was found. Project conventions inferred from the codebase and the user's memory index, which the plans must respect: `.mjs` with JSDoc for anything bundled into the browser; zero imports and zero console in `derive-flagged.mjs`; every guard watched red on a planted fixture before it is trusted; checkpoint plans run on the primary checkout; `data/` and `node_modules` must be provided to worktree executors.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/37-review-queue-priority-cur-04/37-CONTEXT.md` — locked decisions D-01..D-20
- `scripts/curate-server.mjs` (routes, `applyUpsert`/`applyRemove`, `writeAtomic`, `handleExclusionWrite`, `serveCurateRoute`, `createServer`)
- `scripts/curate-queue/derive-flagged.mjs`, `index.ts`, `format.mjs` and their tests
- `scripts/curate-overlay/index.ts` (transport, `describeFailure`) and `scripts/curate-overlay.test.mjs`, `scripts/curate-queue.test.mjs`
- `scripts/lib/curation-guard.mjs` and `curation-guard.test.mjs`; `scripts/build-widgets.mjs` (`dataDirs`, `dataFiles`, `assertNoPrivateArtifacts`, `assertNoCurationArtifacts`, call order); `scripts/lib/copy-data-tree.mjs`
- `scripts/verify-dashboard-publish.mjs` (`expect404`, list at ~474-478) and `verify-dashboard-publish-guard.test.mjs`
- `src/analytics/compute-best-efforts.ts` (`computeActivityEfforts` Branches 1-3, `segmentsIntersectingWindow`, Pass 1 construction at ~`activities[id] =`), `src/analytics/best-effort.types.ts`, `src/dashboard/data/best-efforts-client.ts`
- `scripts/compute-unreliable-segment-recount.mjs`, `scripts/compute-clean-window-recount.mjs` and tests; `scripts/unreliable-segment-import-guards.test.mjs`
- `.github/workflows/daily-refresh.yml` push-paths filter (`data/curation/**` is not listed, so committing the reviewed file does not trigger a deploy)
- Live probes this session (scratchpad scripts): regeneration timing and byte-identity, index-space vs seconds-space metres agreement, stream-measured segment metres agreement, transported-set agreement between index and shards, tier reconciliation (references only)

### Secondary (MEDIUM confidence)
- None used.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from the repo.
- Architecture: HIGH — each seam read directly; the metres design was validated against the live archive.
- Pitfalls: HIGH — drawn from tests actually read (and from the user's own failure history); the list of tests to update is complete for what was read but `tsc` and a full test run remain the final detector for fixture literals.

**Research date:** 2026-11-25
**Valid until:** 2026-12-25 (stable internal codebase; re-verify only if Phase 36.1 or 36.x changes touch `compute-best-efforts.ts`, `curation-guard.mjs` or the curate server before planning)
