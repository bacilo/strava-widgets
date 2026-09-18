---
phase: 30
slug: elevation-quality-signal
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-18
updated: 2026-09-18
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `30-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled in by the planner/executor once PLAN.md task IDs
> exist; the framework, sampling rate, and Wave 0 rows below are already fixed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18` |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'node'`, `fileParallelism: false` (keep), `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`. A `scripts/**/*.test.ts` file is **never collected** — the two new script-side tests must be `*.test.mjs`. |
| **Quick run command** | `npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts` (or the file(s) the task touched) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s quick / ~180s full suite |

---

## Sampling Rate

- **After every task commit:** Run the targeted `npx vitest run <file>` for whatever file(s) that task touched (default: the quick run command above)
- **After every plan wave:** Run `npm test` (full suite, `fileParallelism: false`) **plus** `node scripts/compute-pace-quality-recount.mjs --expect 299` — the D-06 regression gate; Phase 27's `anySevere` composite (299/1,890; decimation 154 / gapProfile 127 / impossibleSamples 31) must be byte-stable after this phase lands
- **Before `/gsd-verify-work`:** Full suite green, `npx tsc --noEmit`, `npm run build-widgets` and `npm run verify-dashboard` exit 0, and `git status --porcelain data/` is empty after both new scripts have run
- **Max feedback latency:** 20 seconds (quick command)

---

## Per-Task Verification Map

*Populated during planning — one row per task ID emitted by the PLAN.md files.
Every requirement below must be claimed by at least one task row before
`wave_0_complete` may be set true.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-T1 | 30-01 | 1 | ELEV-01 | T-30-01, T-30-02, T-30-04 | Three total detectors at −50 m / 60 m / 5 m/s with `LOOP_RADIUS_M = 100`; malformed, `[]`, wrong-length, non-finite or absent input returns not-computable, never throws, never a coerced zero; the haversine constant is the one `derive-stream.ts` uses | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "elevation"` | ❌ W0 (extend existing) | ⬜ pending |
| 30-01-T2 | 30-01 | 1 | ELEV-01 | T-30-03 | `elevation` is the sixth signal and rides the existing shard; `hasAnySevereSignal`'s `Pick<>` key set is unchanged, demonstrated failing when widened | unit (key-set assertion) + unit (mode independence) | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes elevation"` and `-t "mode independence"` | ❌ W0 | ⬜ pending |
| 30-01-T3 | 30-01 | 1 | ELEV-01 | T-30-05 | The required key lands tree-wide with no existing assertion altered; `ALT_MIN` untouched | regression (full suite + typecheck) | `npx tsc --noEmit && npm test` | ✅ existing suite | ⬜ pending |
| 30-02-T1 | 30-02 | 2 | ELEV-02 | T-30-06, T-30-07, T-30-08 | Pinned real exemplars (4556693525 min −282 m; 4745489664 drift −197.6 m at 0 m; 3149636661 worst 80.4 m/s and also drifting) re-verify against the live archive; an unhandled `expected` key still throws | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ✅ extend (`assertExpectedProperties` switch) | ⬜ pending |
| 30-03-T1 | 30-03 | 2 | ELEV-01 | T-30-12, T-30-13 | `start_latlng`/`end_latlng` reach the detector through the existing metadata slice with zero new file reads; the Phase 27 composite is unmoved by the regeneration | integration (real archive) | `npm run build && npm run compute-dashboard-index && node scripts/compute-pace-quality-recount.mjs --expect 299` | ✅ (re-run, not extended) | ⬜ pending |
| 30-03-T2 | 30-03 | 2 | ELEV-01 | T-30-09, T-30-10 | A stale row with no `elevation` key, a `'minor'` tier, or a `NaN`/string numeric parses to an explicit not-computable — never a throw, never `0` | unit | `npx vitest run src/dashboard/data/pace-quality-client.test.ts` | ✅ extend | ⬜ pending |
| 30-03-T3 | 30-03 | 2 | ELEV-02 | T-30-11 | A partial rollout (one published row missing `quality.elevation`) fails the publish gate, demonstrated failing | integration (publish gate) | `npm run build-widgets && npm run verify-dashboard` | ✅ extend (`QUALITY_SUB_KEYS`) | ⬜ pending |
| 30-04-T1 | 30-04 | 2 | ELEV-02 | T-30-14, T-30-16, T-30-17 | `data/streams/` byte-unchanged proved by a sha256 digest before/after with a non-zero exit on mismatch; no `fs` write target under `data/` in the script or the analytics module; importing the module sweeps nothing | integration (digest) + unit (source scan) | `npx vitest run scripts/compute-elevation-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| 30-04-T2 | 30-04 | 2 | ELEV-02 | T-30-15, T-30-16 | `30-CALIBRATION.md` reports per-mode cohorts, the derived loop radius with its justification, the loop-gated overlap matrix and union, the device breakdown, the 207-style drift not-computable cohort with its denominator, the loop-gate exclusions by id, and the D-08 carry-forward finding — and regenerates byte-identically | integration (script, real archive) + idempotence diff | `npm run compute-elevation-calibration` | ❌ W0 | ⬜ pending |
| 30-04-T3 | 30-04 | 2 | ELEV-01 | T-30-18 | ROADMAP Criteria 1 and 3 and REQUIREMENTS ELEV-01 state the loop-gated counts and record the original as a raw-difference measurement; both checkboxes remain unticked pending verification | doc assertion (grep) | `grep -c "34 barometric-closure-drift" .planning/ROADMAP.md` returns 0 and `grep -c "raw-difference" .planning/ROADMAP.md .planning/REQUIREMENTS.md` returns ≥1 each | n/a (docs) | ⬜ pending |
| 30-05-T1 | 30-05 | 3 | ELEV-01 | T-30-19, T-30-20, T-30-22, T-30-23 | Exactly one severe-only elevation badge per row on all three surfaces, carrying the fired modes' measured values; no badge for `none`/`not-computable`; no badge when every value is null; no TypeError on a row with no `quality`; no filter or URL parameter added | unit | `npx vitest run src/dashboard/views/list.test.ts -t "elevation"` | ✅ extend | ⬜ pending |
| 30-05-T2 | 30-05 | 3 | ELEV-01 | T-30-21 | The Elevation Gain stat card is badged when flagged and nothing else is caveated; no new fetch or `Promise.all` member | typecheck + regression suite | `npx tsc --noEmit && npm test` | ✅ existing suite | ⬜ pending |
| 30-06-T1 | 30-06 | 3 | ELEV-01 | T-30-24, T-30-28 | Three always-on elevation rows on every activity; the section and the not-available fallback both return eight rows; the render loop and the three existing rows are untouched | unit | `npx tsc --noEmit && npx vitest run src/dashboard/views/detail-sections.test.ts` | ✅ extend | ⬜ pending |
| 30-06-T2 | 30-06 | 3 | ELEV-01 | T-30-25, T-30-26, T-30-27 | All four drift phrasings render and the excluded and position-unknown states are provably different strings; a stream-less activity shows no `0 m`/`0 m/s`; a null shard nulls only `evidenceText` | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "elevation rows"` | ❌ W0 (new describe) | ⬜ pending |
| 30-07-T1 | 30-07 | 3 | ELEV-02 | T-30-29, T-30-30, T-30-31, T-30-32 | The recount reproduces the elevation cohorts from the shipped index alone, importing no classifier and never touching `anySevere`; malformed rows degrade rather than throw; no `fs` write target under `data/` | integration (script) + unit (source scan) | `node scripts/compute-elevation-recount.mjs && npx vitest run scripts/compute-elevation-recount.test.mjs` | ❌ W0 | ⬜ pending |
| 30-07-T2 | 30-07 | 3 | ELEV-02 | T-30-33 | Three independently produced figures for one cohort reconcile with every delta quantified and caused; Phase 27's composite stays byte-stable under an unmodified script | regression | `node scripts/compute-pace-quality-recount.mjs --expect 299` | ✅ (re-run, not extended) | ⬜ pending |
| 30-08-T1 | 30-08 | 4 | ELEV-01, ELEV-02 | T-30-34, T-30-36, T-30-37 | Eight rows drafted with CAN PASS / CAN FAIL in both directions, each stating an expected value from a committed shard, the calibration report or a script's stdout; the served digest is computed from fetched bytes | integration (build + serve + digest) | `node scripts/compute-elevation-recount.mjs && node scripts/compute-pace-quality-recount.mjs --expect 299 && npm run verify-dashboard` | ❌ W0 | ⬜ pending |
| 30-08-T2 | 30-08 | 4 | ELEV-01, ELEV-02 | T-30-35, T-30-38, T-30-39 | Badge, three detail lines, Elevation Gain caveat, position-unknown wording and elevation's absence from the severe filter read off a rendered page; verdicts verbatim; requirements ticked only after every mapped row passes | manual (browser checkpoint) | human-check — see § Round 1 Checkpoint | n/a (manual) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/analytics/pace-quality.ts` — `ElevationSignal` type, `subGroundSignal` / `closureDriftSignal` / `verticalRateSignal` pure detectors (total on any array-shaped input), `elevation` field on `ActivityQualitySignals`, `startLatlng` / `endLatlng` on `ActivityQualityMetadata`; `hasAnySevereSignal` untouched
- [ ] `src/analytics/pace-quality.test.ts` — elevation, closure-drift, mode-independence and `anySevere`-exclusion test groups
- [ ] `src/analytics/pace-fixtures.ts` — three synthetic per-mode `makeStream` fixtures and two new `PINNED_FIXTURES` rows (4745489664, 3149636661) with verified `expected` values
- [ ] `src/analytics/pace-fixtures.test.ts` — extend `assertExpectedProperties`'s switch **in the same task** as the fixture-row addition (otherwise the existing test throws on unknown `expected` keys — RESEARCH Pitfall 2)
- [ ] `src/analytics/compute-dashboard-index.ts` — pass `start_latlng` / `end_latlng` into `qualityMetadata`; land the elevation scalar on the index row (additive, `schemaVersion` stays 1)
- [ ] `src/dashboard/data/pace-quality-client.ts` — parse elevation fields as `Partial`, handle absence
- [ ] `src/dashboard/views/list.ts` — `qualityBadgeSpecs` elevation block (one severe-only badge naming fired mode(s) + worst value)
- [ ] `src/dashboard/views/detail.ts` — Elevation Gain stat-card badge (mirrors the `paceDisagreement` precedent)
- [ ] `src/dashboard/views/detail-sections.ts` — three always-on elevation rows + `notAvailableRows()` extension (drift not-computable reads in words)
- [ ] `scripts/compute-elevation-calibration.mjs` + `scripts/compute-elevation-calibration.test.mjs` — new, mirrors `compute-pace-quality-calibration.mjs`, adds the D-16 digest step, writes `30-CALIBRATION.md` as its single declared target
- [ ] `scripts/compute-elevation-recount.mjs` + `scripts/compute-elevation-recount.test.mjs` — new, mirrors `compute-pace-quality-recount.mjs`, reads `data/dashboard/index.json` only, never imports the classifier
- [ ] `package.json` — `compute-elevation-calibration` and `compute-elevation-recount` scripts
- [ ] `.planning/ROADMAP.md` § Phase 30 Criterion 1 and `.planning/REQUIREMENTS.md` § ELEV-01 — "at least 34" corrected to the measured loop-gated figure (21), recording that 34 was a raw-difference measurement (D-04); must land before the checkpoint plan drafts its rows

