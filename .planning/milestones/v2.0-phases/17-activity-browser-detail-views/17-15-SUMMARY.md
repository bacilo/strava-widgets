---
phase: 17-activity-browser-detail-views
plan: 15
subsystem: testing
tags: [vitest, verify-dashboard-publish, leaflet, chartjs, code-splitting, browser-checkpoint]

# Dependency graph
requires:
  - phase: 17-09
    provides: filters/search/chips list-logic wired into #/list
  - phase: 17-10
    provides: calendar view and multi-run day picker
  - phase: 17-14
    provides: activity detail page orchestration (lazy map + chart mounting, stale guards)
provides:
  - Completed 17-VALIDATION.md validation record (Per-Task Verification Map, Manual-Only
    Verifications, Gap-Closure Record) for the entire phase 17-01..17-15
  - A confirmed automated gate snapshot (592/592 tests, clean tsc, 20/20 verify-dashboard checks)
    with resolved D-25 chunk-inventory evidence
  - Two named, unfixed defects (GAP 1, GAP 2) ready for gap-closure planning
affects: [gap-closure planning for phase 17, /gsd-verify-work readiness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static server mirroring verify-dashboard-publish.mjs's MOUNT_PREFIX/safeResolve logic, used
       for human-browser checkpoints so the local check always matches the GitHub Pages project-path
       shape (never root-mounted)"
    - "Gap-closure recorded verbatim in 17-VALIDATION.md rather than patched under checkpoint
       pressure, continuing the 16-09 precedent"

key-files:
  created:
    - .planning/phases/17-activity-browser-detail-views/deferred-items.md
  modified:
    - .planning/phases/17-activity-browser-detail-views/17-VALIDATION.md

key-decisions:
  - "GAP 1 and GAP 2 recorded as open, unfixed defects (status: partial) rather than patched in
    place, per the plan's explicit 16-09-precedent instruction"
  - "nyquist_compliant left false: the validation methodology itself satisfies every Sign-Off
    checklist item, but the flag is reserved for a fully clean phase gate per the plan's own
    acceptance criteria"
  - "Uncommitted working-tree changes to detail-charts.ts/detail-map.ts discovered mid-task (see
    Known Stubs/Deviations) were left untouched rather than folded into this commit — out of this
    task's file scope and out of process for a checkpoint that explicitly forbids patching gaps"

patterns-established:
  - "Persistent human-checkpoint static server pattern: reuse the production-equivalent
    MOUNT_PREFIX-mounted server logic from the automated publish verifier, with an SPA-fallback
    added, rather than inventing a second serving strategy for manual checks"

requirements-completed: [BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-05, BROWSE-06, DETAIL-01, DETAIL-05]

# Metrics
duration: ~25min (Task 1 automated gate + server setup, plus Task 3 recording after the human
  checkpoint response; excludes the wait time for the human walkthrough itself)
completed: 2026-08-11
---

# Phase 17 Plan 15: Real-Browser Verification & Validation Sign-Off Summary

**Full automated gate confirmed green (592/592 tests, clean tsc, 20/20 verify-dashboard checks,
D-25 chunk split proven) and a real-browser walkthrough closed with a PARTIAL result: 2 named,
unpatched gaps (route-map basemap tiles absent; chart-band x-axis misalignment) recorded in
17-VALIDATION.md per the 16-09 precedent, phase gate not closed.**

## Performance

