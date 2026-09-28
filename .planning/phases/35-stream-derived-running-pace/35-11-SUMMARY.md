---
phase: 35-stream-derived-running-pace
plan: 11
subsystem: ui
tags: [copywriting, accessibility, testing, source-wiring-guard]

# Dependency graph
requires:
  - phase: 35-stream-derived-running-pace
    provides: "plan 35-08's retargeted comparator (PaceDisagreement.runningPaceSecPerKm) and plan 35-10's Running Pace tile / runningPaceTilePlan"
provides:
  - "Three disputed-pace copy strings retargeted from the ambiguous 'stream-derived' wording to the unambiguous 'running' wording (detail badge, shared paceDisputedExplanation sentence, splits-rebase footnote)"
  - "The D-03 badge-reach argument recorded in appendStatusBadges' own docblock"
  - "Source-wiring proof that the splits rebase note and vs. Avg bars move together onto the running pace, gated by the unchanged isRebasedAverage conditional"
  - "Criterion-4 regression proof: metadata pace and moving_time are unaffected by paceDisagreement/runningPace, with a directory-walked source scan finding zero references to the three new identifiers outside their legitimate producer"
affects: [35-12-integration-merge, 35-13-browser-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-free proof idiom (comment-stripped source scan + pure-value equality) for functions that call document.createElement in a vitest environment:node suite with no DOM-simulation library"
    - "Directory-walked, comment-stripped source scan (walkTsFiles) proving a forbidden identifier reaches zero files under a subtree, built fresh at test time so new files are covered automatically"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail.ts
    - src/dashboard/views/list.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/views/list.test.ts

key-decisions:
  - "No direction clause is appended to paceDisputedExplanation because D-06 ships slower-only; the docblock records this as the reason and names itself as the one place a future symmetric-direction clause belongs"
  - "The splits-rebase and criterion-4 proofs are DOM-free source-wiring guards, not DOM renders, because this suite runs vitest environment:node with no jsdom/happy-dom anywhere in the tree (confirmed by dependency check) -- the same constraint detail-sections.test.ts and list.test.ts already document for their sibling DOM builders. The value-level rendering claims are covered by the mandatory browser checkpoint (plan 35-13), per 35-VALIDATION.md's Manual-Only Verifications row"
  - "No snapshot mechanism (toMatchSnapshot/__snapshots__) exists anywhere in this repository, confirmed by repo-wide grep -- Task 3's 'no snapshot edited' criterion is vacuously satisfied"

patterns-established:
  - "walkTsFiles in list.test.ts: a third, file-local copy of the readSourceTree/curation-guard.mjs recursive-.ts-walk idiom, scoped to this file's own criterion-4 containment scan"

requirements-completed: []  # This plan ticks nothing (requirement-tick safety note in 35-11-PLAN.md); RPACE-02/RPACE-03 remain Pending in REQUIREMENTS.md pending 35-12/35-13.

# Metrics
duration: ~20min
completed: 2026-09-28
---

# Phase 35 Plan 11: Retarget disputed-pace copy from "stream-derived" to "running" Summary

**Retargeted all three disputed-pace disclosure strings to name the running pace (not the now-ambiguous "stream-derived" phrase), recorded the D-03 badge-reach argument, and added DOM-free regression proof that the splits rebase and criterion 4's byte-identical boundary both hold.**

## Performance

- **Duration:** ~20 min (not automatically timed at agent launch; measured from first to last commit timestamp, 08:43:34–08:49:56 CEST, plus prior exploration)
- **Completed:** 2026-09-28
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments
- All three disputed-pace strings (detail badge, shared explanation sentence, splits footnote) now name the running pace; `stream-derived` appears zero times across the three touched source files, including in comments
- `appendStatusBadges`' docblock now records the D-03 reach argument at the one dispatch point where a future reader will find it
- Proved (DOM-free) that the splits rebase note is emitted from exactly one call site, gated by the unchanged `isRebasedAverage && activityAvgPaceSecPerKm !== null` conditional, and that the note and the `vs. Avg` bars read the identical parameter so they cannot structurally diverge
- Proved (DOM-free) that the metadata pace cell, moving-time cell and mobile-card summary line are built from exactly one expression each, none of which reads `paceDisagreement`/`runningPace`, and that `formatPace`/`formatDurationHms` output is byte-identical whether or not a row carries the new fields, while the badge set is asserted to differ
- Directory-walked, comment-stripped source scan proves zero references to `runningPace`/`RunningPaceRow`/`deriveRunningPace` under `src/widgets/`, `src/widget/`, or stats-computation source outside the three legitimate producer files -- verified to actually catch a planted violation before the probe was removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Retarget the three copy strings and record the D-03 reach argument** - `e9a6258a` (fix)
2. **Task 2: Prove the splits rebase follows the widened badge and names the right figure** - `32cb3729` (test)
3. **Task 3: Criterion 4 regression — the metadata pace and moving_time are byte-identical everywhere else** - `26225742` (test)

No separate plan-metadata commit was made per the requirement-tick safety note (this plan does not touch REQUIREMENTS.md/ROADMAP.md/STATE.md, which are orchestrator-owned).

## Files Created/Modified
- `src/dashboard/views/detail.ts` - detail-view "Pace disputed" badge text retargeted (`stream-derived` → `running`); one comment retargeted to avoid the retired term
- `src/dashboard/views/list.ts` - `paceDisputedExplanation`'s shared sentence retargeted, its docblock extended with the D-01/D-06 dated note; `appendStatusBadges`' docblock extended with the D-03 dated note; one comment retargeted
- `src/dashboard/views/detail-sections.ts` - the splits-rebase footnote in `buildSplitsSection` retargeted; one comment retargeted
- `src/dashboard/views/detail-sections.test.ts` - the D-13 caption-note test updated to the new wording plus an absence assertion; two new source-wiring tests (footnote gating, bars/footnote single-parameter proof)
- `src/dashboard/views/list.test.ts` - `formatDurationHms` added to the import list; a new `criterion 4 regression` describe block with five tests (independent-value pace check, with/without-fields invariance + badge-diff pair, two source-wiring guards, two directory-walked containment scans)

## Copy that stops describing its own number — old, new, the number, and why

| Location | Old wording | New wording | Number it sits beside | Why the new wording is true |
|---|---|---|---|---|
| `detail.ts`, Pace stat-card third-child badge | `Pace disputed — stream-derived {formatPace(disagreement.runningPaceSecPerKm)}` | `Pace disputed — running {formatPace(disagreement.runningPaceSecPerKm)}` | `disagreement.runningPaceSecPerKm` | The value shown IS `runningPaceSecPerKm`, produced by `deriveRunningPace`. "stream-derived" is ambiguous — both the retired span-based pace and the running pace are technically stream-derived — but "running" names this exact field unambiguously. |
| `list.ts`, `paceDisputedExplanation` (shared by the row badge's hover/`.sr-only` text and the detail badge's `title`/`.sr-only` text) | `Metadata pace disagrees with the stream-derived pace: {running} measured vs. {metadata} shown` | `Metadata pace disagrees with the running pace: {running} measured vs. {metadata} shown` | `disagreement.runningPaceSecPerKm` (measured) and `disagreement.metadataPaceSecPerKm` (shown) | The sentence's subject — "the running pace" — is exactly the `{running}` figure it then quotes. No direction clause is appended because D-06 ships slower-only: the badge only ever fires when the running pace is slower, so silence about direction cannot mislead a reader about which way it moved. |
| `detail-sections.ts`, `buildSplitsSection`'s `isRebasedAverage` footnote | `Splits above are compared against the stream-derived average ({avg}), not the disputed metadata average.` | `Splits above are compared against the running pace ({avg}), not the disputed metadata average.` | `activityAvgPaceSecPerKm`, which `detail.ts` sets to `disagreement.runningPaceSecPerKm` exactly when `isRebasedAverage` is true (D-13's rebase conditional, unchanged) | In the only branch where this footnote renders, `activityAvgPaceSecPerKm` literally equals the running pace — naming it "the running pace" is what the number actually is in that branch. |

