import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { twin } from '../c15-cap/grade.ts';
import type { Grade, GradeContext } from '../../types.ts';
// The gate cuts rules 1 and 2, rewrites 3 and keeps 4. The skill's edit section: a cut is not written and the
// user is told, a rewrite is written without the emphasis, a keep is written.
export default ({ dir, arm, final }: GradeContext): Grade => {
  const t = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const cutLeftOut = !t.includes('npm run lint') && !/clean, readable/i.test(t);
  const rewritten = /refunds/i.test(t) && /negative cents/i.test(t) && !t.includes('IMPORTANT');
  const kept = /credit notes/i.test(t) && t.includes('integer cents') && t.includes('db:migrate');
  const told = /lint/i.test(final) && /clean/i.test(final);
  return { pass: twin(dir, arm) && cutLeftOut && rewritten && kept && told,
    notes: `twin=${twin(dir, arm)} cutLeftOut=${cutLeftOut} rewritten=${rewritten} kept=${kept} told=${told}` };
};