*No framework installation gap — vitest already collects both file patterns this phase needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Severe-only elevation badge renders on each of the three `renderActivityRow` surfaces with condition + measured value | ELEV-01 (D-10) | Rendered DOM in a real browser against the served build | Browser checkpoint — open a flagged activity (e.g. 4556693525) on each surface; quote the badge text; assert the number against `data/stats/pace-quality/4556693525.json`, not against the badge itself |
| Detail view shows three always-on elevation lines (healthy and flagged) plus the Elevation Gain caveat only when flagged | ELEV-01 (D-11, D-12) | Rendered DOM; the drift not-computable state must read in words | Browser checkpoint — 4556693525 and one healthy activity; read the three numbers back against the shard file and `30-CALIBRATION.md`; confirm the healthy activity's card carries no caveat |
| Served build is the build under test | ELEV-02 (Criterion 3) | Stale `index.html` / `index.json` in checkpoints has passed defects three times | Hard-reload after every fixture edit; verify the served digest, not the build log; viewport clamps to 500..941 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Task 1: Build Verification, Derived Expected Values, and Drafted Rows

### Build and Serve — Digest Verified From Fetched Bytes

Commands run in order: `npm run build && npm run compute-dashboard-index && npm run build-widgets`.

- `npm run build && npm run compute-dashboard-index` regenerated `data/dashboard/index.json`: 1,890
  activities indexed, 1,865 with streams, `Quality: any severe signal: 299`, `Quality: not computable: 25`.
