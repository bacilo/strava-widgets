---
phase: 29-curation-review-queue
plan: 08
subsystem: curation
tags: [curation, review-queue, checkpoint, human-verify]

requirements-completed: []  # PENDING — CUR-01/CUR-02/CUR-03 tick only after Task 2's browser checkpoint passes.

# Metrics
duration: "Task 1 only (checkpoint pending)"
completed: null
---

# Phase 29 Plan 08: Human Browser Checkpoint — Queue Extent, Write Path, Origin Rejection, Guard Status Summary

**Task 1 (automated pre-flight) complete: full suite, build, guards and the independent recount all
green on the served build; Task 2 (the blocking human browser checkpoint) is PENDING — not yet
presented to the developer.**

## Status

**Task 1: COMPLETE.** All pre-flight commands executed, every exit code recorded, the day's four
discriminating numbers captured, and the server started successfully.

**Task 2: NOT STARTED.** This is a `checkpoint:human-verify` gate with `gate="blocking"`. Per the
plan's own governing rule, no requirement may be ticked and no row verdict may be recorded until the
developer performs the browser checkpoint (rows R1-R11) themselves. This executor did not attempt,
simulate, or self-approve any row.

## Evidence

**Measured today, not reused from planning** — `29-CONTEXT.md`'s figures (47/65/12/28) are a
2026-09-17 snapshot of an archive the nightly CI sync grows; this run re-measured live against the
current archive state and observed the same values, confirming no nightly sync landed between the
29-03 measurement and this checkpoint's pre-flight.

Measured 2026-09-18.

| Command | Result | Exit code |
|---|---|---|
| `git status --porcelain data/best-effort-exclusions.json` (before checkpoint) | empty | 0 |
| `npm test` | 82/82 test files, 2422/2422 tests passed | 0 |
| `npm run build` (`tsc`) | clean | 0 |
| `npm run build-widgets` | all widgets/pages/dashboard SPA built; private-artifact scan 7541 files scanned, none contain identity/health fields; curation-artifact scan: no curation-mode artifacts found | 0 |
| `npm run verify-dashboard` | 66 check(s) passed, 0 failure(s) | 0 |
| `node -e "...findCurationArtifacts('dist/widgets')..."` | `[]` | 0 |
| `node scripts/compute-pr-ceiling-recount.mjs` | PASS: recount agrees with the shipped totals; no disagreements found | 0 |

### The four discriminating numbers (2026-09-18)

| Symbol | Meaning | Value | Source |
|---|---|---|---|
| **N** | Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards) | **47** | `compute-pr-ceiling-recount.mjs` |
| **M** | of which already excluded | **12** | same run, "of which already excluded" line |
| **T** | total exclusions in `data/best-effort-exclusions.json` | **12** | same line (`12 of 12 total exclusions`); confirmed independently via `exclusions.length` |
| **E** | Recomputed demoted total (effort-level, own arithmetic) | **65** | same run (world-record 19, max-speed 15, ceiling 31) |
| **C** | ceiling-guard-only activity count (decoy) | **28** | `node -e` sweep over `data/stats/best-efforts.json` counting activities with >=1 effort where `demotion.guard === 'ceiling'` |
| **N − M** | flagged minus already-excluded (decoy — what a wrongly-drained queue would show) | **35** | `47 - 12` |

All four discriminating values (N=47, E=65, C=28, N−M=35) are mutually distinct — no row loses
discrimination today.

### Digests (served-bytes proof, T-29-20)

| Artifact | sha256 |
|---|---|
| `dist/widgets/index.html` | `3163ab41f55099732fd569391d5a3fcbacc74dd0081f7c8b0ea4350ff50f99fa` |
| `.curate-dist/queue.js` (on disk, post `npm run curate` startup rebuild) | `9b02123da4a033000751ba694ee8517f5123f06a9a9f447c7f01eca72b515328` |
| `.curate-dist/queue.js` served (`curl http://127.0.0.1:4173/__curate/queue.js \| shasum -a 256`) | `9b02123da4a033000751ba694ee8517f5123f06a9a9f447c7f01eca72b515328` — **matches on-disk digest exactly** |

