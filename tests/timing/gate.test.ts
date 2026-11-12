import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseRule, CorpusRunner, type Case } from '../../hooks/gate/corpus.ts';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts, type Facts } from '../../hooks/gate/facts.ts';
import { describedPath, describedScript, projectOverview, q1, stackList } from '../../hooks/gate/checks/q1.ts';
import { q2 } from '../../hooks/gate/checks/q2.ts';
import { q3 } from '../../hooks/gate/checks/q3.ts';
import { contextFor, judgeAll } from '../../hooks/gate/verdict.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from '../gate/helpers.ts';
import { best, show, timed } from './helpers.ts';

// The wall-clock budgets of the gate. They run alone, after the parallel suite (see the test script).
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runner = new CorpusRunner(root);
after(() => { runner.dispose(); });

const factsCache = new Map<string, Facts>();
function factsOf(files: Record<string, string>): Facts {
  const key = JSON.stringify(files);
  let f = factsCache.get(key);
  if (f === undefined) { f = readFacts(join(repo(files), 'CLAUDE.md')); factsCache.set(key, f); }
  return f;
}

const README = '# Ledger\n\n[![build](https://img.shields.io/x.svg)](https://ci)\n\nLedger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses, and produces monthly reports as PDF files.\n\n## Install\n\nnpm install ledger\n';
const SUMMARY = 'Ledger is a bookkeeping service for freelancers that tracks invoices, payments and expenses and produces monthly PDF reports.';
const EVENTS = { 'package.json': '{"name":"events","devDependencies":{"jest":"^29","eslint":"^9","prettier":"^3","husky":"^9"},"dependencies":{"zod":"^3","tsconfig-paths":"^4","debug":"^4","colors":"^1","express":"^4","ms":"^2","pino":"^9"}}' };

// Every detector on a large repository.
// The whole path, facts read inside the timed loop, with paths off and on. With paths on the cited files are
// real files of 20-30 KB on disk, so their reads are timed too.
test('200 varied rules over a repository of 2,000 files are judged in under 200 ms, paths off and on', () => {
  const files: string[] = ['package.json', 'README.md'];
  for (let i = 0; files.length < 2000; i++) files.push(`packages/p${i % 40}/src/module${i}.ts`);
  const disk: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'big', description: 'A big monorepo of packages for testing', scripts: { build: 'tsc -b', 'db:backup': 'node db/backup.mjs' },
      dependencies: { react: '^19', next: '^15', zod: '^3', pino: '^9' } }),
    'README.md': README,
  };
  // 300 of the listed files on disk, 20-30 KB each.
  for (let i = 0; i < 300; i++) disk[files[i + 2] ?? ''] = `// Parses the input of module ${i}\n${'export const value = parseInput(raw);\n'.repeat(500 + (i % 10) * 25)}`;
  const dir = repo(disk);
  const cited = Array.from({ length: 40 }, (_, i) => `- \`${files[i + 2] ?? ''}\` — Parses the input`);
  const samples = [
    '- **Stack**: Next.js 15 · Zod', '- `npm run db:backup` - Create database backup', SUMMARY, '# CLAUDE.md',
    'This file provides guidance to Claude Code when working with code in this repository.', '- Keep the legacy code as it is', '- **pino**: Fast logger',
    '- Never commit secrets.', '- Money is stored in integer cents', '- Jest, ESLint and Prettier',
  ];
  const rules = Array.from({ length: 200 }, (_, i) => (i % 5 === 0 ? cited[(i / 5) % 40] : samples[i % samples.length]) ?? '');
  const markdown = rules.join('\n\n');
  const measured: string[] = [];
  for (const paths of [false, true]) {
    let cut = 0;
    const runs = timed(() => {
      const facts = readFacts(join(dir, 'CLAUDE.md'), { files });
      const verdicts = judgeAll(parseRules(markdown), facts, contextFor(facts, { paths }));
      assert.equal(verdicts.length, 200);
      cut = verdicts.filter((v) => v.code === 'inferable-path').length;
    });
    assert.equal(cut, paths ? 40 : 0);
    measured.push(`paths ${paths ? 'on' : 'off'}: ${show(runs)} ms`);
    assert.ok(best(runs) < 200, measured.join('; '));
  }
  console.log(`# timing ${measured.join('; ')}`);
});
test('runs of spaces, dots and separators keep every detector fast', () => {
  const facts = factsOf({ ...EVENTS, 'README.md': README, 'lib/a.js': '' });
  for (const filler of [' ', '.', '+', 'a', '-', ':', '(']) {
    for (const prefix of ['- `lib/a.js` — ', '- **Stack**: Jest', '- `npm run x` - ', 'Ledger ', '- Jest, ']) {
      for (const len of [590, 20_000]) {
        const rule = parseRules(`${prefix}${filler.repeat(len)}x`)[0];
        assert.ok(rule !== undefined);
        const runs = timed(() => { for (const check of [describedPath, stackList, describedScript, projectOverview, q3]) check(rule, facts); });
        assert.ok(best(runs) < 50, `${JSON.stringify(prefix)} + ${len} x ${JSON.stringify(filler)}: ${show(runs)} ms`);
      }
    }
  }
});

