---
phase: 29-curation-review-queue
verified: 2026-09-18T13:15:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 29: Curation Review Queue Verification Report

**Phase Goal:** Local curation mode surfaces ceiling-flagged efforts in a reviewable queue and lets
the developer exclude them via the existing whole-activity write path — no new write surface, both
publish guards still prove it absent from the published bundle.

**Verified:** 2026-09-18T13:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | The queue surfaces flagged activities without hunting, and the listed set matches Phase 28's independently-derived flagged set exactly | ✓ VERIFIED | `node scripts/compute-pr-ceiling-recount.mjs` independently re-run this session: `Flagged ACTIVITIES: 47`, `of which already excluded: 12 of 12 total exclusions` — matches 29-08-SUMMARY.md's N=47/M=12/T=12 exactly, re-derived (not reused). `scripts/curate-queue/derive-flagged.mjs`'s `deriveFlaggedActivities` reads real `bestEffortsDoc.activities` (no hardcoded/static data), and its own test file's live cross-check against `recountDemotedActivities` passes (25/25 tests). The `data/best-effort-exclusions.json` file was independently inspected this session: 12 entries, 0 duplicates, 0 non-string reasons, 0 `__proto__` keys — the two "independent" counters agree on the real archive (WR-02's divergence is latent, not active). The "Review queue" nav-link injector (`scripts/curate-overlay/index.ts:71-90`) targets `#app-nav-root .app-nav__links`, giving one-click reachability (D-07). Checkpoint rows R1-R6 (29-08-SUMMARY.md, developer PASS, 2026-09-18) additionally confirm the rendered row count, excluded-row count, ordering and row content in a real browser. |
| 2 | Exclusion reuses the existing write path (trusted-origin check, atomic write, activity-id validation); untrusted origin rejected | ✓ VERIFIED | `scripts/curate-queue/index.ts:30` imports `removeExclusion, runRecompute, saveExclusion` from `../curate-overlay/index.js` and calls them directly (lines 220, 228) — no second fetch call site to `/__curate/exclusions/*` exists in the queue client (confirmed via grep: only the import, no local `fetch(...exclusions...)`). `scripts/curate-server.mjs` gates the write route (line 656-657) and both new GET routes (lines 733-735, 756-758) behind the same `isTrustedOrigin` check used by the pre-existing overlay routes. Checkpoint rows R7 (write lands as exactly one entry, `"distances": null`, reversible) and R8 (cross-origin PUT/GET → 403, same-origin control → 200) both recorded PASS against the live server with `git diff` evidence. |
| 3 | Both publish guards discriminate in both directions on the new routes (red under a planted leak, green on a correct build) | ✓ VERIFIED | Build-time half: `scripts/lib/curation-guard.test.mjs`'s `D-19` block (4 fixture cases: planted queue page caught once, planted queue bundle caught once, nested `.curate-dist`-style bundle caught with distinct paths, clean tree returns `[]`) — 30/30 tests pass. HTTP-layer half: `scripts/verify-dashboard-publish.mjs:412-413` carries literal `expect404` assertions for `/__curate/queue` and `/__curate/queue.js`; `scripts/verify-dashboard-publish-guard.test.mjs`'s Case E/Case F plant each route's content into `dist/widgets` and assert the real shipped verifier exits non-zero naming that path (7/7 tests pass). Independently re-ran both guards against the current build this session: `findCurationArtifacts('dist/widgets')` → `[]`; `node scripts/verify-dashboard-publish.mjs` printed `✓ GET /__curate/queue -> 404` and `✓ GET /__curate/queue.js -> 404`, exit 0. Checkpoint row R10 confirmed served-bytes digests matched build-time digests (no stale-artifact substitution). |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/lib/curation-guard.mjs` | `findCurationArtifacts` with one-path-one-violation invariant (IN-17 fix) | ✓ VERIFIED | Exists, substantive (walk+scan logic with symlink/non-regular-file/unreadable-dir handling), wired (imported by `curation-guard.test.mjs` and `build-widgets.mjs`'s `assertNoCurationArtifacts`). Independently re-run: `[]` on current `dist/widgets`. |
| `scripts/lib/curation-guard.test.mjs` | IN-17 pin + D-19 planted queue fixtures | ✓ VERIFIED | Contains "queue" fixture cases (lines 355-410), 30/30 tests pass. |
| `scripts/verify-dashboard-publish.mjs` | Two new literal `expect404` assertions for `/__curate/queue`, `/__curate/queue.js` | ✓ VERIFIED | Lines 412-413, confirmed present and passing independently this session. |
| `scripts/verify-dashboard-publish-guard.test.mjs` | Case E and Case F planted-fixture proofs | ✓ VERIFIED | Lines 120-151, 7/7 tests pass. |
| `scripts/compute-pr-ceiling-recount.mjs` | `recountDemotedActivities` export, `Flagged ACTIVITIES` CLI line, `--expect-flagged-activities` flag | ✓ VERIFIED | Independently re-run this session, printed `Flagged ACTIVITIES (own arithmetic, >=1 non-null demotion, all guards): 47`. |
| `scripts/curate-queue/derive-flagged.mjs` | `deriveFlaggedActivities`, `buildPrefillReason`, `summarizeQueue` — pure, zero imports | ✓ VERIFIED | Confirmed: iterates real `bestEffortsDoc.activities`, all-guards demotion check (not ceiling-only), `__proto__` key skipped. 25/25 tests pass including live cross-check. |
| `scripts/curate-queue/format.mjs` | Local formatters | ✓ VERIFIED (with noted latent Warning WR-06) | Exists, exported, tested; `formatPace(undefined)` produces `NaN:NaN/km` per code review — latent on the current well-formed archive, not reachable today. |
| `scripts/curate-queue/index.ts` | Queue page controller, ≥150 lines | ✓ VERIFIED | 300+ lines; imports overlay transport (line 30), calls `saveExclusion`/`removeExclusion`/`runRecompute` directly, no parallel fetch. |
| `scripts/curate-server.mjs` | `QUEUE_ENTRY`/`QUEUE_OUTFILE`, `buildQueueBundle`, `extractStylesheetHref`, `renderQueuePage`, two gated GET routes, startup log line | ✓ VERIFIED | All present; both new routes origin-gated (lines 733-735, 756-758); startup log prints queue URL (line 905). |
| `scripts/curate-overlay/index.ts` | Nav-link injector | ✓ VERIFIED | `DOMContentLoaded` listener targets `#app-nav-root .app-nav__links`, injects "Review queue" text (lines 71-90). |
| `.planning/phases/29-curation-review-queue/29-08-SUMMARY.md` | Checkpoint verdict, measured numbers, PD-01 ruling | ✓ VERIFIED | All 11 rows carry explicit PASS verdicts; PD-01 ruled "approve"; numbers independently re-derived and matched this session. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `scripts/curate-queue/index.ts` | `scripts/curate-overlay/index.ts` | import of `saveExclusion`/`removeExclusion`/`runRecompute` | ✓ WIRED | Confirmed via grep — single import site, both functions called at write sites (lines 220, 228). |
| `scripts/curate-queue/index.ts` | `scripts/curate-queue/derive-flagged.mjs` | import of `deriveFlaggedActivities`/`summarizeQueue`/`buildPrefillReason` | ✓ WIRED | Line 23. |
| `serveCurateRoute` in `curate-server.mjs` | `renderQueuePage`/`extractStylesheetHref` | GET `/__curate/queue` branch | ✓ WIRED | Line 733 onward, origin-gated. |
| `main()` in `curate-server.mjs` | `buildQueueBundle` | startup esbuild step | ✓ WIRED | Confirmed via 29-08-SUMMARY's startup log (`.curate-dist/queue.js  20.9kb`) and this session's independent digest/route checks. |
| `scripts/verify-dashboard-publish-guard.test.mjs` | `scripts/verify-dashboard-publish.mjs` | `execFileSync` subprocess of the real shipped script | ✓ WIRED | Case E/F run the actual script against a planted fixture, asserting non-zero exit naming the leaked path. |
| `scripts/lib/curation-guard.test.mjs` | `scripts/lib/curation-guard.mjs` | named import of `findCurationArtifacts` | ✓ WIRED | 30/30 tests pass. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `scripts/curate-queue/index.ts` rendered rows | `rows` from `deriveFlaggedActivities(...)` | `fetch('/strava-widgets/data/stats/best-efforts.json')` (real mirrored archive document) | Yes — independently confirmed `47` flagged activities on the real archive | ✓ FLOWING |
| Queue header counts | `summarizeQueue(rows)` | same `rows` above | Yes — `47` / `12` confirmed to match `recountDemotedActivities`'s independent arithmetic this session | ✓ FLOWING |
| Guard scan results | `findCurationArtifacts('dist/widgets')` | real filesystem walk of the actual built `dist/widgets` tree | Yes — independently re-run, returns `[]` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Independent flagged-activity recount matches SUMMARY's recorded N/M/T | `node scripts/compute-pr-ceiling-recount.mjs` | `Flagged ACTIVITIES: 47`, `already excluded: 12 of 12` | ✓ PASS |
| Real exclusions file is well-formed (WR-02 non-active check) | inline `node -e` inspection of `data/best-effort-exclusions.json` | 12 entries, 0 duplicates, 0 non-string reasons, 0 `__proto__` keys | ✓ PASS |
| Build-time guard clean on current build | `findCurationArtifacts('dist/widgets')` | `[]` | ✓ PASS |
| HTTP-layer guard asserts new routes 404 on current build | `node scripts/verify-dashboard-publish.mjs` | `✓ GET /__curate/queue -> 404`, `✓ GET /__curate/queue.js -> 404`, exit 0 | ✓ PASS |
| Queue client reuses existing write transport, no parallel fetch | grep for imports/fetch call sites in `curate-queue/index.ts` | only imports `saveExclusion`/`removeExclusion`/`runRecompute`; no local `/__curate/exclusions` fetch | ✓ PASS |
| Full phase-relevant test suite green | `npx vitest run` on the 4 guard/queue test files + `derive-flagged.test.mjs` | 88/88 tests pass across the 5 files | ✓ PASS |
| Full repo suite green (regression check) | `npm test` | 82/82 files, 2422/2422 tests | ✓ PASS |

