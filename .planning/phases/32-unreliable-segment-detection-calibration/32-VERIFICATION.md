---
phase: 32-unreliable-segment-detection-calibration
verified: 2026-09-20T13:10:05Z
status: gaps_found
score: 5/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The detector's never-throws / total-function contract (T-26-01) holds: any invalid t/d, malformed gap span, or non-finite/invalid parameter returns a fresh empty array and never throws (32-02-PLAN.md must_haves, restated in 32-03/32-07/32-09 STOP conditions)"
    status: failed
    reason: "detectUnreliableSegments and advanceSteps throw TypeError on null gaps, null params, a [null] gap entry, and null t/d. Independently reproduced against the shipped dist/analytics/unreliable-segments.js: detectUnreliableSegments(t,d,null,P) -> 'gaps is not iterable'; detectUnreliableSegments(t,d,[],null) -> 'Cannot destructure speedLimitMps of null'; detectUnreliableSegments(t,d,[null],P) -> 'Cannot read properties of null (reading startSec)'; detectUnreliableSegments(null,null,[],P) -> 'Cannot read properties of null (reading length)'; advanceSteps(t,d,null) -> 'gaps is not iterable'. The module docblock and detectUnreliableSegments's own docblock both promise a fresh [] here, never a throw. Three untyped .mjs consumers (compute-unreliable-segment-calibration.mjs, validate-unreliable-segments-1hz.mjs) call this module with JSON.parse'd, unvalidated on-disk data, so this is a reachable production path, not a theoretical one."
    artifacts:
      - path: "src/analytics/unreliable-segments.ts"
        issue: "No Array.isArray(t)/Array.isArray(d)/Array.isArray(gaps) or params-is-object guard before iteration; mapGapToIndices dereferences a gap span without a null/typeof check"
    missing:
      - "Guard t/d/gaps as arrays and params as a non-null object before any iteration in both advanceSteps and detectUnreliableSegments; guard span in mapGapToIndices; add regression tests for null/non-array gaps, null params, a [null] gap entry, and null t/d (the existing 'total function' describe block only covers field-level malformation: NaN/Infinity/negative on an otherwise well-shaped object)"
  - truth: "Self-execution / import-time side-effect guards genuinely demonstrate the generator scripts perform no disk I/O at import time (32-05/32-06-PLAN.md behavior: 'module import triggers no disk read')"
    status: failed
    reason: "Both guards do vi.spyOn(fs, 'readFileSync') on the default fs namespace object, then dynamic-import a script that consumes fs via a NAMED import (import { readFileSync } from 'fs'). Node's ESM/CJS builtin interop binds the name at resolution, so replacing the property on the namespace object never intercepts the real call. Reproduced with a control probe module that DOES read a file at import time via a named import, behind the identical spy+cache-bust pattern: the probe read the file (content confirmed) while the spy recorded 0 calls. expect(spy).not.toHaveBeenCalled() therefore cannot fail under any script behavior — the guard is structurally vacuous, not merely untested for a red case."
    artifacts:
      - path: "scripts/compute-unreliable-segment-recount.test.mjs"
        issue: "Vacuous guard in the 'import-time side effects' describe block (~line 525-534); confirmed present verbatim during this verification"
      - path: "scripts/compute-unreliable-segment-calibration.test.mjs"
        issue: "Vacuous guard, same pattern (~line 1232-1247)"
    missing:
      - "Replace the fs-namespace spy with a probe that can actually observe the named-import call (e.g. a child-process instrumented require, or asserting on process.argv[1]-driven main() behavior instead of import), and add a watched-failing companion case using a synthetic module that reads at import time, mirroring pace-single-source.test.ts's proven both-directions discipline"
  - truth: "D-06/D-07 touching/adjacency rule is applied with one consistent boundary definition, so a segment's mechanism label and conserved metres/seconds do not depend on incidental duplicate timestamps at a gap boundary"
    status: failed
    reason: "mapGapToIndices picks gi = the LAST index at span.startSec and gj = the FIRST index at span.endSec, while isGapPair's own inclusive test (g.startSec <= t[i] && t[i+1] <= g.endSec) treats the duplicate-timestamp pair itself as a gap pair, discarding it from advanceSteps. The two definitions disagree whenever a duplicate timestamp sits exactly on a gap boundary. Independently reproduced against dist: {t:[0,1,1,13], d:[0,20,20,21], gaps:[{startSec:1,endSec:13}]} classifies as one isolated-jump segment (20m/1s, gapCount 0); the same activity without the duplicate sample ({t:[0,1,13], d:[0,20,21]}) classifies as one gap-adjacent segment (21m/13s, gapCount 1) merging the same burst and gap. The gap's own distance/time is silently dropped from the segment in the duplicate-timestamp case — a direct violation of the phase goal's 'segments that conserve real distance/time'. 72 of the 1,874 committed streams already carry duplicate timestamps (validateStreamSeries explicitly documents these as valid input); none currently sits exactly on a gap boundary, so this is latent on today's committed archive and does not currently misclassify any committed stream, including 3475724402 (whose recount still agrees row-for-row)."
    artifacts:
      - path: "src/analytics/unreliable-segments.ts"
        issue: "mapGapToIndices and isGapPair use inconsistent boundary-index conventions (~line 199-206 vs ~351-379)"
    missing:
      - "Align mapGapToIndices with isGapPair's own inclusive bounds (first index at startSec, last index at endSec); add both reproduced fixtures above as permanent regression tests in unreliable-segments.test.ts"
