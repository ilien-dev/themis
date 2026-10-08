import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooks = join(root, 'hooks');
const { twinOf } = await import('../hooks/lib.mjs');

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
const reason = (o) => o?.hookSpecificOutput?.permissionDecisionReason ?? '';
const context = (o) => o?.hookSpecificOutput?.additionalContext ?? null;

function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'themis-t-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}
const text = (dir, file) => readFileSync(join(dir, file), 'utf8');
const pre = (dir, tool_name, tool_input, env) => hook('pre-tool.mjs', { tool_name, tool_input, cwd: dir }, env);
const write = (dir, content, file = 'CLAUDE.md', env) => pre(dir, 'Write', { file_path: file, content }, env);
const post = (dir, tool_name, tool_input, env) =>
  hook('parity.mjs', { hook_event_name: 'PostToolUse', tool_name, tool_input, cwd: dir }, env);
const start = (dir, env) => hook('parity.mjs', { hook_event_name: 'SessionStart', source: 'startup', cwd: dir }, env);
const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });

test('malformed and empty input exit 0 silently', () => {
  for (const h of ['parity.mjs', 'pre-tool.mjs']) {
    const r = spawnSync(process.execPath, [join(hooks, h)], { input: '{not json', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(hook(h, ''), null);
  }
});

test('BOM-prefixed input is accepted', () => {
  const body = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'CLAUDE.md', content: 'x'.repeat(10000) }, cwd: project() });
  assert.equal(decision(hook('pre-tool.mjs', '﻿' + body)), 'deny');
});

test('cap: write over the cap is denied, under is allowed, other files ignored', () => {
  const dir = project();
  assert.equal(decision(write(dir, 'x'.repeat(10000))), 'deny');
  assert.equal(decision(write(dir, 'x'.repeat(10000), 'AGENTS.md')), 'deny');
  assert.equal(decision(write(dir, 'x'.repeat(10000), '.claude/CLAUDE.local.md')), 'deny');
  assert.equal(write(dir, 'npm test'), null);
  assert.equal(write(dir, 'npm test', 'AGENTS.md'), null);
  assert.equal(write(dir, 'x'.repeat(10000), 'README.md'), null);
});

test('cap: growing past the cap is denied; shrinking an oversized file is allowed', () => {
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const dir = project({ [name]: 'a'.repeat(8900) + '\nOLD' });
    const edit = (d, ti) => pre(d, 'Edit', { file_path: join(d, name), ...ti });
    assert.equal(decision(edit(dir, { old_string: 'OLD', new_string: 'b'.repeat(300) })), 'deny', name);
    assert.equal(edit(dir, { old_string: 'OLD', new_string: 'b'.repeat(20) }), null, name);
    const over = project({ [name]: 'a'.repeat(12000) });
    assert.equal(edit(over, { old_string: 'a'.repeat(1000), new_string: '' }), null, name);
    const multi = pre(dir, 'MultiEdit', { file_path: name, edits: [{ old_string: 'OLD', new_string: 'c'.repeat(400) }] });
    assert.equal(decision(multi), 'deny', name);
  }
});

test('cap: imports count, code spans do not', () => {
  const dir = project({ 'docs/big.md': 'y'.repeat(8800) });
  const out = write(dir, 'See @docs/big.md\n' + 'z'.repeat(200));
  assert.equal(decision(out), 'deny');
  assert.match(reason(out), /imported/);
  assert.match(reason(out), /themis:themis/);
  assert.equal(write(dir, 'Mention `@docs/big.md` in code only'), null);
});

test('cap: configurable and disableable', () => {
  const dir = project();
  assert.equal(write(dir, 'x'.repeat(10000), 'CLAUDE.md', { CLAUDE_PLUGIN_OPTION_CLAUDE_MD_CAP: '0' }), null);
  assert.equal(decision(write(dir, 'x'.repeat(500), 'AGENTS.md', { CLAUDE_PLUGIN_OPTION_CLAUDE_MD_CAP: '100' })), 'deny');
});

test('shell writes to a rule file are denied; other shell commands pass', () => {
  const dir = project();
  const bash = (command, tool_name = 'Bash') => pre(dir, tool_name, { command });
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'CLAUDE.local.md']) {
    for (const c of [`echo rule >> ${f}`, `sed -i 's/a/b/' ${f}`, `cat x | tee ${f}`]) assert.equal(decision(bash(c)), 'deny', c);
    assert.equal(decision(bash(`Add-Content ${f} 'x'`, 'PowerShell')), 'deny', f);
    for (const c of [`cat ${f}`, `wc -c ${f}`, `git diff ${f}`]) assert.equal(bash(c), null, c);
  }
  assert.equal(bash('echo AGENTS > notes.txt'), null);
});

