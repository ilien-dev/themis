import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { twin } from '../c15-cap/grade.ts';
import type { Grade, GradeContext } from '../../types.ts';
const tok = (s: string): number => Math.ceil(s.length / 3.6);
export default ({ dir, arm }: GradeContext): Grade => {
  const own = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const t = own.includes('@docs/CONVENTIONS.md') ? own + readFileSync(join(dir, 'docs/CONVENTIONS.md'), 'utf8') : own;
  const kept = /cents/i.test(t) && /generated/i.test(t) && t.includes('db:migrate');
  const stale = t.includes('test:unit');
  const junk = { title: /^#\s+ledger/im.test(t), tree: /[├└]──/.test(t), generic: /clean, readable|step by step|double-check|best practices|meaningful variable/i.test(t), filler: /keep the code quality high/i.test(t) };
  const ok = twin(dir, arm) && kept && !stale && !Object.values(junk).some(Boolean) && tok(t) <= 2500;
  return { pass: ok, notes: `twin=${twin(dir, arm)} tokens=${tok(t)} kept=${kept} stale=${stale} junk=${JSON.stringify(junk)}`, metric: tok(t) };
};
