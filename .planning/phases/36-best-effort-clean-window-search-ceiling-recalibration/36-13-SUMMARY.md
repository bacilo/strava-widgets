---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 13
subsystem: analytics
tags: [best-effort, ceiling-recalibration, merge, idempotence, sha256-signature, validation-binding, vitest]

# Dependency graph
requires:
  - phase: 36-05
    provides: "the three scoping activities' real-archive BEFORE/AFTER figures and SEG-05b's load-bearing proof, cited by this plan's own checkpoint row (a) and the SEG-05b verification row"
  - phase: 36-06
    provides: "the archive-wide census and D-03 overlap invariant this plan's reachability table cites as OBSERVED evidence"
  - phase: 36-07
    provides: "the ceiling-state write gate this plan's Task 1 confirms still holds on the merged tree (sha256 unchanged through a real compute-all-stats run)"
  - phase: 36-08
    provides: "the contaminated badge/panel-row rows this plan's checkpoint round (a), (b), (f) judge"
  - phase: 36-09
    provides: "the records-disclosure and three-homes-lockstep-audit rows this plan binds into the verification map"
  - phase: 36-12
    provides: "the third reconciliation leg (recount) this plan re-runs post-merge, and whose gap-closure fix (two-part verdict, intersecting pairSpeeds) this plan's regenerated artifacts and checkpoint rows reflect for the first time"
provides:
  - "A confirmed truthful no-op merge (origin/master 5e902283 already an ancestor of local HEAD, 0 commits ahead) — MERGE-01 satisfied without rewriting any archive data"
  - "36-CEILING-RECALIBRATION.md and 36-DIFF.md regenerated on the post-merge, post-gap-closure tree and proven three-run byte-identical, with every moved figure attributed to the already-landed detector/recount fixes rather than new archive data"
  - "Two externally-computed sha256 values (recorded beside commit 893eec64) for plan 36-14's developer sign-off"
  - "A served-build digest verification (local static server, fetched assets compared byte-for-byte against the freshly built files on disk)"
  - "36-VALIDATION.md with all 26 verification-map rows bound to real task ids and non-zero matched counts (two originally-vacuous commands corrected), the Two-Direction Reachability table rewritten with OBSERVED evidence, and 8 frozen checkpoint rows (one redrafted after a reachability check found its suggested fixture no longer exists post-gap-closure) for plan 36-14"
