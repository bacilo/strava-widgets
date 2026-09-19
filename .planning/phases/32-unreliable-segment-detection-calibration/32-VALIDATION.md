---
phase: 32
slug: unreliable-segment-detection-calibration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-19
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`, `fileParallelism: false`) |
| **Quick run command** | `npx vitest run src/analytics/unreliable-segments.test.ts scripts/compute-unreliable-segment-recount.test.mjs scripts/compute-unreliable-segment-calibration.test.mjs` (the `.test.mjs` files import `../dist/`, so run `npm run build` first) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds (full suite; archive-scanning calibration tests dominate) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, the calibration artifact regenerated twice with zero diff, and the recount shown failing against a deliberately-broken detector before passing
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Task IDs are filled by the planner. Every `-t` row MUST record the matched test count when run — a filter matching 0 tests exits 0 and is indistinguishable from a pass.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-02-T1/T2, 32-08-T1 | 02, 08 | 1, 5 | SEG-01 | T-32-04 | Non-`ok` `t`/`d`, malformed gaps or params → fresh empty result, never throws (`validateStreamSeries`); folded run-level scoring does not fire on full/zero aliasing | unit | `npx vitest run src/analytics/unreliable-segments.test.ts` and `-t "decimation"` (record matched count) | ❌ W0 | ⬜ pending |
| 32-03-T1/T2, 32-07-T2, 32-08-T1/T2 | 03, 07, 08 | 1, 4, 5 | SEG-02 | T-32-06, T-32-16 | Recount never imports the detector; watched failing vs a deliberately broken detector | unit + script | `npx vitest run src/analytics/unreliable-segments.test.ts -t "3475724402"` (record matched count), `npx vitest run scripts/unreliable-segment-recount-crosscheck.test.mjs scripts/compute-unreliable-segment-recount.test.mjs`, and `node scripts/compute-unreliable-segment-recount.mjs`. Asserts that no burst is unmerged or labelled isolated and that per-segment metres/seconds equal the independent table. The scoping probe's 30/18/1,694 m/106 s/707 s is a reconciliation reference, NOT an asserted value | ❌ W0 | ⬜ pending |
| 32-08-T1 | 08 | 5 | SEG-03 | T-32-18 | Extents derived in-test from raw t/d | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "mechanism"` (record matched count). 3475734189 t=1353–1360 is hidden-pause; the retained 3475740390 jumps (all five unless the 32-05 decision amends criterion 3) are isolated-jump | ❌ W0 | ⬜ pending |
| 32-05-T1/T2, 32-06-T1/T2, 32-07-T1, 32-09-T1 | 05, 06, 07, 09 | 2, 3, 4, 6 | SEG-04 | T-32-10, T-32-11, T-32-13 | Anti-quota: no flagged count before the statistic is chosen; D-13 strawman watched failing | script | `node scripts/compute-unreliable-segment-calibration.mjs` run twice, with `git diff --exit-code` on the artifact; `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| 32-04-T1/T2 | 04 | 2 | SEG-05a | T-32-08, T-32-09 | Importer, arithmetic, structural and param-key confinement | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "SEG-05a"` (record matched count). A planted second implementation is watched red first (in-suite and on the real tree) | ✅ extend | ⬜ pending |
| 32-01-T2, 32-09-T1 | 01, 09 | 1, 6 | D-17 | T-32-01, T-32-02, T-32-03 | Stream byte-identity: a digest change fails, new files are tolerated, append-only | unit | `npx vitest run scripts/compute-stream-checksums.test.mjs`. A planted one-byte edit is watched red, then restored, and `git status --porcelain data/streams` is empty | ❌ W0 | ⬜ pending |
| 32-09-T2 | 09 | 6 | D-12 | T-32-20, T-32-21 | Local-only; no `.test.mjs`; graceful absence | manual (local) | `node scripts/validate-unreliable-segments-1hz.mjs --as-of <date>` twice with zero diff; `UNRELIABLE_1HZ_EXPORT_ROOT=/nonexistent …` exits 0 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/analytics/unreliable-segments.ts` + `.test.ts` — SEG-01/02/03
- [ ] `scripts/compute-unreliable-segment-recount.mjs` + `.test.mjs` — SEG-02 independent table (D-15)
- [ ] `scripts/compute-unreliable-segment-calibration.mjs` + `.test.mjs` — SEG-04
- [ ] Calibration artifact of record in the phase directory — SEG-04
- [ ] Streams-immutability manifest `data/stream-checksums.json` + `scripts/compute-stream-checksums.test.mjs` gate (outside `data/streams/`, so it cannot collide with `data/streams/manifest.json`) — D-17
- [ ] `scripts/unreliable-segment-recount-crosscheck.test.mjs` — SEG-02 `npm test`-time detector vs recount agreement
- [ ] `scripts/validate-unreliable-segments-1hz.mjs` — D-12, deliberately WITHOUT a `.test.mjs` sibling (vitest collects `scripts/**/*.test.mjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 1 Hz FIT cross-check of detected segments | SEG-04 / D-12 | Needs local-only `export_data/`, excluded from CI by design | Run `node scripts/validate-unreliable-segments-1hz.mjs` on the primary checkout; commit its dated findings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
