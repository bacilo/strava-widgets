---
phase: quick-261127-gha
plan: 01
status: complete
requirements: [QUICK-261127-gha]
commits: [edf79228, 2adb0619]
---

# Quick 261127-gha: Readable chart tooltip titles

Every linear-x Chart.js chart now has a `tooltip.callbacks.title` using a pure, UTC, DOM-free formatter module (`chart-tooltip-title.ts`). Resolves Phase 23 Finding 6.

## Chart inventory outcome

| Chart | Title shown |
|---|---|
| Volume (empty + zoom branch) | Week of 23 Nov 2026 / November 2026 / 2026 |
| Cadence & HR bands | September 2025 |
| Training Load (empty + zoom branch) | Mon 23 Nov 2026 |
| Records PR evolution | 14 Mar 2025 |
| Activity detail bands | 3.45 km / 12:34 / 1:02:34 (reads live xAxisMode; prefers the primary dataset's item) |
| YoY, Gear, widgets (category x) | untouched |

`trends-tick-format.ts` change is comment-only.

## Verification
- Formatter tests: 9 pass, in default TZ and TZ=America/Los_Angeles.
- Wiring tests (11): 11 failed / 11 total at edf79228 (pre-wiring code, scratchpad worktree, node_modules symlinked), 11 passed after. No `-t` filter used. Worktree removed and pruned; `git worktree list` shows only the primary checkout.
- `npm run test:logic`: 127 files, 4462 tests passed. `npx tsc --noEmit` clean. No changes under data/ or dist/.

## Commits
- edf79228 formatters + tests
- 2adb0619 wiring into trends/records/detail charts
- wiring test commit (third, see git log)

## Deviations
None. The HEAD-fail probe used edf79228 (formatter commit, before wiring) as the pre-change baseline since wiring was already committed by then.
