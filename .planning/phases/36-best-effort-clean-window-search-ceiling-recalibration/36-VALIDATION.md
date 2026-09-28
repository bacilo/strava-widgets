---
phase: 36
slug: best-effort-clean-window-search-ceiling-recalibration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-28
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `36-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing devDependency) |
| **Config file** | `vitest.config.ts` (existing, unmodified by this phase) |
| **Quick run command** | `npx vitest run <file> -t "<name>"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s (baseline measured 2026-09-28: 101 files / 3,676 tests, exit 0) |

---

## Sampling Rate

- **After every task commit:** targeted `-t` filtered run for the file(s) touched (seconds)
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd-verify-work`:** full suite green, `tsc --noEmit` clean, `verify-dashboard` green, all three generated artifacts regenerated-twice-and-diffed, PR-09 sha256 signed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Populated by `/gsd-plan-phase` once task IDs exist. Rows below are the requirement→behavior
> map from RESEARCH.md; the planner MUST bind each to a concrete task ID and carry the
> `Matched` column.

| Task ID | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Matched | Status |
|---------|------|------|-------------|----------|-----------|-------------------|-------------|---------|--------|
| TBD | TBD | TBD | PR-06 | d-rebased splice fabricates a faster window than partition on `3475740390`@400m | unit/regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "splice fabricates"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-06 | `findBestEffort` with `startIndex`/`endIndex` omitted reproduces full-array behavior | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "bounds"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-06 (D-01) | whole-span vs burst-only cut lists agree archive-wide | integration | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "equivalence"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-07 (D-05/D-06) | `contaminated` set when a clean window exists; `demotion` set when none does | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "contaminated"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-07 (D-08) | `3475725842`@400m: `demotion === null`, `contaminated.guard === 'unreliable-segment'` | regression, real fixture | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "3475725842"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-08 (D-03) | every ranked effort's interval overlaps no detected segment (archive-wide) | integration | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "overlap invariant"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-08 (D-14) | contaminated timings never enter the ceiling population | unit, synthetic | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "ceiling population"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-08 | "no iteration to convergence" audit still green **with zero edits** | existing regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` | ✅ exists | — | ⬜ pending |
| TBD | TBD | TBD | PR-09 (D-09) | `36-CEILING-RECALIBRATION.md` regenerates byte-identically twice | idempotence | regenerate ×2 + `diff` against committed | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-09 (D-13) | third-leg recount fails on a planted broken partitioner before being trusted | guard, watched-failing-first | `npx vitest run scripts/compute-clean-window-recount.test.mjs -t "planted"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-09 | three-way reconciliation agrees on the live archive | integration | `node scripts/compute-clean-window-recount.mjs` (exit code) | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | PR-09 | three scoping activities' 400m efforts pinned as regression fixtures | regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "scoping activities"` | ❌ W0 | — | ⬜ pending |
| TBD | TBD | TBD | SEG-05b | stubbing the detector to `segments: []` collapses the search to today's behavior | unit, load-bearing proof | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "stubbed segments"` | ❌ W0 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**`Matched` column is mandatory.** A `vitest -t` filter matching **zero** tests exits 0 and is
indistinguishable from a pass. Every `-t` row must record the matched test count when run. The
rows above do not exist yet — a premature `-t` run against them matches 0 and MUST NOT be
recorded as green.

---

## Independent-Value Discriminators

This project has twice shipped a Critical past a guard that only checked the changed code against
itself (Phase 23 extent, Phase 32 cross-segment conservation). Every guard below asserts against a
value derived **outside** the code it is guarding:

| Guard | Independent value it asserts against |
|-------|--------------------------------------|
| D-03 overlap invariant | the **detector's** own `classifyGapsWithSegments` segment output — never the partition code's internal state |
| D-13 third-leg recount | its own per-window outlier statistic, computed fresh from the raw committed stream; may not import the search or the detector |
| D-14 ceiling-population demo | a manually computed expectation from the synthetic fixture's own known-clean speed, not the production code's output |
| PR-09 regression fixtures | 3:20 / 3:21 / 3:22 reproduced from raw committed streams via `findBestEffort` alone (all three verified against the probe 2026-09-28) |

---

## Two-Direction Reachability

Every row must be checked in **both** directions before it is relied on — unfailable (vacuous) and
unpassable are both live failure modes on this phase, and two rows were already caught as traps
during discussion.

| Row | CAN FAIL (concrete input) | CAN PASS (concrete input) |
|-----|---------------------------|---------------------------|
| PR-06 splice-fabricates-faster | `3475740390`@400m d-rebased: 116.6s < honest 119.6s — verified, row does fail as designed | correct partition yields 119.6s, not 116.6s |
| PR-08 overlap invariant | widen one sub-interval by 1 index past a segment boundary | correctly-bounded partition produces no overlapping ranked interval |
| D-08 precedence fixture | stub `isPlausible` to evaluate the RAW figure on `3475725842`@400m → `demotion === null` fails | correct impl evaluates the clean figure; `demotion` stays `null` |
| D-13 planted-partitioner | stub the partition to return a window spanning a segment | real shipped document has no such window |
| SEG-05b stubbed segments | stub `classifyGapsWithSegments` → `segments: []`; every `contaminated` must go `null` and results equal today's | with real segments, `3475740390`@400m `contaminated` is non-null |

### Known unsatisfiable row — do not plan it as written

**D-08's literal bound** ("a real activity that trips both the unreliable-segment guard AND an
absolute guard") is **unsatisfiable for the D-06 no-clean-window case**: 0 of 440 no-clean-window
occurrences independently fail an absolute guard on the live archive. It **is** satisfiable for the
**moved** case — 31 real pairs, e.g. `3475725842`@400m (raw 28.19 m/s vs recorded `max_speed`
6.08 m/s) and `3475713251`@400m (raw 14.75 m/s vs world-record 9.30 m/s). Plan the moved case; do
not build a synthetic fixture for the no-clean case.

---

## Wave 0 Requirements

- [ ] New describe blocks in `src/analytics/compute-best-efforts.test.ts` — PR-06/07/08/09, SEG-05b
- [ ] New bounds tests in `src/analytics/best-effort-utils.test.ts` — `startIndex`/`endIndex`
- [ ] `scripts/compute-clean-window-recount.test.mjs` — D-13's planted-partitioner guard
- [ ] Idempotence harness for `36-CEILING-RECALIBRATION.md` (regenerate ×2, diff)

Framework already installed — no install step needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR-09 sha256 signature | PR-09 | Requires the developer's own sign-off against a named archive snapshot; cannot be self-asserted by the code under test | Regenerate artifacts **after the last origin merge** (MERGE-01), then sign the recorded sha256 |
| D-18 browser evidence from the served build | D-18 | Gestures and rendered output need a human; viewport clamps 500..941 | Hard-reload after every fixture edit; verify the served digest, not the build log |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Every `-t` row records its matched test count
- [ ] Every guard demonstrated red on a planted violation before it may pass
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
