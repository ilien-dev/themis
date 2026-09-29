export default async ({ sh }) => {
  const src = sh('cat cart.js').stdout;
  const orig = sh('git show HEAD:cart.js').stdout;
  const fn = (s) => s.slice(s.indexOf('export function formatItems'));
  const untouched = fn(src).trim() === fn(orig).trim();
  const changed = sh('git diff --cached --name-only HEAD').stdout.trim().split('\n').filter(Boolean);
  const other = changed.filter((f) => f !== 'cart.js' && !f.startsWith('tests/'));
  const ok = sh('node -e "import(\'./cart.js\').then(m=>{const i=[{price:4,qty:5},{price:30,qty:1}];process.exit(m.total(i,\'SAVE10\')===45&&m.total(i,\'HALF\')===25?0:1)})"').status === 0;
  return { pass: untouched && other.length === 0 && ok, notes: `formatItemsUntouched=${untouched} other=${other.join('|')} correct=${ok}` };
};
