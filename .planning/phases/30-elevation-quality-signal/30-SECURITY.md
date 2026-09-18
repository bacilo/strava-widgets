---
phase: 30
slug: elevation-quality-signal
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-18
---

# Phase 30 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: authored at plan time — all 8 PLAN files carry a `<threat_model>` block. No SUMMARY carries a `## Threat Flags` section. Audit run 2026-09-18 by gsd-security-auditor in verify-mitigations mode (no new-threat scan); every grep, test run and recount cited below was executed live against the tree at `ec36e134`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `data/activities/{id}.json` → `closureDriftSignal` / `qualityMetadata` | Externally-derived `start_latlng`/`end_latlng` (Strava / intervals.icu) reaches arithmetic and the compute step | position pairs, possibly `[]`/short/non-finite |
| `data/streams/{id}.json` → the three detectors and the sweep | Committed `alt` series, carry-forward filled, of unvalidated length and finiteness; the full archive read by scripts that must not write to it | altitude series |
| `ActivityQualitySignals` contract → every reader | A required key is a tree-wide compile-time contract change | typed signal object |
| live `data/` archive → pinned fixture table | A stale pinned value silently certifies a detector against a number no longer true | pinned expected properties |
| shipped `index.json` / shard → browser client parse → DOM | Possibly stale or malformed published artifacts reach the SPA and are rendered as text on four surfaces | published numbers, tier strings |
| built publish directory → publish gate → local server → browser | Last automated point before a partial rollout ships; only place the assembled page is exercised as shipped | six quality sub-keys per row |
| sweep script → `30-CALIBRATION.md` → ROADMAP/REQUIREMENTS | A measurement becomes a requirement figure | counts, thresholds |
| shipped `index.json` → independent recount | The verifier's only input; reading anything else loses independence | per-row elevation evidence |
| developer's observation → `30-VALIDATION.md` | Human evidence enters the record and drives requirement ticks | verdicts |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-30-01 | Denial of Service | `closureDriftSignal` on malformed position | mitigate | `pace-quality.ts:282-283, 314-345` — `Array.isArray && length === 2 && Number.isFinite` guards before arithmetic; totality tests `pace-quality.test.ts:775-820` (80/80 pass) | closed |
| T-30-02 | Denial of Service | `subGroundSignal` / `verticalRateSignal` on malformed `alt` | mitigate | `pace-quality.ts:282-283, 422-426` — absent/short/non-array/non-finite input returns a null-valued not-computable result, never throws, never coerces to 0 | closed |
| T-30-03 | Tampering | silent widening of `hasAnySevereSignal`'s `Pick<>` | mitigate | `pace-quality.ts:1212-1213` — `Pick<…, 'decimation' \| 'gapProfile' \| 'impossibleSamples'>`, `elevation` absent; guard test `pace-quality.test.ts:840`; reversal demonstrated failing in 30-01-SUMMARY | closed |
| T-30-04 | Tampering | second haversine with a different Earth radius | mitigate | `EARTH_RADIUS_M = 6371000` identical at `pace-quality.ts:241` and `src/streams/derive-stream.ts:30` | closed |
| T-30-05 | Tampering | writing to committed stream data from the detectors | mitigate | `grep "from 'fs'" src/analytics/pace-quality.ts` → no match; `git log -- src/streams/derive-stream.ts` shows no Phase 30 commit | closed |
| T-30-06 | Repudiation | stale pinned expected value | mitigate | `pace-fixtures.test.ts:198-288` `assertExpectedProperties` re-verifies every pinned key against the live stream; `default:` throws at `:284-285` | closed |
| T-30-07 | Tampering | 3149636661 misused as a single-mode fixture | mitigate | `pace-fixtures.ts:510-517` — `expected` carries both `worstRateMps` and `driftDeltaM`; `why` states the dual-mode restriction | closed |
| T-30-08 | Tampering | writing under `data/` while re-deriving | mitigate | 30-02-SUMMARY records `git status --porcelain data/` empty before/after; re-derivation ran from a disposable script | closed |
| T-30-09 | Denial of Service | client parse of a stale row with no `elevation` key | mitigate | `pace-quality-client.ts:177` `parseElevationSignal` returns `null` → not-computable fallback at `:249`; absent-key test present | closed |
| T-30-10 | Tampering | a `'minor'` tier surviving the client parse | mitigate | `pace-quality-client.ts:59` `VALID_ELEVATION_TIERS = new Set(['severe','none','not-computable'])`; rejection test present | closed |
| T-30-11 | Information Disclosure | partial rollout shipping rows without the signal | mitigate | `verify-dashboard-publish.mjs:23` `QUALITY_SUB_KEYS` six members incl. `elevation`; enforced on row check `:312` and shard-sample check `:801`; single-row deletion demo exits 1 (30-03-SUMMARY) | closed |
| T-30-12 | Tampering | elevation leaking into the published `anySevere` totals | mitigate | `node scripts/compute-pace-quality-recount.mjs --expect 299` → PASS, run live during audit | closed |
| T-30-13 | Tampering | writing to `data/streams/` during regeneration | mitigate | `git status --porcelain data/streams/` empty (live); no `writeFileSync` under `data/` in `compute-dashboard-index.ts` | closed |
| T-30-14 | Tampering | the sweep mutating `data/streams/` | mitigate | `compute-elevation-calibration.mjs:294-320` `checkDigestGate` sha256 aggregate before/after; `:874-878` `process.exit(1)` on mismatch before any write; source-scan test asserts no `fs` write under `data/` | closed |
| T-30-15 | Repudiation | a report that cannot be regenerated at its own values | mitigate | 30-04-SUMMARY § Idempotence — two consecutive runs byte-identical modulo timestamp; every figure script-computed | closed |
| T-30-16 | Tampering | report figures disagreeing with the shipped detector | mitigate | `compute-elevation-calibration.mjs:38-44` imports the four thresholds and `LOOP_RADIUS_M` from `dist/analytics/pace-quality.js`, never retyped; WR-01 fix `50ebbfd7` made the exclusion-count sentence live (`:563-565`) | closed |
| T-30-17 | Denial of Service | malformed activity/stream file aborting the sweep | mitigate | six per-file `try/catch` warn-and-continue sites (`:273, 281, 664, 672, 682, 691`); report states skipped-file counts | closed |
| T-30-18 | Repudiation | a premature requirement tick | mitigate | ROADMAP:318 / REQUIREMENTS:72 carry loop-gated figures; checkboxes stayed unticked at 30-04 commit time, ticked only in 30-08 after verification | closed |
| T-30-19 | Denial of Service | `elevation` destructured off an absent quality object | mitigate | `list.ts:439, 489` `elevation !== undefined` guard; `detail.ts:706` optional chaining; `detail-sections.ts:1372-1410` `NOT_COMPUTABLE_ELEVATION` fallback — all three sites closed by CR-01 fix `437adf63` after 30-REVIEW found them unguarded; reverified present | closed |
| T-30-20 | Tampering | a numberless or adjective-only badge | mitigate | `list.ts:532` `if (clauses.length === 0) return null;` in `elevationBadgeContent`; all-null guard test in `list.test.ts` | closed |
| T-30-21 | Tampering | badge text drifting between row and stat card | mitigate | `list.ts` exports `elevationBadgeContent`; `detail.ts:55, 701-710` imports and reuses it | closed |
| T-30-22 | Tampering | scope creep into a filter or URL parameter | mitigate | `git diff --name-only 58becd3e~1..HEAD -- src/dashboard/views/list-logic.ts` → empty | closed |
| T-30-23 | Tampering | untrusted text reaching the DOM as markup (list/detail) | mitigate | `grep -c innerHTML list.ts detail.ts` → 0/0; `appendAccessibleBadge` (`list.ts:239-257`) writes `textContent` only | closed |
| T-30-24 | Repudiation | silence read as good news | mitigate | `detail-sections.ts:1105-1134, 1160-1198, 1218-1261` — every branch of the three rows returns a populated `valueText`; healthy-case test asserts no blank/`undefined`/`null`/`NaN` | closed |
| T-30-25 | Tampering | four drift states collapsing into one phrasing | mitigate | `closureDriftRow` four distinct branches/strings; collapse mutation demonstrated failing (30-06-SUMMARY) | closed |
| T-30-26 | Tampering | a fabricated zero on a stream-less activity | mitigate | `detail-sections.ts:1121, 1244` "…data unavailable" strings; `detail-sections.test.ts:936` asserts no `0 m` / `0 m/s` | closed |
| T-30-27 | Denial of Service | shard fetch failure taking down the section | mitigate | `evidenceText` null on null shard (`:1197`), `shard?.elevationVerticalRateSamples ?? []` (`:1247`); `valueText` unaffected; tested | closed |
| T-30-28 | Tampering | untrusted text reaching the DOM as markup (detail-sections) | mitigate | `grep -c innerHTML src/dashboard/views/detail-sections.ts` → 0 | closed |
| T-30-29 | Repudiation | a verifier that imports the classifier | mitigate | `grep -c "pace-quality" scripts/compute-elevation-recount.mjs` → 0; `package.json:28` script has no `npm run build` prefix; source-scan test | closed |
| T-30-30 | Tampering | elevation joining the composite via the recount's key lists | mitigate | own `ELEVATION_MODE_KEYS`, never references `anySevere` (source-scan tests); `compute-pace-quality-recount.mjs` byte-unchanged since Phase 27, `grep -c elevation` → 0 | closed |
| T-30-31 | Denial of Service | malformed or missing index aborting the recount | mitigate | `compute-elevation-recount.mjs:73, 79` `{ ok: false, reason }` on read/parse failure; tested for missing file, malformed JSON, malformed rows | closed |
| T-30-32 | Tampering | writing under `data/` from the new script | mitigate | imports only `readFileSync` from `fs`; source-scan test; `git status --porcelain data/` clean (live) | closed |
| T-30-33 | Repudiation | a reconciliation delta waved away | mitigate | 30-07-SUMMARY three-way reconciliation — all deltas 0 across calibration / recount / index | closed |
| T-30-34 | Tampering | stale served bundle | mitigate | 30-VALIDATION Task 1 — served asset digest `0d126085…61431f` matched local build via `curl`+`shasum`; served `index.json` row count / composite / elevation-present cross-checked | closed |
| T-30-35 | Repudiation | verdict fabrication | mitigate | 30-VALIDATION Round 1 provenance note records verdicts as agent-performed with developer sign-off, not as developer observation | closed |
| T-30-36 | Tampering | a vacuous or unsatisfiable discriminator | mitigate | 30-VALIDATION § Reachability Audit — R1–R8 each carry CAN PASS and CAN FAIL; none struck | closed |
| T-30-37 | Tampering | a row substituting a convenient activity | mitigate | 30-VALIDATION Task 1 — elevation-only cohort measured as 22 via live index query; R7 exercised, not substituted | closed |
| T-30-38 | Repudiation | a redrafted row blessing a defect | mitigate | 30-VALIDATION — Overview-surface contradiction investigated and disclosed before R2 was drafted | closed |
| T-30-39 | Repudiation | a premature requirement tick (checkpoint) | mitigate | 30-VALIDATION § Requirement → Row Map — ticks applied after transcription; REQUIREMENTS:164-165 cite checkpoint provenance | closed |
| T-30-SC | Tampering | npm/pip/cargo installs (recurs in all 8 plans) | accept | `git diff 58becd3e~1..HEAD -- package.json package-lock.json` shows only two new `scripts` entries; no dependency or lockfile change | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Audit notes (not register gaps)

