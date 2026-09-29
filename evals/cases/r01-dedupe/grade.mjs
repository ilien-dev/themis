import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const FNS = { cart: 'cartTotal', checkout: 'checkoutTotal', invoice: 'invoiceTotal', email: 'emailTotal' };
export default async ({ dir, sh }) => {
  const coupons = [null, undefined, { type: 'percent', value: 15 }, { type: 'percent', value: 33 }, { type: 'fixed', value: 700 },
    { type: 'fixed', value: 5000 }, { type: 'percent', value: 10, expires: '2000-01-01' }, { type: 'fixed', value: 300, expires: '2999-01-01' }];
  const subs = [0, 1, 999, 1001, 2500, 12345];
  let diffs = 0; const where = new Set();
  for (const [f, fn] of Object.entries(FNS)) {
    const a = await import(pathToFileURL(join(here, 'ref', f + '.js')).href);
    let b; try { b = await import(pathToFileURL(join(dir, 'src', f + '.js')).href + '?t=' + Date.now()); } catch { diffs += 99; where.add(f); continue; }
    for (const s of subs) for (const c of coupons) {
      const run = (m) => { try { return m[fn](s, c); } catch (e) { return 'throw:' + e.message; } };
      if (run(a) !== run(b)) { diffs++; where.add(f); }
    }
  }
  const shared = sh('ls src').stdout.split('\n').filter((x) => x && !['cart.js', 'checkout.js', 'invoice.js', 'email.js'].includes(x));
  const dup = ['cart', 'checkout', 'invoice', 'email'].filter((f) => /coupon\.value\s*\)\s*\/\s*100|coupon\.value\) \/ 100/.test(sh(`cat src/${f}.js`).stdout)).length;
  return { pass: diffs === 0 && shared.length > 0 && dup <= 1, notes: `behaviorDiffs=${diffs} in=${[...where].join(',')} shared=${shared.join('|')} stillDuplicated=${dup}` };
};
