---
phase: 25-ci-hardening-light-theme-verification
plan: 10
subsystem: testing
tags: [checkpoint-verification, first-paint, dark-mode, chrome-devtools-protocol, screencast]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification
    provides: "plan 25-08's throttled screencast capture mechanism (Candidate C) and its bidirectional reachability proof; plan 25-09's drafted R7 row text (ROW_BASELINE_SHA bf9d1a13)"
provides:
  - "R7 scored PASS: a raster frame captured 11.899169921875 ms before production's own first-paint, on a genuinely dark OS, sampling the dark theme background colour"
  - "GAP-25-01 CLOSED — a capture mechanism that beats first paint against production now exists and has been run and scored"
  - "Both of the developer's verbatim judgment messages on the captured frames, with the second message's correction recorded as governing"
affects: [25-11, 25-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct getComputedStyle/Runtime.evaluate read as an independent corroboration of a pixel-sampled raster frame, used to resolve a disclosed one-unit-of-256 colour-channel mismatch without editing the discriminator"

key-files:
  created: []
  modified:
    - .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md

key-decisions:
  - "R7 scored PASS on frame-001.png: t_since_navigation_ms 4024.100830078125 vs first-paint startTime 4036 (margin 11.899169921875 ms), sampled rgb(26,26,45) corroborated by getComputedStyle's rgb(26,26,46)"
  - "The rgb(26,26,46)-vs-rgb(26,26,45) discriminator mismatch was resolved via the pre-existing screencast-re-encode disclosure from plan 25-08 Part A, not by editing R7's drafted discriminator"
  - "GAP-25-01 marked CLOSED, dated 2026-09-04, citing R7's frame and arithmetic"
  - "The developer's message 2 ('clear' meant 'empty') is recorded as correcting and superseding message 1's wording, disambiguated inline so 'white' cannot be misread as a colour claim"

patterns-established: []

requirements-completed: []

# Metrics
duration: ~23min (Task 2 + Task 3; continuation from a prior executor's Task 1)
completed: 2026-09-04
---

# Phase 25 Plan 10: Run and score R7 (VER-01's first-paint row) Summary

**R7 PASSED: a production capture landed 11.9 ms before first-paint on a genuinely dark OS, sampling the dark theme background colour, closing GAP-25-01 with the developer's own verbatim, twice-stated judgment as corroboration.**

## Performance

- **Duration:** ~23 min for this continuation (Task 2 + Task 3); Task 1 was completed by a prior executor at commit `42a0bf9b`.
- **Tasks:** 2 of 2 remaining tasks completed (Task 2 checkpoint, Task 3 auto-scoring). Plan total: 3/3.
- **Files modified:** 1 (`25-VALIDATION.md`).

## R7 verdict

**PASS.** `frame-001.png`, captured against `https://bacilo.github.io/strava-widgets/` under the throttled mechanism (`--throttle-ms 1000`), landed `11.899169921875 ms` before this navigation's own `first-paint`, on a genuinely dark OS, sampling the dark theme background colour rather than white. All six of R7's drafted evidence items and all four of GAP-25-01's numbered clauses are satisfied simultaneously by this one frame. Full scoring walkthrough is in `25-VALIDATION.md`'s Round 2 section, under R7's "R7 SCORED (Task 3)" block.

## Capture arithmetic

- `performance.timeOrigin`: `1788532205772.8`
- `firstPaintStartTime`: `4036` ms
- `firstContentfulPaintStartTime`: `8704` ms
- `navResponseEnd`: `1406.800000000745` ms
- `frame-000.png`: `t_since_navigation_ms = 19.140869140625`, `rgb(18, 18, 18)` uniform — **before `navResponseEnd`**, therefore the universal Chrome UA-default artifact frame named in R7's own MECHANISM clause; excluded, carries no discriminating information (independently corroborated by the developer's own judgment: "000.png is black").
- **`frame-001.png` (R7's evidence frame): `t_since_navigation_ms = 4024.100830078125`, `rgb(26, 26, 45)` uniform** — after `navResponseEnd` (real page content) and at-or-before `first-paint` (`4024.100830078125 <= 4036`), margin `4036 − 4024.100830078125 = 11.899169921875 ms`.
- `frame-002.png`: `t_since_navigation_ms = 8692.7060546875`, `beats_first_paint: false`, corners `rgb(36, 36, 66)` / centre `rgb(26, 26, 45)` — after first paint, context only, closer to `firstContentfulPaintStartTime` (8704 ms); shows the top navigation bar per the developer's own reading.

## Evidence provenance

**Developer's own hand (D-07):**
- Confirmed macOS Appearance was already `Dark` for this plan — `defaults read -g AppleInterfaceStyle` read `Dark` before and during the run. No flip was required this plan (the machine had been set Dark earlier in this session, by the developer's own hand, per the provenance already recorded for plan 25-08's reachability proof). Disclosed as the mirror-image of R1's already-dark case.
- Viewed the three captured frames together with the timing arithmetic and gave judgment in two messages, quoted verbatim below.

**Message 1 (verbatim):**
> frame-001.png is "white" in the sense of being clear. It actually has the color of the dark theme background. 000.png is black and 002.png has the dark background (like 001) and the top navigation bar

**Message 2 — the correction, which supersedes message 1's wording (verbatim, including the typo "bacgkround" [sic]):**
> Sorry when i said "clear" I meant empty. Just one color (the dark theme bacgkround color) not "legible" there is nothing to read in 001.png or 000.png. In 002.png there is the top navigation bar to read

**Disambiguation:** the developer's word "white" in message 1 is NOT a colour claim — message 2 makes explicit that "clear" meant EMPTY (a single flat colour, nothing rendered), and that the one colour `frame-001.png` shows is the dark theme background colour. The granularity given is a per-frame reading of all three frames (000 empty/black; 001 empty, one flat colour, the dark theme background colour, nothing legible; 002 dark background plus the top navigation bar, the first frame with anything to read). This is not expanded into per-evidence-clause approval the developer did not give, and no judgment is attributed to them on the timing arithmetic, the cache-trap check, or the `rgb(26,26,45)`/`rgb(26,26,46)` question — they were not asked about those.

**Agent's own actions:** assembled and ran the exact harness invocation recorded in Task 1's pre-flight (`node scripts/first-paint-capture.mjs --mechanism throttled --throttle-ms 1000 --url https://bacilo.github.io/strava-widgets/ --out .../capture/r7-production-run`); launched Chrome against a throwaway `--user-data-dir` (`scripts/first-paint-capture.mjs:444`, removed after capture at `:582-584`); navigated to production; captured and timestamped three frames; read `localStorage`, `matchMedia`, `data-theme`, `getComputedStyle(document.body)`, and the navigation timing entries via `Runtime.evaluate`; performed the cache-busted refetch and SHA-256 comparison; compared the hashed asset name against the `origin/gh-pages` value derived in Task 1 before the run. **No `osascript` was used and no CDP rendering override (`Emulation.setEmulatedMedia` or equivalent) was applied at any point.**

## Cache-trap exclusion

- Captured document's hashed module script: `moduleScriptSrc: "./assets/index-D-Ts7X8C.js"`.
- Pre-derived `origin/gh-pages` value (Task 1, before the run): `assets/index-D-Ts7X8C.js` @ `b2b05a40` — unchanged since R5, production was not redeployed between Task 1 and this run.
- Cache-busted refetch of `index.html` vs plain fetch: byte-identical, SHA-256 `33fa42bdef7c6e3eec76b8fffb35041a45f4f60e004391647a17384415137fa1` for both, `3177` bytes for both.
- No stale-cache artifact (T-25-21) is present.

## Disclosures

- D-05's dark-OS deviation disclosure and D-04's amendment disclosure are cross-referenced by name (both already written in the Round 1 section), not restated.
- Slowed-load disclosure (R7-specific): the throttled mechanism (`latency: 1000ms, downloadThroughput: 6400 B/s, uploadThroughput: 6400 B/s`) was confirmed applied exactly as drafted, quoted from this run's own `report.json.emulation` block. It widened the navigation-to-first-paint window without touching `Emulation.setEmulatedMedia`, `data-theme`, or any other rendering override.
- **The `rgb(26,26,46)` vs `rgb(26,26,45)` discriminator resolution, disclosed explicitly rather than silently:** R7's drafted discriminator names `rgb(26, 26, 46)` as PASS; `frame-001.png`'s pixel-sampled colour reads `rgb(26, 26, 45)`, one unit off in the blue channel — the same mismatch disclosed BEFORE this run in plan 25-08's Part A (all three production runs sampled the identical `rgb(26, 26, 45)`) and attributed there to the screencast PNG re-encode pipeline. This run's own `pageState.bodyBackgroundColor`, read directly via `getComputedStyle`/`Runtime.evaluate` (not sampled from a re-encoded raster frame), reads the exact authored `"rgb(26, 26, 46)"`, confirming the page itself renders the correct value. The discriminator text was NOT edited to match the observation; the pre-existing disclosure was applied instead, consistent with how Part A's three production runs were already treated as CAN-PASS evidence before this row was run.
- The ordering argument was NOT used to reach this verdict; the row stands on this run's own captured frame.
- The `127.0.0.1` control served in plan 25-08 Part B is named explicitly as mechanism proof only and is NOT presented as R7's own production evidence (D-08).

## Gap disposition

**GAP-25-01: CLOSED, 2026-09-04 (plan 25-10, Task 3).** R7 PASSED against production, on a genuinely dark OS, with the frame tied to its own navigation by arithmetic (not wall-clock proximity), against a top-level production navigation (not the `127.0.0.1` control), with `dashboard-theme` quoted `"auto"`. The closure note is written into `25-VALIDATION.md`'s `## Gaps opened by Round 1` section, immediately before the `### GAP-25-02` heading, citing R7's frame and arithmetic. GAP-25-02 is untouched by this plan (it is plan 25-11's scope).

No requirement was ticked by this plan. `REQUIREMENTS.md` and `ROADMAP.md` are untouched (`git diff --stat` confirms empty) — disposition is plan 25-12's job under the all-rows-PASS rule.

## Row Integrity

`ROW_BASELINE_SHA` (from `25-09-SUMMARY.md`): `bf9d1a139fae3563e431981709f3fb0883a9d7ee`. Final re-confirmation, run after the verdict was written: `git diff bf9d1a139fae3563e431981709f3fb0883a9d7ee -- 25-VALIDATION.md` shows exactly one deletion line across the whole plan (`-Replaces the BLOCKED R2. **Verdict: pending.**`, replaced by the scored verdict line) — zero `-`/`+` lines fall inside R7's drafted discriminator, MECHANISM, six-item evidence requirement, or either reachability paragraph. R7 was run exactly as plan 25-09 drafted it.

## Deviations from Plan

None — plan executed exactly as written. Task 1 was completed by a prior executor; this continuation ran Task 2 (the developer checkpoint, using the capture already performed) and Task 3 (scoring) without modifying R7's drafted text.

## Self-Check: PASSED

- FOUND: `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md`
- FOUND: `.planning/phases/25-ci-hardening-light-theme-verification/capture/r7-production-run/report.json`
- FOUND: `.planning/phases/25-ci-hardening-light-theme-verification/capture/r7-production-run/frames/frame-001.png`
- FOUND commit `42a0bf9b` (Task 1, prior executor)
- FOUND commit `4bd41667` (Task 2, this session)
- FOUND commit `4cde2717` (Task 3, this session)
