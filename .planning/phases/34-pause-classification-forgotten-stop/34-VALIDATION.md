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
| PAUSE-01 | Four-class band assignment on gap-bearing intervals (both bands developer-declared per D-20/D-21, provenance asserted); hidden-pause/isolated-jump not-classifiable | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyPauses"` | ❌ W0 |
| PAUSE-02 | Additive index key + capped shard list | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pauses"` | ❌ W0 (extends existing) |
| PAUSE-03 | Merged-segment re-measurement, dated provenance | script (artifact) | PAUSE-03 generator exit 0, regenerated twice byte-identical | ❌ W0 |
| STOP-01 | Two-source union, itemised, timer-running scope | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyForgottenStop"` | ❌ W0 |
| STOP-02 | Declared near-zero threshold (D-20) with drift recorded as a measured non-issue; minimum duration still calibrated and selected by arbitration; walking-break controls asserted against their own window speeds | script (artifact) | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs` | ❌ W0 |
| STOP-03 | Excluded from `hasAnySevereSignal`; detail-view disclosure | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes"` | ✅ extend |
| SEG-05b (34 half) | Classifier reads detector via `pace-derivation.ts`, load-bearing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pause-classification"` | ✅ extend |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Matched count | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|---------------|--------|
| 34-12 T1 | 34-12 | 3 | PAUSE-01, STOP-02 | T-34-24 | Every plant enters its shape's population: `planted items = base items + plants`, watched RED on the HALT-1 code first | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "planted entry"` | record at run | ⬜ pending |
| 34-12 T3 | 34-12 | 3 | PAUSE-01, STOP-02 | T-34-25 | 24-cell reachability matrix: every shape can both pass and fail on both D-13 axes | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "reachability"` | record at run | ⬜ pending |
| 34-13 T1 | 34-13 | 4 | STOP-02 | T-34-28 | Declared stationary constant renders with provenance `developer-declared (D-20), not calibrated`; drift renders as a measured non-issue with live evidence | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "declared constant"` and `-t "drift non-issue"` | record at run | ⬜ pending |
| 34-13 T2 | 34-13 | 4 | PAUSE-01, STOP-02 | T-34-30, T-34-31 | Family G evidence-only (never reaches `selectShape`); `d20-basis` gate shown passing and failing; M/W gated on the declared value being present | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "evidence only"`, `-t "gates"`, `-t "exit contract"` | record at run | ⬜ pending |
| 34-13 T3 | 34-13 | 4 | STOP-02 | T-34-29 | Provenance chain for 0.5 binds CONTEXT text → generator source text → artifact line, watched RED from each side | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "provenance chain"` | record at run | ⬜ pending |
| 34-14 T1 | 34-14 | 5 | PAUSE-01 | T-34-33, T-34-37 | Declared boundary renders with provenance `developer-declared (D-21), not calibrated`; valley evidence is computed live and differs between unimodal and bimodal fixtures | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "declared boundary"` and `-t "valley evidence"` | record at run | ⬜ pending |
| 34-14 T2 | 34-14 | 5 | PAUSE-01, STOP-02 | T-34-36, T-34-39, T-34-40 | Family W evidence-only with finite bases; `d21-basis` both sub-checks shown failing plus stated-reason failures; every gate id PASS individually on the extended fixture; `strawman-<id>-passed` exits 1 for every family incl. M | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "evidence only"`, `-t "gates"`, `-t "exit contract"` | record at run | ⬜ pending |
| 34-14 T3 | 34-14 | 5 | PAUSE-01, STOP-02 | T-34-34 | Provenance chain over BOTH declared constants, plus the no-stray-literal guard for 0.5 and 2.2 | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "provenance chain"` (≥ 2 tests) | record at run | ⬜ pending |
| 34-06 T1 | 34-06 | 6 | PAUSE-01, STOP-02 | T-34-22, T-34-26 | Fourth run: strawmen FAIL first, Family M arbitrates, every gate quoted with its measured value; HALT writes 34-06-HALT-4.md and ships nothing | script (artifact) | `npm run compute-pause-classification-calibration` exit 0 or 1, artifact regenerated twice byte-identical | n/a (artifact) | ⬜ pending |
| 34-06 T2 | 34-06 | 6 | STOP-02 | T-34-19, T-34-21 | Constants shipped FROM the artifact under the two-sided equality guard; no control flagged for its walking pace, asserted strictly below each control's OWN window speed parsed from 34-WALKING-BREAK-EVIDENCE.md, with the CAN FAIL direction in the same test | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "shipped from 34-CALIBRATION"` and `-t "walking-break control"` | record at run | ⬜ pending |

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
