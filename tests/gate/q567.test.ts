import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts, type Facts } from '../../hooks/gate/facts.ts';
import { q5 } from '../../hooks/gate/checks/q5.ts';
import { q6 } from '../../hooks/gate/checks/q6.ts';
import { q7, unresolvedReference } from '../../hooks/gate/checks/q7.ts';
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
const ctx: Context = { accepted: new Map(), techNames: [], options: { paths: false, pathsOverLimit: false } };

function first(text: string) {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  return rule;
}
const ask = (check: typeof q5, text: string, f: Facts = facts): Answer | null => check(first(text), f);
const unresolved = (text: string, f: Facts = facts): string | null => unresolvedReference(first(text), f);

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
  const cut = judge(first('- Write clean code.'), facts, ctx);
  assert.equal(cut.verdict, 'cut');
  assert.ok(!('target' in cut));
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

test('a script that package.json does not have is unresolved; those it has or npm brings are not', () => {
  assert.equal(unresolved('- Run unit tests: `npm run test:unit`'), 'scripts.test:unit not in package.json');
  assert.equal(unresolved('- Lint with `npm run lint`'), null);
  for (const s of ['npm install', 'npm ci', 'npm test', 'npm start']) assert.equal(unresolved(`- Run \`${s}\``), null, s);
  assert.equal(unresolved('- Build one package: `pnpm --filter web build`'), null);
  assert.equal(unresolved('- Use `pnpm -r build`'), null);
  assert.equal(unresolved('- Use `pnpm workspace`'), null);
});

test('q7 abstains on scripts when there is no package.json', () => {
  const bare = readFacts(join(repo({ 'a.txt': '' }), 'CLAUDE.md'));
  assert.equal(unresolved('- Run `npm run build`', bare), null);
});

test('a missing path is unresolved and an existing one is not, with either separator', () => {
  assert.equal(unresolved('See `src/missing.js`.'), '`src/missing.js` not found');
  assert.equal(unresolved('See `src\\money.js`.'), null);
  assert.equal(unresolved('See `src/money.js`.'), null);
  assert.equal(unresolved('See `docs/CONVENTIONS.md`.'), null);
  assert.ok(unresolved('See `docs/MISSING.md`.') !== null);
  assert.equal(unresolved('See `package.json`.'), null);
});

test('q7 treats a cited directory as alive when files are under it', () => {
  for (const p of ['src/generated/', 'src/generated', './src/generated', './src/generated/', 'src/', 'docs']) {
    assert.equal(unresolved(`Do not edit \`${p}\` by hand.`), null, p);
  }
  assert.ok(unresolved('Do not edit `src/gone/` by hand.') !== null);
});

test('q7 resolves a path from the directory of the rule file', () => {
  const sub = repo({ 'package.json': '{}', 'packages/app/lib/x.ts': '', 'packages/app/CLAUDE.md': '' });
  const f = readFacts(join(sub, 'packages/app/CLAUDE.md'));
  assert.equal(unresolved('See `lib/x.ts`.', f), null);
  assert.ok(unresolved('See `lib/y.ts`.', f) !== null);
});

test('q7 abstains on paths when the file list is unknown', () => {
  assert.equal(unresolved('See `src/missing.js`.', { ...facts, files: new Set(), filesKnown: false }), null);
});

