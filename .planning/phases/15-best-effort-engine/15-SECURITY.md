# Security Audit — Phase 15: Best-Effort Engine

**Audited:** 2026-08-10
**Plans covered:** 15-01, 15-02, 15-03, 15-04
**Threats registered:** 17 (register authored at plan time)
**Threats closed:** 17/17
**Threats open:** 0/17
**Unregistered attack surface:** none found in SUMMARY.md files (no `## Threat Flags` sections present in any of the four plan summaries)

This document is the permanent security record for Phase 15. It was produced by re-verifying every declared mitigation directly against the implemented code and, where applicable, by re-running the relevant tests and the real archive output — not by trusting plan/summary prose.

---

## Verification Method

| Disposition | How it was checked |
|---|---|
| `mitigate` | Grep/read of the cited implementation file(s) for the actual control, cross-checked against the named unit/integration tests actually passing |
| `accept` | Confirmed no code control exists (by design) and recorded the risk in the Accepted Risks Log below — the log entry itself is what closes the threat |

Tests were executed live during this audit:
- `npx vitest run src/analytics/best-effort-utils.test.ts src/analytics/compute-best-efforts.test.ts src/analytics/best-effort-fixtures.test.ts` → **65/65 passing**
- Real `data/stats/best-efforts.json` re-validated live: `0` implausible efforts across all emitted efforts against the world-record ceiling table; totals reconcile with the manifest (`activitiesConsidered: 1842`, `skippedNoStream: 25`, `skippedUnreadable: 0`).
- `package.json` diff across all Phase 15 commits confirmed: zero new dependencies added (only a new npm script entry).

---

## Threat Verification

