---
phase: 26
slug: shared-gap-aware-pace-derivation-honest-coverage
status: complete
nyquist_compliant: true
wave_0_complete: false
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
| TBD | TBD | TBD | PACE-01 | — | N/A | unit (grep-based audit) | `npx vitest run src/analytics/pace-single-source.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-02 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "gap boundary"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-03 | — | N/A | unit, real committed stream `5059204779` | `npx vitest run src/analytics/pace-derivation.test.ts -t "adaptive window"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-04 | — | N/A | unit, real archive | `npx vitest run src/analytics/pace-derivation.test.ts -t "histogram"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | PACE-05 | — | N/A | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gap marker"` | ✅ (created by 26-06; 8 passing) | ✅ green |
| TBD | TBD | TBD | PACE-06 | — | N/A | integration (script, real archive) | `node scripts/compute-pace-residual.mjs` — diff against committed `26-RESIDUAL.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-07 | T-26-01 | Total/never-throwing on malformed stream input | unit + archive-wide dry run | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pace disagreement"` | ❌ W0 (extend existing file) | ⬜ pending |
| TBD | TBD | TBD | COV-01 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "coverage sums"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | COV-02 | — | N/A | unit (text/structure assertion — no jsdom, per project convention) | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverage caption"` | ✅ (created by 26-06; 5 passing) | ✅ green |
| TBD | TBD | TBD | ERA-03 | — | N/A | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ❌ W0 | ⬜ pending |

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

---

## Wave 0 Requirements

- [ ] `src/analytics/pace-derivation.ts` + `src/analytics/pace-derivation.test.ts` — the shared module
- [ ] `src/analytics/pace-fixtures.ts` + `src/analytics/pace-fixtures.test.ts` — ERA-03 fixture library
- [ ] `src/analytics/pace-single-source.test.ts` — D-18's grep-based audit
- [ ] `scripts/compute-pace-residual.mjs` — D-19's regenerating script
- [ ] `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — D-19's committed deliverable (13 IDs; re-verify against the live archive before committing as final)
- [ ] Extend `src/dashboard/views/detail-sections.test.ts` — D-08 caption + D-09 split marker
- [ ] Extend `src/analytics/compute-dashboard-index.test.ts` — PACE-07's additive flag field

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

### Verdict table — Round 2 (filled in by Task 2)

| Row | Requirement | Verdict | Verbatim quotation |
|-----|-------------|---------|---------------------|
| R2-1 | D-08/COV-02/CR-01 | | |
| R2-2 | CR-01 | | |
| R2-3 | D-08/COV-02 no-regression | | |
| R2-4 | D-31 | | |
