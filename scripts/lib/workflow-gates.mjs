/**
 * Text-parse structure guard for .github/workflows/daily-refresh.yml
 * (Phase 36.1, L-02). Pure: takes the workflow text, returns a violations
 * array of { rule, detail }. No YAML library is installed, so steps are
 * split on every `      - ` list item inside a `steps:` block (named or
 * not: `- name:`, `- run:`, `- uses:`, `- id:` all start a step) and fields
 * are read by regex. Splitting only on `- name:` let an unnamed step merge
 * into its predecessor, invisible to every rule (36.1 WR-02).
 *
 * The skip-ci token is built by concatenation so this source never contains
 * the literal token.
 */

const SKIP_TOKEN = '[skip' + ' ci]';
const STEPS_KEY_RE = /^(\s*)steps:\s*(#.*)?$/;
const STEP_ITEM_RE = /^ {6}- (\S.*)$/;

/** Split the workflow into one block per step. Throws on 0 steps. */
export function splitSteps(text) {
  const lines = text.split('\n');
  const steps = [];
  let cur = null;
  let stepsIndent = -1; // indent of the active `steps:` key, -1 when outside one
  for (const line of lines) {
    const key = STEPS_KEY_RE.exec(line);
    if (key) {
      stepsIndent = key[1].length;
      cur = null;
      continue;
    }
    const live = line.trim() !== '' && !/^\s*#/.test(line);
    if (stepsIndent >= 0 && live && /^(\s*)/.exec(line)[1].length <= stepsIndent) {
      stepsIndent = -1; // left the steps block
      cur = null;
    }
    const m = stepsIndent >= 0 ? STEP_ITEM_RE.exec(line) : null;
    if (m) {
      // Normalise `      - key: v` to `        key: v` so every field, including
      // the first, is matched by the same `^\s+key:` regexes.
      cur = { lines: ['        ' + m[1]] };
      steps.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (steps.length === 0) throw new Error('splitSteps: workflow has 0 steps');
  return steps.map((s) => {
    // Comments between steps attach to the preceding block; drop them so
    // rules only ever see live YAML.
    const live = s.lines.filter((l) => !/^\s*#/.test(l));
    const body = live.join('\n');
    const named = /^ {8}name:\s*(.*)$/m.exec(body);
    const name = named ? named[1].trim() : `(unnamed step: ${live[0].trim()})`;
    return { name, raw: s.lines.join('\n'), body, run: extractRun(live) };
  });
}

function extractRun(liveLines) {
  const idx = liveLines.findIndex((l) => /^\s+run:/.test(l));
  if (idx < 0) return '';
  const indent = /^(\s*)/.exec(liveLines[idx])[1].length;
  const first = liveLines[idx].replace(/^\s+run:\s*/, '');
  const out = [];
  if (first && !/^[|>][-+]?$/.test(first)) out.push(first);
  for (let i = idx + 1; i < liveLines.length; i++) {
    const l = liveLines[i];
    if (l.trim() === '') { out.push(''); continue; }
    const ind = /^(\s*)/.exec(l)[1].length;
    if (ind <= indent) break;
    out.push(l.trim());
  }
  return out.join('\n');
}

const hasField = (s, re) => re.test(s.body);
const hasCoe = (s) => hasField(s, /^\s+continue-on-error:\s*true\b/m);
const hasIf = (s) => hasField(s, /^\s+if:/m);
const ifText = (s) => (/^\s+if:\s*(.*)$/m.exec(s.body) || [, ''])[1];
const runsTests = (s) => /npm (run )?test|vitest/.test(s.run);
const shellText = (s) => (/^\s+shell:\s*(.*?)\s*$/m.exec(s.body) || [, null])[1];
/** Shell-level exit suppression: `|| true`, `|| :`, `|| exit 0`, `set +e`. */
const SUPPRESS_RE = /\|\|\s*(true\b|:(?=\s|;|$)|exit\s+0\b)|\bset\s+\+[a-z]*e/m;

export function checkWorkflow(text) {
  const v = [];
  const add = (rule, detail) => v.push({ rule, detail });
  const steps = splitSteps(text);
  const idx = (pred) => steps.findIndex(pred);
  const byName = (prefix) => idx((s) => s.name.startsWith(prefix));
  const byId = (id) => idx((s) => new RegExp(`^\\s+id:\\s*${id}\\s*$`, 'm').test(s.body));

  const fetchIdx = byId('fetch');
  const compileIdx = byName('Compile TypeScript');
  const exclusionIdx = byName('Apply dispatched exclusion');
  const buildWidgetsIdx = byName('Build widgets');
  const verifyIdx = byName('Verify dashboard publish contract');
  const commitIdx = byName('Commit updated data and stats');
  const deployIdx = byName('Deploy');

  // EARLY-COMMIT
  const cf = byId('commit_fetched');
  if (cf < 0) {
    add('EARLY-COMMIT', 'no step with id: commit_fetched');
  } else {
    const s = steps[cf];
    if (!(cf > fetchIdx && fetchIdx >= 0)) add('EARLY-COMMIT', 'commit_fetched is not after the fetch step');
    const mustPrecede = [compileIdx, exclusionIdx];
    steps.forEach((t, i) => { if (runsTests(t)) mustPrecede.push(i); });
    for (const i of mustPrecede) {
      if (i < 0) add('EARLY-COMMIT', 'a step commit_fetched must precede was not found');
      else if (cf >= i) add('EARLY-COMMIT', `commit_fetched is not before "${steps[i].name}"`);
    }
    if (!hasCoe(s)) add('EARLY-COMMIT', 'commit_fetched lacks continue-on-error: true');
    if (hasIf(s)) add('EARLY-COMMIT', `commit_fetched has an if: (${ifText(s)}); it must always run`);
    const msg = /commit_message:\s*'([^']*)'/.exec(s.body);
    if (!msg || !msg[1].split('\n')[0].includes(SKIP_TOKEN)) add('EARLY-COMMIT', 'commit_message first line lacks the skip-ci token');
    const fp = /file_pattern:\s*'([^']*)'/.exec(s.body);
    for (const g of ['data/activities/*.json', 'data/sync-state.json', 'data/streams/*.json']) {
      if (!fp || !fp[1].includes(g)) add('EARLY-COMMIT', `file_pattern lacks ${g}`);
    }
  }

  // LOGIC-BLOCKING
  const logic = steps.map((s, i) => [s, i]).filter(([s]) => /npm run test:logic\b/.test(s.run));
  if (logic.length !== 1) {
    add('LOGIC-BLOCKING', `expected exactly one npm run test:logic step, found ${logic.length}`);
  } else {
    const [s, i] = logic[0];
    if (hasField(s, /^\s+continue-on-error:/m)) add('LOGIC-BLOCKING', 'logic step has continue-on-error');
    if (hasIf(s)) add('LOGIC-BLOCKING', 'logic step has an if:');
    // The run body must be the bare command: no pipe, chain, or suppression
    // can then hide the vitest exit code from the step outcome.
    if (!/^npm run test:logic(\s+[^|;&`$()\n]*)?$/.test(s.run.trim())) {
      add('LOGIC-BLOCKING', `logic step run body is not a single npm run test:logic command: ${s.run.trim()}`);
    }
    if (SUPPRESS_RE.test(s.run)) add('LOGIC-BLOCKING', 'logic step run body suppresses the exit code');
    const sh = shellText(s);
    if (sh !== null && sh !== 'bash') add('LOGIC-BLOCKING', `logic step has a non-default shell: ${sh}`);
    if (!(buildWidgetsIdx >= 0 && i > buildWidgetsIdx)) add('LOGIC-BLOCKING', 'logic step is not after Build widgets');
    for (const [label, j] of [['verify', verifyIdx], ['commit', commitIdx], ['deploy', deployIdx]]) {
      if (j < 0 || i >= j) add('LOGIC-BLOCKING', `logic step is not before the ${label} step`);
    }
  }

  // ARCHIVE-REPORTED
  const ap = steps.map((s, i) => [s, i]).filter(([s]) => /^\s+id:\s*archive_pinned\s*$/m.test(s.body));
  if (ap.length !== 1) {
    add('ARCHIVE-REPORTED', `expected exactly one id: archive_pinned step, found ${ap.length}`);
  } else {
    const [s] = ap[0];
    if (!hasCoe(s)) add('ARCHIVE-REPORTED', 'archive_pinned lacks continue-on-error: true');
    if (!/npm run test:archive\b/.test(s.run)) add('ARCHIVE-REPORTED', 'archive_pinned run lacks npm run test:archive');
    // Only the exact `shell: bash` gets GitHub's `-eo pipefail`; a custom
    // string such as `bash {0}` does not, so tee would hide the exit code.
    const sh = shellText(s);
    const pipefailInRun = /^\s*set\s+-[a-z]*o\s+pipefail\b/m.test(s.run);
    if (s.run.includes('|') && !(sh === 'bash' || ((sh === null || /^bash\b/.test(sh)) && pipefailInRun))) {
      add('ARCHIVE-REPORTED', `archive_pinned pipes output without exact shell: bash or set -o pipefail (shell: ${sh})`);
    }
    if (SUPPRESS_RE.test(s.run)) add('ARCHIVE-REPORTED', 'archive_pinned run body suppresses the exit code');
  }

  // FINAL-RED
  const finals = steps.filter((s, i) => deployIdx >= 0 && i > deployIdx && ifText(s).includes("steps.archive_pinned.outcome == 'failure'"));
  const okFinal = finals.some((s) => s.run.includes('GITHUB_STEP_SUMMARY') && s.run.includes('archive-failure-summary.mjs') && /\bexit 1\b/.test(s.run));
  if (!okFinal) add('FINAL-RED', 'no step after Deploy gated on archive_pinned failure that writes the summary and exits 1');

  // DEPLOY-INDEPENDENT
  if (deployIdx < 0) add('DEPLOY-INDEPENDENT', 'no Deploy step');
  else if (hasIf(steps[deployIdx])) add('DEPLOY-INDEPENDENT', 'Deploy step has an if:');
  for (const s of steps) {
    if (/^(Commit|Deploy)/.test(s.name) && s.body.includes('archive_pinned')) {
      add('DEPLOY-INDEPENDENT', `step "${s.name}" references archive_pinned`);
    }
  }

  // NO-BARE-TEST
  for (const s of steps) {
    for (const line of s.run.split('\n')) {
      const t = line.trim();
      if (/^npm (run )?test(\s|$)/.test(t) || (/\bvitest\b/.test(t) && !/--config/.test(t))) {
        add('NO-BARE-TEST', `step "${s.name}" runs a bare test command: ${t}`);
      }
    }
  }

  // NO-INLINE-INPUTS
  for (const s of steps) {
    if (/\$\{\{\s*inputs\./.test(s.run)) add('NO-INLINE-INPUTS', `step "${s.name}" interpolates inputs into a run body`);
  }

  return v;
}
