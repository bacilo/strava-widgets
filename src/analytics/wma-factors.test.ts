import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ageAtDate,
  ageGradePercent,
  interpolate1kFactor,
  lookupFactor,
  parseWmaFactorTable,
  resolveAgeGrade,
} from './wma-factors.js';
import type { WmaFactorTable } from './wma-factors.js';
import { TARGET_ORDER } from './best-effort.types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the REAL committed tables directly (not via a build-time import —
// tsc's rootDir is "src", so a static `import` of a file under data/wma/
// would fail the build; reading via `fs` at test time keeps this file
// buildable while still anchoring the anti-circular assertions below to
// the actual bundled data, per Task 3's requirement).
const roadFactorsRaw = JSON.parse(readFileSync(join(__dirname, '../../data/wma/road-factors.json'), 'utf8'));
const trackFactorsRaw = JSON.parse(readFileSync(join(__dirname, '../../data/wma/track-factors.json'), 'utf8'));

const road = parseWmaFactorTable(roadFactorsRaw);
const track = parseWmaFactorTable(trackFactorsRaw);
if (road === null || track === null) {
  throw new Error('committed data/wma/*.json tables failed to parse — fix the data before running this suite');
}
// Non-null narrowing for TypeScript's benefit in the tests below.
const roadTable: WmaFactorTable = road;
const trackTable: WmaFactorTable = track;

describe('parseWmaFactorTable — real committed tables', () => {
  it('parses both committed tables (road and track) to non-null', () => {
    expect(parseWmaFactorTable(roadFactorsRaw)).not.toBeNull();
    expect(parseWmaFactorTable(trackFactorsRaw)).not.toBeNull();
  });

  it('imports data/wma/road-factors.json and data/wma/track-factors.json directly', () => {
    // This assertion exists to keep the two `data/wma` path references
    // above from being refactored away — the anti-circular tests in this
    // file are only meaningful if they run against the real bundled data.
    expect(roadFactorsRaw.surface).toBe('road');
    expect(trackFactorsRaw.surface).toBe('track');
  });
});

describe('resolveAgeGrade — pinned external worked example (load-bearing)', () => {
  it(
    // Per 18-02-PLAN.md's anti-circularity rule: this expected value is
    // EXTERNAL. RESEARCH.md cross-verified it across icalculator.com,
    // marathonhandbook.com, runbundle.com and miniwebtool.com — a 5K open
    // standard of 769s, an age-50 male road factor of 0.8775, and an
    // actual time of 1500s yielding 58.4%. If the committed road table
    // disagreed with this, the table would be wrong, not this test — see
    // the plan's anti-circularity rule for the required stop-and-report
    // protocol (not applicable here: the committed table matches).
    'male/5k/age50/1500s resolves to 58.4% ± 0.5, not derived',
    () => {
      const result = resolveAgeGrade(roadTable, trackTable, 'male', '5k', 50, 1500);
      expect(result).not.toBeNull();
      expect(result?.percent).toBeGreaterThanOrEqual(58.4 - 0.5);
      expect(result?.percent).toBeLessThanOrEqual(58.4 + 0.5);
      expect(result?.derived).toBe(false);
      expect(result?.surface).toBe('road');
    }
  );
});

describe('ageGradePercent — formula direction regression', () => {
  it('matches the pinned worked example directly', () => {
    const percent = ageGradePercent(769, 1500, 0.8775);
    expect(percent).toBeGreaterThanOrEqual(58.4 - 0.5);
    expect(percent).toBeLessThanOrEqual(58.4 + 0.5);
  });

  it('is the discriminating assertion: a SMALLER age factor yields a HIGHER percentage (never the reverse)', () => {
    // An implementation that multiplies by ageFactor instead of dividing
    // fails this assertion; one that only checks the worked example above
    // would not catch that class of defect (Pitfall 5).
    const lowerFactor = ageGradePercent(769, 1500, 0.7);
    const higherFactor = ageGradePercent(769, 1500, 0.9);
    expect(lowerFactor).toBeGreaterThan(higherFactor);
  });

  it('returns 0 for non-positive actualSec or ageFactor', () => {
    expect(ageGradePercent(769, 0, 0.9)).toBe(0);
    expect(ageGradePercent(769, -5, 0.9)).toBe(0);
    expect(ageGradePercent(769, 1500, 0)).toBe(0);
    expect(ageGradePercent(769, 1500, -0.1)).toBe(0);
  });
});

describe('peak-age sanity — real male/5k road table', () => {
  it('peaks at 1.0 ± 0.001 with at least one peak age in the 25-35 band, and declines with age past the peak', () => {
    const male5k = roadTable.factors.male['5k'];
    let maxFactor = -Infinity;
    const peakAges: number[] = [];
    for (const [ageStr, factor] of Object.entries(male5k)) {
      if (factor > maxFactor) {
        maxFactor = factor;
        peakAges.length = 0;
        peakAges.push(Number(ageStr));
      } else if (factor === maxFactor) {
        peakAges.push(Number(ageStr));
      }
    }
    expect(Math.abs(maxFactor - 1.0)).toBeLessThanOrEqual(0.001);
    // This table's open-class plateau (ages 19-29) is wider than the
    // textbook 25-35 masters-only band — the tie for the max factor spans
    // several ages, so the assertion is "at least one peak age falls in
    // 25-35", not "the first age reaching 1.0 does".
    expect(peakAges.some((age) => age >= 25 && age <= 35)).toBe(true);
    expect(male5k['70']).toBeLessThan(male5k['30']);
  });
});