Server was not started and the exclude/Recompute actions were not exercised this session per the
task's explicit constraint (`data/best-effort-exclusions.json` must stay untouched). This is covered
instead by 29-08-SUMMARY.md's recorded R7/R8 verdicts (developer-executed, with `git diff` evidence),
which this session found no reason to distrust — all independently-checkable claims in that SUMMARY
(N/M/T/E numbers, guard results, digests-adjacent route checks) reproduced exactly.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CUR-01 | 29-03, 29-04, 29-05, 29-06, 29-07, 29-08 | Local curation mode presents a reviewable queue with one exclude action | ✓ SATISFIED | Queue derivation, rendering, nav link and checkpoint rows R1-R6 all confirmed. |
| CUR-02 | 29-05, 29-06, 29-07, 29-08 | Queue reuses existing write machinery, no parallel write surface | ✓ SATISFIED | Import-only write path confirmed in code; R7/R8 confirmed live. |
| CUR-03 | 29-01, 29-02, 29-08 | Both publish guards cover the new routes, demonstrated failing and passing | ✓ SATISFIED | Both guards' red/green fixture tests pass; both re-run green against the current build this session. |

No orphaned requirements found — `.planning/REQUIREMENTS.md`'s CUR section maps exactly CUR-01,
CUR-02, CUR-03 to Phase 29, and all three appear in at least one plan's `requirements:` frontmatter.
CUR-04 and CUR-05 are listed under "Future Requirements" (deferred, out of scope for this phase) and
are not orphaned — CUR-01's ticked entry explicitly documents the CUR-04 deferral as a known,
deliberate limitation.

