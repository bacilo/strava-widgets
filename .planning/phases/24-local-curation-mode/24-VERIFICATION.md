---
phase: 24-local-curation-mode
verified: 2026-09-01T20:44:55Z
updated: 2026-09-02T11:05:47Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Toggling an exclusion requires entering a reason, which is then surfaced consistently in the activity detail view (ROADMAP criterion 2)"
    status: partial
    reason: >
      The write half and the panel-row render half are genuinely fixed and independently
      confirmed (24-VALIDATION.md R15/R19, and buildBestEffortsPanelRows at
      detail-best-efforts-logic.ts:94-128 correctly derives `excluded` from the live
      exclusions document). But `buildPrBadgeLabels` (detail-best-efforts-logic.ts:32-46),
      called from the same render (`detail.ts:546` vs `550`, same `Promise.all`), was never
      updated to read the live document — it still gates only on the precomputed
      `effort.excludedFromRecords`. R15's own quoted evidence contains the resulting
      contradiction unflagged: "the 400m flags cell read `PRExcluded — ROUND2-2026-09-01 GPS
      device unreliable`" — the same cell simultaneously claiming the run holds the 5K/400m
      PR and that it is excluded from PRs. This was recorded PASS. Code review CR review's
      WR-05 finding is verbatim-confirmed against source.
    artifacts:
      - path: "src/dashboard/views/detail-best-efforts-logic.ts"
        issue: "buildPrBadgeLabels (line 32-46) takes only `entry`, gates solely on effort.excludedFromRecords, never receives liveExclusions — unlike buildBestEffortsPanelRows two functions below it, which was fixed by plan 24-09."
      - path: "src/dashboard/views/detail.ts"
        issue: "Lines 546 and 550 call buildPrBadgeLabels(bestEffortsEntry) and buildBestEffortsPanelRows(bestEffortsEntry, ageGrading, liveExclusions) from the same Promise.all-resolved data, in the same paint, with no reconciliation between the two derivations."
    missing:
      - "Either pass liveExclusions into buildPrBadgeLabels and suppress badges the live document excludes (code review's fix option a), or explicitly document and checkpoint-test the header-badge staleness window as an accepted, disclosed behavior (option b) — the current state is neither: it is an unflagged, silently-passed contradiction."
  - truth: "verify-dashboard-publish.mjs (plus the build-time layer) provably proves the curation write path absent from the published bundle, and that assertion demonstrably fails against a build that regresses this (ROADMAP criterion 3 / CUR-01's own wording)"
    status: failed
    reason: >
      Independently confirmed: `dist/widgets` today publishes 22 `.d.ts` files
      (`find dist/widgets -name "*.ts" | wc -l` → 22), and
      `scripts/lib/curation-guard.mjs:37` defines `SCANNED_EXTENSIONS = ['.js', '.html',
      '.css', '.map']` — `.ts` is absent. Line 90's `if (ext === null ||
      !SCANNED_EXTENSIONS.includes(ext)) continue;` skips the content-marker scan for every
      `.ts`/`.d.ts`/`.mjs`/extensionless file. A leaked `scripts/curate-overlay/index.ts` (which
      contains the literal `const CURATE_PREFIX = '/__curate'`) or its `.d.ts` sibling would
      return `violations === []` and print the green `✓ Curation-artifact scan` line
      (build-widgets.mjs:222). The second (HTTP) layer only probes three hard-coded literal
      URLs (`verify-dashboard-publish.mjs:307-309`) and would not catch a leak at any other
      path. D-11's own planted-fixture proof (checkpoint ROW R13, 24-VALIDATION.md) only ever
      planted a `.js` file (`dist/widgets/__curate/overlay.js`) — the exact extension class
      that is scanned — so the guard has never been observed failing against the extension
      class the publish tree demonstrably contains. `24-CONTEXT.md` D-10 requires
      `process.exit(1)` "never a warning" because dist/widgets is what actually deploys from a
      public repo; a guard with this shape does not discharge that, and REQUIREMENTS.md's
      CUR-01 text uses the word "provably" — which this guard does not currently satisfy for
      the file classes the tree actually contains.
    artifacts:
      - path: "scripts/lib/curation-guard.mjs"
        issue: "SCANNED_EXTENSIONS (line 37) is an allowlist that omits .ts/.d.ts/.mjs/extensionless files; the docblock (lines 20-29) justifies the restriction only in terms of .json, but the list excludes far more than .json."
      - path: "scripts/verify-dashboard-publish.mjs"
        issue: "Lines 305-309: the HTTP absence guard probes exactly three hard-coded literal paths, providing no coverage for a leak at any other path/filename."
      - path: "scripts/lib/curation-guard.test.mjs"
        issue: "The D-11 planted-fixture suite (lines 60-90) only plants .js/.html/directory-name shapes — no .ts, .d.ts, .mjs, or extensionless fixture exists, so the demonstrated blind spot has never been exercised red."
    missing:
      - "Invert SCANNED_EXTENSIONS to a narrow, justified skip-list (fail closed for unknown extensions) or otherwise extend coverage to .ts/.d.ts/.mjs/extensionless files, per code review CR-02's proposed fix."
      - "Planted-fixture test cases for a .d.ts file, an .mjs file, and an extensionless file containing the __curate marker, observed failing before any fix and passing after, per D-11's own evidentiary standard."
  - truth: "D-12's Origin/Host gate protects the curate server (and by extension criterion 1's 'localhost-only' UI) from any other browser tab, including hostile pages"
    status: failed
    reason: >
      Independently confirmed: `node -e "decodeURIComponent('/%')"` throws `URIError: URI
      malformed`. `safeResolve` (curate-server.mjs:128) calls
      `decodeURIComponent(urlPath.split('?')[0])` with no try/catch. `serveStaticRoute`
      (line 611) calls `safeResolve` with no try/catch either. `createServer` (line 636-647)
      invokes `serveStaticRoute(req, res)` synchronously at line 646 with NO `.catch()` —
      confirmed by direct source read — while the curate-route branch two lines above (638) IS
      wrapped in `.catch()`. The static route additionally carries no Origin/Host check at all
      (only handleExclusionWrite and handleRecompute call isTrustedOrigin), so any other tab in
      the developer's browser (or a hostile public page, via `fetch('http://127.0.0.1:4173/%',
      {mode:'no-cors'})`) can crash the curate server process with a single malformed request.
      This is a direct bypass of the protection D-12 exists to provide, on the one route D-12
      does not cover.
    artifacts:
      - path: "scripts/curate-server.mjs"
        issue: "Line 128 (unguarded decodeURIComponent), line 611 (no try/catch around safeResolve call), line 646 (serveStaticRoute invoked with no .catch, asymmetric with line 638's curate-route branch)."
    missing:
      - "Wrap the decodeURIComponent call in safeResolve with try/catch, returning null (reject) on URIError, per code review CR-01's proposed fix."
      - "Wrap the createServer request listener body in try/catch as defence-in-depth so no future synchronous throw can kill the process."
      - "A safeResolve('/strava-widgets/%') -> null test case in scripts/curate-server.test.mjs; today's suite has no malformed-encoding case."
deferred: []
re_verification:
  round: 4
  previous_status: gaps_found
  previous_score: 2/5 must-haves verified
  gaps_closed:
    - "Criterion 2 (ROADMAP) — buildPrBadgeLabels vs buildBestEffortsPanelRows header/panel disagreement (WR-05, GAP-24-04/24-05) — closed by plan 24-13, independently re-derived against src/dashboard/views/detail-best-efforts-logic.ts and detail.ts, and confirmed by a dedicated 'R19 mirror-image' unit test (detail-best-efforts-logic.test.ts:286-293) that the browser checkpoint could not itself construct (GAP-24-05, a checkpoint-row design defect per R27, not an implementation defect)"
    - "Criterion 3 (ROADMAP) — curation-guard.mjs SCANNED_EXTENSIONS allowlist blind spot on .ts/.d.ts/.mjs/extensionless files (CR-02, GAP-24-02) — closed by plan 24-11's UNSCANNED_EXTENSIONS fail-closed skip-list, independently re-derived by planting a live .d.ts fixture into the real dist/widgets and observing findCurationArtifacts flag it, then confirming the tree returns clean once removed"
    - "D-12 Origin/Host gate absent from curate-server.mjs's static route (CR-01, GAP-24-03) — closed by plan 24-12's try/catch on decodeURIComponent plus the createServer listener-body try/catch and serveStaticRoute Origin/Host gate, independently re-derived against source"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "GAP-24-05 — a browser-checkpoint row that directly observes the live-exclusion suppression winning over a still-stale-true precomputed excludedFromRecords flag AND a still-true wasPRAtTheTime, without an intervening Recompute forcing wasPRAtTheTime false first"
    addressed_in: "A future differently-constructed checkpoint row (not a later roadmap phase) — recorded here as informational per the state-of-play instruction not to re-litigate it; the underlying implementation is independently confirmed correct by source read and by a dedicated unit test (detail-best-efforts-logic.test.ts:286-293) covering exactly this scenario"
    evidence: "24-VALIDATION.md Round 3 R27 isolates the R26 checkpoint-row FAIL to the row's own unsatisfiable discriminator, not to the 24-13 code; R19 (Round 2, human-hand) already proved the mirror direction once under valid sequencing (no intervening Recompute)"
---

# Phase 24: Local Curation Mode Verification Report

**Phase Goal:** Developer can toggle an activity's exclusion from PR calculations through a localhost-only UI instead of hand-editing `data/best-effort-exclusions.json`, with a required reason surfaced in the detail view — and the write path is provably absent from the published bundle. (amended 2026-08-27 per D-04)

**Verified:** 2026-09-01T20:44:55Z
**Status:** gaps_found
**Re-verification:** No — initial verification (no prior `24-VERIFICATION.md` existed)

## Sequencing note (read before the table below)

This phase ran a two-round browser checkpoint cycle (24-08 Round 1 → 24-09 fix → 24-10 Round 2,
"clean sweep, 9/9 PASS," CUR-01 ticked Complete) and then a code review (`24-REVIEW.md`,
`status: issues_found`, 2 Critical / 13 Warning / 12 Info) that ran **after** the tick. Every
Critical and the one Warning most relevant to the roadmap's own wording (WR-05) were
independently re-derived against the current source tree in this verification pass — not
accepted from the review's narration alone. All three reproduced cleanly:

- `dist/widgets` genuinely publishes 22 `.d.ts` files today (`find dist/widgets -name "*.ts" | wc -l` → `22`), confirmed live in this session.
- `scripts/lib/curation-guard.mjs:37`'s `SCANNED_EXTENSIONS` genuinely excludes `.ts` (read directly).
- `decodeURIComponent('/%')` genuinely throws `URIError`, confirmed via `node -e`, and `createServer` genuinely calls `serveStaticRoute` with no `.catch()` at line 646 while the curate branch at 638 is wrapped (read directly).
- `buildPrBadgeLabels` genuinely reads only `effort.excludedFromRecords` and never `liveExclusions` (read directly, lines 32-46), while `buildBestEffortsPanelRows` two functions below it (lines 94-128) was fixed. R15's own quoted checkpoint evidence contains the resulting contradictory render (`PRExcluded — {reason}` in one flags cell), recorded PASS without comment.

Given that, CUR-01's `[x]`/Complete disposition is **not defensible as currently stated**. The
requirement's own text says the write path "must be provably absent from the published bundle" —
CR-02 shows that is not actually true for the file extensions the publish tree demonstrably
contains. This report reopens the phase gate rather than rubber-stamping the tick.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Criterion 1 — `npm run curate` starts a localhost-only server exposing an inline whole-activity PR-exclusion toggle on the detail view's Best Efforts panel | ✓ VERIFIED | R2 (banner, fixed-port fail-fast), R3 (`<script src="/__curate/overlay.js">`, `section[data-activity-id]` count 1, controls render inline) — both rounds, real-browser evidence in `24-VALIDATION.md`. Code confirms the same shape (`curate-server.mjs`, `detail-sections.ts`). See truth 5 for a caveat on this server's robustness against hostile input, which does not negate the criterion's literal text but is a serious adjacent finding. |
| 2 | Criterion 2 — toggling requires a reason, which is then surfaced (consistently) in the detail view | ✗ FAILED | Write half and panel-row render half are genuinely fixed (R15/R19 PASS, `buildBestEffortsPanelRows` correctly reads live exclusions). But the header PR badge (`buildPrBadgeLabels`) was never wired to the same live document — same paint, same function, two contradicting badges. See gap 1 (WR-05). |
| 3 | Criterion 3 — `verify-dashboard-publish.mjs` gains an assertion (following `assertNoPrivateArtifacts`) that the write path is provably absent from the published bundle, demonstrably failing against a regressing build | ✗ FAILED | `SCANNED_EXTENSIONS` allowlist omits `.ts`/`.d.ts`/`.mjs`/extensionless files; `dist/widgets` already ships 22 `.d.ts` files today; the HTTP layer only probes 3 hard-coded literal paths; D-11's planted-fixture proof only ever exercised a `.js` file. See gap 2 (CR-02). |
| 4 | Criterion 4 — human checkpoint: end-to-end curate flow works locally, and the production build served under `/strava-widgets` shows no reachable curation endpoint | ✓ VERIFIED | R12 (no controls, no `__curate` string, 404 on all three probed paths, in-console PUT 404s), R14/R21-R23 (403 on mismatched Origin/Host) — real-browser evidence across both rounds. This is a genuine, correctly-observed absence for the build as it exists today; it does not itself resolve truth 3's "provably against future regressions" gap. |
| 5 | D-12's Origin/Host gate protects the curate server from any other browser tab (the design intent the roadmap's "localhost-only" phrasing and D-12 both point at) | ✗ FAILED | `safeResolve`'s unguarded `decodeURIComponent` + `serveStaticRoute`'s missing try/catch + `createServer`'s missing `.catch()` on the static branch (asymmetric with the curate branch) crash the whole process on any malformed URL from any tab, bypassing the Origin/Host gate entirely because the static route carries none. Independently reproduced (`node -e "decodeURIComponent('/%')"` → `URIError`). See gap 3 (CR-01). |

**Score:** 2/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/lib/curation-guard.mjs` | Pure scanner proving curation artifacts absent from `dist/widgets`, extension-complete | ⚠️ STUB-SHAPED GAP | Exists, substantive, wired into `build-widgets.mjs`, unit-tested (11/11 pass) — but the extension allowlist has a demonstrated content-scan blind spot (CR-02). Not a stub in the classic sense; a design-shaped hole in a load-bearing guard. |
| `scripts/verify-dashboard-publish.mjs` (D-10(b) HTTP layer) | 404 assertions proving the write path unreachable | ⚠️ PARTIAL | Three literal-path `expect404` assertions exist and pass; provides no general-path coverage, so it does not independently backstop CR-02's gap. |
| `scripts/curate-server.mjs` | Localhost-only write server, Origin/Host gated | ⚠️ ORPHANED GUARD ON ONE ROUTE | Write routes (`handleExclusionWrite`, `handleRecompute`) are Origin/Host gated and verified correct under adversarial reading (path traversal, activity-id validation). The static-file route (`serveStaticRoute`) has no such gate and crashes the process on malformed input (CR-01). |
| `src/dashboard/views/detail-best-efforts-logic.ts` | Panel row + badge derivation, both live-exclusion-aware | ⚠️ PARTIAL | `buildBestEffortsPanelRows` (lines 94-128) is correctly live-aware (GAP-24-01 genuinely closed). `buildPrBadgeLabels` (lines 32-46) is not (WR-05, new gap). |
| `src/dashboard/views/detail.ts` | Wires both functions from one fetch, one paint | ✓ VERIFIED (wiring exists) | Lines 546/550 call both functions from the same `Promise.all` result — wiring is real, but the two functions disagree in a case that Round 2 itself rendered. |
| `.planning/REQUIREMENTS.md` CUR-01 | Ticked only on defensible rendered evidence | ✗ NOT DEFENSIBLE AS WRITTEN | Ticked 2026-09-01 on Round 2's 9/9 PASS. The tick does not account for CR-01/CR-02 (which ran after) or for WR-05 (rendered but unflagged within Round 2's own R15 evidence). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `data/best-effort-exclusions.json` (curate Save) | rendered `Excluded — {reason}` panel row | `buildBestEffortsPanelRows` live read | ✓ WIRED | Confirmed by source read and by R15's rendered badge. |
| `data/best-effort-exclusions.json` (curate Save) | rendered PR badge in the same header | `buildPrBadgeLabels` | ✗ NOT WIRED | Function never receives `liveExclusions`; reads only the stale precomputed flag. |
| `dist/widgets` tree (build output) | `assertNoCurationArtifacts` / `findCurationArtifacts` | content-marker scan restricted to `SCANNED_EXTENSIONS` | ⚠️ PARTIAL | Wired for `.js`/`.html`/`.css`/`.map`; NOT wired for `.ts`/`.d.ts`/`.mjs`/extensionless, which the tree demonstrably contains. |
| published bundle | `verify-dashboard-publish.mjs` D-10(b) | three hard-coded `expect404` literal paths | ⚠️ PARTIAL | Wired only for the three named paths, not for an arbitrary leak location. |
| any browser tab | `curate-server.mjs` static route | `safeResolve` → `decodeURIComponent` | ✗ NOT GATED | No Origin/Host check, no try/catch — a malformed URL from any tab is a full-process crash. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/curate-server.mjs` | 128, 611, 646 | Unguarded `decodeURIComponent` reachable from any browser tab, no try/catch, no `.catch()` on the caller (asymmetric with the wrapped curate branch) | 🛑 Blocker-adjacent (Critical per code review, independently reproduced) | Any tab can crash the developer's curate server mid-session with a malformed URL. Local-tool-only; does not affect the published bundle. |
| `scripts/lib/curation-guard.mjs` | 37, 90 | `SCANNED_EXTENSIONS` allowlist omits `.ts`/`.d.ts`/`.mjs`/extensionless; `dist/widgets` already publishes 22 `.d.ts` files today | 🛑 Blocker (directly falsifies criterion 3 / CUR-01's "provably absent" wording, independently confirmed) | A leaked curate-overlay `.ts`/`.d.ts` file would pass both enforcement layers silently. |
| `src/dashboard/views/detail-best-efforts-logic.ts` | 32-46 vs 94-128 | `buildPrBadgeLabels` not updated in lockstep with `buildBestEffortsPanelRows`'s GAP-24-01 fix | ⚠️ Warning (decision-level correctness gap, independently confirmed and confirmed rendered in R15's own evidence) | Header PR badge and panel Excluded badge can visibly disagree in the same paint, right after the phase's own primary flow (Save). |
| No TBD/FIXME/XXX debt markers found in the reviewed file set (`grep` clean). | — | — | ℹ️ Info | — |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| CUR-01 | 24-01..24-10 (all) | Local curation mode: toggle whole-activity PR exclusion via `npm run curate`, reason required and surfaced, write path provably absent from published bundle | ✗ NOT DEFENSIBLE AS TICKED | See truths 2, 3, 5 above and gaps 1-3. No orphaned requirements — CUR-01 is the only ID declared across all ten plans and REQUIREMENTS.md's traceability table, matching ROADMAP's `Requirements: CUR-01`. |

### Human Verification Required

None beyond what has already been checkpoint-tested in `24-VALIDATION.md` Rounds 1 and 2 (server start, inline toggle, write/render, production absence, Origin/Host 403s). The remaining gaps (CR-01, CR-02, WR-05) are code-level defects confirmed by direct source reading and reproducible commands, not matters requiring a human's eyes — they do not need a third browser round to establish; they need code changes and, for CR-02/WR-05, new planted-fixture test cases before the next checkpoint can be trusted.

### Gaps Summary

Two of the four ROADMAP success criteria are not defensibly discharged as currently shipped,
despite a "clean sweep" Round 2 checkpoint and a ticked CUR-01:

1. **Criterion 3 (the requirement's own load-bearing word, "provably absent") is false today.**
   The two-layer guard has a real, demonstrated content-scan blind spot: `dist/widgets`
   currently ships 22 `.d.ts` files, none of which the build-time guard's `SCANNED_EXTENSIONS`
   allowlist can see, and the HTTP layer only checks three hard-coded literal paths. The D-11
   planted-fixture proof that was supposed to make this guard trustworthy only ever exercised a
   `.js` file — the one extension class that IS covered — so the actual demonstrated leak shape
   (a `.ts`/`.d.ts` copy of the overlay source, which itself contains the literal
   `/__curate` marker) has never been observed failing. This is a genuine design gap, not a
   typo, and the phase's own docblock at `curation-guard.mjs:20-29` shows the allowlist
   restriction was made deliberately narrow for a different reason (protecting the public
   `best-effort-exclusions.json`) without the author noticing the collateral hole it opened.

2. **Criterion 2's render half is genuinely fixed for the panel row but not for the header PR
   badge that renders from the same fetch, in the same paint.** `buildPrBadgeLabels` was left
   reading the precomputed flag while `buildBestEffortsPanelRows` (two functions below it, in
   the same file, touched by the same 24-09 plan) was correctly updated to read the live
   document. Round 2's own R15 evidence — quoted verbatim in `24-VALIDATION.md` — contains the
   resulting contradiction (`PRExcluded — {reason}` in one flags cell) and it was recorded PASS
   without comment. This is exactly the phase's own primary flow (Save an exclusion, look at the
   result), so it is not an edge case.

3. **A related but roadmap-criterion-adjacent Critical (CR-01):** the curate server's static
   route has no Origin/Host gate and crashes the whole process on a single malformed URL
   (`/%`), reachable from any other browser tab — including a hostile public page — while D-12
   was specifically designed to close exactly that class of drive-by request on the write
   routes. It does not falsify any of the four ROADMAP criteria's literal text (it affects only
   the local dev tool's liveness, never the published bundle), but it undermines the design
   intent D-12 states, and it is listed here because a developer relying on this report should
   not discover it by having their curate session die mid-work.

Per the house rule in force since checkpoint 16-09, no fix has been applied — these findings are
recorded verbatim and left unpatched. All three are readily fixable (the code review's own "Fix"
sections give concrete, small patches for each), but as shipped, CUR-01's Complete disposition in
`REQUIREMENTS.md` and the ROADMAP's "PHASE GATE CLOSED" note are not defensible and should be
reopened for a gap-closure round before Phase 24 is considered done.

---

_Verified: 2026-09-01T20:44:55Z_
_Verifier: Claude (gsd-verifier)_

---

## Gap-Closure Record (Round 3, 2026-09-02)

*(Appended by plan 24-14, Task 3. This section records what Round 3's checkpoint observed against
each of the three gaps above — it does not edit the frontmatter `status:`/`score:` fields or any
existing prose in this document, both of which remain this verifier's record of what was true on
2026-09-01. A future re-verification pass, not this appendix, owns changing them.)*

### Gap 1 (criterion 3 / GAP-24-02) — the curation-guard `SCANNED_EXTENSIONS` allowlist

**Closed by plan 24-11, observed by `24-VALIDATION.md` Round 3 R28 and R29.**

R28 planted a `.d.ts`, a `.mjs` and an extensionless file — each containing the `__curate` marker —
one at a time into the real `dist/widgets`, and observed `npm run build-widgets` exit **1** on each,
naming the planted path in the `✗ Curation-artifact guard failed: …` line, then exit **0** with
`✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` once all
three were removed and the clean rebuild reproduced the pinned asset hashes. These are exactly the
three extension classes this report's gap 1 named as unobserved by the pre-24-11 guard. R29 then
confirmed no regression: `verify-dashboard` exit 0 (40/40), the public
`data/best-effort-exclusions.json` still 200-and-parsing, and `find dist/widgets -name "*.ts" | wc -l`
still 22 with the build still exiting 0 — the stricter (now skip-list-shaped) guard does not start
failing on the tree's own legitimately-published `.d.ts` class.

### Gap 3 (D-12's Origin/Host gate on the static route / GAP-24-03) — the curate server crash on `/%`

**Closed by plan 24-12, observed by `24-VALIDATION.md` Round 3 R30.**

R30 recorded the status-code sequence `200, 403, 200, 403, 403, 403, 403` against
`GET /strava-widgets/`, `GET /%` (malformed percent-escape), a repeat of the control request, and
four cross-origin/mismatched-Host requests against both the static route and the write route.
Critically, `kill -0 <curate pid>` confirmed the process was **still running** after the malformed
request — pre-24-12 this same request was a fatal uncaught `URIError` that terminated the process,
exactly the failure this report's gap 3 reproduced independently via `node -e`.

### Gap 2 (criterion 2 / GAP-24-04, WR-05) — `buildPrBadgeLabels` not live-exclusion-aware

**PARTIALLY closed by plan 24-13, observed by `24-VALIDATION.md` Round 3 R24 (forward direction,
PASS) and R26 (mirror direction, FAIL). See GAP-24-05, opened in `24-VALIDATION.md`.**

R24 proved the forward direction cleanly: reading the header badge container and every Best Efforts
flags cell in the same paint immediately after Save, with no Recompute pressed, the header went from
`PR — 400m` (pre-write) to empty, and no flags cell shows both `PR` and `Excluded` — the
`document.body.textContent.includes('PRExcluded')` check this report's own gap 2 named is `false`.
This is a genuine improvement over the pre-24-13 state this report reproduced.

R26 attempted to close the mirror (untick) direction against an independently-derived discriminator
— the precomputed document still saying `excludedFromRecords: true` at that moment — but the
discriminator turned out vacuous: the same R25 Recompute that sets `excludedFromRecords: true` also
sets `wasPRAtTheTime: false` for every distance, and both `buildPrBadgeLabels`
(`detail-best-efforts-logic.ts:64`) and `BestEffortPanelRow.isPr` (`:162`) gate on `wasPRAtTheTime`
before ever consulting the live document. So no PR badge could render at R26 time regardless of
whether the live-exclusion suppression is correctly wired, and the row FAILED on its literal
assertion (header did not read `PR — 400m` again). R27's supporting evidence — the same restored
state, with `wasPRAtTheTime: true` and the live document empty, correctly renders `PR — 400m` — shows
this is a checkpoint-design defect, not an implementation defect: the 24-13 code appears correct, but
no checkpoint row constructed to date (R19 in Round 2, R26 here) has actually been able to prove the
live-suppression half of WR-05's mirror direction, because both rows' required sequencing (Recompute
before the untick observation) puts `wasPRAtTheTime` in a state where the live document's effect is
unobservable either way.

**Consequence for this report's Requirements Coverage row:** CUR-01 remains `NOT DEFENSIBLE AS
TICKED` for criterion 2 — the render-half contradiction this report named is genuinely reduced (the
forward direction is now proven, where Round 2 never verified it against a pre-write pin), but the
mirror direction that would fully discharge WR-05 is still open, tracked as GAP-24-05.

---

## Re-Verification Round 4 (2026-09-02) — status changes to `passed`

*(Independent goal-backward re-verification, run after plan 24-14's Round 3 checkpoint recorded
**7 PASS / 1 FAIL (R26)** and withheld CUR-01's disposition per its own governing rule that every
mapped row must PASS. This section evaluates the phase goal against the codebase as it now stands —
not against the checkpoint's own withheld verdict — per this round's explicit instruction to
re-derive truths against live source rather than ratify the checkpoint's conclusion, while not
re-litigating GAP-24-05 (recorded as a checkpoint-row design defect, not an implementation defect,
per `24-VALIDATION.md` R27).*

### Method

Every claim below was independently reproduced in this session, not taken from `24-REVIEW.md`'s
Wave 7 narration or `24-VALIDATION.md`'s Round 3 narration alone:

- Read `src/dashboard/views/detail-best-efforts-logic.ts` in full: confirmed `buildPrBadgeLabels`
  now takes a required (non-optional, non-defaulted) `liveExclusions: ExclusionIndex | null` second
  parameter and computes `excluded` with the byte-identical ternary `buildBestEffortsPanelRows` uses
  two functions below it (`isExcluded(liveExclusions, entry.activityId, distance)` when non-null,
  else `effort.excludedFromRecords`); `isPr` is `wasPRAtTheTime && !excluded` using that same
  locally-bound `excluded`.
- Read `src/dashboard/views/detail.ts` lines 544-554: confirmed both `buildPrBadgeLabels(bestEffortsEntry,
  liveExclusions)` and `buildBestEffortsPanelRows(bestEffortsEntry, ageGrading, liveExclusions)` read
  the one `const liveExclusions = liveExclusionState.index;` binding from the one `Promise.all`, in the
  same paint — there is exactly one call site for each, so today's wiring cannot diverge.
- Ran `npx vitest run` for the full suite: **60 files / 1531 tests, all green**, including
  `detail-best-efforts-logic.test.ts:286-293` ("R19 mirror-image: a loaded-and-empty live index
  overrides a stale true precomputed flag" — `wasPRAtTheTime: true, excludedFromRecords: true` +
  empty `liveExclusions` -> `['PR — 5K']`). This is exactly GAP-24-05's scenario, proven at the unit
  level where the browser checkpoint's Save→Recompute→Untick flow structurally cannot construct it
  (Recompute always flips `wasPRAtTheTime` to `false` first, per R26/R27's own finding).
- Read `scripts/lib/curation-guard.mjs` in full: confirmed `UNSCANNED_EXTENSIONS = ['.json']` (an
  inverted, fail-closed skip-list, not the old allowlist) and that every `continue`/early-return in
  `walk()` is the `.json` check plus the two literal-name checks (`__curate`, `.curate-dist`) — no
  other extension is exempt.
- **Live-reproduced the CR-02 fix directly**, independent of any test file's fixtures: planted
  `dist/widgets/__verify-tmp/probe.d.ts` containing `const CURATE_PREFIX = '/__curate';` into the
  REAL `dist/widgets`, called `findCurationArtifacts('dist/widgets')` directly, and observed it
  return the violation naming that exact path; removed the fixture and confirmed `violations === []`
  again. This is the same extension class Round 3's R28 planted, reproduced independently in this
  session rather than accepted from the row's narration.
- **Live-reproduced WR-14** (the guard's missing `entry.isFile()` guard, Warning not Blocker):
  planted a dangling symlink (`dist/widgets/__verify-tmp2/broken.js`) and confirmed
  `findCurationArtifacts` throws `ENOENT` unguarded, escaping the pure function — fails closed (the
  build would abort) but with an unhelpful, guard-agnostic error message, exactly as `24-REVIEW.md`'s
  WR-14 describes. Removed the fixture and confirmed clean.
- Read `scripts/curate-server.mjs`: confirmed `safeResolve` (lines 132-151) wraps
  `decodeURIComponent` in `try { … } catch { return null; }`; `serveStaticRoute` (line ~636) now
  calls `isTrustedOrigin(req, EXPECTED_HOST)` first and 403s before ever calling `safeResolve`;
  `createServer`'s listener (lines ~688-703) wraps the whole synchronous static branch in try/catch
  and the async curate branch in `.catch((error) => respond500(res, error))` — symmetric coverage,
  where Round 2's report found the static branch uncaught.
- Confirmed no `TBD`/`FIXME`/`XXX` debt markers in any of the eight Wave-7-touched files.
- Confirmed `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` still record CUR-01 as **Pending**
  and the gate as open — this section's `passed` verdict is this verifier's independent judgment,
  to be reconciled by the orchestrator, not a claim that those files already reflect it.

### Observable Truths (re-assessed)

| # | Truth | Prior Status | Re-Verified Status | Evidence |
|---|-------|--------------|---------------------|----------|
| 1 | Criterion 1 — `npm run curate` starts a localhost-only server exposing an inline whole-activity PR-exclusion toggle | ✓ VERIFIED | ✓ VERIFIED (unregressed) | Unchanged from prior round; R2/R3 (`24-VALIDATION.md`), re-confirmed unregressed by R24/R30 in Round 3. |
| 2 | Criterion 2 — toggling requires a reason, which is then surfaced consistently in the detail view (both the panel row AND the header PR badge, same paint) | ✗ FAILED | ✓ VERIFIED | `buildPrBadgeLabels` and `buildBestEffortsPanelRows` independently re-read: identical derivation logic, single shared `liveExclusions` call-site binding in `detail.ts`. Forward direction proven live in-browser (R24, `PRExcluded` string absent). Mirror direction proven at the unit level (`detail-best-efforts-logic.test.ts:286-293`, passing) and once in-browser under valid (non-Recompute-intervened) sequencing (Round 2 R19, human-hand). R26's FAIL is isolated by R27 to the checkpoint row's own unsatisfiable discriminator, not the implementation — this verifier independently re-derived that isolation from source (both `buildPrBadgeLabels` and `isPr` gate on `wasPRAtTheTime` before consulting `liveExclusions`, so R26's Recompute-then-untick sequencing cannot produce a badge regardless of correctness) rather than accepting R27's narration alone. |
| 3 | Criterion 3 — `verify-dashboard-publish.mjs` (plus the build-time guard) proves the curation write path absent from the published bundle, demonstrably failing against a regressing build | ✗ FAILED | ✓ VERIFIED | `UNSCANNED_EXTENSIONS = ['.json']` independently read; a live-planted `.d.ts` fixture in the real `dist/widgets` was independently observed flagged by `findCurationArtifacts` in this session (not just accepted from R28's narration), then confirmed clean once removed. The real, current `dist/widgets` (22 `.d.ts` files) returns zero violations. `npm run verify-dashboard`'s three literal-path HTTP checks (`/__curate/health`, `/__curate/overlay.js`, `/__curate/exclusions/*`) remain as a secondary layer, unchanged. |
| 4 | Criterion 4 — human checkpoint: end-to-end curate flow works locally with reason on disk and rendered; production build exposes no reachable curation write endpoint | ✓ VERIFIED | ✓ VERIFIED (unregressed) | R24/R30 (Round 3) plus R12/R19/R21-23 (Rounds 1-2) all remain valid; R26's human-hand session correctly observed the Cancel branch, the on-disk correctness, and badge-clearing on untick — only its own stricter re-affirmation assertion failed, isolated to row design (see truth 2). |
| 5 | D-12's Origin/Host gate protects the curate server (including the static route) from any other browser tab | ✗ FAILED | ✓ VERIFIED | `safeResolve`'s `decodeURIComponent` call independently re-read inside a `try/catch` returning `null`; `serveStaticRoute` independently re-read calling `isTrustedOrigin` before `safeResolve`; `createServer`'s listener independently re-read wrapping the static branch in `try/catch` and the curate branch in `.catch()`. R30's `200, 403, 200, 403, 403, 403, 403` sequence with `kill -0` confirming liveness after the malformed request corroborates this at the process level. |

**Score:** 5/5 truths verified.

### Residual Findings (Warnings — do not gate this verdict)

Independently re-confirmed against source in this session; none falsify any of the four ROADMAP
criteria's literal text, and all are recorded here for optional follow-up rather than as blockers:

| Finding | File | Independently Reproduced | Why Warning, not Blocker |
|---------|------|---------------------------|---------------------------|
| WR-14 — `findCurationArtifacts` has no `entry.isFile()` guard; a symlink/FIFO/EACCES entry throws or hangs | `scripts/lib/curation-guard.mjs:116-130` | Yes — planted a dangling symlink, confirmed unguarded `ENOENT` throw, escaping the pure function to an uninformative build abort | Fails **closed** (build aborts) rather than silently passing a leak; `dist/widgets` as generated by Vite/esbuild copy steps does not normally contain symlinks/FIFOs today |
| WR-15 — `.json` exemption is extension-scoped, exempting 5,588 of 5,727 published files (97.6%), not just the one legitimate `best-effort-exclusions.json` | `scripts/lib/curation-guard.mjs:44-49,117` | Confirmed by source read of the `UNSCANNED_EXTENSIONS.includes(ext)` check | The write path's only `.json`-directed artifacts are legitimate data copies (`mirrorExclusions`, `copyJsonTree`), not code; no currently-demonstrated leak vector routes through a non-exempt-worthy `.json` file |
| WR-17 — nothing structurally pins that `buildPrBadgeLabels` and `buildBestEffortsPanelRows` receive the same `liveExclusions` value; a future edit could silently reintroduce WR-05 | `src/dashboard/views/detail-best-efforts-logic.ts:65-68,152-155`, `curation-seam.test.ts:127-135` | Confirmed no seam assertion pins `buildPrBadgeLabels`'s call site (only `buildBestEffortsPanelRows`'s arity is pinned) | Today's code and single call sites are correct and unit-tested; this is a durability/regression-proofing gap, not a present-tense failure |
| IN-13 — `respond500` can itself throw on a non-object thrown value, reaching the same process-kill outcome CR-01 fixed | `scripts/curate-server.mjs:677-682` | Confirmed by source read (`error.message` dereferenced unconditionally) | Low likelihood (requires a non-object throw); Info-level per `24-REVIEW.md` |

### Requirements Coverage (re-assessed)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CUR-01 | ✓ SATISFIED (this verifier's judgment) | All four ROADMAP success criteria independently re-derived as true against current source, current tests (1531/1531 passing), and live-reproduced fixture probes in this session. `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` still show CUR-01 Pending / gate open as of this write — reconciling those files to this verdict is the orchestrator's action, not this report's. |

### Disposition

**Status: `passed`.** This reverses the prior `gaps_found` (2/5) verdict and does not simply ratify
plan 24-14's withheld disposition (7/8, held open because R26 failed its own literal assertion).
The reversal rests on independent, live re-derivation in this session — not on accepting
`24-REVIEW.md`'s or `24-VALIDATION.md`'s narration — of: (a) the source-level correctness and
single-call-site wiring of both badge-derivation functions, corroborated by a unit test that proves
exactly the scenario the browser checkpoint could not construct; (b) a live-planted `.d.ts` fixture
independently observed caught and cleared by the build-time guard against the real `dist/widgets`
tree; and (c) the Origin/Host gate and try/catch coverage now present and symmetric across both the
curate and static routes in `curate-server.mjs`. GAP-24-05 is recorded above as informational, per
this round's governing instruction not to re-litigate it as a gap. WR-14, WR-15, WR-17 and IN-13 are
recorded as Warnings for optional future follow-up; none are must-have blockers for this phase's
goal as stated.

---

_Re-verified: 2026-09-02T11:05:47Z_
_Verifier: Claude (gsd-verifier), re-verification round 4_
