import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseRule, CorpusRunner, matches, parseCorpus, type Case } from '../../hooks/gate/corpus.ts';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts } from '../../hooks/gate/facts.ts';
import { contextFor, judgeAll } from '../../hooks/gate/verdict.ts';
import { REASON_CODES, type Verdict } from '../../hooks/gate/types.ts';

// The regression corpus: every labelled rule must get its verdict and reason code.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cases = parseCorpus(readFileSync(join(root, 'tests/gate/corpus.jsonl'), 'utf8'));
const runner = new CorpusRunner(root);
after(() => { runner.dispose(); });

const describe = (c: Case, v: Verdict): string => `${c.id}: expected ${c.expect} ${c.code ?? ''}, got ${v.verdict} ${v.code ?? ''} (${v.evidence})`;

test('every corpus case gets its expected verdict and code', () => {
  const wrong = cases.map((c) => ({ c, v: runner.run(c) })).filter(({ c, v }) => !matches(c, v)).map(({ c, v }) => describe(c, v));
  assert.deepEqual(wrong, []);
});

test('the corpus has at least 150 cases and every reason code at least 5', () => {
  assert.ok(cases.length >= 150, `${cases.length} cases`);
  const known = new Set<string>(REASON_CODES);
  for (const c of cases) if (c.code !== undefined) assert.ok(known.has(c.code), `${c.id}: unknown code ${c.code}`);
  for (const code of REASON_CODES) {
    const n = cases.filter((c) => c.code === code).length;
    assert.ok(n >= 5, `${code}: ${n} cases`);
  }
  // Both languages, and enough rules that must enter as written to measure false cuts.
  const spanish = cases.filter((c) => /[áéíóúñ]|\b(?:usa|nunca|siempre|ejecutes|piensa|este)\b/i.test(c.rule));
  assert.ok(spanish.length >= 20, `${spanish.length} Spanish cases`);
  assert.ok(cases.filter((c) => c.expect === 'keep').length >= 100);
});

test('the c14 and c15 fixtures are in the corpus rule by rule', () => {
  for (const [repo, prefix] of [['evals/cases/c14-themis-audit/fixture', 'c14-'], ['evals/cases/c15-cap/fixture', 'c15-']] as const) {
    const rules = parseRules(readFileSync(join(root, repo, 'CLAUDE.md'), 'utf8'));
    const own = cases.filter((c) => c.repo === repo && c.id.startsWith(prefix) && c.line !== undefined);
    assert.deepEqual(own.map((c) => [c.line, c.rule]), rules.map((r) => [r.line, r.text]), repo);
  }
});

test('two runs, the second in reverse order, give identical output', () => {
  const once = (r: CorpusRunner, list: readonly Case[]): string[] => list.map((c) => {
    const { facts, ctx } = r.factsFor(c);
    return JSON.stringify(judgeAll([caseRule(c)], facts, ctx));
  });
  const first = once(runner, cases);
  const fresh = new CorpusRunner(root);
  try {
    const second = once(fresh, [...cases].reverse()).reverse();
    assert.deepEqual(second, first);
  } finally {
    fresh.dispose();
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
  // The best of three runs: the test files run in parallel, and a busy machine slows the git calls of
  // one run without saying anything about the gate.
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const facts = readFacts(join(dir, 'CLAUDE.md'));
    const verdicts = judgeAll(parseRules(markdown), facts, contextFor(facts));
    runs.push(performance.now() - start);
    assert.ok(verdicts.length > 50);
  }
  const ms = Math.min(...runs);
  assert.ok(ms < 200, `${largest}: ${runs.map((r) => r.toFixed(0)).join(', ')} ms`);
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
  const start = performance.now();
  judgeAll([rule], facts, ctx);
  const ms = performance.now() - start;
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
});

test('a gap is only allowed on a kept rule and names why the rule is redundant', () => {
  const gaps = cases.filter((c) => c.gap !== undefined);
  assert.ok(gaps.every((c) => c.expect === 'keep' && (c.gap ?? '').length > 20));
  assert.throws(() => parseCorpus('{"id":"x","repo":"r","file":"f","rule":"- a","expect":"cut","code":"emphasis","gap":"why it is redundant"}'), /gap/);
  assert.throws(() => parseCorpus('{"id":"x","repo":"r","file":"f","rule":"- a","expect":"cut"}'), /code is required/);
});

// A snapshot of a third-party repository: files.txt is its file listing, rules.md holds the rule file's
// text, and the rule file itself need not exist under its real name.
test('a repo with files.txt is judged against that listing, and its rule file need not exist', () => {
  const base = mkdtempSync(join(tmpdir(), 'themis-snapshot-'));
  try {
    const repo = (name: string, listing: string | null): void => {
      mkdirSync(join(base, name), { recursive: true });
      writeFileSync(join(base, name, 'package.json'), '{"name":"snap","scripts":{}}');
      writeFileSync(join(base, name, 'rules.md'), '- Entry point is `src/main.ts`\n');
      if (listing !== null) writeFileSync(join(base, name, 'files.txt'), listing);
      else { mkdirSync(join(base, name, 'src')); writeFileSync(join(base, name, 'src', 'other.ts'), ''); } // src/ exists, src/main.ts does not
    };
    repo('listed', 'package.json\nsrc/main.ts\n');
    repo('bare', null);
    const rule = '- Entry point is `src/main.ts`';
    const listed: Case = { id: 'listed-1', repo: 'listed', file: 'CLAUDE.md', rule, expect: 'keep' };
    const bare: Case = { ...listed, id: 'bare-1', repo: 'bare' };
    const snapshots = new CorpusRunner(base);
    try {
      const facts = snapshots.factsFor(listed).facts;
      assert.equal(facts.inRepo, true);
      assert.equal(facts.root, snapshots.dirFor('listed'));
      assert.ok(facts.files.has('src/main.ts'));
      assert.ok(facts.filesKnown);
      assert.notEqual(snapshots.run(listed).code, 'dead-reference');
      assert.equal(snapshots.run(bare).code, 'dead-reference');
    } finally {
      snapshots.dispose();
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
