---
phase: 34-pause-classification-forgotten-stop
verified: 2026-09-23T13:35:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/4
  gaps_closed:
    - "R3 — 6286234101's Pauses section judged by a human on the shipped post-34-16 build (three rows, 5866-5922 labelled Walked); verifier reproduced all three rendered rows digit-for-digit from the shipped shard plus the shipped renderer"
    - "R4 — 3475740390's not-classifiable clause judged by a human on the shipped build; verifier reproduced the exact rendered string from the shipped index row plus the shipped renderer"
    - "Validation Approval line re-signed 2026-09-23 naming the post-34-16 build, superseding (not overwriting) the post-34-15 line"
    - "Info 1 — the WALK_RUN_BOUNDARY_MPS provenance docblock's 1-walked/17-ran-through misstatement corrected at the source of record; the 'no generator change needed' claim independently confirmed"
  gaps_remaining: []
  regressions: []
human_verification: []
deferred: []
---

# Phase 34: Pause Classification & Forgotten-Stop — Verification Report

**Phase Goal:** Every gap and merged unreliable segment is classified by implied speed (stationary / walked / ran-through / transported) on every gap-bearing interval, and sustained near-zero speed inside recorded, timer-running time is flagged as a possible forgotten stop — both disclosed on the detail view, neither correcting moving time, pace or best efforts.
**Verified:** 2026-09-23T09:06:45Z (initial) · **Re-verified:** 2026-09-23T13:35:00Z (closure round)
**Status:** passed
**Re-verification:** Yes — after closure of the three human-verification items raised by the initial run

This verification was run goal-backward against the codebase and the committed data. Every
figure below was re-derived by this verifier by running the code, not read out of a SUMMARY.
The working tree was clean before and after both rounds (`git status --porcelain` empty each time).

---

## Re-Verification Round (2026-09-23, HEAD `10c9e453`)

The initial run (2026-09-23T09:06:45Z, commit `33207897`) returned `human_needed` at 4/4 truths
verified: the code was sound, but two rendered-surface checkpoint verdicts (R3, R4) had been
collected against builds that no longer existed, and the Validation Approval line predated plan
34-16. Two Info items were also recorded. Every one of those is re-checked below **against the
codebase, not against the closure commits' own narration**.

### What the closure round actually changed

`git diff --stat 33207897 HEAD` — five files, 84 insertions, 8 deletions:

| File | Nature of change |
|---|---|
| `34-VALIDATION.md` | +55/-3 — new Re-check Note, two appended verdict cells, new Approval line |
| `34-CONTEXT.md` | +14 — dated correction bullet appended to D-21 |
| `34-06-SUMMARY.md` | +2 — dated correction paragraph |
| `34-07-SUMMARY.md` | +2 — dated closure annotation |
| `src/analytics/pause-classification.ts` | +11/-5 — **docblock comment only** |

`.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`: **zero diff** across `33207897..HEAD`
(`git diff 33207897 HEAD -- <path>` empty for both). No requirement was ticked, unticked or
re-worded by the closure round.

### Closure item 1 — R3, 6286234101's Pauses section

**VERIFIED, and independently reproduced rather than accepted.** I did not take the developer's
paste on trust. I read the shipped shard `data/stats/pace-quality/6286234101.json` and ran its three
`pauseIntervals` entries through the shipped renderer's own formatting rules
(`pausesSectionPlan`, `detail-sections.ts:2018-2023`: `formatEffortDuration(startSec)` + `km
${(startMetres/1000).toFixed(2)}`, `Math.round(metres)` for distance, and
`pausesSectionRowClassText` at `:1960-1980`):

| Shard entry | Derived `atText` | Derived `classText` | Derived duration | Derived distance |
|---|---|---|---|---|
| `covered-creep` walked 5866→5922, 56 s, 35.600 m, startMetres 17151.6 | `1:37:46 · km 17.15` | `Walked — possible forgotten stop (timer running)` | `0:56` | `36 m` |
| `recording-gap` walked 6225→6236, 11 s, 13.200 m, startMetres 17528.0 | `1:43:45 · km 17.53` | `Walked` | `0:11` | `13 m` |
| `covered-creep` stationary 6236→6313, 77 s, 26.700 m, startMetres 17541.2 | `1:43:56 · km 17.54` | `Stationary — possible forgotten stop (timer running)` | `1:17` | `27 m` |

This is the developer's paste **character for character**, including the `km` figures and the
rounded metres — three rows, not four. The paste is therefore not a recollection; it is what this
code produces from this data.

The two substantive claims behind R3 both hold on my own derivation:
- **Neither flagged row intersects the gated control window.** The window is t=5289–5696
  (1:28:09–1:34:56). The two `covered-creep` rows sit at 5866–5922 and 6236–6313 — both strictly
  after 5696. R3's own claim is intact.
- **The two classes are derived from their own numbers, not hardcoded.** 35.6 m / 56 s = 0.6357 m/s
  → `walked` (above the 0.5 m/s stationary bound); 26.7 m / 77 s = 0.3468 m/s → `stationary`. The
  developer's ≈0.643 / ≈0.351 are the same quantities computed from the *rendered* rounded metres
  (36/56, 27/77) — a 0.7 % and 1.1 % difference that changes no class. This is the WR-01 fix
  working: before it, the merged union's label was hardcoded `Stationary`.

`signals.forgottenStop` on the same shard reads `count 2, totalSec 133, longestSec 77` — the
post-D-22 numbers, matching the independent oracle exactly as established in the initial round.

### Closure item 2 — R4, 3475740390's summary row

**VERIFIED, and independently reproduced.** I read the live index row from
`data/dashboard/index.json`: `pauseClassification = {intervalCount 5, stationary 0, walked 5,
ranThrough 0, transported 0, notClassifiableCount 5}`, and `forgottenStop = {computable: false,
reason: "distance-triggered recording: a standstill would be written as a recording gap, not a
covered creep, so the forgotten-stop flag cannot see it", all numeric fields null}`. Fed through
`detail-sections.ts:1583` (`` ` (${pc.notClassifiableCount} not-classifiable — see Unreliable
segments)` ``), `:1595` and `:1604`, this renders exactly the developer's pasted string. The
superseded 34-15 wording `isolated-jump/hidden-pause` appears **0** times in the served bundle
`dist/widgets/assets/index-BKPMOQAp.js`; the new wording appears once. The open cosmetic item R4
carried since 34-15 is genuinely closed, not merely re-labelled.

