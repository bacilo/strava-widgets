/**
 * Replacement for the two vacuous import-time side-effect guards that used to live inside
 * compute-unreliable-segment-recount.test.mjs and compute-unreliable-segment-calibration.test.mjs
 * (32-VERIFICATION.md gap #2). Both old guards did `vi.spyOn(fs, 'readFileSync')` (plus, for the
 * calibration file, `readdirSync`/`writeFileSync`) against the default `fs` namespace object, then
 * dynamically imported a script that consumes `fs` via `import { readFileSync } from 'fs'`. That
 * spy can never fire: Node resolves a builtin's named exports once, when the `fs` namespace is
 * created, so a property replacement made after the fact is never dereferenced by a call already
 * bound to the original named export. `expect(spy).not.toHaveBeenCalled()` was true regardless of
 * what the imported script actually did — it was proven vacuous during planning by importing a
 * probe module that genuinely reads a file at import time and observing the spy record zero calls.
 *
 * This file lives apart from its two siblings, rather than replacing their blocks in place,
 * because `vi.mock('fs', ...)` is hoisted and applies to the ENTIRE test file it appears in. The
 * two sibling files each have 40-plus other tests that use the real `fs` module (reading fixtures,
 * the recount's own source-scanning zero-import guard, etc.) — mocking `fs` file-wide there would
 * contaminate all of them. Isolating the mock to this one file keeps the sibling files' real
 * coverage untouched.
 *
 * The replacement mechanism is `vi.mock('fs', factory)` (and `vi.mock('node:fs', factory)`, in
 * case either script ever adopts the `node:`-prefixed specifier) with an `importOriginal`
 * passthrough that WRAPS `readFileSync`, `readdirSync` and `writeFileSync`, recording every call
 * before delegating to the real implementation, and exposes the same wrapped functions on both the
 * named-export surface and the `default` object — so it intercepts a call made through EITHER
 * import idiom. Unlike the old spy, this can be observed failing on demand: the two positive
 * controls below (import-time-read-probe-named.mjs and import-time-read-probe-default.mjs) are
 * modules whose only purpose is to read a file at import time, and the first two tests assert this
 * mechanism records that read through both idioms. Only once that is demonstrated do the negative
 * assertions (tests 3-5) use the same mechanism to certify the real generator scripts do NOT read
 * or write at import — making those negative assertions falsifiable instead of vacuous.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const { calls, wrapFsModule } = vi.hoisted(() => {
  const calls = [];

  function wrapFsModule(actual) {
    function record(fn, arg0) {
      calls.push({ fn, arg0 });
    }

    const wrapped = {
      readFileSync: (...args) => {
        record('readFileSync', args[0]);
        return actual.readFileSync(...args);
      },
      readdirSync: (...args) => {
        record('readdirSync', args[0]);
        return actual.readdirSync(...args);
      },
      writeFileSync: (...args) => {
        record('writeFileSync', args[0]);
        return actual.writeFileSync(...args);
      },
    };

    return {
      ...actual,
      ...wrapped,
      default: {
        ...(actual.default ?? actual),
        ...wrapped,
      },
    };
  }

  return { calls, wrapFsModule };
});

vi.mock('fs', async (importOriginal) => wrapFsModule(await importOriginal()));
vi.mock('node:fs', async (importOriginal) => wrapFsModule(await importOriginal()));

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const CALIBRATION_ARTIFACT_PATH = join(
  ROOT_DIR,
  '.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md'
);

describe('control — a module that reads at import via a NAMED fs import is observed', () => {
  it('records a readFileSync call and confirms the probe really read', async () => {
    calls.length = 0;
    const probe = await import('./lib/import-time-read-probe-named.mjs?cache-bust-named-control');
    expect(probe.probeLength).toBeGreaterThan(0);
    const recorded = calls.filter((c) => c.fn === 'readFileSync');
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.some((c) => String(c.arg0).includes('package.json'))).toBe(true);
  });
});

describe('control — a module that reads at import via a DEFAULT fs import is observed', () => {
  it('records a readFileSync call and confirms the probe really read', async () => {
    calls.length = 0;
    const probe = await import('./lib/import-time-read-probe-default.mjs?cache-bust-default-control');
    expect(probe.probeLength).toBeGreaterThan(0);
    const recorded = calls.filter((c) => c.fn === 'readFileSync');
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.some((c) => String(c.arg0).includes('package.json'))).toBe(true);
  });
});

describe('compute-unreliable-segment-recount.mjs performs no disk read at import', () => {
  it('records zero fs calls', async () => {
    calls.length = 0;
    await import('./compute-unreliable-segment-recount.mjs?cache-bust-recount-import-guard');
    expect(calls).toEqual([]);
  });
});

describe('compute-unreliable-segment-calibration.mjs performs no disk read, directory listing or write at import', () => {
  it('records zero fs calls', async () => {
    calls.length = 0;
    await import('./compute-unreliable-segment-calibration.mjs?cache-bust-calibration-import-guard');
    expect(calls).toEqual([]);
  });
});

describe('32-CALIBRATION.md is byte-untouched across the calibration import', () => {
  let mtimeBeforeImport;

  beforeAll(async () => {
    calls.length = 0;
    mtimeBeforeImport = existsSync(CALIBRATION_ARTIFACT_PATH)
      ? statSync(CALIBRATION_ARTIFACT_PATH).mtimeMs
      : null;
    await import('./compute-unreliable-segment-calibration.mjs?cache-bust-calibration-mtime-guard');
  });

  it('leaves the artifact mtime unchanged across the import, or confirms it still does not exist', () => {
    const existsAfterImport = existsSync(CALIBRATION_ARTIFACT_PATH);
    if (mtimeBeforeImport === null) {
      expect(existsAfterImport).toBe(false);
      return;
    }
    expect(existsAfterImport).toBe(true);
    const mtimeAfterImport = statSync(CALIBRATION_ARTIFACT_PATH).mtimeMs;
    expect(mtimeAfterImport).toBe(mtimeBeforeImport);
  });
});
