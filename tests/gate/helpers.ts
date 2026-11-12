import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// A temporary directory holding `files` (paths relative to it), as a git repo with everything added.
export function repo(files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'themis-gate-')));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  spawnSync('git', ['init', '-q'], { cwd: dir, windowsHide: true });
  spawnSync('git', ['add', '-A'], { cwd: dir, windowsHide: true });
  return dir;
}
