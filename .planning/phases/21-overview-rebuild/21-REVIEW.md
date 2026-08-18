---
phase: 21
depth: standard
status: clean
critical: 0
warning: 0
info: 2
reviewed: 2026-08-18T10:05:37Z
---

# Phase 21 (overview-rebuild) — Code Review

**Scope reviewed:** diff `35c084d5..HEAD` restricted to the fourteen files listed in the review
request (`streak-utils.ts`/`.test.ts`, `compute-advanced-stats.ts`, `analytics.types.ts`,
`list.ts`/`.test.ts`, `overview.ts`/`.test.ts`, `records.ts`, `records-logic.ts`/`.test.ts`,
`row-semantics.test.ts`, `styles.css`, `styles.test.ts`).

**Method:** read every hunk of the diff in the context of the surrounding file, cross-referenced
each change against the D-NN decisions in `21-CONTEXT.md` and the six areas of interest called out
in the review brief, ran `npx tsc --noEmit` and the full `npm test` suite (49 files / 1122 tests,
all green) as a floor, not a substitute for reading the code.

## Summary

This phase is unusually well-scoped and well-tested for the risk it carries (three simultaneously-
rendered row surfaces sharing one renderer, a two-layer streak-date bug, a pure year-filter/re-rank).
I traced each of the six flagged risk areas individually and found the implementation matches the
documented decisions with no gaps:

1. **Element-id collisions** — `rowIdPrefix(surface, rowId)` is the single construction site for
   both `renderActivityRow`'s row-level `aria-describedby` and `appendStatusBadges`'
   `lowConfidenceDescriptionId`, called with the *same* `idPrefix` value within one row build, so the
   two never diverge inside a single row. The two Overview call sites pass distinct `overview-prs`/
   `overview-activities` surfaces, so a `prCount > 0` activity appearing in both cards emits two
   distinct ids, not a duplicate. Confirmed byte-for-byte against `list.ts:154-196` and the four-way
   distinctness test in `list.test.ts`.
2. **`selectCurrentStreak` degradation** — `streak-utils.ts:127` sets `currentStreakEnd:
   lastActivityDate` unconditionally (mirroring the pre-existing `longestStreakEnd` precedent), and
   `records-logic.ts:328-335` reads `currentStreakEnd` (not `currentStreakStart`) through a
   `typeof x === 'string' && x.length > 0` guard. Verified all four cases by hand: absent key →
   `undefined` fails `typeof === 'string'` → `null`; `null` → same; empty string → length check fails
   → `null`; malformed non-string → same. `currentStreakEnd` is deliberately excluded from the
   required-field `hasOwn` gate, so a pre-phase `streaks.json` still renders the tile, only the
   sub-label degrades. `overview.ts`'s `currentStreakSublabel` (lines 143-151) implements the
   identical guard independently and is covered by its own degrade-path tests.
3. **`filterRankingsToYear` purity/re-ranking** — confirmed it never mutates the input (`{ ...entry,
   rank: i + 1 }` produces new objects), uses `getUTCFullYear()` (not local-time `getFullYear()`) via
   `parseStartDateToEpochMs`'s Z-suffix normalization, drops unparseable dates rather than throwing,
   and reassigns rank 1..N over the filtered subset in source order (never re-sorting). Test coverage
   includes an explicit 1 Jan / 31 Dec UTC-boundary case in both archive date spellings.
4. **`Promise.all` guarding in `mount()`** — `fetchStatsJson` (line 162) already try/catches
   internally and resolves to `null` on any fetch/parse failure, so the new `yearly-stats.json` call
   cannot cause the outer `Promise.all` to reject; a missing file degrades only
   `selectThisYearStats`'s two tiles to em-dash placeholders, not the whole Overview page. Verified
   this is unchanged from the pre-existing two-call pattern the new call was added alongside.
5. **CSS cascade** — `.activity-row`'s `flex-direction`/`flex-wrap` were edited in place at the base
   rule (styles.css:338), not overridden in the new Phase 21 block; the only new property the Phase 21
   block adds to `.activity-row` is `gap` (a value D-08 never named). Confirmed via `grep` that no
   other top-level `.activity-row` body still declares `flex-wrap: wrap`, and that the three D-08-
   frozen values (`background`, `border-radius: 8px`, `padding: var(--space-md)`, plus
   `.activity-list`'s `gap: var(--space-sm)`) are unchanged and covered by cascade-aware
   (`cascadeWinningBodyDeclaring`) assertions in `styles.test.ts`, appropriate given `.activity-row`
   and `.activity-row__name` are each now declared at more than one top-level site.
6. **XSS/output encoding** — no `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`eval` introduced
   anywhere in the diff. `renderActivityRow`'s new header/badges DOM continues to use `textContent`
   exclusively for `row.name` and every badge/meta string; `records.ts`'s new empty-state copy
   interpolates only `DISTANCE_LABELS[distance]` (a fixed internal lookup table, never
   user-controlled) and a numeric `year`.

I also independently checked the "second, previously-unrecorded" streak bug the phase context calls
out (`records-logic.ts:274-278` reading `currentStreakStart` instead of an end date) and confirmed
it was fixed in the same plan as the producer change, with a discriminator test asserting the
*value* (not just presence) of `endedISO` against a fixture carrying two different dates for the two
fields — the one assertion shape that would catch a plausible-but-wrong fix.

No Critical or Warning findings. Two Info-level observations below, neither blocking.

## Critical Issues

None found.

## Warnings

None found.

## Info

### IN-01: `isRecord`/`hasOwn` tolerant-parse helpers are duplicated verbatim between `overview.ts` and `records-logic.ts`

**File:** `src/dashboard/views/overview.ts:44-50` (new in this phase), also present in
`src/dashboard/views/records-logic.ts`
**Issue:** `overview.ts`'s new `selectThisYearStats` needed the same `isRecord`/`hasOwn`
tolerant-parse idiom `records-logic.ts` already has, and the plan copied it locally rather than
sharing it. This is a documented, deliberate choice (21-06-SUMMARY.md: "matches the existing
duplication between the two view modules rather than introducing a new cross-view dependency") and
consistent with the project's established pattern of per-view-module parse helpers, so it is not a
regression the phase introduced by accident. Flagging only because a third occurrence in a future
phase would be worth extracting into a shared `dashboard/data/tolerant-parse.ts`-style module.
**Fix:** No action needed now. If a third view module needs the same guard, extract
`isRecord`/`hasOwn` into a shared helper module at that point.

### IN-02: `buildStatCard`'s `sublabel` parameter uses a truthy check rather than `typeof`/length check

**File:** `src/dashboard/views/overview.ts:110` (`if (sublabel) { ... }`)
**Issue:** Every current caller of `buildStatCard` passes either `undefined` or a non-empty string
produced by `currentStreakSublabel` (which never returns `''`), so the truthy check is safe today.
It is slightly less defensive than the explicit `typeof x === 'string' && x.length > 0` idiom used
one function above it (`currentStreakSublabel` itself) and in `records-logic.ts`'s equivalent guard
— a future caller passing `''` intending "no sublabel" would get identical (correct) behavior, but a
future caller passing `'0'` or another falsy-looking-but-meaningful string would silently lose it
only if that string were literally `''`, which is not a realistic value for this field. Not a real
defect against any current or foreseeable input.
**Fix:** Optional hardening only: `if (typeof sublabel === 'string' && sublabel.length > 0)` for
symmetry with the guard idiom used elsewhere in the same file. Not required before shipping.

---

_Reviewed: 2026-08-18T10:05:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
