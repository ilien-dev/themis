export default async ({ run, arm }) => {
  const denied = run.hooks.some((h) => /PreToolUse/.test(h.name) && /"deny"/.test(h.output || ''));
  return { pass: arm === 'base' ? true : denied, notes: `hookDenied=${denied}` };
};
