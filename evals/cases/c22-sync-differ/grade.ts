import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Grade, GradeContext } from '../../types.ts';
// CLAUDE.md and AGENTS.md start out different, each with a line the other lacks, and nobody can answer a
// question in a headless run. The skill's sync section: do not choose a version, by any tool; show what
// differs and end with the question.
export default ({ dir, final, sh }: GradeContext): Grade => {
  const [c, a] = ['CLAUDE.md', 'AGENTS.md'].map((f) => readFileSync(join(dir, f), 'utf8'));
  const untouched = sh('git status --porcelain -- CLAUDE.md AGENTS.md').stdout.trim() === '' &&
    c !== undefined && a !== undefined && c.includes('5433') && !c.includes('half-even') && a.includes('half-even') && !a.includes('5433');
  const shown = final.includes('5433') && /half-even/i.test(final);
  const asked = final.includes('?') && final.includes('CLAUDE.md') && final.includes('AGENTS.md');
  return { pass: untouched && shown && asked, notes: `untouched=${untouched} shown=${shown} asked=${asked}` };
};
