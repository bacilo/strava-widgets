/**
 * Headless CLI for editing data/best-effort-exclusions.json.
 *
 * This exists so an exclusion can be made from GitHub's Actions tab with no
 * local checkout, no `npm run curate` server and no hand-edited JSON — see
 * the `exclude_activity_id` input in .github/workflows/daily-refresh.yml.
 * `npm run exclude` points here too, for the same operation from a terminal.
 *
 * It is the SAME mutation as curate's tickbox, not a second implementation:
 * applyUpsert, applyRemove, writeAtomic, isValidCurateActivityId and
 * normalizeReason are all imported from scripts/curate-server.mjs, which
 * owns the D-05/D-06/D-07 contracts (entry shape is always
 * `{activityId, distances: null, reason}`; an untick REMOVES the entry
 * rather than emptying its `distances`, because buildExclusionIndex
 * silently skips an entry whose distances array is empty). Importing that
 * module does not start a server — it has a self-execution guard.
 *
 * D-09 (curate never invokes git) is NOT violated here. That rule exists so
 * a tickbox in a browser cannot cause a deploy. This script invokes no git
 * either; committing is the caller's job, done explicitly by the workflow
 * step or by the developer by hand.
 *
 * Unlike curate, this validates that the activity actually EXISTS before
 * writing. Curate can't produce a bad id — you tick a run that is on screen
 * — but a hand-typed id in a dispatch form can, and an exclusion entry for
 * a nonexistent activity is silently inert: it would never match anything,
 * and nothing downstream would ever report it.
 */

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  EXCLUSIONS_PATH,
  MAX_REASON_CHARS,
  applyRemove,
  applyUpsert,
  isValidCurateActivityId,
  normalizeReason,
  writeAtomic,
} from './curate-server.mjs';

const ACTIVITIES_DIR = 'data/activities';

const USAGE = `Usage:
  node scripts/exclusion-cli.mjs --id <activityId> --reason "<why>"
  node scripts/exclusion-cli.mjs --id <activityId> --remove

  --id      Activity id as it appears in the dashboard URL (#/activity/<id>),
            e.g. 3475726256 or i184264408.
  --reason  Why this run is not a trusted personal record. Required unless
            --remove is given. Max ${MAX_REASON_CHARS} characters.
  --remove  Delete the activity's exclusion entry instead of adding one.`;

/** Exits with a message on stderr; never throws a stack trace at the user. */
function fail(message) {
  console.error(`ERROR: ${message}\n\n${USAGE}`);
  process.exit(1);
}

/** Minimal flag parser — no dependency, and the surface is three flags. */
export function parseArgs(argv) {
  const args = { id: null, reason: null, remove: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--remove') {
      args.remove = true;
    } else if (token === '--id' || token === '--reason') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`${token} requires a value.`);
      }
      args[token === '--id' ? 'id' : 'reason'] = value;
      i += 1;
    } else {
      fail(`Unrecognized argument: ${token}`);
    }
  }
  return args;
}

export function main() {
  const { id, reason, remove } = parseArgs(process.argv.slice(2));

  if (id === null) fail('--id is required.');
  if (!isValidCurateActivityId(id)) {
    fail(`"${id}" is not a valid activity id (expected digits, optionally i-prefixed).`);
  }

  // Fail on a typo'd id here rather than writing an entry that matches
  // nothing. The dashboard URL is the authoritative source for this value.
  const activityFile = resolve(ACTIVITIES_DIR, `${id}.json`);
  if (!existsSync(activityFile)) {
    fail(
      `No activity ${id} in ${ACTIVITIES_DIR}/. Check the id in the dashboard URL ` +
        `(#/activity/<id>). If the run was just uploaded, it may not have synced yet.`
    );
  }

  const doc = JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'));
  const existing = doc.exclusions.find((e) => e.activityId === id);

  let updated;
  let summary;

  if (remove) {
    if (existing === undefined) {
      fail(`Activity ${id} is not currently excluded — nothing to remove.`);
    }
    updated = applyRemove(doc, id);
    summary = `Removed exclusion for ${id}`;
  } else {
    const cleanReason = normalizeReason(reason);
    if (cleanReason === null) {
      fail(
        reason === null
          ? '--reason is required when adding an exclusion.'
          : `--reason must be 1-${MAX_REASON_CHARS} characters after trimming.`
      );
    }
    updated = applyUpsert(doc, id, cleanReason);
    // applyUpsert replaces in place, so an existing id is an edit, not a
    // second entry — worth saying out loud in a log the developer reads later.
    summary = existing === undefined
      ? `Excluded ${id} — ${cleanReason}`
      : `Updated exclusion reason for ${id} — ${cleanReason}`;
  }

  writeAtomic(EXCLUSIONS_PATH, `${JSON.stringify(updated, null, 2)}\n`);

  console.log(summary);
  console.log(`${EXCLUSIONS_PATH} now holds ${updated.exclusions.length} exclusion(s).`);

  // Lets the workflow use this as its commit message without re-deriving it.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
  }
}

// Self-execution guard, mirroring curate-server.mjs: main() runs only under
// direct invocation, so a test can import parseArgs without triggering a write.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
