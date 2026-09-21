---
phase: 33
slug: coverage-integration-pace-clipping-segment-signal
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `33-RESEARCH.md` § Validation Architecture. Task IDs filled by plan 33-12 (2026-09-21),
> post-MERGE-01 (truthful no-op — see `33-12-SUMMARY.md`).

---

## The two rules this contract exists to enforce

**Rule 1 — every `-t` row records its matched test count.** A vitest name filter matching zero
tests **exits 0** and is indistinguishable from a pass. A row reading `-t "unreliable"` with no
matched count is not evidence. Record `(**N matched, N passed**)` on every filtered row, and a
whole-file count alongside it where the filter is the only proof of a behaviour.

**Rule 2 — every guard asserts against an INDEPENDENT value, never internal agreement.** This
project has twice shipped a green gate over broken code because a check asserted that the code
agreed with itself (Phase 23 extent; Phase 32 cross-segment conservation with N=1 fixtures).
`coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec` is near-tautological once
`classifyGaps` partitions a span — it is NOT the proof of COV-03. The load-bearing assertion is
that `unreliableSec` equals an **independently recounted** segment-seconds total produced by the
detector-free gap-first recount (D-03/D-15), computed without importing the detector. That
recount — `scripts/compute-coverage-identity-recount.mjs` — reports **0 identity violations, 0
recount mismatches over 1,874 streams**, and was watched FAILING first (699 mismatches against a
deliberately broken detector, `33-07-SUMMARY.md`) before being trusted. Plan 33-12 re-confirmed
this on the merged tree, byte-identical, exit 0.

**Corollary (D-13, reachability in both directions).** Every browser-checkpoint row carries a
stated CAN FAIL / CAN PASS proof before it is run. A row can be defective in *either* direction:
vacuous (passes against a chart that failed to render at all — which is exactly what an
absence-only "the 0:34/km sample is gone" row does) or unpassable (a discriminator no real input
can satisfy). Check both before blaming the code.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (already configured — no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` (the `.test.mjs` files import `../dist/` — run `npm run build` first) |
| **Full suite command** | `npm test` — **93 files / 3,102 tests, all green**, confirmed on the merged tree by plan 33-12 (2026-09-21); baseline was 91 files / 2,848 tests as of 32-17 |
| **Estimated runtime** | ~28 s full suite (measured by plan 33-12, `NO_COLOR=1 npm test`) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test files> -t "<relevant fragment>"`, matched count recorded
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** full suite green; the archive-wide identity/recount artifact clean (zero identity violations across all 1,874 streams); every calibration/recount artifact regenerated **twice** and byte-identical (`git diff --exit-code`); human browser checkpoint (D-13 rows) PASS against a **digest-verified** served build
- **Max feedback latency:** ~60 s

**Archive-scan placement (D-03).** The 1,874-stream identity/recount scan is a regenerable
**artifact**, run by hand or CI at phase-close time — never inside `npm test`'s hot path (the
suite is already serialised with `fileParallelism: false`). The `npm test`-time guard is the fast
named-fixture identity check plus the extended `unreliable-segment-recount-crosscheck.test.mjs`.

---

## Per-Task Verification Map