### Closure item 3 — the Validation sign-off

**VERIFIED, and it supersedes rather than overwrites.** Checked structurally, not by reading the
commit message:

- All three Re-check Notes survive in order (lines 89, 141, 222) — the 34-15 D-22 note, the 34-16
  code-review note, and the new post-34-16 human re-check note. Nothing was deleted.
- The R3, R4 and R9 verdict cells were **appended to**, not rewritten. The full pre-34-15 R3 text
  (including the four-row paste `1:37:46 (0:49), 1:37:57 (0:45), …` that exposed D-22) and the full
  post-34-15 R4 text (including the retired `isolated-jump/hidden-pause` quote and its OPEN COSMETIC
  ITEM note) are still legible in the file, each now carrying a trailing
  `**RE-CONFIRMED PASS post-34-16 (2026-09-23)**` clause. The history of what was judged against
  which build is fully recoverable.
- Both Approval lines are present (lines 310 and 312). The new one is explicitly scoped —
  "superseding the above for R3/R4/R9 only" — and names the build (`16250d75...`). The old line is
  untouched.
- The new note's R9 paragraph correctly declines to invent a human check for a machine-checkable
  equality claim and cites this verifier's own re-derivation. That attribution is accurate: I
  re-derived the equality in both rounds.

### Closure item 4 — Info 1, the walk/run provenance prose

**VERIFIED — and the executor's convenient-sounding "the generator never said it" claim is TRUE.**
This was the one claim the closure round most plausibly could have used to avoid work, so I checked
it directly rather than reasoning about it:

- `grep -n -i "every one of|18 merged|none classify|all 18|18 gap-bearing"` against
  `34-CALIBRATION.md` and `scripts/compute-pause-classification-calibration.mjs`: **zero matches in
  either.** The artifact's only D-21 narrative is line 206, a computed sentence about the valley
  premise ("the valley rule's picked bin (6.95 m/s…) sits away from the modal bin (3.05 m/s…)") —
  it makes no claim about 3475724402's class distribution at all.
- The artifact's per-interval class table (lines 214–233) renders row 12 as
  `| 12 | recording-gap | 3364 | 3388 | 24 | 46.3 | 1.929 | walked |` and has always done so. The
  generated output was never wrong.
- Regenerated at HEAD: `34-CALIBRATION.md` sha256 `e40aeaca…` before and `e40aeaca…` after, tree
  clean. The docblock edit changed nothing generated.

**Correction to this report's own initial round.** The initial Anti-Patterns row asserted that the
over-generalised sentence "appears in `34-CONTEXT.md` D-21 **and in `34-CALIBRATION.md`'s D-21
narrative**." The second half of that was wrong — I did not check the artifact closely enough before
asserting it. The row is amended in the Anti-Patterns table below. The executor's narrower claim is
the accurate one.

The correction itself is real and lands at the source of record:
`src/analytics/pause-classification.ts:159-175` now reads "17 of 3475724402's 18 gap-bearing
intervals … classify `ran-through`; the 18th (`recording-gap`, t=3364-3388, 1.929 m/s) classifies
`walked`", names the over-generalisation, and dates the correction. `34-CONTEXT.md` D-21 carries a
dated correction bullet that explicitly leaves the decision (2.2 m/s) unaffected. `34-06-SUMMARY.md`
(which held the original wrong paragraph) and `34-07-SUMMARY.md` (which had flagged the discrepancy
and asked for closure) are both annotated. Re-running
`scripts/compute-pause-classification-recount.mjs` at HEAD prints `walked=1 ran-through=17
stationary=0 transported=0 outOfScope(zero-advance-pause)=0` and `PASS`, exit 0 — confirming the
corrected text and refuting the old.

One residual, Info-level and unchanged in severity, is recorded in the Anti-Patterns table below:
`34-CONTEXT.md:42`'s pre-phase scoping-probe table still reads
`| 3475724402's 18 merged intervals | 18 | 2.31–4.06 m/s |`, a range that excludes row 12's
1.929 m/s. That row is the *origin* of the over-generalisation and was not corrected. It is a
pre-implementation scoping table, not a claim about shipped behaviour, and D-21 immediately below it
now carries the correction — so it does not block.

### Closure item 5 — Info 2, the requirement-tick ordering

**Disposition: stays a recorded observation. It does not warrant a gap.** I tested the specific
question — did the ordering leave anything untrue in the record? — rather than restating the
timeline:

- The six ticks in `.planning/REQUIREMENTS.md` are the amended requirement texts plus `- [x]`. Their
  truth value **today** is correct: CR-01 and CR-02 are fixed in the source (re-read this round), the
  suite is green, and every mapped checkpoint row now carries a verdict collected on the shipped
  build. Nothing currently asserted in REQUIREMENTS.md is false.
- The tick's stated basis is narrowly scoped and survives scrutiny. `34-11-SUMMARY.md` records the
  rule used — "read the Requirement column mechanically (… STOP-01←R3,R4,R5 …)" — and the claim "no
  requirement's amended text is contradicted by its mapped rows or the automated evidence." That
  claim is about the mapped rows and the automated suite, both of which were genuinely clean at
  09:54. It does not claim a code review had been done. It is narrowly true as written, which is why
  the ordering produced a premature tick without producing a false statement.
- The chain is fully traceable in the record: `34-REVIEW.md` (10:07) found CR-01/CR-02, `34-16`
  (10:52) fixed both with named regression tests, and both are cited in this report's Judgement 7.
- The one dependency the ordering did create — 34-11's tick leaning on a "post-fix row count (3)"
  that at the time came from `34-15-SUMMARY.md` rather than from a human's eyes — is exactly what
  closure item 1 has now discharged with a human verdict and my own re-derivation.

