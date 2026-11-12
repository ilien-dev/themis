import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts, type Facts } from '../../hooks/gate/facts.ts';
import { describedPath, describedScript, projectOverview, q1, stackList } from '../../hooks/gate/checks/q1.ts';
import { q3 } from '../../hooks/gate/checks/q3.ts';
import { q7 } from '../../hooks/gate/checks/q7.ts';
import { contextFor, judgeAll, type Check, type CheckOptions } from '../../hooks/gate/verdict.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from './helpers.ts';

// Phase 1.1: the detectors for described paths, stack lists, described scripts, overviews and /init filler.

const factsCache = new Map<string, Facts>();
function factsOf(files: Record<string, string>): Facts {
  const key = JSON.stringify(files);
  let f = factsCache.get(key);
  if (f === undefined) { f = readFacts(join(repo(files), 'CLAUDE.md')); factsCache.set(key, f); }
  return f;
}

// Described paths are opt-in (gate_paths); these tests turn them on unless they say otherwise.
const ON: CheckOptions = { paths: true, pathsOverLimit: false };
// The answer of `check` to the only rule of `text` in a repository holding `files`.
function ask(check: Check, text: string, files: Record<string, string>, options: CheckOptions = ON): Answer | null {
  const rules = parseRules(text);
  const rule = rules[0];
  if (rules.length !== 1 || rule === undefined) throw new Error(`${rules.length} rules parsed from ${text}`);
  return check(rule, factsOf(files), options);
}
const code = (check: Check, text: string, files: Record<string, string>): string | null => ask(check, text, files)?.code ?? null;
const nulls = (check: Check, files: Record<string, string>, texts: readonly string[]): void => {
  for (const t of texts) assert.equal(ask(check, t, files), null, t);
};

// Detector 1: the /init template.
const PLAIN = { 'package.json': '{"name":"acme"}' };
test('a level-1 heading that only names the rule file is filler', () => {
  for (const t of ['# CLAUDE.md', '# AGENTS.md', '# Project instructions', '# CLAUDE.md instructions']) assert.equal(code(q3, t, PLAIN), 'file-filler', t);
  nulls(q3, PLAIN, ['# CLAUDE.md — payments rules', '# CLAUDE.md for the billing service', '# Never edit CLAUDE.md', '# AGENTS.md (v2)']);
});
test('the /init sentence is filler with any agent name and an optional parenthesis', () => {
  const sentence = 'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.';
  const a = ask(q3, sentence, PLAIN);
  assert.ok(a !== null); assert.equal(a.verdict, 'cut'); assert.equal(a.code, 'file-filler'); assert.equal(a.question, 3);
  for (const t of [
    'This file provides guidance to Codex when working with code in this repository.',
    'This file provides guidance to AI coding agents when working with code in this repository.',
    'Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con código en este repositorio.',
  ]) assert.equal(code(q3, t, PLAIN), 'file-filler', t);
});
test('the /init sentence followed by a rule is kept', () => {
  nulls(q3, PLAIN, [
    'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Always run migrations first.',
    'This file provides guidance to Claude Code when working with code in this repository, which has no tests.',
    'This file provides guidance to Claude Code when working with code in this repository before release 2.',
  ]);
});

