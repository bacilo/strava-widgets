---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 07
subsystem: analytics
tags: [best-effort, ceiling-state, write-gate, cli-flag, ci-workflow, typescript, vitest]

# Dependency graph
requires:
  - phase: 36-04
    provides: "computeBestEfforts calling the real clean-window search on every run, which moves the population/p90/ceiling at every distance and makes data/best-effort-ceiling.json's unconditional write hazard (28 WR-06) fire on an ordinary local run — the live evidence this plan's gate had to close"
provides:
  - "ComputeBestEffortsOptions.writeCeilingState (default false, explicit === true) — the committed data/best-effort-ceiling.json write is now conjunctively gated on the opt-in AND the ceiling having moved"
  - "ComputeStepOptions — the per-invocation value threaded through ComputeStep.run and runComputeAllStatsSteps, never read from an ambient global inside a step closure"
  - "--write-ceiling-state CLI flag on both computeAllStatsCommand and computeBestEffortsCommand"
  - "daily-refresh.yml's compute-all-stats step as the sole invocation that passes --write-ceiling-state; its own and the auto-commit step's comments corrected to state the closed hazard, not the open one"
  - "src/analytics/ceiling-state-write-gate.test.ts — both-directions proof, including the byte-unchanged case over an existing disagreeing file and a flag-on-vs-off deep-equal proof that no derived figure changes"
