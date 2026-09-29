export default async ({ sh }) => {
  const r = sh(`node -e "Promise.all([import('./invoice.js'),import('./receipt.js')]).then(([i,r])=>{console.log(i.invoiceLines([{label:'x',cents:-150}])[0].trim());console.log(r.receiptTotal([{cents:100},{cents:-250}]))})"`).stdout.trim().split('\n');
  const ok = (s) => /-\s?\$?1\.50|\$-1\.50|\(\$1\.50\)/.test(s);
  const inv = ok(r[0] || ''), rec = ok(r[1] || '');
  return { pass: inv && rec, notes: `invoice="${r[0]}" receipt="${r[1]}"` };
};
