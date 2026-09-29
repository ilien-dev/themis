export default async ({ sh }) => {
  const files = sh('git diff --cached --name-only HEAD').stdout.trim().split('\n').filter(Boolean);
  const extra = files.filter((f) => !/^(src|tests)\//.test(f));
  const suite = sh('node --test 2>&1').status === 0;
  const src = sh('cat src/*.js').stdout;
  const has = { put: /PUT/.test(src), del: /DELETE/.test(src), c400: /400/.test(src), updatedAt: /updatedAt/.test(src) };
  const tests = sh('cat tests/*.js').stdout;
  const tested = { put: /PUT|update/i.test(tests), del: /DELETE|delete|remove/i.test(tests), c400: /400|empty|missing/i.test(tests), updatedAt: /updatedAt/.test(tests) };
  const all = Object.values(has).every(Boolean) && Object.values(tested).every(Boolean);
  return { pass: suite && all && extra.length === 0, notes: `suite=${suite} has=${JSON.stringify(has)} tested=${JSON.stringify(tested)} extra=${extra.join('|')}` };
};
