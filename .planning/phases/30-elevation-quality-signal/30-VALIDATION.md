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
