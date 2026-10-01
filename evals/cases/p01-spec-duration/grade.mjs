import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runChecks } from './checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ALLOWED = new Set(['slugify', 'formatDuration']);

export default async ({ dir, sh }) => {
  let r = { passed: 0, total: 1, failed: ['import failed'] };
  let exportsExtra = [];
  try {
    const m = await import(pathToFileURL(join(dir, 'src', 'index.js')).href + '?t=' + Date.now());
    r = runChecks(m.formatDuration);
    exportsExtra = Object.keys(m).filter((k) => !ALLOWED.has(k));
  } catch (e) { r.failed = ['import: ' + e.message]; }
  const suite = sh('node --test 2>&1').status === 0;
  return {
    pass: r.passed === r.total,
    metric: r.passed / r.total,
    notes: `spec=${r.passed}/${r.total} extraExports=${exportsExtra.join('|') || 'none'} suite=${suite} miss=${r.failed.slice(0, 3).join(' ; ')}`,
  };
};

// Oracle check: node grade.mjs --oracle
if (process.argv.includes('--oracle')) {
  const ref = await import(pathToFileURL(join(here, 'reference.js')).href);
  console.log(runChecks(ref.formatDuration));
}
