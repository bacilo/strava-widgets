---
phase: 31
slug: tech-debt-closure-silent-failure-guards-docs-reconciliation
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-19
planned: 2026-09-19
updated: 2026-09-19
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `31-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is
> filled in by the planner against the PLAN.md files; the framework, sampling rate, Wave 0
> rows and manual-only rows were fixed before planning. **Every `-t` filter in this file must be
> proven to match ≥1 test before its row is trusted** — the Phase 26 retroactive audit
> (2026-09-19) found a filter matching 0 tests that could never fail.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18` |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`. A `scripts/**/*.test.ts` file is **never collected** — new script-side tests must be `*.test.mjs`. |
| **Quick run command** | `npx vitest run <the test file(s) the task touched>` — the phase's files: `src/analytics/compute-best-efforts.test.ts`, `src/analytics/best-effort-ceiling.test.ts`, `src/dashboard/views/records-logic.test.ts`, `scripts/lib/copy-data-tree.test.mjs`, `scripts/compute-pr-ceiling-recount.test.mjs`, `scripts/curate-queue/derive-flagged.test.mjs`, `scripts/compute-pace-residual.test.mjs`, `scripts/compute-pr-ceiling-calibration.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 s quick / ~30 s full suite (84 files / 2550 tests on 2026-09-19) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <file>` for the file(s) that task touched, and confirm any `-t` filter the task's verify block uses matches ≥1 test (look for `N passed | M skipped`, never `0 passed`).
- **After every plan wave:** Run `npm test` (full suite) and `npx tsc --noEmit`.
- **Before `/gsd-verify-work`:** full suite green; `npx tsc --noEmit` clean; `npm run build-widgets` clean; `node scripts/compute-pr-ceiling-recount.mjs` PASS against the real, well-formed `data/best-effort-exclusions.json` (this script gains fail-closed checks in TD-03 and must still pass on the real file); `node scripts/compute-elevation-recount.mjs` PASS and `node scripts/compute-pace-quality-recount.mjs --expect 299` PASS (D-06 regression, cheap).
- **Max feedback latency:** 20 seconds (quick command)

### Non-vacuity idiom for every `-t` row

Every `<automated>` block in this phase's plans wraps its filtered run so a zero-match filter fails
the task rather than passing it silently:

`npx vitest run <file> -t "<filter>" 2>&1 | tee /tmp/<tag>.log; grep -qE "Tests +[1-9][0-9]* passed" /tmp/<tag>.log && ! grep -qE "[1-9][0-9]* failed" /tmp/<tag>.log`

The **expected** match count is stated per row below. The executor records the **observed** count in
the row's Status cell and in its plan SUMMARY. A row whose observed count is 0 is red, not green.

---

## Per-Task Verification Map

> Filled in by the planner (2026-09-19) against the ten PLAN.md files. Each TD row maps to at least
> one task's `<automated>` verify block. Expected `-t` match counts are stated in the command cell.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-T1, 31-01-T2 | 31-01 | 1 | TD-01 | T-31-03 | Arithmetic tests read the committed fixture, not the real file; exactly one live premise test remains | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "REAL committed exclusion"` — **expected exactly 1** | ✅ extend | ✅ green — observed 1 passed (matches expected exactly 1) |
| 31-01-T2 | 31-01 | 1 | TD-01 | T-31-09 | Premise failure fails loudly with a re-pin message naming entry, fixture and test | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "premise"` — **expected ≥2** | ❌ W0 | ✅ green — observed 2 passed (matches expected ≥2) |
| 31-01-T3 | 31-01 | 1 | TD-01 | T-31-03 | Editing a fixture COPY is caught by the arithmetic assertions (D-03) | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "fixture copy"` — **expected ≥1** | ❌ W0 | ✅ green — observed 1 passed (matches expected ≥1) |
| 31-02-T1, 31-02-T2 | 31-02 | 1 | TD-02 | T-31-01 | Same-size, newer, different-content destination is replaced and logged by path | unit, planted fixture | `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "stale"` — **expected ≥1** (RED in T1, green in T2) | ❌ W0 | ✅ green — observed 1 passed (matches expected ≥1) |
| 31-02-T2 | 31-02 | 1 | TD-02 | T-31-11 | Unchanged files are still skipped (no cost regression) | unit | `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "skip"` — **expected ≥1** | ❌ W0 | ✅ green — observed 1 passed (matches expected ≥1) |
| 31-03-T1 | 31-03 | 1 | TD-03 | T-31-12 | Unrecognized `demotion.guard` renders "N by another guard" in fixed order | unit, planted fixture | `npx vitest run src/dashboard/views/records-logic.test.ts -t "another guard"` — **expected ≥2** | ✅ extend | ✅ green — observed 2 passed (matches expected ≥2) |
| 31-03-T2 | 31-03 | 1 | TD-03 | T-31-02 | Malformed exclusions entry (dup id / bad reason / `__proto__` / non-string id) fails the recount verdict naming each | unit, planted fixture ×4 | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` — **expected ≥5** | ✅ extend | ✅ green — observed 7 passed (matches expected ≥5) |
| 31-04-T1, 31-04-T2 | 31-04 | 1 | TD-03 | T-31-02 | Queue skips malformed entries, counts them, header renders the count | unit, planted fixture | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs -t "malformed"` — **expected ≥6** | ✅ extend | ✅ green — observed 9 passed (matches expected ≥6) |
| 31-05-T1, 31-05-T2 | 31-05 | 1 | TD-04 | T-31-04 | Reason states the margin at 3 dp; house-register regex updated; thin-margin case cannot read as equal | unit | `npx vitest run src/analytics/best-effort-ceiling.test.ts -t "house register"` — **expected ≥1** (RED in T1, green in T2) | ✅ extend | ✅ green — observed 2 passed (matches expected ≥1) |
| 31-06-T2 | 31-06 | 1 | TD-05 | T-31-05 | Residual scan excludes `manifest.json` (G-03) via an exported/testable seam | unit + CLI | `npx vitest run scripts/compute-pace-residual.test.mjs -t "manifest"` — **expected ≥2**; and `node scripts/compute-pace-residual.mjs \| grep "Archive size scanned"` equals `find data/streams -name '*.json' ! -name manifest.json \| wc -l` | ❌ W0 | ✅ green — observed 2 passed (matches expected ≥2) |
| 31-07-T1 | 31-07 | 1 | TD-05 | T-31-05 | Largest-drift sentence is data-derived (WR-07) | unit | `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "largest drift"` — **expected ≥4** | ❌ W0 | ✅ green — observed 7 passed (matches expected ≥4) |
| 31-07-T2 | 31-07 | 1 | TD-05 | T-31-23 | "Demoted" column reconciles with the pipeline total (WR-08) | unit | `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "owner-excluded"` — **expected ≥3** | ❌ W0 | ✅ green — observed 7 passed (matches expected ≥3) |
| 31-08-T1 | 31-08 | 2 | TD-05 | T-31-26 | All five artifacts regenerate twice, byte-identical apart from `**Generated:**` | integration (real archive) | run the five generators twice in dependency order (TD-04 first; residual before pace-quality calibration, which shells out to it, then residual once more) and diff each pair with the `**Generated:**` line stripped — **five empty diffs** | ✅ scripts exist | ✅ green — observed 5/5 empty diffs (31-08-SUMMARY.md Round 2 Idempotence Proofs table, re-confirmed present in committed artifacts) |
| 31-08-T2 | 31-08 | 2 | TD-05 | T-31-27 | The three-way ceiling count reconciles and the new `28-DIFF.md` sha256 is recorded | integration (real archive) | `node scripts/compute-pr-ceiling-recount.mjs` PASS; diff ceiling-only = `byGuard.ceiling` = `independentCeilingCount`; `shasum -a 256` of the committed `28-DIFF.md` recorded beside `cdf9d654…` | ✅ scripts exist | ✅ green — observed 32=32=32, sha256 97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5 recorded (re-derived fresh by this plan, not copied from 31-08) |
| 31-09-T1 | 31-09 | 3 | TD-05 | T-31-06 | Hand-written figures corrected in place with dated notes | doc check | Each stale string survives ONLY inside a dated correction note: `grep -n "716 of 1,864\|716-activity" .planning/REQUIREMENTS.md .planning/ROADMAP.md \| grep -vi corrected \| wc -l` → 0; same shape for `"13 of the 154"` (REQUIREMENTS.md), `"pending phase re-verification"` (REQUIREMENTS.md), `"1,866 streams scanned"` (ROADMAP.md); and `grep -c "Corrected 2026-" .planning/REQUIREMENTS.md` ≥ 1 | doc | ✅ green — observed 0/0/0/0 stale-string matches (none outside a corrected note), 5 dated correction notes |
| 31-10-T2 | 31-10 | 4 | TD-05 | T-31-07 | Fresh PR-04 sign-off bound to the new `28-DIFF.md` sha256 | manual (irreducible) | N/A — human, blocking; see Manual-Only | N/A | ✅ green — developer's blanket approval, all three rows PASS ("Approve — R4-1/R4-2 PASS, R4-3 PASS via 4556693525@1k"), recorded verbatim 2026-09-19 in `28-VALIDATION.md` § PR-04 Sign-off (Round 4) / Developer's Verdict (Round 4), bound to sha256 `97e1782c…` |
| 31-09-T2 | 31-09 | 3 | TD-06 | T-31-31 | `27-VALIDATION.md` flips to `status: passed` in the plan that closes G-02 | doc check | `grep '^status:' .planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` → `status: passed`; and `grep -c "remains open and is scheduled for Phase 31" .../27-VALIDATION.md` → 0 | doc | ✅ green — observed status: passed, 0 stale-open-line matches |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file/test does not exist yet, Wave 0 creates it*