// The largest CLAUDE.md among the eval fixtures, judged as the hook would: facts read, then every rule.
test('judging the largest fixture takes under 200 ms', () => {
  const cases = join(root, 'evals/cases');
  const fixtures = readdirSync(cases).map((d) => join('evals/cases', d, 'fixture')).filter((d) => {
    try { return statSync(join(root, d, 'CLAUDE.md')).isFile(); } catch { return false; }
  });
  const largest = fixtures.sort((a, b) => statSync(join(root, b, 'CLAUDE.md')).size - statSync(join(root, a, 'CLAUDE.md')).size)[0];
  assert.ok(largest !== undefined);
  const dir = runner.dirFor(largest);
  const markdown = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const runs = timed(() => {
    const facts = readFacts(join(dir, 'CLAUDE.md'));
    const verdicts = judgeAll(parseRules(markdown), facts, contextFor(facts));
    assert.ok(verdicts.length > 50);
  });
  assert.ok(best(runs) < 200, `${largest}: ${show(runs)} ms`);
});

test('a 20,000-character single-line rule is judged in under 200 ms', () => {
  // Varied content so every check gets past its first test: spans, paths, an absolute, a technology,
  // phrases of the tables and a README in the repository.
  const parts = [
    'Write clean code and handle errors properly', 'never run `npm run build` while `npm run dev` runs',
    'see `src/lib/api.ts` and `docs/checkout.md`', 'use single quotes', 'the basket is stored in local storage',
    'IMPORTANT this file gives you context about the Shop project', 'think step by step', 'We use React',
  ];
  let text = '- ';
  for (let i = 0; text.length < 20_000; i++) text += `${parts[i % parts.length] ?? ''}; `;
  const c: Case = { id: 'long', repo: 'tests/gate/repos/shop', file: 'CLAUDE.md', rule: text, expect: 'keep' };
  const { facts, ctx } = runner.factsFor(c);
  const rule = caseRule(c);
  assert.equal(rule.lines, 1);
  const runs = timed(() => { judgeAll([rule], facts, ctx); });
  assert.ok(best(runs) < 200, `${show(runs)} ms`);
});

// q1: the answer of q1 to the first rule of `text` in a repository holding `files`.
function ask1(text: string, files: Record<string, string>): Answer | null {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  return q1(rule, readFacts(join(repo(files), 'CLAUDE.md')));
}
const REACT = { 'package.json': '{"name":"app","dependencies":{"react":"^18"}}', 'src/app.tsx': '' };
test('a long single-line rule is answered quickly (q1)', () => {
  const runs = timed(() => { ask1(`We use ${'word '.repeat(4000)}`, REACT); });
  assert.ok(best(runs) < 1000, `${show(runs)} ms`);
});

// q2: the answer of q2 to the first rule of `text` in a repository holding `files`.
function ask2(text: string, files: Record<string, string>, settings?: unknown): Answer | null {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  const all = settings === undefined ? files : { ...files, '.claude/settings.json': JSON.stringify(settings) };
  return q2(rule, readFacts(join(repo(all), 'CLAUDE.md')));
}
const prettier = (cfg: string): Record<string, string> => ({ 'package.json': '{"name":"app","scripts":{"format":"prettier --check ."}}', '.prettierrc': cfg });
const deny = (...entries: string[]): unknown => ({ permissions: { deny: entries } });
test('a long single-line rule is answered quickly (q2)', () => {
  const p = prettier('{"semi":true}');
  const runs = timed(() => {
    ask2(`Use semicolons ${'and the '.repeat(4000)}`, p);
    ask2(`Never run \`${'git '.repeat(4000)}\``, p, deny('Bash(git:*)'));
    ask2('indent with '.repeat(3000), p);
  });
  assert.ok(best(runs) < 1000, `${show(runs)} ms`);
});

// q3
test('patterns stay linear on adversarial input', () => {
  const facts = readFacts(join(repo({ 'package.json': '{"name":"app"}' }), 'CLAUDE.md'));
  const ask = (text: string): Answer | null => {
    const rule = parseRules(text)[0];
    if (rule === undefined) throw new Error('no rule parsed');
    return q3(rule, facts);
  };
  const runs = timed(() => {
    for (const t of [
      `This file gives ${'x '.repeat(20000)}`,
      `write ${'clean, '.repeat(20000)}`,
      'think '.repeat(20000),
      `Remember to ${'keep the code quality high and '.repeat(5000)}`,
      `handle ${'errors '.repeat(20000)}`,
    ]) ask(t);
  });
  assert.ok(best(runs) < 2000, `${show(runs)} ms`);
});
