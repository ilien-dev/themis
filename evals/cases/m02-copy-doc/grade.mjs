import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ dir, sh }) => {
  const orig = sh('git show HEAD:docs/guide.md').stdout;
  const kept = readFileSync(join(dir, 'docs/guide.md'), 'utf8') === orig;
  const extra = readdirSync(join(dir, 'docs')).filter((f) => f !== 'guide.md');
  return { pass: kept && extra.length > 0, notes: `originalKept=${kept} newFiles=${extra.join('|')}` };
};
