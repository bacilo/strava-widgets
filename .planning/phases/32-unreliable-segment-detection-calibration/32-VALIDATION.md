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
| **Quick run command** | `npx vitest run src/analytics/unreliable-segments.test.ts scripts/compute-unreliable-segment-recount.test.mjs scripts/compute-unreliable-segment-calibration.test.mjs` |
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
| TBD | TBD | TBD | SEG-01 | — | Non-`ok` `t`/`d` → empty result, never throws (`validateStreamSeries`) | unit | `npx vitest run src/analytics/unreliable-segments.test.ts` (record matched count) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEG-02 | — | N/A | unit + script | `npx vitest run src/analytics/unreliable-segments.test.ts -t "3475724402"` (record matched count) and `node scripts/compute-unreliable-segment-recount.mjs` — asserts no burst unmerged or labelled isolated and per-segment metres/seconds equal the independent table; the scoping probe's 30/18/1,694 m/106 s/707 s is a reconciliation reference, NOT an asserted value | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEG-03 | — | N/A | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "mechanism"` (record matched count) — 3475734189 t=1353–1360 hidden-pause; 3475740390 all five jumps isolated-jump | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEG-04 | — | N/A | script | `node scripts/compute-unreliable-segment-calibration.mjs` run twice, `git diff --exit-code` on the artifact; `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEG-05a | — | N/A | unit | `npx vitest run src/analytics/pace-single-source.test.ts` — planted second implementation watched red first | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | D-17 | — | Stream byte-identity: digest change fails, new files tolerated | unit | `npx vitest run <streams-immutability test>` — planted one-byte edit watched red, restored, `git status --porcelain data/streams` empty | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/analytics/unreliable-segments.ts` + `.test.ts` — SEG-01/02/03
- [ ] `scripts/compute-unreliable-segment-recount.mjs` + `.test.mjs` — SEG-02 independent table (D-15)
- [ ] `scripts/compute-unreliable-segment-calibration.mjs` + `.test.mjs` — SEG-04
- [ ] Calibration artifact of record in the phase directory — SEG-04
- [ ] Streams-immutability manifest + vitest gate (must not collide with `data/streams/manifest.json`) — D-17
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