Filled by plan 33-12 (Task 3), post-MERGE-01. "Task ID" names the discharging plan's own task
number; "Plan" names the discharging plan. Every `-t` row's matched count was either quoted
directly from that plan's own SUMMARY, or — where a SUMMARY did not record one for the exact
filter text this row uses — **re-run on 2026-09-21 during plan 33-12** and recorded here, per
Rule 1's own "never left blank" requirement. Two rows (T-33-09, T-33-16) surfaced genuine
**contract-drift / partial-vacuity findings** during this re-run; both row commands were
corrected by the orchestrator on 2026-09-21 (the rows record the drafted command, why it was wrong,
and the re-run counts of the corrected one). No test or production file was changed.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 3 | 33-01 | 1 | PACE-08 | T-33-01 | `classifyGaps` widened; `unreliable` outranks `recording-gap`/`pause`; the whole merged `[startSec,endSec]` moves out of `recordingGapSec`/`pauseSec` (D-01). Containment uses the detector's own `startIndex`/`endIndex` — never a second boundary convention (32-13/32-17 precedent) | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "unreliable"` (**12 matched, 12 passed** — re-run 2026-09-21 during plan 33-12; `33-01-SUMMARY.md` recorded "6 new tests" but no explicit matched-count line for this exact filter) | ✅ `src/analytics/pace-derivation.test.ts` | ✅ done |
| Task 1+2 | 33-06 | 2 | PACE-08 | T-33-02 | Chart window clipping and histogram exclusion inherit the behaviour with **zero call-site change** (D-02/D-12). Asserted by fixture, not by source inspection | unit | `npx vitest run src/dashboard/views/detail-charts-logic.test.ts src/dashboard/views/detail-zones.test.ts -t "unreliable"` (**21 matched, 21 passed** — combined; `33-06-SUMMARY.md` recorded 12 matched/12 passed for `detail-charts-logic.test.ts` alone and 9 matched/9 passed for `detail-zones.test.ts` alone; combined run re-confirmed 21/21 on 2026-09-21) | ✅ | ✅ done |
| Task 1 | 33-04 | 2 | PACE-09 | T-33-03 | `SplitGapAnnotation` widened three-way; `unreliable` wins the marker whenever present (D-09). The two-way else-branch (`else pauseSec += …`) is pinned by a test that FAILS if unreliable time is silently counted as pause | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "splitGapAnnotations"` (**17 matched, 17 passed** — `33-04-SUMMARY.md`'s own recorded count; watched RED first via a restored two-way else, 3 failures, quoted verbatim there) | ✅ | ✅ done |
| Task 2 | 33-04 | 2 | COV-03 | T-33-04 | Caption renders the fourth term always-on **including at 0%** (D-10); the four independently-rounded integers are NOT forced to sum to 100 | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverageCaptionText"` (**9 matched, 9 passed** — `33-04-SUMMARY.md`'s own recorded count) | ✅ | ✅ done |
| Task 2 | 33-03 | 2 | COV-03 | T-33-05 | `gapFraction`'s numerator includes `unreliableSec` (D-04); `GAP_PROFILE_SEVERE_FRACTION`/`GAP_PROFILE_MINOR_FRACTION` unchanged (D-05, anti-quota) | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "gapProfile"` (**7 matched, 7 passed** — `33-03-SUMMARY.md`'s own recorded count; whole file 87/87; anti-quota pin watched RED on a temporary 0.2→0.25 edit, reverted clean) | ✅ | ✅ done |
| Task 1 | 33-05 | 1 | COV-03 | T-33-06 | **Trap 4:** `pace-quality-client.ts`'s `VALID_GAP_KINDS` hardcoded `Set(['recording-gap','pause'])` drops every `unreliable` interval at parse time, client-side. Widened, tolerant-entry-drop pattern preserved | unit | `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "unreliable"` (**21 matched, 21 passed** — re-run 2026-09-21; `33-05-SUMMARY.md` recorded 5 matched/5 passed at the time, count grew via plans 33-09/33-10's later additive parser fixtures in the same file, all containing the substring "unreliable"; watched RED first on the pre-widening 2-member set, 5 failures, quoted verbatim in `33-05-SUMMARY.md`) | ✅ | ✅ done |
| Task 3 | 33-01 | 1 | SEG-05b (D-15, this phase's half) | T-33-07 | `pace-derivation.ts` reading the detector is **load-bearing**, proven by stubbing the call and watching the clipping disappear — not by the import existing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pace-derivation"` (**5 matched, 5 passed** — re-run 2026-09-21; the literal filter text this row specifies as-written matches non-vacuously. Note: the plan's own actual discharging test is titled with the substring `"load-bearing"`, separately re-confirmed **1 matched, 1 passed** with `-t "load-bearing"` — both filters are non-vacuous, cited for full transparency) | ✅ | ✅ done |
| Task 1+2 | 33-07 | 2 | COV-03 | T-33-08 | Archive-wide four-way identity, **zero violations across 1,874 streams**, with `unreliableSec` asserted against the detector-free gap-first recount — not against `classifyGaps` (Rule 2). Recount extended to emit the currently-discarded isolated/hidden-pause runs | script (artifact) | `npm run compute-coverage-identity-recount` — exit 0, `PASS: scanned=1874 skipped=0 identityViolations=0 recountMismatches=0`; generator run **twice** by plan 33-12 Task 2 with `git diff --exit-code` clean, post-MERGE-01 | ✅ `scripts/compute-coverage-identity-recount.mjs` + `.test.mjs` | ✅ done |
| Task 2 | 33-07 | 2 | COV-03 | T-33-09 | The recount is watched FAILING against a deliberately-broken detector before it may pass (PITFALLS 11 — a recount sharing the classifier's blind spot proves nothing) | script | `npx vitest run scripts/compute-coverage-identity-recount.test.mjs` — **35 matched, 35 passed** (whole file, no `-t` filter; orchestrator re-run 2026-09-21). Watched-FAILING evidence: `33-07-SUMMARY.md` Task 2 — 699/1,874 mismatching activities under the seeded `i < seg.endIndex - 1` mutation, exit 1, identity violations still 0, then reverted to PASS. *Corrected 2026-09-21 by the orchestrator:* the drafted command `scripts/*-recount-crosscheck.test.mjs` glob-matched only the pre-existing Phase 32 `unreliable-segment-recount-crosscheck.test.mjs` (5/5), a different file from the one that discharges this behaviour (found by plan 33-12's literal re-run) | ✅ | ✅ done (command corrected) |
| n/a (figure reconciliation) | 33-07 | 2 | COV-03 | T-33-10 | The artifact reports how much time moved out of `recording-gap`/`pause` per mechanism, and the D-05 per-tier migration **including if it is zero** | script | Generator output inspected: D-01 gap-adjacent mechanism total **11,574.0 s / 63 activities / 85 segments / 12,730.8 m** reconciles exactly against `32-CALIBRATION.md`'s own Figures-of-record reference — re-confirmed unmoved by plan 33-12 Task 2's post-merge regeneration (grep-verified against the regenerated `32-CALIBRATION.md`) | ✅ | ✅ done |
| Task 1-4 | 33-14 (resolving plan 33-08's documented HALT via D-16) | 2 | SEG-06 | T-33-11 | D-07's excess-metres tier constant derived with its own non-circularity argument (D-16: a reference population disjoint from the flagged cohort); insensitivity checked (removal/planted). Watched failing first on a deliberately circular strawman | script | `npx vitest run scripts/compute-unreliable-segment-severity-calibration.test.mjs` (**81 matched, 81 passed** — `33-14-SUMMARY.md`'s own recorded count, re-confirmed 2026-09-21 during plan 33-12); generator run **twice** in plan 33-12 Task 2, byte-identical, exit 0; shape **R1 selected**, `0.00423`, shipped constant character-identical (`Shipped value equal: yes`) | ✅ | ✅ done |
| Task 2+4 | 33-09 | 3 | SEG-06 | T-33-12 | Signal tiered `none`/`minor`/`severe`; `hasAnySevereSignal`'s `Pick<>` **NEVER** widened (D-06), pinned by a never-widen guard demonstrated red (temporarily widen, watch the guard fail, revert, `git diff` empty after revert) | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "unreliableSegments"` (**19 matched, 19 passed** — re-run 2026-09-21; `33-09-SUMMARY.md` recorded 13 matched/13 passed for Task 2 alone at the time; plan 33-10 later added 3 D-08 cross-check tests whose titles also contain the substring, plus Task 4's never-widen guard test) | ✅ | ✅ done |
| Task 3 | 33-10 | 3 | SEG-06 | T-33-13 | Index row additions are additive; `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`. Shard segment list capped at 100 like `impossibleSamples`, carries no `parts` | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "unreliable"` (**3 matched, 3 passed** — `33-10-SUMMARY.md`'s own recorded count, after its own Rule-1 title-rename fix from 1/3 to 3/3) | ✅ | ✅ done |
| Task 1 | 33-11 | 3 | SEG-06 | T-33-14 | Only `severe` badges a list row; `none`/`minor`/`not-computable` stay silent there | unit | `npx vitest run src/dashboard/views/list.test.ts -t "unreliableSegments"` (**12 matched, 12 passed** — `33-11-SUMMARY.md`'s own recorded count) | ✅ | ✅ done |
| Task 3 | 33-04 | 3 | COV-03 | T-33-15 | `gapProfileRow`'s evidence line reads `shard.gapIntervals`, which now contains unreliable intervals — whether it itemises by kind is **decided and pinned** (research recommends itemise) | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gapProfileRow"` (**2 matched, 2 passed** — re-run 2026-09-21; `33-04-SUMMARY.md`'s own quoted filters for this task were `"splitGapAnnotations"`/whole-file 146/146, not this exact string, so this exact count is a plan-33-12 first-record) | ✅ | ✅ done |
| Task 2 (`list.ts`) + Task 3 (`detail-sections.ts`) | 33-05 + 33-04 | 3 | COV-03 | T-33-16 | D-11 copy widening: badge `visibleText`, the `Coverage gaps` detail label and the healthy text all name what the number now counts (correctness fix, not cosmetic) | unit | `npx vitest run src/dashboard/views/list.test.ts -t "gaps, pauses or unreliable"` — **1 matched, 1 passed**; AND `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gapProfileRow"` — **2 matched, 2 passed** (both orchestrator re-runs 2026-09-21). *Corrected 2026-09-21 by the orchestrator:* the drafted single command applied the `list.ts` phrase filter to both files and matched **0** tests in `detail-sections.test.ts`, whose D-11 copy assertions live inside `expect(...)` strings rather than `it(...)` titles, so that half of the row was vacuous (found by plan 33-12's literal re-run). The detail-side copy is asserted by the `gapProfileRow` tests (this table's T-33-15) and `coverageCaptionText` (T-33-04, 9/9) | ✅ | ✅ done (command split) |

---

## Wave 0 Requirements

- [x] A fixture `PaceQualityShard`-shaped object carrying **at least one `unreliable`-kind `gapInterval`**, for `pace-quality-client.test.ts` — **closed by plan 33-05 Task 1** (T-33-06): 5 explicit-literal cases, watched RED against the pre-widening 2-member `VALID_GAP_KINDS` set first (5 failures, quoted verbatim in `33-05-SUMMARY.md`), then GREEN.
- [x] `scripts/compute-*-recount.mjs` extension (archive-wide, detector-free) + its own `.test.mjs` import-time no-side-effect guard — **closed by plan 33-07** (`scripts/compute-coverage-identity-recount.mjs` + `.test.mjs`, T-33-08/T-33-09/T-33-10): 0 identity violations, 0 recount mismatches over 1,874 streams; watched FAILING first (699 mismatches against a deliberately broken detector, exit 1), then reverted to PASS. Re-confirmed byte-identical on the merged tree by plan 33-12 Task 2.
- [x] `scripts/compute-*-severity-calibration.mjs` (D-07's constant) + its own `.test.mjs` — **built by plan 33-08** (documented HALT: no candidate outer percentile cleared D-13 insensitivity), **resolved and shipped by plan 33-14** (D-16 non-self-referential re-derivation, shape R1 first-clearing, `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423`). Wave 3's SEG-06 tier (plan 33-09) consumed this constant without redeclaring it.
- [x] Framework install: **none** — vitest already configured, unchanged throughout the phase.

---

## Manual-Only Verifications

Human browser checkpoint against a **digest-verified served build** (run by plan 33-13). Criteria
1, 2 and 4 of the ROADMAP Phase 33 goal are all rendered claims. Every row below states its
expected value **with the SUMMARY it came from**, plus a **CAN FAIL** and a **CAN PASS** clause
(D-13), audited against both defect directions (vacuous / unsatisfiable) before being finalised.
Rows are grouped **per requirement** (SEG-06, PACE-08, PACE-09, COV-03) so plan 33-13 can
disposition each requirement independently from its own mapped rows, under the all-rows-PASS rule.

**Standing checkpoint conventions (learned the hard way on this project — all apply, read before
running any row):**
- **Cache trap:** hard-reload after every fixture edit. A stale `index.html`/`index.json` in a
  staged build has produced false evidence here before — serving from `127.0.0.1` alone is **NOT
  enough**.
- **Verify the SERVED digest, not the build log.** `build-widgets` silently no-ops on any
  locally-edited `dist/` file (mtime skip), so a green build log can describe a stale bundle. At
  the close of plan 33-12, the on-disk assets were `dist/widgets/assets/index-B3Etra57.js` and
  `dist/widgets/assets/index-CQkdBpPg.css` (`npm run verify-dashboard`, 66/66 checks passed,
  2026-09-21) — this is a **pre-checkpoint reference only**. Plan 33-13 MUST capture its own fresh
  served digest and compare it against a freshly built one; do not reuse this pair as evidence.
- **Viewport clamps to 500..941** in the available capture path.
- **Gestures need a human.** Hover/scan rows below are marked `HUMAN GESTURE`; pure visual/textual
  read-back rows are marked `HUMAN READ-BACK`; subjective-judgement rows are marked `HUMAN
  JUDGEMENT`.
- **Routes:** activity detail is `#/activity/:id` (`src/dashboard/view.types.ts` `ROUTES.DETAIL`);
  the activity list is `#/list` (`ROUTES.LIST`).
- **Verdicts are transcribed verbatim** by plan 33-13 — a blank cell under `Verdict` below is
  intentional; do not fill it here.

### PACE-08 — pace chart band and histogram clip unreliable segments

| # | Activity / URL | Read back | Expected value (source) | CAN FAIL | CAN PASS | Requirement | Verdict |
|---|---|---|---|---|---|---|---|
| R1 | `3475724402` at `#/activity/3475724402` | HUMAN GESTURE: hover the pace chart to find its fastest (lowest sec/km) rendered point; also scan for any point in the 0:30–0:40/km band | Fastest **173.01 sec/km = 2:53/km**, exact match to the chart's own Task-1 rendered output (diff 0.000); zero rendered samples in the 0:30–0:40/km band (`33-06-SUMMARY.md` Task 1, independent hand-computation from raw `t`/`d`, never calling `derivePaceSeriesGapAware`/`buildChannelSeries`) | If the detector import regressed to a no-op (33-01's watched-failing load-bearing proof: stubbing `detectUnreliableSegments` un-clips the window), OR the segment-start-leak class reappeared (33-06 Task 1's watched-failing `{clipAtGaps:false}` mutation), the chart would surface a faster/leaked sample — the human-read fastest would move below 173.01 sec/km, or a 0:3x/km sample would reappear | 173.01 sec/km is already the chart's own rendered output on the current build (33-06-SUMMARY.md, exact diff 0.000) — reachable with one hover gesture inside the chart's rendered x-range (within the 500–941px viewport clamp), not aspirational | PACE-08 | |
| R2 | `3475734189` at `#/activity/3475734189` | HUMAN GESTURE: hover the pace chart for its fastest point; scan for any 0:30–0:40/km sample | Fastest **231.21 sec/km = 3:51/km**, exact match (diff 0.000); zero rendered samples in 0:30–0:40/km (`33-06-SUMMARY.md` Task 1) | Same defect classes as R1 (detector-off, segment-start-leak) — reachable via the same two watched-failing demonstrations cited there | Same as R1 — 231.21 sec/km is already the current build's rendered output | PACE-08 | |
| R3 | `3475740390` at `#/activity/3475740390` | HUMAN GESTURE: hover the pace chart AND the pace histogram for the fastest point on each; scan both for any 1:10–1:40/km (70–100 sec/km) sample | Fastest **160.00 sec/km = 2:40/km** (`33-06-SUMMARY.md` Task 2: "the raw minimum histogram sample is exactly 160.00 sec/km"; rendered fastest *bucket* edge is 150 sec/km, a 15 s `PACE_BUCKET_WIDTH_SEC` quantisation of the same 160.00 sec/km value, not a leak); zero populated histogram buckets overlap 70–100 sec/km. The chart inherits the SAME clipping mechanism as R1/R2 (D-02, zero call-site change; `detail.ts`/`detail-charts-logic.ts`/`detail-zones.ts` confirmed byte-identical pre/post-phase by 33-06's own audit), so the chart is expected to show the identical value | The histogram's own load-bearing discriminator is the `bucketedSec <= coveredSec` accounting identity (33-06 Task 2's watched-failing mutation: dropping `'unreliable'`-kind `gapIntervals` entries leaked exactly 5 boundary samples, `3584 > 3569`) — a human cannot read that identity directly, but a regression severe enough to leak samples would also move the rendered fastest bucket or introduce a visible 70–100 sec/km sample, which this row DOES catch | 160.00 sec/km / bucket-edge 150 is already the current build's measured output (33-06-SUMMARY.md Task 2); reachable via hover, within the viewport clamp | PACE-08 | |
| R4 (control) | `10146303423` at `#/activity/10146303423` | HUMAN GESTURE: hover the pace chart end-to-end, confirm the full range renders with no gaps, and its fastest reads close to the independently-derived clean value | `classifyGaps(t,d).unreliableSec === 0`, span 2,559 s / 42.6 min, 2,545 samples, fully covered (no recording-gap/pause either); chart renders its full 2,545-point range identically whether the detector runs for real or is stubbed to `[]` (`vi.doMock`); fastest ≈ 225.99 sec/km / 3:46/km, identical to 6 decimal places both ways (`33-06-SUMMARY.md` Task 1) | A regression that clips a clean activity (nothing to clip) would show visible GAPS in the chart's rendered range, or a fastest value diverging from ≈225.99 sec/km — this is the direction an absence-only "the bad sample is gone" row structurally cannot see (D-13's own stated reason for requiring a control) | Today's build already renders 10146303423's full range unchanged (33-06-SUMMARY.md, proven both through the real detector path and a stubbed-to-`[]` path) | PACE-08 | |

### PACE-09 — per-km split marker

| # | Activity / URL | Read back | Expected value (source) | CAN FAIL | CAN PASS | Requirement | Verdict |
|---|---|---|---|---|---|---|---|
| R5 | `3475740390` at `#/activity/3475740390`, per-km splits table, **split 8** | HUMAN READ-BACK: locate split 8 (covers `d=7305 m`, the t=2508 52.4 m isolated-jump start) and read its gap-marker label | Split 8 (`startTimeSec: 2393.34`, `endTimeSec: 2684.46`) carries the **unreliable** marker — confirmed live via `derivePaceWithCoverage`: `{startSec: 2508, endSec: 2513, kind: 'unreliable'}` (`33-04-SUMMARY.md` Task 1, km index and interval kind both derived in-test from the real stream, not trusted from planning prose) | 33-04's own watched-RED demonstration (temporarily restoring the old two-way `else { pauseSec += overlapSec }`) produced 3 failures naming exactly this defect class: the split would show NO marker, or a **pause** marker, instead of **unreliable** — quoted verbatim in `33-04-SUMMARY.md` (`{ km: 1, pauseSec: 30 (expected 0), unreliableSec: 0 (expected 30) }`) | Split 8's `unreliable` kind is already confirmed live on the current build (33-04-SUMMARY.md), reachable by scrolling the splits table to km 8 — no hover gesture required | PACE-09 | |

### COV-03 — the always-on coverage caption, and the archive-wide identity

**Non-rendered half (cited, not a browser row):** the archive-wide four-way identity
(`coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec`) holds with **0 identity
violations, 0 recount mismatches over 1,874 streams**, re-confirmed byte-identical on the merged
tree by plan 33-12 Task 2 (`33-COVERAGE-IDENTITY.md`, regenerated twice, `git diff --exit-code`
clean both times). The load-bearing check is the detector-free recount (Rule 2 above), not the
identity alone — watched FAILING first (699/1,874 mismatches, `33-07-SUMMARY.md`). This is
COV-03's non-rendered evidence; it is cited here, not re-tested by a browser row, per this plan's
own instruction not to invent a browser row for a claim that isn't rendered.

**Rendered half (browser rows, the always-on caption):**

| # | Activity / URL | Read back | Expected value (source) | CAN FAIL | CAN PASS | Requirement | Verdict |
|---|---|---|---|---|---|---|---|
| R6 | `3475724402` at `#/activity/3475724402`, coverage caption | HUMAN READ-BACK: read the caption verbatim | `'82% of elapsed time covered · 1% recording gaps · 0% paused · 17% unreliable'` — matches `33-04-SUMMARY.md`'s own measured Task 2 value exactly, independently re-derived by plan 33-12 (`classifyGaps` + `coverageCaptionText` run directly against the real committed stream via the shipped `dist/` build: `spanSec 4345, coveredSec 3548, recordingGapSec 46, pauseSec 0, unreliableSec 751`) | If D-10's fourth term regressed to render only when non-zero (the rejected alternative), or `coverageCaptionText` failed to read `unreliableSec`, the caption would omit the term or show `0% unreliable` on a genuinely-unreliable activity — reachable, since 33-01's own five Rule-1 real-stream caption corrections (`33-01-SUMMARY.md`) prove the caption DOES move when `unreliableSec` changes | The exact string is already the current build's measured output (independently re-derived twice: 33-04-SUMMARY.md in-test, and this plan's own fresh probe against the shipped `dist/` code) | COV-03 | |
| R7 | `3475734189` at `#/activity/3475734189`, coverage caption | HUMAN READ-BACK: read the caption verbatim | `'99% of elapsed time covered · 0% recording gaps · 1% paused · 0% unreliable'` — independently derived by plan 33-12's probe (`spanSec 2387, coveredSec 2363, recordingGapSec 0, pauseSec 16, unreliableSec 8`; 8/2387 ≈ 0.34% legitimately rounds to `0%` — this activity's unreliable SECONDS are small even though its unreliable DISTANCE/fraction tiers `severe` under SEG-06 (R10 below), a genuine reconciliation point, not a contradiction: COV-03's caption counts seconds-of-span, SEG-06's tier counts excess-metres-of-distance) | Same defect class as R6 — an omitted term reads as "unknown" not "0%", or a wrong non-zero percentage would appear | 8/2387 rounds to exactly `0%` on the current build (this plan's independent probe against the shipped `dist/` code) | COV-03 | |
| R8 | `3475740390` at `#/activity/3475740390`, coverage caption | HUMAN READ-BACK: read the caption verbatim | `'98% of elapsed time covered · 2% recording gaps · 0% paused · 0% unreliable'` — independently derived by plan 33-12's probe (`spanSec 3650, coveredSec 3569, recordingGapSec 66, pauseSec 0, unreliableSec 15`; 15/3650 ≈ 0.41% rounds to `0%`, same reconciliation note as R7 — this activity tiers `severe` under SEG-06 (R11 below) despite a `0%` caption term) | Same defect class as R6/R7 | 15/3650 rounds to exactly `0%` on the current build | COV-03 | |
| R9 (control) | `10146303423` at `#/activity/10146303423`, coverage caption | HUMAN READ-BACK: read the caption verbatim, specifically confirming the fourth term is PRESENT and reads `0%` (not omitted) | `'100% of elapsed time covered · 0% recording gaps · 0% paused · 0% unreliable'` — independently derived by plan 33-12's probe (`spanSec 2559, coveredSec 2559, recordingGapSec 0, pauseSec 0, unreliableSec 0`) | This is the case D-10 exists to guard: if the term were rendered only when non-zero, it would be ABSENT here entirely, reading as "unknown" rather than "zero" — the exact direction an absence-only row cannot see, which is why this control row exists | The `0% unreliable` term is already present and correct on the current build's measured output (this plan's independent probe) | COV-03 | |

### SEG-06 — the seventh quality signal, badge and detail row

| # | Activity / URL | Read back | Expected value (source) | CAN FAIL | CAN PASS | Requirement | Verdict |
|---|---|---|---|---|---|---|---|
| R10 | `3475734189` at `#/list` (badge) and `#/activity/3475734189` (detail Quality Signals, ninth row) | HUMAN READ-BACK: confirm the list row shows a badge, read its text; read the detail view's "Unreliable segments" row value/evidence | Badge shown, text `'1 unreliable segment, 182 m over 0:08 (hidden pause)'`; detail row same `valueText`, `evidenceText: 'First segment at 22:32; longest 0:08'`; tier `severe` (`33-11-SUMMARY.md` "For the human checkpoint" table, cross-checked independently by this plan's own probe against the shipped `dist/` code, byte-identical) | 33-11 Task 1's 12 unit cases directly assert minor/none/not-computable produce NO badge and severe DOES — a regression of the severe-only gate is the reachable defect this row would independently catch on the real page, beyond the synthetic-fixture unit tests | 33-11 Task 3's end-to-end compute→serialise→parse→render proof already reproduces this exact string/tier on the real committed stream (quoted table, `33-11-SUMMARY.md`) — attainable on the served build | SEG-06 | |
| R11 | `3475740390` at `#/list` (badge) and `#/activity/3475740390` (detail, ninth row) | Same read-back as R10 | Badge shown, text `'5 unreliable segments, 166 m over 0:15 (isolated jump)'`; detail row same `valueText`, `evidenceText: 'First segment at 39:07; longest 0:05'`; tier `severe` (`33-11-SUMMARY.md`, cross-checked independently) | Same defect class as R10 | Same as R10 — `33-11-SUMMARY.md`'s end-to-end proof | SEG-06 | |
| R12 | `3475724402` at `#/list` (NO badge expected) and `#/activity/3475724402` (detail, ninth row) | HUMAN READ-BACK: confirm the list row shows NO badge for this signal; read the detail view's "Unreliable segments" row | List row: no unreliable-segments badge. Detail row: `'16 unreliable segments, 2149 m over 12:31 (gap adjacent)'`, tier `minor` (`33-11-SUMMARY.md`, cross-checked independently — `totalExcessMetres` is exactly 0 by D-07's gap-dilution definition, all 16 segments' excess clamped to zero over their merged span, a recorded finding not a bug) | If D-06's severe-only badge gate regressed, this `minor`-tier activity would show a badge it doesn't today — reachable via 33-11 Task 1's dedicated minor/none/not-computable-stay-silent unit tests, which this row independently re-checks on a real page | `33-11-SUMMARY.md`'s end-to-end proof already reproduces this exact detail-row string and the absent badge on the current build | SEG-06 | |
| R13 (control) | `10146303423` at `#/list` (NO badge) and `#/activity/10146303423` (detail, ninth row) | HUMAN READ-BACK: confirm no badge; read the detail row | List row: no badge. Detail row: `'No unreliable segments detected'`, `evidenceText: null`, tier `none` — `33-11-SUMMARY.md` names this activity as **flagged, not yet driven end-to-end** through Task 3 (only unit-tested via synthetic fixtures); this plan's own probe against the shipped `dist/` code independently confirms `tier:'none', count:0` on the REAL stream, closing that gap | If the `none`/not-computable rendering path regressed to show a placeholder or a stray badge, this row would catch it on real data rather than a synthetic fixture — reachable via 33-11 Task 2's 11+2 dedicated none/not-computable unit cases, which never exercised this specific real stream | This plan's own fresh probe confirms `tier:'none'` is the real, attainable value for this activity on the shipped code | SEG-06 | |
| R14 | `3475724402` at `#/activity/3475724402`, detail Quality Signals ninth row | HUMAN JUDGEMENT (no numeric readback — a subjective copy-quality call, flagged by `33-11-SUMMARY.md` for exactly this checkpoint): does `'16 unreliable segments, 2149 m over 12:31 (gap adjacent)'` with NO badge read clearly, or does it read as "nothing wrong" despite the real 2,149 m / 12:31 it discloses? `totalExcessMetres` is exactly 0 **by D-07's own gap-dilution definition** (every one of the 16 segments' excess clamps to zero over its merged, gap-diluted span) — state that plainly to the developer so they judge the COPY, not the TIER, which is not in question here | Claude's own discretionary copy (`33-11-SUMMARY.md` key-decisions), no dictated UI-SPEC text to defer to | CAN FAIL: the developer finds the copy misleading (reads as "clean" despite disclosing real distance/duration) | CAN PASS: the developer finds the copy clear and informative as written — the row already states the real 2,149 m / 12:31 figures, not merely the tier | SEG-06 | |
| R15 | `3475724402`, `3475734189`, `3475740390`, each at `#/activity/{id}`, comparing the "Coverage gaps" row's `evidenceText` (itemises "`N` unreliable segments" among its gap/pause counts) against the new "Unreliable segments" row's own count | HUMAN READ-BACK + JUDGEMENT: read both rows on each of the three named activities; confirm the two counts are numerically equal AND that the two rows don't read as conflicting on the page (the intentional-double-disclosure question `33-11-SUMMARY.md` flags) | Counts must agree: 3475724402 → 16 / 16; 3475734189 → 1 / 1; 3475740390 → 5 / 5 (`33-11-SUMMARY.md` Task 3: `gapProfileRowResult.evidenceText contains '${signal.count} unreliable'` proven directly on all three named activities, both counts sourced from the same `classifyGapsWithSegments` output by construction) | A regression breaking the shared resolution (`resolveCoverage`, one detector call per producer, proven by 33-09's own observant-counter test) would desynchronise the two counts — numerically reachable; the VISUAL non-conflict judgement is the added value only a human can give beyond the already-automated numeric-agreement proof | 33-11 Task 3 already proves numeric agreement on the real committed streams — the counts are attainable and equal on the current build; only the human visual-read is new here | SEG-06, COV-03 | |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a stated Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — closed (see Wave 0 Requirements above)
- [x] No watch-mode flags — every command is `vitest run`, never `vitest` (watch mode)
- [x] Every `-t` row records a **non-zero matched count** (Rule 1) — all 15 rows in the per-task
      map now carry a recorded count; two (T-33-09, T-33-16) additionally surfaced genuine
      contract-drift/partial-vacuity findings, since corrected in place (see the two rows) rather than silently passed over
- [x] Every guard asserts against an independently-derived value (Rule 2); the four-way identity
      alone does NOT discharge COV-03 — the detector-free recount (0 mismatches/1,874 streams,
      watched failing first at 699 mismatches) is the load-bearing check, re-confirmed post-merge
- [x] Every browser-checkpoint row (R1–R15) carries a stated CAN FAIL / CAN PASS proof in **both**
      directions, audited against vacuity and unsatisfiability
- [x] Artifacts regenerated twice, byte-identical — `32-CALIBRATION.md`, `33-COVERAGE-IDENTITY.md`,
      `33-CALIBRATION.md` all re-confirmed on the merged tree by plan 33-12 Task 2
- [ ] `nyquist_compliant: true` set in frontmatter — **deliberately NOT set by plan 33-12**; only
      plan 33-13, against real rendered verdicts, may flip this

**Approval:** pending
