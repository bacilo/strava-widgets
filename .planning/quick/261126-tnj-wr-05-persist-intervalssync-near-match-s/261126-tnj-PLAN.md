---
phase: quick-261126-tnj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/strava.types.ts
  - src/storage/sync-state.ts
  - src/storage/sync-state.test.ts
  - src/sync/intervals-sync.ts
  - src/sync/intervals-sync.test.ts
  - src/sync/activity-sync.ts
  - .planning/phases/37.1-address-tech-debt-near-match-dedupe-in-intervalssync/37.1-REVIEW-FIX.md
autonomous: true
requirements: [quick-261126-tnj, 37.1-WR-05]

must_haves:
  truths:
    - "A near-match skip found by IntervalsSync is written to data/sync-state.json under near_match_skips, keyed by intervalsId, as {existingId, deltaS, startDate, firstSeen}"
    - "A skip recorded earlier in a run is still on disk after a later activity in the same run triggers the per-activity save (no clobber)"
    - "A run whose only event is a near skip (nothing written) still persists the skip, and leaves last_sync_timestamp, last_activity_id and total_activities unchanged"
    - "Re-seeing the same skip keeps the original firstSeen; a second identical run leaves sync-state.json byte-identical"
    - "An existing sync-state.json without near_match_skips loads and syncs fine; SyncStateManager.updateAfterSync and ActivitySync's save carry an existing near_match_skips map through unchanged"
    - "The new clobber test was shown to FAIL against the pre-fix save code, and a post-fix mutation (dropping near_match_skips from the per-activity save) makes it fail again"
    - "37.1-REVIEW-FIX.md shows WR-05 fully fixed with its commit hash and frontmatter status: all_fixed with no trailing partial comment"
  artifacts:
    - path: "src/types/strava.types.ts"
      provides: "NearMatchSkipRecord interface and optional SyncState.near_match_skips"
      contains: "near_match_skips?"
    - path: "src/sync/intervals-sync.ts"
      provides: "Durable, idempotent near-skip recording carried through every save"
      contains: "near_match_skips"
    - path: "src/storage/sync-state.ts"
      provides: "updateAfterSync preserves near_match_skips"
      contains: "near_match_skips"
    - path: "src/storage/sync-state.test.ts"
      provides: "Legacy-load and updateAfterSync carry-through rows (temp dir)"
    - path: "src/sync/intervals-sync.test.ts"
      provides: "Real-SyncStateManager durability rows: clobber, skip-only, idempotence, legacy file"
  key_links:
    - from: "src/sync/intervals-sync.ts"
      to: "SyncStateManager.save"
      via: "per-activity save and end-of-loop save both include near_match_skips"
      pattern: "near_match_skips"
    - from: "src/storage/sync-state.ts"
      to: "SyncState.near_match_skips"
      via: "updateAfterSync newState carries currentState.near_match_skips"
      pattern: "currentState\\.near_match_skips"
---

<objective>
Close 37.1 review finding WR-05 completely: persist IntervalsSync near-match skips durably in data/sync-state.json as an optional `near_match_skips` map, idempotently, and make sure no SyncStateManager.save() caller can clobber it.

Purpose: today a near-skip lives only in stdout and the CI log. Once the watermark moves more than a day past the skipped start, nothing in data/ records it, so a skipped delivery that was really a separate run cannot be audited or recovered.

Output: type change, IntervalsSync persistence, carry-through in SyncStateManager.updateAfterSync and ActivitySync, failing-first tests, corrected docstring, and an updated 37.1-REVIEW-FIX.md.

Design choice (already made by the developer): this is a field in sync-state.json, not a separate ledger file. data/sync-state.json is already committed nightly (`.github/workflows/daily-refresh.yml:139` git add pathspec, `:310` file_pattern) and already checked by `scripts/lib/workflow-gates.mjs:127`. So no CI workflow, gate or seed-file changes are needed, and none may be made.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/37.1-address-tech-debt-near-match-dedupe-in-intervalssync/37.1-REVIEW.md
@.planning/phases/37.1-address-tech-debt-near-match-dedupe-in-intervalssync/37.1-REVIEW-FIX.md
@src/sync/intervals-sync.ts
@src/sync/intervals-sync.test.ts
@src/storage/sync-state.ts

