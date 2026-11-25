---
phase: 37
slug: review-queue-priority-cur-04
status: verified
threats_open: 0
asvs_level: 1
created: 2026-11-25
---

# Phase 37 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| generated best-efforts.json to browser parse | Stale or hand-edited shard can carry any value in `contaminatedMetres` | numeric metres |
| browser tab to curate server (127.0.0.1:4173) | Any page can attempt a request; DNS rebinding can present a foreign Host | reviewed reason/fingerprint (private review text) |
| request body to committed file | Untrusted JSON persisted into data/curation/reviewed.json | reason, fingerprint |
| working tree to published bundle (dist/widgets) | Anything copied there is public | review text must never cross |
| reviewed.json / best-efforts.json to DOM | File-supplied strings rendered | reason, fingerprint |
| verifier to code under verification | Self-certifying recount risk | derived queue order |
| checkpoint evidence to served bytes | Stale build / stale browser cache | digests |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-37-01 | Tampering | parseActivityBestEfforts | mitigate | src/dashboard/data/best-efforts-client.ts:170-175 (typeof number, isFinite, >= 0, else 0). best-efforts-client.test.ts:67-95 covers NaN, Infinity, negative, string, null, absent via it.each, expected 0 | closed |
| T-37-02 | Tampering | computeActivityEfforts Map | mitigate | src/analytics/compute-best-efforts.ts:420 Map, :491 and :539 keyed `${startIndex}:${endIndex}`, :576 sums map values. compute-best-efforts.test.ts:3277-3320 F1 asserts 40 and not 80, F2 asserts 65; expected values hand-derived, independent windows asserted first | closed |
| T-37-03 | Repudiation | BEST_EFFORTS_SCHEMA_VERSION | accept | `export const BEST_EFFORTS_SCHEMA_VERSION = 1` unchanged (src/analytics/best-effort.types.ts:16); additive-field comments at :274 and :352. Logged in Accepted Risks as AR-37-01 | closed |
| T-37-04 | Spoofing/Tampering | PUT/DELETE reviewed | mitigate | scripts/curate-server.mjs:700-706 resolveWriteTarget calls isTrustedOrigin(req, EXPECTED_HOST) first (403); isTrustedOrigin at :602-611 checks Host and Origin. Handler :794 uses it. curate-server.test.mjs:1006-1022 tests cross-origin and mismatched-Host PUT 403 and nothing written; :1077 DELETE 403 | closed |
| T-37-05 | Information disclosure | GET /__curate/reviewed | mitigate | curate-server.mjs:1011-1019 isTrustedOrigin gate returning 403. Test curate-server.test.mjs:928-941 (cross-origin and mismatched Host 403) | closed |
| T-37-06 | Tampering | id decoding | mitigate | curate-server.mjs:626-628 isValidCurateActivityId (regex, `__proto__` rejected); :712-724 400 on bad decode or id. Write target is the constant paths.reviewedPath (:495-496), never derived from id. Tests: :425-426 unit, :991-993 route-level `..%2Fx`, `__proto__`, `abc`, `%` 400 | closed |
| T-37-07 | Tampering | normalizeFingerprint / normalizeReason | mitigate | curate-server.mjs:461-464 charset regex `^[A-Za-z0-9:,\|=-]{1,2000}$`; :638-643 trim, non-empty, cap MAX_REASON_CHARS (=2000, :88); handler :806-817 returns 400. Note: fingerprint cap is 2000, not the 1000 in the plan text (raised to fit the longest derived fingerprint, 1555 chars per the code comment); a cap and charset are present, so the mitigation holds. Rendering is textContent-only (T-37-25). Test :985-987 400 on bad body | closed |
| T-37-08 | Denial of service | readJsonBody | mitigate | curate-server.mjs:87 MAX_BODY_BYTES = 10 KiB; :662-668 destroy and 413. Test curate-server.test.mjs:997 (413 or reset, nothing written) | closed |
| T-37-09 | Tampering | readReviewedFile | mitigate | curate-server.mjs:475-483 throws on invalid JSON or non-array `reviewed`; PUT :832-835, DELETE :844-848, GET :1021-1026 catch and return 500 before any write. Tests :1047 (PUT corrupt, bytes unchanged), :1101 (DELETE corrupt, nothing written), :922 (GET 500), :795. WR-04 (null entry blocks writes) fails closed, no overwrite; not a gap | closed |
| T-37-10 | Tampering | both write handlers, exclusion-cli | mitigate | Reviewed PUT refuses when excluded: curate-server.mjs:820-826 (409). Exclusion PUT refuses when reviewed: :744-752 (409). CLI refuses: scripts/exclusion-cli.mjs:116-131 (fail on reviewed id; fail closed on corrupt file). Tests: curate-server.test.mjs:1032, :1041, :1091, exclusion-cli.test.mjs:184-216, committed-files disjointness :1155-1161 | closed |
| T-37-11 | Information disclosure | persistReviewed | mitigate | curate-server.mjs:494-497 only mkdirSync + writeAtomic to paths.reviewedPath, no mirror call. Tests: curate-server.test.mjs:1125-1135 (function body excludes mirrorExclusions and dist), :1116-1122 (publishRoot empty after PUT and DELETE) | closed |
| T-37-12 | Tampering | curate-server.test.mjs | mitigate | Injected tmp paths via resolveServerPaths (curate-server.test.mjs:95-114 default pin and override tests; real-socket suite at :812-905). SHA-256 guard over EXCLUSIONS_PATH and REVIEWED_PATH: beforeAll/afterAll at file scope (lines 78-87, outside every describe), so afterAll runs after every write suite. WR-01 fix confirmed: the hooks observe the writes. data/curation/reviewed.json and exclusions file are clean in git now (`git diff --exit-code` exit 0) | closed |
| T-37-13 | Information disclosure | findCurationArtifacts | mitigate | scripts/lib/curation-guard.mjs:124-127 anchored `data/curation` directory rule; :172-175 file named `reviewed.json` at any depth. Tests lib/curation-guard.test.mjs:439-480 cases (a)-(f) with exact-path assertions and a clean control. IN-03 (case-sensitive exact name) is outside the stated mitigation; noted, not opened | closed |
| T-37-14 | Information disclosure | verify-dashboard-publish.mjs | mitigate | scripts/verify-dashboard-publish.mjs:483-485 three literal expect404 calls (`/__curate/reviewed`, `/__curate/reviewed/3475726256`, `/data/curation/reviewed.json`). verify-dashboard-publish-guard.test.mjs Cases H, I, J (:168-210) plant the leak and assert non-zero exit naming the path; Case A :71-88 asserts the three 404 lines | closed |
| T-37-15 | Tampering | expect404 list | mitigate | Literal paths only; grep for an `expect404(baseUrl, '/data/'` prefix returns no match. Clean control: curation-guard.test.mjs:469-473 (exclusions and best-efforts json return []); guard test Case A :86-87 asserts the public exclusions file still parses | closed |
| T-37-16 | Denial of service | guard tests | mitigate | verify-dashboard-publish-guard.test.mjs:57-63 cleanup helpers (data/curation only, never dist/widgets/data), :66-69 afterEach, finally blocks in each case, :213-218 post-suite absence assertion (also asserts exclusions file still exists) | closed |
| T-37-17 | Tampering | buildReviewedMap, buildTransportedMap, activities loop | mitigate | scripts/curate-queue/derive-flagged.mjs:186 Map storage, :194 `__proto__` skipped and counted, :297 and :300 activities loop filters `__proto__`. Tests derive-flagged.test.mjs:770-795, :606-640 | closed |
| T-37-18 | Repudiation | buildReviewedMap | mitigate | derive-flagged.mjs:188-212 skipped entries counted (skippedCount) and never set in the map, so never mark a row reviewed; countMalformedReviewed at :225. Tests derive-flagged.test.mjs:598-603, :606-640 (planted eight-class doc counts exactly 8, with a clean control 0). Queue surfaces the count (curate-queue/index.ts:520-525). WR-04 null-entry write block fails closed; not a gap | closed |
| T-37-19 | Tampering | contaminatedMetres read | mitigate | derive-flagged.mjs:353-361 finite non-negative check else 0 plus metresMissing; surfaced by curate-queue/index.ts:526-532 note and counts.metresMissing (derive-flagged.mjs:510). Test derive-flagged.test.mjs:336-349 (undefined, NaN, -5, '120', null, Infinity). WR-05 (wording and bottom placement) is outside the stated mitigation; noted | closed |
| T-37-20 | Elevation | reviewConflict | mitigate | derive-flagged.mjs:400-401 reviewConflict = excluded && review present; excluded wins. Test derive-flagged.test.mjs:534-542 (appears only under Excluded, never Reviewed or To review). Visible note: curate-queue/index.ts:534-540. IN-03/IN-04 (cannot un-review conflicts from UI) is outside the stated mitigation | closed |
| T-37-21 | Repudiation | compute-review-queue-recount.mjs | mitigate | scripts/compute-review-queue-recount.mjs:36-38 imports exactly fs, path, url. Test compute-review-queue-recount.test.mjs:337-375 (comment-stripped scan, planted fixture flagged, real source specifiers equal fs/path/url, no require or dynamic import). Metres re-measured from streams (:127 onward, test :270, :289) | closed |
| T-37-22 | Repudiation | diffQueueOrder | mitigate | compute-review-queue-recount.mjs:253-280 compares count, missing/extra ids, tier, metres, position. Test :179-245 mutations (a)-(d) each assert a non-empty diff, with clean-diff control (f); expected rows are hand-derived (:132-141, :164-176) | closed |
| T-37-23 | Tampering | recountReviewQueue / main | mitigate | compute-review-queue-recount.mjs:159-226 failures for missing shard, truncated lists, index/shard transported disagreement, shipped metres mismatch; :296-330 readJson collects missing inputs; :348-364 main sets exitCode 1 on missing inputs or failures. Tests :247-290 | closed |
| T-37-24 | Repudiation | import-time I/O test | mitigate | scripts/unreliable-segment-import-guards.test.mjs:74-75 vi.mock('fs') and vi.mock('node:fs') wrapper (:64 covers `default`), named and default positive controls (:87, :98), review-queue recount imported at :164-167; the file contains no vi.spyOn call | closed |
| T-37-25 | Tampering | curate-queue/index.ts rendering | mitigate | grep finds no innerHTML, insertAdjacentHTML, outerHTML or document.write in scripts/curate-queue/*; scripts/curate-queue.test.mjs:226-239 forbids all four tokens in source. Page CSP script-src 'self' unchanged (curate-server.mjs:292) | closed |
| T-37-26 | Elevation | curate-queue/index.ts | mitigate | No /__curate literal in the queue source: curate-queue.test.mjs:60-61, :87-88, :222-223; writes only via imported saveReviewed/removeReviewed (index.ts:40-45, :304, :340) | closed |
| T-37-27 | Repudiation | loadReviewedDoc null path | mitigate | scripts/curate-overlay/index.ts:125-135 returns null on non-ok or throw; curate-queue/index.ts:490, :496-500 passes `reviewedDoc ?? undefined` (all rows not reviewed) and :543-548 appends a visible `data-queue-reviewed-unavailable-note`. Stated mitigation (null path) holds as written. WR-02/WR-03 (failed best-efforts/index fetches) are outside it; noted. No dedicated test asserts the note string (code evidence only) | closed |
| T-37-28 | Tampering | fingerprint contract | mitigate | curate-queue.test.mjs:175-207 contract test: derived fingerprints (synthetic and over real derive rows) pass normalizeFingerprint imported from the server; server re-validates every PUT (curate-server.mjs:812) | closed |
| T-37-29 | Repudiation | Un-review control | mitigate | curate-queue/index.ts:297 window.confirm precedes the only removeReviewed call (:304); test curate-queue.test.mjs:114-124 asserts confirm index < call index in the function slice and exactly one call site | closed |
| T-37-30 | Repudiation | served build | mitigate | 37-VALIDATION.md Checkpoint Evidence item 4: three equal digests (working tree = dist = served) for best-efforts.json, dashboard/index.json, best-effort-exclusions.json plus served assets digest | closed |
| T-37-31 | Repudiation | order verdict | mitigate | 37-VALIDATION.md Checkpoint Verdicts step 1: DOM extractions (565/553 rows, sha1 recorded) diffed against the recount CLI list, mismatch list empty | closed |
| T-37-32 | Repudiation | both publish guards | mitigate | 37-VALIDATION.md evidence item 6: planted leaks on the real tree gave exit 1 for guard 1 and guard 2 naming the paths, then both exit 0 after removal | closed |
| T-37-33 | Tampering | tracked/dist state | mitigate | 37-VALIDATION.md: clean start `git diff --exit-code` exit 0, step 7 and item 6 post-restore exit 0, planted paths absent; independently re-verified by this audit: `git diff --exit-code` on both tracked files exits 0 and `git status` is clean | closed |
| T-37-34 | Tampering | curl 409 probes | mitigate | 37-VALIDATION.md step 4: both probes returned 409 with both files unchanged; no 200 occurred so no matching DELETE was needed | closed |
| T-37-35 | Elevation | REQUIREMENTS/ROADMAP/STATE | mitigate | CUR-04 and CUR-06 ticked in REQUIREMENTS.md (:118-119, :179-180) only after every row PASS (37-07-SUMMARY, 37-VALIDATION requirement disposition). 37-07-SUMMARY deviation 5: ROADMAP/STATE were updated on orchestrator instruction with the phase left In Progress, not ticked before verification | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-37-01 | T-37-03 | The new `contaminatedMetres` field is additive; BEST_EFFORTS_SCHEMA_VERSION stays 1 per precedent (Phase 26 D-14 / Phase 36 D-05). Consumers that predate the field degrade fail-closed to 0 (T-37-01). Constant verified unchanged at src/analytics/best-effort.types.ts:16 | plan 37-01 (planner), verified by security audit | 2026-11-25 |

---

## Unregistered Flags

None. Every plan SUMMARY `## Threat Flags` section reports none new.

## Noted, Not Opened (deferred review findings outside stated mitigations)

- WR-02/WR-03: failed best-efforts or index fetches produce a silent partial queue; T-37-27 covers only the reviewed-doc null path.
- WR-04: a null entry in reviewed.json makes every write 500 (fails closed, no overwrite).
- WR-05: missing-metres wording and placement.
- IN-03: Guard 1 path rules are case-sensitive and exact-name.
- IN-04: reviewConflict rows cannot be un-reviewed from the UI.
- T-37-07: fingerprint cap implemented as 2000 chars, not 1000 as the plan text says.
- T-37-27: no test asserts the unavailable-note text.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-25 | 35 | 35 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-25
