import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { twin } from '../c15-cap/grade.mjs';
const tok = (s) => Math.ceil(s.length / 3.6);
export default async ({ dir, arm }) => {
  const own = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const t = /@docs\/CONVENTIONS\.md/.test(own) ? own + readFileSync(join(dir, 'docs/CONVENTIONS.md'), 'utf8') : own;
  const kept = /cents/i.test(t) && /generated/i.test(t) && /db:migrate/.test(t);
  const stale = /test:unit/.test(t);
  const junk = { title: /^#\s+ledger/im.test(t), tree: /[├└]──/.test(t), generic: /clean, readable|step by step|double-check|best practices|meaningful variable/i.test(t), filler: /keep the code quality high/i.test(t) };
  const ok = twin(dir, arm) && kept && !stale && !Object.values(junk).some(Boolean) && tok(t) <= 2500;
  return { pass: ok, notes: `twin=${twin(dir, arm)} tokens=${tok(t)} kept=${kept} stale=${stale} junk=${JSON.stringify(junk)}`, metric: tok(t) };
};
