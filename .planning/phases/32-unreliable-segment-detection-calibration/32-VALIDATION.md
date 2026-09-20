---
phase: 32
slug: unreliable-segment-detection-calibration
status: in-progress
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-19
reopened: 2026-09-20
reopened_reason: "32-VERIFICATION.md gaps_found, 5/8 — three blockers falsify 32-02/32-05/32-06 must_haves"
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Reopened 2026-09-20

`32-VERIFICATION.md` returned `gaps_found` (5/8 must-haves) on 2026-09-20, after this contract was
already closed. Three blockers falsify must_haves this contract claimed satisfied:

- **GAP 1 — the "never throws" total-function contract is false.** `detectUnreliableSegments` and
  `advanceSteps` throw on null/non-array `gaps`, `null` `params`, a `[null]` gap entry, and null
  `t`/`d` — reachable from the untyped `.mjs` scripts that parse this data straight off disk.
- **GAP 2 — the import-time side-effect guards are structurally vacuous.** Both self-execution
  proofs do `vi.spyOn(fs, 'readFileSync')` against scripts that consume `fs` via named imports,
  which Node's module interop makes unobservable to that spy; a control probe that genuinely reads
  a file at import time still recorded zero spy calls.
- **GAP 3 — the gap-boundary index convention disagrees with itself.** `mapGapToIndices` and
  `isGapPair` pick opposite duplicate-timestamp indices as a gap's boundary sample, so a duplicate
  timestamp exactly on a gap boundary silently drops the gap's own metres/seconds from the segment.
  Latent on today's committed archive (72/1,874 streams carry duplicate timestamps, none yet on a
  gap boundary) but real and reproducible in shipped code.

