import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { stripComments } from '../dashboard/row-semantics.test.js';

/**
 * Lockstep audit (Phase 36, plan 36-09) over the `EffortDemotionGuard` value's THREE required
 * homes:
 *   1. `src/analytics/best-effort.types.ts` — the `EffortDemotionGuard` union declaration.
 *   2. `src/dashboard/data/best-efforts-client.ts` — `VALID_DEMOTION_GUARDS`, the browser's
 *      allowlist. An omitted guard here makes `parseDemotion` return `null`, so the demotion
 *      VANISHES in the browser with no type error — this home fails SILENTLY.
 *   3. `src/dashboard/views/records-logic.ts` — the per-guard `switch` in
 *      `countDemotedAtDistance`. An omitted guard here buckets the demotion into the unexplained
 *      `other` count — this home fails by MISLABELLING, also with no type error.
 *
 * A guard added to the union and forgotten in either of the other two homes compiles cleanly
 * (the union is compile-time; the other two are runtime string comparisons) and ships a
 * browser-visible regression. This file exists so that failure mode is caught by a test rather
 * than discovered in production, and so a FIFTH guard added after this phase is audited
 * automatically rather than requiring a new hand-written case here.
 *
 * Every plant in this file is an in-memory string replacement on a COPY of the real source text
 * — no plant is ever written to disk, and `git status --porcelain` on the three audited files is
 * asserted unchanged by this plan's own verification step. `stripComments` (imported from
 * `row-semantics.test.ts`, the same function `records.test.ts` uses) is applied before any
 * region is scanned, so a guard value mentioned only in a comment — e.g. explaining what the
 * value means — can never satisfy the audit; the fourth planted-case group below proves that
 * directly.
 */

const TYPES_PATH = new URL('./best-effort.types.ts', import.meta.url);
const CLIENT_PATH = new URL('../dashboard/data/best-efforts-client.ts', import.meta.url);
const RECORDS_LOGIC_PATH = new URL('../dashboard/views/records-logic.ts', import.meta.url);

interface HomeSources {
  types: string;
  client: string;
  recordsLogic: string;
}

const realSources: HomeSources = {
  types: readFileSync(TYPES_PATH, 'utf8'),
  client: readFileSync(CLIENT_PATH, 'utf8'),
  recordsLogic: readFileSync(RECORDS_LOGIC_PATH, 'utf8'),
};

/**
 * Finds `startNeedle` in `source` and walks forward from its first `{` counting brace depth
 * until it returns to 0, returning the slice from `startNeedle`'s own start through the matching
 * closing brace (inclusive). Used to extract the per-guard `switch` block without scanning the
 * whole file — an occurrence of a guard string elsewhere in `records-logic.ts` (e.g. a comment
 * above the switch, or a fixture in a sibling test file this function never reads) cannot
 * satisfy the audit, because it is simply never inside the extracted region.
 */
function extractBalancedBraceRegion(source: string, startNeedle: string): string {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`extractBalancedBraceRegion: needle not found: ${startNeedle}`);
  const openBrace = source.indexOf('{', start);
  if (openBrace < 0) throw new Error(`extractBalancedBraceRegion: no opening brace after needle: ${startNeedle}`);

  let depth = 0;
  let i = openBrace;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`extractBalancedBraceRegion: unbalanced braces after: ${startNeedle}`);
  return source.slice(start, i + 1);
}

/** Extracts the `EffortDemotionGuard` union declaration, from its `export type` keyword to its terminating `;`. */
function extractUnionRegion(typesSource: string): string {
  const needle = 'export type EffortDemotionGuard =';
  const start = typesSource.indexOf(needle);
  if (start < 0) throw new Error('EffortDemotionGuard union declaration not found');
  const end = typesSource.indexOf(';', start);
  if (end < 0) throw new Error('EffortDemotionGuard union declaration has no terminating ;');
  return typesSource.slice(start, end + 1);
}

