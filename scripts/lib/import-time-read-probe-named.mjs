/**
 * Deliberately performs a disk read at import time (Phase 32 plan 12, GAP 2). It exists solely as
 * a positive control for scripts/unreliable-segment-import-guards.test.mjs — nothing in production
 * may import it. It is the named-import half of the pair: it consumes `fs` via
 * `import { readFileSync } from 'fs' }`, which is the exact idiom the old
 * `vi.spyOn(fs, 'readFileSync')` guard in compute-unreliable-segment-recount.test.mjs and
 * compute-unreliable-segment-calibration.test.mjs could never observe. Node resolves a CommonJS
 * builtin's named exports once, when the `fs` namespace object is first created, so replacing the
 * `readFileSync` PROPERTY on that namespace object afterwards never intercepts a call already bound
 * to the original function reference — the spy sits on a namespace nobody dereferences through.
 * Paired with import-time-read-probe-default.mjs (the `import fs from 'fs'` half), together they
 * prove the replacement guard (`vi.mock('fs', ...)`) can actually observe a read through BOTH
 * import idioms before it is trusted to certify their absence in the real generator scripts.
 */

import { readFileSync } from 'fs';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);

export const probeLength = readFileSync(PACKAGE_JSON_URL, 'utf8').length;
