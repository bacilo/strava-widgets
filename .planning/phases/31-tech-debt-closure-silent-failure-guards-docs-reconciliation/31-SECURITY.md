---
phase: 31
slug: tech-debt-closure-silent-failure-guards-docs-reconciliation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-19
---

# Phase 31 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| owner-editable `data/best-effort-exclusions.json` → test suite / recount / queue | Hand-maintained JSON parsed by `compute-best-efforts.test.ts`, `compute-pr-ceiling-recount.mjs`, and `derive-flagged.mjs`'s `buildExclusionsMap` (ASVS V5) | curation intent, not code |
| local working tree → `dist/widgets/data/` → published site | `copyJsonTree`'s digest comparison is the only gate before bytes ship | build artifacts |
| `data/stats/best-efforts.json` shard → `records-logic.ts` → Records screen | A shard written by a future/foreign guard value reaching a user-facing total | demotion counts |
| `ceilingDemotion`'s reason string → `best-efforts.json` → Records note / badge / queue prefill / `28-DIFF.md` | One string crosses into every human-facing explanation of a demotion | reason prose |
| `data/streams/` directory listing → generator denominator → committed artifact → requirement prose | A miscount at the listing step propagates into a figure a human later cites | file counts |
| generator prose → committed artifact of record → human judgment at sign-off | A hard-coded claim in generated prose is indistinguishable from a measured one | derived figures |
| local archive (`data/`) → generator → committed artifact → human sign-off; local commit → origin/master → nightly CI | A wrong/stale input becomes a signed claim; a commit body can suppress the nightly deploy | archive data, commit metadata |
| measured value → hand-written prose in a document of record; one phase's validation record → milestone archive | A number typed by hand is indistinguishable from a measured one without provenance | prose figures, validation status |
| regenerated `28-DIFF.md` → developer's judgment → signed record; developer's words → `28-VALIDATION.md` → `REQUIREMENTS.md` tick state | Human evidence entering the record and driving a requirement's disposition | sign-off verdicts |
| local curate server → browser | Local-only surface, already origin-gated by `curate-server.mjs` (CUR-02, unmodified) | queue HTML |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-31-01 | Tampering | `copyJsonTree` mtime skip letting a doctored `dist/widgets/data/*.json` survive `build-widgets` | mitigate | `scripts/lib/copy-data-tree.mjs:41-64` — size-then-SHA-1-digest comparison replaces the mtime skip | closed |
| T-31-02 (plan 03, recount) | Tampering | malformed/prototype-polluting exclusion entries reaching the recount unreported | mitigate | `scripts/compute-pr-ceiling-recount.mjs:290-312` — CR-01-fixed fail-closed check (`entry is not an object`, non-string id, `__proto__` literal, duplicate id, missing/empty reason), all pushed to `malformedExclusions`; `Map`/`Set` keyed storage throughout | closed |
| T-31-02 (plan 04, queue) | Tampering | malformed/`__proto__`-keyed entries silently dropped by the queue with no signal | mitigate | `scripts/curate-queue/derive-flagged.mjs:101` `countMalformedExclusions`; rendered at `scripts/curate-queue/index.ts:311-316` (`"${malformedCount} exclusion entries ignored (malformed)"`); parity test in `derive-flagged.test.mjs` asserts `countMalformedExclusions(doc) === recountDemotedActivities(...).malformedExclusions.length` (added by CR-01/WR-02 fix, commit `75ae1ff1`/`fa38f913`) | closed |
| T-31-03 | Tampering | `best-effort-exclusions.fixture.json` becoming a silent second source of truth | mitigate | `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` (byte copy, 2 entries); `compute-best-efforts.test.ts:995-1040` — real-file premise test + "mutating a fixture copy" test (passing, verified live: `npx vitest run` 281/281) | closed |
| T-31-04 | Repudiation | self-contradictory demotion reason ("4.63 exceeds 4.63") | mitigate | `src/analytics/best-effort-ceiling.ts:215-223` — explicit 3-dp margin, `<0.001` sub-resolution guard (WR-01 fix, commit `33763113`); thin-margin test at `best-effort-ceiling.test.ts:206` using the live `3475730418@1mi` figures | closed |
| T-31-05 (plan 06, residual) | Repudiation | wrong-at-source generator denominator reverting any hand-corrected prose | mitigate | `scripts/lib/stream-files.mjs` single-owner `isStreamFile`/`idFromFilename`; `compute-pace-residual.mjs:33` imports it (no local redefinition); unit test at seam + live `find`-based cross-check recorded in `31-06-SUMMARY.md` | closed |
| T-31-05 (plan 07, diff) | Repudiation | generated artifact asserting a finding the data no longer supports (hard-coded "400m") | mitigate | `scripts/compute-pr-ceiling-calibration.mjs:386` `largestAbsoluteDrift(reconciliation)` computed from `report.reconciliation` at render time; `compute-pr-ceiling-calibration.test.mjs` 34/34 passing (verified live) | closed |
| T-31-05 (plan 08, five artifacts) | Repudiation | hand-corrected generated artifact reverting on next run | mitigate | `31-08-SUMMARY.md` — five idempotence proofs (`**Generated:**` line stripped, byte-identical second run); nothing hand-edited, fixes live in the generator scripts | closed |
| T-31-06 | Repudiation | stale figure standing in a document of record as if measured | mitigate | `31-09-SUMMARY.md` — 5 figures re-measured this session from `data/dashboard/index.json`/`26-RESIDUAL.md`; dated provenance notes in `REQUIREMENTS.md:94,107` and `ROADMAP.md`; old strings survive only inside dated notes | closed |
| T-31-07 | Repudiation | sign-off bound to bytes other than the ones reviewed | mitigate | `28-VALIDATION.md:1246-1254` — Round 3 revision recovered via `git show ad59daeb:...`, hash-verified (`cdf9d654…`) against the recorded Round 3 hash before diffing; new hash `97e1782c…` computed from committed bytes and independently confirmed live via `shasum -a 256 28-DIFF.md` (see Audit Trail) | closed |
| T-31-08 | Denial of Service | nightly deploy gate red on unexplained numeric mismatch after a curation edit | mitigate | D-01: zero arithmetic dependency on the live exclusions file (fixture-backed instead); one remaining live read is a premise check (`compute-best-efforts.test.ts:968-980`), not an arithmetic comparison | closed |
| T-31-09 | Repudiation | premise assertion present but unactionable | mitigate | `compute-best-efforts.test.ts:993-1000` — message test pins 4 required substrings (`4556693525`, `data/best-effort-exclusions.json`, `best-effort-exclusions.fixture.json`, `compute-best-efforts.test.ts`) | closed |
| T-31-10 | Repudiation | silent replacement leaving no record for a later checkpoint | mitigate | `scripts/lib/copy-data-tree.mjs:58` — `console.log('replaced stale ${destPath}')` emitted only in the same-size/different-digest branch | closed |
| T-31-11 | Denial of Service | digest pass making rebuilds unacceptably slow | accept | Measured: 7,580 files/186MB, SHA-1 ~1.4s vs unconditional copy ~1.7s; size-first short-circuit keeps common case at stat cost (documented in `copy-data-tree.mjs:41-49` comment and `31-02-SUMMARY.md`) | closed |
| T-31-12 | Information Disclosure | Records total larger than sum of named parts, remainder unexplained | mitigate | `src/dashboard/views/records-logic.ts:165` — `other: number` is a required (non-optional) field of `DemotionCounts`, counted at line 221 default branch, rendered last at line 248 | closed |
| T-31-13 | Tampering | recount importing the classifier it checks, making its verdict circular | mitigate | `grep -nE "^import" scripts/compute-pr-ceiling-recount.mjs` → only `fs`, `path`, `url` (verified live, no import of `best-effort-ceiling.ts` or `compute-best-efforts.ts`) | closed |
| T-31-14 | Denial of Service | new fail-closed check turning the real archive red for a well-formed file | mitigate | `node scripts/compute-pr-ceiling-recount.mjs` run live against the real archive → `PASS: recount agrees with the shipped totals; no disagreements found.`, exit 0 | closed |
| T-31-15 | Tampering | `deriveFlaggedActivities` return-shape change silently altering queue population | mitigate | `git diff 5c1cc364..HEAD -- scripts/curate-queue/derive-flagged.mjs` shows no change to the `export function deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc)` signature line (verified live) | closed |
| T-31-16 | Information Disclosure | malformed count rendered as adjective rather than measured value | mitigate | `scripts/curate-queue/index.ts:315` — `"${malformedCount} exclusion entries ignored (malformed)"`, named condition plus number, no adjective | closed |
| T-31-17 | Tampering | queue's local-only dev surface leaking into the published build | accept | `scripts/build-widgets.mjs:12,211-227` — `findCurationArtifacts()` (`scripts/lib/curation-guard.mjs`) scan unchanged and still wired into the build (verified live) | closed |
| T-31-18 | Tampering | format change silently invalidating a downstream assertion/consumer | mitigate | `31-05-SUMMARY.md` — every assertion site enumerated and updated; full suite green (verified live: 281/281 across the affected test files) | closed |
| T-31-19 | Repudiation | stale worked example in house-register docblock outliving the format | mitigate | `src/analytics/best-effort-ceiling.ts:186` — docblock references the live `3475730418@1mi` case | closed |
| T-31-20 | Tampering | two copies of `isStreamFile` drifting apart | mitigate | Single owner `scripts/lib/stream-files.mjs:39`; `compute-pace-quality-calibration.mjs:48` and `compute-pace-residual.mjs:33` both import it, zero local redefinitions in either (verified live grep) | closed |
| T-31-21 | Tampering | new import edge dragging `execSync`/`REGENERATE_COMMAND` module-scope machinery into the residual generator | mitigate | `scripts/lib/stream-files.mjs` contains only imports-free function/constant declarations, no top-level side effects (verified by full-file read) | closed |
| T-31-22 | Repudiation | regenerated `26-RESIDUAL.md` committed out of dependency order | mitigate | `31-06-SUMMARY.md:72,122` — reverted with `git checkout --`; confirmed live: `git status --porcelain .../26-RESIDUAL.md` empty | closed |
| T-31-23 | Information Disclosure | table column silently meaning something narrower than its label | mitigate | `scripts/compute-pr-ceiling-calibration.mjs:300-312` — WR-08's scoped label, owner-excluded count rendered beside it, reconciliation sentence naming the check command | closed |
| T-31-24 | Tampering | reconciliation double-counting/overlapping so the sum is coincidentally right | mitigate | `scripts/compute-pr-ceiling-calibration.mjs:351-390` — reconciliation helper measured directly off `bestEffortsDoc` against the same population `buildFilteredPopulations` derives, not asserted; render test covers the mismatch branch | closed |
| T-31-25 | Tampering | prose fix quietly moving a threshold | mitigate | `applyCeiling` (`compute-pr-ceiling-calibration.mjs:270`) untouched; `compute-pr-ceiling-calibration.test.mjs` 34/34 green (verified live) | closed |
| T-31-26 | Tampering | regeneration performed out of dependency order | mitigate | `31-08-SUMMARY.md` — six-step ordering followed, residual generator run last for its own file; `28-DIFF.md` contains the 3-dp margin clause (verified: `2a0a9c45` diff shows the measured reconciliation sentence) | closed |
| T-31-27 | Repudiation | sign-off bound to a hash not matching committed bytes | mitigate | `28-VALIDATION.md:1251` records `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5`; live `shasum -a 256 28-DIFF.md` → identical hash (verified) | closed |
| T-31-28 | Tampering | incidental `data/` churn committed as if a deliverable | mitigate | `git log --stat 5c1cc364..HEAD -- data/` → no output (no incidental `data/` commits in-scope; verified live) | closed |
| T-31-29 | Denial of Service | commit body containing CI-skip token suppressing nightly deploy | mitigate | `git log --format=%B 5c1cc364..HEAD \| grep -ci "skip ci"` → `0` (verified live) | closed |
| T-31-30 | Repudiation | correction copied from the audit's own older measurement, propagating its error | mitigate | `31-09-SUMMARY.md:113,196` — figures re-derived live this session (device-family census over `data/dashboard/index.json`), not copied from research/audit | closed |
| T-31-31 | Repudiation | flipping `27-VALIDATION.md` to passed before its gating gap closed | mitigate | `27-VALIDATION.md` header shows `status: passed`; G-02 closure text present (§ G-02, dated 2026-09-19) precedes the flip, gated per D-14 (verified live) | closed |
| T-31-32 | Tampering | scope creep into another phase's validation record or this phase's own success criteria | mitigate | `31-09-SUMMARY.md:180` — `git diff 27-VALIDATION.md` scope confirmed limited to frontmatter status line, header note, § G-02, retroactive-audit sentence; no ROADMAP § Phase 31 or tick-state change in that task | closed |
| T-31-33 | Repudiation | verdict fabrication or blanket approval expanded into invented per-row detail | mitigate | `28-VALIDATION.md:1449` — verdict transcribed verbatim: `"Approve — R4-1/R4-2 PASS, R4-3 PASS via 4556693525@1k"`; per-row PASS lines attribute back to the same blanket quote, no invented detail | closed |
| T-31-34 | Tampering | vacuous or unsatisfiable checkpoint row | mitigate | `28-VALIDATION.md:1430-1445` — Reachability Audit with CAN PASS/CAN FAIL pairs for R4-1..R4-3, both directions non-vacuous; the declined "NOT EXERCISABLE" alternative is recorded, not substituted | closed |
| T-31-35 | Repudiation | premature or unevidenced requirement tick | mitigate | `REQUIREMENTS.md:107` — TD-05 ticked 2026-09-19 citing the Round 4 blanket approval (three PASSes) after verification; TD-06 ticked separately in plan 31-09 after G-02 closure (line 108) | closed |
| T-31-36 | Tampering | number presented to the developer that the document produced about itself | mitigate | `28-VALIDATION.md:1219` — three-way figure (diff ceiling-only 32 = recount `byGuard.ceiling` 32 = `independentCeilingCount` 32) derived via `compute-pr-ceiling-recount.mjs`, which imports nothing it checks (T-31-13); Round 3 baseline recovered from git history (`ad59daeb`), not from the new file | closed |
| T-31-SC | Tampering | npm/pip/cargo installs across all ten plans | accept | `git diff 5c1cc364..HEAD -- package.json package-lock.json` → empty (0 lines, verified live); every plan declares "installs nothing" | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-31-01 | T-31-11 | Full-tree SHA-1 digest pass adds ~0.3s to `build-widgets` (measured 1.4s vs 1.7s unconditional copy on the 186MB/7,580-file primary checkout); accepted because the size-first short-circuit keeps the unchanged common case at stat cost, and the alternative (mtime-only skip) is the tampering vector T-31-01 closes | Phase 31 plan 02 | 2026-09-19 |
| AR-31-02 | T-31-17 | The `npm run curate` local-only dev surface remains unchanged from Phase 24/29's origin-gated `curate-server.mjs` (CUR-02); TD-03c's queue change stays inside that existing surface and does not widen it | Phase 31 plan 04 | 2026-09-19 |
| AR-31-03 | T-31-SC | This phase adds zero npm/pip/cargo packages across all ten plans; confirmed empty `package.json`/`package-lock.json` diff against the phase's pre-execution commit `5c1cc364` | Phase 31 (all plans) | 2026-09-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 40 (36 unique IDs; T-31-02 and T-31-05 verified separately at each of their occurrences; T-31-SC verified once for all 10 plans) | 40 | 0 | gsd-security-auditor |

