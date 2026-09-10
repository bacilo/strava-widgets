import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

import { stripComments } from '../row-semantics.test.js';

/*
 * Source-wiring guard over records.ts's Records screen empty-state and
 * demotion-note rendering (Phase 28, plan 28-04, D-03). Vitest runs in this
 * repository with `environment: 'node'` — there is no DOM-simulation
 * library dependency anywhere in the tree, so this file never invokes a DOM
 * builder (`buildPrTableEmptyState`/`buildPrTableSection` themselves).
 * Rendering itself is proven only by the mandatory human browser checkpoint;
 * this file proves only that the render path is wired to the pure,
 * unit-tested `records-logic.ts` functions rather than to a reintroduced
 * inline copy ternary. Mirrors `detail-sections.test.ts`'s idiom exactly.
 */

const VIEWS_DIR = new URL('./', import.meta.url);

function readSource(relativePath: string): string {
  return fs.readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Isolates one function's body from a comment-stripped source string,
 * starting at `declarationNeedle` and ending just before the next
 * function declaration at ANY indentation level (top-level or nested,
 * e.g. `renderTables` inside `buildPrTablesSection`) — unlike
 * `detail-sections.test.ts`'s top-level-only variant, this file needs to
 * isolate a nested function too.
 */
function isolateFunctionBody(source: string, declarationNeedle: string): string {
  const start = source.indexOf(declarationNeedle);
  if (start < 0) {
    throw new Error(`isolateFunctionBody: declaration not found: ${declarationNeedle}`);
  }
  const nextFunctionDeclaration = /\n\s*(export )?function /g;
  nextFunctionDeclaration.lastIndex = start + declarationNeedle.length;
  const nextMatch = nextFunctionDeclaration.exec(source);
  const end = nextMatch ? nextMatch.index : source.length;
  return source.slice(start, end);
}

const recordsStripped = stripComments(readSource('records.ts'));

describe('records.ts wiring (source guard) — empty-state and demotion-note rendering', () => {
  const buildPrTableEmptyStateBody = isolateFunctionBody(recordsStripped, 'function buildPrTableEmptyState(');
  const buildPrTableSectionBody = isolateFunctionBody(recordsStripped, 'function buildPrTableSection(');
  const renderTablesBody = isolateFunctionBody(recordsStripped, 'function renderTables(');

  it('buildPrTableEmptyState calls resolvePrTableEmptyState exactly once and contains zero occurrences of the old inline copy literal', () => {
    expect(countOccurrences(buildPrTableEmptyStateBody, 'resolvePrTableEmptyState(')).toBe(1);
    expect(countOccurrences(buildPrTableEmptyStateBody, 'The archive has no')).toBe(0);
  });

  it('buildPrTableSection calls resolvePrTableDemotionNote exactly once', () => {
    expect(countOccurrences(buildPrTableSectionBody, 'resolvePrTableDemotionNote(')).toBe(1);
  });

  it('the render loop (renderTables) calls countDemotedAtDistance exactly once per distance', () => {
    expect(countOccurrences(renderTablesBody, 'countDemotedAtDistance(')).toBe(1);
  });

  it('innerHTML appears zero times in the whole file — no reason string can be injected as markup', () => {
    expect(countOccurrences(recordsStripped, 'innerHTML')).toBe(0);
  });

  it('buildPrTableEmptyState is called with four arguments', () => {
    const callSiteIndex = buildPrTableSectionBody.indexOf('buildPrTableEmptyState(');
    expect(callSiteIndex).toBeGreaterThanOrEqual(0);
    const callSite = buildPrTableSectionBody.slice(callSiteIndex, buildPrTableSectionBody.indexOf(')', callSiteIndex) + 1);
    // 'buildPrTableEmptyState(distance, scope, year, demotedCount)' — three commas, four arguments.
    expect(countOccurrences(callSite, ',')).toBe(3);
  });
});
