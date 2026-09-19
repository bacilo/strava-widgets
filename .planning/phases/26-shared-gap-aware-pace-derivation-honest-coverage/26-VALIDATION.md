---
phase: 26
slug: shared-gap-aware-pace-derivation-honest-coverage
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-08
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `26-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (existing — keep `fileParallelism: false`, per STATE.md's Phase 24 cross-plan-defect lesson; do **not** re-enable parallelism for this phase's new test files) |
| **Quick run command** | `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts` |
| **Full suite command** | `npm run test` (`vitest run`) |
| **Estimated runtime** | ~30s quick / full suite per existing project baseline |

**Framework install:** none needed — vitest is already configured project-wide.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts`
- **After every plan wave:** Run `npm run test` (full suite, `fileParallelism: false`)
- **Before `/gsd-verify-work`:** Full suite green **+** `tsc --noEmit` **+** `npm run build-widgets` — this project's existing phase-gate convention, confirmed across every prior phase in STATE.md
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Rows below are keyed by requirement and are
filled in with concrete task IDs once `*-PLAN.md` files exist; every task that
touches a requirement below must cite the matching automated command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PACE-01 | — | N/A | unit (grep-based audit) | `npx vitest run src/analytics/pace-single-source.test.ts` | ✅ | ✅ green |
| TBD | TBD | TBD | PACE-02 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "gap boundary"` | ✅ | ✅ green |
| TBD | TBD | TBD | PACE-03 | — | N/A | unit, real committed stream `5059204779` | `npx vitest run src/analytics/pace-derivation.test.ts -t "adaptive window"` | ✅ | ✅ green |
| TBD | TBD | TBD | PACE-04 | — | N/A | unit, real archive | `npx vitest run src/dashboard/views/detail-zones.test.ts -t "PACE-04"` (11 tests; the original `pace-derivation.test.ts -t "histogram"` matched 0 tests — vacuous, repointed 2026-09-19) | ✅ | ✅ green |
| Task 2 | 26-06 | 4 | PACE-05 | — | N/A | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gap marker"` | ✅ (created by 26-06; 8 passing) | ✅ green |
| TBD | TBD | TBD | PACE-06 | — | N/A | integration (script, real archive) | `node scripts/compute-pace-residual.mjs` — diff against committed `26-RESIDUAL.md` | ✅ | ✅ green |
| TBD | TBD | TBD | PACE-07 | T-26-01 | Total/never-throwing on malformed stream input | unit + archive-wide dry run | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pace disagreement"` | ✅ (extended) | ✅ green |
| TBD | TBD | TBD | COV-01 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "coverage sums"` | ✅ | ✅ green |
| Task 2 | 26-06 | 4 | COV-02 | — | N/A | unit (text/structure assertion — no jsdom, per project convention) | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverage caption"` | ✅ (created by 26-06; 5 passing) | ✅ green |
| TBD | TBD | TBD | ERA-03 | — | N/A | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Demonstrated-Failing Cases (Nyquist negative staging)

Every Phase 26 Success Criterion carries a "demonstrated failing" clause. Each negative
case below must be staged and observed failing **before** its positive assertion is trusted.

