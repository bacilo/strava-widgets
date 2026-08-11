---
phase: 16-dashboard-shell-data-contract
plan: 14
subsystem: infra
tags: [github-actions, github-pages, ci-cd, deploy, git]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: "Plans 16-10..16-13 (dashboard SPA, activity/detail views, gap-closure fixes, blocking CI gate steps) merged to local master"
provides:
  - "origin/master carrying the full Phase 16 phase (src/dashboard/, dashboard index generator, relocated src/pages/widgets.html, plan 16-13's blocking CI gate)"
  - "A gated, green daily-refresh workflow run (id 31487234659) that exercised Run test suite and Verify dashboard publish contract as blocking steps before deploy"
  - "origin/gh-pages serving the dashboard SPA at root, the widget showcase at widgets.html, and a data/ tree with dashboard/, activities/, streams/ alongside the pre-existing geo/, heatmap/, routes/, stats/"
affects: ["16-15", "16-16", "any future phase touching daily-refresh.yml or the gh-pages publish contract"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fast-forward push discipline: non-fast-forward push rejections are a hard stop, never force-pushed or auto-merged by the executor without explicit resolution"]

key-files:
  created: []
  modified: [".planning/STATE.md"]

key-decisions:
  - "On non-fast-forward push rejection, halted and reported rather than merging/rebasing/forcing, per this plan's explicit authorization boundary — origin/master had 2 commits (dfaaf1e, bca8ae1) not in local master, both automated 'chore: update activities and stats [skip ci]' commits from the nightly CI's git-auto-commit-action, both touching only the generatedAt timestamp in data/geo/geo-metadata.json"
  - "Orchestrator resolved the divergence with a merge (not a rebase) to avoid rewriting all 179 unpushed phase commits for a one-line timestamp conflict; merge commit 95b499b applied cleanly with no conflict since local master had not touched that file since the merge-base"
  - "Task 1's local gate was re-run by the orchestrator after the merge touched data/, confirming green before the push proceeded; not re-run a second time by this executor since the orchestrator's re-run already covered the merged tree"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: ~40min (including a coordinator-mediated pause to resolve a non-fast-forward push rejection)
completed: 2026-08-11
---

# Phase 16 Plan 14: Push Phase 16 to origin and verify the live GitHub Pages deploy

**Pushed 179 unpushed commits (the entire Phase 16 dashboard SPA) to origin/master, ran the gated daily-refresh workflow to a green conclusion, and confirmed against the live origin that the dashboard SPA — not the pre-Phase-16 widget showcase — now serves at the site root with a full data/ tree.**

## Performance

- **Duration:** ~40 min (includes one coordinator-mediated pause for a non-fast-forward push rejection)
- **Started:** 2026-08-11T~11:00Z
- **Completed:** 2026-08-11T11:38:39Z
- **Tasks:** 3 (all complete)
- **Files modified:** 1 (`.planning/STATE.md`, blocker note + clear)

## Accomplishments
- `origin/master` now contains `src/dashboard/` and the whole Phase 16 tree — the branch the publishing workflow builds from is current
- A `daily-refresh` run (workflow_dispatch, id `31487234659`) completed with conclusion `success`, with the plan 16-13 blocking gate steps (`Run test suite`, `Verify dashboard publish contract`) both green, proving the CI gate is real and not silently skipped
- `origin/gh-pages` (new HEAD `1646351`) serves the dashboard SPA (`id="app-nav-root"`, `id="app"`) at the root, the widget showcase at `/widgets.html`, the three pre-existing standalone pages intact, and a `data/` tree with `dashboard/`, `activities/`, `streams/` in addition to the pre-existing `geo/`, `heatmap/`, `routes/`, `stats/`
- All 8 live-origin URLs (root, showcase, 3 standalone pages, index.json, and the deployed index's first `i`-prefixed row's detail + stream JSON) returned 200 on first attempt — no propagation lag encountered

## Task Commits

1. **Task 1: Run the full local gate and a publish-safety scan** — no commit (verification only; `git status --short` was empty throughout)
2. **Task 2: Push master to origin and run the publishing workflow to completion** — `14f15f8` (docs, blocker documentation after first push attempt was rejected) + orchestrator's merge commit `95b499b` (not authored by this executor) + the actual push (no new local commit — `git push origin master` after the merge)
3. **Task 3: Verify the deployed gh-pages tree and the live origin** — no commit (verification only)

**Plan metadata:** see below (this SUMMARY + STATE.md update)

_Note: Task 2 spanned a coordinator interaction — see "Issues Encountered" below for the full sequence._

## Files Created/Modified
- `.planning/STATE.md` — blocker recorded (non-fast-forward push rejection) then cleared once resolved; position/session updated

## Decisions Made
- Chose to STOP rather than merge/rebase/force on the first non-fast-forward push rejection, exactly as this plan's authorization block required, even though the divergence was almost certainly trivial (confirmed after the fact: yes, a single-line timestamp field).
- Did not re-run Task 1's local gate a second time after the coordinator's merge — the orchestrator explicitly re-ran and reported it green (`npm test`, `tsc --noEmit`, `build-widgets`, `verify-dashboard` all exit 0, 15/15 checks) before handing control back, and independently verified the merge touched only `data/geo/geo-metadata.json`.

## Deviations from Plan

### Auto-fixed Issues

None — no code changes were required. The one deviation was a controlled halt-and-resume, not an auto-fix (see Issues Encountered).

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. The plan's own authorization block anticipated exactly this failure mode (non-fast-forward push) and specified the correct behavior (stop, don't force), which is what happened.