No threshold value (1.0173 or any rounded form) was hardcoded anywhere — none of the three strings needed to express the cut numerically; the badge's presence/absence already communicates that a material disagreement was found, and `PACE_DISAGREEMENT_RUNNING_RATIO` (`pace-derivation.ts:1098`) remains the single definition.

## D-03 badge-reach argument (recorded in `list.ts`, `appendStatusBadges`' docblock)

All four `RowSurface` values (`activity-card`, `activity-table`, `overview-prs`, `overview-activities`) already dispatch through the one `appendStatusBadges` function on `rowPaceDisagreement(row) !== null` — a population-size-agnostic boolean. Phase 35 widens WHICH rows satisfy that boolean (the comparator moved from the retired span-based pace to the running pace, D-01) but makes no structural change to the dispatch itself, so no code path exists by which two surfaces could disagree about whether a given row is disputed. A detail-view-only reach was rejected because it would require actively SUPPRESSING this dispatch for the other three surfaces — the duplicated-derivation shape Phase 24 D-04 warns against.

## Grep confirmation (Task 1 acceptance criteria)

```
$ grep -c "Pace disputed — running " src/dashboard/views/detail.ts        # 1
$ grep -c "disagrees with the running pace" src/dashboard/views/list.ts   # 1
$ grep -c "compared against the running pace" src/dashboard/views/detail-sections.ts  # 1
$ grep -rc 'stream-derived' src/dashboard/views/{detail,list,detail-sections}.ts  # all :0
$ grep -q "PACE_DISPUTED_BADGE_TEXT = 'Pace disputed'" src/dashboard/views/list.ts  # match
```