- `npm run build-widgets` explicitly reported `✓ Copied data/dashboard/*.json → dist/widgets/data/dashboard/ (1 copied, 0 skipped)` — the index was NOT skipped by the mtime guard. The dashboard SPA's JS bundle (`dist/widgets/assets/index-Ct-mwNp6.js`, referenced by `dist/widgets/index.html`) is rebuilt by esbuild on every invocation (no mtime-skip path applies to bundles, only to the `data/` copy step) and its file mtime (`Sep 18 16:42` local) postdates this run.
- **Local digest** (`shasum -a 256 dist/widgets/assets/index-Ct-mwNp6.js`):
  `0d126085d9c5b128638f4e251180e88017ed0a6277c083e5614324161a61431f`
- Served the publish directory: `cd dist/widgets && nohup python3 -m http.server 8899 --bind 127.0.0.1 &` (PID `27820`, log `/tmp/gsd-30-08-serve.log`). Base URL: `http://127.0.0.1:8899/`.
- **Served digest** (`curl -s http://127.0.0.1:8899/assets/index-Ct-mwNp6.js | shasum -a 256`):
  `0d126085d9c5b128638f4e251180e88017ed0a6277c083e5614324161a61431f`
  — **MATCH.** Local and served bytes are byte-identical.
- `curl`'d `/data/dashboard/index.json` (served) and compared against the local file:

  | | served | local |
  |---|---|---|
  | sha256 | `bff1daf9b4eddd5fc301468337f941bd7e7b04c948bf415a0be40588a9a7da1d` | `bff1daf9b4eddd5fc301468337f941bd7e7b04c948bf415a0be40588a9a7da1d` |
  | row count | 1890 | 1890 |
  | `totals.qualityAnySevere` | 299 | 299 |
  | rows with `quality.elevation` present | 1890 (100%) | 1890 (100%) |

  — **MATCH** on every field. The served build is the build under test; no stale bundle beside a fresh index (T-30-34).

