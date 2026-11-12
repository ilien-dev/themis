import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRules, parseRules } from '../../hooks/gate/extract.ts';

test('a wrapped bullet is one rule', () => {
  const r = parseRules('- Never run `x`\n  because it drops the db\n- Second');
  assert.deepEqual(r.map((x) => [x.kind, x.lines]), [['item', 2], ['item', 1]]);
});
test('a numbered list is one steps rule', () => {
  assert.deepEqual(parseRules('1. a\n2. b\n3. c').map((x) => x.kind), ['steps']);
});
test('a fenced block joins its lead-in and hides markdown inside it', () => {
  const r = parseRules('Tree:\n```\n# not a heading\n- not an item\n```');
  assert.equal(r.length, 1); assert.equal(r[0]?.kind, 'code');
});
test('only level-1 headings are rules', () => {
  assert.deepEqual(parseRules('# Ledger\n## Commands\n- a').map((x) => x.kind), ['heading', 'item']);
});
test('CRLF gives the same rules as LF', () => {
  const lf = '- a\n- b\n'; assert.deepEqual(parseRules(lf.replace(/\n/g, '\r\n')), parseRules(lf));
});
test('newRules ignores reorders, rewraps and deletions', () => {
  assert.deepEqual(newRules('- a\n- b', '- b\n-   a'), []);
  assert.deepEqual(newRules('- a\n- b', '- a'), []);
  assert.deepEqual(newRules('- a', '- a\n- c').map((x) => x.text), ['- c']);
  assert.equal(newRules(null, '- a\n- b').length, 2);
});