// Detector 2: a path and a plain description.
// Each file holds the words a plain description of it may use; the descriptions that must be kept use others.
const PATHS = {
  'package.json': '{"name":"gpu"}',
  'lib/nvidia.js': '// Executes nvidia-smi through the driver tool and parses the CSV output from it.\nexport function querySmi() {}\n',
  'lib/tracking-cache.js': '// In-memory LRU cache.\nexport class TrackingCache {}\n',
  'src/generated/schema.ts': 'export const schema = {};\n', 'src/db/schema.sql': 'create table invoices (id int);\n',
  'src/legacy/bill.ts': 'export function bill() {}\n', 'src/api/users-handler.ts': 'export const users = 1;\n', 'src/api/invoice-routes.ts': 'export const routes = 1;\n',
  'src/extension.ts': '// Main entry point: handles activation and hover providers.\nexport function activate() {}\n', 'build/index.ts': '',
  'src/facturas/cobro.ts': '// Lógica de facturación y cobro.\nexport const cobro = 1;\n',
};
test('an existing path with a short plain description is inferable', () => {
  const a = ask(q1, '- `lib/nvidia.js` — Executes nvidia-smi and parses CSV output', PATHS);
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-path', question: 1, evidence: 'path: lib/nvidia.js' });
  assert.equal(code(q1, '- **TrackingCache** (lib/tracking-cache.js:5): In-memory LRU cache', PATHS), 'inferable-path');
  assert.equal(code(q1, '- **extension.ts** - Main entry point, handles activation and hover providers', PATHS), 'inferable-path');
  assert.equal(code(q1, '- `src/api/`: users and invoice routes', PATHS), 'inferable-path'); // a directory: the names of its files
  assert.equal(code(q1, '- `src/facturas/cobro.ts` — lógica de facturación y cobro', PATHS), 'inferable-path');
});
test('a described path with a status word, a command, an effect verb or an instruction is kept', () => {
  nulls(q1, PATHS, [
    '- `src/generated/` — generated by `npm run gen`',
    '- `src/generated/` — auto-generated schema types',
    '- `src/db/` — schema, applied by the migrator at boot',
    '- `src/db/` — schema loaded at startup',
    '- `src/db/` — schema shared by the worker and the API',
    '- `src/db/` — schema required by the importer',
    '- `src/db/` — schema that the worker depends on',
    '- `src/legacy/` — legacy billing code',
    '- `src/legacy/` — código heredado de facturación',
    '- `src/api/` — do not import from here',
    '- `src/api/` — handlers, see `docs/api.md` first',
    '- `src/api/` — handlers; ask before changing them',
    '- `src/api/` — handlers for every route',
    '- `src/api/` — handlers for API v2',
    '- `src/api/` — you add new routes here',
    '- **Deprecated API** (`src/api/`): HTTP handlers',
    '- `src/api/` — handlers (internal)',
    '- `src/api/` — 全局类型定义',
  ]);
});
test('a pointer that says when to read a file, or that it is the source of truth, is kept', () => {
  const files = { ...PATHS, 'docs/refunds.md': '# Refunds\n\nRefund rules and examples, and the canonical data model.\n', 'prisma/schema.prisma': 'model Invoice { id Int }\n' };
  nulls(q1, files, [
    '- `docs/refunds.md` — for changing refund logic', '- `docs/refunds.md` — for refund logic', '- `docs/refunds.md` — editing guide for refunds',
    '- `prisma/schema.prisma` — single source of truth for the data model', '- `prisma/schema.prisma` — canonical data model',
  ]);
  assert.equal(code(q1, '- `docs/refunds.md` — refund rules and examples', files), 'inferable-path');
});
test('a bare file name that matches several files is kept: the rule says which one', () => {
  const files = { ...PATHS, 'src/a/index.ts': '', 'src/b/index.ts': '' };
  assert.equal(ask(q1, '- **index.ts** - Entry point', files), null);
  assert.equal(code(q1, '- **extension.ts** - Entry point', files), 'inferable-path');
});
test('a described path naming a tool the manifest lacks is kept: the description may be stale', () => {
  const files = { ...PATHS, 'package.json': '{"name":"mcp","dependencies":{"@modelcontextprotocol/sdk":"^1","commander":"^12"}}',
    'src/serve.ts': '// MCP server built with fastmcp\n', 'src/index.ts': '// CLI interface built on commander\nimport { Command } from "commander";\n' };
  assert.equal(ask(q1, '- `src/serve.ts`: MCP server using fastmcp', files), null);
  assert.equal(code(q1, '- `src/index.ts`: CLI interface using Commander', files), 'inferable-path');
});
test('a described path that does not exist is left to question 7', () => {
  const text = '- `src/missing.ts` — helpers';
  assert.equal(ask(q1, text, PATHS), null);
  assert.equal(ask(q7, text, PATHS)?.code, 'dead-reference');
});
test('a description over 25 words is kept', () => {
  const long = Array.from({ length: 26 }, (_, i) => ['parses', 'csv', 'output', 'from', 'the', 'driver', 'tool'][i % 7]).join(' ');
  assert.equal(long.split(' ').length, 26);
  assert.equal(ask(q1, `- \`lib/nvidia.js\` — ${long}`, PATHS), null);
  assert.equal(code(q1, `- \`lib/nvidia.js\` — ${long.split(' ').slice(0, 25).join(' ')}`, PATHS), 'inferable-path');
});
test('a bold label that is not a path shape is not a described path', () => {
  nulls(describedPath, PATHS, ['- **Build**: the output of the compiler', '- **lib**: helpers', '- `RecordScreen`: main data collection screen']);
});
test('a described path spread over several lines is kept', () => {
  assert.equal(ask(q1, '- `src/api/` — HTTP handlers\n  - `index.ts` — the router', PATHS), null);
});

