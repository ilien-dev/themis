import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFacts } from '../../hooks/gate/facts.ts';
import { parseEditorconfig, parseFlatYaml, parseJsonc } from '../../hooks/gate/read-config.ts';
import { repo } from './helpers.ts';

test('the nearest package.json wins in a monorepo', () => {
  const d = repo({ 'package.json': '{"name":"root","dependencies":{"react":"1"}}', 'packages/api/package.json': '{"name":"api","dependencies":{"express":"1"}}', 'packages/api/CLAUDE.md': '' });
  const f = readFacts(join(d, 'packages/api/CLAUDE.md'));
  const pkg = f.pkg;
  assert.ok(pkg); assert.equal(pkg.name, 'api'); assert.ok(pkg.deps.has('express')); assert.ok(!pkg.deps.has('react'));
});
test('prettier config resolves values and needs proof of execution', () => {
  const d = repo({ '.prettierrc': 'semi: false\nsingleQuote: true\n', 'package.json': '{"scripts":{"format":"prettier --write ."}}' });
  const f = readFacts(join(d, 'CLAUDE.md'));
  assert.equal(f.config.get('prettier.semi'), false); assert.ok(f.runs.has('prettier'));
  assert.ok(!readFacts(join(repo({ '.prettierrc': 'semi: false\n' }), 'CLAUDE.md')).runs.has('prettier'));
});
test('tsconfig with comments and extends is read; a cycle does not throw', () => {
  const d = repo({ 'tsconfig.json': '{ // c\n "extends": "./base.json" }', 'base.json': '{"extends":"./tsconfig.json","compilerOptions":{"strict":true}}' });
  assert.equal(readFacts(join(d, 'CLAUDE.md')).config.get('tsconfig.strict'), true);
});
test('broken package.json gives null, not an exception', () => {
  assert.equal(readFacts(join(repo({ 'package.json': '{nope' }), 'CLAUDE.md')).pkg, null);
});
test('code-only configs are listed as unreadable', () => {
  assert.deepEqual(readFacts(join(repo({ 'eslint.config.js': '' }), 'CLAUDE.md')).unreadable, ['eslint.config.js']);
});
test('outside a git repo inRepo is false and root is the file directory', () => {
  const d = mkdtempSync(join(tmpdir(), 'themis-nogit-'));
  writeFileSync(join(d, 'package.json'), '{"name":"x"}');
  const f = readFacts(join(d, 'CLAUDE.md'));
  assert.equal(f.inRepo, false);
  assert.equal(f.root, f.dir);
  assert.equal(f.pkg?.name, 'x');
});
test('permissions.deny is read from both settings files', () => {
  const d = repo({
    '.claude/settings.json': '{"permissions":{"deny":["Bash(rm -rf:*)"]}}',
    '.claude/settings.local.json': '{"permissions":{"deny":["Read(.env)"]}}',
  });
  assert.deepEqual([...readFacts(join(d, 'CLAUDE.md')).deny].sort(), ['Bash(rm -rf:*)', 'Read(.env)']);
});
test('files are posix paths relative to the root, languages are counted, override skips git', () => {
  const d = repo({ 'src/a.ts': '', 'src/b.ts': '', 'tool.py': '' });
  const f = readFacts(join(d, 'src/CLAUDE.md'));
  assert.ok(f.files.has('src/a.ts')); assert.deepEqual(f.languages, ['TypeScript', 'Python']);
  const o = readFacts(join(d, 'CLAUDE.md'), { files: ['x/y.go'] });
  assert.deepEqual([...o.files], ['x/y.go']); assert.deepEqual(o.languages, ['Go']);
});
test('editorconfig, biome, eslint rules, lockfiles and docs are read', () => {
  const d = repo({
    '.editorconfig': 'root = true\n[*]\nindent_style = space\n[*.md]\nindent_style = tab\n',
    'biome.json': '{"formatter":{"indentStyle":"tab"},}',
    '.eslintrc.json': '{"rules":{"quotes":["error","single"]}}',
    'pnpm-lock.yaml': '',
    'README.md': 'First para.\n\nSecond para.\n',
    'docs/guide.md': 'Guide text.\n',
  });
  const f = readFacts(join(d, 'CLAUDE.md'));
  assert.equal(f.config.get('editorconfig.indent_style'), 'space');
  assert.equal(f.config.get('biome.formatter.indentStyle'), 'tab');
  assert.deepEqual(f.config.get('eslint.rules.quotes'), ['error', 'single']);
  assert.ok(f.lockfiles.has('pnpm-lock.yaml'));
  assert.deepEqual(f.docs, [{ file: 'README.md', text: 'First para.' }, { file: 'README.md', text: 'Second para.' }, { file: 'docs/guide.md', text: 'Guide text.' }]);
});
test('config parsers tolerate comments, trailing commas and nesting', () => {
  assert.deepEqual(parseJsonc('{ /* a */ "u": "http://x//y", "l": [1,2,], }'), { u: 'http://x//y', l: [1, 2] });
  assert.equal(parseJsonc('{nope'), null);
  assert.deepEqual(parseFlatYaml('# c\nsemi: false\nwidth: 80\nname: "a b" # note\nnested:\n  x: 1\n'), { semi: false, width: 80, name: 'a b' });
  assert.deepEqual(parseEditorconfig('root = true\n[*.js]\nindent_size = 4\n[*]\nIndent_Style = Space\n'), { root: 'true', indent_style: 'space' });
});
test('filesKnown is true with a git listing and with override.files', () => {
  const d = repo({ 'a.ts': '' });
  assert.equal(readFacts(join(d, 'CLAUDE.md')).filesKnown, true);
  assert.equal(readFacts(join(d, 'CLAUDE.md'), { files: [] }).filesKnown, true);
});