So the end state is sound and the record is complete. What remains is a process observation, and
the project already carries it as a recorded failure mode ("requirements ticked before review/verify
run"). Recorded below, not raised to a gap.

### Closure-round regression checks

| Check | Result | Status |
|---|---|---|
| Full suite at HEAD | `npm test` → 98 files, **3499 passed**, 0 failures | ✓ PASS |
| Type check at HEAD | `npx tsc --noEmit` → exit 0, no output | ✓ PASS |
| Served digest == freshly built digest | `shasum -a 256 data/dashboard/index.json dist/widgets/data/dashboard/index.json` → both `16250d75fac18b97ff06fc912208610330d887425d7120800e7359ed376c2557` | ✓ PASS |
| Served bundle still matches source at HEAD | `index.html` references `assets/index-BKPMOQAp.js`; the only source change since the build is comment-only (every `+`/`-` line in `git show 10c9e453 -- src/` is inside a `/** */` block), and the bundle is comment-stripped (`developer-declared`, `Disclosed consequence`, `gap-bearing intervals` all appear **0** times in it) | ✓ PASS — no stale-build trap |
| Calibration artifact idempotent at HEAD | `e40aeaca…` → `e40aeaca…`, tree clean | ✓ PASS |
| Independent recount at HEAD | exit 0, `PASS`, `walked=1 ran-through=17` | ✓ PASS |
| Debt markers in phase-modified production files | `TBD`/`FIXME`/`XXX` → none | ✓ PASS |
| Requirements untouched by closure | `git diff 33207897 HEAD -- .planning/REQUIREMENTS.md` empty | ✓ PASS |
| Phase checkbox still unticked | `ROADMAP.md:111` reads `- [ ] **Phase 34: …**`; progress table row 34 reads `In Progress` with an empty completion-date cell; `STATE.md` `status: executing` | ✓ PASS — orchestrator's tick is still outstanding, as it should be |
| Judgement 5's limit unchanged | `pause-classification.test.ts:728` still reads `SCAN_ACTIVITIES = ['6286234101', '3475715143']` | ✓ CONFIRMED STILL TWO ACTIVITIES — carried forward below |

**No regressions.** All three human items closed, both Info items resolved to a disposition, all
four truths still verified.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, as amended)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3475724402's gap-bearing intervals are classified from their own merged distance and elapsed time, under bands recorded in a regenerable artifact carrying its own non-circularity argument, and the per-segment classes agree with an independent table produced outside the classifier | ✓ VERIFIED | Ran `node scripts/compute-pause-classification-recount.mjs` (zero-import of the classifier/detector) — exit 0, `PASS: recount agrees with the calibration artifact's class table`. Its 18 rows match `data/stats/pace-quality/3475724402.json`'s `pauseIntervals` value-for-value (I diffed source/seconds/metres/class myself): 16 `merged-segment` + 2 `recording-gap`, 17 `ran-through` + 1 `walked` (row 12, t=3364-3388, 1.929 m/s). `34-CALIBRATION.md` regenerated byte-identical (sha256 `e40aeaca…` before and after `npm run compute-pause-classification-calibration`; re-confirmed at HEAD in the closure round) and carries `## Non-circularity`, `## Rejected on argument`, `## Strawmen watched failing`, provenance lines per constant. |
| 2 | The detail view lists each pause with class, duration and distance; the per-activity summary is an additive index key with per-interval detail in the lazy quality shard | ✓ VERIFIED | `buildPausesSection` (`detail-sections.ts:2048`) renders an `At / Class / Duration / Distance` table via `textContent` only; mounted at `detail.ts:612` (`pausesContainer.replaceChildren(buildPausesSection(pausesSectionPlan(paceQualityShard, quality)))`). `data/dashboard/index.json` carries `pauseClassification` + `forgottenStop` on 1874 of 1899 quality rows (additive — every pre-Phase-34 key intact). `data/stats/pace-quality/<id>.json` carries `pauseIntervals` (18 entries for 3475724402). **Closure round:** the rendered output of this path is now human-confirmed on the shipped build for both 6286234101 (three rows) and 3475740390 (summary clause), and I re-derived both renderings from shard/index data through the shipped formatting rules. |
| 3 | v2.2's "9 activities advance >100 m across a ≥30 s gap" figure is re-measured on merged segments and the corrected figure recorded with dated provenance in a regenerable artifact | ✓ VERIFIED | `34-PAUSE03-REMEASUREMENT.md`: merged rule **22 activities** vs old rule **13**, side by side, with the 9-vs-13 discrepancy reconciled honestly rather than asserted equal. Re-ran `npm run compute-pause-transport-remeasurement` — byte-identical (sha256 `964afdf5…`). `.planning/milestones/v2.2-REQUIREMENTS.md:165` carries the dated forward pointer (`*Superseded 2026-09-22 by v2.3 PAUSE-03 …*`), confirmed present. |
| 4 | A forgotten-stop flag (count, total seconds, longest stretch) is computed per activity, itemised by source, disclosed on the detail view, structurally excluded from the severe composite, and no walking-break control is flagged for its walking pace — asserted against an independent value | ✓ VERIFIED | `hasAnySevereSignal` takes `Pick<…, 'decimation' \| 'gapProfile' \| 'impossibleSamples'>` (`pace-quality.ts:1778`) — type-level exclusion, plus the `anySevere excludes pauseClassification and forgottenStop` guard test feeding deliberately "severe-looking" values. The walking-break control property test runs live on all three confirmed controls at shipped params AND re-runs with `stationaryMaxMps` raised to each control's own parsed window aggregate speed, asserting at least one stretch must then intersect — genuinely two-directional, with the bound parsed from `34-WALKING-BREAK-EVIDENCE.md` at test time, never pinned. `npm test`: 3499/3499 green across 98 files (re-run at HEAD in the closure round). **Closure round:** R3's human verdict on the shipped build confirms both flagged rows fall outside the gated control window, which I re-derived from the shard (5866–5922 and 6236–6313, both after t=5696). |