// Detector 3: a list of dependencies.
const EVENTS = { 'package.json': '{"name":"events","devDependencies":{"jest":"^29","eslint":"^9","prettier":"^3","husky":"^9"},"dependencies":{"zod":"^3","tsconfig-paths":"^4","debug":"^4","colors":"^1","express":"^4","ms":"^2","pino":"^9"}}' };
const NEXT = { 'package.json': '{"name":"board","dependencies":{"next":"^15.1.0","react":"^19.0.0","tailwindcss":"^4","typescript":"~5.7.2","@xyflow/react":"^12","@types/node":"^24"}}' };
test('a list whose every segment is a dependency is inferable', () => {
  const a = ask(q1, '- Jest (unit + integration), ESLint + Prettier, Husky', EVENTS);
  assert.ok(a !== null); assert.equal(a.verdict, 'cut'); assert.equal(a.code, 'inferable-stack'); assert.match(a.evidence, /jest/);
  assert.equal(ask(q1, '- Jest (unit + integration), ESLint + Prettier, Husky pre-commit', EVENTS), null); // a trailing word
  assert.equal(code(q1, '**Stack**: Tailwind CSS 4 · TypeScript', NEXT), 'inferable-stack');
  assert.equal(code(q1, '- **Stack**: Tailwind CSS, `@xyflow/react` and TypeScript 5', NEXT), 'inferable-stack');
  assert.equal(ask(q1, '**Stack**: Next.js 15 · React 19 · TypeScript', NEXT), null); // two frameworks: the same TECH category
  assert.equal(ask(q1, '**Stack**: Next.js 15 · TypeScript', NEXT), null); // react is there too, unnamed
  assert.equal(code(q1, '- **Testing**: Jest, Husky', EVENTS), 'inferable-stack');
  assert.equal(code(q1, '- Pruebas: Jest y Prettier', EVENTS), 'inferable-stack');
});
test('a version that differs from the manifest is a conflict naming both', () => {
  const a = ask(q1, '**Stack**: Tailwind CSS · TypeScript 4', NEXT);
  assert.ok(a !== null); assert.equal(a.verdict, 'conflict'); assert.equal(a.code, 'stale-version'); assert.equal(a.question, 1);
  assert.match(a.evidence, /TypeScript 4/); assert.match(a.evidence, /~5\.7\.2/);
});
test('a version the manifest cannot confirm stops the stack list', () => {
  const loose = { 'package.json': '{"dependencies":{"react":">=18 <20","tailwindcss":"latest"}}' };
  nulls(q1, loose, ['- **Stack**: React 18, Tailwind CSS']);
  assert.equal(code(q1, '- **Stack**: React, Tailwind CSS', loose), 'inferable-stack');
  assert.equal(ask(q1, '- **Runtime**: Node.js 20, TypeScript', NEXT), null); // @types/node says nothing of the runtime
});
test('a stack line with an instruction, a non-dependency or prose is kept', () => {
  nulls(q1, EVENTS, [
    '- Zod for all request validation',
    '- **zod**: validate every request body with it',
    '- Jest, ESLint, Prettier, Stripe webhooks',
    '- Jest and ESLint, never Mocha',
    '- Jest, not Vitest',
    '- Jest (unit only), ESLint',
    '- Jest (runs in CI), ESLint',
    '- Jest + ESLint: required before merge',
  ]);
  nulls(q1, EVENTS, ['Use debug and colors sparingly', '- debug and colors', '- express, ms', 'Jest, ESLint and Prettier']);
});
test('a 0.x version is compared by minor, and abstains without one', () => {
  const zero = { 'package.json': '{"dependencies":{"dagre":"^0.8.5","next":"^15"}}' }; // Next.js makes the list unambiguous
  assert.equal(ask(q1, '- **Stack**: Dagre 0.7, Next.js', zero), null); // below 1.0 no conflict is claimed
  assert.equal(code(q1, '- **Stack**: Dagre 0.8, Next.js', zero), 'inferable-stack');
  assert.equal(ask(q1, '- **Stack**: Dagre 0, Next.js', zero), null);
});
test('a stack line naming one of two tools of a kind is kept: it says which one is used', () => {
  const both = { 'package.json': '{"devDependencies":{"jest":"^29","vitest":"^2","eslint":"^9"}}' };
  nulls(q1, both, ['- **Testing**: Jest, ESLint', '- Jest, ESLint', '- **jest**: Testing framework']);
  assert.equal(ask(q1, '- **Linting**: ESLint, Vitest, Jest', both), null); // two test runners: the same category
});
test('"**dependency**: description" is never cut: nothing in the repo checks the description', () => {
  nulls(q1, EVENTS, ['- **tsconfig-paths**: TypeScript path mapping support', '- **pino**: Fast logger','- **pino**: logger shared by every service', '- **pino**: legacy logger', '- **pino**: logger, configured in `src/log.ts`', '- **pino**: logger for v2']);
});
test('without a package.json, or with a broken one, the stack, script and overview detectors return null', () => {
  for (const files of [{ 'README.md': '# x\n\nA tool.\n' }, { 'package.json': '{ broken', 'README.md': '# x\n\nA tool.\n' }]) {
    nulls(stackList, files, ['- Jest (unit + integration), ESLint + Prettier, Husky pre-commit', '- **pino**: Fast logger']);
    nulls(describedScript, files, ['- `npm run db:backup` - Create database backup']);
    nulls(projectOverview, files, ['A tool that converts web pages to clean Markdown for language model pipelines.']);
  }
});