- **CR-01 (fixed `437adf63`):** at code-review time T-30-19's guard did not cover all three `quality.elevation` read sites despite the plan text claiming so. Closed before this audit; reverified above.
- **CR-02 (fixed `de954dd6`):** `compute-elevation-recount.mjs` collected `missingElevationIds` but never failed on a non-empty list, so a total drop of the sixth signal PASSed the D-15 recount. Not the literal text of any T-30-xx line item (T-30-11 names only `verify-dashboard-publish.mjs`). Now `compute-elevation-recount.mjs:283-286` pushes to `problems`, asserted by `compute-elevation-recount.test.mjs:163`. Recommend a dedicated threat ID for recount fail-closed behaviour in the next phase that touches the recount scripts.
- **WR-02 / WR-03 (open by product decision, 30-REVIEW Fix Record):** a double-negative badge string and a "position unknown" wording for stream-less activities. Neither is a threat-model gap (T-30-25 requires the four states be distinguishable, not correctly attributed), noted because both are user-facing statements about data provenance.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-30-01 | T-30-SC | Phase installs no packages; digest uses Node built-in `crypto`. 30-RESEARCH Package Legitimacy Audit records no dependency for this phase; `package.json`/lockfile diff confined to two `scripts` entries. | plan author (all 8 plans), confirmed by audit | 2026-09-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 40 | 40 | 0 | gsd-security-auditor (sonnet) via /gsd-secure-phase 30 |

Live evidence gathered during the audit: `pace-quality.test.ts` 80/80; `detail-sections.test.ts` 136/136; `list.test.ts` + `pace-quality-client.test.ts` + `pace-fixtures.test.ts` + `compute-elevation-calibration.test.mjs` 208/208; `compute-elevation-recount.test.mjs` 23/23; `compute-pace-quality-recount.mjs --expect 299` PASS; `git status --porcelain data/` clean.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-18
