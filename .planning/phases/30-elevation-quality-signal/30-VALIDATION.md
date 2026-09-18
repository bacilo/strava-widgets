---
phase: 30
slug: elevation-quality-signal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-18
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
| — | — | — | ELEV-01 | — | Three elevation modes detected archive-wide; sub-ground / loop-gated drift / vertical-rate cohorts reproduce the research-measured counts (11 / 21 / 39, union 60) from the report, not the detector's self-description | unit + integration (real archive) | `npx vitest run src/analytics/pace-quality.test.ts -t "elevation"` | ❌ W0 (extend existing) | ⬜ pending |
| — | — | — | ELEV-01 | T-30 V5 | Loop-gated drift is `not-computable` (never a plausible zero) when `start_latlng`/`end_latlng` is absent, `[]`, wrong-length or non-finite; point-to-point endpoints (≥552 m apart) are excluded with a stated reason | unit, synthetic fixtures + two new pinned reals | `npx vitest run src/analytics/pace-quality.test.ts -t "closure drift"` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-01 | T-30 tampering | `elevation` never joins `anySevere` — `hasAnySevereSignal`'s `Pick<>` key set and the recount's `TIERING_SIGNAL_KEYS` are unchanged (D-06 structural guarantee) | unit (key-set assertion) | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes elevation"` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-02 | — | Mode independence — each synthetic fixture fires exactly one mode; removing it flags nothing for that mode (Criterion 2) | unit, three synthetic fixtures | `npx vitest run src/analytics/pace-quality.test.ts -t "mode independence"` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-02 | — | Dry-run composite reported in `30-CALIBRATION.md`; recount reproduces it from the shipped index without importing the classifier (Phase 27 D-03) | integration (script, real archive) | `node scripts/compute-elevation-recount.mjs` + `npx vitest run scripts/compute-elevation-recount.test.mjs` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-02 | T-30 V6 | `data/streams/` byte-unchanged after the calibration sweep — sha256 digest before/after printed into the report; script exits non-zero on mismatch (D-16) | integration (digest) | `node scripts/compute-elevation-calibration.mjs` + `npx vitest run scripts/compute-elevation-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-02 | — | No `fs` write target under `data/` in the new analytics code or either script (T-27-09 pattern) | unit (source scan) + `git status --porcelain data/` empty after both scripts run | `npx vitest run scripts/compute-elevation-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| — | — | — | ELEV-02 | — | Phase 27's `anySevere` composite stays byte-stable at 299/1,890 after this phase (D-06 regression) | regression | `node scripts/compute-pace-quality-recount.mjs --expect 299` | ✅ (re-run, not extended) | ⬜ pending |
| — | — | — | ELEV-02 | — | Pinned fixture properties (4556693525 min −282 m; 4745489664 drift −197.6 m at 0 m; 3149636661 worst 80.4 m/s) re-verify against the live archive | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ✅ extend (`assertExpectedProperties` switch) | ⬜ pending |

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