**Score: 4/4 truths verified.**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pause-classification.ts` | Pure four-class classifier + forgotten-stop core | ✓ VERIFIED | 753 lines. `classifyPauseSpeed`, `collectPauseIntervals`, `joinUnreliableIntervals` (two-pointer, counts BOTH violation directions), `findCreepStretches` (D-22 union), `recordingMechanismSignature`, `classifyForgottenStop`. Transport rung uses the IMPORTED `UNRELIABLE_SPEED_LIMIT_MPS`, no literal. Closure round touched only its provenance docblock. |
| `src/analytics/pace-quality.ts` | 9th/10th untiered signals + capped shard projection | ✓ VERIFIED | `pauseClassificationSignal`, `forgottenStopSignal`, `projectPauseIntervals`, `SHARD_LIST_CAP = 100` exported as the one source. `buildPaceQualityShard` calls the classifier and the stop core exactly once each and shares the results. |
| `src/dashboard/data/pace-quality-client.ts` | All-or-nothing read-side parsers | ✓ VERIFIED | `parsePauseClassificationSignal` / `parseForgottenStopSignal` both invalidate the whole signal on a present-but-unparseable field (CR-01/WR-02 fixes read and confirmed in the source, not the summary). Read side honours `SHARD_LIST_CAP`. |
| `src/dashboard/views/detail-sections.ts` | Pauses section + Quality Signals summary row | ✓ VERIFIED | `pausesSectionPlan` has four kinds including IN-01's `'not-computable'`; `pausesSummaryRow` discloses `notClassifiableCount`; truncation text built from `SHARD_LIST_CAP`. Closure round: its `:1583`/`:1595`/`:1604`/`:1960-1980`/`:2018-2023` formatting rules were used to re-derive both human-verified renderings exactly. |
| `scripts/compute-pause-classification-calibration.mjs` | HALT-capable calibration generator | ✓ VERIFIED | Re-ran live in both rounds: 1874 streams, strawman G/M/W all FAIL first, M1 selected at 40 s, G and W rendered evidence-only. Artifact byte-identical. |
| `scripts/compute-pause-classification-recount.mjs` | D-18 zero-import independent class table | ✓ VERIFIED | Re-ran in both rounds: exit 0, PASS, `walked=1 ran-through=17`. Confirmed zero imports of the classifier/detector/pace-derivation in any spelling. |
| `scripts/compute-walking-break-evidence.mjs` | Zero-import oracle + control evidence | ✓ VERIFIED | Re-ran `--write`: `34-WALKING-BREAK-EVIDENCE.md` byte-identical (sha256 `86acdfbf…`). `localCreepWindows` is imported by the production test suite as the independent oracle. |
| `34-CALIBRATION.md` | Regenerable, evidence-carrying artifact | ✓ VERIFIED | Idempotent (verified by regeneration in both rounds). Carries drift measurement rows, valley histogram evidence, per-constant provenance lines, gates table, per-interval class table (row 12 = `walked`, correct throughout), archive-wide findings. |
| `.planning/todos/pending/2026-09-23-*` | Homes for 34-16's four deferred findings | ✓ VERIFIED | All four present: `pause03-generator-and-recount-hardening`, `validate-stream-series-null-safety-at-source`, `read-and-render-caps-for-shard-lists`, `not-classifiable-mechanism-breakdown-in-pauses-row`. |
| `34-VALIDATION.md` | Nine checkpoint rows, all judged on the shipped build, signed | ✓ VERIFIED (closure round) | Three Re-check Notes retained in order; R3/R4/R9 cells appended-to rather than rewritten with the superseded text still legible; second Approval line dated 2026-09-23 naming the post-34-16 build and scoped "superseding the above for R3/R4/R9 only". |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pause-classification.ts` | `pace-derivation.ts` (detector's merged output) | type + value imports, consumed in `collectPauseIntervals` | ✓ WIRED | SEG-05b's Phase 34 half; the classifier reads merged segments, never re-derives them. |
| `pace-quality.ts` | `pause-classification.ts` | `classifyPauses` / `classifyForgottenStop` at `buildPaceQualityShard` and the two signal functions | ✓ WIRED | Single call each, results shared with the projection. |
| `buildPaceQualityShard` | `data/stats/pace-quality/*.json` | `pauseIntervals` + `signals.pauseClassification/forgottenStop` | ✓ WIRED | Verified on disk for 3475724402 and 6286234101. |
| `data/dashboard/index.json` | list/detail views | `pace-quality-client.ts` parsers | ✓ WIRED | 1874 rows carry the two new keys; parsers exercised by tests; 3475740390's row re-read this round and its rendered clause re-derived from it. |
| `pausesSectionPlan` | `detail.ts` | `detail.ts:612` inside the post-first-paint mount | ✓ WIRED | Not orphaned. Closure round: a human read the output of this mount on the shipped build. |
| `hasAnySevereSignal` | `pauseClassification` / `forgottenStop` | `Pick<>` exclusion | ✓ DELIBERATELY NOT WIRED | STOP-03's structural exclusion; guard test watches a widening. |
| `src/` bundle | served build | `dist/widgets/assets/index-BKPMOQAp.js` | ✓ WIRED | Bundle contains `not-classifiable — see Unreliable segments`, `possible forgotten stop (timer running)`, `Showing the first 100 intervals`; the superseded `isolated-jump/hidden-pause` string appears **0** times. Re-confirmed at HEAD: the only source change since the build is comment-only, and the bundle carries no comment text. No stale-build trap. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Pauses section | `shard.pauseIntervals` | `projectPauseIntervals` ← `classifyPauses` + `findCreepStretches` | Yes — 18 real rows on 3475724402, 3 on 6286234101, all three of the latter now human-confirmed on screen and re-derived here | ✓ FLOWING |
| Quality Signals Pauses row | `quality.pauseClassification` / `forgottenStop` | index.json ← `buildPaceQualityShard` | Yes — 1874 activities carry classification; 455 carry a non-zero forgotten stop; 3475740390's not-computable row human-confirmed on screen and re-derived here | ✓ FLOWING |
| Creep row class cell | `classifyPauseSpeed(union.metres, union.seconds)` | WR-01 fix | Yes — 6286234101's two unions classify `walked` (0.6357 m/s) and `stationary` (0.3468 m/s) and now RENDER as two different labels on the shipped build, i.e. the class is derived, not hardcoded | ✓ FLOWING |
| Shipped constants | `34-CALIBRATION.md` `## Chosen constants` | ship-from-artifact equality test (numeric AND character-for-character against the source text) | Yes | ✓ FLOWING |

---

## Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Full suite green | `npm test` | 98 files, 3499 tests, 0 failures (both rounds) | ✓ PASS |
| Type check clean | `npx tsc --noEmit` | exit 0, no diagnostics (closure round) | ✓ PASS |
| Independent class recount agrees | `node scripts/compute-pause-classification-recount.mjs` | exit 0, `PASS`, `walked=1 ran-through=17` (both rounds) | ✓ PASS |
| Calibration artifact is regenerable and idempotent | `npm run compute-pause-classification-calibration` then `shasum -a 256` | `e40aeaca…` → `e40aeaca…`, tree clean (both rounds) | ✓ PASS |
| PAUSE-03 artifact idempotent | `npm run compute-pause-transport-remeasurement` | `964afdf5…` unchanged | ✓ PASS |
| Walking-break evidence idempotent | `npm run compute-walking-break-evidence` | `86acdfbf…` unchanged | ✓ PASS |
| R9 served == freshly built | `shasum -a 256 data/dashboard/index.json dist/widgets/data/dashboard/index.json` | both `16250d75fac18b97…` — equality holds in both rounds | ✓ PASS |
| **R3's rendered rows reproduced from shipped data** | Verifier read `data/stats/pace-quality/6286234101.json` and applied `detail-sections.ts`'s own formatting rules | All three rows reproduce the developer's paste character-for-character, incl. `km 17.15`/`km 17.53`/`km 17.54` and `36 m`/`13 m`/`27 m` | ✓ PASS — human verdict independently corroborated |
| **R4's rendered clause reproduced from shipped data** | Verifier read 3475740390's `data/dashboard/index.json` row and applied `detail-sections.ts:1583/1595/1604` | Reproduces the pasted string exactly, incl. the full D-10 not-computable reason | ✓ PASS — human verdict independently corroborated |
| **D-22 fix is two-directional on the REAL archive** | Verifier-written scratch script reimplementing the retired pre-34-15 merge rule against `data/streams/6286234101.json` via `dist/` | pre-fix rule → `5866-5915(49s) 5877-5922(45s) 6236-6313(77s)` = **count 3, total 171, longest 77**; shipped rule → `5866-5922(56s) 6236-6313(77s)` = **count 2, total 133, longest 77**, which equals the independent oracle exactly and equals the shipped shard's `forgottenStop` | ✓ PASS — defect independently reproduced and the fix independently confirmed |
| Live arbitration still selects M1 by arbitration | calibration run output | strawman M FAIL first; `M1: base=40 removedDelta=0 plantedDelta=0 pass=true`; `selected: M1` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no PLAN/SUMMARY in this phase declares
one. The phase's runnable equivalents are the four zero-import generators and the vitest suite; all
were executed by this verifier in its own process in both rounds, not quoted from a SUMMARY.

---

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| PAUSE-01 | 34-01/03/04/06/07/10/11/12/13/14/15/16 | ✓ SATISFIED **as amended** (see Judgement 2) | Four classes shipped; per-segment agreement with the D-18 recount proven live in both rounds; artifact regenerable with non-circularity argument and both dispositions' evidence. The original "calibrated bands" demand was replaced by "developer-declared" for two of three constants. |
| PAUSE-02 | 34-08/09/10/11/15/16 | ✓ SATISFIED | Pauses section + additive index key + lazy shard, all wired and carrying real data; the rendered output is now human-confirmed on the shipped build and re-derived here from the shipped data. |
| PAUSE-03 | 34-01/05/10/11 | ✓ SATISFIED | 22 vs 13, dated provenance, idempotent artifact, v2.2 forward pointer. |
| STOP-01 | 34-01/03/08/10/11/15/16 | ✓ SATISFIED | Two sources itemised (creep + zero-advance pause), recording gaps excluded, D-10 not-computable path with distinct reasons, D-22 union semantics verified to produce the oracle's own numbers. CR-01 (the one defect that made this requirement briefly untrue at its tick) is fixed with a dedicated reproduction test, read in the source. |
| STOP-02 | 34-02/04/06/10/11/12/13/14 | ✓ SATISFIED **as amended** | `FORGOTTEN_STOP_MIN_SEC = 40` genuinely selected by arbitration (re-reproduced live). Near-zero threshold developer-declared after the drift population measured degenerate. Walking-control property asserted two-directionally against an independent value; R3's shipped-build verdict confirms the control's window stays unflagged on screen. |
| STOP-03 | 34-08/09/10/11 | ✓ SATISFIED | `Pick<>` structural exclusion + never-widen guard; no pause/forgotten-stop badge spec. |
| SEG-05b | (cross-phase) | ✓ CORRECTLY PENDING | Still `- [ ]` in REQUIREMENTS.md and `Pending` in the traceability table, with Phase 34's own half recorded verbatim ("`pause-classification.ts` reads the detector's merged segments through `pace-derivation.ts`, proven load-bearing by plan 34-03 Task 3"). Re-ticks only after Phases 35 and 36. Untouched by the closure round. |

No orphaned requirements: every ID REQUIREMENTS.md maps to Phase 34 is claimed by at least one
plan's frontmatter.

---

## Adversarial Findings — the eight items this verification was asked to press on

*These judgements were reached in the initial round and are retained verbatim. The closure round
re-checked Judgement 5's stated limit (still true at HEAD) and closed Judgement 6; nothing in the
closure round weakens or supersedes Judgements 1–4, 7 or 8.*

### Judgement 1 — The four mid-phase requirement amendments

**Verdict: honest narrowings backed by measurement, with one clause that overreaches its own escape hatch.**

Evidence for honesty, none of which came from a SUMMARY:

- **`d12-anchor-ii` was pre-declared, not invented after the fact.** `git log -S "d12-anchor-ii" -- scripts/compute-pause-classification-calibration.mjs` returns exactly one commit: `9cf1a111 feat(34-04)`, the original generator, authored before any real-archive run. The gate that killed Family W's arbitrated 6.95 m/s was in the code before Family W had ever produced a number. This is the single most important fact against post-hoc rationalisation, and it holds.
- **Family M, the only constant still calibrated, was never retuned.** Its shapes were declared in `4e4bd09c feat(34-04)` and are untouched by 34-12/34-13/34-14 except for D-19's uniform planting-rule change. Re-running the generator today re-selects M1 at 40 s by arbitration, with strawman M failing first.
- **The declared values produced outcomes the phase did NOT want, and those were disclosed rather than hidden.** At 2.2 m/s, 3475724402 does not split between walked and ran-through — D-02's own expectation — and D-21 retires that expectation in writing. At 0.5 m/s, walking control 3475715143 IS flagged for a 42 s standstill, and the developer declined to lower the bound to suppress it. A value chosen to flatter the implementation would have been ~2.5 m/s (producing the predicted split) and <0.5 m/s (producing three clean controls). Neither was chosen.
- **The retired evidence is still in the artifact and still true.** HALT-2's figures (684 standstill episodes, 6 chained, 2.70 m total, G4/G5 base 0.029873, removedDelta 89.7455%, plantedDelta 3902.0881%/1561.8912%) and HALT-3's (W1 6.95 at n=2,612,365; modal bin [3.00,3.10) mass 852973; picked bin 6.95 mass 309) all re-render identically on a live regeneration.
- **HALT-1's contamination guard holds.** None of G1/G2/G3's measured values (`2.723333`, `1.655000`, `0.908333`, `2.6928%`, `5.1360%`, `10.1591%`) appears anywhere under `src/` or `scripts/`.
- **D-19's planting-rule change is justified by arithmetic, not by a measured value.** The archive holds 6056 judged gap-bearing intervals (5260+623+167+6 from the artifact's own findings line); Family G's population is 6. Planting |J| = 6056 items into a population of 6 is structurally unpassable whatever the statistic. The claim is verifiable and verified.