human_verification: []
---

# Phase 32: Unreliable-Segment Detection & Calibration Verification Report

**Phase Goal:** One calibrated detector merges gap-adjacent slew bursts, hidden-pause bursts and
isolated GPS jumps into segments that conserve real distance/time, and becomes the single source.
**Verified:** 2026-09-20T13:10:05Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/SEG-02: 3475724402 — every burst gap-adjacent, matches an independently derived per-segment table | ✓ VERIFIED | `npm run compute-unreliable-segment-recount` exits 0, PASS, 16 rows (orchestrator + re-run during this verification, `scripts/unreliable-segment-recount-crosscheck.test.mjs` 4/4 pass, `-t "3475724402"` matches 4 tests, all green) |
| 2 | SC2/SEG-03: 3475734189 hidden-pause burst flagged at t=1353–1360 | ✓ VERIFIED | `src/analytics/unreliable-segments.test.ts -t "mechanism"` → 12 matched, pass; 32-CALIBRATION.md § D-10(d) check shows the hidden-pause window admitted, 122.7 m excess |
| 3 | SC3/SEG-03: 3475740390 five isolated jumps flagged, incl. t=2508, t=2580/2587 as distinct segments | ✓ VERIFIED | Same `-t "mechanism"` run; 32-CALIBRATION.md § D-10(d) check shows all five jumps admitted with individual excess values |
| 4 | SC4/SEG-04: committed, regenerable calibration artifact states the calibrated constant(s), a non-circularity argument, and the Suunto (4556693525) disposition | ✓ VERIFIED (see WARNING below) | 32-CALIBRATION.md contains all 18 generated sections incl. `## Chosen constants`, `## Non-circularity (D-13)`, `## Suunto over-measurement disposition`; regenerates byte-identically (orchestrator-confirmed); shipped constants UNRELIABLE_SPEED_LIMIT_MPS=7.35, UNRELIABLE_EXCESS_FLOOR_M=3.0, HIDDEN_PAUSE_MIN_METRES=116.95 match the artifact's "shipped equal" column. **Caveat:** the B (hidden-pause boundary) derivation's `findValley` function is proven unsound (CR-04, reproduced below) — it can only ever manufacture a valley from out-of-interval histogram mass, never suppress one. Today's real archive happens to produce `valleyFound: false` on both the pre- and post-merge (32-09) runs, so the shipped 116.95 (the honest midpoint fallback) is unaffected today, but the "non-circular, measured" claim rests on a function that is not sound in general. Not scored as a failure because the shipped value and artifact statement are both currently correct. |
| 5 | SC5/SEG-05a: single-source audit extended to the detector, demonstrated catching a planted second implementation both in-suite and against the real tree | ✓ VERIFIED | `pace-single-source.test.ts -t "SEG-05a"` → 7 matched, pass (≥ 6 required); planted-both-directions blocks present for all 4 planted files; 32-04-SUMMARY.md real-tree red-then-green sequence present |
| 6 | The detector's never-throws / total-function contract (T-26-01) holds for malformed gaps/params/t/d | ✗ FAILED | See gaps frontmatter — reproduced directly against `dist/analytics/unreliable-segments.js` |
| 7 | Self-execution/import-time-side-effect guards genuinely test "no disk read at import" | ✗ FAILED | Guard is structurally vacuous (`vi.spyOn(fs,...)` cannot see a named-import call); reproduced with a control probe |
| 8 | D-06/D-07 touching/adjacency rule applies one consistent boundary definition regardless of duplicate timestamps, so conservation holds unconditionally | ✗ FAILED | `mapGapToIndices` vs `isGapPair` boundary-index mismatch, reproduced directly; latent on the committed archive today |