**Requirement coverage:** TD-01 → 3 rows (plan 31-01) · TD-02 → 2 (31-02) · TD-03 → 3 (31-03, 31-04) · TD-04 → 1 (31-05) · TD-05 → 7 (31-06, 31-07, 31-08, 31-09 automated/doc + 31-10 manual) · TD-06 → 1 (31-09). Every requirement has at least one automated or doc-check row; TD-05 additionally carries the phase's only blocking human step.

**Note on the doc-check row (31-09-T1):** the original draft of this row used bare
`grep -c "<stale string>" → 0` gates. Those are self-invalidating, because D-13's correction notes
quote the old figure by design. The gate is therefore "the stale string appears only on a line that
also names the correction", expressed as `grep -n ... | grep -vi corrected | wc -l → 0`.

---

## Wave 0 Requirements

- [x] `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (name/location Claude's Discretion) — TD-01's committed fixture, copying `4556693525` and `3475711469` verbatim (both `distances: null`) — **plan 31-01, task 1** — exists, confirmed present
- [x] `scripts/lib/copy-data-tree.test.mjs` — new file (TD-02), mkdtemp pattern from `scripts/lib/curation-guard.test.mjs` — **plan 31-02, task 1** — exists, confirmed present
- [x] `scripts/lib/stream-files.mjs` (or equivalent) — shared `isStreamFile` lifted out of `compute-pace-quality-calibration.mjs` (TD-05) — **plan 31-06, task 1** — exists, confirmed present
- [x] `scripts/compute-pace-residual.mjs` — export a small `isStreamFile`-filtered listing helper so the manifest exclusion has a unit-test seam (TD-05) — **plan 31-06, task 2** — exists, confirmed present
- [x] `scripts/curate-queue/index.ts` — the "N exclusion entries ignored (malformed)" node beside `data-queue-summary` (TD-03) — **plan 31-04, task 2** — exists, confirmed present
- [x] `scripts/compute-pr-ceiling-calibration.test.mjs` — "largest drift" and "owner-excluded" cases (TD-05) — **plan 31-07, tasks 1 and 2** — exists, confirmed present

*No framework installation gap — vitest already collects both file patterns this phase needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR-04 re-sign of the regenerated `28-DIFF.md` | TD-05 (D-12) | D-14 of Phase 28: the sign-off is a human judgment recorded outside the generated artifact, bound to its sha256 | Present the machine diff of `28-DIFF.md` against the Round 3 signed version (sha256 `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`, recovered from git and verified by hash before diffing), the three-way ceiling count (diff = recount `byGuard.ceiling` = `independentCeilingCount`), and any rank moves; record the developer's verdict verbatim in `28-VALIDATION.md` § PR-04 Sign-off (Round 4), then re-hash. Expected content delta: the TD-04 reason-string format on every ceiling row plus any archive drift since 2026-09-19. **Drafted and presented by plan 31-10 (rows R4-1, R4-2, R4-3), the phase's last plan, `gate="blocking"`.** |
| Browser spot-check of the Records "another guard" sentence and the queue's malformed-entries line | TD-03 | Not warranted as a dedicated round (CONTEXT § Claude's Discretion): both surfaces are pure-text builders proven by unit assertions on planted fixtures, and neither can be reached on the real, well-formed archive without doctoring data. Optional. | If performed: doctor a COPY of `data/stats/best-efforts.json` served under `npm run curate`, never the committed file; quote the rendered text verbatim. **Not planned as a task.** Plan 31-04 task 2 records the real-archive negative control (no malformed line rendered) instead. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an explicit Wave 0 dependency — every task in plans 31-01..31-09 carries an `<automated>` block; 31-10's task 2 is the single `<human-check>` and is the phase's only manual row
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — each Wave 0 item above names the plan and task that creates it
- [x] Every `-t` filter proven to match ≥1 test (expected counts stated above; observed counts recorded by the executor at run time — see Per-Task Verification Map, every row's Status cell states an observed count ≥ its expected minimum)
- [x] No watch-mode flags
- [x] Feedback latency < 20s for every targeted command
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Task ID / Plan / Wave columns filled by the planner 2026-09-19 against the ten PLAN.md
files. `wave_0_complete` flips once the six Wave 0 files exist and run green; `status` and
`nyquist_compliant` are dispositioned by plan 31-10 after the Round 4 verdict.

---

## Validation Audit (plan 31-10, closing this record)

All ten Per-Task Verification Map rows are green: 31-01 through 31-09's `-t` filters each observed
at or above their expected minimum count (recorded in each row's Status cell above; full detail in
each plan's own SUMMARY.md), and the phase's single manual row (31-10-T2, PR-04 Round 4) is now
green — the developer's blanket approval, all three rows (R4-1, R4-2, R4-3) PASS, recorded verbatim
in `28-VALIDATION.md` § PR-04 Sign-off (Round 4) / Developer's Verdict (Round 4), bound to sha256
`97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`.

All six Wave 0 files exist and are exercised by their plan's own green rows. The Validation
Sign-Off checklist above is now fully ticked. `status: passed`, `nyquist_compliant: true` and
`wave_0_complete: true` are set in the frontmatter per this audit.

TD-05 requirement tick: applied in `.planning/REQUIREMENTS.md` by this same plan (31-10), after
this verdict, per the tick-after-verification rule (STATE.md § Carried into the next milestone).
No gap was found this round; nothing is deferred.