Where it overreaches: **STOP-02's "measured non-issue" escape hatch is about drift tolerance, not about whether the threshold is calibrated.** The original text reads "The near-zero threshold and minimum duration are calibrated against the archive, and the calibration artifact measures how much GPS drift-while-stationary actually exists… The detector tolerates drift if it is measured to matter; otherwise drift is recorded as a measured non-issue." D-20 reads the "otherwise" branch as excusing the *calibration of the threshold itself*, which is a wider reading than the sentence supports. The outcome is defensible — with 678 of 684 standstills at exactly zero advance, there is genuinely nothing to calibrate against — but the amendment's framing ("STOP-02's own text anticipates this outcome") is more comfortable than the text actually warrants. Recorded as a judgement, not a gap: the disposition is disclosed, dated, and the artifact keeps the evidence.

### Judgement 2 — Is the amended PAUSE-01 still a meaningful requirement?

**Plainly: it is materially weaker than it was, and two-thirds of its band content is now a human judgement with a loose bracket check. It is not hollow, but it is no longer the requirement that was written.**

What remains real and verified:
- The ran-through/transported boundary is still the *imported* `UNRELIABLE_SPEED_LIMIT_MPS = 7.35`, calibrated in Phase 32, with a source-scanning audit banning any local literal.
- The artifact is genuinely regenerable (byte-identical on re-run), carries the measurement rows that produced each disposition, and carries a per-constant provenance line that names "developer-declared (D-20/D-21)" rather than laundering it as calibrated.
- Both declarations have a live basis gate re-checked on every run, and both gates are two-directional: `d20-basis` fails if the declaration drops below the measured drift rate; `d21-basis` fails if the boundary is not strictly greater than every confirmed control's own window speed (max 1.797) AND strictly less than the covered-time modal bin centre (3.050).
- Criterion 1's substantive teeth — per-segment agreement with an independent, zero-import recount — survives intact and passes live.

