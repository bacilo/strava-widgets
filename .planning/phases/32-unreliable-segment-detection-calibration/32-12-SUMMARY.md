---
phase: 32-unreliable-segment-detection-calibration
plan: 12
subsystem: testing
tags: [vitest, vi.mock, fs, import-time-guard, gap-closure]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: 32-VERIFICATION.md gap #2 finding — the vacuous fs-spy import guards
provides:
  - a `vi.mock('fs')`/`vi.mock('node:fs')` recorder that observes readFileSync/readdirSync/writeFileSync through both the named-import and default-import idioms
  - two committed positive-control probe modules proving the recorder is falsifiable
  - a watched-failing demonstration (quoted below) proving the negative assertion can go red
  - deletion of both structurally vacuous `vi.spyOn(fs, ...)` guards, replaced with pointer comments
affects: [32-unreliable-segment-detection-calibration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mock('fs', async (importOriginal) => ...) with vi.hoisted() for the shared call recorder — the only mechanism proven (via a genuinely reading probe) to observe both `import { readFileSync } from 'fs'` and `import fs from 'fs'`"
    - "Positive-control probe modules under scripts/lib/ that deliberately violate the invariant being tested, so a negative assertion can be watched failing on demand"

key-files:
  created:
    - scripts/lib/import-time-read-probe-named.mjs
    - scripts/lib/import-time-read-probe-default.mjs
    - scripts/unreliable-segment-import-guards.test.mjs
  modified:
    - scripts/compute-unreliable-segment-recount.test.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs

key-decisions:
  - "Isolated the vi.mock('fs') guard into its own file rather than adding it to either sibling test file, because vi.mock is hoisted file-wide and would have contaminated 40+ real fs-using tests in each sibling"
  - "Wrapped fs functions on both the named-export surface and a synthesized `default` object in the same factory, and mocked both 'fs' and 'node:fs' specifiers, so the guard is idiom-independent and prefix-independent for any future edit to either generator script"

requirements-completed: [SEG-02, SEG-04]

# Metrics
duration: 12min
completed: 2026-09-20
---

# Phase 32 Plan 12: Replace Vacuous Import-Time fs-Spy Guards Summary

**Replaced two `vi.spyOn(fs, 'readFileSync')` guards that could never observe a named-import call with a `vi.mock('fs')` recorder proven (via two positive-control probes and a watched-failing demonstration) to catch a genuine import-time read through both fs import idioms.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-20T21:32:51+02:00 (worktree base commit)
- **Completed:** 2026-09-20T21:42:03+02:00
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Closed 32-VERIFICATION.md gap #2: the "module import triggers no disk read" claim for both `compute-unreliable-segment-recount.mjs` and `compute-unreliable-segment-calibration.mjs` is now carried by a mechanism that can actually fail.
- Proved the mechanism is idiom-independent with two positive-control probes (named-import and default-import) whose only purpose is to be caught, and confirmed both control assertions check for a *recorded call*, not merely a successful import.
- Ran a one-off watched-failing demonstration: pointed the recount guard's negative assertion at the reading probe instead of the real script, watched it go red with a recorded `readFileSync` call, then reverted.
- Deleted both vacuous `vi.spyOn(fs, ...)` blocks and left pointer comments explaining why the old mechanism could not fail, citing 32-VERIFICATION.md gap #2.
- Verified zero changes to either production generator script (`git diff --name-only` on both `.mjs` files is empty).

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit the two positive-control probes and the observing guard file** - `fe1c4f84` (feat)
2. **Task 2: Delete the two vacuous guards and leave a pointer in their place** - `372d6a8d` (test)

**Plan metadata:** committed separately by the orchestrator after all worktree agents in this wave complete (per this plan's execution instructions, STATE.md/ROADMAP.md are not touched here).

## Files Created/Modified

- `scripts/lib/import-time-read-probe-named.mjs` - positive control: reads `package.json` at import time via `import { readFileSync } from 'fs'`
- `scripts/lib/import-time-read-probe-default.mjs` - positive control: reads `package.json` at import time via `import fs from 'fs'`
- `scripts/unreliable-segment-import-guards.test.mjs` - the observing guard: `vi.mock('fs')`/`vi.mock('node:fs')` recorder, two control tests, two negative-assertion tests (recount, calibration), and a fifth test that mirrors `compute-elevation-calibration.test.mjs`'s mechanism-independent mtime check on `32-CALIBRATION.md`
- `scripts/compute-unreliable-segment-recount.test.mjs` - vacuous `describe('import-time side effects', ...)` block deleted, replaced with a pointer comment; unused `fs`/`vi` imports removed
- `scripts/compute-unreliable-segment-calibration.test.mjs` - vacuous `describe('import-time side effects', ...)` block (three spies) deleted, replaced with a pointer comment; unused `fs`/`vi` imports removed

## Reachability Evidence (both directions, as required)

### Direction (a): the new guard PASSES against the real, side-effect-free modules

```
$ npx vitest run scripts/unreliable-segment-import-guards.test.mjs
 RUN  v4.0.18 /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-a67bb7c099505f6b1

 ✓ scripts/unreliable-segment-import-guards.test.mjs (5 tests) 129ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

All 5 tests: both controls (named-import probe, default-import probe) recorded a `readFileSync`
call mentioning `package.json` and confirmed `probeLength > 0`; the recount import, the
calibration import, and the `32-CALIBRATION.md` mtime check all passed with zero recorded calls
and an unchanged mtime.

### Direction (b): the new guard FAILS on demand against a deliberately side-effecting probe

One-off demonstration (per the plan's acceptance criteria): temporarily pointed the recount
guard's negative assertion (`expect(calls).toEqual([])`) at a dynamic import of
`./lib/import-time-read-probe-named.mjs` instead of the real recount script, ran it, then
reverted.

```
$ npx vitest run scripts/unreliable-segment-import-guards.test.mjs -t "performs no disk read at import"
 ❯ scripts/unreliable-segment-import-guards.test.mjs (5 tests | 1 failed | 4 skipped) 11ms
     × records zero fs calls 11ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  scripts/unreliable-segment-import-guards.test.mjs > compute-unreliable-segment-recount.mjs performs no disk read at import > records zero fs calls
AssertionError: expected [ { fn: 'readFileSync', …(1) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "arg0": "file:///Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-a67bb7c099505f6b1/package.json",
+     "fn": "readFileSync",
+   },
+ ]

 Test Files  1 failed (1)
      Tests  1 failed | 4 skipped (5)
```

The negative assertion went red with a recorded `readFileSync` entry pointing at the exact file
the probe reads. The edit was then reverted and the file re-confirmed green (5/5 passed).

This satisfies the plan's reachability bar: the guard is proven to pass on the real module AND to
fail on demand against a module that genuinely performs the forbidden call.

## Before/After Test Counts (Task 2, sibling files)

| File | Before (2026-09-20 gate) | After | Delta | Reason |
|---|---|---|---|---|
| `scripts/compute-unreliable-segment-recount.test.mjs` | 47 | 46 | -1 | Vacuous `import-time side effects` block deleted; its coverage is now carried by the new guard file's non-vacuous equivalent test |
| `scripts/compute-unreliable-segment-calibration.test.mjs` | 57 | 56 | -1 | Same — three-spy vacuous block deleted; superseded by the new guard file's calibration test plus the independent mtime test |

Verified directly:

```
$ npx vitest run scripts/compute-unreliable-segment-recount.test.mjs scripts/compute-unreliable-segment-calibration.test.mjs scripts/unreliable-segment-import-guards.test.mjs
 ✓ scripts/unreliable-segment-import-guards.test.mjs (5 tests) 118ms
 ✓ scripts/compute-unreliable-segment-calibration.test.mjs (56 tests) 20ms
 ✓ scripts/compute-unreliable-segment-recount.test.mjs (46 tests) 7ms

 Test Files  3 passed (3)
      Tests  107 passed (107)
```

`grep -c "vi.spyOn(fs" scripts/compute-unreliable-segment-recount.test.mjs
scripts/compute-unreliable-segment-calibration.test.mjs` → `0` and `0` (confirmed after
rewording the pointer comments to avoid re-triggering the same literal pattern they describe).
`grep -c "unreliable-segment-import-guards"` on both files → `1` and `1` (pointer present).

## Production Scripts Unchanged

```
$ git diff --name-only scripts/compute-unreliable-segment-recount.mjs scripts/compute-unreliable-segment-calibration.mjs
(empty)
```

D-15's zero-import guarantee and the artifact's byte-identical regeneration are untouched — no
edits were made to either generator's source.

## No Production Importer of the Probes

```
$ grep -rn "import-time-read-probe" scripts src | grep -v "unreliable-segment-import-guards.test.mjs" | grep -v "scripts/lib/import-time-read-probe"
(empty)
```

## tsc / npm test (bare-worktree environment)

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm test
 Test Files  7 failed | 83 passed | 1 skipped (91)
      Tests  3 failed | 2644 passed | 23 skipped (2670)
```

The 7 failing files (`scripts/verify-dashboard-publish-stats.test.mjs`,
`src/dashboard/views/records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`,
`trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`,
`detail-sections.test.ts`) all fail on `ENOENT` against `data/stats/**` fixture files that were
never generated in this bare worktree checkout (per this plan's environment note: roughly ten
unrelated fixture-driven files are expected to fail here and are not a regression). None of the
failing files are among this plan's `files_modified`, and none reference `unreliable-segment` or
`fs-spy`/`vi.mock`. This is environmental, not a regression — the orchestrator's post-merge
`npm test` on the primary checkout is the real gate. Net change versus the 90-file/2,788-test
baseline this plan targets: -2 vacuous tests (one per sibling file) +5 new guard-file tests = +3
net, consistent with 107 passing across the three touched files here.

## Decisions Made

- **D-12/D-15 compliance preserved:** neither generator script was modified; the new guard proves
  (rather than merely asserts) the zero-import-I/O discipline both decisions require.
- Isolated the new `vi.mock('fs')` guard in its own file instead of inlining it into either
  sibling, because `vi.mock` is hoisted file-wide in vitest and would otherwise mock `fs` for
  every other test in that file — contaminating 40+ real fs-using tests per sibling file.
- Mocked both `'fs'` and `'node:fs'` specifiers with the same factory, and wrapped the functions
  on both the named-export surface and a synthesized `default` object, so a future edit to either
  script (idiom or specifier prefix) cannot silently reopen this hole.

## Deviations from Plan

None - plan executed exactly as written. The one wording adjustment made mid-task (rephrasing the
pointer comments in both sibling files to avoid containing the literal substring `vi.spyOn(fs`)
was necessary to satisfy the plan's own acceptance grep and is not a deviation from scope — it is
part of correctly executing Task 2's stated acceptance criteria.

## Issues Encountered

Initial pointer-comment wording in both sibling test files quoted the old mechanism's exact
syntax (`vi.spyOn(fs, 'readFileSync')`), which caused the acceptance grep
(`grep -c "vi.spyOn(fs"`) to still find 2 matches per file — not real spy usage, just prose
describing it. Reworded both comments to describe the old mechanism without reproducing the
literal pattern, re-verified the grep returns `0` for both files, and re-ran the full three-file
test suite to confirm no regression from the wording change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

GAP 2 from 32-VERIFICATION.md is closed: the "no disk read at import" claim for both generator
scripts is now backed by a guard proven reachable in both directions. This plan does not touch
`src/analytics/unreliable-segments.ts` (owned by the parallel 32-11 gap-closure plan covering
GAP 1) or `.planning/STATE.md`/`.planning/ROADMAP.md` (owned by the orchestrator after this wave
completes).

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: scripts/lib/import-time-read-probe-named.mjs
- FOUND: scripts/lib/import-time-read-probe-default.mjs
- FOUND: scripts/unreliable-segment-import-guards.test.mjs
- FOUND: fe1c4f84 (feat commit, Task 1)
- FOUND: 372d6a8d (test commit, Task 2)
