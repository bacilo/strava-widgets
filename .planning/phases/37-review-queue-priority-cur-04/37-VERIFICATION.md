---
phase: 37-review-queue-priority-cur-04
verified: 2026-11-25T19:20:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 3/3
  note: "Re-verification after post-review fix round (0896c257 CR-01, 199b810f WR-01, bc06014e docs). Prior report at 7e7e8b28."
  gaps_closed:
    - "CR-01: demoted vs contaminated flip now resurfaces a reviewed row"
    - "WR-01: tracked-file SHA guard now runs at file scope"
  gaps_remaining: []
  regressions: []
---

# Phase 37: Review Queue Priority (CUR-04, CUR-06) Verification Report

**Phase Goal:** The curation review queue is reordered by pause-classification and unreliable-segment guard priority, and a queue row can be marked "reviewed and kept" (reversible, distinct from exclude, own committed file) through the existing overlay transport, with both publish guards re-verified.
**Verified:** 2026-11-25T19:20:00Z
**Status:** passed
**Re-verification:** Yes. This is a re-verification after the CR-01 and WR-01 fix round. The prior report is at 7e7e8b28.

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Reviewed-and-kept with required reason, own committed file, leaves default view, reachable under "reviewed", reversible | VERIFIED | `data/curation/reviewed.json` is tracked and empty (`"reviewed": []`), separate from the exclusions file. The `none`/`reviewed`/`changed` states in `derive-flagged.mjs:374-378` are unchanged apart from the token format. The full suite is green (below), including the server write suites. |
| 2 | Both guards red under planted leak, green on served build | VERIFIED (regression check) | The fix round did not touch `curation-guard.mjs`, `build-widgets.mjs` or `verify-dashboard-publish.mjs`. The guard suites are part of the green full run. The earlier browser and dist evidence still stands. |
| 3 | Queue lists guard-moved and transported activities, transported first then contaminated metres, count equals independent recount | VERIFIED | `npm run compute-review-queue-recount` exited 0 with PASS and 565 rows. The recount is independent of derive. Ordering and membership logic are untouched by the fix, which only changed the fingerprint string. |

**Score:** 3/3

## CR-01 Fix Verification

**Consistency across producers and consumers.** I grepped `scripts/` and `src/` for `fingerprint` and `|t=`.
- There is one producer, `fingerprintFor` (`derive-flagged.mjs:158-172`). It now emits `<distance>:<kind>:<guard>` with kind `demoted` (from `e.demotion`) or `contaminated` (from `e.contaminated`). The result is sorted and de-duplicated, with the `|t=0|1` suffix.
- The consumers do no parsing. `derive-flagged.mjs:378` does string equality between the stored and current fingerprint. `curate-queue/index.ts:340` and `:404` pass it through or display it. `curate-overlay/index.ts:145` sends it. `curate-server.mjs:812` validates it with `normalizeFingerprint`. Nothing splits on `:` or `,`.
- `normalizeFingerprint` has a charset `[A-Za-z0-9:,|=-]` that still admits the new tokens, and its cap is now 2000. The 1555-character worst case from the commit fits. The cap is a regex literal, and I did not recompute 1555 independently.
- A grep for old-format tokens (`<dist>:<guard>` without a kind) finds nothing in the code or the tests. It finds hits only in historical planning prose (37-REVIEW.md quotes the old probe on purpose, and 37-02/37-04 PLANs and the 37-VALIDATION step-3 evidence row record the pre-fix format). Those are records, not code.

**D-10 resurface logic.** The `none`/`reviewed`/`changed` computation is unchanged. A stored fingerprint that differs from the current one gives `changed`, which `to-review` includes. A stale old-format string would also resurface as `changed`, which is fail-safe. None exists, because `reviewed.json` is empty.