**Score:** 5/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/unreliable-segments.ts` | Pure detector, total function, 3 mechanisms, calibrated constants | ⚠️ VERIFIED WITH DEFECTS | Exists, substantive, wired into recount/calibration/1Hz-validation and the SEG-05a audit. Two of the three "total function"/adjacency guarantees it documents are false (CR-02, CR-01) |
| `scripts/compute-unreliable-segment-recount.mjs` | Independent gap-first recount, zero-import, fails closed | ✓ VERIFIED | Zero-import guard passes; recount PASSES against the live 16-row artifact table; was watched failing against a deliberately broken detector (32-07 T2, orchestrator-confirmed) |
| `scripts/compute-unreliable-segment-calibration.mjs` | Reachability, negative-control candidates, statistics, constant derivation, figures of record | ⚠️ VERIFIED WITH DEFECTS | Regenerates byte-identically; `findValley` (D-08) is unsound in general (CR-04); `parseDecisionText` (D-05 fixtures) fails to validate parsed spans (CR-06, latent — today's real Decision line parses correctly, confirmed by direct execution) |
| `.planning/phases/.../32-CALIBRATION.md` | Committed artifact of record, all sections | ✓ VERIFIED | All 18 generated headings present; idempotent |
| `src/analytics/pace-single-source.test.ts` (SEG-05a extension) | Detector containment scans, non-vacuous, planted proofs both directions | ✓ VERIFIED | 7 matched `-t "SEG-05a"` tests pass; distinct mechanism from the vacuous fs-spy guards (reads real source text) |
| `src/analytics/unreliable-segments.test.ts` (32-08 fixtures) | Real-stream named-activity regression tests | ✓ VERIFIED | `-t "3475724402"` → 4 matched; `-t "mechanism"` → 12 matched; all green |
| `scripts/unreliable-segment-recount-crosscheck.test.mjs` | npm-test-time detector-vs-recount agreement | ✓ VERIFIED | 4/4 tests pass, incl. watched-failing sub-test |
| `scripts/validate-unreliable-segments-1hz.mjs` | Local-only 1Hz validation, graceful absence | ⚠️ VERIFIED WITH DEFECT | `existsSync` graceful-absence path confirmed by design; `buildActivityFinding` throws on a missing/unparseable stream despite a documented "never throws" contract (CR-03, not independently re-reproduced this session; local-only, not in CI/npm test, lower blast radius) |
| `scripts/compute-stream-checksums.mjs` + `.test.mjs` | D-17 append-only manifest gate, watched failing | ✓ VERIFIED | Orchestrator-confirmed: append-only refusal, isStreamFile ownership, tolerated-new-file behaviour all sound per code review |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `unreliable-segments.ts` | `best-effort-utils.ts` | `validateStreamSeries` import | WIRED | Confirmed in source |
| `compute-unreliable-segment-recount.mjs` | `32-CALIBRATION.md` | `parseCalibrationArtifact` | WIRED | `node scripts/compute-unreliable-segment-recount.mjs` exits 0, PASS |
| `compute-unreliable-segment-calibration.mjs` | `dist/analytics/unreliable-segments.js` | detector import for calibration | WIRED | Confirmed; generator regenerates byte-identically |
| `unreliable-segment-recount-crosscheck.test.mjs` | `compute-unreliable-segment-recount.mjs` | imports both sides for nightly agreement | WIRED | 4/4 tests pass |
| `pace-single-source.test.ts` | `unreliable-segments.ts` | containment/importer scan | WIRED | Non-vacuous, 7 SEG-05a tests pass |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SEG-01 | 32-02, 32-08 | Detector judges maximal runs, folds decimation aliasing, catches diluted slews | ✓ SATISFIED (with defect) | Mechanics tests pass; total-function contract (part of SEG-01's own module) is false for malformed input (gap #1) |
| SEG-02 | 32-03, 32-07, 32-08 | Gap-adjacent merging with independent recount agreement | ✓ SATISFIED (with latent defect) | Recount passes on 3475724402; D-06/D-07 boundary inconsistency (gap #3) is latent but real |
| SEG-03 | 32-08 | Hidden-pause and isolated-jump mechanisms on named activities | ✓ SATISFIED | Both fixture tests pass with independently-derived extents |
| SEG-04 | 32-05, 32-06, 32-07, 32-09 | Calibrated, regenerable, non-circular artifact with Suunto disposition | ✓ SATISFIED (with soundness caveat) | Artifact complete and idempotent; D-08's derivation tool (`findValley`) is unsound in general (CR-04) though currently inert |
| SEG-05a | 32-04 | Single-source audit extended to detector, planted proofs both directions | ✓ SATISFIED | 7 matched tests, real-tree red-then-green sequence recorded |
| SEG-05 (split carrier, 32-01) | 32-01 | Amendment/split bookkeeping only, never ticked | ✓ SATISFIED | REQUIREMENTS.md carries SEG-05a/SEG-05b rows, no unsplit SEG-05 row remains |
| SEG-05b | *(deferred to Phases 33/35/36 by design)* | Every consumer reads the detector | — NOT EXPECTED HERE | Correctly left Pending in REQUIREMENTS.md traceability table; not claimed by any Phase 32 plan |

No orphaned requirements: every ID in REQUIREMENTS.md's Phase 32 traceability rows (SEG-01, SEG-02, SEG-03, SEG-04, SEG-05a) is claimed by at least one plan's `requirements:` frontmatter field, and no plan claims an ID absent from REQUIREMENTS.md.

### Anti-Patterns Found

(Full detail in `32-REVIEW.md`, independently re-confirmed for CR-01, CR-02, CR-04, CR-05 during this verification; CR-06's premise confirmed as a real parser defect but not currently manifesting against the committed `32-05-SUMMARY.md`.)

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/analytics/unreliable-segments.ts` | ~240-388 | Throws instead of failing closed on null/non-array gaps, params, t, d | 🛑 Blocker | Falsifies the documented "never throws" contract; reachable from untyped `.mjs` callers reading JSON off disk |
| `scripts/compute-unreliable-segment-recount.test.mjs`, `scripts/compute-unreliable-segment-calibration.test.mjs` | ~525-534, ~1232-1247 | `vi.spyOn(fs, 'readFileSync')` cannot observe a named-import call — guard is structurally vacuous | 🛑 Blocker | The claimed proof of "no disk I/O at import" is not a real test; green today for an untestable reason |
| `src/analytics/unreliable-segments.ts` | ~199-206, ~351-379 | `mapGapToIndices` and `isGapPair` use inconsistent boundary-index conventions on duplicate timestamps | 🛑 Blocker (latent) | Can silently reclassify gap-adjacent as isolated-jump and drop conserved metres/seconds; 72/1874 streams already carry duplicate timestamps, none yet on a gap boundary |
| `scripts/compute-unreliable-segment-calibration.mjs` | ~1070-1111 | `findValley` counts histogram mass outside the anchor interval, can only manufacture (never suppress) a valley | ⚠️ Warning | Shipped `HIDDEN_PAUSE_MIN_METRES` unaffected today (`valleyFound: false` both pre- and post-merge); derivation is unsound in general |
| `scripts/compute-unreliable-segment-calibration.mjs` | ~751-755 | `parseDecisionText` splits `fixtures:` spans without validating the parsed numbers (e.g., an en-dash silently yields `NaN`) | ⚠️ Warning | Latent — the real `32-05-SUMMARY.md` fixtures line parses correctly (confirmed: `7409028052:586-624`, `3647739864:945-971`, plain hyphens) |
| `scripts/validate-unreliable-segments-1hz.mjs` | ~262-281 | `buildActivityFinding` throws on a missing/unparseable stream despite a "never throws" docblock | ⚠️ Warning | Local-only script, not wired into CI/npm test; lower blast radius |
| `src/analytics/pace-single-source.test.ts` | ~349-356 | Detector-importer confinement needles are single-quote-only | ⚠️ Warning | A double-quoted or backtick import specifier would evade the SEG-05a scan |
| `src/analytics/unreliable-segments.test.ts` | ~603-622 | D-05 negative-control fixtures assert only `[]`, no reachability/non-vacuity check | ⚠️ Warning | `7409028052` is reported "one segment away" from a control that cannot fail |
| `scripts/compute-unreliable-segment-calibration.mjs` | ~1131-1144 | `namedItemSegmentMetres` takes the first overlapping segment, never flags ambiguous overlap | ⚠️ Warning | Feeds directly into the D-08 anchor interval |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers were found in the files modified by this phase.