affects: [36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conjunctive write gate, fail-closed default: the committed baseline write requires BOTH an explicit per-invocation opt-in (resolved via === true, never a bare truthy check) AND a non-empty movement diff — never either alone"
    - "Per-invocation value threaded as an explicit function argument through a step table, never read from an ambient global (process.argv/process.env) inside a step's own closure — the existing --ci precedent's own gap this plan closes for a second flag"
    - "A skipped write is reported, never silent — the console movement report and the committed write are deliberately decoupled so a local run still sees what it isn't allowed to persist"

key-files:
  created:
    - src/analytics/ceiling-state-write-gate.test.ts
  modified:
    - src/analytics/compute-best-efforts.ts
    - src/compute-all-stats-steps.ts
    - src/compute-all-stats-steps.test.ts
    - src/index.ts
    - .github/workflows/daily-refresh.yml
    - src/analytics/compute-best-efforts.test.ts

key-decisions:
  - "D-11 implemented exactly as delegated: explicit opt-in flag, off by default, gated at the option/CLI-flag boundary rather than inside the pure derivation modules (best-effort-ceiling.ts / best-effort-ceiling-state.ts stay byte-untouched, confirmed by empty git diff)"
  - "Docblock prose describing the new ComputeStepOptions/threading rationale had to avoid spelling the literal strings 'process.argv'/'process.env' anywhere in compute-all-stats-steps.ts's own text, since the verify script (correctly) bans any occurrence of those substrings in that file to keep the module genuinely free of ambient reads — reworded to describe the mechanism ('the process's own argument vector or its environment') instead of naming it literally"
  - "The three pre-existing Phase 28 D-06/D-07 tests in compute-best-efforts.test.ts (a file otherwise owned by 36-05 in this wave) were broken by this plan's own default-off behavior change, since they call computeBestEfforts() expecting an unconditional write. Added writeCeilingState: true to exactly those three call sites — see Deviations."

requirements-completed: [PR-08, PR-09]

# Metrics
duration: ~50min
completed: 2026-09-28
---

# Phase 36 Plan 07: Ceiling-State Write Gate Summary

**Gated `data/best-effort-ceiling.json`'s write behind an explicit `writeCeilingState` opt-in (default false, `=== true` resolved) threaded as `ComputeStepOptions` through the step table and a new `--write-ceiling-state` CLI flag, with the nightly `daily-refresh.yml` workflow as the sole invocation that passes it — closing 28 WR-06.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-28
- **Tasks:** 3 (all `type="auto"`, autonomous)
- **Files modified:** 6 declared in `files_modified` + 1 additional (`compute-best-efforts.test.ts`, see Deviations)

## Accomplishments

- The committed ceiling-state file is now written only when an explicit, per-invocation opt-in is passed AND the ceiling actually moved — never either condition alone, and never as a side effect of an unrelated local command.
- **Reproduced the exact live hazard this plan closes, on the real archive, with hashes:** `data/best-effort-ceiling.json`'s sha256 before and after an ordinary `npm run compute-best-efforts` run is IDENTICAL (`01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20`, both before and after), even though the console's own movement report shows every distance's ceiling genuinely moved (400m 5.1098→5.0295 m/s, 1k 4.7496→4.7111, 1mi 4.6281→4.5982, 5k 4.3452→4.3384, 10k 4.2204→4.2521, half became fail-open) — exactly the scenario that dirtied this file during 36-04's own worktree setup (its SUMMARY's deviation 6) before this gate existed. The run's own printed line confirms the skip: `Ceiling moved but the write to data/best-effort-ceiling.json was skipped (opt-in --write-ceiling-state absent)`.
- Confirmed the "unguarded" direction historically, read-only: `git show 17b5a455...:src/analytics/compute-best-efforts.ts` shows the pre-this-plan write condition was the unconditional `if (ceilingMovement.length > 0)` — the exact code path that produced the live hazard.
- `ComputeStepOptions.writeCeilingState` is threaded as an explicit function argument through `ComputeStep.run` and `runComputeAllStatsSteps`, never read from an ambient global inside a step's own closure — confirmed by the verify script's own `process.argv`/`process.env` absence check on `compute-all-stats-steps.ts`.
- The nightly `daily-refresh.yml` workflow's `compute-all-stats` step is the one invocation that passes `--ci --write-ceiling-state`; its own comment and the auto-commit step's comment were both corrected — the auto-commit step's prior sentence ("That includes local runs, which then dirty this CI-committed file too.") is now false and was replaced, not left standing.
- `package.json`'s three scripts (`compute-best-efforts`, `compute-all-stats`, `process`) are confirmed unchanged (`git diff` empty).
- `src/analytics/ceiling-state-write-gate.test.ts` watches the gate in both directions on a `CEILING_MIN_POPULATION`-sized synthetic fixture where the ungated code would have written: no-prior-file × flag-absent/-present, existing-disagreeing-file × flag-absent/-present (byte-identical vs byte-changed, compared as raw strings), and a flag-on-vs-off deep-equal proof that no single derived figure changes either way.

## Task Commits

1. **Task 1: The option and the two-condition write gate** - `9c18a7a4` (feat)
2. **Task 2: Thread the per-invocation flag through the step table, the two CLI commands and the CI workflow** - `7ff74633` (feat)
3. **Task 3: Watch the gate in both directions, including the byte-unchanged case over an existing file** - `46f02095` (test)

**Plan metadata:** committed separately below, per the phase's own `docs({phase}-{plan}): complete...` convention (final-commit step).

## Files Created/Modified

- `src/analytics/compute-best-efforts.ts` - `writeCeilingState?: boolean` option (docblock states the two D-11 bounds and names 28 WR-06 + the workflow step); default resolved with explicit `=== true`; write condition now `writeCeilingState && ceilingMovement.length > 0`; a skipped-write console line when the ceiling moved but the opt-in was absent. `best-effort-ceiling.ts`/`best-effort-ceiling-state.ts` untouched (confirmed empty `git diff`).
- `src/compute-all-stats-steps.ts` - New `ComputeStepOptions { writeCeilingState: boolean }`; `ComputeStep.run` widened to `(options: ComputeStepOptions) => Promise<void>`; the `compute-best-efforts` step forwards `options.writeCeilingState`; `runComputeAllStatsSteps` threads it into every `step.run(...)` call.
- `src/compute-all-stats-steps.test.ts` - Fixed 4 pre-existing `runComputeAllStatsSteps` call sites broken by the widened signature (added `writeCeilingState: false`); added one new threading test recording the `ComputeStepOptions` a synthetic step receives across two `writeCeilingState` values, never calling a real `COMPUTE_ALL_STATS_STEPS` member — this satisfies Task 3's own item 4 requirement, landed in the Task 2 commit out of practical necessity (the file had to compile for Task 2's own `tsc`/vitest verify gate; see Deviations).
- `src/index.ts` - `computeBestEffortsCommand` and `computeAllStatsCommand` both read `--write-ceiling-state` from `process.argv` and forward it; `announcedSteps`'s wrapper forwards the threaded `ComputeStepOptions`; help text updated for both subcommands plus one CI-form example line.
- `.github/workflows/daily-refresh.yml` - `compute-all-stats` step's invocation gains `--write-ceiling-state`; its comment states the reason; the auto-commit step's now-false sentence about local runs dirtying the file is replaced with a corrected statement naming the flag.
- `src/analytics/ceiling-state-write-gate.test.ts` (new) - The both-directions proof (5 tests, see Verification Evidence).
- `src/analytics/compute-best-efforts.test.ts` - 3 pre-existing Phase 28 D-06/D-07 tests updated with `writeCeilingState: true` (see Deviations — this file is owned by 36-05 in this wave; the touch is minimal and isolated to this one describe block).

## Decisions Made

D-11 implemented exactly as delegated in `36-CONTEXT.md`/`36-RESEARCH.md` — explicit opt-in flag, default false, gated at the option/CLI-flag boundary. No new architectural decision was made; every choice below is a mechanical consequence of that delegation:

- The write-gate docblocks in `compute-all-stats-steps.ts` describe the "no ambient read" rationale without spelling `process.argv`/`process.env` literally, since the file's own verify script forbids either substring appearing anywhere in the file (to keep the guarantee mechanically checkable, not just asserted in prose).
- `writeCeilingState` is resolved with an explicit `=== true` (not a bare truthy check) per D-11's own bound, so an untyped `.mjs` caller passing a truthy non-boolean cannot opt in by accident.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docblock prose introduced the exact ambient-read literals the verify script bans**
- **Found during:** Task 2 verification (`process.argv not in st and process.env not in st`)
- **Issue:** The new `ComputeStepOptions`/`runComputeAllStatsSteps` docblocks explained the "why not read from an ambient global" rationale by naming `process.argv`/`process.env` literally in the prose — which the verify script's own assertion (correctly) treats as a leak, since it wants the file provably free of those substrings, not merely free of the *code path*.
- **Fix:** Reworded both docblocks to describe the mechanism ("the process's own argument vector or its environment") without spelling the literal identifiers.
- **Files modified:** `src/compute-all-stats-steps.ts`
- **Verification:** `grep -n "process.argv\|process.env" src/compute-all-stats-steps.ts` → no matches; verify script's assertion passes.
- **Committed in:** `7ff74633` (Task 2 commit — fixed before committing)

**2. [Rule 3 - Blocking] Pre-existing `compute-all-stats-steps.test.ts` call sites broke compilation once `runComputeAllStatsSteps`'s signature widened**
- **Found during:** Task 2, `npx tsc --noEmit`
- **Issue:** Four existing calls to `runComputeAllStatsSteps(steps, { continueOnError, ... })` omitted the now-required `writeCeilingState` field, since that file predates this plan's flag.
- **Fix:** Added `writeCeilingState: false` to each of the four call sites (a value irrelevant to what those tests actually assert). Also added the Task-3-required threading test in the same pass, since the file was already open for this mechanical fix and needed to compile for Task 2's own verify gate regardless — see the "Files Created/Modified" note on `compute-all-stats-steps.test.ts` above for why this test landed one commit earlier than the plan's own task numbering.
- **Files modified:** `src/compute-all-stats-steps.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run src/compute-all-stats-steps.test.ts` — 11/11 pass.
- **Committed in:** `7ff74633` (Task 2 commit)

**3. [Rule 1 - Bug, cross-plan file] Three pre-existing Phase 28 D-06/D-07 tests in `compute-best-efforts.test.ts` broke because they assumed the OLD unconditional write**
- **Found during:** Task 3, `npm test` (full suite)
- **Issue:** `describe('committed ceiling state (Phase 28 D-06/D-07)')`'s three tests call `computeBestEfforts({...})` with no `writeCeilingState` and then read the written file — a direct, necessary consequence of Task 1's own default-off behavior change, not a pre-existing bug. **This file is nominally owned by 36-05 in this parallel wave** (per this plan's own `<parallel_execution>` instructions), so this is a flagged cross-plan touch, not a routine in-scope fix.
- **Fix:** Added `writeCeilingState: true` to exactly the three `computeBestEfforts` call sites inside that one describe block (and its shared `common` object literal for the second/third tests) — no other line in the file was touched. Each edit carries a one-line comment naming 36-07/D-11 so a reader of `compute-best-efforts.test.ts` understands why these three call sites differ from every other call site in the file.
- **Files modified:** `src/analytics/compute-best-efforts.test.ts` (9 lines changed, isolated to the `'committed ceiling state (Phase 28 D-06/D-07)'` describe block, lines ~2395-2518)
- **Verification:** `npm test` — 103/103 files, 3834/3834 tests pass (full suite, post-fix).
- **Committed in:** `46f02095` (Task 3 commit)
- **Flag for orchestrator/merge:** this is the one file this plan touched outside its declared `files_modified` list, and outside its declared file-ownership boundary with 36-05. The diff is 9 lines, confined to one describe block unrelated to 36-05's clean-window-search scope (different lines, different describe block), so a three-way merge should apply cleanly — but this is called out explicitly in case 36-05's own concurrent edits to this file touch the same describe block.

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — a self-inflicted docblock literal collision and a cross-plan test fixup necessitated by this plan's own behavior change; 1 Rule 3 — a mechanical compile-time fixup of pre-existing test call sites).
**Impact on plan:** None touch this plan's own design. Deviation 3 is the only one with cross-plan surface — flagged explicitly above for the orchestrator's merge step.

## Issues Encountered

None beyond the three deviations above, all resolved without any change to this plan's own design.

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every task boundary and at final state.
- `npm test` — **103/103 files, 3834/3834 tests pass** (full suite, unfiltered, post all three tasks).
- `npx vitest run -t "writeCeilingState"` — **6 tests matched, 6 passed** across 2 files (`src/analytics/ceiling-state-write-gate.test.ts`'s 5 tests + `src/compute-all-stats-steps.test.ts`'s 1 threading test) — not 0, confirming the filter is not vacuous.
- `git diff --stat` for `best-effort-ceiling.ts`, `best-effort-ceiling-state.ts`, `package.json` — all empty, confirmed.
- `git status --porcelain data/` — empty, confirmed before every commit in this plan and after the live-evidence `npm run compute-best-efforts` run below.
- `git diff --stat 17b5a455...HEAD -- src/ .github/` touches 7 files: the 6 declared in `files_modified` plus `src/analytics/compute-best-efforts.test.ts` (see Deviation 3).
- **fs-spy-cannot-observe-named-imports check:** this plan's gate test asserts against the real filesystem (`readFileSync`'s raw string, and a `throw` on a missing file) rather than a `vi.spyOn(fs, 'writeFileSync')` mock — so there is no named-import blind spot to confirm; the assertion is against actual on-disk bytes, the strongest possible observation.
- **Live-evidence reproduction (both directions):**
  - Guarded refusal, on the real archive: `npm run compute-best-efforts` (built via `npm run build`) reported real movement at every distance (400m 5.1098→5.0295, 1k 4.7496→4.7111, 1mi 4.6281→4.5982, 5k 4.3452→4.3384, 10k 4.2204→4.2521, half became fail-open) and printed `Ceiling moved but the write to data/best-effort-ceiling.json was skipped (opt-in --write-ceiling-state absent)`. `sha256sum data/best-effort-ceiling.json` before and after: **identical** (`01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20`), and `git status --porcelain data/` stayed empty.
  - Unguarded rewrite, historical/read-only: `git show 17b5a455acee6060107e09efa8e201b2e51e8585:src/analytics/compute-best-efforts.ts | grep "if (ceilingMovement.length > 0)"` confirms the pre-this-plan write condition was unconditional on movement alone — the exact code path that produced 36-04's own live hazard (its SUMMARY's deviation 6).

