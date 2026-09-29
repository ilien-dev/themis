export default async ({ sh }) => {
  const g = sh('cat greet.js').stdout;
  const reused = /capitalize/.test(g) && /utils\/text/.test(g) && !/toUpperCase/.test(g);
  const ok = sh(`node -e "import('./greet.js').then(m=>process.exit(m.greet({name:'john'})==='Hello, John'?0:1))"`).status === 0;
  return { pass: reused && ok, notes: `reused=${reused} correct=${ok}` };
};
