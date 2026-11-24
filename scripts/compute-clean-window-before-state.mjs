/**
 * BEFORE-STATE LEG: PR-09's fourth reconciliation leg (36-16, closing 36-VERIFICATION.md gap 1 / CR-01).
 *
 * WHY IT EXISTS. 36-VERIFICATION.md found that none of PR-09's three legs could catch CR-01 (the diff
 * headline stated "0 ceiling reinstatements" while real ones exist). Legs 1 and 2 share the diff
 * generator, and the recount (leg 3) never reconstructs the OLD state. A fourth leg that reconstructed
 * the OLD state with the same rule would share the same blind spot. So this leg does not reconstruct:
 * it RUNS the pipeline that actually shipped before Phase 36 (commit ebe0245c) over the same tracked
 * archive, and treats that document as the OLD state, ceiling, unrounded durations (IN-04) and
 * exclusions exactly as production applied them.
 *
 * WHAT IT SHARES: the tracked archive (data/streams, data/activities, the manifest, the exclusions
 * file) and, for the NEW side, the current pipeline (dist/analytics/compute-best-efforts.js).
 * WHAT IT DOES NOT SHARE: this file has no import of the diff generator or of the recalibration script
 * (any spelling, static or dynamic; findForbiddenImports enforces this and the test runs it on this very
 * file), and it applies no reconstruction rule, because the OLD state is the pre-phase pipeline's own
 * output.
 *
 * REPRODUCTION (all outside the repository, nothing tracked is written):
 *   git fetch origin && git rev-list --count HEAD..origin/master      # record it
 *   git worktree add --detach <tmp>/prephase ebe0245c
 *   ln -s <repo>/node_modules <tmp>/prephase/node_modules
 *   npx tsc -p <tmp>/prephase/tsconfig.json
 *   npm run compute-clean-window-before-state -- --pre-phase-dist <tmp>/prephase/dist
 *   rm <tmp>/prephase/node_modules && git worktree remove --force <tmp>/prephase && git worktree prune
 *
 * IN-04 NOTE: this leg uses production's unrounded evaluation. A disagreement confined to efforts
 * within 0.05 s of a guard threshold is the reconstruction's rounding, and must be named per pair.
 *
 * FAILS CLOSED: a figure the artifact does not state is null and its row never agrees.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// The leg's own constants, deliberately not imported from the shared types module.
const TARGET_ORDER_LOCAL = ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'];
const ABSOLUTE_GUARDS_LOCAL = ['world-record', 'max-speed'];
const CEILING_GUARD_LOCAL = 'ceiling';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const PHASE_DIR = join(
  ROOT_DIR,
  '.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration'
);
const DEFAULT_DIFF_PATH = join(PHASE_DIR, '36-DIFF.md');
const RECALIBRATION_PATH = join(PHASE_DIR, '36-CEILING-RECALIBRATION.md');

// ---------------------------------------------------------------------------
// Pure: bucket derivation
// ---------------------------------------------------------------------------

function zeroByDistance() {
  const out = {};
  for (const d of TARGET_ORDER_LOCAL) out[d] = 0;
  return out;
}

function isRanked(e) {
  return e.demotion == null && e.excludedFromRecords !== true;
}

/** Classifies every (activity, distance) pair present in both documents. */
export function deriveBeforeAfterBuckets(oldDoc, newDoc) {
  const out = {
    reinstated: { absoluteGuard: zeroByDistance(), ceiling: zeroByDistance() },
    newlyDemoted: zeroByDistance(),
    demotedGuardChanged: zeroByDistance(),
    movedButRanked: zeroByDistance(),
    unchanged: zeroByDistance(),
    excluded: zeroByDistance(),
    ceilingPairs: {},
    onlyInOld: 0,
    onlyInNew: 0,
    unknownOldGuard: 0,
  };
  for (const d of TARGET_ORDER_LOCAL) out.ceilingPairs[d] = [];

  const index = (doc) => {
    const m = new Map();
    for (const [id, act] of Object.entries(doc.activities ?? {})) {
      for (const e of act.efforts ?? []) m.set(`${id}\u0000${e.distance}`, { id, e });
    }
    return m;
  };
  const oldIdx = index(oldDoc);
  const newIdx = index(newDoc);

  for (const [key, o] of oldIdx) {
    const n = newIdx.get(key);
    if (!n) {
      out.onlyInOld += 1;
      continue;
    }
    const d = o.e.distance;
    if (!(d in out.excluded)) continue;
    const oe = o.e;
    const ne = n.e;
    if (oe.excludedFromRecords === true || ne.excludedFromRecords === true) {
      out.excluded[d] += 1;
    } else if (oe.demotion != null && ne.demotion == null) {
      const guard = oe.demotion.guard;
      if (ABSOLUTE_GUARDS_LOCAL.includes(guard)) {
        out.reinstated.absoluteGuard[d] += 1;
      } else if (guard === CEILING_GUARD_LOCAL) {
        out.reinstated.ceiling[d] += 1;
        out.ceilingPairs[d].push({
          activityId: o.id,
          distance: d,
          oldDurationSec: oe.durationSec,
          newDurationSec: ne.durationSec,
        });
      } else {
        out.unknownOldGuard += 1;
      }
    } else if (isRanked(oe) && isRanked(ne) && ne.contaminated != null) {
      out.movedButRanked[d] += 1;
    } else if (oe.demotion == null && ne.demotion != null) {
      out.newlyDemoted[d] += 1;
    } else if (oe.demotion != null && ne.demotion != null && oe.demotion.guard !== ne.demotion.guard) {
      out.demotedGuardChanged[d] += 1;
    } else {
      out.unchanged[d] += 1;
    }
  }
  for (const key of newIdx.keys()) if (!oldIdx.has(key)) out.onlyInNew += 1;
  return out;
}

