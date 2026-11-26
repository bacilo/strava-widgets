---
phase: quick-261126-w9z
plan: 01
subsystem: testing
tags: [vitest, mutation-probe, consolidate, publish-gate, guards]
requirements: [37.2-WR-01, 37.2-WR-04]
key-files:
  modified:
    - src/exports/consolidate.test.ts
    - scripts/verify-dashboard-publish-quality-keys.test.mjs
metrics:
  completed: 2026-11-26
---

# Quick 261126-w9z: Harden 37.2 vacuous guards Summary

Two test-only edits make the phase 37.2 WR-01 and WR-04 guards able to fail. A decoy archive record puts a near-match inside the exact-epoch and by-id pins. 22 new mid-row and last-row planted removals cover the quality keys. No production file changed.

## Commits

- 3719b20f: WR-01, consolidate.test.ts
- 884a0aa8: WR-04, verify-dashboard-publish-quality-keys.test.mjs

## What changed

- **WR-01:** a decoy archive record 555 at 2011-08-16T18:56:02Z is written into the fixture's `activitiesDir`, not into the shared `fixture()`. It sits 30 s after record 111, and each test asserts that delta (30) independently.
  - The exact-epoch pin now uses the decoy. Its readdir length goes 4 to 5, and it also asserts `888.json` is never imported.
  - New twin 'resolves a strava id match before the near rule' pins the by-id branch.
- **WR-04:** `it.each` over EMITTED_SIGNAL_KEYS x {mid, last} gives 22 cases. Each deletes `activities[idx].quality[key]` through `withMutation` in the mkdtemp shadow tree. Each asserts idx > 0, mid < last, id != rowId, and that row 0 is untouched. The gate must exit non-zero naming that row id and key.
- **Case G** in verify-dashboard-publish-guard.test.mjs is left unmodified. It writes the real dist, so extending it would add real-dist writes. Its property (a partial rollout of `quality.elevation`) is subsumed by the new cases, because `elevation` is an emitted key and the cases cover the mid and last rows in a shadow tree.

## Red evidence (scratch copies only)

| Mutant | Command | Matched | Failing | Total |
|---|---|---|---|---|
| Baseline (scratch) | consolidate.test.ts | n/a | 0 | 27 pass |
| A: near, then id, then epoch | `-t "before the near rule"` | 2 | 2 | 27 (25 skipped) |
| A | whole file | n/a | 2 (both new pins) | 27 |
| B: id, then near, then epoch | `-t "before the near rule"` | 2 | 1 (exact-epoch only; by-id passes) | 27 (25 skipped) |
| B | whole file | n/a | 1 | 27 |
| Baseline (scratch) | both gate suites | n/a | 0 | 81 pass |
| `parsed.activities.slice(0, 1)` | `-t "row fails and names that row"` (quality-keys file) | 22 | 22 | 69 (47 skipped) |
| slice(0, 1) | both gate suites unfiltered | n/a | 22, all new cases | 81 (59 pass) |

Primary checkout, green: `-t "before the near rule"` matched 2 and passed 2. The whole consolidate.test.ts file passed 27. Both gate suites passed 81 with dist present and nothing skipped.

## Deviations

- Mutant A's whole-file run failed only the 2 new pins. The log-format test that the verification report expected to fail incidentally did not fail here.
- The plan cites a 71/71 green count against the slice(0, 1) mutant. Before this task the two gate suites held 59 tests (81 minus the 22 added), so the "before" figure is 59/59 on this tree. The mismatch is a stale plan figure and does not affect the result.

## Safety checks

- Probes ran only in scratchpad copies (`w9z-probe`, `w9z-gate-probe`), and both were removed.
- `git diff --quiet HEAD -- src/exports/consolidate.ts scripts/verify-dashboard-publish.mjs` is clean.
- `git status` shows no changes under dist/ or data/.
- `npm run test:logic`: 125 files, 4442 tests passed, 0 failed.

## Self-Check: PASSED

Both commits exist, both test files are modified as planned, and no production file differs from HEAD.