What is gone:
- `d21-basis` brackets 2.2 inside a 1.253 m/s-wide window. Any value in [1.798, 3.049] passes. That is a sanity check, not a calibration.
- `d20-basis` is effectively one-sided: it only asserts `0.029873 < 0.5`. Any declaration above the drift rate passes.
- PAUSE-01's literal demand — "speed bands calibrated against the archive" — is met for zero of the two bands the phase itself was responsible for.

The honest summary is that PAUSE-01 as ticked certifies "two numbers a human chose, bracketed by measured evidence, with a re-runnable sanity check and a full paper trail." That is a reasonable engineering outcome after three HALTs, and it is disclosed everywhere. It is not what the requirement asked for, and the tick rests on a dated in-place amendment rather than on the original contract. A reader of the traceability table alone (`PAUSE-01 | Phase 34 | Complete`) would not learn this.

**Closure round: unchanged.** Nothing in the closure commits strengthens either band or narrows either basis gate. This judgement is carried forward below.

### Judgement 3 — The three HALTs

Evidence retained and re-verified: see Judgement 1. No shape was retuned after seeing a delta. Families G and W were *retired to evidence-only*, which is a different act from retuning — their rows are still rendered, still failing/passing exactly as measured, and explicitly marked "NOT ARBITRATED … no row here can select or influence a constant." D-19's planting-rule change is the one harness change made after seeing failures, and its justification is counting-only and independently checkable (see above). Verified.

### Judgement 4 — The two plan amendments (34-12, 34-14)

**34-12's planted-entry fix is non-vacuous on the real archive.** The invariant `planted n = base n + plants` holds on every episode-unit row in the live artifact: strawman G 5362+54=5416; strawman M 78895+789=79684; strawman W 794+54=848; G4 6+1=7. The per-activity shapes (G5, M1, M2, W1, W2) report n in activities, so the plant lands inside an activity's own population without changing the activity count — consistent, not a violation.

**34-14's replacements are two-directional on real numbers, not synthetic fixtures.** The three-control property test (`pause-classification.test.ts`, "across EVERY confirmed control (D-21)…") reads three real committed streams, runs `classifyForgottenStop` at shipped params (CAN PASS), then re-runs with `stationaryMaxMps` set to each control's own aggregate speed parsed from `34-WALKING-BREAK-EVIDENCE.md` and asserts at least one stretch must then intersect the window (CAN FAIL). Both directions execute on every `npm test`. The shipped-params direction is non-vacuous: it prints six real flagged stretches (0.3468–0.7096 m/s) against bounds of 1.264/1.797. `d21-basis` likewise compares against two live-measured quantities on the real archive.

Caveat recorded: the CAN-PASS margins are wide (0.63 m/s and 1.09 m/s of headroom). The test can fail, but it would take a large regression to make it.

### Judgement 5 — Would the test architecture now catch a sibling of the D-22 defect?

**Partly yes — and this is a real improvement, not a paper one.** `describe('independent scan')` in `pause-classification.test.ts` now runs `findCreepStretches` against the zero-import `localCreepWindows` oracle on two real committed streams at shipped params, on every `npm test`, with:
- exact per-stretch equality (start/end/seconds/metres), every expected value parsed from the oracle at test time;
- a no-miss assertion in the other direction;
- a structural partition proving every unmatched oracle window really does cross a covered-run boundary (so the known definitional gap cannot be used as a blanket excuse);
- per-source `count`/`sum`/`max` equality against the coverage-scoped oracle set — which is exactly the aggregate the D-22 defect corrupted;
- explicit reachability guards (`expect(oracle.length).toBeGreaterThan(0)`), closing the vacuous-0-vs-0 hole.

I confirmed this is genuinely two-directional by reimplementing the retired pre-34-15 merge rule myself and running it against 6286234101: it produces count 3 / 171 s where the shipped rule and the oracle both produce count 2 / 133 s. The test would have gone RED on the old code.