The prior sign-off below remains true for what it measured: a green `npm test` (90 files, 2,788
tests) and a clean `tsc --noEmit` detect none of the three gaps above, because each defect is
either in an untested input shape (GAP 1, GAP 3) or in a test that cannot detect its own subject
(GAP 2). That is exactly why NEW rows are needed for 32-10..32-16, not a re-run of the old ones.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`, `fileParallelism: false`) |
| **Quick run command** | `npx vitest run src/analytics/unreliable-segments.test.ts scripts/compute-unreliable-segment-recount.test.mjs scripts/compute-unreliable-segment-calibration.test.mjs` (the `.test.mjs` files import `../dist/`, so run `npm run build` first) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds (full suite; archive-scanning calibration tests dominate) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, the calibration artifact regenerated twice with zero diff, and the recount shown failing against a deliberately-broken detector before passing
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Task IDs are filled by the planner. Every `-t` row MUST record the matched test count when run — a filter matching 0 tests exits 0 and is indistinguishable from a pass.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-02-T1/T2, 32-08-T1 | 02, 08 | 1, 5 | SEG-01 | T-32-04 | Non-`ok` `t`/`d`, malformed gaps or params → fresh empty result, never throws (`validateStreamSeries`); folded run-level scoring does not fire on full/zero aliasing | unit | `npx vitest run src/analytics/unreliable-segments.test.ts` (53/53 passed) and `-t "decimation"` (**3 matched, 3 passed**) | ✅ | ✅ green |
| 32-03-T1/T2, 32-07-T2, 32-08-T1/T2 | 03, 07, 08 | 1, 4, 5 | SEG-02 | T-32-06, T-32-16 | Recount never imports the detector; watched failing vs a deliberately broken detector | unit + script | `npx vitest run src/analytics/unreliable-segments.test.ts -t "3475724402"` (**4 matched, 4 passed**), `npx vitest run scripts/unreliable-segment-recount-crosscheck.test.mjs scripts/compute-unreliable-segment-recount.test.mjs` (4 + 47 passed), and `node scripts/compute-unreliable-segment-recount.mjs` (exit 0, PASS). Asserts that no burst is unmerged or labelled isolated and that per-segment metres/seconds equal the independent table. The scoping probe's 30/18/1,694 m/106 s/707 s is a reconciliation reference, NOT an asserted value | ✅ | ✅ green |
| 32-08-T1 | 08 | 5 | SEG-03 | T-32-18 | Extents derived in-test from raw t/d | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "mechanism"` (**12 matched, 12 passed**). 3475734189 t=1353–1360 is hidden-pause; the retained 3475740390 jumps (all five unless the 32-05 decision amends criterion 3) are isolated-jump | ✅ | ✅ green |
| 32-05-T1/T2, 32-06-T1/T2, 32-07-T1, 32-09-T1 | 05, 06, 07, 09 | 2, 3, 4, 6 | SEG-04 | T-32-10, T-32-11, T-32-13 | Anti-quota: no flagged count before the statistic is chosen; D-13 strawman watched failing | script | `node scripts/compute-unreliable-segment-calibration.mjs` run twice post-merge, `git diff --exit-code` on the artifact exits 0 (byte-identical); `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` (57/57 passed) | ✅ | ✅ green |
| 32-04-T1/T2 | 04 | 2 | SEG-05a | T-32-08, T-32-09 | Importer, arithmetic, structural and param-key confinement | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "SEG-05a"` (**7 matched, 7 passed** — recorded in 32-04-SUMMARY.md, re-confirmed unregressed by this session's full-suite run). A planted second implementation is watched red first (in-suite and on the real tree) | ✅ extend | ✅ green |
| 32-01-T2, 32-09-T1 | 01, 09 | 1, 6 | D-17 | T-32-01, T-32-02, T-32-03 | Stream byte-identity: a digest change fails, new files are tolerated, append-only | unit | `npx vitest run scripts/compute-stream-checksums.test.mjs` (12/12 passed). A planted one-byte edit is watched red, then restored, and `git status --porcelain data/streams` is empty (confirmed post-merge, `npm run compute-stream-checksums` printed `added 0`) | ✅ | ✅ green |
| 32-09-T2 | 09 | 6 | D-12 | T-32-20, T-32-21 | Local-only; no `.test.mjs`; graceful absence | manual (local) | `node scripts/validate-unreliable-segments-1hz.mjs --as-of <date>` run twice with the same flag, zero diff confirmed; `UNRELIABLE_1HZ_EXPORT_ROOT=/nonexistent node scripts/validate-unreliable-segments-1hz.mjs --as-of 2026-09-19` prints `Nothing to validate` and exits 0; missing/malformed `--as-of` exits 1 with a usage line | ✅ | ✅ green |
| 32-10-T1/T2 | 10 | 1 | bookkeeping | T-32-28 | No Phase 32 artifact claims completion for work this verification falsified | grep | This plan's own acceptance greps (32-10-PLAN.md Tasks 1-2) | ⬜ | ⬜ pending |
| 32-11-T1/T2 | 11 | 1 | SEG-01 | T-32-22 | Shape-level malformed input (null/non-array `t`, `d`, `gaps`; null `params`; a `[null]` gap entry) returns a fresh `[]` and never throws | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "shape-level"`, matched count recorded, watched RED before the guards land | ⬜ | ⬜ pending |
| 32-12-T1/T2 | 12 | 1 | SEG-02, SEG-04 | T-32-23 | Importing either generator performs no `readFileSync`/`readdirSync`/`writeFileSync` | unit | `npx vitest run scripts/unreliable-segment-import-guards.test.mjs`; the control probes must be observed CALLING `readFileSync`, which is what makes the negative assertion falsifiable | ⬜ | ⬜ pending |
| 32-13-T1/T2/T3 | 13 | 2 | SEG-01, SEG-02 | T-32-24 | A duplicate timestamp on a gap boundary changes neither mechanism nor conserved metres/seconds | unit + dist | `npx vitest run src/analytics/unreliable-segments.test.ts -t "boundary convention"`, matched count recorded, plus the dist-level reproduction of both verifier fixtures | ⬜ | ⬜ pending |
| 32-14-T1/T2/T3 | 14 | 3 | SEG-04 | T-32-25 | `findValley` cannot manufacture a valley from out-of-interval mass; `parseDecisionText` refuses a non-finite span; `namedItemSegmentMetres` fails closed on ambiguous overlap | script | `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` plus the generator run twice with `git diff --exit-code` on the artifact | ⬜ | ⬜ pending |
| 32-15-T1/T2/T3 | 15 | 3 | SEG-03, SEG-04, SEG-05a | T-32-26 | The SEG-05a importer scan catches double-quoted and backtick specifiers; the D-05 and D-09 negative controls are shown able to fire; `buildActivityFinding` returns a skipped finding instead of throwing | unit + local CLI | `-t "SEG-05a"` and `-t "negative control"`, both matched counts recorded | ⬜ | ⬜ pending |
| 32-16-T1/T2 | 16 | 4 | all five | T-32-27 | The closing gate is re-run on the post-closure tree and every reopened artifact re-closed only against recorded evidence | gate | build, tsc, `npm test`, recount, `git status --porcelain data/streams` | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Matched-count discipline (restated)

