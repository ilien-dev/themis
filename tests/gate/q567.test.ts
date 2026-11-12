import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts, type Facts } from '../../hooks/gate/facts.ts';
import { q5 } from '../../hooks/gate/checks/q5.ts';
import { q6 } from '../../hooks/gate/checks/q6.ts';
import { q7 } from '../../hooks/gate/checks/q7.ts';
import { CHECKS, judge, type Context } from '../../hooks/gate/verdict.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from './helpers.ts';

const CONVENTIONS = [
  'Every handler validates its input at the edge.',
  'Domain code never imports from the transport layer.',
  'Errors carry a stable code and a human message.',
  'Log lines are structured and never contain secrets.',
].join('\n');

const dir = repo({
  'package.json': '{"scripts":{"lint":"eslint .","build":"tsc"}}',
  'src/money.js': '',
  'src/generated/a.ts': '',
  'docs/CONVENTIONS.md': `# Conventions\n\n${CONVENTIONS}\n\nShort note.\n`,
});
const facts = readFacts(join(dir, 'CLAUDE.md'));
const ctx: Context = { accepted: new Map(), techNames: [] };

function first(text: string) {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  return rule;
}
const ask = (check: typeof q5, text: string, f: Facts = facts): Answer | null => check(first(text), f);

test('the checks are registered after question 3, in order 5, 6, 7', () => {
  assert.deepEqual(CHECKS.map((c) => c.question), [1, 2, 3, 5, 6, 7]);
  assert.ok(CHECKS.some((c) => c.question === 5 && c.run === q5));
  assert.ok(CHECKS.some((c) => c.question === 6 && c.run === q6));
  assert.ok(CHECKS.some((c) => c.question === 7 && c.run === q7));
});

test('judge copies the target of a move into the verdict and omits it otherwise', () => {
  const moved = judge(first('- Never run `npm publish` locally.'), facts, ctx);
  assert.equal(moved.verdict, 'move');
  assert.equal(moved.target, 'permissions.deny or a hook');
  const fixed = judge(first('- See `src/missing.js`.'), facts, ctx);
  assert.equal(fixed.verdict, 'fix');
  assert.ok(!('target' in fixed));
  assert.ok(!('target' in judge(first('- Keep it small.'), facts, ctx)));
});

test('q5 moves an absolute prohibition about a command', () => {
  const a = ask(q5, 'Never run `npm publish` locally.');
  assert.equal(a?.verdict, 'move');
  assert.equal(a.code, 'absolute-command');
  assert.equal(a.question, 5);
  assert.equal(a.target, 'permissions.deny or a hook');
  assert.equal(a.evidence, 'absolute "Never" with `npm publish`');
  assert.equal(ask(q5, 'Nunca ejecutes `git push --force`.')?.verdict, 'move');
  assert.equal(ask(q5, '- Always avoid `docker system prune`.')?.verdict, 'move');
  assert.equal(ask(q5, 'Never edit `src/generated/a.ts` by hand.')?.verdict, 'move');
});

test('q5 leaves alone absolutes without a command and prohibitions without an absolute', () => {
  assert.equal(ask(q5, 'All money values are integer cents; never floats.'), null);
  assert.equal(ask(q5, 'Do not edit src/generated/ by hand.'), null);
  assert.equal(ask(q5, 'Do not run `npm publish` locally.'), null);
  assert.equal(ask(q5, 'Never use `any`.'), null);
  assert.equal(ask(q5, 'Never call `useEffect` for derived state.'), null);
  assert.equal(ask(q5, 'Always write tests before the code.'), null);
});

test('q6 moves a numbered list of six steps and keeps one of five', () => {
  const steps = (n: number): string => Array.from({ length: n }, (_, i) => `${i + 1}. Step number ${i + 1}`).join('\n');
  const a = ask(q6, steps(6));
  assert.equal(a?.verdict, 'move');
  assert.equal(a.code, 'long-procedure');
  assert.equal(a.evidence, '6 steps');
  assert.equal(a.target, 'a skill or a doc, with a one-line pointer');
  assert.equal(ask(q6, steps(5)), null);
});

test('q6 moves any rule longer than eight lines and keeps one of eight', () => {
  const para = (n: number): string => Array.from({ length: n }, (_, i) => `Line ${i + 1} of a long note`).join('\n');
  const a = ask(q6, para(9));
  assert.equal(a?.code, 'long-procedure');
  assert.equal(a.evidence, '9 lines');
  assert.equal(ask(q6, para(8)), null);
});

