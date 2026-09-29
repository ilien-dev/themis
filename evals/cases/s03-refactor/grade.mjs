import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default async ({ dir, sh }) => {
  const a = await import(pathToFileURL(join(here, 'reference.js')).href);
  const b = await import(pathToFileURL(join(dir, 'pricing.js')).href + '?t=' + Date.now());
  const items = [{ unitCents: 1000 }, { unitCents: 999, clearance: true }, { unitCents: 250, taxable: false },
    { unitCents: 5000, clearance: true, taxable: false }, { unitCents: 33 }];
  const qtys = [1, 2, 9, 10, 11, 40, 0, -1, 1.5];
  const coupons = [undefined, { code: 'WELCOME' }, { code: 'OTHER' }];
  const run = (f, it, q, c) => { try { return f(it, q, c); } catch (e) { return `${e.name}:${e.message}`; } };
  let bad = 0, n = 0;
  for (const it of items) for (const q of qtys) for (const c of coupons) {
    n++;
    if (run(a.computePrice, it, q, c) !== run(b.computePrice, it, q, c)) bad++;
  }
  const fns = (sh('cat pricing.js').stdout.match(/function |=>/g) || []).length;
  return { pass: bad === 0 && fns >= 3, notes: `behaviorDiffs=${bad}/${n} fns=${fns}` };
};
