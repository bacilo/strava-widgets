---
phase: 34
slug: pause-classification-forgotten-stop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-22
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `34-RESEARCH.md` § Validation Architecture. Task IDs are filled once plans exist.

---

## The two rules this contract enforces (carried from `33-VALIDATION.md`)

**Rule 1 — every `-t` row records its matched test count.** A vitest name filter that matches zero
tests exits 0 and cannot be told apart from a pass. A row with no recorded matched count > 0 is not green.

**Rule 2 — every guard is watched failing first.** A never-widen guard, the D-18 independent
recount and the D-13 insensitivity check must each be shown failing against a planted violation
(widened composite, deliberately broken classifier, circular strawman) before any passing run counts.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (configured; no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` (`.test.mjs` files import `../dist/` — run `npm run build` first) |
| **Full suite command** | `npm test` (Phase 33 close: 93 files / 3,102 tests green — re-confirm fresh at Wave 0) |
| **Estimated runtime** | ~120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched files> -t "<fragment>"`, matched count recorded (Rule 1)
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** full suite green, and every calibration/recount artifact regenerated twice byte-identical. The D-18 recount must also have been watched failing first. Then run the human browser checkpoint against a digest-verified served build, hard-reloading after every fixture edit.
- **Max feedback latency:** 120 seconds

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PAUSE-01 | Four-class band assignment on gap-bearing intervals; hidden-pause/isolated-jump not-classifiable | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyPauses"` | ❌ W0 |
| PAUSE-02 | Additive index key + capped shard list | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pauses"` | ❌ W0 (extends existing) |
| PAUSE-03 | Merged-segment re-measurement, dated provenance | script (artifact) | PAUSE-03 generator exit 0, regenerated twice byte-identical | ❌ W0 |
| STOP-01 | Two-source union, itemised, timer-running scope | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyForgottenStop"` | ❌ W0 |
| STOP-02 | Calibrated threshold/duration; walking-break negative control | script (artifact) | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs` | ❌ W0 |
| STOP-03 | Excluded from `hasAnySevereSignal`; detail-view disclosure | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes"` | ✅ extend |
| SEG-05b (34 half) | Classifier reads detector via `pace-derivation.ts`, load-bearing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pause-classification"` | ✅ extend |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Matched count | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|---------------|--------|
| _filled once plans exist_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/analytics/pause-classification.ts` + `.test.ts` — classifier module (or extension per CONTEXT Claude's Discretion)
- [ ] `scripts/compute-pause-classification-calibration.mjs` + `.test.mjs` — walk/run valley, drift floor, STOP min-duration
- [ ] `scripts/compute-pause-classification-recount.mjs` — D-18 zero-import independent recount for 3475724402
- [ ] PAUSE-03 re-measurement generator (standalone or folded into calibration)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-12 walking-break negative control confirmed as a genuine walk | STOP-02 | Only the developer knows what happened on the run | Review research candidates 6286234101 / 3475733231 / 3475715143; confirm ≥1 before pinning |
| Pauses section + Quality Signals summary row render per-segment classes matching the D-18 table | PAUSE-01, PAUSE-02, STOP-03 | Rendered claim; gestures need a human | Digest-verified served build, hard-reload, read 3475724402's classes back against the recount artifact |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Every `-t` row has a recorded matched count > 0 (Rule 1)
- [ ] Every guard watched failing first (Rule 2)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
