# Phase 27: Per-Activity Quality Signals - Research

**Researched:** 2026-09-10
**Domain:** Internal codebase archaeology + archive-wide measurement (no external library, no web research) — locating the exact compute/render integration points for five new per-activity signals in a mature TypeScript static-SPA-plus-CI-pipeline codebase, and deriving thresholds for the two signals CONTEXT.md left to research.
**Confidence:** HIGH — every code claim below was confirmed by direct `grep`/`Read` against the live source tree in this session; every numeric claim was confirmed by a read-only measurement script run against the full committed `data/streams/` (1,865 files) and `data/activities/` (1,890 files) archives, never by search or training-data recall. Nothing in the repo was modified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Severity model and calibration (QUAL-05, Criterion 4)**
- **D-01:** Per-signal tiers; the composite "any severe" (activities carrying **at least one** severe signal) is the calibrated number Criterion 4 measures — not a per-signal budget, not one rolled-up activity tier.
- **D-02 (do not quietly reverse):** Thresholds are derived from mechanism first; the measured composite rate is a reported finding, never solved for. A rate materially above ~5% is a calibration failure to surface, not license to retune.
- **D-03:** The independent recount reads `data/dashboard/index.json` off disk only and must **not** import the classifier — bounded claim: "what shipped matches what was reported."
- **D-04:** Phase 26's cohort rule (**>15% zero-advance samples AND ≥50 samples**) is reused **verbatim** as the severe-decimation threshold — the 154 already-identified activities are exactly the severe-decimation set. The 26-RESIDUAL.md 14-activity residual is a boundary cross-check only (`npm run compute-pace-residual`), never a sixth signal, never decimation's top tier.
- **D-05 (consequence of D-12/D-13):** Only **three** signals tier — decimation, impossible-sample count, gap profile. Device era and elapsed-vs-moving divergence are untiered facts and contribute nothing to the composite rate.
- **D-06 (denominator, measured 2026-09-10 by CONTEXT.md, re-confirmed by this research):** Live archive is 1,890 activities / 1,866 streams (this session found 1,865 stream files walkable — see Assumptions Log A1 for the ±1 reconciliation); 24 activities have no stream at all and the three stream-derived tiering signals cannot be computed for them — they must report an explicit not-computable state, never a fabricated zero, following the existing `streams.available: false` + `reason` precedent.

**Disclosure surfaces and badge text (QUAL-02/03/04, Criterion 3)**
- **D-07:** Severe-tier only on activity-list rows, one named badge per fired signal (minor tier still ships in the index/detail but never list-badges).
- **D-08:** The detail view discloses **all five** signals, always, tier-styled — including healthy ones.
- **D-09:** Visible badge text carries condition + measured value (e.g. `12% of elapsed time in recording gaps`); the accessible `explanation` slot carries why it matters. Reuses `appendAccessibleBadge(container, visibleText, explanation, descriptionId)` from `list.ts` **unchanged**.
- **D-10:** All three `renderActivityRow` surfaces badge (Activities, Overview Recent Activities, Overview Recent PRs), no per-surface branching. **This research found a fourth reachable surface — see Code Context and Common Pitfalls.**

**Device era taxonomy (ERA-01/02, Criterion 5)**
- **D-11:** Family-level granularity matching `pace-fixtures.ts`'s pinned set (`garmin-fenix-6-pro`, `suunto-9`, `strava-app-gpx`, `intervals-icu`, `no-device-name`, plus whatever else the archive requires).
- **D-12:** An unrecognized `device_name` is a **third** explicit category (`unrecognized-device`) keeping the raw string verbatim — never folded into `no-device-name`, never a fabricated family. Note for the planner: `device_name` is untrusted free text on a public artifact — render with `textContent`, never `innerHTML`.
- **D-13:** Device era carries no severity tier — a labelled fact only, always disclosed, never badged on a list row.
- **D-14:** Elapsed-vs-moving divergence carries no severity tier either — a disclosed ratio only.

**Sort, filter, and the shard (QUAL-03, Criterion 2)**
- **D-15:** One filter, no new sort key.
- **D-16:** The filter is one toggle: "has any severe signal" (the same composite Criterion 4 measures).
- **D-17:** The shard (`data/stats/pace-quality/{id}.json`) carries the evidence behind each scalar: classified gap intervals, impossible-sample indices with implied speeds, zero-advance run profile, resolved adaptive window width, resolved device family + raw `device_name`.
- **D-18:** "Zero fetches on list, exactly one on open" is proven by BOTH a human network-panel checkpoint against a verified-served-digest build AND an instrumented fetch-counter vitest test — neither alone. Checkpoint hazards: `127.0.0.1` alone insufficient (stale staged `index.html`/`index.json`, hard-reload after every fixture edit); `build-widgets` can silently no-op on a locally-edited `dist` file — verify the **served digest**, not the build log; viewport clamps to 500..941.

### Claude's Discretion
- **Thresholds for impossible-sample count and gap profile** — decimation's threshold is fixed by D-04; these two are NOT. **This research proposes candidate thresholds below (Summary + Common Pitfalls) with full archive-wide measurement — a genuine, load-bearing finding is that a naive per-sample impossible-speed detector heavily aliases with decimation (90% of the 154 severe-decimation activities also trip a naive "≥1 impossible sample" check) and this must be designed around, not measured past.**
- **Where the compute step lives** — architecture call for the planner, bound by purity (D-15-of-Phase-26).
- **How "moving a threshold and observing the rate move" is wired** (Criterion 4).
- **Tier styling** against Phase 19's design system; where the detail view's quality section sits.

