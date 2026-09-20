---
phase: 32-unreliable-segment-detection-calibration
verified: 2026-09-20T21:13:07Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  gaps_closed:
    - "The detector's never-throws / total-function contract (T-26-01) holds (GAP 1, closed by 32-11)"
    - "Self-execution / import-time side-effect guards genuinely demonstrate no disk I/O at import (GAP 2, closed by 32-12)"
    - "D-06/D-07 touching/adjacency rule applies one consistent boundary definition regardless of duplicate timestamps (GAP 3, closed by 32-13, with a self-introduced regression — round-2 CR-01 — subsequently closed by 32-17)"
  gaps_remaining: []
  regressions: []
human_verification: []
---

# Phase 32: Unreliable-Segment Detection & Calibration Verification Report

**Phase Goal:** A single detector identifies unreliable segments — gap-adjacent slew bursts,
hidden-pause bursts with no timestamp gap, and isolated GPS jumps — from the committed `t`/`d`
channels alone, calibrated against the archive with an explicit non-circularity argument, and
becomes the one source every downstream consumer reads (SEG-05b, deferred to Phases 33/35/36).
**Verified:** 2026-09-20T21:13:07Z
**Status:** passed
**Re-verification:** Yes — after two closure rounds (32-10..32-16 for the 2026-09-20T13:10:05Z
gaps_found report, then 32-17 for round-2 code review's CR-01/WR-01)

## Goal Achievement

Every finding below was independently reproduced against the current tree today (build re-run,
`npm test` re-run, `dist/analytics/unreliable-segments.js` re-executed directly with fresh probe
scripts, calibration artifact regenerated twice) — not read off SUMMARY.md prose or the prior
VERIFICATION.md/REVIEW.md reports, which are treated only as pointers to what to check.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/SEG-02: 3475724402 — every burst gap-adjacent, matches an independently derived per-segment table, conserves distance/time | ✓ VERIFIED | Ran `detectUnreliableSegments` directly against `data/streams/3475724402.json` via the compiled `dist/` module with `classifyGaps`-derived gaps and the shipped constants: 16 segments, ALL `gap-adjacent`, zero non-gap-adjacent, zero index-range overlaps across the 16, sum-of-metres (2148.7 m) sane against stream total (13424.7 m). `npm run compute-unreliable-segment-recount` independently PASSES against the calibration artifact's own table. |
| 2 | SC2/SEG-03: 3475734189 hidden-pause burst flagged at t=1353–1360 | ✓ VERIFIED | Direct `dist/` execution: a `hidden-pause` segment spans t=1352–1360 (181.5 m), fully covering the named window and mechanism. (The ROADMAP's "199 m" figure is 32-CONTEXT.md's own pre-calibration research measurement of this burst by a different method — a reference, not a value this criterion requires the detector's own folded-run output to reproduce exactly, consistent with this phase's own "reference to reconcile against" convention elsewhere. Substantive claim — hidden-pause fires on this window — is independently confirmed.) |
| 3 | SC3/SEG-03: 3475740390 five isolated jumps flagged, incl. t=2508 and t=2580/2587 as distinct segments | ✓ VERIFIED | Direct `dist/` execution: exactly 5 `isolated-jump` segments at t=2347 (30.1 m/3s), t=2508 (52.4 m/5s — the 400 m best start), t=2536 (28.6 m/2s), t=2580 (30.4 m/3s), t=2587 (24.7 m/2s) — figures match 32-CONTEXT.md's measured values and ROADMAP's named figures exactly, and 2580/2587 are two distinct segments as required. |
| 4 | SC4/SEG-04: committed, regenerable calibration artifact states the calibrated constant(s), a non-circularity argument, and the Suunto (4556693525) disposition | ✓ VERIFIED | `32-CALIBRATION.md` sha256 = `f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e` (matches exactly); regenerated twice this session, byte-identical both times (`git status --porcelain` clean after each run). Contains `## Chosen constants`, `## Non-circularity (D-13)` (with a watched-failing tail-percentile strawman for L/F/B, each shown failing the same 1% tolerance the real statistic passes), and `## Suunto over-measurement disposition — 4556693525` (states DETECTED, mechanism disclosed, never corrected, per D-01/D-03). `findValley`'s prior unsoundness (CR-04) is fixed — confirmed by reading the in-interval-only binning code directly. |
| 5 | SC5/SEG-05a: single-source audit extended to the detector, demonstrated catching a planted second implementation both in-suite and against the real tree, robust to quote style | ✓ VERIFIED | `pace-single-source.test.ts -t "SEG-05a"` → 9 matched, 9 passed (≥7 baseline recorded in 32-15-SUMMARY.md, confirmed independently). Quote-variant proof present and green for double-quoted and backtick import specifiers, both `.js` and extensionless forms. |
| 6 | The detector's never-throws / total-function contract (T-26-01) holds for malformed gaps/params/t/d (GAP 1, closed by 32-11) | ✓ VERIFIED | Re-ran, myself, all five of the prior verification's own reproduction inputs directly against the freshly rebuilt `dist/analytics/unreliable-segments.js`: `(t,d,null,P)`, `(t,d,[],null)`, `(t,d,[null],P)`, `(null,null,[],P)`, `advanceSteps(t,d,null)` — every one returns a fresh `[]` (confirmed distinct array references across two calls), none throws. |
| 7 | Self-execution/import-time-side-effect guards genuinely test "no disk read at import" (GAP 2, closed by 32-12) | ✓ VERIFIED | The vacuous `vi.spyOn(fs,...)` pattern is gone; replaced by `scripts/unreliable-segment-import-guards.test.mjs`'s `vi.mock('fs')`/`vi.mock('node:fs')` recorder. Ran the file: 5/5 pass, including both positive controls (`import-time-read-probe-named.mjs` via named import, `import-time-read-probe-default.mjs` via default import) recording real reads. **I additionally wrote and ran my own falsifiability check** — a scratch test pointing the exact negative-assertion shape (`expect(calls).toEqual([])`) at the known-reading named-import probe instead of the real generator scripts — and confirmed it goes RED (`AssertionError: expected [ {...} ] to deeply equal []`), proving the guard mechanism is not vacuous. Scratch file removed after use; `git status --porcelain` clean. |
| 8 | D-06/D-07 touching/adjacency rule applies one consistent boundary definition regardless of duplicate timestamps, AND does not double-count distance when two adjacent gap spans share a duplicated boundary (GAP 3 + round-2 CR-01, closed by 32-13 then 32-17) | ✓ VERIFIED | Single-gap duplicate-boundary fixture (`t=[0,1,1,13]`, one gap `{startSec:1,endSec:13}`) still classifies `gap-adjacent`, 21 m/13 s/1 gap, unchanged from 32-13. The round-2 reviewer's exact two-gap overlap reproduction (`t=[0,1,5,5,10,11]`, `d=[0,20,25,45,50,140]`, gaps `[{1,5},{5,10}]`, `hiddenPauseMinMetres:1e9`) — which pre-32-17 returned two overlapping segments summing 160 m against a 140 m stream — now returns a fresh `[]` (fail-closed), independently re-executed against the freshly rebuilt `dist/` module. `-t "boundary convention"` → 7 matched, 7 passed (up from 32-13's 6, the new fixture added, none removed). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/unreliable-segments.ts` | Pure detector, total function, 3 mechanisms, calibrated constants, no double-counting | ✓ VERIFIED | 664 lines. `Array.isArray`/`gapListIsWellShaped`/`paramsAreValid` guards confirmed present and effective; `mapGapToIndices` FIRST-at-start/LAST-at-end convention confirmed; new `sortedGapBlocks` overlap-detection loop (lines 514-519) confirmed present and effective against the CR-01 reproduction. `npx tsc --noEmit` exits 0. |
| `scripts/compute-unreliable-segment-recount.mjs` | Independent gap-first recount, zero-import, fails closed | ✓ VERIFIED | Re-ran: `PASS: recount agrees with the calibration artifact's detector table.` |
| `scripts/compute-unreliable-segment-calibration.mjs` | Reachability, negative-control candidates, statistics, constant derivation, figures of record, sound `findValley`, validated `parseDecisionText`, fail-closed `namedItemSegmentMetres` | ✓ VERIFIED | Regenerates byte-identically (confirmed twice this session). `findValley` bins only `v >= lowMetres && v < highMetres` (in-interval only) — CR-04 fix confirmed present in source. `namedItemSegmentMetres` throws on ambiguous multi-overlap (WR-07 fix) confirmed present in source. |
| `.planning/phases/.../32-CALIBRATION.md` | Committed artifact of record, all sections, idempotent | ✓ VERIFIED | sha256 exact match; regenerated twice, byte-identical both times. |
| `src/analytics/pace-single-source.test.ts` (SEG-05a extension) | Detector containment scans, non-vacuous, planted proofs both directions, quote-style-independent | ✓ VERIFIED | 9 matched `-t "SEG-05a"` tests pass (up from the prior report's 7); quote-variant fixtures (double-quote, backtick, extensionless) present and passing. |
| `src/analytics/unreliable-segments.test.ts` (real-stream fixtures + gap-boundary + CR-01 regression) | Real-stream named-activity regression tests, boundary-convention block, two-gap overlap fixture, cross-segment conservation | ✓ VERIFIED | `-t "3475724402"` → 4 matched; `-t "mechanism"` → 12 matched; `-t "boundary convention"` → 7 matched; whole-file 94 passed, 0 failed. Cross-segment conservation assertion (no segment's `startIndex` precedes the previous `endIndex`; combined metres never exceed `d[n-1]-d[0]`) is present in the sweep and was proven able to fail (verified via SUMMARY's RED transcript; the underlying mechanism — the same guard I independently exercised via the CR-01 reproduction — is confirmed live). |
| `scripts/unreliable-segment-recount-crosscheck.test.mjs` | npm-test-time detector-vs-recount agreement | ✓ VERIFIED | Included in the 91-file/2848-test green `npm test` run. |
| `scripts/validate-unreliable-segments-1hz.mjs` | Local-only 1Hz validation, graceful absence, never-throws for both the stream read (CR-03) and the activity-doc read (WR-01) | ✓ VERIFIED | `activityDoc === null \|\| typeof activityDoc !== 'object' \|\| typeof activityDoc.start_date !== 'string'` guard confirmed present at line ~318-323, immediately preceding the `Date.parse` dereference. Source read directly, matches WR-01's fix description exactly. |
| `scripts/compute-stream-checksums.mjs` + `.test.mjs` | D-17 append-only manifest gate | ✓ VERIFIED | Re-ran `npm run compute-stream-checksums`: `added 0`, tree clean. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `unreliable-segments.ts` | `best-effort-utils.ts` | `validateStreamSeries` import | WIRED | Confirmed in source (line 36). |
| `compute-unreliable-segment-recount.mjs` | `32-CALIBRATION.md` | `parseCalibrationArtifact` | WIRED | `node scripts/compute-unreliable-segment-recount.mjs` exits 0, PASS, re-run this session. |
| `compute-unreliable-segment-calibration.mjs` | `dist/analytics/unreliable-segments.js` | detector import for calibration | WIRED | Confirmed; generator regenerates byte-identically, re-run twice this session. |
| `unreliable-segment-recount-crosscheck.test.mjs` | `compute-unreliable-segment-recount.mjs` | imports both sides for nightly agreement | WIRED | Included in the green 91-file/2848-test `npm test` run. |
| `pace-single-source.test.ts` | `unreliable-segments.ts` | containment/importer scan | WIRED | Non-vacuous, 9 SEG-05a tests pass. |
| `unreliable-segment-import-guards.test.mjs` | `fs`/`node:fs` | `vi.mock` recorder | WIRED, NON-VACUOUS | Independently proven falsifiable this session (own scratch test against the known-reading probe went RED). |

### Data-Flow Trace (Level 4)

Not applicable in the strict sense — this phase ships no rendered UI (explicitly out of scope per
32-CONTEXT.md § Phase Boundary: "No rendered surface, so no human browser checkpoint"). The
equivalent trace for a compute-only detector is: does the detector's output, when run against the
real committed archive, differ from a hand-derived/independently-recounted value? Yes, and
matching: `compute-unreliable-segment-recount.mjs` (a deliberately different, non-importing
algorithm) agrees with the detector's own calibration-artifact table; the archive-wide overlap scan
recorded in 32-17-SUMMARY.md (383 activities with adjacent shared-boundary gaps, 0 at a duplicate
timestamp, 0 overlapping-segment activities, 1344 total segments) was not re-executed by me in full
(1,874-stream scan takes longer than a spot-check), but the recount PASS and byte-identical
calibration artifact are independent corroboration that detector output is unchanged and correctly
flowing from real `t`/`d` data, not a static/stub value.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Detector never throws on 5 malformed-input shapes | `node -e` against `dist/analytics/unreliable-segments.js` | All 5 return fresh `[]`, none throws | ✓ PASS |
| CR-01 two-gap overlap reproduction fails closed | `node -e` against `dist/analytics/unreliable-segments.js` | Returns `[]` (was `160m` double-counted pre-fix) | ✓ PASS |
| Single-gap duplicate-boundary convention unchanged | `node -e` against `dist/analytics/unreliable-segments.js` | `gap-adjacent`, 21m/13s/1 gap | ✓ PASS |
| GAP 2 guard is falsifiable (not vacuous) | scratch vitest file pointing negative assertion at reading probe | RED (`AssertionError`) | ✓ PASS |
| SC1/SC2/SC3 named-activity claims | `node -e` against `dist/` + `data/streams/*.json` | 16 gap-adjacent segments (3475724402); hidden-pause at t=1352-1360 (3475734189); 5 isolated jumps at named t values (3475740390) | ✓ PASS |
| Calibration artifact idempotent, sha256-matched | `node scripts/compute-unreliable-segment-calibration.mjs` (x2) | sha256 `f8f6d5db...` both times, `git status` clean | ✓ PASS |
| Full suite green | `npm test` | 91 files / 2848 tests passed | ✓ PASS |
| Recount independent agreement | `node scripts/compute-unreliable-segment-recount.mjs` | PASS | ✓ PASS |
| Build/typecheck clean | `npm run build`, `npx tsc --noEmit` | both exit 0 | ✓ PASS |

### Probe Execution

N/A — this phase declares no `scripts/*/tests/probe-*.sh`-style probes, and none exist under
`scripts/*/tests/`. Its "recount"/"calibration"/"import-guards" scripts serve the equivalent role
and are covered above as spot-checks and key links.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| SEG-01 | 32-02, 32-08, 32-11, 32-13, 32-17 | Detector judges maximal runs, folds decimation aliasing, catches diluted slews, total function | ✓ SATISFIED | Mechanics tests pass; never-throws contract independently re-confirmed against 5 reproduction inputs this session. |
| SEG-02 | 32-03, 32-07, 32-08, 32-13, 32-17 | Gap-adjacent merging, independent recount agreement, one consistent boundary convention, no double-counting | ✓ SATISFIED | Recount PASS on 3475724402; single-gap and two-gap overlap fixtures both independently re-verified against `dist/` this session. |
| SEG-03 | 32-08, 32-15 | Hidden-pause and isolated-jump mechanisms on named activities | ✓ SATISFIED | Both fixtures independently re-derived from raw `t`/`d` this session, matching the named windows/values exactly. |
| SEG-04 | 32-05, 32-06, 32-07, 32-09, 32-12, 32-14 | Calibrated, regenerable, non-circular artifact with Suunto disposition, sound `findValley` | ✓ SATISFIED | Artifact complete, idempotent, sha256-matched; `findValley`'s CR-04 unsoundness confirmed fixed in source (in-interval-only binning). |
| SEG-05a | 32-04, 32-15 | Single-source audit extended to detector, planted proofs both directions, quote-style-independent | ✓ SATISFIED | 9 matched tests, quote-variant fixtures present and green. |
| SEG-05 (split carrier, 32-01) | 32-01 | Amendment/split bookkeeping only, never ticked | ✓ SATISFIED | REQUIREMENTS.md carries SEG-05a/SEG-05b rows; no unsplit SEG-05 row remains. |
| SEG-05b | *(deferred to Phases 33/35/36 by design)* | Every consumer reads the detector | — NOT EXPECTED HERE | Correctly left Pending in REQUIREMENTS.md traceability table; not claimed by any Phase 32 plan. |

No orphaned requirements: every ID in REQUIREMENTS.md's Phase 32 traceability rows (SEG-01,
SEG-02, SEG-03, SEG-04, SEG-05a) is claimed by at least one plan's `requirements:` frontmatter
field (verified by grepping all 17 plans), and no plan claims an ID absent from REQUIREMENTS.md.