### Anti-Patterns Found

None at Blocker or Warning severity from this session's independent scan. Scanned all 17 files listed
in `29-REVIEW.md` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers and empty-implementation
patterns: zero debt markers found (one incidental `textarea.placeholder = '...'` HTML attribute in
`curate-queue/index.ts:147`, which is a UI hint string, not a stub marker).

`29-REVIEW.md` (code review, run 2026-09-18) separately found 0 Critical, 6 Warning, 5 Info findings.
None of the 6 Warnings contradicts a phase success criterion on the current codebase:

- **WR-01** (HTML attribute injection in `renderQueuePage` from a malformed `dist/widgets/index.html`) — requires a corrupted local build artifact to trigger; not reachable by an external actor; does not affect Criterion 1-3.
- **WR-02** (the two "independent" flagged-count implementations disagree on malformed exclusion entries — duplicates, `reason: null`, `__proto__` keys) — independently checked this session: the real `data/best-effort-exclusions.json` has 12 well-formed entries with none of those defects, so Criterion 1's "matches exactly" holds on the actual archive today. This is a real latent robustness gap (a future hand-edit could silently desynchronize the checkpoint's cross-check) but not an active failure of the phase goal.
- **WR-03, WR-04, WR-05, WR-06** — pre-existing-pattern reuse, dead field, or latent formatting gaps on malformed input; none reachable on the current well-formed archive, none blocking a success criterion.

These Warnings are legitimate follow-up work but do not rise to BLOCKER — they are advisory
robustness/code-quality findings, not evidence the phase goal is unachieved.

### Human Verification Required

None outstanding. Plan 29-08's blocking checkpoint (`checkpoint:human-verify`, gate: blocking)
already exercised all irreducibly-manual halves of Criteria 1 and 2 (rendered extent in a real
browser, write-path gesture, cross-origin rejection) on 2026-09-18, with the developer's explicit
PASS verdicts on R1-R10 and an "approve" ruling on PD-01, recorded in `29-08-SUMMARY.md`. This
session's independent, code-level re-verification reproduced every checkable claim in that record
(N=47/M=12/T=12 recount, both guards green, write-path import structure, origin gating) and found no
contradiction, so no second human pass is required.

### Gaps Summary

None. All three ROADMAP success criteria are independently verified against the current codebase and
the current real archive, not merely against SUMMARY.md's narrative. The queue derives its listed set
from live data (not hardcoded), reuses the existing write transport exclusively, and both publish
guards are demonstrated red-under-leak (via committed fixture tests) and green-on-correct-build
(re-run independently this session). The one substantive latent Warning (WR-02) does not manifest on
the real, well-formed exclusions file. Phase goal achieved; ready to proceed.

---

*Verified: 2026-09-18T13:15:00Z*
*Verifier: Claude (gsd-verifier)*