// ---------------------------------------------------------------------------
// Pure: markdown parsers (null = the artifact does not state the figure)
// ---------------------------------------------------------------------------

function headlineInt(text, re) {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parseNumberCell(cell) {
  if (cell == null || cell === '' || cell === '—') return null;
  const n = Number(cell);
  return Number.isFinite(n) ? n : null;
}

/** Parses the first table whose header starts with `| Distance | Ceiling before (m/s)`. */
function parseCeilingBeforeTableFrom(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('| Distance | Ceiling before (m/s)'));
  if (start === -1) return null;
  const out = {};
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = tableCells(lines[i]);
    const pop = cells[cells.length - 1].split('->')[0].trim();
    out[cells[0]] = { ceiling: parseNumberCell(cells[1]), population: parseNumberCell(pop) };
  }
  return out;
}

export function parseRecalibrationBefore(markdownText) {
  return parseCeilingBeforeTableFrom(markdownText);
}

export function parseDiffArtifact(markdownText) {
  const reinst = markdownText.match(/^- Reinstated: (\d+) \((\d+) absolute-guard, (\d+) ceiling\)/m);
  const parsed = {
    movedButRanked: headlineInt(markdownText, /^- Moved but still ranked: (\d+)/m),
    newlyDemoted: headlineInt(markdownText, /^- Newly demoted: (\d+)/m),
    reinstatedTotal: reinst ? Number(reinst[1]) : null,
    reinstatedAbsoluteGuard: reinst ? Number(reinst[2]) : null,
    reinstatedCeiling: reinst ? Number(reinst[3]) : null,
    demotedGuardChanged: headlineInt(markdownText, /^- Demoted before and after, guard changed: (\d+)/m),
    unchanged: headlineInt(markdownText, /^- Unchanged: (\d+)/m),
    ownerExcluded: headlineInt(markdownText, /^- Owner-excluded, omitted from the five populations above: (\d+)/m),
    reinstatedTable: null,
    ceilingBefore: parseCeilingBeforeTableFrom(markdownText),
    oldRankRows: {},
  };

  const lines = markdownText.split('\n');
  const tStart = lines.findIndex(
    (l) => l.trim() === '| Distance | Absolute-guard reinstatements | Ceiling reinstatements |'
  );
  if (tStart !== -1) {
    parsed.reinstatedTable = {};
    for (let i = tStart + 2; i < lines.length && lines[i].startsWith('|'); i++) {
      const c = tableCells(lines[i]);
      parsed.reinstatedTable[c[0]] = { absoluteGuard: parseNumberCell(c[1]), ceiling: parseNumberCell(c[2]) };
    }
  }

  let inRank = false;
  let dist = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      inRank = line.trim() === '## Rank Changes';
      dist = null;
      continue;
    }
    if (!inRank) continue;
    if (line.startsWith('### ')) {
      dist = line.slice(4).trim();
      parsed.oldRankRows[dist] = [];
      continue;
    }
    if (dist && /^\|\s*\d+\s*\|/.test(line)) {
      const c = tableCells(line);
      parsed.oldRankRows[dist].push({ rank: Number(c[0]), activityId: c[1], durationText: c[3] });
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Pure: reconciliation
// ---------------------------------------------------------------------------

function fmtCeiling(c) {
  return c == null ? '—' : c.toFixed(4);
}

/** Compares the pre-phase document's own ceilings to a parsed "Ceiling before" table. */
export function compareCeilingsBefore(oldCeilings, table, label) {
  if (table == null) {
    return [{ check: `ceiling before (table) vs ${label}`, derived: 'present', artifact: null, agrees: false }];
  }
  const rows = [];
  for (const d of TARGET_ORDER_LOCAL) {
    const hasOld = oldCeilings != null && oldCeilings[d] != null;
    const hasArt = table[d] != null;
    if (!hasOld && !hasArt) continue;
    const derived = hasOld
      ? `${fmtCeiling(oldCeilings[d].ceilingMps)} (N=${oldCeilings[d].populationN})`
      : null;
    const artifact = hasArt ? `${fmtCeiling(table[d].ceiling)} (N=${table[d].population})` : null;
    rows.push({
      check: `ceiling before ${d} vs ${label}`,
      derived,
      artifact,
      agrees: derived !== null && artifact !== null && derived === artifact,
    });
  }
  return rows;
}

function sum(byDistance) {
  return TARGET_ORDER_LOCAL.reduce((s, d) => s + byDistance[d], 0);
}

function row(check, derived, artifact) {
  return { check, derived, artifact, agrees: artifact !== null && artifact !== undefined && derived === artifact };
}

export function reconcileBeforeState(derived, parsed, oldDoc) {
  const rows = [];
  const absTotal = sum(derived.reinstated.absoluteGuard);
  const ceilTotal = sum(derived.reinstated.ceiling);
  rows.push(row('reinstated (total)', absTotal + ceilTotal, parsed.reinstatedTotal ?? null));
  rows.push(row('absolute-guard reinstatements (total)', absTotal, parsed.reinstatedAbsoluteGuard ?? null));
  rows.push(row('ceiling reinstatements (total)', ceilTotal, parsed.reinstatedCeiling ?? null));
  for (const d of TARGET_ORDER_LOCAL) {
    const t = parsed.reinstatedTable ? parsed.reinstatedTable[d] : null;
    rows.push(row(`absolute-guard reinstatements (${d})`, derived.reinstated.absoluteGuard[d], t ? t.absoluteGuard : null));
    rows.push(row(`ceiling reinstatements (${d})`, derived.reinstated.ceiling[d], t ? t.ceiling : null));
  }
  rows.push(row('newly demoted (total)', sum(derived.newlyDemoted), parsed.newlyDemoted ?? null));
  rows.push(row('demoted-guard-changed (total)', sum(derived.demotedGuardChanged), parsed.demotedGuardChanged ?? null));
  rows.push(row('moved-but-ranked (total)', sum(derived.movedButRanked), parsed.movedButRanked ?? null));
  rows.push(row('unchanged (total)', sum(derived.unchanged), parsed.unchanged ?? null));
  rows.push(row('owner-excluded (total)', sum(derived.excluded), parsed.ownerExcluded ?? null));
  rows.push(row('pairs only in the pre-phase document', derived.onlyInOld, 0));
  rows.push(row('pairs only in the current document', derived.onlyInNew, 0));
  rows.push(row('OLD demotion guards not recognised', derived.unknownOldGuard, 0));

  for (const d of TARGET_ORDER_LOCAL) {
    const rendered = (parsed.oldRankRows ?? {})[d] ?? [];
    for (const r of rendered) {
      const actual = oldDoc.rankings?.[d]?.[r.rank - 1];
      const dText = actual && typeof actual.durationSec === 'number' ? actual.durationSec.toFixed(1) : null;
      const derivedText = actual ? `${actual.activityId} ${dText}` : null;
      const artifactText = `${r.activityId} ${r.durationText}`;
      rows.push({
        check: `old rank ${d} #${r.rank}`,
        derived: derivedText,
        artifact: artifactText,
        agrees: derivedText !== null && derivedText === artifactText,
      });
    }
  }

  rows.push(...compareCeilingsBefore(oldDoc.ceilings, parsed.ceilingBefore ?? null, '36-DIFF.md'));
  rows.push(
    ...compareCeilingsBefore(oldDoc.ceilings, parsed.recalibrationBefore ?? null, '36-CEILING-RECALIBRATION.md')
  );

  return { rows, ok: rows.every((r) => r.agrees) };
}

// ---------------------------------------------------------------------------
// Pure: zero-import source guard
// ---------------------------------------------------------------------------

const FORBIDDEN_SUFFIXES = ['compute-clean-window-diff.mjs', 'compute-ceiling-recalibration.mjs'];

/** Returns one hit per static or dynamic import whose specifier names a forbidden script. */
export function findForbiddenImports(sourceText) {
  const stripped = sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  const hits = [];
  const patterns = [/\bimport\b[^'"`;]*?\bfrom\s*['"`]([^'"`]+)['"`]/g, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g];
  for (const re of patterns) {
    for (const m of stripped.matchAll(re)) {
      if (FORBIDDEN_SUFFIXES.some((s) => m[1].endsWith(s))) hits.push(m[0]);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { preDist: null, diff: DEFAULT_DIFF_PATH };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pre-phase-dist') args.preDist = argv[++i];
    else if (argv[i] === '--diff') args.diff = resolve(argv[++i]);
  }
  return args;
}

const USAGE =
  'Usage: node scripts/compute-clean-window-before-state.mjs --pre-phase-dist <dir> [--diff <path>]\n' +
  'Build the pre-phase tree first: git worktree add --detach <tmp>/prephase ebe0245c; symlink node_modules;\n' +
  'npx tsc -p <tmp>/prephase/tsconfig.json; then pass <tmp>/prephase/dist. See this file\'s docblock.';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const preModule = args.preDist ? join(resolve(args.preDist), 'analytics', 'compute-best-efforts.js') : null;
  if (!preModule || !existsSync(preModule)) {
    console.error(`pre-phase dist missing or has no analytics/compute-best-efforts.js\n${USAGE}`);
    process.exitCode = 2;
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'before-state-leg-'));
  try {
    const pre = await import(pathToFileURL(preModule).href);
    const oldDoc = await pre.computeBestEfforts({
      statsDir: join(tempDir, 'old-stats'),
      ceilingStatePath: join(tempDir, 'old-ceiling.json'),
    });
    const cur = await import(
      pathToFileURL(join(ROOT_DIR, 'dist', 'analytics', 'compute-best-efforts.js')).href
    );
    const newDoc = await cur.computeBestEfforts({
      statsDir: join(tempDir, 'new-stats'),
      ceilingStatePath: join(tempDir, 'new-ceiling.json'),
    });

    const diffText = readFileSync(args.diff, 'utf8');
    const recalText = readFileSync(RECALIBRATION_PATH, 'utf8');

    console.log(
      `\npre-phase document carries ceilings: ${oldDoc.ceilings != null}, rankings: ${oldDoc.rankings != null}`
    );
    const derived = deriveBeforeAfterBuckets(oldDoc, newDoc);
    const parsed = parseDiffArtifact(diffText);
    parsed.recalibrationBefore = parseRecalibrationBefore(recalText);
    const result = reconcileBeforeState(derived, parsed, oldDoc);

    console.log('\nReconciliation rows (check | derived | artifact | agrees):');
    for (const r of result.rows) {
      console.log(`  ${r.check} | derived=${r.derived} | artifact=${r.artifact} | agrees=${r.agrees}`);
    }
    console.log('\nCeiling-reinstated pairs (activityId, OLD duration s, NEW duration s):');
    for (const d of TARGET_ORDER_LOCAL) {
      const list = derived.ceilingPairs[d];
      console.log(`  ${d}: ${list.length}`);
      for (const p of list) console.log(`    ${p.activityId} ${p.oldDurationSec} -> ${p.newDurationSec}`);
    }
    console.log(`\nonlyInOld=${derived.onlyInOld} onlyInNew=${derived.onlyInNew}`);

    const bad = result.rows.filter((r) => !r.agrees).length;
    if (result.ok) {
      console.log('BEFORE-STATE LEG: OK');
    } else {
      console.log(`BEFORE-STATE LEG: FAIL (${bad} disagreement(s))`);
      process.exitCode = 1;
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`FAILED: ${err.stack ?? err}`);
    process.exitCode = 2;
  });
}
