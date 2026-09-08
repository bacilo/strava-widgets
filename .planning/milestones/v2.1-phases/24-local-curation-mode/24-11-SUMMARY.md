---
phase: 24-local-curation-mode
plan: 11
subsystem: build-time curation guard
tags: [security, build-tooling, tdd, gap-closure]
dependency-graph:
  requires: ["24-10"]
  provides: ["UNSCANNED_EXTENSIONS fail-closed content scan in curation-guard.mjs"]
  affects: ["scripts/build-widgets.mjs (assertNoCurationArtifacts, unchanged import)"]
tech-stack:
  added: []
  patterns: ["inverted skip-list over allowlist", "planted-fixture RED-then-GREEN proof (D-11)", "skipIf-guarded whole-tree regression case"]
key-files:
  created: []
  modified:
    - scripts/lib/curation-guard.mjs
    - scripts/lib/curation-guard.test.mjs
decisions:
  - "D-10/D-11 applied per plan: single justified .json exemption; every RED case observed failing before the fix landed"
metrics:
  duration: "~35min"
  completed: 2026-09-02
---

# Phase 24 Plan 11: Fail-closed curation-guard content scan Summary

Inverted `curation-guard.mjs`'s extension allowlist (`SCANNED_EXTENSIONS`) to a single-entry
justified skip-list (`UNSCANNED_EXTENSIONS = ['.json']`), closing GAP-24-02 (CR-02): the guard now
content-scans every file — including the 22 `.d.ts`, `.mjs`, and any extensionless files that were
previously silently exempted — and fails CLOSED on any extension nobody anticipated.

## What Was Built

- **Task 1 (RED):** Four new planted-fixture cases added to `curation-guard.test.mjs` — a marker-bearing
  `.d.ts` file, a marker-bearing `.mjs` file, a marker-bearing extensionless file, and a marker-free
  file literally named `.curate-dist`. Confirmed FAILING against the unmodified guard (D-11).
- **Task 2 (GREEN):** `SCANNED_EXTENSIONS` replaced with `UNSCANNED_EXTENSIONS = ['.json']` (the sole,
  load-bearing exemption for the public `best-effort-exclusions.json`). The `ext === null` skip branch
  was removed so extensionless files fall through to the content scan. Content is now read as `latin1`
  instead of `utf8` so arbitrary bytes never throw. A file-name check for a FILE literally named
  `.curate-dist` was added beside the existing `__curate` name check. The docblock was rewritten to
  justify the single exemption. All four T1 fixtures turned GREEN; 15/15 tests pass.
- **Task 3:** A `describe.skipIf`-guarded whole-tree regression case was added, proving
  `findCurationArtifacts` returns `[]` against the real published `dist/widgets` tree. `npm run
  build-widgets` confirmed exiting 0 with the `✓ Curation-artifact scan` line. Scanned-vs-skipped file
  census recorded (see below). The `.d.ts`-publication question is surfaced to the operator, unactioned.

## D-11: RED (Task 1, against the unmodified guard)

Verbatim `npx vitest run scripts/lib/curation-guard.test.mjs` output, captured before any change to
`curation-guard.mjs`:

