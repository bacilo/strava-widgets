---
phase: 37-review-queue-priority-cur-04
verified: 2026-11-25T19:05:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 37: Review Queue Priority (CUR-04, CUR-06) Verification Report

**Phase Goal:** The curation review queue is reordered by pause-classification and unreliable-segment guard priority, and a queue row can be marked "reviewed and kept" (reversible, distinct from exclude, own committed file) through the existing overlay transport, with both publish guards re-verified.
**Status:** passed, with open review findings the developer should triage (none defeat a success criterion).
**Re-verification:** No.

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | A row can be marked reviewed and kept with a required reason, in its own file, leaves default view, reachable under "reviewed", reversible | VERIFIED | `data/curation/reviewed.json` exists, committed, separate from `best-effort-exclusions.json`, currently empty. Derive code has `reviewed`/`changed`/`none` states, and the view filters (`to-review` excludes `reviewed`, `reviewed` view). Server routes tested over real sockets (299 tests across 7 phase files re-run green). Developer-attested browser steps 2-7 PASS, with `git diff` evidence of the exact entry added and removed. Empty reason is rejected. D-11 409s were checked in both directions. |
| 2 | Both guards red under a planted leak, green on the served build | VERIFIED | `findCurationArtifacts` (curation-guard.mjs lines 124-130, 170-178) has path rules for `data/curation` and `reviewed.json`. It is wired into `build-widgets.mjs:220`. `verify-dashboard-publish.mjs:483-485` asserts three new 404s. Checkpoint evidence item 6 shows both guards exit 1 on a planted leak on the real dist and exit 0 after removal. I re-ran the guard unit and subprocess suites (green). |
| 3 | Queue lists guard-moved and transported-pause activities, transported-first then contaminated metres, count equals independent recount | VERIFIED | I ran `node scripts/compute-review-queue-recount.mjs`: PASS, 565 rows, tier 1 first, ordered by metres. The recount imports only fs/path/url, so it is independent of `derive-flagged.mjs`. Its unit tests fail on a tier swap, no-dedupe, reversed order and a dropped row. The browser DOM was diffed against the recount: 565 rows and 553 rows identical in count, set, position and metres. |

**Score:** 3/3

## Requirements Coverage

| ID | Status | Evidence |
|---|---|---|
| CUR-04 | SATISFIED | SC1 and SC2. REQUIREMENTS.md line 118 is ticked, with a traceability row. |
| CUR-06 | SATISFIED | SC3. REQUIREMENTS.md line 119 is ticked, with a traceability row. |

No orphaned requirement IDs: only these two are mapped to Phase 37.

## Independence and Reachability Check

- The recount shares no code with derive and fails closed on altered shipped fields. Expected values in the checkpoint came from the recount, not from CONTEXT's probe figures.
- Guards were exercised in both directions: red on a planted dist leak and green after removal. The plan's guard-2 expectation needed a planted directory, which the checkpoint recorded as a plan defect rather than a code defect.
- The resurface row (step 5) is reachable and was seen to pass by editing the stored fingerprint.

## Review Findings Judged Against the Success Criteria

None defeats an SC. I recommend the developer triage these:

- **CR-01 (Critical, 37-REVIEW.md):** `fingerprintFor` does not distinguish a demoted effort from a contaminated effort that ranks. A flip between them never resurfaces a reviewed row. I confirmed the code matches locked D-12. SC1 requires only mark, hide, show and reverse. It does not require this resurface case, so the criterion holds. It is a real correctness gap in the meaning of "reviewed". `reviewed.json` is empty today, so the fix is free now and costs more after the first real review. I recommend fixing it before the first real review.
- **WR-01:** The T-37-12 tracked-file SHA guard in `scripts/curate-server.test.mjs:72-88` has its `afterAll` scoped to its own describe block. I confirmed that in the code. It runs before the write suites, so it is vacuous. It is a test-quality gap in a no-write-to-tracked-files protection. SC1 behaviour is independently evidenced by the live `git diff` checks, and the working tree is clean at HEAD.
- **WR-02/WR-03:** A failed best-efforts or index fetch fails open. The queue is silently partial, and valid reviews show as "no longer flagged" with an Un-review control. This is a degraded-state UX risk. The healthy path is verified.
- **WR-04:** A `null` entry in reviewed.json makes every write answer 500. It is a robustness issue on hand-edited files.
- **WR-05, IN-01 to IN-05:** Copy accuracy, brittleness and hardening notes.

## Anti-Patterns

I did not run a full TBD/FIXME marker scan. The one lead I checked, WR-01, is a test-design defect, not a debt marker. Working tree is clean.

## Human Verification

None outstanding. The 37-07 checkpoint rows were developer-verdicted PASS (sequencing deviation recorded, verdicts unaffected). 37-VALIDATION.md sign-off boxes are still unticked, so the developer should tick them.

## Gaps Summary

No blocking gaps. The phase goal is achieved in the codebase. Recommended follow-up is a small fix round for CR-01 and WR-01 through WR-04. Per the project memory on verification after requirement tick, if that round runs, reopen all four artifacts and re-verify.

---

_Verified: 2026-11-25T19:05:00Z_
_Verifier: Claude (gsd-verifier)_