// Detector 4: a script and a description made of its own words.
const SCRIPTS = { 'package.json': JSON.stringify({ name: 'acme', scripts: {
  'test:integration': 'vitest run --coverage tests/integration', 'db:backup': 'node database/backup.mjs', deploy: 'node scripts/deploy.js --env production',
  build: 'turbo run build', clean: 'rimraf dist', 'check-types': 'turbo run check-types', test: 'vitest run',
} }) };
test('an existing script described by its own name and command is inferable', () => {
  const a = ask(q1, '- `npm run test:integration` - Run integration tests with coverage', SCRIPTS);
  assert.deepEqual(a, { verdict: 'cut', code: 'inferable-script', question: 1, evidence: 'package.json: scripts.test:integration' });
  assert.equal(code(q1, '- `npm run db:backup` - Create database backup', SCRIPTS), 'inferable-script');
  assert.equal(code(q1, '- `pnpm check-types` - Check types', SCRIPTS), 'inferable-script');
  assert.equal(code(q1, '- `yarn db:backup`: database backup', SCRIPTS), 'inferable-script');
  assert.equal(code(q1, '- `npm run test:integration` — pruebas de integración con cobertura', SCRIPTS), 'inferable-script');
});
test('a script rule with a warning, a need, a risky effect or foreign words is kept', () => {
  nulls(q1, SCRIPTS, [
    '- `npm run deploy` deploys to production; ask first',
    '- `npm run deploy` - Deploy to production',
    '- `npm run test:integration` needs the Docker stack up',
    '- `npm run test:integration` - Run integration tests with coverage before you push',
    '- `npm run test:integration` - Run integration tests, never in CI',
    '- `npm run test:integration` - Run integration tests (takes 4 minutes)',
    '- `npm run db:backup` - Create database backup in `backups/`',
    '- `npm run db:backup` - Create database backup — slow',
    '- `npm run missing` - Run the missing script',
    '- `npm run test:integration -- --watch` - Run integration tests',
  ]);
});
test('a script cited without `run` counts only when the package manager would run it', () => {
  assert.equal(ask(q1, '- `pnpm build` - Build all apps and packages', SCRIPTS), null);
  const wide = { 'package.json': '{"scripts":{"build":"turbo run build --filter=./apps/* --filter=./packages/*"}}' };
  assert.equal(code(q1, '- `pnpm build` - Build all apps and packages', wide), 'inferable-script');
  assert.equal(ask(q1, '- `npm build` - Build all apps and packages', wide), null);
});

