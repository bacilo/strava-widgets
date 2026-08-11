---
phase: 18-records-trends-differentiators
plan: 01
subsystem: infra
tags: [privacy, build-pipeline, gitignore, public-artifact-guard, vitest]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: "data/config/athlete.json (maxHr/hrZones), copyDataFiles convention, verify-dashboard-publish.mjs gate shape"
provides:
  - "data/private/ — gitignored home for birthDate/sex/restingHr, with a committed placeholder-only example template"
  - "src/analytics/athlete-private.ts — build-time-only parse/load contract (ATHLETE_PRIVATE_SCHEMA_VERSION, parseAthletePrivateConfig, loadAthletePrivateConfig)"
  - "scripts/build-widgets.mjs assertNoPrivateArtifacts() — hard-fails the build if identity/health fields reach dist/widgets/"
  - "scripts/verify-dashboard-publish.mjs — 404 assertions for the private path, own-property regression guard on the public athlete config, 200 assertion for best-effort-exclusions.json"
  - "copyDataFiles extended: data/wma directory entry (unused until later plans) + explicit single-file allow-list for data/best-effort-exclusions.json"
affects: [18-02, 18-03, 18-04, 18-05, 18-06, 18-07, 18-08, 18-09, 18-10, 18-11, 18-12, 18-13, 18-14, 18-15, 18-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time-only identity/health config: gitignored data/private/*.json with a negated placeholder example, validated by a total/never-throws parser mirroring parseAthleteConfig's hasOwn discipline"
    - "Two independent gates on one sensitive artifact: a build-time hard-fail (assertNoPrivateArtifacts) plus a publish-time HTTP contract check (404 + own-property regression guard) — same pattern as the Phase 16 postmortem's 'assert the production shape' lesson"
    - "Explicit single-file allow-list (dataFiles) alongside the directory allow-list (dataDirs) in copyDataFiles, to publish one data/ root file without wholesale-copying data/ root"

key-files:
  created:
    - data/private/README.md
    - data/private/athlete-private.example.json
    - src/analytics/athlete-private.ts
    - src/analytics/athlete-private.test.ts
  modified:
    - .gitignore
    - scripts/build-widgets.mjs
    - scripts/verify-dashboard-publish.mjs

key-decisions:
  - "Locked deviation from CONTEXT.md D-12's literal wording: birthDate/sex/restingHr live in data/private/athlete-private.json, NOT merged into the already-public data/config/athlete.json — RESEARCH.md Pitfall 1 (HIGH) proved the literal wording unshippable in this PUBLIC repo. D-12's actual intent (one hand-maintained file, per-consumer validation, missing fields disable only their own feature) is preserved at the new path."
  - "restingHr is optional and tolerant (absent/0/out-of-range all degrade to null) while birthDate/sex are required and reject the whole config — because Edwards TRIMP (D-14's default) and age-grading need only birthDate/sex, not resting HR."
  - "assertNoPrivateArtifacts scans published JSON for the substrings birthDate/restingHr/\"sex\" rather than deep-parsing every file — cheap, catches the exact identity fields regardless of which JSON document they'd end up in."

requirements-completed: [REC-06, TREND-04]

# Metrics
duration: ~45min
completed: 2026-08-11
---

# Phase 18 Plan 01: Private Athlete Config Contract & Publish Guards Summary

**Gitignored `data/private/athlete-private.json` (birthDate/sex/restingHr) with a build-time-only parser, a build-hard-fail guard, and a publish-time 404 + regression assertion — two independent structural gates proving identity fields never reach this public repo's git history or its GitHub Pages output.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-11
- **Tasks:** 3/3 completed
- **Files modified:** 8 (4 created, 4 modified — including .gitignore)

## Accomplishments
- Resolved RESEARCH.md Pitfall 1 (HIGH severity) before any downstream plan reads identity fields: `data/private/athlete-private.json` is gitignored, its committed example is placeholder-only and is itself rejected by the parser (can never masquerade as real config), and `src/analytics/athlete-private.ts` provides a total, never-throwing build-time-only loader.
- `scripts/build-widgets.mjs`'s `assertNoPrivateArtifacts()` hard-fails the build (`process.exit(1)`) if `dist/widgets/data/private` exists or any published JSON contains `birthDate`/`restingHr`/`"sex"` — verified against 3723-3734 scanned JSON files with zero false positives.
- `scripts/verify-dashboard-publish.mjs` now asserts the private path 404s, the private directory 404s, `data/best-effort-exclusions.json` 200s with a real `exclusions` array, and — critically — that the *public* `data/config/athlete.json` has no own `birthDate`/`sex`/`restingHr` property, closing the exact regression class the Phase 16 postmortem warned about (a well-meaning future edit re-merging private fields into the public file).
- Both negative controls (Task 2 and Task 3) were run live, observed failing with the expected message and exit code, then reverted — confirming the guards are load-bearing, not decorative.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the private athlete config contract and its build-time loader** - `5c19676` (feat)
2. **Task 2: Extend copyDataFiles and add a build-time private-artifact guard** - `9933d7f` (feat)
3. **Task 3: Add the first negative-reachability assertion to the publish verifier** - `a0d938f` (feat)

_No TDD tasks in this plan — all three were `type="auto"` without `tdd="true"`._

## Files Created/Modified
- `data/private/README.md` - Setup instructions; states the phase passes with the file absent
- `data/private/athlete-private.example.json` - Committed template, placeholder-only (`birthDate: "YYYY-MM-DD"`), deliberately rejected by the parser
- `src/analytics/athlete-private.ts` - `ATHLETE_PRIVATE_SCHEMA_VERSION`, `AthleteSex`, `AthletePrivateConfig`, `parseAthletePrivateConfig` (total, hasOwn-gated), `loadAthletePrivateConfig` (warn-and-degrade, never throws)
- `src/analytics/athlete-private.test.ts` - 11 vitest cases: valid config, template rejection, missing/invalid sex, restingHr edge cases (absent/0/48), `__proto__`-keyed object non-reachability, prose birthDate rejection, ENOENT degrade
- `.gitignore` - `data/private/*.json` with `!data/private/athlete-private.example.json` negation
- `scripts/build-widgets.mjs` - `dataDirs` gains `data/wma`; new `dataFiles` single-file allow-list carries `data/best-effort-exclusions.json`; new `assertNoPrivateArtifacts()` called at the end of `copyDataFiles()`
- `scripts/verify-dashboard-publish.mjs` - `expect404` generalized to take a `reason` argument; new checks for the private path/directory 404, the exclusions file 200, and the public athlete-config own-property regression guard

## Decisions Made
- Followed the plan's `<locked_deviation>` verbatim: `data/config/athlete.json` gains no new fields; `data/private/athlete-private.json` is the sole home for identity/health inputs, at a different path than CONTEXT.md D-12's literal wording specified (D-12's intent is preserved, just relocated per RESEARCH.md Pitfall 1's HIGH-severity finding).
- `assertNoPrivateArtifacts` scans by substring (`"birthDate"`, `"restingHr"`, `"\"sex\""`) rather than JSON-parsing every published file — matches the plan's `<action>` spec exactly and is cheap enough to run over 3700+ files on every build.
- Chose to revert an incidental `data/geo/geo-metadata.json` timestamp change that `npm run compute-all-stats` produced as a side effect of running the plan's own verification commands — out of this plan's file scope (not in `files_modified` frontmatter), so left untouched rather than committed.

## Deviations from Plan

None — plan executed exactly as written, including both required negative controls.

### Negative Control Observations (Task 2)

Command: `mkdir -p dist/widgets/data/private && echo '{"birthDate":"1985-04-12"}' > dist/widgets/data/private/x.json && npm run build-widgets`
- **Exit code:** 1
- **Message:** `✗ Private-artifact guard failed: dist/widgets/data/private exists and must never be published.`
- Cleaned up with `rm -rf dist/widgets/data/private`, rebuilt to green (exit 0, `Private-artifact scan: 3723 published JSON files scanned, none contain identity/health fields.`)

### Negative Control Observations (Task 3)

Gate 1 — build-time guard, still active:
- Command: temporarily added `"birthDate": "1985-04-12"` to `data/config/athlete.json`, then `npm run build-widgets`
- **Exit code:** 1
- **Message:** `✗ Private-artifact guard failed: .../dist/widgets/data/config/athlete.json contains "birthDate" — identity/health fields must never reach the published site.`

Gate 2 — publish verifier, with the build-time guard temporarily commented out so the poisoned file could reach `dist/`:
- Command: `npm run build-widgets` (guard disabled, exit 0) then `npm run verify-dashboard`
- **Exit code:** 1 (24 checks passed, 1 failure)
- **Message:** `✗ /data/config/athlete.json has an own "birthDate", "sex", or "restingHr" property — identity/health fields must live only in gitignored data/private/athlete-private.json (T-18-PII-01)`

Both `scripts/build-widgets.mjs` and `data/config/athlete.json` were restored to their exact committed state (`git diff` confirmed empty against HEAD before commit) and re-verified green: `npm run build-widgets && npm run verify-dashboard` → 25/25 checks; full `npm test` → 603/603 passing (up from the pre-plan baseline of 592, +11 new `athlete-private.test.ts` cases).

## Issues Encountered
- Two of my own doc comments accidentally matched the plan's literal acceptance-criteria greps (`grep -c 'from .*dashboard'` and `grep -c "src: 'data',"`), because the comments happened to contain those exact substrings while describing what the code does/doesn't do. Reworded both comments to keep the same meaning without the literal match; no functional change. Not logged as a Rule 1-3 deviation since no code behavior was affected — purely a comment-wording adjustment to satisfy the plan's own verification commands.
- Running the plan's own verification chain required populating local `data/stats/` and `data/dashboard/` (both gitignored, regenerated by `npm run compute-all-stats` / `npm run compute-dashboard-index`) since they didn't exist in this worktree checkout. This is expected per CONTEXT.md's "Data findings" note that the local `best-efforts.json` needs rebuilding before trusting any record number — not a plan deviation.

## Next Phase Readiness
- `data/private/athlete-private.json` contract, loader, build guard, and publish guard are all in place and tested — every downstream plan in this phase (age-grading, TRIMP training load) can now read `loadAthletePrivateConfig` at build time with the structural guarantee that real values never reach git or the published site.
- The developer can now create `data/private/athlete-private.json` from the example template with real values at any point; the phase continues to pass with it absent.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
