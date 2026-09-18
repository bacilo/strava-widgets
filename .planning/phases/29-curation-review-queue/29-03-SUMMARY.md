---
phase: 29-curation-review-queue
plan: 03
subsystem: pr-recount
tags: [curation, pr-plausibility, tdd, cli]
requirements-completed: [CUR-01]
dependency-graph:
  requires: []
  provides:
    - "recountDemotedActivities export (scripts/compute-pr-ceiling-recount.mjs)"
    - "--expect-flagged-activities CLI pin"
    - "activity-level flagged count + excluded share, printed by the CLI"
  affects:
    - "Phase 29's browser checkpoint for Criterion 1 (compares the queue header against this recount)"
tech-stack:
  added: []
  patterns:
    - "classifier-independent recount: zero-import guard (D-15) extended to a new export, no new import added"
key-files:
  created: []
  modified:
    - scripts/compute-pr-ceiling-recount.mjs
    - scripts/compute-pr-ceiling-recount.test.mjs
decisions:
  - "D-16: recountDemotedActivities dedupes by activity across all three demotion guards (world-record/max-speed/ceiling), not a ceiling-only subset"
  - "D-01: population is any non-null demotion, mirrored from recountDemoted's malformed-guard tolerance — does not require typeof demotion.guard === 'string'"
  - "D-02: excludedWithinFlaggedCount is reported as a subset of the flagged set, never subtracted from it"
metrics:
  duration: "~35min"
  completed: 2026-09-18
---

# Phase 29 Plan 03: PR Ceiling Recount — Activity-Level Flagged Count Summary

Added `recountDemotedActivities` to the D-15 classifier-independent recount, giving Criterion 1's
browser checkpoint an activity-level count (and its already-excluded share) derived by the
recount's own arithmetic — a number that Phase 29's review queue header can be compared against
without either artifact importing the module that produced the other's data.

## What Was Built

**Task 1 — `recountDemotedActivities` (TDD RED then GREEN).** Added a `describe('recountDemotedActivities', ...)` block to `scripts/compute-pr-ceiling-recount.test.mjs` covering every case in the plan's `<behavior>` block: dedupe (an activity with 3 demoted efforts counts once), all-guards coverage (world-record-only and max-speed-only activities both count, not just ceiling), the not-flagged case (every effort `demotion: null`), null-safety (`null`, `{}`, `{ activities: null }`, non-array `efforts`, a string/number `demotion`, all returning `flaggedActivityCount: 0` and never throwing), and the exclusions-overlap cases (an exclusion inside the flagged set increments `excludedWithinFlaggedCount`; one outside it still counts toward `exclusionsTotal`; no exclusions doc at all yields `excludedWithinFlaggedCount: null` while `flaggedActivityCount` stays correct).

RED was observed first: `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` reported 7 failing assertions, all `TypeError: (0 , __vite_ssr_import_4__.recountDemotedActivities) is not a function` — the export did not yet exist. Then added `export function recountDemotedActivities(bestEffortsDoc, exclusionsDoc)` to `scripts/compute-pr-ceiling-recount.mjs`, mirroring `recountDemoted`'s null-safety idiom (default `activities` to `{}`, default `efforts` to `[]`, treat a non-object/`null` `demotion` as absent). Per the plan's explicit instruction, it does **not** require `typeof demotion.guard === 'string'` — a malformed guard value still qualifies the activity, since `recountDemoted` already reports malformed guards separately via `unrecognisedGuards` and D-01's population is "any non-null demotion." `flaggedActivityIds` is sorted for stable, diffable output. Added no new `import` — the zero-import guard (D-15) test still passes (verified: 54/54 green after the GREEN commit).

**Task 2 — Wired into the CLI, the expect flag and the verdict.**
- `parseExpectFlags` gained `expectFlaggedActivities`, parsed from `--expect-flagged-activities <n>` with the same integer-or-throw semantics as `--expect-demoted`.
- `parseInputPaths` gained `exclusionsPath`, resolved from `--exclusions <path>` and defaulting to a new `EXCLUSIONS_PATH` constant (`data/best-effort-exclusions.json`). Read through the existing `readShippedJson` helper in `main()`, so a missing or malformed exclusions file lands in `readErrors` rather than throwing.
- `main()` computes `flaggedActivities = recountDemotedActivities(bestEffortsRead.doc, exclusionsRead.ok ? exclusionsRead.doc : undefined)` and prints, next to the existing `Recomputed demoted total ...` line:
  - `Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): <n>`
  - `  of which already excluded (data/best-effort-exclusions.json): <n> of <n> total exclusions` (or an "unavailable" line if the exclusions document could not be read)
  - a caution line naming this count a superset of the ceiling-only cohort and the population the Phase 29 review queue lists (D-01)
  - `--expect-flagged-activities <n>: MATCH`/`MISMATCH` when the flag is supplied
