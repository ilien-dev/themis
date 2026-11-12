import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { twin } from '../c15-cap/grade.ts';
import type { Grade, GradeContext } from '../../types.ts';
// Both rules are kept with the note unresolved-reference. The first names a file that moved (addCents is
// exported by src/money.js), the second a directory that does not exist. The skill's edit section: repair the first,
// write the second as given and tell the user it did not resolve.
export default ({ dir, arm, final }: GradeContext): Grade => {
  const t = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const repaired = t.includes('addCents') && t.includes('src/money.js') && !t.includes('src/lib/money.js');
  const asGiven = t.includes('tests/fixtures/reports');
  const told = final.includes('tests/fixtures/reports');
  return { pass: twin(dir, arm) && repaired && asGiven && told, notes: `twin=${twin(dir, arm)} repaired=${repaired} asGiven=${asGiven} told=${told}` };
};