/** Extracts the `VALID_DEMOTION_GUARDS` Set literal, from its `const` declaration to its terminating `;`. */
function extractClientRegion(clientSource: string): string {
  const needle = 'const VALID_DEMOTION_GUARDS';
  const start = clientSource.indexOf(needle);
  if (start < 0) throw new Error('VALID_DEMOTION_GUARDS declaration not found');
  const end = clientSource.indexOf(';', start);
  if (end < 0) throw new Error('VALID_DEMOTION_GUARDS declaration has no terminating ;');
  return clientSource.slice(start, end + 1);
}

/** Extracts the per-guard `switch (effort.demotion.guard)` block in full, braces balanced. */
function extractRecordsLogicRegion(recordsLogicSource: string): string {
  return extractBalancedBraceRegion(recordsLogicSource, 'switch (effort.demotion.guard)');
}

/**
 * Parses the guard list directly from the union's own source text, rather than hardcoding the
 * four strings here — so a fifth guard added to the union after this phase is audited
 * automatically, with no companion edit needed in this file. A parse that silently returned an
 * empty list would make every "real direction" assertion below vacuously true, which is exactly
 * why one of those assertions pins today's count to 4.
 */
function parseGuardsFromUnion(unionRegion: string): string[] {
  const matches = unionRegion.match(/'([^']+)'/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * The audit itself: returns the names of the homes (`'types'`, `'client'`, `'recordsLogic'`)
 * that do NOT carry `guard`. An empty array means all three homes agree. Comments are stripped
 * from each FULL source before the declaration is even located, so a guard mentioned only in a
 * comment anywhere in the file — including one placed right next to the real declaration — can
 * never be found by the extraction step that follows.
 */
function missingHomes(sources: HomeSources, guard: string): string[] {
  const typesRegion = extractUnionRegion(stripComments(sources.types));
  const clientRegion = extractClientRegion(stripComments(sources.client));
  const recordsLogicRegion = extractRecordsLogicRegion(stripComments(sources.recordsLogic));

  const missing: string[] = [];
  if (!typesRegion.includes(`'${guard}'`)) missing.push('types');
  if (!clientRegion.includes(`'${guard}'`)) missing.push('client');
  if (!recordsLogicRegion.includes(`case '${guard}':`)) missing.push('recordsLogic');
  return missing;
}

describe('effort-guard-homes — parsing the guard list from source (not hardcoded)', () => {
  it('parses exactly 4 guards from the union today, so a parse that silently returned an empty list cannot pass', () => {
    const guards = parseGuardsFromUnion(extractUnionRegion(stripComments(realSources.types)));
    expect(guards).toHaveLength(4);
    expect(guards.sort()).toEqual(['ceiling', 'max-speed', 'unreliable-segment', 'world-record'].sort());
  });
});

describe('effort-guard-homes — REAL direction: all three homes agree, for every guard in the union', () => {
  const guards = parseGuardsFromUnion(extractUnionRegion(stripComments(realSources.types)));

  it('the parsed guard list is used to drive the real-direction checks below (self-check, not vacuous)', () => {
    expect(guards.length).toBeGreaterThan(0);
  });

  it("'unreliable-segment' (this phase's new guard) has no missing home", () => {
    expect(missingHomes(realSources, 'unreliable-segment')).toEqual([]);
  });

  it("'ceiling' has no missing home", () => {
    expect(missingHomes(realSources, 'ceiling')).toEqual([]);
  });

  it("'world-record' has no missing home", () => {
    expect(missingHomes(realSources, 'world-record')).toEqual([]);
  });

  it("'max-speed' has no missing home", () => {
    expect(missingHomes(realSources, 'max-speed')).toEqual([]);
  });

  it('holds for the WHOLE parsed union, not just the four values hardcoded above one at a time', () => {
    for (const guard of guards) {
      expect(missingHomes(realSources, guard)).toEqual([]);
    }
  });
});