| Threat ID | Plan | Category | Component | Disposition | Status | Evidence |
|---|---|---|---|---|---|---|
| T-15-01 | 15-01 | Tampering | `best-effort-utils.validateStreamSeries` | mitigate | CLOSED | `src/analytics/best-effort-utils.ts:50-91` — rejects length mismatch, non-finite values, decreasing `t`/`d` with named reasons, in that order, before any sweep runs. 8 dedicated tests in `src/analytics/best-effort-utils.test.ts:80-140` (exceeds the 5-test plan minimum), all passing. |
| T-15-04 | 15-01 | Tampering | `best-effort-utils.isPlausible` | mitigate | CLOSED | `src/analytics/best-effort-utils.ts:140-164` — drops efforts exceeding `max_speed * MAX_SPEED_MARGIN (1.02)` or `WORLD_RECORD_SPEED_MPS[key]`, reason string names both numbers via `.toFixed(2)`. 6 tests across `isPlausible — max_speed guard`, `— max_speed unavailable`, `— world-record ceiling` blocks (`best-effort-utils.test.ts:142-188`), all passing. |
| T-15-03 | 15-01 | DoS | `best-effort-utils.findBestEffort` | mitigate | CLOSED | `src/analytics/best-effort-utils.ts:112-115` — end pointer `j` declared once outside the `i` loop, only ever advanced (`if (j < i + 1) j = i + 1;`), never reset. 200,000-sample synthetic series test (`best-effort-utils.test.ts:34-49`) asserts completion `<2000ms`, passing. |
| T-15-SC | 15-01 | Tampering | npm installs | accept | CLOSED | See Accepted Risks Log #1. Confirmed via `git log -p -- package.json`: no dependency changes in plan 01's commits (`559b4a3`, `8b039f1`, `b4254a5`, `29b196c`, `749028e`). |
| T-15-01 | 15-02 | Tampering | `computeActivityEfforts` series intake | mitigate | CLOSED | `src/analytics/compute-best-efforts.ts:68-71` — `validateStreamSeries(t, d)` runs first; on failure returns `{ efforts: [], rejected: [], eligibleTargets: [], seriesError }` before any sweep call. Malformed-series tests in `compute-best-efforts.test.ts` pass (25/25 total file). |
| T-15-02 | 15-02 | DoS | `computeBestEfforts` per-activity loop | mitigate | CLOSED | Outer per-activity `try`/`catch` at `compute-best-efforts.ts:180-231` (`console.warn` + `skippedUnreadable++` + `continue`); inner per-target `try`/`catch` inside `computeActivityEfforts` at lines 82-116. Corrupt-stream tmpdir test in the `archive orchestration` describe block passes and asserts the run still returns efforts for other seeded activities. |
| T-15-04 | 15-02 | Tampering | rejection handling | mitigate | CLOSED | Every dropped effort recorded via `rejected.push({ activityId, distance, reason })` at `compute-best-efforts.ts:94,110-114,202-205`; echoed to console at lines 308-316 (capped at 50 rows + `... and N more` tail per `REJECTED_CONSOLE_CAP`). |
| T-15-05 | 15-02 | Info Disclosure | `data/stats/best-efforts.json` | accept | CLOSED | See Accepted Risks Log #2. Confirmed `.gitignore:10` contains `data/stats/`; `git status --porcelain data/stats` empty during this audit. |
| T-15-SC | 15-02 | Tampering | npm installs | accept | CLOSED | See Accepted Risks Log #1. No `package.json` changes in plan 02's commits. |
| T-15-02 | 15-03 | DoS | `daily-refresh.yml` best-effort step | mitigate | CLOSED | `.github/workflows/daily-refresh.yml:76-83` — `Compute best efforts` step carries `continue-on-error: true`; paired `Warn on best-effort failure` step conditioned on `steps.best-efforts.outcome == 'failure'`. |
| T-15-03 | 15-03 | DoS | real archive run in CI budget | mitigate | CLOSED | Live re-run during this audit confirms the underlying O(n) guarantee (T-15-03/15-01) holds at scale; plan-03 SUMMARY records the actual real-archive run at ~1.0s wall-clock, well under the 120s gate. No persisted automated regression test re-checks this on every future CI run — see Note below. |
| T-15-06 | 15-03 | DoS | commit step `file_pattern` | mitigate | CLOSED | `.github/workflows/daily-refresh.yml:98` — `file_pattern: 'data/activities/*.json data/sync-state.json data/geo/*.json data/streams/*.json'`, confirmed unchanged and excludes `data/stats/`. |
| T-15-04 | 15-03 | Tampering | real-run output validation | mitigate | CLOSED | Re-executed live during this audit against the current `data/stats/best-efforts.json`: `implausible efforts: 0` across all 8,806 emitted efforts checked against the world-record ceiling table; ranking-order check logic present and previously verified in plan-03 SUMMARY. |
| T-15-SC | 15-03 | Tampering | npm installs | accept | CLOSED | See Accepted Risks Log #1. `package.json` diff for plan 03 (`eb30168`) adds only a script entry, no dependency. |
| T-15-07 | 15-04 | Tampering | fixture expected values | mitigate | CLOSED | `src/analytics/best-effort-fixtures.test.ts:1-21` doc comment states editing an `expectedDurationSec` to pass a test is a correctness regression; every `FIXTURES` row (lines 56-105) carries a non-empty `reference` string naming platform + read date; guarded by its own test (`best-effort-fixtures.test.ts:173-177`), passing. |
| T-15-08 | 15-04 | Repudiation | fixture provenance | mitigate | CLOSED | `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` committed (`788ea04`, `9dfe9f5`) alongside the fixture suite, with per-row Notes and a "Verification Notes" section recording provenance and caveats (e.g. poor-device flag on rows 1-2). |
| T-15-01 | 15-04 | Tampering | fixture suite archive reads | mitigate | CLOSED | `best-effort-fixtures.test.ts:129` calls `computeActivityEfforts`, which runs `validateStreamSeries` first (`compute-best-efforts.ts:68-71`) — a corrupted committed stream surfaces as a named `seriesError`, not a silent bad tolerance failure. |

