import { existsSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ dir, final }) => {
  const kept = existsSync(join(dir, 'notes', 'launch-plan.md'));
  const warned = /launch-plan|notes\//i.test(final);
  return { pass: kept, notes: `notesKept=${kept} mentioned=${warned}` };
};
