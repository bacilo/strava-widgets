---
phase: 32
slug: unreliable-segment-detection-calibration
status: complete
closed: 2026-09-20
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-19
reopened: 2026-09-20
reopened_reason: "32-REVIEW.md round-2 CR-01 (Critical): 32-13's own gap-boundary fix double-counts distance across two adjacent gap spans sharing a duplicated boundary timestamp — falsifies the maximal-contiguous-chain/conservation invariant. Closing plan: 32-17. Prior reopen (same date): 32-VERIFICATION.md gaps_found, 5/8 — three blockers falsify 32-02/32-05/32-06 must_haves, closed by 32-10..32-16."
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
| 32-10-T1/T2 | 10 | 1 | bookkeeping | T-32-28 | No Phase 32 artifact claims completion for work this verification falsified | grep | This plan's own acceptance greps (32-10-PLAN.md Tasks 1-2) | ✅ | ✅ green (32-10-SUMMARY.md: both task commits' acceptance greps passed, 0fcb24ba/4b935955) |
| 32-11-T1/T2 | 11 | 1 | SEG-01 | T-32-22 | Shape-level malformed input (null/non-array `t`, `d`, `gaps`; null `params`; a `[null]` gap entry) returns a fresh `[]` and never throws | unit | `npx vitest run src/analytics/unreliable-segments.test.ts -t "shape-level"`, matched count recorded, watched RED before the guards land | ✅ | ✅ green (**31 matched, 31 passed**, re-run 2026-09-20 on the merged tree; RED confirmed in 32-11-SUMMARY.md: 22 failed/9 passed pre-fix; all five verifier-listed dist-level inputs re-reproduced returning `[]` without throwing, two successive invalid calls confirmed to return distinct array objects — `GAP1-ALL-FIVE-EMPTY-NO-THROW-DISTINCT-OBJECTS-OK`) |
| 32-12-T1/T2 | 12 | 1 | SEG-02, SEG-04 | T-32-23 | Importing either generator performs no `readFileSync`/`readdirSync`/`writeFileSync` | unit | `npx vitest run scripts/unreliable-segment-import-guards.test.mjs`; the control probes must be observed CALLING `readFileSync`, which is what makes the negative assertion falsifiable | ✅ | ✅ green (**5 matched, 5 passed**, re-run 2026-09-20; both controls confirmed recording a `readFileSync` call against `package.json`; watched-failing demonstration re-run in this plan — see Approval note below and SUMMARY — then reverted, `git diff` on the file empty after revert) |
| 32-13-T1/T2/T3 | 13 | 2 | SEG-01, SEG-02 | T-32-24 | A duplicate timestamp on a gap boundary changes neither mechanism nor conserved metres/seconds | unit + dist | `npx vitest run src/analytics/unreliable-segments.test.ts -t "boundary convention"`, matched count recorded, plus the dist-level reproduction of both verifier fixtures | ✅ | ✅ green (**6 matched, 6 passed**, re-run 2026-09-20; both verifier fixtures A/B re-reproduced against `dist/analytics/unreliable-segments.js` — `GAP3-A-AND-B-GAP-ADJACENT-21M-13S-1GAP-OK`) |
| 32-14-T1/T2/T3 | 14 | 3 | SEG-04 | T-32-25 | `findValley` cannot manufacture a valley from out-of-interval mass; `parseDecisionText` refuses a non-finite span; `namedItemSegmentMetres` fails closed on ambiguous overlap | script | `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` plus the generator run twice with `git diff --exit-code` on the artifact | ✅ | ✅ green (**7 matched, 7 passed** for `-t "findValley"`, re-run 2026-09-20; generator run twice, `git diff --exit-code` on 32-CALIBRATION.md clean — byte-identical, sha256 `f8f6d5db...`. Carry-forward: this row's own plan-verify literal `grep -c "valleyFound: false"` can never match this artifact's rendered prose (32-14-SUMMARY.md's own documented finding); re-confirmed here via the semantic equivalent `grep -c "NO clean valley found" 32-CALIBRATION.md` → `1`) |
| 32-15-T1/T2/T3 | 15 | 3 | SEG-03, SEG-04, SEG-05a | T-32-26 | The SEG-05a importer scan catches double-quoted and backtick specifiers; the D-05 and D-09 negative controls are shown able to fire; `buildActivityFinding` returns a skipped finding instead of throwing | unit + local CLI | `-t "SEG-05a"` and `-t "negative control"`, both matched counts recorded | ✅ | ✅ green (**`-t "SEG-05a"` 9 matched, 9 passed** (≥7 baseline); **`-t "negative control"` 6 matched, 6 passed** (≥3 required), re-run 2026-09-20 on `src/analytics/pace-single-source.test.ts` and `src/analytics/unreliable-segments.test.ts` respectively. Carry-forward: 32-15's D-05/D-09 discriminator correction stands as documented — `7409028052` and the D-09 pair are protected by the 3.0 m excess floor, not the 7.35 m/s speed limit; only `3647739864` is speed-protected. CR-03 CLOSED: 32-15's bare worktree had no `export_data/` and could only prove the missing/malformed-stream directions; this checkout DOES have `export_data/strava/`, and `buildActivityFinding('3475724402', ...)` was re-run here directly against the real `.fit.gz` original (`activities/3711971403.fit.gz`) — `skipped: null`, `fitSampleCount: 3655`, 16 segments, all `gap-adjacent`, matching the recount table row-for-row. This is the "real activity, normal finding shape" demonstration 32-15 could not complete; it is closed now, not carried forward) |
| 32-16-T1/T2 | 16 | 4 | all five | T-32-27 | The closing gate is re-run on the post-closure tree and every reopened artifact re-closed only against recorded evidence | gate | build, tsc, `npm test`, recount, `git status --porcelain data/streams` | ✅ | ✅ green (build/tsc/npm test/recount/checksums/streams all re-run 2026-09-20 on the merged tree at `080ea7da` — see Approval note below for the full recorded gate output) |
| 32-17-T1/T2 | 17 | 5 | SEG-01, SEG-02 | T-32-24 | Two adjacent gap spans mapping to OVERLAPPING index ranges via a shared duplicate-timestamp boundary fail closed (a fresh `[]`), never double-counting distance; conservation is asserted ACROSS segments against an independently-derived total, not only within one | unit + dist | `npx vitest run src/analytics/unreliable-segments.test.ts -t "round-2 CR-01"` and `-t "boundary convention"`, matched counts recorded, watched RED before the guard lands; dist-level reproduction of the reviewer's exact input | ✅ | ✅ green (**`round-2 CR-01` 1 matched, 1 passed**; **`boundary convention` 7 matched, 7 passed** (up from 32-13's 6 — coverage only grew); RED confirmed pre-fix: 1 failed / 93 passed (94) whole-file, reviewer's exact input returned two overlapping segments summing 160 m vs actual 140 m; post-fix `dist/analytics/unreliable-segments.js` reproduction returns `[]` — `CR-01-CLOSED-FAILS-CLOSED-OK`) |
| 32-17-T3 | 17 | 5 | SEG-04 | — | `buildActivityFinding`'s `activityDoc.start_date` dereference guarded the same way CR-03 guarded the sibling stream read — missing/null/non-object activity doc or non-string `start_date` yields a skipped finding, never a throw | local CLI | Pre-fix throw and post-fix skip both observed via direct CLI probe against `buildActivityFinding`; `3475724402` re-confirmed unchanged | ✅ | ✅ green (pre-fix: `THREW: Cannot read properties of null (reading 'start_date')`; post-fix: `{"skipped":"activity doc missing, not an object, or start_date not a string"}` for both a `null` doc and a non-string `start_date`; `3475724402` unchanged — `skipped:null`, `fitSampleCount:3655`, 16 segments, all `gap-adjacent`) |
| 32-17-T4 | 17 | 5 | all five | T-32-27 | The closing gate is re-run on the post-CR-01/WR-01 tree; archive output, calibration sha256 and the three constants unchanged | gate | build, tsc, `npm test`, calibration regen x2, recount, checksums, archive scan | ✅ | ✅ green — see Re-Approval section below for the full recorded gate output |

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

---

## Re-Approval 2026-09-20 (plan 32-16, post-gap-closure)

**Closing gate, re-run on the merged post-gap-closure tree (HEAD `080ea7da`, primary checkout, not a
worktree):**

- `npm run build` (tsc) — exit 0
- `npx tsc --noEmit` — exit 0
- `npm test` — `91 files passed (91)`, `2847 tests passed (2847)` (up from the pre-gap-closure
  90/2,788 baseline: +1 file (`scripts/unreliable-segment-import-guards.test.mjs`, 32-12), +59 tests
  net — every plan's own recorded delta (32-11 +31 shape-level, 32-12 −2 vacuous +5 guard-file,
  32-13 +6 boundary-convention (net of the mechanism-collision rename), 32-14 +14 CR-04/CR-06/WR-07,
  32-15 +5 SEG-05a-quoting/negative-control) sums to +59, matching this run exactly)
