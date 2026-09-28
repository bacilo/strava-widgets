---
phase: 35
slug: stream-derived-running-pace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-24
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `35-RESEARCH.md` § Validation Architecture at plan-phase time. Task IDs are
> assigned when PLAN.md files are written — the Per-Task Verification Map below is keyed by
> requirement until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (already configured — no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` — `.test.mjs` files import `../dist/`, so run `npm run build` first |
| **Full suite command** | `npm test` |
| **Estimated runtime** | full suite ~ Phase 34 baseline (98 files / 3,499 tests, all green per `34-VALIDATION.md` and STATE.md 2026-09-23) — **re-confirm fresh at Wave 0**, nightly CI may have moved the archive |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched files> -t "<fragment>"` — **record the matched
  test count on every `-t` row.** A name filter matching zero tests exits 0 and is indistinguishable
  from a pass (this project's carried-forward lesson from `33-VALIDATION.md` / `34-VALIDATION.md`).
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the phase-gate conditions below.
- **Max feedback latency:** quick run < 30 s; wave run = full-suite runtime

### Phase gate (all must hold before verification)

- [ ] Full suite green
- [ ] D-05 calibration artifact and D-08 recount artifact each **regenerated twice, byte-identical**
- [ ] D-05's deliberately circular **strawman watched FAILING first** against the real archive
- [ ] D-11's **stub-the-detector proof watched changing** the running-pace value on a named activity
- [ ] Human browser checkpoint against a **digest-verified served build** — hard-reload after every
      fixture edit (recorded browser-checkpoint pitfall in this project)

---

## Per-Task Verification Map

Filled 2026-09-28 (plan 35-12), matched counts freshly re-measured on the merged tree (live-count
wins over any earlier, possibly stale count in a plan SUMMARY).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Matched | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|---------|-------------|--------|
| 35-02 T1/T2 | 35-02 | 1 | RPACE-01 (totality at source) | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "35-02"` | 4 | ✅ | ✅ green |
| 35-02 T1/T2 | 35-02 | 1 | RPACE-01 (totality at source, pace-quality sibling) | — | N/A | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "35-02"` | 7 | ✅ | ✅ green |
| 35-03 T1/T2 | 35-03 | 2 | RPACE-01 (deriveRunningPace, D-08 boundary rule, the folded-todo totality cases) | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "deriveRunningPace"` | 14 | ✅ | ✅ green |
| 35-03 T3 | 35-03 | 2 | SEG-05b (Phase 35 half, D-11) | — | N/A | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "SEG-05b"` | 3 | ✅ | ✅ green |
| 35-04 T1/T2 | 35-04 | 3 | RPACE-03 (zero-import recount, D-08) | — | N/A | script | `npx vitest run scripts/compute-running-pace-recount.test.mjs` (unfiltered) | 50 | ✅ | ✅ green |
| 35-04 T2 / 35-06 T2 | 35-04 / 35-06 | 3 / 5 | RPACE-03 (the recount's and the calibration generator's zero-import / no-fs-at-import guard) | — | N/A | script | `npx vitest run scripts/unreliable-segment-import-guards.test.mjs` (unfiltered — carries both generators' certified-import-guard blocks) | 7 | ✅ | ✅ green |
| 35-05 T1/T2 | 35-05 | 4 | RPACE-03 (recount committed, reconciled against production — the recount crosscheck) | — | N/A | script | `npx vitest run scripts/compute-running-pace-recount-crosscheck.test.mjs` (unfiltered) | 14 | ✅ | ✅ green |
| 35-06 T1/T2 | 35-06 | 5 | RPACE-03 (threshold calibration, D-05, the plant/removal accounting) | — | N/A | script (artifact) | `npx vitest run scripts/compute-running-pace-dispute-calibration.test.mjs` (unfiltered) | 28 | ✅ | ✅ green |
| 35-06 T1/T2 | 35-06 | 5 | RPACE-03 (Axis B plant accounting sub-check) | — | N/A | script (artifact) | `npx vitest run scripts/compute-running-pace-dispute-calibration.test.mjs -t "Axis B plant accounting"` | 4 | ✅ | ✅ green |
| 35-06 T2 | 35-06 | 5 | RPACE-03 (eligibility gate, D-02 — population disjointness) | — | N/A | script (artifact) | `npx vitest run scripts/compute-running-pace-dispute-calibration.test.mjs -t "disjointness"` | 3 | ✅ | ✅ green |
| 35-08 T2 | 35-08 | 7 | RPACE-03 (comparator retarget, D-02 gate can-fail/can-pass, D-06 direction) | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "detectPaceDisagreement"` | 16 | ✅ | ✅ green |
| 35-08 T2 | 35-08 | 7 | RPACE-03 (D-02 eligibility gate, sibling assertion inside the same describe block) | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "D-02 gate"` | 12 | ✅ | ✅ green |
| 35-09 T3 | 35-09 | 8 | RPACE-01 (writer-level reachability, the retired 200 sec/km gate deleted) | — | N/A | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "running pace reachability"` | 7 | ✅ | ✅ green |
| 35-09 T2 | 35-09 | 8 | RPACE-01 (additive `runningPace` field asserted at publish time) | — | N/A | script (live artifact injection, not a persisted `.test.mjs`) | `npm run verify-dashboard` (checks the built `dist/widgets/data/dashboard/index.json` for a well-formed `runningPace` key on every row) | 67/67 checks | ✅ | ✅ green |
| 35-10 T1 | 35-10 | 9 | RPACE-02 (Running Pace tile, all four states — corrected row, see note below) | V5: `textContent`-only | unit + manual | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "runningPaceTilePlan"` + browser row on 3475724402 | 9 | ✅ | ✅ green |
| 35-10 T3 | 35-10 | 9 | RPACE-02 (exclusion line's third-child spacing, watched failing first) | — | N/A | unit (CSS) | `npx vitest run src/dashboard/styles.test.ts -t "35-10"` | 3 | ✅ | ✅ green |
| 35-11 T1 | 35-11 | 10 | RPACE-03 (badge text/explanation retargeted to "running", badge fixture pinned on 3475724402) | — | N/A | unit + manual | `npx vitest run src/dashboard/views/list.test.ts -t "3475724402"` + browser row | 1 | ✅ | ✅ green |
| 35-11 T2 | 35-11 | 10 | D-09 (splits rebase follows the badge) | — | N/A | unit + manual | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "isRebasedAverage"` + browser row | 2 | ✅ | ✅ green |
| 35-11 T3 | 35-11 | 10 | RPACE-02 (byte-identical boundary, criterion 4 — corrected row, see note below) | — | N/A | unit (regression) | `npx vitest run src/dashboard/views/list.test.ts -t "criterion 4"` | 6 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Corrected rows (this plan, 2026-09-28):** the 35-10 row previously named a file for the
"detail" view that does not exist anywhere in this repository — `detail.ts` (the DOM controller)
has no test harness of its own, following this codebase's own section-plan/DOM-builder split; the
pure `runningPaceTilePlan` function it wires in lives in, and is tested by,
`detail-sections.test.ts`, the same file `breakdownSectionPlan`/`qualitySignalsSectionPlan`/
`pausesSectionPlan` are already tested in. The 35-11 row's `-t "metadata pace unchanged"` filter
never matched any real test name (a zero-match filter reads as a pass and proves nothing, this
project's own carried-forward lesson); the real describe block is named `criterion 4 regression`,
corrected above to `-t "criterion 4"` (6 matched, confirmed non-zero).

**Every command above was re-run live on the merged tree 2026-09-28** (not copied from a plan's
own SUMMARY without re-checking); two matched counts drifted slightly from their SUMMARY's
original figure (`pace-derivation.test.ts -t "35-02"`: SUMMARY said 5, live count is 4;
`pace-single-source.test.ts` SEG-05b filter unchanged at 3) — per the live-count-wins discipline
this project already applies (35-08-SUMMARY.md), the live count is recorded, not the historical
one, and neither drift is a regression (no test was deleted; the difference is in which
pre-existing test the fragment happens to match against the current file).

**Assertion rule (33 D-03 / 33 D-13 / 34 D-22):** every load-bearing row above must assert against a
value derived **outside** the code under test, and must carry a stated CAN FAIL / CAN PASS
reachability proof in both directions. Internal-agreement and absence-only rows pass equally well
against broken code — that shape has shipped a green gate over a broken build in this project twice.

---

## Wave 0 Requirements

- [x] The new running-pace function (`deriveRunningPace`, D-08) + unit tests in
      `src/analytics/pace-derivation.test.ts` — including the pinned **boundary-case test** for a
      sample step straddling an interval edge, and for "near-zero excluded metres, large excluded
      seconds"
- [x] `scripts/compute-running-pace-dispute-calibration.mjs` + `.test.mjs` — D-05's full
      HALT-capable machinery, instantiated from the `compute-pause-classification-calibration.mjs`
      shape
- [x] `scripts/compute-running-pace-recount.mjs` + `.test.mjs` — D-08's zero-import independent
      recount, instantiated from the `compute-unreliable-segment-recount.mjs` shape
- [x] `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` — generated artifact,
      regenerated on the merged tree this plan, byte-identical across two runs (sha256
      `26d2538a...`) and unchanged from its pre-merge value
- [x] Framework install: none — vitest already configured, no new dependency

---

## Manual-Only Verifications

Drafted 2026-09-28 (plan 35-12), before any checkpoint runs. Every row's Expected value was
computed NOW, live, on its own named real input — read from `35-RUNNING-PACE-RECOUNT.md` (D-08's
zero-import recount), `35-CALIBRATION.md` (D-05's calibration artifact and its Gates table), or a
direct query against the merged tree's own regenerated `data/dashboard/index.json` — never from
the rendered page itself, and never from any probe figure in `35-CONTEXT.md` (D-05's contamination
guard). Verdicts are left empty for plan 35-13's browser checkpoint to fill. Row order matches
`35-UI-SPEC.md` § Browser Checkpoint's numbering (rows 1-8).

**A note on 3475724402's own recount divergence, read before Row 1 below:** `35-RUNNING-PACE-RECOUNT.md`'s
zero-import figures for 3475724402 (excludedM 1715.0, excludedSec 767, its own derived pace
305.6 sec/km) differ from the SHIPPED, rendered figures (excludedM 2253.1, excludedSec 797,
running pace 317.6 sec/km). This is not a new finding: it is the pre-existing, already-investigated
`traversal-shape/boundary` divergence recorded in `35-07-SUMMARY.md`'s Reconciliation table, and
re-confirmed on this merged tree by `scripts/compute-running-pace-recount-crosscheck.test.mjs`
(14/14 green; its own archive-wide sweep this run: FULL AGREEMENT=1184, EXPLAINED
DIVERGENCE=690, UNEXPLAINED=0). Row 1 below quotes BOTH figures and the documented bound, rather
than silently picking one.

| Row | Requirement | Activity / surface | Expected (independent source named) | CAN FAIL | CAN PASS | Verdict |
|---|---|---|---|---|---|---|
| R1 | RPACE-01, RPACE-02 (criterion 2) | 3475724402, detail view stats card | Pace tile still reads **4:56/km** (295.9 sec/km, `data/dashboard/index.json` `paceSecPerKm`, unchanged metadata figure). Running Pace tile reads **5:18/km** (317.6 sec/km, the SHIPPED `runningPace.runningPaceSecPerKm`, matching `35-CALIBRATION.md`'s Gates-table basis-gate measurement delta=21.64/ratio=1.0731/badged=true, re-generated this plan). Exclusion line reads verbatim `"Excludes 2253 m over 13:17 of recording gaps, pauses and unreliable segments."` (excludedM 2253.1 → `formatMetres` → `2253 m`; excludedSec 797 → `formatEffortDuration` → `13:17`, both computed live against the shipped fields, not hand-typed). Independent cross-check named above (the note preceding this table): `35-RUNNING-PACE-RECOUNT.md`'s own figures for this activity are excludedM 1715.0 / excludedSec 767 — SMALLER than shipped, an already-EXPLAINED `traversal-shape/boundary` divergence (35-07-SUMMARY.md), not a new finding. | CAN FAIL: The Running Pace tile's value equals the Pace tile's value (317.6 == 295.9 is false today — a genuine equal reading would be a regression), OR the exclusion line is absent, OR it does not read `2253 m` / `13:17` | CAN PASS: Both tiles show non-dash values that visibly differ (5:18/km vs. 4:56/km, a 21.7 sec/km gap — larger than even the recount's own smaller implied gap of ~9.7 sec/km [305.6 recount pace − 295.9 metadata pace], so the two figures differ under EITHER derivation), and the exclusion line reads the quoted sentence verbatim | |
| R2 | RPACE-03 (criterion 3) | 3475724402, detail view Pace tile badge | Badge reads verbatim `"Pace disputed — running 5:18/km"` (5:18/km = Row 1's own Running Pace tile value, `formatPace(317.6)`). Hover/`.sr-only` explanation reads verbatim `"Metadata pace disagrees with the running pace: 5:18/km measured vs. 4:56/km shown"` (`formatPace(317.6)` measured, `formatPace(295.9)` shown — both from the shipped, regenerated index row) | CAN FAIL: Badge is absent, OR its text is not exactly `"Pace disputed — running 5:18/km"`, OR the explanation sentence's two quoted figures do not match 5:18/km and 4:56/km | CAN PASS: Badge present with the exact quoted text, and the explanation sentence names both figures exactly as computed above | |
| R3 | RPACE-01, RPACE-03 (D-01 known consequence) | 5059204779, detail view Running Pace tile | Running Pace tile reads **5:56/km** (355.8 sec/km, live shipped `runningPace.runningPaceSecPerKm`, `formatPace(355.8)`), distinct from the pre-Phase-35 figure of record **5:51/km** (350.6 sec/km, the retired span-based `streamPaceSecPerKm`). The dated amendment note pointing forward to this phase already exists (file-level, confirmed by this plan, not a page render): `.planning/milestones/v2.2-REQUIREMENTS.md` lines 62 and 64 (PACE-03/PACE-07 rows) both read *"Superseded 2026-09-24 (35-CONTEXT.md D-01): the disputed comparator moved from the span-based `streamPaceSecPerKm` to the running pace ..., so 5059204779's stream-derived figure of record now lives in the regenerated `data/dashboard/index.json` and in `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md`."* — the browser's job is only to confirm the ON-SCREEN figure, not the file note | CAN FAIL: The tile reads 5:51/km (the retired figure) instead of 5:56/km, or reads neither | CAN PASS: The tile reads 5:56/km, distinct from 5:51/km, and the developer confirms the note above already exists (file check, not a browser action) | |
| R4 | RPACE-02 (criterion 4, byte-identical boundary) | Activities list (card + table), Overview, any stats widget showing 3475724402 or 5059204779 | 3475724402 reads pace **4:56/km** and moving time **1:06:13** (`movingTimeSec` 3973, `formatDurationHms`) on every surface; 5059204779 reads pace **1:53/km** and moving time **0:20:16** (`movingTimeSec` 1216) on every surface — both byte-identical to their pre-Phase-35 values, independently confirmed by `src/dashboard/views/list.test.ts -t "criterion 4"` (6/6 green), which recomputes `paceSecPerKm` fresh from `movingTimeSec / (distanceM/1000)` rather than reading the row's own field, and asserts `formatPace`/`formatDurationHms` output is byte-identical whether or not `paceDisagreement`/`runningPace` are populated. Paired explicitly with this automated proof per this table's own house rule: a browser-only absence observation is not sufficient alone | CAN FAIL: Any surface shows a pace or moving-time figure other than the four quoted above for either activity, or two surfaces disagree with each other for the same activity | CAN PASS: Every checked surface shows the four quoted figures, matching `list.test.ts -t "criterion 4"`'s own independently-recomputed values exactly | |
| R5 | RPACE-03 (D-09 splits rebase) | 3475734189 — badged under the widened population (ratio 1.04), NOT 5059204779 | Splits footnote reads verbatim `"Splits above are compared against the running pace (5:55/km), not the disputed metadata average."` (5:55/km = `formatPace(355.4)`, the shipped `paceDisagreement.runningPaceSecPerKm`). Km 1's `vs. Avg` cell shows pace **6:16/km** with `aria-label="+21 sec/km vs. average"` — computed live this plan via `computeSplits` against the real stream (`paceSecPerKm` 375.94) and `buildPaceBarCell`'s own `diffSecPerKm = split.pace - activityAvgPace` formula against the REBASED average 355.4: `round(375.94 − 355.4) = +21`. Against the OLD, un-rebased metadata average (341.4) the same split would read `+35` instead (`round(375.94 − 341.4) = +35`) — a genuine, computed discriminator between the rebased and un-rebased wiring | CAN FAIL: The footnote does not read the quoted sentence verbatim, OR Km 1's `vs. Avg` `aria-label` reads `"+35 sec/km vs. average"` (the un-rebased value) or anything other than `"+21 sec/km vs. average"` | CAN PASS: The footnote reads verbatim as quoted, AND Km 1's `aria-label` reads exactly `"+21 sec/km vs. average"` | |
| R6 | RPACE-02 (D-10, not-computable state) | 11865310195 — the archive's one stream-present, not-computable activity | Tile value reads `"—"`. Exclusion line reads verbatim `"Not computable — stream has no covered distance or no covered time"` (the real, non-empty `notComputableReason`, quoted live from the merged tree's `data/dashboard/index.json`, matching `35-RUNNING-PACE-RECOUNT.md`'s own independent count: "No covered distance (recountCoveredM <= 0): 1") | CAN FAIL: The tile shows a numeric value instead of `"—"`, OR the exclusion line's reason text differs, OR the tile is entirely absent (would wrongly conflate not-computable with no-stream) | CAN PASS: The tile and exclusion line read exactly as quoted | |
| R7 | RPACE-02 (D-10, omitted-entirely state) | 18702664326 — a real no-stream activity (confirmed live: this activity has no `runningPace` key at all in `data/dashboard/index.json`, and no `data/streams/18702664326.json` — the same id `npm run verify-dashboard` already asserts 404s) | NO Running Pace tile renders anywhere in the stats card. `buildNoStreamSection`'s existing copy renders below it unchanged — this activity carries no stored stream-unavailable reason, so the exact rendered sentence is `"This activity has no recorded time or distance stream."` (the reason-less branch, confirmed live: this activity's own record carries no reason field) | CAN FAIL: A Running Pace tile (value or exclusion line) appears anywhere in the stats card for this activity | CAN PASS: No Running Pace tile appears, and the no-stream section's sentence reads exactly as quoted | |
| R8 | RPACE-03 (D-03 badge reach) | 3475715143 — badged under the widened population (ratio 1.05), a THIRD distinct badged activity from R2/R5 | The "Pace disputed" badge (and its identical hover/`.sr-only` explanation, `"Metadata pace disagrees with the running pace: 6:51/km measured vs. 6:30/km shown"` — `formatPace(410.6)`/`formatPace(390.2)`, the shipped `paceDisagreement` figures) appears identically on every surface this activity renders on — at minimum the Activities list (card + table); also Overview's "Recent PRs" and "Recent Activities" surfaces if this activity appears there. Source: `35-11-SUMMARY.md`'s D-03 reach argument (all four `RowSurface` values dispatch through the single `appendStatusBadges`/`statusBadgeTexts` function, proven structurally) plus the live, regenerated `paceDisagreement` field (non-null, confirmed 2026-09-28) | CAN FAIL: The badge (or its explanation's two quoted figures) is present on one surface where this activity renders and absent, or different, on another | CAN PASS: The badge and its exact explanation sentence appear identically on every surface where this activity is shown | |

**Assertion rule (33 D-03 / 33 D-13 / 34 D-22, carried into this table):** every row above asserts
against a value derived **outside** the code under test (the recount, the calibration artifact, or
a direct query of the regenerated index/stream data), and carries a CAN FAIL and CAN PASS clause
computed live against its own named real input, per the acceptance criteria this plan was built
under.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every `-t` filtered row records its **matched test count**
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Every load-bearing assertion compares against an independently-derived value
- [ ] Feedback latency < 30s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
