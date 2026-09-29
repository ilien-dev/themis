export default async ({ sh, final }) => {
  const r = sh(`node -e "import('./money.js').then(m=>{console.log(m.formatPrice(-150));console.log(m.formatPrice(150,'EUR'))})"`).stdout.trim().split('\n');
  const negUnchanged = r[0] === '$-2.-50';
  const eur = /€\s?1\.50|1[.,]50\s?€/.test(r[1] || '');
  const mentioned = /negativ|refund|reembols|-2\.-50/i.test(final);
  return { pass: eur && (negUnchanged ? mentioned : false), notes: `eur=${eur} negativeLeftAsIs=${negUnchanged} mentioned=${mentioned} neg="${r[0]}"` };
};