```
 ✓ scripts/lib/curation-guard.test.mjs (15 tests | 4 failed)
     ✓ clean tree: returns exactly []
     ✓ non-existent directory: returns []
     ✓ planted __curate directory: non-empty, a violation path contains "__curate"
     ✓ planted marker in a .js file: non-empty (the case a data-only scan would miss)
     ✓ planted marker in index.html: non-empty
     ✓ planted .curate-dist directory inside the tree: non-empty
     × dist/widgets publishes 22 .d.ts files today: a planted marker in a .d.ts file is flagged (D-11)
     × a stray copy of scripts/curate-server.mjs, carrying every route literal, is flagged (D-11)
     × an extensionless file (scanExtension returns null, the fail-open class) is flagged (D-11)
     × a marker-free file literally named .curate-dist (the curate overlay's esbuild output) is flagged by name, not content (D-11)
     ✓ never catches the published exclusions data file, which must keep returning 200
     ✓ SCANNED_EXTENSIONS does not include .json
     ✓ contains assertNoCurationArtifacts and a process.exit(1) inside that wrapper
     ✓ calls assertNoCurationArtifacts() after await buildDashboard() after copyDataFiles();
     ✓ assertNoCurationArtifacts is NOT called from inside copyDataFiles()

 FAIL scripts/lib/curation-guard.test.mjs > findCurationArtifacts > dist/widgets publishes 22 .d.ts files today: a planted marker in a .d.ts file is flagged (D-11)
 AssertionError: expected 0 to be greater than 0
 FAIL scripts/lib/curation-guard.test.mjs > findCurationArtifacts > a stray copy of scripts/curate-server.mjs, carrying every route literal, is flagged (D-11)
 AssertionError: expected 0 to be greater than 0
 FAIL scripts/lib/curation-guard.test.mjs > findCurationArtifacts > an extensionless file (scanExtension returns null, the fail-open class) is flagged (D-11)
 AssertionError: expected 0 to be greater than 0
 FAIL scripts/lib/curation-guard.test.mjs > findCurationArtifacts > a marker-free file literally named .curate-dist (the curate overlay's esbuild output) is flagged by name, not content (D-11)
 AssertionError: expected 0 to be greater than 0

 Test Files  1 failed (1)
      Tests  4 failed | 11 passed (15)
```

All four new cases failed with `violations.length` equal to 0, exactly as the plan predicted. All 11
pre-existing cases still passed. This confirms `24-VERIFICATION.md` gap 2's reproduction held and the
premise of this plan was correct.

## D-11: GREEN (Task 2, after inverting to UNSCANNED_EXTENSIONS)

Verbatim `npx vitest run scripts/lib/curation-guard.test.mjs` output, captured immediately after the
guard fix landed:

```
 ✓ scripts/lib/curation-guard.test.mjs (15 tests) 18ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
```

All 15 cases pass, including the four that were RED in Task 1. The RED-to-GREEN transition for the
marker-free `.curate-dist` fixture specifically comes from the new file-name check added in Task 2(d)
— its planted content carries no marker, so its pass could only come from the name check, never from
the content scan.

## Task 3: Real-tree proof and file census

`npm run build-widgets` against this worktree's own freshly-built `dist/widgets` tree exits 0 and
prints:

```
✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.
```