### Re-run Scripts, Verbatim Stdout

**`npm run compute-elevation-calibration`** (idempotence check: regenerated `30-CALIBRATION.md` against the
final build; content byte-identical modulo the `**Generated:**` timestamp — confirmed via
`diff <(git show HEAD:… | grep -v Generated:) <(grep -v Generated: 30-CALIBRATION.md)`, no output. The
regenerated file was reverted with `git checkout --` since it is outside this plan's `files_modified` and a
timestamp-only diff would misattribute a Plan 04 artifact to this plan — same convention plan 30-07 used.):

```
Computing pre-sweep data/streams/ digest (D-16)...
  1865 files, digest 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
Reading the live archive (data/activities/, data/streams/)...
Activities: 1890; streams present: 1865
Computing elevation signals for every activity (shipped classifier, no overrides)...
Loop-gated union: 60
Computing post-sweep data/streams/ digest (D-16)...
  1865 files, digest 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
data/streams/ is byte-unchanged (digest match, 1865 files): 0a7836d291ee953cd89365fe6669847a084d9de7775b033af3fdbec2e5f16f61
Inclusion-exclusion check: PASS.

Wrote .../30-CALIBRATION.md
```

**`node scripts/compute-elevation-recount.mjs`**:

```
D-15 independent elevation recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows: 1890
Rows carrying a "quality" object: 1890 of 1890 (100.0%)
Rows carrying "quality.elevation": 1890 of 1890 (100.0%)

Per-mode flagged counts (own arithmetic, read from each row's per-mode fields):
  subGround.flagged:              11 of 1890 (0.6%)
  closureDrift.state==='flagged': 21 of 1890 (1.1%)
  verticalRate.flagged:           39 of 1890 (2.1%)

Overlaps:
  subGround ∩ closureDrift: 6
  subGround ∩ verticalRate: 3
  closureDrift ∩ verticalRate: 3
  all three: 1
  inclusion-exclusion check: 11 + 21 + 39 - 6 - 3 - 3 + 1 = 60 vs. direct union 60: MATCH

Recounted union (own arithmetic, subGround OR closureDrift OR verticalRate): 60
  vs. shipped elevation.tier === 'severe' count: 60

closureDrift not-computable (position unknown, D-02 — among elevation-computable rows): 207 of 1865 (11.1%)
elevation.tier not-computable (whole-signal, stream-less cohort): 25 of 1890 (1.3%)

Device-family breakdown of the recounted severe set:
  suunto-9: 46
  garmin-fenix-6-pro: 11
  no-device-name: 2
  garmin-vivoactive-4: 1

PASS: recount agrees with the shipped elevation tiers; no disagreements found.
```

**`node scripts/compute-pace-quality-recount.mjs --expect 299`** (the pre-phase composite; D-06 regression gate):

