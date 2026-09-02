---
phase: 24-local-curation-mode
verified: 2026-09-01T20:44:55Z
status: gaps_found
score: 2/5 must-haves verified
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
