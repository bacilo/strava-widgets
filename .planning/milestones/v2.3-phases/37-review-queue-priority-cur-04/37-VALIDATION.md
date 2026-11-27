---
phase: 37
slug: review-queue-priority-cur-04
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-25
audited: 2026-11-26
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
| 37-01-T1 | 37-01 | 1 | CUR-06 | — | N/A | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts` (`contaminatedMetres` de-duplicated per activity, Branch 2 + 3, 0 when none) | ✅ extend | ✅ green |
| 37-01-T2 | 37-01 | 1 | CUR-06 | — | Fail-closed parse (NaN, negative, string, absent → 0) | unit | `npx vitest run src/dashboard/data/best-efforts-client.test.ts` | ✅ extend | ✅ green |
| 37-04-T1 | 37-04 | 1 | CUR-06 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (union membership, tiers, comparator, tie-breaks; D-05 block rewritten) | ✅ rewrite | ✅ green |
| 37-05-T2 | 37-05 | 2 | CUR-06 | — | N/A | integration (`skipIf` no data) | `npx vitest run scripts/compute-review-queue-recount.test.mjs` (derive == recount on count AND order; the live block's evidence is taken on the primary checkout in 37-07-T1, and a live-only fail-closed result in a worktree is recorded, not counted) | ❌ W0 | ✅ green |
| 37-05-T1 | 37-05 | 2 | CUR-06 | — | N/A | unit | same file (recount fails on tier swap, no-dedupe metres, reversed order, dropped row, altered shipped field; passes on real derive) | ❌ W0 | ✅ green |
| 37-05-T1, 37-05-T2 | 37-05 | 2 | CUR-06 | — | No forbidden import, no import-time I/O | unit | same file + `npx vitest run scripts/unreliable-segment-import-guards.test.mjs` (`vi.mock('fs')` block at :164, positive controls) | ✅ W0 done | ✅ green |
| 37-02-T2 | 37-02 | 1 | CUR-04 | T-37 V5 | `applyReviewUpsert`/`applyReviewRemove` exact entry shape, no mutation | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ✅ green |
| 37-02-T2 | 37-02 | 1 | CUR-04 | T-37 V4/V5 | 400 bad id/empty reason/bad fingerprint, 403 cross-origin (incl. GET), 409 exclusion conflict both directions, 413; tmp paths only | integration | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ✅ green |
| 37-02-T1 | 37-02 | 1 | CUR-04 | — | Real tracked files unchanged by the suite (SHA before/after); guard seen RED on a written tmp stand-in, and the publishRoot-empty and corrupt-not-overwritten tests seen RED under mutation (37-02-T2 step 9) | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ✅ green |
| 37-02-T3 | 37-02 | 1 | CUR-04 | — | Committed `reviewed.json` and `best-effort-exclusions.json` share no activityId | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ✅ green |
| 37-04-T2 | 37-04 | 1 | CUR-04 | — | N/A | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (fingerprint order-independent, ignores metres; views incl. changed, orphans) | ✅ extend | ✅ green |
| 37-06-T1, 37-06-T2 | 37-06 | 2 | CUR-04 | T-37 XSS | textContent-only, no route literal, no forbidden tokens, one saveReviewed call site, confirm-guarded un-review, blank reason, fingerprint contract; each check seen RED under a recorded mutation (37-06-T1 a-e, 37-06-T2 a-e) | source-text | `npx vitest run scripts/curate-queue.test.mjs scripts/curate-overlay.test.mjs` | ✅ extend | ✅ green |
| 37-03-T1 | 37-03 | 1 | CUR-04 | T-37 leak | Guard 1 flags planted `data/curation/reviewed.json`, planted sibling, planted `data/reviewed.json`; clean control `[]`; exclusions not flagged; `UNSCANNED_EXTENSIONS` still `['.json']` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ✅ green |
| 37-03-T2 | 37-03 | 1 | CUR-04 | T-37 leak | Guard 2 clean run prints three new `→ 404` lines; each planted leak exits non-zero naming the path | subprocess | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ✅ green |
| 37-04-T1 | 37-04 | 1 | CUR-04 | — | `derive-flagged.mjs` zero `import`, zero `console` (planted-violation proof) | source-text | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ✅ W0 done | ✅ green |
| fix CR-01 (0896c257) | review | — | CUR-04 | — | Fingerprint tokens are `<distance>:<kind>:<guard>`; a 5k demoted↔contaminated flip resurfaces a reviewed row as `changed` (both directions, with an unchanged-evidence control) | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` (tests at :455, :460, :469; RED on pre-fix derive per 37-VERIFICATION) | ✅ | ✅ green |
| fix WR-01 (199b810f) | review | — | CUR-04 | T-37-12 | Tracked-file SHA guard hooks at file scope, so they run after every write suite | unit | `npx vitest run scripts/curate-server.test.mjs` (hooks :78-87; RED under a probe write per commit 199b810f) | ✅ | ✅ green |
| audit 2026-11-26 | validate | — | CUR-04 | T-37-07 | Producer↔validator contract: every `fingerprintFor` output passes `normalizeFingerprint`. Realistic worst case 482 chars, loose bound 1555 (both derived from source vocabulary), every live row (565, max 219 chars), the cap pinned against source | unit | `npx vitest run scripts/curate-queue/fingerprint-contract.test.mjs` (9 tests; RED under a charset mutation (4 failed) and a length mutation (2 failed), plus in-test negative controls) | ✅ new | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/compute-review-queue-recount.mjs` + `.test.mjs`, plus a `package.json` script `compute-review-queue-recount` (37-05-T1)
- [x] A `vi.mock('fs')` import-time guard for the recount (copy `unreliable-segment-import-guards.test.mjs`'s mechanism and positive controls) (37-05-T2)
- [x] `data/curation/reviewed.json` seed (committed) (37-02-T2)
- [x] Zero-import/zero-console scan test for `derive-flagged.mjs` (37-04-T1)
- [x] Injectable-paths refactor of `createServer` before any write-route test is written (37-02-T1, which precedes 37-02-T2)
- [x] Framework install: none needed

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist audit passed 2026-11-26 (`/gsd-validate-phase 37`). Human UAT sign-off is still `/gsd-verify-work`'s call.

---

## Checkpoint Evidence

Gathered by 37-07-T1 on the PRIMARY checkout, 2026-11-25. Human verdicts (37-07-T2) are in "Checkpoint Verdicts" below.

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

Plan defect (not a code defect): the plan's guard-2 expectation of naming `/__curate/reviewed` needs a planted directory `__curate/` containing a file `reviewed`; a planted file named `__curate` cannot produce it (see item 6).

Per-Task map statuses: every row is green on the evidence of its plan SUMMARY (mutation-proven RED/GREEN recorded there) plus the primary-checkout full run in item 3 (122 files, 4274 tests passed; recount file 21, guard suites 12 + 36, none skipped, none matched at 0).

---

## Checkpoint Verdicts

Served build: curate server 127.0.0.1:4173 serving the digest-verified build from Evidence item 4. Clean start (`git diff --exit-code` on reviewed.json and best-effort-exclusions.json) was exit 0 before step 3.

| Step | Requirement | Verdict | Observation (developer / orchestrator, verbatim in substance) |
|------|-------------|---------|----------------------------------------------------------------|
| 1 Order (D-09, D-19) | CUR-06 | PASS | DOM extractions (id, data-tier, data-contaminated-metres) saved as dom-all.txt (565 rows, sha1 82e62501e5c1dbde2dcfc88ee48c28986d6f2e07) and dom-tr.txt (553 rows, sha1 a1f948f81b5c817b8fb4f6808c21cf83b225ffa7), diffed against the recount-derived list normalized to "id tier metres". All: 565 rows identical (count, set, position, tier, metres). To review: 553 rows identical; the 12 excluded absent, including tier-3 5059204779. Mismatch list empty. |
| 2 Views (D-15) | CUR-04 | PASS | Summary 553 + 0 + 12 = 565; each view button count matched its rows. |
| 3 Mark reviewed | CUR-04 | PASS | Empty reason shows "A reason is required.", no write. With a reason the row moved to Reviewed. `git diff data/curation/reviewed.json` showed exactly one added entry {activityId 3540594727, reason "just reviewed", reviewedAt 2026-11-25T17:31:13.923Z, fingerprint "10k:unreliable-segment,400m:unreliable-segment\|t=0"}; exclusions file no diff. |
| 4 Mutual exclusion (D-11) | CUR-04 | PASS | Excluded 3475726256 shows exclusion controls only, no review control, line "Remove the exclusion first to mark this reviewed and kept." Reviewed 3540594727 shows no exclude control and "Un-review first to exclude this activity." curl: PUT /__curate/reviewed/3475726256 -> 409 "Conflict: activity is excluded - remove the exclusion first"; PUT /__curate/exclusions/3540594727 -> 409 "Conflict: activity is reviewed and kept - un-review it first"; neither file changed. |
| 5 Resurface (D-10) | CUR-04 | PASS | Fingerprint edited to "10k:unreliable-segment\|t=0"; after hard-reload 3540594727 appeared under To review marked "changed since review" with old reason and date, with Review again and Un-review controls. |
| 6 Orphan (D-13) | CUR-04 | PASS | Appended {activityId 10041312551, reason "orphan probe (37-07 step 6)", reviewedAt 2026-11-25T17:40:00.000Z, fingerprint "\|t=0"}; Reviewed showed "No longer flagged (1)" with it; the summary counted it. |
| 7 Un-review (D-14) | CUR-04 | PASS | Orphan and changed row un-reviewed through the page (confirm dialogs). `git diff --exit-code data/curation/reviewed.json data/best-effort-exclusions.json` exit 0 afterwards. Observation: Un-review for the changed row 3540594727 is visible under To review, not Reviewed. By design: a "changed" entry lives in To review (scripts/curate-queue/index.ts:444-447); reviewed-state rows mount Un-review in Reviewed (index.ts:441-443), which was seen in step 4. |
| 8 Close | - | PASS | Curate server (pid 9339) stopped; port 4173 no longer listening; working tree clean. FALLBACK RESTORE not needed. |
| T1 guards red/green | CUR-04 | PASS | See Evidence item 6 (red on planted leak, green after removal; both guards). |
| T1 recount/digests | CUR-06 | PASS | See Evidence items 4-5. |

Sequencing deviation: the orchestrator applied the step-5 fingerprint edit and the step-6 orphan append together before the developer checked step 4's reviewed half. The reviewed row had already resurfaced, so the orchestrator restored the matching fingerprint, the developer confirmed step 4 (reviewed half) and step 6 together, and the orchestrator re-broke the fingerprint for step 5. Verdicts are unaffected.

Requirement disposition: every row mapped to CUR-04 and CUR-06 is PASS, so both are ticked in REQUIREMENTS.md. Sign-off approval remains for /gsd-verify-work.

---

## Validation Audit 2026-11-26

Every mapped file was re-run on the primary checkout: 9 files, 425 tests passed, 0 skipped, 0 failed, and the tree was clean afterwards. After the new contract test and the import-guard file were added, all of it was green again. The new test also runs under `vitest.logic.config.ts` (9 passed). The quick-run command (curate files) took about 0.6 s.

| Metric | Count |
|--------|-------|
| Gaps found | 1 (producer↔validator fingerprint contract, MISSING) |
| Resolved | 1 (`scripts/curate-queue/fingerprint-contract.test.mjs`) |
| Escalated | 0 |
| Map rows added | 3 (CR-01, WR-01, contract) |
| Map rows corrected | 1 (the recount import guard now names `unreliable-segment-import-guards.test.mjs`) |

Caveat: the 482 / 1555 exact-length pins fail on any vocabulary change (a new distance, a new guard or a longer name). That is intended. Redo the derivation in the test's header comment when they fire.

Out of scope here (they are review findings, not requirement gaps; tracked as a todo by 9782bd14): WR-02/WR-03 (fetch fails open, so the queue is silently partial), WR-04 (a `null` reviewed entry makes writes answer 500), WR-05, IN-01..IN-05.