`stream-derived` appeared not only in the three target strings but also in four pre-existing/self-authored comments (two in `detail.ts`, one in `list.ts`, one in `detail-sections.ts`); all four were reworded without reintroducing the literal substring, so the "zero times" acceptance criterion holds against comments too, not only against the visible copy.

`git diff --stat` on the three touched source files: `detail.ts` +9/-3, `list.ts` +26/-3, `detail-sections.ts` +2/-2 (38 insertions, 8 deletions total across the three files — the two docblock additions plus the string retargets and their retargeted surrounding comments).

## Splits-rebase proof (Task 2) — what could and could not be asserted, and why

`buildSplitsSection` and `buildPaceBarCell` both call `document.createElement` directly. This suite runs under `vitest`'s `environment: 'node'`, and no DOM-simulation library (jsdom/happy-dom) is installed anywhere in this repository (confirmed via `npm ls jsdom happy-dom` → empty) — the exact constraint `detail-sections.test.ts`'s own file header already documents for `buildBreakdownSection`/`buildSplitsSection`. Calling either builder directly would throw `ReferenceError: document is not defined`.

Given that constraint, Task 2's items were satisfied as follows:

1. **Footnote full-string equality** — satisfied as strongly as a comment-stripped source scan allows: the literal fixed portions of the new sentence are asserted present, and the retired `stream-derived average` wording is asserted absent.
2. **Both directions of the rebase conditional** — a new test isolates `buildSplitsSection`'s function body and proves the retargeted footnote text (a) appears exactly once in the whole file, and (b) appears strictly after the literal guard `if (isRebasedAverage && activityAvgPaceSecPerKm !== null)`. Since that is the only occurrence of the note text anywhere, there is no second, unconditional emission path — the false/null direction cannot render the note.
3. **Bar baseline follows the note** — proven structurally rather than by value: `buildPaceBarCell(split, activityAvgPaceSecPerKm)` and `formatPace(activityAvgPaceSecPerKm)` are asserted to read the exact same parameter, and the function signature is asserted to declare that parameter exactly once. The bars and the note therefore cannot structurally diverge — but the actual rendered VALUES differing between a rebased and non-rebased call (the plan's literal ask) requires DOM rendering this suite cannot perform. **This is covered only by the mandatory human browser checkpoint (plan 35-13)**, per `35-VALIDATION.md`'s Manual-Only Verifications row "Splits 'vs. Avg' bars rebase to the running pace on the widened badged population," which extends the existing "unit + manual" D-09 row at `35-VALIDATION.md:67` (`npx vitest run src/dashboard/views/detail-sections.test.ts -t "isRebasedAverage"` + browser row).
4. **Population-widening consequence** — already covered by the pre-existing source-scan test (renamed/annotated, not logically changed) asserting `const rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.runningPaceSecPerKm : paceSecPerKm;` is present verbatim in `detail.ts`. `detail.ts` exposes no helper for this inline ternary, so per the plan's own fallback, duplicating the ternary in the test was avoided in favor of this source-scan proof.

`npx vitest run src/dashboard/views/detail-sections.test.ts` (unfiltered, no `-t` filter): **197/197 tests passed**.

## Criterion-4 proof (Task 3) — what could and could not be asserted, and why

`renderActivityRow`/`buildTableRow` are likewise DOM builders and cannot be invoked here (the same constraint `list.test.ts`'s own `rowIdPrefix` describe block already documents). Both cells and the mobile-card summary line are single-expression assignments in `list.ts`:
```
metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km · ${formatDurationHms(row.movingTimeSec)} · ${formatPace(row.paceSecPerKm)}`;
movingTimeTd.textContent = formatDurationHms(row.movingTimeSec);
paceTd.textContent = formatPace(row.paceSecPerKm);
```
The proof combines (a) a source scan pinning these as the ONLY expressions feeding those three text nodes (each occurs exactly once in the stripped source; the `metaEl.textContent` line is asserted to contain neither `paceDisagreement` nor `runningPace`), with (b) a pure-value equality: `formatPace`/`formatDurationHms` produce byte-identical output for two rows sharing the same `distanceM`/`movingTimeSec`/`paceSecPerKm`, one carrying `paceDisagreement`+`runningPace` populated and one carrying both `null`, and the first row's `paceSecPerKm` is independently verified to equal `movingTimeSec / (distanceM / 1000)` computed fresh in the test (not read back from the row's own field). The same pair asserts `statusBadgeTexts` differs — `Pace disputed` present on the with-fields row, absent on the without-fields row — so the invariance claim cannot pass vacuously against a render that produced nothing.

Together (a)+(b) constrain every possible input to the three cells (a) and the output for the one remaining live input (b), which is at least as strong as an actual DOM render for this specific claim. The literal served-build rendering is additionally confirmed by the mandatory browser checkpoint (plan 35-13), per `35-VALIDATION.md`'s criterion-4 row ("Confirm on a served build **and** by automated regression rows above — absence-only browser rows are not sufficient alone").

**Source containment:** a fresh directory walk (`walkTsFiles`, built at test time so a newly added widget file is covered automatically) over `src/widgets/` (11 subdirectories: `comparison-chart`, `geo-stats-widget`, `geo-table-widget`, `heatmap-widget`, `map-test-widget`, `multi-run-overlay`, `pin-map-widget`, `route-browser`, `shared`, `single-run-map`, `stats-card`, `streak-widget`) and `src/widget/` (the older singular embeddable weekly-bar-chart widget, `chart-config.ts`/`index.ts`) finds zero comment-stripped references to `runningPace`, `RunningPaceRow` or `deriveRunningPace`. A second walk over `src/analytics/` (excluding the three legitimate producer files: `pace-derivation.ts` defines `deriveRunningPace`, `compute-dashboard-index.ts` calls it, `dashboard-index.types.ts` declares `RunningPaceRow`), `src/geo/`, `src/exports/`, and the two root pipeline files `src/compute-all-stats-steps.ts`/`src/index.ts`, likewise finds zero references.

**This scan is proven non-vacuous**: a probe file (`src/widgets/__criterion4_probe.ts`, `export const x = 'runningPace';`) was planted, the widgets scan test was run in isolation and observed failing with the planted violation listed, then the probe was deleted and `git status --porcelain src/` confirmed clean before committing.

**Stats-document snapshots:** no snapshot mechanism (`toMatchSnapshot`, `__snapshots__`) exists anywhere in this repository (confirmed by repo-wide grep) — this criterion is vacuously satisfied; there is nothing to re-run unmodified.

`npx vitest run src/dashboard/views/list.test.ts` (unfiltered): **133/133 tests passed**. Full suite (`npm test`): **101 files / 3676 tests passed**, 0 failed. `git status --porcelain` shows no modified snapshot file (none exist to modify).

## Decisions Made
- No direction clause in `paceDisputedExplanation` — recorded in the function's own docblock as a dated note naming exactly where a future symmetric-direction clause would go, per the plan's instruction
- Retargeted every occurrence of the literal substring `stream-derived` in the three touched files, including in comments that were not part of the plan's three named strings, because the Task 1 acceptance criterion and its automated verify command both check for zero occurrences across the whole file, not only inside the visible copy
- Adopted the codebase's existing DOM-free proof idiom (comment-stripped source-wiring guards) for both Task 2 and Task 3 rather than introducing a DOM-simulation library, since this repository has none installed anywhere and adding one would be an architectural change outside this copy-only plan's scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's automated verify command failed on first run because pre-existing and my own explanatory comments also contained the literal substring `stream-derived`**
- **Found during:** Task 1 verification
- **Issue:** The plan's automated verify command asserts zero occurrences of `stream-derived` across the three touched files. My first-pass edits retargeted only the three visible copy strings, but four comments (two pre-existing docblocks referencing the old copy by literal quote, plus two of my own new explanatory comments) still contained the substring.
- **Fix:** Reworded all four comments to describe the same facts without reusing the literal substring (e.g., "both come from the stream" instead of quoting "stream-derived" as a compound word).
- **Files modified:** `src/dashboard/views/detail.ts`, `src/dashboard/views/list.ts`, `src/dashboard/views/detail-sections.ts` (all part of Task 1's commit)
- **Verification:** Re-ran the exact verify command; all five checks passed.
- **Committed in:** `e9a6258a` (Task 1 commit)

**2. [Rule 3 - Blocking] Plan's DOM-rendering test requests (Task 2 items 1-3, Task 3 item 1) cannot be executed literally because no DOM-simulation library exists in this repository**
- **Found during:** Task 2 and Task 3, before writing any test code
- **Issue:** `buildSplitsSection`, `buildPaceBarCell`, `renderActivityRow` and `buildTableRow` all call `document.createElement` directly. This suite runs under vitest's `environment: 'node'`, confirmed with no jsdom/happy-dom dependency anywhere in the tree — calling any of these functions in a test would throw `ReferenceError: document is not defined`. Both `detail-sections.test.ts` and `list.test.ts` already document this exact constraint in their own file headers for sibling DOM builders (`buildBreakdownSection`, `renderActivityRow`), so this is a pre-existing, structural fact about the codebase, not a plan defect.
- **Fix:** Adopted the same DOM-free source-wiring-guard idiom this codebase already uses elsewhere (`isolateFunctionBody`, comment-stripped `stripComments` source scans, pure-value equality against independently-computed values) to prove everything DOM-free proof can prove, and explicitly deferred the remaining value-level rendering claims to the mandatory browser checkpoint (plan 35-13), naming the exact `35-VALIDATION.md` Manual-Only row each deferred claim maps to — the plan's own item 4 (Task 2) explicitly sanctions exactly this fallback, and the reasoning was extended to the other DOM-blocked items for consistency, since the same underlying constraint applies uniformly.
- **Files modified:** `src/dashboard/views/detail-sections.test.ts`, `src/dashboard/views/list.test.ts`
- **Verification:** All new/updated tests pass; the containment scan was additionally verified non-vacuous with a planted-and-removed probe file.
- **Committed in:** `32cb3729` (Task 2 commit), `26225742` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues discovered while satisfying the plan's own acceptance criteria, neither requiring an architectural change or new dependency)
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's own acceptance criteria as literally written against the actual state of the codebase. No scope creep; no library added; no plan requirement weakened.

## Issues Encountered
None beyond the two deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three disputed-pace copy strings and the D-09 splits-rebase copy are retargeted and proven consistent with each other and with the underlying data (D-03's single-dispatch argument, and the single-parameter proof that the footnote and bars cannot structurally diverge).
- Plan 35-12 (merge/regenerate) can proceed: no data/, dist/, or index-producer files were touched by this plan.
- Plan 35-13 (human browser checkpoint) must additionally verify, on a served build: the three retargeted strings render correctly and are readable as accessible descriptions out of visual context; the splits `vs. Avg` bars actually shift when a rebase applies (this plan's DOM-free proof could not render pixel/value output); and the criterion-4 absence claim on a served build, per `35-VALIDATION.md`'s Manual-Only Verifications rows.
- REQUIREMENTS.md's RPACE-02/RPACE-03 remain intentionally unticked (Pending) — this plan's frontmatter explicitly instructs skipping `requirements mark-complete`.

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail.ts
- FOUND: src/dashboard/views/list.ts
- FOUND: src/dashboard/views/detail-sections.ts
- FOUND: src/dashboard/views/detail-sections.test.ts
- FOUND: src/dashboard/views/list.test.ts
- FOUND commit: e9a6258a (Task 1)
- FOUND commit: 32cb3729 (Task 2)
- FOUND commit: 26225742 (Task 3)

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-28*
