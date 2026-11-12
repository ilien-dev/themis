import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { citedPaths, citedScripts, spans } from "../text.js";
// Question 7: does the rule point at something that is gone, or shout instead of explain?
const BUILTIN_SCRIPTS = new Set(['install', 'ci', 'test', 'start']); // npm brings these
// Package manager subcommands that are not scripts (the extraction already drops the npm ones).
const PM_COMMANDS = new Set([
    'workspace', 'workspaces', 'filter', 'store', 'fetch', 'import', 'prune', 'rebuild', 'outdated', 'list', 'ls', 'why', 'env', 'setup',
    'patch', 'deploy', 'licenses', 'dedupe', 'login', 'logout', 'whoami', 'unlink', 'info', 'node', 'global', 'bin', 'set', 'plugin', 'upgrade',
    'upgrade-interactive', 'check', 'owner', 'team', 'tag', 'policies', 'unplug', 'autoclean', 'run',
]);
// A flag that points the command at another package, whose scripts are not in this package.json.
const OTHER_PACKAGE = /\s(?:-w|-F|-C|--workspaces?|--filter|--prefix|--cwd|--dir)(?![\w-])/;
const EMPHASIS = /(?<![\p{L}\p{N}_])(IMPORTANT|CRITICAL|MUST|NEVER|ALWAYS|IMPORTANTE|CRÍTICO|NUNCA|SIEMPRE)(?![\p{L}\p{N}_])/u;
// A bare name such as `Node.js` or `socket.io` is a library, not a file; only these extensions mark a file.
const BARE_FILE_EXT = /\.(?:md|json|ya?ml|toml|tsx?|[cm]js|txt|sh|py|go|rs|css|html)$/i;
const EXT = /\.[A-Za-z0-9]{1,5}$/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const posix = (p) => p.replaceAll('\\', '/');
const fix = (evidence) => ({ verdict: 'fix', code: 'dead-reference', question: 7, evidence });
function topDirs(facts) {
    const out = new Set();
    for (const f of facts.files) {
        const i = f.indexOf('/');
        if (i > 0)
            out.add(f.slice(0, i));
    }
    return out;
}
// A file or a directory that exists, tracked or on disk, from the repo root or from the rule file's directory.
function alive(p, facts) {
    const starts = [p, posix(relative(facts.root, join(facts.dir, p)))];
    for (const f of facts.files)
        if (starts.some((s) => f === s || f.startsWith(`${s}/`)))
            return true;
    return existsSync(join(facts.root, p)) || existsSync(join(facts.dir, p));
}
function deadPath(raw, facts, dirs) {
    let p = posix(raw);
    while (p.startsWith('./'))
        p = p.slice(2);
    p = p.replace(/\/+$/, '');
    if (p === '' || p.startsWith('/') || p.startsWith('~') || p.startsWith('..') || /^[A-Za-z]:/.test(p))
        return false;
    if (alive(p, facts))
        return false;
    if (!p.includes('/'))
        return BARE_FILE_EXT.test(p);
    const first = p.split('/')[0] ?? '';
    if (existsSync(join(facts.root, first)) || existsSync(join(facts.dir, first)))
        return true;
    // The first segment is unknown: a URL path, a package subpath or a branch name unless it looks like this repo's.
    return EXT.test(p) || dirs.has(first);
}
export const q7 = (rule, facts) => {
    if (rule.kind === 'heading' || rule.kind === 'code')
        return null;
    if (facts.filesKnown) {
        const dirs = topDirs(facts);
        const dead = citedPaths(rule.text).find((p) => deadPath(p, facts, dirs));
        if (dead !== undefined)
            return fix(`\`${dead}\` not found`);
    }
    if (facts.pkg !== null && !spans(rule.text).some((s) => OTHER_PACKAGE.test(` ${s}`))) {
        const known = facts.pkg.scripts;
        const missing = citedScripts(rule.text).find((s) => !s.script.startsWith('-') && !BUILTIN_SCRIPTS.has(s.script) && !PM_COMMANDS.has(s.script) && !Object.hasOwn(known, s.script));
        if (missing !== undefined)
            return fix(`scripts.${missing.script} not in package.json`);
    }
    const outside = rule.text.replace(LIST_MARKER, '').replace(/`[^`\n]*`/g, ' ');
    const word = EMPHASIS.exec(outside)?.[1];
    if (word === undefined)
        return null;
    const a = { verdict: 'rewrite', code: 'emphasis', question: 7, evidence: `emphasis "${word}"` };
    return a;
};