describe('1k derived flag and interpolation (D-09)', () => {
  it('resolveAgeGrade marks 1k as derived and every other target distance as not derived', () => {
    for (const distance of TARGET_ORDER) {
      const result = resolveAgeGrade(roadTable, trackTable, 'male', distance, 40, 1500);
      expect(result, `distance ${distance} should resolve`).not.toBeNull();
      if (distance === '1k') {
        expect(result?.derived).toBe(true);
      } else {
        expect(result?.derived).toBe(false);
      }
    }
  });

  it('interpolate1kFactor returns a value strictly between the two inputs, closer to the 800m end', () => {
    const interpolated = interpolate1kFactor(0.9, 0.8);
    expect(interpolated).toBeGreaterThan(0.8);
    expect(interpolated).toBeLessThan(0.9);
    // ln(1000) sits nearer ln(800) than ln(1609.344), so the result should
    // be nearer 0.9 (the 800m factor) than the midpoint (0.85).
    const midpoint = 0.85;
    expect(Math.abs(interpolated - 0.9)).toBeLessThan(Math.abs(midpoint - 0.9));
  });
});

describe('ageAtDate', () => {
  it('returns the lower age when the birthday has not yet been reached in the target year', () => {
    expect(ageAtDate('1990-06-15', '2020-06-01')).toBe(29);
  });

  it('returns the higher age when the birthday falls exactly on the target date', () => {
    expect(ageAtDate('1990-06-15', '2020-06-15')).toBe(30);
  });

  it('does not throw for a Feb 29 birth date compared against a non-leap-year Feb 28 target', () => {
    expect(() => ageAtDate('2000-02-29', '2001-02-28')).not.toThrow();
    const age = ageAtDate('2000-02-29', '2001-02-28');
    expect(typeof age).toBe('number');
  });

  it('returns null for malformed input', () => {
    expect(ageAtDate('not-a-date', '2020-01-01')).toBeNull();
    expect(ageAtDate('2020-01-01', 'also-not-a-date')).toBeNull();
  });

  it('returns null when the target date is before the birth date', () => {
    expect(ageAtDate('2020-01-01', '2019-01-01')).toBeNull();
  });
});

describe('lookupFactor — clamping', () => {
  it('clamps an age below the table minimum to the minimum age\'s factor', () => {
    const ages = Object.keys(roadTable.factors.male['5k']).map(Number);
    const minAge = Math.min(...ages);
    const belowMin = lookupFactor(roadTable, 'male', '5k', minAge - 50);
    expect(belowMin).toBe(roadTable.factors.male['5k'][String(minAge)]);
  });

  it('clamps an age above the table maximum to the maximum age\'s factor', () => {
    const ages = Object.keys(roadTable.factors.male['5k']).map(Number);
    const maxAge = Math.max(...ages);
    const aboveMax = lookupFactor(roadTable, 'male', '5k', maxAge + 50);
    expect(aboveMax).toBe(roadTable.factors.male['5k'][String(maxAge)]);
  });

  it('returns null for an unknown distance', () => {
    expect(lookupFactor(roadTable, 'male', 'ultramarathon', 40)).toBeNull();
  });
});

describe('parseWmaFactorTable — synthetic edge cases', () => {
  it('returns null when the female sex is entirely absent', () => {
    const missingFemale = {
      schemaVersion: 1,
      surface: 'road',
      edition: 'test',
      source: 'https://example.test',
      openStandardSec: { male: { '5k': 800 } },
      factors: { male: { '5k': { '50': 0.9 } } },
    };
    expect(parseWmaFactorTable(missingFemale)).toBeNull();
  });

  it('returns null when the only factor value is out of range (1.4)', () => {
    const outOfRange = {
      schemaVersion: 1,
      surface: 'road',
      edition: 'test',
      source: 'https://example.test',
      openStandardSec: { male: { '5k': 800 }, female: { '5k': 800 } },
      factors: {
        male: { '5k': { '50': 1.4 } }, // dropped by the (0, 1] filter, leaving male with zero valid distances
        female: { '5k': { '50': 0.9 } },
      },
    };
    expect(parseWmaFactorTable(outOfRange)).toBeNull();
  });

  it('does not let a __proto__ JSON key reach the object prototype chain', () => {
    // JSON.parse (unlike an object literal's `{ __proto__: ... }` syntax)
    // creates a genuine OWN property literally named "__proto__" — this is
    // exactly the shape a malicious or corrupted committed JSON file could
    // take, and it is what real callers hand this function (parsed JSON).
    const malicious = JSON.parse(
      '{"schemaVersion":1,"surface":"road","edition":"test","source":"https://example.test",' +
        '"openStandardSec":{"male":{"5k":800},"female":{"5k":800}},' +
        '"factors":{"male":{"5k":{"50":0.9},"__proto__":{"polluted":0.5}},"female":{"5k":{"50":0.9}}}}'
    );

    const result = parseWmaFactorTable(malicious);
    expect(result).not.toBeNull();
    expect(result?.factors.male['5k']?.['50']).toBe(0.9);
    expect(Object.prototype.hasOwnProperty.call(result?.factors.male, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(result?.factors.male)).toBe(Object.prototype);
    expect((result?.factors.male as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('resolveAgeGrade — surface routing', () => {
  it('routes 5k/10k/half/marathon to the road table', () => {
    for (const distance of ['5k', '10k', 'half', 'marathon'] as const) {
      const result = resolveAgeGrade(roadTable, trackTable, 'male', distance, 40, 1500);
      expect(result?.surface, `distance ${distance}`).toBe('road');
    }
  });

  it('routes 400m/1k/1mi to the track table', () => {
    for (const distance of ['400m', '1k', '1mi'] as const) {
      const result = resolveAgeGrade(roadTable, trackTable, 'male', distance, 40, 1500);
      expect(result?.surface, `distance ${distance}`).toBe('track');
    }
  });
});
