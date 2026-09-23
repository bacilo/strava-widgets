---
phase: 34
slug: pause-classification-forgotten-stop
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-22
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `34-RESEARCH.md` § Validation Architecture. Task IDs were filled as plans 34-01
> through 34-14 executed; the Per-Task Verification Map below is now fully populated (34-10).

---

## The two rules this contract enforces (carried from `33-VALIDATION.md`)

**Rule 1 — every `-t` row records its matched test count.** A vitest name filter that matches zero
tests exits 0 and cannot be told apart from a pass. A row with no recorded matched count > 0 is not green.

**Rule 2 — every guard is watched failing first.** A never-widen guard, the D-18 independent
recount and the D-13 insensitivity check must each be shown failing against a planted violation
(widened composite, deliberately broken classifier, circular strawman) before any passing run counts.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (configured; no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` (`.test.mjs` files import `../dist/` — run `npm run build` first) |
| **Full suite command** | `npm test` (Phase 33 close: 93 files / 3,102 tests green — re-confirm fresh at Wave 0) |
| **Estimated runtime** | ~120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched files> -t "<fragment>"`, matched count recorded (Rule 1)
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** full suite green, and every calibration/recount artifact regenerated twice byte-identical. The D-18 recount must also have been watched failing first. Then run the human browser checkpoint against a digest-verified served build, hard-reloading after every fixture edit.
- **Max feedback latency:** 120 seconds

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PAUSE-01 | Four-class band assignment on gap-bearing intervals (both bands developer-declared per D-20/D-21, provenance asserted); hidden-pause/isolated-jump not-classifiable | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyPauses"` | ❌ W0 |
| PAUSE-02 | Additive index key + capped shard list | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pauses"` | ❌ W0 (extends existing) |
| PAUSE-03 | Merged-segment re-measurement, dated provenance | script (artifact) | PAUSE-03 generator exit 0, regenerated twice byte-identical | ❌ W0 |
| STOP-01 | Two-source union, itemised, timer-running scope | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "classifyForgottenStop"` | ❌ W0 |
| STOP-02 | Declared near-zero threshold (D-20) with drift recorded as a measured non-issue; minimum duration still calibrated and selected by arbitration; walking-break controls asserted against their own window speeds | script (artifact) | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs` | ❌ W0 |
| STOP-03 | Excluded from `hasAnySevereSignal`; detail-view disclosure | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes"` | ✅ extend |
| SEG-05b (34 half) | Classifier reads detector via `pace-derivation.ts`, load-bearing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pause-classification"` | ✅ extend |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Matched count | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|---------------|--------|
| 34-12 T1 | 34-12 | 3 | PAUSE-01, STOP-02 | T-34-24 | Every plant enters its shape's population: `planted items = base items + plants`, watched RED on the HALT-1 code first | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "planted entry"` | 6 (live-measured 2026-09-23 during 34-10; not explicitly quoted per-filter in 34-12-SUMMARY.md) | ✅ green |
| 34-12 T3 | 34-12 | 3 | PAUSE-01, STOP-02 | T-34-25 | 24-cell reachability matrix: every shape can both pass and fail on both D-13 axes | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "reachability"` | 25 (live-measured 2026-09-23 during 34-10; not explicitly quoted per-filter in 34-12-SUMMARY.md — the file's own "24-cell" name is a matrix-dimension count, not the `-t` match count, since some cells share a describe/it) | ✅ green |
| 34-13 T1 | 34-13 | 4 | STOP-02 | T-34-28 | Declared stationary constant renders with provenance `developer-declared (D-20), not calibrated`; drift renders as a measured non-issue with live evidence | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "declared constant"` and `-t "drift non-issue"` | 12 and 4 (live-measured 2026-09-23; 34-13-SUMMARY.md quoted 11/4 — the "declared constant" filter now also matches text introduced by 34-14's later table-driven "provenance chain" block, growing 11→12; not a regression) | ✅ green |
| 34-13 T2 | 34-13 | 4 | PAUSE-01, STOP-02 | T-34-30, T-34-31 | Family G evidence-only (never reaches `selectShape`); `d20-basis` gate shown passing and failing; M/W gated on the declared value being present | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "evidence only"`, `-t "gates"`, `-t "exit contract"` | 12, 20, 10 (live-measured 2026-09-23; 34-13-SUMMARY.md quoted 7 for "evidence only" pre-34-14 — 34-14 Task 2 extended the same describe block with W-specific tests to 12 total, matching 34-14-SUMMARY.md's own count exactly) | ✅ green |
| 34-13 T3 | 34-13 | 4 | STOP-02 | T-34-29 | Provenance chain for 0.5 binds CONTEXT text → generator source text → artifact line, watched RED from each side | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "provenance chain"` | 10 (live-measured 2026-09-23; 34-13-SUMMARY.md quoted 4 pre-34-14 — 34-14 Task 3 made this block table-driven over both declared constants, growing to 10, matching 34-14-SUMMARY.md's own count exactly) | ✅ green |
| 34-14 T1 | 34-14 | 5 | PAUSE-01 | T-34-33, T-34-37 | Declared boundary renders with provenance `developer-declared (D-21), not calibrated`; valley evidence is computed live and differs between unimodal and bimodal fixtures | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "declared boundary"` and `-t "valley evidence"` | 10 and 7 (live-measured 2026-09-23; 34-14-SUMMARY.md quotes both 9 and 6 for "declared boundary" internally inconsistently — live count used as the authoritative figure) | ✅ green |
| 34-14 T2 | 34-14 | 5 | PAUSE-01, STOP-02 | T-34-36, T-34-39, T-34-40 | Family W evidence-only with finite bases; `d21-basis` both sub-checks shown failing plus stated-reason failures; every gate id PASS individually on the extended fixture; `strawman-<id>-passed` exits 1 for every family incl. M | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "evidence only"`, `-t "gates"`, `-t "exit contract"` | 12, 20, 10 (live-measured 2026-09-23; matches 34-14-SUMMARY.md exactly) | ✅ green |
| 34-14 T3 | 34-14 | 5 | PAUSE-01, STOP-02 | T-34-34 | Provenance chain over BOTH declared constants, plus the no-stray-literal guard for 0.5 and 2.2 | unit | `npx vitest run scripts/compute-pause-classification-calibration.test.mjs -t "provenance chain"` (≥ 2 tests) | 10 (live-measured 2026-09-23; matches 34-14-SUMMARY.md exactly, ≥2 satisfied) | ✅ green |
| 34-06 T1 | 34-06 | 6 | PAUSE-01, STOP-02 | T-34-22, T-34-26 | Fourth run: strawmen FAIL first, Family M arbitrates, every gate quoted with its measured value; HALT writes 34-06-HALT-4.md and ships nothing | script (artifact) | `npm run compute-pause-classification-calibration` exit 0 or 1, artifact regenerated twice byte-identical | n/a (artifact) — exit 0 re-confirmed 2026-09-23 on the merged tree (no new streams arrived; origin/master was already an ancestor), sha256 `7a19fdc7...` byte-identical across 2 fresh runs, matching the already-committed artifact exactly (no diff) | ✅ green |
| 34-06 T2 | 34-06 | 6 | STOP-02 | T-34-19, T-34-21 | Constants shipped FROM the artifact under the two-sided equality guard; no control flagged for its walking pace, asserted strictly below each control's OWN window speed parsed from 34-WALKING-BREAK-EVIDENCE.md, with the CAN FAIL direction in the same test | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "shipped from 34-CALIBRATION"` and `-t "walking-break control"` | 6 and 5 (live-measured 2026-09-23; matches 34-06-SUMMARY.md exactly) | ✅ green |
| 34-15 T1 | 34-15 | 11 | STOP-01, STOP-02 | T-34-41, T-34-42 | D-22 union-merge fix: overlapping/boundary-sharing covered-creep windows merge into ONE stretch with the union's own seconds/metres, never consulting the union's speed as a merge condition; matches the independent oracle window-for-window on 6286234101 and 3475715143 (coverage-scoped); no two returned stretches overlap | unit | `npx vitest run src/analytics/pause-classification.test.ts -t "independent scan"`, `-t "walking-break control"`, `-t "findCreepStretches"` | 9, 5, 10 (live-measured 2026-09-23; matches 34-15-SUMMARY.md exactly) | ✅ green |
| 34-15 T2 | 34-15 | 11 | PAUSE-02, STOP-03 | T-34-44 | pausesSummaryRow discloses `pauseClassification.notClassifiableCount` as a trailing parenthetical when > 0, adds nothing when 0 or null (CR-01) | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "Pauses"` | 15 (live-measured 2026-09-23; matches 34-15-SUMMARY.md exactly) | ✅ green |
| 34-15 T3 | 34-15 | 11 | STOP-01, STOP-02, PAUSE-02 | T-34-43, T-34-45, T-34-46 | Regeneration on the merged tree; D-22 fix changes only the archive-wide covered-creep stretch count (363→300, still 82 activities); calibration constants and their provenance unchanged; D-18 recount, five upstream artifacts and data/streams byte-identical; archive-wide reconciliation (82 activities with ≥1 production covered-creep stretch, 69 full agreement, 13 explained by coverage-scope divergence, 0 unexplained) | script + gate | `npm run compute-pause-classification-calibration` (byte-identical x2), `npm run compute-pause-classification-recount`, `npm test`, `npx tsc --noEmit`, `npm run build-widgets`, `npm run verify-dashboard` | n/a (artifact/gate) — sha256 `e40aeaca...` byte-identical x2, recount PASS (walked=1 ran-through=17, matches 34-07 exactly), npm test 3478/3478, verify-dashboard 66/66, served digest `13a244ed...` equals freshly built digest | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Re-check Note (2026-09-23, plan 34-15, D-22 gap closure)

Plan 34-15 fixed the double-counted covered-creep stretch defect (D-22) and added the
`notClassifiableCount` disclosure. This note lists, per this plan's own drafted `<recheck>` block,
which Manual-Only rows the executor confirmed actually moved against the regenerated data — one
of the plan's own `<recheck>` predictions did NOT hold and is corrected below.

**Must be RE-CHECKED by plan 34-11's human on the rebuilt page:**
- **R4** — 3475740390's Pauses summary row TEXT changed: it now reads
  `5 intervals: 0 stationary, 5 walked, 0 ran through, 0 transported (5 not-classifiable:
  isolated-jump/hidden-pause) · possible forgotten stop: not computable — ...` (previously no
  parenthetical). The not-computable reason clause itself is unchanged.
- **R7** — its quoted CAN-PASS evidence figure moved: `forgottenStop.totalSec=232, count=5` for
  3475715143 (previously `totalSec=384, count=9`, both double-counted under the retired merge).
  The row's own CLAIM ("no badge appears") is unaffected — only the quoted non-zero signal number
  changed. Re-quote, do not re-derive the claim.

**CORRECTED — this plan's own drafted `<recheck>` predicted R2 would need re-checking; it does
NOT:**
- **R2** — 3475724402's Pauses summary row. 3475724402's `pauseClassification.notClassifiableCount`
  is `0` both before and after this plan (unaffected by Task 1's fix — this activity carries no
  covered-creep stretches at all), so Task 2's disclosure clause never fires and the rendered row
  text is BYTE-IDENTICAL to what plan 34-11 would have seen: `18 intervals: 0 stationary, 1 walked,
  17 ran through, 0 transported · possible forgotten stop: none found` — confirmed by directly
  invoking `qualitySignalsSectionPlan` against the regenerated index row. The plan text's assumption
  that "Task 2 adds the not-classifiable clause wherever `notClassifiableCount > 0`" is true, but
  3475724402 is not such a case — R2 does not need re-verification.

**Confirmed provably unaffected (re-quote the evidence only, do not re-judge), per this plan's own
`<recheck>` reasoning, verified against the regenerated data:**
- **R1** — 3475724402's Pauses section rows. Confirmed UNAFFECTED: 3475724402 carries zero
  covered-creep entries before and after this plan.
- **R3** — 6286234101, no flagged row inside [5289, 5696]. Confirmed UNAFFECTED: both of this
  activity's post-fix creep windows (5866-5922, 6236-6313) lie outside that window, exactly as
  before (R3's own quoted text already used the independent `--scan` figures, which the pre-fix
  production bug never touched).
- **R5** — 3475715143's first creep row. Confirmed UNAFFECTED: production's first covered-creep
  stretch is still exactly `startSec 1708, endSec 1750, seconds 42, metres 21` — a dedicated
  regression-guard test in `pause-classification.test.ts` (`-t "independent scan"`) pins this.
- **R6** — jumps absent from Pauses, present in Unreliable Segments. Confirmed UNAFFECTED: the
  Pauses SECTION is untouched by Task 2 (summary-row-only change); 3475740390's
  `notClassifiableCount` (5) and `unreliableSegments.count` (5) are unchanged.
- **R8** — PAUSE-03 artifact. Confirmed UNAFFECTED: `34-PAUSE03-REMEASUREMENT.md` byte-identical
  (sha256 `964afdf5...`) before and after this plan's regeneration.
- **R9** — served digest equals freshly built digest. Re-run this plan (required, since the build
  changed): served digest, `dist/widgets/` copy and `data/dashboard/index.json` all equal
  `13a244ed...` (a NEW value, since `index.json`'s content genuinely changed — the digest VALUE was
  never pinned, per this row's own 2026-09-23 correction). The claim (equality) holds; no human
  re-judgment needed beyond re-glancing that the page still renders.

---

## Wave 0 Requirements

- [x] `src/analytics/pause-classification.ts` + `.test.ts` — classifier module (or extension per CONTEXT Claude's Discretion)
- [x] `scripts/compute-pause-classification-calibration.mjs` + `.test.mjs` — walk/run valley, drift floor, STOP min-duration
- [x] `scripts/compute-pause-classification-recount.mjs` — D-18 zero-import independent recount for 3475724402
- [x] PAUSE-03 re-measurement generator (standalone or folded into calibration)

---

## Manual-Only Verifications

Drafted 2026-09-23 (plan 34-10), before any checkpoint runs. Every row's expected value was computed NOW, live, on its own named real input, independently of the classifier — never from the rendered page itself. Verdicts are left empty for plan 34-11's browser checkpoint to fill.

| Row | Requirement | Activity / surface | Expected (independent source named) | CAN FAIL | CAN PASS | Verdict |
|---|---|---|---|---|---|---|
| R1 | PAUSE-01, PAUSE-02 | 3475724402, detail view Pauses section (18 rows: 16 merged-segment + 2 recording-gap) | Every row's class/duration/distance equals `scripts/compute-pause-classification-recount.mjs`'s printed table (D-18, zero-import of the classifier/detector, re-run 2026-09-23, exit 0): row 12 (recording-gap, t=3364–3388, 24s, 46.3m, 1.929 m/s) is the sole `walked` row; the other 17 rows (recording-gap + merged-segment, at 2.307–4.065 m/s) are `ran-through`. Full table quoted in `34-07-SUMMARY.md` and reproduced identically by this plan's own re-run. | Any row's class or seconds differs from the recount table, or a row present in the recount is missing from the rendered section, or vice versa | The recount table is non-empty and has at least one walked (1) and one ran-through (17) row — both present, stated here | |
| R2 | PAUSE-02, STOP-03 | 3475724402, detail view Quality Signals "Pauses" summary row | The walked (1), ran-through (17) and transported (0) counts equal the recount tally `walked=1 ran-through=17 stationary=0 transported=0 outOfScope(zero-advance-pause)=0` (D-18 recount, re-run 2026-09-23, exit 0, PASS). The rendered row's stationary count (currently 0, per the live index row `pauseClassification.stationaryCount`) also folds in zero-advance pauses, which the recount does not verify at all (scoped out — its own `outOfScope(zero-advance-pause)` count for this activity is 0, i.e. there is nothing unverified being hidden inside that 0 here) | Any of the three counts (walked/ran-through/transported) on the rendered row differs from the recount tally | The tally is quoted above (walked=1, ran-through=17, transported=0, outOfScope=0) | |
| R3 | STOP-01, STOP-02 | 6286234101 (first, D-12-gated confirmed walking-break control, window t=5289–5696), detail view Pauses section | No Pauses row marked "possible forgotten stop" falls inside [5289, 5696]. Independent evidence (zero-import `scripts/compute-walking-break-evidence.mjs`, live-measured 2026-09-23): `minWindowSpeed(t, d, 5289, 5696, 40)` = **0.990 m/s** against the shipped `STATIONARY_MAX_SPEED_MPS` = 0.5 m/s — **margin = +0.490 m/s** (positive). Cross-checked via `--scan 6286234101 --max-mps 0.5 --min-sec 40` (also zero-import): only two creep windows exist archive-wide for this activity (t=5866–5922, t=6236–6313), both entirely OUTSIDE [5289, 5696] — none intersects the control's own window | The control's own minimum 40 s window speed inside its window (0.990 m/s) is quoted against the shipped 0.5 m/s threshold; a threshold raised above 0.990 m/s would flag this walk — margin +0.490 m/s | The margin is positive (it is, +0.490 m/s) — this row is PASSABLE, not UNPASSABLE | |
| R4 | STOP-01, STOP-03 | 3475740390, detail view Quality Signals "Pauses" summary row | The row reads "possible forgotten stop: not computable — distance-triggered recording: a standstill would be written as a recording gap, not a covered creep, so the forgotten-stop flag cannot see it" (D-10 reason, quoted verbatim from the live regenerated `data/dashboard/index.json` index row for this activity, 2026-09-23) and never "none found" | The page shows numbers instead of the not-computable reason, or shows "none found" | The D-10 anchor gate in `34-CALIBRATION.md`'s "D-10 blind-spot rule" section reads PASS for 3475740390 (expected distanceTriggered = true, actual = true) — confirmed this plan, re-generated 2026-09-23 | |
| R5 | STOP-01 | 3475715143 — the LOWEST activity id (by numeric Strava id) for which both the production shard's own `pauseIntervals` (regenerated this plan, 2026-09-23) AND the independent zero-import `--scan` report at least one covered-creep stretch (checked across all 82 covered-creep-flagged activities in the regenerated archive; this is also the D-21 accepted-flag control — using it for both R3's sibling anchor and this row's creep-positive case is not a conflict, since they test different activities and different claims) | The position and duration of its first creep row equal the `--scan` output within 1 s: production `pauseIntervals[0]` (source `covered-creep`) = startSec 1708, endSec 1750, seconds 42, metres 21; independent `--scan 3475715143 --max-mps 0.5 --min-sec 40` first window = startSec 1708, endSec 1750, seconds 42, metres 21 — **exact match, 0 s difference** | No marked row exists on the rendered page for this window, or its position/duration differs from the `--scan` output by more than 1 s | `--scan` output is quoted above and matches exactly | |
| R6 | PAUSE-02, D-15 | 3475740390, detail view Pauses section vs. Unreliable Segments row | None of its 5 isolated-jump segments (named individually in `32-CALIBRATION.md`: t=2347–2350, t=2508–2513, t=2536–2538, t=2580–2583, t=2587–2589) appears as a Pauses row, while the Unreliable Segments row still shows `unreliableSegments.count=5, mechanisms=[isolated-jump]` (live index row, re-generated 2026-09-23). The not-classifiable count from the live index row's `pauseClassification.notClassifiableCount` = 5, equal to the isolated-jump segment count `32-CALIBRATION.md` names for this activity (5, listed individually) | A jump row (any of the 5 named t-ranges) appears in the rendered Pauses section | That count is at least 1 — it is 5, stated | |
| R7 | STOP-03, D-17 | List rows of R1 (3475724402), R3 (6286234101) and R5 (3475715143)'s activities; the `#/list` "has any severe signal" filter membership of 3475724402 | None of the three list rows shows a pause or forgotten-stop badge. 3475724402's `anySevere=true` (live index row) is driven solely by `impossibleSamples.tier="severe"` (36 impossible samples, a pre-existing Phase-≤32 signal Phase 34 never touches) — `pauseClassification`/`forgottenStop` carry no `tier` field at all (D-11) and are structurally excluded from `hasAnySevereSignal`'s 3-member `Pick<>` (proven by 34-08's never-widen guard, watched failing under a planted widening, and by 34-09's D-17 guard, watched failing under a planted `qualityBadgeSpecs` push) — so membership is unaffected by construction, not merely by observation | A new pause/forgotten-stop badge appears on any of the three rows | R5's activity (3475715143) has a non-zero forgotten stop (`forgottenStop.totalSec=232, count=5`, live index row regenerated 2026-09-23 by plan 34-15's D-22 union-merge fix — **figure refreshed from the pre-fix R7 draft's `totalSec=384, count=9`, both double-counted under the retired merge; see 34-15-SUMMARY.md's CHANGED-NUMBERS table**) — so there genuinely is something that COULD wrongly badge if D-17/D-11 had regressed, and it does not | |
| R8 | PAUSE-03 | `34-PAUSE03-REMEASUREMENT.md`, `.planning/milestones/v2.2-REQUIREMENTS.md:165` | The Figure of record sentence, quoted verbatim from this plan's own regeneration (2026-09-23, sha256 `964afdf5...` identical across 2 consecutive runs): "Merged rule ... **22 activities** (max 15.3 km/h). Old rule ... **13 activities** (max 13.8 km/h). Transported class ... **5 activities**, **6 intervals**." `v2.2-REQUIREMENTS.md:165` carries the dated forward pointer ("*Superseded 2026-09-22 by v2.3 PAUSE-03 ... see `34-PAUSE03-REMEASUREMENT.md`*"), confirmed present verbatim this plan | The artifact is missing, or its sha256 differs across two fresh regenerations | The sha256 pair is equal (confirmed: `964afdf5...` both runs) | |
| R9 | All rendered rows, D-16 | The served build (`npm run verify-dashboard` target) vs. the freshly built `dist/widgets/` tree; 3475724402's pace chart | The served asset digest EQUALS the freshly built digest, computed fresh at check time: `shasum -a 256 data/dashboard/index.json dist/widgets/data/dashboard/index.json` prints two identical digests. **The digest value is deliberately NOT pinned here (corrected 2026-09-23):** `index.json` embeds a generation timestamp, so its bytes change on every regeneration — an earlier draft of this row pinned `468220ab...`, and the next honest rebuild produced `793fee8a...`, which would have read as a failure of a check that actually passed. The claim that matters is the EQUALITY of the two digests on the same build, never a fixed literal (project lesson: a generated artifact whose bytes cannot be stable must never be pinned as an expected value). Record both digests as evidence of the run, not as the expectation; `dist/widgets/index.html` references `assets/index-CEgY2fjF.js`/`assets/index-CQkdBpPg.css`, both confirmed served 200 by `verify-dashboard` (66/66 checks passed). 3475724402's pace chart still clips as closed on Phase 33's own checkpoint — Phase 33's recorded post-clip fastest pace for this activity is **2:53/km** (`33-06-SUMMARY.md`), quoted here as the bound to read the rendered chart against, never re-derived | The served digest does not equal the freshly built digest, OR the rendered pace chart shows a pace faster than 2:53/km anywhere on 3475724402 | The digests match (confirmed) and 2:53/km is the quoted, independently-sourced bound to check the rendered chart against | |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Every `-t` row has a recorded matched count > 0 (Rule 1)
- [ ] Every guard watched failing first (Rule 2)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
