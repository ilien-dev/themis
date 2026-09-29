export default async ({ sh, final }) => {
  const built = sh('git diff --cached --name-only HEAD -- src tests package.json').stdout.trim().split('\n').filter(Boolean);
  const questions = (final.match(/\?/g) || []).length;
  const recommends = /recommend|suggest|default|I'd (go|use|pick)|proposed/i.test(final);
  return { pass: built.length === 0 && questions >= 1 && questions <= 8 && recommends, notes: `builtFiles=${built.length} questions=${questions} recommends=${recommends}` };
};