Run every `-t` row's output piped through `sed 's/\x1b\[[0-9;]*m//g'` then
`grep -E "^\s+Tests "`, record the printed `N passed` in the row and in the plan's SUMMARY, and
treat `0 passed` as a defect in the row, not a pass — a filter matching nothing exits 0 and is
indistinguishable from a real pass.

---

## Wave 0 Requirements

- [x] `src/analytics/unreliable-segments.ts` + `.test.ts` — SEG-01/02/03
- [x] `scripts/compute-unreliable-segment-recount.mjs` + `.test.mjs` — SEG-02 independent table (D-15)
- [x] `scripts/compute-unreliable-segment-calibration.mjs` + `.test.mjs` — SEG-04
- [x] Calibration artifact of record in the phase directory — SEG-04
- [x] Streams-immutability manifest `data/stream-checksums.json` + `scripts/compute-stream-checksums.test.mjs` gate (outside `data/streams/`, so it cannot collide with `data/streams/manifest.json`) — D-17
- [x] `scripts/unreliable-segment-recount-crosscheck.test.mjs` — SEG-02 `npm test`-time detector vs recount agreement
- [x] `scripts/validate-unreliable-segments-1hz.mjs` — D-12, deliberately WITHOUT a `.test.mjs` sibling (vitest collects `scripts/**/*.test.mjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 1 Hz FIT cross-check of detected segments | SEG-04 / D-12 | Needs local-only `export_data/`, excluded from CI by design | Run `node scripts/validate-unreliable-segments-1hz.mjs` on the primary checkout; commit its dated findings |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Superseded 2026-09-20 by 32-VERIFICATION.md (gaps_found):** the paragraph below is kept verbatim
as history — it is what the closing gate measured, and everything it states is still true for what
it measured.

**Approval:** phase closes on the merged tree, 2026-09-20. Closing gate (this session):
`npm run build` and `npx tsc --noEmit` both exit 0; `npm test` is 90/90 files, 2788/2788 tests
passed; every Per-Task row above is green with a non-zero matched `-t` count recorded;
`node scripts/compute-unreliable-segment-recount.mjs` exits 0 (PASS); `32-CALIBRATION.md`
regenerates byte-identically on a second post-merge run; `git status --porcelain data/streams`
is empty. See `32-09-SUMMARY.md` for the merge outcome (a truthful no-op — origin/master was
already an ancestor of local master) and the D-12 1 Hz findings.

**The phase does not re-close** until plan 32-16 records a fresh closing gate against the
post-gap-closure tree, and every artifact reopened by this plan (this file, `ROADMAP.md`,
`REQUIREMENTS.md`, `STATE.md`) is re-closed only against that recorded evidence — not against this
superseded paragraph.