The planner checked who else consumes sync-state.json:
- `src/index.ts` statusCommand (~line 108) reads only the four existing fields. An extra key is harmless.
- `src/sync/activity-sync.ts:84` (legacy Strava sync) calls `syncStateManager.save({...})` with a literal 4-field object. That is a THIRD save site that would clobber the map, so it is in scope. It has no test file.
- `scripts/build-widgets.mjs:162` deliberately does not publish sync-state.json, so there is no PII or publish-contract impact.
- `scripts/lib/workflow-gates.mjs:127` and `daily-refresh.yml:139/:310` match on the path only. They do not validate the schema.
- No JSON schema validates sync-state.json anywhere. `src/exports/fit-import.test.ts:538` uses its own fake manager and is unaffected.

<interfaces>
From src/types/strava.types.ts (current):
  export interface SyncState {
    last_sync_timestamp: number; // Unix epoch seconds
    last_activity_id: number | string;
    total_activities: number;
    last_sync_date: string; // ISO 8601
  }

From src/sync/intervals-sync.ts:
  export interface NearMatchSkip { intervalsId: string; existingId: string; deltaS: number; startDate: string; }
  export interface IntervalsSyncResult { newRuns; totalFetched; skipped; nearMatches: NearMatchSkip[] }
  - line 113: const state = await this.syncStateManager.load();
  - lines 160-171: near branch pushes into nearMatches, logs, continues
  - lines 225-230: per-activity save of the literal 4-field object (the clobber site)
  - line 240: saveManifest once after the loop

From src/storage/sync-state.ts:
  class SyncStateManager(statePath: string, fileStore: FileStore)
    load(): Promise<SyncState>   // default 4-field object when file missing; else readJson
    save(state: SyncState): Promise<void>   // writeJson, which is JSON.stringify(data, null, 2) via tmp file + rename
    updateAfterSync(activities): Promise<SyncState>   // builds a literal 4-field newState (second clobber site)

From src/sync/intervals-sync.test.ts:
  makeFakeClient(payload, activities) -> { client, getStreamsCalls, state }
  makeFakeSyncStateManager() -> { manager, saveCalls }   // in-memory fake; load() returns zero state
  describe 'near-match dedupe (ING-05)': E = '2026-08-01T06:00:00Z'; helpers seed(id, startDate, extra), at(offsetS), delivery(id, startDate), build(activities), nearLogLines()
  Existing row 'skips and reports a delivery 60 s from a hand-seeded FIT-imported record, writing nothing' asserts expect(saveCalls).toHaveLength(0). The new behaviour invalidates that assertion (see Task 1).
  Raw activities are processed in reverse array order (oldest first), so pass fixtures newest-first.

