---
phase: 31
slug: tech-debt-closure-silent-failure-guards-docs-reconciliation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-19
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

---

## Per-Task Verification Map

> Filled in by the planner. Each TD row below must map to at least one task's `<automated>` verify block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TD-01 | — | Arithmetic tests read the committed fixture, not the real file; exactly one live premise test remains | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "REAL committed exclusion"` (must match exactly 1 after the change) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TD-01 | — | Premise failure fails loudly with a re-pin message naming entry, fixture and test | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "premise"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-01 | — | Editing a fixture COPY is caught by the arithmetic assertions (D-03) | unit, demonstrated failing | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "fixture copy"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-02 | T-31-01 | Same-size, newer, different-content destination is replaced and logged by path | unit, planted fixture | `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "stale"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-02 | — | Unchanged files are still skipped (no cost regression) | unit | `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "skip"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-03 | — | Unrecognized `demotion.guard` renders "N by another guard" in fixed order | unit, planted fixture | `npx vitest run src/dashboard/views/records-logic.test.ts -t "another guard"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TD-03 | T-31-02 | Malformed exclusions entry (dup id / bad reason / `__proto__` / non-string id) fails the recount verdict naming each | unit, planted fixture ×4 | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TD-03 | T-31-02 | Queue skips malformed entries, counts them, header renders the count | unit, planted fixture | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs -t "malformed"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TD-04 | — | Reason states the margin at 3 dp; house-register regex updated; thin-margin case cannot read as equal | unit | `npx vitest run src/analytics/best-effort-ceiling.test.ts -t "house register"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | Residual scan excludes `manifest.json` (G-03) via an exported/testable seam | unit + CLI | `npx vitest run scripts/compute-pace-residual.test.mjs -t "manifest"` and `node scripts/compute-pace-residual.mjs \| grep "Archive size scanned"` equals `find data/streams -name '*.json' ! -name manifest.json \| wc -l` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | Largest-drift sentence is data-derived (WR-07) | unit | `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "largest drift"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | "Demoted" column reconciles with the pipeline total (WR-08) | unit | `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs -t "owner-excluded"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | All five artifacts regenerate twice, byte-identical apart from `**Generated:**` | integration (real archive) | run the five generators twice in dependency order (TD-04 first; residual before pace-quality calibration, which shells out to it) and diff each pair with the `**Generated:**` line stripped | ✅ scripts exist | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | Hand-written figures corrected in place with dated notes | doc check | `grep -c "716 of 1,864" .planning/REQUIREMENTS.md .planning/ROADMAP.md` → 0 uncorrected; `grep -c "13 of the 154" .planning/REQUIREMENTS.md` → 0 uncorrected; `grep -c "pending phase re-verification" .planning/REQUIREMENTS.md` → 0 | doc | ⬜ pending |
| TBD | TBD | TBD | TD-05 | — | Fresh PR-04 sign-off bound to the new `28-DIFF.md` sha256 | manual (irreducible) | N/A — human, blocking; see Manual-Only | N/A | ⬜ pending |
| TBD | TBD | TBD | TD-06 | — | `27-VALIDATION.md` flips to `status: passed` in the plan that closes G-02 | doc check | `grep '^status:' .planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` → `status: passed` | doc | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file/test does not exist yet, Wave 0 creates it*

**Requirement coverage:** TD-01 → 3 rows · TD-02 → 2 · TD-03 → 3 · TD-04 → 1 · TD-05 → 6 (5 automated/doc + 1 manual) · TD-06 → 1. Every requirement has at least one automated or doc-check row; TD-05 additionally carries the phase's only blocking human step.

---

## Wave 0 Requirements

- [ ] `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (name/location Claude's Discretion) — TD-01's committed fixture, copying `4556693525` and `3475711469` verbatim (both `distances: null`)
- [ ] `scripts/lib/copy-data-tree.test.mjs` — new file (TD-02), mkdtemp pattern from `scripts/lib/curation-guard.test.mjs`
- [ ] `scripts/lib/stream-files.mjs` (or equivalent) — shared `isStreamFile` if lifted out of `compute-pace-quality-calibration.mjs` (TD-05)
- [ ] `scripts/compute-pace-residual.mjs` — export `sweepArchive()` or an `isStreamFile`-filtered helper so the manifest exclusion has a unit-test seam (TD-05)
- [ ] `scripts/curate-queue/index.ts` — the "N exclusion entries ignored (malformed)" node beside `data-queue-summary` (TD-03)
- [ ] `scripts/compute-pr-ceiling-calibration.test.mjs` — "largest drift" and "owner-excluded" cases (TD-05)

*No framework installation gap — vitest already collects both file patterns this phase needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR-04 re-sign of the regenerated `28-DIFF.md` | TD-05 (D-12) | D-14 of Phase 28: the sign-off is a human judgment recorded outside the generated artifact, bound to its sha256 | Present the machine diff of `28-DIFF.md` against the Round 3 signed version (sha256 `cdf9d65499d7ac62123ecc33d1e298ae08a0d07f6740ba7bdcc4cf5fa365b8dd`), the three-way ceiling count (diff = recount `byGuard.ceiling` = `independentCeilingCount`), and any rank moves; record the developer's verdict verbatim in `28-VALIDATION.md` § PR-04 Sign-off (Round 4), then re-hash. Expected content delta: the TD-04 reason-string format on every ceiling row plus any archive drift since 2026-09-19. |
| Browser spot-check of the Records "another guard" sentence and the queue's malformed-entries line | TD-03 | Not warranted as a dedicated round (CONTEXT § Claude's Discretion): both surfaces are pure-text builders proven by unit assertions on planted fixtures, and neither can be reached on the real, well-formed archive without doctoring data. Optional. | If performed: doctor a COPY of `data/stats/best-efforts.json` served under `npm run curate`, never the committed file; quote the rendered text verbatim. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or an explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Every `-t` filter proven to match ≥1 test (count recorded in the row)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s for every targeted command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — the planner fills the Task ID / Plan / Wave columns; `wave_0_complete` flips once the Wave 0 files exist and run green.
