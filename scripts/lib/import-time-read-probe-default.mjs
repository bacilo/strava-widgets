/**
 * Deliberately performs a disk read at import time (Phase 32 plan 12, GAP 2). It exists solely as
 * a positive control for scripts/unreliable-segment-import-guards.test.mjs — nothing in production
 * may import it. It is the default-import half of the pair: it consumes `fs` via
 * `import fs from 'fs'` and calls `fs.readFileSync(...)`, rather than the named-import idiom used
 * by import-time-read-probe-named.mjs. Together the two probes prove the replacement guard
 * (`vi.mock('fs', ...)`) is idiom-independent — it must catch a read made through the default
 * namespace object just as reliably as one made through a named binding, since a future edit to
 * either real generator script could use either shape.
 */

import fs from 'fs';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);

export const probeLength = fs.readFileSync(PACKAGE_JSON_URL, 'utf8').length;
