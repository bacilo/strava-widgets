---
phase: 29-curation-review-queue
plan: 08
subsystem: curation
tags: [curation, review-queue, checkpoint, human-verify, pr-plausibility]

# Dependency graph
requires:
  - phase: 29-curation-review-queue
    provides: "the queue page, its exclude/recompute controls, curate-server write route, and both publish guards (plans 29-01 through 29-07)"
provides:
  - "the developer's recorded browser verdict (R1-R10, all PASS) proving the queue's rendered extent, write path, origin rejection and guard status against the live archive"
  - "PD-01 ruling: approve the third fetch of data/dashboard/index.json for activity names"
affects: [phase-29-verification, phase-29-review]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/29-curation-review-queue/29-08-SUMMARY.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PD-01 approved: keep the third fetch of /strava-widgets/data/dashboard/index.json for activity names on queue rows (no new route added; the flagged SET is derived without it)"

patterns-established: []

requirements-completed: [CUR-01, CUR-02, CUR-03]

# Metrics
duration: "Task 1 + Task 2 (checkpoint): same-session, human verification 2026-09-18"
completed: 2026-09-18
---

# Phase 29 Plan 08: Human Browser Checkpoint — Queue Extent, Write Path, Origin Rejection, Guard Status Summary

**Every checkpoint row (R1-R10) passed against the live archive and the served build; PD-01 approved
keeping the activity-name join via `data/dashboard/index.json`; CUR-01, CUR-02 and CUR-03 are complete.**

## Status

**Task 1: COMPLETE.** All pre-flight commands executed, every exit code recorded, the day's four
discriminating numbers captured, and the server started successfully.

**Task 2: COMPLETE.** The developer performed the browser checkpoint against
`http://127.0.0.1:4173/__curate/queue` (served digest confirmed matching the on-disk build). All
eleven rows returned an explicit verdict; PD-01 was ruled on. No gap was found — the phase gate closes
clean, not on a partial pass.

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

`git status --porcelain data/best-effort-exclusions.json` confirmed empty again after all of the
above (no exclusions-file mutation occurred during pre-flight).

## Checkpoint Verdicts