- **Duration:** ~25 min of active executor work (Task 1 automated gate + server setup; Task 3
  recording after the human's checkpoint response), across two sessions separated by a blocking
  human-verify checkpoint
- **Completed:** 2026-08-11
- **Tasks:** 3/3 (Task 1 auto, Task 2 human checkpoint, Task 3 auto)
- **Files modified:** 1 (`17-VALIDATION.md`); 1 created (`deferred-items.md`)

## Accomplishments

- Ran and recorded the complete automated gate: `npm test` (592/592, +219 vs. the 373-test
  pre-phase baseline), `npx tsc --noEmit` (clean), `npm run build-widgets` + `npm run
  verify-dashboard` (20/20 checks, 0 failures, including the two `data/config/*.json` shape checks).
- Proved the D-25 chunk split at the build level with re-derived, resolved filenames: dashboard
  entry chunk `index-C4VZzD15.js` carries neither Leaflet nor Chart.js library code; async chunks
  `detail-map-CFE38LJh.js` (104 Leaflet refs) and `detail-charts-BLeo4CpR.js` (160 chart refs)
  carry them, with a CSS asset (`detail-map-CIGW-MKW.css`) emitted for the map chunk.
- Stood up a persistent local static server mounting `dist/widgets/` under `/strava-widgets`
  (mirroring `verify-dashboard-publish.mjs`'s exact mount logic, plus an SPA fallback), verified it
  rejects root-mounted requests (403) the way the Phase 16 postmortem's fix requires, and handed a
  full 38-step, group-by-group walkthrough script to the developer.
- Recorded the developer's real-browser result verbatim in `17-VALIDATION.md`: 8 of 10
  Manual-Only-Verifications rows confirmed clean; 2 gaps named with requirement IDs, severity, and
  the orchestrator's root-cause interpretation kept clearly separate from the user's own words.
- Completed the Per-Task Verification Map (all tasks 17-01..17-15), set `wave_0_complete: true`
  (all six Wave 0 test files exist and pass, 182 tests), and resolved the Validation Sign-Off
  checklist — left `nyquist_compliant: false` with an explicit written reason.
- Set `status: partial` in the frontmatter; the phase gate is explicitly NOT closed and gap-closure
  planning (`/gsd-plan-phase 17 --gaps`) is the recorded next step.

## Task Commits

1. **Task 1: Full automated gate plus a project-path publish smoke run** — no commit (verification-
   only task per its own `<files>` scope; `dist/` is gitignored and no source files changed)
2. **Task 2: Real-browser verification** — human checkpoint, PARTIAL result relayed by the
   coordinator (no commit; developer-driven, not executor-driven)
3. **Task 3: Record results in 17-VALIDATION.md and close or gap the phase** - `ce070ca` (docs)

**Plan metadata:** commit pending (this SUMMARY.md + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## Files Created/Modified

- `.planning/phases/17-activity-browser-detail-views/17-VALIDATION.md` - Per-Task Verification Map
  fully populated; Automated Evidence section added; Manual-Only Verifications table resolved with
  a Status column; new Gap-Closure Record section documenting GAP 1 and GAP 2; Validation Sign-Off
  checklist completed; frontmatter set to `status: partial`, `wave_0_complete: true`,
  `nyquist_compliant: false`
- `.planning/phases/17-activity-browser-detail-views/deferred-items.md` - new file logging two
  out-of-scope discoveries (see Deviations below)

## Decisions Made

- Followed the 16-09 precedent exactly: a PARTIAL checkpoint result is recorded as named,
  unfixed gaps with requirement IDs and severity, never patched in place under checkpoint pressure.
- `requirements-completed` in this SUMMARY's frontmatter lists only the 8 requirements the
  checkpoint actually confirmed clean (BROWSE-01..06, DETAIL-01, DETAIL-05); DETAIL-02, DETAIL-03,
  and DETAIL-04 are withheld pending gap-closure, mirroring how 16-09's summary listed only DASH-01.
- `nyquist_compliant` left `false` even though every individual Sign-Off checklist box is
  genuinely satisfied on its own terms (Wave 0 coverage, sampling continuity, feedback latency),
  because the plan's own Task 3 acceptance criteria tie that flag to an all-groups-passed result.

## Deviations from Plan

### Auto-fixed Issues

None - Task 1 and Task 3 executed exactly as written; no bugs, missing functionality, or blocking
issues were found during the executor's own work.

### Notable discoveries (logged, not auto-fixed — out of this plan's file scope)

**1. Pre-existing uncommitted source changes found mid-Task-3**
- **Found during:** Task 3, immediately before staging the commit
- **What was found:** `src/dashboard/views/detail-charts.ts` and `src/dashboard/views/detail-map.ts`
  had uncommitted working-tree changes that read as in-progress fixes for GAP 1 and GAP 2
  respectively (a `Y_AXIS_WIDTH_PX` axis-gutter pin, and a `tileerror` listener adding a caveat
  notice). The executor did not write these and cannot confirm their correctness or provenance.
- **Action taken:** Left untouched — not staged, not reverted, not committed. Per this plan's
  explicit instruction not to patch a failed checkpoint group in place, and because they fall
  outside Task 3's declared file scope (`17-VALIDATION.md` only), folding them into this commit
  would have violated both the checkpoint discipline and the task-commit-protocol's staging rules.
- **Details:** `.planning/phases/17-activity-browser-detail-views/deferred-items.md` § 1

**2. Stale tracked build artifact `dist/widgets/test.html`**
- **Found during:** Task 1, running `npm run build-widgets` as required by the plan's verify command
- **What was found:** the build no longer regenerates this file, so it shows as a working-tree
  deletion; it predates the `dist/*`/`dist/widgets/*` `.gitignore` rules (originally committed in
  Phase 12).
- **Action taken:** Left uncommitted — out of scope for a `17-VALIDATION.md`-only commit; flagged
  for a future cleanup pass rather than folded incidentally into this plan's commit.
- **Details:** `.planning/phases/17-activity-browser-detail-views/deferred-items.md` § 2

---

**Total deviations:** 0 auto-fixed; 2 discoveries logged to `deferred-items.md` and left untouched.
**Impact on plan:** None on this plan's own deliverable (`17-VALIDATION.md`). The uncommitted
source changes are directly relevant to the next gap-closure plan and should be triaged there.

## Issues Encountered

None beyond the two named gaps themselves, which are the expected, correctly-functioning output of
this plan's process (catching real defects a locally-passing automated gate could not see) rather
than problems with plan execution.

## Known Stubs

None introduced by this plan (validation-recording only; no application code changed).

## Threat Flags

None — this plan's only file change is a validation record; no new network endpoints, auth paths,
file access patterns, or trust-boundary schema changes were introduced.

## User Setup Required

None - no external service configuration required. The local checkpoint server
(`http://127.0.0.1:4319/strava-widgets/`, PID from the prior Task 1 session) is left running per
the coordinator's instruction, so the developer can re-verify once gap-closure work lands.

## Next Phase Readiness

- The phase gate is **NOT** closed. `17-VALIDATION.md` resolves to `status: partial` with 2 named
  gaps (GAP 1 — DETAIL-02 route-map basemap tiles do not render; GAP 2 — DETAIL-03/DETAIL-04 chart
  band x-axis misalignment, which also undermines the shared hover-crosshair guarantee).
- Recorded next step: gap-closure planning via `/gsd-plan-phase 17 --gaps`, which should also
  triage the two pre-existing uncommitted source changes noted in `deferred-items.md` — they
  appear to target these exact gaps but were not verified or committed by this plan.
- `/gsd-verify-work` should not be run against this phase until the gap-closure plan lands and a
  follow-up checkpoint confirms both gaps are resolved (re-using the same
  `http://127.0.0.1:4319/strava-widgets/` server, still running).

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*
