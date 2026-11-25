/**
 * Structure guard for .github/workflows/daily-refresh.yml (Phase 36.1, L-02).
 *
 * Asserts checkWorkflow() is clean on the REAL workflow, then plants one
 * mutation per rule into the real text (String.replace) and asserts the guard
 * names that rule. Each mutation asserts mutated !== original first, so a
 * mutation whose target text vanished fails loudly instead of passing
 * vacuously. Read-only: nothing here writes to a tracked file.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkWorkflow, splitSteps } from './lib/workflow-gates.mjs';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const real = readFileSync(resolve(REPO_ROOT, '.github/workflows/daily-refresh.yml'), 'utf8');
const SKIP = '[skip' + ' ci]';

/** Cut the text from `startMarker` up to (not including) `endMarker` (or EOF). */
function cut(text, startMarker, endMarker) {
  const a = text.indexOf(startMarker);
  if (a < 0) return null;
  const b = endMarker ? text.indexOf(endMarker, a) : text.length;
  if (b < 0) return null;
  return { before: text.slice(0, a), piece: text.slice(a, b), after: text.slice(b) };
}

function expectRule(mutated, rule) {
  expect(mutated).not.toBe(real);
  const rules = checkWorkflow(mutated).map((x) => x.rule);
  expect(rules).toContain(rule);
}

describe('daily-refresh.yml structure', () => {
  it('splitSteps throws on a file with no steps', () => {
    expect(() => splitSteps('name: x\n')).toThrow();
  });

  it('real workflow satisfies every rule', () => {
    expect(checkWorkflow(real)).toEqual([]);
  });

  it('ARCHIVE-REPORTED: dropping continue-on-error from archive_pinned', () => {
    const mutated = real.replace(/(id: archive_pinned\n) +continue-on-error: true[^\n]*\n/, '$1');
    expectRule(mutated, 'ARCHIVE-REPORTED');
  });

  it('ARCHIVE-REPORTED: dropping shell: bash from archive_pinned', () => {
    expectRule(real.replace(/^ {8}shell: bash\n/m, ''), 'ARCHIVE-REPORTED');
  });

  it('FINAL-RED: moving the final step before Deploy', () => {
    const f = cut(real, '      - name: Fail the run if archive-pinned', null);
    expect(f).not.toBeNull();
    const without = f.before;
    const at = without.indexOf('      - name: Deploy widgets');
    const mutated = without.slice(0, at) + f.piece + '\n' + without.slice(at);
    expectRule(mutated, 'FINAL-RED');
  });

  it('NO-BARE-TEST: restoring npm test in place of test:logic', () => {
    expectRule(real.replace('run: npm run test:logic', 'run: npm test'), 'NO-BARE-TEST');
  });

  it('LOGIC-BLOCKING: adding continue-on-error to the logic step', () => {
    expectRule(
      real.replace(/(- name: Run logic tests[^\n]*\n)/, '$1        continue-on-error: true\n'),
      'LOGIC-BLOCKING',
    );
  });

  it('DEPLOY-INDEPENDENT: adding an if on archive_pinned to Deploy', () => {
    expectRule(
      real.replace(
        '      - name: Deploy widgets to GitHub Pages\n',
        "      - name: Deploy widgets to GitHub Pages\n        if: steps.archive_pinned.outcome == 'success'\n",
      ),
      'DEPLOY-INDEPENDENT',
    );
  });

  it('EARLY-COMMIT: moving commit_fetched after Compile TypeScript', () => {
    const c = cut(real, '      - name: Commit fetched data', '      - name: Warn on early commit failure');
    expect(c).not.toBeNull();
    const rest = c.before + c.after;
    const at = rest.indexOf('      - name: Compute all statistics');
    expectRule(rest.slice(0, at) + c.piece + rest.slice(at), 'EARLY-COMMIT');
  });

  it('EARLY-COMMIT: removing the skip-ci token from the commit_fetched message', () => {
    expectRule(
      real.replace(`'chore: commit fetched activities ${SKIP}'`, "'chore: commit fetched activities'"),
      'EARLY-COMMIT',
    );
  });

  // 36.1 WR-02: four mutations that each returned [] before the fix.
  it('NO-BARE-TEST: an unnamed `- run:` step invoking vitest is its own step and is flagged', () => {
    const mutated = real.replace(
      '      - name: Verify dashboard publish contract\n',
      '      - run: npx vitest run\n\n      - name: Verify dashboard publish contract\n',
    );
    expect(splitSteps(mutated)).toHaveLength(splitSteps(real).length + 1);
    expectRule(mutated, 'NO-BARE-TEST');
  });

  it('NO-BARE-TEST: an unnamed `- uses:` step does not swallow the next step', () => {
    const mutated = real.replace(
      '      - name: Run logic tests (blocking)\n',
      '      - uses: actions/cache@v4\n      - name: Run logic tests (blocking)\n',
    );
    expect(splitSteps(mutated)).toHaveLength(splitSteps(real).length + 1);
    expect(checkWorkflow(mutated)).toEqual([]);
  });

  it('ARCHIVE-REPORTED: `shell: bash {0}` on archive_pinned (no pipefail)', () => {
    const mutated = real.replace(/(id: archive_pinned\n(?: {8}[^\n]*\n)*? {8}shell: )bash\n/, '$1bash {0}\n');
    expectRule(mutated, 'ARCHIVE-REPORTED');
  });

  it('ARCHIVE-REPORTED: `|| true` on the archive_pinned run body', () => {
    expectRule(real.replace('2>&1 | tee archive-pinned.log', '2>&1 | tee archive-pinned.log || true'), 'ARCHIVE-REPORTED');
  });

  it('EARLY-COMMIT: an if: on commit_fetched', () => {
    expectRule(
      real.replace('        id: commit_fetched\n', '        id: commit_fetched\n        if: false\n'),
      'EARLY-COMMIT',
    );
  });

  it.each([
    ['|| true', 'run: npm run test:logic || true'],
    ['|| :', 'run: npm run test:logic || :'],
    ['set +e', 'run: |\n          set +e\n          npm run test:logic'],
    ['; true', 'run: npm run test:logic; true'],
  ])('LOGIC-BLOCKING: exit suppression %s on the logic step', (_label, replacement) => {
    expectRule(real.replace('run: npm run test:logic', replacement), 'LOGIC-BLOCKING');
  });

  it('NO-INLINE-INPUTS: interpolating an input into a run body', () => {
    expectRule(
      real.replace('        run: npm run build\n', '        run: echo "${{ inputs.exclude_reason }}"\n'),
      'NO-INLINE-INPUTS',
    );
  });
});
