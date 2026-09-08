---
phase: 24-local-curation-mode
plan: 17
subsystem: curation-mode
tags: [browser-checkpoint, curation-guard, best-efforts, requirements-gate, roadmap-gate]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (waves 1-9, plans 24-01..24-16)
    provides: the curate server/overlay/write-path, the live-exclusions badge derivation, and the two Wave 9 fixes (WR-14 entry.isFile() guard; WR-17 resolveExcluded seam pin) this round's checkpoint validates in a real paint
provides:
  - The WR-05 mirror direction (badge suppressed by a live exclusion, badge restored by removing it) observed in a real browser paint for the first time in this phase, against an on-disk discriminator proven live (wasPRAtTheTime: true) rather than vacuous, closing GAP-24-05's last open item
  - CUR-01 ticked Complete in REQUIREMENTS.md and the Phase 24 ROADMAP gate closed, both earned on four full checkpoint rounds' rendered evidence (Round 1 → Round 4), not a mechanical match
  - The origin todo (2026-08-12-exclusion-tickbox-local-curation-mode.md) moved to completed/ with its final disposition recorded
affects: [phase-25-ci-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Reachability-before-presentation: a checkpoint row that empties its own discriminator (R19, R26) is unsatisfiable — assert wasPRAtTheTime===true from disk and HALT before presenting the row, don't discover the failure a third time in the browser", "Direct-shard-edit checkpoint construction: when a UI's own write path (Save→Recompute→Untick) cannot reach the state a row needs to discriminate, hand-edit the underlying data file directly (with byte-identity restore proven by sha256+cmp for gitignored copies) rather than accept an unsatisfiable row design"]

key-files:
  created: []
  modified:
    - .planning/phases/24-local-curation-mode/24-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/24-local-curation-mode/24-VERIFICATION.md
    - .planning/phases/24-local-curation-mode/24-REVIEW.md
    - .planning/todos/completed/2026-08-12-exclusion-tickbox-local-curation-mode.md

key-decisions:
  - "All four rows (R32-R35) recorded PASS; the disposition was SET, not withheld, per the plan's own governing rule that CUR-01 and the ROADMAP gate tick only if every mapped row is PASS"
  - "R33's gestures were orchestrator-driven rather than literally human-hand as the plan's <how-to-verify> template specifies (mirroring R34's phrasing); disclosed transparently in the Evidence provenance table rather than silently upgraded, since no native confirm() dialog gates this row the way it does R34"
  - "R34's step-2 Cancel-noop sub-check (entry still on disk, array length unchanged, checkbox restored to ticked after Cancel) rests on the human developer's report alone, not an independent orchestrator capture — precedented by Round 1's R10 disclosing the identical limitation for the identical gesture without demotion"

requirements-completed: [CUR-01]

# Metrics
duration: ~35min (Tasks 2-3 of this continuation; Task 1 was completed and committed prior to this session)
completed: 2026-09-02
---

# Phase 24 Plan 17: Round 4 BLOCKING Checkpoint (R32-R35) and CUR-01/Gate Disposition Summary

**The WR-05 mirror direction observed in a real Chrome paint for the first time in this phase — hand-edited shard holds `wasPRAtTheTime:true` + `excludedFromRecords:true` simultaneously, badge renders exactly once, then survives a human-performed untick/Cancel/re-untick/OK sequence — closing GAP-24-05, ticking CUR-01, and closing the Phase 24 ROADMAP gate.**

## Performance

- **Duration:** ~35 min (this continuation covered Task 2's write-up and Task 3's disposition; Task 1 — fresh gate, snapshots, pinned values, reachability proof — was already complete and committed as `b9caced` before this session started)
- **Tasks:** 3 total for the plan (1 complete on entry, 2 executed this session)
- **Files modified this session:** 6 (`24-VALIDATION.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `24-VERIFICATION.md`, `24-REVIEW.md`, the origin todo)

## Accomplishments

- Closed the last open item of the amended GAP-24-05: browser-row coverage of the WR-05 mirror direction, via a direct per-activity best-efforts shard edit (both the repo and `dist/widgets` copies) that leaves `wasPRAtTheTime: true` intact while flipping `excludedFromRecords` — the state R19 (Round 2) and R26 (Round 3) could never reach because their own mandated Save→Recompute→Untick sequence always zeroed `wasPRAtTheTime` first.
- R32 observed the discriminating state directly: served shard `[["400m",true,true],...]`, header renders exactly one badge `PR — 400m`, flags cells `["PR","","","",""]`. R34 observed the restore — a human-performed native-`window.confirm()` gesture (automation cannot click through it) — with the badge returning identically against the same still-stale-true precomputed flag.
- CUR-01 ticked Complete in `REQUIREMENTS.md`; the Phase 24 ROADMAP gate closed with a dated, per-item-cited "PHASE GATE CLOSED" paragraph; `24-VERIFICATION.md` gained an appended Gap-Closure Record without touching its frontmatter `status`/`score`/`gaps`; `24-REVIEW.md` gained closing one-liners on WR-14, WR-17 and the Wave 7 WR-05 trace; the origin todo moved to `completed/`.

## Task Commits

1. **Task 1: Fresh gate, build identity, snapshots, pinned values, reachability proof** - `b9caced` (docs) — completed prior to this session
2. **Task 2: Round 4 checkpoint R32-R35 write-up** - `9799e08` (docs)
3. **Task 3: Set the disposition** - `35f2d54` (docs) + `0ba5ae9` (docs, supplemental — see Deviations)

## Files Created/Modified
- `.planning/phases/24-local-curation-mode/24-VALIDATION.md` - Appended `## Round 4 Checkpoint (R32-R35)`: evidence provenance table, four row verdicts, final state check, Round 4 Observations, and a Round 4 disposition note closing GAP-24-05
- `.planning/REQUIREMENTS.md` - CUR-01 checkbox flipped `[x]`; traceability table row flipped Pending → Complete, retaining `REOPENED 2026-09-02` / "the developer kept the gate OPEN" as verbatim history
- `.planning/ROADMAP.md` - Wave 10's `24-17-PLAN.md` ticked; Phase 24 milestone checklist box ticked with a dated "PHASE GATE CLOSED" paragraph citing R32, R34, plan 24-15 and plan 24-16 by name, plus `(completed 2026-09-02)`
- `.planning/phases/24-local-curation-mode/24-VERIFICATION.md` - Appended `## Gap-Closure Record (Round 4, 2026-09-02)` naming the plan/row that closed each GAP-24-05 item and noting the frontmatter `gaps:` array is round-1 vintage and superseded; frontmatter itself untouched (diff is additions-only)
- `.planning/phases/24-local-curation-mode/24-REVIEW.md` - Three one-line closing notes appended: WR-14 ("CLOSED 2026-09-02 by plan 24-15"), WR-17 ("CLOSED 2026-09-02 by plan 24-16"), and the Wave 7 WR-05 trace ("Browser-row coverage added 2026-09-02 by plan 24-17 — see R32 and R34")
- `.planning/todos/completed/2026-08-12-exclusion-tickbox-local-curation-mode.md` - Moved from `pending/` via `git mv`; appended a dated closing note confirming Approach B shipped and step 2 stays superseded by D-04

## Round 4 Checkpoint Evidence (R32-R35), quoted

**Task 1 pinned values recap** (from the already-committed `b9caced`): `TARGET_ACTIVITY` `4556693525`, `TARGET_DISTANCE` `400m`; `PINNED_PR_SET {"400m"}` cardinality 1; `PINNED_BADGE_LABELS ["PR — 400m"]`; `PINNED_FLAGS_CELLS ["PR","","","",""]`; `PINNED_EXCLUSIONS_LENGTH` 2 (ids `3475726256`, `3475725513`); `PINNED_GENERATED_AT 2026-09-02T10:26:20.996Z`; independent cross-check `data/stats/best-efforts.json rankings['400m'][0].activityId = 4556693525`. Build identity: `assets/index-D-Ts7X8C.js` + `assets/index-B573RjUr.css` (differs from Round 3's `index-B1uN9-48.js`). Written reachability proof (e)(1) HELD: served shard read `wasPRAtTheTime: true` for `400m` before any edit; `node -e` check exit 0.

**R32 — PASS.** Setup flipped only `400m`'s `excludedFromRecords` `false→true` in both shard copies (`cmp`-identical), `wasPRAtTheTime` untouched. Cache trap excluded (navType `reload`, both resources refetched after `responseEnd`, both plain-vs-busted bodies identical). **Discriminator quoted from disk at the instant of observation:** `[["400m",true,true],["1k",false,false],["1mi",false,false],["5k",false,false],["10k",false,false]]`, `exclusionsLength: 2`, `exclusionsHasTarget: false`. **Render:** header `textContent` = `PR — 400m`, badge count `1`, flags cells `["PR","","","",""]`, `Excluded` absent. Inference in words: the precomputed flag says excluded; an implementation reading it would render zero badges; the one badge on screen came from the live document alone.

**R33 — PASS**, with two disclosed provenance caveats (neither PASS-blocking). Ticked the checkbox, typed `ROUND4-2026-09-02 GPS device unreliable`, Save; textarea value confirmed matching pre-Save, `checkboxChecked` not separately re-quoted. Cache trap excluded. Render: header `""`, badge count `0`, all five flags cells `Excluded — ROUND4-2026-09-02 GPS device unreliable`, `PRExcluded` false. On disk: `{"activityId":"4556693525","distances":null,"reason":"ROUND4-2026-09-02 GPS device unreliable"}`, `exclusions.length === 3`. Recorded explicitly (per the plan's own instruction): this row does not discriminate on its own — it is R32/R34's paired control.

**R34 — PASS**, with the Cancel-noop sub-check (step 2) recorded on the human developer's report only — precedented, not independently orchestrator-captured, by Round 1's R10 disclosing the identical limitation for the identical gesture without demoting that row. Confirm dialog quoted verbatim: `Removing this exclusion deletes it and changes PR history. Continue?` — matches `exclusion-panel.ts:143-144`/`:167-168`. **Discriminator quoted from disk at this instant:** `[["400m",true,true],...]` unchanged — no Recompute ran between R32 and R34; `exclusionsLength: 2`, `exclusionsHasTarget: false`. **Render:** header `PR — 400m`, badge count `1`, flags cells `["PR","","","",""]`, `Excluded` absent. This is the row R19 and R26 could not be.

**R35 — PASS.** sha256 after restore: `27ac99d6a9255458a6624fa46cb535ec08b67998876440fe249db4b99fc32f1a` (both `data/stats/best-efforts/4556693525.json` and its `dist/widgets` copy) and `ff74768a76821c43852faaab3e522a2a7026b1930e3172c8dcd4d7b5821894b8` (both `data/best-effort-exclusions.json` and its `dist/widgets` copy) — all four MATCH Task 1's recorded table; `cmp` OK all four. `git status --porcelain` for `data/` and `src/dashboard/styles.css`: empty. `generatedAt` still `2026-09-02T10:26:20.996Z`, `rankings['400m'][0].activityId` still `4556693525` — no Recompute ran. `git rev-parse HEAD` = `b9caced9ac1e8a04caecd7192af511e6c9063d75` = BASELINE_HEAD. Port 4173 free. Five gate commands all exit 0 (1560/1560 tests, `tsc --noEmit` clean, both builds clean including the curation-artifact scan, `verify-dashboard` 40/40). Build identity reproduced.

## Decisions Made

- All four rows PASS → disposition SET per the plan's own governing rule (CUR-01/gate tick only if every mapped row is PASS).
- R33's "Gestures, human hand" plan phrasing was not literally satisfied (orchestrator-driven, no confirm() dialog gates this row) — disclosed transparently rather than silently upgraded to human-performed; judged non-blocking since PASS criteria concern rendered/disk state, not who clicked.
- R34's Cancel-noop sub-check (step 2) rests on the developer's report alone; disclosed and precedented against Round 1's R10, which recorded the same limitation for the same gesture without demotion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected a partial-staging git error in Task 3's commit**
- **Found during:** Task 3 (committing the cross-file disposition)
- **Issue:** A single `git add` invocation listed both the todo's new (`completed/`) and old (`pending/`) paths; since `git mv` had already staged the rename, the stale `pending/` pathspec caused the whole multi-path `git add` call to fail atomically (`fatal: pathspec ... did not match any files`), silently leaving `REQUIREMENTS.md`, `ROADMAP.md`, `24-VERIFICATION.md`, `24-REVIEW.md`, and the todo's own content edit unstaged. Only the rename landed in commit `35f2d54`.
- **Fix:** Re-ran `git add` against only the correct, currently-existing paths and created a second commit (`0ba5ae9`) carrying the actual disposition content. Both commits together constitute Task 3's full, correct change; nothing was lost or reverted.
- **Files modified:** none beyond Task 3's own file list
- **Verification:** `git show --stat` on both commits confirms `35f2d54` carries only the rename and `0ba5ae9` carries the five content edits; `git status --short` is clean of Task 3's files after `0ba5ae9`
- **Committed in:** `0ba5ae9`

---

**Total deviations:** 1 auto-fixed (1 blocking, self-caused git tooling error, corrected within the same task before proceeding)
**Impact on plan:** No scope creep; Task 3 required two commits instead of one due to the staging error, both created immediately in sequence with no other work interleaved.

## Issues Encountered

None beyond the git-staging deviation above.

## Carried-Forward NOTEs (recorded, not acted on this round)

- **WR-15** — the `.json` exemption in `curation-guard.mjs` is extension-scoped rather than path-scoped, exempting 5,588 of 5,727 published files. Recorded in Round 4 (both in `24-VERIFICATION.md`'s Residual Findings and `24-REVIEW.md`) as an optional Warning; deliberately excluded from GAP-24-05's closing list because the only `.json`-directed write-path artifacts are legitimate data copies, not code.
- **IN-13** — `respond500` (`scripts/curate-server.mjs:677-682`) dereferences `error.message` unconditionally and could itself throw on a non-object thrown value, reaching the same process-kill class CR-01 fixed. Info-level, low likelihood, not acted on.
- **The 22-`.d.ts` publication question** — `dist/widgets` ships 22 `.d.ts` files by design (they pass the now-hardened `curation-guard.mjs` content scan cleanly); whether publishing them at all is intended remains an open operator decision, standing since plan 24-11, independent of the now-closed guard-hole gap.

## Next Phase Readiness

Phase 24 (Local Curation Mode) is fully closed: all 17 plans across 10 waves executed, CUR-01 ticked Complete, the ROADMAP gate closed on four full checkpoint rounds' worth of rendered evidence. No blockers carried into Phase 25 (CI Hardening & Light-Theme Verification), which has no dependency on Phase 24's subsystem.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `b9caced` (Task 1)
- FOUND: `9799e08` (Task 2)
- FOUND: `35f2d54` (Task 3, rename)
- FOUND: `0ba5ae9` (Task 3, content)
- FOUND: `.planning/phases/24-local-curation-mode/24-17-SUMMARY.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/ROADMAP.md`
