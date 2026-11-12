import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACCEPTED_FILE, loadAccepted, pendingKey, pruneAccepted, recordAccepted, takePending, writePending } from '../../hooks/gate/accepted.ts';
import { ruleHash } from '../../hooks/gate/text.ts';
import type { Answer, Rule, Verdict } from '../../hooks/gate/types.ts';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'themis-accepted-'));
const mkRule = (text: string): Rule => ({ text, kind: 'item', line: 1, lines: 1 });
const cut = (text: string, extra: Partial<Verdict> = {}): Verdict => ({
  rule: mkRule(text), verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'phrases: clean code', notes: [], ...extra,
});
const keep = (text: string): Verdict => ({ rule: mkRule(text), verdict: 'keep', code: null, question: null, evidence: '', notes: [] });

test('recordAccepted + loadAccepted return the same Answer; keep is not stored', () => {
  const root = tmp();
  const move = cut('- Deploy notes live elsewhere', { verdict: 'move', code: 'procedure', question: 6, evidence: 'steps', target: 'docs/deploy.md' });
  recordAccepted(root, [cut('- Write clean code'), move, keep('- Run `npm test` before pushing')], '2026-11-12');
  const loaded = loadAccepted(root);
  assert.equal(loaded.size, 2);
  const expected: Answer = { verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'phrases: clean code' };
  assert.deepEqual(loaded.get(ruleHash('Write clean code')), expected);
  assert.deepEqual(loaded.get(ruleHash('Deploy notes live elsewhere')), { verdict: 'move', code: 'procedure', question: 6, evidence: 'steps', target: 'docs/deploy.md' });
  assert.equal(loaded.has(ruleHash('Run `npm test` before pushing')), false);
  const file = JSON.parse(readFileSync(join(root, ACCEPTED_FILE), 'utf8')) as { version: number; rules: Record<string, { date: string }> };
  assert.equal(file.version, 1);
  assert.equal(file.rules[ruleHash('Write clean code')]?.date, '2026-11-12');
  rmSync(root, { recursive: true, force: true });
});

test('hash ignores CRLF, "-  " and "* " markers; changing a word changes it', () => {
  const base = ruleHash('Write clean code');
  assert.equal(ruleHash('- Write clean code\r\n'), base);
  assert.equal(ruleHash('-  Write clean code'), base);
  assert.equal(ruleHash('* Write clean code'), base);
  assert.notEqual(ruleHash('Write cleaner code'), base);
  const root = tmp();
  recordAccepted(root, [cut('* Write clean code\r\n')], '2026-11-12');
  assert.ok(loadAccepted(root).has(base));
  rmSync(root, { recursive: true, force: true });
});

test('writing twice in a different order produces the same bytes', () => {
  const a = tmp();
  const b = tmp();
  const x = cut('- Alpha rule about nothing'); const y = cut('- Beta rule about nothing');
  recordAccepted(a, [x, y], '2026-11-12');
  recordAccepted(b, [y], '2026-11-12');
  recordAccepted(b, [x], '2026-11-12');
  const bytesA = readFileSync(join(a, ACCEPTED_FILE), 'utf8');
  assert.equal(bytesA, readFileSync(join(b, ACCEPTED_FILE), 'utf8'));
  assert.ok(bytesA.endsWith('}\n'));
  assert.ok(!bytesA.includes('\r'));
  assert.equal(loadAccepted(b).size, 2);
  rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

test('invalid JSON loads as empty and recordAccepted rewrites it', () => {
  const root = tmp();
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, ACCEPTED_FILE), '{ not json');
  assert.equal(loadAccepted(root).size, 0);
  recordAccepted(root, [cut('- Write clean code')], '2026-11-12');
  assert.equal(loadAccepted(root).size, 1);
  rmSync(root, { recursive: true, force: true });
});

test('missing file loads as empty; entries with an invalid shape are ignored', () => {
  const root = tmp();
  assert.equal(loadAccepted(root).size, 0);
  mkdirSync(join(root, '.claude'));
  const good = { verdict: 'cut', code: 'c', question: 3, evidence: 'e', date: 'd' };
  writeFileSync(join(root, ACCEPTED_FILE), JSON.stringify({ version: 1, rules: { a: good, b: { ...good, verdict: 'keep' }, c: { ...good, question: 4 }, d: 7, e: { ...good, target: 5 } } }));
  assert.deepEqual([...loadAccepted(root).keys()], ['a']);
  rmSync(root, { recursive: true, force: true });
});

test('pruneAccepted removes only absent hashes and returns the count', () => {
  const root = tmp();
  recordAccepted(root, [cut('- One rule here'), cut('- Two rule here'), cut('- Three rule here')], '2026-11-12');
  const live = new Set([ruleHash('One rule here')]);
  assert.equal(pruneAccepted(root, live), 2);
  assert.deepEqual([...loadAccepted(root).keys()], [ruleHash('One rule here')]);
  assert.equal(pruneAccepted(root, live), 0);
  rmSync(root, { recursive: true, force: true });
});

test('pruneAccepted on a missing file returns 0 and creates nothing', () => {
  const root = tmp();
  assert.equal(pruneAccepted(root, new Set()), 0);
  assert.equal(existsSync(join(root, '.claude')), false);
  rmSync(root, { recursive: true, force: true });
});

test('takePending returns the hashes once and null the second time', () => {
  // One pending approval per session and rule file: the key does not depend on the tool input.
  const key = pendingKey('s1', '/p/CLAUDE.md');
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.notEqual(key, pendingKey('s2', '/p/CLAUDE.md'));
  assert.notEqual(key, pendingKey('s1', '/p/AGENTS.md'));
  assert.equal(key, pendingKey('s1', '/p/CLAUDE.md'));
  writePending(key, ['aaaa', 'bbbb']);
  assert.deepEqual(takePending(key), ['aaaa', 'bbbb']);
  assert.equal(takePending(key), null);
  assert.equal(existsSync(join(tmpdir(), 'themis-gate', `${key}.json`)), false);
});

test('recordAccepted given only keep verdicts creates no file', () => {
  const root = tmp();
  recordAccepted(root, [keep('- Run `npm test` before pushing')], '2026-11-12');
  assert.equal(existsSync(join(root, '.claude')), false);
  rmSync(root, { recursive: true, force: true });
});