```
D-03 independent recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows (activity-count denominator): 1890
Rows with a computable stream (notComputableReason === null): 1865
Not-computable count: 25
Per-signal severe counts (own arithmetic, tier === 'severe'):
  decimation:        154
  gapProfile:        127
  impossibleSamples: 31
Recomputed composite (own arithmetic, union of the three tiers): 299
  vs. totals.qualityAnySevere:        299
  vs. count of row.quality.anySevere:  299
--expect 299: MATCH

PASS: recount agrees with the shipped totals; no disagreements found.
```

**`npm run verify-dashboard`**: 66/66 checks passed, 0 failures, exit 0 (asset lines confirm the served build:
`✓ GET /assets/index-Ct-mwNp6.js -> 200`, `✓ GET /assets/index-CQkdBpPg.css -> 200`).

**`npx tsc --noEmit`**: exit 0, no output. **`npm test`**: 84/84 files, 2539/2539 tests, exit 0.

### Derived Expected Values (each from a source other than the page)

- **Severe exemplar — `4556693525`** (unchanged from `30-03-SUMMARY.md`/`30-05-SUMMARY.md`/`30-06-SUMMARY.md`,
  re-confirmed against the just-regenerated `data/stats/pace-quality/4556693525.json` and the matching index
  row): `subGround: { flagged: true, minAltM: -282 }`, `closureDrift: { state: 'clear', deltaM: -5.600000000000023, startEndDistM: 0 }`,
  `verticalRate: { flagged: false, worstRateMps: 3.3000000000000114 }`. Row badge text (computed by
  `elevationBadgeContent`, only `subGround` fires): `altitude -282 m below ground`. Three detail lines
  (`30-06-SUMMARY.md`): `lowest altitude -282 m — below plausible ground level` / `start/end altitude differ by
  6 m (loop, 0 m apart)` / `max vertical rate 3.3 m/s`. Date: `2021-01-02` (local) — usable as a date-range
  filter value on `#/list` to isolate the row (search-by-name is useless here: the activity is named
  `Morning Run`, shared by hundreds of rows).

- **Healthy exemplar — `17257505831`** (`tier: 'none'`, `closureDrift.state: 'clear'` on a loop —
  `startEndDistM: 0`): `subGround: { flagged: false, minAltM: 7.800000000000011 }`,
  `closureDrift: { deltaM: 2.3999999999999773, startEndDistM: 0 }`, `verticalRate: { flagged: false,
  worstRateMps: 1.3999999999999773 }`. Three detail lines (`30-06-SUMMARY.md`): `lowest altitude 8 m` /
  `start/end altitude differ by 2 m (loop, 0 m apart)` / `max vertical rate 1.4 m/s`. No elevation row badge,
  no Elevation Gain stat-card badge expected (tier is `'none'`, not `'severe'`). Date: `2026-02-02` (local).

- **Position-unknown exemplar — `i184264408`** (`closureDrift.state: 'not-computable'`, the other two modes
  ran clean): `subGround: { flagged: false, minAltM: -1 }`, `verticalRate: { flagged: false, worstRateMps:
  1.200000000000001 }`. Drift line (`30-06-SUMMARY.md`): `start/end position unknown — drift not checked` —
  no number, visibly distinct from the excluded-not-a-loop phrasing (`start/end position measured N m apart —
  not a loop, so drift was not checked`). Date: `2026-09-07` (local).