describe('effort-guard-homes — PLANTED direction: three separate removals, one per home, each caught individually', () => {
  /*
   * An audit checked only in the passing direction is the failure mode this project has shipped
   * twice (checkpoint-rows-must-assert-extent.md). Three separate removals — not one — are
   * needed because a scanner that only ever looked at ONE home would still pass two of the three
   * plants below: each plant leaves the other two homes untouched and correct, so a broken
   * scanner that, say, only ever checked `client` would report `[]` (wrongly) for the `types`-
   * and `recordsLogic`-only plants.
   */

  it('removing the guard from the TYPES union only is caught as exactly ["types"] — the other two homes still carry it', () => {
    const plantedTypes = realSources.types.replace(" | 'unreliable-segment'", '');
    // Self-check the plant actually removed the literal, so a no-op replace cannot pass this test.
    expect(plantedTypes).not.toEqual(realSources.types);
    const planted: HomeSources = { ...realSources, types: plantedTypes };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['types']);
  });

  it('removing the guard from the CLIENT allowlist only is caught as exactly ["client"]', () => {
    const plantedClient = realSources.client.replace("  'unreliable-segment',\n", '');
    expect(plantedClient).not.toEqual(realSources.client);
    const planted: HomeSources = { ...realSources, client: plantedClient };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['client']);
  });

  it('removing the guard\'s case from the RECORDS-LOGIC switch only is caught as exactly ["recordsLogic"]', () => {
    const plantedRecordsLogic = realSources.recordsLogic.replace(
      "        case 'unreliable-segment':\n          counts.unreliableSegment++;\n          break;\n",
      ''
    );
    expect(plantedRecordsLogic).not.toEqual(realSources.recordsLogic);
    const planted: HomeSources = { ...realSources, recordsLogic: plantedRecordsLogic };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['recordsLogic']);
  });
});

describe('effort-guard-homes — PLANTED direction: a comment-only occurrence does not satisfy the audit (comment-stripping is load-bearing)', () => {
  it('a guard value removed from the real TYPES location but re-inserted only inside a comment is still reported missing from types', () => {
    const withoutReal = realSources.types.replace(" | 'unreliable-segment'", '');
    const withCommentOnly = withoutReal.replace(
      'export type EffortDemotionGuard =',
      "// a comment mentioning 'unreliable-segment' here must NOT satisfy the audit\nexport type EffortDemotionGuard ="
    );
    const planted: HomeSources = { ...realSources, types: withCommentOnly };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['types']);
  });

  it('a guard value removed from the real CLIENT location but re-inserted only inside a comment is still reported missing from client', () => {
    const withoutReal = realSources.client.replace("  'unreliable-segment',\n", '');
    const withCommentOnly = withoutReal.replace(
      'const VALID_DEMOTION_GUARDS',
      "// a comment mentioning 'unreliable-segment' here must NOT satisfy the audit\nconst VALID_DEMOTION_GUARDS"
    );
    const planted: HomeSources = { ...realSources, client: withCommentOnly };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['client']);
  });

  it('a guard value removed from the real RECORDS-LOGIC switch but re-inserted only inside a comment is still reported missing from recordsLogic', () => {
    const withoutReal = realSources.recordsLogic.replace(
      "        case 'unreliable-segment':\n          counts.unreliableSegment++;\n          break;\n",
      ''
    );
    const withCommentOnly = withoutReal.replace(
      'switch (effort.demotion.guard)',
      "switch (effort.demotion.guard) /* a comment mentioning 'unreliable-segment' here must NOT satisfy the audit */"
    );
    const planted: HomeSources = { ...realSources, recordsLogic: withCommentOnly };
    expect(missingHomes(planted, 'unreliable-segment')).toEqual(['recordsLogic']);
  });
});

describe('effort-guard-homes — self-tests of the extraction helpers', () => {
  it('extractBalancedBraceRegion returns a region whose brace count is balanced and which contains the needle', () => {
    const region = extractRecordsLogicRegion(stripComments(realSources.recordsLogic));
    const opens = (region.match(/\{/g) ?? []).length;
    const closes = (region.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(region.startsWith('switch (effort.demotion.guard)')).toBe(true);
  });

  it('parseGuardsFromUnion round-trips a small synthetic union', () => {
    expect(parseGuardsFromUnion("export type X = 'a' | 'b' | 'c';")).toEqual(['a', 'b', 'c']);
  });
});