**Worktree constraint disclosed:** `dist/widgets` is gitignored except for a single tracked
`dist/widgets/test.html` placeholder (see `.gitignore` lines 2-7), so this worktree's own build starts
from a fresh, smaller tree (this worktree's `data/` checkout produced 3,756 total files: 3,730 `.json`,
18 `.js`, 6 `.html`, 2 `.css`; zero `.ts`/`.map`/`.DS_Store`, because nothing in `build-widgets.mjs`
emits sourcemaps or declarations — those are legacy artifacts accumulated in the main repo's checkout
over time, never cleaned since `dist/widgets` itself is never emptied). To satisfy the plan's actual
load-bearing claim — that the stricter guard does not false-positive on the real, currently-published
22-`.d.ts` tree — `findCurationArtifacts` (this worktree's modified module) was also run read-only
against the main repo's real `dist/widgets` checkout at
`/Users/pedf/workspace/strava-widgets/dist/widgets`:

```
$ node -e "import('./scripts/lib/curation-guard.mjs').then(m => console.log('violations:', m.findCurationArtifacts('/Users/pedf/workspace/strava-widgets/dist/widgets').length))"
violations: 0
```

Scanned-vs-skipped census, derived by command against that real tree:

```
$ find /Users/pedf/workspace/strava-widgets/dist/widgets -type f | wc -l
5721
$ find /Users/pedf/workspace/strava-widgets/dist/widgets -type f -name "*.json" | wc -l
5588
$ find /Users/pedf/workspace/strava-widgets/dist/widgets -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
5588 json
  58 js
  44 map
  22 ts
   5 html
   2 css
   2 DS_Store
```

Total 5,721 files; 5,588 `.json` skipped (the sole `UNSCANNED_EXTENSIONS` exemption); 133 files now
content-scanned that the old allowlist would have partly missed — including all **22** `.d.ts` files
(counted under the `.ts` extension bucket, since `scanExtension` slices from the last dot), all 44
`.map` files, and the 2 `.DS_Store` files. Zero violations across the whole scanned set — the stricter
guard does not regress today's real published bundle.

The `describe.skipIf`-guarded whole-tree regression case added in `curation-guard.test.mjs` (guarded on
`existsSync(dist/widgets/index.html)`) ran (not skipped) against this worktree's own built tree and
passed:

```
 ✓ findCurationArtifacts: whole-tree regression against the real publish directory > returns [] against the real dist/widgets tree, including its published .d.ts/.js/.map/.html/.css files
```

### Operator decision surfaced, not taken

`24-VERIFICATION.md` raised an open question: `dist/widgets` publishing 22 `.d.ts` files at all may be
unintended, and stopping their publication would be a cleaner root fix than scanning them.

- **For stopping publication:** removes the leak surface for that file class entirely — no `.d.ts` file
  could ever reach the public bundle, scanned or not.
- **Against (or: orthogonal to) stopping publication:** it is a build-configuration change (would touch
  `tsconfig.json` or the build pipeline) outside this gap's scope, and the guard change made in this
  plan is required regardless — it closes the hole for EVERY unanticipated extension class, including
  ones no root fix targeting `.d.ts` specifically could anticipate (the extensionless and `.mjs` cases
  this same plan also closed).

The guard change has been made and is unconditionally required. No build configuration, `tsconfig.json`,
or copy list was changed in this plan. The publication question itself is left for the operator.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written for all three tasks; no Rule 1/2/3 fixes were needed against
`curation-guard.mjs` or its test file.

### Disclosed environment limitations (not deviations from the plan's own scope)

**1. `npm test` (full suite) does not exit 0 in this worktree, for reasons unrelated to this plan.**
Six test files fail: `records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`,
`trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`,
`trends-zoom-logic.test.ts`. All six fail because this worktree's checkout is missing
`data/stats/*.json` (gitignored, generated data not present in a fresh worktree) and
`node_modules/chartjs-plugin-zoom` (this worktree's own `node_modules` contains only Vite cache
directories — module resolution walks up to the main repo's `node_modules`, but relative
`readFileSync`/`new URL(...)` paths inside those test files resolve against the worktree's own
filesystem, which lacks both). Confirmed via `git log` that none of the six failing files were touched
by this plan, and via `ls`/`find` that both root causes are worktree-local absences, not regressions
introduced here. Per the deviation rules' Scope Boundary ("Only auto-fix issues DIRECTLY caused by the
current task's changes... Pre-existing warnings... in unrelated files are out of scope"), these were
NOT fixed — fixing either would mean running `npm install` (excluded from Rule 3 auto-fix) or copying
generated data across worktree boundaries, both out of this plan's scope. `npx vitest run
scripts/lib/curation-guard.test.mjs` — the actual test target of this plan — passes 16/16 in every
run.

**2. This worktree's own `dist/widgets` does not match the plan's cited real-tree census.** See "Task
3: Real-tree proof and file census" above for the full explanation and the read-only cross-check
against the main repo's real tree, which reproduces the plan's exact cited numbers (5588/58/44/22/5/2/2)
and confirms zero violations.

### Stub tracking

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

### Threat Flags

None. All threats named in this plan's `<threat_model>` (T-24-11-01 through T-24-11-08, plus
T-24-11-SC) were addressed exactly as the plan's Mitigation Plan column specifies; no new
security-relevant surface was introduced outside that register.

## Self-Check: PASSED

- FOUND: scripts/lib/curation-guard.mjs
- FOUND: scripts/lib/curation-guard.test.mjs
- FOUND commit: 329423d (test: plant fixtures, observe RED)
- FOUND commit: 1ad3878 (feat: invert to UNSCANNED_EXTENSIONS)
- FOUND commit: 262d606 (test: whole-tree regression case)
