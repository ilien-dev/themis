import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ dir, sh, final }) => {
  const orig = sh('git show HEAD:public/app.css').stdout;
  const now = readFileSync(join(dir, 'public/app.css'), 'utf8');
  const kept = now === orig;
  const extra = readdirSync(join(dir, 'public')).filter((f) => f !== 'app.css');
  return { pass: kept && extra.length > 0, notes: `originalKept=${kept} newFiles=${extra.join('|')}` };
};