`.curate-dist/queue.js` did not exist as a build-widgets output — it is produced by
`buildQueueBundle()` inside `scripts/curate-server.mjs`'s `main()` at server startup (plan 29-06).
The server was started with `npm run curate` (background) and rebuilt both `.curate-dist/overlay.js`
(7.5kb) and `.curate-dist/queue.js` (20.9kb) in its startup log before printing the two URLs below.
The digest was recorded both before and after that startup rebuild and is identical, confirming the
rebuild was a no-op against already-current source.

### Server

Started via `npm run curate` (background). Startup log:

```
.curate-dist/overlay.js  7.5kb
⚡ Done in 18ms

.curate-dist/queue.js  20.9kb
⚡ Done in 9ms
curate server running at http://127.0.0.1:4173/strava-widgets/
Review queue running at http://127.0.0.1:4173/__curate/queue
Save writes the working tree only — curate never touches git (D-09).
```

- Dashboard URL: `http://127.0.0.1:4173/strava-widgets/`
- Review queue URL: `http://127.0.0.1:4173/__curate/queue`

Confirmed live: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/__curate/queue` → `200`.

**Server status at hand-off: RUNNING** (PID confirmed via `lsof -ti :4173`). The orchestrator/next
agent should confirm it is still running before presenting the checkpoint to the developer, and
restart with `npm run curate` if it has since exited.

`git status --porcelain data/best-effort-exclusions.json` confirmed empty again after all of the
above (no exclusions-file mutation occurred during pre-flight).

## Checkpoint Pending — Task 2 verdicts not yet recorded

Task 2 (`checkpoint:human-verify`, `gate="blocking"`) has NOT been performed. Rows R1-R11 from
`.planning/phases/29-curation-review-queue/29-08-PLAN.md` are awaiting the developer's verdicts:

- R1 — Reachable in one navigation action
- R2 — Header count equals **N** (47)
- R3 — Rendered row count equals **N** (47), last row renders completely
- R4 — Already-excluded row count equals **M** (12), each with a non-empty reason
- R5 — Ordering (pending before excluded, dates descending within each block)
- R6 — Row content and prefill
- R7 — Exclude action writes and reverses through the existing path
- R8 — Untrusted origin rejected (403/403/200)
- R9 — Recompute control present with its filtered-population warning note
- R10 — Both guards green on the build that was served (re-confirm digest match)
- R11 — PD-01 decision (approve/reject the third fetch of `data/dashboard/index.json` for activity names)

No row verdict has been recorded. No requirement (CUR-01/CUR-02/CUR-03) has been ticked. The phase
gate stays open until every row is scored and PD-01 is ruled on.

## Deviations from Plan

None — Task 1 executed exactly as written. All commands exited 0 on the first attempt; no auto-fixes
were needed.

## Self-Check (Task 1 only)

- `git status --porcelain data/best-effort-exclusions.json` empty both before and after Task 1 — CONFIRMED
- `npm test` → 82/82 files, 2422/2422 tests passed — CONFIRMED
- `npm run build` → exit 0 — CONFIRMED
- `npm run build-widgets` → exit 0, curation-artifact scan clean — CONFIRMED
- `npm run verify-dashboard` → 66/66 checks passed — CONFIRMED
- `findCurationArtifacts('dist/widgets')` → `[]` — CONFIRMED
- `compute-pr-ceiling-recount.mjs` → PASS, N=47/M=12/T=12/E=65 — CONFIRMED
- Server reachable at `http://127.0.0.1:4173/__curate/queue` → 200 — CONFIRMED
- Served `queue.js` digest matches on-disk `.curate-dist/queue.js` digest — CONFIRMED

---
*Phase: 29-curation-review-queue*
*Task 1 completed: 2026-09-18 (checkpoint pending)*