- `node scripts/compute-unreliable-segment-recount.mjs` — exit 0, PASS, all 16 rows agree with
  `32-CALIBRATION.md`'s detector table
- `node scripts/compute-unreliable-segment-calibration.mjs` run, then `git diff --exit-code` on
  `32-CALIBRATION.md` — clean (byte-identical); sha256 `f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e`,
  unchanged from the orchestrator's pre-plan check
- `npm run compute-stream-checksums` — printed `added 0`
- `git status --porcelain data/streams` — empty (`STREAMS-CLEAN`)

**Three gaps re-reproduced closed directly against `dist/analytics/unreliable-segments.js`** (not
the TypeScript source, not a SUMMARY's narration):

- GAP 1 (total-function contract): all five verifier-listed inputs
  (`detectUnreliableSegments(t,d,null,P)`, `(t,d,[],null)`, `(t,d,[null],P)`,
  `(null,null,[],P)`, `advanceSteps(t,d,null)`) returned a fresh `[]` without throwing; two
  successive invalid calls confirmed to return distinct array objects — `GAP1-ALL-FIVE-EMPTY-NO-THROW-DISTINCT-OBJECTS-OK`
- GAP 3 (gap-boundary convention): both verifier fixtures (`{t:[0,1,1,13], d:[0,20,20,21], gaps:[{startSec:1,endSec:13}]}`
  and `{t:[0,1,13], d:[0,20,21], gaps:[{startSec:1,endSec:13}]}`) returned exactly one segment each,
  `mechanism: 'gap-adjacent'`, `metres: 21`, `seconds: 13`, `gapCount: 1` —
  `GAP3-A-AND-B-GAP-ADJACENT-21M-13S-1GAP-OK`
- GAP 2 (import-time guard): `npx vitest run scripts/unreliable-segment-import-guards.test.mjs`
  passed 5/5, with both control tests confirmed recording a real `readFileSync` call against
  `package.json`. The watched-failing demonstration was re-run in this plan: the recount guard's
  `expect(calls).toEqual([])` assertion was pointed at
  `./lib/import-time-read-probe-named.mjs` instead of the real recount script and re-run —
  ```
  FAIL  scripts/unreliable-segment-import-guards.test.mjs > compute-unreliable-segment-recount.mjs performs no disk read at import > records zero fs calls
  AssertionError: expected [ { fn: 'readFileSync', …(1) } ] to deeply equal []
  - []
  + [ { "arg0": "file:///Users/pedf/workspace/strava-widgets/package.json", "fn": "readFileSync" } ]
  ```
  then reverted (`git diff` on the file empty after revert; whole-file re-run confirmed 5/5 green
  again).

**Every `-t` filter named in 32-16-PLAN.md's action, matched count recorded (all non-zero):**
`shape-level` 31, `boundary convention` 6, `findValley` 7, `SEG-05a` 9 (≥7 baseline), `negative
control` 6 (≥3 required), `3475724402` 4, `mechanism` 12, `decimation` 3. No Per-Task row's Status
cell reads pending anymore — all seven gap-closure rows are ✅ green.

**Plan-verify-literal note (documented, not silently satisfied — same pattern as 32-14's
`valleyFound: false` finding and 32-15's `.test.mjs` baseline):** 32-16-PLAN.md's own acceptance
criterion asks for a zero count of the pending-status marker-plus-word combination across this
file. It is not zero: the Per-Task table's own legend caption (present since Wave 0, unchanged by
any gap-closure plan) spells out all four status markers including the pending one, so counting
that exact combination returns 1 even in a fully-closed file — confirmed identical at the phase's
ORIGINAL 2026-09-20 close (`60e3ef6a`, pre-reopen), before any row was ever pending. The
substantive criterion — no per-task row's own Status cell still reading pending — holds; the
plan's literal count does not account for the legend caption sharing that combination.

**Shipped constants and valleyFound, re-confirmed unchanged:**
`grep -E "UNRELIABLE_SPEED_LIMIT_MPS = 7.35|UNRELIABLE_EXCESS_FLOOR_M = 3;|HIDDEN_PAUSE_MIN_METRES = 116.95" src/analytics/unreliable-segments.ts | wc -l`
→ `3`. `grep -c "NO clean valley found" 32-CALIBRATION.md` → `1` (the semantic equivalent of
`valleyFound: false` — see the 32-14 row's carried-forward note on why the literal string can never
appear in this artifact's rendered prose; `valleyFound` is still false).

**Carry-forward items from the six sibling gap-closure plans, reflected honestly, not silently
ticked away:**

1. **32-14's Task 3 verify-literal mismatch** — `grep -c "valleyFound: false"` can never match this
   artifact (it is only ever rendered as prose: "NO clean valley found — anchor-interval midpoint
   fallback"). Not re-litigated as a plan defect; the semantic check above stands in for it, as it
   did in 32-14-SUMMARY.md.
2. **32-15's D-05/D-09 discriminator correction** — the plan's originally proposed single check
   (`vMax < UNRELIABLE_SPEED_LIMIT_MPS`) is false for 2 of 3 real fixtures (`7409028052` vMax=8.70
   m/s, the D-09 pair vMax=8.80 m/s — both protected by the 3.0 m excess floor instead, not the
   speed limit; only `3647739864` is speed-protected). This correction is shipped in the test file
   as-is; not reverted or re-litigated here.
3. **32-15's CR-03 environment limitation — CLOSED in this plan.** 32-15's bare worktree had no
   `export_data/`, so its "real activity, normal finding shape" demonstration used a dummy
   `.fit.gz` and only proved the code path reaches segment detection before skipping at FIT decode.
   This primary checkout DOES have `export_data/strava/`; re-ran
   `buildActivityFinding('3475724402', 'data/streams', 'data/activities', csvMap, 'export_data/strava')`
   directly against the real `activities/3711971403.fit.gz` original: `skipped: null`,
   `fitSampleCount: 3655`, 16 segments returned, all `gap-adjacent`, matching the recount table
   row-for-row. The full "normal finding shape" 32-15 could not reach is now demonstrated; also
   re-confirmed the missing-stream direction still returns a skipped finding rather than throwing
   (`{"id":"0000000000","skipped":"no Filename in activities.csv"}`).
4. **32-15's `grep -c "\.test\.mjs"` baseline mismatch** — the plan's stated expectation of `0` does
   not match `scripts/validate-unreliable-segments-1hz.mjs`'s actual pre-existing baseline of `3`
   (unchanged docblock prose about D-12, confirmed via `git show HEAD~7:...` still `3` on this
   checkout). Not a defect introduced by any gap-closure plan; documented, not silently ticked past.

**Approval:** the phase's closing gate passes on the post-gap-closure tree at `080ea7da`. All three
verifier-scored blockers (GAP 1, GAP 2, GAP 3) are re-reproduced closed directly against the
compiled `dist/` module and the committed test suite, not trusted from a SUMMARY's narration. No
calibrated constant moved; `valleyFound` is still false. This file is re-closed
(`status: complete`, `closed: 2026-09-20`, `reopened: 2026-09-20` retained). **The phase itself is
NOT re-closed by this paragraph** — that is `/gsd-verify-work`'s call, which has not yet re-run
against this tree.

---

## Re-Approval 2026-09-20 (plan 32-17, round-2 CR-01/WR-01 closure)

`32-REVIEW.md`'s round-2 (gap-closure re-review) found one Critical the gap-closure round
introduced into itself (CR-01: 32-13's own gap-boundary widening fix double-counts distance across
two adjacent gap spans sharing a duplicated boundary timestamp) plus one residual Warning (WR-01:
`buildActivityFinding` still throws on a null/malformed `activityDoc.start_date`, the same class of
defect CR-03 fixed for the sibling stream read three lines above). This plan closes both.

**Task 1 — CR-01 fail-closed, watched RED then GREEN:**

Pre-fix, the reviewer's exact input (`t=[0,1,5,5,10,11]`, `d=[0,20,25,45,50,140]`,
`gaps=[{startSec:1,endSec:5},{startSec:5,endSec:10}]`,
`params={speedLimitMps:7.35,excessFloorMetres:3,hiddenPauseMinMetres:1e9}`) reproduced directly
against `dist/analytics/unreliable-segments.js` returns:
```
seg0 startIndex 0 endIndex 3 metres 45 seconds 5
seg1 startIndex 2 endIndex 5 metres 115 seconds 6   (overlaps seg0 at [2,3])
sum 160 m  vs  actual d[5]-d[0] = 140 m  ->  20 m double-counted
```
The permanent regression fixture pinning this input was watched RED before any source change:
`1 failed | 93 passed (94)` whole-file, `1 failed | 6 passed (7 matched)` for
`-t "boundary convention"`.

`detectUnreliableSegments` now sorts the mapped gap blocks by `startIndex` and fails closed (a
fresh `[]`) if any two overlap — the reviewer's own suggested shape, checked ACROSS gap blocks
rather than within one, matching the module's existing fail-closed discipline for a malformed gap
span. Chose fail-closed over merging: merging two overlapping gap blocks still requires deciding
which duplicate-timestamp sample "owns" the shared interval's own metres/seconds — the same
ambiguity that produces divergent answers in the first place — so a fresh `[]` is the lower-risk
default that can never emit a conservation-violating result.

Post-fix: `dist/analytics/unreliable-segments.js` reproduction returns `[]` —
`CR-01-CLOSED-FAILS-CLOSED-OK`. Whole-file `94 passed (94)`; `-t "round-2 CR-01"` `1 matched, 1
passed`; `-t "boundary convention"` `7 matched, 7 passed` (up from 32-13's 6 — the new fixture
lives in the same describe block, so coverage grew, not shifted); `-t "mechanism"` unchanged at
`12 matched, 12 passed`. `npx tsc --noEmit` exits 0.

**Task 2 — cross-segment conservation, shown able to fail:**

The existing "conservation holds for every segment produced by the adjacency fixtures" sweep grew
from 4 to 6 fixtures (added the "not swallowed" two-SEPARATE-segments case and the CR-01 overlap
fixture itself) and gained a cross-segment assertion per fixture: no segment's `startIndex` may
precede the previous segment's `endIndex`, and the segments' combined `metres` may never exceed an
INDEPENDENTLY-DERIVED total (the stream's own `d[last]-d[first]`) — retained alongside, not instead
of, the existing within-segment check, with a comment noting the within-segment check alone is
insufficient (both of CR-01's overlapping segments individually satisfied it).

Proved the new assertion can fail: temporarily disabled the Task 1 guard's `return []` (restored
immediately after; `git diff` on the source file confirmed clean before re-committing), re-ran the
sweep —
```
AssertionError: expected 2 to be greater than or equal to 3
```
(the CR-01 fixture's `segments[1].startIndex=2 < segments[0].endIndex=3`, exactly the overlap
CR-01 describes). Restored the guard and re-ran GREEN: whole-file `94 passed (94)`.

**Task 3 — WR-01 closed, both directions demonstrated:**

Pre-fix (guard temporarily reverted, then restored — `git diff` confirmed clean before
re-committing), a direct CLI probe against `buildActivityFinding` with a `null` activity doc:
```
THREW: Cannot read properties of null (reading 'start_date')
```
Post-fix, the same probe:
```
RESULT {"id":"9999999901","skipped":"activity doc missing, not an object, or start_date not a string"}
```
A non-string `start_date` (`12345`) on an otherwise real activity doc produces the same graceful
skip. `3475724402` (real `export_data/strava/` on this checkout) still produces its full normal
finding, unchanged:
```
NEVER-THROWS-OK {"id":"3475724402","skipped":null,"fitSampleCount":3655,"segmentCount":16,"mechanisms":["gap-adjacent"]}
```

**Task 4 — closing gate re-run on the post-CR-01/WR-01 tree:**

- `npm run build` (tsc) — exit 0; `npx tsc --noEmit` — exit 0
- `npm test` — `91 files passed (91)`, `2848 tests passed (2848)` (up from 32-16's 91/2,847 by
  exactly +1 — this plan's own new CR-01 regression fixture; the cross-segment assertion and the
  WR-01 fix added no new `it` blocks)
- `node scripts/compute-unreliable-segment-calibration.mjs` run TWICE — both runs byte-identical to
  each other and to the pre-plan artifact; sha256
  `f8f6d5db0df01f8735b664d2712f6c87dc2516c8263439b5a9dd3132365b027e` unchanged; `git diff
  --exit-code` on `32-CALIBRATION.md` clean after each run
- Three shipped constants unchanged:
  `grep -E "UNRELIABLE_SPEED_LIMIT_MPS = 7.35|UNRELIABLE_EXCESS_FLOOR_M = 3;|HIDDEN_PAUSE_MIN_METRES = 116.95" src/analytics/unreliable-segments.ts | wc -l`
  → `3`
- `node scripts/compute-unreliable-segment-recount.mjs` — exit 0, PASS, all 16 rows agree with
  `32-CALIBRATION.md`'s detector table
- `npm run compute-stream-checksums` — printed `added 0`; `git status --porcelain data/streams` —
  empty
- Archive scan re-run over all 1,874 committed streams through the live
  `classifyGaps(t,d).gapIntervals` -> `detectUnreliableSegments` path: `scanned: 1874`,
  `withAdjacentSharedBoundary: 383`, `atDuplicateTimestamp: 0`, `overlappingSegmentActivities: 0`,
  `totalSegments: 1344` — identical shape to the orchestrator's pre-plan measurement (383/0/0);
  `totalSegments` is unchanged from before this plan because a byte-identical calibration artifact
  and matching recount already prove no committed stream's segment set moved (the fix can only
  ever change output for a gap-block-overlap case, and 0 committed streams hit that case)

**Carry-forward items from 32-16, reflected honestly, not silently ticked away (unchanged by this
plan — neither is this plan's to close):**

1. **32-14's Task 3 verify-literal mismatch** — `grep -c "valleyFound: false"` can never match
   `32-CALIBRATION.md` (only ever rendered as prose: "NO clean valley found — anchor-interval
   midpoint fallback"). Re-confirmed still `1` via `grep -c "NO clean valley found"
   32-CALIBRATION.md`.
2. **32-16's own `grep -c "⬜ pending"` literal** — cannot print `0` because the Per-Task table's
   own status legend caption spells out the pending marker+word combination as part of describing
   all four possible statuses. Confirmed still a structural property of the legend, not a
   regression; no per-task row's own Status cell reads `⬜ pending`.

**Approval:** the phase's closing gate passes on the post-CR-01/WR-01 tree. CR-01 (the round-2
Critical) and WR-01 (the round-2 residual Warning) are both closed, each with a watched-failing
pre-fix observation and a passing post-fix observation quoted above. No calibrated constant moved;
the calibration artifact regenerates byte-identically twice; the archive scan is unchanged. This
file's per-task rows for 32-17 are ✅ green. **The phase itself is NOT re-closed by this
paragraph** — that is `/gsd-verify-work`'s call. The ROADMAP.md Phase 32 checkbox remains
unticked, per this plan's explicit scope boundary.
