---
phase: 35-stream-derived-running-pace
verified: 2026-09-28T09:01:14Z
status: passed
score: 4/4 roadmap success criteria verified (plus RPACE-01/02/03 and SEG-05b's Phase 35 half)
overrides_applied: 0
---

# Phase 35: Stream-Derived Running Pace — Verification Report

**Phase Goal:** A stream-derived running pace — unreliable segments and gaps excluded from both
distance and time — computed for every activity with a computable stream through the existing
single pace-derivation module, shown beside metadata pace, with the existing "Pace disputed" badge
raised on material disagreement (amended 2026-09-24, D-08/D-06: covered metres over
`coverage.coveredSec` off the same `pairKinds` partition; "material disagreement" is slower-only,
gated on strictly positive withheld distance).

**Verified:** 2026-09-28T09:01:14Z
**Status:** passed
**Re-verification:** No — initial verification (no prior `35-VERIFICATION.md` existed)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every activity with a computable stream carries a running pace via the single pace-derivation module; every other stream carries an explicit not-computable value with a stated reason; archive-wide count reported as a finding | VERIFIED | `deriveRunningPace` (`src/analytics/pace-derivation.ts:698-751`) is the ONE implementation (confirmed only definition site in `src/`); `computable` gate is exactly `validateStreamSeries(t,d).ok AND coveredSec>0 AND coveredM>0` (lines 710-750). Live query of shipped `dist/widgets/data/dashboard/index.json`: 1899/1899 rows carry the `runningPace` key; 1 row `computable:false` (reason `"stream has no covered distance or no covered time"`); 25 rows `runningPace:null` (no-stream). `35-09-SUMMARY.md` reports this exact split as a finding: "running pace computable 1873 / not computable 26 (25 no-stream + the 1 not-computable stream)". `35-CALIBRATION.md` independently reports "Non-computable (deriveRunningPace): 1", and `35-RUNNING-PACE-RECOUNT.md` independently reports "No covered distance (recountCoveredM <= 0): 1" — three independent sources agree. |
| 2 | 3475724402's detail view shows running pace beside metadata pace (4:56/km) with a plain exclusion statement, and the two figures visibly differ | VERIFIED | Shipped row: `paceSecPerKm=295.9` (4:56/km), `runningPace.runningPaceSecPerKm=317.6` (5:18/km), `excludedM=2253.1`, `excludedSec=797`. `detail.ts:706-729` appends the Running Pace tile immediately after the Pace tile (`statGrid.appendChild(paceStatCard)` then the running-pace block), satisfying "beside". Browser checkpoint Row R1 (`35-VALIDATION.md`) transcribes a live PASS: Pace tile "4:56/km", Running Pace tile "5:18/km", exclusion line verbatim "Excludes 2253 m over 13:17 of recording gaps, pauses and unreliable segments.", against a digest-verified served build matching plan 35-12's frozen digest. |
| 3 | "Pace disputed" badge raised on 3475724402 under an archive-calibrated, recorded threshold; newly-disputed / faster-side / gate-excluded counts reported as findings; anti-quota discipline held; basis gate (not selector) | VERIFIED | `PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173` defined exactly once (`pace-derivation.ts:1098`; dist mirror only). Re-ran `node scripts/compute-running-pace-dispute-calibration.mjs` (dry run) against the clean, unmodified tree: output byte-identical to the committed `35-CALIBRATION.md` (same shape arbitration table, same `Selected: C3`, same constant). Basis gate recorded explicitly as a gate, not a selector: `\| Basis gate (3475724402 badged under eligibility + slower-only direction) \| eligible=true targetValue=1.0731 cut=1.0173 \| PASS \|`, and the generator's own text states a failing basis gate renders `## GATE FAILED`/`## NO SHAPE CLEARS` and HALTs rather than substituting a shape. Findings reported: "Newly-disputed count under the chosen cut (population E): 125" (matches live count of `paceDisagreement != null` rows in the shipped index: 125/1899), "Faster-side count at the mirror cut ... never badged: 15", "Gate-excluded population ... n=575". Anti-quota: shapes are declared and arbitrated in a fixed pre-declared order (S0, C1, C3, C2, C4, B1, B2); C3 is the first to clear both Axis B and Axis C — not chosen because it badges 3475724402, since C1 (ranked ahead of C3) failed on its own axes first. Strawman S0 measured FIRST and fails both Axis B (movement 122.5%) and Axis C (movement 122.5%) — the corrected, tail-sensitive narrowing (top-two order statistics) described in the be-skeptical brief, matching the code comment history in `35-CALIBRATION.md` lines 13-17. `detectPaceDisagreement` (`pace-derivation.ts:1146-1164`) implements the eligibility gate (`excludedM > 0`, zero free parameters) and slower-only direction (`ratio >= cut`, never the reverse) exactly as D-02/D-06 require. |
| 4 | Metadata pace and device `moving_time` remain byte-identical everywhere else | VERIFIED | `streamPaceSecPerKm` and `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM` have zero occurrences anywhere in `src/` (grep confirmed). Shipped index: 3475724402 `paceSecPerKm=295.9`, `movingTimeSec=3973` (1:06:13); 5059204779 `pace=1:53/km`, `moving time=0:20:16` per Row R4's live transcription — both matching the task's stated facts exactly. `list.test.ts -t "criterion 4"` (6 matched) independently recomputes `paceSecPerKm` from `movingTimeSec / (distanceM/1000)` rather than reading the row field, asserting byte-identical output whether or not `paceDisagreement`/`runningPace` are populated; ran green as part of the full suite. |

**Score:** 4/4 roadmap success criteria verified.

### Requirement-Level Must-Haves

| Requirement | Status | Evidence |
|---|---|---|
| RPACE-01 | SATISFIED | Single `deriveRunningPace` implementation, total (never throws on null/undefined/non-array/short streams — `pace-derivation.test.ts -t "deriveRunningPace"`, 14 matched, green), computable definition matches the amended REQUIREMENTS.md row verbatim, archive-wide non-computable count reported. Ticked `[x]` in `.planning/REQUIREMENTS.md` line 46; Traceability table row "Complete". |
| RPACE-02 | SATISFIED | Fourth stat tile, always-on exclusion line (all four states: computable/zero-excluded/not-computable/omitted, `runningPaceTilePlan`, `detail-sections.ts:876-907`), `textContent`-only (no innerHTML). Browser checkpoint rows R1, R4, R6, R7 all PASS. Ticked `[x]`, Traceability "Complete". |
| RPACE-03 | SATISFIED | One comparator (running pace), zero-free-parameter eligibility gate, slower-only direction, calibrated constant with provenance docblock. Browser checkpoint rows R2, R3, R5, R8 all PASS. Ticked `[x]`, Traceability "Complete". |
| SEG-05b (Phase 35 half) | SATISFIED (row stays Pending, correctly) | `deriveRunningPace` reads the detector via `classifyGapsWithSegments`, proven load-bearing by `pace-single-source.test.ts`'s "SEG-05b" block (3 matched, green: stubbing `detectUnreliableSegments` to `[]` changes `runningPaceSecPerKm`/`excludedM`/`excludedSec` on real 3475724402 in both directions). REQUIREMENTS.md row correctly left `[ ]` — Phase 36 still owes its half; this is the correct disposition, not a gap. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/analytics/pace-derivation.ts` | `deriveRunningPace`, `RunningPace`, `PACE_DISAGREEMENT_RUNNING_RATIO`, retargeted `detectPaceDisagreement` | VERIFIED | Read in full for the relevant sections; matches D-08/D-01/D-02/D-06/D-07 exactly. |
| `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` | Full shape arbitration, strawman-first, chosen constant, gates, findings | VERIFIED | Regenerated dry-run byte-identical to committed artifact. |
| `.planning/phases/35-stream-derived-running-pace/35-RUNNING-PACE-RECOUNT.md` | Independent zero-import recount, named activities, archive-wide reconciliation | VERIFIED | Present, content matches crosscheck test's live figures. |
| `scripts/compute-running-pace-recount-crosscheck.test.mjs` | `classifyDivergence` fails closed to UNEXPLAINED with three structurally-gated causes | VERIFIED | Full function body read; final fallback (line ~420) is unconditionally `UNEXPLAINED`. All 14 tests green, including CAN/CANNOT synthetic fixtures per cause and the real archive-wide sweep (`FULL AGREEMENT=1184, EXPLAINED DIVERGENCE=690, UNEXPLAINED=0`, genuinely reached, not asserted `>0` or forced). |
| `src/dashboard/views/detail.ts` / `detail-sections.ts` | Running Pace tile wired beside Pace tile | VERIFIED | Tile appended immediately after `paceStatCard`; `runningPaceTilePlan` pure function covers all four states. |
| `src/dashboard/views/list.ts` | Badge/disclosure retargeted to running pace, single dispatch point | VERIFIED | Badge text "Pace disputed — running {X}" confirmed at `detail.ts:701`; criterion-4 regression test green. |
| `dist/widgets/data/dashboard/index.json` (shipped) | `runningPace` on every row; 125/1899 disputed; 1 not-computable | VERIFIED | Live-queried: exactly matches. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `deriveRunningPace` | `detectUnreliableSegments` | `classifyGapsWithSegments`, proven load-bearing | WIRED | `pace-single-source.test.ts -t "SEG-05b"` (3 matched, green) stubs the detector and shows the running pace and excluded metres/seconds change on real 3475724402 in both directions. |
| `compute-dashboard-index.ts` | `pace-derivation.ts deriveRunningPace` | one call per activity on the already-read stream | WIRED | `compute-dashboard-index.ts:273` calls `deriveRunningPace(streamForQuality)`; `verify-dashboard-publish.mjs` asserts every row carries the key (67/67 checks green per `35-09-SUMMARY.md`). |
| `35-VALIDATION.md` Manual-Only rows | `35-RUNNING-PACE-RECOUNT.md` / `35-CALIBRATION.md` | Expected values sourced from the independent artifacts, not the rendered page | WIRED | Confirmed by reading all 8 rows: every Expected value cites the artifact and figure it was drawn from, never a page read or 35-CONTEXT.md's contaminated probe table. |
| `35-VALIDATION.md` verdicts | `.planning/REQUIREMENTS.md` | requirement ticks only when every mapped row is PASS | WIRED | `35-13-SUMMARY.md` shows the per-requirement mapping (RPACE-01→R1,R3; RPACE-02→R1,R4,R6,R7; RPACE-03→R2,R3,R5,R8), all PASS, all three ticked; SEG-05b correctly left unticked. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Running Pace tile (`detail.ts`) | `runningPace` | `indexClient.getRow(detail.id)?.runningPace`, itself sourced from `deriveRunningPace` over the real committed stream archive | Yes — live-queried shipped JSON carries per-activity, non-fabricated values (1873 distinct computable rows, 1 explicit not-computable, 25 null) | FLOWING |
| "Pace disputed" badge (`list.ts`/`detail.ts`) | `paceDisagreement` | `detectPaceDisagreement(metadataPaceSecPerKm, runningPace)` over the same archive | Yes — 125/1899 rows non-null, matching the independently-generated `35-CALIBRATION.md` finding exactly | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `PACE_DISAGREEMENT_RUNNING_RATIO` defined in exactly one place | `grep -rn "PACE_DISAGREEMENT_RUNNING_RATIO = " src/` | Single match, `pace-derivation.ts:1098` (dist mirror only, compiled output) | PASS |
| `streamPaceSecPerKm` / old threshold constant fully deleted | `grep -rn "streamPaceSecPerKm\|PACE_DISAGREEMENT_METADATA_THRESHOLD" src/` | Zero matches | PASS |
| Shipped index carries `runningPace` on every row, 125 disputed, 1 not-computable | Node script against `dist/widgets/data/dashboard/index.json` | 1899/1899 rows have `runningPace`; 125 non-null `paceDisagreement`; 1 `computable:false`; 25 `null` | PASS |
| Calibration artifact regenerates byte-identical | `node scripts/compute-running-pace-dispute-calibration.mjs` (dry run) | Output identical to committed `35-CALIBRATION.md` (same shape table, same `Selected: C3`, same constant, same findings) | PASS |
| `classifyDivergence` fails closed, three gated causes | Read `scripts/compute-running-pace-recount-crosscheck.test.mjs` lines 350-427; ran full test file | 14/14 tests green, final fallback is unconditional UNEXPLAINED, each named cause gated on a checked structural predicate | PASS |
| tsc clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Full suite green | `npx vitest run` | 101 files / 3676 tests, all passed | PASS |

### Probe Execution

Not applicable in the formal `scripts/*/tests/probe-*.sh` sense — this phase's runnable verification is the recount/calibration scripts and their `.test.mjs` suites, executed above under Behavioral Spot-Checks with full stdout captured.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| RPACE-01 | 35-01 through 35-09 | Stream-derived running pace via single module | SATISFIED | See table above |
| RPACE-02 | 35-10, 35-11 | Detail-view rendering beside metadata pace | SATISFIED | See table above |
| RPACE-03 | 35-06, 35-07, 35-08, 35-11 | Calibrated "Pace disputed" badge | SATISFIED | See table above |
| SEG-05b (Phase 35 half only) | 35-03, 35-13 | Detector single-source, Phase 35's consumer | SATISFIED (row stays Pending, correctly, pending Phase 36) | See table above |

No orphaned requirements found: `.planning/REQUIREMENTS.md`'s Traceability table maps only RPACE-01/02/03 and SEG-05b's per-phase share to Phase 35, and all four appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` debt markers found in any phase-35-modified file (`grep -n -E` swept all 11 core `src`/`scripts` files) | — | N/A |
| `src/analytics/compute-dashboard-index.ts:250-263`, `pace-derivation.ts:698-707` | WR-01 (35-REVIEW.md) | `runningPace.notComputableReason` reads "no stream committed for this activity" even for a stream that genuinely exists but fails to read/parse | INFO (advisory, non-blocking) | Message-accuracy defect in a rare edge case (stream file present but corrupt/unparseable); does not affect the archive-wide `computable`/count reporting or any of the four ROADMAP criteria; disclosed in `35-REVIEW.md` as a non-critical warning, not a data-loss or crash risk. |
| `scripts/verify-dashboard-publish.mjs:375-395` | WR-02 (35-REVIEW.md) | `runningPace` shape check doesn't validate `excludedM`/`excludedSec` type/finiteness/sign | INFO (advisory, non-blocking) | Publish-time guard gap on a numeric sub-field; the shipped archive's own values are sane (verified live above); doesn't affect this phase's must-haves. |

Both items above are the two advisory warnings already recorded in `35-REVIEW.md` (0 critical, 2 warnings) and are carried here as INFO for completeness — they do not block phase goal achievement.

**Disclosed, deliberately-unfixed carry-forward items (confirmed recorded, not new gaps):**
- Seven activities whose `excludedM` is a sub-picometre negative float (`-1.8e-12`-scale) fall into no population (E nor B nor C): recorded in `35-07-HALT-1.md` and `35-07-SUMMARY.md` with explicit IDs (`12992993271, 13098246407, 14049367721, 15923122090, 5619205516, 5875527057, 6924646802`), flagged "not fixed here — carried forward for a future plan."
- Three quantized-distance streams (`3647739864, 4598855187, 5059204779`) dominate population E's extreme tail: recorded in `35-07-SUMMARY.md`, flagged "not fixed here — carried forward," and explicitly noted as non-skewing today since no shipped shape reads E directly.

### Human Verification Required

None. The phase's one human checkpoint (`35-VALIDATION.md`'s 8-row browser checkpoint against a digest-verified served build) was already run and transcribed verbatim by plan 35-13, with all 8 rows PASS (R7 against a corrected, auditably-documented Expected value). Per the task instructions this was not re-run; its artifact was read and cross-checked against the independent recount/calibration figures it claims to quote, and found consistent.

### Gaps Summary

None found. All four ROADMAP success criteria are independently verified against the actual codebase (not SUMMARY prose): the single-source constant, the deleted legacy comparator, the shipped dashboard index counts, the wired UI tile and badge, the independent recount/crosscheck with its now-fail-closed classifier, and the calibration's anti-quota-compliant arbitration all check out under direct inspection and re-execution. The three specific defects flagged in the verification brief (unconditional-EXPLAINED classifier, insensitive strawman S0, mis-derived R7 Expected value) are each confirmed corrected, with the corrections themselves auditable in the codebase/artifacts (dated docblocks, HALT records, and a disclosed checkpoint-row correction) rather than merely asserted in a SUMMARY. The two carry-forward disclosed items and the two advisory code-review warnings are present and accounted for, none rising to blocker severity.

---

_Verified: 2026-09-28T09:01:14Z_
_Verifier: Claude (gsd-verifier)_