- **Elevation-only exemplar — `16028352681`.** Selected by reading the just-regenerated shipped index
  directly: `quality.elevation.tier === 'severe' && quality.anySevere === false` matches **22 of 1890**
  activities (script: `node -e "…filter(r=>r.quality.elevation.tier==='severe'&&r.quality.anySevere===false)…"`
  against `data/dashboard/index.json`) — non-zero, so this row IS exercisable and is not struck.
  `16028352681`'s own shard: `subGround: { flagged: false, minAltM: 9 }`, `closureDrift: { state:
  'not-computable' }`, `verticalRate: { flagged: true, worstRateMps: 9, violatingSamples: 10 }` — fires on
  vertical rate alone, so its row badge is `spike 9 m/s` (via `elevationBadgeContent`: `subGround` and
  `closureDrift` contribute no clause, `verticalRate.flagged` contributes `spike 9 m/s`). Not also severe on
  any of the three tiering signals (`decimation`/`gapProfile`/`impossibleSamples` all `'none'`), confirming
  `anySevere: false` is not a coincidence of this particular row — device family `garmin-fenix-6-pro`. Date:
  `2025-10-04` (local).

- **A genuine reachability finding, investigated before drafting R2 (per the plan's own "investigate before
  redrafting" rule and the `reachability-probe-must-use-named-input` / `checkpoint-rows-can-be-unsatisfiable`
  project lessons):** D-10's badge is described in `30-05-SUMMARY.md` as reaching "all three
  `renderActivityRow` surfaces (Activities card/table, Overview Recent Activities, Overview Recent PRs)".
  `RowSurface` (`src/dashboard/views/list.ts`) actually names four values — `activity-card`, `activity-table`
  (both on `#/list`, viewport-toggled — one logical surface), `overview-activities`, `overview-prs` (both on
  `#/`). Overview's two surfaces are NOT arbitrary browsing — `overview.ts` slices the already
  most-recent-first `rows` array: `RECENT_ACTIVITY_COUNT = 10` (unfiltered top 10 by date) and
  `RECENT_PR_COUNT = 5` (top 5 of `rows.filter(r => r.prCount > 0)`). Checked directly against the
  regenerated index: **0 of the top 10 most-recent activities and 0 of the top 5 most-recent PR'd activities
  carry `elevation.tier === 'severe'`** (verbatim dates/tiers recorded in the derivation script run — most
  recent row is `i184264408` at `2026-09-07`, tier `'none'`; most recent PR row is `7827165619` at
  `2022-09-18`, tier `'none'`). No severe-elevation activity is reachable on either Overview surface in the
  current archive — not a suspected defect (the badge machinery is generically shared: `qualityBadgeSpecs`
  is the one function both `list.ts` and `overview.ts` iterate, confirmed by direct code read, not rendered
  evidence), but a dataset-coverage gap, the same disposition the `20-05` checkpoint recorded for seven
  theme-sensitive rows with no stated theme coverage ("an evidence gap rather than a defect"). **R2 below is
  scoped accordingly: its CAN PASS/CAN FAIL discriminator covers the Activities-list surface only (the one
  surface a severe-elevation row can actually reach today); the Overview portion is recorded as NOT
  EXERCISABLE via a real archive activity, stated with its own reason, rather than silently assumed to pass.**

---

## Round 1 Checkpoint (R1-R8)

**Serve command:** `cd dist/widgets && nohup python3 -m http.server 8899 --bind 127.0.0.1 &` (already running,
PID `27820`, started by the executor — the developer does not need to start it again). **Base URL:**
`http://127.0.0.1:8899/`. **Served asset digest** (`assets/index-Ct-mwNp6.js`, sha256):
`0d126085d9c5b128638f4e251180e88017ed0a6277c083e5614324161a61431f` — matches the locally built asset (see
Task 1 § Build and Serve above). **Hard-reload before starting, and again after any navigation that changes
the dataset.** Keep the viewport between 500 and 941 px.

Route table: Overview `#/`, Activities list `#/list`, Activity detail `#/activity/{id}`. The list has a
free-text name search (useless for these exemplars — several share the name "Morning Run") and a date-range
filter (`from`/`to`) that can isolate a single row by the exemplar's own date, given above per exemplar.

---

**R1 — served digest.** In DevTools' Network panel, confirm the loaded JS asset's filename.
Expected: `assets/index-Ct-mwNp6.js`, matching the digest `0d126085…61431f` computed from the fetched bytes in
Task 1 § Build and Serve. Source: this plan's own `curl` + `shasum` run, not the build log.
CAN PASS: DevTools shows `assets/index-Ct-mwNp6.js` loaded (200).
CAN FAIL: a stale bundle serves a different asset filename.
**Verdict:** pending

**R2 — the row badge on the Activities-list surface (Overview portion NOT EXERCISABLE — see Task 1 finding
above).** On `#/list`, isolate `4556693525` (date filter `2021-01-02` to `2021-01-02`, or paginate/sort —
name search will not disambiguate it). Quote its elevation badge text VERBATIM, in both the card and table
layouts if both are reachable at your viewport. Expected: `altitude -282 m below ground`, identical in both
layouts. Source: `elevationBadgeContent` applied to `data/stats/pace-quality/4556693525.json`'s `subGround`
(`minAltM: -282`, the only mode that fires), recorded verbatim in `30-05-SUMMARY.md`.
CAN PASS: the quoted text reads exactly `altitude -282 m below ground` on the Activities-list surface,
identical across any layouts reached.
CAN FAIL: no badge on the Activities-list surface, a badge naming a condition with no number, or a number
disagreeing with the shard (`-282`).
**Verdict:** pending
*(Overview `#/` Recent Activities / Recent PRs: NOT EXERCISABLE — 0 of the current top-10-recent / top-5-PR'd
activities carry `elevation.tier === 'severe'`, per the Task 1 finding. Not scored PASS or FAIL.)*

