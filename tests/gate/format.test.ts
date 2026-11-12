import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, firstLine, formatAsk, formatAudit, formatNotes, formatStaleVendor, metrics, snippet, staleVendor } from '../../hooks/gate/format.ts';
import { PHRASES } from '../../hooks/gate/tables/phrases.ts';
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
  assert.equal(formatAsk([CUT, keep('- Amounts are cents.'), MOVE], 'CLAUDE.md', 'ask'), [
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
  assert.equal(formatAsk([keep('- Amounts are cents.')], 'CLAUDE.md', 'ask'), '');
});

test('in report mode the trailer tells Claude to tell the user, not to drop rules', () => {
  const out = formatAsk([CUT, MOVE], 'CLAUDE.md', 'report');
  assert.ok(out.startsWith('themis: 2 of 2 new rules in CLAUDE.md may not be needed.'));
  assert.ok(out.endsWith('\n\nthemis did not block this edit. Tell the user which of these rules were flagged and why. ' +
    'Apply a `rewrite` yourself; do not remove or move a rule without telling the user.'));
  assert.doesNotMatch(out, /Approve|Deny|remember/);
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

test('an unresolved-reference note shows which reference did not resolve, in the notes and in audit', () => {
  const v: Verdict = { ...keep('- See `docs/gone.md`.', ['unresolved-reference']), evidence: '`docs/gone.md` not found' };
  assert.equal(formatNotes([v]), [
    'themis: notes on rules kept as written:',
    '  "- See `docs/gone.md`.": unresolved-reference (`docs/gone.md` not found)',
  ].join('\n'));
  assert.match(formatAudit([v]), /^\| 1 \| - See `docs\/gone\.md`\. \| keep \| {2}\| {2}\| `docs\/gone\.md` not found \| unresolved-reference \|$/m);
  assert.equal(formatAsk([v], 'CLAUDE.md', 'report'), '');
  // Still covered with no-evidence beside it: question 7 checked the reference against the repository.
  assert.deepEqual(coverage([{ ...v, notes: ['unresolved-reference', 'no-evidence'] }]), { covered: 1, total: 1 });
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

test('metrics: a gap is not a rule to keep, and closing one is a correct interruption', () => {
  const m = metrics([
    { expect: 'keep', got: keep('- a', []) },
    { expect: 'keep', gap: true, got: keep('- b', []) }, // a known gap, still open
    { expect: 'keep', gap: true, got: CUT }, // a gap the gate now closes
  ]);
  assert.equal(m.falseCut, 0); // only "- a" had to enter as written
  assert.equal(m.precision, 1);
  assert.equal(m.interrupted, 1);
  assert.deepEqual(m.byVerdict['cut'], { n: 1, correct: 1 });
  assert.equal(metrics([{ expect: 'keep', gap: true, got: keep('- b', []) }]).falseCut, null);
});

test('formatAsk counts headings among the new rules only when one is interrupted', () => {
  const heading = keep('# Notes', [], 'heading');
  assert.match(formatAsk([heading, CUT, keep('- Amounts are cents.')], 'CLAUDE.md', 'ask'), /^themis: 1 of 2 new rules in CLAUDE\.md/);
  const title: Verdict = { rule: rule('# Ledger', 'heading'), verdict: 'cut', code: 'inferable-title', question: 1, evidence: 'package.json: name', notes: [] };
  assert.match(formatAsk([title, heading, CUT], 'CLAUDE.md', 'ask'), /^themis: 2 of 2 new rules in CLAUDE\.md/);
});

test('vendor entries retrieved more than 60 days ago are listed for review', () => {
  const vendor = PHRASES.filter((p) => p.group === 'vendor').length;
  assert.deepEqual(staleVendor(PHRASES, new Date('2027-01-11T12:00:00Z')), []); // 60 days: not yet
  const stale = staleVendor(PHRASES, new Date('2027-01-12T12:00:00Z'));
  assert.equal(stale.length, vendor);
  const first = stale[0];
  assert.ok(first !== undefined);
  assert.deepEqual(Object.keys(first).sort(), ['days', 'models', 'pattern', 'retrieved', 'url']);
  assert.equal(first.days, 61);
  assert.equal(first.retrieved, '2026-11-12');
  assert.equal(formatStaleVendor([]), 'Vendor entries to review: none');
  const text = formatStaleVendor(stale);
  assert.ok(text.startsWith('Vendor entries to review: 4\n  "think\\s+step[- ]by[- ]step'), text);
  assert.match(text, /retrieved 2026-11-12, 61 days ago, https:\/\/platform\.claude\.com\//);
});
