import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FIT_IMPORT_PROVIDERS, NEAR_MATCH_TOLERANCE_S, findNearMatch, isFitImported } from './near-match.js';

/**
 * Behavioural edge rows use literal 120/121 that live in this test, independent
 * of the source constant. The structural guard scans real source text for a
 * private copy of the window; every mutation is an in-memory string.
 */

const E = 1776666748;

function read(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

/** Same function as src/dashboard/row-semantics.test.ts (a test file cannot be imported). */
export function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

export function findWindowLiterals(sourcesByPath: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const [p, src] of Object.entries(sourcesByPath)) {
    const code = stripComments(src);
    for (const _m of code.matchAll(/(?<![\w.$])120(?![\w.])/g)) violations.push(`${p}: literal 120`);
    for (const _m of code.matchAll(/\bNEAR_MATCH_TOLERANCE_S\s*=(?!=)/g)) {
      violations.push(`${p}: defines NEAR_MATCH_TOLERANCE_S`);
    }
  }
  return violations;
}

export function findMissingSharedImports(
  sourcesByPath: Record<string, string>,
  needsCall: string[],
): string[] {
  const violations: string[] = [];
  for (const [p, src] of Object.entries(sourcesByPath)) {
    const code = stripComments(src);
    if (!/from\s+['"](?:\.\/|\.\.\/exports\/)near-match\.js['"]/.test(code)) {
      violations.push(`${p}: missing near-match import`);
    }
    if (needsCall.includes(p) && !code.includes('findNearMatch(')) {
      violations.push(`${p}: missing findNearMatch( call`);
    }
  }
  return violations;
}

const fitImport = read('./fit-import.ts');
const reconcile = read('./reconcile.ts');
const nearMatch = read('./near-match.ts');
const intervalsSync = read('../sync/intervals-sync.ts');

const SCANNED = {
  'fit-import.ts': fitImport,
  'reconcile.ts': reconcile,
  'intervals-sync.ts': intervalsSync,
};

describe('constants and predicate', () => {
  it('pins the window and providers against literals', () => {
    expect(NEAR_MATCH_TOLERANCE_S).toBe(120);
    expect([...FIT_IMPORT_PROVIDERS]).toEqual(['garmin-export']);
  });
  it('isFitImported accepts only garmin-export', () => {
    expect(isFitImported('garmin-export')).toBe(true);
    for (const p of ['strava-export', 'intervals', undefined, null, 5]) {
      expect(isFitImported(p)).toBe(false);
    }
  });
});

describe('findNearMatch', () => {
  const cands = [{ id: 'a', epoch: E }];
  it.each([
    [1, 1],
    [-1, -1],
    [120, 120],
    [-120, -120],
  ])('offset %i matches with deltaS %i', (off, delta) => {
    expect(findNearMatch(E + off, cands)).toEqual({ id: 'a', epoch: E, deltaS: delta });
  });
  it.each([121, -121, 0])('offset %i does not match', off => {
    expect(findNearMatch(E + off, cands)).toBeUndefined();
  });
  it('non-finite query never matches and never throws', () => {
    expect(findNearMatch(NaN, cands)).toBeUndefined();
    expect(findNearMatch(Infinity, cands)).toBeUndefined();
  });
  it('non-finite candidate is ignored, finite one still matches', () => {
    const r = findNearMatch(E + 5, [{ id: 'bad', epoch: NaN }, { id: 'a', epoch: E }]);
    expect(r?.id).toBe('a');
  });
  it('picks the smallest |deltaS|, first on a tie', () => {
    const r = findNearMatch(E, [
      { id: 'far', epoch: E + 50 },
      { id: 'near1', epoch: E - 10 },
      { id: 'near2', epoch: E + 10 },
    ]);
    expect(r).toEqual({ id: 'near1', epoch: E - 10, deltaS: 10 });
  });
  it('honours a custom tolerance and handles empty candidates', () => {
    expect(findNearMatch(E + 30, cands, 10)).toBeUndefined();
    expect(findNearMatch(E + 30, cands, 30)?.deltaS).toBe(30);
    expect(findNearMatch(E + 1, [])).toBeUndefined();
  });
});

describe('stripComments', () => {
  it('removes block and line comments but keeps https://', () => {
    expect(stripComments('a /* x */ b')).toBe('a  b');
    expect(stripComments('a // x\nb')).toBe('a \nb');
    expect(stripComments("u = 'https://x.y'")).toBe("u = 'https://x.y'");
  });
});

describe('structural guard: one definition of the window (SC3)', () => {
  it('real sources carry no private window', () => {
    expect(findWindowLiterals(SCANNED)).toEqual([]);
  });
  it('near-match.ts defines the constant exactly once', () => {
    const code = stripComments(nearMatch);
    expect(code.match(/export const NEAR_MATCH_TOLERANCE_S = 120;/g)).toHaveLength(1);
    expect(code.match(/\bNEAR_MATCH_TOLERANCE_S\s*=(?!=)/g)).toHaveLength(1);
  });
  it.each(Object.keys(SCANNED))('a planted literal in %s is caught', p => {
    const mutated = { ...SCANNED, [p]: SCANNED[p as keyof typeof SCANNED] + '\nconst WINDOW = 120;\n' };
    const v = findWindowLiterals(mutated);
    expect(v.length).toBeGreaterThan(0);
    expect(v.some(x => x.startsWith(`${p}:`))).toBe(true);
  });
  it('a planted redefinition is caught', () => {
    const v = findWindowLiterals({ 'x.ts': 'export const NEAR_MATCH_TOLERANCE_S = 60;' });
    expect(v).toEqual(['x.ts: defines NEAR_MATCH_TOLERANCE_S']);
  });
  it('comments and look-alike numbers are not violations', () => {
    expect(findWindowLiterals({ 'x.ts': '// 120 s' })).toEqual([]);
    expect(findWindowLiterals({ 'x.ts': '/* +-120 s */' })).toEqual([]);
    for (const s of ['const a = 1200;', 'const a = 0.120;', 'const x120 = 1;']) {
      expect(findWindowLiterals({ 'x.ts': s })).toEqual([]);
    }
  });
});

describe('structural guard: shared import and call', () => {
  const required = {
    'fit-import.ts': fitImport,
    'reconcile.ts': reconcile,
    'intervals-sync.ts': intervalsSync,
  };
  const needsCall = ['fit-import.ts', 'intervals-sync.ts'];
  it('real sources import the shared module; fit-import and intervals-sync call findNearMatch', () => {
    expect(findMissingSharedImports(required, needsCall)).toEqual([]);
  });
  it('deleting the import line is caught', () => {
    const mutated = {
      ...required,
      'fit-import.ts': fitImport.replace(/^.*from '\.\/near-match\.js';.*$/m, ''),
    };
    const v = findMissingSharedImports(mutated, ['fit-import.ts']);
    expect(v).toContain('fit-import.ts: missing near-match import');
  });
  it('removing the call is caught', () => {
    const mutated = { ...required, 'fit-import.ts': fitImport.replaceAll('findNearMatch(', 'other(') };
    expect(findMissingSharedImports(mutated, ['fit-import.ts'])).toContain(
      'fit-import.ts: missing findNearMatch( call',
    );
  });
  describe('synthetic intervals-sync source', () => {
    const SYNTH =
      "import { findNearMatch, isFitImported } from '../exports/near-match.js';\n" +
      'const near = findNearMatch(epoch, fitImported);\n';
    it('control is clean; removing the import or the call is caught', () => {
      expect(findMissingSharedImports({ 'intervals-sync.ts': SYNTH }, ['intervals-sync.ts'])).toEqual([]);
      const noImport = SYNTH.replace(/^import .*$/m, '');
      expect(
        findMissingSharedImports({ 'intervals-sync.ts': noImport }, ['intervals-sync.ts']).join('\n'),
      ).toContain('intervals-sync.ts');
      const noCall = SYNTH.replace('findNearMatch(epoch, fitImported)', 'other(epoch)');
      expect(
        findMissingSharedImports({ 'intervals-sync.ts': noCall }, ['intervals-sync.ts']).join('\n'),
      ).toContain('intervals-sync.ts: missing findNearMatch( call');
    });
  });
});