**Documentation-completeness note (Info, not a gap):** REQUIREMENTS.md's SEG-02 and SEG-04 rows
document their "Reopened .../Closed by 32-13" and "Reopened .../Closed by 32-12 and 32-14" history
but do not mention that 32-13's own fix introduced round-2's CR-01 (subsequently closed by 32-17),
nor WR-01. 32-17-SUMMARY.md's own "Decisions Made" section explains this was deliberate: the
plan's genesis commit reopened only `32-VALIDATION.md` and `ROADMAP.md`, on the reasoning that
CR-01/WR-01 were introduced and closed entirely within the gap-closure round and were never a
REQUIREMENTS.md-visible regression (SEG-01/02/04 stayed ticked throughout). This is a defensible
call and does not affect the functional truth of any requirement — verified independently above —
but a future reader of REQUIREMENTS.md alone, without also reading 32-VALIDATION.md's reopen
history, would not learn that 32-13's fix needed a follow-up. Recorded for visibility, not scored
as a gap.

### Anti-Patterns Found

Full detail in `32-REVIEW-round1.md` and `32-REVIEW.md` (round 2). Both rounds' Critical and
Warning findings are now closed and independently re-confirmed above. One Info-level item from
round 2 remains genuinely open (by the reviewer's own classification) and does not block the goal:

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/unreliable-segment-import-guards.test.mjs` | ~41-59 | `wrapFsModule` enumerates exactly `readFileSync`/`readdirSync`/`writeFileSync` rather than wrapping the whole `fs` surface generically | ℹ️ Info | Not vacuous today (both production scripts import only these three names, confirmed); a future generator edit that imports `existsSync`/`statSync` at import time would silently evade this guard. Reviewer's own severity call (round 2, IN-01); low blast radius, requires a future code change to manifest, no fix required to close this phase. |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers found in any file this phase modified (checked
`unreliable-segments.ts`, `unreliable-segments.test.ts`, `validate-unreliable-segments-1hz.mjs`,
`compute-unreliable-segment-calibration.mjs`, `compute-unreliable-segment-recount.mjs`,
`unreliable-segment-import-guards.test.mjs`, `pace-single-source.test.ts` directly, this session).
No `TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" markers either.

### Known-Open Items Assessed (carried forward, not hidden)

1. **32-14's `grep -c "valleyFound: false"` plan-verify literal.** Confirmed myself: this literal
   matches **0** times in `32-CALIBRATION.md` and structurally never can, because the generator
   renders that internal state only as the prose "NO clean valley found — anchor-interval midpoint
   fallback." The semantic equivalent, `grep -c "NO clean valley found"`, matches **1** time. This
   is an unsatisfiable plan-verify row, not a code defect — the underlying claim (no clean valley
   exists, midpoint fallback used, stated honestly) is true and independently confirmed in the
   artifact's own `## Hidden-pause vs isolated-jump boundary (D-08)` section.
2. **A `⬜ pending` grep literal colliding with `32-VALIDATION.md`'s own status legend.** Read the
   relevant section directly: the file's status-legend caption itself spells out all four status
   markers (including `⬜ pending`) as prose describing the legend, which a literal count would
   always find regardless of whether any per-task row is actually pending. Confirmed no per-task
   Status cell in the file currently reads `⬜ pending` — all rows for 32-10 through 32-17 read
   `✅ green`. This is the same class of unsatisfiable-literal issue as (1), not a masked gap.

### Human Verification Required

None. Every truth in this report resolves from direct code execution, direct source reading, or
independently-run test/script output — no visual, real-time, or subjective-quality judgment is
required. This matches 32-CONTEXT.md's own scoping note that this phase has no rendered surface.

### Gaps Summary

**None remaining.** All three gaps from the 2026-09-20T13:10:05Z report (never-throws contract,
vacuous import guards, boundary-convention inconsistency) are closed and independently
re-reproduced against the current tree in this session — not merely re-read from SUMMARY.md
prose. The one Critical the closure round introduced into itself (round-2 CR-01: 32-13's own
boundary-widening fix double-counting distance across two adjacent gap spans sharing a duplicated
boundary) is also closed and independently re-reproduced: the reviewer's exact input now returns a
fresh `[]` instead of two overlapping, double-counting segments, while the single-gap case that
32-13 originally fixed remains unchanged and green. The residual WR-01 warning
(`activityDoc.start_date` unguarded) is closed and independently confirmed via direct source
reading of the guard clause.

All five ROADMAP Success Criteria (SC1-SC5 / SEG-01 through SEG-05a) were independently
re-derived this session directly from the committed streams and the compiled detector — not
accepted from the calibration artifact's own prose or any SUMMARY's claim — and all five hold.
SEG-05b (the goal's "one source every downstream consumer reads") is correctly out of scope for
this phase and correctly left Pending, discharged by Phases 33/35/36.

The phase goal is achieved: the detector identifies all three mechanisms from `t`/`d` alone,
conserves distance/time (including the previously-latent two-gap overlap case), is calibrated
against the archive with an explicit, watched-failing non-circularity argument, and the SEG-05a
half of the single-source audit demonstrably catches a planted second implementation under three
quote styles. Ready to proceed to Phase 33.

---

_Verified: 2026-09-20T21:13:07Z_
_Verifier: Claude (gsd-verifier)_
