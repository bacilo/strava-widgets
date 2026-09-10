---
phase: 28
slug: pr-plausibility-ceiling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-10
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `28-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled in by the planner/executor once PLAN.md task IDs
> exist; the framework, sampling rate, and Wave 0 rows below are already fixed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18` |
| **Config file** | none — no separate `vitest.config.*`; vitest runs against the default TS/ESM setup already used by every `*.test.ts` in `src/` |
| **Quick run command** | `npx vitest run src/analytics/compute-best-efforts.test.ts src/analytics/best-effort-utils.test.ts src/dashboard/views/detail-best-efforts-logic.test.ts src/dashboard/views/records-logic.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s quick / ~180s full suite (60+ files, 1500+ tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green, plus `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` all exit 0
- **Max feedback latency:** 20 seconds (quick command)

---

## Per-Task Verification Map

*Populated during planning — one row per task ID emitted by the PLAN.md files.
Every requirement below must be claimed by at least one task row before
`wave_0_complete` may be set true.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD_ | — | — | PR-01 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "deterministic"` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-01 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-02 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "non-circular"` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-03 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "4556693525"` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-03 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "demoted efforts remain in efforts array"` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-04 | — | N/A | integration | `node scripts/compute-pr-ceiling-diff.mjs` twice + `diff --ignore-matching-lines='Generated:'` | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-04 | — | N/A | integration | classifier-independent recount script (zero-import discipline, per D-15) | ❌ W0 | ⬜ pending |
| _TBD_ | — | — | PR-05 | — | N/A | integration | 662-cohort dry-run count read from `data/dashboard/index.json` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New `describe` blocks in `src/analytics/compute-best-efforts.test.ts` for: determinism (two-run byte-identity), non-circularity (filtered-vs-unfiltered divergence fixture), the pinned `4556693525` 400m regression case (45.2s / 8.85 m/s — corrected against the live archive), and "no path deletes a flagged effort."
- [ ] New pure ceiling-derivation function plus its own `*.test.ts` (module location is a planner discretion item — `src/analytics/best-effort-ceiling.ts` or an addition to `best-effort-utils.ts`).
- [ ] `scripts/compute-pr-ceiling-diff.mjs` + its guard test, mirroring `scripts/compute-pace-residual.mjs`'s side-by-side OLD/NEW computation shape (the archive has no committed historical baseline to diff against — `data/stats/` is gitignored).
- [ ] A classifier-independent recount script for Criterion 5, mirroring `scripts/compute-pace-quality-recount.mjs`'s zero-classifier-import discipline exactly (D-15).
- [ ] Regression case for `buildPrFlagsCell` (`src/dashboard/views/detail-sections.ts:639-653`) covering a demoted+PR and a demoted+excluded row rendering distinguishably — guards against re-creating the Phase 24 R15 `PRExcluded — {reason}` concatenation defect. Verify first whether that function currently has any test file at all.
- [ ] `records-logic.test.ts` / `records.test.ts` case for the new "demoted, not never-attempted" empty-state branch.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A ceiling-demoted effort remains visibly present, with its stated demotion reason, on the activity detail view — and is absent only from the ranked PR list | PR-03 | Success criterion 4 explicitly requires the effort be "read directly in the browser, not merely present in JSON". A JSON assertion is exactly the self-agreeing check the project's Phase 23 CR-01 lesson exists to guard against. | Build and serve the dashboard, hard-reload (stale `index.html`/`index.json` in staged builds is a known trap), navigate to a known ceiling-demoted activity's detail view, read the effort row and its demotion reason on screen, then confirm the same effort is absent from the Records/PR ranking screen. Capture the served digest, not the build log. |
| Archive-wide before/after PR diff reviewed and signed off | PR-04 | Success criterion 5 makes developer sign-off the deliverable itself — a human must read every record that changes hands. | Generate the diff from the real full archive, read it, and confirm its record count reconciles with the independently-derived ceiling-rejected count from the criterion 3 dry run. Sign off before the phase closes. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
