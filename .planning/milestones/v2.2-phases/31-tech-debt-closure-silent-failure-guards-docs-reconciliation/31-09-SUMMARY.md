---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 09
subsystem: docs
tags: [docs-reconciliation, requirements, roadmap, milestone-audit, validation-flip]

# Dependency graph
requires:
  - phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
    provides: "31-08 (regenerated 26-RESIDUAL.md with the corrected 1,874-scan/14-residual figures; the merged 1,899-activity archive `data/dashboard/index.json` these corrections re-measure against)"
provides:
  - "Five stale hand-written figures corrected in place with dated provenance notes: REQUIREMENTS.md PACE-06 (13->14), ERA-02 (716/1,864->663/1,899), ROADMAP Phase 27 Criterion 5 (same cohort), ROADMAP Phase 26 Criterion 1 (1,866->1,874 streams scanned), REQUIREMENTS.md PR-03/PR-04/PR-05 + their traceability rows ('pending phase re-verification' -> the actual 28-VERIFICATION.md outcome)"
  - "v2.2-MILESTONE-AUDIT.md's tech_debt list amended: 27 G-01 marked CLOSED (was 'open'), plus dated closure notes on the two documentation entries this plan discharged"
  - "27-VALIDATION.md's G-02 closed at its source (dated, quoting the re-measured figure), header note corrected, retroactive-audit closing sentence updated, frontmatter status: partial -> passed"
  - "TD-06 ticked (its remaining obligation -- the G-02 correction plus the 27-VALIDATION.md flip -- both landed in this plan)"
