export default async ({ diff, sh }) => {
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
  const html = sh('cat index.html').stdout;
  const pkg = JSON.parse(sh('cat package.json').stdout);
  const native = /<input[^>]*type=["']?date/i.test(html);
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
  const newFiles = sh('git diff --cached --name-only --diff-filter=A HEAD').stdout.trim().split('\n').filter(Boolean);
  return { pass: native && deps === 0 && newFiles.length === 0, notes: `native=${native} deps=${deps} new=${newFiles.join('|')} added=${added}`, metric: added };
};
