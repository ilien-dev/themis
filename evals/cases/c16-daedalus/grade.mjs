import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ dir, sh }) => {
  const branch = sh('git rev-parse --abbrev-ref HEAD').stdout.trim();
  const commits = Number(sh('git rev-list --count main..HEAD').stdout.trim() || 0) + (branch === 'main' ? Number(sh('git rev-list --count HEAD').stdout.trim()) - 1 : 0);
  const clean = sh('git status --porcelain -- src tests').stdout.trim() === '';
  const suite = sh('node --test 2>&1').status === 0;
  const ticket = readFileSync(join(dir, '.themis/tickets/01-search.md'), 'utf8');
  const ticked = (ticket.match(/- \[x\]/gi) || []).length;
  const pass = branch !== 'main' && commits >= 1 && clean && suite && ticked >= 2;
  return { pass, notes: `branch=${branch} commits=${commits} clean=${clean} suite=${suite} ticked=${ticked}` };
};