Recorded 2026-09-18 against the served build (digests `dist/widgets/index.html` `3163ab41…`, served
`queue.js` `9b02123d…`, both confirmed to match Task 1's Evidence block before the session started).
All rows PASS. R9's optional full recompute was not run — the developer accepted the automated
verdicts as-is.

| Row | Requirement/Decision | Verdict | Observed |
|---|---|---|---|
| R1 | CUR-01, D-07 — reachable in one click | PASS | "Review queue" link present in the dashboard nav; one click landed on `/__curate/queue`. |
| R2 | CUR-01 Criterion 1, D-16, D-01 — header equals **N** | PASS | Header reads "47 flagged · 12 already excluded" (= N 47; not E 65, C 28, or N−M 35). |
| R3 | Reachable extent, not a claim | PASS | `document.querySelectorAll('[data-queue-row]').length` = 47; last row (Feb 6, 2018 — Frederiksberg - Ryvang, id 3475735603) renders date, name link, one effort line, and its control. |
| R4 | D-02, D-15 — already-excluded listed and marked | PASS | 12 rows with `data-excluded="true"` (= M); every one shows `Excluded — <non-empty reason>`. |
| R5 | D-05 — ordering | PASS | All pending rows precede all excluded rows; dates descend within each block. |
| R6 | D-12, D-11 — row content and prefill | PASS | Pending row "Dec 16, 2022 — Morning Run" links to `/strava-widgets/#/activity/8254185606` and that detail page opened; effort line `400m · max-speed · implied 13.31 m/s exceeds activity max_speed 5.51 m/s · 0:30 · 1:15/km`; ticking the checkbox revealed an editable textarea prefilled `400m: implied 13.31 m/s exceeds activity max_speed 5.51 m/s`. |
| R7 | CUR-02 Criterion 2 — exclude writes through the existing path | PASS | Appended ` — checkpoint test` and pressed Save: page reloaded, `git diff data/best-effort-exclusions.json` showed exactly one added entry `{"activityId":"8254185606","distances":null,"reason":"400m: implied 13.31 m/s exceeds activity max_speed 5.51 m/s — checkpoint test"}` (12→13 entries). Remove exclusion: confirm dialog text "Removing this exclusion deletes it and changes PR history. Continue?"; accepting reloaded the page, row returned to pending, diff clean (13→12). Confirm gate additionally proven non-vacuous: with confirm stubbed to return false on an excluded row, no request was issued and the file stayed clean. |
| R8 | CUR-02 Criterion 2 — untrusted origin rejected | PASS | Cross-origin PUT `/__curate/exclusions/8254185606` with `Origin: http://evil.example` → 403; cross-origin GET `/__curate/queue` → 403; same-origin GET control → 200; exclusions file clean afterwards. |
| R9 | D-13, D-14 — recompute control | PASS | Recompute control sits at the top of the queue; its note reads "The plausibility ceiling is derived from the already-filtered population, so excluding an activity and recomputing can change which activities are listed here." Optional full-loop recompute not run — see note below. |
| R10 | CUR-03 Criterion 3 — guards green on served build | PASS | `shasum -a 256 dist/widgets/index.html` still `3163ab41f55099732fd569391d5a3fcbacc74dd0081f7c8b0ea4350ff50f99fa`; served `/__curate/queue.js` digest equals on-disk `9b02123da4a033000751ba694ee8517f5123f06a9a9f447c7f01eca72b515328`; `findCurationArtifacts('dist/widgets')` → `[]`; `npm test`, `build-widgets`, `verify-dashboard` green per Task 1. |
| R11 | PD-01 decision | **APPROVE** | Keep the third fetch of `/strava-widgets/data/dashboard/index.json` for activity names — see Decisions Made below. |

**R9 note (optional recompute):** not run. The developer accepted the automated verdicts as-is; the
full-loop recompute (pressing the control, watching it rewrite `data/stats/**`, and re-checking R2
against a new **N**) was intentionally skipped this session since it takes minutes and R9's required
half (control present, correct warning note) already passed.

**Note for the record (not a defect):** the developer initially hit 403 at the bare root
`http://127.0.0.1:4173/` — that path is unrouted by design; the dashboard is at
`/strava-widgets/`.

`git status --porcelain data/best-effort-exclusions.json` is empty at the end of the session.

## Deviations from Plan

None — Task 1 executed exactly as written, and Task 2's checkpoint returned a blanket PASS with no
gap. All commands exited 0 on the first attempt; no auto-fixes were needed.

## Decisions Made

- **PD-01 (approve):** `data/stats/best-efforts.json` carries no activity `name`, but D-12 requires
  one on every queue row. The implementation makes a third fetch — `/strava-widgets/data/dashboard/index.json`,
  already public, already mirrored, already read by the dashboard — and uses it for the name only.
  D-08 named two files and said "no new server read route"; this adds no route, and the flagged SET
  is derived without it, so a failed third fetch cannot change which rows appear. The developer
  approved keeping this join as built, rather than dropping it in favor of `Activity <id>` rows.

## Self-Check

- `git status --porcelain data/best-effort-exclusions.json` empty both before and after Task 1 and
  Task 2 — CONFIRMED
- `npm test` → 82/82 files, 2422/2422 tests passed — CONFIRMED
- `npm run build` → exit 0 — CONFIRMED
- `npm run build-widgets` → exit 0, curation-artifact scan clean — CONFIRMED
- `npm run verify-dashboard` → 66/66 checks passed — CONFIRMED
- `findCurationArtifacts('dist/widgets')` → `[]` — CONFIRMED
- `compute-pr-ceiling-recount.mjs` → PASS, N=47/M=12/T=12/E=65 — CONFIRMED
- Server reachable at `http://127.0.0.1:4173/__curate/queue` → 200 — CONFIRMED
- Served `queue.js` digest matches on-disk `.curate-dist/queue.js` digest — CONFIRMED
- All eleven checkpoint rows (R1-R11) carry an explicit developer verdict — CONFIRMED
- `.planning/REQUIREMENTS.md` CUR-01, CUR-02, CUR-03 ticked `[x]` — CONFIRMED

## Self-Check: PASSED

## Next Phase Readiness

Phase 29's curation review queue is fully verified against the live archive and the served build.
CUR-01, CUR-02 and CUR-03 are complete. Ready for phase-level review/verification per the standard
`/gsd-plan-phase 29 --gaps` gate (no gaps recorded this round).

---
*Phase: 29-curation-review-queue*
*Task 1 completed: 2026-09-18*
*Task 2 (checkpoint) completed: 2026-09-18*
