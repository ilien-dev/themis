import { ABSOLUTE, citedPaths, citedScripts, spans, words } from "../text.js";
import { BARE_FILE_EXT, unresolvedReference } from "./q7.js";
// Question 5: is this an absolute prohibition about a command or a path? A permission or a hook enforces it.
// First tokens that make a span with spaces a shell command rather than a code fragment.
const CLI = new Set([
    'git', 'npm', 'pnpm', 'yarn', 'bun', 'npx', 'node', 'deno', 'docker', 'make', 'rm', 'mv', 'cp', 'curl', 'wget', 'gh', 'kubectl',
    'terraform', 'python', 'python3', 'pip', 'pip3', 'uv', 'cargo', 'go', 'tsc', 'eslint', 'prettier', 'sudo', 'chmod', 'chown', 'ssh', 'scp',
    'helm', 'aws', 'gcloud', 'az', 'psql', 'mysql', 'redis-cli', 'dotnet', 'mvn', 'gradle', 'bundle', 'rake', 'composer', 'php', 'ruby',
]);
const NEVER = /^(?:never|under no circumstances|nunca|jamás)$/i;
// What may surround the command of an absolute that a deny entry or a hook holds whole. Any other word
// is a condition, a scope or a reason ("on production", "while `npm run dev` runs", "; use X") that
// an all-or-nothing permission would lose, so the rule stays.
const PROHIBITION = new Set([
    'never', 'under', 'no', 'circumstances', 'do', 'not', 'don', 't', 'dont', 'run', 'use', 'execute', 'call', 'invoke', 'avoid',
    'the', 'a', 'command', 'commands', 'please', 'ever', 'locally', 'here', 'yourself', 'manually', 'by', 'hand',
    'nunca', 'jamás', 'ejecutes', 'ejecutar', 'uses', 'usar', 'llames', 'el', 'la', 'comando', 'evita', 'a', 'mano', 'aquí', 'localmente',
]);
const REQUIREMENT = new Set([
    'always', 'run', 'use', 'execute', 'avoid', 'the', 'a', 'please', 'before', 'after', 'every', 'each', 'committing', 'commit', 'commits', 'pushing', 'push',
    'siempre', 'ejecuta', 'usa', 'evita', 'antes', 'de', 'del', 'hacer', 'cada', 'después',
]);
// What a tool call does to a file. A prohibition about a path is enforceable only when it names one of
// these: "never import from `src/db/`" is a design rule, not a permission.
const FILE_ACTION = new Set([
    'edit', 'modify', 'touch', 'write', 'overwrite', 'delete', 'remove', 'rename', 'change', 'commit', 'read', 'open',
    'edites', 'modifiques', 'toques', 'escribas', 'sobrescribas', 'borres', 'elimines', 'renombres', 'cambies', 'subas', 'leas', 'abras',
]);
export const q5 = (rule, facts) => {
    if (rule.kind === 'heading' || rule.kind === 'code')
        return null;
    const marker = ABSOLUTE.exec(rule.text)?.[0];
    if (marker === undefined)
        return null;
    if (unresolvedReference(rule, facts) !== null)
        return null; // kept with a note: the reference needs a look first
    const never = NEVER.test(marker);
    const all = spans(rule.text);
    // A bare name such as `Math.round` is a file only with a file extension or when the repository has it.
    const paths = new Set(citedPaths(rule.text).filter((p) => p.includes('/') || BARE_FILE_EXT.test(p) || facts.files.has(p)));
    // A command is a package script or starts with a known CLI; a fragment such as `as any` is not one.
    const isCommand = (s) => {
        const first = s.trim().split(/\s+/)[0] ?? '';
        return (/\s/.test(s.trim()) && CLI.has(first)) || citedScripts(`\`${s}\``).length > 0;
    };
    const command = all.find(isCommand);
    // A deny entry can forbid a file operation; nothing can require one ("always read `docs/x.md`").
    const path = command === undefined && never ? all.find((s) => paths.has(s.replaceAll('\\', '/'))) : undefined;
    const span = command ?? path;
    if (span === undefined)
        return null;
    const around = words(rule.text.replace(`\`${span}\``, ' '));
    const allowed = never ? PROHIBITION : REQUIREMENT;
    if (!around.every((w) => allowed.has(w) || (path !== undefined && FILE_ACTION.has(w))))
        return null;
    if (path !== undefined && !around.some((w) => FILE_ACTION.has(w)))
        return null;
    const answer = {
        verdict: 'move', code: 'absolute-command', question: 5,
        evidence: `absolute "${marker}" with \`${span}\``,
        // A deny rule can forbid but cannot require, so an "always" needs a hook.
        target: never ? 'permissions.deny or a hook' : 'a hook',
    };
    return answer;
};
