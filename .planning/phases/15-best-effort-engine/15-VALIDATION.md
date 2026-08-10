---
phase: 15
slug: best-effort-engine
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
updated: 2026-08-10
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (already installed, already the only test framework in this repo) |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `environment: 'node'`, `globals: true`) |
| **Quick run command** | `npx vitest run src/analytics/best-effort-utils.test.ts src/analytics/compute-best-efforts.test.ts src/analytics/best-effort-fixtures.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~8 s quick, ~25 s full suite (136 existing tests plus this phase's additions) |

No framework install is required. No new npm packages are introduced anywhere in this phase.

---

## Sampling Rate

- **After every task commit:** Run the quick run command (scoped to the files that exist at that point)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green, plus `npx tsc --noEmit` and the real-archive gate in 15-03 Task 2
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | REC-01 | — | N/A (types only) | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | REC-01 | T-15-01, T-15-03 | Malformed series (length mismatch, non-finite, decreasing `t`/`d`) rejected with a named reason before the sweep; sweep stays O(n) | unit | `npx vitest run src/analytics/best-effort-utils.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | REC-01 | T-15-04 | Effort above `max_speed × 1.02` or the world-record ceiling dropped with a numeric reason; falsy `max_speed` degrades to the ceiling instead of rejecting everything | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "isPlausible"` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | REC-01 | T-15-01, T-15-04 | Per-target isolation: one implausible distance dropped, siblings survive; malformed series returns `seriesError` instead of NaN durations | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | REC-01 | T-15-02, T-15-05 | Corrupt stream file warns, increments `skippedUnreadable`, run continues; output written atomically to gitignored `data/stats/` | integration (tmpdir) | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "archive orchestration"` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 3 | REC-01 | T-15-02, T-15-06 | CI step is `continue-on-error`; gitignored `data/stats/` stays out of the commit `file_pattern` | smoke (CLI) | `npm run build && node dist/index.js help \| grep -q "compute-best-efforts"` | ✅ | ⬜ pending |
| 15-03-02 | 03 | 3 | REC-01 | T-15-03, T-15-04 | Real archive run reconciles with the manifest, every effort under its world-record ceiling, under 120 s | integration (real data) | `node dist/index.js compute-best-efforts && node -e "<totals + ceiling + ranking gates, see 15-03 Task 2>"` | ✅ | ⬜ pending |
| 15-04-01 | 04 | 4 | REC-01 | T-15-08 | Candidate provenance recorded in a committed worksheet | script gate | `node -e "<candidate-row count and coverage gate, see 15-04 Task 1>"` | ✅ | ⬜ pending |
| 15-04-02 | 04 | 4 | REC-01 | T-15-07 | Reference values come from the developer's own Strava/Garmin data, never from the engine's output | manual checkpoint | — (blocking `checkpoint:human-verify`) | n/a | ⬜ pending |
| 15-04-03 | 04 | 4 | REC-01 | T-15-07, T-15-01 | Computed efforts match externally-reported times within 2%; suite runs without the gitignored output present | integration (fixture) | `npx vitest run src/analytics/best-effort-fixtures.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: no three consecutive tasks lack an automated verify — the only non-automated task in the phase is 15-04-02, and it is immediately followed by 15-04-03's fixture suite.

---

## Wave 0 Requirements

- [ ] `src/analytics/best-effort-utils.test.ts` — created by 15-01 Task 2, extended by Task 3 (sweep, interpolation, pause gaps, series validation, both guards, PR marking, ranking)
- [ ] `src/analytics/compute-best-efforts.test.ts` — created by 15-02 Task 1, extended by Task 2 (pre-filter, lowConfidence, per-target isolation, tmpdir orchestration)
- [ ] `src/analytics/best-effort-fixtures.test.ts` — created by 15-04 Task 3, blocked on the 15-04 Task 2 checkpoint for its expected values
- [x] No framework install needed — Vitest is already configured and used identically by `src/streams/*.test.ts` and `src/analytics/streak-utils.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Externally-reported best-effort times for the fixture activities | REC-01 | The reference values exist only inside the developer's Strava and Garmin Connect accounts; no API access is available (Strava paywalled its API in June 2026) and no agent can read them (RESEARCH.md Open Question 1) | Open each row's activity in `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md`, read the platform's own "Best Efforts" value for that distance, enter it as `MM:SS`, or write `not available` |

Once collected, the values are frozen into `best-effort-fixtures.test.ts` and every subsequent run of that assertion is fully automated.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (15-04-02 is the single deliberate exception, justified above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
