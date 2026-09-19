# Phase 32: Unreliable-Segment Detection & Calibration - Research

**Researched:** 2026-09-19
**Domain:** Sample-level GPS/timing anomaly detection over committed `t`/`d` streams; archive calibration with an explicit non-circularity argument
**Confidence:** HIGH overall — every numeric claim below was either measured directly against `data/streams/*.json` / `data/activities/*.json` in this session, or is copied verbatim from CONTEXT.md/PROJECT.md with its original provenance preserved. Two items (the exact speed-limit statistic, the metres-boundary valley) are explicitly LOW/inconclusive by measurement, not by omission — see Assumptions Log and Open Questions.

## Summary

Phase 32 ships one new, fully standalone module (`src/analytics/unreliable-segments.ts`) that is **not wired into `pace-derivation.ts`/`classifyGaps` this phase** — per CONTEXT.md's Phase Boundary, that integration is explicitly Phase 33's job. This corrects `research/ARCHITECTURE.md`'s Pattern 1, which was written before CONTEXT.md's discussion and assumed the detector would be called from inside `classifyGaps` in this same phase; CONTEXT.md's "Not in this phase" list overrides that assumption. Phase 32's actual deliverable is: a pure detector function operating on `t`/`d` alone, a committed/regenerable/idempotent calibration artifact (`32-CALIBRATION.md`), an independent gap-first recount script for `3475724402` that never imports the detector, and the `pace-single-source.test.ts` audit extended to cover the detector (SEG-05a only — SEG-05b, "every consumer reads it," has no consumer yet and is correctly out of scope).

