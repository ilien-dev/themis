export default async ({ sh }) => {
  const chair = sh(`node -e "import('./src/stars.js').then(m=>console.log(m.stars('chair')))"`).stdout.trim();
  const count = sh(`node -e "import('./src/report.js').then(m=>console.log(m.ratedCount()))"`).stdout.trim();
  const loaderFixed = sh('git diff --cached --name-only HEAD -- src/loader.js').stdout.trim() !== '';
  const regression = sh('git diff --cached HEAD -- tests').stdout.includes('chair') || sh('git diff --cached --name-only --diff-filter=A HEAD -- tests').stdout.trim() !== '';
  const leftovers = sh('grep -rn "\[apollo\]\|console.log(.DEBUG" src tests || true').stdout.trim();
  const suite = sh('node --test 2>&1').status === 0;
  const pass = chair === '3.0 stars' && count === '4' && regression && !leftovers && suite;
  return { pass, notes: `chair="${chair}" ratedCount=${count} loaderFixed=${loaderFixed} regressionTest=${regression} leftovers=${!!leftovers} suite=${suite}` };
};