test('q7 ignores urls, globs, versions and things that are not repo paths', () => {
  for (const s of ['https://x.dev/a', 'src/**/*.ts', 'v2.1/3 beta']) assert.equal(unresolved(`See \`${s}\`.`), null, s);
  for (const s of ['/api/users/list', 'react/jsx-runtime', 'feature/new-login', 'on/off', 'Node.js', 'socket.io', '/etc/hosts', '~/notes.md']) {
    assert.equal(unresolved(`Use \`${s}\` here.`), null, s);
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

// Two blind measurements found most unresolved references were rules to keep: q7 no longer interrupts them.
test('q7 never answers a rule for its unresolved reference, but still rewrites its emphasis', () => {
  for (const t of ['See `src/missing.js`.', '- Run unit tests: `npm run test:unit`']) assert.equal(ask(q7, t), null, t);
  const a = ask(q7, '- IMPORTANT: see `src/missing.ts`');
  assert.equal(a?.verdict, 'rewrite');
  assert.equal(a.code, 'emphasis');
  const v = judge(first('- IMPORTANT: see `src/missing.ts`'), facts, ctx);
  assert.equal(v.verdict, 'rewrite');
  assert.equal(v.code, 'emphasis');
});

test('a rule with an unresolved reference is kept with a note that carries the reference', () => {
  for (const [t, evidence] of [['- See `src/missing.js`.', '`src/missing.js` not found'],
    ['- Run unit tests: `npm run test:unit`', 'scripts.test:unit not in package.json']]) {
    const v = judge(first(t ?? ''), facts, ctx);
    assert.equal(v.verdict, 'keep', t);
    assert.equal(v.code, null);
    assert.equal(v.question, null);
    assert.equal(v.notes[0], 'unresolved-reference', t);
    assert.equal(v.evidence, evidence, t);
  }
  assert.ok(!judge(first('- See `src/money.js`.'), facts, ctx).notes.includes('unresolved-reference'));
  assert.equal(judge(first('- See `src/money.js`.'), facts, ctx).evidence, '');
  // q7 does not judge code blocks or headings, so neither carries the note.
  assert.ok(!judge(first('```sh\ncat `src/missing.js`\n```'), facts, ctx, []).notes.includes('unresolved-reference'));
  assert.deepEqual(judge({ text: '## See `src/missing.js`', kind: 'heading', line: 1, lines: 1 }, facts, ctx, []).notes, []);
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
  for (const s of ['settings.json', 'tsconfig.json', 'SKILL.md']) assert.equal(unresolved(`See \`${s}\`.`, f), null, s);
  assert.ok(unresolved('See `missing.json`.', f) !== null);
});

test('q7 does not judge paths outside a git repo', () => {
  const plain = readFacts(join(mkdtempSync(join(tmpdir(), 'themis-plain-')), 'CLAUDE.md'));
  assert.equal(plain.inRepo, false);
  assert.equal(unresolved('See `src/missing.js`.', plain), null);
  assert.equal(unresolved('See `missing.md`.', plain), null);
});

test('q7 ignores a line or column suffix on a path', () => {
  for (const s of ['src/money.js:42', 'src/money.js:42:7', 'src/money.js#L10', 'src/money.js#L10-L20', 'src/money.js#L10-20']) {
    assert.equal(unresolved(`See \`${s}\`.`), null, s);
  }
  assert.equal(unresolved('See `src/missing.js:42`.'), '`src/missing.js` not found');
});

test('q7 abstains on build output and ignored paths, which a fresh clone lacks', () => {
  const r = repo({ 'package.json': '{}', 'src/a.ts': '', '.gitignore': '/cache-data/\nsecrets.json\n*.log\n# comment\n' });
  const f = readFacts(join(r, 'CLAUDE.md'));
  for (const s of ['dist/x.js', 'build/out.js', 'node_modules/foo/x.js', 'coverage/lcov.info', '.next/server.js', 'cache-data/x.bin', 'a/b/secrets.json', 'cache-data/']) {
    assert.equal(unresolved(`See \`${s}\`.`, f), null, s);
  }
  assert.ok(unresolved('See `src/missing.ts`.', f) !== null);
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

test('q5 leaves alone a rule with an unresolved reference, which is kept with the note', () => {
  const text = 'Never edit `src/missing.js` by hand.';
  assert.equal(ask(q5, text), null);
  const v = judge(first(text), facts, ctx);
  assert.equal(v.verdict, 'keep');
  assert.ok(v.notes.includes('unresolved-reference'));
});

// Task 9 corpus: an absolute with a condition, a scope, a reason or a second instruction is more than
// an all-or-nothing deny entry or hook can hold.
test('q5 keeps an absolute that carries a condition, a scope, a reason or a second instruction', () => {
  for (const t of [
    'Never commit `.env` files; use `.env.example`.',
    'Never run `npm publish` from a laptop; the release job signs the package.',
    'Never run `npm run build` while `npm run dev` is running.',
    'Never run `npm run lint` on production.',
    'Never run `git push` to main directly.',
    'Never run `git push --force` without asking me first.',
    'Nunca ejecutes `git push` sin pasar las pruebas.',
    'Always use `npm ci` in CI.',
    'Always run `npm run lint` after pulling.',
    'Never run `docker compose down -v` unless the on-call approves.',
  ]) assert.equal(ask(q5, t), null, t);
});

test('q5 moves a path only for a prohibition about a file operation on a real file name', () => {
  assert.equal(ask(q5, 'Never modify `package.json`.')?.verdict, 'move');
  assert.equal(ask(q5, 'Nunca edites `src/money.js` a mano.')?.verdict, 'move');
  for (const t of [
    'Never import from `src/money.js` in tests.', // a design rule, not a permission
    'Always read `docs/CONVENTIONS.md` before changing money code.', // nothing can require a read
    'Never call `Math.round` on cents.', // a function, not a file
    '1. `src/` - code\n2. `src/generated/` - never import it from a route\n3. `docs/` - notes',
  ]) assert.equal(ask(q5, t), null, t);
});

// Final review: references that resolve in ways the first version missed.
test('q7 reports only explicit run forms as missing scripts', () => {
  for (const s of ['pnpm vitest run src/a.test.ts', 'yarn prisma migrate dev', 'pnpm tsc --noEmit', 'bun scripts/seed.ts', 'pnpm missing', 'yarn missing']) {
    assert.equal(unresolved(`- Use \`${s}\``), null, s);
  }
  for (const s of ['npm run missing', 'pnpm run missing', 'yarn run missing', 'bun run missing']) {
    assert.equal(unresolved(`- Use \`${s}\``), 'scripts.missing not in package.json', s);
  }
});
test('q7 abstains on a missing script when another package.json is tracked', () => {
  const r = repo({ 'package.json': '{"scripts":{"lint":"eslint ."}}', 'site/package.json': '{"scripts":{"docs":"x"}}' });
  assert.equal(unresolved('- Build the docs: `npm run docs`', readFacts(join(r, 'CLAUDE.md'))), null);
});
test('q7 treats a multi-segment path as alive when a tracked path ends with it', () => {
  const r = repo({ 'package.json': '{}', 'packages/core/src/module.ts': '', 'packages/core/src/deep/x.ts': '' });
  const f = readFacts(join(r, 'CLAUDE.md'));
  for (const s of ['src/module.ts', 'core/src/module.ts', 'src/deep', 'src/deep/']) assert.equal(unresolved(`See \`${s}\`.`, f), null, s);
  assert.ok(unresolved('See `packages/core/src/gone.ts`.', f) !== null);
  assert.ok(unresolved('See `rc/module.ts`.', readFacts(join(repo({ 'package.json': '{}', 'rc/a.ts': '', 'x/src/module.ts': '' }), 'CLAUDE.md'))) !== null);
});
test('q7 strips line ranges and symbols before resolving a path', () => {
  for (const s of ['src/money.js:146-162', 'src/money.js::parse()', 'src/money.js::Money.parse', 'src/money.js#parse', 'src/money.js#Money.parse()']) {
    assert.equal(unresolved(`See \`${s}\`.`), null, s);
  }
  assert.equal(unresolved('See `src/missing.js:1-20`.'), '`src/missing.js` not found');
});
test('q7 does not judge a path whose first segment the repository does not know', () => {
  for (const s of ['peonping.github.io/docs/index.html', 'example.com/a/b.json', 'other-repo/src/a.ts']) assert.equal(unresolved(`See \`${s}\`.`), null, s);
});
test('q6 counts the content lines of a code block, not its fences or blank lines', () => {
  const block = (n: number, lead = ''): string => `${lead}\`\`\`ts\n${Array.from({ length: n }, (_, i) => `const a${i} = ${i};\n`).join('')}\n\`\`\``;
  assert.equal(ask(q6, block(8)), null);
  assert.equal(ask(q6, block(6, 'Example:\n')), null);
  const a = ask(q6, block(9));
  assert.equal(a?.code, 'long-procedure');
  assert.equal(a.evidence, '9 lines');
});
