import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts } from '../../hooks/gate/facts.ts';
import type { Answer, Rule } from '../../hooks/gate/types.ts';
import { citedPaths, citedScripts, hasAnchor, hasReason, ruleHash, similarity, spans, words } from '../../hooks/gate/text.ts';
import { interrupts, judge, judgeAll, type Context, type RegisteredCheck } from '../../hooks/gate/verdict.ts';
import { repo } from './helpers.ts';

function rule(text: string): Rule {
  const r = parseRules(text)[0];
  if (r === undefined) throw new Error('no rule parsed');
  return r;
}
const dir = repo({ 'package.json': '{"scripts":{"lint":"eslint ."}}', 'src/money.js': '' });
const facts = readFacts(join(dir, 'CLAUDE.md'));
const ctx: Context = { accepted: new Map(), techNames: ['Express'] };
const answer = (question: Answer['question'], code = 'x'): Answer => ({ verdict: 'cut', code, question, evidence: 'e' });

test('similarity ignores repetition and case', () => {
  assert.equal(similarity('Ledger tracks invoices and payments.', 'ledger tracks invoices and payments ledger tracks invoices and payments'), 1);
  assert.ok(similarity('run the unit tests first', 'deploy to the staging cluster') < 0.1);
  assert.equal(similarity('two words', 'two words'), 0);
});
test('words drops list markers and punctuation', () => {
  assert.deepEqual(words('- Use `npm test`, then STOP.'), ['use', 'npm', 'test', 'then', 'stop']);
  assert.deepEqual(words('1. First step'), ['first', 'step']);
});
test('spans returns the content of each code span', () => {
  assert.deepEqual(spans('run `npm test` and `src/a.ts`'), ['npm test', 'src/a.ts']);
});
test('citedPaths skips urls, globs and versions, accepts backslashes', () => {
  assert.deepEqual(citedPaths('see `https://x.dev/a`, `src/**/*.ts`, `v2.1/3 beta`, `src\\money.js`'),['src/money.js']);
});
test('citedScripts reads package manager invocations', () => {
  assert.deepEqual(citedScripts('run `npm run lint`, `pnpm build`, `npm test` or `npm install`'), [
    { pm: 'npm', script: 'lint' }, { pm: 'pnpm', script: 'build' }, { pm: 'npm', script: 'test' },
  ]);
});
test('hasReason and hasAnchor', () => {
  assert.ok(hasReason('Avoid it because it is slow')); assert.ok(hasReason('Evita eso porque rompe'));
  assert.ok(hasReason('Keep it small; reviews get harder')); assert.ok(!hasReason('Never touch it'));
  assert.ok(hasAnchor('see `x`', [])); assert.ok(hasAnchor('call parseRules first', [])); assert.ok(hasAnchor('use Express here', ['Express']));
  assert.ok(!hasAnchor('keep things tidy', ['Express']));
});
test('ruleHash ignores the list marker and spacing', () => {
  assert.equal(ruleHash('- Keep   it\n  small'), ruleHash('* Keep it small'));
  assert.match(ruleHash('x'), /^[0-9a-f]{16}$/);
});

test('no check answers: keep with notes', () => {
  const v = judge(rule('- All money values are integer cents; never floats.'), facts, ctx, []);
  assert.equal(v.verdict, 'keep'); assert.deepEqual([...v.notes].sort(), ['absolute-no-reason', 'no-anchor', 'no-evidence']);
});
test('a reason clears absolute-no-reason', () => {
  assert.ok(!judge(rule('- Never use floats for money because they lose cents.'), facts, ctx, []).notes.includes('absolute-no-reason'));
});
test('a known technology, an existing script or an existing path clears no-evidence', () => {
  assert.ok(!judge(rule('- Handlers use Express.'), facts, ctx, []).notes.includes('no-evidence'));
  assert.ok(!judge(rule('- Run `npm run lint` first.'), facts, ctx, []).notes.includes('no-evidence'));
  assert.ok(!judge(rule('- Money lives in `src/money.js`.'), facts, ctx, []).notes.includes('no-evidence'));
  assert.ok(judge(rule('- Run `npm run nope` first.'), facts, ctx, []).notes.includes('no-evidence'));
});
test('a heading that is kept has no notes', () => {
  assert.deepEqual(judge(rule('# Project rules'), facts, ctx, []).notes, []);
});
test('first answering check wins and later ones do not run', () => {
  const checks: RegisteredCheck[] = [
    { question: 1, run: () => null },
    { question: 2, run: () => answer(2, 'first') },
    { question: 3, run: () => { throw new Error('must not run'); } },
  ];
  const v = judge(rule('- Anything goes here.'), facts, ctx, checks);
  assert.equal(v.verdict, 'cut'); assert.equal(v.code, 'first'); assert.equal(v.question, 2); assert.equal(v.evidence, 'e'); assert.deepEqual(v.notes, []);
  assert.ok(interrupts(v)); assert.ok(!interrupts(judge(rule('- x'), facts, ctx, [])));
});
test('an accepted rule is kept with its original answer', () => {
  const r = rule('- Anything goes here.');
  const original = answer(2);
  const v = judge(r, facts, { ...ctx, accepted: new Map([[ruleHash(r.text), original]]) }, [{ question: 2, run: () => { throw new Error('must not run'); } }]);
  assert.equal(v.verdict, 'keep'); assert.deepEqual(v.notes, ['accepted']); assert.equal(v.original, original);
});
test('outside a repo only questions 3 and 7 apply', () => {
  const calls: number[] = [];
  const checks: RegisteredCheck[] = [1, 3, 7].map((q) => ({ question: q as 1 | 3 | 7, run: () => { calls.push(q); return null; } }));
  judge(rule('- Anything.'), { ...facts, inRepo: false }, ctx, checks);
  assert.deepEqual(calls, [3, 7]);
});
test('judgeAll judges every rule in order', () => {
  const rules = parseRules('- one\n- two\n');
  assert.deepEqual(judgeAll(rules, facts, ctx).map((v) => v.rule.text), ['- one', '- two']);
});
