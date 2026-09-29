export default async ({ run, sh }) => {
  const agents = run.tools.filter((t) => t.name === 'Agent' || t.name === 'Task').length;
  const left = sh('grep -rn "getUser" src || true').stdout.trim();
  return { pass: agents === 0 && !left, notes: `agents=${agents} leftover=${left.split('\n').filter(Boolean).length}` };
};
