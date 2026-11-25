---
phase: 37
slug: review-queue-priority-cur-04
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-25
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `37-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` (`fileParallelism: false`); `vitest.logic.config.ts` excludes `*.archive.test.*`; `vitest.archive.config.ts` |
| **Quick run command** | `npx vitest run scripts/curate-queue scripts/curate-queue.test.mjs scripts/curate-server.test.mjs scripts/curate-overlay.test.mjs scripts/lib/curation-guard.test.mjs` |
| **Full suite command** | `npm run test:logic` then `npm run build` (tsc catches fixture literals missing the new required field) |
| **Estimated runtime** | ~3 s quick; full suite per wave |

Baseline before the phase: the curate-related files ran 184 tests green in about 2 s.

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `npm run test:logic` plus `npm run build`
- **Before `/gsd-verify-work`:** Full suite green, `npm run verify-dashboard` against a fresh `npm run build-widgets` on the primary checkout, and the browser checkpoint recorded
- **Max feedback latency:** 5 seconds (quick run)

---

## Per-Task Verification Map

Task IDs are bound when plans are written. One row per behaviour; the executor fills the Task ID and Status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CUR-06 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts` (`contaminatedMetres` de-duplicated per activity, Branch 2 + 3, 0 when none) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-06 | — | Fail-closed parse (NaN, negative, string, absent → 0) | unit | `npx vitest run src/dashboard/data/best-efforts-client.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-06 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (union membership, tiers, comparator, tie-breaks; D-05 block rewritten) | ✅ rewrite | ⬜ pending |
| TBD | TBD | TBD | CUR-06 | — | N/A | integration (`skipIf` no data) | `npx vitest run scripts/compute-review-queue-recount.test.mjs` (derive == recount on count AND order) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CUR-06 | — | N/A | unit | same file (recount fails on tier swap, no-dedupe metres, reversed order, dropped row, altered shipped field; passes on real derive) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CUR-06 | — | No forbidden import, no import-time I/O | unit | same file + `vi.mock('fs')` import guard (positive controls) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | T-37 V5 | `applyReviewUpsert`/`applyReviewRemove` exact entry shape, no mutation | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | T-37 V4/V5 | 400 bad id/empty reason/bad fingerprint, 403 cross-origin (incl. GET), 409 exclusion conflict both directions, 413; tmp paths only | integration | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | — | Real tracked files unchanged by the suite (SHA before/after) | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | — | Committed `reviewed.json` and `best-effort-exclusions.json` share no activityId | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (fingerprint order-independent, ignores metres; views incl. changed, orphans) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | T-37 XSS | textContent-only, no route literal, no forbidden tokens | source-text | `npx vitest run scripts/curate-queue.test.mjs scripts/curate-overlay.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | T-37 leak | Guard 1 flags planted `data/curation/reviewed.json`, planted sibling, planted `data/reviewed.json`; clean control `[]`; exclusions not flagged; `UNSCANNED_EXTENSIONS` still `['.json']` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | T-37 leak | Guard 2 clean run prints three new `→ 404` lines; each planted leak exits non-zero naming the path | subprocess | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CUR-04 | — | `derive-flagged.mjs` zero `import`, zero `console` (planted-violation proof) | source-text | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/compute-review-queue-recount.mjs` + `.test.mjs`, plus a `package.json` script `compute-review-queue-recount`
- [ ] A `vi.mock('fs')` import-time guard for the recount (copy `unreliable-segment-import-guards.test.mjs`'s mechanism and positive controls)
- [ ] `data/curation/reviewed.json` seed (committed)
- [ ] Zero-import/zero-console scan test for `derive-flagged.mjs`
- [ ] Injectable-paths refactor of `createServer` before any write-route test is written
- [ ] Framework install: none needed

---

## Standing Evidence Rules (every row)

- Expected values come from the recount or from a hand-built fixture with a stated derivation. They never come from CONTEXT's probe figures (371 / 365 / 194 / 451 / 5 / 565), which are for reconciliation only.
- Each discriminator is exercised both failing and passing. A row that cannot fail, or cannot pass, is a defect in the row.
- Any `-t` selection records its expected matched count, and the test asserts it is non-zero. Prefer a file path.
- No test writes to or git-checkouts a tracked file (`data/curation/reviewed.json`, `data/best-effort-exclusions.json`, `.planning/**`). Writes go to `os.tmpdir()`.
- No guard is built on `vi.spyOn(fs, 'readFileSync')`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Queue order and count in the browser equal the recount's ordered list | CUR-06 | Served build + browser rendering | Primary checkout: `npm run build`, `npm run compute-best-efforts`, `npm run build-widgets`, `npm run curate`. Verify that the served `best-efforts.json` digest equals the working tree, then hard-reload. Compare the DOM row ids with the output of `node scripts/compute-review-queue-recount.mjs`, by set and by order. |
| Mark reviewed → leaves To review, appears under Reviewed; un-review removes the entry | CUR-04 | Gestures need a human | Mark one row, reload, and check `git diff data/curation/reviewed.json` shows exactly that entry with exclusions untouched. Un-review it and confirm the entry is gone. |
| Resurface on fingerprint change ("changed since review"); orphans shown | CUR-04 | Browser state | Edit the fixture so the stored fingerprint differs, then hard-reload and confirm the row returns to To review with its old reason and date. |
| D-11 mutual exclusion surfaced in the UI (409 message) | CUR-04 | Gestures | Try to exclude a reviewed row, and to review an excluded one. |
| Both publish guards red under a planted leak, green on the served build | CUR-04 | Requires planting into dist | Plant `dist/widgets/data/curation/reviewed.json`. Show guard 1 red (`findCurationArtifacts('dist/widgets')` or build-widgets) and `npm run verify-dashboard` red. Remove the file, then show both green. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