**Totals: 17/17 CLOSED, 0 OPEN.**

---

## Note on T-15-03 (15-03) — non-persisted regression protection

T-15-03 in plan 03 ("real archive run inside CI budget") was verified as a one-time gate during plan execution — the real run completed in ~1.0s against a 120s threshold, and this audit re-confirmed the algorithm's O(n) guarantee still holds (`findBestEffort`'s forward-only pointer, unit-tested at 200,000 samples). However, there is no persisted automated test that re-checks real-archive wall-clock runtime on every future CI run; the only standing protection against a future algorithmic regression (e.g., a change that resets the end pointer) is the synthetic 200k-sample timing test in `best-effort-utils.test.ts`, which is a proxy for, not a direct measurement of, the real-archive scenario. This is not a blocker — the disposition was satisfied as declared (a one-time verification gate, not a continuous CI gate) — but it is recorded here as a residual gap for future maintainers.

---

## Unregistered Flags

None. No `## Threat Flags` section was found in any of `15-01-SUMMARY.md`, `15-02-SUMMARY.md`, `15-03-SUMMARY.md`, or `15-04-SUMMARY.md`. The one non-trivial deviation surfaced during implementation (the `activitiesConsidered` totals-definition bug fixed in plan 03, commit `6e2bdeb`) is a correctness fix, not new attack surface, and does not map to any STRIDE category.

---

## Accepted Risks Log

### 1. T-15-SC — npm installs (all 4 plans)
**Category:** Tampering (supply chain)
**Disposition:** accept
**Rationale:** Phase 15 adds zero new npm packages across all four plans. `package.json`'s `dependencies`/`devDependencies` blocks are unchanged from pre-Phase-15 state; the only `package.json` change across the phase is a new `scripts` entry (`compute-best-efforts`). No new registry surface is introduced, so no package legitimacy audit or slopcheck applies.
**Verified:** `git log -p -- package.json` across all Phase 15 commits (`559b4a3`, `8b039f1`, `b4254a5`, `29b196c`, `749028e`, `380792e`, `498705e`, `5cdb609`, `144f2a9`, `eb30168`, `6e2bdeb`, `788ea04`, `9dfe9f5`, `027dc25`) shows only the one script-entry addition; current `package.json` `dependencies`/`devDependencies` match pre-Phase-15 baseline.

### 2. T-15-05 — Information Disclosure via `data/stats/best-efforts.json`
**Category:** Information Disclosure
**Disposition:** accept
**Rationale:** The document holds only durations, paces, and second-offsets already derivable from the committed `data/streams/` and `data/activities/` archive — no positions, no secrets, no third-party credentials. The file is gitignored (`.gitignore:10`, `data/stats/`) and therefore never committed to the repository and never exposed via the public Pages deploy artifact set.
**Verified:** `.gitignore:10` contains `data/stats/`; `git status --porcelain data/stats` produced no output during this audit, confirming the file (which exists on disk from the real run) is untracked.

---

## Residual Observations (non-blocking, informational)

- The real-archive rejection list (34 rows, documented in `15-03-SUMMARY.md`) provides genuine positive evidence the `isPlausible` guard (T-15-04) is functioning against real corrupted-stream data — e.g. activity `5059213289` at an implied 903 m/s was correctly rejected by the `max_speed` guard.
- Activity `5059204779`, flagged in the plan as a "known-bad" archive record (10.80 km / 20:16 moving-time discrepancy at the activity-summary level), produced no rejections because the guard operates on stream-derived implied speed, not on the activity summary's own distance/duration fields. This is consistent with the guard's declared design (T-15-04 operates on `t`/`d`, not on `distance`/`moving_time`) and is not a gap in the declared mitigation.
- A follow-up feature request (manual activity exclusion from PR calculations, `15-04-SUMMARY.md`) was correctly deferred to Phase 18 and is out of scope for this audit.

---

SECURITY.md: `.planning/phases/15-best-effort-engine/SECURITY.md`