test('shell block looks at what the command writes to, not at any ">" in it', () => {
  const dir = project();
  const bash = (command, tool_name = 'Bash') => pre(dir, tool_name, { command });
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    for (const c of [
      `cat ${f} 2>&1`, `cmp CLAUDE.md AGENTS.md > /dev/null 2>&1`, `git diff ${f} > out.patch`, `wc -c ${f} >> sizes.txt`,
      `node -e "console.log([1].map(x => x))" ${f}`, `git commit -m "${f} -> shorter"`, `cat ${f} | tee copy.txt`,
      `grep -c x ${f} 2>/dev/null`, `sed -n 1,5p ${f}`,
    ]) assert.equal(bash(c), null, c);
    for (const c of [`Get-Content ${f} | Out-File copy.txt`, `Get-Content ${f} 2>$null`, `Set-Content notes.txt (Get-Content ${f})`]) assert.equal(bash(c, 'PowerShell'), null, c);
    for (const c of [
      `echo x > ${f}`, `echo x >${f}`, `echo x >> "./docs/${f}"`, `cat > sub/${f} <<EOF`, `printf x 2>&1 >> ${f}`,
      `cat x | tee -a ${f}`, `sed -i 's|a|b|' ${f}`, `perl -i -pe 's/a/b/' ${f}`,
    ]) assert.equal(decision(bash(c)), 'deny', c);
    for (const c of [`'x' | Out-File ${f}`, `Set-Content -Path ${f} -Value x`, `Add-Content .\\${f} 'x'`, `'x' > ${f}`]) assert.equal(decision(bash(c, 'PowerShell')), 'deny', c);
  }
});

test('parity: an edit to one file is copied to the other, byte for byte', () => {
  const dir = project({ 'CLAUDE.md': 'a\r\nb\n', 'AGENTS.md': 'a\r\nb\n' });
  assert.equal(pre(dir, 'Edit', { file_path: 'CLAUDE.md', old_string: 'b', new_string: 'c' }), null);
  writeFileSync(join(dir, 'CLAUDE.md'), 'a\r\nc\n'); // the tool ran
  const out = post(dir, 'Edit', { file_path: 'CLAUDE.md', old_string: 'b', new_string: 'c' });
  assert.equal(text(dir, 'AGENTS.md'), 'a\r\nc\n');
  assert.match(context(out), /AGENTS\.md/);
  // the other direction, and a no-op when they already match
  writeFileSync(join(dir, 'AGENTS.md'), 'z\n');
  post(dir, 'Write', { file_path: join(dir, 'AGENTS.md'), content: 'z\n' });
  assert.equal(text(dir, 'CLAUDE.md'), 'z\n');
  assert.equal(post(dir, 'MultiEdit', { file_path: 'CLAUDE.md', edits: [] }), null);
});

test('parity: a missing twin is created, in subdirectories and in .claude/ too', () => {
  const dir = project({ 'CLAUDE.md': 'root\n', 'pkg/api/AGENTS.md': 'api\n', '.claude/CLAUDE.md': 'dot\n' });
  post(dir, 'Write', { file_path: 'CLAUDE.md', content: 'root\n' });
  post(dir, 'Write', { file_path: 'pkg/api/AGENTS.md', content: 'api\n' });
  post(dir, 'Write', { file_path: '.claude/CLAUDE.md', content: 'dot\n' });
  assert.equal(text(dir, 'AGENTS.md'), 'root\n');
  assert.equal(text(dir, 'pkg/api/CLAUDE.md'), 'api\n');
  assert.equal(text(dir, '.claude/AGENTS.md'), 'dot\n');
});

test('parity: creating the missing file is allowed only as a copy of the existing one', () => {
  const dir = project({ 'CLAUDE.md': 'rules\n' });
  assert.equal(write(dir, 'rules\n', 'AGENTS.md'), null);
  const out = write(dir, 'other rules\n', 'AGENTS.md');
  assert.equal(decision(out), 'deny');
  assert.match(reason(out), /copy/);
  assert.equal(write(project(), 'first file\n', 'AGENTS.md'), null);
});