**R3 — the three detail lines on the flagged activity.** Open `#/activity/4556693525` and quote all three
elevation lines verbatim. Expected: `lowest altitude -282 m — below plausible ground level` / `start/end
altitude differ by 6 m (loop, 0 m apart)` / `max vertical rate 3.3 m/s`. Source: `qualitySignalsSectionPlan`
applied to `data/stats/pace-quality/4556693525.json`, recorded verbatim in `30-06-SUMMARY.md`.
CAN PASS: all three lines match the expected strings exactly.
CAN FAIL: fewer than three lines, a blank value, `undefined`/`null`/`NaN` on screen, or a number disagreeing
with the shard file.
**Verdict:** pending

**R4 — the three detail lines on the HEALTHY activity, and no caveat.** Open `#/activity/17257505831` (date
filter `2026-02-02` if browsing `#/list` first) and quote its three elevation lines. Expected: `lowest
altitude 8 m` / `start/end altitude differ by 2 m (loop, 0 m apart)` / `max vertical rate 1.4 m/s`. Source:
`data/stats/pace-quality/17257505831.json`, recorded verbatim in `30-06-SUMMARY.md`. Then confirm the
Elevation Gain stat card carries NO badge (expected: `tier: 'none'` on this row, so no caveat).
CAN PASS: all three lines match the expected strings exactly, AND the Elevation Gain stat card carries no
badge.
CAN FAIL: a healthy activity showing no elevation lines at all (silence as good news), or a caveat on a card
the page does not flag.
**Verdict:** pending

**R5 — the Elevation Gain caveat on the flagged activity.** On `#/activity/4556693525`, confirm the
Elevation Gain stat card carries a caveat and quote it; confirm no other stat card, split column or aggregate
on that page is caveated. Expected caveat text: `altitude -282 m below ground` — same text as R2/R3, since
`detail.ts`'s stat-card badge and `list.ts`'s row badge both call the one exported `elevationBadgeContent`.
Source: `src/dashboard/views/detail.ts` (`elevationStatCard` / `appendAccessibleBadge` wiring, confirmed by
code read) plus the same shard value as R2/R3.
CAN PASS: the Elevation Gain stat card's badge reads `altitude -282 m below ground`, and no other stat card /
split column / aggregate on the page carries a badge.
CAN FAIL: no caveat on the flagged card, or a caveat appearing on a second surface D-12 excludes (a split
column, an aggregate, or any other stat card).
**Verdict:** pending

**R6 — the drift line's position-unknown wording.** Open `#/activity/i184264408` (date filter `2026-09-07` if
browsing `#/list` first) and quote its closure-drift line. Expected: `start/end position unknown — drift not
checked` — states in words that position is unknown, no distance, no delta. Source:
`data/stats/pace-quality/i184264408.json` (`closureDrift.state: 'not-computable'`), recorded verbatim in
`30-06-SUMMARY.md`, distinguished by construction from the excluded-not-a-loop phrasing (`start/end position
measured N m apart — not a loop, so drift was not checked`) demonstrated failing in `30-06-SUMMARY.md`'s own
mutation test.
CAN PASS: the line reads exactly `start/end position unknown — drift not checked`.
CAN FAIL: the line shows a number, reads as healthy, reads identically to the not-a-loop exclusion, or is
absent.
**Verdict:** pending

**R7 — D-06 on the shipped surface.** On `#/list`, enable the "Only activities with a severe quality signal"
checkbox (the Quality filter field) and confirm `16028352681` is ABSENT from the filtered list (date filter
`2025-10-04` to `2025-10-04` with the checkbox on should show zero rows). Then disable the checkbox, re-apply
the same date filter, and confirm `16028352681` IS present, carrying the badge `spike 9 m/s`. Finally, with
the checkbox on and the date filter cleared, confirm the pagination reads `Page 1 of 6` and the last page (6)
shows 49 rows (5×50 + 49 = 299) — the filtered total, independently compared against the Phase 27 recount's
composite from Task 1 (`node scripts/compute-pace-quality-recount.mjs --expect 299`: composite 299), not
against another browser number.
CAN PASS: `16028352681` is absent under the filter and present-and-badged (`spike 9 m/s`) without it, and the
filtered total is 299 (Page 1 of 6, last page 49 rows), matching the recount composite with zero stated
drift.
CAN FAIL: the elevation-only activity appears under the filter, or the filtered count differs from the
recount's composite (299) by more than the archive drift between the two runs, which must be stated as a
number.
**Verdict:** pending

