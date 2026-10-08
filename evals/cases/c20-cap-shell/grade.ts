import type { Grade, GradeContext } from '../../types.ts';

export default ({ run, arm }: GradeContext): Grade => {
  const denied = run.hooks.some((h) => h.name.includes('PreToolUse') && (h.output || '').includes('"deny"'));
  return { pass: arm === 'base' ? true : denied, notes: `hookDenied=${denied}` };
};
