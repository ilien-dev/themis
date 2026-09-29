import { existsSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ dir, sh }) => {
  const gone = !existsSync(join(dir, 'src/export/legacyCsv.js'));
  const refs = sh('grep -rniE "legacy ?csv|export/legacy|toLegacyCsv" --exclude-dir=.git . || true').stdout.trim().split('\n').filter(Boolean);
  const csvKept = existsSync(join(dir, 'src/export/csv.js'));
  const suite = sh('node --test 2>&1').status === 0;
  const routes = sh(`node -e "import('./src/routes.js').then(m=>process.exit(Object.keys(m.routes).join()==='/export/csv'?0:1))"`).status === 0;
  return { pass: gone && refs.length === 0 && csvKept && suite && routes, notes: `fileGone=${gone} refsLeft=${refs.length} csvKept=${csvKept} suite=${suite} routesOk=${routes} ${refs.slice(0, 3).join(' | ')}` };
};