### Human Verification Required

None. Every truth in this report resolves from direct code execution or grep evidence; no visual, real-time, or subjective-quality judgment is required.

### Gaps Summary

Three findings falsify explicit must_have claims from this phase's own plans, independently reproduced
during this verification against the actual shipped `dist/` build and committed test files (not
inferred from `32-REVIEW.md` alone):

1. **The "never throws" total-function contract is false.** `detectUnreliableSegments` and
   `advanceSteps` throw on null/non-array `gaps`, `null` `params`, and a `[null]` gap entry — all
   reachable from the untyped `.mjs` scripts that parse this data straight off disk. This is an
   explicit must_have truth in 32-02-PLAN.md's frontmatter, phrased as "returns a fresh empty array
   and never throws," and it is not true.
2. **The "module import triggers no disk read" guards cannot fail.** Both self-execution proofs use
   `vi.spyOn(fs, 'readFileSync')` against scripts that consume `fs` via named imports, which Node's
   module interop makes unobservable to that spy. A control probe (a module that genuinely reads at
   import time) still recorded zero spy calls. The guard is green for a reason that has nothing to do
   with the scripts' actual behavior.
3. **The gap-touching/adjacency rule uses two disagreeing boundary conventions.** `mapGapToIndices`
   and `isGapPair` pick opposite duplicate-timestamp indices as a gap's boundary sample, so a
   duplicate timestamp exactly on a gap boundary silently turns a gap-adjacent segment into an
   isolated-jump one and drops the gap's own metres/seconds from the segment — a direct violation of
   the phase goal's "conserve real distance/time." This is latent on the current 1,874-stream archive
   (72 streams already carry duplicate timestamps; none yet lands on a gap boundary), but it is a real,
   reproducible defect in shipped code that will become this phase's single source of truth for
   Phases 33/35/36.

All three are grouped by one root cause: **the "watched failing" / "shown never throws" / "proven"
discipline this phase's own conventions require was not applied uniformly** — some guards
(SEG-05a's containment scans, the D-15 recount's broken-detector demonstration, the D-13
strawman-insensitivity checks) are genuinely proven both directions; others (the fs-spy import
guards, the total-function coverage, the gap-boundary index convention) were asserted as tested but
are not. A green `npm test` (90 files / 2,788 tests) and a clean `tsc --noEmit` do not detect any of
the three, because the defects are either in an untested input shape (gaps #1, #3) or in a test that
cannot detect its own subject (gap #2).

Five roadmap Success Criteria (SC1-SC5 / SEG-01 through SEG-05a) are otherwise genuinely achieved:
the detector, recount, calibration artifact, and SEG-05a audit all do what they claim on the
committed archive and named fixtures today. SEG-05b is correctly out of scope for this phase.

---

_Verified: 2026-09-20T13:10:05Z_
_Verifier: Claude (gsd-verifier)_
