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

// Final review: thematic breaks, fences and line numbers.
test('a thematic break is not a rule', () => {
  for (const hr of ['---', '***', '___', '- - -', '  * * *', '-----']) {
    assert.deepEqual(parseRules(`- a\n\n${hr}\n\n- b`).map((x) => x.text), ['- a', '- b'], hr);
  }
  assert.deepEqual(parseRules('---'), []);
  assert.deepEqual(parseRules('Some text\n---\n- b').map((x) => x.text), ['Some text', '- b']);
});
test('a line that opens a new info string inside a fence does not close it', () => {
  const r = parseRules('```md\nExample:\n```ts\nconst a = 1;\n```\n- after');
  // CommonMark: "```ts" cannot close a fence, so the block runs to the next bare fence.
  assert.deepEqual(r.map((x) => [x.kind, x.line, x.lines]), [['code', 1, 5], ['item', 6, 1]]);
});
test('the closing fence is at least as long as the opening one and of the same character', () => {
  const r = parseRules('````\n```\n- hidden\n````\n- shown');
  assert.deepEqual(r.map((x) => [x.kind, x.text]), [['code', '````\n```\n- hidden\n````'], ['item', '- shown']]);
  assert.deepEqual(parseRules('```\n~~~\n- hidden\n```').map((x) => x.kind), ['code']);
  assert.deepEqual(parseRules('```\n- hidden\n```   \n- shown').map((x) => x.kind), ['code', 'item']);
});
test('a fence indented up to three spaces hides its content', () => {
  const r = parseRules('  ```\n  # not a heading\n  - not an item\n  ```\n- shown');
  assert.deepEqual(r.map((x) => [x.kind, x.line]), [['code', 1], ['item', 5]]);
});
test('an unclosed fence runs to the end of the file', () => {
  const r = parseRules('- before\n```\n# not a heading\n- not an item');
  assert.deepEqual(r.map((x) => [x.kind, x.line, x.lines]), [['item', 1, 1], ['code', 2, 3]]);
});
test('tilde fences hide their content too', () => {
  assert.deepEqual(parseRules('~~~\n# x\n- y\n~~~\n- z').map((x) => x.kind), ['code', 'item']);
});
test('line values are 1-based and count blank lines and headings', () => {
  const r = parseRules('# Title\n\n## Section\n\n- one\n  wrapped\n\nA paragraph.\n\n1. a\n2. b');
  assert.deepEqual(r.map((x) => [x.kind, x.line, x.lines]), [['heading', 1, 1], ['item', 5, 2], ['paragraph', 8, 1], ['steps', 10, 2]]);
});
test('a numbered list with blank lines between items is one steps rule', () => {
  const r = parseRules('1. first\n\n2. second\n\n3. third\n\nAfter.');
  assert.deepEqual(r.map((x) => [x.kind, x.line, x.lines]), [['steps', 1, 5], ['paragraph', 7, 1]]);
});