test('q6 moves a block copied from a doc and names the file', () => {
  const a = ask(q6, CONVENTIONS);
  assert.equal(a?.verdict, 'move');
  assert.equal(a.code, 'duplicated-passage');
  assert.equal(a.target, 'docs/CONVENTIONS.md');
  assert.equal(a.evidence, 'similar to docs/CONVENTIONS.md');
});

test('q6 keeps a one-line gotcha that a doc also says, and a short block that only resembles one', () => {
  assert.equal(ask(q6, 'Domain code never imports from the transport layer.'), null);
  assert.equal(ask(q6, 'Every handler validates its input at the edge.\nErrors carry a stable code and a human message.\nTests cover each handler.'), null);
});

test('q7 fixes a script that package.json does not have, and keeps those it has or npm brings', () => {
  const a = ask(q7, '- Run unit tests: `npm run test:unit`');
  assert.equal(a?.verdict, 'fix');
  assert.equal(a.code, 'dead-reference');
  assert.equal(a.question, 7);
  assert.equal(a.evidence, 'scripts.test:unit not in package.json');
  assert.equal(ask(q7, '- Lint with `npm run lint`'), null);
  for (const s of ['npm install', 'npm ci', 'npm test', 'npm start']) assert.equal(ask(q7, `- Run \`${s}\``), null, s);
  assert.equal(ask(q7, '- Build one package: `pnpm --filter web build`'), null);
  assert.equal(ask(q7, '- Use `pnpm -r build`'), null);
  assert.equal(ask(q7, '- Use `pnpm workspace`'), null);
});

test('q7 abstains on scripts when there is no package.json', () => {
  const bare = readFacts(join(repo({ 'a.txt': '' }), 'CLAUDE.md'));
  assert.equal(ask(q7, '- Run `npm run build`', bare), null);
});

test('q7 fixes a missing path and keeps an existing one, with either separator', () => {
  const a = ask(q7, 'See `src/missing.js`.');
  assert.equal(a?.verdict, 'fix');
  assert.equal(a.evidence, '`src/missing.js` not found');
  assert.equal(ask(q7, 'See `src\\money.js`.'), null);
  assert.equal(ask(q7, 'See `src/money.js`.'), null);
  assert.equal(ask(q7, 'See `docs/CONVENTIONS.md`.'), null);
  assert.equal(ask(q7, 'See `docs/MISSING.md`.')?.code, 'dead-reference');
  assert.equal(ask(q7, 'See `package.json`.'), null);
});

test('q7 treats a cited directory as alive when files are under it', () => {
  for (const p of ['src/generated/', 'src/generated', './src/generated', './src/generated/', 'src/', 'docs']) {
    assert.equal(ask(q7, `Do not edit \`${p}\` by hand.`), null, p);
  }
  assert.equal(ask(q7, 'Do not edit `src/gone/` by hand.')?.code, 'dead-reference');
});

test('q7 resolves a path from the directory of the rule file', () => {
  const sub = repo({ 'package.json': '{}', 'packages/app/lib/x.ts': '', 'packages/app/CLAUDE.md': '' });
  const f = readFacts(join(sub, 'packages/app/CLAUDE.md'));
  assert.equal(ask(q7, 'See `lib/x.ts`.', f), null);
  assert.equal(ask(q7, 'See `lib/y.ts`.', f)?.code, 'dead-reference');
});

test('q7 abstains on paths when the file list is unknown', () => {
  assert.equal(ask(q7, 'See `src/missing.js`.', { ...facts, files: new Set(), filesKnown: false }), null);
});

test('q7 ignores urls, globs, versions and things that are not repo paths', () => {
  for (const s of ['https://x.dev/a', 'src/**/*.ts', 'v2.1/3 beta']) assert.equal(ask(q7, `See \`${s}\`.`), null, s);
  for (const s of ['/api/users/list', 'react/jsx-runtime', 'feature/new-login', 'on/off', 'Node.js', 'socket.io', '/etc/hosts', '~/notes.md']) {
    assert.equal(ask(q7, `Use \`${s}\` here.`), null, s);
  }
});

test('q7 flags emphasis in capitals as a rewrite', () => {
  const a = ask(q7, '- IMPORTANT: Use arrow functions where appropriate.');
  assert.equal(a?.verdict, 'rewrite');
  assert.equal(a.code, 'emphasis');
  assert.equal(a.evidence, 'emphasis "IMPORTANT"');
  assert.equal(ask(q7, 'Handlers MUST validate input.')?.evidence, 'emphasis "MUST"');
  assert.equal(ask(q7, 'SIEMPRE valida la entrada.')?.code, 'emphasis');
  assert.equal(ask(q7, 'NUNCA subas secretos.')?.code, 'emphasis');
  assert.equal(ask(q7, 'Es CRÍTICO validar.')?.code, 'emphasis');
});

