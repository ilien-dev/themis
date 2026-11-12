import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCEPTED_FILE } from '../../hooks/gate/accepted.ts';
import { ruleHash } from '../../hooks/gate/text.ts';
import { repo } from './helpers.ts';

// The CLI is tested as the skill runs it: the compiled hooks/dist/gate.js.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE = join(root, 'hooks', 'dist', 'gate.js');

function gate(args: readonly string[], input = '', cwd = root): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [GATE, ...args], { input, cwd, encoding: 'utf8', windowsHide: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// docs/ exists, so a missing file under it is a dead reference rather than a path of something else.
const LEDGER = { 'package.json': '{"name":"ledger","scripts":{"lint":"node lint.js"}}', 'src/money.js': '', 'docs/guide.md': '' };
const MARKDOWN = '# Ledger\n\n- Write clean code.\n- All money values are integer cents; never floats.\n- See `docs/missing.md`.\n';

test('check reads markdown on stdin and prints one verdict per rule', () => {
  const dir = repo(LEDGER);
  const r = gate(['check', '--file', join(dir, 'CLAUDE.md')], MARKDOWN);
  assert.equal(r.status, 0, r.stderr);
  const verdicts = r.stdout.split('\n').filter((l) => /^\d+: /.test(l));
  assert.deepEqual(verdicts.map((l) => l.replace(/ {2}".*$/, '')), [
    '1: cut · inferable-title · question 1',
    '3: cut · generic-advice · question 3',
    '4: keep',
    '5: fix · dead-reference · question 7',
  ]);
  assert.match(r.stdout, /`docs\/missing\.md` not found/);
  assert.match(r.stdout, /themis: notes on rules kept as written:\n {2}"- All money values are integer cents; never floats\.": no-evidence/);
});

test('check --file defaults to CLAUDE.md in the working directory', () => {
  const dir = repo(LEDGER);
  const r = gate(['check'], '- Lint: `npm run lint`\n', dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^1: cut · inferable-script/);
});

test('check --json is parseable and has verdict, code, question, evidence, notes', () => {
  const dir = repo(LEDGER);
  const r = gate(['check', '--json', '--file', join(dir, 'CLAUDE.md')], MARKDOWN);
  assert.equal(r.status, 0, r.stderr);
  const list = JSON.parse(r.stdout) as Record<string, unknown>[];
  assert.equal(list.length, 4);
  for (const v of list) for (const k of ['line', 'text', 'verdict', 'code', 'question', 'evidence', 'notes']) assert.ok(k in v, k);
  assert.deepEqual(list.map((v) => v['verdict']), ['cut', 'cut', 'keep', 'fix']);
  const kept = list[2];
  assert.ok(kept !== undefined);
  assert.deepEqual(kept['notes'], ['no-evidence', 'no-anchor', 'absolute-no-reason']);
  assert.equal(kept['code'], null);
});

test('audit prints the coverage line and --prune drops stale accepted entries', () => {
  const live = ruleHash('- Write clean code.');
  const stale = ruleHash('- A rule that was deleted.');
  const entry = { verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'phrases: generic "Write clean code"', date: '2026-11-12' };
  const dir = repo({ ...LEDGER, [ACCEPTED_FILE]: JSON.stringify({ version: 1, rules: { [live]: entry, [stale]: entry } }) });
  // A sibling rule file shares the store: its rules are live too.
  const sibling = ruleHash('- Run `npm run lint` before pushing.');
  const store = JSON.parse(readFileSync(join(dir, ACCEPTED_FILE), 'utf8')) as { rules: Record<string, unknown> };
  store.rules[sibling] = entry;
  writeFileSync(join(dir, ACCEPTED_FILE), JSON.stringify(store));
  mkdirSync(join(dir, 'pkg'));
  writeFileSync(join(dir, 'pkg', 'AGENTS.md'), '- Run `npm run lint` before pushing.\n');
  writeFileSync(join(dir, 'CLAUDE.md'), MARKDOWN);

  const plain = gate(['audit', join(dir, 'CLAUDE.md')]);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /^\| Line \| Rule \| Verdict \| Code \| Question \| Evidence \| Notes \|$/m);
  assert.match(plain.stdout, /^\| 3 \| - Write clean code\. \| keep \| {2}\| {2}\| {2}\| accepted \|$/m);
  assert.match(plain.stdout, /^Coverage: 2 of 3 rules \(66\.7%\) matched a table or the repository\.$/m);
  assert.doesNotMatch(plain.stdout, /Pruned/);

  const pruned = gate(['audit', join(dir, 'CLAUDE.md'), '--prune']);
  assert.equal(pruned.status, 0, pruned.stderr);
  assert.match(pruned.stdout, /^Pruned 1 stale accepted entry\.$/m);
  const left = JSON.parse(readFileSync(join(dir, ACCEPTED_FILE), 'utf8')) as { rules: Record<string, unknown> };
  assert.deepEqual(Object.keys(left.rules).sort(), [live, sibling].sort());

  const json = gate(['audit', join(dir, 'CLAUDE.md'), '--json']);
  const data = JSON.parse(json.stdout) as { verdicts: unknown[]; coverage: { covered: number; total: number } };
  assert.equal(data.verdicts.length, 4);
  assert.deepEqual(data.coverage, { covered: 2, total: 3 });
});

test('report prints precision, false-cut rate and coverage', () => {
  const corpus = [
    { id: 'a', repo: 'r', file: 'CLAUDE.md', rule: '- Write clean code.', expect: 'cut', code: 'generic-advice' },
    { id: 'b', repo: 'r', file: 'CLAUDE.md', rule: '- Lint: `npm run lint`', expect: 'cut', code: 'inferable-script' },
    { id: 'c', repo: 'r', file: 'CLAUDE.md', rule: '- All money values are integer cents; never floats.', expect: 'keep' },
    { id: 'd', repo: 'r', file: 'CLAUDE.md', rule: '- IMPORTANT: amounts are cents.', expect: 'keep' }, // labelled keep, the gate rewrites it
  ].map((c) => JSON.stringify(c)).join('\n');
  const dir = repo({ 'corpus.jsonl': `${corpus}\n`, 'r/package.json': '{"name":"x","scripts":{"lint":"node lint.js"}}' });
  const r = gate(['report', join(dir, 'corpus.jsonl')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Cases: 4$/m);
  assert.match(r.stdout, /^Interrupted: 3$/m);
  assert.match(r.stdout, /^Precision of interruption: 66\.7%$/m);
  assert.match(r.stdout, /^False-cut rate: 50\.0%$/m);
  assert.match(r.stdout, /^Coverage: 75\.0%$/m);
  assert.match(r.stdout, /^ {2}d: expected keep, got rewrite emphasis$/m);

  const json = JSON.parse(gate(['report', join(dir, 'corpus.jsonl'), '--json']).stdout) as { metrics: { precision: number; falseCut: number; coverage: number }; mismatches: unknown[] };
  assert.equal(json.metrics.falseCut, 0.5);
  assert.equal(json.mismatches.length, 1);
});

test('unknown subcommand exits 2', () => {
  // A corpus whose case holds two rules, and one with a line that is not JSON, are wrong input too.
  const bad = repo({
    'two.jsonl': `${JSON.stringify({ id: 'a', repo: 'r', file: 'CLAUDE.md', rule: '- one\n- two', expect: 'keep' })}\n`,
    'broken.jsonl': '{"id":\n', 'r/package.json': '{}',
  });
  for (const args of [['frobnicate'], [], ['audit'], ['check', '--nope'], ['report', 'missing.jsonl'], ['audit', 'a.md', 'b.md'],
    ['report', join(bad, 'two.jsonl')], ['report', join(bad, 'broken.jsonl')]]) {
    const r = gate(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: gate/);
    assert.equal(r.stdout, '');
  }
});

test('--file takes a path, not the next option', () => {
  const r = gate(['check', '--file', '--json'], '- a\n');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--file needs a path/);
});

test('--prune does nothing outside a git repository, where sibling rule files cannot be seen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'themis-noprune-'));
  const stale = ruleHash('- A rule that was deleted.');
  const entry = { verdict: 'cut', code: 'generic-advice', question: 3, evidence: 'e', date: '2026-11-12' };
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, ACCEPTED_FILE), JSON.stringify({ version: 1, rules: { [stale]: entry } }));
  writeFileSync(join(dir, 'CLAUDE.md'), '- Write clean code.\n');
  const r = gate(['audit', join(dir, 'CLAUDE.md'), '--prune']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Not pruned: the rule files of this repository are unknown outside a git repository\.$/m);
  const left = JSON.parse(readFileSync(join(dir, ACCEPTED_FILE), 'utf8')) as { rules: Record<string, unknown> };
  assert.deepEqual(Object.keys(left.rules), [stale]);
  const json = JSON.parse(gate(['audit', join(dir, 'CLAUDE.md'), '--prune', '--json']).stdout) as Record<string, unknown>;
  assert.equal(json['pruned'], null);
});