test('parity: when the two already differ, Edit is denied and Write asks the user', () => {
  const dir = project({ 'CLAUDE.md': 'mine\n', 'AGENTS.md': 'theirs\n' });
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    const e = pre(dir, 'Edit', { file_path: f, old_string: 's', new_string: 'S' });
    assert.equal(decision(e), 'deny', f);
    assert.match(reason(e), /CLAUDE\.md/);
    assert.match(reason(e), /AGENTS\.md/);
    assert.match(reason(e), /ask/i);
    assert.equal(decision(pre(dir, 'MultiEdit', { file_path: f, edits: [{ old_string: 's', new_string: 'S' }] })), 'deny', f);
    // even a write that copies the other file picks a winner, so the user confirms it
    for (const content of ['merged\n', 'theirs\n', 'mine\n']) assert.equal(decision(write(dir, content, f)), 'ask', f);
  }
  // nothing was changed by the checks themselves
  assert.equal(text(dir, 'CLAUDE.md'), 'mine\n');
  assert.equal(text(dir, 'AGENTS.md'), 'theirs\n');
  // the approved write lands, then the copy restores parity
  writeFileSync(join(dir, 'AGENTS.md'), 'merged\n');
  post(dir, 'Write', { file_path: 'AGENTS.md', content: 'merged\n' });
  assert.equal(text(dir, 'CLAUDE.md'), 'merged\n');
});

test('parity: the cap is checked before the difference', () => {
  const dir = project({ 'CLAUDE.md': 'mine\n', 'AGENTS.md': 'theirs\n' });
  const out = write(dir, 'x'.repeat(10000));
  assert.equal(decision(out), 'deny');
  assert.match(reason(out), /cap/);
});

test('parity: CLAUDE.local.md, the user and managed directories, and other files have no twin', () => {
  const home = project({ '.claude/CLAUDE.md': 'global\n' });
  const env = { HOME: home, USERPROFILE: home };
  post(home, 'Write', { file_path: '.claude/CLAUDE.md', content: 'global\n' }, env);
  assert.ok(!existsSync(join(home, '.claude', 'AGENTS.md')));
  assert.equal(start(join(home, '.claude'), env), null);

  const dir = project({ 'CLAUDE.local.md': 'me\n', 'README.md': 'r\n' });
  post(dir, 'Write', { file_path: 'CLAUDE.local.md', content: 'me\n' });
  post(dir, 'Write', { file_path: 'README.md', content: 'r\n' });
  assert.deepEqual(readdirSync(dir).sort(), ['CLAUDE.local.md', 'README.md']);
  assert.equal(start(dir), null);

  const managed = process.platform === 'win32'
    ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'ClaudeCode')]
    : ['/Library/Application Support/ClaudeCode', '/etc/claude-code'];
  for (const d of managed) assert.equal(twinOf(join(d, 'CLAUDE.md')), null, d);
});

test('parity: a project directory that happens to be called claude-code or ClaudeCode is paired like any other', () => {
  const dir = project({ 'ClaudeCode/CLAUDE.md': 'a\n', 'claude-code/AGENTS.md': 'b\n' });
  assert.match(context(start(dir)), /ClaudeCode\/CLAUDE\.md exists/);
  post(dir, 'Write', { file_path: 'ClaudeCode/CLAUDE.md', content: 'a\n' });
  post(dir, 'Write', { file_path: 'claude-code/AGENTS.md', content: 'b\n' });
  assert.equal(text(dir, 'ClaudeCode/AGENTS.md'), 'a\n');
  assert.equal(text(dir, 'claude-code/CLAUDE.md'), 'b\n');
});

