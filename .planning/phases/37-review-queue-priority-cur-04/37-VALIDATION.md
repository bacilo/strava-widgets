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

Task IDs bound by the planner on 2026-11-25 (`<plan>-T<n>` = task n of that plan). One row per behaviour; executors fill Status and the matched test count. Manual-only rows below are executed by 37-07-T1 (automated guard red/green, recount capture, served digest) and 37-07-T2 (human gestures).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-T1 | 37-01 | 1 | CUR-06 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts` (`contaminatedMetres` de-duplicated per activity, Branch 2 + 3, 0 when none) | ✅ extend | ⬜ pending |
| 37-01-T2 | 37-01 | 1 | CUR-06 | — | Fail-closed parse (NaN, negative, string, absent → 0) | unit | `npx vitest run src/dashboard/data/best-efforts-client.test.ts` | ✅ extend | ⬜ pending |
| 37-04-T1 | 37-04 | 1 | CUR-06 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (union membership, tiers, comparator, tie-breaks; D-05 block rewritten) | ✅ rewrite | ⬜ pending |
| 37-05-T2 | 37-05 | 2 | CUR-06 | — | N/A | integration (`skipIf` no data) | `npx vitest run scripts/compute-review-queue-recount.test.mjs` (derive == recount on count AND order; the live block's evidence is taken on the primary checkout in 37-07-T1, and a live-only fail-closed result in a worktree is recorded, not counted) | ❌ W0 | ⬜ pending |
| 37-05-T1 | 37-05 | 2 | CUR-06 | — | N/A | unit | same file (recount fails on tier swap, no-dedupe metres, reversed order, dropped row, altered shipped field; passes on real derive) | ❌ W0 | ⬜ pending |
| 37-05-T1, 37-05-T2 | 37-05 | 2 | CUR-06 | — | No forbidden import, no import-time I/O | unit | same file + `vi.mock('fs')` import guard (positive controls) | ❌ W0 | ⬜ pending |
| 37-02-T2 | 37-02 | 1 | CUR-04 | T-37 V5 | `applyReviewUpsert`/`applyReviewRemove` exact entry shape, no mutation | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 37-02-T2 | 37-02 | 1 | CUR-04 | T-37 V4/V5 | 400 bad id/empty reason/bad fingerprint, 403 cross-origin (incl. GET), 409 exclusion conflict both directions, 413; tmp paths only | integration | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 37-02-T1 | 37-02 | 1 | CUR-04 | — | Real tracked files unchanged by the suite (SHA before/after); guard seen RED on a written tmp stand-in, and the publishRoot-empty and corrupt-not-overwritten tests seen RED under mutation (37-02-T2 step 9) | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 37-02-T3 | 37-02 | 1 | CUR-04 | — | Committed `reviewed.json` and `best-effort-exclusions.json` share no activityId | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 37-04-T2 | 37-04 | 1 | CUR-04 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (fingerprint order-independent, ignores metres; views incl. changed, orphans) | ✅ extend | ⬜ pending |
| 37-06-T1, 37-06-T2 | 37-06 | 2 | CUR-04 | T-37 XSS | textContent-only, no route literal, no forbidden tokens, one saveReviewed call site, confirm-guarded un-review, blank reason, fingerprint contract; each check seen RED under a recorded mutation (37-06-T1 a-e, 37-06-T2 a-e) | source-text | `npx vitest run scripts/curate-queue.test.mjs scripts/curate-overlay.test.mjs` | ✅ extend | ⬜ pending |
| 37-03-T1 | 37-03 | 1 | CUR-04 | T-37 leak | Guard 1 flags planted `data/curation/reviewed.json`, planted sibling, planted `data/reviewed.json`; clean control `[]`; exclusions not flagged; `UNSCANNED_EXTENSIONS` still `['.json']` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| 37-03-T2 | 37-03 | 1 | CUR-04 | T-37 leak | Guard 2 clean run prints three new `→ 404` lines; each planted leak exits non-zero naming the path | subprocess | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ⬜ pending |
| 37-04-T1 | 37-04 | 1 | CUR-04 | — | `derive-flagged.mjs` zero `import`, zero `console` (planted-violation proof) | source-text | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/compute-review-queue-recount.mjs` + `.test.mjs`, plus a `package.json` script `compute-review-queue-recount` (37-05-T1)
- [ ] A `vi.mock('fs')` import-time guard for the recount (copy `unreliable-segment-import-guards.test.mjs`'s mechanism and positive controls) (37-05-T2)
- [ ] `data/curation/reviewed.json` seed (committed) (37-02-T2)
- [ ] Zero-import/zero-console scan test for `derive-flagged.mjs` (37-04-T1)
- [ ] Injectable-paths refactor of `createServer` before any write-route test is written (37-02-T1, which precedes 37-02-T2)
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

---

## Checkpoint Evidence

Gathered by 37-07-T1 on the PRIMARY checkout, 2026-11-25. Human verdicts (37-07-T2) are NOT yet recorded here.

1. **Merge.** `git fetch origin`: origin/master is 0 commits ahead of HEAD (a995b6b2). No merge needed, no merge sha.
2. **Regenerate.** `npm run build`, `npm run compute-all-stats`, `npm run build-widgets` (in that order). The regeneration rewrote only the `generatedAt` stamp of `data/geo/geo-metadata.json`; that one generated file was reverted with `git checkout -- data/geo/geo-metadata.json`. `data/stats/best-efforts.json`: 1930 per-activity objects carry `contaminatedMetres`, non-numeric count 0.
3. **Gates.** `npx tsc --noEmit` clean. `npm test`: 122 files, 4274 tests passed. `live archive: derive vs recount` ran (not skipped) and passed; `scripts/compute-review-queue-recount.test.mjs` 21 passed. `scripts/verify-dashboard-publish-guard.test.mjs` 12 + `scripts/lib/curation-guard.test.mjs` 36 = 48 passed, none skipped. `npm run verify-dashboard` exit 0, and the three new success lines are present: `GET /__curate/reviewed -> 404`, `GET /__curate/reviewed/3475726256 -> 404`, `GET /data/curation/reviewed.json -> 404`.
4. **Served digests (D-20)** against `npm run curate` on 127.0.0.1:4173 (three equal triples: working tree = dist = served):
   - best-efforts.json: `f1254806fbcc7c42a8238bf162fbea70d0bffd9c`
   - dashboard/index.json: `6f3c51dec61a99bada98a4256ead9cbf41b81a63`
   - best-effort-exclusions.json: `6accea937561343174ad4a43c77a03f950c6fc14`
   - served `assets/index-twhf7FvW.js`: dist = served = `052f7e3557ddfa8c810d4ae7704f5aa6828967de`
5. **Recount.** `npm run compute-review-queue-recount`: exit 0, `PASS:`, 565 rows, tiers T1 5 / T2 556 / T3 4. Equals the CONTEXT probe figure (565) and its tier split; reference only, not the expected value (the expected value is the recount's own printed list). 12 exclusions, all 12 inside the recount list, so All 565 = To review 553 + Reviewed 0 + Excluded 12.
6. **Guards red then green** (planted on the real built tree, removal in a shell `trap`):
   - Planting only a FILE named `dist/widgets/__curate` leaves `/__curate/reviewed` at 404 (a file has no children), so guard 2 named only `/data/curation/reviewed.json`. The plan's expectation that guard 2 names `/__curate/reviewed` is reachable only by planting a directory `__curate/` containing a file `reviewed`. That plant was used for the recorded run below.
   - Guard 1 `findCurationArtifacts('dist/widgets')` exit 1: `dist/widgets/__curate` (directory), `dist/widgets/data/curation`, `dist/widgets/data/curation/reviewed.json`.
   - Guard 2 `npm run verify-dashboard` exit 1: `GET /__curate/reviewed expected 404 ..., got 200` and `GET /data/curation/reviewed.json expected 404 ..., got 200`.
   - After removal: both exit 0; `test ! -e dist/widgets/data/curation && test ! -e dist/widgets/__curate` holds; `git diff --exit-code data/curation/reviewed.json data/best-effort-exclusions.json` exit 0.