// Detector 5: an overview made of the manifest's and the README's words.
const README = '# Ledger\n\n[![build](https://img.shields.io/x.svg)](https://ci)\n\nLedger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses, and produces monthly reports as PDF files.\n\n## Install\n\nnpm install ledger\n';
const LEDGER = { 'package.json': '{"name":"ledger","description":"Bookkeeping service for freelancers","dependencies":{"pdfkit":"^0.15"}}', 'README.md': README };
const SUMMARY = 'Ledger is a bookkeeping service for freelancers that tracks invoices, payments and expenses and produces monthly PDF reports.';
test('a paragraph made of the README and manifest words is an inferable overview', () => {
  const a = ask(q1, SUMMARY, LEDGER);
  assert.ok(a !== null); assert.equal(a.code, 'inferable-overview'); assert.equal(a.verdict, 'cut');
  assert.equal(code(q1, '`ledger` is a service for freelancers: it tracks invoices and expenses and produces monthly reports.', LEDGER), 'inferable-overview');
});
test('an overview with one new proper noun is kept', () => {
  assert.equal(ask(q1, 'Ledger is a bookkeeping service for freelancers that tracks invoices, payments and expenses in Stripe and produces monthly PDF reports.', LEDGER), null);
});
test('an overview with one new sentence is kept', () => {
  assert.equal(ask(q1, `${SUMMARY} The admin UI lives in another repo.`, LEDGER), null);
  assert.equal(ask(q1, `${SUMMARY} Reports go to the accountant.`, LEDGER), null);
});
test('an overview with few content words, a span, a rule or a number is kept', () => {
  nulls(projectOverview, LEDGER, [
    'Ledger tracks invoices and payments.',
    `${SUMMARY.slice(0, -1)} with \`pdfkit\`.`,
    `${SUMMARY.slice(0, -1)}, never in euros.`,
    `${SUMMARY.slice(0, -1)} for 3 countries.`,
    `${SUMMARY.slice(0, -1)} when asked.`,
    '- Ledger is a bookkeeping service for freelancers that tracks invoices, payments and expenses.',
  ]);
});

// Every detector on a large repository.
// The whole path, facts read inside the timed loop, with paths off and on. With paths on the cited files are
// real files of 20-30 KB on disk, so their reads are timed too.
test('200 varied rules over a repository of 2,000 files are judged in under 200 ms, paths off and on', () => {
  const files: string[] = ['package.json', 'README.md'];
  for (let i = 0; files.length < 2000; i++) files.push(`packages/p${i % 40}/src/module${i}.ts`);
  const disk: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'big', description: 'A big monorepo of packages for testing', scripts: { build: 'tsc -b', 'db:backup': 'node db/backup.mjs' },
      dependencies: { react: '^19', next: '^15', zod: '^3', pino: '^9' } }),
    'README.md': README,
  };
  // 300 of the listed files on disk, 20-30 KB each.
  for (let i = 0; i < 300; i++) disk[files[i + 2] ?? ''] = `// Parses the input of module ${i}\n${'export const value = parseInput(raw);\n'.repeat(500 + (i % 10) * 25)}`;
  const dir = repo(disk);
  const cited = Array.from({ length: 40 }, (_, i) => `- \`${files[i + 2] ?? ''}\` — Parses the input`);
  const samples = [
    '- **Stack**: Next.js 15 · Zod', '- `npm run db:backup` - Create database backup', SUMMARY, '# CLAUDE.md',
    'This file provides guidance to Claude Code when working with code in this repository.', '- Keep the legacy code as it is', '- **pino**: Fast logger',
    '- Never commit secrets.', '- Money is stored in integer cents', '- Jest, ESLint and Prettier',
  ];
  const rules = Array.from({ length: 200 }, (_, i) => (i % 5 === 0 ? cited[(i / 5) % 40] : samples[i % samples.length]) ?? '');
  const markdown = rules.join('\n\n');
  const measured: string[] = [];
  for (const paths of [false, true]) {
    const runs: number[] = [];
    let cut = 0;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const facts = readFacts(join(dir, 'CLAUDE.md'), { files });
      const verdicts = judgeAll(parseRules(markdown), facts, contextFor(facts, { paths }));
      runs.push(performance.now() - start);
      assert.equal(verdicts.length, 200);
      cut = verdicts.filter((v) => v.code === 'inferable-path').length;
    }
    assert.equal(cut, paths ? 40 : 0);
    measured.push(`paths ${paths ? 'on' : 'off'}: ${runs.map((r) => r.toFixed(0)).join(', ')} ms`);
    assert.ok(Math.min(...runs) < 200, measured.join('; '));
  }
  console.log(`# timing ${measured.join('; ')}`);
});
test('runs of spaces, dots and separators keep every detector fast', () => {
  const facts = factsOf({ ...EVENTS, 'README.md': README, 'lib/a.js': '' });
  for (const filler of [' ', '.', '+', 'a', '-', ':', '(']) {
    for (const prefix of ['- `lib/a.js` — ', '- **Stack**: Jest', '- `npm run x` - ', 'Ledger ', '- Jest, ']) {
      for (const len of [590, 20_000]) {
        const rule = parseRules(`${prefix}${filler.repeat(len)}x`)[0];
        assert.ok(rule !== undefined);
        const start = performance.now();
        for (const check of [describedPath, stackList, describedScript, projectOverview, q3]) check(rule, facts);
        const ms = performance.now() - start;
        assert.ok(ms < 50, `${JSON.stringify(prefix)} + ${len} x ${JSON.stringify(filler)}: ${ms.toFixed(0)} ms`);
      }
    }
  }
});