**Live verification commands run this session (not just documentation review):**
- `npx vitest run` on all 8 directly-affected test files → 281/281 passing
- `node scripts/compute-pr-ceiling-recount.mjs` against the real archive → `PASS`, exit 0
- `npx vitest run scripts/compute-pr-ceiling-calibration.test.mjs` → 34/34 passing
- `shasum -a 256 .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` → `97e1782c953288d8676e5a8e79f48696e0b3d4c6f4da32f314a4989f089f57d5` (matches `28-VALIDATION.md`'s recorded hash)
- `git log --format=%B 5c1cc364..HEAD | grep -ci "skip ci"` → `0`
- `git log --stat 5c1cc364..HEAD -- data/` → empty
- `git diff 5c1cc364..HEAD -- package.json package-lock.json` → empty
- `grep -nE "^import" scripts/compute-pr-ceiling-recount.mjs` → `fs`, `path`, `url` only
- `git diff 5c1cc364..HEAD -- scripts/curate-queue/derive-flagged.mjs` — confirmed `deriveFlaggedActivities`'s signature line unchanged
- `git status --porcelain` — clean tree, no stray reverted-artifact residue
- Confirmed all four `31-REVIEW.md` findings (CR-01 `75ae1ff1`, WR-01 `33763113`, WR-02 `fa38f913`, WR-03 `2a0a9c45`) are present in `git log` and ordered before HEAD (`13091a87`)

### Threat Flags cross-check (SUMMARY.md `## Threat Flags`)

Only plans 05 and 08 include a `## Threat Flags` section; plans 01, 02, 03, 04, 06, 07, 09, 10 have no such section. Both present sections read "None" and map their own plan's threats to the register (T-31-04/T-31-18/T-31-19 in plan 05; T-31-05/T-31-26/T-31-27/T-31-28/T-31-29 in plan 08) with no new attack surface flagged. No unregistered flags found.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
