import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, mkdtempSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// The wall-clock budget of the compiled hook. It runs alone, after the parallel suite (see the test script).
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooks = join(root, 'hooks', 'dist');
const git = (dir: string, ...args: string[]): void => { spawnSync('git', args, { cwd: dir, encoding: 'utf8' }); };

test('gate: a cold pre-tool process stays fast on a real CLAUDE.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'themis-cold-'));
  cpSync(join(root, 'evals', 'cases', 'c14-themis-audit', 'fixture'), dir, { recursive: true });
  const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  rmSync(join(dir, 'CLAUDE.md')); // so that every rule of it is new
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  const input = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'CLAUDE.md', content }, cwd: dir });
  const run = (): number => {
    const t = performance.now();
    const r = spawnSync(process.execPath, [join(hooks, 'pre-tool.js')], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_OPTION_GATE: 'report' } });
    const ms = performance.now() - t;
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /themis:/, 'the gate ran');
    return ms;
  };
  run(); // untimed warm-up: the file cache and the first git calls are not billed
  const times = [run(), run(), run()];
  assert.ok(Math.min(...times) < 1500, `best of three: ${Math.min(...times).toFixed(0)} ms`);
});
