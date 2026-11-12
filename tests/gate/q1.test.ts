import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts } from '../../hooks/gate/facts.ts';
import { q1 } from '../../hooks/gate/checks/q1.ts';
import { CHECKS } from '../../hooks/gate/verdict.ts';
import { TECH, OBVIOUS_SCRIPTS, AFFIRM, NEGATION } from '../../hooks/gate/tables/alias.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from './helpers.ts';

const FIXTURE = 'evals/cases/c14-themis-audit/fixture';
const fixtureFile = (name: string): string => readFileSync(join(FIXTURE, name), 'utf8');

// The answer of q1 to the first rule of `text` in a repository holding `files`.
function ask(text: string, files: Record<string, string>): Answer | null {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  return q1(rule, readFacts(join(repo(files), 'CLAUDE.md')));
}

const REACT = { 'package.json': '{"name":"app","dependencies":{"react":"^18"}}', 'src/app.tsx': '' };
const PNPM = { 'package.json': '{"name":"app"}', 'pnpm-lock.yaml': '' };
const LINT = { 'package.json': '{"name":"app","scripts":{"lint":"eslint .","gen":"node gen.js","test":"node --test"}}' };

test('the table is registered and large enough', () => {
  assert.ok(TECH.length >= 40);
  assert.ok(OBVIOUS_SCRIPTS.includes('lint') && AFFIRM.length > 0 && NEGATION instanceof RegExp);
  assert.ok(CHECKS.some((c) => c.question === 1 && c.run === q1));
});

test('React as the only framework is inferable', () => {
  const a = ask('We use React.', REACT);
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-tech', question: 1, evidence: 'package.json: dependencies.react' });
});
test('the dependency group is named in the evidence', () => {
  const a = ask('This project is built with Vitest.', { 'package.json': '{"devDependencies":{"vitest":"^2"}}' });
  assert.equal(a?.evidence, 'package.json: devDependencies.vitest');
});
test('Spanish templates work', () => {
  assert.equal(ask('Usamos React.', REACT)?.code, 'inferable-tech');
  assert.equal(ask('Hecho con React.', REACT)?.code, 'inferable-tech');
});
test('a language is inferable when it is the first one of the repository', () => {
  const a = ask('Written in TypeScript.', REACT);
  assert.equal(a?.code, 'inferable-tech'); assert.match(a.evidence, /TypeScript/);
  assert.equal(ask('Written in JavaScript.', { 'a.ts': '', 'b.ts': '', 'c.js': '' }), null);
});
test('npm is inferable from its lockfile', () => {
  assert.equal(ask('Use npm.', { 'package-lock.json': '{}' })?.evidence, 'package-lock.json');
});
test('"Use pnpm, not npm." is not inferable', () => { assert.equal(ask('Use pnpm, not npm.', PNPM), null); });
test('"Use pnpm." is not inferable: it replaces the default', () => { assert.equal(ask('Use pnpm.', PNPM), null); });
test('two technologies of one category are not inferable', () => {
  assert.equal(ask('We use Jest.', { 'package.json': '{"devDependencies":{"jest":"1","vitest":"1"}}' }), null);
});
test('a negation is not inferable', () => {
  assert.equal(ask('Don\'t use Express for new routes.', { 'package.json': '{"dependencies":{"express":"4"}}' }), null);
  assert.equal(ask('No usamos React.', REACT), null);
});
test('a technology the repository lacks is not inferable', () => { assert.equal(ask('We use Vue.', REACT), null); });
test('more than three remaining words are not inferable', () => {
  const files = { 'package.json': '{"dependencies":{"react":"1","@tanstack/react-query":"1"}}' };
  assert.equal(ask('Use React Query for all server state, never useEffect fetches.', files), null);
  assert.equal(ask('We use React for every screen of the whole product.', REACT), null);
});

test('an obvious script that exists is inferable', () => {
  const a = ask('- Lint: `npm run lint`', LINT);
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-script', question: 1, evidence: 'package.json: scripts.lint' });
  assert.equal(ask('- Tests: `npm test`', LINT)?.code, 'inferable-script');
});
test('a script with arguments, a non-obvious or a missing script is not inferable', () => {
  assert.equal(ask('- Run a single test: `npm test -- money`', LINT), null);
  assert.equal(ask('- Generate schema: `npm run gen`', LINT), null);
  assert.equal(ask('- Build: `npm run build`', LINT), null);
  assert.equal(ask('- Lint, then test: `npm run lint` and `npm test`', LINT), null);
  assert.equal(ask('- Always run the linter before you push to the shared branch: `npm run lint`', LINT), null);
});

test('a heading with the package name is inferable', () => {
  const a = ask('# Ledger - Project Instructions for Claude', { 'package.json': '{"name":"ledger"}' });
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-title', question: 1, evidence: 'package.json: name' });
});
test('only the first paragraph of the file can be a title', () => {
  const files = { 'package.json': '{"name":"ledger"}' };
  assert.equal(ask('Ledger instructions for Claude', files)?.code, 'inferable-title');
  const second = parseRules('Intro text.\n\nLedger instructions for Claude')[1];
  assert.ok(second !== undefined);
  assert.equal(q1(second, readFacts(join(repo(files), 'CLAUDE.md'))), null);
});
test('a heading that matches the README title is inferable', () => {
  const files = { 'package.json': '{"name":"x"}', 'README.md': '# The Ledger Bookkeeping Service For Freelancers\n' };
  assert.equal(ask('# The Ledger Bookkeeping Service For Freelancers', files)?.code, 'inferable-title');
});
test('an unrelated heading is kept', () => { assert.equal(ask('# Testing rules', { 'package.json': '{"name":"ledger"}' }), null); });

test('the directory structure block of the c14 fixture is inferable', () => {
  const block = parseRules(fixtureFile('CLAUDE.md')).find((r) => r.kind === 'code' && r.text.includes('├'));
  assert.ok(block !== undefined);
  const dir = repo({ 'package.json': fixtureFile('package.json'), 'README.md': fixtureFile('README.md'), 'src/money.js': '' });
  const a = q1(block, readFacts(join(dir, 'CLAUDE.md')));
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-tree', question: 1, evidence: 'repository file tree' });
});
test('a list of existing paths with descriptions is inferable', () => {
  const files = { 'src/a.ts': '', 'tests/a.test.ts': '', 'docs/x.md': '' };
  const list = '1. `src/` - application code\n2. `tests/` - the tests\n3. `docs/` - documentation';
  assert.equal(ask(list, files)?.code, 'inferable-tree');
  assert.equal(ask('1. `src/` - application code\n2. `tests/` - the tests\n3. `nope/` - nothing', files), null);
  assert.equal(ask('1. `src/` - use it\n2. `tests/` - run them\n3. `docs/` - keep it updated', files), null);
});

const README = '# Ledger\n\nLedger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly reports.\n';
const OVERVIEW = { 'package.json': '{"name":"other"}', 'README.md': README };
test('an overview copied from the README is inferable', () => {
  const a = ask('Ledger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly reports.', OVERVIEW);
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-overview', question: 1, evidence: 'README.md' });
});
test('an overview with a span in it is kept', () => {
  assert.equal(ask('Ledger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly `reports`.', OVERVIEW), null);
});
test('an overview of one sentence is kept', () => {
  assert.equal(ask('Ledger is a small bookkeeping service for freelancers', OVERVIEW), null);
});

test('a long single-line rule is answered quickly', () => {
  const start = performance.now();
  ask(`We use ${'word '.repeat(4000)}`, REACT);
  assert.ok(performance.now() - start < 1000);
});