test('parity: a file that imports its twin is left alone and reported', () => {
  const dir = project({ 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': 'rules\n' });
  assert.equal(pre(dir, 'Edit', { file_path: 'AGENTS.md', old_string: 'rules', new_string: 'rules 2' }), null);
  writeFileSync(join(dir, 'AGENTS.md'), 'rules 2\n');
  assert.equal(post(dir, 'Edit', { file_path: 'AGENTS.md' }), null);
  assert.equal(text(dir, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(context(start(dir)), /import/);
  // an import inside a code span is not an import
  const code = project({ 'CLAUDE.md': 'see `@AGENTS.md`\n', 'AGENTS.md': 'rules\n' });
  assert.match(context(start(code)), /differ/);
});

test('parity: a symlinked pair is left alone', (t) => {
  const dir = project({ 'AGENTS.md': 'rules\n' });
  try { symlinkSync(join(dir, 'AGENTS.md'), join(dir, 'CLAUDE.md')); } catch { return t.skip('symlinks are not available here'); }
  assert.equal(pre(dir, 'Edit', { file_path: 'AGENTS.md', old_string: 'rules', new_string: 'r' }), null);
  assert.equal(post(dir, 'Write', { file_path: 'AGENTS.md', content: 'rules\n' }), null);
  assert.match(context(start(dir)), /symlink/);
});

test('parity: session start is silent when every pair matches', () => {
  assert.equal(start(project()), null);
  assert.equal(start(project({ 'CLAUDE.md': 'a\n', 'AGENTS.md': 'a\n', 'sub/CLAUDE.md': 'b\n', 'sub/AGENTS.md': 'b\n', 'CLAUDE.local.md': 'me\n' })), null);
});

test('parity: session start names each pair that differs or is incomplete, and tells Claude to ask', () => {
  const dir = project({
    'CLAUDE.md': 'a\n', 'AGENTS.md': 'changed by hand\n',
    'pkg/api/AGENTS.md': 'api\n',
    'ok/CLAUDE.md': 'same\n', 'ok/AGENTS.md': 'same\n',
    'node_modules/dep/AGENTS.md': 'vendored\n',
  });
  const ctx = context(start(dir));
  assert.match(ctx, /differ: CLAUDE\.md .* AGENTS\.md/);
  assert.match(ctx, /pkg\/api\/AGENTS\.md exists, pkg\/api\/CLAUDE\.md does not/);
  assert.doesNotMatch(ctx, /ok\//);
  assert.doesNotMatch(ctx, /node_modules/);
  assert.match(ctx, /ask/i);
  assert.match(ctx, /themis:themis/);
});

test('parity: in a git repo, session start covers the directories above the working directory and skips ignored ones', () => {
  const dir = project({
    'CLAUDE.md': 'a\n', 'AGENTS.md': 'b\n', '.gitignore': 'dist/\n',
    'app/src/x.js': '', 'app/CLAUDE.md': 'app\n', 'dist/AGENTS.md': 'built\n',
  });
  if (git(dir, 'init', '-q').status !== 0) return;
  const ctx = context(start(join(dir, 'app', 'src')));
  assert.match(ctx, /differ: .*CLAUDE\.md/);
  assert.match(ctx, /app\/CLAUDE\.md exists/);
  assert.doesNotMatch(ctx, /dist/);
});

test('parity: after a shell command that names a rule file, a difference is reported', () => {
  const dir = project({ 'CLAUDE.md': 'a\n', 'AGENTS.md': 'a\n' });
  assert.equal(post(dir, 'Bash', { command: 'git checkout -- AGENTS.md' }), null);
  writeFileSync(join(dir, 'AGENTS.md'), 'older\n');
  assert.match(context(post(dir, 'Bash', { command: 'git checkout -- AGENTS.md' })), /differ/);
  assert.match(context(post(dir, 'PowerShell', { command: 'Copy-Item x CLAUDE.md' })), /differ/);
  assert.equal(post(dir, 'Bash', { command: 'npm test' }), null);
});

test('parity: can be turned off', () => {
  const env = { CLAUDE_PLUGIN_OPTION_PARITY: 'false' };
  const dir = project({ 'CLAUDE.md': 'mine\n', 'AGENTS.md': 'theirs\n', 'sub/CLAUDE.md': 'x\n' });
  assert.equal(pre(dir, 'Edit', { file_path: 'CLAUDE.md', old_string: 'mine', new_string: 'm' }, env), null);
  assert.equal(post(dir, 'Write', { file_path: 'sub/CLAUDE.md', content: 'x\n' }, env), null);
  assert.ok(!existsSync(join(dir, 'sub', 'AGENTS.md')));
  assert.equal(start(dir, env), null);
  assert.equal(decision(write(dir, 'x'.repeat(10000), 'AGENTS.md', env)), 'deny'); // the cap still applies
});

test('manifest, hooks and skill are consistent', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.version, '2.0.0');
  assert.deepEqual(Object.keys(manifest.userConfig), ['claude_md_cap', 'parity']);
  const hooksJson = readFileSync(join(hooks, 'hooks.json'), 'utf8');
  for (const f of hooksJson.match(/hooks\/[\w-]+\.mjs/g)) assert.ok(readFileSync(join(root, f)), f);
  // `if` takes one rule, so each shell and each file name needs its own handler
  for (const event of ['PreToolUse', 'PostToolUse'])
    for (const rule of ['Bash(*CLAUDE*)', 'Bash(*AGENTS*)', 'PowerShell(*CLAUDE*)', 'PowerShell(*AGENTS*)'])
      assert.ok(JSON.parse(hooksJson).hooks[event].some((m) => m.hooks.some((h) => h.if === rule)), `${event} ${rule}`);
  assert.deepEqual(readdirSync(join(root, 'skills')), ['themis']);
  assert.ok(!existsSync(join(root, 'agents')));
  const md = readFileSync(join(root, 'skills', 'themis', 'SKILL.md'), 'utf8').replace(/\r/g, '');
  assert.match(md, /^---\nname: themis\ndescription: "[^"]+"\nwhen_to_use: "[^"]+"/);
  assert.match(md, /AGENTS\.md/);
});