## Known Stubs

None.

## Threat Flags

None — this plan closes an existing, already-registered threat (T-36-35..T-36-40 in this plan's own `<threat_model>`); it introduces no new network endpoint, auth path, file access pattern, or schema change at a trust boundary.

## Next Phase Readiness

- 28 WR-06 is closed: the committed `data/best-effort-ceiling.json` cannot be dirtied by any hand-run entry point; only the nightly CI workflow's explicit `--write-ceiling-state` invocation can rewrite it.
- Plan 36-10 (D-09/D-11's own downstream: the ceiling recalibration artifact + PR-09's diff/recount) can now safely run `computeBestEfforts` locally without opt-in and trust that the committed baseline stays exactly what CI last produced, until it deliberately opts in to regenerate it.
- No blockers. This plan ticks no requirement beyond PR-08/PR-09 (already the phase's own declared requirements for this plan) and edits no other planning document, per its own "Requirement-tick safety" objective note.

## Self-Check: PASSED

All created/modified files confirmed present on disk (`ceiling-state-write-gate.test.ts`, `compute-best-efforts.ts`, `compute-all-stats-steps.ts`, `compute-all-stats-steps.test.ts`, `index.ts`, `daily-refresh.yml`, `compute-best-efforts.test.ts`, this SUMMARY). All three task commits (`9c18a7a4`, `7ff74633`, `46f02095`) confirmed present via `git log --oneline --all`.

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