affects: ["36-14"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Truthful no-op merge recorded with evidence (git fetch + git merge-base --is-ancestor), not assumed, mirroring the 32-09 precedent — MERGE-01 is satisfied by confirming the fetch found nothing, not by fabricating a merge commit"
    - "Idempotence proof that accounts for a sibling artifact's own legitimately-varying Generated-line citation, in addition to the artifact's own Generated line — confirmed via a widened strip pattern used only for verification (no generator code touched, since the quirk lives in an out-of-scope file)"
    - "Checkpoint rows re-verified against the CURRENT regenerated archive before being frozen, not against the plan's own suggested fixtures — one row (f) was redrafted after its suggested fixture was found unreachable post-gap-closure, following the same discipline row (b) was explicitly told to apply"

key-files:
  created: []
  modified:
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md

key-decisions:
  - "origin/master (5e902283) was confirmed a strict ancestor of local HEAD (ac7d900f) via git merge-base --is-ancestor before concluding the merge was a no-op — not inferred from the ahead/behind count alone, since a non-ancestor 0-ahead state would be a different (impossible-but-worth-ruling-out) situation"
  - "The data/geo/geo-metadata.json timestamp-only side effect from compute-all-stats was reverted via git checkout, not committed, following the 28-14 precedent exactly — outside this plan's declared file scope"
  - "A deferred-items.md file was drafted to log the nested-timestamp idempotence quirk discovered in compute-clean-window-diff.mjs, then deliberately NOT committed: this specific plan's own <verification> block requires git diff --stat to touch exactly the three declared files, and 36-13-PLAN.md's files_modified (unlike 28-14's own precedent, which explicitly added deferred-items.md to its own list) does not include one. The finding is instead recorded in full in this SUMMARY's Deviations section."
  - "Checkpoint row (f)'s suggested fixture (a single effort carrying both contaminated and demotion, e.g. 4598855187@1k) was found UNREACHABLE on the merged, post-gap-closure archive — the detector fix removed the contaminated record that previously coexisted with the ceiling demotion. Rather than force the row, it was redrafted to a two-distinct-rows-same-activity substitute (10367206938: contaminated at 5k, demoted at 10k), of which 255 real candidates exist archive-wide."

patterns-established:
  - "Verification-map binding against LIVE re-runs, not against the historical SUMMARY's own recorded counts: several -t filters' matched counts have grown since their implementing plan ran (gap-closure added new planted-defect tests), and the binding step re-measures rather than copies stale numbers."

requirements-completed: []  # This plan's own objective states explicitly: "this plan ticks NOTHING. It does not touch a requirement checkbox, the Traceability table, the SEG-05b row, the ROADMAP Phase 36 checkbox, the progress table or STATE.md. Plan 36-14 alone sets dispositions."

# Metrics
duration: ~2h10m
completed: 2026-10-01
---

# Phase 36 Plan 13: Merge, Regenerate, Digest-Verify, Freeze Validation Summary

**Confirmed origin/master is a truthful no-op merge (already an ancestor of local HEAD), regenerated both PR-09 signed artifacts on the resulting tree with every moved figure attributed to the already-landed gap-closure fixes rather than new archive data, proved the full gate green against a served-and-digest-verified build, recorded both artifacts' externally-computed sha256 values for plan 36-14's sign-off, and bound all 26 rows of 36-VALIDATION.md's Per-Task Verification Map to real task ids with live-measured matched counts — freezing 8 checkpoint rows (one redrafted after its suggested fixture was found unreachable post-gap-closure) for the developer's upcoming checkpoint round.**

## Performance

- **Duration:** ~2h10m (extensive context reading given the gap-closure debrief, then Task 1's merge/regenerate/digest work, then Task 2's full SUMMARY-mining pass across eleven prior plans to bind the verification map)
- **Started:** 2026-10-01 (context gathering)
- **Completed:** 2026-10-01
- **Tasks:** 2 completed
- **Files modified:** 3 (matches `files_modified` exactly: `36-CEILING-RECALIBRATION.md`, `36-DIFF.md`, `36-VALIDATION.md`)

## Accomplishments

- **MERGE-01, confirmed truthful no-op:** `git fetch origin` found origin/master unchanged at `5e902283` (last real commit 2026-09-19); `git merge-base --is-ancestor origin/master HEAD` confirmed it is already an ancestor of local HEAD (`ac7d900f`, 470 commits ahead, 0 behind). `git merge origin/master` printed `Already up to date.` — no merge commit, no files brought into `data/`. This mirrors Phase 32's own 32-09 precedent exactly.
- **Full rebuild/regenerate gate, green:** `npm run build`, `npm run compute-all-stats` (confirmed `git status --porcelain data/` empty afterward, modulo one timestamp-only `data/geo/geo-metadata.json` side effect reverted via `git checkout --`), `npm run build-widgets` (confirmed a real rebuild via its own "replaced stale ..." log lines, not a silent mtime no-op), `npm run verify-dashboard` (67/67 checks pass). `npx tsc --noEmit` exits 0. `npm test` — **107 files / 3,921 tests pass, 29.66s** (baseline at phase start: 101 files / 3,676 tests). `data/best-effort-ceiling.json`'s sha256 confirmed byte-unchanged (`01802d20...`) — the 36-07 write gate holds; no `--write-ceiling-state` flag was ever passed.
- **Both signed artifacts regenerated and proven three-run idempotent:** `npm run compute-ceiling-recalibration` then `npm run compute-clean-window-diff` (recalibration first, since the diff reads it), run three times total, diffed pairwise with the `**Generated:**` line stripped — byte-identical every time. One additional, pre-existing (out-of-scope) nested-timestamp citation in `36-DIFF.md`'s own `## Inputs` section was discovered and is documented below under Deviations; it does not affect content idempotence, only an incidental second timestamp line.
- **Every moved figure attributed, not just noted:** newly-demoted efforts moved 442 → 391 (−51), matching the gap-closure detector fix's own recorded upper bound exactly. The internal `moved-but-ranked`-vs-walked-`contaminated` gap narrowed from 32 to 31 records, because the detector fix resolved the one `4598855187@1k` contaminated-and-ceiling-demoted tension plans 36-11 and 36-12 both independently flagged — and this plan's own re-run of the recount leg confirms it a third way (0 internal-consistency violations, down from 1). No figure moved because of new archive data; the merge itself was a confirmed no-op.
- **The independent leg re-run, matching the gap-closure debug record exactly:** `npm run compute-clean-window-recount` exits 0, `pass=1440 fail=0 notAssessable=74` (of 1,514), all three pinned fixtures (3475740390/3475724402/3475734189 @400m) MATCH.
- **Served-digest verification performed, not assumed from the build log:** a local static server over `dist/widgets` served `index.html`; the referenced `assets/index-CgwZxcPm.js` and `assets/index-CfRubajH.css` were fetched directly and their sha256 digests compared byte-for-byte against the freshly built files on disk — both match exactly.
- **Final sha256 values computed externally, recorded beside commit `893eec64`:** `36-CEILING-RECALIBRATION.md` → `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`; `36-DIFF.md` → `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1`. Neither hash is written into either artifact.
- **All 26 Per-Task Verification Map rows bound**, each with a real plan/task id, wave number, a live-measured non-zero `Matched` count, and a corrected `Automated Command` where the originally-drafted one turned out vacuous (two found: `-t "contaminated"` matched a non-vacuous-but-wrong 11 across unrelated describes, and `-t "stubbed segments"` matched a genuine **0** — both corrected to the real test titles).
- **Two-Direction Reachability table rewritten with OBSERVED, not predicted, evidence** for all five original rows plus three new watched-red guards this phase added (the three-homes audit's three independent per-home plants, the write gate's historical-vs-gated live reproduction, and the basis gate's planted-vs-live contrast).
- **8 checkpoint rows (a-h) frozen for plan 36-14**, each with an Expected value derived outside the changed code. Row (b)'s four-segment claim was re-confirmed unchanged on the merged archive. Row (f) was genuinely redrafted after its suggested single-effort fixture was found unreachable (see Decisions). Row (g)'s half-marathon fail-open was re-confirmed still exercisable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge origin, regenerate both artifacts on the merged tree, and prove the gate green on a digest-verified build** - `893eec64` (feat)
2. **Task 2: Bind every verification row to a task id with its matched count, and freeze the checkpoint rows** - `24b6b0e8` (test)

**Plan metadata:** this SUMMARY commit is the metadata commit. Per this plan's own objective, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `.planning/STATE.md` are NOT touched by this agent — plan 36-14 alone sets dispositions, and this run confirmed `git diff` empty for all three throughout.

## Files Created/Modified

- `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md` — regenerated on the post-merge, post-gap-closure tree; every per-distance figure re-derived and attributed.
- `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md` — regenerated in the same session (reads the recalibration artifact); headline totals, guard counts and the internal-reconciliation gap all re-derived.
- `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md` — Per-Task Verification Map filled (26 rows), Two-Direction Reachability table rewritten with observed evidence, Manual-Only Verifications replaced with 8 frozen checkpoint rows, merge/signature/digest record added, frontmatter set to `nyquist_compliant: true` / `wave_0_complete: true`.

## Verification Evidence

- `npx tsc --noEmit` exits 0.
- `npm test` — 107 files / 3,921 tests pass, 29.66s wall-clock.
- `npm run verify-dashboard` — 67/67 checks pass.
- `git status --porcelain data/` empty at every checkpoint in this plan (one timestamp-only side effect reverted, not committed).
- `git diff --exit-code data/best-effort-ceiling.json` — empty; sha256 `01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20` unchanged throughout.
- Both artifacts regenerated three times with pairwise diffs empty (`**Generated:**` line stripped; `36-DIFF.md`'s one additional nested timestamp citation also stripped for the true-content comparison — see Deviations).
- `npm run compute-clean-window-recount` — exit 0, `pass=1440 fail=0 notAssessable=74` (of 1,514), all three pinned fixtures MATCH.
- Served `assets/index-CgwZxcPm.js` sha256 `c6b7d4cd5890109af0df7775d0868acb5b768991f8645c4ddf941d6e9ece0117` == on-disk. Served `assets/index-CfRubajH.css` sha256 `c292c22f4e3bfddc1d871faa9c4c664b55b986709fffe0aa4ce49a1f3b383137` == on-disk.
- `36-CEILING-RECALIBRATION.md` sha256 `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`; `36-DIFF.md` sha256 `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1` — both computed via `shasum -a 256`, recorded beside commit `893eec64`, written into neither artifact.
- Task 2's own Python verify script: no `TBD` cell, 35 total table rows matched across the document (26 in the Per-Task Verification Map alone, exceeding the required ≥20), no blank cell in the first 8 columns of any row, `CAN FAIL`/`CAN PASS`/`Independent source`/`sha256`/`Verdict` all present, `Approval: pending` confirmed.
- `git diff --stat` for `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — all empty.
- `git diff --stat ac7d900f..HEAD` touches exactly the three files in `files_modified`.
- `git diff --diff-filter=D --name-only` — empty after every commit in this plan; no file was deleted.

## Decisions Made

See `key-decisions` in the frontmatter above. The two most consequential:

1. **The merge's no-op status was PROVEN, not assumed** — `git merge-base --is-ancestor origin/master HEAD` was run explicitly before concluding MERGE-01 was satisfied, rather than inferring it from the `0 ahead` count alone (a 0-ahead, non-ancestor state would indicate a diverged history requiring an actual merge, a materially different situation).
2. **Checkpoint row (f) was redrafted after a genuine reachability failure**, exactly mirroring the discipline row (b) was explicitly told to apply: the plan's own suggested single-effort both-badges fixture (`4598855187@1k`) no longer exists on the merged, post-gap-closure archive — confirmed both by a direct read of the regenerated shard (now `demotion.guard === 'ceiling'`, `contaminated: null`) and by this plan's own re-run of the recount leg (`internal consistency: OK, no violations`, down from 1). Rather than force the row against evidence that contradicts it, a real, reachable substitute (activity `10367206938`, contaminated at 5k / demoted at 10k — one of 255 such activities) was found and the redraft is recorded in the row itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, out-of-scope, logged not fixed] `compute-clean-window-diff.mjs`'s `## Inputs` section cites a second, legitimately-varying timestamp the idempotence proof's own strip pattern does not name**

- **Found during:** Task 1's three-run idempotence proof (first regeneration pair)
- **Issue:** `scripts/compute-clean-window-diff.mjs`'s `crossCheckCeilingAgainstRecalibration` (plan 36-11's own, deliberate design: "the ONE place this generator reads a sibling artifact's output instead of computing its own") reads `36-CEILING-RECALIBRATION.md`'s own `**Generated:**` line and quotes it verbatim in `36-DIFF.md`'s own `## Inputs` section. When both artifacts are regenerated back-to-back TWICE — the exact sequence this plan's own task requires (recalibration first, since the diff reads it) — this nested citation line changes between the two runs purely because the sibling's own Generated line moved, even though every other figure in both artifacts is byte-identical. This is the same CLASS of bug plan 36-10's own Deviation #3 found and fixed (a second, undocumented run-varying timestamp invisible to the Generated-line-only strip) — but that instance lived inside 36-10's own generator; this instance lives in `compute-clean-window-diff.mjs` (plan 36-11's file), which is **not** in this plan's `files_modified` scope (`36-VALIDATION.md`, `36-CEILING-RECALIBRATION.md`, `36-DIFF.md` only — no `.mjs` script).
- **Verified NOT a content bug:** diffing two consecutive post-merge regenerations with this one additional line stripped (alongside the top `**Generated:**` line) showed both artifacts byte-identical in every other respect across three consecutive runs. True content idempotence holds; only the two timestamp lines vary.
- **Fix:** none applied to the generator (out of this plan's declared file scope — the fix belongs in `compute-clean-window-diff.mjs`, a file this plan does not touch). A `deferred-items.md` entry was drafted documenting the finding and a suggested fix (drop the quoted `generatedAt` value from the citation, naming the sibling artifact by path only) but was deliberately NOT committed, because this specific plan's own `<verification>` block requires `git diff --stat` to touch EXACTLY the three declared files — unlike plan 28-14's own precedent, which explicitly added `deferred-items.md` to its own `files_modified` list when it needed one, `36-13-PLAN.md`'s frontmatter does not. The finding is instead fully recorded here, in this SUMMARY, satisfying the SCOPE BOUNDARY rule's "log out-of-scope discoveries" requirement without violating this plan's own narrower file-count gate.
- **Files modified:** none.
- **Verification:** three-run idempotence re-confirmed with the widened strip; see Verification Evidence above.
- **Committed in:** n/a (verification-only finding, no source change; logged here per the scope-boundary rule).

---

**Total deviations:** 1 logged (Rule 1 class, out-of-scope to this plan's declared file set — not fixed, fully documented here per the executor's scope-boundary rule).
**Impact on plan:** None. The finding does not affect either artifact's content correctness or this plan's own idempotence proof, which accounted for it explicitly before concluding both artifacts regenerate identically.

## Issues Encountered

None beyond the one logged-not-fixed finding above, which required no problem-solving — it is a pre-existing, out-of-scope generator trait discovered by this plan's own required verification step working exactly as designed.

## User Setup Required

None - no external service configuration required. Plan 36-14's checkpoint round will ask the developer to independently run `shasum -a 256` against both artifacts and confirm they match the two values recorded in this SUMMARY and in `36-VALIDATION.md`'s checkpoint row (h).

## Gap-Closure Caveats for the 36-14 Sign-Off (verbatim, carried forward from `.planning/debug/36-recount-isolated-jump.md`)

Recorded here, and in `36-VALIDATION.md`, per the orchestrator's explicit instruction that these caveats must be visible wherever the recount verdict is recorded:

1. **The recount's per-window floor (`PER_WINDOW_FLOOR_PERCENTILE_LOCAL` = p75) was selected as "the strictest zero-failure candidate" among p50..p95** — an outcome-selected value, not one declared before measurement. The next step up (p80) already produces 3 failures on the live archive.
2. **`notAssessable` rose from 13 (pre-gap-closure) to 74 (post-gap-closure)**, 52 of which are windows with no outside-window reference (whole-activity windows) — a genuine blind spot of the new statistic, not a silently wrong answer, but a limitation the developer should weigh when signing.

Both caveats are carried forward unchanged from the debug record; this plan's own re-run (`notAssessable=74` of 1,514) reproduces them exactly on the merged tree.

## 36-11/36-12 SUMMARY Narratives Now Stale — Explicitly Not Quoted

Per the orchestrator's gap-closure context: 36-11's and 36-12's own SUMMARY figures (442 newly demoted, 1,169 moved-but-ranked, 1,201 walked-contaminated, the `4598855187@1k` co-occurrence, the 190-failure pre-fix recount run) are all **superseded** by the gap-closure round and by this plan's own regeneration. This SUMMARY and `36-VALIDATION.md` cite only the POST-gap-closure, POST-this-plan figures (391 newly demoted, 1,097/1,128 with a 31-record gap, 0 internal-consistency violations, 0 recount failures). 36-11-SUMMARY.md's "dilution in large windows" explanation for the original 190 failures was explicitly refuted by `.planning/debug/36-recount-isolated-jump.md`'s own investigation (the true cause was jump-magnitude overlap between the contaminated and control populations, a self-referential blind window, and a dropped crossing pair — not dilution) and is not repeated here as current.

## Next Phase Readiness

- Plan 36-14 can now run its checkpoint round directly against `36-VALIDATION.md`'s 8 frozen rows and the two sha256 values recorded in Task 1 — no further regeneration or measurement is needed before that round starts, provided the tree is not edited between this plan's completion and that checkpoint.
- The one logged-not-fixed finding (the nested-timestamp idempotence quirk in `compute-clean-window-diff.mjs`) is a candidate for a future plan that touches that file; it does not block 36-14 and does not affect either artifact's signed content.
- No blockers for 36-14. This plan ticked nothing: `REQUIREMENTS.md`, `ROADMAP.md` and `STATE.md` are all confirmed untouched by `git diff`.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md
- FOUND: .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md
- FOUND: .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md
- FOUND: commit 893eec64
- FOUND: commit 24b6b0e8

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-10-01*