test('q7 does not flag capitals inside a span, acronyms or identifiers', () => {
  assert.equal(ask(q7, 'Set `NODE_ENV=IMPORTANT`'), null);
  assert.equal(ask(q7, 'Parse the HTTP and JSON payload.'), null);
  assert.equal(ask(q7, 'Read MUST_HAVE from the config.'), null);
  assert.equal(ask(q7, 'Never use floats for money.'), null);
  assert.equal(ask(q7, 'Importantly, keep it short.'), null);
});

test('q7 reports a dead reference before emphasis', () => {
  assert.equal(ask(q7, 'IMPORTANT: see `src/missing.js`.')?.code, 'dead-reference');
});

test('rules that carry information are not flagged by any of the three', () => {
  for (const t of [
    'Never deploy on Fridays unless the on-call approves.',
    'Retry at most 3 times before failing.',
    'When the cache is cold, warm it with `src/money.js` first.',
    'All money values are integer cents; never floats.',
  ]) {
    for (const c of [q5, q6, q7]) assert.equal(ask(c, t), null, t);
  }
});

// Round 1 review fixes.

test('q7 finds a bare file name anywhere in the repo, not only at the root', () => {
  const r = repo({ 'package.json': '{}', '.claude/settings.json': '', 'packages/x/tsconfig.json': '', 'skills/a/SKILL.md': '' });
  const f = readFacts(join(r, 'CLAUDE.md'));
  for (const s of ['settings.json', 'tsconfig.json', 'SKILL.md']) assert.equal(ask(q7, `See \`${s}\`.`, f), null, s);
  assert.equal(ask(q7, 'See `missing.json`.', f)?.code, 'dead-reference');
});

test('q7 does not judge paths outside a git repo', () => {
  const plain = readFacts(join(mkdtempSync(join(tmpdir(), 'themis-plain-')), 'CLAUDE.md'));
  assert.equal(plain.inRepo, false);
  assert.equal(ask(q7, 'See `src/missing.js`.', plain), null);
  assert.equal(ask(q7, 'See `missing.md`.', plain), null);
});

test('q7 ignores a line or column suffix on a path', () => {
  for (const s of ['src/money.js:42', 'src/money.js:42:7', 'src/money.js#L10', 'src/money.js#L10-L20', 'src/money.js#L10-20']) {
    assert.equal(ask(q7, `See \`${s}\`.`), null, s);
  }
  const a = ask(q7, 'See `src/missing.js:42`.');
  assert.equal(a?.evidence, '`src/missing.js` not found');
});

test('q7 abstains on build output and ignored paths, which a fresh clone lacks', () => {
  const r = repo({ 'package.json': '{}', 'src/a.ts': '', '.gitignore': '/cache-data/\nsecrets.json\n*.log\n# comment\n' });
  const f = readFacts(join(r, 'CLAUDE.md'));
  for (const s of ['dist/x.js', 'build/out.js', 'node_modules/foo/x.js', 'coverage/lcov.info', '.next/server.js', 'cache-data/x.bin', 'a/b/secrets.json', 'cache-data/']) {
    assert.equal(ask(q7, `See \`${s}\`.`, f), null, s);
  }
  assert.equal(ask(q7, 'See `src/missing.ts`.', f)?.code, 'dead-reference');
});

test('q5 does not treat a code fragment as a command', () => {
  assert.equal(ask(q5, 'Never use `as any` casts.'), null);
  assert.equal(ask(q5, 'Always write `if (x) return` guards.'), null);
  assert.equal(ask(q5, 'Never run `docker compose down -v` here.')?.verdict, 'move');
  assert.equal(ask(q5, 'Never run `rm -rf dist`.')?.verdict, 'move');
});

test('q5 targets a deny rule for never-type markers and a hook for always-type markers', () => {
  assert.equal(ask(q5, 'Never run `npm publish` locally.')?.target, 'permissions.deny or a hook');
  assert.equal(ask(q5, 'Nunca ejecutes `git push --force`.')?.target, 'permissions.deny or a hook');
  assert.equal(ask(q5, 'Always run `npm run lint` before committing.')?.target, 'a hook');
  assert.equal(ask(q5, 'Siempre ejecuta `npm run lint`.')?.target, 'a hook');
});

test('q5 leaves a rule with a dead reference to q7, which reports a fix', () => {
  const text = 'Never edit `src/missing.js` by hand.';
  assert.equal(ask(q5, text), null);
  const v = judge(first(text), facts, ctx);
  assert.equal(v.verdict, 'fix');
  assert.equal(v.question, 7);
});
