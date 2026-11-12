import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts } from '../../hooks/gate/facts.ts';
import { q2 } from '../../hooks/gate/checks/q2.ts';
import { CHECKS } from '../../hooks/gate/verdict.ts';
import { LINT_MAP } from '../../hooks/gate/tables/lint-map.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from './helpers.ts';

// The answer of q2 to the first rule of `text` in a repository holding `files`.
function ask(text: string, files: Record<string, string>, settings?: unknown): Answer | null {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  const all = settings === undefined ? files : { ...files, '.claude/settings.json': JSON.stringify(settings) };
  return q2(rule, readFacts(join(repo(all), 'CLAUDE.md')));
}

const PKG_FORMAT = '{"name":"app","scripts":{"format":"prettier --check ."}}';
const PKG_PLAIN = '{"name":"app","scripts":{"test":"node --test"}}';
const prettier = (cfg: string, pkg = PKG_FORMAT): Record<string, string> => ({ 'package.json': pkg, '.prettierrc': cfg });
const deny = (...entries: string[]): unknown => ({ permissions: { deny: entries } });

test('the table is registered and large enough', () => {
  assert.ok(LINT_MAP.length >= 30);
  assert.ok(CHECKS.some((c) => c.question === 2 && c.run === q2));
  assert.equal(new Set(LINT_MAP.map((e) => e.id)).size, LINT_MAP.length);
  const index = CHECKS.findIndex((c) => c.question === 2);
  assert.ok(index > CHECKS.findIndex((c) => c.question === 1));
});

test('a rule the formatter enforces is cut, naming where it runs', () => {
  const a = ask('Use semicolons.', prettier('{"semi":true}'));
  assert.deepEqual(a, { verdict: 'cut', code: 'enforced-config', question: 2, evidence: '.prettierrc: semi = true; run by package.json scripts.format' });
});
test('a rule that contradicts the config is a conflict', () => {
  const a = ask('Use semicolons.', prettier('{"semi":false}'));
  assert.equal(a?.verdict, 'conflict'); assert.equal(a.code, 'config-conflict'); assert.equal(a.question, 2);
  assert.match(a.evidence, /\.prettierrc: semi = false/);
});
test('nobody runs the tool: the rule is kept', () => {
  assert.equal(ask('Use semicolons.', prettier('{"semi":true}', PKG_PLAIN)), null);
});
test('a code config that may override the readable one: the rule is kept', () => {
  assert.equal(ask('Use semicolons.', { ...prettier('{"semi":true}'), 'prettier.config.js': 'export default {};' }), null);
  assert.equal(ask('Use semicolons.', { ...prettier('{"semi":false}'), 'prettier.config.js': 'export default {};' }), null);
  assert.equal(ask('Use semicolons.', { 'package.json': PKG_FORMAT, 'prettier.config.js': 'export default { semi: true };' }), null);
});
test('a config key that is not set gives nothing', () => {
  assert.equal(ask('Use semicolons.', prettier('{"tabWidth":2}')), null);
  assert.equal(ask('Use semicolons.', { 'package.json': PKG_FORMAT }), null);
});
test('Spanish rules are understood', () => {
  assert.equal(ask('Usa comillas simples.', prettier('{"singleQuote":true}'))?.code, 'enforced-config');
  assert.equal(ask('Usa punto y coma.', prettier('{"semi":true}'))?.code, 'enforced-config');
  assert.equal(ask('Sin punto y coma.', prettier('{"semi":false}'))?.code, 'enforced-config');
  assert.equal(ask('Usa comillas dobles.', prettier('{"singleQuote":true}'))?.verdict, 'conflict');
});
test('the negative form of an intent matches its own value', () => {
  assert.equal(ask('Do not use semicolons.', prettier('{"semi":false}'))?.code, 'enforced-config');
  assert.equal(ask('Avoid semicolons.', prettier('{"semi":true}'))?.verdict, 'conflict');
  assert.equal(ask('No trailing commas.', prettier('{"trailingComma":"none"}'))?.code, 'enforced-config');
});
test('a config in package.json counts and a husky hook proves the run', () => {
  const files = { 'package.json': '{"name":"app","prettier":{"singleQuote":true}}', '.husky/pre-commit': 'npx prettier --write .\n' };
  const a = ask('Usa comillas simples.', files);
  assert.equal(a?.code, 'enforced-config');
  assert.equal(a.evidence, 'package.json: singleQuote = true; run by .husky/pre-commit');
});
test('the evidence names the file that proves the run, never a generic place', () => {
  const base = { 'package.json': '{"name":"app"}', '.prettierrc': '{"semi":true}' };
  const sources: Record<string, string> = {
    'lefthook.yml': 'pre-commit:\n  commands:\n    fmt:\n      run: npx prettier --check .\n',
    '.pre-commit-config.yaml': 'repos:\n- repo: local\n  hooks:\n  - id: prettier\n',
    '.github/workflows/ci.yml': 'jobs:\n  x:\n    steps:\n      - run: npx prettier --check .\n',
    '.husky/pre-commit': 'npx lint-staged && prettier --check .\n',
  };
  for (const [file, body] of Object.entries(sources)) {
    const a = ask('Use semicolons.', { ...base, [file]: body });
    assert.equal(a?.evidence, `.prettierrc: semi = true; run by ${file}`, file);
    assert.doesNotMatch(a.evidence, /scripts\/hooks\/CI/);
  }
});