### Deferred Ideas (OUT OF SCOPE)
- Sorting the activity list by quality tier — filter only, per D-15.
- Per-signal filter checkboxes and a device-family filter select — deferred to Phase 29.
- A sixth "unfixed residual" signal — the roadmap names five; the residual stays a boundary cross-check.
- Garmin export adapter (STREAM-04) and IN-17/IN-18 curation-guard cosmetics — both externally/phase-blocked, unrelated to this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | Five named signals, CI-computed, never browser-derived | `compute-dashboard-index.ts` already reads `data/activities/{id}.json` (has `device_name`, `elapsed_time`, `moving_time`) and conditionally `data/streams/{id}.json` — confirmed the exact file this phase extends, or the sibling script it composes with. See Architecture Patterns. |
| QUAL-02 | Disclosed individually; device era and decimation stay separate despite correlating | D-05/D-13 already resolve the *design* question; this research adds the *quantified* correlation risk for impossible-sample-count vs decimation (90% overlap at a naive threshold) that the planner must design around for THAT pair too. |
| QUAL-03 | Compact scalars additive on index row; detail in a lazy shard mirroring `best-efforts/{id}.json` | `best-efforts-client.ts` read in full — exact fetch-once/memoize/degrade-to-null shape to mirror; `compute-best-efforts.ts:311-321` is the exact shard-writer precedent (archive-wide doc + per-id `data/stats/<name>/{id}.json` loop) to copy for `pace-quality/`. |
| QUAL-04 | Badges explain, not just mark | Found a structural mismatch: `appendStatusBadges`/`statusBadgeTexts` currently dispatch by **exact string equality** against a fixed sentinel constant (`LOW_CONFIDENCE_BADGE_TEXT`, `PACE_DISPUTED_BADGE_TEXT`) — this breaks for a badge whose VISIBLE text varies per row (D-09's own requirement). See Common Pitfalls #1 — this is the single most consequential architecture finding for the planner. |
| QUAL-05 | Severity calibrated against measured archive-wide rate, ~5% target | Full candidate-threshold sweep run against the live archive for gap-profile and impossible-sample-count (Summary + Common Pitfalls). Decimation's 154/1,866 (8.3% of streamed activities) is already known from Phase 26 and does NOT by itself clear ~5% — composite math matters, see Summary. |
| ERA-01 | Device-family, not file-format, branching | Confirmed `device_name` presence/values across the live archive (908 fēnix 6 Pro, 205 Suunto 9, 35 Strava App, 1 vívoactive 4, 741 blank). Confirmed the committed stream/`CanonicalStream` schema carries **no `speed` field at all** — ERA-01's 0%/99.8% evidence was gathered from local `export_data/` FIT files during scoping, not from anything computable in CI today; this is a justification for keying on `device_name`, not a runtime measurement Phase 27 recomputes. |
| ERA-02 | No-device-name is its own explicit category, never a default | Measured **741** blank-`device_name` activities live (roadmap's cited 716 is stale, consistent with D-06's own staleness finding), and found the 741 further splits into 659 genuine no-device-name, 78 intervals.icu-migrated (`source_provider === 'intervals'`), and 4 bulk-export-recovered (`source_provider === 'strava-export'`) — a distinction NOT visible from `device_name` alone. See Common Pitfalls #2 — this is a second load-bearing finding the planner needs before writing the family-resolution function. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Five signal computations (decimation reuse, impossible-sample, gap-profile reuse, elapsed/moving ratio, device family) | API / Backend (CI compute step) | — | Same mapping as Phase 26's classifier: this project's "API tier" is the nightly GitHub Actions `compute-all-stats` chain, not a live server. Every signal is computed once, written to `data/`, read many times by the client. |
| Index scalar fields (5 signals, additive) | Database/Storage | API/Backend (writer) | Written by `compute-dashboard-index.ts` (or a new step feeding it) into gitignored `data/dashboard/index.json`, published to GitHub Pages. |
| Per-activity evidence shard (`pace-quality/{id}.json`) | Database/Storage | API/Backend (writer) | Mirrors `best-efforts/{id}.json` exactly — written once in CI, fetched lazily by the browser. |
| Badge rendering (list + detail) | Browser / Client | — | `list.ts`/`detail.ts`/`detail-sections.ts` — static SPA render path, no server tier. |
| Filter toggle + URL state | Browser / Client | — | `list-logic.ts` — pure, DOM-free, unit-testable under vitest's `node` environment. |
| Calibration dry-run + independent recount | API / Backend (offline script) | Database/Storage | A `scripts/` script reading `data/dashboard/index.json` directly (D-03) — never imports the classifier, mirroring `compute-pace-residual.mjs`'s "reads the committed archive, writes/prints a report" shape. |

**Note on this project's tiers:** static SPA on GitHub Pages + a GitHub Actions nightly compute pipeline; no live "API/Backend" server exists. Same mapping Phase 26's research already established.

## Summary

This phase has no new library to select — every technique it needs (a gap classifier, a quantile function, a badge-append helper, a lazy per-id JSON shard client) already exists in this exact codebase from Phase 18 (best-efforts shard) and Phase 26 (gap classification, quantile, fixtures). The work is (1) wiring five new computed fields through the CI writer into the already-additive index contract, (2) a new lazy shard mirroring `best-efforts/{id}.json` byte-for-byte in shape, (3) restructuring the list badge-dispatch mechanism to carry per-row dynamic text (a genuine, non-trivial gap the badge helper's current design does not support), and (4) deriving two thresholds CONTEXT.md deliberately left open.

**Primary recommendation:** Extend `compute-dashboard-index.ts`'s existing per-activity loop (it already reads the activity JSON and conditionally the stream JSON for PACE-07) to also call `classifyGaps`/`derivePaceWithCoverage` (reused, not reimplemented) for the gap-profile signal, a new small `countImpossibleSamples` function for the impossible-sample signal, a new small `resolveDeviceFamily(device_name, source_provider)` function for device era (**must** consult `source_provider`, not `device_name` alone — see Common Pitfalls #2), and `elapsed_time / moving_time` arithmetic already available from the same activity JSON read. Write the five scalars onto `DashboardIndexRow` as **required** fields (matching the `gearName`/`paceDisagreement` WR-06 precedent already in `dashboard-index.types.ts`) and write the evidence shard in the same per-id loop pattern `compute-best-efforts.ts:311-321` already uses for `best-efforts/{id}.json`.

**The two open thresholds, measured against the live 1,865-stream archive this session:**
- **Gap-profile (recording-gap + pause, as a fraction of stream span, via the SAME `classifyGaps` Phase 26 ships):** `>20%` yields **127 activities (6.8%)**; `>25%` yields **88 (4.7%)** — the ~5% target is clearable at a 22-25% cut, and this is a mechanism-first number (it is roughly "a fifth to a quarter of the recorded time is gap"), not solved backward from 5%. Recommend `>20%` OR `>25%` as the severe cut, to be justified from mechanism (a genuinely large fraction of elapsed time not covered) rather than the target rate, per D-02.
- **Impossible-sample count:** naive raw-consecutive-sample `dd/dt` against the 100m-world-record floor (10.44 m/s) flags **662 of 1,865 (35.5%)** activities with **at least one** such sample — far too permissive to use as-is (this is exactly REQUIREMENTS.md PR-05's own cited 662-activity cohort, confirmed independently here) — but at a **raw-count** cut of `>=10` samples it drops to **31 activities (1.7%)**, and `>=20` to **10 (0.5%)**. **However, of the highest-count offenders, the top four (counts 115/89/87/59) are exactly Phase 26's severe-decimation-cohort activities** (coarse-emission-interval watches whose decimation aliasing manufactures huge implied-speed spikes when distance jumps after a long flat run) — **90% of the full 154-activity severe-decimation cohort also trips a naive "≥1 impossible sample" check.** A raw per-sample detector is NOT independent of decimation the way QUAL-02 wants; see Common Pitfalls #3 for the full data and three design options.

**Composite math the planner must reconcile against Criterion 4's ~5% (≈90-94 of 1,890) target:** decimation alone is 154/1,866 streamed activities (8.3%) — already above 5% on its own, before any other signal is unioned in. **Criterion 4's ~5% target is very likely unreachable as a literal "under ~5%" if decimation's severe threshold is genuinely fixed verbatim at D-04's 154 (which is locked, non-negotiable) and unioned with even a small impossible-sample or gap-profile contribution.** This is not something to solve by loosening D-04 (explicitly locked) or by re-tuning the other two thresholds until the union drops below 5% (D-02 forbids solving for the rate) — it is a finding for the planner to carry into implementation and very likely back to the user: **Criterion 4 and D-01/D-04/D-02 may be jointly unsatisfiable as literally worded**, and the dry-run report should state the composite rate honestly even if it lands materially above 5%, per D-02's own instruction that this is "a finding to surface, not a reason to retune."

**Everything else is integration, not invention** — the shard client, the badge helper, the filter param, and the fixture library all have exact, confirmed precedents to copy.

## Standard Stack

### Core
No new runtime dependency. Every primitive needed is already in this codebase: `classifyGaps`/`quantile`/`advanceIntervals` (`pace-derivation.ts`), `createBestEffortsClient`'s shape (`best-efforts-client.ts`), `appendAccessibleBadge` (`list.ts`), `WORLD_RECORD_SPEED_MPS`/`validateStreamSeries` (`best-effort-utils.ts`). TypeScript 5.9.3, Node 22 (project target), vitest 4.0.18 confirmed already installed (`package.json`).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| — | — | — | No new dependency; matches `.planning/research/SUMMARY.md`'s milestone-wide rejection of `simple-statistics`/`d3-array` and Phase 26's own "no new library" precedent |

### Supporting
Not applicable.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `countImpossibleSamples`/`resolveDeviceFamily` (~15-30 lines each) | A geolocation/GPS-quality npm package | Rejected — no such package exists for this project's decimated, position-free stream shape (privacy-by-design: no per-sample lat/lng committed at all, per REQUIREMENTS.md's Out of Scope table), and the milestone's own STACK.md vetting already rejected `simple-statistics`/`d3-array` for smaller asks than this |

**Installation:** none required.

**Version verification:** not applicable — no package to verify.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — every algorithm is hand-rolled TypeScript reusing existing project primitives, following Phase 26's identical precedent. `slopcheck` was not run because there is nothing to run it against. If a future planning pass introduces any `package.json` dependency during this phase, the Package Legitimacy Gate protocol must be re-run before it ships.

## Architecture Patterns

### System Architecture Diagram

```
data/activities/{id}.json  (device_name, source_provider, elapsed_time, moving_time)
data/streams/{id}.json     (t[], d[] — committed, byte-identical; NO speed field, NO per-sample lat/lng)
        │                          │
        ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  compute-dashboard-index.ts  (EXTENDED — existing per-activity loop)  │
│                                                                        │
│  For every activity (existing loop, already reads activity JSON):     │
│    - deviceEra   = resolveDeviceFamily(device_name, source_provider)  │  <- untiered fact
│    - elapsedVsMoving = elapsed_time / moving_time (or null)           │  <- untiered fact
│                                                                        │
│  IFF a stream exists (else: explicit not-computable state, D-06):     │
│    - coverage = classifyGaps(t, d)              [Phase 26, reused]   │
│    - gapProfileSeverity = tier(coverage fractions)                    │  <- tiers
│    - impossibleCount = countImpossibleSamples(t, d)  [NEW, small]     │
│    - impossibleSeverity = tier(impossibleCount)                       │  <- tiers
│    - decimationSeverity = severeDecimationCohort.has(id) ? severe     │
│                           : minor/none  [Phase 26's 154, VERBATIM]    │  <- tiers
│                                                                        │
│  Writes 5 REQUIRED scalar fields onto DashboardIndexRow (WR-06        │
│  pattern: required, never optional, so a compute step that stops      │
│  emitting one fails tsc, not silently)                                │
│                                                                        │
│  Writes evidence shard data/stats/pace-quality/{id}.json              │
│  (mirrors compute-best-efforts.ts:311-321's per-id write loop)        │
└──────────────────────────────────────────────────────────────────────┘
        │                                              │
        ▼                                              ▼
data/dashboard/index.json                    data/stats/pace-quality/{id}.json
(5 new REQUIRED scalar fields,                (gap intervals, impossible-sample
 schemaVersion stays 1)                        indices+speeds, zero-advance run
        │                                       profile, resolved window, device
        │                                       family + raw device_name)
        ▼                                              ▲
┌────────────────────────┐                              │ fetched lazily, ONE call,
│ list.ts / list-logic.ts │                              │ inside detail.ts's existing
│ - severe-only list badge│                              │ Promise.all (mirrors
│ - "any severe" filter   │                              │ bestEffortsClient.load)
│ toggle (1 new URL param)│                    ┌─────────┴──────────┐
└────────────────────────┘                     │ detail.ts /         │
                                                │ detail-sections.ts  │
                                                │ - all 5 always      │
                                                │   disclosed, tiered │
                                                └─────────────────────┘

Offline, CI-adjacent (D-03's independent recount — NOT a browser path):
data/dashboard/index.json
        │  read directly, NO import of the classifier/compute step
        ▼
scripts/compute-pace-quality-recount.mjs  (NEW, mirrors compute-pace-residual.mjs's
        │                                  "reads committed archive, prints a report" shape)
        ▼
stdout / a committed report — counts severe-tier fields with its own arithmetic
```

### Recommended Project Structure

```
src/analytics/
├── pace-derivation.ts           # EXISTING — classifyGaps/quantile/advanceIntervals reused unchanged
├── pace-fixtures.ts             # EXISTING — extend PINNED_FIXTURES' device-family stratification if new families needed; do NOT duplicate
├── pace-quality.ts              # NEW — countImpossibleSamples, resolveDeviceFamily, tier() helpers, all 5 signal assembly, pure/client-safe
├── pace-quality.test.ts         # NEW — unit tests per signal, including the two threshold "demonstrated failing" cases
├── compute-dashboard-index.ts   # EXTENDED — calls pace-quality.ts, writes 5 fields + shard
└── dashboard-index.types.ts     # EXTENDED — 5 new REQUIRED fields on DashboardIndexRow, following gearName/paceDisagreement's WR-06 pattern

src/dashboard/
├── data/
│   ├── best-efforts-client.ts       # EXISTING — pattern to mirror exactly
│   └── pace-quality-client.ts       # NEW — fetch-once/memoize client for pace-quality/{id}.json, mirrors best-efforts-client.ts's parse-tolerant/degrade-to-null shape
└── views/
    ├── list.ts                      # EXTENDED — statusBadgeTexts/appendStatusBadges restructured for dynamic per-row text (see Common Pitfalls #1)
    ├── list-logic.ts                # EXTENDED — one new FilterState field + URL param
    ├── detail.ts                    # EXTENDED — pace-quality shard added to the existing Promise.all in mountBestEffortsAndBadges (or an equivalent mount fn)
    └── detail-sections.ts           # EXTENDED — new "Quality Signals" section near buildBreakdownSection's Pace Distribution heading

scripts/
└── compute-pace-quality-recount.mjs  # NEW (D-03) — reads data/dashboard/index.json ONLY, never imports pace-quality.ts
```

### Pattern 1: The shard-writer precedent to copy exactly

**What:** `compute-best-efforts.ts` writes the archive-wide document first, then loops a second time writing one file per activity id under `<statsDir>/<name>/<id>.json`.

**Confirmed source (this session):**
```typescript
// Source: src/analytics/compute-best-efforts.ts:308-321
await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);

// Per-activity shard files (18-13/T-18-AVAIL-04): the detail view's
// ...
for (const [id, entry] of Object.entries(doc.activities)) {
  await fileStore.writeJson(path.join(statsDir, 'best-efforts', `${id}.json`), entry);
}
```
**When to use:** Write `data/stats/pace-quality/{id}.json` the same way, inside (or immediately after) `compute-dashboard-index.ts`'s existing per-activity loop — no new top-level script is required; the index writer is already iterating every activity once.

### Pattern 2: The lazy shard client to mirror exactly

**What:** `createBestEffortsClient` — fetch-once, memoized-by-id (`Map<string, Promise<...>>`), a 404 or malformed body degrades to `null` (never rejects), and — critically — **a `null` result is NOT memoized**, so a subsequent load re-fetches rather than replaying a cached failure.

**Confirmed source (this session, full function read):** `src/dashboard/data/best-efforts-client.ts` — `parseActivityBestEfforts` (total, never-throwing, tolerant at the entry level), `createBestEffortsClient` (in-flight `Map`, `reset()` for tests). Copy this shape verbatim for `pace-quality-client.ts`, changing only the URL (`stats/pace-quality/{id}.json`) and the parse function's field set.

### Pattern 3: The one-mount-point fetch guarantee (Criterion 2's structural half)

**What:** `detail.ts`'s `mountBestEffortsAndBadges` function is called exactly once per detail-view mount and does exactly one `Promise.all([...])` for every shard/config fetch the detail view needs (best-efforts, age-grading, live exclusion state). This function is NOT called from the list view at all — it exists only inside the detail-route render path.

**Confirmed source (this session):** `src/dashboard/views/detail.ts:536-546`.

**When to use:** Add `paceQualityClient.load(detail.id)` as a fourth member of this SAME `Promise.all`. This is what makes "zero fetches on list, exactly one on open" true **by construction** rather than by observation alone — the list view's render path never imports or calls this function, so there is no code path by which a shard fetch could leak onto the list screen. D-18's instrumented counter test should assert this same guarantee (a fetch-count of exactly 1 after one `mountBestEffortsAndBadges` call, exactly 0 after building the list).

### Pattern 4: Additive-index-field discipline (already proven twice)

**What:** `gearName` and `paceDisagreement` both went onto `DashboardIndexRow` as **REQUIRED** producer-type fields (never optional), with `ParsedDashboardIndexRow`'s `Partial<>` handling the re-parse side, and `DASHBOARD_INDEX_SCHEMA_VERSION` staying at `1` both times. `scripts/verify-dashboard-publish.mjs` asserts `schemaVersion === 1` and separately spot-checks the newest field's presence (see its `gearName` check pattern).

**Confirmed source (this session):** `src/analytics/dashboard-index.types.ts`'s own header states this explicitly: *"Phase 27 asserts index additivity for its own signals against this same precedent."* Follow it exactly: 5 new REQUIRED fields, schema version unchanged, and add a `verify-dashboard-publish.mjs` spot-check for at least one of the five (mirroring its existing `gearName` leak/presence check).

### Anti-Patterns to Avoid

- **Computing per-sample impossible-speed over the RAW stream without excluding decimation-aliased jumps, then treating the count as independent evidence from decimation:** measured this session at 90% overlap with the severe-decimation cohort for the highest-count offenders — see Common Pitfalls #3.
- **Keying device-family resolution on `device_name` alone:** silently merges 78 intervals.icu-migrated activities into `no-device-name`, discarding a real, currently-invisible-without-`source_provider` distinction — see Common Pitfalls #2.
- **Bolting a fourth `if (text === SOME_NEW_SENTINEL)` branch onto `appendStatusBadges`'s existing dispatch-by-exact-string-equality:** works only for FIXED badge text; Phase 27's badges need PER-ROW dynamic text (D-09) — see Common Pitfalls #1.
- **Treating Criterion 4's ~5% target as solvable by retuning after seeing the composite rate exceed it:** explicitly forbidden by D-02; the union of a locked 8.3% decimation cohort with any nonzero contribution from the other two signals is very likely to exceed ~5%, and that is a finding, not a bug to fix by moving a threshold.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gap classification for the gap-profile signal | A second gap classifier | `classifyGaps` (`pace-derivation.ts`) | D-04/26-CONTEXT.md's explicit reuse mandate; recomputing gap logic here would let this phase's classification silently drift from Phase 26's |
| A percentile/quantile function | A new implementation or naive `sort()[i]` | `quantile()` (`pace-derivation.ts`, exported) | Same R-7 linear-interpolation implementation Phase 28's ceiling will also reuse — its own JSDoc says do not substitute a nearest-rank variant |
| A lazy per-activity JSON fetch client | A new fetch/cache pattern | `createBestEffortsClient`'s shape (`best-efforts-client.ts`) | Already the total, never-throwing, never-memoize-a-failure pattern this exact use case needs |
| An accessible badge with visible text + hover/`aria-describedby` explanation | A new badge DOM builder | `appendAccessibleBadge` (`list.ts`) | D-09 names this explicitly; it is already the single builder every other badge in this dashboard uses |
| A "read the shipped index, count fields, print a report" recount script | A new ad-hoc script shape | `scripts/compute-pace-residual.mjs`'s shape (read committed data, compute, print/write) | Direct, already-tested precedent in this repo for exactly this kind of offline verification script |
| World-record speed ceilings | A hardcoded new literal for "100m WR speed" without checking existing constants | `WORLD_RECORD_SPEED_MPS` (`best-effort-utils.ts`) — **note: its shortest entry is `400m` at 9.296 m/s, NOT 100m at 10.44 m/s; the 10.44 value used elsewhere in this repo (`pace-fixtures.ts` comments, PR-05's own cited cohort) is not an exported constant anywhere in `src/`** | Avoids a second, undocumented "world record speed" literal; if a 100m-specific value is needed it should be added as an exported constant, not a private literal buried in the new signal's file |

**Key insight:** identical to Phase 26's own conclusion — every primitive this phase needs already exists in a directly-reusable shape (classifier, quantile, shard client, badge builder, recount-script shape). The actual net-new work is small (impossible-sample counting, device-family resolution, the badge-dispatch restructuring) and each of those three has a concrete, measured gotcha documented below.

## Common Pitfalls

### Pitfall 1: `appendStatusBadges`'s dispatch is keyed on exact string equality — Phase 27's badges need per-row dynamic text
**What goes wrong:** `statusBadgeTexts(row): string[]` returns plain strings, and `appendStatusBadges` decides HOW to render each one by comparing it against fixed sentinel constants (`text === LOW_CONFIDENCE_BADGE_TEXT`, `text === PACE_DISPUTED_BADGE_TEXT`). This works today because every existing badge's VISIBLE text is either fully generic (rendered via plain `appendBadge`) or one of exactly two fixed strings ("Low confidence", "Pace disputed") whose dynamic detail lives only in the hover/`aria-describedby` explanation, never in the visible text itself (confirmed: the list row's "Pace disputed" badge shows the SAME fixed string for every disputed activity; only `detail.ts`'s separate stat-card badge shows the per-activity stream-derived figure). D-09 requires the LIST row's visible badge text itself to carry the measured value (`12% of elapsed time in recording gaps`) — a genuinely new requirement this dispatch shape cannot satisfy by adding more `if (text === X)` branches, because there is no fixed `X` to match against when the text varies continuously per row.
**Why it happens:** The existing pattern was built for exactly two dynamic-explanation-but-fixed-visible-text badges; nothing in it anticipated a badge whose visible text itself varies per activity.
**How to avoid:** Restructure `statusBadgeTexts`'s contract (or add a parallel decision function) so the append step can consult the ROW's own severity fields directly — e.g., have `appendStatusBadges` check `row.gapProfileSeverity === 'severe'` and call a new `appendGapProfileBadge(container, idPrefix, row.gapProfileEvidence)` directly, rather than round-tripping through a `string[]` and re-matching by content. This is an API change to `statusBadgeTexts`'s signature/contract, not an additive branch — flag this explicitly in the plan rather than discovering it mid-implementation.
**Warning signs:** A plan that adds `if (text === 'some hardcoded gap badge string')` and then can't make the percentage vary per activity without threading it back through the string comparison.

### Pitfall 2: `device_name` alone cannot distinguish `intervals-icu` from `no-device-name` — both are blank
**What goes wrong:** Measured this session: of 741 activities with a blank/absent `device_name`, only 659 are genuinely Strava-recorded-with-no-device-metadata. The other 82 also have blank `device_name` but are NOT the same population: 78 carry `source_provider === 'intervals'` (the Aug 2026 intervals.icu migration, per STATE.md's Aug 2026 maintenance-arc note) and 4 carry `source_provider === 'strava-export'` (bulk-export-recovered runs, same note). A device-family resolver keyed on `device_name` alone will silently fold all 82 into `no-device-name`, understating the `intervals-icu` family CONTEXT.md's own pinned fixture (`i174284902`) explicitly names as its own category.
**Why it happens:** `device_name` is the field every other piece of this codebase (`gear-client.ts`'s `resolveGearLabel`, the pinned fixtures' `why` strings) uses to talk about device provenance, so it's the natural first field to reach for — but it was never designed to distinguish ingestion PROVENANCE (which pipeline synced this activity) from device METADATA (what hardware recorded it), and this is the one case where that distinction matters.
**How to avoid:** `resolveDeviceFamily` must consult BOTH `device_name` (primary) and `source_provider` (tiebreaker for the blank-device_name case): `device_name` non-empty → family lookup (or `unrecognized-device` + raw string, D-12); else `source_provider === 'intervals'` → `intervals-icu`; else → `no-device-name` (this also silently and correctly folds the 4 `strava-export` bulk-recovery activities into `no-device-name`, which this research judges acceptable — they are genuinely Strava-sourced activities with no device metadata, just recovered via a different channel; flag for the planner's confirmation, not asserted as settled).
**Warning signs:** A measured `no-device-name` cohort that doesn't match a separately-computed `intervals-icu`-only count, or an `intervals-icu` family in the shipped index with zero rows despite `i`-prefixed activities existing in the archive.

### Pitfall 3: A naive per-sample impossible-speed detector re-detects decimation, not independent GPS error
**What goes wrong:** Measured this session: counting samples whose consecutive-pair implied speed (`(d[i+1]-d[i])/(t[i+1]-t[i])`) exceeds the 100m-world-record floor (10.44 m/s) flags 662/1,865 activities (35.5%) with at least one such sample — matching REQUIREMENTS.md PR-05's own cited cohort exactly, confirming this is the SAME mechanism Phase 28's PR-plausibility work targets, not a new one. At a stricter raw-count cut (`>=10` samples), the top offenders by count are `4598855187` (115), `4184295723` (89), `3647739864` (87), `5059204779` (59) — the first, third and fourth are exactly Phase 26's pinned coarse-emission-interval profile activities (zero-advance fraction 92-97%, all inside the 154-activity severe-decimation cohort). Archive-wide, **139 of the 154 severe-decimation activities (90%) also trip a naive "≥1 impossible sample" check** — because decimation aliasing manufactures exactly the "huge distance jump in one short tick after a long flat run" shape that also reads as an impossible instantaneous speed. This is a real, measured coupling between two signals QUAL-02 wants to stay independently meaningful (in the same spirit as the device-era/decimation correlation QUAL-02 already names, but this pairing is NOT named or accounted for anywhere in CONTEXT.md).
**Why it happens:** Both mechanisms look at the same raw `(t, d)` residual arithmetic from a different angle — decimation collapses many samples' worth of distance into one recorded tick, and that same collapsed tick, read as an instantaneous speed, looks impossible.
**How to avoid:** This research does not resolve which of three options to take — it surfaces the finding with numbers so the planner can decide deliberately rather than discover it in a failing calibration report:
  1. **Accept the overlap** (same treatment QUAL-02 already accepts for device-era/decimation) — an activity that is BOTH severely decimated AND has raw impossible-speed samples is arguably a genuinely worse activity, and two badges naming two distinct-but-correlated mechanisms is still informative. Simplest, most consistent with D-05's existing precedent.
  2. **Exclude segments already inside a `pause`/flat-run classification from the impossible-sample count** — tested this session and found it does NOT solve the problem: the coarse-emission-interval activities' flat runs are mostly classified as `covered` (not `pause`) under D-05's scale-relative pause rule (by design — 5059204779 must classify with ~0% pause time), so excluding `pause`-classified segments leaves the aliasing jumps untouched.
  3. **Use a windowed/smoothed implied speed rather than raw consecutive-sample deltas** for the impossible-sample check specifically — would damp decimation spikes while likely preserving genuine single-sample GPS noise (the `34757xxxxx`-prefixed activities, whose impossible counts of 13-48 samples show 0% zero-advance fraction — a DIFFERENT, non-decimation population, possibly the "recorded with an inaccurate GPS device" activities STATE.md's Pending Todos section already names, `3475726256`/`3475725513`). Most surgical, most implementation effort.
**Warning signs:** A dry-run report where the impossible-sample severe tier and the decimation severe tier have near-total overlap in their flagged-ID lists — a sign option 1 was taken implicitly without a deliberate decision, or that option 2/3 wasn't actually effective.

### Pitfall 4: Criterion 4's ~5% target may not be jointly satisfiable with D-01/D-02/D-04 as literally worded
**What goes wrong:** D-04 locks decimation's severe threshold verbatim at Phase 26's 154-activity cohort (8.3% of 1,866 streamed activities) — already above the ~5% (≈90-94) target on its own, before any contribution from the other two tiering signals. D-01 requires the composite ("any severe") to be the number Criterion 4 measures. D-02 forbids solving backward from the 5% target. Under these three constraints simultaneously, the composite is a floor of at least 154 activities (8.3%) — a number ABOVE ~5% is close to unavoidable, not merely possible, unless significant portions of the 154 decimation-severe set overlap with activities that would ALSO be excluded some other way this research did not find (e.g., if many of the 154 have no impossible/gap-profile issues at all, they're still each individually severe on decimation alone and still count toward the composite).
**Why it happens:** CONTEXT.md's four severity decisions were each reasoned through independently and locally-justified (D-01's "any severe" composite, D-02's "don't solve for the rate," D-04's "reuse Phase 26's cohort verbatim") without anyone computing whether all three can hold AND land under 5% simultaneously — and Phase 26's 154-activity cohort was fixed before Phase 27's calibration discussion happened.
**How to avoid:** The plan should compute the actual composite rate honestly in the dry-run and REPORT it, per D-02's own instruction that a high rate is "a finding to surface, not a reason to retune." The plan should not silently narrow D-04's decimation definition to make the number smaller (that would violate D-04's "verbatim" instruction) nor treat Criterion 4 as failed-and-therefore-unshippable without first checking with the user — this is exactly the kind of measured, load-bearing tension between a locked decision and a roadmap criterion the planner should flag back rather than resolve unilaterally.
**Warning signs:** A calibration report landing at ~8-15% with no acknowledgment that D-04 alone accounts for most of it — treating it as if the OTHER two signals are the problem when the math shows they may not need to add much at all.

## Code Examples

### The exact fetch-once/memoize/degrade shape to mirror for the new shard client
```typescript
// Source: src/dashboard/data/best-efforts-client.ts (read in full, this session)
export function createBestEffortsClient(options: BestEffortsClientOptions = {}): BestEffortsClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const inFlight = new Map<string, Promise<ActivityBestEfforts | null>>();

  async function fetchActivityBestEfforts(activityId: string): Promise<ActivityBestEfforts | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const url = `${baseUrl}stats/best-efforts/${activityId}.json`;
      const response = await doFetch(url);
      if (!response.ok) throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      const body = await response.json();
      return parseActivityBestEfforts(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(activityId: string): Promise<ActivityBestEfforts | null> {
    const existing = inFlight.get(activityId);
    if (existing) return existing;
    const promise = fetchActivityBestEfforts(activityId).then((result) => {
      if (result === null) inFlight.delete(activityId); // do NOT memoize a failure
      return result;
    });
    inFlight.set(activityId, promise);
    return promise;
  }

  function reset(): void { inFlight.clear(); }
  return { load, reset };
}
```

### The exact one-mount-point Promise.all to extend
```typescript
// Source: src/dashboard/views/detail.ts:536-546
async function mountBestEffortsAndBadges(/* ... */): Promise<void> {
  const [bestEffortsEntry, ageGrading, liveExclusionState] = await Promise.all([
    bestEffortsClient.load(detail.id),
    ageGradingClient.load(),
    loadLiveExclusionState(detail.id),
  ]);
  // ADD: paceQualityClient.load(detail.id) as a fourth member here.
  // ...
}
```

### The exact per-id shard-write loop to copy
```typescript
// Source: src/analytics/compute-best-efforts.ts:308-321
await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);
for (const [id, entry] of Object.entries(doc.activities)) {
  await fileStore.writeJson(path.join(statsDir, 'best-efforts', `${id}.json`), entry);
}
```

### The device-family/source_provider distinction (measured this session — no existing code reference, net-new)
```typescript
// Measured this session against data/activities/*.json (1,890 files):
// device_name breakdown: 908 "Garmin fēnix 6 Pro", 205 "Suunto 9", 35 "Strava App",
// 1 "Garmin vívoactive 4", 741 blank/absent.
// Of the 741 blank: 659 no source_provider (genuine no-device-name),
// 78 source_provider === "intervals" (intervals.icu migration),
// 4 source_provider === "strava-export" (bulk-export recovery).
function resolveDeviceFamily(deviceName: string | null | undefined, sourceProvider: string | undefined): DeviceFamily {
  if (typeof deviceName === 'string' && deviceName.trim().length > 0) {
    return KNOWN_FAMILIES[deviceName] ?? { kind: 'unrecognized-device', raw: deviceName };
  }
  if (sourceProvider === 'intervals') return { kind: 'intervals-icu' };
  return { kind: 'no-device-name' };
}
```

### Impossible-sample measurement, archive-wide (this session, reproducible against `data/streams/`)
```
Activities with >=1 sample faster than 100m WR (10.44 m/s): 662 of 1,865 (35.5%)
Activities with >=1 sample faster than 400m WR (9.30 m/s, existing WORLD_RECORD_SPEED_MPS['400m']): 750 (40.2%)
  >=1  impossible samples: 662 activities (35.5%)
  >=2  impossible samples: 300 activities (16.1%)
  >=5  impossible samples:  71 activities ( 3.8%)
  >=10 impossible samples:  31 activities ( 1.7%)
  >=20 impossible samples:  10 activities ( 0.5%)
Top 4 by raw count are exactly Phase 26's severe-decimation profile activities (92-97% zero-advance).
Overlap: 139 of the 154 severe-decimation activities ALSO have >=1 impossible sample (90%).
```

### Gap-profile measurement, archive-wide (this session, via `classifyGaps`'s own logic, reused not reimplemented)
```
>5%  of span in gap (recording+pause): 464 activities (24.9%)
>10% of span in gap: 279 activities (15.0%)
>15% of span in gap: 197 activities (10.6%)
>20% of span in gap: 127 activities ( 6.8%)
>25% of span in gap:  88 activities ( 4.7%)
>30% of span in gap:  63 activities ( 3.4%)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Badges with fixed visible text + dynamic explanation only (`appendPaceDisputedBadge`) | Badges whose VISIBLE text itself carries a per-row measured value (D-09) | This phase | `statusBadgeTexts`'s string-equality dispatch contract must be restructured, not extended — see Pitfall 1 |
| `device_name` as the sole provenance signal | `device_name` + `source_provider` jointly, to distinguish intervals.icu-migrated activities from genuinely device-less ones | This phase (net-new finding) | Prevents silently merging 78 intervals.icu activities into the `no-device-name` cohort |
| Effort-level plausibility (`isPlausible`, `activityMaxSpeedMps`) | Per-sample plausibility (new, this phase) | This phase | A genuinely new mechanism, not a reuse of `isPlausible` — confirmed it does not transfer (operates on a different granularity and a different denominator) |

**Deprecated/outdated:** None — this phase adds to an actively-used contract rather than replacing anything.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | This session's `fs.readdirSync('data/streams')` found 1,865 files excluding `manifest.json`; CONTEXT.md's D-06 states 1,866 streams. Both are consistent with "the archive changes between sessions" (the same drift Phase 26's own research flagged for its cohort counts) — treat as a 1-activity sync-timing difference, not a discrepancy to chase down. | User Constraints D-06, Summary | LOW — re-run the same `fs.readdirSync` count at implementation time; a difference of more than 1-2 from this session's numbers is worth investigating, a difference of exactly 1 is expected archive drift |
| A2 | The severe-decimation cohort re-measured this session (154, using Phase 26's exact >15%-zero-advance-AND->=50-samples rule) is assumed to be IDENTICAL in membership (not just count) to `26-RESIDUAL.md`'s own 154 — this session verified the COUNT matches but did not diff the full ID list against `26-RESIDUAL.md` (which only lists the 14-activity residual, not the full 154) | Summary, Common Pitfalls #3/#4 | LOW-MEDIUM — if archive drift added/removed a different single activity that also happens to cross the 15% line, the overlap-with-impossible-sample-count figure (139/154, 90%) could shift by one or two; re-verify at implementation time via `npm run compute-pace-residual`'s own re-derivation, which the plan should do anyway per D-04 |
| A3 | Folding the 4 `source_provider === 'strava-export'` blank-device_name activities into `no-device-name` (rather than a new fourth category) is this research's judgment call, not a locked decision | Common Pitfalls #2, Code Examples | LOW — 4 activities either way; if the planner/user wants these distinguished, add a fourth `bulk-recovery` family value, but this research recommends NOT doing so since REQUIREMENTS.md/CONTEXT.md never names this population and it is genuinely a Strava-recorded, device-less activity by any definition ERA-02 cares about |
| A4 | The 100m-world-record floor (10.44 m/s, Bolt 9.58s) is assumed to be a reasonable STARTING candidate for "physically impossible" per-sample speed, matching the existing informal precedent in `pace-fixtures.ts`'s comments and PR-05's own cited cohort — but no code in `src/` currently exports this constant, and the actual severe-tier cut this research proposes (raw count >=10 or >=20) is itself unvalidated against any "genuinely broken" ground truth beyond the decimation-overlap finding | Summary, Common Pitfalls #3 | MEDIUM — this is explicitly Claude's-Discretion territory per CONTEXT.md; the planner/discuss-phase should treat the specific cut number as a proposal requiring the same D-02 mechanism-first justification this research began but did not finish (e.g., "why >=10 rather than >=5 or >=20" still needs a stated reason beyond "matches roughly the right order of magnitude") |
| A5 | Whether Pitfall 4's "Criterion 4 may be jointly unsatisfiable" finding is itself correct depends on the exact impossible-sample and gap-profile severe cuts chosen, which are not yet locked — it is possible (though this research judges unlikely, given decimation alone is already 8.3%) that a sufficiently narrow choice for the other two signals keeps the union close to 154/1,866 with minimal addition, landing near 8-9% rather than materially higher | Summary, Common Pitfalls #4 | MEDIUM — this is the single most consequential open finding in this document; the planner should compute the ACTUAL union (not just each signal's marginal count) as an early Wave 0 task, before writing any UI code, so the tension surfaces before implementation effort is sunk into a badge/filter design premised on a rate CONTEXT.md's D-02 says must not be gamed to fit |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should Criterion 4's ~5% target be renegotiated with the user given D-04's locked 154/1,866 (8.3%) floor?**
   - What we know: decimation alone, at its locked verbatim threshold, exceeds the ~5% target before any other signal contributes.
   - What's unclear: whether the roadmap author intended the ~5% target to survive Phase 26 fixing the cohort at exactly 154, or whether that number simply wasn't cross-checked against Phase 27's own criterion at roadmap-authoring time (2026-09-08, before Phase 26 executed).
   - Recommendation: the plan should compute and report the actual composite rate as its FIRST calibration step (a Wave 0-adjacent task), and treat "the rate is materially above 5%" as an expected, reportable outcome per D-02 — surfacing it to the user for a disposition decision (accept the honest rate, or revisit D-04's severe-decimation definition with the user's explicit sign-off) rather than silently engineering around it.

2. **Which of Pitfall 3's three options (accept overlap / exclude-by-classification (shown ineffective) / windowed smoothing) should the impossible-sample detector use?**
   - What we know: option 2 is measured ineffective; options 1 and 3 are both viable but have different implementation costs and different "independence" guarantees.
   - What's unclear: whether QUAL-02's "stay individually meaningful" bar is satisfied by option 1's honest-correlation framing (same treatment as device-era/decimation) or requires option 3's extra engineering.
   - Recommendation: default to option 1 (simplest, consistent with an existing precedent) unless the discuss-phase / planner decides QUAL-02's spirit requires the extra decoupling work.

3. **Does `appendStatusBadges`'s restructuring (Pitfall 1) risk regressing the existing "Low confidence"/"Pace disputed" badges?**
   - What we know: those two badges' current fixed-text-plus-dynamic-explanation shape does not need to change; only NEW badges need dynamic visible text.
   - What's unclear: whether the cleanest restructuring keeps the existing two badges on the string-equality path (untouched) while adding a parallel, row-field-driven path for the three new severe-tier signals, or whether a full rewrite of the dispatch function is cleaner.
   - Recommendation: keep the existing two untouched (lowest regression risk) and add a second, explicit dispatch step for the new signals reading directly off `row.<signal>Severity`/`row.<signal>Evidence` fields rather than round-tripping through `statusBadgeTexts`'s string array.

## Environment Availability

Not applicable in the external-dependency sense — no new runtime/CLI/service dependency. Node 22, TypeScript 5.9.3, vitest 4.0.18 already installed and used directly in this session's measurement script.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, measurement scripts | ✓ | 25.2.1 (session), 22 (project target) | — |
| TypeScript | `tsc --noEmit` gate | ✓ | 5.9.3 | — |
| vitest | Unit/audit tests | ✓ | 4.0.18 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, keep this setting) |
| Quick run command | `npx vitest run src/analytics/pace-quality.test.ts` |
| Full suite command | `npm run test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | 5 signals computed in CI, index row + shard both carry them | unit + integration (real archive) | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "quality signals"` | ❌ Wave 0 (extend existing file) |
| QUAL-02 | Device era and decimation stay separate fields even on correlated activities; impossible-sample and decimation overlap does not collapse into one field | unit, using a decimation-aliased fixture with both signals asserted independently present | `npx vitest run src/analytics/pace-quality.test.ts -t "independent signals"` | ❌ Wave 0 |
| QUAL-03 | Index additive (schemaVersion unchanged), shard mirrors best-efforts pattern, fetched lazily | unit (schema) + instrumented fetch-count test (D-18) | `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "fetch count"` | ❌ Wave 0 |
| QUAL-04 | Badge visible text names condition + measured value | unit (DOM/text assertion, this project's jsdom-free convention) | `npx vitest run src/dashboard/views/list.test.ts -t "quality badge text"` | ❌ Wave 0 (extend existing file if present) |
| QUAL-05 | Dry-run composite rate reported; recount script reproduces it without importing the classifier | integration (script, real archive) | `node scripts/compute-pace-quality-recount.mjs` (diff against a committed report or CI-printed count) | ❌ Wave 0 |
| ERA-01 | fēnix 6 Pro vs Suunto 9 differentiated despite same FIT format | unit, real pinned fixtures `10041312551`/`3480808722` | `npx vitest run src/analytics/pace-quality.test.ts -t "device family"` | ❌ Wave 0 |
| ERA-02 | no-device-name (659) and intervals-icu (78) reported as distinct categories, never a fabricated default | unit + archive-wide dry run | `npx vitest run src/analytics/pace-quality.test.ts -t "no-device-name category"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/analytics/pace-quality.test.ts src/dashboard/data/pace-quality-client.test.ts`
- **Per wave merge:** `npm run test` (full suite, `fileParallelism: false`)
- **Phase gate:** Full suite green + `tsc --noEmit` + `npm run build-widgets` before `/gsd-verify-work`, matching every prior phase's convention

### Wave 0 Gaps
- [ ] `src/analytics/pace-quality.ts` + `.test.ts` — the module itself (impossible-sample count, device-family resolution, tiering)
- [ ] `src/dashboard/data/pace-quality-client.ts` + `.test.ts` — shard client mirroring `best-efforts-client.ts`
- [ ] `scripts/compute-pace-quality-recount.mjs` — D-03's independent recount script
- [ ] Extend `src/analytics/dashboard-index.types.ts` — 5 new REQUIRED fields
- [ ] Extend `src/analytics/compute-dashboard-index.ts` — call the new module, write the 5 fields + shard
- [ ] Restructure `src/dashboard/views/list.ts`'s badge-dispatch (Pitfall 1) — this is bigger than an additive change and should be its own task/plan step
- [ ] Extend `src/dashboard/views/list-logic.ts` — one new `FilterState` field + URL param
- [ ] Extend `src/dashboard/views/detail.ts` — add `paceQualityClient.load` to the existing `Promise.all`
- [ ] Extend `src/dashboard/views/detail-sections.ts` — new always-on quality section
- [ ] Extend `scripts/verify-dashboard-publish.mjs` — spot-check at least one of the 5 new fields, following the existing `gearName` check pattern
- [ ] A human browser checkpoint — this project's standing convention, and D-18 explicitly requires a network-panel checkpoint for Criterion 2 specifically (not merely a general courtesy checkpoint)

**Framework install:** none needed.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled by default), matching Phase 26. This phase's attack surface is narrow but non-zero, larger than Phase 26's: it publishes a previously-uncommitted-to-the-index raw string (`device_name`) to a public artifact for the `unrecognized-device` category (D-12).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | Yes | `device_name` is athlete/device-controlled free text now reaching the published index for the FIRST time as a raw, un-mapped string (`unrecognized-device`'s raw field) — must render with `textContent`, never `innerHTML`, matching the existing rule for `row.name` and precedented by `resolveGearLabel` already putting `device_name` into `gearName`. `validateStreamSeries`'s total/never-throwing contract must extend to the new pure functions on any array-shaped input. |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted/adversarial `device_name` string reaching the DOM unescaped via the new `unrecognized-device` badge/detail text | Tampering (stored XSS via athlete-controlled Strava metadata, mirroring the existing `row.name` threat model this codebase already defends against) | `textContent` only, never string-concatenated `innerHTML` — same rule `dashboard-index.types.ts`'s header already states for `name` |
| A malformed/adversarial `data/streams/{id}.json` causing an uncaught exception in the new impossible-sample/device-family functions | Denial of Service (client-side crash) | Every new function must be total (validated input via `validateStreamSeries`, safe defaults, never throws), same discipline `pace-derivation.ts`'s header already states |

## Sources

### Primary (HIGH confidence — read/measured directly against the live repository this session)
- `src/analytics/compute-dashboard-index.ts`, `dashboard-index.types.ts`, `pace-derivation.ts`, `pace-fixtures.ts`, `best-effort-utils.ts`, `compute-best-efforts.ts` — read in full or by targeted `grep -n` + `sed -n`, line numbers cited above confirmed directly
- `src/dashboard/data/best-efforts-client.ts`, `gear-client.ts` — read in full
- `src/dashboard/views/list.ts`, `list-logic.ts`, `detail.ts`, `detail-sections.ts` — read by targeted section, function signatures and call sites confirmed by `grep -n`
- `src/compute-all-stats-steps.ts`, `scripts/verify-dashboard-publish.mjs`, `package.json` — read for CI chain ordering and toolchain versions
- `data/streams/*.json` (1,865 files), `data/activities/*.json` (1,890 files) — read via `node:fs` from a throwaway script under this session's scratchpad directory, never touching `src/`, `data/`, or `scripts/`
- `.planning/phases/26-.../26-RESIDUAL.md`, `26-RESEARCH.md`, `26-CONTEXT.md` — read in full for the reused gap-classifier/fixture-library/cohort-definition precedent

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` — read in full for requirement text, success criteria, and the Aug 2026 maintenance-arc note that explains `source_provider`'s intervals.icu/strava-export values

### Tertiary (LOW confidence)
- None — this phase's research required no external web sources; the whole task was internal code reading and archive measurement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every reused primitive confirmed present and unchanged by direct source read
- Architecture (shard client, mount-point, shard-writer patterns): HIGH — every named integration point confirmed present in actual committed source with exact line numbers
- Badge-dispatch restructuring need (Pitfall 1): HIGH — confirmed by reading the actual dispatch function; this is not a hypothesis
- Device-family/`source_provider` finding (Pitfall 2): HIGH — exact counts measured against all 1,890 activity files
- Impossible-sample/decimation overlap finding (Pitfall 3): HIGH for the measured overlap number (139/154); MEDIUM for which of the three design options is "correct" — that is a genuine open design question, not a resolved fact
- Criterion-4-unsatisfiability finding (Pitfall 4): MEDIUM — the arithmetic (154/1,866 > 5%) is HIGH confidence; whether the OVERALL union stays close to 154 or grows substantially depends on thresholds not yet chosen, which is itself the open question

**Research date:** 2026-09-10
**Valid until:** Recommend re-verifying the 154-cohort, 741-no-device-name, and 662/139-overlap counts at implementation time if more than ~1-2 weeks elapse — this archive grows via nightly CI sync (confirmed drifting by dozens of activities within the same milestone in Phase 26's own research).
