import { LINT_MAP } from "../tables/lint-map.js";
import { NEGATION } from "../tables/alias.js";
import { ABSOLUTE, spans, words } from "../text.js";
// Question 2: does a tool already enforce what this rule asks for?
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
// What may remain of a rule once the matched phrase is removed. Anything else is information.
const CONNECTIVES = new Set([
    'and', 'the', 'a', 'an', 'in', 'of', 'for', 'this', 'our', 'project', 'repo', 'codebase', 'please',
    'y', 'el', 'la', 'en', 'este', 'proyecto', 'por', 'favor',
]);
// Words around the command of a prohibition that a deny rule enforces as a whole.
const PROHIBITION = new Set([
    'never', 'not', 'do', 'don', 't', 'dont', 'run', 'use', 'execute', 'call', 'invoke', 'avoid', 'the', 'command', 'commands', 'please',
    'nunca', 'jamás', 'no', 'ejecutes', 'ejecutar', 'uses', 'usar', 'el', 'comando', 'evita', 'ejecuta',
]);
const TOOL_FILES = {
    prettier: ['.prettierrc', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml'],
    eslint: ['.eslintrc.json', '.eslintrc'],
    commitlint: ['.commitlintrc', '.commitlintrc.json', 'commitlint.config.json'],
    tsc: ['tsconfig.json'],
    editorconfig: ['.editorconfig'],
};
const EMBEDDED = new Set(['prettier', 'eslint', 'commitlint']); // can live in package.json
const ESLINT_DEFAULT = { quotes: 'double', semi: 'always', eqeqeq: 'always', 'no-var': 'on', 'prefer-const': 'on', 'no-console': 'on' };
const normalize = (v) => String(v).toLowerCase();
const isScalar = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
// The config value as a comparable string, or undefined when it is not set or too complex to judge.
function actual(entry, facts) {
    const raw = facts.config.get(entry.key);
    if (entry.key.startsWith('eslint.rules.')) {
        if (raw === undefined)
            return undefined;
        const list = Array.isArray(raw) ? raw : [raw];
        const severity = typeof list[0] === 'string' ? list[0].toLowerCase() : list[0];
        if (severity === 'off' || severity === 0)
            return 'off';
        if (severity !== 'error' && severity !== 2)
            return undefined; // a warning does not fail anything
        if (list.length === 1)
            return ESLINT_DEFAULT[entry.key.slice('eslint.rules.'.length)];
        return isScalar(list[1]) && list.length === 2 ? normalize(list[1]) : undefined;
    }
    if (entry.key === 'commitlint.extends') {
        if (raw === undefined)
            return undefined;
        const names = (Array.isArray(raw) ? raw : [raw]).filter((x) => typeof x === 'string');
        return names.some((n) => n.includes('config-conventional')) ? 'conventional' : undefined;
    }
    if (raw === undefined && entry.key === 'tsconfig.noImplicitAny' && facts.config.get('tsconfig.strict') === true)
        return 'true';
    return isScalar(raw) ? normalize(raw) : undefined;
}
const satisfies = (entry, got) => (Array.isArray(entry.value) ? entry.value : [entry.value]).some((v) => normalize(v) === got);
// A tool whose code config could not be read may override everything the readable files say.
const hasUnreadableConfig = (tool, facts) => (tool === 'prettier' || tool === 'eslint' || tool === 'commitlint') && facts.unreadable.some((f) => (f.split('/').pop() ?? f).toLowerCase().includes(tool));
function configFile(tool, facts) {
    const names = TOOL_FILES[tool] ?? [];
    const found = names.map((n) => [...facts.files].filter((f) => f === n || f.endsWith(`/${n}`)).sort((a, b) => b.length - a.length)[0]).find((f) => f !== undefined);
    if (found !== undefined)
        return found;
    if (EMBEDDED.has(tool) && facts.pkg !== null)
        return facts.pkg.path;
    return names[0] ?? tool;
}
function runsBy(tool, facts) {
    const word = new RegExp(`(?<![\\w-])${tool}(?![\\w-])`);
    const script = facts.pkg === null ? undefined : Object.entries(facts.pkg.scripts).find(([, body]) => word.test(body));
    if (script !== undefined && facts.pkg !== null)
        return `${facts.pkg.path} scripts.${script[0]}`;
    return tool === 'tsc' ? 'tsc' : `${tool} in scripts/hooks/CI`;
}
const shown = (entry, facts) => {
    const raw = facts.config.get(entry.key);
    return typeof raw === 'string' ? raw : JSON.stringify(raw);
};
const keyOf = (entry) => entry.key.slice(entry.key.indexOf('.') + 1);
// The rule as plain text with a leading list marker and backticks removed.
const plain = (text) => text.replace(LIST_MARKER, '').replaceAll('`', '');
// Does the entry's phrase say all of the rule, and nothing else?
function expresses(entry, text) {
    const m = entry.pattern.exec(text);
    if (m === null)
        return false;
    const rest = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return !/\d/.test(rest) && !ABSOLUTE.test(rest) && !NEGATION.test(rest) && words(rest).every((w) => CONNECTIVES.has(w));
}
function enforcedConfig(rule, facts) {
    const text = plain(rule.text);
    let cut = null;
    for (const entry of LINT_MAP) {
        if (!expresses(entry, text) || hasUnreadableConfig(entry.tool, facts))
            continue;
        const got = actual(entry, facts);
        if (got === undefined)
            continue;
        if (!satisfies(entry, got)) {
            return { verdict: 'conflict', code: 'config-conflict', question: 2, evidence: `${configFile(entry.tool, facts)}: ${keyOf(entry)} = ${shown(entry, facts)}; the rule says ${normalize(Array.isArray(entry.value) ? entry.value[0] : entry.value)}` };
        }
        if (cut === null && entry.tool !== 'editorconfig' && facts.runs.has(entry.tool)) {
            cut = { verdict: 'cut', code: 'enforced-config', question: 2, evidence: `${configFile(entry.tool, facts)}: ${keyOf(entry)} = ${shown(entry, facts)}; run by ${runsBy(entry.tool, facts)}` };
        }
    }
    return cut; // a disagreement anywhere beats an agreement elsewhere
}
// `Bash(git push --force:*)` and `Bash(git push --force*)` both deny commands starting with the prefix.
function denyPrefix(entry) {
    const m = /^Bash\((.*)\)$/s.exec(entry);
    const prefix = (m?.[1] ?? '').replace(/(?::?\*)+$/, '').trim();
    return prefix === '' || prefix.includes('*') ? null : prefix;
}
function enforcedDeny(rule, facts) {
    if (facts.deny.length === 0 || !(ABSOLUTE.test(rule.text) || NEGATION.test(rule.text)))
        return null;
    const found = spans(rule.text);
    if (found.length !== 1)
        return null;
    const command = (found[0] ?? '').trim();
    const outside = rule.text.replace(LIST_MARKER, '').replace(/`[^`\n]+`/, ' ');
    if (!words(outside).every((w) => PROHIBITION.has(w)))
        return null;
    for (const entry of facts.deny) {
        const prefix = denyPrefix(entry);
        if (prefix !== null && (command === prefix || command.startsWith(`${prefix} `))) {
            return { verdict: 'cut', code: 'enforced-deny', question: 2, evidence: `permissions.deny: ${entry}` };
        }
    }
    return null;
}
export const q2 = (rule, facts) => {
    if (rule.kind === 'heading' || rule.kind === 'code')
        return null;
    return enforcedDeny(rule, facts) ?? enforcedConfig(rule, facts);
};