test('an override of the tool config keeps the rule', () => {
  const overridden = '{"semi":true,"overrides":[{"files":"*.vue","options":{"semi":false}}]}';
  assert.equal(ask('Use semicolons.', prettier(overridden)), null);
  assert.equal(ask('Use semicolons.', { 'package.json': '{"name":"app","scripts":{"format":"prettier ."},"prettier":{"semi":true,"overrides":[]}}' }), null);
  assert.equal(ask('Use semicolons.', { ...ESLINT('{"semi":"error"}'), '.eslintrc.json': '{"rules":{"semi":"error"},"overrides":[{"files":["*.ts"],"rules":{"semi":"off"}}]}' }), null);
  assert.equal(ask('Use semicolons.', { 'package.json': PKG_FORMAT, '.prettierrc.yaml': 'semi: true\noverrides:\n  - files: "*.vue"\n' }), null);
  assert.equal(ask('Use semicolons.', prettier('{"semi":true}'))?.code, 'enforced-config'); // no override: still cut
});
test('an editorconfig section other than [*] that sets the key silences the conflict', () => {
  assert.equal(ask('Indent with 2 spaces.', { '.editorconfig': '[*]\nindent_size = 4\n[*.py]\nindent_size = 2\n' }), null);
  assert.equal(ask('Indent with 2 spaces.', { '.editorconfig': '[*]\nindent_size = 4\n[*.md]\ntrim_trailing_whitespace = false\n' })?.verdict, 'conflict');
});

test('trailing commas accept every value that adds them', () => {
  assert.equal(ask('Use trailing commas.', prettier('{"trailingComma":"es5"}'))?.code, 'enforced-config');
  assert.equal(ask('Use trailing commas.', prettier('{"trailingComma":"all"}'))?.code, 'enforced-config');
  assert.equal(ask('Use trailing commas.', prettier('{"trailingComma":"none"}'))?.verdict, 'conflict');
});
test('numeric options are compared by value', () => {
  assert.equal(ask('Set the tab width to 2.', prettier('{"tabWidth":2}')), null); // "the" is not part of the phrase
  assert.equal(ask('Tab width 2.', prettier('{"tabWidth":2}'))?.code, 'enforced-config');
  assert.equal(ask('Tab width 2.', prettier('{"tabWidth":4}'))?.verdict, 'conflict');
  assert.equal(ask('Max line length 100.', prettier('{"printWidth":100}'))?.code, 'enforced-config');
  assert.equal(ask('Max line length 100.', prettier('{"printWidth":80}'))?.verdict, 'conflict');
});