Independent literals for assertions (computed by the planner, not by the code under test):
  epoch(2026-08-01T06:00:00Z) = 1785564000; epoch(2026-08-01T07:00:00Z) = 1785567600
  at(60) = '2026-08-01T06:01:00Z'; at(3600) = '2026-08-01T07:00:00Z'
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED: failing-first durability tests, recorded failing against the current save code</name>
  <files>src/sync/intervals-sync.test.ts, src/storage/sync-state.test.ts</files>
  <behavior>
    New describe in intervals-sync.test.ts: 'IntervalsSync near-match skips persist in sync-state (WR-05)'. It uses a REAL SyncStateManager('sync-state.json', fileStore) over a mkdtemp FileStore, and reads the result back with JSON.parse(fs.readFileSync(path.join(tmpDir,'sync-state.json'),'utf-8')). Pin the clock with vi.useFakeTimers({ toFake: ['Date'] }) and vi.setSystemTime(new Date('2026-11-26T12:00:00.000Z')). Restore with vi.useRealTimers() and vi.restoreAllMocks() in afterEach. Seed FIT record '25000000001' at E with source_provider 'garmin-export' in each row that needs it.
    - Row A (clobber, required failing-first): deliveries newest-first [delivery('i2003', at(3600)), delivery('i2001', at(60))], so i2001 is skipped first and then i2003 is written. Assert res.newRuns === 1. On disk, near_match_skips must toEqual { i2001: { existingId: '25000000001', deltaS: 60, startDate: '2026-08-01T06:01:00Z', firstSeen: '2026-11-26T12:00:00.000Z' } }, last_sync_timestamp === 1785567600 and last_activity_id === 'i2003'.
    - Row B (skip-only run): pre-write tmpDir/sync-state.json with the legacy 4 fields only, { last_sync_timestamp: 1785560000, last_activity_id: 'i1999', total_activities: 7, last_sync_date: '2026-08-01T05:00:00.000Z' } (the 1-day overlap still fetches the fake's activities). Deliveries are [delivery('i2001', at(60))]. Assert res.newRuns === 0, no activities/i2001.json, and the file now toEqual exactly those four legacy values plus the near_match_skips map from Row A. Watermark, id, count and last_sync_date must be unchanged.
    - Row C (idempotence across two runs): run the Row-B-style skip-only sync twice with two separate IntervalsSync instances over the same tmpDir. Between runs, move the clock with vi.setSystemTime(new Date('2026-11-27T12:00:00.000Z')). Assert that firstSeen is still '2026-11-26T12:00:00.000Z' after run 2, and that the raw file bytes after run 2 equal the bytes after run 1 (Buffer equality).
    - Row D (pre-existing entry keeps firstSeen): pre-write a sync-state.json that already holds near_match_skips.i2001 with firstSeen '2026-01-01T00:00:00.000Z', and the same deliveries as Row A. After the run, that entry's firstSeen is still '2026-01-01T00:00:00.000Z' and i2003 was written. Together with Row A this covers both the idempotent re-see and the no-clobber path.
    - Row E (legacy file loads fine): pre-write the legacy 4-field file and a plain non-near delivery [delivery('i2002', at(7200))] with no FIT seed. Assert res.newRuns === 1, no throw, and that the saved file has no near_match_skips key (expect(Object.keys(onDisk)).not.toContain('near_match_skips')). This keeps the nightly file's shape unchanged on nights with no skips.
    New file src/storage/sync-state.test.ts uses a temp dir FileStore and a real SyncStateManager:
    - Legacy load: a file with only the 4 fields loads to exactly those 4 values, and near_match_skips is undefined.
    - updateAfterSync carry-through: pre-write state with near_match_skips { i9: { existingId: '25000000009', deltaS: -30, startDate: '2026-08-02T06:00:00Z', firstSeen: '2026-08-02T07:00:00.000Z' } }. Call updateAfterSync with one minimal activity { id: 42, start_date: '2026-08-03T06:00:00Z' } cast as never. The file on disk still holds that exact map literal, and last_activity_id === '42'.
  </behavior>
  <action>
    Write the rows above exactly. Every expected value must be a literal written in the test (the project rule is that tests assert against independent values, not values derived from the code under test). Use fs.mkdtempSync(path.join(os.tmpdir(), ...)) for every file. No test may write to a tracked path (data/ in particular). Use the default-import `fs`/`fsp` style already in the file, and never spy on fs.

    Also update the existing ING-05 row 'skips and reports a delivery 60 s from a hand-seeded FIT-imported record, writing nothing'. The new behaviour makes its `expect(saveCalls).toHaveLength(0)` wrong, because the skip is now persisted. Replace it with expect(saveCalls).toHaveLength(1), and assert that saveCalls[0] toMatchObject { last_sync_timestamp: 0, last_activity_id: '', total_activities: 0, near_match_skips: { i2001: { existingId: '25000000001', deltaS: 60, startDate: at(60) } } }. Leave its manifest-bytes and no-activity-file assertions untouched: the manifest must still be unchanged. Note this assertion change explicitly in the SUMMARY so nobody reads it as softening a guard.

    Run the suite against the CURRENT, unmodified source and record the result in the SUMMARY: the failed/passed counts per file and the specific failure message of Row A. Row A, B, C, D, the carry-through row and the updated ING-05 row must fail. Row E and the legacy-load row are expected to pass already. Note that in the SUMMARY and do not count them as RED evidence. If Row A passes here, stop: the test is vacuous. Fix it before continuing. Commit the failing tests as test(quick-261126-tnj): ... (do not put the skip-ci token anywhere in the commit message).
  </action>
  <verify>
    <automated>npx vitest run src/sync/intervals-sync.test.ts src/storage/sync-state.test.ts 2>&amp;1 | tail -30   # expected NON-zero exit at this step; record "N failed | M passed" per file in SUMMARY</automated>
  </verify>
  <done>The new rows exist. Row A and the other durability rows are shown failing against the pre-fix code, with the counts and Row A's failure message recorded. The failing-test commit exists. No tracked file was written by the tests (git status shows only the two test files changed before the commit).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN: persist near_match_skips and carry it through every save, then mutation-check</name>
  <files>src/types/strava.types.ts, src/sync/intervals-sync.ts, src/storage/sync-state.ts, src/sync/activity-sync.ts</files>
  <behavior>
    - All Task 1 rows pass. Every other row in both files still passes.
    - Mutation 1: remove near_match_skips from the per-activity save in intervals-sync.ts. Row A and Row D must fail.
    - Mutation 2: drop the carry-through in updateAfterSync. The carry-through row must fail.
    - Mutation 3: always overwrite firstSeen with new Date().toISOString(). Rows C and D must fail.
  </behavior>
  <action>
    In src/types/strava.types.ts, add an exported interface NearMatchSkipRecord { existingId: string; deltaS: number; startDate: string; firstSeen: string } with a one-line comment: ids, date, signed delta and first-seen ISO time only, no health or location fields. Add `near_match_skips?: Record<string, NearMatchSkipRecord>` to SyncState, with a comment that the key is the intervals.icu activity id, that IntervalsSync writes it, and that it is optional so legacy files load.

    In src/sync/intervals-sync.ts, in syncNewActivities:
    - Copy `state.near_match_skips ?? {}` into a local map at the start, plus a `skipsDirty` flag.
    - In the near branch, after the existing nearMatches push, add the map entry ONLY if the intervalsId key is absent, with firstSeen = new Date().toISOString(). Set skipsDirty only when an entry was added. Re-seeing a key changes nothing, which is the idempotence rule.
    - Keep a `lastSaved` SyncState variable, initialised to the loaded state.
    - In the per-activity save, build the state object, add near_match_skips only when the map is non-empty (conditional spread, so a skip-free night keeps today's 4-key file shape, which Row E checks), save it, assign it to lastSaved, and clear skipsDirty.
    - After the loop, next to saveManifest: if skipsDirty, save { ...lastSaved, near_match_skips: map }. This persists a skip that came after the last written activity, and a skip-only run. In the skip-only case the watermark fields stay exactly as loaded.
    - Leave nearMatches, the console line and IntervalsSyncResult unchanged. index.ts needs no change.
    - Rewrite the tail of the class docstring (currently "A skip is reported only in the returned nearMatches and the console log; nothing is written to data/ ... so the CI log is the only trace.") to say the following:
      - Each skip is also recorded durably in sync-state.json near_match_skips, keyed by intervalsId, with {existingId, deltaS, startDate, firstSeen}.
      - Recording is idempotent: a skip already present keeps its original firstSeen, and a run that adds nothing new does not rewrite the file for it.
      - Every save carries the map, so writing a later activity never drops it.
      - Console/nearMatches reporting still only re-reports while the watermark is within a day of the skipped start.

    In src/storage/sync-state.ts updateAfterSync, add `...(currentState.near_match_skips ? { near_match_skips: currentState.near_match_skips } : {})` to newState. Add a sentence to the class doc: any save must carry near_match_skips through.

    In src/sync/activity-sync.ts (line ~84, the legacy Strava per-page save), add the same conditional spread from `state.near_match_skips`. This is the third save site the planner found. Without it, a Strava sync run would clobber the map.

    Do not change SyncStateManager.save or load semantics, the workflow, workflow-gates.mjs, or data/sync-state.json.

    Then run the three mutations in the behavior block one at a time. Record for each: the edit, the matched failing rows, and the failed/passed counts. Restore after each one and confirm with git diff that the source is back. Finally run npx tsc --noEmit and the full npm test on the primary checkout. Record the totals. If failures appear that are only ENOENT on gitignored data/stats or dist, rebuild per the project memory before calling them regressions. Commit as fix(quick-261126-tnj): WR-05 persist near-match skips in sync-state. Record the hash for Task 3.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npx vitest run src/sync/intervals-sync.test.ts src/storage/sync-state.test.ts &amp;&amp; npm test</automated>
  </verify>
  <done>tsc is clean. Both test files pass, with the counts recorded. The full suite is green. All three mutations were shown failing the named rows, then restored. All three save sites carry near_match_skips. The docstring is corrected. The fix commit hash is recorded.</done>
</task>

<task type="auto">
  <name>Task 3: Mark WR-05 fully fixed in 37.1-REVIEW-FIX.md</name>
  <files>.planning/phases/37.1-address-tech-debt-near-match-dedupe-in-intervalssync/37.1-REVIEW-FIX.md</files>
  <action>
    Frontmatter: change the line `status: partial  # all 5 committed, but WR-05 only partly fixed (durable ledger deferred)` to exactly `status: all_fixed`, with no trailing comment.

    In the Summary bullets, remove the "WR-05 is only partly fixed, see below" clause from the Fixed line.

    In the WR-05 section, make these changes:
    - Set **Files modified** to the Task 2 source files plus the two test files.
    - Set **Commit** to `2f2e4660 (docstring), <Task 2 hash> (durable record)`. Use the real 8-character short hash from Task 2 (git rev-parse --short=8).
    - Set **Status** to `fixed`.
    - Replace "Not done, and why" with an **Applied fix (follow-up quick-261126-tnj)** paragraph. It should say that skips are persisted in data/sync-state.json `near_match_skips`, keyed by intervalsId, as {existingId, deltaS, startDate, firstSeen}, and that recording is idempotent. It should name the three save sites that carry the map. It should explain why the field was chosen over a ledger file: sync-state.json is already in both daily-refresh.yml pathspecs (:139, :310) and in workflow-gates.mjs:127, so no CI, gate or seed-file change was needed.
    - Add a **Mutation checks** list with the RED result from Task 1 and the three mutations from Task 2, with their counts.

    Keep the rest of the file unchanged. Commit as docs(quick-261126-tnj): mark 37.1 WR-05 fully fixed.
  </action>
  <verify>
    <automated>F=.planning/phases/37.1-address-tech-debt-near-match-dedupe-in-intervalssync/37.1-REVIEW-FIX.md; grep -qx 'status: all_fixed' "$F" &amp;&amp; ! grep -q 'partly fixed\|only partly\|status: partial' "$F" &amp;&amp; grep -q 'near_match_skips' "$F" &amp;&amp; git cat-file -e "$(grep -o '[0-9a-f]\{8\} (durable record)' "$F" | cut -d' ' -f1)^{commit}" &amp;&amp; echo OK</automated>
  </verify>
  <done>Frontmatter reads exactly `status: all_fixed`. WR-05 is marked fixed and cites a commit hash that resolves in git. No "partly fixed" wording remains. The docs commit exists.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| intervals.icu API -> data/sync-state.json | Activity ids and start dates from the API are now stored in a committed file |
| data/sync-state.json -> public site | Not crossed: build-widgets.mjs does not publish sync-state.json (T-18-PII-03) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-tnj-01 | Information disclosure | near_match_skips record | mitigate | Record holds only ids, ISO start date, signed delta and firstSeen (NearMatchSkipRecord type). No HR, location or name fields. The file is not published (build-widgets.mjs:162). |
| T-tnj-02 | Tampering | concurrent nightly writers clobbering the map | mitigate | All three SyncStateManager.save callers carry near_match_skips, and the clobber/carry-through rows plus mutations 1-2 prove it |
| T-tnj-03 | Denial of service | unbounded map growth | accept | Near skips are rare (FIT-import overlaps only); one small entry per skip. Pruning is out of scope |
| T-tnj-04 | Tampering | CI workflow/gate edits | mitigate | Plan forbids touching daily-refresh.yml and workflow-gates.mjs; the path is already committed and gated |
</threat_model>

<verification>
- npx tsc --noEmit clean
- Both target test files pass. Matched test counts are recorded, and no `-t` filter is used, so no vacuous filter is possible.
- Full npm test is green on the primary checkout.
- The RED failure from Task 1 and the three mutation failures from Task 2 are recorded in the SUMMARY.
- git status is clean after the commits. data/sync-state.json is not modified by this plan.
</verification>

<success_criteria>
- Near skips survive on disk across a later same-run write, a skip-only run, repeated runs (firstSeen stable, bytes identical) and legacy files.
- No save path drops near_match_skips.
- 37.1-REVIEW-FIX.md reports all_fixed, and WR-05 cites a resolving commit hash.
</success_criteria>

<output>
Create `.planning/quick/261126-tnj-wr-05-persist-intervalssync-near-match-s/261126-tnj-SUMMARY.md` when done
</output>
