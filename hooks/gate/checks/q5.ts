import { ABSOLUTE, citedPaths, citedScripts, spans } from '../text.ts';
import type { Answer } from '../types.ts';
import type { Check } from '../verdict.ts';
import { deadReference } from './q7.ts';

// Question 5: is this an absolute prohibition about a command or a path? A permission or a hook enforces it.

// First tokens that make a span with spaces a shell command rather than a code fragment.
const CLI = new Set([
  'git', 'npm', 'pnpm', 'yarn', 'bun', 'npx', 'node', 'deno', 'docker', 'make', 'rm', 'mv', 'cp', 'curl', 'wget', 'gh', 'kubectl',
  'terraform', 'python', 'python3', 'pip', 'pip3', 'uv', 'cargo', 'go', 'tsc', 'eslint', 'prettier', 'sudo', 'chmod', 'chown', 'ssh', 'scp',
  'helm', 'aws', 'gcloud', 'az', 'psql', 'mysql', 'redis-cli', 'dotnet', 'mvn', 'gradle', 'bundle', 'rake', 'composer', 'php', 'ruby',
]);
const NEVER = /^(?:never|under no circumstances|nunca|jamás)$/i;

export const q5: Check = (rule, facts) => {
  if (rule.kind === 'heading' || rule.kind === 'code') return null;
  const marker = ABSOLUTE.exec(rule.text)?.[0];
  if (marker === undefined) return null;
  if (deadReference(rule, facts) !== null) return null; // question 7 reports that first

  const all = spans(rule.text);
  const paths = new Set(citedPaths(rule.text));
  // A command is a package script or starts with a known CLI; a fragment such as `as any` is not one.
  const isCommand = (s: string): boolean => {
    const first = s.trim().split(/\s+/)[0] ?? '';
    return (/\s/.test(s.trim()) && CLI.has(first)) || citedScripts(`\`${s}\``).length > 0;
  };
  const span = all.find(isCommand) ?? all.find((s) => paths.has(s.replaceAll('\\', '/')));
  if (span === undefined) return null;

  const answer: Answer = {
    verdict: 'move', code: 'absolute-command', question: 5,
    evidence: `absolute "${marker}" with \`${span}\``,
    // A deny rule can forbid but cannot require, so an "always" needs a hook.
    target: NEVER.test(marker) ? 'permissions.deny or a hook' : 'a hook',
  };
  return answer;
};
