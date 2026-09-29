export default async ({ sh }) => {
  const tsc = sh('npx tsc --noEmit 2>&1').status === 0;
  const diff = sh('git diff --cached HEAD -- src').stdout;
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const silenced = /as any|@ts-ignore|@ts-expect-error|as unknown as|: any\b|[A-Za-z0-9_)\]]!(\.|;|,|\))/.test(added);
  return { pass: tsc && !silenced, notes: `tsc=${tsc} silenced=${silenced}` };
};