This session identified the previously-unrecorded Suunto over-measurement activity: **`4556693525`** (Suunto 9, FIT file `activities/4868274524.fit.gz`). The match is conclusive on two independent, exact figures: position present in **51.3%** of the FIT file's 3,359 records (computed by decoding the file with the already-installed `@garmin/fitsdk`, exactly matching the milestone's quoted figure) and an elevation low of **−282 m** (matching STREAM-08's "admits −282 m altitude readings" verbatim — same activity, independently corroborated). On the raw 1 Hz FIT, the single fastest sample-to-sample burst near that descent is **36 m/s over 1 real second** (08:05:26→27, dist 962→998 m), not literally 17 m/s — the "17 m/s" figure in planning prose does not reproduce exactly under a plain distance-delta measurement and should be treated as an approximation, not a value to re-cite as exact (see Assumptions Log A1). On the **committed, decimated stream** (`data/streams/4556693525.json`, 1,682 samples vs 3,359 raw — roughly 2:1 decimation), the same burst is split across two decimated pairs: **18.0 m/s (36 m in 2 s, t=271→273)** and **21.0 m/s (42 m in 2 s, t=273→275)** — i.e. it is not diluted below detectability, it is if anything *more* visible (higher per-sample speed than the raw "17 m/s" prose figure) because decimation-by-selection kept both endpoint samples of the fast section. D-01's decision (the Suunto sample WILL be flagged, no speed rule can spare it) is reinforced, not weakened, by this finding.

This session also found, measured, and vetted three real activity IDs for D-05's negative-control fixtures — sustained, corroborated-genuine fast running with no gap adjacency, all recorded on a Garmin fēnix 6 Pro (a different, GPS-reliable device family from the three Suunto/phone-app scoping activities): `16628769295` (33 s @ 6.05 m/s, HR rising 155→161, cadence 181–185), `7409028052` (33 s @ 6.03 m/s, HR 144–148, cadence 179–185), `8869338724` (24 s @ 6.27 m/s, HR 155–159, cadence 165–171). None touches a >10 s gap. Headroom to the slowest named jump (10.0 m/s) is **3.7–4.0 m/s (~60–65%)** — smaller than the Suunto-vs-jump headroom architecture research assumed, but a clean, real, corroborated gap. A broader archive-wide sweep for "sustained fast running" surfaced 47 candidates at 18–24 m/s for 15–40+ seconds; every one of those is a red herring (see Common Pitfalls) — the true "fastest genuine" ceiling in this personal recreational archive sits around 6.0–6.8 m/s, not higher.

**Primary recommendation:** Build `unreliable-segments.ts` as a self-contained, `pace-derivation.ts`-independent module this phase; do not touch `classifyGaps`/`GapKind`/`PaceCoverage`. Derive the speed-limit constant from a bulk (not tail) archive-wide statistic sitting between the ~6.3 m/s genuine-fast ceiling and the 10.0 m/s slowest jump, run the D-13 insensitivity check watched failing on a tail-percentile strawman first, and ship the calibration artifact, the gap-first recount, and the single-source-audit extension all in this phase, exactly as CONTEXT.md's Phase Boundary requires.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** ROADMAP criterion 4 / SEG-04 wins over PITFALLS.md Pitfall 2. If the run-level rule fires on the Suunto sample (activity `4556693525`, confirmed this session), it IS a segment. Pitfall 2's "must stay unflagged" is superseded. Downstream agents must not pin the Suunto sample as a must-not-fire fixture.
- **D-02:** The Suunto activity must first be identified and measured on the COMMITTED stream — done this session (`4556693525`, see Summary above and the dedicated section below). The artifact states the outcome either way.
- **D-03:** No fourth mechanism enum member. A no-gap run is `isolated-jump` (or `hidden-pause` per D-08). SEG-04's "own mechanism label" is satisfied by a disclosed note in the calibration artifact naming the Suunto activity and stating the detector cannot tell over-measurement from a jump. Needs a recorded wording amendment to ROADMAP criterion 4 and REQUIREMENTS SEG-04.
- **D-04:** One downstream treatment for every segment (Phases 33/36 must not re-litigate or add a per-mechanism branch).
- **D-05:** The negative control is the archive's fastest corroborated-genuine running, not the Suunto. Pin 2–3 named activity IDs as permanent must-not-fire fixtures with headroom reported. Real IDs only, no synthetic look-alikes. This session proposes `16628769295`, `7409028052`, `8869338724` (see below) — not yet locked, pending planner/discuss confirmation.
- **D-06:** Adjacency = touching only (no tolerance constant). SEG-04's "adjacency rule calibrated" is discharged by a near-miss sweep reported as a finding.
- **D-07:** Clean samples never swallowed; segments chain only when contiguous (burst–gap–burst–gap, nothing clean between).
- **D-08:** Hidden-pause vs isolated-jump split by metres carried, calibrated from the archive's no-gap-segment metres distribution. If no clean valley, the artifact says so and the label is a best-effort description. This session's probe found **no clean valley** (see D-08 section) — plan for the contingency wording, not a hard cutoff.
- **D-09:** A calibrated excess-metres significance floor must admit 24.7 m/2 s at t=2587 on `3475740390` (confirmed on committed stream: 7718.5−7693.8=24.7 m) and should exclude `3475734189`'s ≈17 m/2 s at t=1581–1583 (confirmed: 4548.3−4531.0=17.3 m).
- **D-10:** Speed-limit statistic delegated under 5 structural constraints (bulk-set, not a tail percentile of the judged population, not round, flags every named burst on the three scoping activities and spares D-05's fixtures, anti-quota). See Calibration Population section for probe figures.
- **D-11:** One rule for every stream; disjointness from decimation is proven, not engineered, against `decimationSignal`'s `'severe'` tier (`pace-quality.ts`).
- **D-12:** 1 Hz FIT originals: validation only, never derivation. A local-only script under `scripts/` cross-checks detected segments against 1 Hz originals; nothing under `export_data/` is wired into CI or `npm test`.
- **D-13:** Non-circularity demonstrated as insensitivity (remove detected segments / plant synthetic slews, constant must not move beyond a stated tolerance), watched failing first on a deliberately circular statistic (e.g. a tail percentile).
- **D-14:** SEG-05 is split. Phase 32 closes SEG-05a only (audit extension + planted second-implementation catch). SEG-05b (every consumer reads it) stays open, ticked per consuming phase. Needs a recorded REQUIREMENTS.md amendment (split row + traceability table).
- **D-15:** The independent per-segment table is a committed `.mjs` under `scripts/` that never imports the detector, uses a gap-first algorithm (walk outward from each gap, not run-first), emits the table for `3475724402`, is shown FAILING against a deliberately-broken detector before passing, fails closed on malformed input, and is regenerable.
- **D-16:** Headline = per-mechanism, in three units (activities, segments, metres+seconds), over a LIVE stream denominator (never hard-coded 1,873 — mind the `manifest.json`-counted-as-a-stream defect, confirmed still a live risk this session, see D-17 section). Reconciliation table against 259/1,873, 121/1,873, and 30/18/1,694 m/106 s/707 s on `3475724402`.
- **D-17:** A `data/streams/` immutability gate lands in this phase — a committed sha256-per-file manifest, watched failing on a planted one-byte edit, then restored. Must not collide with the EXISTING `data/streams/manifest.json` (a stream-availability index, unrelated purpose, legitimately changes every sync — see D-17 section for the exact collision risk).

### Claude's Discretion

- The exact statistic, multiplier and tolerance for the speed limit, the metres boundary and the excess-metres floor — bound by D-10 and D-13.
- The detector's exported types and output shape (segment fields, mechanism union, burst/gap itemisation), provided each segment carries start/end time, metres, seconds, mechanism, and enough itemisation for D-15's table. Shape it so Phase 33 can fold it into `classifyGaps` and Phase 36 can partition on it, but wire neither.
- What "second implementation" means to the extended audit (banned literals / structural patterns), bound by the audit's two documented historical blind spots (see Code Context section).
- How the near-miss sweep's N is chosen for D-06's finding (a reporting window, not a rule).
- The manifest's location/format for D-17 and how new stream files get appended.
- Artifact filename and script names, following `27-CALIBRATION.md` / `28-CEILING-CALIBRATION.md` / `30-CALIBRATION.md` and `compute-*-calibration.mjs` / `compute-*-recount.mjs` (this session's precedent check confirms all three calibration artifacts live at `.planning/phases/{N}-{slug}/{N}-CALIBRATION.md` — no milestone-root placement).

### Deferred Ideas (OUT OF SCOPE)

- Whether the near-miss sweep (D-06) justifies a tolerance-based adjacency rule — revisit only if the measured count is material.
- A reliable over-measurement-vs-jump discriminator (would need lat/lng or the 1 Hz speed channel) — belongs with the STREAM-05 re-derivation revisit; D-12's validation output is its first evidence.
- Garmin export adapter todo — unrelated, externally blocked (STREAM-04).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEG-01 | Detector identifies segments from `t`/`d` alone, judges maximal advancing runs by aggregate speed (not single samples) | `advanceIntervals`/`computeFlatRunDurations` idiom documented in Code Context; Pitfall 1/3 dilution evidence measured this session (probe4) |
| SEG-02 | Gap-adjacent burst merging conserves real distance/elapsed time; `3475724402` leaves no burst unmerged; independent per-segment table | D-15 gap-first algorithm design + zero-import structural-assertion pattern (from `compute-pr-ceiling-recount.test.mjs`), both documented below |
| SEG-03 | Hidden-pause (`3475734189`) and isolated-jump (`3475740390`) mechanisms detected and labelled from `t`/`d` alone | D-08/D-09 metres-boundary probes (this session, no clean valley found — documented) |
| SEG-04 | Calibrated speed limit + adjacency rule in a committed artifact with non-circularity argument + Suunto disposition | D-02 Suunto identification (this session, conclusive); D-10/D-13 calibration-statistic probes (this session) |
| SEG-05a | Single-source audit extended to the detector, catching a planted second implementation | `pace-single-source.test.ts` read in full — two historical blind spots and planted-violation pattern documented below |
</phase_requirements>

## Project Constraints

No `./CLAUDE.md` exists in this repo — no project-specific directive file to enforce. No `.claude/skills/` or `.agents/skills/` directory exists either — no project skills to load. The project's own conventions (standing conventions paragraph in REQUIREMENTS.md, PROJECT.md Key Decisions table) are treated as load-bearing throughout this document instead.

## Architectural Responsibility Map

This project has no traditional multi-tier web architecture (no server-rendered frontend, no live API backend) — it is a static-JSON pipeline computed by CI and served as a static SPA. Tiers below are the project's own analogues.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unreliable-segment detection (SEG-01/02/03) | CI Compute (pure TS module, `src/analytics/`) | — | Must run in CI from committed `t`/`d`; no `lat/lng`, no `export_data/` access at this tier |
| Calibration artifact generation (SEG-04) | CI Compute / Local dev script (`scripts/compute-*-calibration.mjs`) | Committed doc (`.planning/phases/32-.../32-CALIBRATION.md`) | Generator imports the detector (permitted — its job is to calibrate it); output is a committed, regenerable markdown/JSON artifact, not runtime code |
| Independent per-segment recount (SEG-02, D-15) | CI Compute / Local dev script (`scripts/compute-*-recount.mjs`) | — | Zero-import structural constraint — must never import the detector; reads raw `t`/`d` only |
| Single-source audit extension (SEG-05a) | Test tier (`vitest`, `src/analytics/*.test.ts`) | — | Structural source-tree scan, same tier as the existing `pace-single-source.test.ts` |
| 1 Hz FIT validation (D-12) | Local-only script (`scripts/`, gitignored `export_data/` input) | — | Explicitly NOT CI/`npm test` — no tier above local developer machine may touch it |
| `data/streams/` immutability gate (D-17) | Test tier (`vitest`, CI-run) | Committed manifest (`data/*.json`) | Runs every `npm test` invocation, must not misclassify `data/streams/manifest.json` (a different artifact) as a pinned stream |

**Not this phase (Phase 33's tier, noted so the planner does not accidentally pull it forward):** `pace-derivation.ts`/`classifyGaps` wiring (CI Compute, `src/analytics/pace-derivation.ts`), any Dashboard/Browser-tier rendering of segments (SEG-06's badge).

## Standard Stack

No new core technology and zero new `package.json` entries — confirmed via `npm ls`: `@garmin/fitsdk@21.212.0`, `vitest@4.0.18`, `chart.js@4.5.1`, `chartjs-plugin-zoom@2.2.0`, all already installed and exercised in this session (the FIT decode used the exact `Decoder`/`Stream.fromBuffer` pattern already documented in `src/exports/geometry-readers.ts`). `research/STACK.md`'s conclusion holds without qualification: this phase's math (median, run-merging, aggregate implied speed) extends `quantile()`/`advanceIntervals()`/the `classifyGaps` run-walk idiom, all hand-rolled, all already in `pace-derivation.ts`. `[CITED: research/STACK.md]`

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Detector module, calibration types | Every prior milestone's convention |
| Node.js | 25.2.1 local / 22 CI | Runtime for compute scripts | Confirmed via `node --version` this session `[VERIFIED: local npm ls / node --version]` |
| vitest | ^4.0.18 | Unit tests, planted-violation fixtures, immutability gate | Confirmed installed; `vitest.config.ts` already collects `scripts/**/*.test.mjs` (load-bearing for D-12, see Pitfalls) `[VERIFIED: local read of vitest.config.ts]` |
| `@garmin/fitsdk` | 21.212.0 (installed) | D-12's local-only 1 Hz validation script only | Already used this session to decode `4868274524.fit.gz` successfully — `Decoder`/`Stream.fromBuffer` confirmed working end-to-end `[VERIFIED: ran this session]` |

### Supporting

None — `research/STACK.md`'s rejection of `simple-statistics`/`d3-array`/`mathjs`/`turf.js`/`geolib`/any anomaly-detection package stands unchanged; nothing in this phase's scope needs a capability those research findings didn't already evaluate and reject.

### Alternatives Considered

No new alternatives surfaced this session beyond `research/STACK.md`'s existing table.

**Installation:**
```bash
# Nothing to install.
```

**Version verification:** confirmed this session via `npm ls @garmin/fitsdk vitest chart.js` — all match `research/STACK.md`'s stated versions exactly, no drift since 2026-09-19's research pass (same day).

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. `research/STACK.md` and this session's own `npm ls` both confirm no new `package.json` entries are needed. Skip the slopcheck gate.

## Architecture Patterns

### Correction to `research/ARCHITECTURE.md`: Phase 32 does NOT wire into `classifyGaps`

`research/ARCHITECTURE.md`'s "Pattern 1: Third `GapKind`, not a parallel segment list" describes a two-pass-plus-merge design where `unreliable-segments.ts`'s detector is called from *inside* `classifyGaps`, `GapKind` gains a third member, and `PaceCoverage` gains `unreliableSec` — all in the same phase. **CONTEXT.md's Phase Boundary explicitly excludes this from Phase 32**: "Not in this phase: wiring into `classifyGaps` / a fourth `GapKind` / coverage identity (Phase 33)." ROADMAP.md's own Phase 33 goal confirms this sequencing ("The detector's output is wired into `classifyGaps` as a fourth `GapKind`... Depends on: Phase 32"). The planner must build Phase 32 to Pattern 1's *shape* (so Phase 33 can fold it in without a rewrite) but must not perform the fold itself. This also means `PaceCoverage`, `GapKind`, `GapInterval` are all **unchanged** by Phase 32 — do not add `unreliableSec` or a third `GapKind` member this phase.

### System Diagram (Phase 32's actual scope)

```
data/streams/{id}.json (t, d)
        │
        ▼
src/analytics/unreliable-segments.ts   (NEW, standalone — no import of
  │                                      pace-derivation.ts, no import
  │  detectUnreliableSegments(t, d,      BY pace-derivation.ts yet)
  │    calibration?) → UnreliableSegment[]
  │
  ├──► scripts/compute-unreliable-segment-calibration.mjs  (imports the
  │      detector — its job — derives + writes 32-CALIBRATION.md)
  │
  ├──► scripts/compute-unreliable-segment-recount.mjs  (NEVER imports the
  │      detector — gap-first algorithm, own arithmetic, table for
  │      3475724402, fails closed on malformed input)
  │
  └──► src/analytics/pace-single-source.test.ts  (EXTENDED — new banned
         literal(s)/structural check(s) confining the detector's raw
         arithmetic to unreliable-segments.ts + *.test.ts; planted-violation
         describe block added, mirroring the existing two)

data/streams/*.json (all files)
        │
        ▼
[NEW] streams-immutability test (vitest) — sha256 manifest, D-17
```

No arrow from `unreliable-segments.ts` into `pace-derivation.ts`, `pace-quality.ts`, or `compute-best-efforts.ts` this phase — that is Phase 33/34/36's job (SEG-05b).

### Recommended Project Structure

```
src/analytics/
├── unreliable-segments.ts       # NEW — pure detector + calibration constants,
│                                 #   exported types (UnreliableSegment, SegmentMechanism)
├── unreliable-segments.test.ts  # NEW — unit tests, fixtures from the three
│                                 #   scoping activities + D-05's negative controls
├── pace-single-source.test.ts   # MODIFIED — new banned literal(s) confining the
│                                 #   detector's raw arithmetic; new planted-violation
│                                 #   describe block (mirrors the existing two)
├── pace-derivation.ts           # UNCHANGED this phase (Phase 33's job)
└── best-effort-utils.ts         # UNCHANGED — only `validateStreamSeries` is reused

scripts/
├── compute-unreliable-segment-calibration.mjs   # NEW — imports the detector (permitted),
│                                                  #   writes 32-CALIBRATION.md, idempotent
├── compute-unreliable-segment-calibration.test.mjs
├── compute-unreliable-segment-recount.mjs        # NEW — NEVER imports the detector,
│                                                  #   gap-first, table for 3475724402
├── compute-unreliable-segment-recount.test.mjs   # includes the zero-import structural
│                                                  #   guard (mirrors compute-pr-ceiling-
│                                                  #   recount.test.mjs's pattern exactly)
└── validate-unreliable-segments-1hz.mjs          # NEW, D-12 — local-only, reads
                                                    #   export_data/, no .test.mjs sibling
                                                    #   (vitest.config.ts collects
                                                    #   scripts/**/*.test.mjs — see Pitfalls)

.planning/phases/32-unreliable-segment-detection-calibration/
└── 32-CALIBRATION.md            # NEW — committed artifact of record

data/ (or a new sibling location — Claude's Discretion, D-17)
└── {location TBD}                # NEW — sha256-per-stream-file manifest, NOT inside
                                    #   data/streams/ (collision risk — see D-17 section)
```

### Pattern: Maximal advancing-run scoring (SEG-01)

**What:** `computeFlatRunDurations` (`pace-derivation.ts:151-166`) is the idiom to mirror, NOT reuse — it is a private (unexported) function that groups **flat** (non-advancing, `d[i+1] <= d[i]`) runs. The detector needs the mirror-image: group **advancing** runs and score each by aggregate `Σd/Σt`, not any single sample. `computeFlatRunDurations` cannot be imported (not exported) and should not be exported for this purpose either — the detector's own run-grouping walk belongs entirely inside `unreliable-segments.ts` per the containment discipline `pace-single-source.test.ts`'s docblock states twice.

**Verified pitfall (measured this session, probe4):** a naive "maximal run of samples above a low seed floor, extended while speed stays above a lower continuation floor" (mirroring `classifyGaps`'s own kind-extension idiom) produced **47 false "sustained fast" candidates at 18–24 m/s for 15–40+ seconds** when the seed floor was set to 6-7 m/s with no upper sanity bound — every single one, on inspection, was either device noise (the same `5059213289`/`3647739864`/`5059204779` cohort already flagged by the crude 7 m/s sweep) or, in the single most instructive case, **the Suunto activity itself** (`4556693525`, a second, separate 80-second span at 7.15 m/s with HR 133–140 — a resting/easy HR, physiologically inconsistent with a 2:20/km pace, i.e. a SECOND over-measurement region in the same file, not a genuine sustained run). This is the exact archive-native fixture Pitfall 3 asks for — a run-scoring test must not merely find *a* threshold that flags the three scoping activities; it must also NOT flag D-05's fixtures while still catching sustained noise like this.

### Pattern: Gap-first independent recount (D-15)

**What:** The detector (whatever internal algorithm the planner chooses) is expected to be *run-first*: find advancing/fast runs, then check gap adjacency. D-15's recount must be structurally different — **gap-first**: for each of `3475724402`'s 18 `classifyGaps`-identified gap/pause intervals (recompute `classifyGaps` fresh, or re-derive gap boundaries independently — either is fine since `classifyGaps` is not the thing being audited, only the detector is), walk backward from the gap's start sample and forward from its end sample, accumulating consecutive "fast" samples (own simple per-sample or per-short-window speed test) on each side until the run stops, then sum burst+gap distance/time for that merged segment. This produces the same headline totals via a different code path and a different traversal order — the exact mirror-image the "two artifacts sharing a blind spot" lesson (Pitfall 11) exists to break.

**Zero-import structural assertion — copy this pattern exactly** (verified working, `scripts/compute-pr-ceiling-recount.test.mjs:15-90`):
```javascript
// scripts/compute-unreliable-segment-recount.test.mjs (shape, not literal code)
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

const FORBIDDEN_MODULE_NAMES = ['unreliable-segments', /* any other detector-adjacent module */];

describe('zero-import guard (D-15)', () => {
  it('the stripper actually removes a line naming a forbidden module', () => { /* sanity check on a fixture */ });
  it('compute-unreliable-segment-recount.mjs contains none of the forbidden module names once comments are stripped', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden); // sanity: header docblock legitimately names it
      expect(stripped).not.toContain(forbidden); // stripped source does not
    }
  });
});
```
Source: `scripts/compute-pr-ceiling-recount.test.mjs` lines 15-90 (read in full this session). `[VERIFIED: local read]`

### Pattern: Single-source audit extension (SEG-05a)

`src/analytics/pace-single-source.test.ts` (read in full this session) has TWO documented, historically-real blind spots the docblock names explicitly:

1. **Arithmetic-shaped ban misses non-arithmetic re-implementation.** The real `detail-zones.ts` `maskedPaceSeries` violation (commit `f32dddd8`) had NO `dt/dd`-shaped division at all — it re-implemented `paceHistogramSamples`'s own gap-interval MEMBERSHIP TEST (`gapIntervals.some((g) => ...)`) with zero arithmetic. Closed by adding `GAP_MEMBERSHIP_LITERALS = ['gapIntervals.some(', 'gapIntervals.find(']` as a second, confined-call-site scan alongside the arithmetic-literal scan.
2. **A literal scan misses a formatting variant.** The `windowSec:` scan missed ES2015 object-shorthand (`{ windowSec, gapIntervals }`). Closed by adding `'windowSec,'`/`'windowSec }'` plus the structurally load-bearing `'derivePaceSeriesGapAware('` call-site literal (catches ANY call regardless of how the options object is formatted).

**What "second implementation" means for the detector (Claude's Discretion, bound by these two lessons):** at minimum, ban (a) the detector's own core arithmetic literal(s) — e.g. whatever exact `Σd / Σt` or per-pair `dd / dt` expression the implementation settles on, confined to `unreliable-segments.ts` + `*.test.ts`; and (b) a structural, non-arithmetic re-implementation shape analogous to lesson 1 — e.g. a second place computing "is this run's aggregate speed above the calibrated limit" via ad hoc inline logic rather than calling the exported detector. Since Phase 32 has zero downstream consumers, the practical shape of a "second implementation" this phase is a **planted probe file** (mirroring `pace-single-source.test.ts`'s own permanent in-suite planted-fixture describe block, lines 367-453) rather than a real historical incident — the audit is proven catching a *hypothetical* future violation, which is exactly SEG-05a's own wording ("shown catching a planted second implementation").

**Demonstrated-catching proof shape to copy verbatim** (`pace-single-source.test.ts:367-453`, read in full):
```typescript
describe('SEG-05a — the audit is demonstrated catching a reintroduced second implementation (planted, permanent)', () => {
  it('names the exact planted file path and the exact planted literal', () => {
    const plantedFiles = [{
      path: 'src/dashboard/views/planted-second-unreliable-segment-impl.ts',
      source: [/* a synthetic re-implementation of the detector's core check */].join('\n'),
    }];
    const violations = findUnreliableSegmentViolations(plantedFiles); // new sibling scanner
    expect(violations).toEqual([{ path: '...', needle: '...', count: 1 }]);
  });
  it('with the literal removed, the same planted file produces no violation (fails in both directions)', () => { /* ... */ });
});
```
Per D-14, both the in-suite planted block AND a one-off planted probe file run against the real tree (captured verbatim in the plan's SUMMARY.md, then deleted, `git status --porcelain src` confirmed clean afterward) are required — mirroring `pace-single-source.test.ts`'s own docblock, which distinguishes the permanent in-suite proof from the one-off real-tree proof explicitly.

### Anti-Pattern: Building Pattern 1's full `classifyGaps` fold this phase

Covered above — this is the single most consequential scope-correction in this document. A planner who follows `research/ARCHITECTURE.md` literally will over-build Phase 32.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile/median for the calibration statistic | A third percentile implementation | `quantile()` (`pace-derivation.ts:100`, R-7 interpolation) or `percentileNearestRank()` (`best-effort-ceiling.ts:81`, nearest-rank) — pick one, cite it | Project deliberately maintains exactly two, by name, for calibration-load-bearing reasons (`research/STACK.md`) |
| Per-sample "is this too fast" gate | A duplicate of `countImpossibleSamples` (`pace-quality.ts:1001`) | A NEW, separate signal — `countImpossibleSamples` uses `WORLD_RECORD_100M_SPEED_MPS` (10.44 m/s) as a PER-SAMPLE floor; it structurally cannot catch a diluted multi-sample slew that stays under 10.44 m/s per sample while carrying excess aggregate distance (Pitfall 3's exact failure mode) | Confirmed by reading `pace-quality.ts:1001-1057` this session — different denominator, different question, not a duplicate to reconcile away |
| Zero-import recount discipline | A bespoke ad hoc "don't import X" comment with no test | The exact `stripComments` + `FORBIDDEN_MODULE_NAMES` + raw-source-sanity-check pattern from `compute-pr-ceiling-recount.test.mjs` | Already proven, already has a "the stripper actually works" self-test guarding against the self-invalidating-grep trap |
| Stream-file glob for D-17's manifest | A naive `fs.readdirSync('data/streams').filter(f => f.endsWith('.json'))` | An explicit `isStreamFile()`-style exclusion of `manifest.json` | This exact glob mistake is a REAL, already-fixed defect in this repo twice (Phase 27 G-01, closed by plan 27-11's `isStreamFile()`; Phase 27 G-03, the identical bug in `compute-pace-residual.mjs`) |

**Key insight:** every "don't hand-roll" item above traces to a documented, already-paid-for lesson in this exact codebase — none is a generic best-practice appeal.

## Runtime State Inventory

Not applicable — Phase 32 is a greenfield addition (a new module, a new script, an extended test file, a new committed manifest). No rename/refactor/migration is in scope.

## D-02: The Suunto activity, identified and measured

**Method (this session):** Cross-referenced `data/activities/*.json` for `device_name === "Suunto 9"` (205 activities), scanned each committed stream for samples with implied speed in the 15–20 m/s band during an altitude-decreasing (descent) span, ranked by altitude drop. Top hit: `4556693525` (Suunto 9, altitude drop 10.2 m around the candidate sample — the largest in the whole 205-activity cohort by a wide margin). Cross-checked against the Strava CSV export (`export_data/strava/activities.csv`): `Max Speed = 16.4`, `Elevation Low = -282.0` — the latter is an EXACT match to `STREAM-08`'s already-documented "-282 m altitude readings" finding, which independently confirms the same activity. `[VERIFIED: local file read + computation]`

**FIT decode confirmation (this session, `@garmin/fitsdk`):** decoded `export_data/strava/activities/4868274524.fit.gz` (the Strava-CSV-mapped original for `4556693525`). 3,359 raw records; **position present in exactly 1,724 (51.3%)** — an exact match to the milestone's quoted "position exists in only 51.3% of that file's records." This is conclusive. `[VERIFIED: ran @garmin/fitsdk Decoder this session]`

**The "17 m/s" figure does not reproduce exactly (Assumption A1):** a plain per-sample `dd/dt` scan of the raw 1 Hz FIT found the file's single fastest sample-to-sample speed is **36.0 m/s** (record 271, 2021-01-02T08:05:26→27Z, distance 962→998 m, altitude -113.6→-115 m, both samples carry a GPS position ~14 m apart per haversine — i.e. NOT "GPS geometry says 0 m" for this specific pair). A broader scan for `dd` in [14,20] m over `dt=1 s` with near-zero geodesic displacement between position-carrying neighbours found two much smaller candidates (14 m/s-class, ~3.2–3.6 m geodesic displacement) elsewhere in the file, neither matching "17 m/s" exactly either. **This is a probe finding, not a locked fact**: either (a) the original "17 m/s" figure was computed by a different method (e.g. the device's own `speed` field, which shows 14.92→18.04→18.68→16.94 m/s across records 271-274 — 17-ish is plausible as an eyeballed average of that run), or (b) it refers to a moment this session's specific scan parameters didn't isolate. The planner does not need to resolve this discrepancy to close the phase — D-02 only requires identifying the activity and reporting the committed-stream shape, both done — but the calibration artifact should NOT re-quote "17 m/s" as a precise, re-derived figure; it should cite the measured committed-stream numbers below instead.

**Committed (decimated) stream shape — this is D-02's actual deliverable:** `data/streams/4556693525.json` has 1,682 samples (raw FIT had 3,359 — roughly 2:1 decimation). The burst is NOT collapsed into a single diluted sample; it spans two decimated pairs:
| Index | t | d | dt | dd | implied speed |
|---|---|---|---|---|---|
| 135→136 | 271→273 | 962→998 | 2 s | 36 m | **18.0 m/s** |
| 136→137 | 273→275 | 998→1040 | 2 s | 42 m | **21.0 m/s** |

Both exceed the range of all five isolated jumps on `3475740390` (10.0–14.3 m/s) and sit within the measured genuine-slew range on `3475724402` (8.6–27.9 m/s, this session's own re-measurement — see D-08 section). **The disposition is unambiguous: any speed-limit rule set low enough to catch the three scoping activities' bursts will also catch this burst on the committed stream.** D-01's decision holds, more strongly than the pre-measurement "17 m/s" figure suggested.

**Context worth flagging (not required by D-02, surfaced because it bears on D-13's insensitivity check):** the same activity's stream shows a SECOND, separate ~80-second span (t=239-319, HR 133-140, cadence 176-178) at an aggregate 7.15 m/s with a resting-adjacent heart rate — almost certainly another descent-triggered over-measurement region in the same file, not a genuine sustained run. If the calibration population for D-10 includes this activity's "bulk" speeds naively, it will include this second contaminated span too — worth an explicit exclusion note in the calibration artifact (which activity, which span, why) rather than a silent inclusion.

## D-05: Negative-control fixtures — fastest corroborated-genuine running

**Method (this session):** Archive-wide scan (all 1,873 streams) for maximal runs where consecutive per-sample speed stays ≥3.5 m/s, seeded at ≥4 m/s, sustained ≥20 s, aggregate speed in [4.5, 7.2] m/s, excluding runs touching the stream's own first/last 60 s (GPS-lock noise) and excluding runs that touch a >10 s recording-gap on either boundary. 343 candidates found; top result was `4556693525` itself (the Suunto activity — excluded, see D-02 finding above, HR 133-140 too low for the implied pace). After excluding that and other low-HR/low-cadence outliers, three fēnix-6-Pro-recorded candidates stand out with corroborating HR trend and cadence:

| Activity | Device | Span | Duration | Aggregate speed | HR range | Cadence range | Gap-touching? |
|---|---|---|---|---|---|---|---|
| `16628769295` | Garmin fēnix 6 Pro | t=1023–1056 | 33 s | **6.05 m/s** | 155→161 (rising) | 181–185 | No (boundary dt 1 s / 2 s) |
| `7409028052` | Garmin fēnix 6 Pro | t=591–624 | 33 s | **6.03 m/s** | 144–148 | 179–185 | No (boundary dt 5 s / 8 s) |
| `8869338724` | Garmin fēnix 6 Pro | t=3002–3026 | 24 s | **6.27 m/s** | 155–159 | 165–171 | No (boundary dt 1 s / 2 s) |

`[VERIFIED: local computation this session against data/streams/ and data/activities/]` — activity dates/names/device confirmed via `data/activities/{id}.json`.

**Headroom to the slowest named jump (10.0 m/s, on `3475740390`):** 3.73–3.97 m/s, i.e. the fastest corroborated-genuine fixture (`8869338724` at 6.27 m/s) sits **37% below** the slowest jump. This is a real, measured gap but noticeably smaller than the pre-measurement "Suunto 17 m/s vs jumps ~10-14 m/s" framing implied — the true genuine-fast ceiling in this personal recreational archive is much lower than an elite-adjacent 17 m/s. Report this honestly in the calibration artifact rather than implying a wider margin exists.

**Why the archive's OTHER 47 "sustained fast" candidates (18–24 m/s, ≥15 s) do NOT qualify:** every one of those (e.g. `3475725842` at 23.7 m/s/39 s, `3475735637` at 21.9 m/s/21 s — activity-ID range `3475xxxxxx`, the same range as the three scoping activities and known-noisy `5059204779`/`3647739864`) is almost certainly device/decimation noise, not genuine running — 20+ m/s sustained for tens of seconds is a bicycle- or vehicle-adjacent speed, physiologically implausible for the archive's own recorded activities (all typed `Run`). **Do not accidentally pick from this list when sourcing D-05 fixtures** — it is exactly the trap Pitfall 12 describes (a look-alike candidate that "detects >X m/s" but doesn't discriminate the real phenomenon).

**Not yet locked:** these three IDs are this session's research proposal, not a CONTEXT.md-locked decision (D-05 explicitly delegates the final pick to research/planning). Confirm with the developer before pinning as permanent regression fixtures, per the standing "no look-alike fixtures" convention.

## D-08: Hidden-pause vs isolated-jump metres boundary — no clean valley found

**Method (this session):** Archive-wide scan for "no-gap bursts" (maximal runs of consecutive samples with per-sample speed ≥7 m/s — the same uncalibrated floor as the crude scoping sweep — that do NOT touch a >10 s recording-gap on either boundary), histogrammed by total distance carried in 25 m buckets.

| Bucket (m) | Count | Bucket (m) | Count |
|---|---|---|---|
| [0,25) | 5,967 | [150,175) | 49 |
| [25,50) | 764 | [175,200) | 24 |
| [50,75) | 168 | [200,225) | 19 |
| [75,100) | 69 | [225,250) | 19 |
| [100,125) | 56 | [250,275) | 11 |
| [125,150) | 45 | [275,300) | 14 |

`[VERIFIED: local computation this session, probe4]` — 7,262 total no-gap bursts at this uncalibrated floor; this is a probe figure at a floor that will not survive calibration, reported only to characterize the shape of the distribution.

**Finding: the histogram decays smoothly with no distinct dip/valley separating a "jump" cluster (25-52 m, per the three scoping activities) from a "hidden-pause" cluster (~199 m).** There is a mild local bump at 150-175 m but nothing resembling a bimodal split with a clean trough. This directly matches D-08's own stated contingency: **"If that distribution shows no clean valley, the artifact says so and the label is recorded as a best-effort description, not a verified cause."** The planner should write the calibration artifact expecting to invoke this contingency, not expecting to find and cite a specific metres cutoff as a discovered natural boundary. A reasonable fallback (Claude's Discretion) is a single, disclosed threshold (e.g. informed by the two named anchors — jumps top out at 52 m, the hidden pause is 199 m — placing a boundary near the midpoint or at a round-ish figure like 100 m) with the artifact explicitly stating it is a description, not a discovered discriminator.

## D-09: Excess-metres significance floor — anchor points confirmed

Both cited anchors reproduce exactly on the committed streams this session:
- `3475740390`, t=2587→2589: `d` goes 7693.8→7718.5, **Δ=24.7 m over 2 s (12.35 m/s)** — must be ADMITTED (not filtered out as insignificant).
- `3475734189`, t=1581→1583: `d` goes 4531.0→4548.3, **Δ=17.3 m over 2 s (8.65 m/s)** — must be EXCLUDED as insignificant (this segment is likely below whatever speed-limit threshold is finally chosen anyway, at 8.65 m/s, so the "excess metres beyond what the limit allows" framing may make this case moot if the speed-limit gate alone already excludes it — worth checking in planning whether D-09's floor is even reachable/needed for a segment that a correctly-calibrated speed gate wouldn't flag as a candidate in the first place).

`[VERIFIED: local computation this session]`

## D-10 / D-13: Speed-limit calibration statistic — probe figures only

**These are throwaway probe figures to reconcile against, NOT expected values** — per CONTEXT.md's own explicit warning that the roadmapper has pinned probe figures as expected values before on this milestone.

**Method:** For every activity with ≥20 advancing samples (1,873 of 1,873 scanned), computed that activity's OWN p95 and p99 of per-sample advancing speed (`dd/dt` where `dd>0`), then built the ARCHIVE-WIDE distribution of those 1,873 per-activity p95/p99 values (a "bulk of the bulk" statistic, structurally two levels removed from any single activity's own outlier tail — this is the shape D-10 constraint (a) asks for: set by the bulk, not moved by a few hundred slews).

| Percentile of archive | per-activity p95 distribution | per-activity p99 distribution |
|---|---|---|
| p50 | 3.75 m/s | 4.48 m/s |
| p75 | 4.20 m/s | 5.19 m/s |
| **p90** | **5.97 m/s** | **7.00 m/s** |
| p95 | 6.50 m/s | 7.00 m/s |
| p99 | 6.50 m/s | 9.47 m/s |
| p99.9 | 122.7 m/s | 155.7 m/s |

`[VERIFIED: local computation this session, probe3]` — note the sharp jump from p99 to p99.9 in both columns: the "bulk" (up to p99) is tightly clustered under ~10 m/s; the contaminated tail (decimation noise + genuine slews) starts abruptly above it. This gap is itself useful evidence for D-11 (disjointness from decimation) and D-13 (a bulk statistic taken below p99 is structurally insulated from the tail it needs to judge).

**A candidate statistic meeting D-10's five constraints (probe only, not a recommendation to lock):** `K × p90(archive-wide distribution of per-activity p95(advancing speed))` = `K × 5.97`. For this to land between the D-05 genuine-fast ceiling (6.27 m/s) and the slowest named jump (10.0 m/s) with headroom on both sides, `K` would need to be roughly 1.3–1.6 (giving ~7.8–9.6 m/s) — structurally the same shape as `CEILING_K` (a measured max/p90-style ratio, not a round number), but this session did NOT identify a principled, measured value for `K` the way `CEILING_K` was derived from "the largest observed max/p90 ratio among mechanism-clean distances" — that requires first defining a "mechanism-clean" cohort for THIS calibration, which is exactly D-11/D-13's job and is properly a planning-time, not research-time, derivation (constraint (b): never a tail percentile of the judged population — using this archive's own p99.9 as an anchor would violate that constraint directly). **Flag as an open calibration question for the plan to resolve**, not a locked number.

**D-13 insensitivity check, sketched:** (1) compute the candidate statistic on the full archive; (2) remove every currently-flagged segment's contribution from the per-activity speed arrays and recompute — the statistic should not move materially; (3) separately, plant a synthetic batch of extra slew-shaped bursts (reusing real archive shapes, e.g. cloned from `3475724402`'s own measured bursts, per the anti-look-alike convention) into a copy of the population and recompute — again, should not move materially; (4) watched-failing-first proof: run the SAME two checks against a deliberately circular statistic (e.g. `quantile(allSpeeds, 0.999)` — a tail percentile of the very population containing the slews) and confirm IT moves materially under (2)/(3), establishing that the check can actually fail before trusting it on the real candidate.

## D-11: Overlap with the decimation-severe cohort

**The function/artifact:** `decimationSignal(t, d)` in `src/analytics/pace-quality.ts:792-820` — `tier: 'severe'` when `zeroAdvanceFraction > DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION` (0.15) AND `sampleCount >= DECIMATION_SEVERE_MIN_SAMPLES` (50). This is the SAME 154-activity cohort rule committed in `26-RESIDUAL.md` and reproduced verbatim in `compute-pace-residual.mjs`'s `isSevereStairStep` — three places agree by construction (`pace-quality.ts:745-752`'s own docblock states this). The shipped per-activity value is `quality.decimation.tier` in `data/dashboard/index.json`. `[VERIFIED: local read this session]`

**How to measure the overlap:** for every activity the new detector flags (has ≥1 unreliable segment), read that activity's `quality.decimation.tier` from `data/dashboard/index.json` (or recompute `decimationSignal(t,d)` directly from the stream — either is fine since neither is the thing being audited) and report `(flagged ∩ severe) / flagged` and `(flagged ∩ severe) / severe`. Follow `compute-elevation-recount.mjs`'s inclusion-exclusion-style reporting convention (though for a single pair, not three-way overlap, the arithmetic is simpler — just a straight intersection count with both denominators reported, per that script's own `formatPct` idiom).

## D-14 / SEG-05a: The audit to extend — precise blind-spot mechanics

Covered in detail under Architecture Patterns above. Summary of the two blind spots for quick reference:
1. **Non-arithmetic structural re-implementation** (real incident, commit `f32dddd8`) — closed by confining specific non-arithmetic call-site literals (`gapIntervals.some(`, `.find(`), not just banning arithmetic expressions.
2. **Formatting-sensitive literal scan** (real incident, CR-03) — closed by adding shorthand-form literals AND a structurally load-bearing call-site literal (`derivePaceSeriesGapAware(`) that doesn't depend on how the call is formatted.

For the detector, the structurally load-bearing equivalent of `derivePaceSeriesGapAware(` is likely the exported detector function's own name (e.g. `detectUnreliableSegments(`) — banning direct calls to it from outside `unreliable-segments.ts`/`*.test.ts` is NOT the goal (callers are expected to call it once wired in later phases) — rather, the goal is banning a **second definition/reimplementation of the same logic**, which is a different shape of scan (banning the internal arithmetic/structural literals, not the public call site). Get this distinction right in planning: SEG-05a bans a second IMPLEMENTATION, not a second CALLER (there are zero callers this phase anyway).

## D-15: Gap-first recount algorithm — full design

Covered under Architecture Patterns above (design + zero-import structural assertion code pattern, copied verbatim from a working, currently-tested script). Additional detail: `compute-pr-ceiling-recount.mjs` and `compute-elevation-recount.mjs` both follow a `main()`-behind-a-self-execution-guard shape (`if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }`) so their pure functions can be imported by a sibling `.test.mjs` without triggering a real file read as an import-time side effect — copy this shape for `compute-unreliable-segment-recount.mjs` too. The "fails closed on malformed input" requirement (D-15) mirrors `compute-elevation-recount.mjs`'s `readShippedIndex`/`recountElevation` pattern: never throw, return `{ ok: false, reason }` or push into a `problems`/`findings` array, exit non-zero on any problem, always print WHY.

## D-17: Stream-immutability manifest — collision risk confirmed real

**`data/streams/manifest.json` ALREADY EXISTS** — confirmed this session (`schemaVersion: 1`, `generated_at`, `totals: { activities: 1899, with_streams: 1874, without_streams: 25, ... }`). It is a **stream-availability index**, written by both `backfill-streams` and the daily intervals.icu sync, and it legitimately changes on every sync (new `generated_at`, new totals as the archive grows). `[VERIFIED: local read this session]`

**This is the exact shape of the Phase 27 G-01/G-03 defect** (a naive `data/streams/*.json` glob counting `manifest.json` as if it were a stream file), already found and fixed twice in this codebase (`isStreamFile()` exclusion in `compute-pace-quality-calibration.mjs`, then again in `compute-pace-residual.mjs`). **D-17's new byte-identity manifest MUST NOT repeat this mistake in either direction:**
1. If the new manifest lists `data/streams/manifest.json` itself as a pinned file, the gate will fail on every legitimate nightly sync (false positive, guaranteed).
2. If the new manifest's own generator globs `data/streams/*.json` without excluding the existing `manifest.json`, it will hash a file whose content is EXPECTED to change and immediately produce a spurious "byte-identity violated" failure.

**Recommended design (Claude's Discretion, D-17):**
- **Location:** a NEW file, sibling to `data/streams/`, not inside it — e.g. `data/streams-checksum-manifest.json` or `data/stream-checksums.json` — avoids any possibility of the manifest hashing itself and avoids any glob confusion with the existing availability index. (An alternative — placing it inside `data/streams/` but excluding both itself and `manifest.json` by an explicit `isStreamFile()`-style check — also works but repeats a pattern this project has twice had to retrofit rather than design in from the start; prefer the sibling location.)
- **Format:** `{ schemaVersion, generatedAt, files: { "<id>.json": "<sha256>", ... } }` — same shape family as every other artifact in `data/`.
- **Tolerating new files:** the vitest gate iterates the manifest's OWN `files` keys and re-hashes each one, comparing digest — it does NOT iterate the live `data/streams/` directory. A brand-new stream file that isn't yet a key in the manifest is invisible to the gate (not a violation) until a regeneration step adds it. This is the simplest correct shape for "tolerates new files" and requires no allowlist/exclusion logic at check time.
- **The check, watched failing first:** plant a one-byte edit to any listed `data/streams/{id}.json`, run the vitest gate, confirm it reports the specific file and a digest mismatch, then `git checkout -- data/streams/{id}.json` and confirm `git status --porcelain data/streams` is clean and the gate passes again.
- **Live stream count for D-16's denominator:** confirmed this session — **1,874 live stream files** (`data/streams/*.json` excluding `manifest.json`) out of 1,899 total activities. This is TODAY's figure (probe, will drift) — the artifact must read it live via `fs.readdirSync` at generation time, never hard-code it (D-16's own requirement, and this is precisely the "denominator is a live stream count" the specifics section calls out).

## D-12: Local-only 1 Hz validation — `export_data/` confirmed present and workable

`export_data/strava/activities/*.fit.gz` (1,873 files, ~123 MB total, gitignored) is present and readable in this environment; `export_data/strava/activities.csv` maps canonical activity IDs to FIT filenames (column `Filename`, e.g. `4556693525` → `activities/4868274524.fit.gz`) — this mapping was used successfully this session and should be the join key the local-only validation script uses (no other committed provenance file provides a complete ID→filename map; `data/provenance.json` is a summary/counts document, not a per-activity index). `[VERIFIED: ran this session]`

**Critical, previously-undocumented constraint for D-12: `vitest.config.ts` collects `scripts/**/*.test.mjs`.** Confirmed this session (`vitest.config.ts:15`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`). This means **any `.test.mjs` file colocated under `scripts/` automatically runs under `npm test`**, regardless of what the corresponding `.mjs` script does. D-12 requires the local-only validation script to never be wired into CI/`npm test` — the safest way to guarantee this is to **not create a `.test.mjs` sibling for the 1 Hz validation script at all** (unlike every other `compute-*.mjs` in `scripts/`, which does have a `.test.mjs`). If a plan does want unit coverage for the script's own pure logic (e.g. a haversine cross-check helper), that logic should be extracted into a plain, `export_data/`-independent pure function that a `.test.mjs` CAN exercise with synthetic fixtures — the file that actually does `readFileSync('export_data/...')` should remain untested-by-vitest and clearly commented as to why.

**Fallback pattern for graceful absence (mirrors an existing, working precedent):** `src/exports/consolidate.ts:138-144` already checks whether `export_data/` (or its subdirectories) exist/have content and prints `"Nothing to consolidate: no directories under export_data/."` rather than throwing, when the gitignored directory is absent (e.g. in CI). Any local-only script this phase adds should follow the identical shape: `existsSync` guard, informative log line, clean exit — never a thrown error — so that even an accidental CI invocation degrades gracefully instead of failing the pipeline.

## Common Pitfalls

### Pitfall: The archive's "sustained fast" cohort is mostly a decoy

**What goes wrong:** A naive archive sweep for "sustained fast running" (the shape D-05 asks for) returns dozens of 18-24 m/s candidates sustained for 15-40+ seconds. These look, superficially, like exactly what's needed — real activity IDs, sustained duration, no synthetic look-alike smell.

**Why it happens:** These candidates cluster in the same low-activity-ID range (`3475xxxxxx`, pre-2019 recordings) as the three scoping activities and the already-known-noisy `5059204779`/`3647739864` — the same device/recording-era population already flagged by the crude 7 m/s sweep, not a second population of genuinely fast athletes.

**How to avoid:** Cross-check every D-05 candidate against HR (should show real cardiovascular effort, not a resting-adjacent value) and cadence (should show a physiologically plausible sprint cadence, ~170-190 spm) where available, and sanity-check the implied pace against what's physically achievable for a recreational archive (>15 m/s sustained for >10s is bicycle-adjacent, not running-adjacent, for any but an elite sprinter, and this archive is a personal recreational-running collection).

**Warning signs:** A candidate list dominated by one narrow activity-ID range or one device family; a candidate whose HR is LOWER than what a genuinely easy jog would produce.

### Pitfall: `data/streams/manifest.json`'s existing purpose gets silently overloaded

**What goes wrong:** D-17's new immutability manifest and the pre-existing stream-availability manifest share a name collision risk (both plausibly "the stream manifest"). A planner unfamiliar with the pre-existing file could either overwrite its purpose or build a gate that globs it in as a pinned file.

**How to avoid:** Covered exhaustively in the D-17 section above — use a distinctly-named sibling file, never `data/streams/manifest.json` itself.

### Pitfall: Treating `research/ARCHITECTURE.md`'s Pattern 1 as this phase's spec

**What goes wrong:** Following the architecture research's code sketch (which modifies `GapKind`, `PaceCoverage`, `classifyGaps`) produces work that belongs to Phase 33, inflates this phase's scope, and risks a premature/wrong-shaped integration that Phase 33 then has to partially undo.

**How to avoid:** Covered under Architecture Patterns above — CONTEXT.md's Phase Boundary is the authoritative scope statement; research/ARCHITECTURE.md predates it and is superseded on this specific point.

### Pitfall: Re-citing "17 m/s" as an exact, re-derived figure

**What goes wrong:** The calibration artifact quotes "17 m/s" as if this session's independent measurement reproduced it exactly. It did not (see D-02 section — measured 18.0/21.0 m/s on the committed stream, 36.0 m/s peak on the raw 1 Hz file).

**How to avoid:** Cite the numbers this session actually measured on the committed stream (18.0 m/s and 21.0 m/s across the two decimated pairs) as the artifact's stated figures, note the "17 m/s" prose figure as the original (unreproduced-exactly) planning citation, and do not present the discrepancy as resolved.

## Code Examples

### Zero-import structural guard (D-15), full working precedent
```javascript
// Source: scripts/compute-pr-ceiling-recount.test.mjs (read in full this session)
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}
// FORBIDDEN_MODULE_NAMES named the classifier's own module names; the test both
// sanity-checks that the RAW source names them (in its own docblock) and asserts
// the STRIPPED source does not contain them as executable code.
```

### Never-throwing, always-explain recount verdict shape
```javascript
// Source: scripts/compute-elevation-recount.mjs (read in full this session)
export function evaluateReport(report, expected) {
  const problems = [...report.schemaFindings];
  if (report.missingElevationIds.length > 0) { problems.push(`...`); }
  // ... every failure mode appended as a human-readable string, never thrown
  return { pass: problems.length === 0, problems };
}
```

### Graceful `export_data/`-absence handling
```typescript
// Source: src/exports/consolidate.ts:138-144 (read this session)
const exportRoot = 'export_data';
// ... existsSync guard ...
if (/* no directories under export_data/ */) {
  console.log('Nothing to consolidate: no directories under export_data/.');
  // return cleanly, never throw
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Crude 7 m/s uncalibrated per-sample sweep (259/1,873, 121/1,873) | Calibrated run-level aggregate detector with an explicit non-circularity argument | This phase (SEG-04) | Replaces "establishes reach" figures with figures of record; every headline number gets a live-denominator, per-mechanism breakdown |
| "17 m/s Suunto sample, unflagged" (Pitfall 2, `research/SUMMARY.md`) | "Suunto sample, activity `4556693525`, flagged under its own mechanism label, disclosed not corrected" (D-01, D-03) | This session (CONTEXT.md discussion) + this research pass (activity ID identified) | Downstream phases must not pin the Suunto sample as a negative control |

**Deprecated/outdated:** `research/ARCHITECTURE.md`'s Pattern 1 code sketch, insofar as it implies the `classifyGaps` fold happens in Phase 32 — superseded by CONTEXT.md's Phase Boundary (this phase is compute/calibration-only, per ROADMAP.md's own Phase 33 entry).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "17 m/s over one second" prose figure refers to activity `4556693525` but does not reproduce exactly under a plain distance-delta scan of the raw FIT (measured 36.0 m/s peak instead) | D-02 | LOW — the activity-ID identification is independently confirmed by two EXACT, unrelated figures (51.3% position coverage, −282 m elevation low); only the specific "17 m/s" prose number is in question, and D-02 does not require reconciling it, only reporting the committed-stream shape (done) |
| A2 | `16628769295`/`7409028052`/`8869338724` are genuinely corroborated-fast (not noise) based on HR trend + cadence + non-gap-adjacency | D-05 | MEDIUM — if wrong, a future calibration could accidentally flag a "genuine" fixture; recommend the developer/planner spot-check at least one of these three against the Strava app before locking as a permanent regression fixture, since this session had no way to visually inspect the route |
| A3 | The candidate speed-limit statistic (`K × p90(per-activity p95 speeds)`) is a viable SHAPE for D-10, but `K` was not derived with a measured, non-circular method this session | D-10/D-13 | MEDIUM — this is explicitly flagged as an open calibration question, not presented as settled; the planner/calibration-script author must still do the D-11/D-13 work to justify a specific `K` |
| A4 | No clean valley exists in the no-gap-segment metres distribution (D-08) at the uncalibrated 7 m/s floor used for this probe | D-08 | LOW — this is a probe at an uncalibrated floor; a differently-calibrated floor could, in principle, produce a cleaner valley, though the smooth long-tail shape observed makes this unlikely |

## Open Questions

1. **What method produced the original "17 m/s" figure?**
   - What we know: activity `4556693525` is conclusively identified; the committed-stream shows 18.0/21.0 m/s across two decimated samples; the raw 1 Hz peak nearby is 36.0 m/s; the device's own `speed` field shows values in the 14.9-18.7 m/s range across the burst.
   - What's unclear: which exact computation the original v2.2 scoping investigator used to arrive at "17 m/s."
   - Recommendation: don't chase this further — cite the measured committed-stream figures (18.0/21.0 m/s) as the artifact's authoritative numbers and note the discrepancy with the original prose citation once, briefly.

2. **Is D-09's excess-metres floor even reachable/necessary if the speed-limit gate already excludes the `3475734189` trivia case?**
   - What we know: the trivia case measures 8.65 m/s, likely below any speed-limit threshold derived from D-10 (which is expected to land somewhere in the 7.8-9.6 m/s range per this session's probe).
   - What's unclear: whether the final calibrated speed limit lands above or below 8.65 m/s.
   - Recommendation: the calibration script should check this directly — if the speed gate alone already excludes 8.65 m/s, D-09's floor becomes a secondary/defensive layer (still worth having per SEG-04's explicit ask) rather than the primary discriminator; state this relationship explicitly in the artifact.

3. **`K`'s measured, non-circular value for D-10's candidate statistic.**
   - What we know: the shape (`K × p90 of a two-level-removed bulk statistic`) satisfies constraints (a)/(b)/(c); constraint (d)/(e) (flags all named bursts, spares D-05 fixtures, not moved by a demotion-count target) still needs to be checked against a specific `K`.
   - What's unclear: the measured method to derive `K` itself without circularity (mirroring how `CEILING_K` was derived from "largest observed max/p90 ratio among mechanism-clean distances" — this calibration needs its own analogous "mechanism-clean" cohort definition first).
   - Recommendation: this is squarely planning/execution work, not further research — the calibration generator script (`compute-unreliable-segment-calibration.mjs`) is the right place to iterate on this numerically with the full D-13 insensitivity check as the acceptance gate, exactly as `28-CEILING-CALIBRATION.md` did for `CEILING_K`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All compute scripts | ✓ | 25.2.1 local / 22 CI | — |
| vitest | Unit tests, immutability gate | ✓ | 4.0.18 | — |
| `@garmin/fitsdk` | D-12's local-only validation script | ✓ | 21.212.0 | — |
| `export_data/strava/activities/*.fit.gz` | D-12's local-only validation script | ✓ (this environment) | 1,873 files, ~123 MB | If absent in another environment: script must exit cleanly per the `consolidate.ts` precedent, never wired into CI regardless |
| `export_data/strava/activities.csv` | D-12's ID→FIT-filename join | ✓ | — | Only committed source with a complete per-activity FIT filename map; `data/provenance.json` is summary-only |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `export_data/` itself — already has a working graceful-absence precedent (`consolidate.ts`) to copy.

## Validation Architecture

`workflow.nyquist_validation` not found as explicitly `false` in `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`, `fileParallelism: false`) |
| Quick run command | `npx vitest run src/analytics/unreliable-segments.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEG-01 | Run-level (not per-sample) aggregate scoring; decimation-aliasing non-fire | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "decimation"` | ❌ Wave 0 |
| SEG-02 | `3475724402` all 30 bursts merged, none isolated; matches independent table | unit + script | `npx vitest run src/analytics/unreliable-segments.test.ts -t "3475724402"` and `node scripts/compute-unreliable-segment-recount.mjs` | ❌ Wave 0 |
| SEG-03 | Hidden-pause (`3475734189`) + isolated-jump (`3475740390`) mechanism labels | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "mechanism"` | ❌ Wave 0 |
| SEG-04 | Calibration artifact exists, regenerates idempotently, Suunto disposition stated | script + manual diff | `node scripts/compute-unreliable-segment-calibration.mjs && node scripts/compute-unreliable-segment-calibration.mjs` (run twice, diff) | ❌ Wave 0 |
| SEG-05a | Audit extension catches planted second implementation | unit | `npx vitest run src/analytics/pace-single-source.test.ts` | ✅ (file exists, extend it) |
| D-17 | `data/streams/` byte-identity gate | unit | `npx vitest run` (new streams-immutability test) | ❌ Wave 0 |

**Vacuous `-t` filter warning:** every `-t` command above MUST record the matched test count in `VALIDATION.md` (per the project's own `vitest -t filter can be vacuous` lesson) — a filter string that matches zero tests exits 0 and looks identical to a passing run.

### Sampling Rate
- **Per task commit:** `npx vitest run src/analytics/unreliable-segments.test.ts scripts/compute-unreliable-segment-recount.test.mjs scripts/compute-unreliable-segment-calibration.test.mjs`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the calibration artifact regenerated twice with zero unexplained diff, plus the recount script demonstrated failing against a deliberately-broken detector before passing.

### Wave 0 Gaps
- [ ] `src/analytics/unreliable-segments.ts` + `.test.ts` — the detector itself, covers SEG-01/02/03
- [ ] `scripts/compute-unreliable-segment-calibration.mjs` + `.test.mjs` — SEG-04
- [ ] `scripts/compute-unreliable-segment-recount.mjs` + `.test.mjs` — SEG-02's independent verification, D-15
- [ ] `.planning/phases/32-.../32-CALIBRATION.md` — the artifact of record
- [ ] Streams-immutability manifest + its vitest gate — D-17
- [ ] `scripts/validate-unreliable-segments-1hz.mjs` (no `.test.mjs`) — D-12

## Security Domain

`security_enforcement` not found as `false` — treated as enabled, but this phase has no attack surface: no new HTTP route, no new user input, no new write path. It is pure compute over already-committed, already-trusted local data, plus one new read-only test/gate.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | `validateStreamSeries` guard on every function taking `t`/`d` (existing pattern, reused, not reinvented) |
| V6 Cryptography | Yes (incidental) | sha256 for the D-17 manifest — use Node's built-in `crypto.createHash('sha256')`, no new dependency; this is an integrity check, not a security-secrecy boundary |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/adversarial `t`/`d` array crashing the detector | Denial of Service (of the CI compute step) | `validateStreamSeries` total-input guard, zeroed/empty result on any non-`ok` input, never throw (T-26-01 discipline, already established) |
| A local-only script accidentally reading `export_data/` in CI and failing the pipeline | Denial of Service | `existsSync` graceful-absence guard (`consolidate.ts` precedent), no `.test.mjs` sibling collected by `vitest.config.ts`'s glob |

## Sources

### Primary (HIGH confidence)
- `src/analytics/pace-derivation.ts` (read in full this session) — `classifyGaps`, `computeFlatRunDurations` (private, unexported), `quantile`, `advanceIntervals`, `RECORDING_GAP_ABS_THRESHOLD_SEC`
- `src/analytics/best-effort-utils.ts` (read in full this session) — `validateStreamSeries`, `findBestEffort`, `WORLD_RECORD_100M_SPEED_MPS`
- `src/analytics/pace-single-source.test.ts` (read in full this session) — the audit to extend, both documented blind spots, the planted-violation pattern
- `src/analytics/pace-quality.ts` (relevant sections read this session) — `decimationSignal`, `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION`/`_MIN_SAMPLES`, `countImpossibleSamples`
- `src/analytics/best-effort-ceiling.ts` (relevant sections read this session) — `percentileNearestRank`, `CEILING_K`'s derivation discipline
- `scripts/compute-elevation-recount.mjs` (read in full this session) — never-imports-classifier recount shape
- `scripts/compute-pr-ceiling-recount.mjs` / `.test.mjs` (relevant sections read this session) — the zero-import structural guard pattern, copied verbatim above
- `src/exports/consolidate.ts` (relevant sections read this session) — graceful `export_data/`-absence precedent
- `vitest.config.ts` (read this session) — confirms `scripts/**/*.test.mjs` is collected, the D-12 constraint
- `data/streams/manifest.json`, `data/provenance.json` (read this session) — the D-17 collision risk, confirmed real
- `export_data/strava/activities.csv`, `export_data/strava/activities/4868274524.fit.gz` (read/decoded this session via `@garmin/fitsdk`) — D-02's conclusive identification
- `data/streams/*.json`, `data/activities/*.json` (bulk-scanned this session, 1,873/1,899 files) — D-05, D-08, D-09, D-10, D-11 measurements
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md` (read this session)
- `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md` (read in full this session)

### Secondary (MEDIUM confidence)
- Strava CSV export `Max Speed` field for `4556693525` (16.4 m/s) as corroborating-but-not-authoritative context for the "17 m/s" prose figure

### Tertiary (LOW confidence)
- None used — this phase's research relied entirely on primary, direct-read/direct-computation sources; no WebSearch was needed (this is a project-internal calibration question, not an ecosystem question)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions confirmed via `npm ls` this session
- Architecture: HIGH — the Phase 32/33 scope boundary is directly stated in CONTEXT.md and cross-confirmed in ROADMAP.md
- Pitfalls: HIGH for project-specific mechanics (all read/measured directly this session); MEDIUM for the D-10 calibration statistic (a probe shape, not a measured final value)

**Research date:** 2026-09-19
**Valid until:** ~7 days for the archive-derived numeric probes (the archive grows via nightly sync; D-16 already requires a live re-derivation at artifact-generation time regardless) — the architectural/scope findings (Phase 32 vs 33 boundary, the manifest collision risk, the vitest glob constraint) are stable until the relevant files change.