**The honest limit:** the reconciliation runs on two named activities, not archive-wide. 34-15's archive-wide reconciliation (13 structurally-explained disagreements) was a one-off, not a standing test. A sibling defect that only manifests on a stream shape neither 6286234101 nor 3475715143 exhibits would still reach the browser first. The independent-oracle comparison is no longer the *only* thing that would catch it, but it is still the *only* thing that would, and it is only pointed at two activities.

**Closure round: re-checked and unchanged.** `pause-classification.test.ts:728` still reads `const SCAN_ACTIVITIES = ['6286234101', '3475715143'] as const;`. The limit stands exactly as written and is carried forward below.

### Judgement 6 — The human checkpoint verdicts across three builds

**CLOSED in the closure round.** The initial round found that two of the nine rows carried verdicts recorded against rendered text the shipped build no longer produced, and that the Approval line predated plan 34-16 entirely. That was the sole reason this report read `human_needed`.

All three items are now discharged, and — importantly — discharged in a way I could corroborate without a browser:

- **R3** (6286234101's Pauses section): the developer viewed the shipped build (digest `16250d75…`) and recorded a three-row paste. I reproduced all three rows from `data/stats/pace-quality/6286234101.json` through the shipped renderer's own formatting rules, character for character. Both flagged rows (5866–5922, 6236–6313) fall outside the gated control window t=5289–5696, and the two rows now carry *different* classes derived from their own numbers (0.6357 and 0.3468 m/s) — the WR-01 fix visible on screen.
- **R4** (3475740390's summary row): the developer viewed the shipped clause `(5 not-classifiable — see Unreliable segments)`. I reproduced the entire rendered row from the live index row through `detail-sections.ts:1583/1595/1604`, and confirmed the superseded `isolated-jump/hidden-pause` string appears 0 times in the served bundle. The cosmetic item R4 had carried open since 34-15 is closed.
- **R9** (served digest == freshly built digest): re-verified by this verifier in both rounds — `16250d75fac18b97…` on both sides. Correctly recorded as needing no human.
- **The Approval line** is re-issued and dated 2026-09-23, naming the post-34-16 build, scoped "superseding the above for R3/R4/R9 only", and appended beneath the earlier line rather than replacing it. All three Re-check Notes and the full superseded verdict text remain legible as history.
- **R1, R2, R5, R6, R7, R8**: confirmed unaffected in the initial round; their evidence re-derived where checkable (R1/R2 via the recount, R5 via the 0.5 m/s inclusive edge, R8 via byte-identical regeneration). Unchanged.

### Judgement 7 — Are the Criticals actually fixed, and do the deferrals have homes?

**Both Criticals are fixed in the source, read directly.**
- **CR-01**: `parseForgottenStopSignal` (`pace-quality-client.ts:409`) now returns `null` for any non-finite numeric field when `raw.computable` is true, so a partially-corrupted shard falls through to `NOT_COMPUTABLE_FORGOTTEN_STOP_PARSED` instead of rendering "none found". `parsePauseClassificationSignal` is genuinely all-or-nothing on present-but-unparseable fields (`:367`). A dedicated reproduction test exists (`pace-quality-client.test.ts:819`).
- **CR-02**: `findCreepStretches` (`pause-classification.ts:652, :676`) now returns `[]` on a `t`/`d` length mismatch and rejects non-finite `seconds`/`metres` explicitly *before* the `> maxSpeedMps` comparison — closing the `NaN > max === false` acceptance hole. Two regression tests added.

All four deferred todos exist under `.planning/todos/pending/` with 2026-09-23 dates. IN-06's `VACUOUS` verdict token is implemented in the generator (`:1506`) with four tests covering VACUOUS / PASS / FAIL, and the live artifact renders `d20-basis … PASS` (non-vacuous on this archive).

### Judgement 8 — SEG-05b

✓ Correct. Still `- [ ]` Pending, traceability row `Pending`, Phase 34's own half recorded with its load-bearing stub proof, re-tick explicitly gated on Phases 35 and 36. Untouched by the closure round.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` | — | **None found** across all twelve phase-modified production and test files, re-scanned at HEAD. Debt-marker gate passes. |
| `src/analytics/pause-classification.ts` | ~161-163 | Provenance docblock stated "at 2.2 m/s every one of 3475724402's **18 merged intervals (2.307-4.065 m/s)** classifies `ran-through`" | ℹ️ Info — **RESOLVED 2026-09-23 (`10c9e453`)** | The statement was factually wrong against the shipped data (17 `ran-through`, 1 `walked` — row 12, `recording-gap`, t=3364-3388, 1.929 m/s). Now corrected at the source of record: the docblock names the 17/1 split, identifies the over-generalisation (the quoted 2.307-4.065 range is the merged-segment subset's), and dates the correction. `34-CONTEXT.md` D-21 carries a dated correction bullet; `34-06-SUMMARY.md` and `34-07-SUMMARY.md` are annotated. Re-derived at HEAD: `walked=1 ran-through=17`. **Correction to this report's own initial wording:** the initial round additionally claimed the sentence "appears in `34-CALIBRATION.md`'s D-21 narrative." It does not — verified by grep against both the artifact and its generator, neither of which contains any form of the claim. The artifact's D-21 narrative (line 206) is a computed sentence about the valley premise only, and its per-interval class table has always rendered row 12 as `walked`. The executor's "no generator change needed" claim is therefore accurate, and independently confirmed by a byte-identical regeneration at HEAD (`e40aeaca…`). |
| `.planning/phases/34-…/34-CONTEXT.md` | 42 | Pre-phase scoping-probe table row `\| 3475724402's 18 merged intervals \| 18 \| 2.31–4.06 m/s \|` | ℹ️ Info — residual, not corrected | This row is the *origin* of the over-generalisation the commit above fixed: it attributes the 16 merged-segment intervals' range to all 18 gap-bearing intervals, silently excluding row 12's 1.929 m/s. It survives the correction round uncorrected. Mitigating: it is a pre-implementation scoping-probe table, not a claim about shipped behaviour; D-21 twelve screens below it now carries the dated correction; and `.planning/ROADMAP.md:243`'s amendment uses the narrow ("merged intervals") wording that 34-07 established is technically true of the 16. Blocks nothing; recorded so a later reader of the scoping table is not misled. |
| `.planning/REQUIREMENTS.md` | 51, 107-112 | Six requirements ticked at commit `c35312ed` (2026-09-23 09:54) | ℹ️ Info — **stays a recorded observation** | 34-REVIEW.md (10:07) subsequently found two Critical defects, one of which (CR-01) was a direct STOP-01 violation, so STOP-01 was not satisfied at the moment it was ticked. 34-16 (10:52) fixed both with regression tests, verified in the source. **Closure-round disposition:** the ordering does not leave anything untrue in the record. The ticks' truth value today is correct; 34-11-SUMMARY's stated basis is narrowly scoped ("not contradicted by its mapped rows or the automated evidence") and was true as written at 09:54 — it never claimed a code review had run; the review→fix chain is fully traceable; and the one evidential dependency the ordering created (34-11 leaning on a SUMMARY-sourced "3 rows" figure) has now been discharged by a human verdict on the shipped build plus this verifier's own re-derivation. This matches the project's recorded "requirement ticked before review/verify runs" failure mode; the end state is sound, the ordering was not. Not raised to a gap. |
| `.planning/ROADMAP.md` | 111 | Unticked phase line carries a completion date: `- [ ] **Phase 34: …** … (completed 2026-09-23)` | ℹ️ Info — pre-existing, predates the closure round | `c0645ad5` removed this stray date after `89ce634a` reverted the premature tick; `26d1a741` re-added it while correctly leaving the checkbox unticked. The checkbox itself is in the right state (unticked, awaiting the orchestrator), and the progress table row reads `In Progress` with an empty date cell — so the two are mutually inconsistent today. Self-resolving once the orchestrator ticks. Flagged only so the orchestrator does not treat the date as already-correct bookkeeping. |
| `src/analytics/pace-single-source.test.ts` | WR-08 scanner | Non-vacuity proven only by planted fixture | ℹ️ Info | Self-disclosed in 34-16-SUMMARY's key-decisions: unlike D-05's sibling scanner, no real file carries the banned band-literal needle, so there is no real-file reachability anchor. Accepted as disclosed. |

---

## Carried Forward — what the next phase inherits

These are not gaps. They are limits of what this phase's PASS certifies, recorded so they are not
silently lost at the phase boundary. Neither is addressed by Phase 35's or Phase 36's roadmap
success criteria, so neither is "deferred" in the scheduling sense — each needs an owner if it is
to be closed.

1. **The amended PAUSE-01 certifies materially less than its original text asked for** (Judgement 2).
   Two of the three class bands are developer-declared, bracketed by one-sided or wide sanity gates
   (`d20-basis` asserts only `0.029873 < 0.5`; `d21-basis` admits anything in [1.798, 3.049]). The
   paper trail is complete and honest, but a reader of the traceability table alone
   (`PAUSE-01 | Phase 34 | Complete`) would not learn this. Any future phase that reuses
   `STATIONARY_MAX_SPEED_MPS` or `WALK_RUN_BOUNDARY_MPS` as if it were archive-calibrated would be
   building on a declaration.

2. **The oracle reconciliation is pointed at two named activities, not the archive** (Judgement 5).
   `SCAN_ACTIVITIES = ['6286234101', '3475715143']`. 34-15's archive-wide reconciliation was a
   one-off, not a standing test. A sibling of the D-22 defect that only manifests on a stream shape
   neither activity exhibits would still reach the browser first. The
   `.planning/todos/pending/2026-09-23-pause03-generator-and-recount-hardening.md` todo is the
   nearest existing home, but it does not currently name archive-wide creep reconciliation.

3. **D-20's reading of STOP-02's "measured non-issue" clause outruns the sentence** (Judgement 1,
   final paragraph). The outcome is defensible; the framing ("STOP-02's own text anticipates this
   outcome") is more comfortable than the text warrants.

---

## Gaps Summary

**No gaps, and no outstanding human verification.**

Every ROADMAP success criterion is achieved in the codebase, every requirement ID is supported by
code I read and behaviour I executed, no artifact is a stub, no key link is broken, and no debt
marker is outstanding. I independently reproduced the phase's headline defect (D-22 overlapping-creep
double counting) and independently confirmed the shipped fix produces the independent oracle's own
numbers.

The single reason the initial round withheld a pass — two rendered-surface checkpoint verdicts
collected against builds that no longer existed, plus an Approval line predating plan 34-16 — is
closed. Crucially, it is closed in a form I could check rather than merely accept: both pasted
renderings reproduce character-for-character when I run the shipped data through the shipped
renderer's own formatting rules, so the developer's verdicts are corroborated by the codebase and
not just asserted in a document. The sign-off supersedes without overwriting, all three Re-check
Notes and the full superseded verdict text remain legible, no requirement was touched, and the phase
checkbox is correctly still unticked for the orchestrator.

The one closure claim most likely to have been a convenient answer — "34-CALIBRATION.md needed no
generator change because the wrong sentence never appeared in generated output" — is **true**, and
verifying it turned up an error in this report's own initial round, which is corrected above: the
sentence was never in the artifact or its generator, only in hand-written prose. The correction was
made at the right place (the production docblock that a later reader would trust) and the artifact
regenerates byte-identical at HEAD.

Two things survive this pass and must not be read as erased by it. **The amended PAUSE-01 is
materially weaker than written** — two of three bands are declared, not calibrated, behind gates
loose enough to admit a wide range of values; the tick rests on a dated in-place amendment, not on
the original contract. And **the oracle-reconciliation test is aimed at two named activities, not
the archive** — it is a real improvement over what existed before D-22, and it would have caught
D-22, but a sibling defect on an unrepresented stream shape would still reach the browser first.
Both are recorded in Judgements 2 and 5 and restated under "Carried forward" so the next phase
inherits them explicitly.

On the phase's central honesty question — whether four mid-phase requirement amendments were
narrowings backed by measurement or rationalisation of what the code happened to do — the evidence
comes down on the side of honesty, decisively on the structural test (`d12-anchor-ii` predates every
real-archive run by commit history) and persuasively on the behavioural one (both declared values
produced outcomes the phase had predicted against, and both were disclosed rather than tuned away).
The closure round is consistent with that pattern: the one place it could have taken the easy road
it did not, and the one thing it declined to change it was right to decline.

---

_Verified: 2026-09-23T09:06:45Z (initial) · Re-verified: 2026-09-23T13:35:00Z (closure round, HEAD `10c9e453`)_
_Verifier: Claude (gsd-verifier)_