| # | Negative case staged | Observable that proves the failure | Criterion / Req |
|---|----------------------|-----------------------------------|-----------------|
| 1 | Fixed 20s window instead of adaptive | `5059204779` reads ~94.8% fast mass / ~30% coverage (vs 1.2% / 97% adaptive) | Crit 5 · PACE-03 |
| 2 | Absolute distance-flat pause threshold instead of scale-relative | ~97% of `5059204779` classified as paused despite max time gap of 7s | D-05 · PACE-02 |
| 3 | Gap-boundary clipping removed | Constructed known-duration-gap fixture shows the window bridging the gap | Crit 2 · PACE-02 |
| 4 | Split gap marking removed | Split whose window crosses a gap renders with no marker/legend | Crit 2 · PACE-05 |
| 5 | The `dd <= 0` skip in `computePaceDistribution` (the located defect) | `covered + Σ(excluded by category)` ≠ `t[n-1] - t[0]`; 964/3,394s (28%) unaccounted on `4556693525` | Crit 3 · COV-01 |
| 6 | A second per-sample pace implementation deliberately reintroduced | `pace-single-source.test.ts` fails, naming the offending file | Crit 4 · PACE-01 |
| 7 | Metadata-vs-stream cross-check removed | Dashboard reverts to displaying `5059204779` as 1:53/km as fact | Crit 7 · PACE-07 |
| 8 | Archive sweep re-run against the unfixed per-sample path | Baseline fast-mass values reproduce, confirming the "after" comparison is real | Crit 1 · PACE-04/06 |
| 9 | (26-11, plan 26-11's Task 1) The documented `sum(timeSec) === coverage.coveredSec` invariant asserted against the zero-net-advance `covered` segment flanked by two `recording-gap`s | Watched failing twice, verbatim vitest output (`pace-derivation.test.ts`): `FAIL … demonstrated-failing: the documented invariant is FALSE on the synthetic shape (0 vs 2)` / `AssertionError: expected +0 to be 2` and `FAIL … demonstrated-failing: the documented invariant is FALSE on real archive activity 11865310195 (0 vs 6)` / `AssertionError: expected +0 to be 6` | Crit 3 · COV-01 |
| 10 | (26-12, plan 26-12's Task 1) The coverage caption gated behind `buckets.length` | Watched failing twice, verbatim vitest output (`detail-sections.test.ts`, `breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)`): `renders the pace heading and caption for real activity 11865310195 even though its histogram is empty, from a hand-built fixture` / `AssertionError: expected null not to be null` and `renders the same caption from the real committed stream 11865310195, not just a synthetic look-alike` / `AssertionError: expected null not to be null` — `buildBreakdownSection([], coverage, null)` returned `null` for an activity with 33% covered / 67% recording gaps | Crit 3 · COV-02 |
| 11 | (26-14, plan 26-14's Task 1 RED) The pace chart band's `buildChannelSeries` output compared index-for-index against `derivePaceWithCoverage(stream).paceSeries` on `5059204779` | Watched failing (3 of 5 tests red), verbatim vitest transcript quoted in `26-14-SUMMARY.md`: at the first sample where both series are non-null, `t=175: chart (fixed-20s) y=66.45 s/km   vs   histogram (derivePaceWithCoverage, adaptive-150s) y=498.34 s/km`; the equality assertion failed with `expected [ …(578) ] to deeply equal [ …(1841) ]`; the fast-mass assertion failed with `expected 93.63 to be less than 0.01` | Crit 1/5 · PACE-01 |
| 12 | (26-15, plan 26-15's Task 1 RED) `statusBadgeTexts` on a dashboard-index row with the `paceDisagreement` key genuinely absent | Watched failing (4 of 6 assertions), verbatim vitest transcript quoted in `26-15-SUMMARY.md`: `FAIL src/dashboard/views/list.test.ts > CR-02 — a row whose index predates the paceDisagreement field produces no badge and no crash > statusBadgeTexts returns [] for the missing-key row, matching a clean explicit-null row` / `AssertionError: expected [ 'Pace disputed' ] to deeply equal []`; a separate built-output reproduction threw `TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')` at `paceDisputedExplanation` | PACE-07 · CR-02 |
| 13 | (26-14, plan 26-14's Task 3) The extended single-source audit's real-tree plant, `src/dashboard/views/planted-fixed-window.ts` | Watched failing, verbatim vitest transcript quoted in `26-14-SUMMARY.md`: `× override containment: clipAtGaps / windowSec (colon, comma and shorthand-close forms) / pauseRule / any derivePaceSeriesGapAware( call site appear only in pace-derivation.ts or *.test.ts files` / `AssertionError: override literals found outside pace-derivation.ts/*.test.ts: [{"path":"src/dashboard/views/planted-fixed-window.ts","literal":"windowSec,"},{"path":"src/dashboard/views/planted-fixed-window.ts","literal":"derivePaceSeriesGapAware("}]` | Crit 4 · PACE-01 |

---

## Wave 0 Requirements

- [x] `src/analytics/pace-derivation.ts` + `src/analytics/pace-derivation.test.ts` — the shared module
- [x] `src/analytics/pace-fixtures.ts` + `src/analytics/pace-fixtures.test.ts` — ERA-03 fixture library
- [x] `src/analytics/pace-single-source.test.ts` — D-18's grep-based audit
- [x] `scripts/compute-pace-residual.mjs` — D-19's regenerating script
- [x] `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — D-19's committed deliverable (13 IDs; re-verify against the live archive before committing as final)
- [x] Extend `src/dashboard/views/detail-sections.test.ts` — D-08 caption + D-09 split marker
- [x] Extend `src/analytics/compute-dashboard-index.test.ts` — PACE-07's additive flag field

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage caption reads correctly on screen under the `Pace Distribution` heading, and its percentage equals a hand-sum taken straight from the committed stream file | COV-02, Crit 3 | Criterion 3 requires the value be *read in the browser at the moment of observation*, not asserted from a unit test | Serve the built dashboard, hard-reload (stale `index.html`/`index.json` in staged builds is a known trap), open the pinned exemplar `4556693525`, read the caption percentage back against an independently summed value from `data/streams/4556693525.json`. Pre-computed expectation (plan 26-06, re-derived at execution time from `derivePaceWithCoverage`): `"99% of elapsed time covered · 1% recording gaps · 0% paused"` (spanSec 3394, coveredSec 3363, recordingGapSec 31, pauseSec 0). |
| Split gap marker + legend render legibly at phone widths without breaking the splits table's 7 columns (`Km \| Pace \| Elapsed \| Avg HR \| Avg Cadence \| Elev Δ \| vs. Avg` — confirmed by direct source read, not the 8 columns CONTEXT.md's prose stated) | PACE-05, D-09 | Layout legibility is not assertable from a text/structure test | Hard-reload, open activity `10198771331` (fēnix 6 Pro FIT, span 5225s, distance 11169m — pinned as `gap-crossing-split` in `pace-fixtures.ts`) at narrow viewport (clamped 500..941). Confirm km 11's Pace cell reads `"18:38/km ⚠"` and the legend below the splits table reads exactly `"Km 11: includes 11:29 of recording gap"` — the marker and legend should read as "paused mid-km" not "bad kilometre". Verified at execution time (plan 26-06): `splitGapAnnotations` flags exactly km 11 (recordingGapSec 688, pauseSec 1, totalSec 689 = 11:29), no other split in this activity is flagged. Backups if `10198771331` cannot be reached: `10238432339` (km 17, 515s gap) or `10325703458` (km 2, 273s gap), both also pinned in `pace-fixtures.ts`. |
| PACE-07 badge appears on **both** the detail Pace stat card and the Activities list row (and is considered against all three `renderActivityRow` surfaces) | PACE-07, D-11 | Multi-surface rendering; `idPrefix` pattern makes the list row shared across Activities, Overview Recent Activities, Overview Recent PRs | Hard-reload, sort Activities by pace, confirm `5059204779` ranks #1 **with** its badge visible and is not suppressed from results (D-12) |

*This project has a standing browser-checkpoint convention: per PROJECT.md, automated gates have
missed shipped rendering defects three times. ROADMAP.md marks Phase 26 `UI hint: yes`. A human
browser checkpoint is expected before this phase closes.*

---

## Round 1 Checkpoint (R1-R6)

Prepared by plan 26-10 Task 1, 2026-09-08. All six rows below carry a pre-stated expected value,
derived **before** observation, and an explicit failing-observation description, per this
project's `checkpoint-rows-must-assert-extent` and `checkpoint-rows-can-be-unsatisfiable` lessons.

### Pre-session automated gate (all exited 0, run against the live tree before serving)

| # | Command | Exit code |
|---|---------|-----------|
| 1 | `npm run test` | 0 (1883 passed / 0 failed, 69 files) |
| 2 | `npx tsc --noEmit` | 0 |
| 3 | `npm run build` | 0 |
| 4 | `npm run compute-dashboard-index` | 0 (1890 indexed, **Pace disagreements flagged: 1**) |
| 5 | `npm run build-widgets` | 0 (dashboard SPA + all 11 widgets built; `data/dashboard/*.json` — 1 copied) |
| 6 | `npm run verify-dashboard` | 0 (56 checks passed, 0 failures) |

`git status --porcelain data/streams` — no output (archive byte-identical; `data/dashboard/index.json`
is gitignored per `.gitignore:14`, so its regeneration produces no working-tree diff).

### Served build

- **URL (mounted, production-shaped — matches the GitHub Pages project-page mount D-02 uses):**
  `http://127.0.0.1:4173/strava-widgets/`
- **Server:** `npm run curate` (`scripts/curate-server.mjs`), started detached:
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 &`
- **Restart command if the process is gone:** from the repo root,
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 & disown` (binds `127.0.0.1:4173` only; if you see
  `FATAL: port 4173 is already in use`, a prior instance is still running — that is fine, just reload
  the browser).
- **Staged-build guard (T-26-18), confirmed by fetch against the SERVED URL, not the repo file:**
  `curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json` → activity `5059204779`'s
  row carries `"paceDisagreement":{"streamPaceSecPerKm":350.6,"metadataPaceSecPerKm":112.6,"ratio":3.11}`
  and `"paceSecPerKm":112.6` — matching the freshly regenerated repo artifact exactly, not a stale
  staged copy. `GET /strava-widgets/` → `200`.

### Setup instructions (read before every row)

1. **Hard reload** the page before starting (Cmd+Shift+R / disable cache in DevTools). Staged builds
   in this project have served a stale `index.html`/`index.json` before — pointing at `127.0.0.1`
   alone is not sufficient.
2. Keep the browser viewport within the **500-941 px** band for every row.
3. Routes (hash router): Overview `#/`, Activities list `#/list`, Detail `#/activity/{id}`.

### Row 1 — D-08 / COV-02 — coverage caption, activity `4556693525`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/4556693525`, scroll to `Pace Distribution`.
- **What to read back:** the `.text-label` caption line directly under the `Pace Distribution` heading.
- **Independent derivation method (does NOT import `src/analytics/pace-derivation.ts`):** a
  standalone throwaway Node script (`/tmp/hand-derive-coverage.mjs`, not committed) read
  `data/streams/4556693525.json`'s `t`/`d` arrays directly and reimplemented the classification rule
  from its documented spec in `pace-derivation.ts`'s own comments (read, not imported) — segment
  `[t[i],t[i+1]]` is `recording-gap` if `dt > 10s`; else `pause` if it belongs to a maximal
  distance-flat run (`d[i+1]-d[i] <= 0`) whose duration exceeds `5 * p90(advanceIntervals)` (R-7
  linear-interpolation quantile); else `covered`. Result: `n=1682` samples, `spanSec = t[1681]-t[0] =
  3394`, `coveredSec=3363`, `recordingGapSec=31`, `pauseSec=0`, `coveredSec+recordingGapSec+pauseSec
  = 3394 = spanSec` exactly (sum identity holds). Rounded: **covered 99%, recording gaps 1%, paused
  0%.** (This independently-derived result matches plan 26-06's own pre-computed figure from
  `derivePaceWithCoverage` exactly — expected, since both implement the same documented rule; the
  point of this derivation is that it was computed WITHOUT calling that code.)
- **Pre-stated expected caption (verbatim):** `"99% of elapsed time covered · 1% recording gaps · 0% paused"`
- **PASS if:** the caption is present, names all three categories, and its three percentages equal
  the hand-derived 99/1/0 (or disagree by no more than one point of rounding).
- **FAIL if:** the caption is absent, any of the three named categories is missing, or a percentage
  disagrees with the hand sum by more than one point of rounding.
- **Both-direction check:** satisfiable both ways — a code regression that dropped the caption, or
  that fed the histogram's numbers through a different span, would produce an observably different
  or absent string; a correct render reproduces the hand-derived percentages exactly.

### Row 2 — D-09 / PACE-05 — split gap marker + legend, activity `10198771331`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/10198771331`, scroll to `Splits`.
- **Selected activity (plan 26-06's verified pick, pinned in `pace-fixtures.ts` and by a permanent
  automated assertion in `detail-sections.test.ts`):** `10198771331` (fēnix 6 Pro FIT, span 5225s,
  distance 11169m — confirmed present at `data/streams/10198771331.json`, span 5225s matches).
- **Flagged split:** km 11 only (689s total overlap: 688s recording-gap + 1s pause boundary noise).
- **Pre-stated expected values (verbatim):**
  - Pace-column cell text: `"18:38/km ⚠"`
  - Legend line (below the splits table): `"Km 11: includes 11:29 of recording gap"`
  - That split's own pace number, unchanged from before this phase: `18:38/km` (PACE-05's own
    "splits' own arithmetic is not changed" claim — the marker adds a glyph, never alters the number).
- **PASS if:** the marker and legend both render with the exact strings above, and km 11's Pace
  number reads `18:38/km`.
- **FAIL if:** the marker or legend is absent, the legend does not state a duration, or the pace
  number differs from `18:38/km`.
- **Both-direction check:** satisfiable both ways — this row was previously vacuous (plan 26-10's
  own `<interfaces>` noted no real activity had been selected); plan 26-06 closed that gap by
  selecting and pinning this real activity with a permanent regression test, so a marker/legend
  regression is independently observable in the browser (not merely re-reading the same test).

### Row 3 — D-11 / PACE-07, detail view — Pace stat card, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/5059204779`, Pace stat card.
- **Source data (read from the served, freshly-regenerated index, confirmed above):**
  `paceSecPerKm: 112.6` (metadata), `paceDisagreement.streamPaceSecPerKm: 350.6`.
- **Pre-stated expected values (verbatim):**
  - Stat card big value (unchanged, D-10): `"1:53/km"`
  - Badge line beneath it: `"Pace disputed — stream-derived 5:51/km"`
- **PASS if:** both strings read exactly as above.
- **FAIL if:** the big value differs from `1:53/km`, or the badge is absent or does not name the
  stream-derived figure.
- **Both-direction check:** satisfiable both ways — a code regression silently substituting the
  stream pace for the metadata pace would change the big value (observable FAIL); an omitted badge
  or wrong figure is independently distinguishable from a correct render.

### Row 4 — D-11 / PACE-07, list row — Activities, sorted by pace, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/list`, sort by Pace ascending (fastest first) —
  the "Pace (fastest)" option in the sort `<select>` at narrow widths, or the clickable `Pace` column
  header at wider widths.
- **Independently computed expected position:** sorting the served `index.json`'s 1889
  activities carrying a numeric `paceSecPerKm` ascending by that field places `5059204779`
  (`112.6` sec/km) **first** — no other activity in the archive has a lower `paceSecPerKm` (next
  fastest: `7827165619` at `247.2`). Plan 26-08's own independent verification (against the compiled
  `list-logic.js`) recorded this as `"#1 of 1890"`.
- **Pre-stated expected values:** badge text `"Pace disputed"`; **position: rank #1 (fastest pace in
  the sorted list)** — not merely present.
- **PASS if:** the row appears in the sorted results (not suppressed) at rank #1, with the
  `"Pace disputed"` badge visible.
- **FAIL if:** the row is absent from the sorted results (suppression, forbidden by D-12), the badge
  is missing, or the row's rank differs from #1.
- **Both-direction check:** satisfiable both ways — a suppression regression removes the row
  entirely (observable FAIL distinct from a correct render); a sort-key regression would place it at
  a different, observably wrong rank.

### Row 5 — D-11 / PACE-07, other surfaces — Overview, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/`, Recent Activities and Recent PRs cards.
- **Pre-recorded verdict: NOT EXERCISABLE**, determined before the session by direct inspection of
  the served/regenerated index, independent of the UI:
  - **Recent PRs** filters `rows.filter(row => row.prCount > 0)` (`overview.ts`). `5059204779`'s
    served row carries `"prCount": 0` — it can never qualify, by construction, regardless of any
    other state.
  - **Recent Activities** takes `rows.slice(0, 10)` from the index, which is ordered date-descending
    (confirmed: index entry 0 is `2026-09-07T14:11:59Z`, entry 1889 is `2011-08-16T18:55:32Z`).
    `5059204779`'s `startDate` is `2021-03-25T17:03:15Z`, at **date-descending position 1091 of
    1890** in the served index — far outside the top-10 slice.
  - Both exclusions are independent and structural (a zero PR count; a five-year-old date against a
    live-updating archive), not incidental — this row cannot be forced into either surface without
    fabricating a fixture the plan's own scope does not authorize.
- **Instruction for the session:** confirm this reasoning still holds against the served build (re-check
  `prCount` and the Recent Activities list's actual contents) and record NOT EXERCISABLE with that
  confirmation — never as a silent skip.

### Row 6 — D-13 / PACE-07 — rebased `vs. Avg` baseline, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/5059204779`, splits table `vs. Avg`
  column + caption note below `.splits-scroll`.
- **Pre-stated expected caption (verbatim):**
  `"Splits above are compared against the stream-derived average (5:51/km), not the disputed metadata average."`
- **What to read back:** the caption note verbatim, plus at least one split's `vs. Avg` value or
  `aria-label`, confirming it now reads as a small, plausible delta.
- **PASS if:** the caption note reads exactly as above, and the quoted `vs. Avg` delta is small
  (consistent with comparing against a ~5:51/km baseline) rather than the roughly four-minutes-slow
  reading the old metadata-average baseline (~1:53/km) would have produced against the same
  stream-derived per-split paces.
- **FAIL if:** the note is absent, or the quoted delta is still on the order of four minutes wide.
- **Both-direction check:** satisfiable both ways — a regression that left the baseline unrebased
  would reproduce the ~4-minute-wide deltas PACE-07's problem statement describes (observable FAIL);
  a correct rebase produces small deltas and the disclosure note, both independently readable.

### Verdict table — Round 1, recorded 2026-09-09

Session conducted against the re-verified served build (full gate re-run green on 2026-09-09; see
"Pre-session automated gate" above, all six commands re-executed at HEAD `5743bbfd`). Every
quotation below was supplied by the developer from the browser; none was inferred from an
automated check, per Criterion 3.

| Row | Requirement | Verdict | Verbatim quotation |
|-----|-------------|---------|---------------------|
| R1  | D-08/COV-02 | **PASS** | `99% of elapsed time covered · 1% recording gaps · 0% paused` |
| R2  | D-09/PACE-05 | **PASS** | Pace cell: `18:38/km ⚠` · Legend: `Km 11: includes 11:29 of recording gap` |
| R3  | D-11/PACE-07 | **PASS** | Badge: `Pace disputed — stream-derived 5:51/km` (big value attested unchanged against the pre-stated `1:53/km`) |
| R4  | D-11/PACE-07/D-12 | **PASS** | `pace disputed` under Status; **position: 1** in the pace-sorted list |
| R5  | D-11/PACE-07 | **NOT EXERCISABLE** (justified) | Reasoning re-confirmed against the served build — see below |
| R6  | D-13/PACE-07 | **PASS** | `Splits above are compared against the stream-derived average (5:51/km), not the disputed metadata average.` |

**R1 — Criterion 3 satisfaction.** The caption was read in the browser at the moment of
observation and reconciled against an independent hand sum. The hand derivation was re-run
fresh on 2026-09-09 from `data/streams/4556693525.json` by a throwaway script that does **not**
import `src/analytics/pace-derivation.ts`: n=1682, `spanSec = t[1681] - t[0] = 3394`,
`coveredSec=3363`, `recordingGapSec=31`, `pauseSec=0`, sum identity exact
(3363+31+0 = 3394) → **99% / 1% / 0%**. The quoted caption equals the hand-derived values with
zero rounding divergence.

**R2 — PACE-05's "arithmetic is not changed" clause.** The flagged split's own pace reads
`18:38/km`, identical to the pre-phase value recorded in Round 1's expected column. The marker
adds a glyph; it did not alter the number.

**R4 — D-12 non-suppression.** The row is present in the pace-sorted list at rank 1, matching the
independently computed expectation (sorting the served index's 1889 numerically-paced activities
ascending places `5059204779` at 112.6 s/km first; next fastest `7827165619` at 247.2). Position
stated, not merely presence asserted.

**R5 — NOT EXERCISABLE, re-confirmed 2026-09-09 against the served build** by reproducing
`overview.ts`'s own selection logic rather than by eye (the browser extension was unavailable to
the orchestrator; this row carries no read-in-the-browser clause, unlike R1):
- `Recent PRs` = `rows.filter(r => r.prCount > 0).slice(0, 5)` → `7827165619, 6709874572,
  5059213289, 4598855187, 4556693525`. `5059204779` carries `prCount: 0` — excluded by construction.
- `Recent Activities` = `rows.slice(0, 10)` → ten `i18…` ids, all 2026. `5059204779`'s
  `startDate` `2021-03-25T17:03:15Z` sits at date-descending position **1091 of 1890**.
Both exclusions are structural and independent. Recorded as NOT EXERCISABLE with confirmation,
never as a silent skip.

---

## Findings raised during Round 1 (not patched — gap-closure work, per the plan's own rule)

No row failed. Both items below were surfaced by the developer during the session and are logged
verbatim rather than fixed under checkpoint pressure, per this project's 16-09 / 17-15 / 19-05
precedents.

### F-26-01 — `Moving Time` renders the same corrupted metadata that `Pace disputed` discloses, without disclosure (candidate gap closure)

Raised by the developer on R3: "The 'elapsed' time on splits ends at 1:03:08 (km 11) which seems
about right. Why is the total then listed at 20:16?"

The two figures reconcile exactly, and the reconciliation exposes an incomplete disclosure:

| Figure | Value | Source |
|--------|-------|--------|
| Splits elapsed end (km 11) | 1:03:08 = **3788 s** | stream, `t[last] - t[0]` |
| `Moving Time` stat card | 20:16 = **1216 s** | metadata `moving_time` |

`3788 / 1216 = 3.115` — precisely the `paceDisagreement.ratio: 3.11` the badge reports. Distance
(10804 m) is agreed by both sources, so `10804/1216 = 112.6` s/km (1:53/km, metadata) and
`10804/3788 = 350.6` s/km (5:51/km, stream).

`moving_time` is therefore the **root** corrupted quantity and pace is its derived symptom.
`src/dashboard/views/detail.ts:634` renders the `Moving Time` tile via
`formatDurationHms(movingTimeSec)` with no disclosure badge, immediately beside the `Pace` tile
that does carry one. PACE-07's requirement text names `moving_time: 1216` explicitly as the
defect's origin, so whether this falls inside PACE-07 or opens a successor requirement is a
scoping decision for the next phase — it is **not** settled here.

Evidence that this is a live reader-facing problem rather than a theoretical one: it confused the
developer mid-checkpoint, on the very activity the phase built its disclosure around.

Row R3 still passes on its own terms — the row asserted the big value stayed `1:53/km` and the
badge rendered, and both held. This is a scope gap the row did not assert, not a row failure.

### F-26-02 — thin outlier buckets at both tails of the pace histogram (deferred, non-blocking)

Raised by the developer on R1, explicitly flagged "not a priority". On `4556693525` the
distribution carries many 0.0-0.1 min buckets at both extremes — `1:30-1:45/km` through
`3:00-3:15/km` at the fast tail, and `8:15-8:30/km` through `18:30-18:45/km` at the slow tail.
These are genuine measured samples (that activity is 99% covered), not artefacts of a gap, so
suppressing them is a display decision — trimming, merging tail buckets, or a percentile clamp —
with its own honesty trade-off against COV-02's "coverage is visible to the reader" principle.
Deferred; see `deferred-items.md`.

---

## Validation Sign-Off

Ticked by plan 26-10 Task 2 on 2026-09-09. Items marked `—` are plan-time validation-design
properties owned by earlier plans in this phase; 26-10 does not tick what it did not verify.

- [ ] — All tasks have `<automated>` verify or Wave 0 dependencies *(plan-time design; not re-audited by 26-10)*
- [ ] — Sampling continuity: no 3 consecutive tasks without automated verify *(plan-time design; not re-audited by 26-10)*
- [ ] — Wave 0 covers all MISSING references *(plan-time design; not re-audited by 26-10)*
- [x] No watch-mode flags — verified 2026-09-09: `package.json` `test` is `vitest run`; the only watch entry is the separate opt-in `test:watch`, and `vitest.config.ts` sets no watch flag.
- [x] Feedback latency < 30s — verified 2026-09-09: full suite `npm run test` completed in **12.03s** (1883 tests / 69 files).
- [ ] — All 8 demonstrated-failing cases staged and observed failing before their positive assertion *(owned by plans 26-01…26-09; not re-audited by 26-10)*
- [x] `nyquist_compliant: true` set in frontmatter — set, on the basis that all six Round 1 rows are PASS or a justified NOT EXERCISABLE, with no FAIL and no BLOCKED.

**Approval:** Round 1 recorded and approved 2026-09-09 — five PASS, one justified NOT EXERCISABLE,
zero FAIL, zero BLOCKED. Two findings (F-26-01, F-26-02) logged as gap-closure/deferred work
rather than patched during the session.

---

## Round 2 Checkpoint (R2-1..R2-4)

Prepared by plan 26-13 Task 1, 2026-09-09. Confirms the CR-01 fix (plan 26-12) on screen — the
gap `26-VERIFICATION.md` found by code-path tracing and a live archive scan, never by browser
observation, because `11865310195` was never a Round 1 row. Every row below carries a pre-stated
expected value, derived **before** observation and **without** importing
`src/analytics/pace-derivation.ts` or anything under `dist/analytics/`, plus an explicit
FAIL condition and a both-direction satisfiability note, per this project's
`checkpoint-rows-must-assert-extent` and `checkpoint-rows-can-be-unsatisfiable` lessons.

### Pre-session automated gate (all exited 0, run against the live tree before serving, 2026-09-09)

| # | Command | Exit code |
|---|---------|-----------|
| 1 | `npm run test` | 0 (1895 passed / 0 failed, 69 files) |
| 2 | `npx tsc --noEmit` | 0 |
| 3 | `npm run build` | 0 |
| 4 | `npm run compute-dashboard-index` | 0 (1890 indexed, Pace disagreements flagged: 1) |
| 5 | `npm run build-widgets` | 0 (dashboard SPA + all 11 widgets built; `data/dashboard/*.json` — 1 copied) |
| 6 | `npm run verify-dashboard` | 0 (56 checks passed, 0 failures) |

`git status --porcelain data/streams` — no output (archive byte-identical to what the hand
derivation below reads).

### Served build

- **URL (mounted, production-shaped — matches the GitHub Pages project-page mount D-02 uses):**
  `http://127.0.0.1:4173/strava-widgets/`
- **Server:** `npm run curate` (`scripts/curate-server.mjs`), restarted fresh for this round (a
  stale instance from an earlier session was killed first, so the served bytes are guaranteed to
  come from the rebuild above, not a 2h17m-old process):
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 & disown`
- **Restart command if the process is gone:** from the repo root,
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 & disown` (binds `127.0.0.1:4173` only; if you
  see `FATAL: port 4173 is already in use`, a prior instance is still running — that is fine, just
  reload the browser).
- **Staged-build guard (T-26-26), confirmed by fetch against the SERVED URL, not the repo file:**
  - `curl -s http://127.0.0.1:4173/strava-widgets/data/streams/11865310195.json` →
    `"t":[0,1,2,14,17,18]`, `"d":[0,0,0,0,0,0]` — matches the committed repo file exactly, no stale
    staged copy.
  - `curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json` → activity
    `11865310195`'s row carries `"streams":{"available":true,"hr":false,"cadence":true,"elevation":true,"distanceSource":"native"}`.
  - `GET /strava-widgets/` → `200`.

### Setup instructions (read before every row)

1. **Hard reload** the page before starting (Cmd+Shift+R / disable cache in DevTools). Staged builds
   in this project have served a stale `index.html`/`index.json` before — pointing at `127.0.0.1`
   alone is not sufficient.
2. Keep the browser viewport within the **500-941 px** band for every row.
3. Routes (hash router): Detail `#/activity/{id}`.

### Independent derivation method (does NOT import `src/analytics/pace-derivation.ts` or `dist/analytics/`)

A standalone throwaway Node script (`hand-derive-round2.mjs`, session scratch dir, not committed)
read `data/streams/{id}.json`'s `t`/`d` arrays directly and reimplemented the classification rule
from its documented spec in `pace-derivation.ts`'s own **comments** (read, not imported): segment
`[t[i],t[i+1]]` is `recording-gap` if `dt > 10s` (`RECORDING_GAP_ABS_THRESHOLD_SEC`); else `pause`
if it belongs to a maximal distance-flat run (`d[i+1]-d[i] <= 0`) whose duration exceeds
`5 * p90(advanceIntervals)` (`PAUSE_GAP_P90_MULTIPLIER`, R-7 linear-interpolation quantile); else
`covered`.

**Activity `11865310195`** (`t = [0, 1, 2, 14, 17, 18]`, `d = [0, 0, 0, 0, 0, 0]`): `n=6`. `d`
never advances, so `advanceIntervals = []` and the pause threshold resolves to `Infinity` — nothing
is a pause. Per-segment classification: `[0,1]` dt=1 covered, `[1,2]` dt=1 covered, `[2,14]` dt=12
> 10 **recording-gap**, `[14,17]` dt=3 covered, `[17,18]` dt=1 covered. `spanSec = t[5] - t[0] =
18`. `coveredSec = 1+1+3+1 = 6`. `recordingGapSec = 12`. `pauseSec = 0`. Sum identity:
`6 + 12 + 0 = 18 = spanSec` exactly. Rounded: **33% / 67% / 0%**. Since the histogram is empty
(0 buckets), all 6 covered seconds are unbucketed → `formatEffortDuration(6)` → `"0:06"`.

**Activity `4556693525`** (pinned exemplar, re-derived fresh): `n=1682`, `spanSec = t[1681] - t[0]
= 3394`, `coveredSec=3363`, `recordingGapSec=31`, `pauseSec=0`, sum identity exact
(`3363+31+0 = 3394`). Rounded: **99% / 1% / 0%** — matches Round 1's Row 1 hand derivation exactly
(re-run independently, not re-read from that row).

**Pre-fix reachability, so R2-1/R2-2 are provably failable, not vacuous:** at HEAD before plan
26-12 (`8026cb4b`), `buildBreakdownSection([], coverage, null)` returned `null` for `11865310195`
— no section, no heading, no caption at all. Verbatim watched-failing transcript is table row (10)
above, from `26-12-SUMMARY.md`. Post-fix, the same inputs at HEAD now produce a non-null plan (see
totality check below) — both directions are demonstrated, not assumed.

### Totality check (T-26-29 mitigation — confirms the page can render before a human is asked to look)

Ran a scratch vitest file (session scratch dir, added to `src/analytics/`, run, then deleted —
never committed; `git status --porcelain src/analytics` confirmed empty afterward) asserting each
call in the real render chain (`detail.ts`'s own sequence: `computeSplits` →
`derivePaceWithCoverage` → `computePaceDistribution` → `computeHrZoneTimes` →
`breakdownSectionPlan`) does not throw for `11865310195`'s committed stream:

```
splits.length 0
buckets.length 0
coverage {"spanSec":18,"coveredSec":6,"recordingGapSec":12,"pauseSec":0,"gapIntervals":[{"startSec":2,"endSec":14,"kind":"recording-gap"}]}
zoneTimesNullConfig null
plan {"showPaceHeading":true,"captionText":"33% of elapsed time covered · 67% recording gaps · 0% paused","showBars":false,"noteText":"No pace buckets — 0:06 of covered time produced no derivable pace.","showHrZones":false}

✓ src/analytics/__round2-totality-scratch.test.ts (1 test) 3ms
```

None of the five calls throws; `breakdownSectionPlan` returns non-null with `captionText` and
`noteText` matching the hand derivation above exactly, and `showHrZones: false`. No row below is
unsatisfiable for an unrelated reason — the detail page for `11865310195` does render.

### R2-1 — D-08 / COV-02 / CR-01 — the caption that previously did not render at all, activity `11865310195`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/11865310195`, the `Pace Distribution`
  section.
- **What to read back:** does the `Pace Distribution` section exist at all? Then the `.text-label`
  caption line directly under the heading.
- **Pre-stated expected caption (verbatim):** `"33% of elapsed time covered · 67% recording gaps ·
  0% paused"`, reconciled against the hand sum above (span 18, covered 6, recording gap 12,
  `6 + 12 + 0 = 18`).
- **PASS if:** the section and its caption are present and the three percentages equal the
  hand-derived 33/67/0 (or disagree by no more than one point of rounding).
- **FAIL if:** no `Pace Distribution` section renders, the caption is absent, a named category is
  missing, or a percentage disagrees by more than one rounding point.
- **Both-direction check:** fails against pre-fix code — `buildBreakdownSection` returned `null`
  for this activity at HEAD before 26-12 (table row (10) above), so the row's failing observation
  is demonstrated, not hypothetical; it passes only if the fix works.

### R2-2 — the honest note and the absence of bars, same activity

- **Where:** same page, the `Pace Distribution` section, the `.text-label` line where the histogram
  bars would be.
- **What to read back:** the note line verbatim, and whether any histogram bar row is present.
- **Pre-stated expected verbatim:** `"No pace buckets — 0:06 of covered time produced no derivable
  pace."` (matches the shipped copy confirmed by direct source read of
  `src/dashboard/views/detail-sections.ts:511` and the totality check's own `plan.noteText` above —
  26-12's SUMMARY did not report a different shipped string, so this is quoted, not re-stated). The
  `0:06` is independently derived (18 second span minus the 12 second recording gap = 6 seconds of
  covered time), not read off the code.
- **PASS if:** the note reads exactly as pre-stated **and** zero histogram bar rows are present.
- **FAIL if:** the note is absent, its duration is anything other than `0:06`, or any bar row
  renders.
- **Both-direction check:** a fix that fell back to the stream span rather than the covered seconds
  would render `0:18` — an observably different, distinguishable failure, so the number tests
  reachable extent against an independent value rather than internal agreement.

### R2-3 — no-regression: the pinned exemplar `4556693525` still renders BOTH caption and bars

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/4556693525`, the `Pace Distribution`
  section.
- **Independent derivation (re-run fresh, not re-read from Round 1's Row 1):** `n=1682, spanSec =
  t[1681] - t[0] = 3394`, covered 3363, recording gap 31, pause 0.
- **Pre-stated expected caption (verbatim):** `"99% of elapsed time covered · 1% recording gaps ·
  0% paused"`, **and** at least one histogram bar row visible, whose label the human quotes (a
  `m:ss–m:ss/km` bucket label with its minutes/percentage value).
- **PASS if:** caption matches the hand sum and at least one bar row is quoted.
- **FAIL if:** the caption is absent or disagrees by more than one rounding point, **or** no bar
  rows render.
- **Both-direction check:** this is the inversion guard — a fix that made the caption
  unconditional but dropped the bars would pass R2-1 and R2-2 and fail here, which is the only row
  that can catch that specific regression.

### R2-4 — D-31 preserved now that the section renders where it did not before, activity `11865310195`

- **Where:** same page as R2-1/R2-2, anywhere on the detail page.
- **Independent input:** the SERVED index row's `"hr": false`, confirmed by the curl above; also
  confirmed structurally by the totality check's `zoneTimesNullConfig: null` (the function returns
  `null` because the stream carries no `hr` channel at all — the same absence would hold under the
  app's real, non-null athlete config, since `computeHrZoneTimes` checks `stream.hr` presence
  independently of `config`).
- **What to read back:** does a `Heart Rate Zones` heading, an empty zone panel, or any "no HR
  data"-style copy appear anywhere on the page?
- **Pre-stated expected:** **no** `Heart Rate Zones` heading anywhere on that detail page, no empty
  panel shell, and no "no HR data"-style copy.
- **PASS if:** the breakdown card contains the pace heading, caption and note only.
- **FAIL if:** a `Heart Rate Zones` heading, an empty zone panel, or any placeholder copy appears.
- **Both-direction check:** passable (D-31's behaviour at HEAD, confirmed unregressed by R2-4) and
  newly failable (the card itself did not render for this activity before 26-12, so an empty HR
  shell becomes reachable here for the first time — a regression that added a placeholder alongside
  the newly-rendering pace half would be caught here and nowhere else in this round).

### Verdict table — Round 2, recorded 2026-09-09

Session conducted against the served build described above (all six pre-session gate commands
green, served-path curls verified fresh). Every quotation below was supplied by the developer
from the browser at the moment of observation; none was inferred from an automated check, per
Criterion 3.

| Row | Requirement | Verdict | Verbatim quotation |
|-----|-------------|---------|---------------------|
| R2-1 | D-08/COV-02/CR-01 | **PASS** | `33% of elapsed time covered · 67% recording gaps · 0% paused` |
| R2-2 | CR-01 | **PASS** | `No pace buckets — 0:06 of covered time produced no derivable pace.` |
| R2-3 | D-08/COV-02 no-regression | **PASS** | `99% of elapsed time covered · 1% recording gaps · 0% paused` · bar rows quoted: `1:30–1:45/km` `0.2 min`; `5:30–5:45/km` `8.2 min`; `6:00–6:15/km` `5.5 min` |
| R2-4 | D-31 | **PASS** | "don't see any heart rate section" |

**R2-1 — PASS.** The developer pasted the full section content read on screen:

```
Pace Distribution
33% of elapsed time covered · 67% recording gaps · 0% paused

No pace buckets — 0:06 of covered time produced no derivable pace.
```

The section exists — the developer confirmed this explicitly before quoting anything, satisfying
the row's "does the section exist at all?" clause. The caption line reads exactly `33% of
elapsed time covered · 67% recording gaps · 0% paused`, matching the pre-stated expectation
verbatim and **reconciled against the hand-derived 33/67/0** (span 18, covered 6, recording gap
12, `6 + 12 + 0 = 18`, as derived independently in the section above without importing
`pace-derivation.ts`). The developer additionally noted "section exists but no histogram" — this
is the expected R2-2 condition, not an R2-1 defect, and is not recorded as a finding against this
row.

**R2-2 — PASS.** The note line reads exactly `No pace buckets — 0:06 of covered time produced no
derivable pace.`, matching the pre-stated verbatim string exactly. Zero histogram bar rows are
present — the developer's paste shows the caption and note only, with no bar rows between them
and the end of the section. The `0:06` discriminator held: a span-based fallback would have
rendered `0:18` instead, and did not.

**R2-4 — PASS.** The developer reported: "don't see any heart rate section." No `Heart Rate
Zones` heading, no empty zone panel, and no "no HR data"-style copy were observed anywhere on the
page. D-31 is preserved now that the pace half of the card renders where it previously did not.

**R2-3 — PASS.** Caption read verbatim: `99% of elapsed time covered · 1% recording gaps · 0%
paused`, matching the fresh hand derivation (n=1682, spanSec 3394, covered 3363, recording gap
31, pause 0) with zero rounding divergence. Bars render — the developer pasted roughly 57 bar
rows; sample bar rows quoted verbatim from their paste: `1:30–1:45/km` `0.2 min`; `5:30–5:45/km`
`8.2 min`; `6:00–6:15/km` `5.5 min`. The inversion guard is satisfied: caption AND bars both
render, so a fix that made the caption unconditional but silently dropped the bars is ruled out.

**Note on the R2-3 paste:** the developer's quotation ends at a final `18:30–18:45/km` label with
its value cut off mid-paste. This is a paste truncation in the developer's message, not a missing
value on screen, and is not recorded as a finding or a partial failure.

**Orchestrator cross-check (supplementary evidence, orchestrator-computed — NOT one of the four
human verdicts above, and not itself a checkpoint row).** Plan 26-12 shipped a second note branch
("Bars below omit N of covered time…") that renders alongside the histogram whenever
`unbucketedCoveredSec > 0`. The developer's R2-3 paste shows bars with no such note present,
which would indicate residue if `4556693525` carried any unbucketed covered time. Computed via
the D-16 entry point `derivePaceWithCoverage` for both activities:
- `4556693525`: `coveredSec 3363`, `bucketedSec 3363`, **`unbucketedSec 0`**, 1679 samples.
- `11865310195`: `coveredSec 6`, `bucketedSec 0`, **`unbucketedSec 6`**, 0 samples.

`4556693525` has zero unbucketed covered seconds, so the absence of the second note branch on
that activity is **correct behaviour**, not a missing branch — this cross-check corroborates
R2-3's PASS rather than contradicting it. This paragraph is orchestrator-computed supplementary
evidence, not a fifth human-observed row, and does not substitute for or alter any of the four
recorded verdicts above.

Every quotation in the verdict table and its per-row narrative above came verbatim from the
developer's message reporting what they read in the browser; no verdict was inferred from an
automated check.

---

## Round 3 Checkpoint (R3-1..R3-4)

Confirms CR-03 (chart band overriding the adaptive window) and CR-02 (a stale `index.json`
missing `paceDisagreement` producing a false badge/crash) closed, on a real rendered page. Session
prepared 2026-09-09 by plan `26-16`, Task 1.

### Pre-session automated gate (all exited 0, run against the live tree before serving, 2026-09-09)

| # | Command | Exit code | Notes |
|---|---------|-----------|-------|
| 1 | `npm run test` | `0` | 69 test files, **1907/1907** tests passed |
| 2 | `npx tsc --noEmit` | `0` | clean |
| 3 | `npm run build` | `0` | clean |
| 4 | `npm run compute-dashboard-index` | `0` | 1890 indexed, 1865 with streams, pace disagreements flagged: 1 (unchanged, `git status --short data/` empty afterward) |
| 5 | `npm run build-widgets` | `0` | clean; private-artifact scan and curation-artifact scan both clean |
| 6 | `npm run verify-dashboard` | `0` | **56 check(s) passed, 0 failure(s)** |

`git status --porcelain data/streams` — empty. The committed stream archive read by the
independent-derivation script below is byte-identical to what `dist/analytics` and
`dist/dashboard` were built from in gate step 3.

### Served build (defeats the staged-build cache trap — T-26-39)

Served via `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 &`. Served root named in
`scripts/curate-server.mjs`: `const ROOT = resolve(process.cwd(), 'dist/widgets')`, mounted at
`MOUNT_PREFIX = '/strava-widgets'` on `CURATE_PORT = 4173` — i.e.
`http://127.0.0.1:4173/strava-widgets/` serves `dist/widgets`, a BUILD OUTPUT tree, never the
repo's `data/` directory directly.

`curl` against the SERVED path (not the repo file), recorded verbatim:

```
$ curl -s http://127.0.0.1:4173/strava-widgets/data/streams/5059204779.json | head -c 120
{
  "schemaVersion": 1,
  "id": "5059204779",
  "source": "fit",
  "distanceSource": "native",
  "sampleCount": 1893,
```

The `head -c 120` window lands inside this stream's JSON header (`schemaVersion`/`id`/etc.) rather
than the `t` array body, which appears later in the object — but it proves the served bytes are
`5059204779`'s own file (id matches, byte-identical to the repo file's own first 120 bytes,
confirmed separately). The `t` array's own leading values, read by parsing the full served
response, are `[0, 7, 9, 11, 13, 15, 17, 19, 21, 23]`.

The served `data/dashboard/index.json`, BEFORE doctoring, carries the `5059204779` row with a
non-null `paceDisagreement`:

```json
{
  "id": "5059204779",
  ...
  "paceDisagreement": {
    "streamPaceSecPerKm": 350.6,
    "metadataPaceSecPerKm": 112.6,
    "ratio": 3.11
  },
  "gearName": "Shoe 6"
}
```

`sha256sum` of the ORIGINAL `dist/widgets/data/dashboard/index.json`, recorded before any
doctoring — **R3-4 restores to this exact digest**:

```
b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da  dist/widgets/data/dashboard/index.json
```

### Setup instructions (read before every row)

1. Keep the browser viewport within the **500-941 px** band.
2. **Hard reload** (Cmd+Shift+R, or disable cache in DevTools) before starting, and again after
   any rebuild or fixture edit — staged builds in this project have served a stale `index.html`/
   `index.json` before (T-26-39).
3. R3-1 and R3-3 need this exact console snippet, pasted BEFORE the band re-renders (a full page
   reload discards a prototype patch; a hash-route change does not):

```js
window.__ticks = [];
const _origFillText = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
  window.__ticks.push(text);
  return _origFillText.apply(this, [text, ...rest]);
};
```

   After pasting, navigate to `#/list` and back to the target `#/activity/<id>` so the bands
   redraw under the patch, then evaluate and quote:

```js
[...new Set(window.__ticks.filter((s) => /^\d+:\d{2}\/km$/.test(s)))]
```

   The x-axis tick format is `M:SS` (time mode) or `N.N km` (distance mode) — neither matches the
   anchored `/^\d+:\d{2}\/km$/` regex, so it cleanly isolates the pace y-axis. The tooltip label
   reads `Pace: M:SS/km`, which also does not match the anchored regex.

### Independent-derivation script and verbatim output

Script (`round3-derive.mjs`, throwaway, run from the repo root with `dist/analytics/` and
`dist/dashboard/views/*.js` imported as built by gate step 3 above; reads
`data/streams/5059204779.json` and `data/streams/4556693525.json` directly — **does not** import
any pre-computed table from this plan):

```js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = '/Users/pedf/workspace/strava-widgets';

const { derivePaceWithCoverage, adaptiveWindowSec, PACE_WINDOW_FLOOR_SEC } = await import(
  pathToFileURL(path.join(ROOT, 'dist/analytics/pace-derivation.js')).href
);
const { computePaceDistribution } = await import(
  pathToFileURL(path.join(ROOT, 'dist/dashboard/views/detail-zones.js')).href
);
const { buildChannelSeries } = await import(
  pathToFileURL(path.join(ROOT, 'dist/dashboard/views/detail-charts-logic.js')).href
);
const { computeSplits } = await import(
  pathToFileURL(path.join(ROOT, 'dist/dashboard/views/detail-splits.js')).href
);

function formatPace(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}
function loadStream(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/streams', id + '.json'), 'utf8'));
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function analyzeActivity(id) {
  console.log('=== Activity', id, '===');
  const stream = loadStream(id);
  const t = stream.t, d = stream.d;
  const aw = adaptiveWindowSec(t, d);
  console.log('adaptiveWindowSec:', aw);
  const adaptive = derivePaceWithCoverage(stream);
  const floor = derivePaceWithCoverage(stream, { windowSec: PACE_WINDOW_FLOOR_SEC });

  function seriesStats(res, label) {
    const vals = res.paceSeries.filter((v) => v !== null && Number.isFinite(v) && v > 0);
    if (vals.length === 0) { console.log(label, '— no non-null samples'); return null; }
    const min = Math.min(...vals), max = Math.max(...vals), med = median(vals);
    console.log(label, 'windowSec=' + res.windowSec, 'n=' + vals.length,
      'min=' + formatPace(min) + ' (' + min.toFixed(1) + 's/km)',
      'median=' + formatPace(med) + ' (' + med.toFixed(1) + 's/km)',
      'max=' + formatPace(max) + ' (' + max.toFixed(1) + 's/km)');
    return { min, max, med, vals };
  }
  const adaptiveStats = seriesStats(adaptive, 'ADAPTIVE (post-fix chart)');
  const floorStats = seriesStats(floor, 'FIXED-20s (pre-fix chart)');

  const dist = computePaceDistribution(adaptive, t);
  console.log('Histogram bucket count:', dist.length,
    'first:', dist[0] ? dist[0].label : 'NONE',
    'last:', dist.length ? dist[dist.length - 1].label : 'NONE');

  function fastFractionDirect(res, denomLabel) {
    const vals = res.paceSeries;
    let fastDt = 0, totalDt = 0;
    for (let i = 1; i < t.length; i++) {
      const dt = t[i] - t[i - 1];
      if (dt <= 0) continue;
      const v = vals[i];
      if (v === null || !Number.isFinite(v)) continue;
      totalDt += dt;
      if (v < 180) fastDt += dt;
    }
    const frac = totalDt > 0 ? fastDt / totalDt : NaN;
    console.log('Fast-mass <180s/km (' + denomLabel + '):', (frac * 100).toFixed(2) + '%',
      'fastDt=' + fastDt, 'totalDt(denominator=sum of dt across non-null samples in this series)=' + totalDt);
    return frac;
  }
  fastFractionDirect(adaptive, 'adaptive window');
  fastFractionDirect(floor, 'fixed-20s floor window');

  const seriesTime = buildChannelSeries(stream, 'pace', 'time');
  const seriesDistance = buildChannelSeries(stream, 'pace', 'distance');
  const splits = computeSplits(stream);
  console.log('Totality: buildChannelSeries(time) len=' + seriesTime.length,
    'buildChannelSeries(distance) len=' + seriesDistance.length,
    'derivePaceWithCoverage paceSeries len=' + adaptive.paceSeries.length,
    'computePaceDistribution buckets=' + dist.length,
    'computeSplits len=' + splits.length);

  if (floorStats) console.log('Pre-fix (fixed-20s) extent max = ' + floorStats.max.toFixed(1) + 's/km = ' + formatPace(floorStats.max) + ' -> no Chart.js tick above this can appear pre-fix');
  if (adaptiveStats) console.log('Post-fix (adaptive) extent max = ' + adaptiveStats.max.toFixed(1) + 's/km = ' + formatPace(adaptiveStats.max) + ' -> Chart.js must place a tick at/above this region post-fix');
}

analyzeActivity('5059204779');
console.log('');
analyzeActivity('4556693525');
```

Verbatim output:

```
=== Activity 5059204779 ===
adaptiveWindowSec: 150
ADAPTIVE (post-fix chart) windowSec=150 n=1841 min=2:27/km (147.1s/km) median=5:40/km (340.1s/km) max=17:29/km (1049.0s/km)
FIXED-20s (pre-fix chart) windowSec=20 n=578 min=0:30/km (30.5s/km) median=1:58/km (118.3s/km) max=4:27/km (266.7s/km)
Histogram bucket count: 36 first: 2:15–2:30/km last: 17:15–17:30/km
Fast-mass <180s/km (adaptive window): 1.22% fastDt=45 totalDt(denominator=sum of dt across non-null samples in this series)=3681
Fast-mass <180s/km (fixed-20s floor window): 94.81% fastDt=1095 totalDt(denominator=sum of dt across non-null samples in this series)=1155
Totality: buildChannelSeries(time) len=1841 buildChannelSeries(distance) len=1841 derivePaceWithCoverage paceSeries len=1893 computePaceDistribution buckets=36 computeSplits len=11
Pre-fix (fixed-20s) extent max = 266.7s/km = 4:27/km -> no Chart.js tick above this can appear pre-fix
Post-fix (adaptive) extent max = 1049.0s/km = 17:29/km -> Chart.js must place a tick at/above this region post-fix

=== Activity 4556693525 ===
adaptiveWindowSec: 20
ADAPTIVE (post-fix chart) windowSec=20 n=1682 min=1:35/km (95.2s/km) median=5:45/km (344.8s/km) max=18:31/km (1111.1s/km)
FIXED-20s (pre-fix chart) windowSec=20 n=1682 min=1:35/km (95.2s/km) median=5:45/km (344.8s/km) max=18:31/km (1111.1s/km)
Histogram bucket count: 52 first: 1:30–1:45/km last: 18:30–18:45/km
Fast-mass <180s/km (adaptive window): 2.42% fastDt=82 totalDt(denominator=sum of dt across non-null samples in this series)=3394
Fast-mass <180s/km (fixed-20s floor window): 2.42% fastDt=82 totalDt(denominator=sum of dt across non-null samples in this series)=3394
Totality: buildChannelSeries(time) len=1682 buildChannelSeries(distance) len=1682 derivePaceWithCoverage paceSeries len=1682 computePaceDistribution buckets=52 computeSplits len=11
Pre-fix (fixed-20s) extent max = 1111.1s/km = 18:31/km -> no Chart.js tick above this can appear pre-fix
Post-fix (adaptive) extent max = 1111.1s/km = 18:31/km -> Chart.js must place a tick at/above this region post-fix
```

A supplementary probe (same script, extended) confirms `5059204779`'s modal histogram bar and full
coverage, independent of the planner's stated figures:

```
modal bucket: 5:00–5:15/km 444s
spanSec: 3788
coverage: {"spanSec":3788,"coveredSec":3788,"recordingGapSec":0,"pauseSec":0,"gapIntervals":[]}
```

**Reproduction against the planner's `<interfaces>` table: every figure reproduced exactly** —
`adaptiveWindowSec` (150 / 20-floor), adaptive extent (`2:27/km → 17:29/km`, median `5:40/km`;
`1:35/km → 18:31/km` identical under both windows), fixed-20s extent (`0:30/km → 4:27/km`, median
`1:58/km`), histogram bar counts and first/last labels (36 bars `2:15–2:30/km`/`17:15–17:30/km`;
52 bars `1:30–1:45/km`/`18:30–18:45/km`), modal bucket (`5:00–5:15/km` at 444s) and span (3,788s,
fully covered). No figure differed materially; no discriminating margin collapsed. Fast-mass
denominator, stated explicitly: **the sum of real `Δt` across all non-null samples in the series
under test** (`totalDt` above) — 1.22% / 94.81% for `5059204779` (adaptive / fixed-20s), 2.42% /
2.42% for `4556693525` (identical because its adaptive window resolves to the 20s floor).

### Failability of the discriminators (pinned before any human looks)

**R3-1 (largest tick, activity `5059204779`).** Pre-fix, the entire plotted extent tops out at
`266.7 sec/km` — no Chart.js tick can be placed above `5:00/km`. Post-fix, the extent reaches
`1,049.0 sec/km` — Chart.js must place its largest tick at or above `15:00/km` to cover that range.
FAIL condition: the largest captured tick is `5:00/km` or faster.

**R3-2 (tooltip, activity `5059204779`).** Pre-fix, the series median is `1:58/km` (118.3 s/km) and
its fastest sample `0:30/km` (30.5 s/km) — most of five spread-out hover points would read faster
than `2:27/km`. Post-fix, the fastest sample in the series is `2:27/km` (147.1 s/km) by
construction — no hover can read faster. FAIL condition: any quoted tooltip value faster than
`2:27/km`.

**R3-3 (regression control, activity `4556693525`).** Both windows produce an identical
`1,111.1 sec/km` extent (`18:31/km`) because this activity's adaptive window resolves to the 20s
floor — the row is expected to PASS under both pre-fix and post-fix code and is not a
discriminator.

**R3-4 (stale index, CR-02).** Pre-fix (pre-26-15) reproduction from `26-REVIEW.md`: every row
with the key absent produced the `Pace disputed` badge and `paceDisputedExplanation` threw
`TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')`. Post-fix
(26-15's `rowPaceDisagreement`), the absent key resolves to `null` at both call sites. FAIL
condition: every row carries the badge, or the list is blank, or that `TypeError` appears.

### Totality check (confirms nothing throws before a human is asked to look)

From the independent-derivation script's own totality line, for both activities:
`buildChannelSeries(stream, 'pace', 'time')`, `buildChannelSeries(stream, 'pace', 'distance')`,
`derivePaceWithCoverage`, `computePaceDistribution` and `computeSplits` all returned without
throwing, all non-empty:

- `5059204779`: `buildChannelSeries(time)=1841`, `buildChannelSeries(distance)=1841`,
  `derivePaceWithCoverage.paceSeries=1893`, `computePaceDistribution buckets=36`,
  `computeSplits=11`.
- `4556693525`: `buildChannelSeries(time)=1682`, `buildChannelSeries(distance)=1682`,
  `derivePaceWithCoverage.paceSeries=1682`, `computePaceDistribution buckets=52`,
  `computeSplits=11`.

No row below is unsatisfiable for an unrelated reason — both detail pages render, and `#/list`
(exercised separately for R3-4) is unaffected by either activity's data.

### R3-4 fixture, staged now (not during the session)

`dist/widgets/data/dashboard/index.json` copied aside (original digest above), then doctored: every
row's `paceDisagreement` key **deleted** (`delete row.paceDisagreement`, not set to `null`) — 1890
of 1890 rows carried the key before deletion, all 1890 had it removed.

`sha256sum` of the DOCTORED file:

```
0f914382bd3732979047f4fa05d41a2af6169fb675b30e11838537292ecbda22  dist/widgets/data/dashboard/index.json
```

`curl` of the served doctored path, proving the key is gone and the row count is unchanged:

```
$ curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json | node -e "... count rows with 'paceDisagreement' in a ..."
served row count: 1890 rows still carrying paceDisagreement key: 0
$ curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json | sha256sum
0f914382bd3732979047f4fa05d41a2af6169fb675b30e11838537292ecbda22  -
```

The served digest matches the on-disk doctored digest exactly. Restoration is a rebuild
(`npm run build-widgets`), verified in Task 2 against the ORIGINAL digest recorded above, not a
hand edit.

### R3-1 — CR-03 discriminator, activity `5059204779`, chart-vs-histogram extent against an independently derived value

**Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/5059204779`, the Pace chart band and
the `Pace Distribution` DOM list on the same page.

**Procedure:** paste the fillText-patch snippet above, navigate to `#/list` and back to
`#/activity/5059204779`, then evaluate
`[...new Set(window.__ticks.filter((s) => /^\d+:\d{2}\/km$/.test(s)))]` and quote the printed
array. Separately quote the FIRST and LAST bar labels from the DOM `Pace Distribution` list.

**Expected:** the captured tick array's largest value is at least `15:00/km`; the histogram's first
and last bar labels are `2:15–2:30/km` and `17:15–17:30/km` (independently re-derived above); the
chart's largest tick and the histogram's last bar both bracket the independently derived series
maximum of `17:29/km` (1,049.0 s/km).

**This row does NOT merely ask whether the two surfaces agree with each other — it pins both to
`17:29/km`, computed from the committed stream file outside the code under test**, per this
project's own "checkpoint rows must assert extent" lesson.

**FAIL:** the largest captured tick is `5:00/km` or faster — the signature of the fixed-20s series,
whose whole extent tops out at `4:27/km`.

**Both-direction note:** failable (the pre-fix chart's fixed-20s series cannot produce a tick above
`5:00/km` — its whole extent is `266.7 sec/km`) and passable (the post-fix extent reaches
`1,049.0 sec/km`, so Chart.js must place a tick at or above `15:00/km`).

### R3-2 — CR-03 fast end, activity `5059204779`, tooltip readout

**Where:** same page, hovering the Pace chart band.

**Procedure:** hover at roughly five positions spread across the band's width; quote each
tooltip's `Pace: M:SS/km` value verbatim.

**Expected:** no quoted value is faster than `2:27/km` (the independently derived fastest sample in
the 150s adaptive series); most cluster around `5:40/km` (its median).

**FAIL:** any quoted value faster than `2:27/km`.

**Both-direction note:** failable (pre-fix the series median is `1:58/km` and its fastest sample
`0:30/km`, so most hover points would violate it) and passable (post-fix no value faster than
`2:27/km` exists in the series by construction). Requires a real pointer gesture — not reachable
from an automated check; a human is required.

### R3-3 — no-regression control, activity `4556693525`

**Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/4556693525`, same tick-capture snippet
and the `Pace Distribution` DOM list.

**Expected:** the captured tick array's largest value is at least `15:00/km` (extent reaches
`18:31/km` under BOTH windows, since this activity's adaptive window resolves exactly to the 20s
floor); the histogram still shows 52 bars, first label `1:30–1:45/km`, last label `18:30–18:45/km`
(independently re-derived above).

**FAIL:** the chart or the histogram differs from the pre-fix state in any way.

**Both-direction note: this row is a REGRESSION CONTROL, not a discriminator — it passes both
before and after the fix, by design.** Its job is to catch the opposite failure: a fix that
widened the window for every activity instead of resolving it per activity. A PASS here is not, by
itself, evidence that CR-03 closed.

### R3-4 — CR-02, Activities list against a stale index

**Where:** `http://127.0.0.1:4173/strava-widgets/#/list`, sorted by pace, against the DOCTORED
`index.json` staged above.

**Procedure:** hard reload, sort by pace, report: whether the list renders at all, whether ANY row
shows a `Pace disputed` badge, and whether the browser console shows a `TypeError`.

**Expected:** the list renders normally, zero `Pace disputed` badges appear anywhere, console is
free of `TypeError`.

**FAIL:** every row carries the badge, or the list is blank, or
`TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')` appears.

**Both-direction note:** failable (this is the exact reproduction from `26-REVIEW.md`'s CR-02,
which threw against the shipped build before plan 26-15) and passable (26-15's
`rowPaceDisagreement` resolves the absent key to `null` at both call sites).

**Restore procedure (after the developer reports, regardless of verdict):** run
`npm run build-widgets` and confirm `sha256sum dist/widgets/data/dashboard/index.json` matches the
ORIGINAL digest `b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da` recorded above.

### Staged-failing observation of Task 2's own automated check (T-26-40 mitigation)

Ran Task 2's `<automated>` command verbatim (its exact source lives in the Task 2 block of
`26-16-PLAN.md` — not re-quoted here, since its regex pattern literal itself contains the very
token this task is forbidden from writing), against the exact state this task leaves behind: four
rows exist above, four `FAIL:` condition sentences are on the page, and Task 2's real transcription
heading and its four per-row lines have not been written by this task (a grep for the real heading
anchored at line-start, `^## Round 3 Verdicts`, outputs `0` at this point — see the
acceptance-criteria greps recorded earlier in this section).

Recorded exit code and stderr, run from the repo root:

```
$ node -e "<Task 2's <automated> command, run verbatim>"
expected four distinct transcribed verdict lines R3-1..R3-4, found 0 []
$ echo $?
1
```

Exit code **1** (non-zero) — the check refuses to pass even though the page carries four staged
`FAIL:` condition sentences and no human has said anything. Note on the check's own mechanics,
recorded for transparency: the check's `indexOf` lookup for its trigger heading is an unanchored
substring search, so on this exact run it matched this very section's own earlier prose (which
names that heading string in backticks while explaining the check), before it would have matched
a real `^##`-anchored heading further down — landing its search cursor inside this explanatory
paragraph rather than short-circuiting immediately with a "no heading found" message. This does
not weaken the check: it still requires four distinct per-row transcription lines somewhere after
that cursor, and this task has written none, so it still failed closed, exiting non-zero with the
message quoted above. When Task 2 appends its real heading and four transcription lines later in
the file, they fall after this same early substring match and are still found by the scan — so
the check's pass path is unaffected by this document naming its own trigger string. This
demonstrates the check is scoped to four per-row transcription lines, not to the word `FAIL`
occurring anywhere on the page — it cannot be satisfied by this task's own staged negative-case
prose.

---

## Round 3 Verdicts

R3-1 Verdict: PASS
R3-2 Verdict: PASS
R3-3 Verdict: PASS
R3-4 Verdict: PASS

Session conducted 2026-09-10 by the developer against the served build described in the Round 3
setup above (all six pre-session gate commands green, served-path curls verified fresh, viewport
held in the 500-941 px band, hard reload performed before each row). Every quotation below is
verbatim from the developer's reply; none is inferred from an automated check — the transcription
check above proves only that this heading and these four lines exist, not that any verdict is
true.

| Row | Requirement | Verdict | Verbatim quotation |
|-----|-------------|---------|---------------------|
| R3-1 | D-01/D-16/PACE-01/CR-03 | **PASS** | Tick array: `(6) ['3:20/km', '6:40/km', '10:00/km', '13:20/km', '16:40/km', '20:00/km']`; histogram bars `"2:15–2:30/km"` / `"17:15–17:30/km"` |
| R3-2 | PACE-01/CR-03 | **PASS** | "fasest i can see is 2:27. I would say most of them are around 5:00 rather than 5:40 though." |
| R3-3 | PACE-01 no-regression control | **PASS** ("PASS I GUESS") | 52 bars, first `"1:30–1:45/km"`, last `"18:30–18:45/km"` |
| R3-4 | PACE-07/CR-02 | **PASS** | "renders normally, clean console except for: GET http://127.0.0.1:4173/favicon.ico 403 (Forbidden) and [Facebook Extractor] Starting extraction... content.js:1 [Facebook Extractor] No video data found in page (maybe from a plugin or something)? and no badges shown." |

**R3-1 — PASS.** The developer patched `CanvasRenderingContext2D.prototype.fillText`, navigated
`#/list` → `#/activity/5059204779` to force a redraw under the patch, and quoted the captured tick
array verbatim:

```
(6) ['3:20/km', '6:40/km', '10:00/km', '13:20/km', '16:40/km', '20:00/km']
```

The largest captured tick is `20:00/km`, which is at or above the pre-stated `15:00/km` FAIL
threshold and brackets the independently derived series maximum of `17:29/km` (1,049 s/km)
against the axis's own `20:00/km` (1,200 s/km) top tick. This value is unreachable under the
fixed-20s window, whose entire plotted extent topped out at `4:27/km` (266.7 s/km) — so this row
is the discriminator working as designed, not two surfaces merely agreeing with each other.

The developer separately quoted the histogram's first and last bar labels verbatim: `"2:15–2:30/km"`
and `"17:15–17:30/km"` — matching the independently re-derived values from Task 1 exactly.

**R3-2 — PASS, with a recorded observation, not smoothed into the verdict.** The developer's
reply, verbatim: "PAS: fasest i can see is 2:27. I would say most of them are around 5:00 rather
than 5:40 though."

The fastest hovered value, `2:27/km`, satisfies the row's FAIL condition — nothing was quoted
faster than `2:27/km`, the independently derived fastest sample in the 150s adaptive series. The
row is a PASS on its stated expectation.

**Deviation, recorded as its own finding per this row's instruction (not forced into the
verdict):** the developer's hovered values clustered nearer `5:00/km` than the pre-stated median
of `5:40/km`. The sample was roughly five hover points, so this is plausibly sampling scatter
against a Δt-weighted median rather than a defect — a small, non-uniform sample of pointer
positions is not expected to reproduce a time-weighted statistic exactly. This is a departure from
a pre-stated expectation and is recorded honestly rather than rounded away; it does not change the
PASS verdict, which rests solely on the fast-end FAIL condition (`2:27/km`), not on the median
clustering.

**R3-3 — PASS (control row), with caveats recorded honestly.** The developer quoted the
histogram's bar labels in full; the orchestrator counted 52 bars, first `"1:30–1:45/km"`, last
`"18:30–18:45/km"` — all three match the pre-stated expectation from the independent derivation.

Caveats, stated plainly rather than omitted:
- The tick-capture snippet's output array was **not** captured for this row — only the histogram
  labels were quoted by the developer.
- The developer expressed their own uncertainty in the reply, verbatim: "PASS I GUESS".
- **This row is a control, not a discriminator, and its PASS carries no evidentiary weight toward
  closing CR-03.** Activity `4556693525`'s adaptive window resolves exactly to the 20s floor, so
  its chart and histogram render identically whether or not CR-03 is fixed. Its job is only to
  rule out a fix that widened the averaging window for every activity instead of resolving it
  per-activity — which it does, since nothing here regressed. The discriminating weight for CR-03
  closure rests on R3-1 and R3-2 alone.

**R3-4 — PASS.** The developer's reply, verbatim: "renders normally, clean console except for: GET
http://127.0.0.1:4173/favicon.ico 403 (Forbidden) and [Facebook Extractor] Starting extraction...
content.js:1 [Facebook Extractor] No video data found in page (maybe from a plugin or something)?
and no badges shown."

The list rendered, zero `Pace disputed` badges appeared anywhere, and no
`TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')` occurred — the row
passes both stated conditions. The `favicon.ico 403` is the static file server (`curate-server.mjs`)
declining a request for an icon that does not exist in `dist/widgets`, not application code. The
"Facebook Extractor" lines originate from a browser extension's injected `content.js`, not from
this application's bundle. Neither line is treated as a `TypeError` or as evidence against the
row; the console is clean for the purposes of this row's FAIL condition.

**Provenance check (orchestrator-confirmed before the human looked, T-26-42 mitigation).** The
canonical `data/dashboard/index.json` carries `paceDisagreement` on all 1890 rows; the served
`dist/widgets/data/dashboard/index.json` at the time of this row carried it on 0 rows (confirmed
by `curl` above, § "R3-4 fixture"). The discriminator was genuine, not vacuous.

Every quotation in the verdict table and its per-row narrative above came verbatim from the
developer's message reporting what they read in the browser; no verdict was inferred from an
automated check.

**Restore, performed after all four rows were recorded, regardless of verdict (T-26-42
mitigation).** First attempt was `npm run build-widgets` alone; its `data/dashboard` copy step
reported `(0 copied, 1 skipped)` and the doctored digest was unchanged afterward — `copyJsonTree`
(`scripts/lib/copy-data-tree.mjs`) contains an mtime-based efficiency guard ("skip the copy when
the destination is already up to date") that compares `destMtime >= srcMtime`; because the
doctoring in Task 1 touched the dest file's mtime AFTER the untouched repo source's mtime, the
guard concluded the doctored copy was already current and skipped recopying it. This is a Rule 1
bug found during restoration, not a defect in the fixture or the verdicts above — it is fixed by
forcing the copy directly from the known-good repo source rather than relying on the mtime guard:

```
$ npm run build-widgets
... (0 copied, 1 skipped for data/dashboard — mtime guard skipped the doctored file, see above)
$ sha256sum dist/widgets/data/dashboard/index.json
0f914382bd3732979047f4fa05d41a2af6169fb675b30e11838537292ecbda22  dist/widgets/data/dashboard/index.json   # still doctored — digest mismatch caught here
$ sha256sum data/dashboard/index.json
b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da  data/dashboard/index.json   # repo source confirmed matches the ORIGINAL digest exactly
$ cp data/dashboard/index.json dist/widgets/data/dashboard/index.json
$ npm run build-widgets   # re-run to confirm idempotent/clean after the forced copy
... (clean; private-artifact scan: 5647 published JSON files scanned, none contain identity/health fields; curation-artifact scan clean)
$ sha256sum dist/widgets/data/dashboard/index.json
b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da  dist/widgets/data/dashboard/index.json
$ curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json | grep -c paceDisagreement
1890
$ curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json | sha256sum
b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da  -
```

The restored digest matches the ORIGINAL digest recorded in Task 1
(`b15943de4f21d91894795cde7e48951f05648ea15e6f194b68de4468e7a998da`) both on disk and on the
SERVED path (verified by `curl` against `127.0.0.1:4173`, not just the repo file), and the served
path shows `paceDisagreement` present on all 1890 rows again — the fixture is restored on the
SERVED path, not merely in the repo tree.

## Validation Audit 2026-09-19

Retroactive audit (`/gsd-validate-phase 26`, run from the v2.2 close-out audit's Nyquist finding: the Per-Task map above was never filled after planning — Task IDs still `TBD`, 9 rows pending, Wave 0 unticked — although `26-VERIFICATION.md` passed 7/7 on 2026-09-10 after three rounds).

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**The one gap was a vacuous row, not missing coverage.** The PACE-04 row's command `npx vitest run src/analytics/pace-derivation.test.ts -t "histogram"` matched **0 of 32** tests (all skipped, exit 0) — it could never fail. The histogram is actually tested in `src/dashboard/views/detail-zones.test.ts` (`computePaceDistribution — … (PACE-01, PACE-04)` and the `PACE-04 worked example 4556693525` describe blocks); the row now points there (`-t "PACE-04"`, 11 passed / 25 skipped). Every other `-t` filter was checked for a non-zero match before its row was flipped:

| Row | Command | Matched |
|-----|---------|---------|
| PACE-01 | `pace-single-source.test.ts` | 74 passed |
| PACE-02 | `pace-derivation.test.ts -t "gap boundary"` | 2 passed / 30 skipped |
| PACE-03 | `pace-derivation.test.ts -t "adaptive window"` | 12 passed / 20 skipped |
| PACE-04 | `detail-zones.test.ts -t "PACE-04"` (repointed) | 11 passed / 25 skipped |
| PACE-06 | `node scripts/compute-pace-residual.mjs` | regenerates: 154 cohort / 14 residual / 153 improved, 1 tied, 0 regressed on the merged archive; only the `Generated` line differs from the committed file. Prints "Archive size scanned: 1875" — the G-03 manifest miscount (true per-activity count 1874), scheduled for Phase 31 D-11. |
| PACE-07 | `compute-dashboard-index.test.ts -t "pace disagreement"` | 3 passed / 39 skipped |
| COV-01 | `pace-derivation.test.ts -t "coverage sums"` | 10 passed / 22 skipped |
| ERA-03 | `pace-fixtures.test.ts` | 39 passed |
| Wave 0 extensions | `detail-sections.test.ts` 136 passed; `compute-dashboard-index.test.ts` 42 passed; `detail-charts-logic.test.ts -t "CR-03"` 6 passed | — |

All run live 2026-09-19 on the merged 1,899-activity archive. Manual rows (Rounds 1–3 browser checkpoints) remain satisfied by their recorded developer verdicts and are not re-run. No test files were generated. `nyquist_compliant: true` stands; `wave_0_complete` flipped to true. Task-ID columns are left `TBD`: the map predates the plans and re-deriving 16 plans' task IDs adds no coverage — the requirement column is the key.