**R8 — the corrected criteria and the report.** A document read, not rendered evidence: confirm
`.planning/ROADMAP.md` Phase 30 Criterion 1 and Criterion 3 and `.planning/REQUIREMENTS.md` § ELEV-01 state
the loop-gated figures (21 loop-gated drift, 60 union) and record the original 34 as a raw-difference
measurement (both files already grep-confirmed by the executor: `grep -c "34 barometric-closure-drift"`
returns 0, `grep -c "raw-difference"` returns ≥1 in each). Confirm `30-CALIBRATION.md` § Loop-gate exclusions
lists the 12 point-to-point + 1 no-position exclusions by id, and § Loop radius derives `LOOP_RADIUS_M = 100`
from the measured 0 m / 552.44 m gap in the start/end distance distribution. Compare the report's union (60,
§ Overlap matrix) against the recount's union from Task 1 (`node scripts/compute-elevation-recount.mjs`:
`Recounted union: 60`).
CAN PASS: both documents state the loop-gated figures with the raw-34 recorded as a raw-difference
measurement, `30-CALIBRATION.md` lists all 13 exclusions by id with a derived radius, and the report's union
(60) matches the recount's union (60) exactly.
CAN FAIL: a document still stating the raw figure, an exclusion list absent, or the two union figures
disagreeing without a stated cause.
**Verdict:** pending

---

### Reachability Audit

Every CAN PASS / CAN FAIL pair from the eight rows above, repeated together per the plan's requirement that
the audit read in one place. Every row has both a satisfiable pass condition and a satisfiable fail
condition; none is struck. (R7 is exercisable — the elevation-only cohort is 22, not zero — so it stays a
live row rather than NOT EXERCISABLE; R2's Overview sub-claim is the one piece of a row found unreachable,
disclosed and carved out above rather than silently asserted or silently dropped.)

- R1 — CAN PASS: DevTools shows `assets/index-Ct-mwNp6.js` loaded (200). CAN FAIL: a stale bundle serves a
  different asset filename.
- R2 — CAN PASS: the quoted text reads exactly `altitude -282 m below ground` on the Activities-list surface,
  identical across any layouts reached. CAN FAIL: no badge on the Activities-list surface, a badge naming a
  condition with no number, or a number disagreeing with the shard (`-282`).
- R3 — CAN PASS: all three lines match the expected strings exactly. CAN FAIL: fewer than three lines, a
  blank value, `undefined`/`null`/`NaN` on screen, or a number disagreeing with the shard file.
- R4 — CAN PASS: all three lines match the expected strings exactly, AND the Elevation Gain stat card carries
  no badge. CAN FAIL: a healthy activity showing no elevation lines at all (silence as good news), or a
  caveat on a card the page does not flag.
- R5 — CAN PASS: the Elevation Gain stat card's badge reads `altitude -282 m below ground`, and no other stat
  card / split column / aggregate on the page carries a badge. CAN FAIL: no caveat on the flagged card, or a
  caveat appearing on a second surface D-12 excludes (a split column, an aggregate, or any other stat card).
- R6 — CAN PASS: the line reads exactly `start/end position unknown — drift not checked`. CAN FAIL: the line
  shows a number, reads as healthy, reads identically to the not-a-loop exclusion, or is absent.
- R7 — CAN PASS: `16028352681` is absent under the filter and present-and-badged (`spike 9 m/s`) without it,
  and the filtered total is 299 (Page 1 of 6, last page 49 rows), matching the recount composite with zero
  stated drift. CAN FAIL: the elevation-only activity appears under the filter, or the filtered count differs
  from the recount's composite (299) by more than the archive drift between the two runs, which must be
  stated as a number.
- R8 — CAN PASS: both documents state the loop-gated figures with the raw-34 recorded as a raw-difference
  measurement, `30-CALIBRATION.md` lists all 13 exclusions by id with a derived radius, and the report's
  union (60) matches the recount's union (60) exactly. CAN FAIL: a document still stating the raw figure, an
  exclusion list absent, or the two union figures disagreeing without a stated cause.

### Gap-Closure Record

*(empty — populated only if a FAIL is recorded during Task 2)*
