import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const tok = (s) => Math.ceil(s.length / 3.6);
export default async ({ dir }) => {
  const p = join(dir, 'CLAUDE.md');
  if (!existsSync(p)) return { pass: false, notes: 'no CLAUDE.md' };
  const own = readFileSync(p, 'utf8');
  const t = /@docs\/CONVENTIONS\.md/.test(own) ? own + readFileSync(join(dir, 'docs/CONVENTIONS.md'), 'utf8') : own;
  const has = { cents: /cents/i.test(t), generated: /generated/i.test(t) && /gen\b|npm run gen/.test(t), migrate: /db:migrate/.test(t) };
  const junk = { title: /^#\s+ledger/im.test(t), tree: /[├└]──|^\s*src\/\s*$/m.test(t), overview: /bookkeeping service for freelancers/i.test(t) };
  const ok = Object.values(has).every(Boolean) && !Object.values(junk).some(Boolean) && tok(t) <= 2500;
  return { pass: ok, notes: `tokens=${tok(t)} has=${JSON.stringify(has)} junk=${JSON.stringify(junk)}`, metric: tok(t) };
};
