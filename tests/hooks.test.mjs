import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooks = join(root, 'hooks');

function hook(name, input, env = {}) {
  const r = spawnSync(process.execPath, [join(hooks, name)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const decision = (o) => o?.hookSpecificOutput?.permissionDecision ?? null;

function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'themis-t-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}
const write = (dir, content, file = 'CLAUDE.md', env) =>
  hook('pre-tool.mjs', { tool_name: 'Write', tool_input: { file_path: file, content }, cwd: dir }, env);

test('malformed and empty input exit 0 silently', () => {
  for (const h of ['session-start.mjs', 'pre-tool.mjs']) {
    const r = spawnSync(process.execPath, [join(hooks, h)], { input: '{not json', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
  assert.equal(hook('pre-tool.mjs', ''), null);
});

test('BOM-prefixed input is accepted', () => {
  const body = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'CLAUDE.md', content: 'x'.repeat(10000) }, cwd: project() });
  assert.equal(decision(hook('pre-tool.mjs', '﻿' + body)), 'deny');
});

test('session start injects the core rule; THEMIS_CORE_FILE overrides it', () => {
  const ctx = hook('session-start.mjs', { source: 'compact' }).hookSpecificOutput.additionalContext;
  assert.equal(ctx, readFileSync(join(hooks, 'core.txt'), 'utf8').trim());
  const alt = join(project({ 'c.txt': 'alt rule' }), 'c.txt');
  assert.equal(hook('session-start.mjs', {}, { THEMIS_CORE_FILE: alt }).hookSpecificOutput.additionalContext, 'alt rule');
  const empty = join(project({ 'e.txt': '' }), 'e.txt');
  assert.equal(hook('session-start.mjs', {}, { THEMIS_CORE_FILE: empty }), null);
});

test('core rule stays tiny', () => {
  const core = readFileSync(join(hooks, 'core.txt'), 'utf8');
  assert.ok(core.length / 3.6 < 100, `core is ~${Math.round(core.length / 3.6)} tokens`);
});

test('cap: write over the cap is denied, under is allowed, other files ignored', () => {
  const dir = project();
  assert.equal(decision(write(dir, 'x'.repeat(10000))), 'deny');
  assert.equal(decision(write(dir, 'x'.repeat(10000), '.claude/CLAUDE.local.md')), 'deny');
  assert.equal(write(dir, 'npm test'), null);
  assert.equal(write(dir, 'x'.repeat(10000), 'README.md'), null);
});

test('cap: growing past the cap is denied; shrinking an oversized file is allowed', () => {
  const dir = project({ 'CLAUDE.md': 'a'.repeat(8900) + '\nOLD' });
  const edit = (d, ti) => hook('pre-tool.mjs', { tool_name: 'Edit', tool_input: { file_path: join(d, 'CLAUDE.md'), ...ti }, cwd: d });
  assert.equal(decision(edit(dir, { old_string: 'OLD', new_string: 'b'.repeat(300) })), 'deny');
  assert.equal(edit(dir, { old_string: 'OLD', new_string: 'b'.repeat(20) }), null);
  const over = project({ 'CLAUDE.md': 'a'.repeat(12000) });
  assert.equal(edit(over, { old_string: 'a'.repeat(1000), new_string: '' }), null);
  const multi = hook('pre-tool.mjs', { tool_name: 'MultiEdit', tool_input: { file_path: 'CLAUDE.md', edits: [{ old_string: 'OLD', new_string: 'c'.repeat(400) }] }, cwd: dir });
  assert.equal(decision(multi), 'deny');
});

test('cap: imports count, code spans do not', () => {
  const dir = project({ 'docs/big.md': 'y'.repeat(8800) });
  const out = write(dir, 'See @docs/big.md\n' + 'z'.repeat(200));
  assert.equal(decision(out), 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /imported/);
  assert.equal(write(dir, 'Mention `@docs/big.md` in code only'), null);
});

test('cap: configurable and disableable', () => {
  const dir = project();
  assert.equal(write(dir, 'x'.repeat(10000), 'CLAUDE.md', { CLAUDE_PLUGIN_OPTION_CLAUDE_MD_CAP: '0' }), null);
  assert.equal(decision(write(dir, 'x'.repeat(500), 'CLAUDE.md', { CLAUDE_PLUGIN_OPTION_CLAUDE_MD_CAP: '100' })), 'deny');
});

test('cap: shell writes to CLAUDE.md are denied; other shell commands pass', () => {
  const dir = project();
  const bash = (command, tool_name = 'Bash') => hook('pre-tool.mjs', { tool_name, tool_input: { command }, cwd: dir });
  for (const c of ['echo rule >> CLAUDE.md', "sed -i 's/a/b/' CLAUDE.md", 'cat x | tee CLAUDE.md']) assert.equal(decision(bash(c)), 'deny', c);
  assert.equal(decision(bash("Add-Content CLAUDE.md 'x'", 'PowerShell')), 'deny');
  for (const c of ['cat CLAUDE.md', 'wc -c CLAUDE.md', 'git diff CLAUDE.md']) assert.equal(bash(c), null, c);
});

test('manifest, hooks and skills are consistent', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.userConfig), ['claude_md_cap']);
  const hooksJson = readFileSync(join(hooks, 'hooks.json'), 'utf8');
  for (const f of hooksJson.match(/hooks\/[\w-]+\.mjs/g)) assert.ok(readFileSync(join(root, f)), f);
  for (const s of ['ariadne', 'daedalus', 'apollo', 'argus', 'hermes', 'hestia']) {
    const md = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8').replace(/\r/g, '');
    assert.match(md, /^---\nname: [a-z]+\ndescription: "[^"]+"/, s);
    assert.match(md, /disable-model-invocation: true/, s);
  }
});
