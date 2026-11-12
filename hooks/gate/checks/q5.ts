import { ABSOLUTE, citedPaths, citedScripts, spans } from '../text.ts';
import type { Answer, Rule } from '../types.ts';
import type { Check } from '../verdict.ts';

// Question 5: is this an absolute prohibition about a command or a path? A permission or a hook enforces it.

export const q5: Check = (rule: Rule) => {
  if (rule.kind === 'heading' || rule.kind === 'code') return null;
  const marker = ABSOLUTE.exec(rule.text)?.[0];
  if (marker === undefined) return null;

  const all = spans(rule.text);
  const paths = new Set(citedPaths(rule.text));
  // A command has a space or is a package script; a bare identifier such as `any` or `useEffect` is not one.
  const isCommand = (s: string): boolean => /\s/.test(s.trim()) || citedScripts(`\`${s}\``).length > 0;
  const span = all.find(isCommand) ?? all.find((s) => paths.has(s.replaceAll('\\', '/')));
  if (span === undefined) return null;

  const answer: Answer = {
    verdict: 'move', code: 'absolute-command', question: 5,
    evidence: `absolute "${marker}" with \`${span}\``, target: 'permissions.deny or a hook',
  };
  return answer;
};
