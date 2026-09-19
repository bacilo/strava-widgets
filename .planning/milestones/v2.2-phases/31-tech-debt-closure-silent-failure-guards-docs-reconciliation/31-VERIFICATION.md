---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
verified: 2026-09-19T15:05:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation Verification Report

**Phase Goal:** Close the v2.2 close-out audit's five silent-and-passing findings at the source — each with a demonstrated-failing test — and reconcile every artifact of record with the code and the merged 1,899-activity archive, so the milestone can be completed on a record that matches the code.
**Verified:** 2026-09-19T15:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Requirement) | Status | Evidence |
|---|---|---|---|
| 1 | TD-01: CR-01 regression tests decoupled from the live exclusions file; fixture carries both entries, one live premise test remains | ✓ VERIFIED | `-t "REAL committed exclusion"` → exactly 1 passed; `-t "premise"` → 2 passed; `-t "fixture copy"` → 1 passed. `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` has both `4556693525` and `3475711469` with `distances: null`. Only one `new URL(...)` reference to the real file remains (line 987 of `compute-best-efforts.test.ts`); premise-failure message names entry, real file, fixture path and test (lines 976-978). |
| 2 | TD-02: `copyJsonTree` mtime skip replaced with size-then-digest; both call sites intact | ✓ VERIFIED | `grep -n mtime` on `scripts/lib/copy-data-tree.mjs` shows no mtime comparison — the guard is `statSync` size compare then `createHash('sha1')` digest compare (lines 50-58). `-t "stale"` → 1 passed, `-t "skip"` → 1 passed. Both `scripts/build-widgets.mjs:233` and `scripts/curate-server.mjs:691` still call `copyJsonTree`. |
| 3 | TD-03: Records `other` bucket, recount fail-closed on malformed exclusions, queue malformed count | ✓ VERIFIED | `records-logic.test.ts -t "another guard"` → 2 passed; `compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` → 7 passed; `derive-flagged.test.mjs -t "malformed"` → 10 passed (≥6 required). Parity test `countMalformedExclusions(doc) === recountDemotedActivities(...).malformedExclusions.length` exists at `derive-flagged.test.mjs:395-443` (the CR-01 post-review fix). `grep -nE "^import .* from" scripts/compute-pr-ceiling-recount.mjs` shows only `fs`, `path`, `url`. `node scripts/compute-pr-ceiling-recount.mjs` → exit 0, `PASS: recount agrees with the shipped totals`. |
| 4 | TD-04: ceiling demotion reason always states margin at 3dp, sub-0.0005 renders `<0.001` | ✓ VERIFIED | `best-effort-ceiling.ts` `marginText = margin < 0.0005 ? '<0.001' : margin.toFixed(3)` (post-review WR-01 fix). `data/stats/best-efforts.json`'s `3475730418`@1mi reason reads exactly `implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)`. A full scan of the shipped document for `/by 0\.000 m\/s/` found zero matches. `-t "house register"` → 2 passed. |
| 5 | TD-05: five artifacts of record regenerated against merged archive, reconciled, one fresh PR-04 sign-off; stale figures corrected in place | ✓ VERIFIED | All five artifacts (`26-RESIDUAL.md`, `27-CALIBRATION.md`, `28-CEILING-CALIBRATION.md`, `28-DIFF.md`, `30-CALIBRATION.md`) carry `**Generated:** 2026-09-19T...` stamps. `26-RESIDUAL.md` reports "Archive size scanned: 1874". `28-DIFF.md` sha256 = `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`, matching `28-VALIDATION.md`'s recorded "New sha256" and its § PR-04 Sign-off (Round 4) / Developer's Verdict (Round 4) binds that exact hash to a verbatim recorded verdict ("Approve — R4-1/R4-2 PASS, R4-3 PASS via 4556693525@1k"). `28-CEILING-CALIBRATION.md` reads "19 + 13 = 32 — matches the shipped document's 32 ceiling demotions" (WR-03 post-review fix, measured not asserted). WR-07 fixed: the largest-drift sentence in `28-CEILING-CALIBRATION.md` names "10k" (data-derived), not a hard-coded "400m". REQUIREMENTS.md and ROADMAP.md both carry the old figures ("716 of 1,864", "13 of the 154", "1,866 streams scanned") ONLY inside dated correction notes (`grep ... | grep -vi corrected` → 0 matches for all four strings checked); 8 "Corrected 2026-" notes present in REQUIREMENTS.md. `v2.2-MILESTONE-AUDIT.md` line 57 records G-01 CLOSED with cross-reference to plan 27-11 and the 31-08 re-confirmation. |
| 6 | TD-06: no v2.2 phase carries a pre-execution validation record; 27-VALIDATION.md flips to passed | ✓ VERIFIED | `27-VALIDATION.md` frontmatter `status: passed`. `26-VALIDATION.md` and `29-VALIDATION.md` both carry `## Validation Audit 2026-09-19` sections with live re-run evidence (26: PACE-04 row repointed and re-run; 29: `updated: 2026-09-19`, all rows re-run live). `31-VALIDATION.md` frontmatter `status: passed`, `nyquist_compliant: true`. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` | committed two-entry fixture | ✓ VERIFIED | Both entries present, `distances: null` on each, matches live file verbatim per its own note |
| `src/analytics/compute-best-efforts.test.ts` | repointed CR-01 tests + 1 premise test + fixture-copy mutation test | ✓ VERIFIED | Confirmed by `-t` filters above; premise test at line 982, fixture-copy mutation test at line 1255 writes only under `tmpDir` |
| `scripts/lib/copy-data-tree.mjs` | size-then-digest, no mtime | ✓ VERIFIED | Lines 44-68; staleness log at line 63 (per D-05) |
| `scripts/lib/copy-data-tree.test.mjs` | stale/skip tests | ✓ VERIFIED | Both `-t` filters ≥1 |
| `src/dashboard/views/records-logic.ts` | `other` bucket + fixed-order sentence | ✓ VERIFIED | `DemotionCounts.other`, `describeDemotionCounts` renders "N by another guard" after the three named guards (lines 190-252) |
| `scripts/compute-pr-ceiling-recount.mjs` | fail-closed on malformed exclusions, no classifier/queue import | ✓ VERIFIED | Only `fs`/`path`/`url` imported; `node` run PASSes on real file |
| `scripts/curate-queue/derive-flagged.mjs` + `index.ts` | malformed count + rendered line | ✓ VERIFIED | `countMalformedExclusions` exported; queue page renders `data-queue-malformed-note` (line 311-316) |
| `src/analytics/best-effort-ceiling.ts` | margin-stating reason, `<0.001` floor | ✓ VERIFIED | Confirmed via source read and live document scan |
| `26-RESIDUAL.md`, `27-CALIBRATION.md`, `28-CEILING-CALIBRATION.md`, `28-DIFF.md`, `30-CALIBRATION.md` | regenerated, reconciled, dated | ✓ VERIFIED | All carry 2026-09-19 `Generated:` stamps; content spot-checked above |
| `28-VALIDATION.md` § PR-04 Sign-off (Round 4) | fresh re-sign bound to new sha256 | ✓ VERIFIED | Verbatim developer verdict recorded, bound to `97e1782c…` |
| `27-VALIDATION.md`, `26-VALIDATION.md`, `29-VALIDATION.md` | backfilled validation records | ✓ VERIFIED | Statuses and audit trails confirmed above |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `compute-best-efforts.test.ts` (4 CR-01 tests) | `best-effort-exclusions.fixture.json` | `fileURLToPath` + `computeBestEfforts({ exclusionsPath })` | WIRED | Confirmed by fixture-copy mutation test changing the 1k demotion outcome |
| `compute-best-efforts.test.ts` premise test | `data/best-effort-exclusions.json` | single remaining live read | WIRED | Only one live-file reference remains in the whole file |
| `build-widgets.mjs` / `curate-server.mjs` | `copy-data-tree.mjs` `copyJsonTree` | direct import + call | WIRED | Both call sites present and unchanged in shape |
| `records.ts` | `describeDemotionCounts` | direct call | WIRED | Unchanged call site per CONTEXT § Integration Points; `other` field flows through automatically |
| `curate-queue/index.ts` | `derive-flagged.mjs` `countMalformedExclusions` | direct call | WIRED | Line 311, rendered into DOM at line 313-316 |
| `compute-pr-ceiling-calibration.mjs` | shipped `best-efforts.json` ceiling-demotion count | `countShippedCeilingDemotions` | WIRED | WR-03 post-review fix — sentence now measures rather than asserts identity |

### Data-Flow Trace (Level 4)

Not applicable in the strict sense (no rendered dashboard component with live state) — the phase's two rendered surfaces (Records `other` bucket sentence, curation queue malformed-count line) were traced to their data sources above and both derive from computed counts, not hardcoded/empty defaults.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Recount fails closed / passes on real file | `node scripts/compute-pr-ceiling-recount.mjs` | exit 0, "PASS: recount agrees with the shipped totals" | ✓ PASS |
| Pace-quality recount matches expected | `node scripts/compute-pace-quality-recount.mjs --expect 299` | "MATCH", "PASS" | ✓ PASS |
| Elevation recount agrees | `node scripts/compute-elevation-recount.mjs` | "PASS: recount agrees with the shipped elevation tiers" | ✓ PASS |
| Full suite green | `npm test` | 85 files / 2608 tests passed | ✓ PASS |
| Type-check clean | `npx tsc --noEmit` | no output, exit clean | ✓ PASS |
| Build clean | `npm run build-widgets` | completed, no errors; `dist/` regenerated (gitignored) | ✓ PASS |
| Working tree unaffected by verification | `git status --porcelain` | empty | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or PLAN/SUMMARY-declared probes found for this phase. SKIPPED — this phase is a test/compute/tooling/docs phase whose verification is the `npm test` + generator-script suite already exercised above, not shell probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TD-01 | 31-01 | Decouple CR-01 tests from live exclusions file | ✓ SATISFIED | Fixture + premise test confirmed above |
| TD-02 | 31-02 | Replace mtime skip with digest comparison | ✓ SATISFIED | Source + tests confirmed above |
| TD-03 | 31-03, 31-04 | Honest degradation / fail-closed on malformed data, three sites | ✓ SATISFIED | All three sites confirmed, parity test present |
| TD-04 | 31-05 | Margin always stated in ceiling demotion reason | ✓ SATISFIED | Source + live document scan confirmed |
| TD-05 | 31-06, 31-07, 31-08, 31-09, 31-10 | Reconcile all artifacts of record with code and merged archive | ✓ SATISFIED | All five artifacts, PR-04 re-sign, dated corrections confirmed |
| TD-06 | 31-09 | No v2.2 phase carries a pre-execution validation record | ✓ SATISFIED | 26/27/29-VALIDATION.md audit trails confirmed |

No orphaned requirements — REQUIREMENTS.md traceability table maps all six TD-01..TD-06 to Phase 31, and all six are addressed by at least one PLAN's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 21 phase-touched source/test files | none found | — | No debt markers in any phase-touched file |
| `scripts/curate-queue/index.ts:315` | 315 | IN-06 (review, unresolved): `${malformedCount} exclusion entries ignored` always plural, never singular-corrected | ℹ️ Info | Cosmetic only; review classified as Info, not required to fix; does not affect any TD-0x success criterion |
| `scripts/lib/copy-data-tree.mjs:63` | 63 | IN-01/IN-02 (review, unresolved): staleness log prints absolute path and fires before copy completes; no test pins log silence on ordinary copies | ℹ️ Info | Does not affect D-04/D-05/D-06 correctness — the digest-replace behavior itself is proven; only the log's cosmetic/timing details are unaddressed |
| various | — | IN-03/IN-04/IN-05/IN-07/IN-08 (review, unresolved) | ℹ️ Info | All classified Info by 31-REVIEW.md; none contradicts a Phase 31 success criterion — spot-checked IN-08 (empty-string activityId) does not affect the live archive's real exclusions file, which has no such entries |

31-REVIEW.md status is `fixed` (1 Critical + 3 Warnings all resolved by commits `75ae1ff1`, `33763113`, `fa38f913`, `2a0a9c45`, confirmed present in `git log`). The remaining 8 Info items are advisory polish items explicitly left open by the reviewer and do not block any of the six success criteria — confirmed by re-reading each Info item against the roadmap's six criteria; none names a criterion it would break.

### Out-of-Scope Guard

Confirmed untouched by `git diff --name-only 7cb7c793^..HEAD`: no changes to `src/dashboard/index-client.ts` (retype deferred to v2.3), no ceiling-file write-gate code, no `CUR-04` dismiss action, no 26 F-26-02 histogram-tail code, no 30 badge-wording changes. `scripts/curate-queue/index.ts` WAS touched, but only for the in-scope D-09 malformed-count line — confirmed by review's files-reviewed list and by reading the diff context around line 311-316.

### Human Verification Required

None. The phase's only human-judgment step (PR-04 Round 4 re-sign, `31-10-T2`) was completed during execution — the developer's verbatim blanket approval is recorded in `28-VALIDATION.md` § PR-04 Sign-off (Round 4) / Developer's Verdict (Round 4), bound to the exact sha256 (`97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`) independently verified above. No new human verification items were identified during this audit.

### Gaps Summary

No gaps found. All six roadmap success criteria (TD-01 through TD-06) are independently verified against running code and committed artifacts, not SUMMARY narration: every `-t` filter was re-run live in this session and met or exceeded its documented expected count; the full regression suite (85 files / 2608 tests), `tsc --noEmit`, `build-widgets`, and all three independent recount scripts (`compute-pr-ceiling-recount.mjs`, `compute-pace-quality-recount.mjs --expect 299`, `compute-elevation-recount.mjs`) all pass clean; the working tree is unmodified by this verification (`git status --porcelain` empty before and after); the four post-review fix commits (CR-01, WR-01, WR-02, WR-03) are present in git history and their effects are observable in the current source and the regenerated `28-DIFF.md`/`28-CEILING-CALIBRATION.md`; the PR-04 Round 4 sign-off is bound to the correct, independently-recomputed sha256; and the out-of-scope list from ROADMAP § Phase 31 was confirmed untouched.

---

_Verified: 2026-09-19T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