affects: ["31-10 (PR-04 Round 4 sign-off, TD-05 tick -- this plan's TD-06 tick and the now-passed 27-VALIDATION.md are precedent for what 31-10 must not disturb)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "House-style dated correction note: replace the stale figure in body prose, then append '*Corrected <date>: was <old>; live figure <how measured> is <new> -- see <source record>.*' so the old figure survives only inside the note, findable by a reader tracing the audit"
    - "Live re-measurement discipline: a figure that already matches a prior document's own claim (e.g. research's 663/1,899) is still re-derived independently this session rather than trusted, per T-31-30's threat disposition"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/v2.2-MILESTONE-AUDIT.md
    - .planning/phases/27-per-activity-quality-signals/27-VALIDATION.md

key-decisions:
  - "The acceptance criterion 'git diff .planning/REQUIREMENTS.md | grep -E \"^[-+]- \\[\" | wc -l returns 0' is unsatisfiable for this task's own required edits: every corrected requirement (PACE-06, ERA-02, PR-03/04/05) lives on one long single-line paragraph beginning with its checkbox marker, so git's line-level diff necessarily emits both the old full line (prefixed '-') and the new full line (prefixed '+') for ANY prose change, and both start with '- [x]', matching the regex regardless of whether the checkbox itself moved. Verified empirically (a throwaway git repo reproduces the same pattern for a same-line word-only edit) and against the real diff: `git diff .planning/REQUIREMENTS.md | grep -E '^[-+]- \\[' | sed -E 's/^([-+]).*\\[( |x)\\].*/\\1\\2/' | sort | uniq -c` returns exactly `5 +x` / `5 -x` -- five lines changed, all five stayed `[x]` on both sides, zero `[ ]` on either side. The real invariant the criterion intends (no tick flipped) holds; the literal grep count does not, and is documented here as an unpassable discriminator rather than worked around by skipping the edit."
  - "ERA-02's corrected figure (663/1,899, 34.9%) was re-measured live this session via `node -e` over `data/dashboard/index.json` per the environment note, rather than trusted from 31-RESEARCH.md's preliminary figure or 27-VALIDATION.md's own 2026-09-10 census -- it matched both exactly, confirming no drift since the merge added 9 activities with zero change to the no-device-name count."
  - "TD-06 ticked in this plan (not deferred to 31-10): the plan's own output spec permits it once G-02 closes and 27-VALIDATION.md flips to passed, both of which are this plan's Task 2. TD-05 stays unticked, per the same spec, until 31-10's PR-04 Round 4 verdict."

patterns-established:
  - "Dated-note corrections keep the stale string alive only inside a note that also contains the word 'corrected', which lets a `grep -vi corrected` gate exclude the line from a stale-string audit while still being human-findable"

requirements-completed: [TD-06]
# TD-05 intentionally NOT ticked here -- per this plan's own <output> tick rule,
# it ticks in 31-10 after the PR-04 Round 4 verdict.

# Metrics
duration: ~40min
completed: 2026-09-19
---

# Phase 31 Plan 09: Reconcile Every Stale Hand-Written Figure and Close 27 G-01/G-02 Summary

**Five stale hand-written figures (PACE-06, ERA-02, two ROADMAP criteria, and the PR-03/04/05 re-verification wording) corrected in place with dated provenance notes, each re-measured this session rather than copied from an older record; 27 G-01 marked CLOSED in the audit and G-02 closed at its source, flipping `27-VALIDATION.md` from `status: partial` to `status: passed`.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-19 (this session, after 31-08)
- **Completed:** 2026-09-19
- **Tasks:** 2 (both committed; a third small commit ticks TD-06 per the plan's own output spec)
- **Files modified:** 4 (`REQUIREMENTS.md`, `ROADMAP.md`, `v2.2-MILESTONE-AUDIT.md`, `27-VALIDATION.md`)

## Accomplishments

- Re-measured the device-family census live against the merged archive before writing anything (see below) rather than trusting 31-RESEARCH.md's preliminary figure or 27-VALIDATION.md's own prior census on trust.
- Read the residual/scanned-archive figures directly off `26-RESIDUAL.md` as regenerated and committed by 31-08.
- Corrected all five figures named in the plan's interfaces table, each with a dated italic note naming its source record, and confirmed the four stale-string greps (excluding "corrected" lines) all return 0.
- Amended `v2.2-MILESTONE-AUDIT.md`'s tech_debt list: 27 G-01 now reads CLOSED (was "open"); the two documentation entries Task 1 discharged (Phase 26's PACE-06 item, Phase 27's G-02 item) gained dated closure notes.
- Closed G-02 at its source in `27-VALIDATION.md` (header note, § G-02 body, retroactive-audit closing sentence) and flipped its frontmatter `status: partial` -> `status: passed`, confirming `nyquist_compliant`/`wave_0_complete` stayed `true` and untouched.
- Ran the full gate: `npm test` (85/85 files, 2596/2596 tests) and `npx tsc --noEmit` (clean).
- Ticked TD-06 (its remaining obligation was exactly this plan's Task 2); left TD-05 unticked per the plan's own tick rule.

## Task Commits

1. **Task 1: Re-measure each stale figure and correct it in place with a dated note** - `7e719b9d` (docs)
2. **Task 2: Close G-01 in the audit, close G-02 in 27-VALIDATION, and flip it to passed** - `00569aef` (docs)

**TD-06 tick (plan output spec, not a numbered task):** `98ab7c6f` (docs)

**No separate plan-metadata commit yet** — SUMMARY.md/STATE.md/ROADMAP.md progress-tracking updates are committed after this document, per the sequential-executor protocol.

## Device-Family Census (verbatim, this session)

Command:
```js
node -e '
const idx = require("./data/dashboard/index.json");
const rows = idx.activities;
const total = rows.length;
const counts = {};
for (const r of rows) {
  const fam = r.quality && r.quality.deviceEra ? r.quality.deviceEra.family : "MISSING";
  counts[fam] = (counts[fam]||0)+1;
}
console.log("total rows:", total);
console.log(counts);
const noDevice = counts["no-device-name"] || 0;
console.log("no-device-name:", noDevice, "of", total, "=", (100*noDevice/total).toFixed(1)+"%");
'
```
Output (verbatim):
```
total rows: 1899
{
  'intervals-icu': 87,
  'no-device-name': 663,
  'garmin-fenix-6-pro': 908,
  'strava-app-gpx': 35,
  'suunto-9': 205,
  'garmin-vivoactive-4': 1
}
no-device-name: 663 of 1899 = 34.9%
```
Row total (908 + 663 + 205 + 87 + 35 + 1 = 1,899) reconciles with `total rows: 1899`. This matches `27-VALIDATION.md` G-02's own 2026-09-10 census (663 of 1,890 at that time — the archive grew by 9 activities with zero change to the no-device-name count) and confirms 31-RESEARCH.md's preliminary 663/1,899 figure independently rather than trusting it.

## Figures Read Off `26-RESIDUAL.md` (regenerated by 31-08, not re-run here)

- Archive size scanned: **1,874** (was 1,866 — the pre-fix figure carried the `manifest.json` miscount 27 G-03 / 31-06 fixed)
- Severe stair-step cohort size: **154** (unchanged)
- Residual count (after fast mass > 0.5% of covered time): **14** (was 13)
- Max residual: **2.44%**

## The Five Correction Notes (verbatim, as landed)

**1. REQUIREMENTS.md PACE-06:**
> *Corrected 2026-09-19: was 13 of the 154 (0.5–2.4%); live figure read off the regenerated `26-RESIDUAL.md` (31-08, merged 1,899-activity archive) is 14 of the 154 (0.51–2.44%) — the same cross-plan integration repair already recorded at ROADMAP.md's Phase 26 Criterion 1 (Phase 30 D-04 house style).*

**2. REQUIREMENTS.md ERA-02:**
> *Corrected 2026-09-19: was 716 of 1,864 activities (38%); live figure re-measured this session via a device-family census over `data/dashboard/index.json` (`quality.deviceEra.family === "no-device-name"`) on the merged 1,899-activity archive is 663 of 1,899 (34.9%) — see `27-VALIDATION.md` G-02, now CLOSED. The shortfall from 716 reflects improved device classification (activities that previously resolved to no-device-name now resolve to `intervals-icu`/`strava-app-gpx`/`garmin-vivoactive-4`), not a defect.*

**3. ROADMAP.md Phase 27 Criterion 5:**
> *(Corrected 2026-09-19: was the 716-activity cohort; live census over `data/dashboard/index.json` on the merged 1,899-activity archive measures 663/1,899 (34.9%) — see `27-VALIDATION.md` G-02, now CLOSED.)*

**4. ROADMAP.md Phase 26 Criterion 1:**
> *(corrected 2026-09-19: was 1,866 streams scanned, the pre-fix figure carrying the `manifest.json` miscount 31-06 fixed (27 G-03); live count re-derived from the regenerated `26-RESIDUAL.md` (31-08, merged 1,899-activity archive) is 1,874 — see `26-RESIDUAL.md`.)*

**5. REQUIREMENTS.md PR-03/PR-04/PR-05 (identical note appended to each, plus their three traceability rows):**
> *Corrected 2026-09-19: was "pending phase re-verification" — the re-verification named above landed the same day (2026-09-17) this wording was written and was never propagated back into this line.*

Each of PR-03/04/05's bodies also gained, immediately before the correction note, the actual re-verification reference: *"verified by `28-VERIFICATION.md` (2026-09-17T10:15Z, `status: passed`, 5/5, superseding the earlier `gaps_found` 2/5, `gaps_remaining: []`)."*

## Amended Audit Entry (verbatim)

`v2.2-MILESTONE-AUDIT.md`, 27-per-activity-quality-signals tech_debt items:

> `"G-01 (CLOSED by plan 27-11, 2026-09-10): 27-CALIBRATION.md is not regenerable byte-identical from compute-pace-quality-calibration.mjs at its own corrected denominator values -- fixed by 27-11's isStreamFile() exclusion of manifest.json plus a regression test demonstrated failing against the old naive glob first; confirmed again by plan 31-08's 2026-09-19 regeneration against the merged 1,899-activity archive, which reproduces apart from its timestamp and the archive's growth"`
>
> `"G-02 (CLOSED by Phase 31 plan 31-09, 2026-09-19): ROADMAP Criterion 5 and REQUIREMENTS.md ERA-02 cited '716 of 1,864 (38%)' no-device-name; corrected in place to the live re-measured figure 663 of 1,899 (34.9%) on the merged archive, with a dated note in each document naming 27-VALIDATION.md G-02 as the source record; 27-VALIDATION.md itself flipped status: partial -> passed in the same plan (D-14)"`

Plus a dated closure note appended to the 26-shared-gap-aware-pace-derivation-honest-coverage phase's "Docs: REQUIREMENTS.md PACE-06 ..." item, pointing at this plan.

## G-02 Closure Text (verbatim, `27-VALIDATION.md` § G-02)

> **Status: CLOSED by Phase 31 plan 31-09 (2026-09-19).** ERA-02's requirement was already ticked on R8's PASS, never contingent on this gap since the gap concerned only a cited figure rather than the behavior R8 verified. The figure itself is now corrected: plan 31-09 re-measured the no-device-name cohort live against `data/dashboard/index.json` this session (`quality.deviceEra.family === 'no-device-name'`) on the merged 1,899-activity archive — **663 of 1,899 (34.9%)**, matching this record's own 2026-09-10 census exactly (663 of 1,890 at that time; the archive grew by 9 activities with no change to the no-device-name count). REQUIREMENTS.md ERA-02 and ROADMAP Phase 27 Criterion 5 were both corrected in place from "716 of 1,864 (38%)" / "the 716-activity … cohort" to the live figure, each with a dated italic note naming this record as the source. `status: passed` follows in this file's frontmatter in the same plan, per D-14.

## `git diff --stat` for All Four Files (cumulative, Task 1 + Task 2)

```
 .planning/REQUIREMENTS.md                                              | 20 ++++++++--------
 .planning/ROADMAP.md                                                   |  4 ++--
 .planning/phases/27-per-activity-quality-signals/27-VALIDATION.md      | 27 +++++++++++++++-------
 .planning/v2.2-MILESTONE-AUDIT.md                                      |  6 ++---
 4 files changed, 34 insertions(+), 23 deletions(-)
```
(The TD-06 tick commit `98ab7c6f`, on top of this, touches `.planning/REQUIREMENTS.md` for two more lines — the TD-06 body checkbox/note and its traceability row.)

## Verification Results

- **Four stale-string greps (Task 1 `<automated>` block), all 0:**
  - `716 of 1,864\|716-activity` (REQUIREMENTS.md + ROADMAP.md, excl. "corrected" lines): **0**
  - `13 of the 154` (REQUIREMENTS.md, excl. "corrected" lines): **0**
  - `pending phase re-verification` (REQUIREMENTS.md, excl. "corrected" lines): **0**
  - `1,866 streams scanned` (ROADMAP.md, excl. "corrected" lines): **0**
  - `grep -c "Corrected 2026-" .planning/REQUIREMENTS.md`: **5**
- **Task 2 `<automated>` block, all pass:**
  - `grep -q "^status: passed" 27-VALIDATION.md`: match
  - `grep -c "G-02" 27-VALIDATION.md` >= 1: match
  - `grep -n "G-01 (open)" v2.2-MILESTONE-AUDIT.md | wc -l` -eq 0: match
  - `grep -n "remains open and is scheduled for Phase 31" 27-VALIDATION.md | wc -l` -eq 0: match
- **`git diff .planning/ROADMAP.md` shows no change to the Phase 31 section:** confirmed — `git diff .planning/ROADMAP.md | grep -n "Phase 31"` returned nothing.
- **`git diff 27-VALIDATION.md` scope:** confirmed touching only the frontmatter status line, the header note, § G-02, and the retroactive-audit closing sentence — no row verdict, Per-Task map row, or requirement disposition changed (full diff reviewed inline during execution).
- **`nyquist_compliant`/`wave_0_complete` unmodified:** confirmed both lines appear unchanged (context lines, no +/-) in the diff.
- **`npm test`:** 85 files passed, 2596 tests passed, exit 0.
- **`npx tsc --noEmit`:** exit 0, no errors.
- **No CI-skip token in any commit message; nothing pushed** (`git status -sb` shows the branch ahead of origin, no push performed).

## Decisions Made

See `key-decisions` in frontmatter. In short: (1) the "tick state" acceptance-criteria grep is a discriminator that cannot pass for this task's own required prose edits, since git's line-level diff always emits both old and new full lines for a single-line paragraph edit — verified the real invariant (no `[ ]`/`[x]` flip) holds by inspecting the checkbox character on both sides directly, and documented the unpassable literal check rather than skip the required correction; (2) re-measured ERA-02's figure live this session per the environment note rather than trusting research's or 27-VALIDATION.md's prior figure, even though all three ultimately agree; (3) ticked TD-06 in this plan per its own output spec, since both of its remaining obligations (G-02 closure, `27-VALIDATION.md` flip) landed in Task 2.

## Deviations from Plan

None beyond the documented acceptance-criteria discrepancy above (not a code/content deviation — the actual corrections match the plan's action text and interfaces table exactly). No Rule 1/2/3 auto-fixes were needed; no Rule 4 architectural questions arose.

## Issues Encountered

The first attempt at editing PR-04's body line copied text from the traceability-table row's wording ("and § PR-04 Sign-off (Round 2, D-14)") into an `old_string` for the body line, which does not contain that clause — the `Edit` tool correctly rejected the non-matching string. Re-read the exact body line and re-applied the edit with the correct surrounding text; no incorrect content was ever written.

## Next Phase Readiness

- `27-VALIDATION.md` now reads `status: passed` with G-01 and G-02 both closed — no v2.2 phase carries a pre-execution or gap-gated validation record from Phase 27 forward into the archive (partial progress toward TD-06's ROADMAP Criterion 6, now closed by this plan).
- REQUIREMENTS.md and ROADMAP.md are internally consistent with the merged 1,899-activity archive on every figure this plan's scope covered; no stale figure from the audit's D-13 list remains outside a correction note.
- 31-10 remains responsible for: TD-05's tick (after the PR-04 Round 4 verdict), the fresh PR-04 sign-off bound to 31-08's new `28-DIFF.md` sha256 (`97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`), and any remaining ROADMAP Phase 31 criterion closure. No blockers identified for that work.

## Self-Check: PASSED

- `.planning/phases/31-tech-debt-closure-silent-failure-guards-docs-reconciliation/31-09-SUMMARY.md` — this file, created.
- Commit `7e719b9d`: `git log --oneline --all | grep 7e719b9d` → found.
- Commit `00569aef`: `git log --oneline --all | grep 00569aef` → found.
- Commit `98ab7c6f`: `git log --oneline --all | grep 98ab7c6f` → found.
- All four modified files (`REQUIREMENTS.md`, `ROADMAP.md`, `v2.2-MILESTONE-AUDIT.md`, `27-VALIDATION.md`) confirmed present on disk with the edits described above.

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*