// Review round 1: open slots closed, and the described path checked against the file it names.
test('the /init sentence takes only a known agent name and a domain in its parenthesis', () => {
  const s = (agent: string, paren = ''): string => `This file provides guidance to ${agent}${paren === '' ? '' : ` (${paren})`} when working with code in this repository.`;
  nulls(q3, PLAIN, [
    s('Claude Code', 'production access'), s('Claude Code', 'read-only mode'), s('Claude Code', 'overrides ~/.claude'), s('the release bot'), s('new hires'),
    s('the on-call engineer', 'pager rotation'),
  ]);
  for (const t of [s('Claude Code', 'claude.ai/code'), s('Gemini CLI'), s('GitHub Copilot'), s('AI agents'), s('coding agents'), s('Claude Code', 'https://claude.ai/code')]) {
    assert.equal(code(q3, t, PLAIN), 'file-filler', t);
  }
});
test('an overview with a one-word new fact in a short sentence is kept', () => {
  for (const extra of ['The websocket server is separate.', 'Drag changes are throttled.', 'Columns are fixed.', 'Teams are tenants.', 'Cards are immutable.', 'Sync is best-effort.']) {
    assert.equal(ask(q1, `${SUMMARY} ${extra}`, LEDGER), null, extra);
  }
  assert.equal(ask(q1, 'Ledger is a bookkeeping service for freelancers that tracks invoices, payments and expenses and produces fixed monthly PDF reports.', LEDGER), null);
});
test('a version is called stale only against a single plain range of major 1 or more', () => {
  const peer = { 'package.json': '{"devDependencies":{"react":"^19.0.0","typescript":"^5"},"peerDependencies":{"react":"^18 || ^19"}}' };
  assert.equal(ask(q1, '- **Stack**: React 18, TypeScript', peer), null);
  assert.equal(ask(q1, '- **Stack**: React 19, TypeScript', peer), null);
  const same = { 'package.json': '{"devDependencies":{"react":"^19.0.0","typescript":"^5"},"peerDependencies":{"react":"^19.0.0"}}' };
  assert.equal(ask(q1, '- **Stack**: React 18, TypeScript', same)?.code, 'stale-version');
  assert.equal(ask(q1, '- **Stack**: React 18, TypeScript 5, React 19', same), null); // two majors for one dependency
});
test('a capital at the start earns an ordinary-word dependency nothing', () => {
  nulls(q1, EVENTS, ['- Debug and colors', '- Debug, Colors', '- **Stack**: Debug and colors']);
  assert.equal(code(q1, '- `debug` and `colors`', EVENTS), 'inferable-stack');
  assert.equal(code(q1, '- Jest, ESLint and debug', EVENTS), 'inferable-stack'); // every other segment is unambiguous
});
test('"**dependency**: description" and a one-segment stack line are kept', () => {
  const files = { 'package.json': '{"dependencies":{"colors":"^1","lodash":"^4","zustand":"^5","axios":"^1","ky":"^1","@tanstack/react-query":"^5"}}' };
  nulls(q1, files, [
    '- **Colors**: brand palette in the Tailwind config', '- **lodash**: Utility helpers, being phased out',
    '- **zustand**: Client state, the server state is in React Query', '- **axios**: HTTP client for the REST API', '- **HTTP**: Axios',
  ]);
});
// Files whose text does not hold the words of these descriptions.
const PLAINFILES = {
  'package.json': '{"name":"shop"}', 'src/webhooks/stripe.ts': 'export function handle(e: unknown) { return e; }\n', 'src/money.ts': 'export const add = (a: number, b: number) => a + b;\n',
  'src/card/form.ts': 'export function form() {}\n', 'src/api/invoices.ts': 'export function list() {}\n', 'db/schema.sql': 'create table t (id int);\n',
  'src/middleware/auth.ts': 'export function auth() {}\n', 'src/format.ts': 'export function format(d: Date) { return d; }\n', 'src/handlers/order.ts': 'export function order() {}\n',
  'src/lib/order.ts': 'export function placeOrder() {}\n', 'public/robots.txt': 'User-agent: *\nDisallow: /\n', 'src/billing/rules.ts': 'export const rules = [];\n',
  'src/db/client.ts': 'import { PrismaClient } from "@prisma/client";\nexport const db = new PrismaClient();\n',
};
test('a description with words its path and file do not hold is kept', () => {
  nulls(q1, PLAINFILES, [
    '- `src/webhooks/stripe.ts` — Stripe webhook handler, idempotent by event ID', '- `src/money.ts` — money math in integer cents', '- `src/card/form.ts` — PCI scope',
    '- `src/api/invoices.ts` — invoice endpoints, public API with external consumers', '- `db/schema.sql` — schema, kept in lockstep with the warehouse',
    '- `src/middleware/auth.ts` — auth middleware, order matters', '- `src/format.ts` — formatting helpers in UTC',
    '- `src/handlers/` — thin handlers, business logic lives in `src/lib/`', '- `src/format.ts` — formatting helpers duplicated in the mobile app',
    '- `public/robots.txt` — blocks crawlers on purpose', '- `src/billing/rules.ts` — billing rules agreed with finance', '- `src/db/client.ts` — Prisma client singleton, one per process',
  ]);
  assert.equal(code(q1, '- `src/db/client.ts` — Prisma client', PLAINFILES), 'inferable-path');
});
test('a described path needs two words matched by the path or its content, and a readable file', () => {
  assert.equal(ask(q1, '- `src/format.ts` — helpers', PLAINFILES), null); // only a role noun
  const dir = repo({ 'package.json': '{"name":"x"}', 'src/a.ts': 'export const parseInvoice = 1;\n' });
  const facts = readFacts(join(dir, 'CLAUDE.md'), { files: ['package.json', 'src/a.ts', 'src/gone.ts'] });
  const gone = parseRules('- `src/gone.ts` — gone parser')[0];
  assert.ok(gone !== undefined);
  assert.equal(describedPath(gone, facts), null); // listed but not on disk
  const ok = parseRules('- `src/a.ts` — parse invoice')[0];
  assert.ok(ok !== undefined);
  assert.equal(describedPath(ok, facts)?.code, 'inferable-path');
  const binary = { 'package.json': '{"name":"x"}', 'assets/logo.json': '\u0000\u0001logo image data' };
  assert.equal(ask(q1, '- `assets/logo.json` — logo image data', binary), null);
});