## Issues Encountered

**`git push origin master` was rejected as non-fast-forward on the first attempt (Task 2).**

Root cause: `origin/master` had accumulated 2 commits (`dfaaf1e`, `bca8ae1`) not present in local `master`, both automated `chore: update activities and stats [skip ci]` commits from the nightly CI's `git-auto-commit-action` step, both touching only the `generatedAt` timestamp field in `data/geo/geo-metadata.json` (confirmed via `git show --stat` on both commits before any resolution attempt).

Per this plan's explicit authorization ("If the push is rejected as non-fast-forward, STOP and report — do not force"), the executor:
1. Did not force-push, merge, or rebase.
2. Diagnosed the divergence precisely (`git rev-list --left-right --count`, `git show --stat`, direct content diff of the one file) without mutating any git state beyond a local `fetch`.
3. Recorded the blocker via `gsd-sdk query state.add-blocker` and committed a `docs(16-14)` note (`14f15f8`) to `STATE.md` documenting Task 1's clean gate results and the Task 2 stop.
4. Reported the full diagnosis back to the coordinator and awaited a decision.

The coordinator independently verified the same diagnosis, chose to **merge** (not rebase, to avoid rewriting all 179 unpushed phase commits for a one-line timestamp), ran `git merge origin/master --no-edit` on the main working tree (applied cleanly, no conflict — local `master` had not touched that file since the merge-base, so git resolved it trivially, keeping origin's newer `2026-08-11T05:45:39.063Z` value), re-ran Task 1's full local gate on the merged tree (all green), and handed control back with `git rev-list --count master..origin/master` = 0.

The executor then verified the resolved state independently before proceeding, pushed successfully (`dfaaf1e..95b499b master -> master`), and completed Tasks 2 and 3 without further incident.

## Verification Results

### Task 1 — Local gate + publish-safety scan (all green)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | exit 0 (368 passing, 20 test files) |
| `npm run build` | exit 0 |
| `npm run build-widgets` | exit 0 |
| `npm run verify-dashboard` | exit 0, **15 checks passed, 0 failures** |
| `git rev-list --count origin/master..master` (pre-push) | 177 (real current number at time of check, superseding the plan's cited 148) |
| `git diff --name-only origin/master..master` — sensitive paths | none found (1987 files touched, no `.env`, `.env.*`, `data/tokens.json`, or `export_data/` path) |
| `git check-ignore -v .env data/tokens.json export_data` | all 3 matched a `.gitignore` rule |
| Credential-shaped-string grep (excluding `.planning`) | no output |
| `grep -c '/Users/' data/provenance.json` | 0 |
| `git status --short` | empty |

### Task 2 — Push + workflow run

| Item | Value |
|---|---|
| Push (after merge resolution) | `dfaaf1e..95b499b master -> master` |
| `git rev-list --count origin/master..master` (post-push) | 0 |
| `git ls-tree origin/master src/ --name-only` | includes `src/dashboard` |
| Workflow run id | `31487234659` |
| Workflow run URL | https://github.com/bacilo/strava-widgets/actions/runs/31487234659 |
| Trigger | `workflow_dispatch` on `master` (headSha `95b499bb33b07d8069a6ebcac2f1a56e7a7d2eb0`) |
| Run conclusion | `success` |
| `Run test suite` step | `success` |
| `Verify dashboard publish contract` step | `success` |
| `Deploy widgets to GitHub Pages` step | `success` |
| `git diff HEAD -- .github/workflows/daily-refresh.yml` | empty (workflow not edited to force green) |

### Task 3 — Deployed gh-pages tree + live origin

| Item | Value |
|---|---|
| `origin/gh-pages` HEAD (before) | `7a1aa8a` / `2026-08-11T05:45:56Z` (stale) |
| `origin/gh-pages` HEAD (after) | `16463514e7076b825ca4029852056808c1ca75df` / `2026-08-11T11:36:37+00:00` |
| Tree listing includes | `assets`, `index.html`, `widgets.html`, `heatmap.html`, `pinmap.html`, `routes.html`, `data` |
| `index.html` contains `id="app-nav-root"` | yes (count 1) |
| `index.html` contains `id="app"` | yes (count 1) |
| `widgets.html` contains `.iife.js` references | yes (count 10) |
| `data/` tree | `activities`, `dashboard`, `geo`, `heatmap`, `routes`, `stats`, `streams` |
| `data/dashboard/index.json` schemaVersion | 1 |
| `data/dashboard/index.json` activity count | 1868 (> 1800) |
| First row id | `i174601247` (begins with `i`, as expected for intervals.icu-migrated activities) |

**Live URL status table** (via `curl -sS -o /dev/null -w '%{http_code}'` against `https://bacilo.github.io/strava-widgets`, run as a standalone script to avoid a shell-nesting quirk that broke `curl`/`sleep`/`date` resolution inside doubly-nested loop constructs in this session's sandbox — all requests returned 200 on the **first** attempt, no propagation-lag backoff needed):

| URL | Status | Attempts |
|---|---|---|
| `/` | 200 | 1 |
| `/widgets.html` | 200 | 1 |
| `/heatmap.html` | 200 | 1 |
| `/pinmap.html` | 200 | 1 |
| `/routes.html` | 200 | 1 |
| `/data/dashboard/index.json` | 200 | 1 |
| `/data/activities/i174601247.json` | 200 | 1 |
| `/data/streams/i174601247.json` | 200 | 1 |

`curl -sS https://bacilo.github.io/strava-widgets/ | grep -c 'id="app-nav-root"'` → 1 (confirms the live root response body is the SPA, not a stale cached page).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 16's headline gap (SC1: dashboard never deployed) is closed. `origin/master` and `origin/gh-pages` both carry the full phase.
- The plan 16-13 CI gate (`Run test suite`, `Verify dashboard publish contract`) is proven to run and block on the real runner, not just locally.
- P08/D-08 (SPA at root, showcase at `/widgets.html`, pre-existing pages intact) is verified against the live origin, not `dist/widgets/`.
- Remaining phase 16 work (16-15, 16-16 per the plan sequence) can proceed against a live, current deployment.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/16-dashboard-shell-data-contract/16-14-SUMMARY.md`
- FOUND: commit `14f15f8` (blocker documentation)
- FOUND: commit `95b499b` (merge resolution)
- FOUND: commit `6a70d76` (this SUMMARY)
- Confirmed via `gh run view 31487234659 --json conclusion -q .conclusion` → `success`