**Test non-vacuity.** I extracted `scripts/` from HEAD into a scratch directory and put the pre-fix `derive-flagged.mjs` (`git show 7e7e8b28:...`) in place. No tracked file was modified. `derive-flagged.test.mjs` then showed 9 failures, including all three new CR-01 tests:
- "a 5k demoted effort and a 5k contaminated effort ... fingerprint differently"
- "tokens are `<distance>:<kind>:<guard>`..."
- "a reviewed row resurfaces as changed when its 5k flips demoted -> contaminated (and back)"

The flip test includes a control that unchanged evidence stays `reviewed`, so its `changed` assertion is not trivially true. It covers both flip directions and asserts the row is in the `to-review` view. The claim of red on old code and green on new code holds.

## WR-01 Fix Verification

In `scripts/curate-server.test.mjs`, `beforeAll` (line 78) and `afterAll` (line 84) are now at file scope, before the first `describe` at line 89. The `afterAll` therefore runs after every write suite in the file and compares the SHA-256 of both tracked data files. I did not re-run the commit's temporary probe write. The structure is correct by inspection. `git status` is clean after the full run, so no test wrote to a tracked file.

## Behavioural Checks

| Check | Result |
|---|---|
| `npm test` | 122 files and 4277 tests passed. |
| `npm run compute-review-queue-recount` | exit 0, PASS, 565 rows. |
| Old derive against new tests (scratch copy) | 9 failed, including the 3 CR-01 tests. |
| `git diff --exit-code data/` | clean. |
| `git status --short` | clean. |

## Does the Fingerprint Change Invalidate the 37-07 Human Checkpoint?

**No.** The checkpoint ran on the pre-fix build and I judge its verdicts still valid. My reasoning:
- `reviewed.json` was empty at HEAD before and after the fix. The checkpoint's mark and un-review steps added and then removed an entry, so no stored entry carries an old-format fingerprint.
- The mark, hide, show and reverse flow, the empty-reason rejection, the D-11 409s and the guard red/green evidence do not depend on the token text. The server stores whatever valid fingerprint the client sends, and the validator's charset is unchanged.
- The resurface row (step 5) was exercised by editing the stored fingerprint to differ from the current one. It still holds, because derive compares strings.
- Two things do differ. The "Flags now:" line in the UI and the fingerprint in a new entry now show the longer format. The step-3 VALIDATION row quotes the old string as historical evidence. The queue membership and ordering that the browser DOM was diffed against the recount are unaffected.
- I did not re-run the browser. A single human glance at one reviewed-and-kept cycle on the new build would be a courtesy, not a requirement, because the changed surface is covered by server-socket and derive unit tests.

## Requirements Coverage

| ID | Status | Evidence |
|---|---|---|
| CUR-04 | SATISFIED | SC1 and SC2. Ticked at REQUIREMENTS.md:118, traceability row at line 179. |
| CUR-06 | SATISFIED | SC3. Ticked at REQUIREMENTS.md:119, traceability row at line 180. |

There are no orphaned IDs.

## Anti-Patterns

The files changed by the fix round are `derive-flagged.mjs`, `curate-server.mjs` and three test files. A fix-round diff review found no TBD/FIXME/XXX markers and no stubs. I did not scan the whole phase's files for markers.

## Remaining Open Review Findings (not SC-defeating, unchanged)

- WR-02 and WR-03: a failed best-efforts or index fetch fails open, so the queue is silently partial.
- WR-04: a `null` entry in reviewed.json makes writes answer 500.
- WR-05 and IN-01 to IN-05: copy and hardening notes.

These were triaged in the prior report as non-blocking. They are the developer's call.

## Human Verification

None required. The 37-VALIDATION.md sign-off boxes may still be unticked, and the developer should confirm that.

## Gaps Summary

No gaps. CR-01 is consistent across all producers and consumers, the D-10 resurface works with the new format, and the new tests fail on the pre-fix code. WR-01 is at file scope. SC1 to SC3 did not regress.

---

_Verified: 2026-11-25T19:20:00Z_
_Verifier: Claude (gsd-verifier)_