// Review round 2: described paths opt-in, resolved in one place, and lists that assign roles kept.
const NV = { 'package.json': '{"name":"gpu"}', 'lib/nvidia.js': '// Executes nvidia-smi and parses the CSV output.\n' };
test('described paths are judged only with gate_paths on', () => {
  const rule = parseRules('- `lib/nvidia.js` — Executes nvidia-smi and parses CSV output')[0];
  assert.ok(rule !== undefined);
  const facts = factsOf(NV);
  assert.equal(q1(rule, facts), null); // no options: off
  assert.equal(q1(rule, facts, { paths: false, pathsOverLimit: false }), null);
  assert.equal(q1(rule, facts, ON)?.code, 'inferable-path');
  assert.equal(judgeAll([rule], facts, contextFor(facts))[0]?.verdict, 'keep');
  assert.equal(judgeAll([rule], facts, contextFor(facts, { paths: true }))[0]?.code, 'inferable-path');
});
test('a directory is resolved from the rule file, then the root, and never pooled from several places', () => {
  const files = {
    'package.json': '{"name":"mono"}', 'src/api/index.ts': 'export {};\n', 'packages/admin/src/api/billing-audit-users.ts': 'export {};\n',
    'packages/a/src/x/parse.ts': '// parse invoice\n', 'packages/b/src/x/parse.ts': '// parse invoice\n',
    'src/util.ts': '// date helpers\n', 'packages/admin/src/util.ts': '// currency format helpers\n',
  };
  nulls(q1, files, ['- `src/api/` — billing audit users', '- `src/x/parse.ts` — parse invoice', '- `src/util.ts` — currency format helpers']);
  const dir = repo(files);
  const admin = readFacts(join(dir, 'packages/admin/CLAUDE.md'));
  const judge1 = (text: string): string | null => { const r = parseRules(text)[0]; assert.ok(r !== undefined); return q1(r, admin, ON)?.code ?? null; };
  assert.equal(judge1('- `src/api/` — billing audit users'), 'inferable-path');
  assert.equal(judge1('- `src/util.ts` — currency format helpers'), 'inferable-path');
  assert.equal(judge1('- `src/util.ts` — date helpers'), null);
});
test('scope words and past participles are information, not roles', () => {
  const files = {
    'package.json': '{"name":"x"}', 'src/server/db.ts': 'export const db = connect();\n', 'src/client/api.ts': 'export const api = {};\n',
    'src/app/page.tsx': 'export default function Page() { return null; }\n',
    'src/refunds.ts': 'export function disableRefunds() {}\nexport function lockAccounts() {}\nexport function pauseSubscriptions() {}\n',
  };
  nulls(q1, files, [
    '- `src/server/db.ts` — db client for tests', '- `src/client/api.ts` — api client for the server', '- `src/app/page.tsx` — app page, client component',
    '- `src/refunds.ts` — refunds, disabled', '- `src/refunds.ts` — refunds with locked accounts', '- `src/refunds.ts` — refunds for paused subscriptions',
  ]);
});
test('the two matched words are distinct words of the description, not of the name', () => {
  const files = { 'package.json': '{"name":"x"}', 'src/cache.ts': '// cache layer\n' };
  nulls(q1, files, ['- `src/cache.ts` — cache cache', '- **Cache Layer** (`src/cache.ts`): cache']);
  assert.equal(code(q1, '- `src/cache.ts` — cache layer', files), 'inferable-path');
});
test('only the first 32 KB of a cited file are read', () => {
  const files = { 'package.json': '{"name":"x"}', 'src/late.ts': `${'x'.repeat(33 * 1024)}\n// parse invoice\n`, 'src/early.ts': '// parse invoice\n' };
  assert.equal(ask(q1, '- `src/late.ts` — parse invoice', files), null);
  assert.equal(code(q1, '- `src/early.ts` — parse invoice', files), 'inferable-path');
});
test('more than 40 distinct cited paths turn the detector off for the whole file, in any order', () => {
  const disk: Record<string, string> = { 'package.json': '{"name":"x"}' };
  for (let i = 0; i < 41; i++) disk[`src/m${i}.ts`] = '// parse invoice\n';
  const facts = factsOf(disk);
  const rules = (n: number): ReturnType<typeof parseRules> => parseRules(Array.from({ length: n }, (_, i) => `- \`src/m${i}.ts\` — parse invoice`).join('\n'));
  const ctx = contextFor(facts, { paths: true });
  assert.ok(judgeAll(rules(40), facts, ctx).every((v) => v.code === 'inferable-path'));
  assert.ok(judgeAll(rules(41), facts, ctx).every((v) => v.verdict === 'keep'));
  assert.ok(judgeAll([...rules(41)].reverse(), facts, ctx).every((v) => v.verdict === 'keep'));
});
test('a stack line that splits roles between tools is kept', () => {
  const both = { 'package.json': '{"devDependencies":{"jest":"^29","vitest":"^2","eslint":"^9","@biomejs/biome":"^1","webpack":"^5","vite":"^6"}}' };
  nulls(q1, both, ['- Jest for unit tests, Vitest for integration tests', '- ESLint for linting, Biome for formatting', '- Webpack for server, Vite for client', '- **Testing**: Jest / Vitest']);
  assert.equal(code(q1, '- Jest, ESLint, Prettier, Husky', EVENTS), 'inferable-stack');
});
test('the /init parenthesis is one of the agents\' own sites', () => {
  const s = (paren: string): string => `This file provides guidance to Claude Code (${paren}) when working with code in this repository.`;
  assert.equal(ask(q3, s('staging.example.com'), PLAIN), null);
  for (const site of ['claude.ai/code', 'https://claude.ai/code', 'claude.com/claude-code']) assert.equal(code(q3, s(site), PLAIN), 'file-filler', site);
  assert.equal(code(q3, 'This file provides guidance to Codex (openai.com/codex) when working with code in this repository.', PLAIN), 'file-filler');
});
