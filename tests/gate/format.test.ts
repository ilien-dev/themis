import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, firstLine, formatAsk, formatAudit, formatNotes, metrics, snippet } from '../../hooks/gate/format.ts';
import type { Rule, Verdict } from '../../hooks/gate/types.ts';

const rule = (text: string, kind: Rule['kind'] = 'item', line = 1): Rule => ({ text, kind, line, lines: text.split('\n').length });
const keep = (text: string, notes: Verdict['notes'] = [], kind: Rule['kind'] = 'item'): Verdict =>
  ({ rule: rule(text, kind), verdict: 'keep', code: null, question: null, evidence: '', notes });
const CUT: Verdict = { rule: rule('- Write clean code.', 'item', 3), verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'phrases: generic "Write clean code"', notes: [] };
const MOVE: Verdict = {
  rule: rule('- Never run `npm publish`.', 'item', 4), verdict: 'move', code: 'absolute-command', question: 5,
  evidence: 'absolute "Never" with `npm publish`', target: 'permissions.deny or a hook', notes: [],
};

test('formatAsk names each interrupted rule with its verdict, code, question and evidence', () => {
  assert.equal(formatAsk([CUT, keep('- Amounts are cents.'), MOVE], 'CLAUDE.md'), [
    'themis: 2 of 3 new rules in CLAUDE.md may not be needed.',
    '',
    '  "- Write clean code."',
    '  cut · generic-advice · question 3',
    '  phrases: generic "Write clean code"',
    '',
    '  "- Never run `npm publish`."',
    '  move · absolute-command · question 5',
    '  absolute "Never" with `npm publish` → permissions.deny or a hook',
    '',
    'Approve to add them as written; themis will remember the choice. Deny to drop the edit.',
  ].join('\n'));
  assert.equal(formatAsk([keep('- Amounts are cents.')], 'CLAUDE.md'), '');
});

test('a snippet is the first line, at most 100 characters', () => {
  assert.equal(snippet('first line\nsecond'), 'first line');
  assert.equal(snippet('```text\nledger/\n├── src/\n```'), 'ledger/');
  assert.equal(snippet('```\n```'), '```');
  assert.equal(firstLine('```text\nledger/\n```'), '```text'); // the ask shows the first line as written
  assert.equal(firstLine(`- ${'x'.repeat(200)}`).length, 100);
  const long = snippet(`- ${'x'.repeat(200)}`);
  assert.equal(long.length, 100);
  assert.ok(long.endsWith('…'));
});

test('formatNotes is empty without notes and explains each note otherwise', () => {
  assert.equal(formatNotes([CUT, keep('- Amounts are cents.')]), '');
  const accepted: Verdict = { ...keep('- Write clean code.', ['accepted']), original: { verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'e' } };
  assert.equal(formatNotes([keep('- Never use floats.', ['no-evidence', 'absolute-no-reason']), accepted]), [
    'themis: notes on rules kept as written:',
    '  "- Never use floats.": no-evidence (nothing in the repository backs it), absolute-no-reason (an absolute without a reason)',
    '  "- Write clean code.": accepted (approved earlier despite cut · generic-advice)',
  ].join('\n'));
});

test('formatAudit escapes table cells and ends with the coverage line, headings not counted', () => {
  const pipe = keep('- Use `a | b` here.', []);
  const out = formatAudit([keep('# Title', [], 'heading'), CUT, pipe, keep('- Nothing known.', ['no-evidence'])]);
  assert.match(out, /^\| 1 \| - Use `a \\\| b` here\. \| keep \|/m);
  assert.match(out, /^\| 3 \| - Write clean code\. \| cut \| generic-advice \| 3 \| phrases: generic "Write clean code" \| {2}\|$/m);
  assert.match(out, /\nCoverage: 2 of 3 rules \(66\.7%\) matched a table or the repository\.$/);
  assert.deepEqual(coverage([keep('# T', [], 'heading')]), { covered: 0, total: 0 });
});

test('metrics: precision over interrupted rules, false cuts over rules to keep, coverage over all', () => {
  const m = metrics([
    { expect: 'cut', got: CUT },
    { expect: 'keep', got: MOVE }, // a false cut
    { expect: 'keep', got: keep('- a', ['no-evidence']) },
    { expect: 'keep', got: keep('- b', []) },
    { expect: 'move', got: keep('- c', []) }, // a miss: not interrupted
  ]);
  assert.equal(m.interrupted, 2);
  assert.equal(m.precision, 0.5);
  assert.equal(m.falseCut, 1 / 3);
  assert.equal(m.coverage, 4 / 5);
  assert.deepEqual(m.byVerdict, { cut: { n: 1, correct: 1 }, move: { n: 1, correct: 0 }, keep: { n: 3, correct: 2 } });
  const none = metrics([]);
  assert.equal(none.precision, null);
  assert.equal(none.falseCut, null);
});