- `evaluateReport` gained a fourth positional parameter `expectedFlaggedActivities`, pushing a problem quoting both numbers on a mismatch. Stayed pure — no `console`, no `process.exit` — matching the existing tests' expectations.
- Added `evaluateReport` test cases mirroring the existing expect-demoted mismatch case (mismatch fails quoting both numbers; an exact match passes), plus updated the pre-existing `parseInputPaths`/`parseExpectFlags` tests for the new `exclusionsPath`/`expectFlaggedActivities` fields their return shapes now carry.
- Updated the module docblock's bound-on-claim note with the required sentence: this count is a live measurement that grows with the nightly sync, so no caller may hardcode today's value into shipped source.

All 59 tests green after Task 2 (`npx vitest run scripts/compute-pr-ceiling-recount.test.mjs`).

**Task 3 — Recorded the live values and their discriminators (measurement only, no source changed).** See the table below. `git status --short` after this task showed no changes — confirmed measurement-only, satisfying the acceptance criterion.

## Live Archive Measurement (2026-09-18)

Data as shipped in the primary checkout (`data/stats/best-efforts.json`, `data/dashboard/index.json`, `data/best-effort-exclusions.json`, all last regenerated by the nightly sync on 2026-09-16). Run **read-only** from this worktree against the primary checkout's data files, since `data/stats/` and `data/dashboard/` are gitignored and absent in a fresh worktree — the `--best-efforts`/`--index`/`--exclusions` override flags exist for exactly this case, per the module's own docblock.

| # | Measurement | Command | Value |
|---|---|---|---|
| 1 | `flaggedActivityCount` (all guards, activity level) | `node scripts/compute-pr-ceiling-recount.mjs --best-efforts <path>/data/stats/best-efforts.json --index <path>/data/dashboard/index.json --exclusions <path>/data/best-effort-exclusions.json` | **47** |
| 2 | `ownDemotedTotal` (effort level) | same command, `Recomputed demoted total` line | **65** (ceiling 31, world-record 19, max-speed 15) |
| 3 | ceiling-guard-only activity count | `node -e "const doc=JSON.parse(require('fs').readFileSync('<path>/data/stats/best-efforts.json','utf8'));const activities=doc.activities\|\|{};let count=0;for(const id of Object.keys(activities)){const efforts=Array.isArray(activities[id].efforts)?activities[id].efforts:[];if(efforts.some(e=>e.demotion&&typeof e.demotion==='object'&&e.demotion.guard==='ceiling'))count+=1;}console.log(count);"` | **28** |
| 4 | `flaggedActivityCount - excludedWithinFlaggedCount` (what a wrongly-drained queue would show) | `47 - 12` (excludedWithinFlaggedCount read off the same CLI run's `of which already excluded` line: `12 of 12 total exclusions`) | **35** |

All four numbers are mutually distinct (47, 65, 28, 35) — this is what makes the Criterion 1 checkpoint row failable in three directions rather than vacuously agreeing with itself.

**These are measurements of the archive on the run date (2026-09-18), not constants.** The nightly sync changes them (the archive grows via CI). The Phase 29 browser checkpoint must re-run `node scripts/compute-pr-ceiling-recount.mjs --expect-flagged-activities <n>` at verification time rather than reuse the numbers above. None of these four numbers were added to shipped source or to a test assertion — the tests in `scripts/compute-pr-ceiling-recount.test.mjs` exercise the function's *behavior* against hand-built fixtures, never the live archive's current counts.

## CLI Verification Evidence

Run against the live archive (read-only, via the override flags):
- Plain run: exits 0, prints `Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): 47` and `PASS: recount agrees with the shipped totals; no disagreements found.`
- `--expect-flagged-activities 47`: prints `--expect-flagged-activities 47: MATCH`, exits 0.
- `--expect-flagged-activities 46`: prints `--expect-flagged-activities 46: MISMATCH`, exits 1, and the problem line quotes both numbers: `recomputed flaggedActivityCount (47) does not equal --expect-flagged-activities 46`.
- `--exclusions /tmp/does-not-exist.json`: exits 1, prints `FAILED to read one or more shipped documents:` naming the ENOENT reason — no uncaught exception.
- `grep -vn '^\s*\*' scripts/compute-pr-ceiling-recount.mjs | grep -c "flaggedActivityCount === 47"` returns `0` — no literal flagged-activity count in source.

## Deviations from Plan

None — plan executed exactly as written across all three tasks.

## Self-Check: PASSED

- `scripts/compute-pr-ceiling-recount.mjs` — FOUND (modified)
- `scripts/compute-pr-ceiling-recount.test.mjs` — FOUND (modified)
- Task 1 commit `17ec7fa4` — FOUND
- Task 2 commit `fa31ad1b` — FOUND
- `grep -c "export function recountDemotedActivities" scripts/compute-pr-ceiling-recount.mjs` → `1`
- `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` → 59/59 passed