test('tsc always counts as running when a tsconfig exists', () => {
  const a = ask('Enable strict mode.', { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
  assert.deepEqual(a, { verdict: 'cut', code: 'enforced-config', question: 2, evidence: 'tsconfig.json: strict = true; run by tsc (tsconfig.json)' });
  assert.equal(ask('Enable strict mode.', { 'tsconfig.json': '{"compilerOptions":{"strict":false}}' })?.verdict, 'conflict');
  assert.equal(ask('Enable strict mode.', { 'tsconfig.json': '{"compilerOptions":{}}' }), null);
});
test('noImplicitAny follows strict and noUnusedLocals is its own flag', () => {
  assert.equal(ask('Disallow implicit any.', { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' })?.code, 'enforced-config');
  assert.equal(ask('Disallow implicit any.', { 'tsconfig.json': '{"compilerOptions":{"strict":true,"noImplicitAny":false}}' })?.verdict, 'conflict');
  assert.equal(ask('Avoid unused variables.', { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' }), null);
  assert.equal(ask('Avoid unused variables.', { 'tsconfig.json': '{"compilerOptions":{"noUnusedLocals":true}}' })?.code, 'enforced-config');
});

test('editorconfig can conflict but never cuts', () => {
  assert.equal(ask('Indent with 2 spaces.', { '.editorconfig': 'root = true\n[*]\nindent_size = 4\n' })?.verdict, 'conflict');
  assert.equal(ask('Indent with 2 spaces.', { '.editorconfig': 'root = true\n[*]\nindent_size = 2\n' }), null);
  assert.equal(ask('Indent with spaces.', { '.editorconfig': '[*]\nindent_style = space\n' }), null);
  assert.equal(ask('Indent with tabs.', { '.editorconfig': '[*]\nindent_style = space\n' })?.verdict, 'conflict');
  assert.equal(ask('Use LF line endings.', { '.editorconfig': '[*]\nend_of_line = lf\n' }), null);
  assert.equal(ask('Use LF line endings.', { '.editorconfig': '[*]\nend_of_line = crlf\n' })?.verdict, 'conflict');
  // Even when a script runs prettier.
  assert.equal(ask('Indent with 2 spaces.', { 'package.json': PKG_FORMAT, '.editorconfig': '[*]\nindent_size = 2\n' }), null);
});

const ESLINT = (rules: string): Record<string, string> => ({ 'package.json': '{"name":"app","scripts":{"lint":"eslint ."}}', '.eslintrc.json': `{"rules":${rules}}` });
test('eslint rules in array and string forms are read', () => {
  assert.equal(ask('Use single quotes.', ESLINT('{"quotes":["error","single"]}'))?.code, 'enforced-config');
  assert.equal(ask('Use single quotes.', ESLINT('{"quotes":["error","double"]}'))?.verdict, 'conflict');
  assert.equal(ask('Use semicolons.', ESLINT('{"semi":"error"}'))?.code, 'enforced-config'); // "always" is the default
  assert.equal(ask('Use semicolons.', ESLINT('{"semi":["error","never"]}'))?.verdict, 'conflict');
  assert.equal(ask('Avoid var.', ESLINT('{"no-var":"error"}'))?.code, 'enforced-config');
  assert.equal(ask('Avoid var.', ESLINT('{"no-var":"off"}'))?.verdict, 'conflict');
  assert.equal(ask('Use `const` instead of `let` when possible.', ESLINT('{"prefer-const":2}')), null);
  assert.equal(ask('Prefer const.', ESLINT('{"prefer-const":2}'))?.code, 'enforced-config');
  assert.equal(ask('Use === instead of ==.', ESLINT('{"eqeqeq":["error","always"]}'))?.code, 'enforced-config');
  assert.equal(ask('Avoid console.log.', ESLINT('{"no-console":"error"}'))?.code, 'enforced-config');
});
test('a warning, an unset rule, an unrun eslint or a code config give nothing', () => {
  assert.equal(ask('Use single quotes.', ESLINT('{"quotes":["warn","single"]}')), null);
  assert.equal(ask('Use single quotes.', ESLINT('{"semi":"error"}')), null);
  assert.equal(ask('Avoid var.', { 'package.json': PKG_PLAIN, '.eslintrc.json': '{"rules":{"no-var":"error"}}' }), null);
  assert.equal(ask('Avoid var.', { ...ESLINT('{"no-var":"error"}'), 'eslint.config.js': 'export default [];' }), null);
  assert.equal(ask('Avoid console.log.', ESLINT('{"no-console":["error",{"allow":["log"]}]}')), null);
});

test('conventional commits are enforced by commitlint when it runs', () => {
  const files = { 'package.json': '{"name":"app","scripts":{"commitlint":"commitlint --edit"}}', '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}' };
  assert.equal(ask('Use conventional commits.', files)?.code, 'enforced-config');
  assert.equal(ask('Commit messages must follow Conventional Commits.', files)?.code, 'enforced-config');
  assert.equal(ask('Use conventional commits.', { ...files, 'package.json': PKG_PLAIN }), null);
  assert.equal(ask('Use conventional commits for releases only.', files), null);
});

test('a prohibition a deny rule blocks is cut', () => {
  const a = ask('Never run `git push --force`.', {}, deny('Bash(git push --force:*)'));
  assert.deepEqual(a, { verdict: 'cut', code: 'enforced-deny', question: 2, evidence: 'permissions.deny: Bash(git push --force:*)' });
  assert.equal(ask('Do not run `git push --force origin main`.', {}, deny('Bash(git push --force*)'))?.code, 'enforced-deny');
  assert.equal(ask('Nunca ejecutes `git push --force`.', {}, deny('Bash(git push --force:*)'))?.code, 'enforced-deny');
});
test('a prohibition without a deny rule is kept', () => {
  assert.equal(ask('Never run `git push --force`.', {}), null);
  assert.equal(ask('Never run `git push --force`.', {}, deny('Bash(rm -rf:*)')), null);
  assert.equal(ask('Never run `git push --force`.', {}, deny('Bash(git push:*)'))?.code, 'enforced-deny'); // the broader prefix blocks it too
});
test('a deny entry without a wildcard is an exact match', () => {
  assert.equal(ask('Never run `npm run build --watch`.', {}, deny('Bash(npm run build)')), null);
  assert.equal(ask('Never run `npm run build`.', {}, deny('Bash(npm run build)'))?.code, 'enforced-deny');
  assert.equal(ask('Never run `npm run build --watch`.', {}, deny('Bash(npm run build:*)'))?.code, 'enforced-deny');
});
test('a deny rule only covers commands it really starts', () => {
  assert.equal(ask('Never run `git pushall`.', {}, deny('Bash(git push:*)')), null);
  assert.equal(ask('Never run `git push`.', {}, deny('Bash(git push --force:*)')), null);
  assert.equal(ask('Never run `git push`.', {}, deny('Bash(*)')), null);
  assert.equal(ask('Never run `git push`.', {}, deny('Read(./.env)')), null);
});
test('a prohibition that says more than the deny rule is kept', () => {
  const d = deny('Bash(git push --force:*)');
  assert.equal(ask('Never run `git push --force` without asking me first.', {}, d), null);
  assert.equal(ask('Never run `git push --force` on main; the history is shared.', {}, d), null);
  assert.equal(ask('Run `git push --force` only after a backup.', {}, d), null);
  assert.equal(ask('Run `git push --force`.', {}, d), null);
});

// Rules that carry information must survive.
test('a rule that says more than the intent is kept', () => {
  const p = prettier('{"semi":true,"singleQuote":true,"tabWidth":2,"useTabs":false}');
  for (const text of [
    'Use semicolons only in `for` headers.', 'Avoid semicolons in JSON fixtures.', 'Always use semicolons.', 'Never use semicolons in tests.',
    'Use semicolons when the line ends a statement.', 'Use semicolons, except in Vue files.', 'Use semicolons in 3 places.',
    'Use semicolons and keep lines short.', "Don't use semicolons after imports.",
    'Use single quotes unless the string has an apostrophe.', 'Use single quotes in JavaScript but double quotes in JSX.',
    'Usa comillas simples excepto en JSX.', 'Usa punto y coma solo en los tests.', 'Usa comillas simples y nunca plantillas.',
    'Indent with 2 spaces in YAML.', 'Tab width 2 for Python only.', 'Use semicolons. Use single quotes.',
  ]) assert.equal(ask(text, p), null, text);
});
test('a rule that says more than the compiler flag is kept', () => {
  const ts = { 'tsconfig.json': '{"compilerOptions":{"strict":true,"noUnusedLocals":true}}' };
  for (const text of [
    'Enable strict mode in new packages.', 'Enable strict mode before releasing.', 'Never disable strict mode.', 'Enable strict mode, but allow any in tests.',
    'Avoid unused variables except in test helpers.', 'Disallow implicit any only in src.', 'Enable strict mode when migrating.',
  ]) assert.equal(ask(text, ts), null, text);
});
test('a rule with a keyword of the table but another meaning is kept', () => {
  const files = { ...prettier('{"semi":true,"singleQuote":true}'), ...ESLINT('{"no-var":"error","prefer-const":2}') };
  for (const text of [
    'Semicolons are required by the legacy parser, see docs.', 'Quotes inside strings must be escaped.', 'Never use var in generated code.',
    'Use const for module-level constants and let for loop counters.', 'Prefer const over let in hot paths.', 'Strict mode is required for new files.',
    'The strict flag stays off for the legacy folder.', 'Single quotes for strings, backticks for templates.',
  ]) assert.equal(ask(text, files), null, text);
});
test('headings, code blocks and unrelated text are ignored', () => {
  const p = prettier('{"semi":true}');
  assert.equal(ask('# Use semicolons', p), null);
  assert.equal(ask('```\nUse semicolons.\n```', p), null);
  assert.equal(ask('Write tests first.', p), null);
});
